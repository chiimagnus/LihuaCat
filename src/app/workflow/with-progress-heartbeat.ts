export const runWithProgressHeartbeat = async <T>({
  task,
  onHeartbeat,
  intervalMs = 20000,
}: {
  task: () => Promise<T>;
  onHeartbeat: (elapsedSec: number) => Promise<void> | void;
  intervalMs?: number;
}): Promise<T> => {
  const start = Date.now();
  const timer = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - start) / 1000);
    Promise.resolve(onHeartbeat(elapsedSec)).catch(() => {
      // Heartbeat logging should not crash the main task.
    });
  }, intervalMs);

  try {
    return await task();
  } finally {
    clearInterval(timer);
  }
};
