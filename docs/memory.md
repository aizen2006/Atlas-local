# Memory

> **Status:** this page describes the current SQLite + vector implementation. The memory
> layer is being moved onto [Supermemory](https://supermemory.ai) — local by default,
> cloud optional — which will replace most of what is below. This page is rewritten when
> that lands.

Atlas separates two things that are easy to conflate:

- **Conversation history** — every message, in order, per session. Relational, complete,
  never summarized.
- **Memory** — a small set of distilled, reusable lessons drawn from past tasks. Lossy by
  design, retrieved by relevance rather than recency.

History is what lets you reopen a conversation. Memory is what makes a *new* conversation
better than the last one.

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

Each memory carries a `category` (`user`, `project`, `workflow`, `tool`, `fact`), an
`importance`, and a `confidence` the agent assigns itself.

## Why the bar is so high

Retrieval returns the nearest neighbours in embedding space regardless of quality. It has
no notion of "this one is junk" — it returns the closest *k* it can find. So every stored
triviality is a candidate to crowd out a real lesson.

That inverts the intuition: a memory system gets better by refusing to write, not by
writing more. Accumulated noise makes an assistant worse with use, and the damage is
invisible until you notice the answers drifting.

## When memory is read

Not on every turn. The planner decides whether a request actually needs past context —
"continue where we left off" does, "what is SQLite" does not — and retrieval only runs
when it says so. The `pipeline` summary returned with each response reports how many
memories were used, so this is visible rather than mysterious.

## Where it lives

One SQLite file, `packages/memory/src/memory.db` by default. Memories and their vectors
are written and deleted as a pair. To wipe everything Atlas has learned, stop it and
delete that file — it is recreated empty on the next boot.
