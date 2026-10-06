import { getIndiaMarketStatus } from "../market-data/india-market-status.ts";

export type MarketDataErrorCode =
  | "invalid_symbol"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "upstream_error"
  | "malformed_response"
  | "provider_not_configured"
  | "provider_not_implemented"
  | "configuration_error"
  | "license_not_approved"
  | "demo_not_available_in_production"
  | "missing_credentials"
  | "authentication_failed"
  | "provider_unavailable"
  | "unsupported_request"
  | "market_closed";

export type MarketDataErrorCategory =
  | "PROVIDER_NOT_CONFIGURED"
  | "CREDENTIALS_NOT_CONFIGURED"
  | "AUTHENTICATION_FAILED"
  | "DATA_UNAVAILABLE"
  | "DATA_RIGHTS_NOT_APPROVED"
  | "PROVIDER_ERROR";

export function marketDataErrorCategory(
  error: unknown,
): MarketDataErrorCategory {
  if (!(error instanceof MarketDataError)) {
    return "PROVIDER_ERROR";
  }

  switch (error.code) {
    case "provider_not_configured":
      return "PROVIDER_NOT_CONFIGURED";
    case "missing_credentials":
      return "CREDENTIALS_NOT_CONFIGURED";
    case "authentication_failed":
      return "AUTHENTICATION_FAILED";
    case "license_not_approved":
      return "DATA_RIGHTS_NOT_APPROVED";
    case "provider_unavailable":
    case "timeout":
    case "rate_limited":
    case "market_closed":
      return "DATA_UNAVAILABLE";
    default:
      return "PROVIDER_ERROR";
  }
}

export class MarketDataError extends Error {
  readonly code: MarketDataErrorCode;
  readonly providerId?: string;

  constructor(
    message: string,
    code: MarketDataErrorCode,
    providerId?: string,
  ) {
    super(message);
    this.name = "MarketDataError";
    this.code = code;
    if (providerId !== undefined) {
      this.providerId = providerId;
    }
  }
}

export function marketDataErrorStatus(error: unknown): number {
  if (!(error instanceof MarketDataError)) {
    return 500;
  }

  switch (error.code) {
    case "invalid_symbol":
      return 400;
    case "not_found":
      return 404;
    case "rate_limited":
      return 429;
    case "timeout":
      return 504;
    case "upstream_error":
    case "malformed_response":
    case "provider_unavailable":
      return 502;
    case "authentication_failed":
      return 502;
    case "unsupported_request":
      return 422;
    case "market_closed":
      return 409;
    case "provider_not_configured":
    case "provider_not_implemented":
    case "configuration_error":
    case "license_not_approved":
    case "demo_not_available_in_production":
    case "missing_credentials":
      return 503;
  }
}

export function marketDataErrorResponse(
  error: unknown,
  fallbackMessage: string,
): Response {
  const marketDataError =
    error instanceof MarketDataError ? error : undefined;
  if (marketDataError) {
    console.warn("[market-data] Provider request failed", {
      provider: marketDataError.providerId ?? "unknown",
      code: marketDataError.code,
    });
  } else {
    console.error("[market-data] Unexpected provider error", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
  const licenseStatus =
    marketDataError?.code === "license_not_approved"
      ? "REQUIRES_REVIEW"
      : marketDataError?.providerId === "demo"
        ? "INTERNAL_ONLY"
        : "UNKNOWN";

  return Response.json(
    {
      error: marketDataError?.message ?? fallbackMessage,
      code: marketDataError?.code ?? "unknown_error",
      category: marketDataErrorCategory(error),
      credentialStatus:
        marketDataError?.code === "authentication_failed"
          ? "INVALID_OR_EXPIRED"
          : marketDataError?.code === "missing_credentials"
            ? "MISSING"
            : "NOT_APPLICABLE",
      provider: marketDataError?.providerId ?? "unknown",
      status: "UNAVAILABLE",
      reason: marketDataError?.message ?? fallbackMessage,
      source: marketDataError?.providerId ?? "unavailable",
      dataStatus: "UNAVAILABLE",
      licenseStatus,
      delayStatus: "UNKNOWN",
      marketStatus: getIndiaMarketStatus().status,
    },
    {
      status: marketDataErrorStatus(error),
      headers: { "Cache-Control": "no-store" },
    },
  );
}
