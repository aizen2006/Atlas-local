import { Hono } from "hono";
import { readSoul, writeSoul, SOUL_PATH, SOUL_MAX_BYTES } from "../libs/soul";

const settingsRoute = new Hono();

// SOUL.md is user-authored: Atlas reads it before every reply and never writes
// to it. These endpoints are the only writer.
settingsRoute.get("/soul", async (c) => {
    const content = await readSoul();
    return c.json({
        content,
        path: SOUL_PATH,
        maxBytes: SOUL_MAX_BYTES,
        bytes: Buffer.byteLength(content, "utf-8"),
    });
});

settingsRoute.put("/soul", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    if (typeof body?.content !== "string") {
        return c.json({ message: "Body must be { content: string }" }, 400);
    }

    // The cap is refused rather than truncated: this rides on every request, and
    // silently dropping the end of what someone wrote is worse than saying no.
    const bytes = Buffer.byteLength(body.content, "utf-8");
    if (bytes > SOUL_MAX_BYTES) {
        return c.json(
            {
                message: `Too long: ${bytes} bytes, limit is ${SOUL_MAX_BYTES}. This is loaded on every message, so it has to stay short.`,
                bytes,
                maxBytes: SOUL_MAX_BYTES,
            },
            413,
        );
    }

    try {
        await writeSoul(body.content);
    } catch (error) {
        console.error(`Failed to write ${SOUL_PATH}`, error);
        return c.json({ message: "Could not save the file" }, 500);
    }

    // takes effect on the next message — the agent is rebuilt per turn
    return c.json({ ok: true, bytes, path: SOUL_PATH });
});

export default settingsRoute;
