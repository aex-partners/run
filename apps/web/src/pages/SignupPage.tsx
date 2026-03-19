import { useState } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { t } from "../locales/en";
import { trpc } from "../lib/trpc";
import { Logo } from "../components/atoms/Logo/Logo";

export function SignupPage() {
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
      const res = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.user) {
        setError(data?.message ?? t.auth.signUpFailed);
        return;
      }

      navigate("/");
    } catch {
      setError(t.auth.networkError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
      }}
    >
      <div
        style={{
          width: 360,
          background: "var(--surface)",
          borderRadius: 12,
          border: "1px solid var(--border)",
          padding: 32,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Logo width={36} height={36} />
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
          {t.auth.signUp}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
          {t.auth.signUpDescription}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", display: "block", marginBottom: 6 }}>
              {t.auth.name}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", display: "block", marginBottom: 6 }}>
              {t.auth.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", display: "block", marginBottom: 6 }}>
              {t.auth.password}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 14,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: "var(--danger)", padding: "8px 12px", borderRadius: 8, background: "#fef2f2" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: loading ? "wait" : "pointer",
              fontFamily: "inherit",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? t.auth.creatingAccount : t.auth.signUp}
          </button>
        </form>

        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 20, textAlign: "center" }}>
          {t.auth.hasAccount}{" "}
          <Link to="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
            {t.auth.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
