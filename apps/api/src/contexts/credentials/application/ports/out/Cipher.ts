// Driven port for symmetric encryption of the credential value at rest. The
// repository adapter uses it to encrypt on write and decrypt on read; the domain
// never sees ciphertext. The adapter (adapters/out/crypto) wraps AES-256-GCM.
export interface Cipher {
  encrypt(plaintext: string): string
  decrypt(encoded: string): string
}
