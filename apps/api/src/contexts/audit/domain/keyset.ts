// Pure keyset-pagination rule. Callers fetch `limit + 1` rows already ordered by
// the cursor column (here createdAt, desc); this trims to `limit` and derives the
// next cursor from the last kept row. Keeping the page math here (not in the SQL
// adapter) makes it testable without a database.
export interface Page<T> {
  readonly items: T[]
  readonly nextCursor: Date | null
}

export function keysetPage<T>(
  rows: readonly T[],
  limit: number,
  cursorOf: (row: T) => Date,
): Page<T> {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows.slice()
  const last = items[items.length - 1]
  return { items, nextCursor: hasMore && last ? cursorOf(last) : null }
}
