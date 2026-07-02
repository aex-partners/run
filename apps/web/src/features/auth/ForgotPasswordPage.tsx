import { useState } from "react";
import { Link } from "react-router-dom";
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
  footerStyle,
  linkStyle,
  formStyle,
} from "./authStyles";

/**
 * Entry point for the forgot-password flow. POSTs the email to better-auth's
 * /request-password-reset, which mints a token and (via sendResetPassword)
 * emails the /reset-password link. The endpoint returns success even when no
 * account matches, so the UI always shows the same neutral confirmation to
 * avoid leaking which emails are registered.
 */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/request-password-reset"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          // Same origin as the SPA, so it passes better-auth's originCheck.
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? t("forgotPassword.failed"));
        return;
      }
      setSent(true);
    } catch {
      setError(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      {sent ? (
        <>
          <h1 style={titleStyle}>{t("forgotPassword.title")}</h1>
          <p style={descriptionStyle}>{t("forgotPassword.success")}</p>
          <Link
            to="/login"
            style={{
              ...primaryButtonStyle(false),
              display: "block",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            {t("forgotPassword.backToLogin")}
          </Link>
        </>
      ) : (
        <>
          <h1 style={titleStyle}>{t("forgotPassword.title")}</h1>
          <p style={descriptionStyle}>{t("forgotPassword.description")}</p>

          <form onSubmit={handleSubmit} style={formStyle}>
            <div>
              <label style={labelStyle}>{t("auth.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            </div>

            {error && <div style={errorBoxStyle}>{error}</div>}

            <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
              {loading ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
            </button>
          </form>

          <p style={footerStyle}>
            <Link to="/login" style={linkStyle}>
              {t("forgotPassword.backToLogin")}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
