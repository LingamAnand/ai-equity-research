import { marketDataErrorResponse } from "@/lib/providers/market-data-error";
import { getRequestMarketDataService } from "@/lib/services/market-data";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!query || query.length > 80) {
    return Response.json(
      { error: "Provide a search query between 1 and 80 characters." },
      { status: 400 },
    );
  }

  try {
    const marketDataService = await getRequestMarketDataService();
    const companies = await marketDataService.searchCompanies(query);
    return Response.json(
      { companies },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return marketDataErrorResponse(error, "Company search is unavailable.");
  }
}
