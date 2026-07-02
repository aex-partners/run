import { JsonObject } from '@/shared/domain/Json'

// Read side (CQRS). AEX `listSubmissions`.
export interface SubmissionView {
  id: string
  formId: string
  entityRecordId: string | null
  data: JsonObject
  submitterIp: string | null
  createdAt: Date
}

export interface ListSubmissionsOptions {
  formId: string
}

export interface ListSubmissions {
  execute(opts: ListSubmissionsOptions): Promise<SubmissionView[]>
}
