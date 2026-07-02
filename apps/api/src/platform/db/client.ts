import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '@/platform/db/schema'

// The DB type adapters depend on, and the factory that builds the pool. The real
// pool is created once in main; adapters receive `Database` by injection and
// never open their own connection. Mirrors AEX's drizzle(postgres(url)) setup
// (postgres-js driver, pgvector-enabled pg17).
export type Database = ReturnType<typeof makeDb>

export function makeDb(url: string) {
  return drizzle(postgres(url), { schema })
}
