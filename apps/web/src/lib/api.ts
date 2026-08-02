import type { ChatMessage, SessionSummary, SkillSummary } from "./types";

export async function fetchSessions(): Promise<SessionSummary[]> {
    try {
        const res = await fetch("/sessions");
        if (!res.ok) return [];
        return (await res.json()) as SessionSummary[];
    } catch {
        return [];
    }
}

export async function fetchSkills(): Promise<SkillSummary[]> {
    try {
        const res = await fetch("/skills");
        if (!res.ok) return [];
        return (await res.json()) as SkillSummary[];
    } catch {
        return [];
    }
}

// These two return a boolean rather than swallowing failures: the panel shows
// the registry's real state, so a silent no-op would leave the UI lying about
// whether a skill is active.
export async function setSkillEnabled(id: number, enabled: boolean): Promise<boolean> {
    try {
        const res = await fetch(`/skills/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function deleteSkill(id: number): Promise<boolean> {
    try {
        const res = await fetch(`/skills/${id}`, { method: "DELETE" });
        return res.ok;
    } catch {
        return false;
    }
}

export async function fetchSessionMessages(id: number): Promise<ChatMessage[]> {
    try {
        const res = await fetch(`/sessions/${id}/messages`);
        if (!res.ok) return [];
        const rows = (await res.json()) as { role: "user" | "agent"; content: string | null }[];
        // historical turns carry no pipeline metadata
        return rows.map((row, i) => ({
            id: `s${id}-${i}`,
            role: row.role,
            content: row.content ?? "",
        }));
    } catch {
        return [];
    }
}
