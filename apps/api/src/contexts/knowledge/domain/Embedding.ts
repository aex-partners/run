import { Result, ok, fail } from '@/shared/kernel/Result'

// VO. A dense vector produced by an embedding model. The dimension is implicit
// in the array length (voyage-3 = 1024 for KB, 1536 for message embeddings).
// Pure: it carries no knowledge of pgvector or any model.
export class Embedding {
  private constructor(private readonly _values: readonly number[]) {}

  static of(values: number[]): Result<Embedding> {
    if (values.length < 1) return fail('Embedding: must have at least one dimension')
    return ok(new Embedding([...values]))
  }

  get dimensions(): number {
    return this._values.length
  }

  toArray(): number[] {
    return [...this._values]
  }
}
