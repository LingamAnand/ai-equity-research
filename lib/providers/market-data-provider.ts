import type {
  Company,
  HistoricalPriceRange,
  MarketOverviewItem,
  MarketPrice,
  MarketDataProviderId,
  MarketQuote,
} from "@/lib/types/financial";

export interface MarketDataProvider {
  readonly id: MarketDataProviderId;
  searchCompanies(query: string): Promise<Company[]>;
  getCompany(identifier: string): Promise<Company | null>;
  getQuote(company: Company): Promise<MarketQuote>;
  getQuotes(companies: Company[]): Promise<MarketQuote[]>;
  getMarketOverview(): Promise<MarketOverviewItem[]>;
  getHistoricalPrices(
    company: Company,
    range: HistoricalPriceRange,
  ): Promise<MarketPrice[]>;
}
