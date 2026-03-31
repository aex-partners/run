import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Coins, Bell } from "lucide-react";
import { trpc } from "../lib/trpc";
import { SettingsScreen } from "../components/screens/SettingsScreen/SettingsScreen";
import { PluginConnectDialog, type PluginConnectDialogProps } from "../components/organisms/PluginConnectDialog/PluginConnectDialog";
import type { User } from "../components/organisms/UserTable/UserTable";
import type { AgentFormData } from "../components/organisms/AgentForm/AgentForm";
import type { SkillFormData } from "../components/organisms/SkillForm/SkillForm";
import type { CustomToolFormData } from "../components/organisms/CustomToolForm/CustomToolForm";

type PermissionMatrix = Record<string, Record<string, boolean>>;

export function SettingsPage() {
  const utils = trpc.useUtils();

  // ─── Users ──────────────────────────────────────────────────
  const { data: serverUsers = [] } = trpc.users.list.useQuery();

  // ─── Company Settings ─────────────────────────────────────────
  const { data: companyName } = trpc.settings.get.useQuery({ key: "company.name" });
  const { data: companyTradeName } = trpc.settings.get.useQuery({ key: "company.tradeName" });
  const { data: companyAddress } = trpc.settings.get.useQuery({ key: "company.address" });
  const { data: companyPhone } = trpc.settings.get.useQuery({ key: "company.phone" });
  const { data: companyEmail } = trpc.settings.get.useQuery({ key: "company.email" });
  const { data: companyCnpj } = trpc.settings.get.useQuery({ key: "company.cnpj" });

  const setSetting = trpc.settings.set.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
    },
  });

  const companyInfo = {
    name: (companyName as string) ?? "",
    tradeName: (companyTradeName as string) ?? "",
    cnpj: (companyCnpj as string) ?? "",
    address: (companyAddress as string) ?? "",
    phone: (companyPhone as string) ?? "",
    email: (companyEmail as string) ?? "",
    plan: "Self-Hosted",
    activeUsers: String(serverUsers.length),
  };

  const handleSaveCompany = (info: { name: string; tradeName: string; cnpj: string; address: string; phone: string; email: string; plan: string; activeUsers: string }) => {
    const fields = ["name", "tradeName", "address", "phone", "email", "cnpj"] as const;
    for (const field of fields) {
      setSetting.mutate({ key: `company.${field}`, value: info[field] });
    }
  };

  const inviteUser = trpc.users.invite.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setInviteOpen(false);
      setInviteForm({ name: "", email: "", password: "" });
    },
  });

  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
  });
  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
  });
  const updateStatus = trpc.users.updateStatus.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
  });
  const updateName = trpc.users.updateName.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", password: "" });
  const [inviteError, setInviteError] = useState("");

  const users: User[] = serverUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status as User["status"],
  }));

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    try {
      await inviteUser.mutateAsync(inviteForm);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite user");
    }
  };

  // ─── Agents ─────────────────────────────────────────────────
  const { data: serverAgents = [] } = trpc.agents.list.useQuery();
  const createAgent = trpc.agents.create.useMutation({ onSuccess: () => utils.agents.list.invalidate() });
  const updateAgent = trpc.agents.update.useMutation({ onSuccess: () => utils.agents.list.invalidate() });
  const deleteAgent = trpc.agents.delete.useMutation({ onSuccess: () => utils.agents.list.invalidate() });

  const agents = serverAgents.map((a) => {
    const raw = a as Record<string, unknown>;
    const skillIds = Array.isArray(raw.skillIds) ? (raw.skillIds as string[]) : [];
    const toolIds = Array.isArray(raw.toolIds) ? (raw.toolIds as string[]) : [];
    return {
      id: a.id,
      name: a.name,
      description: a.description ?? undefined,
      systemPrompt: (raw.systemPrompt as string) ?? '',
      modelId: (raw.modelId as string) ?? '',
      skillIds,
      toolIds,
      skillCount: skillIds.length,
      toolCount: toolIds.length,
    };
  });

  // ─── Skills ─────────────────────────────────────────────────
  const { data: serverSkills = [] } = trpc.skills.list.useQuery();
  const createSkill = trpc.skills.create.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const updateSkill = trpc.skills.update.useMutation({ onSuccess: () => utils.skills.list.invalidate() });
  const deleteSkill = trpc.skills.delete.useMutation({ onSuccess: () => utils.skills.list.invalidate() });

  const skills = serverSkills.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description ?? undefined,
    toolCount: (s as Record<string, unknown>).toolIds
      ? ((s as Record<string, unknown>).toolIds as string[]).length
      : 0,
    hasGuardrails: !!(s as Record<string, unknown>).guardrails,
  }));

  const skillOptions = serverSkills.map((s) => ({ value: s.id, label: s.name }));

  // ─── Tools ─────────────────────────────────────────────────
  const { data: serverTools = [] } = trpc.customTools.list.useQuery();
  const { data: serverPieceTools = [] } = trpc.plugins.listPieceTools.useQuery();
  const createTool = trpc.customTools.create.useMutation({ onSuccess: () => utils.customTools.list.invalidate() });
  const updateTool = trpc.customTools.update.useMutation({ onSuccess: () => utils.customTools.list.invalidate() });
  const deleteTool = trpc.customTools.delete.useMutation({ onSuccess: () => utils.customTools.list.invalidate() });
  const testTool = trpc.customTools.test.useMutation();

  const [testResult, setTestResult] = useState<{ success: boolean; result?: string; error?: string } | null>(null);

  const customTools = serverTools.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description ?? undefined,
    type: t.type as "http" | "query" | "code" | "composite",
  }));

  const toolOptions = serverTools.map((t) => ({ value: t.id, label: t.name }));

  // ─── Credentials (for plugin connection status) ────────────
  const { data: allCredentials = [] } = trpc.credentials.list.useQuery();
  const connectedPlugins = React.useMemo(
    () => new Set(allCredentials.filter((c) => c.hasValue).map((c) => c.pluginName)),
    [allCredentials],
  );

  // ─── Plugins ─────────────────────────────────────────────────
  const { data: serverPlugins = [] } = trpc.plugins.list.useQuery();
  const installPlugin = trpc.plugins.install.useMutation({ onSuccess: () => utils.plugins.list.invalidate() });
  const uninstallPlugin = trpc.plugins.uninstall.useMutation({ onSuccess: () => utils.plugins.list.invalidate() });
  const _configurePlugin = trpc.plugins.configure.useMutation({ onSuccess: () => utils.plugins.list.invalidate() });
  const togglePlugin = trpc.plugins.setEnabled.useMutation({ onSuccess: () => utils.plugins.list.invalidate() });
  const syncPluginRegistry = trpc.plugins.syncRegistry.useMutation({ onSuccess: () => utils.plugins.list.invalidate() });

  // Auto-sync piece catalog on first load if no plugins exist
  const [didAutoSync, setDidAutoSync] = React.useState(false);
  React.useEffect(() => {
    if (!didAutoSync && serverPlugins.length === 0 && !syncPluginRegistry.isPending) {
      setDidAutoSync(true);
      syncPluginRegistry.mutate();
    }
  }, [serverPlugins.length, didAutoSync, syncPluginRegistry]);

  const PLUGIN_ICONS: Record<string, React.ReactNode> = {
    "coins": <Coins size={18} />,
    "bell": <Bell size={18} />,
  };

  const getPluginIcon = (p: { icon?: string | null; name: string }) => {
    if (p.icon && PLUGIN_ICONS[p.icon]) return PLUGIN_ICONS[p.icon];
    return <Coins size={18} />;
  };

  const getLogoUrl = (p: { icon?: string | null }) => {
    if (p.icon && (p.icon.startsWith("http") || p.icon.startsWith("/"))) return p.icon;
    return undefined;
  };

  // Auto-refetch while any plugin is installing
  const hasInstallingPlugins = serverPlugins.some((p) => p.status === "installing");
  React.useEffect(() => {
    if (!hasInstallingPlugins) return;
    const interval = setInterval(() => {
      utils.plugins.list.invalidate();
    }, 2000);
    return () => clearInterval(interval);
  }, [hasInstallingPlugins, utils.plugins.list]);

  const installedPlugins = serverPlugins
    .filter((p) => p.status === "installed" || p.status === "disabled" || p.status === "installing" || p.status === "error")
    .map((p) => {
      let toolCount = 0;
      if (p.manifest) {
        try {
          const manifest = JSON.parse(p.manifest);
          toolCount = manifest.tools?.length ?? 0;
        } catch { /* ignore */ }
      }
      const authType = (p as Record<string, unknown>).authType as string | undefined;
      const hasAuth = !!authType && authType !== "none";
      return {
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        icon: getPluginIcon(p),
        logoUrl: getLogoUrl(p),
        installed: true as const,
        enabled: p.status === "installed",
        installing: p.status === "installing",
        version: p.version,
        category: p.category ?? undefined,
        toolCount,
        needsAuth: hasAuth,
        connected: hasAuth ? connectedPlugins.has(p.pieceName ?? "") : false,
      };
    });

  const marketplacePlugins = serverPlugins
    .filter((p) => p.status === "available")
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      icon: getPluginIcon(p),
      logoUrl: getLogoUrl(p),
      installed: false as const,
      version: p.version,
      category: p.category ?? undefined,
    }));

  // Connect dialog state
  const [connectPluginId, setConnectPluginId] = useState<string | null>(null);
  const connectPlugin = connectPluginId ? serverPlugins.find((p) => p.id === connectPluginId) : null;
  const { data: pluginCredentials = [] } = trpc.credentials.getByPlugin.useQuery(
    { pluginName: connectPlugin?.pieceName ?? "" },
    { enabled: !!connectPlugin?.pieceName },
  );
  const createCredentialMut = trpc.credentials.create.useMutation({
    onSuccess: () => {
      utils.credentials.getByPlugin.invalidate();
      setConnectPluginId(null);
    },
  });
  const deleteCredentialMut = trpc.credentials.delete.useMutation({
    onSuccess: () => utils.credentials.getByPlugin.invalidate(),
  });
  const getOAuth2Url = trpc.credentials.getOAuth2Url.useMutation();

  const handlePluginInstall = (name: string) => {
    const plugin = serverPlugins.find((p) => p.name === name);
    if (plugin) installPlugin.mutate({ id: plugin.id });
  };

  const handlePluginUninstall = (name: string) => {
    const plugin = serverPlugins.find((p) => p.name === name);
    if (plugin) uninstallPlugin.mutate({ id: plugin.id });
  };

  const handlePluginConfigure = (name: string) => {
    const plugin = serverPlugins.find((p) => p.name === name);
    if (plugin) setConnectPluginId(plugin.id);
  };

  const handlePluginToggle = (name: string, enabled: boolean) => {
    const plugin = serverPlugins.find((p) => p.name === name);
    if (plugin) togglePlugin.mutate({ id: plugin.id, enabled });
  };

  const handleSaveCredential = (value: Record<string, unknown>) => {
    if (!connectPlugin?.pieceName) return;
    createCredentialMut.mutate({
      name: `${connectPlugin.name} API Key`,
      pluginName: connectPlugin.pieceName,
      type: (connectPlugin as Record<string, unknown>).authType === "oauth2" ? "oauth2"
        : (connectPlugin as Record<string, unknown>).authType === "basic_auth" ? "basic_auth"
        : (connectPlugin as Record<string, unknown>).authType === "custom_auth" ? "custom_auth"
        : "secret_text",
      value,
    });
  };

  const handleStartOAuth2 = async (clientId: string, clientSecret: string): Promise<string> => {
    if (!connectPlugin?.pieceName) throw new Error("No plugin selected");
    const result = await getOAuth2Url.mutateAsync({
      pluginName: connectPlugin.pieceName,
      clientId,
      clientSecret,
    });
    return result.url;
  };

  const handleDisconnect = () => {
    if (pluginCredentials.length > 0) {
      deleteCredentialMut.mutate({ id: pluginCredentials[0].id });
    }
  };

  // System tools (hardcoded for now; could come from a tRPC query)
  const systemToolOptions = [
    { value: "createEntity", label: "createEntity" },
    { value: "queryEntities", label: "queryEntities" },
    { value: "updateEntity", label: "updateEntity" },
    { value: "deleteEntity", label: "deleteEntity" },
    { value: "createSchema", label: "createSchema" },
    { value: "addField", label: "addField" },
  ];

  // ─── Handlers ───────────────────────────────────────────────

  const handleCreateAgent = (data: AgentFormData) => {
    createAgent.mutate({
      name: data.name,
      description: data.description || undefined,
      systemPrompt: data.systemPrompt,
      modelId: data.modelId || undefined,
      skillIds: data.skillIds,
      toolIds: data.toolIds,
    });
  };

  const handleUpdateAgent = (id: string, data: AgentFormData) => {
    updateAgent.mutate({
      id,
      name: data.name,
      description: data.description || undefined,
      systemPrompt: data.systemPrompt,
      modelId: data.modelId || undefined,
      skillIds: data.skillIds,
      toolIds: data.toolIds,
    });
  };

  const handleCreateSkill = (data: SkillFormData) => {
    createSkill.mutate({
      name: data.name,
      description: data.description || undefined,
      systemPrompt: data.systemPrompt,
      toolIds: data.toolIds,
      systemToolNames: data.systemToolNames,
      guardrails: data.guardrails,
    });
  };

  const handleUpdateSkill = (id: string, data: SkillFormData) => {
    updateSkill.mutate({
      id,
      name: data.name,
      description: data.description || undefined,
      systemPrompt: data.systemPrompt,
      toolIds: data.toolIds,
      systemToolNames: data.systemToolNames,
      guardrails: data.guardrails,
    });
  };

  const handleCreateTool = (data: CustomToolFormData) => {
    createTool.mutate({
      name: data.name,
      description: data.description,
      type: data.type,
      inputSchema: data.inputSchema,
      config: data.config,
      isReadOnly: data.isReadOnly,
      integrationId: data.integrationId || undefined,
    });
  };

  const handleUpdateTool = (id: string, data: CustomToolFormData) => {
    updateTool.mutate({
      id,
      name: data.name,
      description: data.description,
      type: data.type,
      inputSchema: data.inputSchema,
      config: data.config,
      isReadOnly: data.isReadOnly,
      integrationId: data.integrationId || undefined,
    });
  };

  const handleTestTool = async (data: CustomToolFormData) => {
    const existing = serverTools.find((t) => t.name === data.name);
    if (!existing) return;
    try {
      const result = await testTool.mutateAsync({ id: existing.id });
      setTestResult({
        success: result.success,
        result: result.result ? JSON.stringify(result.result, null, 2) : undefined,
        error: result.error ?? undefined,
      });
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "Test failed" });
    }
  };

  const formLoading =
    createAgent.isPending || updateAgent.isPending ||
    createSkill.isPending || updateSkill.isPending ||
    createTool.isPending || updateTool.isPending;

  // ─── Permissions Persistence ──────────────────────────────────
  const handleLoadPermissions = async (): Promise<PermissionMatrix | null> => {
    const result = await utils.settings.get.fetch({ key: "permissions.matrix" });
    if (result && typeof result === "object") return result as PermissionMatrix;
    return null;
  };

  const handleSavePermissions = async (matrix: PermissionMatrix) => {
    await setSetting.mutateAsync({ key: "permissions.matrix", value: JSON.stringify(matrix) });
  };

  return (
    <>
      <SettingsScreen
        users={users}
        installedPlugins={installedPlugins}
        marketplacePlugins={marketplacePlugins}
        companyInfo={companyInfo}
        onSaveCompany={handleSaveCompany}
        onInviteUser={() => setInviteOpen(true)}
        onEditUser={(id, name) => updateName.mutate({ userId: id, name })}
        onDeleteUser={(id) => deleteUser.mutate({ userId: id })}
        onChangeRole={(id, role) => updateRole.mutate({ userId: id, role })}
        onChangeStatus={(id, status) => updateStatus.mutate({ userId: id, status: status === "inactive" ? "inactive" : "active" })}
        onInstallPlugin={handlePluginInstall}
        onConfigurePlugin={handlePluginConfigure}
        onUninstallPlugin={handlePluginUninstall}
        onTogglePlugin={handlePluginToggle}
        onSyncPluginRegistry={() => syncPluginRegistry.mutate()}
        syncingPlugins={syncPluginRegistry.isPending}
        agents={agents}
        skillOptions={skillOptions}
        toolOptions={toolOptions}
        systemToolOptions={systemToolOptions}
        onCreateAgent={handleCreateAgent}
        onUpdateAgent={handleUpdateAgent}
        onDeleteAgent={(id) => deleteAgent.mutate({ id })}
        skills={skills}
        onCreateSkill={handleCreateSkill}
        onUpdateSkill={handleUpdateSkill}
        onDeleteSkill={(id) => deleteSkill.mutate({ id })}
        customTools={customTools}
        pieceTools={serverPieceTools}
        onCreateTool={handleCreateTool}
        onUpdateTool={handleUpdateTool}
        onDeleteTool={(id) => deleteTool.mutate({ id })}
        onTestTool={handleTestTool}
        testResult={testResult}
        formLoading={formLoading}
        onLoadPermissions={handleLoadPermissions}
        onSavePermissions={handleSavePermissions}
      />

      {/* Invite user dialog */}
      <Dialog.Root open={inviteOpen} onOpenChange={setInviteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200 }} />
          <Dialog.Content
            style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 400, background: "var(--surface)", borderRadius: 12,
              border: "1px solid var(--border)", padding: 24, zIndex: 201,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>Invite User</Dialog.Title>
              <Dialog.Close asChild>
                <button aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 4, display: "flex" }}>
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>
            <form onSubmit={handleInviteSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", display: "block", marginBottom: 6 }}>Name</label>
                <input type="text" value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} required autoFocus
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", display: "block", marginBottom: 6 }}>Email</label>
                <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", display: "block", marginBottom: 6 }}>Password</label>
                <input type="password" value={inviteForm.password} onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))} required minLength={6}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              </div>
              {inviteError && (
                <div style={{ fontSize: 13, color: "var(--danger)", padding: "8px 12px", borderRadius: 8, background: "#fef2f2" }}>{inviteError}</div>
              )}
              <button type="submit" disabled={inviteUser.isPending}
                style={{ padding: "10px 16px", borderRadius: 8, background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", cursor: inviteUser.isPending ? "wait" : "pointer", fontFamily: "inherit", opacity: inviteUser.isPending ? 0.7 : 1, marginTop: 4 }}>
                {inviteUser.isPending ? "Inviting..." : "Invite"}
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Plugin Connect dialog */}
      <PluginConnectDialog
        open={!!connectPluginId}
        onClose={() => setConnectPluginId(null)}
        pluginName={connectPlugin?.pieceName ?? ""}
        pluginDisplayName={connectPlugin?.name ?? ""}
        pluginLogoUrl={getLogoUrl(connectPlugin ?? {})}
        authType={((connectPlugin as Record<string, unknown> | undefined)?.authType as PluginConnectDialogProps["authType"]) ?? "none"}
        connected={pluginCredentials.length > 0}
        onSaveCredential={handleSaveCredential}
        onStartOAuth2={handleStartOAuth2}
        onDisconnect={handleDisconnect}
        saving={createCredentialMut.isPending}
      />
    </>
  );
}
