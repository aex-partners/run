// Health of a credential. A credential is born `active`; a failed OAuth refresh
// flips it to `error`; `missing` marks a credential whose secret was cleared.
export type CredentialStatus = 'active' | 'error' | 'missing'
