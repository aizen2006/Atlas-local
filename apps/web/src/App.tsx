import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { ChatView } from "./components/ChatView";
import { SessionRail } from "./components/SessionRail";
import { SettingsPanel } from "./components/SettingsPanel";
import { SkillsPanel } from "./components/SkillsPanel";
import { useChat } from "./hooks/useChat";

export default function App() {
    const chat = useChat();
    const [skillsOpen, setSkillsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

    return (
        <>
            <AppShell
                rail={
                    <SessionRail
                        activeSessionId={chat.activeSessionId}
                        onSelect={chat.loadSession}
                        onNewChat={chat.newChat}
                        onOpenSkills={() => setSkillsOpen(true)}
                        onOpenSettings={() => setSettingsOpen(true)}
                    />
                }
            >
                <ChatView chat={chat} />
            </AppShell>

            {skillsOpen && <SkillsPanel onClose={() => setSkillsOpen(false)} />}
            {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        </>
    );
}
