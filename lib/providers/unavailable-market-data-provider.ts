import type {
  Company,
  MarketOverviewItem,
  MarketPrice,
  MarketQuote,
} from "@/lib/types/financial";
import type { MarketDataProvider } from "@/lib/providers/market-data-provider";
import {
  MarketDataError,
  type MarketDataErrorCode,
} from "@/lib/providers/market-data-error";

export class UnavailableMarketDataProvider implements MarketDataProvider {
  readonly id = "unavailable";

  constructor(
    private readonly failure: MarketDataErrorCode,
    private readonly message: string,
    private readonly selectedProvider = "unavailable",
  ) {}

  private unavailable(): never {
    throw new MarketDataError(
      this.message,
      this.failure,
      this.selectedProvider,
    );
  }

  async searchCompanies(): Promise<Company[]> {
    return this.unavailable();
  }

  async getCompany(): Promise<Company | null> {
    return this.unavailable();
  }

  async getQuote(): Promise<MarketQuote> {
    return this.unavailable();
  }

  async getQuotes(): Promise<MarketQuote[]> {
    return this.unavailable();
  }

  async getMarketOverview(): Promise<MarketOverviewItem[]> {
    return this.unavailable();
  }

  async getHistoricalPrices(): Promise<MarketPrice[]> {
    return this.unavailable();
  }
}
