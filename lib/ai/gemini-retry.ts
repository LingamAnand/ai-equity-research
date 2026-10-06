function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRateLimited(error: unknown): boolean {
  return (
    isRecord(error) &&
    (error.status === 429 ||
      error.status === "429" ||
      error.code === 429 ||
      error.code === "429")
  );
}

function getStatus(error: unknown): number | null {
  if (!isRecord(error)) {
    return null;
  }
  if (typeof error.status === "number") {
    return error.status;
  }
  if (typeof error.status === "string" && /^\d{3}$/.test(error.status)) {
    return Number(error.status);
  }
  if (typeof error.code === "number") {
    return error.code;
  }
  if (typeof error.code === "string" && /^\d{3}$/.test(error.code)) {
    return Number(error.code);
  }
  return null;
}

function isTransientUnavailable(error: unknown): boolean {
  if (isRateLimited(error)) {
    return false;
  }
  if (getStatus(error) === 503) {
    return true;
  }
  return (
    isRecord(error) &&
    ((typeof error.code === "string" &&
      error.code.toUpperCase() === "UNAVAILABLE") ||
      (typeof error.status === "string" &&
        error.status.toUpperCase() === "UNAVAILABLE") ||
      (typeof error.message === "string" &&
        /\bUNAVAILABLE\b/i.test(error.message)))
  );
}

export async function withGeminiTransientRetries<T>(
  request: (timeoutMs: number) => Promise<T>,
  options: {
    timeoutMs?: number;
    maxRetries?: number;
    baseDelayMs?: number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const deadline = Date.now() + timeoutMs;

  for (let retry = 0; ; retry += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      const timeoutError = new Error("Gemini analysis request timed out.");
      timeoutError.name = "AbortError";
      throw timeoutError;
    }

    try {
      return await request(remainingMs);
    } catch (error) {
      if (!isTransientUnavailable(error) || retry >= maxRetries) {
        throw error;
      }

      const availableMs = deadline - Date.now();
      const delayMs = Math.min(baseDelayMs * 2 ** retry, availableMs);
      if (delayMs <= 0 || delayMs >= availableMs) {
        throw error;
      }
      await sleep(delayMs);
    }
  }
}
