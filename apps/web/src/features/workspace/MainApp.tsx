import { useCallback, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { AppShell, type Section } from "./AppShell/AppShell";
import { TabBar } from "./TabBar/TabBar";
import { ChatPage } from "../chat/ChatPage";
import { MailPage } from "../mail/MailPage";
import { FilesPage } from "../files/FilesPage";
import { SettingsPage } from "../settings/SettingsPage";
import { TasksPage } from "../tasks/TasksPage";
import { DatabasePage } from "../database/DatabasePage";
import { FlowsPage } from "../flows/FlowsPage";
import { KnowledgePage } from "../knowledge/KnowledgePage";
import { ProfilePage } from "../settings/ProfilePage";
import { DocsPage } from "../knowledge/DocsPage";
import { WebSocketProvider, useWS } from "../../app/providers/WebSocketProvider";
import { OnboardingTour } from "./OnboardingTour/OnboardingTour";
import { MobileShell } from "./MobileShell/MobileShell";
import { useIsMobile } from "../../shared/hooks/useIsMobile";

const allSections: Section[] = ['chat', 'mail', 'files', 'knowledge', 'database', 'tasks', 'workflows', 'settings', 'profile', 'docs']

function MainAppInner() {
  const { user, logout } = useAuth();
  const [openTabs, setOpenTabs] = useState<Section[]>(["chat"]);
  const [activeTab, setActiveTab] = useState<Section>("chat");
  const { isConnected } = useWS();
  const isMobile = useIsMobile();

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

  const pages = (
    <>
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
            {section === 'files' && <FilesPage onNavigate={openSection} />}
            {section === 'knowledge' && <KnowledgePage />}
            {section === 'tasks' && <TasksPage />}
            {section === 'database' && <DatabasePage />}
            {section === 'workflows' && <FlowsPage />}
            {section === 'settings' && <SettingsPage />}
            {section === 'profile' && <ProfilePage />}
            {section === 'docs' && <DocsPage />}
          </div>
        );
      })}
    </>
  );

  if (isMobile) {
    return (
      <MobileShell
        activeSection={activeTab}
        onSectionChange={openSection}
        currentUser={user.name}
        currentUserEmail={user.email}
        currentUserRole={user.role}
        onLogout={logout}
      >
        {pages}
      </MobileShell>
    );
  }

  return (
    <AppShell
      activeSection={activeTab}
      onSectionChange={openSection}
      currentUser={user.name}
      currentUserEmail={user.email}
      currentUserRole={user.role}
      currentUserImage={user.image}
      onLogout={logout}
      onOpenProfile={() => openSection('profile')}
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
      {pages}
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
