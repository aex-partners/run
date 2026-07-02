import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateForm, UpdateFormCommand } from '@/contexts/forms/application/ports/in/UpdateForm'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { FormId } from '@/contexts/forms/domain/FormId'

export class UpdateFormService implements UpdateForm {
  constructor(
    private readonly forms: FormRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateFormCommand): Promise<Result<{ id: string }>> {
    const form = await this.forms.findById(FormId.of(cmd.id))
    if (!form) return fail('Form not found')

    const updated = form.update(
      {
        name: cmd.name,
        description: cmd.description,
        fields: cmd.fields,
        settings: cmd.settings,
      },
      this.clock.now(),
    )
    if (!updated.ok) return fail(updated.error)

    await this.forms.save(form)
    await this.events.publish(form.pullEvents())
    return ok({ id: cmd.id })
  }
}
