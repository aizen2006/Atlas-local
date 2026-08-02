# Soul

`SOUL.md` is a short document describing how you work and how you want to be talked to.
Atlas reads it before every reply.

**You write it. Atlas never does.**

Open it from **Settings** in the sidebar.

## Why it isn't just a memory

Atlas has three places it keeps things, and they differ in *when they get read*:

| | Read when | Holds |
|---|---|---|
| Memory | the planner decides the task needs past context | many small facts, retrieved by relevance |
| Skills | a skill's description matches the request | one procedure, loaded whole |
| **Soul** | **every single turn** | one short always-on document |

That distinction is the entire point. "Sign off as Soubhik" or "say ship, not deploy" are
wrong *by omission* — if they don't reach the model on some turn, the reply is wrong, and
nobody notices why. Anything retrieved on demand can be missed. Soul can't be.

The flip side is that Soul has no filter. Memory can grow indefinitely because retrieval
picks a handful of relevant items; everything in Soul is in every request, forever. That is
why it is capped, and why it should stay short.

## What to put in it

Standing facts about you and how you want work delivered:

```markdown
## Voice
Be direct. Skip the preamble. If I ask for one sentence, give exactly one.

## Vocabulary
Say "ship", never "deploy".
Our users are "members", not "customers".

## Working style
Give me the recommendation first, then the options.
Sign emails off as Soubhik.
My manager is Priya; my co-founder is Dev.
```

Things that do **not** belong here:

- Anything about one specific task — that is what the conversation is for.
- A procedure with steps — that is a [skill](../packages/skills), which Atlas can write
  itself and only loads when it matches.
- Long background documents — those will be document ingestion, once that lands.

## Rules that make it work

- **It outranks the general guidelines.** Where your soul conflicts with Atlas's built-in
  instructions, yours wins. It describes you specifically; the defaults describe everyone.
- **It applies on your next message.** No restart. Save and send.
- **4 KB limit, enforced by refusal.** Saving something too long fails and leaves the file
  untouched, rather than silently truncating what you wrote. If you hit it, the honest fix
  is to cut, not to raise the cap — remember this is in every request.
- **An unedited file does nothing.** The starter template is all headings and comments, and
  those are stripped before the model sees anything, so a blank scaffold is never presented
  as though it described you.

## Where it lives

Beside your database — by default `packages/memory/src/SOUL.md`, next to `memory.db`.
Persona and memories are the same class of personal data, so they move together if you
repoint `DB_FILE_NAME`.

Override with `SOUL_FILE_NAME`. It's gitignored, and it's a plain markdown file — editing
it in your own editor works exactly as well as the Settings panel.

To reset, delete the file. The starter template comes back on the next read.
