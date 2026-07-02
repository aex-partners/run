import {
  EmailTemplateRenderer,
  EmailLocale,
  TemplateData,
  TemplateName,
  RenderedEmail,
} from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { stringsFor } from '@/contexts/email/adapters/out/templates/html'
import { templateRegistry } from '@/contexts/email/adapters/out/templates/registry'

// Driven adapter for the EmailTemplateRenderer port. Ports AEX email-engine's
// renderTemplate: resolve the locale strings, dispatch to the registered
// renderer. Pure, no IO.
export class TemplateRenderer implements EmailTemplateRenderer {
  render<N extends TemplateName>(name: N, data: TemplateData[N], locale: EmailLocale): RenderedEmail {
    const strings = stringsFor(locale)
    const renderer = templateRegistry[name]
    return renderer(data, strings, locale)
  }
}
