import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../platform/trpc";
import { apiUrl } from "../../platform/api";
import { useAuth } from "../auth/useAuth";
import { Avatar } from "../../shared/ui/Avatar/Avatar";

const card: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 24,
  marginBottom: 16,
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text)",
  marginBottom: 6,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--background)",
  color: "var(--text)",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const button: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  border: "none",
  borderRadius: 8,
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text)",
  marginBottom: 16,
};

const ok: React.CSSProperties = { fontSize: 13, color: "var(--success)", marginTop: 8 };
const err: React.CSSProperties = { fontSize: 13, color: "var(--danger)", marginTop: 8 };

export function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // ─── Display name ───────────────────────────────────────────
  const [name, setName] = useState(user.name);
  const [nameStatus, setNameStatus] = useState<"idle" | "saved" | "error">("idle");
  const updateName = trpc.profile.updateName.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      setNameStatus("saved");
    },
    onError: () => setNameStatus("error"),
  });

  // ─── Avatar ─────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.image);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleAvatarFile = async (file: File) => {
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl("/api/upload/avatar"), {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setAvatarError(body?.error ?? t("profile.avatarError"));
        return;
      }
      const { url } = (await res.json()) as { url: string };
      setAvatarUrl(url);
      utils.auth.me.invalidate();
    } catch {
      setAvatarError(t("profile.avatarError"));
    } finally {
      setAvatarUploading(false);
    }
  };

  // ─── Notification preferences ───────────────────────────────
  const prefs = trpc.notifications.getPreferences.useQuery();
  const updatePrefs = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => utils.notifications.getPreferences.invalidate(),
  });
  const emailDigest = prefs.data?.emailDigest ?? true;

  // ─── Password ───────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<"idle" | "success">("idle");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwStatus("idle");
    if (newPassword !== confirmPassword) {
      setPwError(t("profile.passwordMismatch"));
      return;
    }
    setPwSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/auth/change-password"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setPwError(body?.message ?? t("profile.passwordFailed"));
        return;
      }
      setPwStatus("success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwError(t("profile.passwordFailed"));
    } finally {
      setPwSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: 32 }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          {t("profile.title")}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
          {t("profile.subtitle")}
        </p>

        {/* Avatar + name */}
        <div style={card}>
          <div style={sectionTitle}>{t("profile.accountSection")}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <Avatar name={name || user.name} image={avatarUrl} size="xl" />
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAvatarFile(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                style={{ ...button, background: "var(--surface-2)", color: "var(--text)" }}
                disabled={avatarUploading}
                onClick={() => fileRef.current?.click()}
              >
                {avatarUploading ? t("profile.avatarUploading") : t("profile.avatarUpload")}
              </button>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                {t("profile.avatarHint")}
              </div>
              {avatarError && <div style={err}>{avatarError}</div>}
            </div>
          </div>

          <label style={label} htmlFor="profile-name">{t("profile.nameLabel")}</label>
          <input
            id="profile-name"
            style={input}
            value={name}
            maxLength={100}
            onChange={(e) => {
              setName(e.target.value);
              setNameStatus("idle");
            }}
          />
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              style={button}
              disabled={updateName.isPending || name.trim().length === 0 || name === user.name}
              onClick={() => updateName.mutate({ name: name.trim() })}
            >
              {updateName.isPending ? t("profile.saving") : t("profile.save")}
            </button>
          </div>
          {nameStatus === "saved" && <div style={ok}>{t("profile.saved")}</div>}
          {nameStatus === "error" && <div style={err}>{t("profile.nameFailed")}</div>}
        </div>

        {/* Notifications */}
        <div style={card}>
          <div style={sectionTitle}>{t("profile.notificationsTitle")}</div>
          <label
            style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={emailDigest}
              disabled={prefs.isLoading || updatePrefs.isPending}
              onChange={(e) => updatePrefs.mutate({ emailDigest: e.target.checked })}
              style={{ marginTop: 2, width: 16, height: 16, cursor: "pointer" }}
            />
            <span>
              <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                {t("profile.emailDigestLabel")}
              </span>
              <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {t("profile.emailDigestHint")}
              </span>
            </span>
          </label>
          {updatePrefs.isError && <div style={err}>{t("profile.emailDigestFailed")}</div>}
        </div>

        {/* Password */}
        <div style={card}>
          <div style={sectionTitle}>{t("profile.passwordTitle")}</div>
          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: 14 }}>
              <label style={label} htmlFor="cur-pw">{t("profile.currentPassword")}</label>
              <input
                id="cur-pw"
                type="password"
                style={input}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label} htmlFor="new-pw">{t("profile.newPassword")}</label>
              <input
                id="new-pw"
                type="password"
                style={input}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label} htmlFor="confirm-pw">{t("profile.confirmPassword")}</label>
              <input
                id="confirm-pw"
                type="password"
                style={input}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              style={button}
              disabled={pwSubmitting || !currentPassword || !newPassword || !confirmPassword}
            >
              {pwSubmitting ? t("profile.passwordSubmitting") : t("profile.passwordSubmit")}
            </button>
            {pwStatus === "success" && <div style={ok}>{t("profile.passwordSuccess")}</div>}
            {pwError && <div style={err}>{pwError}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
