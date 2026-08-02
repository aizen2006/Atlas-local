import type { useChat } from "../hooks/useChat";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { MessageList } from "./MessageList";

// The conversation canvas: a header, the scrollable message list (or empty
// state), and the floating composer. Chat state is owned by App via useChat and
// passed in so the session rail can share it.
export function ChatView({ chat }: { chat: ReturnType<typeof useChat> }) {
    const { messages, status, send, stop, retry } = chat;
    const busy = status === "waiting" || status === "streaming";

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-center border-b border-border px-4 py-3">
                <span className="font-medium tracking-tight text-ink">Atlas</span>
            </header>

            {/* the scroll region fills the space; the composer floats over it */}
            <div className="relative min-h-0 flex-1">
                {messages.length === 0 ? (
                    <div className="h-full overflow-y-auto">
                        <EmptyState onPick={send} />
                    </div>
                ) : (
                    <MessageList messages={messages} status={status} onRetry={retry} />
                )}

                {/* floating composer: a fade so messages dissolve beneath a centered card */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0">
                    <div className="h-20 bg-linear-to-t from-canvas via-canvas/85 to-transparent" />
                    <div className="pointer-events-auto -mt-6 bg-canvas px-4 pb-4">
                        <div className="mx-auto max-w-3xl">
                            <Composer onSend={send} onStop={stop} busy={busy} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
