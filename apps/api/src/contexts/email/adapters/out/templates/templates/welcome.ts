import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { TemplateRenderer } from '@/contexts/email/adapters/out/templates/types'
import { button, greetingLine, layout, paragraph } from '@/contexts/email/adapters/out/templates/html'

const copy: Record<EmailLocale, { subject: string; intro: (org?: string) => string; body: string; cta: string }> = {
  en: {
    subject: 'Welcome to AEX',
    intro: (org) => (org ? `Your AEX workspace for ${org} is ready.` : 'Your AEX workspace is ready.'),
    body: 'AEX is your AI-first ERP. Chat with Eric to set up your data, run tasks, and automate your operations.',
    cta: 'Open AEX',
  },
  'pt-BR': {
    subject: 'Bem-vindo ao AEX',
    intro: (org) => (org ? `Seu espaço AEX para ${org} está pronto.` : 'Seu espaço AEX está pronto.'),
    body: 'O AEX é o seu ERP com IA. Converse com o Eric para configurar seus dados, executar tarefas e automatizar suas operações.',
    cta: 'Abrir o AEX',
  },
}

export const welcome: TemplateRenderer<'welcome'> = (data, strings, locale) => {
  const c = copy[locale] ?? copy.en
  const inner =
    greetingLine(strings, data.name) +
    paragraph(c.intro(data.orgName)) +
    paragraph(c.body) +
    (data.appUrl ? button(c.cta, data.appUrl, strings) : '')

  const bodyText = [
    strings.greeting(data.name),
    c.intro(data.orgName),
    c.body,
    data.appUrl ? `${c.cta}: ${data.appUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  return { subject: c.subject, bodyHtml: layout({ bodyInner: inner, strings }), bodyText }
}
