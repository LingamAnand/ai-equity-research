import { buildFundamentalsAnalysis } from "@/lib/calculations/fundamentals-analysis";
import type { MarketQuote } from "@/lib/types/financial";
import type { FundamentalsProvider } from "@/lib/providers/fundamentals-provider";
import type {
  FundamentalsAnalysis,
  FundamentalsHistory,
} from "@/lib/types/fundamentals";
import type { Company } from "@/lib/types/financial";

export class FundamentalsService {
  constructor(private readonly provider: FundamentalsProvider) {}

  getCompanyFundamentals(
    ticker: string,
  ): Promise<FundamentalsHistory | null> {
    return this.provider.getFundamentals(ticker);
  }

  getCompanyLookup(ticker: string): Promise<Company | null> {
    return this.provider.getCompany?.(ticker) ?? Promise.resolve(null);
  }

  searchCompanies(query: string): Promise<Company[]> {
    return this.provider.searchCompanies?.(query) ?? Promise.resolve([]);
  }

  async getCompanyAnalysis(
    ticker: string,
    quote: MarketQuote | null = null,
    marketUnavailableReason?: string,
  ): Promise<FundamentalsAnalysis | null> {
    const fundamentals = await this.provider.getFundamentals(ticker);
    return fundamentals
      ? buildFundamentalsAnalysis(
          fundamentals,
          quote,
          marketUnavailableReason,
        )
      : null;
  }
}
