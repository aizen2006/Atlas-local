# Sub-agents

When a task is long, messy, or would fill the conversation with intermediate tool calls,
Atlas can hand it to a sub-agent. The sub-agent runs in its own sandboxed workspace with
no memory of your conversation, and only its final result comes back.

You can turn this off in **Settings**.

## The two personas

| Persona | Capabilities | For |
|---|---|---|
| `general` | shell · filesystem · memory · compaction | Broad multi-step work: research, planning, drafting |
| `researcher` | memory · compaction *(read-only)* | Web research and synthesis. No file or shell access, by construction |

Atlas picks the persona and writes a self-contained brief, because the sub-agent starts
with no context from your chat.

## Trust model

`general` gets shell access. That is the same trust model as any local dev tool — it is
your machine, running your task, started by you. It is also exactly why running Atlas
multi-tenant is not a small change, and part of why it stays local-first.

If that's more latitude than you want, turn sub-agents off in Settings. The tool is then
removed from Atlas entirely — not just blocked at call time, but absent from what the
model can see, along with the instructions describing it.

## Platform support

| Runtime | Works |
|---|---|
| macOS, Linux | Yes |
| Windows + Node | Yes |
| **Windows + Bun** | **No** |

Atlas runs on Bun, so **sub-agents are unavailable on Windows today.** Settings shows the
switch as *Unavailable* with the reason, rather than letting you enable something that
would fail.

### Why

Two separate problems, and only the second is a hard blocker.

**1. The shell.** The sandbox runs commands through a POSIX shell and falls back to a
hard-coded `/bin/sh` when none is configured. That path doesn't exist on Windows. It
failed quietly rather than loudly — exit code `-4058` and empty output, so a sub-agent
looked like it ran and returned nothing.

Confusingly, it *did* work when Atlas was launched from Git Bash, which sets `SHELL` to a
real `bash.exe` path. Launch the identical code from PowerShell and it silently produced
nothing.

Atlas now resolves a shell explicitly on Windows, so this no longer depends on which
terminal you started from.

**2. Numeric file-open flags — the real blocker.** The sandbox materializes every
workspace file with numeric flags (`O_WRONLY | O_CREAT | O_TRUNC | O_NOFOLLOW`). Bun on
Windows rejects numeric flags with `EINVAL`:

| Runtime | `open(path, 769)` | `open(path, "w")` |
|---|---|---|
| Bun on Windows | `EINVAL` | OK |
| Node on Windows | OK | OK |

So the sandbox fails on its first file write, even once the shell resolves. This is a
runtime limitation, not something the sandbox or Atlas is doing wrong — `O_NOFOLLOW` is
irrelevant here, since it's `undefined` on Windows and the call fails identically without
it.

### If you need sub-agents on Windows

Run the server under Node instead of Bun, or run Atlas on macOS or Linux.

Atlas **probes** for both conditions at startup rather than checking the platform name, so
if a future Bun release accepts numeric flags, sub-agents switch themselves back on with
no code change.
