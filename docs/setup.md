# Setup

Atlas runs entirely on your machine. Getting it going is three steps.

## 1. Install

You need [Bun](https://bun.sh) 1.3 or newer.

```bash
git clone https://github.com/aizen2006/Atlas.git
cd Atlas
bun install
```

## 2. Add your API key

Create a file called `.env` in the **repo root** (the same folder as `package.json`):

```bash
OPENAI_API_KEY=sk-...
```

That is the only required setting. Get a key at
[platform.openai.com/api-keys](https://platform.openai.com/api-keys).

If it is missing, Atlas tells you so on startup and exits — it will not fail halfway
through your first request.

### Optional settings

| Variable | Default | What it does |
|---|---|---|
| `FIRECRAWL_API_KEY` | — | Enables web research. Without it Atlas starts normally and the `webSearch`, `webScrape`, and `agenticSearch` tools are simply not offered to the model. |
| `DB_FILE_NAME` | `packages/memory/src/memory.db` | Where your local database lives. Set it to move or share the file. |
| `SOUL_FILE_NAME` | `SOUL.md` beside the database | Your persona file — see [soul.md](soul.md). |
| `PORT` | `3000` (dev) / `3932` (launcher) | Port for the HTTP server. The launcher picks another free port automatically if this one is taken. |

> **`.env` location:** the repo root is the canonical spot. Keys left in
> `apps/server/.env` or `packages/agents/.env` are still read so older checkouts keep
> working, but Atlas prints a notice asking you to consolidate them.

## 3. Run

```bash
bun run atlas
```

This builds the web UI on first run, starts the server, and opens your browser. The
database schema is created and kept up to date automatically — there is no migration
command to run.

To develop against the server alone, without the UI build or browser:

```bash
cd apps/server
bun run dev
```

Then talk to it directly:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"query":"What is on my plate this week?"}'
```

The response includes a `sessionId`. Pass it back on the next request to continue the
same conversation.

## Where your data lives

Everything is rows in one SQLite file — by default `packages/memory/src/memory.db`.
Conversations, the lessons Atlas draws from them, and the vectors it searches them by
never leave your disk. The only thing that crosses the network is the prompt for the
request you just made.

To start over, stop Atlas and delete that file. It is recreated on the next boot.

## Troubleshooting

**`Atlas needs an OpenAI API key to start`** — create `.env` in the repo root as above.
Check the file is named exactly `.env`, not `.env.txt`.

**`Cannot find module '@repo/...'`** — a stale workspace link, usually after a package
was renamed or removed. `bun install` does not always prune these; delete
`apps/server/node_modules/@repo` and re-run `bun install`.

**Port already in use** — `bun run atlas` falls back to a random free port and prints
the URL. `bun run dev` does not; set `PORT` to something else.

**Web research isn't working** — check `FIRECRAWL_API_KEY` is set. Without it the tools
are deliberately not registered, so Atlas will tell you it has no web access rather
than pretending to search.

**Sub-agent delegation fails** — sub-agents currently use a Unix-only sandbox client and
do not run on Windows. See [subagents.md](subagents.md) once that lands; until then,
this is a known gap rather than a misconfiguration.
