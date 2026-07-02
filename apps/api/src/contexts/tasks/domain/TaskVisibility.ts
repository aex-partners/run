import { Task } from '@/contexts/tasks/domain/Task'

// PURE port of AEX's `task-visibility.ts` security boundary: a task is visible /
// actionable iff the current user created it OR is one of its assignees. The
// read-side equivalent (a SQL WHERE clause) lives in the Drizzle query adapters;
// this is the in-memory check the mutating use cases apply after loading a task.
export const canAccessTask = (task: Task, assigneeUserIds: readonly string[], userId: string): boolean =>
  task.createdBy === userId || assigneeUserIds.includes(userId)
