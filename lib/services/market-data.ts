import "server-only";

import { cookies } from "next/headers";
import { YahooFinanceProvider } from "@/lib/providers/yahoo-finance-provider";
import { FyersMarketDataProvider } from "@/lib/providers/fyers-market-data-provider";
import { DemoMarketDataProvider } from "@/lib/providers/demo-market-data-provider";
import { UnavailableMarketDataProvider } from "@/lib/providers/unavailable-market-data-provider";
import { CompanyService } from "@/lib/services/company-service";
import { MarketDataService } from "@/lib/services/market-data-service";
import { resolveMarketDataProviderConfiguration } from "@/lib/services/market-data-provider-selection";
import { SupabaseDatabaseRepository } from "@/lib/repositories/supabase-database-repository";
import { resolveFyersToken } from "./fyers-token";
import { getFyersLicenseStatus } from "../market-data/fyers-license";

function buildMarketDataService(
  environment: Record<string, string | undefined>,
): MarketDataService {
  const configuration =
    resolveMarketDataProviderConfiguration(environment);
  const marketDataProvider =
    configuration.failure !== null
      ? new UnavailableMarketDataProvider(
          configuration.failure,
          configuration.message ?? "Market data is unavailable.",
          configuration.providerId,
        )
      : configuration.providerId === "demo"
        ? new DemoMarketDataProvider()
        : configuration.providerId === "yahoo"
          ? new YahooFinanceProvider()
          : configuration.providerId === "fyers" &&
              configuration.failure === null
            ? new FyersMarketDataProvider({
                clientId: environment.FYERS_CLIENT_ID?.trim() ?? "",
                accessToken: environment.FYERS_ACCESS_TOKEN?.trim() ?? "",
              licenseStatus: getFyersLicenseStatus(environment),
            })
            : new UnavailableMarketDataProvider(
                configuration.failure ?? "provider_not_implemented",
                configuration.message ??
                  `The ${configuration.providerId} adapter is not implemented.`,
                configuration.providerId,
              );

  return new MarketDataService(
    marketDataProvider,
    new CompanyService(marketDataProvider),
    new SupabaseDatabaseRepository(),
  );
}

export const marketDataService = buildMarketDataService(process.env);

export async function getRequestMarketDataService(): Promise<MarketDataService> {
  const cookieStore = await cookies();
  const tokenResolution = resolveFyersToken(
    cookieStore.get("fyers_access_token")?.value,
    process.env.FYERS_ACCESS_TOKEN,
  );
  console.info("[fyers] Access token resolved", {
    tokenSource: tokenResolution.tokenSource,
    tokenPresent: tokenResolution.tokenPresent,
  });
  const environment = {
    ...process.env,
    FYERS_ACCESS_TOKEN: tokenResolution.accessToken,
  };
  return buildMarketDataService(environment);
}
