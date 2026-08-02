# Memory

Atlas separates two things that are easy to conflate:

- **Conversation history** — every message, in order, per session. Relational, complete,
  never summarized. Lives in your local SQLite database.
- **Memory** — a small set of distilled, reusable lessons drawn from past tasks. Lossy by
  design, retrieved by relevance rather than recency. Lives in
  [Supermemory](https://supermemory.ai).

History is what lets you reopen a conversation. Memory is what makes a *new* conversation
better than the last one.

## Local or cloud — you choose

| Config | Where memory lives |
|---|---|
| nothing set | **Local.** The Supermemory server and its embedding model run on your machine. Nothing leaves it. |
| `SUPERMEMORY_API_KEY` set | **Cloud.** Memories are stored on Supermemory's servers, using their tuned extraction models. |
| `SUPERMEMORY_BASE_URL` set | That endpoint, as-is — for a server you already run yourself. |

Local is the default, because sending your memories somewhere should be a deliberate act
rather than what happens when you don't configure anything. Atlas prints the active mode
on every boot:

```
Memory: local
```

Everything else — sessions, messages, experiences, skills, `SOUL.md` — stays on your disk
either way.

## What gets remembered

Almost nothing, on purpose. After each task the reflection agent decides whether anything
durable was learned, and defaults to no. A memory is written only when the task revealed
something that would change how a *different* task is handled later:

- a stable fact or preference about you
- an approach that worked, or failed, worth repeating or avoiding
- a durable detail about a project or recurring commitment
- a quirk of a tool or integration

Self-contained tasks — a calculation, a lookup, a rephrasing — teach nothing and are
logged as experiences without producing a memory.

| | |
|---|---|
| **Stored** | `Prefers very short emails and always signs off as Soubhik. Their manager is Priya.` |
| **Not stored** | `Self-contained arithmetic question; no durable preference or tool behaviour was learned.` |

## Why the bar is so high

Retrieval returns the nearest matches by similarity, regardless of quality. It has no
notion of "this one is junk" — it returns the closest results it can find. So every stored
triviality is a candidate to crowd out a real lesson.

That inverts the intuition: a memory system gets better by refusing to write, not by
writing more. Accumulated noise makes an assistant worse with use, and the damage is
invisible until you notice the answers drifting.

Supermemory will happily extract facts from anything handed to it — it has no opinion
about whether a task was worth learning from. **That judgement is Atlas's**, and it is why
the reflection agent still runs in front of it.

## When memory is read

Not on every turn. The planner decides whether a request actually needs past context —
"continue where we left off" does, "what is SQLite" does not — and retrieval only runs
when it says so. The `pipeline` summary returned with each response reports how many
memories were used, so this is visible rather than mysterious.

Standing preferences that should apply to *every* reply do not belong here at all — that
is what [`SOUL.md`](soul.md) is for. Memory is retrieved on demand and can be missed; your
soul is loaded every turn and cannot.

## Failure is soft

If the memory backend is unreachable, Atlas answers without recall and logs the failure
rather than returning an error. A reflection that cannot be stored still leaves its record
in `experiences`. Memory improves a turn; it is never a precondition for one.

## Resetting

Memories are not in your SQLite file, so deleting `memory.db` clears your conversations
but not what Atlas has learned. To clear memory, delete the Supermemory data directory
(local mode) or the stored memories in your account (cloud).
