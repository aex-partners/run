import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { AppShell, type Section } from "../components/layout/AppShell/AppShell";
import { ChatPage } from "./ChatPage";
import { MailPage } from "./MailPage";
import { FilesPage } from "./FilesPage";
import { SettingsPage } from "./SettingsPage";
import { TasksPage } from "./TasksPage";
import { DatabasePage } from "./DatabasePage";
import { FlowsPage } from "./FlowsPage";
import { WebSocketProvider, useWS } from "../providers/WebSocketProvider";
import { OnboardingTour } from "../components/organisms/OnboardingTour/OnboardingTour";

function MainAppInner() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("chat");
  const { isConnected } = useWS();

  const renderSection = () => {
    switch (activeSection) {
      case "chat":
        return <ChatPage onNavigate={setActiveSection} />;
      case "mail":
        return <MailPage />;
      case "files":
        return <FilesPage />;
      case "tasks":
        return <TasksPage />;
      case "database":
        return <DatabasePage />;
      case "workflows":
        return <FlowsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return null;
    }
  };

  const isAdmin = user.role === "admin" || user.role === "owner";

  return (
    <AppShell
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      currentUser={user.name}
      currentUserEmail={user.email}
      currentUserRole={user.role}
      onLogout={logout}
      isOnline={isConnected}
    >
      <OnboardingTour isAdmin={isAdmin} />
      {renderSection()}
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
