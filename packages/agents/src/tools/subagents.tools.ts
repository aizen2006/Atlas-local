import { tool, run, type Tool } from "@openai/agents";
import { SandboxAgent, compaction, filesystem, memory, shell, type Capability } from "@openai/agents/sandbox";
import { UnixLocalSandboxClient } from "@openai/agents/sandbox/local";
import z from "zod";
import { models } from "../constants";
import { webSearch, webScrape, agenticSearch } from "./webSearch.tools";

{/*
    Fixed roster of subagent personas — the calling agent only picks a
    subagent_type and writes a self-contained prompt, it never invents a new
    persona per call. Each sub-agent runs in its own sandboxed workspace with
    no memory of the calling conversation, and only its final output is
    returned; its intermediate tool calls stay isolated.
*/}


// Have to make this so that it works in window's as well 


const SUBAGENT_TYPES = {
    general: {
        description:"Broad multi-step tasks: research, planning, drafting, or anything combining several tools.",
        instructions:`
        You are a general-purpose sub-agent spawned by Atlas to complete one focused task independently.
        Use the tools available to you as needed. Return only the final result Atlas asked for — no narration of your process.
        `,
        capabilities:[shell(),filesystem(),memory(),compaction()] as Capability[],
        tools:[webSearch,webScrape,agenticSearch]
    },
    researcher: {
        description:"Read-only web research and synthesis across multiple sources. Cannot write files or run shell commands.",
        instructions:`
        You are a research sub-agent spawned by Atlas. Your only job is to gather and synthesize information from the web.
        You do not have file or shell access — do not attempt to use them.
        Return a concise synthesis with the most relevant findings first.
        `,
        capabilities:[memory(),compaction()] as Capability[],
        tools:[webSearch,webScrape,agenticSearch]
    }
} as const;

const subagentTypeNames = Object.keys(SUBAGENT_TYPES) as [keyof typeof SUBAGENT_TYPES, ...(keyof typeof SUBAGENT_TYPES)[]];

export const createSubAgents : Tool = tool({
    name:`CreateSubAgents`,
    description: `
        Delegate a focused task to a specialized sub-agent that runs independently in its own sandboxed workspace.

        Use this when a task is complex, multi-step, would clutter the main conversation with intermediate research or tool calls, or benefits from a focused specialist persona.

        Available subagent_type values:
        - general: broad multi-step tasks (research, planning, drafting, multi-tool work).
        - researcher: read-only web research and synthesis, no file or shell access.

        The sub-agent starts with no memory of this conversation, so "prompt" must be a fully self-contained brief: the goal, the relevant context, and what a complete result looks like. Only the sub-agent's final result is returned to you — its intermediate steps are not visible.

        Do NOT use this for simple questions, short answers, or anything you can complete directly in this turn.
        `,
    parameters:z.object({
        subagent_type: z.enum(subagentTypeNames).describe("Which specialist persona to delegate to."),
        description: z.string().describe("A short (3-6 word) label for this task, for logging."),
        prompt: z.string().describe("A fully self-contained task brief for the sub-agent — it has no memory of this conversation.")
    }),
    async execute({subagent_type,description,prompt}){
        const config = SUBAGENT_TYPES[subagent_type];
        const agent = new SandboxAgent({
            name:`${subagent_type}-subagent`,
            model:models.subagent,
            instructions:config.instructions,
            capabilities:[...config.capabilities],
            tools:[...config.tools]
        });
        try {
            const result = await run(agent,prompt,{
                sandbox:{
                    client:new UnixLocalSandboxClient()
                }
            });
            return result.finalOutput;
        } catch (error) {
            console.error(`Sub-agent "${description}" (${subagent_type}) failed`,error);
            return {
                message:`Sub-agent failed to complete the task: ${description}`,
                error:String(error)
            };
        }
    }
})
