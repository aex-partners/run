import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { trpc } from "../../platform/trpc";
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

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();
  const { data: setupStatus } = trpc.settings.isSetupComplete.useQuery();

  if (setupStatus && !setupStatus.complete) {
    return <Navigate to="/setup" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/auth/sign-in/email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? t('auth.invalidCredentials'));
        return;
      }

      // Sign-in just set the session cookie. ProtectedRoute gates on
      // `auth.me`; if the app was first opened logged-out, that query is cached
      // as `null` and would be read synchronously on navigate, bouncing us
      // straight back to /login (fields cleared) before the refetch lands.
      // Reset it so ProtectedRoute refetches fresh (with the new cookie) and
      // shows its loading state instead of the stale null.
      await utils.auth.me.reset();
      navigate("/");
    } catch {
      setError(t('auth.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 style={titleStyle}>{t('auth.signIn')}</h1>
      <p style={descriptionStyle}>{t('auth.signInDescription')}</p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <div>
          <label style={labelStyle}>{t('auth.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={inputStyle}
          />
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <label style={labelStyle}>{t('auth.password')}</label>
            <Link to="/forgot-password" style={{ ...linkStyle, fontSize: 12 }}>
              {t('auth.forgotPasswordLink')}
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>

      <p style={footerStyle}>
        {t('auth.noAccount')}{" "}
        <Link to="/signup" style={linkStyle}>
          {t('auth.signUp')}
        </Link>
      </p>
    </AuthLayout>
  );
}
