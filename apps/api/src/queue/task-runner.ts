import type { Database } from "../db/index.js";

class TaskCancelledException extends Error {
  constructor() {
    super("Task was cancelled");
    this.name = "TaskCancelledException";
  }
}

interface TaskInput {
  id: string;
  type: string;
  title: string;
  description: string | null;
  input: string | null;
  conversationId: string | null;
  agentId: string | null;
  toolName: string | null;
  structuredInput: string | null;
}

export async function runTask(
  _task: TaskInput,
  _db: Database,
): Promise<string> {
  throw new Error("AI layer not available. Task execution requires AI to be configured.");
}

export { TaskCancelledException };
