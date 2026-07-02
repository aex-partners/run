import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { Scope } from '@/contexts/knowledge/domain/Scope'
import { Category } from '@/contexts/knowledge/domain/Category'
import { KnowledgeCreated } from '@/contexts/knowledge/domain/events/KnowledgeCreated'
import { KnowledgeUpdated } from '@/contexts/knowledge/domain/events/KnowledgeUpdated'
import { KnowledgeDeleted } from '@/contexts/knowledge/domain/events/KnowledgeDeleted'

export interface KnowledgeProps {
  scope: string
  category: string
  title: string
  content: string
  createdBy: string | null
  sourceFileId?: string | null
}

export interface KnowledgePatch {
  scope?: string
  category?: string
  title?: string
  content?: string
}

// AGGREGATE of the knowledge context: a single persistent-memory entry for the
// AI. It guards two kinds of invariant, both PURE:
//   - shape: title/content non-empty, category present, scope valid;
//   - authority: who may see, edit, or delete it (scope + createdBy).
// The embedding (pgvector) is a projection maintained by an adapter, NOT held
// here — exactly as in AEX where it is generated best-effort after the row write.
export class Knowledge extends AggregateRoot<KnowledgeId> {
  private constructor(
    id: KnowledgeId,
    private _scope: Scope,
    private _category: Category,
    private _title: string,
    private _content: string,
    private readonly _createdBy: string | null,
    private readonly _sourceFileId: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id)
  }

  static create(id: KnowledgeId, props: KnowledgeProps, now: Date): Result<Knowledge> {
    const scope = Scope.of(props.scope)
    if (!scope.ok) return fail(scope.error)
    const category = Category.of(props.category)
    if (!category.ok) return fail(category.error)
    const title = props.title.trim()
    if (title.length < 1) return fail('Knowledge: title is required')
    const content = props.content.trim()
    if (content.length < 1) return fail('Knowledge: content is required')

    const knowledge = new Knowledge(
      id,
      scope.value,
      category.value,
      title,
      content,
      props.createdBy,
      props.sourceFileId ?? null,
      now,
      now,
    )
    knowledge.addEvent(new KnowledgeCreated(id.value, scope.value.kind, category.value.value, now))
    return ok(knowledge)
  }

  // Rehydrate from persistence: data is trusted, so no events are recorded. A VO
  // that fails to parse signals a corrupt row, which is exceptional — throw.
  static rehydrate(
    id: KnowledgeId,
    props: KnowledgeProps & { createdAt: Date; updatedAt: Date },
  ): Knowledge {
    const scope = Scope.of(props.scope)
    if (!scope.ok) throw new Error(`Knowledge.rehydrate: ${scope.error}`)
    const category = Category.of(props.category)
    if (!category.ok) throw new Error(`Knowledge.rehydrate: ${category.error}`)
    return new Knowledge(
      id,
      scope.value,
      category.value,
      props.title,
      props.content,
      props.createdBy,
      props.sourceFileId ?? null,
      props.createdAt,
      props.updatedAt,
    )
  }

  // Returns whether the embedding should be regenerated (title/content touched).
  update(patch: KnowledgePatch, now: Date): Result<{ contentChanged: boolean }> {
    if (patch.scope !== undefined) {
      const scope = Scope.of(patch.scope)
      if (!scope.ok) return fail(scope.error)
      this._scope = scope.value
    }
    if (patch.category !== undefined) {
      const category = Category.of(patch.category)
      if (!category.ok) return fail(category.error)
      this._category = category.value
    }
    if (patch.title !== undefined) {
      const title = patch.title.trim()
      if (title.length < 1) return fail('Knowledge: title must not be empty')
      this._title = title
    }
    if (patch.content !== undefined) {
      const content = patch.content.trim()
      if (content.length < 1) return fail('Knowledge: content must not be empty')
      this._content = content
    }

    const contentChanged = patch.title !== undefined || patch.content !== undefined
    this._updatedAt = now
    this.addEvent(new KnowledgeUpdated(this.id.value, now))
    return ok({ contentChanged })
  }

  markDeleted(now: Date): void {
    this.addEvent(new KnowledgeDeleted(this.id.value, now))
  }

  // --- PURE authority rules. `company` entries are everyone's; `personal`
  // entries belong to their creator alone (view, edit, and delete alike).
  isVisibleTo(userId: string): boolean {
    return this._scope.isShared() || this._createdBy === userId
  }

  canBeModifiedBy(userId: string): boolean {
    return this._scope.isShared() || this._createdBy === userId
  }

  canBeDeletedBy(userId: string): boolean {
    return this._scope.isShared() || this._createdBy === userId
  }

  get scope(): Scope {
    return this._scope
  }

  get category(): Category {
    return this._category
  }

  get title(): string {
    return this._title
  }

  get content(): string {
    return this._content
  }

  get createdBy(): string | null {
    return this._createdBy
  }

  get sourceFileId(): string | null {
    return this._sourceFileId
  }

  get createdAt(): Date {
    return this._createdAt
  }

  get updatedAt(): Date {
    return this._updatedAt
  }

  // The text fed to the embedding model — title and content, as in AEX.
  embeddingText(): string {
    return `${this._title}\n${this._content}`
  }
}
