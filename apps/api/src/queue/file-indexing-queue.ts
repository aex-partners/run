import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export interface FileIndexingJobData {
  fileId: string;
  userId: string;
  action: "index" | "deindex";
}

export const fileIndexingQueue = new Queue("file-indexing", {
  connection: redisConnection,
});

/** Enqueue a file to be indexed or de-indexed for AI knowledge. */
export async function enqueueFileIndexing(options: FileIndexingJobData) {
  await fileIndexingQueue.add("file-indexing", options, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
    removeOnComplete: true,
    removeOnFail: 10,
  });
}
