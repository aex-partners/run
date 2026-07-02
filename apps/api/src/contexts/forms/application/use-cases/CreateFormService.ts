import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateForm, CreateFormCommand } from '@/contexts/forms/application/ports/in/CreateForm'
import { FormRepository } from '@/contexts/forms/application/ports/out/FormRepository'
import { EntityCatalog } from '@/contexts/forms/application/ports/out/EntityCatalog'
import { Form } from '@/contexts/forms/domain/Form'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { FormField } from '@/contexts/forms/domain/FormField'
import { defaultFormSettings } from '@/contexts/forms/domain/FormSettings'

// Application service. Seeds a new form with one field per entity field (all
// visible, mirroring the entity's required flags) and default settings. The
// entity's field list is read across the ACL — the data context is never imported.
export class CreateFormService implements CreateForm {
  constructor(
    private readonly forms: FormRepository,
    private readonly catalog: EntityCatalog,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateFormCommand): Promise<Result<{ id: string; name: string }>> {
    const entityFields = await this.catalog.fieldsOf(cmd.entityId)
    if (!entityFields) return fail('Entity not found')

    const formFields: FormField[] = entityFields.map((f, i) => ({
      id: this.forms.nextFieldId(),
      entityFieldId: f.id,
      order: i,
      required: f.required,
      visible: true,
    }))

    const id = this.forms.nextId()
    const form = Form.create(
      id,
      EntityRef.of(cmd.entityId),
      cmd.name,
      formFields,
      defaultFormSettings(),
      cmd.createdBy,
      this.clock.now(),
    )
    if (!form.ok) return fail(form.error)

    await this.forms.save(form.value)
    await this.events.publish(form.value.pullEvents())
    return ok({ id: id.value, name: cmd.name })
  }
}
