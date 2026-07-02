// Read side (CQRS). Aggregate counts over the user's visible tasks, answered with
// a single grouped SQL query. Mirrors AEX's `tasks.stats`.
export interface TaskStatsView {
  running: number
  pending: number
  failed: number
  completedToday: number
}

export interface TaskStatsQuery {
  userId: string
}

export interface TaskStats {
  execute(query: TaskStatsQuery): Promise<TaskStatsView>
}
