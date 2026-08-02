import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { openai } from "../libs/openai";
import { runAgent , runAgentStream, planner_agent, createAtlas, reflection_agent } from "@repo/agents";
import { db, messages, sessions, jobs, experiences } from "@repo/memory";
import { models } from "@repo/agents";
import { eq } from "drizzle-orm";
import { loadSkills, listEnabledSkills } from "../libs/utils";
import { recall, remember } from "../libs/memory";
import { loadPersona } from "../libs/soul";
import { subagentsEnabled } from "../libs/settings";

const chat = new Hono();

function render(
    template: string,
    variables: Record<string, string>
) {
    return template.replace(
    /{{(\w+)}}/g,
    (_, key) => variables[key] ?? `{{${key}}}`
    );
}

// the Flow 
// Query 
// -> planner 
// -> optimze the Prompt & load skill's and memory 
// -> send's to LLM and returns response
// -> create a job -> create's experience 
// -> call reflection agent 
// -> Create's Memory 
// -> End
interface Conversation {
    role:"agent" | "user" | null,
    content:string | null
}


// whether Atlas planned, recalled memory, or loaded skills.
interface PipelineSummary {
    planned: boolean,
    memoriesUsed: number,
    skills: string[]
}

// The shared front half of a turn: resolve or create the session, persist the
// user message, optimize the query, run the planner, and retrieve memory +
// skills into a ready-to-send prompt. Both the JSON and the streaming route
// call this; only the final "act" step (buffered vs streamed) differs.
async function prepareTurn(query:string,sessionId?:number):Promise<{
    sessionId:number,
    prompt:string,
    agent:ReturnType<typeof createAtlas>,
    pipeline:PipelineSummary
}>{
    let conversations : Conversation[] = [];

    //Check's sessionId & create a new if not exists
    if(!sessionId){
        // a title is only needed for a brand-new session
        const title = await openai.responses.create({
            model:models.title,
            instructions:"Your role is to analyze the user's query and derive a sutable title for this conversation",
            input:query,
            reasoning:{effort:"none"}
        });
        const [session] = await db.insert(sessions).values({title:title.output_text}).returning({id:sessions.id});
        if(!session) throw new Error("Failed to create session");
        sessionId = session.id;
    }else{
        conversations = await db
            .select({role:messages.role,content:messages.content})
            .from(messages)
            .where(eq(messages.sessionId,sessionId));
    }

    // store's the user's message
    await db.insert(messages).values({sessionId,role:"user",content:query});

    const promptTemplate = `
    UserQuery:{{query}}

    Plan:{{plan}}

    Context:{{memory}}

    Skills:{{skills}}

    Conversation:{{conversation}}
    `;
    const promptVars: Record<string,string> = {
        query,
        plan: "No plan was required.",
        memory: "No relevant memory found.",
        skills: "No relevant skills found.",
        conversation: conversations.length
            ? conversations.map(m=>`${m.role}: ${m.content}`).join("\n")
            : "No prior conversation.",
    };

    //Optimize the Prompt
    const response = await openai.responses.create({
        model: models.optimizer,
        instructions: `
        You are an expert AI Prompt Engineer and Query Optimizer. Your job is to analyze poorly phrased, vague, or inefficient user queries and rewrite them into highly effective, clear, and actionable prompts that yield the best possible AI responses.

        ### Optimization Rules:
        1. Clarify intent and fill in missing context.
        2. Define a clear role/persona for the AI if necessary.
        3. Specify the desired format, tone, or constraints.
        4. Keep it concise but comprehensive.

        ### Examples:

        [Input Query]: "Can you help"
        [Optimized Prompt]: "I need assistance with a task. Please ask me 2-3 clarifying questions to understand what I am trying to achieve so you can help me effectively."

        [Input Query]: "write an email to my boss about being sick"
        [Optimized Prompt]: "Write a professional and polite email to my manager informing them that I cannot come to work today due to illness. Keep it brief, mention that I will check my emails periodically if urgent, and thank them for understanding."

        [Input Query]: "python loop"
        [Optimized Prompt]: "Explain how a 'for' loop works in Python. Provide a simple, real-world code example and break down the syntax step-by-step for a beginner."

        [Input Query]: {{USER_QUERY}}
        [Optimized Prompt]:
        `,
        input: query,
        reasoning:{effort:"low"}
    });

    promptVars.query = response.output_text;

    // The planner used to decide whether skills were needed without being told
    // which skills exist, so it had to guess — and guessed "no" for requests a
    // registered skill covered exactly. It now chooses from the actual catalog.
    const catalog = await listEnabledSkills();
    const plannerInput = `
    Request:
    ${response.output_text}

    Available skills:
    ${catalog.length
        ? catalog.map(s=>`- ${s.name}: ${s.description ?? "(no description)"}`).join("\n")
        : "(none registered)"}
    `;

    // planner agent
    const planner_output = await runAgent(planner_agent,plannerInput);

    const pipeline: PipelineSummary = { planned:false, memoriesUsed:0, skills:[] };

    // checks if plans exist and injects the plan into the prompt
    if(planner_output?.resources.plan){
        if(!planner_output.plan) throw new Error("Failed to get the plan")
        promptVars.plan = planner_output.plan;
        pipeline.planned = true;
    }
    // Memory layer
    if(planner_output?.resources.memory){
        // later make the number of results returned dynamic
        const memoryHits = await recall(query,3);
        if(memoryHits.length){
            promptVars.memory = memoryHits.map(m=>`- ${m}`).join("\n");
            pipeline.memoriesUsed = memoryHits.length;
        }
    }
    // skills layer
    if(planner_output?.resources.skills && planner_output.skills.length){
        const skillNames = planner_output.skills.map(s=>s.name);
        const loadedSkills = await loadSkills(skillNames);
        if(loadedSkills.length){
            promptVars.skills = loadedSkills.map(s=>`### ${s.name}\n${s.content}`).join("\n\n");
            pipeline.skills = loadedSkills.map(s=>s.name);
        }
    }

    // one render, all placeholders resolved
    const prompt = render(promptTemplate,promptVars);

    // The persona is read per turn and goes into the agent's *instructions*, not
    // the prompt above — it describes the person, not the request. Building the
    // agent here rather than importing a singleton is what lets an edit to
    // SOUL.md take effect on the next message instead of the next restart.
    const agent = createAtlas({
        persona: await loadPersona(),
        subagentsEnabled: await subagentsEnabled(),
    });

    return { sessionId, prompt, agent, pipeline };
}

// non-streaming — the full answer arrives at once after the pipeline completes
chat.post('/',async(c)=>{
    try {
        const { query , sessionId } = await c.req.json();
        const prepared = await prepareTurn(query,sessionId);

        // call main agent layer
        const main_output = await runAgent(prepared.agent,prepared.prompt);
        if(!main_output) throw new Error("Failed to get a response from Atlas");

        // store's the agent's reply
        await db.insert(messages).values({sessionId:prepared.sessionId,role:"agent",content:main_output});

        // create a job -> create's experience -> call reflection agent -> Create's Memory
        // runs after the response is sent, so it never adds latency to the client
        void runReflectionPipeline(prepared.sessionId,query,main_output);

        return c.json({sessionId:prepared.sessionId,response:main_output,pipeline:prepared.pipeline});
    } catch (error) {
        console.error(error);
        return c.json({message:"Failed to process the request"},500);
    }
})


chat.post('/stream',async(c)=>{
    const { query , sessionId } = await c.req.json();
    return streamSSE(c,async(stream)=>{
        try {
            const prepared = await prepareTurn(query,sessionId);
            await stream.writeSSE({
                event:"meta",
                data:JSON.stringify({sessionId:prepared.sessionId,pipeline:prepared.pipeline})
            });

            const textStream = await runAgentStream(prepared.agent,prepared.prompt);
            let full = "";
            for await (const chunk of textStream){
                const delta = chunk.toString();
                if(!delta) continue;
                full += delta;
                await stream.writeSSE({event:"token",data:JSON.stringify(delta)});
            }

            // store's the agent's reply, then reflect in the background
            await db.insert(messages).values({sessionId:prepared.sessionId,role:"agent",content:full});
            void runReflectionPipeline(prepared.sessionId,query,full);

            await stream.writeSSE({event:"done",data:JSON.stringify({sessionId:prepared.sessionId})});
        } catch (error) {
            console.error(error);
            await stream.writeSSE({event:"error",data:JSON.stringify({message:"Failed to process the request"})});
        }
    });
})


// Reflextion pipeline
async function runReflectionPipeline(sessionId:number,task:string,result:string){
    let jobId: number | undefined;
    try {
        // create a job
        const [job] = await db.insert(jobs).values({
            type:"reflect",
            payload:{sessionId,task},
            status:"running"
        }).returning({id:jobs.id});
        if(!job) throw new Error("Failed to create job");
        jobId = job.id;

        // create's experience
        const [experience] = await db.insert(experiences).values({
            sessionId,
            task,
            success:true,
            result
        }).returning({id:experiences.id});
        if(!experience) throw new Error("Failed to create experience");

        // call reflection agent
        const reflection_output = await runAgent(reflection_agent,`
        Task: ${task}

        Result: ${result}
        `);

        if(reflection_output?.text){
            // the reflection is always logged against the experience, even when it is
            // just an explanation of why nothing was worth keeping
            await db.update(experiences)
                .set({reflection:reflection_output.text})
                .where(eq(experiences.id,experience.id));

            // Store the lesson — only when the reflection agent judged it durable.
            // Supermemory extracts facts from whatever it is given and has no notion
            // of "this one is junk", so this gate is what keeps accumulated trivia
            // from crowding out real lessons at retrieval time.
            if(reflection_output.worthRemembering){
                await remember({
                    task,
                    result,
                    summary:reflection_output.text,
                    category:reflection_output.category,
                    importance:reflection_output.importance,
                    confidence:reflection_output.confidence,
                    experienceId:experience.id,
                    sessionId
                });
            }
        }

        await db.update(jobs)
            .set({status:"completed",completedAt:new Date()})
            .where(eq(jobs.id,job.id));
    } catch (error) {
        console.error("Reflection pipeline failed",error);
        if(jobId !== undefined){
            await db.update(jobs)
                .set({status:"failed",error:String(error)})
                .where(eq(jobs.id,jobId));
        }
    }
}

export default chat;