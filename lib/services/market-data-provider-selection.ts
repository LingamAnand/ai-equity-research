import type { MarketDataProviderId } from "../types/financial.ts";
import type { MarketDataErrorCode } from "../providers/market-data-error.ts";

export interface MarketDataProviderConfiguration {
  providerId: MarketDataProviderId;
  failure: MarketDataErrorCode | null;
  message: string | null;
}

const providerIds: MarketDataProviderId[] = [
  "unavailable",
  "demo",
  "yahoo",
  "upstox",
  "angelone",
  "twelvedata",
  "fyers",
];

function isMarketDataProviderId(
  providerId: string,
): providerId is MarketDataProviderId {
  return providerIds.some((supportedId) => supportedId === providerId);
}

export function resolveMarketDataProviderConfiguration(
  environment: Record<string, string | undefined>,
): MarketDataProviderConfiguration {
  const configuredProvider = environment.MARKET_DATA_PROVIDER?.trim();

  if (!configuredProvider) {
    return {
      providerId: "unavailable",
      failure: "provider_not_configured",
      message:
        "Market data is disabled. Set MARKET_DATA_PROVIDER to an explicitly reviewed provider.",
    };
  }

  if (!isMarketDataProviderId(configuredProvider)) {
    return {
      providerId: "unavailable",
      failure: "configuration_error",
      message: "MARKET_DATA_PROVIDER must name a supported provider.",
    };
  }

  const providerId = configuredProvider;

  if (environment.NODE_ENV === "production" && providerId === "demo") {
    return {
      providerId,
      failure: "demo_not_available_in_production",
      message: "The demo market-data provider is restricted to development.",
    };
  }

  if (environment.NODE_ENV === "production" && providerId === "yahoo") {
    return {
      providerId,
      failure: "license_not_approved",
      message:
        "Yahoo Finance cannot be served in production until display and redistribution rights are verified.",
    };
  }

  if (
    environment.NODE_ENV === "production" &&
    providerId === "fyers" &&
    environment.MARKET_DATA_DISPLAY_RIGHTS_APPROVED !== "true"
  ) {
    return {
      providerId,
      failure: "license_not_approved",
      message:
        "FYERS production display is disabled until intended market-data display and redistribution rights are confirmed.",
    };
  }

  if (providerId === "unavailable") {
    return {
      providerId,
      failure: "provider_not_configured",
      message: "Market data is disabled by MARKET_DATA_PROVIDER.",
    };
  }

  if (providerId === "fyers") {
    if (
      !environment.FYERS_CLIENT_ID?.trim() ||
      !environment.FYERS_ACCESS_TOKEN?.trim()
    ) {
      return {
        providerId,
        failure: "missing_credentials",
        message:
          "FYERS market data is not configured. Set FYERS_CLIENT_ID and FYERS_ACCESS_TOKEN on the server, or complete login at /api/fyers/login.",
      };
    }
    if (environment.FYERS_DATA_USE_APPROVED !== "true") {
      return {
        providerId,
        failure: "license_not_approved",
        message:
          "FYERS data use is disabled until provider terms permit the intended private research and charting use.",
      };
    }
    return { providerId, failure: null, message: null };
  }

  if (providerId !== "demo" && providerId !== "yahoo") {
    return {
      providerId,
      failure: "provider_not_implemented",
      message: `The ${providerId} adapter is not implemented.`,
    };
  }

  return { providerId, failure: null, message: null };
}
