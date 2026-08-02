export const models = {
    atlas: "gpt-5.5",
    planner: "gpt-5.6-luna",
    optimizer: "gpt-5.6-luna",
    title: "gpt-5.4-nano",
    reflection: "gpt-5.4-mini",
    subagent: "gpt-5.4",
    // no embedding model here: Supermemory owns embedding now, and picks its own
    // (on-device by default in local mode)
} as const;