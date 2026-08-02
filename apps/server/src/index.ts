// must come first — loads .env and applies defaults before any module that
// reads process.env at import time (@repo/memory, the OpenAI client)
import './libs/env'
import { Hono } from 'hono'
import { join } from 'node:path'
import chat  from './routes/chat'
import sessions from './routes/sessions'
import skills from './routes/skills'
import settings from './routes/settings'
import { soulStatus } from './libs/soul'
import { memoryMode } from './libs/memory'
import { syncSkills } from './libs/utils'

export const app = new Hono()

// the built web UI lives here; anchored off import.meta.dir so it resolves the
// same whether the server is launched from apps/server (bun run dev) or the
// repo root (npm run atlas).  apps/server/src -> apps/web/dist
const WEB_DIST = join(import.meta.dir, "../../web/dist");

// pick up any SKILL.md added or edited on disk since the last boot.
// not awaited — a local directory scan finishes long before the first request
// gets through title generation and planning to actually ask for a skill.
void syncSkills()
  .then((count)=>console.log(`Synced ${count} skill(s)`))
  .catch((err)=>console.error("Skill sync failed",err));

// the persona rides on every request, so its size is worth seeing at a glance
console.log(soulStatus());

// which memory backend is live — "cloud" here means memories leave the machine,
// so it should never be a surprise
console.log(`Memory: ${memoryMode}`);

// routes

app.route('/chat',chat);
app.route('/sessions',sessions);
app.route('/skills',skills);
app.route('/settings',settings);

// lightweight liveness check — used by the launcher and the UI to confirm the
// server is reachable without spending a model call.
app.get('/health',(c)=>c.json({ok:true}));

// serve the built SPA for everything else. Any path that maps to a real file in
// the dist folder is served as-is; every other GET falls back to index.html so
// client-side routing works. Falls through to notFound when the UI isn't built.
app.get('/*',async(c,next)=>{
  const path = c.req.path === '/' ? '/index.html' : c.req.path;
  const file = Bun.file(join(WEB_DIST,path));
  if(await file.exists()) return new Response(file);

  const index = Bun.file(join(WEB_DIST,'index.html'));
  if(await index.exists()) return new Response(index);

  return next();
});

// global error handling

app.onError((err, c) => {
  console.error(`${err}`)
  return c.text('Error happend while handling your request', 500)
});

// not
app.notFound((c)=>{
  return c.text("The Route is Not Found",404)
})


// default export drives `bun run dev` (and any `bun run src/index.ts`): Bun
// serves this object. idleTimeout is raised so long SSE streams aren't cut.
// The `npm run atlas` launcher imports { app } and serves it on a resolved port.
export default {
  port: Number(process.env.PORT) || 3000,
  idleTimeout: 255,
  fetch: app.fetch,
}
