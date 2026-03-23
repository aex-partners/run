/**
 * Bling webhook signature verification and event processing.
 * Bling sends X-Bling-Signature-256 header with sha256=HMAC(body, client_secret).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyBlingWebhook(
  rawBody: string,
  signature: string,
  clientSecret: string,
): boolean {
  const expected = "sha256=" + createHmac("sha256", clientSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(signature);
  if (expectedBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(expectedBuf, sigBuf);
}

export interface BlingWebhookPayload {
  eventId: string;
  date: string;
  version: number;
  event: string; // e.g. "order.created", "product.updated"
  companyId: number;
  data: Record<string, unknown>;
}

export function parseWebhookEvent(event: string): { resource: string; action: string } | null {
  const parts = event.split(".");
  if (parts.length !== 2) return null;
  return { resource: parts[0], action: parts[1] };
}

const RESOURCE_TO_ENTITY: Record<string, string> = {
  order: "bling_pedidos",
  product: "bling_produtos",
  stock: "bling_estoque",
  invoice: "bling_notas_fiscais",
};

export function getEntitySlugForResource(resource: string): string | null {
  return RESOURCE_TO_ENTITY[resource] ?? null;
}
