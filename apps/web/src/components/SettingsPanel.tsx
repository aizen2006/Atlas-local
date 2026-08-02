import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { fetchSoul, saveSoul } from "../lib/api";

/**
 * Settings. Currently one thing: SOUL.md, the persona Atlas loads before every
 * reply.
 *
 * This editor is the only writer. Atlas reads the file and never edits it — a
 * persona that rewrites itself drifts, and "open it and fix the wrong line" only
 * works if everything in there is something you put there.
 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
    const [content, setContent] = useState("");
    const [saved, setSaved] = useState("");
    const [path, setPath] = useState("");
    const [maxBytes, setMaxBytes] = useState(4096);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [justSaved, setJustSaved] = useState(false);

    useEffect(() => {
        void fetchSoul().then((soul) => {
            if (soul) {
                setContent(soul.content);
                setSaved(soul.content);
                setPath(soul.path);
                setMaxBytes(soul.maxBytes);
            } else {
                setError("Could not load your soul file.");
            }
            setLoading(false);
        });
    }, []);

    const dirty = content !== saved;

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            // don't discard unsaved edits on a stray Escape
            if (e.key === "Escape" && !dirty) onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, dirty]);

    // byte length, not character count — the server's limit is bytes
    const bytes = new TextEncoder().encode(content).length;
    const over = bytes > maxBytes;

    async function save() {
        setSaving(true);
        setError(null);
        const message = await saveSoul(content);
        if (message) {
            setError(message);
        } else {
            setSaved(content);
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
        }
        setSaving(false);
    }

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            onClick={() => !dirty && onClose()}
        >
            <div
                className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface-1 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                    <div>
                        <h2 className="text-sm font-medium text-ink">Soul</h2>
                        <p className="text-xs text-ink-muted">
                            How you want Atlas to work with you. Read before every reply — Atlas never
                            edits this.
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

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <p className="py-6 text-center text-xs text-ink-muted">Loading…</p>
                    ) : (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            spellCheck={false}
                            rows={18}
                            aria-label="Soul file contents"
                            className="w-full resize-y rounded-md border border-border bg-canvas p-3 font-mono text-xs leading-relaxed text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        />
                    )}

                    {error && <p className="mt-2 text-xs text-ink">{error}</p>}
                </div>

                <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                    <div className="min-w-0">
                        <p className={`text-[11px] ${over ? "text-ink" : "text-ink-muted"}`}>
                            {bytes} / {maxBytes} bytes
                            {over && " — too long, this rides on every message"}
                        </p>
                        {path && <p className="truncate text-[11px] text-ink-muted">{path}</p>}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {justSaved && <span className="text-[11px] text-ink-muted">Saved</span>}
                        {dirty && !justSaved && (
                            <button
                                type="button"
                                onClick={() => setContent(saved)}
                                className="rounded-md px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                            >
                                Revert
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={!dirty || saving || over || loading}
                            onClick={() => void save()}
                            className="rounded-md border border-border bg-canvas px-3 py-1.5 text-xs text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
