import { getRequestMarketDataService } from "@/lib/services/market-data";
import {
  marketDataErrorCategory,
  marketDataErrorResponse,
  MarketDataError,
  marketDataErrorStatus,
} from "@/lib/providers/market-data-error";
import { fundamentalsService } from "@/lib/services/fundamentals";
import { SecEdgarProviderError } from "@/lib/providers/sec-edgar-fundamentals-provider";
import type { FundamentalsAnalysis } from "@/lib/types/fundamentals";
import type { CompanyMarketSnapshot } from "@/lib/types/financial";
import { getIndiaMarketStatus } from "@/lib/market-data/india-market-status";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const marketDataService = await getRequestMarketDataService();
  if (new URL(request.url).searchParams.get("includeFundamentals") === "true") {
    let snapshot: CompanyMarketSnapshot | null = null;
    let marketFailure: MarketDataError | null = null;

    try {
      snapshot = await marketDataService.getCompanySnapshot(ticker);
    } catch (error) {
      if (!(error instanceof MarketDataError)) {
        return marketDataErrorResponse(
          error,
          "Company market data is unavailable.",
        );
      }
      marketFailure = error;
    }

    const marketUnavailableReason =
      marketFailure?.message ??
      (snapshot
        ? "Market data is available from the selected provider."
        : "The selected provider does not support this ticker.");
    let fundamentals: FundamentalsAnalysis | null;
    try {
      fundamentals = await fundamentalsService.getCompanyAnalysis(
        ticker,
        snapshot?.quote ?? null,
        marketUnavailableReason,
      );
    } catch (error) {
      if (!(error instanceof SecEdgarProviderError)) {
        throw error;
      }
      return Response.json(
        {
          error: error.message,
          code: error.code,
          marketError: marketFailure
            ? {
                error: marketFailure.message,
                code: marketFailure.code,
                category: marketDataErrorCategory(marketFailure),
                status: marketDataErrorStatus(marketFailure),
              }
            : null,
          dataStatus: "UNAVAILABLE",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!snapshot && !fundamentals) {
      if (marketFailure) {
        return marketDataErrorResponse(
          marketFailure,
          "Company market data is unavailable.",
        );
      }
      return Response.json(
        {
          error: "Company not found.",
          code: "not_found",
          provider: marketDataService.providerId,
          status: "UNAVAILABLE",
          dataStatus: "UNAVAILABLE",
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      {
        snapshot,
        fundamentals,
        marketError: marketFailure
          ? {
              error: marketFailure.message,
              code: marketFailure.code,
              category: marketDataErrorCategory(marketFailure),
              status: marketDataErrorStatus(marketFailure),
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const snapshot = await marketDataService.getCompanySnapshot(ticker);

    if (!snapshot) {
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

    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return marketDataErrorResponse(
      error,
      "Company market data is unavailable.",
    );
  }
}
