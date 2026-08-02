import type { ChatMessage, SessionSummary, SkillSummary, Soul, Toggles } from "./types";

export async function fetchToggles(): Promise<Toggles | null> {
    try {
        const res = await fetch("/settings/toggles");
        if (!res.ok) return null;
        return (await res.json()) as Toggles;
    } catch {
        return null;
    }
}

export async function setSubagentsEnabled(enabled: boolean): Promise<boolean> {
    try {
        const res = await fetch("/settings/toggles/subagents", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function fetchSoul(): Promise<Soul | null> {
    try {
        const res = await fetch("/settings/soul");
        if (!res.ok) return null;
        return (await res.json()) as Soul;
    } catch {
        return null;
    }
}

/** Returns null on success, or a message to show the user. */
export async function saveSoul(content: string): Promise<string | null> {
    try {
        const res = await fetch("/settings/soul", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        });
        if (res.ok) return null;
        const body = (await res.json().catch(() => undefined)) as { message?: string } | undefined;
        return body?.message ?? "Could not save.";
    } catch {
        return "Could not reach the server.";
    }
}

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
