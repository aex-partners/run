import {
  EmailLocale,
  TemplateData,
  TemplateName,
  RenderedEmail,
} from '@/contexts/email/application/ports/out/EmailTemplateRenderer'

// Per-locale chrome strings shared by every template (greeting, footer, link
// fallback). Internal to the renderer adapter.
export interface LocaleStrings {
  greeting: (name: string) => string
  footer: string
  buttonFallback: string
}

export type TemplateRenderer<N extends TemplateName> = (
  data: TemplateData[N],
  strings: LocaleStrings,
  locale: EmailLocale,
) => RenderedEmail
