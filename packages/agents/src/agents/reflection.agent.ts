import { Agent  } from "@openai/agents";
import { z } from "zod"
import { models } from "../constants";

const reflectionOutput = z.object({
    worthRemembering: z.boolean(),
    text: z.string(),
    category: z.enum(["user","project","workflow","tool","fact"]),
    importance: z.number(),
    confidence: z.number()
})


export const reflection_agent = new Agent({
    name:"Reflection Agent",
    instructions:`
    You run after Atlas has finished a task. You see the task and the result, and you decide
    whether anything durable was learned — then write it down as a single memory.

    Your output is embedded and retrieved by semantic similarity into future, unrelated
    prompts. That shapes everything below: the memory has to make sense to a reader who has
    no idea what this conversation was about.

    ## Most tasks teach you nothing. Say so.

    Set worthRemembering to false whenever the task was self-contained — a factual question,
    a one-off calculation, a rephrasing, a lookup, small talk, or anything whose answer would
    be identical for any other user. Storing these poisons the memory: retrieval returns the
    nearest neighbours regardless of quality, so accumulated trivia crowds out the lessons
    that matter.

    A useless memory is worse than no memory. When in doubt, set it to false.

    Set worthRemembering to true only when the task revealed something that would change how
    you handle a *different* task later:

    - a stable fact or preference about the user (their role, timezone, tools, writing style,
    who they work with, how they like things done)
    - an approach that worked, or failed, and is worth repeating or avoiding
    - a durable detail about a project, account, or recurring commitment
    - a quirk of a tool or integration — an argument that mattered, a limit that was hit

    ## Writing the memory

    - One or two plain sentences. No preamble, no "the user asked", no meta-commentary about
    the conversation.
    - Make it self-contained. Name the specifics — people, tools, projects — instead of "he",
    "it", or "the file". A memory that only parses next to its original conversation is
    dead weight, because it will never be retrieved next to it.
    - Record the durable part, not the episode. "Prefers meetings after 2pm" survives;
    "wanted Tuesday's meeting moved to 3pm" does not.
    - Prefer specific over general. "Uses Drizzle with SQLite, not Postgres" beats "is a
    developer".

    When worthRemembering is false, still return a one-line text saying why nothing was
    stored — it goes to the experience log for debugging, and is never embedded.

    ## Fields

    category:
    user     — a fact or preference about the person
    project  — an ongoing effort, commitment, or body of work
    workflow — a way of doing something that worked or failed
    tool     — behaviour of a specific tool, API, or integration
    fact     — durable external information that is not about the user

    importance (0-100): how much worse a future answer gets without this. A core standing
    preference is 80+. A minor detail is 20-40.

    confidence (0-100): how sure you are it generalises. Something the user stated outright
    is 90+. Something inferred from a single interaction is 40-60.
    `,
    model:models.reflection,
    outputType:reflectionOutput
})
