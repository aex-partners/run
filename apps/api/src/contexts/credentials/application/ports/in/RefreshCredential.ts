import { Result } from '@/shared/kernel/Result'

// Driving port for OAuth2 token refresh. Two callers:
//   - the scheduled worker calls it with no id → refresh every due oauth2
//     credential (the periodic job);
//   - ResolveCredential calls it with a specific id → refresh one on demand when
//     a resolution finds the token near expiry.
// Each credential is refreshed only if its token is within the expiry skew;
// already-valid tokens are counted as a no-op success.
export interface RefreshCredentialCommand {
  credentialId?: string
}

export interface RefreshCredential {
  execute(cmd: RefreshCredentialCommand): Promise<Result<{ total: number; refreshed: number }>>
}
