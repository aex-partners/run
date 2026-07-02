import { TemplateName } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { TemplateRenderer } from '@/contexts/email/adapters/out/templates/types'
import { welcome } from '@/contexts/email/adapters/out/templates/templates/welcome'
import { emailVerification } from '@/contexts/email/adapters/out/templates/templates/email-verification'
import { passwordReset } from '@/contexts/email/adapters/out/templates/templates/password-reset'
import { twoFactorOtp } from '@/contexts/email/adapters/out/templates/templates/two-factor-otp'
import { invite } from '@/contexts/email/adapters/out/templates/templates/invite'
import { accountAlert } from '@/contexts/email/adapters/out/templates/templates/account-alert'
import { notificationDigest } from '@/contexts/email/adapters/out/templates/templates/notification-digest'

// Maps every template name to its renderer. Exhaustive by construction.
export const templateRegistry: { [N in TemplateName]: TemplateRenderer<N> } = {
  welcome,
  'email-verification': emailVerification,
  'password-reset': passwordReset,
  'two-factor-otp': twoFactorOtp,
  invite,
  'account-alert': accountAlert,
  'notification-digest': notificationDigest,
}
