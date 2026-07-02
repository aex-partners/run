import { Result } from '@/shared/kernel/Result'

// Driving port. Step 1 of the OAuth2 dance: build the provider authorization URL
// for the user to visit. The client id/secret are supplied by the caller and
// carried (bound) inside the signed `state` so the callback can complete the
// exchange. Returns the URL to redirect the browser to.
export interface StartOAuthCommand {
  pluginName: string
  clientId: string
  clientSecret: string
  userId: string
}

export interface StartOAuth {
  execute(cmd: StartOAuthCommand): Promise<Result<{ url: string }>>
}
