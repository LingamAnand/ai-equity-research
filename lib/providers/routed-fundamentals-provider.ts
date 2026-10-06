import type { Company } from "../types/financial.ts";
import type { FundamentalsHistory } from "../types/fundamentals.ts";
import type { FundamentalsProvider } from "./fundamentals-provider.ts";

export class RoutedFundamentalsProvider implements FundamentalsProvider {
  private readonly hdfcProvider: FundamentalsProvider;
  private readonly genericProvider: FundamentalsProvider;

  constructor(
    hdfcProvider: FundamentalsProvider,
    genericProvider: FundamentalsProvider,
  ) {
    this.hdfcProvider = hdfcProvider;
    this.genericProvider = genericProvider;
  }

  async getFundamentals(ticker: string): Promise<FundamentalsHistory | null> {
    const bankHistory = await this.hdfcProvider.getFundamentals(ticker);
    if (bankHistory) {
      return bankHistory;
    }
    return this.genericProvider.getFundamentals(ticker);
  }

  getCompany(ticker: string): Promise<Company | null> {
    return this.genericProvider.getCompany?.(ticker) ?? Promise.resolve(null);
  }

  searchCompanies(query: string): Promise<Company[]> {
    return (
      this.genericProvider.searchCompanies?.(query) ?? Promise.resolve([])
    );
  }
}
