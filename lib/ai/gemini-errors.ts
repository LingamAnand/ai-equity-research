export type GeminiFailure =
  | "not_configured"
  | "rate_limited"
  | "invalid_response"
  | "unavailable"
  | "timeout";

export class GeminiProviderError extends Error {
  readonly failure: GeminiFailure;

  constructor(message: string, failure: GeminiFailure) {
    super(message);
    this.name = "GeminiProviderError";
    this.failure = failure;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorStatus(error: unknown): number | null {
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

function isAbortError(error: unknown): boolean {
  return (
    isRecord(error) &&
    (error.name === "AbortError" ||
      error.code === 20 ||
      error.code === "ABORT_ERR")
  );
}

export function classifyGeminiFailure(error: unknown): GeminiFailure {
  if (getErrorStatus(error) === 429) {
    return "rate_limited";
  }
  if (isAbortError(error)) {
    return "timeout";
  }
  if (error instanceof SyntaxError) {
    return "invalid_response";
  }
  return "unavailable";
}

export function createGeminiProviderError(
  error: unknown,
): GeminiProviderError {
  const failure = classifyGeminiFailure(error);
  let message = "Gemini analysis is unavailable.";

  if (failure === "rate_limited") {
    message = "Gemini rate limit reached. Please wait before trying again.";
  } else if (failure === "timeout") {
    message = "Gemini analysis timed out after 90 seconds. Please try again.";
  } else if (failure === "invalid_response") {
    message = "Gemini returned an invalid response.";
  } else if (failure === "unavailable") {
    message = "AI analysis is temporarily unavailable. Please try again.";
  }

  return new GeminiProviderError(message, failure);
}
