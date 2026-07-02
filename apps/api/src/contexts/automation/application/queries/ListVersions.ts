import { FlowVersionView } from '@/contexts/automation/application/queries/GetFlow'

// `flows.listVersions`: versions of a flow, newest first.
export interface ListVersions {
  execute(q: { flowId: string }): Promise<FlowVersionView[]>
}
