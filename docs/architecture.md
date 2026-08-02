# Architecture

Atlas is a Bun + Turborepo monorepo. A request does not just hit a model — it flows
through a cognitive loop, and the interesting part is what happens between the request
and the answer.

## The shape of a request

Everything routes through `POST /chat` (or `POST /chat/stream`), implemented in
[`apps/server/src/routes/chat.ts`](../apps/server/src/routes/chat.ts). Both share the
same front half — `prepareTurn` — and differ only in how the final answer is delivered.

1. **Title & session** — derive a title, resume or create a session, persist the user turn.
2. **Optimize the query** — rewrite a vague request into a sharp, unambiguous prompt.
3. **Plan** — the Planner returns a structured decision: does this task need a plan,
   memory, skills, or none of them?
4. **Retrieve** — only what step 3 asked for. Nothing is loaded speculatively.
5. **Act** — the Atlas agent answers, with whatever tools are configured.
6. **Reflect** — *after* the response is sent, so it never costs the caller latency.

Steps 3–4 are why Atlas only pays for planning and retrieval when a task warrants it.
The pipeline's decisions are returned to the UI as a `pipeline` summary and rendered as
chips, so you can see what it chose to do.

## The reflection loop

After every task a reflection agent sees what was asked and what happened, and decides
whether anything durable was learned. **Most of the time the answer is no** — and that
judgement is the whole feature.

Retrieval returns the nearest neighbours regardless of quality. If every interaction
became a memory, "what's 2+2" would compete for retrieval slots with "prefers short
emails, signs off as Soubhik", and the assistant would get *noisier* with use rather
than sharper. So the reflection agent returns `worthRemembering: false` for anything
self-contained, and only genuine lessons are stored.

Whatever survives is written to be read out of context, because it will surface next to
a future conversation that has nothing to do with the one that produced it.

## The agents

| Agent | Role |
|---|---|
| **Atlas** | The executive assistant. Holds the toolbelt and produces the user-facing answer. |
| **Planner** | Runs first. Decides which resources the task needs. Never answers the user. |
| **Reflection** | Runs after, in the background. Decides whether a durable lesson exists. |

The server also makes two direct model calls of its own: a title generator and a query
optimizer. Model IDs live in one place —
[`packages/agents/src/constants.ts`](../packages/agents/src/constants.ts).

## Layout

```
Atlas/
├── apps/
│   ├── server/          Hono HTTP server — entry point and orchestrator
│   │   └── src/
│   │       ├── atlas.ts     the `bun run atlas` launcher
│   │       ├── index.ts     Hono app, routes, static UI, skill sync
│   │       ├── routes/      chat · sessions
│   │       └── libs/        env · openai · port · utils
│   └── web/             React UI
│
└── packages/
    ├── agents/          agents, tools, integrations
    ├── memory/          SQLite persistence (Drizzle) + schema + migrations
    ├── skills/          SKILL.md playbooks
    └── ui/              shared component scaffold (currently unused)
```

## Data model

| Table | Holds |
|---|---|
| `sessions` | One conversation — title, timestamps |
| `messages` | Every user and agent turn, in order |
| `experiences` | A whole solved task: what was asked, what happened, the reflection drawn from it |
| `memories` | Distilled reusable lessons, with category, importance and confidence |
| `vec_memories` | Vector shadow table, keyed to `memories.id` |
| `skills` | Registry of `SKILL.md` playbooks on disk, synced at boot |
| `jobs` | Background work (currently reflection runs), for retry and debugging |

Schema lives in [`packages/memory/src/schema.ts`](../packages/memory/src/schema.ts) and
is applied automatically on boot. See [memory.md](memory.md) for how retrieval works.

## Sub-agents

Long or messy work gets delegated. `createSubAgents` spawns a sandboxed agent in its own
workspace with no memory of the calling conversation; only its final result comes back,
so intermediate tool calls never clutter the main thread.

| Persona | Capabilities | For |
|---|---|---|
| `general` | shell · filesystem · memory · compaction | Broad multi-step work |
| `researcher` | memory · compaction *(read-only)* | Web research and synthesis. No file or shell access, by construction |

Because Atlas runs on your machine, `general` having shell access is the same trust model
as any local dev tool. It is also why hosting Atlas multi-tenant is not a small change,
and part of why it stays local-first.
