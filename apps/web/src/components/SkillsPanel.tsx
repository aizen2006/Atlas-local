import { useEffect, useState } from "react";
import { Trash, X } from "@phosphor-icons/react";
import { deleteSkill, fetchSkills, setSkillEnabled } from "../lib/api";
import type { SkillSummary } from "../lib/types";

/**
 * The registry of SKILL.md playbooks. Atlas can write these itself, which means
 * it edits its own instruction set — so this panel exists to make that visible
 * and reversible without touching the filesystem.
 *
 * Disabling keeps the file but hides the skill from the planner. Deleting removes
 * the directory too, and is not recoverable.
 */
export function SkillsPanel({ onClose }: { onClose: () => void }) {
    const [skills, setSkills] = useState<SkillSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [confirmId, setConfirmId] = useState<number | null>(null);

    useEffect(() => {
        void fetchSkills().then((rows) => {
            setSkills(rows);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    async function toggle(skill: SkillSummary) {
        setPendingId(skill.id);
        const next = !skill.enabled;
        const ok = await setSkillEnabled(skill.id, next);
        // only reflect the change once the server confirms it, so the switch
        // never shows a state the registry does not actually hold
        if (ok) {
            setSkills((rows) => rows.map((r) => (r.id === skill.id ? { ...r, enabled: next } : r)));
        }
        setPendingId(null);
    }

    async function remove(skill: SkillSummary) {
        setPendingId(skill.id);
        const ok = await deleteSkill(skill.id);
        if (ok) setSkills((rows) => rows.filter((r) => r.id !== skill.id));
        setPendingId(null);
        setConfirmId(null);
    }

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Skills"
            onClick={onClose}
        >
            <div
                className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between border-b border-border px-4 py-3">
                    <div>
                        <h2 className="text-sm font-medium text-ink">Skills</h2>
                        <p className="text-xs text-ink-muted">
                            Playbooks the planner can load. Atlas writes these itself — disable or delete
                            anything you don&apos;t want it using.
                        </p>
                    </div>
                    <button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        className="grid size-8 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        <X size={16} />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-3">
                    {loading ? (
                        <p className="px-2 py-6 text-center text-xs text-ink-muted">Loading…</p>
                    ) : skills.length === 0 ? (
                        <p className="px-2 py-6 text-center text-xs text-ink-muted">
                            No skills yet. Atlas creates one after a task whose procedure is worth repeating.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {skills.map((skill) => (
                                <li
                                    key={skill.id}
                                    className={`rounded-md border border-border bg-canvas p-3 transition-opacity ${
                                        skill.enabled ? "" : "opacity-60"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate text-sm text-ink">{skill.name}</span>
                                                {!skill.enabled && (
                                                    <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-muted">
                                                        disabled
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                                                {skill.description ?? "No description."}
                                            </p>
                                            <p className="mt-1.5 text-[11px] text-ink-muted">
                                                used {skill.usageCount ?? 0}×
                                            </p>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1">
                                            <button
                                                type="button"
                                                disabled={pendingId === skill.id}
                                                onClick={() => void toggle(skill)}
                                                className="rounded-md border border-border px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                                            >
                                                {skill.enabled ? "Disable" : "Enable"}
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Delete ${skill.name}`}
                                                disabled={pendingId === skill.id}
                                                onClick={() => setConfirmId(skill.id)}
                                                className="grid size-8 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                                            >
                                                <Trash size={15} />
                                            </button>
                                        </div>
                                    </div>

                                    {confirmId === skill.id && (
                                        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2">
                                            <span className="text-xs text-ink-muted">
                                                Delete this skill and its file? This cannot be undone.
                                            </span>
                                            <div className="flex shrink-0 gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmId(null)}
                                                    className="rounded-md px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void remove(skill)}
                                                    className="rounded-md border border-border px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
