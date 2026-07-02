import { Result } from '@/shared/kernel/Result'

// Driving port. Step 2 of the OAuth2 dance: the provider redirected back with a
// code + the state we signed. Verify the state, exchange the code for tokens, and
// persist a new oauth2 credential. Invoked from the HTTP callback ROUTE (not a
// tRPC procedure) — see adapters/in/http.
export interface CompleteOAuthCommand {
  code: string
  state: string
}

export interface CompleteOAuth {
  execute(cmd: CompleteOAuthCommand): Promise<Result<{ credentialId: string; pluginName: string }>>
}
