import {
  demoCompany,
  demoHistoricalPrices,
  demoQuote,
} from "@/lib/data/demo-market-data";
import type {
  Company,
  HistoricalPriceRange,
  MarketIndicator,
  MarketPrice,
  MarketQuote,
} from "@/lib/types/financial";
import type { MarketDataProvider } from "@/lib/providers/market-data-provider";

export class DemoMarketDataProvider implements MarketDataProvider {
  readonly id = "demo";

  async searchCompanies(query: string): Promise<Company[]> {
    const company = await this.getCompany(query);
    return company ? [company] : [];
  }

  async getCompany(identifier: string): Promise<Company | null> {
    const normalizedIdentifier = identifier.trim().toLocaleUpperCase();

    if (!normalizedIdentifier) {
      return null;
    }

    const matchesCompany =
      normalizedIdentifier === demoCompany.ticker ||
      normalizedIdentifier === `${demoCompany.ticker}.NS` ||
      normalizedIdentifier === demoCompany.name.toLocaleUpperCase();

    return matchesCompany ? { ...demoCompany } : null;
  }

  async getQuote(company: Company): Promise<MarketQuote> {
    if (company.id !== demoCompany.id) {
      throw new Error(`No demo quote is available for company "${company.ticker}".`);
    }

    return { ...demoQuote };
  }

  async getQuotes(companies: Company[]): Promise<MarketQuote[]> {
    return Promise.all(companies.map((company) => this.getQuote(company)));
  }

  async getMarketOverview(): Promise<MarketIndicator[]> {
    return [];
  }

  async getHistoricalPrices(
    company: Company,
    range: HistoricalPriceRange,
  ): Promise<MarketPrice[]> {
    if (company.id !== demoCompany.id) {
      throw new Error(`No demo price history is available for company "${company.ticker}".`);
    }

    const requestedDays = range === "1mo" ? 31 : range === "3mo" ? 92 : 366;

    return demoHistoricalPrices
      .slice(-requestedDays)
      .map((price) => ({ ...price }));
  }
}
