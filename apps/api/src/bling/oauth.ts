/**
 * Bling-specific OAuth2 token exchange.
 * Bling requires Authorization: Basic base64(client_id:client_secret)
 * and form-urlencoded body (unlike AEX's generic OAuth which sends credentials in the body).
 */

const TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

export const BLING_AUTH_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";

interface BlingTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface BlingTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function basicHeader(clientId: string, clientSecret: string): string {
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function exchangeBlingCode(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<BlingTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bling token exchange failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as BlingTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshBlingToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<BlingTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bling token refresh failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as BlingTokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export function buildBlingAuthUrl(clientId: string, state: string): string {
  const url = new URL(BLING_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("state", state);
  return url.toString();
}
