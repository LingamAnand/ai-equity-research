import type { Company } from "@/lib/types/financial";
import type { MarketDataProvider } from "@/lib/providers/market-data-provider";

export class CompanyService {
  constructor(private readonly provider: MarketDataProvider) {}

  searchCompanies(query: string): Promise<Company[]> {
    return this.provider.searchCompanies(query);
  }

  getCompany(identifier: string): Promise<Company | null> {
    return this.provider.getCompany(identifier);
  }
}
