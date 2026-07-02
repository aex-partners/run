import { Identifier } from '@/shared/kernel/Identifier'

export class FlowId extends Identifier {
  static of(value: string): FlowId {
    return new FlowId(value)
  }
}

export class RunId extends Identifier {
  static of(value: string): RunId {
    return new RunId(value)
  }
}

// --- AEX flow engine identities (versioning + runs + folders) ---

export class FlowVersionId extends Identifier {
  static of(value: string): FlowVersionId {
    return new FlowVersionId(value)
  }
}

export class FlowRunId extends Identifier {
  static of(value: string): FlowRunId {
    return new FlowRunId(value)
  }
}

export class FlowFolderId extends Identifier {
  static of(value: string): FlowFolderId {
    return new FlowFolderId(value)
  }
}
