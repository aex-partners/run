import { ok, Result } from '@/shared/kernel/Result'
import { BlingClient, BlingListParams } from '@/contexts/bling/application/ports/out/BlingClient'
import { BlingRecord } from '@/contexts/bling/domain/BlingRecord'
import { BlingResource } from '@/contexts/bling/domain/BlingResource'

// In-memory, deterministic BlingClient for tests and the offline demo. No network:
// it echoes a couple of records per resource so the shape mirrors the real
// adapter (a `{ items }` list, a single record on get). Never throws.
export class StubBlingClient implements BlingClient {
  // Optional seed so tests can assert on returned records; defaults to a small set.
  constructor(private readonly seed: Partial<Record<BlingResource, BlingRecord[]>> = {}) {}

  async list(
    _token: string,
    resource: BlingResource,
    params: BlingListParams,
  ): Promise<Result<{ items: BlingRecord[] }>> {
    const items = this.seed[resource] ?? [
      { id: 1, nome: `stub-${resource}-1`, pesquisa: params.pesquisa ?? null },
      { id: 2, nome: `stub-${resource}-2` },
    ]
    return ok({ items })
  }

  async get(
    _token: string,
    resource: BlingResource,
    id: string,
  ): Promise<Result<BlingRecord | null>> {
    const seeded = this.seed[resource]?.find((r) => String(r.id) === id)
    if (seeded) return ok(seeded)
    return ok({ id, nome: `stub-${resource}-${id}` })
  }
}
