import { db, settings } from "@repo/memory";
import { eq } from "drizzle-orm";
import { subagentsSupported } from "@repo/agents";

/**
 * Persisted user toggles. Values are stored as text so adding a setting never
 * needs a migration.
 */

export const SUBAGENTS_KEY = "subagents.enabled";

async function readSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, key));
    return row?.value;
}

async function writeSetting(key: string, value: string): Promise<void> {
    await db
        .insert(settings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/**
 * Sub-agent delegation. Defaults to whether the platform can actually run it —
 * on a machine with no POSIX shell the honest default is off, because the
 * alternative is a tool that returns empty output and looks like a bug.
 *
 * An explicit choice always wins over the default, but it can never turn the
 * feature on where it cannot run.
 */
export async function subagentsEnabled(): Promise<boolean> {
    if (!subagentsSupported) return false;
    const stored = await readSetting(SUBAGENTS_KEY);
    return stored === undefined ? true : stored === "true";
}

export async function setSubagentsEnabled(enabled: boolean): Promise<void> {
    await writeSetting(SUBAGENTS_KEY, enabled ? "true" : "false");
}
