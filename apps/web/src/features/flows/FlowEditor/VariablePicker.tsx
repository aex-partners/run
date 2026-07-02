import { useState, useRef, useEffect, useMemo } from "react";
import { Braces } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFlowBuilderStore, collectSteps } from "../flow-builder-store";

// Lets the user insert {{trigger}} / {{stepName}} references by picking a prior
// step from a list (shown by its friendly displayName) instead of hand-typing
// the internal step id. Inserts the engine-correct token into the target field.
export function VariablePicker({ stepName, onInsert }: { stepName: string; onInsert: (token: string) => void }) {
  const { t } = useTranslation();
  const flowVersion = useFlowBuilderStore((s) => s.flowVersion);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const options = useMemo(() => {
    if (!flowVersion) return [] as { label: string; token: string }[];
    const steps = collectSteps(flowVersion.trigger);
    const idx = steps.findIndex((s) => s.name === stepName);
    const priors = idx <= 0 ? [] : steps.slice(0, idx);
    return priors.map((s, i) => {
      const isTrigger = i === 0; // collectSteps[0] is always the trigger (builtin root)
      return {
        label: s.displayName || (isTrigger ? "Trigger" : s.name),
        token: isTrigger ? "{{trigger}}" : `{{${s.name}}}`,
      };
    });
  }, [flowVersion, stepName]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", fontSize: 11, fontFamily: "inherit", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer" }}
      >
        <Braces size={12} /> {t("workflows.insertVariable", "Insert variable")}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 60, minWidth: 200, maxHeight: 240, overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", padding: 4 }}>
          {options.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 8px" }}>{t("workflows.noVariablesYet", "No previous steps to reference yet.")}</div>
          ) : options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onInsert(opt.token); setOpen(false); }}
              style={{ display: "flex", flexDirection: "column", width: "100%", gap: 1, padding: "6px 8px", border: "none", borderRadius: 6, background: "transparent", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2, #f3f4f6)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            >
              <span style={{ fontSize: 12, color: "var(--text)" }}>{opt.label}</span>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>{opt.token}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
