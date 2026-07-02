import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { PasswordHasher } from '@/contexts/identity/application/ports/out/PasswordHasher'

const scryptAsync = promisify(scrypt)
const KEY_LEN = 64

// Real-shaped PasswordHasher adapter backed by node:crypto scrypt. In production
// better-auth owns credential hashing on the `accounts` row; this adapter exists
// so the ACL out-port is fulfilled for any direct hashing path (and is swappable
// for better-auth's hasher in main).
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16).toString('hex')
    const derived = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer
    return `${salt}:${derived.toString('hex')}`
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    const [salt, key] = hashed.split(':')
    if (!salt || !key) return false
    const derived = (await scryptAsync(plain, salt, KEY_LEN)) as Buffer
    const expected = Buffer.from(key, 'hex')
    return expected.length === derived.length && timingSafeEqual(expected, derived)
  }
}
