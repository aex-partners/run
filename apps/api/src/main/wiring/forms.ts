// Wiring for the `forms` context (public form builder over data entities). Two ACL
// bridges to data: EntityCatalog -> DescribeEntity (field schema for rendering +
// validation) and EntityRecordSink -> InsertRecord (a submission becomes a data
// record). Exposes the authenticated forms controller + the public submit controller.
import { Infra } from '@/main/wiring/infra'
import { DataWiring } from '@/main/wiring/data'

import { DrizzleFormRepository } from '@/contexts/forms/adapters/out/persistence/DrizzleFormRepository'
import { DrizzleFormSubmissionRepository } from '@/contexts/forms/adapters/out/persistence/DrizzleFormSubmissionRepository'
import { DrizzleGetForm } from '@/contexts/forms/adapters/out/persistence/DrizzleGetForm'
import { DrizzleGetPublicForm } from '@/contexts/forms/adapters/out/persistence/DrizzleGetPublicForm'
import { DrizzleListForms } from '@/contexts/forms/adapters/out/persistence/DrizzleListForms'
import { DrizzleListSubmissions } from '@/contexts/forms/adapters/out/persistence/DrizzleListSubmissions'
import { CreateFormService } from '@/contexts/forms/application/use-cases/CreateFormService'
import { UpdateFormService } from '@/contexts/forms/application/use-cases/UpdateFormService'
import { DeleteFormService } from '@/contexts/forms/application/use-cases/DeleteFormService'
import { PublishFormService } from '@/contexts/forms/application/use-cases/PublishFormService'
import { SubmitFormService } from '@/contexts/forms/application/use-cases/SubmitFormService'
import { formController } from '@/contexts/forms/adapters/in/http/FormController'
import { publicFormController } from '@/contexts/forms/adapters/in/http/PublicFormController'
import { EntityCatalog } from '@/contexts/forms/application/ports/out/EntityCatalog'
import { EntityRecordSink } from '@/contexts/forms/application/ports/out/EntityRecordSink'

type FormsDeps = Pick<DataWiring['ports'], 'describeEntity' | 'insertRecord'>

export function wireForms(infra: Infra, deps: FormsDeps) {
  const { db, events, clock } = infra
  const { describeEntity, insertRecord } = deps

  // ACL bridge: forms EntityCatalog -> data DescribeEntity (field schema).
  const entityCatalog: EntityCatalog = {
    fieldsOf: async (entityId) => {
      const desc = await describeEntity.execute(entityId)
      if (!desc) return null
      return desc.fields.map((f) => ({
        id: f.id, name: f.name, slug: f.slug, type: f.type, required: f.required, options: f.options, maxRating: f.maxRating,
      }))
    },
  }
  // ACL bridge: forms EntityRecordSink -> data InsertRecord (submission -> record).
  const entityRecordSink: EntityRecordSink = { insert: (entityId, data) => insertRecord.execute({ entityId, data }) }

  const formRepo = new DrizzleFormRepository(db)
  const formSubmissionRepo = new DrizzleFormSubmissionRepository(db)
  const getForm = new DrizzleGetForm(db)
  const getPublicForm = new DrizzleGetPublicForm(db, entityCatalog)
  const listForms = new DrizzleListForms(db)
  const listSubmissions = new DrizzleListSubmissions(db)
  const createForm = new CreateFormService(formRepo, entityCatalog, events, clock)
  const updateForm = new UpdateFormService(formRepo, events, clock)
  const deleteForm = new DeleteFormService(formRepo, events, clock)
  const publishForm = new PublishFormService(formRepo, events, clock)
  const submitForm = new SubmitFormService(formRepo, formSubmissionRepo, entityCatalog, entityRecordSink, events, clock)
  const formsCtl = formController({ create: createForm, update: updateForm, remove: deleteForm, publish: publishForm, list: listForms, get: getForm, submissions: listSubmissions, getPublic: getPublicForm, submit: submitForm })
  const publicFormsCtl = publicFormController({ getPublic: getPublicForm, submit: submitForm })

  return {
    controllers: { forms: formsCtl, publicForms: publicFormsCtl },
  }
}

export type FormsWiring = ReturnType<typeof wireForms>
