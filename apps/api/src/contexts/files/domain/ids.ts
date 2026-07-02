import { Identifier } from '@/shared/kernel/Identifier'

export class FileId extends Identifier {
  static of(value: string): FileId {
    return new FileId(value)
  }
}

export class FileShareId extends Identifier {
  static of(value: string): FileShareId {
    return new FileShareId(value)
  }
}
