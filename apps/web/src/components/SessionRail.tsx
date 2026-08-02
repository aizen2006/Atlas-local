import { useEffect, useState } from "react";
import { BookOpen, ChatText, Plus, SidebarSimple } from "@phosphor-icons/react";
import { fetchSessions } from "../lib/api";
import type { SessionSummary } from "../lib/types";

const COLLAPSE_KEY = "atlas.rail.collapsed";

interface SessionRailProps {
    activeSessionId: number | null;
    onSelect: (id: number) => void;
    onNewChat: () => void;
    onOpenSkills: () => void;
}

export function SessionRail({ activeSessionId, onSelect, onNewChat, onOpenSkills }: SessionRailProps) {
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");

    // refresh the list whenever the active conversation changes — covers a new
    // session appearing after the first turn and re-ordering on open
    useEffect(() => {
        void fetchSessions().then(setSessions);
    }, [activeSessionId]);

    function toggle() {
        setCollapsed((c) => {
            const next = !c;
            localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
            return next;
        });
    }

    if (collapsed) {
        return (
            <aside className="flex h-full w-14 flex-col items-center gap-2 border-r border-border bg-surface-1 py-3">
                <IconButton label="Expand sidebar" onClick={toggle}>
                    <SidebarSimple size={18} />
                </IconButton>
                <IconButton label="New chat" onClick={onNewChat}>
                    <Plus size={18} />
                </IconButton>
                <IconButton label="Skills" onClick={onOpenSkills}>
                    <BookOpen size={18} />
                </IconButton>
            </aside>
        );
    }

    return (
        <aside className="flex h-full w-64 flex-col border-r border-border bg-surface-1">
            <div className="flex items-center justify-between px-3 py-3">
                <span className="text-sm font-medium text-ink">Chats</span>
                <IconButton label="Collapse sidebar" onClick={toggle}>
                    <SidebarSimple size={18} />
                </IconButton>
            </div>

            <div className="px-3 pb-2">
                <button
                    type="button"
                    onClick={onNewChat}
                    className="flex w-full items-center gap-2 rounded-md border border-border bg-canvas px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99]"
                >
                    <Plus size={15} />
                    New chat
                </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 pb-3">
                {sessions.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-ink-muted">No conversations yet.</p>
                ) : (
                    <ul className="flex flex-col gap-0.5">
                        {sessions.map((session) => {
                            const active = session.id === activeSessionId;
                            return (
                                <li key={session.id}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(session.id)}
                                        className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                                            active
                                                ? "bg-surface-2 text-ink"
                                                : "text-ink-muted hover:bg-surface-2/60 hover:text-ink"
                                        }`}
                                    >
                                        <ChatText size={15} className="shrink-0" />
                                        <span className="truncate">{session.title || "Untitled"}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </nav>

            <div className="border-t border-border px-3 py-2">
                <button
                    type="button"
                    onClick={onOpenSkills}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-ink-muted transition-colors hover:bg-surface-2/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    <BookOpen size={15} className="shrink-0" />
                    Skills
                </button>
            </div>
        </aside>
    );
}

function IconButton({
    label,
    onClick,
    children,
}: {
    label: string;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="grid size-9 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
            {children}
        </button>
    );
}
