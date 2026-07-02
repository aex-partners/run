import { Identifier } from '@/shared/kernel/Identifier'

export class CredentialId extends Identifier {
  static of(value: string): CredentialId {
    return new CredentialId(value)
  }
}
