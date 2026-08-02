import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";


// apps/server/src/libs -> repo root
const ROOT = resolve(import.meta.dir, "../../../..");

const CANONICAL = join(ROOT, ".env");

// Earlier layouts kept keys next to whichever package used them. Still honoured
// so an existing checkout keeps working, but they no longer set the convention.
const LEGACY = [
    join(ROOT, "apps", "server", ".env"),
    join(ROOT, "packages", "agents", ".env"),
    join(ROOT, "packages", "memory", ".env"),
];

if (existsSync(CANONICAL)) config({ path: CANONICAL, quiet: true });

for (const path of LEGACY) {
    if (!existsSync(path)) continue;
    // `override: false` is the default — whatever the canonical file already set
    // wins, so a stray legacy file cannot silently shadow the real config.
    config({ path, quiet: true });
    console.warn(`env: reading ${path.slice(ROOT.length + 1)} — move these keys to .env at the repo root`);
}

// The database is an implementation detail of running Atlas, not something a
// user should have to name before their first run. Matches the historical
// default so an existing memory.db is still found.
process.env.DB_FILE_NAME ??= join(ROOT, "packages", "memory", "src", "memory.db");

// Fail on the way in, with the fix, rather than somewhere deep in a model call.
if (!process.env.OPENAI_API_KEY) {
    console.error(
        [
            "",
            "  Atlas needs an OpenAI API key to start.",
            "",
            `  Create ${CANONICAL.slice(ROOT.length + 1)} in ${ROOT}`,
            "  and add:",
            "",
            "      OPENAI_API_KEY=sk-...",
            "",
            "  Get one at https://platform.openai.com/api-keys",
            "",
        ].join("\n"),
    );
    process.exit(1);
}
