import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { TemplateRenderer } from '@/contexts/email/adapters/out/templates/types'
import { button, escapeHtml, greetingLine, layout, paragraph } from '@/contexts/email/adapters/out/templates/html'

const copy: Record<EmailLocale, { subject: (n: number) => string; intro: (n: number) => string; cta: string }> = {
  en: {
    subject: (n) => (n === 1 ? '1 unread notification' : `${n} unread notifications`),
    intro: (n) => (n === 1 ? 'You have 1 unread notification:' : `You have ${n} unread notifications:`),
    cta: 'Open AEX',
  },
  'pt-BR': {
    subject: (n) => (n === 1 ? '1 notificacao nao lida' : `${n} notificacoes nao lidas`),
    intro: (n) => (n === 1 ? 'Voce tem 1 notificacao nao lida:' : `Voce tem ${n} notificacoes nao lidas:`),
    cta: 'Abrir AEX',
  },
}

// Render the unread items as a styled list; titles and bodies are escaped
// because notification text can carry user-supplied content.
function itemsHtml(items: { title: string; body?: string }[]): string {
  const rows = items
    .map(
      (it) =>
        `<li style="margin:0 0 12px;font-size:14px;line-height:1.5;">` +
        `<strong>${escapeHtml(it.title)}</strong>` +
        (it.body ? `<br><span style="color:#52525b;">${escapeHtml(it.body)}</span>` : '') +
        `</li>`,
    )
    .join('')
  return `<ul style="margin:16px 0;padding-left:20px;">${rows}</ul>`
}

export const notificationDigest: TemplateRenderer<'notification-digest'> = (data, strings, locale) => {
  const c = copy[locale] ?? copy.en
  const inner =
    greetingLine(strings, data.name) +
    paragraph(c.intro(data.count)) +
    itemsHtml(data.items) +
    (data.appUrl ? button(c.cta, data.appUrl, strings) : '')
  const bodyText = [
    strings.greeting(data.name),
    c.intro(data.count),
    ...data.items.map((it) => (it.body ? `- ${it.title}: ${it.body}` : `- ${it.title}`)),
    data.appUrl ? `${c.cta}: ${data.appUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return { subject: c.subject(data.count), bodyHtml: layout({ bodyInner: inner, strings }), bodyText }
}
