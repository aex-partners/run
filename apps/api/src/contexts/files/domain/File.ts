import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { FileId } from '@/contexts/files/domain/ids'
import { FileSource } from '@/contexts/files/domain/FileSource'
import { fileTypeFromName, mimeTypeFromName } from '@/contexts/files/domain/FileType'
import { FileUploaded } from '@/contexts/files/domain/events/FileUploaded'
import { FolderCreated } from '@/contexts/files/domain/events/FolderCreated'
import { FileRenamed } from '@/contexts/files/domain/events/FileRenamed'
import { FileMoved } from '@/contexts/files/domain/events/FileMoved'
import { FileStarred } from '@/contexts/files/domain/events/FileStarred'
import { FileTrashed } from '@/contexts/files/domain/events/FileTrashed'
import { FileRestored } from '@/contexts/files/domain/events/FileRestored'
import { FileDeleted } from '@/contexts/files/domain/events/FileDeleted'
import { FilePublicLinkChanged } from '@/contexts/files/domain/events/FilePublicLinkChanged'
import { FileAiIndexChanged } from '@/contexts/files/domain/events/FileAiIndexChanged'

// Snapshot used to rehydrate from persistence. The mapper is the only thing that
// builds this; the rest of the system goes through the factories.
export interface FileSnapshot {
  name: string
  type: string
  mimeType: string | null
  size: number
  path: string | null
  source: FileSource
  sourceRef: string | null
  parentId: string | null
  isFolder: boolean
  starred: boolean
  aiIndexed: boolean
  publicToken: string | null
  deletedAt: Date | null
  ownerId: string
  createdAt: Date
  updatedAt: Date
}

export interface UploadFileProps {
  name: string
  size: number
  path: string
  source: FileSource
  sourceRef?: string | null
  ownerId: string
  parentId?: string | null
}

// AGGREGATE. A node in the per-owner file tree (folders link by parentId). It
// guards the lifecycle invariants — what a valid file/folder is, and which
// transitions are allowed (trash/restore, star, share-by-token, AI index) —
// while leaving the bytes to the FileStorage out-port and the row shape to the
// mapper.
export class File extends AggregateRoot<FileId> {
  private constructor(
    id: FileId,
    public readonly ownerId: string,
    private _name: string,
    private _type: string,
    private _mimeType: string | null,
    private _size: number,
    private _path: string | null,
    private _source: FileSource,
    private _sourceRef: string | null,
    private _parentId: FileId | null,
    private readonly _isFolder: boolean,
    private _starred: boolean,
    private _aiIndexed: boolean,
    private _publicToken: string | null,
    private _deletedAt: Date | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id)
  }

  // A real, byte-bearing file. type/mime are derived from the name so the two
  // can never drift out of sync with the extension.
  static upload(id: FileId, props: UploadFileProps, now: Date): Result<File> {
    const name = props.name.trim()
    if (name.length < 1) return fail('File: name is required')
    if (props.size < 0) return fail('File: size must be >= 0')
    if (props.path.trim().length < 1) return fail('File: storage path is required')

    const file = new File(
      id,
      props.ownerId,
      name,
      fileTypeFromName(name),
      mimeTypeFromName(name),
      props.size,
      props.path,
      props.source,
      props.sourceRef ?? null,
      props.parentId ? FileId.of(props.parentId) : null,
      false,
      false,
      false,
      null,
      null,
      now,
      now,
    )
    file.addEvent(new FileUploaded(id.value, props.ownerId, name, props.size, now))
    return ok(file)
  }

  // A folder: no bytes, no path, size 0. Children point at it via parentId.
  static createFolder(
    id: FileId,
    name: string,
    ownerId: string,
    parentId: string | null,
    now: Date,
  ): Result<File> {
    const trimmed = name.trim()
    if (trimmed.length < 1) return fail('File: folder name is required')

    const folder = new File(
      id,
      ownerId,
      trimmed,
      'folder',
      null,
      0,
      null,
      'upload',
      null,
      parentId ? FileId.of(parentId) : null,
      true,
      false,
      false,
      null,
      null,
      now,
      now,
    )
    folder.addEvent(new FolderCreated(id.value, ownerId, trimmed, parentId, now))
    return ok(folder)
  }

  static rehydrate(id: FileId, s: FileSnapshot): File {
    return new File(
      id,
      s.ownerId,
      s.name,
      s.type,
      s.mimeType,
      s.size,
      s.path,
      s.source,
      s.sourceRef,
      s.parentId ? FileId.of(s.parentId) : null,
      s.isFolder,
      s.starred,
      s.aiIndexed,
      s.publicToken,
      s.deletedAt,
      s.createdAt,
      s.updatedAt,
    )
  }

  rename(name: string, now: Date): Result<void> {
    const trimmed = name.trim()
    if (trimmed.length < 1) return fail('File: name is required')
    this._name = trimmed
    this.touch(now)
    this.addEvent(new FileRenamed(this.id.value, trimmed, now))
    return ok(undefined)
  }

  // A node can never be its own parent. Deeper cycle prevention needs the tree
  // and is the move use case's concern, not the aggregate's.
  move(parentId: FileId | null, now: Date): Result<void> {
    if (parentId && parentId.equals(this.id)) {
      return fail('File: a file cannot be moved into itself')
    }
    this._parentId = parentId
    this.touch(now)
    this.addEvent(new FileMoved(this.id.value, parentId ? parentId.value : null, now))
    return ok(undefined)
  }

  toggleStar(now: Date): void {
    this._starred = !this._starred
    this.touch(now)
    this.addEvent(new FileStarred(this.id.value, this._starred, now))
  }

  trash(now: Date): void {
    this._deletedAt = now
    this.touch(now)
    this.addEvent(new FileTrashed(this.id.value, now))
  }

  restore(now: Date): void {
    this._deletedAt = null
    this.touch(now)
    this.addEvent(new FileRestored(this.id.value, now))
  }

  // Records the permanent-deletion event. The caller removes the row and the
  // bytes; this only stamps the aggregate so the event flows out after delete.
  markDeleted(now: Date): void {
    this.addEvent(new FileDeleted(this.id.value, now))
  }

  setAiIndexed(enabled: boolean, now: Date): void {
    this._aiIndexed = enabled
    this.touch(now)
    this.addEvent(new FileAiIndexChanged(this.id.value, enabled, now))
  }

  setPublicToken(token: string | null, now: Date): void {
    this._publicToken = token
    this.touch(now)
    this.addEvent(new FilePublicLinkChanged(this.id.value, token !== null, now))
  }

  private touch(now: Date): void {
    this._updatedAt = now
  }

  get name(): string {
    return this._name
  }
  get type(): string {
    return this._type
  }
  get mimeType(): string | null {
    return this._mimeType
  }
  get size(): number {
    return this._size
  }
  get path(): string | null {
    return this._path
  }
  get source(): FileSource {
    return this._source
  }
  get sourceRef(): string | null {
    return this._sourceRef
  }
  get parentId(): FileId | null {
    return this._parentId
  }
  get isFolder(): boolean {
    return this._isFolder
  }
  get starred(): boolean {
    return this._starred
  }
  get aiIndexed(): boolean {
    return this._aiIndexed
  }
  get publicToken(): string | null {
    return this._publicToken
  }
  get deletedAt(): Date | null {
    return this._deletedAt
  }
  get createdAt(): Date {
    return this._createdAt
  }
  get updatedAt(): Date {
    return this._updatedAt
  }
}
