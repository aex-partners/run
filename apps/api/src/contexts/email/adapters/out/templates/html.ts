import { EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { LocaleStrings } from '@/contexts/email/adapters/out/templates/types'
import { en } from '@/contexts/email/adapters/out/templates/locales/en'
import { ptBR } from '@/contexts/email/adapters/out/templates/locales/pt-BR'

// Inline-styled HTML helpers ported 1:1 from AEX email-engine/html.ts. Inline-only
// styles keep rendering predictable across mail clients.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function stringsFor(locale: EmailLocale): LocaleStrings {
  return locale === 'pt-BR' ? ptBR : en
}

export function layout(opts: { bodyInner: string; strings: LocaleStrings }): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:#ffffff;border-radius:12px;padding:32px;">
      ${opts.bodyInner}
    </div>
    <p style="margin-top:24px;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">${escapeHtml(opts.strings.footer)}</p>
  </div>
</body></html>`
}

export function button(label: string, url: string, strings: LocaleStrings): string {
  const safeUrl = escapeHtml(url)
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background:#18181b;">
    <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(label)}</a>
  </td></tr></table>
  <p style="font-size:12px;line-height:1.5;color:#71717a;">${escapeHtml(strings.buttonFallback)}<br><a href="${safeUrl}" style="color:#2563eb;word-break:break-all;">${safeUrl}</a></p>`
}

export function paragraph(text: string): string {
  return `<p style="font-size:14px;line-height:1.6;margin:16px 0;">${escapeHtml(text)}</p>`
}

export function greetingLine(strings: LocaleStrings, name: string): string {
  return `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">${escapeHtml(strings.greeting(name))}</p>`
}
