import { marketDataErrorResponse } from "@/lib/providers/market-data-error";
import { getRequestMarketDataService } from "@/lib/services/market-data";

export async function GET() {
  try {
    const marketDataService = await getRequestMarketDataService();
    const indicators = await marketDataService.getMarketOverview();
    return Response.json(
      { indicators },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return marketDataErrorResponse(error, "Market overview is unavailable.");
  }
}
