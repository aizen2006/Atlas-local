import { Hono } from "hono";
import { readSoul, writeSoul, SOUL_PATH, SOUL_MAX_BYTES } from "../libs/soul";
import { subagentsEnabled, setSubagentsEnabled } from "../libs/settings";
import { subagentsSupported, subagentsUnsupportedReason } from "@repo/agents";

const settingsRoute = new Hono();

// Toggles. `supported` is reported separately from `enabled` so the UI can
// explain *why* something is off rather than showing a switch that silently
// refuses to move.
settingsRoute.get("/toggles", async (c) => {
    return c.json({
        subagents: {
            enabled: await subagentsEnabled(),
            supported: subagentsSupported,
            reason: subagentsSupported ? null : subagentsUnsupportedReason,
        },
    });
});

settingsRoute.put("/toggles/subagents", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    if (typeof body?.enabled !== "boolean") {
        return c.json({ message: "Body must be { enabled: boolean }" }, 400);
    }
    if (body.enabled && !subagentsSupported) {
        return c.json({ message: subagentsUnsupportedReason }, 409);
    }

    await setSubagentsEnabled(body.enabled);
    // applies on the next message — the agent is rebuilt per turn
    return c.json({ enabled: await subagentsEnabled(), supported: subagentsSupported });
});

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
