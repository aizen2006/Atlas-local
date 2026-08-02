import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSessionMessages } from "../lib/api";
import { streamChat } from "../lib/chatStream";
import type { ChatMessage } from "../lib/types";

const SESSION_KEY = "atlas.sessionId";

function loadSessionId(): number | null {
    const raw = localStorage.getItem(SESSION_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
}

let counter = 0;
const nextId = () => `${Date.now()}-${counter++}`;

export type ChatStatus = "idle" | "waiting" | "streaming" | "error";

export function useChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [status, setStatus] = useState<ChatStatus>("idle");
    const [activeSessionId, setActiveSessionId] = useState<number | null>(loadSessionId());

    const sessionId = useRef<number | null>(activeSessionId);
    const abort = useRef<AbortController | null>(null);
    const lastQuery = useRef<string>("");

    // keep the ref, the reactive state, and localStorage in lockstep
    const setSession = useCallback((id: number | null) => {
        sessionId.current = id;
        setActiveSessionId(id);
        if (id === null) localStorage.removeItem(SESSION_KEY);
        else localStorage.setItem(SESSION_KEY, String(id));
    }, []);

    const run = useCallback(async (query: string) => {
        const agentId = nextId();
        setMessages((m) => [
            ...m,
            { id: nextId(), role: "user", content: query },
            { id: agentId, role: "agent", content: "" },
        ]);
        setStatus("waiting");

        const controller = new AbortController();
        abort.current = controller;

        const patchAgent = (patch: Partial<ChatMessage>) =>
            setMessages((m) => m.map((msg) => (msg.id === agentId ? { ...msg, ...patch } : msg)));

        try {
            await streamChat(
                { query, sessionId: sessionId.current },
                {
                    onMeta: (meta) => {
                        setSession(meta.sessionId);
                        patchAgent({ pipeline: meta.pipeline });
                    },
                    onToken: (delta) => {
                        setStatus("streaming");
                        setMessages((m) =>
                            m.map((msg) =>
                                msg.id === agentId ? { ...msg, content: msg.content + delta } : msg,
                            ),
                        );
                    },
                    onDone: () => setStatus("idle"),
                    onError: (message) => {
                        patchAgent({ error: message });
                        setStatus("error");
                    },
                },
                controller.signal,
            );
        } catch {
            if (controller.signal.aborted) {
                setStatus("idle"); // user pressed Stop — keep partial content
            } else {
                patchAgent({ error: "Connection lost. Check that the Atlas server is running." });
                setStatus("error");
            }
        } finally {
            abort.current = null;
        }
    }, [setSession]);

    const send = useCallback(
        (query: string) => {
            const trimmed = query.trim();
            if (!trimmed || status === "waiting" || status === "streaming") return;
            lastQuery.current = trimmed;
            void run(trimmed);
        },
        [run, status],
    );

    const stop = useCallback(() => abort.current?.abort(), []);

    const retry = useCallback(() => {
        setMessages((m) => {
            const copy = [...m];
            if (copy[copy.length - 1]?.role === "agent") copy.pop();
            if (copy[copy.length - 1]?.role === "user") copy.pop();
            return copy;
        });
        if (lastQuery.current) void run(lastQuery.current);
    }, [run]);

    const newChat = useCallback(() => {
        abort.current?.abort();
        setSession(null);
        setMessages([]);
        setStatus("idle");
    }, [setSession]);

    // open an existing conversation from the sidebar
    const loadSession = useCallback(
        async (id: number) => {
            abort.current?.abort();
            setSession(id);
            setStatus("idle");
            setMessages(await fetchSessionMessages(id));
        },
        [setSession],
    );

    // restore the last conversation on reload so a refresh doesn't lose the thread
    useEffect(() => {
        const stored = loadSessionId();
        if (stored !== null) void loadSession(stored);
        // run once on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { messages, status, activeSessionId, send, stop, retry, newChat, loadSession };
}
