import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'

// Driven port for the workspace mail settings the transactional pipeline reads
// (AEX email-engine/config.ts): which account sends system mail, and the
// workspace locale. Backed by the platform `settings` table in the adapter.
export interface MailSettings {
  // Id of the email account used as the system sender, or null if unconfigured.
  systemEmailAccountId(): Promise<string | null>
  // Workspace locale for transactional templates (defaults to 'en').
  emailLocale(): Promise<EmailLocale>
}
