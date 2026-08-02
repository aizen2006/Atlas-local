import { readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * SOUL.md — a small, always-loaded document describing how the user works and
 * talks. It is injected into Atlas's instructions on every turn, which is what
 * separates it from memory: vocabulary and tone are wrong *by omission* on any
 * turn they are missing, so they must never depend on a retrieval decision.
 *
 * The user owns this file. Atlas reads it and never writes to it — a persona
 * that edits itself drifts, and the correction loop ("open it and delete the
 * wrong line") only works if what is in there is exactly what you put there.
 *
 * Because it is loaded unconditionally it cannot grow the way memory can:
 * memory scales because retrieval filters it, and this has no filter. Hence the
 * size cap below.
 */

// Lives beside the database — persona and memories are the same class of
// personal data and should move together if DB_FILE_NAME is repointed.
export const SOUL_PATH = process.env.SOUL_FILE_NAME
    ? resolve(process.env.SOUL_FILE_NAME)
    : join(dirname(resolve(process.env.DB_FILE_NAME ?? "memory.db")), "SOUL.md");

/** Refused above this. Roughly 40 lines of prose — it rides on every request. */
export const SOUL_MAX_BYTES = 4096;

const TEMPLATE = `# Soul

How you want Atlas to work with you. Atlas reads this before every reply and
never edits it — everything here is yours.

Delete the prompts and write in your own words. Blank sections are ignored.

## Voice
<!-- How should Atlas talk to you? Direct? Warm? Short? -->

## Vocabulary
<!-- Words you use, and words you don't. e.g. "say ship, not deploy" -->

## Working style
<!-- How you want work delivered. e.g. "recommendation first, options after" -->
`;

export async function readSoul(): Promise<string> {
    if (!existsSync(SOUL_PATH)) return TEMPLATE;
    try {
        return await readFile(SOUL_PATH, "utf-8");
    } catch (error) {
        console.error(`Could not read ${SOUL_PATH}`, error);
        return TEMPLATE;
    }
}

export async function writeSoul(content: string): Promise<void> {
    await writeFile(SOUL_PATH, content, "utf-8");
}

// Comments are authoring scaffolding, not instructions — strip them so the
// placeholder prompts in an unedited file never reach the model as if they were
// things the user actually said.
function stripScaffolding(raw: string): string {
    return raw
        .replace(/<!--[\s\S]*?-->/g, "")
        .split("\n")
        .filter((line) => !/^\s*(Delete the prompts|How you want Atlas|never edits it)/.test(line))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * The persona block for this turn, or "" when the file is absent or still only
 * headings. Returning "" matters: an empty scaffold must not be injected as if
 * it described someone.
 */
export async function loadPersona(): Promise<string> {
    const stripped = stripScaffolding(await readSoul());

    // headings alone carry no information about the user
    const withoutHeadings = stripped.replace(/^#.*$/gm, "").trim();
    if (!withoutHeadings) return "";

    return stripped;
}

/** Logged at boot: an always-on document quietly becoming the biggest thing in
 *  the prompt is exactly the failure the cap exists to catch. */
export function soulStatus(): string {
    if (!existsSync(SOUL_PATH)) return `Soul: none yet (${SOUL_PATH})`;
    const bytes = statSync(SOUL_PATH).size;
    const over = bytes > SOUL_MAX_BYTES ? " — OVER LIMIT, trim it" : "";
    return `Soul: ${SOUL_PATH} (${bytes} bytes${over})`;
}
