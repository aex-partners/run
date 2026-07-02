import { z } from 'zod'
import { router, protectedProcedure, unwrap } from '@/platform/http/trpc'
import { Json } from '@/shared/domain/Json'
import { InsertRecord } from '@/contexts/data/application/ports/in/InsertRecord'
import { UpdateRecord } from '@/contexts/data/application/ports/in/UpdateRecord'
import { DeleteRecord } from '@/contexts/data/application/ports/in/DeleteRecord'
import { ListRecords } from '@/contexts/data/application/queries/ListRecords'
import { QueryRecords, Condition, AggSpec } from '@/contexts/data/application/queries/QueryRecords'

// JSON value algebra as zod (matches @/shared/domain/Json). A record's `data` is
// an arbitrary JSON object decided at runtime.
const jsonValue: z.ZodType<Json> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
)
const jsonObject = z.record(jsonValue)

// A page row as returned by the read-side query engine (id + CAS version + data).
type QueryRow = { id: string; version: number; data: { [slug: string]: Json } }

// Filter/sort/aggregate input shapes for the paged read side (mirror the pure
// QueryRecordsSpec algebra; the driving adapter only validates + forwards).
const whereOp = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'in', 'between', 'is_null', 'is_not_null'])
const filterCond = z.object({
  field: z.string(),
  op: whereOp,
  value: jsonValue.optional(),
  values: z.array(jsonValue).optional(),
})
const sortSpec = z.object({ field: z.string(), dir: z.enum(['asc', 'desc']).optional() })
const aggFn = z.enum(['count', 'sum', 'avg', 'min', 'max'])

// Driving adapter for the record-level procedures of AEX's entities router.
export const recordController = (deps: {
  insert: InsertRecord
  update: UpdateRecord
  remove: DeleteRecord
  list: ListRecords
  query: QueryRecords
}) =>
  router({
    // entities.records (read)
    records: protectedProcedure
      .input(z.object({ entityId: z.string(), sortBy: z.string().optional() }))
      .query(({ input }) => deps.list.execute(input)),

    // entities.query — server-side paged read (filter + sort + limit/offset) over
    // an entity's records, wired to the same dynamic query engine the AI `query`
    // tool uses. Powers the web Table View's page-based pagination.
    query: protectedProcedure
      .input(
        z.object({
          entityId: z.string(),
          filter: z.array(filterCond).optional(),
          sort: z.array(sortSpec).optional(),
          limit: z.number().int().min(1).max(500).default(50),
          offset: z.number().int().min(0).default(0),
        }),
      )
      .query(async ({ input }) => {
        const result = await deps.query.execute({
          entity: input.entityId,
          where: input.filter as Condition[] | undefined,
          order_by: input.sort,
          limit: input.limit,
          offset: input.offset,
        })
        if ('rows' in result) return { rows: result.rows as QueryRow[], total: result.total }
        return { rows: [] as QueryRow[], total: 0 }
      }),

    // entities.aggregate — footer aggregations ({ field, op }[]) over the SAME
    // filter, computed in-SQL (sum/avg/count/min/max) via the query engine.
    aggregate: protectedProcedure
      .input(
        z.object({
          entityId: z.string(),
          filter: z.array(filterCond).optional(),
          aggregates: z.array(z.object({ field: z.string(), op: aggFn })).min(1),
        }),
      )
      .query(async ({ input }) => {
        const specAggs: AggSpec[] = input.aggregates.map((a, i) => ({ fn: a.op, field: a.field, as: `agg_${i}` }))
        const result = await deps.query.execute({
          entity: input.entityId,
          where: input.filter as Condition[] | undefined,
          aggregate: specAggs,
        })
        const values = 'groups' in result ? (result.groups[0]?.values ?? {}) : {}
        return {
          aggregates: input.aggregates.map((a, i) => ({
            field: a.field,
            op: a.op,
            value: (values[`agg_${i}`] ?? null) as Json,
          })),
        }
      }),

    // entities.createRecord
    createRecord: protectedProcedure
      .input(z.object({ entityId: z.string(), data: jsonObject }))
      .mutation(async ({ ctx, input }) =>
        unwrap(await deps.insert.execute({ entityId: input.entityId, data: input.data, createdBy: ctx.user.id })),
      ),

    // entities.updateRecord — AEX's frontend sends only { recordId, data }, so
    // the optimistic-concurrency token is optional here (defaults to the initial
    // version) to keep the UpdateRecord in-port's required expectedVersion fed.
    updateRecord: protectedProcedure
      .input(z.object({ recordId: z.string(), data: jsonObject, expectedVersion: z.number().optional() }))
      .mutation(async ({ input }) =>
        unwrap(
          await deps.update.execute({
            recordId: input.recordId,
            data: input.data,
            expectedVersion: input.expectedVersion ?? 0,
          }),
        ),
      ),

    // entities.deleteRecord
    deleteRecord: protectedProcedure
      .input(z.object({ recordId: z.string() }))
      .mutation(async ({ input }) => {
        unwrap(await deps.remove.execute(input))
        return { success: true }
      }),
  })
