import type { HistoricalPriceRange } from "@/lib/types/financial";
import {
  marketDataErrorResponse,
} from "@/lib/providers/market-data-error";
import { getRequestMarketDataService } from "@/lib/services/market-data";
import { getIndiaMarketStatus } from "@/lib/market-data/india-market-status";

const supportedRanges: HistoricalPriceRange[] = [
  "1d",
  "1w",
  "1mo",
  "3mo",
  "6mo",
  "1y",
  "5y",
];

function isHistoricalPriceRange(value: string): value is HistoricalPriceRange {
  return supportedRanges.some((range) => range === value);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const requestedRange = new URL(request.url).searchParams.get("range") ?? "1mo";

  if (!isHistoricalPriceRange(requestedRange)) {
    return Response.json(
      { error: "Unsupported price range. Use 1d, 1w, 1mo, 3mo, 6mo, 1y, or 5y." },
      { status: 400 },
    );
  }

  try {
    const marketDataService = await getRequestMarketDataService();
    const prices = await marketDataService.getHistoricalPrices(
      ticker,
      requestedRange,
    );

    if (!prices) {
      return Response.json(
        {
          error: "Company not found.",
          code: "not_found",
          provider: marketDataService.providerId,
          status: "UNAVAILABLE",
          reason: "The selected market-data provider does not support this ticker.",
          source: marketDataService.providerId,
          dataStatus: "UNAVAILABLE",
          licenseStatus: "UNKNOWN",
          delayStatus: "UNKNOWN",
          marketStatus: getIndiaMarketStatus().status,
        },
        {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    return Response.json(
      { prices },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return marketDataErrorResponse(
      error,
      "Historical market data is unavailable.",
    );
  }
}
