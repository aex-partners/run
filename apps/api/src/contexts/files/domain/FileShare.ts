import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { FileId, FileShareId } from '@/contexts/files/domain/ids'
import { FileShared } from '@/contexts/files/domain/events/FileShared'
import { FileUnshared } from '@/contexts/files/domain/events/FileUnshared'
import { FileAccessChanged } from '@/contexts/files/domain/events/FileAccessChanged'

// VO. The grant level a share carries. A viewer reads; an editor may also modify.
export type FileAccess = 'viewer' | 'editor'

export interface FileShareSnapshot {
  fileId: string
  userId: string
  access: FileAccess
  createdAt: Date
}

// AGGREGATE. A single "file X is shared with user Y at level Z" grant. Kept as
// its own aggregate (not a child collection of File) because shares are queried,
// granted and revoked independently of the file's own lifecycle.
export class FileShare extends AggregateRoot<FileShareId> {
  private constructor(
    id: FileShareId,
    public readonly fileId: FileId,
    public readonly userId: string,
    private _access: FileAccess,
    private readonly _createdAt: Date,
  ) {
    super(id)
  }

  static create(
    id: FileShareId,
    fileId: FileId,
    userId: string,
    access: FileAccess,
    now: Date,
  ): FileShare {
    const share = new FileShare(id, fileId, userId, access, now)
    share.addEvent(new FileShared(id.value, fileId.value, userId, access, now))
    return share
  }

  static rehydrate(id: FileShareId, s: FileShareSnapshot): FileShare {
    return new FileShare(id, FileId.of(s.fileId), s.userId, s.access, s.createdAt)
  }

  changeAccess(access: FileAccess, now: Date): void {
    this._access = access
    this.addEvent(new FileAccessChanged(this.id.value, this.fileId.value, this.userId, access, now))
  }

  // Stamps the revocation event. The caller removes the row.
  revoke(now: Date): void {
    this.addEvent(new FileUnshared(this.id.value, this.fileId.value, this.userId, now))
  }

  get access(): FileAccess {
    return this._access
  }
  get createdAt(): Date {
    return this._createdAt
  }
}
