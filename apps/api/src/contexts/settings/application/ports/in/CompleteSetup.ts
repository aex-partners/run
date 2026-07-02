import { Result } from '@/shared/kernel/Result'
import { SetupWizardInput } from '@/contexts/settings/domain/SetupPlan'

// Driving port. The one-time setup wizard. Beyond the settings-owned fields it
// carries the data needed by the SetupProvisioner ACL out-port (the acting user,
// SMTP credentials, mail provider).
export interface CompleteSetupCommand extends SetupWizardInput {
  actorUserId: string
  emailProvider?: 'smtp' | null
  smtpUser?: string
  smtpPass?: string
  smtpFrom?: string
}

export interface CompleteSetup {
  execute(cmd: CompleteSetupCommand): Promise<Result<{ success: true }>>
}
