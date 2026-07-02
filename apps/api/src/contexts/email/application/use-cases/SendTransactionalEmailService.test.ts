import { describe, it, expect } from 'vitest'
import { SendTransactionalEmailService } from '@/contexts/email/application/use-cases/SendTransactionalEmailService'
import { MailSettings } from '@/contexts/email/application/ports/out/MailSettings'
import {
  EmailTemplateRenderer,
  EmailLocale,
  RenderedEmail,
  TemplateName,
  TemplateData,
} from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { EmailQueue, QueuedEmail } from '@/contexts/email/application/ports/out/EmailQueue'

class FakeMailSettings implements MailSettings {
  constructor(
    private accountId: string | null,
    private locale: EmailLocale = 'en',
  ) {}
  localeReads = 0
  async systemEmailAccountId(): Promise<string | null> {
    return this.accountId
  }
  async emailLocale(): Promise<EmailLocale> {
    this.localeReads += 1
    return this.locale
  }
}

class FakeRenderer implements EmailTemplateRenderer {
  readonly calls: { name: TemplateName; locale: EmailLocale }[] = []
  render<N extends TemplateName>(name: N, _data: TemplateData[N], locale: EmailLocale): RenderedEmail {
    this.calls.push({ name, locale })
    return {
      subject: `subject:${name}`,
      bodyHtml: `<p>${name}</p>`,
      bodyText: `text:${name}`,
    }
  }
}

class FakeQueue implements EmailQueue {
  readonly jobs: QueuedEmail[] = []
  async enqueue(job: QueuedEmail): Promise<void> {
    this.jobs.push(job)
  }
}

describe('SendTransactionalEmailService', () => {
  it('renders the template and enqueues it on the system account as fire-and-forget (storeSent false)', async () => {
    const settings = new FakeMailSettings('system-acc', 'en')
    const renderer = new FakeRenderer()
    const queue = new FakeQueue()
    const service = new SendTransactionalEmailService(settings, renderer, queue)

    const res = await service.execute({
      to: 'user@x.com',
      template: 'welcome',
      data: { name: 'Ada' },
    })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.sent).toBe(true)
    expect(queue.jobs).toHaveLength(1)
    expect(queue.jobs[0]).toMatchObject({
      accountId: 'system-acc',
      storeSent: false,
      to: ['user@x.com'],
      subject: 'subject:welcome',
      bodyHtml: '<p>welcome</p>',
      bodyText: 'text:welcome',
    })
  })

  it('fails soft when no system account is configured, enqueuing nothing', async () => {
    const settings = new FakeMailSettings(null)
    const renderer = new FakeRenderer()
    const queue = new FakeQueue()
    const service = new SendTransactionalEmailService(settings, renderer, queue)

    const res = await service.execute({ to: 'user@x.com', template: 'welcome', data: { name: 'Ada' } })

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value).toEqual({ sent: false, reason: 'no-system-account' })
    expect(queue.jobs).toHaveLength(0)
    expect(renderer.calls).toHaveLength(0)
  })

  it('uses the command locale verbatim and does not consult the workspace locale', async () => {
    const settings = new FakeMailSettings('system-acc', 'en')
    const renderer = new FakeRenderer()
    const service = new SendTransactionalEmailService(settings, renderer, new FakeQueue())

    await service.execute({ to: 'u@x.com', template: 'welcome', data: { name: 'Ada' }, locale: 'pt-BR' })

    expect(renderer.calls[0].locale).toBe('pt-BR')
    expect(settings.localeReads).toBe(0)
  })

  it('falls back to the workspace locale when the command omits one', async () => {
    const settings = new FakeMailSettings('system-acc', 'pt-BR')
    const renderer = new FakeRenderer()
    const service = new SendTransactionalEmailService(settings, renderer, new FakeQueue())

    await service.execute({ to: 'u@x.com', template: 'welcome', data: { name: 'Ada' } })

    expect(settings.localeReads).toBe(1)
    expect(renderer.calls[0].locale).toBe('pt-BR')
  })
})
