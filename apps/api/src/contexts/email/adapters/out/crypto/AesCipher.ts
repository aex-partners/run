import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 16

// Driven adapter for the Cipher port. Ports AEX email/crypto.ts 1:1: AES-256-GCM
// with a key derived from the configured secret (64-hex parsed directly, any
// other string stretched with scrypt). The key is injected (main reads
// EMAIL_ENCRYPTION_KEY) so the adapter stays process-env-free. When no key is
// configured, encryption is a no-op (backwards-compatible plaintext storage).
export class AesCipher implements Cipher {
  private readonly key: Buffer | null

  constructor(rawKey?: string) {
    this.key = AesCipher.deriveKey(rawKey)
  }

  private static deriveKey(rawKey?: string): Buffer | null {
    if (!rawKey) return null
    if (rawKey.length === 64) {
      try {
        return Buffer.from(rawKey, 'hex')
      } catch {
        // fall through to derive
      }
    }
    return scryptSync(rawKey, 'aex-email-salt', KEY_LENGTH)
  }

  encrypt(plaintext: string): string {
    if (!this.key) return plaintext

    const salt = randomBytes(SALT_LENGTH)
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    const result = Buffer.concat([salt, iv, authTag, encrypted])
    return 'enc:' + result.toString('base64')
  }

  decrypt(ciphertext: string | null): string | null {
    if (!ciphertext) return null
    if (!ciphertext.startsWith('enc:')) return ciphertext
    if (!this.key) return ciphertext

    try {
      const data = Buffer.from(ciphertext.slice(4), 'base64')
      const salt = data.subarray(0, SALT_LENGTH)
      void salt
      const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
      const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)
      const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH)

      const decipher = createDecipheriv(ALGORITHM, this.key, iv)
      decipher.setAuthTag(authTag)
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
      return decrypted.toString('utf-8')
    } catch {
      return null
    }
  }
}
