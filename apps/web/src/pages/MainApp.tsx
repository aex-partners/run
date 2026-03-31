import { useCallback, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { AppShell, type Section } from "../components/layout/AppShell/AppShell";
import { TabBar } from "../components/molecules/TabBar/TabBar";
import { ChatPage } from "./ChatPage";
import { MailPage } from "./MailPage";
import { FilesPage } from "./FilesPage";
import { SettingsPage } from "./SettingsPage";
import { TasksPage } from "./TasksPage";
import { DatabasePage } from "./DatabasePage";
import { FlowsPage } from "./FlowsPage";
import { KnowledgePage } from "./KnowledgePage";
import { WebSocketProvider, useWS } from "../providers/WebSocketProvider";
import { OnboardingTour } from "../components/organisms/OnboardingTour/OnboardingTour";

const allSections: Section[] = ['chat', 'mail', 'files', 'knowledge', 'database', 'tasks', 'workflows', 'settings']

function MainAppInner() {
  const { user, logout } = useAuth();
  const [openTabs, setOpenTabs] = useState<Section[]>(["chat"]);
  const [activeTab, setActiveTab] = useState<Section>("chat");
  const { isConnected } = useWS();

  const openSection = useCallback((section: Section) => {
    setOpenTabs((prev) => {
      if (prev.includes(section)) return prev;
      return [...prev, section];
    });
    setActiveTab(section);
  }, []);

  const closeTab = useCallback((section: Section) => {
    setOpenTabs((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((s) => s !== section);
      return next;
    });
    setActiveTab((prev) => {
      if (prev !== section) return prev;
      const remaining = openTabs.filter((s) => s !== section);
      const closedIndex = openTabs.indexOf(section);
      return remaining[Math.min(closedIndex, remaining.length - 1)] ?? "chat";
    });
  }, [openTabs]);

  const isAdmin = user.role === "admin" || user.role === "owner";

  return (
    <AppShell
      activeSection={activeTab}
      onSectionChange={openSection}
      currentUser={user.name}
      currentUserEmail={user.email}
      currentUserRole={user.role}
      onLogout={logout}
      isOnline={isConnected}
      tabBar={
        <TabBar
          tabs={openTabs}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onCloseTab={closeTab}
        />
      }
    >
      <OnboardingTour isAdmin={isAdmin} />
      {allSections.map((section) => {
        if (!openTabs.includes(section)) return null;
        const isVisible = section === activeTab;

        return (
          <div
            key={section}
            style={{
              display: isVisible ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              overflow: 'hidden',
              height: '100%',
            }}
          >
            {section === 'chat' && <ChatPage onNavigate={openSection} />}
            {section === 'mail' && <MailPage />}
            {section === 'files' && <FilesPage />}
            {section === 'knowledge' && <KnowledgePage />}
            {section === 'tasks' && <TasksPage />}
            {section === 'database' && <DatabasePage />}
            {section === 'workflows' && <FlowsPage />}
            {section === 'settings' && <SettingsPage />}
          </div>
        );
      })}
    </AppShell>
  );
}

export function MainApp() {
  return (
    <WebSocketProvider>
      <MainAppInner />
    </WebSocketProvider>
  );
}
