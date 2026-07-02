import { Entity } from '@/shared/kernel/Entity'
import { FlowFolderId } from '@/contexts/automation/domain/ids'

// A folder that groups flows in the UI. Mirrors the AEX `flow_folders` row; the
// only behaviour is rename and reorder.
export class FlowFolder extends Entity<FlowFolderId> {
  private constructor(
    id: FlowFolderId,
    private _displayName: string,
    private _displayOrder: number,
    public readonly createdAt: Date,
  ) {
    super(id)
  }

  static create(props: { id: FlowFolderId; displayName: string; displayOrder?: number; now: Date }): FlowFolder {
    return new FlowFolder(props.id, props.displayName, props.displayOrder ?? 0, props.now)
  }

  static rehydrate(props: {
    id: FlowFolderId
    displayName: string
    displayOrder: number
    createdAt: Date
  }): FlowFolder {
    return new FlowFolder(props.id, props.displayName, props.displayOrder, props.createdAt)
  }

  rename(displayName: string): void {
    this._displayName = displayName
  }

  reorder(displayOrder: number): void {
    this._displayOrder = displayOrder
  }

  get displayName(): string {
    return this._displayName
  }
  get displayOrder(): number {
    return this._displayOrder
  }
}
