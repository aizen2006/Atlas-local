import { Hono } from "hono";
import { db, sessions, messages } from "@repo/memory";
import { eq, asc, desc } from "drizzle-orm";

const sessionsRoute = new Hono();

// list conversations for the sidebar, most-recently-opened first
sessionsRoute.get("/", async (c) => {
    const rows = await db
        .select({
            id: sessions.id,
            title: sessions.title,
            createdAt: sessions.createdAt,
            lastOpenedAt: sessions.lastOpenedAt,
        })
        .from(sessions)
        .orderBy(desc(sessions.lastOpenedAt));
    return c.json(rows);
});

// the turns of one conversation, in order, so the UI can re-open it
sessionsRoute.get("/:id/messages", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ message: "Invalid session id" }, 400);

    const rows = await db
        .select({ role: messages.role, content: messages.content })
        .from(messages)
        .where(eq(messages.sessionId, id))
        .orderBy(asc(messages.id));

    // opening a session bumps it to the top of the list next time
    await db.update(sessions).set({ lastOpenedAt: new Date() }).where(eq(sessions.id, id));

    return c.json(rows);
});

export default sessionsRoute;
