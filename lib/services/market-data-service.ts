import type {
  Company,
  CompanyMarketSnapshot,
  HistoricalPriceRange,
  MarketOverviewItem,
  MarketPrice,
  MarketQuote,
} from "@/lib/types/financial";
import type { MarketDataProvider } from "@/lib/providers/market-data-provider";
import { MarketDataError } from "@/lib/providers/market-data-error";
import { CompanyService } from "@/lib/services/company-service";
import { runBestEffortPersistence } from "@/lib/services/persistence-logging";

export interface MarketDataPersistence {
  persistCompany(company: Company): Promise<string | null>;
  persistMarketPrices(company: Company, prices: MarketPrice[]): Promise<void>;
}

export class MarketDataService {
  constructor(
    private readonly provider: MarketDataProvider,
    private readonly companyService: CompanyService,
    private readonly persistence?: MarketDataPersistence,
  ) {}

  get providerId(): string {
    return this.provider.id;
  }

  searchCompanies(query: string): Promise<Company[]> {
    return this.companyService.searchCompanies(query);
  }

  async getCompanySnapshot(
    identifier: string,
  ): Promise<CompanyMarketSnapshot | null> {
    const company = await this.companyService.getCompany(identifier);

    if (!company) {
      return null;
    }

    const quote = await this.provider.getQuote(company);
    const persistence = this.persistence;
    if (persistence) {
      await runBestEffortPersistence(
        {
          repositoryOperation: "persistCompany",
          targetTable: "companies",
          operationType: "UPSERT",
        },
        () => persistence.persistCompany(company),
      );
    }
    return { company, quote };
  }

  async getCompanyQuotes(identifiers: string[]): Promise<MarketQuote[]> {
    const companies = await Promise.all(
      identifiers.map((identifier) =>
        this.companyService.getCompany(identifier),
      ),
    );
    const missingCompany = companies.find((company) => company === null);
    if (missingCompany) {
      throw new MarketDataError(
        "A requested company is unsupported by the selected provider.",
        "not_found",
        this.provider.id,
      );
    }
    return this.provider.getQuotes(
      companies.filter((company): company is Company => company !== null),
    );
  }

  getMarketOverview(): Promise<MarketOverviewItem[]> {
    return this.provider.getMarketOverview();
  }

  async getHistoricalPrices(
    identifier: string,
    range: HistoricalPriceRange,
  ): Promise<MarketPrice[] | null> {
    const company = await this.companyService.getCompany(identifier);

    if (!company) {
      return null;
    }

    const prices = await this.provider.getHistoricalPrices(company, range);
    const persistence = this.persistence;
    if (persistence) {
      await runBestEffortPersistence(
        {
          repositoryOperation: "persistMarketPrices",
          targetTable: "market_prices",
          operationType: "UPSERT",
        },
        () => persistence.persistMarketPrices(company, prices),
      );
    }
    return prices;
  }
}
