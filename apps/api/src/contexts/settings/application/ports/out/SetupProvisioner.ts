import { SetupWizardInput } from '@/contexts/settings/domain/SetupPlan'

// ACL out-port for the cross-context side effects of the setup wizard that the
// settings context does NOT own: creating routine entities (data context), the
// Eric agent + conversation + kickoff message (assistant context), promoting the
// setup user to owner and processing invites (identity context), and
// provisioning the SMTP mail account (email context). Fulfilled in the
// composition root as a setup saga that bridges to each context's in-ports — so
// settings never imports another context. Runs AFTER settings have been written.
export interface SetupProvisionRequest extends SetupWizardInput {
  actorUserId: string
  emailProvider?: 'smtp' | null
  smtpUser?: string
  smtpPass?: string
  smtpFrom?: string
}

export interface SetupProvisioner {
  provision(request: SetupProvisionRequest): Promise<void>
}
