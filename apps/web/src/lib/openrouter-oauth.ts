/**
 * OpenRouter OAuth PKCE helpers.
 *
 * Flow:
 * 1. Generate code_verifier + code_challenge (S256)
 * 2. Redirect user to OpenRouter auth page
 * 3. User returns with ?code= param
 * 4. Exchange code + code_verifier via backend tRPC call
 */

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const STORAGE_KEY = "aex-openrouter-pkce";
export const OPENROUTER_CONNECTED_KEY = "aex-openrouter-connected";

export async function startOpenRouterOAuth(callbackUrl: string): Promise<Window | null> {
  const codeVerifier = generateCodeVerifier();
  const challengeBuffer = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(challengeBuffer);

  localStorage.setItem(STORAGE_KEY, codeVerifier);

  const params = new URLSearchParams({
    callback_url: callbackUrl,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return window.open(
    `https://openrouter.ai/auth?${params.toString()}`,
    "aex-openrouter-oauth",
    "width=500,height=700,left=200,top=100"
  );
}

export function getStoredCodeVerifier(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearStoredCodeVerifier(): void {
  localStorage.removeItem(STORAGE_KEY);
}
