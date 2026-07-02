import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { PublishForm, PublishFormCommand } from '@/contexts/forms/application/ports/in/PublishForm'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { FormId } from '@/contexts/forms/domain/FormId'

// Toggles public visibility (AEX `togglePublic`). The repository mints the token;
// the aggregate keeps it once set.
export class PublishFormService implements PublishForm {
  constructor(
    private readonly forms: FormRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: PublishFormCommand): Promise<Result<{ isPublic: boolean; publicToken: string | null }>> {
    const form = await this.forms.findById(FormId.of(cmd.id))
    if (!form) return fail('Form not found')

    const toggled = form.togglePublic(this.forms.nextToken(), this.clock.now())
    if (!toggled.ok) return fail(toggled.error)

    await this.forms.save(form)
    await this.events.publish(form.pullEvents())
    return ok({ isPublic: form.isPublic, publicToken: form.publicToken })
  }
}
