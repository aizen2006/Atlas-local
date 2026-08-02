// must come first — see libs/env.ts. The launcher starts at the repo root while
// `bun run dev` starts in apps/server, and both need the same config.
import "./libs/env";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app } from "./index";
import { resolvePort } from "./libs/port";

// apps/server/src -> apps/web
const WEB_DIR = join(import.meta.dir, "../../web");
const WEB_DIST = join(WEB_DIR, "dist");

// Build the web UI on first run (or after a clean). The server serves the
// static output, so the dist folder must exist before we start listening.
if (!existsSync(join(WEB_DIST, "index.html"))) {
    console.log("Building the Atlas web UI (first run)...");
    const build = Bun.spawnSync(["bun", "run", "build"], {
        cwd: WEB_DIR,
        stdout: "inherit",
        stderr: "inherit",
    });
    if (!build.success) {
        console.error("Web build failed. See the output above.");
        process.exit(1);
    }
}

const port = await resolvePort(3932);

Bun.serve({
    port,
    idleTimeout: 255, // keep long SSE streams alive
    fetch: app.fetch,
});

const url = `http://localhost:${port}`;
console.log(`\n  Atlas is running at ${url}\n`);

openBrowser(url);

// Open the default browser to the app, per-platform. Failure is non-fatal — the
// URL is printed above, so the user can always open it themselves.
function openBrowser(target: string) {
    const command =
        process.platform === "win32"
            ? ["cmd", "/c", "start", "", target]
            : process.platform === "darwin"
              ? ["open", target]
              : ["xdg-open", target];
    try {
        Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
    } catch {
        // ignore — the URL is already printed
    }
}
