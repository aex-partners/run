import { useMemo, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, Check, Loader2, AlertTriangle, Download } from "lucide-react";
import { trpc } from "../../../platform/trpc";
import { useFlowBuilderStore, type FlowAction } from "../flow-builder-store";
import { VariablePicker } from "./VariablePicker";

// --- shared styles (kept local to avoid cross-file coupling) ---
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 13, fontFamily: "inherit", color: "var(--text)",
  background: "var(--surface-2, var(--surface))", border: "1px solid var(--border)", borderRadius: 6,
  outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4,
  textTransform: "uppercase", letterSpacing: "0.04em",
};
const sectionStyle: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--border)" };

interface CatalogItem { id: string; pieceName: string; displayName: string; logoUrl?: string; category?: string | null }
interface PieceProp { name: string; type: string; required: boolean; displayName?: string; description?: string }
interface PieceActionMeta { name: string; displayName?: string; description?: string; props: PieceProp[] }

const TEXTAREA_TYPES = new Set(["LONG_TEXT", "JSON", "OBJECT", "ARRAY", "MARKDOWN"]);

export function PieceSettings({ action }: { action: FlowAction }) {
  const { t } = useTranslation();
  const updateStepSettings = useFlowBuilderStore((s) => s.updateStepSettings);

  const settings = action.settings as Record<string, unknown>;
  const pieceName = (settings.pieceName as string) ?? "";
  const actionName = (settings.actionName as string) ?? "";
  const inputObj = (settings.input && typeof settings.input === "object" && !Array.isArray(settings.input)
    ? (settings.input as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const credentialId = (settings.credentialId as string) ?? "";

  const catalogQuery = trpc.plugins.catalog.useQuery(undefined, { staleTime: 5 * 60_000 });
  const catalog = (catalogQuery.data as unknown as CatalogItem[] | undefined) ?? [];
  const selectedPiece = catalog.find((c) => c.pieceName === pieceName);

  const metaQuery = trpc.plugins.pieceMetadata.useQuery(
    { pieceName },
    { enabled: !!pieceName, staleTime: 5 * 60_000 },
  );
  const actions = ((metaQuery.data?.actions ?? []) as unknown as PieceActionMeta[]);
  const selectedAction = actions.find((a) => a.name === actionName);

  const installedQuery = trpc.plugins.list.useQuery(undefined, { staleTime: 60_000 });
  const isInstalled = !!(installedQuery.data as unknown as { pieceName?: string | null }[] | undefined)?.some(
    (p) => p.pieceName === pieceName,
  );
  const installMut = trpc.plugins.install.useMutation({ onSuccess: () => installedQuery.refetch() });

  const credsQuery = trpc.credentials.getByPlugin.useQuery({ pluginName: pieceName }, { enabled: !!pieceName });
  const creds = (credsQuery.data as unknown as { id: string; name: string; isPrimary: boolean }[] | undefined) ?? [];

  const setPiece = (c: CatalogItem) =>
    updateStepSettings(action.name, { pieceName: c.pieceName, pieceDisplayName: c.displayName, actionName: "", input: {} });
  const setAction = (name: string) => updateStepSettings(action.name, { actionName: name, input: {} });
  const setProp = (prop: string, value: unknown) =>
    updateStepSettings(action.name, { input: { ...inputObj, [prop]: value } });

  return (
    <>
      {/* App picker */}
      <div style={sectionStyle}>
        <label style={labelStyle}>{t("workflows.app", "App")}</label>
        <AppPicker
          items={catalog}
          loading={catalogQuery.isLoading}
          selected={selectedPiece ?? (pieceName ? { id: pieceName, pieceName, displayName: pieceName } : undefined)}
          onSelect={setPiece}
        />
        {pieceName && !isInstalled && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "var(--warning)" }}>
            <AlertTriangle size={12} />
            <span style={{ flex: 1 }}>{t("workflows.pieceNotInstalled", "Not installed. Install to run the flow.")}</span>
            <button
              onClick={() => installMut.mutate({ id: selectedPiece?.id ?? pieceName })}
              disabled={installMut.isPending}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", fontSize: 11, fontFamily: "inherit", border: "1px solid var(--warning)", borderRadius: 6, background: "var(--surface)", color: "var(--warning)", cursor: "pointer" }}
            >
              {installMut.isPending ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={12} />}
              {t("workflows.install", "Install")}
            </button>
          </div>
        )}
        {installMut.isError && (
          <div style={{ marginTop: 6, fontSize: 11, color: "var(--danger)" }}>
            {t("workflows.installFailed", "Install failed")}: {String(installMut.error?.message ?? "").slice(0, 120)}
          </div>
        )}
      </div>

      {/* Action picker */}
      {pieceName && (
        <div style={sectionStyle}>
          <label style={labelStyle}>{t("workflows.action", "Action")}</label>
          {metaQuery.isLoading ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> {t("workflows.loadingActions", "Loading actions…")}
            </div>
          ) : actions.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("workflows.noActions", "No actions for this app.")}</div>
          ) : (
            <select style={{ ...inputStyle, cursor: "pointer" }} value={actionName} onChange={(e) => setAction(e.target.value)}>
              <option value="">{t("workflows.chooseAction", "Choose an action…")}</option>
              {actions.map((a) => (
                <option key={a.name} value={a.name}>{a.displayName ?? a.name}</option>
              ))}
            </select>
          )}
          {selectedAction?.description && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{selectedAction.description}</div>
          )}
        </div>
      )}

      {/* Credential */}
      {pieceName && (
        <div style={sectionStyle}>
          <label style={labelStyle}>{t("workflows.credential", "Credential")}</label>
          {creds.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {t("workflows.noCredential", "No credential for this app. Add one under Settings › Credentials; the flow uses the primary one.")}
            </div>
          ) : (
            <select style={{ ...inputStyle, cursor: "pointer" }} value={credentialId} onChange={(e) => updateStepSettings(action.name, { credentialId: e.target.value })}>
              <option value="">{t("workflows.credentialPrimary", "Primary (default)")}</option>
              {creds.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.isPrimary ? " ★" : ""}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Dynamic input form */}
      {selectedAction && (
        <div style={sectionStyle}>
          <label style={labelStyle}>{t("workflows.inputs", "Inputs")}</label>
          {selectedAction.props.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("workflows.noInputs", "This action has no inputs.")}</div>
          )}
          {selectedAction.props.map((prop) => {
            const val = (inputObj[prop.name] as string) ?? "";
            const isTextarea = TEXTAREA_TYPES.has(prop.type);
            const isCheckbox = prop.type === "CHECKBOX";
            return (
              <div key={prop.name} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ ...labelStyle, marginBottom: 0, textTransform: "none", fontSize: 12, color: "var(--text)" }}>
                    {prop.displayName ?? prop.name}
                    {prop.required && <span style={{ color: "var(--danger)", marginLeft: 3 }}>*</span>}
                    <span style={{ marginLeft: 6, fontSize: 9, color: "var(--text-muted)", fontFamily: "ui-monospace, monospace" }}>{prop.type}</span>
                  </label>
                  {!isCheckbox && <VariablePicker stepName={action.name} onInsert={(tok) => setProp(prop.name, String(val) + tok)} />}
                </div>
                {isCheckbox ? (
                  <select style={{ ...inputStyle, cursor: "pointer" }} value={String(val)} onChange={(e) => setProp(prop.name, e.target.value)}>
                    <option value="">—</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : isTextarea ? (
                  <textarea
                    style={{ ...inputStyle, minHeight: 64, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}
                    value={String(val)}
                    onChange={(e) => setProp(prop.name, e.target.value)}
                    placeholder={prop.description ?? ""}
                  />
                ) : (
                  <input
                    style={inputStyle}
                    value={String(val)}
                    onChange={(e) => setProp(prop.name, e.target.value)}
                    placeholder={prop.description ?? ""}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// --- searchable app dropdown over the full catalog ---
function AppPicker({
  items, loading, selected, onSelect,
}: {
  items: CatalogItem[];
  loading: boolean;
  selected?: CatalogItem;
  onSelect: (c: CatalogItem) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle
      ? items.filter((c) => c.displayName.toLowerCase().includes(needle) || c.pieceName.toLowerCase().includes(needle))
      : items;
    return base.slice(0, 60);
  }, [items, q]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}
      >
        {selected?.logoUrl && <img src={selected.logoUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain" }} />}
        <span style={{ flex: 1, color: selected ? "var(--text)" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.displayName : loading ? t("workflows.loadingApps", "Loading apps…") : t("workflows.chooseApp", "Choose an app…")}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{items.length}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 60, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", padding: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", marginBottom: 4, border: "1px solid var(--border)", borderRadius: 6 }}>
            <Search size={13} color="var(--text-muted)" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("workflows.searchApps", "Search apps…")}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, fontFamily: "inherit", color: "var(--text)" }}
            />
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSelect(c); setOpen(false); setQ(""); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 8px", border: "none", borderRadius: 6, background: "transparent", cursor: "pointer", textAlign: "left" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2, #f3f4f6)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
              >
                {c.logoUrl
                  ? <img src={c.logoUrl} alt="" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain", flexShrink: 0 }} />
                  : <span style={{ width: 18, height: 18, flexShrink: 0 }} />}
                <span style={{ flex: 1, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.displayName}</span>
                {selected?.pieceName === c.pieceName && <Check size={13} color="var(--accent)" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px" }}>{t("workflows.noAppsMatch", "No apps match.")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
