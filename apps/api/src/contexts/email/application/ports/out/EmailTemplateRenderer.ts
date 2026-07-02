// Driven port for transactional template rendering. Declares the contract (the
// typed template catalogue and the i18n locales) the email context exposes; the
// adapter under adapters/out/templates ports AEX email-engine's registry + html
// + locales. Pure: rendering is deterministic, no IO.

export type EmailLocale = 'en' | 'pt-BR'

// Payload shape for each transactional template, keyed by template name. Ported
// 1:1 from AEX email-engine/types.ts.
export interface TemplateData {
  welcome: { name: string; orgName?: string; appUrl?: string }
  'email-verification': { name: string; verificationUrl: string }
  'password-reset': { name: string; resetUrl: string }
  'two-factor-otp': { name: string; code: string }
  invite: { name: string; inviterName?: string; orgName?: string; setupUrl: string }
  'account-alert': { name: string; alertTitle: string; alertBody: string; actionUrl?: string }
  'notification-digest': {
    name: string
    count: number
    items: { title: string; body?: string }[]
    appUrl?: string
  }
}

export type TemplateName = keyof TemplateData

export interface RenderedEmail {
  subject: string
  bodyHtml: string
  bodyText: string
}

export interface EmailTemplateRenderer {
  render<N extends TemplateName>(name: N, data: TemplateData[N], locale: EmailLocale): RenderedEmail
}
