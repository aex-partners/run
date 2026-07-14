import { EntityRegistry } from '@/contexts/compras/application/ports/out/EntityRegistry'

// Local shape for the data ListEntities in-port this bridge calls. Structurally
// identical to the slice of that port this adapter uses -- kept local (not
// imported) so this adapter never crosses the context boundary at the type
// level; the concrete data in-port injected by main/wiring/compras.ts satisfies
// this shape structurally.
interface ListEntitiesLike {
  execute(): Promise<{ id: string; slug: string }[]>
}

// ACL bridge: compras EntityRegistry -> data ListEntities.
export class DataEntityRegistry implements EntityRegistry {
  constructor(private readonly deps: { listEntities: ListEntitiesLike }) {}

  async entityIdBySlug(slug: string): Promise<string | null> {
    const all = await this.deps.listEntities.execute()
    return all.find((e) => e.slug === slug)?.id ?? null
  }
}
