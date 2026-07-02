import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { TemplateRenderer } from '@/contexts/email/adapters/out/templates/types'
import { button, greetingLine, layout, paragraph } from '@/contexts/email/adapters/out/templates/html'

const copy: Record<EmailLocale, { subject: string; body: string; cta: string }> = {
  en: {
    subject: 'Verify your email address',
    body: 'Confirm your email address to finish securing your AEX account. This link expires shortly.',
    cta: 'Verify email',
  },
  'pt-BR': {
    subject: 'Confirme seu endereço de e-mail',
    body: 'Confirme seu endereço de e-mail para concluir a segurança da sua conta AEX. Este link expira em breve.',
    cta: 'Confirmar e-mail',
  },
}

export const emailVerification: TemplateRenderer<'email-verification'> = (data, strings, locale) => {
  const c = copy[locale] ?? copy.en
  const inner = greetingLine(strings, data.name) + paragraph(c.body) + button(c.cta, data.verificationUrl, strings)
  const bodyText = [strings.greeting(data.name), c.body, `${c.cta}: ${data.verificationUrl}`].join('\n\n')
  return { subject: c.subject, bodyHtml: layout({ bodyInner: inner, strings }), bodyText }
}
