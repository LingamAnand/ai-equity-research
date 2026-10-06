import type {
  AIResearchResult,
  Company,
  MarketPrice,
} from "../types/financial.ts";
import {
  logPersistenceFailure,
  persistenceErrorCode,
  type PersistenceFailureContext,
} from "../services/persistence-logging.ts";
import type { createSupabasePersistenceServerClient } from "../supabase/persistence-server.ts";

export type SupabaseDatabaseFailure =
  | "not_configured"
  | "migration_not_applied"
  | "access_denied"
  | "query_failed";

export class SupabaseDatabaseError extends Error {
  readonly failure: SupabaseDatabaseFailure;

  constructor(message: string, failure: SupabaseDatabaseFailure) {
    super(message);
    this.name = "SupabaseDatabaseError";
    this.failure = failure;
  }
}

class PersistenceOperationError extends Error {
  readonly context: PersistenceFailureContext;
  readonly postgresErrorCode: string;

  constructor(context: PersistenceFailureContext, postgresErrorCode: string) {
    super("Supabase persistence operation failed.");
    this.name = "PersistenceOperationError";
    this.context = context;
    this.postgresErrorCode = postgresErrorCode;
  }
}

const pendingAnalysisWrites = new Map<string, Promise<void>>();
type PersistenceClient = ReturnType<
  typeof createSupabasePersistenceServerClient
>;

function classifyQueryFailure(code: string | undefined): SupabaseDatabaseFailure {
  if (code === "42P01" || code === "PGRST205") {
    return "migration_not_applied";
  }
  if (code === "42501" || code === "PGRST301") {
    return "access_denied";
  }
  return "query_failed";
}

function failureMessage(failure: SupabaseDatabaseFailure): string {
  switch (failure) {
    case "not_configured":
      return "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";
    case "migration_not_applied":
      return "The Supabase companies table is unavailable. Apply the existing project migration.";
    case "access_denied":
      return "Supabase denied access to the companies table. Review grants and row-level security policies.";
    case "query_failed":
      return "The Supabase database query failed.";
  }
}

export class SupabaseDatabaseRepository {
  private readonly createPersistenceClient: () => Promise<PersistenceClient>;

  constructor(
    createPersistenceClient: () => Promise<PersistenceClient> = async () => {
      const { createSupabasePersistenceServerClient } = await import(
        "../supabase/persistence-server.ts"
      );
      return createSupabasePersistenceServerClient();
    },
  ) {
    this.createPersistenceClient = createPersistenceClient;
  }

  private persistenceError(
    error: unknown,
    context: PersistenceFailureContext,
  ): PersistenceOperationError {
    return new PersistenceOperationError(context, persistenceErrorCode(error));
  }

  private async upsertCompany(
    client: PersistenceClient,
    company: Company,
    repositoryOperation: string,
  ): Promise<string> {
    const { error: upsertError } = await client.from("companies").upsert(
      {
        ticker: company.ticker,
        exchange: company.exchange,
        name: company.name,
        country_code: company.countryCode,
        currency: company.currency,
        sector: company.sector,
        industry: company.industry,
        market_cap:
          company.marketCap !== null && Number.isFinite(company.marketCap)
            ? company.marketCap
            : null,
        is_active: company.isActive,
        source: company.source,
        source_type: company.sourceType,
        source_url: company.sourceUrl,
        retrieved_at: company.retrievedAt,
      },
      { onConflict: "exchange,ticker", ignoreDuplicates: true },
    );
    if (upsertError) {
      throw this.persistenceError(upsertError, {
        repositoryOperation,
        targetTable: "companies",
        operationType: "UPSERT",
      });
    }

    const { data, error: lookupError } = await client
      .from("companies")
      .select("id")
      .eq("exchange", company.exchange)
      .eq("ticker", company.ticker)
      .maybeSingle();
    if (lookupError) {
      throw this.persistenceError(lookupError, {
        repositoryOperation,
        targetTable: "companies",
        operationType: "SELECT",
      });
    }
    if (!data?.id) {
      throw new Error("Company row was not available after persistence.");
    }
    return data.id;
  }

  async persistCompany(company: Company): Promise<string | null> {
    if (company.sourceType === "demo" || company.dataStatus === "DEMO") {
      return null;
    }

    try {
      const client = await this.createPersistenceClient();
      return await this.upsertCompany(client, company, "persistCompany");
    } catch (error) {
      this.logSkippedPersistence(error, {
        repositoryOperation: "persistCompany",
        targetTable: "companies",
        operationType: "UPSERT",
      });
      return null;
    }
  }

  async persistMarketPrices(
    company: Company,
    prices: MarketPrice[],
  ): Promise<void> {
    if (
      company.sourceType === "demo" ||
      company.dataStatus === "DEMO" ||
      prices.length === 0
    ) {
      return;
    }

    try {
      const client = await this.createPersistenceClient();
      const companyId = await this.upsertCompany(
        client,
        company,
        "persistMarketPrices",
      );
      const rows = prices
        .filter(
          (price) =>
            price.sourceType !== "demo" &&
            price.dataStatus !== "DEMO" &&
            Number.isFinite(price.close) &&
            price.close >= 0,
        )
        .map((price) => ({
          company_id: companyId,
          trade_date: price.date,
          currency: price.currency,
          open: price.open,
          high: price.high,
          low: price.low,
          close: price.close,
          adjusted_close: price.adjustedClose,
          volume:
            price.volume !== null &&
            Number.isSafeInteger(price.volume) &&
            price.volume >= 0
              ? price.volume
              : null,
          source: price.source,
          source_type: price.sourceType,
          source_url: price.sourceUrl,
          retrieved_at: price.retrievedAt,
        }));

      if (rows.length === 0) {
        return;
      }

      const { error } = await client.from("market_prices").upsert(rows, {
        onConflict: "company_id,trade_date,source",
        ignoreDuplicates: true,
      });
      if (error) {
        throw this.persistenceError(error, {
          repositoryOperation: "persistMarketPrices",
          targetTable: "market_prices",
          operationType: "UPSERT",
        });
      }
    } catch (error) {
      this.logSkippedPersistence(error, {
        repositoryOperation: "persistMarketPrices",
        targetTable: "market_prices",
        operationType: "UPSERT",
      });
    }
  }

  async persistAIAnalysis(
    result: AIResearchResult,
    promptHash: string,
  ): Promise<void> {
    const key = `${result.company.exchange}:${result.company.ticker}:${result.modelName}:${promptHash}`;
    const pending = pendingAnalysisWrites.get(key);
    if (pending) {
      return pending;
    }

    const write = this.writeAIAnalysis(result, promptHash).finally(() => {
      pendingAnalysisWrites.delete(key);
    });
    pendingAnalysisWrites.set(key, write);
    return write;
  }

  private async writeAIAnalysis(
    result: AIResearchResult,
    promptHash: string,
  ): Promise<void> {
    try {
      const client = await this.createPersistenceClient();
      const companyId = await this.upsertCompany(
        client,
        result.company,
        "persistAIAnalysis",
      );
      const analysis = result.analysis;
      const row = {
        company_id: companyId,
        analysis_type: "equity_research",
        model_name: result.modelName,
        summary: analysis.executiveSummary,
        key_findings: [
          analysis.businessQuality,
          analysis.financialStrength,
          analysis.valuationObservation,
        ],
        risks: [...analysis.keyRisks, ...analysis.redFlags],
        catalysts: analysis.catalysts,
        prompt_hash: promptHash,
        source: result.source,
        source_type: result.sourceType,
        source_url: result.sourceUrl,
        retrieved_at: result.retrievedAt,
        expires_at: new Date(
          new Date(result.analyzedAt).getTime() + 6 * 60 * 60 * 1000,
        ).toISOString(),
      };

      const { data: existing, error: lookupError } = await client
        .from("ai_analysis")
        .select("id")
        .eq("company_id", companyId)
        .eq("analysis_type", row.analysis_type)
        .eq("model_name", result.modelName)
        .eq("prompt_hash", promptHash)
        .limit(1)
        .maybeSingle();
      if (lookupError) {
        throw this.persistenceError(lookupError, {
          repositoryOperation: "persistAIAnalysis",
          targetTable: "ai_analysis",
          operationType: "SELECT",
        });
      }

      const { error } = existing
        ? await client.from("ai_analysis").update(row).eq("id", existing.id)
        : await client.from("ai_analysis").insert(row);
      if (error) {
        throw this.persistenceError(error, {
          repositoryOperation: "persistAIAnalysis",
          targetTable: "ai_analysis",
          operationType: existing ? "UPDATE" : "INSERT",
        });
      }
    } catch (error) {
      this.logSkippedPersistence(error, {
        repositoryOperation: "persistAIAnalysis",
        targetTable: "ai_analysis",
        operationType: "INSERT",
      });
    }
  }

  private logSkippedPersistence(
    error: unknown,
    fallbackContext: PersistenceFailureContext,
  ): void {
    const context =
      error instanceof PersistenceOperationError
        ? error.context
        : fallbackContext;
    logPersistenceFailure(error, context);
  }

  async checkConnection(): Promise<{ checkedAt: string }> {
    const { createSupabaseServerClient, SupabaseConfigurationError } =
      await import("../supabase/server.ts");
    let client: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    try {
      client = await createSupabaseServerClient();
    } catch (error) {
      if (error instanceof SupabaseConfigurationError) {
        throw new SupabaseDatabaseError(
          failureMessage("not_configured"),
          "not_configured",
        );
      }
      throw error;
    }

    const { error } = await client
      .from("companies")
      .select("id")
      .limit(1);

    if (error) {
      const failure = classifyQueryFailure(error.code);
      console.error("[supabase] Database health query failed.", {
        failure,
        code: error.code,
      });
      throw new SupabaseDatabaseError(failureMessage(failure), failure);
    }

    return { checkedAt: new Date().toISOString() };
  }
}
