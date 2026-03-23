import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";

const SEPARATOR = ".";

function hmac(data: string): string {
  return createHmac("sha256", env.BETTER_AUTH_SECRET).update(data).digest("base64url");
}

export function signOAuthState(payload: Record<string, unknown>): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(data);
  return data + SEPARATOR + signature;
}

export function verifyOAuthState(state: string): Record<string, unknown> | null {
  const dotIndex = state.indexOf(SEPARATOR);
  if (dotIndex === -1) return null;

  const data = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);

  const expected = hmac(data);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(data, "base64url").toString());
  } catch {
    return null;
  }
}
