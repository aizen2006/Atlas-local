import { tool, run, type Tool } from "@openai/agents";
import { SandboxAgent, compaction, filesystem, memory, shell, type Capability } from "@openai/agents/sandbox";
import { UnixLocalSandboxClient } from "@openai/agents/sandbox/local";
import { existsSync, constants, openSync, closeSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import z from "zod";
import { models } from "../constants";
import { webSearch, webScrape, agenticSearch } from "./webSearch.tools";

// The sandbox runs commands through a POSIX shell and, when none is configured,
// falls back to a hard-coded "/bin/sh". On Windows that path does not exist, and
// the failure is quiet rather than loud: the command "completes" with exit code
// -4058 (ENOENT) and no output, so a sub-agent appears to run and returns
// nothing. It only seems to work when launched from Git Bash, which happens to
// set SHELL to a real .exe path — launch the same code from PowerShell and it
// silently produces empty results.
//
// So on Windows the shell is resolved explicitly, and if none is found the
// feature reports itself unsupported instead of failing invisibly.
const WINDOWS_SHELL_CANDIDATES = [
    process.env.SHELL,
    "C:/Program Files/Git/bin/bash.exe",
    "C:/Program Files/Git/usr/bin/bash.exe",
    "C:/Program Files (x86)/Git/bin/bash.exe",
    "C:/Program Files/Git/usr/bin/sh.exe",
];

function resolveSandboxShell(): string | undefined {
    // POSIX hosts already resolve /bin/sh correctly
    if (process.platform !== "win32") return undefined;
    return WINDOWS_SHELL_CANDIDATES.find((path) => path && existsSync(path));
}

const sandboxShell = resolveSandboxShell();

// Second, independent blocker. The sandbox materializes every workspace file
// with *numeric* open flags (O_WRONLY|O_CREAT|O_TRUNC|O_NOFOLLOW). Bun on
// Windows rejects numeric flags with EINVAL — the same call succeeds under Node
// on Windows, and succeeds in Bun when given a string flag like "w". So the
// sandbox fails on the first file write even once the shell resolves.
//
// Probed rather than version-sniffed, so this re-enables itself automatically if
// the runtime stops rejecting them.
function sandboxFileWritesWork(): boolean {
    const probe = join(tmpdir(), `atlas-sandbox-probe-${process.pid}`);
    try {
        closeSync(openSync(probe, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC));
        return true;
    } catch {
        return false;
    } finally {
        try { unlinkSync(probe); } catch { /* nothing to clean up */ }
    }
}

const hasShell = process.platform !== "win32" || Boolean(sandboxShell);
const fileWritesWork = sandboxFileWritesWork();

/**
 * Whether sub-agent delegation can actually run here. When false the caller
 * should leave the tool unregistered rather than offer something that fails
 * mid-task or returns empty output.
 */
export const subagentsSupported = hasShell && fileWritesWork;

export const subagentsUnsupportedReason = !hasShell
    ? "Sub-agents need a POSIX shell. Install Git for Windows (which provides bash.exe) and restart Atlas."
    : !fileWritesWork
      ? "The sandbox cannot write files on this runtime: Bun on Windows rejects the numeric file-open flags it uses. Running Atlas under Node, or on macOS/Linux, enables sub-agents."
      : "";

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
                    // defaultShell is undefined on POSIX, where the built-in
                    // /bin/sh fallback is correct
                    client:new UnixLocalSandboxClient({ defaultShell: sandboxShell })
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
