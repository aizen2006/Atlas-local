import { Hono } from "hono";
import { db, skills } from "@repo/memory";
import { eq, desc } from "drizzle-orm";
import { rm } from "node:fs/promises";
import { dirname } from "node:path";

// Atlas can write its own SKILL.md playbooks, which means it edits its own
// instruction set. These routes exist so that is inspectable and reversible from
// the UI rather than something that only happens on disk.
const skillsRoute = new Hono();

skillsRoute.get("/", async (c) => {
    const rows = await db
        .select({
            id: skills.id,
            name: skills.name,
            description: skills.description,
            enabled: skills.enabled,
            usageCount: skills.usageCount,
            successRate: skills.successRate,
            createdAt: skills.createdAt,
        })
        .from(skills)
        .orderBy(desc(skills.createdAt));
    return c.json(rows);
});

// enable / disable — a disabled skill stays on disk and in the registry but is
// never returned to the planner, so it cannot be loaded into a turn
skillsRoute.patch("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ message: "Invalid skill id" }, 400);

    const body = await c.req.json().catch(() => undefined);
    if (typeof body?.enabled !== "boolean") {
        return c.json({ message: "Body must be { enabled: boolean }" }, 400);
    }

    const [updated] = await db
        .update(skills)
        .set({ enabled: body.enabled })
        .where(eq(skills.id, id))
        .returning({ id: skills.id, name: skills.name, enabled: skills.enabled });

    if (!updated) return c.json({ message: "Skill not found" }, 404);
    return c.json(updated);
});

skillsRoute.delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ message: "Invalid skill id" }, 400);

    const [row] = await db.select().from(skills).where(eq(skills.id, id));
    if (!row) return c.json({ message: "Skill not found" }, 404);

    // remove the registry entry first: if the disk delete fails, a skill that is
    // no longer listed is a better outcome than one listed but unreadable
    await db.delete(skills).where(eq(skills.id, id));

    try {
        // each skill owns its directory — SKILL.md's parent
        await rm(dirname(row.path), { recursive: true, force: true });
    } catch (error) {
        console.error(`Removed "${row.name}" from the registry but could not delete ${row.path}`, error);
        return c.json({ id, name: row.name, deletedFiles: false });
    }

    return c.json({ id, name: row.name, deletedFiles: true });
});

export default skillsRoute;
