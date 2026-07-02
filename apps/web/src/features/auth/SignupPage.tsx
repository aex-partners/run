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

export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: setupStatus } = trpc.settings.isSetupComplete.useQuery();

  if (setupStatus && !setupStatus.complete) {
    return <Navigate to="/setup" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(apiUrl("/api/auth/sign-up/email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.user) {
        setError(data?.message ?? t('auth.signUpFailed'));
        return;
      }

      navigate("/");
    } catch {
      setError(t('auth.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 style={titleStyle}>{t('auth.signUp')}</h1>
      <p style={descriptionStyle}>{t('auth.signUpDescription')}</p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <div>
          <label style={labelStyle}>{t('auth.name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>{t('auth.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>{t('auth.password')}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={inputStyle}
          />
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <button type="submit" disabled={loading} style={primaryButtonStyle(loading)}>
          {loading ? t('auth.creatingAccount') : t('auth.signUp')}
        </button>
      </form>

      <p style={footerStyle}>
        {t('auth.hasAccount')}{" "}
        <Link to="/login" style={linkStyle}>
          {t('auth.signIn')}
        </Link>
      </p>
    </AuthLayout>
  );
}
