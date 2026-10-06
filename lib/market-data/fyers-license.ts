import type { MarketDataLicenseStatus } from "../types/financial.ts";

export function getFyersLicenseStatus(
  environment: Record<string, string | undefined>,
): MarketDataLicenseStatus {
  return environment.FYERS_DATA_USE_APPROVED === "true" &&
    environment.MARKET_DATA_DISPLAY_RIGHTS_APPROVED === "true"
    ? "DISPLAY_ALLOWED"
    : "REQUIRES_REVIEW";
}
