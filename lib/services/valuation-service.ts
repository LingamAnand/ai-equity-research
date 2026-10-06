import {
  cagrForFinancialYears,
  buildAnnualForecastAssumptions,
  calculateHistoricalTrends,
  deriveForecastAssumptions,
  normalizeFinancialYears,
  setUserProvidedAssumption,
} from "../calculations/financial-analysis.ts";
import { calculateFcffDcf } from "../calculations/dcf.ts";
import { calculateDcfScenarios } from "../calculations/scenarios.ts";
import { calculateWacc } from "../calculations/wacc.ts";
import { calculateDcfSensitivity } from "../calculations/sensitivity.ts";
import type {
  FundamentalsAnalysis,
  FundamentalMetric,
} from "../types/fundamentals.ts";
import type { MarketQuote } from "../types/financial.ts";
import type {
  DcfResult,
  FinancialMetricProvenance,
  FinancialYearInput,
  HistoricalTrendMetric,
  ForecastAssumptions,
  ForecastScalarAssumptions,
  ScenarioOverrides,
  SectorClassification,
  ValuationMethodClass,
  ValuationDataQuality,
  ValuationScenarioName,
  WaccInputs,
  WaccAssumptionModel,
  WaccResult,
  TerminalGrowthGuidance,
} from "../types/valuation.ts";

type FundamentalsValuationData = Pick<
  FundamentalsAnalysis,
  "company" | "periods" | "financials" | "statements" | "warnings"
> & {
  companyType?: FundamentalsAnalysis["companyType"] | null;
};

const METRIC_ALIASES = {
  revenue: ["revenue", "netRevenue"],
  ebitda: ["ebitda"],
  ebit: ["ebit"],
  netIncome: ["netIncome", "profitAfterTax"],
  profitBeforeTax: ["profitBeforeTax"],
  depreciation: ["depreciation", "depreciationAndAmortization"],
  capex: ["capex", "capitalExpenditure", "capitalExpenditures"],
  workingCapital: ["netWorkingCapital"],
  changeInWorkingCapital: ["changeInWorkingCapital"],
  cash: ["cashAndCashEquivalents", "cashAndEquivalents"],
  debt: ["totalDebt"],
  shortTermDebt: ["shortTermDebt", "currentDebt"],
  longTermDebt: ["longTermDebt", "nonCurrentDebt"],
  sharesOutstanding: ["sharesOutstanding"],
  dilutedShares: ["dilutedSharesOutstanding", "dilutedShares"],
  equity: ["shareholdersEquity", "totalEquity", "totalNetWorth", "equity"],
  incomeTaxExpense: ["incomeTaxExpense", "taxExpense"],
} as const;

type MappedMetric = keyof typeof METRIC_ALIASES;

function toValuationUnits(metric: FundamentalMetric): number | null {
  if (metric.status === "unavailable") {
    return null;
  }
  switch (metric.provenance.unit) {
    case "INR_CRORE":
      return metric.provenance.currency === "INR" ? metric.value : null;
    case "INR_BILLION":
      return metric.provenance.currency === "INR" ? metric.value * 10 : null;
    case "USD_MILLION":
      return metric.provenance.currency === "USD"
        ? metric.value / 1000
        : null;
    case "USD_BILLION":
      return metric.provenance.currency === "USD" ? metric.value : null;
    case "CRORE_SHARES":
    case "BILLION_SHARES":
      return metric.value;
    default:
      return null;
  }
}

function valueForMetric(
  key: MappedMetric,
  metric: FundamentalMetric | undefined,
): number | null {
  const value = metric ? toValuationUnits(metric) : null;
  return key === "capex" && value !== null ? Math.abs(value) : value;
}

function metricForPeriod(
  analysis: FundamentalsValuationData,
  periodId: string,
  aliases: readonly string[],
): FundamentalMetric | undefined {
  const metrics = [
    ...analysis.financials,
    ...analysis.statements.incomeStatement,
    ...analysis.statements.balanceSheet,
    ...analysis.statements.cashFlowStatement.metrics,
  ];
  return metrics.find(
    (metric) =>
      metric.periodId === periodId &&
      aliases.includes(metric.id) &&
      metric.status !== "unavailable",
  );
}

function provenanceFor(
  metric: FundamentalMetric | undefined,
): FinancialMetricProvenance | undefined {
  if (!metric || metric.status === "unavailable") {
    return undefined;
  }
  return {
    sourceMetricId: metric.id,
    source: metric.provenance.source,
    sourceType:
      metric.provenance.sourceType === "calculated"
        ? "calculated"
        : "official_company_filing",
    sourceUrl: metric.provenance.sourceUrl,
    periodEnd: metric.provenance.period.periodEnd,
    publicationDate: metric.provenance.publicationDate,
    retrievedAt: metric.provenance.retrievedAt,
    unit: metric.provenance.unit,
    currency: metric.provenance.currency,
    pageReference: metric.provenance.pageReference,
    sectionReference: metric.provenance.sectionReference,
  };
}

function calculatedMetricProvenance(
  sourceMetricId: string,
  sources: FinancialMetricProvenance[],
  sectionReference: string,
): FinancialMetricProvenance {
  const first = sources[0]!;
  return {
    sourceMetricId,
    source: "EquityMind deterministic calculation",
    sourceType: "calculated",
    sourceUrl: sources.length === 1 ? first.sourceUrl : null,
    periodEnd: first.periodEnd,
    publicationDate: sources
      .map((source) => source.publicationDate)
      .sort()
      .at(-1)!,
    retrievedAt: sources
      .map((source) => source.retrievedAt)
      .sort()
      .at(-1)!,
    unit: first.unit,
    currency: first.currency,
    pageReference: sources
      .map((source) => source.pageReference)
      .filter(Boolean)
      .join("; "),
    sectionReference,
  };
}

function uniqueProvenance(
  sources: Array<FinancialMetricProvenance | undefined>,
): FinancialMetricProvenance[] {
  return [
    ...new Map(
      sources
        .filter(
          (source): source is FinancialMetricProvenance => Boolean(source),
        )
        .map((source) => [
          `${source.sourceMetricId}:${source.periodEnd}:${source.sourceUrl ?? ""}`,
          source,
        ]),
    ).values(),
  ];
}

function quoteProvenance(quote: MarketQuote): FinancialMetricProvenance {
  const quoteDate = quote.asOf?.slice(0, 10) ?? quote.retrievedAt.slice(0, 10);
  return {
    sourceMetricId: "currentMarketPrice",
    source: quote.source,
    sourceType: "market_data",
    sourceUrl: quote.sourceUrl,
    periodEnd: quoteDate,
    publicationDate: quote.asOf ?? quote.retrievedAt,
    retrievedAt: quote.retrievedAt,
    unit: `${quote.currency}/share`,
    currency: quote.currency,
    pageReference: "",
    sectionReference: "Provider market quote",
  };
}

export function normalizeFundamentalsHistory(
  analysis: FundamentalsValuationData | null,
): FinancialYearInput[] {
  if (!analysis) {
    return [];
  }
  return analysis.periods
    .filter((period) => period.periodType === "annual")
    .map((period) => {
      const metrics = Object.fromEntries(
        Object.entries(METRIC_ALIASES).map(([key, aliases]) => [
          key,
          metricForPeriod(analysis, period.id, aliases),
        ]),
      ) as Partial<Record<MappedMetric, FundamentalMetric>>;
      const values = Object.fromEntries(
        Object.entries(metrics).map(([key, metric]) => [
          key,
          valueForMetric(key as MappedMetric, metric),
        ]),
      ) as Partial<Record<MappedMetric, number | null>>;
      const provenance: NonNullable<FinancialYearInput["provenance"]> = Object.fromEntries(
        Object.entries(metrics)
          .map(([key, metric]) => [key, provenanceFor(metric)])
          .filter((entry): entry is [string, FinancialMetricProvenance] =>
            Boolean(entry[1]),
          ),
      ) as NonNullable<FinancialYearInput["provenance"]>;
      const shortTermDebt = values.shortTermDebt ?? null;
      const longTermDebt = values.longTermDebt ?? null;
      if (
        values.debt === null &&
        shortTermDebt !== null &&
        longTermDebt !== null
      ) {
        values.debt = shortTermDebt + longTermDebt;
        const debtSources = [
          metrics.shortTermDebt
            ? provenanceFor(metrics.shortTermDebt)
            : undefined,
          metrics.longTermDebt
            ? provenanceFor(metrics.longTermDebt)
            : undefined,
        ].filter(
          (source): source is FinancialMetricProvenance => Boolean(source),
        );
        if (debtSources.length) {
          provenance.debt = calculatedMetricProvenance(
            "totalDebt",
            debtSources,
            "Total debt calculated as short-term debt plus long-term debt.",
          );
        }
      }
      const periodEndYear = Number(period.periodEnd.slice(0, 4));
      return {
        fiscalYear: periodEndYear,
        periodEnd: period.periodEnd,
        ...values,
        provenance,
      };
    });
}

export function classifyValuationMethod(input: {
  companyType?: string | null;
  companyName?: string | null;
  sector?: string | null;
  industry?: string | null;
}): ValuationMethodClass {
  const details = [
    input.companyName,
    input.sector,
    input.industry,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/\b(bank|banking)\b/.test(details)) {
    return "BANK";
  }
  if (/\b(nbfc|non[- ]banking financial company|nonbanking financial)\b/.test(details)) {
    return "NBFC";
  }
  if (
    /\b(financial services?|financials|finance|insurance|insurer|asset management|mutual fund|broker|brokerage)\b/.test(
      details,
    )
  ) {
    return "FINANCIAL_SERVICES";
  }
  if (input.companyType === "FINANCIAL_INSTITUTION") {
    return "OTHER_FINANCIAL";
  }
  return "NON_FINANCIAL";
}

const UNAVAILABLE_WACC: WaccInputs = {
  riskFreeRate: null,
  beta: null,
  equityRiskPremium: null,
  costOfDebt: null,
  taxRate: null,
  marketCapitalization: null,
  debt: null,
  terminalGrowth: null,
};

function applyInputOverrides(
  assumptions: ForecastAssumptions,
  overrides: Partial<
    Record<Exclude<keyof ForecastScalarAssumptions, "wacc">, number>
  >,
): ForecastAssumptions {
  const result: ForecastAssumptions = {
    ...assumptions,
    forecastYears: { ...assumptions.forecastYears },
    annualForecast: assumptions.annualForecast.map((year) => ({
      ...year,
      revenueGrowth: { ...year.revenueGrowth },
      ebitdaMargin: { ...year.ebitdaMargin },
      ebitMargin: { ...year.ebitMargin },
      taxRate: { ...year.taxRate },
      depreciationToRevenue: { ...year.depreciationToRevenue },
      capexToRevenue: { ...year.capexToRevenue },
      changeInNwcToRevenue: { ...year.changeInNwcToRevenue },
    })),
  };
  for (const key of [
    "revenueGrowth",
    "ebitdaMargin",
    "ebitMargin",
    "taxRate",
    "depreciationToRevenue",
    "capexToRevenue",
    "changeInNwcToRevenue",
    "terminalGrowth",
  ] as const) {
    const value = overrides[key];
    if (value !== undefined) {
      result[key] = setUserProvidedAssumption(
        result[key],
        value,
        "Explicit analyst-provided forecast assumption.",
      );
      if (key !== "terminalGrowth") {
        for (const year of result.annualForecast) {
          year[key] = setUserProvidedAssumption(
            year[key],
            value,
            "Explicit analyst-provided forecast assumption applied to each forecast year.",
          );
        }
      }
    }
  }
  if (overrides.forecastYears !== undefined) {
    result.forecastYears = setUserProvidedAssumption(
      result.forecastYears,
      overrides.forecastYears,
      "Explicit analyst-provided forecast horizon.",
    );
  }
  return result;
}

function blockedDcf(
  assumptions: ForecastAssumptions,
  reason: string,
): DcfResult {
  return {
    status: "insufficient_data",
    missingInputs: [reason],
    errors: [],
    assumptions,
  };
}

export interface ValuationRequestInputs {
  assumptions?: Partial<
    Record<Exclude<keyof ForecastScalarAssumptions, "wacc">, number>
  >;
  waccInputs?: WaccInputs;
  scenarios?: Partial<Record<ValuationScenarioName, ScenarioOverrides>>;
  annualForecast?: Array<{
    fiscalYear: number;
    revenueGrowth?: number;
    ebitdaMargin?: number;
    ebitMargin?: number;
    taxRate?: number;
    depreciationToRevenue?: number;
    capexToRevenue?: number;
    changeInNwcToRevenue?: number;
  }>;
}

export interface CompanyValuation {
  company: {
    ticker: string;
    name: string;
    exchange: string;
    currency: string | null;
    sector: string | null;
    industry: string | null;
  };
  financialUnit: "INR crore" | "USD billion" | "Unavailable";
  valuationMethod: ValuationMethodClass;
  sectorClassification: SectorClassification;
  methodStatus:
    | "SUPPORTED"
    | "SUPPORTED_WITH_LIMITATIONS"
    | "NOT_APPROPRIATE";
  methodExplanation: string;
  reason: string | null;
  dataQuality: ValuationDataQuality;
  historicalFinancials: ReturnType<typeof normalizeFinancialYears>;
  historicalTrends: HistoricalTrendMetric[];
  terminalGrowthGuidance: TerminalGrowthGuidance;
  cagr: {
    revenue: number | null;
    ebitda: number | null;
    ebit: number | null;
    netIncome: number | null;
  };
  assumptions: ForecastAssumptions;
  wacc: WaccResult;
  waccAssumptions: WaccAssumptionModel;
  dcf: DcfResult;
  sensitivity: ReturnType<typeof calculateDcfSensitivity>;
  scenarios: ReturnType<typeof calculateDcfScenarios>;
  currentPrice: {
    value: number | null;
    currency: string | null;
    source: string | null;
    retrievedAt: string | null;
    asOf: string | null;
    provider: string | null;
    dataStatus: string | null;
    licenseStatus: string | null;
  };
  warnings: string[];
  dataStatus: "available" | "partial" | "unavailable";
  persistence: "not_persisted";
}

const DCF_HISTORICAL_FIELDS = [
  "revenue",
  "ebitda",
  "ebit",
  "profitBeforeTax",
  "taxRate",
  "depreciation",
  "capex",
  "changeInWorkingCapital",
  "cash",
  "debt",
  "dilutedShares",
] as const;

function buildValuationDataQuality(
  rows: ReturnType<typeof normalizeFinancialYears>,
): ValuationDataQuality {
  if (!rows.length) {
    return {
      status: "unavailable",
      completeness: 0,
      quality: "NOT_ASSESSED",
      rationale: "No verified annual financial periods are available.",
      sourcedMetricCount: 0,
      expectedMetricCount: DCF_HISTORICAL_FIELDS.length,
      latestRetrievedAt: null,
      sources: [],
    };
  }
  const latest = rows.at(-1)!;
  const availableCount = DCF_HISTORICAL_FIELDS.filter((key) => {
    if (key === "taxRate") {
      return latest.taxRate !== null;
    }
    return latest[key] !== null;
  }).length;
  const sources = [
    ...new Map(
      rows
        .flatMap((row) => Object.values(row.provenance ?? {}))
        .filter((source): source is FinancialMetricProvenance => Boolean(source))
        .map((source) => [
          `${source.sourceMetricId}:${source.periodEnd}:${source.sourceUrl ?? ""}`,
          source,
        ]),
    ).values(),
  ];
  const sourcedFieldCount = DCF_HISTORICAL_FIELDS.filter((key) =>
    key === "taxRate"
      ? Boolean(
          latest.provenance?.incomeTaxExpense &&
            latest.provenance?.profitBeforeTax,
        )
      : Boolean(latest.provenance?.[key]),
  ).length;
  const completeness = availableCount / DCF_HISTORICAL_FIELDS.length;
  const status = completeness === 1 ? "available" : "partial";
  const quality =
    completeness === 1 && sourcedFieldCount === DCF_HISTORICAL_FIELDS.length
      ? "HIGH"
      : completeness >= 0.6 && sourcedFieldCount >= 7
        ? "MODERATE"
        : "LOW";
  return {
    status,
    completeness,
    quality,
    rationale:
      quality === "HIGH"
        ? "All core FCFF historical fields are present and supported by period-level source provenance."
        : `${availableCount} of ${DCF_HISTORICAL_FIELDS.length} core FCFF historical fields are available for the latest fiscal year; missing fields remain unavailable.`,
    sourcedMetricCount: sourcedFieldCount,
    expectedMetricCount: DCF_HISTORICAL_FIELDS.length,
    latestRetrievedAt:
      sources.map((source) => source.retrievedAt).sort().at(-1) ?? null,
    sources,
  };
}

function makeAssumption(
  value: number | null,
  source: "unavailable" | "user_provided" | "derived",
  basis: "unavailable" | "historical_derived" | "analyst_override" | "system_derived" | "market_derived",
  method: string,
  rationale: string,
  provenance: FinancialMetricProvenance[] = [],
  sourceDescription?: string,
  options: {
    sourceType?: "OBSERVED" | "DERIVED" | "USER_PROVIDED" | "ASSUMED" | "UNAVAILABLE";
    confidence?: "HIGH" | "MODERATE" | "LOW" | "NOT_ASSESSED";
    editable?: boolean;
  } = {},
) {
  const sourceType =
    options.sourceType ??
    (source === "derived"
      ? "DERIVED"
      : source === "user_provided"
        ? "USER_PROVIDED"
        : "UNAVAILABLE");
  return {
    value,
    source,
    sourceType,
    confidence:
      options.confidence ??
      (source === "unavailable"
        ? "NOT_ASSESSED"
        : provenance.length
          ? "MODERATE"
          : "LOW"),
    editable: options.editable ?? true,
    sourceDescription: sourceDescription ?? (
      source === "user_provided"
        ? "Explicit analyst-provided input; supporting citation was not supplied."
        : source === "derived"
          ? "Calculated by the deterministic valuation engine."
          : "No sourced or analyst-provided value."
    ),
    provenance,
    basis,
    method,
    rationale,
  };
}

function buildWaccAssumptions(
  inputs: WaccInputs,
  wacc: WaccResult,
  provenance: Partial<Record<keyof WaccInputs, FinancialMetricProvenance[]>>,
): WaccAssumptionModel {
  const provided = (
    value: number | null,
    label: string,
    key: keyof WaccInputs,
  ) =>
    value === null
      ? makeAssumption(
          null,
          "unavailable",
          "unavailable",
          "requires_sourced_input",
          `${label} is unavailable; no default is applied.`,
          provenance[key] ?? [],
        )
      : makeAssumption(
          value,
          provenance[key]?.length ? "derived" : "user_provided",
          key === "marketCapitalization" && provenance[key]?.length
            ? "market_derived"
            : provenance[key]?.length
              ? "historical_derived"
              : "analyst_override",
          provenance[key]?.length
            ? key === "marketCapitalization"
              ? "current_quote_times_reported_shares"
              : key === "debt"
                ? "latest_reported_total_debt"
                : "effective_tax_from_reported_tax_expense_and_pbt"
            : "explicit_wacc_input",
          provenance[key]?.length
            ? `Sourced ${label} input normalized by the valuation service.`
            : `Explicit analyst input: ${label}.`,
          provenance[key] ?? [],
          provenance[key]?.length
            ? `${label} supplied from the configured financial data source.`
            : `Explicit analyst input for ${label}; source citation was not supplied.`,
          {
            sourceType: provenance[key]?.length
              ? key === "debt" &&
                provenance[key]!.every(
                  (source) => source.sourceType !== "calculated",
                )
                ? "OBSERVED"
                : "DERIVED"
              : "USER_PROVIDED",
            confidence: provenance[key]?.length ? "HIGH" : "NOT_ASSESSED",
          },
        );
  const system = (
    value: number | null,
    method: string,
    rationale: string,
    sources: FinancialMetricProvenance[] = [],
  ) =>
    value === null
      ? makeAssumption(
          null,
          "unavailable",
          "unavailable",
          method,
          rationale,
        )
      : makeAssumption(
          value,
          "derived",
          "system_derived",
          method,
          rationale,
          sources,
          undefined,
          { editable: false, confidence: sources.length ? "HIGH" : "LOW" },
        );
  const unavailableSystem = (method: string, rationale: string) =>
    makeAssumption(
      null,
      "unavailable",
      "unavailable",
      method,
      rationale,
      [],
      undefined,
      { editable: false },
    );
  return {
    riskFreeRate: provided(inputs.riskFreeRate, "risk-free rate", "riskFreeRate"),
    beta: provided(inputs.beta, "beta", "beta"),
    equityRiskPremium: provided(
      inputs.equityRiskPremium,
      "equity risk premium",
      "equityRiskPremium",
    ),
    costOfEquity:
      wacc.status === "available"
        ? system(
            wacc.costOfEquity,
            "CAPM",
            "Risk-free rate + beta × equity risk premium.",
            [
              ...(provenance.riskFreeRate ?? []),
              ...(provenance.beta ?? []),
              ...(provenance.equityRiskPremium ?? []),
            ],
          )
        : unavailableSystem("CAPM", "WACC inputs are incomplete or invalid."),
    preTaxCostOfDebt: provided(inputs.costOfDebt, "pre-tax cost of debt", "costOfDebt"),
    afterTaxCostOfDebt:
      wacc.status === "available"
        ? system(
            wacc.afterTaxCostOfDebt,
            "pre_tax_cost_of_debt_times_one_minus_tax_rate",
            "Pre-tax cost of debt × (1 − effective tax rate).",
            [
              ...(provenance.costOfDebt ?? []),
              ...(provenance.taxRate ?? []),
            ],
          )
        : unavailableSystem(
            "after_tax_cost_of_debt",
            "Pre-tax cost of debt and tax rate are required.",
          ),
    equityWeight:
      wacc.status === "available"
        ? system(wacc.equityWeight, "market_equity_over_total_capital", "Market capitalization / (market capitalization + debt).", [
            ...(provenance.marketCapitalization ?? []),
            ...(provenance.debt ?? []),
          ])
        : unavailableSystem("market_equity_over_total_capital", "Market capitalization and debt are required."),
    debtWeight:
      wacc.status === "available"
        ? system(wacc.debtWeight, "debt_over_total_capital", "Debt / (market capitalization + debt).", [
            ...(provenance.marketCapitalization ?? []),
            ...(provenance.debt ?? []),
          ])
        : unavailableSystem("debt_over_total_capital", "Market capitalization and debt are required."),
    taxRate: provided(inputs.taxRate, "WACC tax rate", "taxRate"),
    debt: provided(inputs.debt, "total debt", "debt"),
    equity: provided(
      inputs.marketCapitalization,
      "equity market capitalization",
      "marketCapitalization",
    ),
    wacc:
      wacc.status === "available"
        ? system(
            wacc.wacc,
            "weighted_average_cost_of_capital",
            "Calculated from the supplied CAPM and after-tax debt cost using market-capitalization and debt weights.",
            [
              ...(provenance.riskFreeRate ?? []),
              ...(provenance.beta ?? []),
              ...(provenance.equityRiskPremium ?? []),
              ...(provenance.costOfDebt ?? []),
              ...(provenance.taxRate ?? []),
              ...(provenance.marketCapitalization ?? []),
              ...(provenance.debt ?? []),
            ],
          )
        : unavailableSystem(
            "weighted_average_cost_of_capital",
            "WACC inputs are incomplete or invalid.",
          ),
  };
}

function applyAnnualOverrides(
  base: ForecastAssumptions,
  lastHistoricalFiscalYear: number,
  annualOverrides: ValuationRequestInputs["annualForecast"],
): ForecastAssumptions {
  const years = base.forecastYears.value;
  if (years === null) {
    return base;
  }
  const result = {
    ...base,
    annualForecast: buildAnnualForecastAssumptions(
      base,
      lastHistoricalFiscalYear,
      years,
    ),
  };
  if (!annualOverrides?.length) {
    return result;
  }
  const assumptionKeys = [
    "revenueGrowth",
    "ebitdaMargin",
    "ebitMargin",
    "taxRate",
    "depreciationToRevenue",
    "capexToRevenue",
    "changeInNwcToRevenue",
  ] as const;
  for (const override of annualOverrides) {
    const target = result.annualForecast.find(
      (entry) => entry.fiscalYear === override.fiscalYear,
    );
    if (!target) {
      throw new RangeError(
        `Annual override FY${override.fiscalYear} is outside the forecast horizon.`,
      );
    }
    for (const key of assumptionKeys) {
      const value = override[key];
      if (value !== undefined) {
        target[key] = setUserProvidedAssumption(
          target[key],
          value,
          `Explicit analyst override for FY${override.fiscalYear}.`,
        );
      }
    }
  }
  return result;
}

export function buildCompanyValuation(
  company: {
    ticker: string;
    name: string;
    exchange: string;
    currency?: string | null;
    sector: string | null;
    industry: string | null;
  },
  analysis: FundamentalsValuationData | null,
  quote: MarketQuote | null,
  requestInputs: ValuationRequestInputs = {},
): CompanyValuation {
  const method = classifyValuationMethod({
    companyType: analysis?.companyType ?? analysis?.company.companyType,
    companyName: company.name,
    sector: company.sector,
    industry: company.industry,
  });
  const historyInputs = normalizeFundamentalsHistory(analysis);
  const rows = normalizeFinancialYears(historyInputs);
  const historicalTrends = calculateHistoricalTrends(rows);
  const revenueCagrReference = historicalTrends.find(
    (metric) => metric.id === "revenueCagr",
  );
  const terminalGrowthGuidance: TerminalGrowthGuidance = {
    value: revenueCagrReference?.value ?? null,
    sourceType: revenueCagrReference?.value === null || revenueCagrReference?.value === undefined
      ? "UNAVAILABLE"
      : "DERIVED",
    method: "longest_available_contiguous_revenue_cagr_up_to_five_years",
    rationale:
      revenueCagrReference?.value === null || revenueCagrReference?.value === undefined
        ? "A contiguous annual revenue history with positive beginning and ending revenue is required to show a historical long-term growth reference. This reference never populates Gordon Growth terminal growth automatically."
        : "Historical revenue CAGR over up to five consecutive years is provided only as a long-term growth reference. It is not a terminal growth assumption and must not be used without analyst confirmation.",
    provenance: revenueCagrReference?.provenance ?? [],
    requiresAnalystConfirmation: true,
  };
  const assumptions = applyAnnualOverrides(applyInputOverrides(
    deriveForecastAssumptions(rows),
    requestInputs.assumptions ?? {},
  ), rows.at(-1)?.fiscalYear ?? 0, requestInputs.annualForecast);
  const quoteIsUsable = Boolean(
    quote &&
      quote.dataStatus !== "DEMO" &&
      quote.dataStatus !== "UNAVAILABLE" &&
      quote.dataStatus !== "UNKNOWN" &&
      quote.asOf !== null &&
      Number.isFinite(quote.price) &&
      quote.price > 0,
  );
  const currentPrice = quoteIsUsable ? quote!.price : null;
  const latestRow = rows.at(-1);
  const latestSharesProvenance = latestRow?.provenance?.sharesOutstanding;
  const financialCurrency =
    latestRow?.provenance?.revenue?.currency ??
    analysis?.company.currency ??
    company.currency ??
    null;
  const compatibleSharesUnit =
    (financialCurrency === "INR" &&
      latestSharesProvenance?.unit === "CRORE_SHARES") ||
    (financialCurrency === "USD" &&
      latestSharesProvenance?.unit === "BILLION_SHARES");
  const marketCapCanBeDerived = Boolean(
    quoteIsUsable &&
      quote?.currency === financialCurrency &&
      compatibleSharesUnit &&
      latestRow?.sharesOutstanding !== null &&
      latestRow?.sharesOutstanding !== undefined &&
      latestRow.sharesOutstanding > 0,
  );
  const derivedMarketCap =
    marketCapCanBeDerived ? currentPrice! * latestRow!.sharesOutstanding! : null;
  const explicitWaccInputs = requestInputs.waccInputs ?? UNAVAILABLE_WACC;
  const debtCanBeSourced = Boolean(
    latestRow?.debt !== null &&
      latestRow?.debt !== undefined &&
      latestRow.provenance?.debt,
  );
  const taxCanBeSourced =
    assumptions.taxRate.value !== null &&
    (assumptions.taxRate.source === "derived" ||
      assumptions.taxRate.source === "user_provided");
  const waccInputs: WaccInputs = {
    ...explicitWaccInputs,
    marketCapitalization:
      explicitWaccInputs.marketCapitalization ??
      (marketCapCanBeDerived ? derivedMarketCap : null),
    debt:
      explicitWaccInputs.debt ??
      (debtCanBeSourced ? latestRow!.debt : null),
    taxRate:
      explicitWaccInputs.taxRate ??
      (taxCanBeSourced ? assumptions.taxRate.value : null),
  };
  const waccProvenance: Partial<
    Record<keyof WaccInputs, FinancialMetricProvenance[]>
  > = {
    taxRate: explicitWaccInputs.taxRate === null
      ? assumptions.taxRate.provenance
      : [],
    debt: explicitWaccInputs.debt === null
      ? uniqueProvenance([latestRow?.provenance?.debt])
      : [],
    marketCapitalization:
      explicitWaccInputs.marketCapitalization === null && marketCapCanBeDerived
      ? uniqueProvenance([
          quoteProvenance(quote!),
          latestSharesProvenance,
        ])
      : [],
  };
  let wacc: WaccResult = calculateWacc(waccInputs);
  if (wacc.status === "available") {
    const waccSources = uniqueProvenance([
      ...(waccProvenance.riskFreeRate ?? []),
      ...(waccProvenance.beta ?? []),
      ...(waccProvenance.equityRiskPremium ?? []),
      ...(waccProvenance.costOfDebt ?? []),
      ...(waccProvenance.taxRate ?? []),
      ...(waccProvenance.marketCapitalization ?? []),
      ...(waccProvenance.debt ?? []),
    ]);
    assumptions.wacc = {
      value: wacc.wacc,
      source: "derived",
      sourceType: "DERIVED",
      confidence: waccSources.length ? "HIGH" : "LOW",
      editable: false,
      sourceDescription: "EquityMind deterministic WACC calculation from explicit CAPM inputs and sourced financing/market inputs.",
      provenance: waccSources,
      basis: "system_derived",
      method: "CAPM_and_weighted_average_cost_of_capital",
      rationale:
        "Calculated from risk-free rate, beta, equity risk premium, pre-tax debt cost, tax rate, market capitalization, and debt. No generic rate defaults are applied.",
    };
  }
  let dcf: DcfResult;
  if (method !== "NON_FINANCIAL") {
    const methodology =
      method === "BANK"
        ? "FCFF DCF is not appropriate for banks; a bank-specific dividend, excess-return, or residual-income method is not yet implemented."
        : "FCFF DCF is not applied to financial institutions; an industry-appropriate valuation method is not yet implemented.";
    dcf = blockedDcf(assumptions, methodology);
    wacc = {
      status: "insufficient_data",
      missingInputs: ["WACC is not applied to this financial-company classification."],
      errors: [],
      assumptions: waccInputs,
    };
  } else {
    dcf = calculateFcffDcf(rows, assumptions, currentPrice);
  }
  const sensitivity =
    method === "NON_FINANCIAL"
      ? calculateDcfSensitivity(rows, assumptions, currentPrice)
      : {
          status: "insufficient_data" as const,
          waccValues: [],
          terminalGrowthValues: [],
          cells: [],
          basis: "Sensitivity requires an applicable FCFF valuation.",
          reason: dcf.status === "available" ? null : dcf.missingInputs[0] ?? null,
        };
  const scenarios =
    method === "NON_FINANCIAL"
      ? calculateDcfScenarios(
          rows,
          assumptions,
          currentPrice,
          requestInputs.scenarios,
        )
      : (["base", "bull", "bear"] as const).map((name) => ({
          name,
          status: "insufficient_data" as const,
          assumptions,
          enterpriseValue: null,
          equityValue: null,
          intrinsicValuePerShare: null,
          upsideDownside: null,
          missingInputs:
            dcf.status === "available" ? [] : [dcf.missingInputs[0]!],
          errors: [],
        }));

  const warnings = [...(analysis?.warnings ?? [])];
  if (!analysis) {
    warnings.push("No verified historical financial statements are available for this company.");
  }
  if (method !== "NON_FINANCIAL") {
    warnings.push(
      dcf.status === "available"
        ? "FCFF DCF was unexpectedly calculated for a financial-company classification."
        : dcf.missingInputs[0]!,
    );
  }
  if (quote?.licenseStatus === "REQUIRES_REVIEW") {
    warnings.push(
      "Market data was retrieved, but its display and usage rights remain under review; valuation calculations do not imply license approval.",
    );
  }
  const reason =
    method !== "NON_FINANCIAL"
      ? dcf.status === "insufficient_data"
        ? dcf.missingInputs[0] ?? "This sector-specific valuation method is not implemented."
        : "A sector-specific valuation method is required."
      : dcf.status === "available"
        ? null
        : dcf.status === "insufficient_data"
          ? dcf.missingInputs.join(", ")
          : dcf.errors.join(", ");
  const methodExplanation =
    method === "NON_FINANCIAL"
      ? "Classified as an operating/non-financial company; FCFF is an appropriate enterprise valuation framework when verified operating, reinvestment, financing, and share-count inputs are complete."
      : method === "BANK"
        ? "Classified as a bank; deposits and borrowings are operating funding, so standard industrial FCFF is not appropriate. A bank-specific residual-income or excess-return model is not implemented."
        : `Classified as ${method.replaceAll("_", " ").toLowerCase()}; standard FCFF is not presented as comparable because a sector-specific valuation method is not implemented.`;
  const dataQuality = buildValuationDataQuality(rows);
  return {
    company: {
      ticker: company.ticker,
      name: company.name,
      exchange: company.exchange,
      currency: financialCurrency,
      sector: company.sector,
      industry: company.industry,
    },
    financialUnit:
      financialCurrency === "INR"
        ? "INR crore"
        : financialCurrency === "USD"
          ? "USD billion"
          : "Unavailable",
    valuationMethod: method,
    sectorClassification: method,
    methodStatus:
      method === "NON_FINANCIAL"
        ? dcf.status === "available"
          ? "SUPPORTED"
          : "SUPPORTED_WITH_LIMITATIONS"
        : "NOT_APPROPRIATE",
    methodExplanation,
    reason,
    dataQuality,
    historicalFinancials: rows,
    historicalTrends,
    terminalGrowthGuidance,
    cagr: {
      revenue: cagrForFinancialYears(rows, "revenue"),
      ebitda: cagrForFinancialYears(rows, "ebitda"),
      ebit: cagrForFinancialYears(rows, "ebit"),
      netIncome: cagrForFinancialYears(rows, "netIncome"),
    },
    assumptions,
    wacc,
    waccAssumptions: buildWaccAssumptions(
      waccInputs,
      wacc,
      waccProvenance,
    ),
    dcf,
    sensitivity,
    scenarios,
    currentPrice: {
      value: currentPrice,
      currency: quoteIsUsable ? quote!.currency : null,
      source: quoteIsUsable ? quote!.source : null,
      retrievedAt: quoteIsUsable ? quote!.retrievedAt : null,
      asOf: quoteIsUsable ? quote!.asOf : null,
      provider: quoteIsUsable ? quote!.provider : null,
      dataStatus: quoteIsUsable ? quote!.dataStatus : null,
      licenseStatus: quoteIsUsable ? quote!.licenseStatus : null,
    },
    warnings,
    dataStatus: dataQuality.status,
    persistence: "not_persisted",
  };
}

export function createUnavailableCompany(
  ticker: string,
  requestInputs: ValuationRequestInputs = {},
) {
  const company = {
    ticker,
    name: ticker,
    exchange: "Unknown",
    sector: null,
    industry: null,
  };
  return buildCompanyValuation(company, null, null, requestInputs);
}
