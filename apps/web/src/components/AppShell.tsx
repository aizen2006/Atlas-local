import type { ReactNode } from "react";

/**
 * The application frame: a collapsible session rail on the left and the main
 * content column on the right. The rail sizes itself (w-14 collapsed / w-64
 * open), so an `auto` first column tracks it.
 */
export function AppShell({ rail, children }: { rail: ReactNode; children: ReactNode }) {
    return (
        <div className="grid h-[100dvh] grid-cols-[auto_1fr] bg-canvas text-ink">
            {rail}
            {children}
        </div>
    );
}
