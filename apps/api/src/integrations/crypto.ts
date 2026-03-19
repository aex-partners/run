import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required for credential encryption");
  }
  // Accept hex-encoded 32-byte key or raw 32-char string
  if (key.length === 64) return Buffer.from(key, "hex");
  if (key.length === 32) return Buffer.from(key, "utf8");
  throw new Error("ENCRYPTION_KEY must be 32 bytes (or 64 hex characters)");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded string: iv + ciphertext + authTag
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // iv (12) + encrypted (variable) + tag (16)
  const combined = Buffer.concat([iv, encrypted, tag]);
  return combined.toString("base64");
}

/**
 * Decrypt a base64-encoded encrypted string (produced by encrypt).
 */
export function decrypt(encoded: string): string {
  const key = getKey();
  const combined = Buffer.from(encoded, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Encrypt a JSON-serializable credentials object.
 */
export function encryptCredentials(credentials: Record<string, unknown>): string {
  return encrypt(JSON.stringify(credentials));
}

/**
 * Decrypt credentials back to an object.
 */
export function decryptCredentials(encrypted: string): Record<string, unknown> {
  if (!encrypted || encrypted === "{}") return {};
  try {
    return JSON.parse(decrypt(encrypted));
  } catch {
    // If decryption fails, it might be stored as plain JSON (migration case)
    try {
      return JSON.parse(encrypted);
    } catch {
      return {};
    }
  }
}
