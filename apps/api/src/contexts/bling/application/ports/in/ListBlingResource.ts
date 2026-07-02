import { Result } from '@/shared/kernel/Result'
import { BlingRecord } from '@/contexts/bling/domain/BlingRecord'
import { BlingResource } from '@/contexts/bling/domain/BlingResource'

// Driving port. Lists records of a Bling resource (produtos / pedidos / contatos)
// with optional pagination and free-text search. Fails with the "connect in
// Settings" message when Bling is not connected.
export interface ListBlingResourceQuery {
  resource: BlingResource
  pagina?: number
  limite?: number
  pesquisa?: string
}

export interface ListBlingResource {
  execute(query: ListBlingResourceQuery): Promise<Result<{ items: BlingRecord[] }>>
}
