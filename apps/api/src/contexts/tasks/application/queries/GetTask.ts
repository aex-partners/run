import { TaskView } from '@/contexts/tasks/application/queries/ListTasks'

// Read side (CQRS). Single task scoped by visibility (created-by OR assignee),
// with its assignee ids. Returns null when missing or not visible.
export interface GetTaskQuery {
  userId: string
  id: string
}

export interface GetTask {
  execute(query: GetTaskQuery): Promise<TaskView | null>
}
