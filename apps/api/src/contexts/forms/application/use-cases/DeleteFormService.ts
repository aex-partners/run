import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeleteForm, DeleteFormCommand } from '@/contexts/forms/application/ports/in/DeleteForm'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { FormId } from '@/contexts/forms/domain/FormId'

export class DeleteFormService implements DeleteForm {
  constructor(
    private readonly forms: FormRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: DeleteFormCommand): Promise<Result<{ success: boolean }>> {
    const id = FormId.of(cmd.id)
    const form = await this.forms.findById(id)
    if (form) {
      form.markDeleted(this.clock.now())
      await this.forms.delete(id)
      await this.events.publish(form.pullEvents())
    } else {
      await this.forms.delete(id)
    }
    return ok({ success: true })
  }
}
