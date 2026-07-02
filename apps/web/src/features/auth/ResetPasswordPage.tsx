import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiUrl } from "../../platform/api";
import { AuthLayout } from "./AuthLayout";
import {
  inputStyle,
  labelStyle,
  primaryButtonStyle,
  errorBoxStyle,
  titleStyle,
  descriptionStyle,
  formStyle,
} from "./authStyles";

/**
 * Shared landing for both invite activation and forgot-password. The token is
 * carried in the URL (`?token=...`) and POSTed to better-auth's /reset-password
 * endpoint, which creates the credential account for an invited user who has
 * none yet, or rotates the password for an existing one.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("resetPassword.mismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: password, token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? t("resetPassword.failed"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {!token ? (
        <>
          <h1 style={titleStyle}>{t("resetPassword.title")}</h1>
          <div style={{ ...errorBoxStyle, marginTop: 16 }}>
            {t("resetPassword.missingToken")}
          </div>
        </>
      ) : done ? (
        <>
          <h1 style={titleStyle}>{t("resetPassword.title")}</h1>
          <p style={descriptionStyle}>{t("resetPassword.success")}</p>
          <Link
            to="/login"
            style={{
              ...primaryButtonStyle(false),
              display: "block",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            {t("resetPassword.goToLogin")}
          </Link>
        </>
      ) : (
        <>
          <h1 style={titleStyle}>{t("resetPassword.title")}</h1>
          <p style={descriptionStyle}>{t("resetPassword.description")}</p>

          <form onSubmit={handleSubmit} style={formStyle}>
            <div>
              <label style={labelStyle}>{t("resetPassword.newPassword")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>{t("resetPassword.confirmPassword")}</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {error && <div style={errorBoxStyle}>{error}</div>}

            <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
              {loading ? t("resetPassword.submitting") : t("resetPassword.submit")}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
