// What the server's pipeline decided for a turn — mirrors the `pipeline` field
// on the /chat response and the `meta` SSE event.
export interface PipelineSummary {
    planned: boolean;
    memoriesUsed: number;
    skills: string[];
}

export type Role = "user" | "agent";

export interface ChatMessage {
    id: string;
    role: Role;
    content: string;
    pipeline?: PipelineSummary; // agent turns only
    error?: string; // set when the turn failed
}

export interface SessionSummary {
    id: number;
    title: string | null;
    createdAt: string;
    lastOpenedAt: string;
}

// A SKILL.md playbook in the registry. Atlas can write these itself, so the UI
// exists to make that visible and reversible.
export interface SkillSummary {
    id: number;
    name: string;
    description: string | null;
    enabled: boolean;
    usageCount: number | null;
    successRate: number | null;
    createdAt: string;
}
