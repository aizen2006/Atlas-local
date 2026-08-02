import { supermemory } from "@repo/memory";

/**
 * Atlas's curated memory, backed by Supermemory.
 *
 * Everything here fails soft. Memory is an enhancement to a turn, not a
 * precondition for one: if the backend is down or misconfigured, Atlas should
 * answer without recall rather than return an error to the user. The reflection
 * pipeline already runs detached, so a failed write costs nothing either.
 */

/**
 * containerTag scopes reads and writes. Atlas is single-tenant, so rather than
 * isolating users these separate curated agent memory from document corpora,
 * which will live under their own tags.
 *
 * Hyphen, not a colon: the API restricts tags to alphanumerics with hyphens,
 * underscores and dots.
 */
export const MEMORY_TAG = "atlas-memory";

export interface RememberArgs {
    /** what the user asked */
    task: string;
    /** what Atlas did */
    result: string;
    /** the reflection agent's one-line summary of the lesson */
    summary: string;
    category: "user" | "project" | "workflow" | "tool" | "fact";
    importance: number;
    confidence: number;
    experienceId: number;
    sessionId: number;
}

/**
 * Store a lesson. Called only when the reflection agent judged the task worth
 * remembering — that gate is the reason memory quality holds up, since
 * Supermemory will happily extract facts from anything handed to it.
 *
 * The raw task and result go in rather than only the distilled line, so
 * Supermemory's own extraction has the context it needs to build graph edges.
 * The distilled summary rides along as metadata.
 */
export async function remember(args: RememberArgs): Promise<void> {
    try {
        await supermemory.ingestionMemory({
            userId: MEMORY_TAG,
            content: `Task: ${args.task}\n\nResult: ${args.result}\n\nLesson: ${args.summary}`,
            metadata: {
                summary: args.summary,
                category: args.category,
                importance: args.importance,
                confidence: args.confidence,
                experienceId: args.experienceId,
                sessionId: args.sessionId,
            },
        });
    } catch (error) {
        console.error("Memory write failed — the lesson is still in experiences", error);
    }
}

/**
 * Retrieve relevant memories for a query. Returns their text, most relevant
 * first; an empty array means "nothing relevant" or "backend unavailable", and
 * the caller treats both the same way.
 */
export async function recall(query: string, limit = 3): Promise<string[]> {
    try {
        const response = await supermemory.searchMemory({
            q: query,
            userId: MEMORY_TAG,
            // "memories" mode returns nothing for these entries even once the
            // document reports status=done — verified against a live backend,
            // where the same query scored 0.763 under hybrid and 0 under
            // memories. Separation from document corpora comes from MEMORY_TAG
            // rather than the search mode, so hybrid is safe here.
            searchMode: "hybrid",
            limit,
            threshold: 0.5,
        });

        return (response.results ?? [])
            // memory results carry `memory`; chunk results carry `chunk`
            .map((r) => r.memory ?? r.chunk ?? "")
            .map((text) => text.trim())
            .filter(Boolean);
    } catch (error) {
        console.error("Memory recall failed — answering without it", error);
        return [];
    }
}

/** Which backend is in use, for the boot log. */
export const memoryMode = supermemory.supermemoryMode;
