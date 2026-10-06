import {
  marketDataErrorResponse,
  MarketDataError,
} from "@/lib/providers/market-data-error";
import { getRequestMarketDataService } from "@/lib/services/market-data";
import { fundamentalsService } from "@/lib/services/fundamentals";
import { SecEdgarProviderError } from "@/lib/providers/sec-edgar-fundamentals-provider";
import type { Company } from "@/lib/types/financial";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query || query.length > 80) {
    return Response.json(
      { error: "Provide a search query between 1 and 80 characters." },
      { status: 400 },
    );
  }

  let marketCompanies: Company[] = [];
  let marketError: unknown = null;
  try {
    const marketDataService = await getRequestMarketDataService();
    marketCompanies = await marketDataService.searchCompanies(query);
  } catch (error) {
    if (!(error instanceof MarketDataError)) {
      return marketDataErrorResponse(error, "Company search is unavailable.");
    }
    marketError = error;
  }

  let fundamentalsCompanies;
  let fundamentalsError: unknown = null;
  try {
    fundamentalsCompanies = await fundamentalsService.searchCompanies(query);
  } catch (error) {
    if (!(error instanceof SecEdgarProviderError)) {
      throw error;
    }
    fundamentalsError = error;
  }

  const companiesByTicker = new Map(
    marketCompanies.map((company) => [company.ticker.toLocaleUpperCase(), company]),
  );
  for (const company of fundamentalsCompanies ?? []) {
    if (!companiesByTicker.has(company.ticker.toLocaleUpperCase())) {
      companiesByTicker.set(company.ticker.toLocaleUpperCase(), company);
    }
  }
  const companies = [...companiesByTicker.values()].slice(0, 20);
  const providerErrors = [
    marketError
      ? {
          provider: "market_data",
          code:
            marketError instanceof MarketDataError
              ? marketError.code
              : "unavailable",
        }
      : null,
    fundamentalsError
      ? {
          provider: "sec_edgar_fundamentals",
          code:
            fundamentalsError instanceof SecEdgarProviderError
              ? fundamentalsError.code
              : "unavailable",
        }
      : null,
  ].filter((error) => error !== null);

  if (!companies.length && providerErrors.length) {
    if (marketError instanceof MarketDataError) {
      return marketDataErrorResponse(
        marketError,
        fundamentalsError instanceof SecEdgarProviderError
          ? fundamentalsError.message
          : "Company search is unavailable.",
      );
    }
    if (fundamentalsError instanceof SecEdgarProviderError) {
      return Response.json(
        {
          error: fundamentalsError.message,
          code: fundamentalsError.code,
          dataStatus: "UNAVAILABLE",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  return Response.json(
    { companies, providerErrors },
    { headers: { "Cache-Control": "no-store" } },
  );
}
