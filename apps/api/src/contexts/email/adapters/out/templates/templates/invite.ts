import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { TemplateRenderer } from '@/contexts/email/adapters/out/templates/types'
import { button, greetingLine, layout, paragraph } from '@/contexts/email/adapters/out/templates/html'

const copy: Record<
  EmailLocale,
  { subject: (org?: string) => string; intro: (inviter?: string, org?: string) => string; body: string; cta: string }
> = {
  en: {
    subject: (org) => (org ? `You've been invited to ${org} on AEX` : "You've been invited to AEX"),
    intro: (inviter, org) => {
      const who = inviter ? `${inviter} invited you` : "You've been invited"
      return org ? `${who} to join ${org} on AEX.` : `${who} to join AEX.`
    },
    body: 'Set your password to activate your account and get started.',
    cta: 'Set your password',
  },
  'pt-BR': {
    subject: (org) => (org ? `Você foi convidado para ${org} no AEX` : 'Você foi convidado para o AEX'),
    intro: (inviter, org) => {
      const who = inviter ? `${inviter} convidou você` : 'Você foi convidado'
      return org ? `${who} para entrar em ${org} no AEX.` : `${who} para entrar no AEX.`
    },
    body: 'Defina sua senha para ativar sua conta e começar.',
    cta: 'Definir senha',
  },
}

export const invite: TemplateRenderer<'invite'> = (data, strings, locale) => {
  const c = copy[locale] ?? copy.en
  const inner =
    greetingLine(strings, data.name) +
    paragraph(c.intro(data.inviterName, data.orgName)) +
    paragraph(c.body) +
    button(c.cta, data.setupUrl, strings)
  const bodyText = [
    strings.greeting(data.name),
    c.intro(data.inviterName, data.orgName),
    c.body,
    `${c.cta}: ${data.setupUrl}`,
  ].join('\n\n')
  return { subject: c.subject(data.orgName), bodyHtml: layout({ bodyInner: inner, strings }), bodyText }
}
