/**
 * Base URL for the API. Empty string when using the built-in reverse proxy (same origin).
 * Only set VITE_API_URL when serving the SPA from a different origin without a proxy.
 */
export const API_BASE = import.meta.env.VITE_API_URL || "";

/** Build a full API URL from a path like "/api/auth/sign-in/email" */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
