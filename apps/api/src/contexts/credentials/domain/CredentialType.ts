// The kinds of secret a credential can hold. `oauth2` carries a refreshable token
// triple; the others are opaque secret bags interpreted by the consuming plugin.
export type CredentialType = 'oauth2' | 'secret_text' | 'basic_auth' | 'custom_auth'
