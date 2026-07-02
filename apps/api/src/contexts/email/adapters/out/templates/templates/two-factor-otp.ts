import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { TemplateRenderer } from '@/contexts/email/adapters/out/templates/types'
import { escapeHtml, greetingLine, layout, paragraph } from '@/contexts/email/adapters/out/templates/html'

const copy: Record<EmailLocale, { subject: string; body: string; expiry: string }> = {
  en: {
    subject: 'Your verification code',
    body: 'Use this code to finish signing in to AEX:',
    expiry: "This code expires in a few minutes. Don't share it with anyone.",
  },
  'pt-BR': {
    subject: 'Seu código de verificação',
    body: 'Use este código para concluir o login no AEX:',
    expiry: 'Este código expira em alguns minutos. Não compartilhe com ninguém.',
  },
}

export const twoFactorOtp: TemplateRenderer<'two-factor-otp'> = (data, strings, locale) => {
  const c = copy[locale] ?? copy.en
  const codeBlock = `<div style="margin:24px 0;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;font-family:monospace;">${escapeHtml(data.code)}</div>`
  const inner = greetingLine(strings, data.name) + paragraph(c.body) + codeBlock + paragraph(c.expiry)
  const bodyText = [strings.greeting(data.name), c.body, data.code, c.expiry].join('\n\n')
  return { subject: c.subject, bodyHtml: layout({ bodyInner: inner, strings }), bodyText }
}
