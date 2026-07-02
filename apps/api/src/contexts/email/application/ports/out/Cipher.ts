// Driven port for credential encryption. The application encrypts a plaintext
// SMTP/IMAP password before it ever reaches an aggregate, and decrypts the
// stored ciphertext only at the moment a transport adapter needs it. The
// concrete AES-256-GCM adapter (ported from AEX email/crypto.ts) lives under
// adapters/out/crypto and is the only thing that touches node:crypto.
export interface Cipher {
  // Returns ciphertext; when no key is configured, returns the plaintext as-is
  // (backwards-compatible with AEX's encryption-disabled mode).
  encrypt(plaintext: string): string
  // Returns plaintext, or null when a ciphertext cannot be decrypted.
  decrypt(ciphertext: string | null): string | null
}
