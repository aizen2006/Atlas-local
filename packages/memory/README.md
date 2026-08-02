# @repo/memory

Atlas's persistence layer: a [Drizzle ORM](https://orm.drizzle.team) schema over local **SQLite** (via `bun:sqlite`). Conversations, the record of every task Atlas has worked through, the skill registry and user settings live here, on disk.

Memories do **not**. They live in Supermemory — see `src/supermemory.ts` — which owns their embedding, storage and retrieval.

## What it exports

`src/index.ts` opens the SQLite connection, sets `WAL` + foreign-key PRAGMAs, applies any pending migrations on boot, and exports:

- **`db`** — the Drizzle client, bound to `bun:sqlite`.
- **the schema** — all tables re-exported from `src/schema.ts`.
- **`supermemory`** — the memory adapter (`ingestionMemory`, `searchMemory`, document CRUD), which resolves to a local server, cloud, or an explicit endpoint depending on the environment.

## Tables

| Table | Holds |
| -------------- | -------------------------------------------------------------------------- |
| `sessions` | Conversation threads (title, timestamps). |
| `messages` | Every user/agent turn, linked to a session. |
| `experiences` | A whole solved task: task, result, reflection, success flag, confidence. |
| `skills` | An index of available `SKILL.md` playbooks (name, description, path, stats). |
| `jobs` | Background work (e.g. the reflection pipeline), with status and retries. |
| `settings` | User toggles that persist across restarts. |

## Memory

Memory is not stored in this database. `src/supermemory.ts` wraps the Supermemory client
and picks a backend from the environment:

- nothing set → local server, started on demand, embeddings on your machine
- `SUPERMEMORY_API_KEY` → cloud
- `SUPERMEMORY_BASE_URL` → that endpoint, as-is

The client is built lazily, so a missing key is never a boot failure.

## Migrations

Managed by [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) (config in `drizzle.config.ts`), output to `src/migrations/`.

```bash
bunx drizzle-kit generate    # after editing src/schema.ts
bunx drizzle-kit migrate     # apply pending migrations
```

## Environment

| Variable | Purpose |
| --------------- | -------------------------------------------------- |
| `DB_FILE_NAME` | Path to the SQLite database, e.g. `./src/memory.db`. |

Set it in `packages/memory/.env` (Drizzle Kit reads it; the connection is opened from the same value).
