import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { TemplateRenderer } from '@/contexts/email/adapters/out/templates/types'
import { button, escapeHtml, greetingLine, layout, paragraph } from '@/contexts/email/adapters/out/templates/html'

const copy: Record<EmailLocale, { cta: string }> = {
  en: { cta: 'Review activity' },
  'pt-BR': { cta: 'Revisar atividade' },
}

export const accountAlert: TemplateRenderer<'account-alert'> = (data, strings, locale) => {
  const c = copy[locale] ?? copy.en
  const title = `<h1 style="font-size:18px;font-weight:700;margin:0 0 8px;">${escapeHtml(data.alertTitle)}</h1>`
  const inner =
    greetingLine(strings, data.name) +
    title +
    paragraph(data.alertBody) +
    (data.actionUrl ? button(c.cta, data.actionUrl, strings) : '')
  const bodyText = [
    strings.greeting(data.name),
    data.alertTitle,
    data.alertBody,
    data.actionUrl ? `${c.cta}: ${data.actionUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  return { subject: data.alertTitle, bodyHtml: layout({ bodyInner: inner, strings }), bodyText }
}
