import { getRequestMarketDataService } from "@/lib/services/market-data";
import { fundamentalsService } from "@/lib/services/fundamentals";
import { MarketDataError } from "@/lib/providers/market-data-error";
import { SecEdgarProviderError } from "@/lib/providers/sec-edgar-fundamentals-provider";
import {
  buildCompanyValuation,
  type ValuationRequestInputs,
} from "@/lib/services/valuation-service";
import type {
  ForecastScalarAssumptions,
  ScenarioOverrides,
  ValuationScenarioName,
  WaccInputs,
} from "@/lib/types/valuation";

const ASSUMPTION_KEYS = [
  "revenueGrowth",
  "ebitdaMargin",
  "ebitMargin",
  "taxRate",
  "depreciationToRevenue",
  "capexToRevenue",
  "changeInNwcToRevenue",
  "terminalGrowth",
  "forecastYears",
] as const satisfies readonly Exclude<
  keyof ForecastScalarAssumptions,
  "wacc"
>[];

const WACC_KEYS = [
  "riskFreeRate",
  "beta",
  "equityRiskPremium",
  "costOfDebt",
  "taxRate",
  "marketCapitalization",
  "debt",
  "terminalGrowth",
] as const satisfies readonly (keyof WaccInputs)[];

const SCENARIO_KEYS = [
  "revenueGrowth",
  "ebitdaMargin",
  "ebitMargin",
  "taxRate",
  "depreciationToRevenue",
  "capexToRevenue",
  "changeInNwcToRevenue",
  "terminalGrowth",
  "wacc",
  "forecastYears",
] as const satisfies readonly (keyof ScenarioOverrides)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumberRecord<T extends string>(
  value: unknown,
  allowedKeys: readonly T[],
): Partial<Record<T, number>> | null {
  if (!isRecord(value)) {
    return null;
  }
  const entries = Object.entries(value);
  if (
    entries.some(
      ([key, item]) =>
        !allowedKeys.includes(key as T) ||
        typeof item !== "number" ||
        !Number.isFinite(item),
    )
  ) {
    return null;
  }
  return Object.fromEntries(entries) as Partial<Record<T, number>>;
}

function parseValuationRequest(value: unknown): ValuationRequestInputs | null {
  if (!isRecord(value)) {
    return null;
  }
  const allowedTopLevel = new Set([
    "assumptions",
    "waccInputs",
    "scenarios",
    "annualForecast",
  ]);
  if (Object.keys(value).some((key) => !allowedTopLevel.has(key))) {
    return null;
  }
  const result: ValuationRequestInputs = {};
  if (value.assumptions !== undefined) {
    const assumptions = readNumberRecord(
      value.assumptions,
      ASSUMPTION_KEYS,
    );
    if (
      assumptions === null ||
      (assumptions.forecastYears !== undefined &&
        !Number.isInteger(assumptions.forecastYears))
    ) {
      return null;
    }
    result.assumptions = assumptions;
  }
  if (value.waccInputs !== undefined) {
    if (!isRecord(value.waccInputs)) {
      return null;
    }
    const entries = Object.entries(value.waccInputs);
    if (
      entries.some(
        ([key, item]) =>
          !WACC_KEYS.includes(key as (typeof WACC_KEYS)[number]) ||
          (item !== null &&
            (typeof item !== "number" || !Number.isFinite(item))),
      )
    ) {
      return null;
    }
    const nullableNumber = (key: (typeof WACC_KEYS)[number]) =>
      value.waccInputs &&
      typeof value.waccInputs === "object" &&
      key in value.waccInputs
        ? (value.waccInputs as Record<string, number | null>)[key]
        : null;
    result.waccInputs = {
      riskFreeRate: nullableNumber("riskFreeRate"),
      beta: nullableNumber("beta"),
      equityRiskPremium: nullableNumber("equityRiskPremium"),
      costOfDebt: nullableNumber("costOfDebt"),
      taxRate: nullableNumber("taxRate"),
      marketCapitalization: nullableNumber("marketCapitalization"),
      debt: nullableNumber("debt"),
      terminalGrowth: nullableNumber("terminalGrowth"),
    };
  }
  if (value.scenarios !== undefined) {
    if (!isRecord(value.scenarios)) {
      return null;
    }
    const scenarios: Partial<
      Record<ValuationScenarioName, ScenarioOverrides>
    > = {};
    for (const [name, overrideValues] of Object.entries(value.scenarios)) {
      if (!["base", "bull", "bear"].includes(name)) {
        return null;
      }
      const overrides = readNumberRecord(
        overrideValues,
        SCENARIO_KEYS,
      );
      if (
        overrides === null ||
        (overrides.forecastYears !== undefined &&
          !Number.isInteger(overrides.forecastYears))
      ) {
        return null;
      }
      scenarios[name as ValuationScenarioName] =
        overrides as ScenarioOverrides;
    }
    result.scenarios = scenarios;
  }
  if (value.annualForecast !== undefined) {
    if (!Array.isArray(value.annualForecast) || value.annualForecast.length > 20) {
      return null;
    }
    const annualKeys = [
      "revenueGrowth",
      "ebitdaMargin",
      "ebitMargin",
      "taxRate",
      "depreciationToRevenue",
      "capexToRevenue",
      "changeInNwcToRevenue",
    ] as const;
    const annualForecast: NonNullable<
      ValuationRequestInputs["annualForecast"]
    > = [];
    const seenYears = new Set<number>();
    for (const item of value.annualForecast) {
      if (
        !isRecord(item) ||
        typeof item.fiscalYear !== "number" ||
        !Number.isInteger(item.fiscalYear) ||
        seenYears.has(item.fiscalYear)
      ) {
        return null;
      }
      const { fiscalYear, ...assumptionValues } = item;
      const values = readNumberRecord(assumptionValues, annualKeys);
      if (values === null) {
        return null;
      }
      seenYears.add(fiscalYear);
      annualForecast.push({
        fiscalYear,
        ...values,
      });
    }
    result.annualForecast = annualForecast;
  }
  return result;
}

async function getValuationResponse(
  ticker: string,
  requestInputs: ValuationRequestInputs = {},
) {
  const marketDataService = await getRequestMarketDataService();
  let snapshot = null;
  let marketError: MarketDataError | null = null;
  try {
    snapshot = await marketDataService.getCompanySnapshot(ticker);
  } catch (error) {
    if (error instanceof MarketDataError) {
      marketError = error;
    } else {
      throw error;
    }
  }

  const analysis = await fundamentalsService.getCompanyAnalysis(
    ticker,
    snapshot?.quote ?? null,
    marketError?.message ?? "Market quote unavailable from the selected provider.",
  );
  if (!snapshot && !analysis) {
    return Response.json(
      {
        error: "Company not found in the selected market or fundamentals providers.",
        code: "not_found",
        dataStatus: "UNAVAILABLE",
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const company = snapshot?.company ?? {
    ticker: analysis!.company.ticker,
    name: analysis!.company.companyName,
    exchange: analysis!.company.exchange,
    sector: null,
    industry: null,
  };
  const valuation = buildCompanyValuation(
    company,
    analysis,
    snapshot?.quote ?? null,
    requestInputs,
  );
  return Response.json(
    {
      ...valuation,
      marketError: marketError
        ? {
            provider: marketError.providerId ?? "unknown",
            code: marketError.code,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  try {
    return await getValuationResponse(ticker);
  } catch (error) {
    if (error instanceof SecEdgarProviderError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          dataStatus: "UNAVAILABLE",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof RangeError) {
      return Response.json(
        { error: error.message, code: "invalid_valuation_assumptions" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("[valuation] Request failed.", {
      operation: "GET company valuation",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      {
        error: "Unable to retrieve company valuation inputs.",
        code: "valuation_data_unavailable",
        dataStatus: "UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON.", code: "invalid_request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const inputs = parseValuationRequest(body);
  if (!inputs) {
    return Response.json(
      {
        error: "Valuation assumptions contain unsupported fields or invalid values.",
        code: "invalid_request",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    return await getValuationResponse(ticker, inputs);
  } catch (error) {
    if (error instanceof SecEdgarProviderError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          dataStatus: "UNAVAILABLE",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof RangeError) {
      return Response.json(
        { error: error.message, code: "invalid_valuation_assumptions" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("[valuation] Request failed.", {
      operation: "POST company valuation",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      {
        error: "Unable to retrieve company valuation inputs.",
        code: "valuation_data_unavailable",
        dataStatus: "UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
