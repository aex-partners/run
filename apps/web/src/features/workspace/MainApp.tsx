import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
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
  const { isConnected } = useWS();
  const isMobile = useIsMobile();

  // Navigation lives in the URL (source of truth): `?tab=` = active section,
  // `?tabs=` = the open-tab bar. So back/forward + reload keep the place, and a
  // section is deep-linkable. Other params (?c= conversation, ?entity=) survive.
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: Section = allSections.includes(searchParams.get("tab") as Section)
    ? (searchParams.get("tab") as Section)
    : "chat";

  const openTabs: Section[] = (() => {
    const parsed = (searchParams.get("tabs")?.split(",") ?? []).filter(
      (s): s is Section => allSections.includes(s as Section),
    );
    if (parsed.length === 0) return [activeTab];
    return parsed.includes(activeTab) ? parsed : [...parsed, activeTab];
  })();

  const applyNav = useCallback(
    (tab: Section, tabs: Section[]) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", tab);
          next.set("tabs", tabs.join(","));
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );

  const openSection = useCallback(
    (section: Section) => {
      applyNav(section, openTabs.includes(section) ? openTabs : [...openTabs, section]);
    },
    [applyNav, openTabs],
  );

  // switching to an already-open tab (TabBar click) = same as openSection.
  const setActiveTab = openSection;

  const closeTab = useCallback(
    (section: Section) => {
      if (openTabs.length <= 1) return;
      const next = openTabs.filter((s) => s !== section);
      let nextActive = activeTab;
      if (activeTab === section) {
        const closedIndex = openTabs.indexOf(section);
        nextActive = next[Math.min(closedIndex, next.length - 1)] ?? "chat";
      }
      applyNav(nextActive, next);
    },
    [applyNav, openTabs, activeTab],
  );

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
