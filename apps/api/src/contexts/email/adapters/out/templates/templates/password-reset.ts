import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { TemplateRenderer } from '@/contexts/email/adapters/out/templates/types'
import { button, greetingLine, layout, paragraph } from '@/contexts/email/adapters/out/templates/html'

const copy: Record<EmailLocale, { subject: string; body: string; cta: string; ignore: string }> = {
  en: {
    subject: 'Reset your password',
    body: 'We received a request to reset your AEX password. Click below to choose a new one. This link expires shortly.',
    cta: 'Reset password',
    ignore: "If you didn't request this, you can safely ignore this email; your password won't change.",
  },
  'pt-BR': {
    subject: 'Redefina sua senha',
    body: 'Recebemos uma solicitação para redefinir sua senha do AEX. Clique abaixo para escolher uma nova. Este link expira em breve.',
    cta: 'Redefinir senha',
    ignore: 'Se você não fez esta solicitação, pode ignorar este e-mail com segurança; sua senha não será alterada.',
  },
}

export const passwordReset: TemplateRenderer<'password-reset'> = (data, strings, locale) => {
  const c = copy[locale] ?? copy.en
  const inner =
    greetingLine(strings, data.name) + paragraph(c.body) + button(c.cta, data.resetUrl, strings) + paragraph(c.ignore)
  const bodyText = [strings.greeting(data.name), c.body, `${c.cta}: ${data.resetUrl}`, c.ignore].join('\n\n')
  return { subject: c.subject, bodyHtml: layout({ bodyInner: inner, strings }), bodyText }
}
