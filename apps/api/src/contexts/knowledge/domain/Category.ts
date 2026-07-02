import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. A free-form bucket (company-info, client, product, preference, ...). One
// value is reserved: `file-content`, used for KB rows auto-indexed from files.
// Default listings hide it; semantic/RAG queries may include it.
export class Category {
  static readonly FILE_CONTENT = 'file-content'

  private constructor(public readonly value: string) {}

  static of(raw: string): Result<Category> {
    const trimmed = raw.trim()
    if (trimmed.length < 1) return fail('Category: must not be empty')
    return ok(new Category(trimmed))
  }

  isFileContent(): boolean {
    return this.value === Category.FILE_CONTENT
  }

  equals(other: Category): boolean {
    return other.value === this.value
  }
}
