import type { CSSProperties } from "react";

// Shared field/button styling for the auth screens (login, signup, reset,
// forgot). Kept in one place so the four forms stay visually identical.

export const inputStyle: CSSProperties = {
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
};

export const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text)",
  display: "block",
  marginBottom: 6,
};

export const primaryButtonStyle = (loading: boolean): CSSProperties => ({
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
});

export const errorBoxStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--danger)",
  padding: "8px 12px",
  borderRadius: 8,
  background: "#fef2f2",
};

export const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "var(--text)",
  marginBottom: 4,
};

export const descriptionStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  marginBottom: 24,
};

export const footerStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  marginTop: 20,
  textAlign: "center",
};

export const linkStyle: CSSProperties = {
  color: "var(--accent)",
  textDecoration: "none",
  fontWeight: 500,
};

export const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
};
