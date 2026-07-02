import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { Cipher } from '@/contexts/credentials/application/ports/out/Cipher'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

// Driven adapter for the Cipher port, ported 1:1 from the source
// integrations/crypto.ts. AES-256-GCM (authenticated encryption). Output is
// base64(iv ‖ ciphertext ‖ authTag). The key is injected (from ENCRYPTION_KEY in
// main) as a 32-char raw string or 64-char hex.
export class AesCredentialCipher implements Cipher {
  private readonly key: Buffer

  constructor(key: string) {
    if (key.length === 64) this.key = Buffer.from(key, 'hex')
    else if (key.length === 32) this.key = Buffer.from(key, 'utf8')
    else throw new Error('ENCRYPTION_KEY must be 32 bytes (or 64 hex characters)')
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([iv, encrypted, tag]).toString('base64')
  }

  decrypt(encoded: string): string {
    const combined = Buffer.from(encoded, 'base64')
    const iv = combined.subarray(0, IV_LENGTH)
    const tag = combined.subarray(combined.length - TAG_LENGTH)
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH)
    const decipher = createDecipheriv(ALGORITHM, this.key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  }
}
