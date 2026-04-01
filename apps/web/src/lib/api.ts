/** Base URL for the API. Empty string when served behind a reverse proxy (same origin). */
export const API_BASE = import.meta.env.VITE_API_URL || "";

/** Build a full API URL from a path like "/api/auth/sign-in/email" */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
