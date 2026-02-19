export class LlmRetriesExhaustedError extends Error {
  public readonly reasons: string[];
  public readonly attempts: number;

  constructor(attempts: number, reasons: string[]) {
    super(`LLM retries exhausted after ${attempts} attempts`);
    this.name = "LlmRetriesExhaustedError";
    this.reasons = reasons;
    this.attempts = attempts;
  }
}

export const withRetries = async <T>(options: {
  maxRetries: number;
  run: (attempt: number, previousErrors: string[]) => Promise<T>;
  shouldRetry?: (value: T) => { retry: boolean; reason?: string };
}): Promise<{ value: T; attempts: number; reasons: string[] }> => {
  const { maxRetries, run, shouldRetry } = options;
  const reasons: string[] = [];
  const maxAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const value = await run(attempt, reasons);
      const retry = shouldRetry?.(value);
      if (retry?.retry) {
        reasons.push(`attempt ${attempt}: ${retry.reason ?? "retry requested"}`);
        continue;
      }
      return { value, attempts: attempt, reasons };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reasons.push(`attempt ${attempt}: ${message}`);
    }
  }

  throw new LlmRetriesExhaustedError(maxAttempts, reasons);
};

