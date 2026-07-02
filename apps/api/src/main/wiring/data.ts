// Wiring for the `data` context (dynamic entities + records). No cross-context
// construction-time dependencies: it only needs infra. Returns its controllers
// plus the in-ports other contexts consume (the AI ToolBox, integrations' RecordSink
// and forms' EntityCatalog/EntityRecordSink all bridge to these).
import { Infra } from '@/main/wiring/infra'

import { DrizzleEntityRepository } from '@/contexts/data/adapters/out/persistence/DrizzleEntityRepository'
import { DrizzleRecordRepository } from '@/contexts/data/adapters/out/persistence/DrizzleRecordRepository'
import { DrizzleSavedViewRepository } from '@/contexts/data/adapters/out/persistence/DrizzleSavedViewRepository'
import { DrizzleViewPreferenceRepository } from '@/contexts/data/adapters/out/persistence/DrizzleViewPreferenceRepository'
import { DrizzleListEntities } from '@/contexts/data/adapters/out/persistence/DrizzleListEntities'
import { DrizzleListRecords } from '@/contexts/data/adapters/out/persistence/DrizzleListRecords'
import { DrizzleQueryRecords } from '@/contexts/data/adapters/out/persistence/DrizzleQueryRecords'
import { DrizzleSearchRecords } from '@/contexts/data/adapters/out/persistence/DrizzleSearchRecords'
import { DrizzlePivotRecords } from '@/contexts/data/adapters/out/persistence/DrizzlePivotRecords'
import { DrizzleGetViewPreference } from '@/contexts/data/adapters/out/persistence/DrizzleGetViewPreference'
import { DrizzleListSavedViews } from '@/contexts/data/adapters/out/persistence/DrizzleListSavedViews'
import { AnthropicFieldValueGenerator } from '@/contexts/data/adapters/out/ai/AnthropicFieldValueGenerator'
import { CreateEntityService } from '@/contexts/data/application/use-cases/CreateEntityService'
import { AddFieldService } from '@/contexts/data/application/use-cases/AddFieldService'
import { UpdateEntityService } from '@/contexts/data/application/use-cases/UpdateEntityService'
import { UpdateFieldService } from '@/contexts/data/application/use-cases/UpdateFieldService'
import { RemoveFieldService } from '@/contexts/data/application/use-cases/RemoveFieldService'
import { DeleteEntityService } from '@/contexts/data/application/use-cases/DeleteEntityService'
import { InsertRecordService } from '@/contexts/data/application/use-cases/InsertRecordService'
import { UpdateRecordService } from '@/contexts/data/application/use-cases/UpdateRecordService'
import { DeleteRecordService } from '@/contexts/data/application/use-cases/DeleteRecordService'
import { GetRecordService } from '@/contexts/data/application/use-cases/GetRecordService'
import { GenerateFieldValueService } from '@/contexts/data/application/use-cases/GenerateFieldValueService'
import { DescribeEntityService } from '@/contexts/data/application/use-cases/DescribeEntityService'
import { ManageSavedViewService } from '@/contexts/data/application/use-cases/ManageSavedViewService'
import { SetViewPreferenceService } from '@/contexts/data/application/use-cases/SetViewPreferenceService'
import { entityController } from '@/contexts/data/adapters/in/http/EntityController'
import { recordController } from '@/contexts/data/adapters/in/http/RecordController'
import { viewController } from '@/contexts/data/adapters/in/http/ViewController'

export function wireData(infra: Infra) {
  const { db, events, clock, env } = infra

  const entityRepo = new DrizzleEntityRepository(db)
  const recordRepo = new DrizzleRecordRepository(db)
  const savedViewRepo = new DrizzleSavedViewRepository(db)
  const viewPrefRepo = new DrizzleViewPreferenceRepository(db)
  const listEntities = new DrizzleListEntities(db)
  const listRecords = new DrizzleListRecords(db)
  const queryRecords = new DrizzleQueryRecords(db)
  const searchRecords = new DrizzleSearchRecords(db)
  const pivotRecords = new DrizzlePivotRecords(db)
  const getViewPreference = new DrizzleGetViewPreference(db)
  const listSavedViews = new DrizzleListSavedViews(db)
  const fieldValueGenerator = new AnthropicFieldValueGenerator(env.ANTHROPIC_API_KEY)

  const createEntity = new CreateEntityService(entityRepo, events, clock)
  const addField = new AddFieldService(entityRepo, events, clock)
  const updateEntity = new UpdateEntityService(entityRepo, events, clock)
  const updateField = new UpdateFieldService(entityRepo, events, clock)
  const removeField = new RemoveFieldService(entityRepo, events)
  const deleteEntity = new DeleteEntityService(entityRepo)
  const insertRecord = new InsertRecordService(entityRepo, recordRepo, events, clock)
  const updateRecord = new UpdateRecordService(entityRepo, recordRepo, events, clock)
  const deleteRecord = new DeleteRecordService(recordRepo)
  const getRecord = new GetRecordService(recordRepo)
  const generateFieldValue = new GenerateFieldValueService(entityRepo, recordRepo, fieldValueGenerator, events, clock)
  const describeEntity = new DescribeEntityService(entityRepo)
  const manageSavedView = new ManageSavedViewService(savedViewRepo)
  const setViewPreference = new SetViewPreferenceService(viewPrefRepo)

  const entitiesCtl = entityController({
    create: createEntity, update: updateEntity, remove: deleteEntity, addField, updateField,
    removeField, generateFieldValue, describe: describeEntity, list: listEntities,
    search: searchRecords, pivot: pivotRecords,
  })
  const recordsCtl = recordController({ insert: insertRecord, update: updateRecord, remove: deleteRecord, list: listRecords, query: queryRecords })
  const viewsCtl = viewController({ getPreference: getViewPreference, setPreference: setViewPreference, listViews: listSavedViews, manageView: manageSavedView })

  return {
    controllers: { entities: entitiesCtl, records: recordsCtl, views: viewsCtl },
    ports: {
      createEntity, insertRecord, updateRecord, deleteRecord, getRecord, describeEntity,
      listEntities, queryRecords,
    },
  }
}

export type DataWiring = ReturnType<typeof wireData>
