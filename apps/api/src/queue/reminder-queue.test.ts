import { describe, it, expect, vi, beforeEach } from "vitest";

const addMock = vi.fn(async (_name: string, _data: unknown, opts: { jobId?: string }) => ({ id: opts?.jobId ?? "job" }));
const getJobMock = vi.fn();

vi.mock("./connection.js", () => ({ redisConnection: {} }));
vi.mock("bullmq", () => {
  class MockQueue {
    add = addMock;
    getJob = getJobMock;
  }
  return { Queue: MockQueue };
});

// Import AFTER mocks so Queue() uses the mocked constructor.
const { enqueueReminder, cancelReminderJob } = await import("./reminder-queue.js");

describe("reminder-queue", () => {
  beforeEach(() => {
    addMock.mockClear();
    getJobMock.mockClear();
  });

  it("enqueues with a delay equal to (scheduledFor - now) and a stable jobId", async () => {
    const scheduledFor = new Date(Date.now() + 60_000);
    const jobId = await enqueueReminder("rem-abc", scheduledFor);
    expect(addMock).toHaveBeenCalledOnce();
    const [_name, data, opts] = addMock.mock.calls[0]!;
    expect(data).toEqual({ reminderId: "rem-abc" });
    expect(opts.jobId).toBe("reminder-rem-abc");
    expect(opts.delay).toBeGreaterThan(59_000);
    expect(opts.delay).toBeLessThanOrEqual(60_000);
    expect(jobId).toBe("reminder-rem-abc");
  });

  it("clamps past dates to delay 0", async () => {
    await enqueueReminder("rem-past", new Date(Date.now() - 10_000));
    const [, , opts] = addMock.mock.calls[0]!;
    expect(opts.delay).toBe(0);
  });

  it("cancelReminderJob removes the matching BullMQ job and returns true", async () => {
    const remove = vi.fn(async () => undefined);
    getJobMock.mockResolvedValueOnce({ remove });
    const ok = await cancelReminderJob("rem-xyz");
    expect(getJobMock).toHaveBeenCalledWith("reminder-rem-xyz");
    expect(remove).toHaveBeenCalledOnce();
    expect(ok).toBe(true);
  });

  it("cancelReminderJob returns false when the job is gone", async () => {
    getJobMock.mockResolvedValueOnce(null);
    const ok = await cancelReminderJob("rem-missing");
    expect(ok).toBe(false);
  });
});
