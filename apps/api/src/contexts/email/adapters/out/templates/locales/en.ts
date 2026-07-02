import { LocaleStrings } from '@/contexts/email/adapters/out/templates/types'

export const en: LocaleStrings = {
  greeting: (name: string) => `Hi ${name},`,
  footer: 'This is an automated message from AEX. Please do not reply to this email.',
  buttonFallback: "If the button above doesn't work, copy and paste this link into your browser:",
}
