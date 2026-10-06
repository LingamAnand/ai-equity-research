import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCagr,
  calculateHistoricalTrends,
  buildAnnualForecastAssumptions,
  deriveForecastAssumptions,
  normalizeFinancialYears,
} from "../lib/calculations/financial-analysis.ts";
import { calculateFcffDcf } from "../lib/calculations/dcf.ts";
import { calculateDcfScenarios } from "../lib/calculations/scenarios.ts";
import { calculateDcfSensitivity } from "../lib/calculations/sensitivity.ts";
import { calculateWacc } from "../lib/calculations/wacc.ts";
import { buildFundamentalsAnalysis } from "../lib/calculations/fundamentals-analysis.ts";
import {
  buildCompanyValuation,
  classifyValuationMethod,
  normalizeFundamentalsHistory,
} from "../lib/services/valuation-service.ts";
import type {
  FinancialYearInput,
  ForecastAssumptions,
  ForecastScalarAssumptions,
  WaccInputs,
} from "../lib/types/valuation.ts";
import type {
  FundamentalMetric,
  FundamentalsAnalysis,
} from "../lib/types/fundamentals.ts";
import type { MarketQuote } from "../lib/types/financial.ts";

function createMetric(
  id: string,
  periodId: string,
  value: number,
  unit: "INR_BILLION" | "INR_CRORE" | "CRORE_SHARES",
  periodEnd: string,
): FundamentalMetric {
  return {
    id,
    periodId,
    value,
    status: "reported",
    provenance: {
      sourceId: `source-${periodId}`,
      source: "Official company annual report",
      sourceType: "official_company_filing",
      sourceUrl: "https://example.com/annual-report",
      period: {
        id: periodId,
        periodType: "annual",
        periodStart: `${Number(periodEnd.slice(0, 4)) - 1}-04-01`,
        periodEnd,
        label: `FY ended ${periodEnd}`,
      },
      publicationDate: periodEnd,
      unit,
      currency: unit === "CRORE_SHARES" ? null : "INR",
      retrievedAt: `${periodEnd}T00:00:00.000Z`,
      pageReference: "Page 1",
      sectionReference: "Annual results",
      reportingBasis: "standalone",
    },
  };
}

function createAnalysis(): NonNullable<
  Parameters<typeof normalizeFundamentalsHistory>[0]
> {
  const periods = [
    {
      id: "fy2023-24",
      periodType: "annual" as const,
      periodStart: "2023-04-01",
      periodEnd: "2024-03-31",
      label: "FY 2023-24",
      reportingBasis: "standalone" as const,
    },
    {
      id: "fy2024-25",
      periodType: "annual" as const,
      periodStart: "2024-04-01",
      periodEnd: "2025-03-31",
      label: "FY 2024-25",
      reportingBasis: "standalone" as const,
    },
  ];
  return {
    company: {
      ticker: "HDFCBANK.NS",
      companyName: "HDFC Bank Limited",
      exchange: "NSE",
      companyType: "FINANCIAL_INSTITUTION",
      reportingBasis: "standalone",
    },
    periods,
    financials: [
      createMetric("netRevenue", periods[0]!.id, 1577.7, "INR_BILLION", periods[0]!.periodEnd),
      createMetric("profitAfterTax", periods[0]!.id, 600, "INR_CRORE", periods[0]!.periodEnd),
      createMetric("capex", periods[0]!.id, -25, "INR_CRORE", periods[0]!.periodEnd),
      createMetric("netRevenue", periods[1]!.id, 1683, "INR_BILLION", periods[1]!.periodEnd),
      createMetric("profitAfterTax", periods[1]!.id, 700, "INR_CRORE", periods[1]!.periodEnd),
      createMetric("capex", periods[1]!.id, -30, "INR_CRORE", periods[1]!.periodEnd),
    ],
    statements: {
      incomeStatement: [],
      balanceSheet: [],
      cashFlowStatement: {
        status: "unavailable",
        metrics: [],
        reason: "Not supplied",
      },
      bankOperatingMetrics: [],
    },
    warnings: [],
  };
}

function createNonFinancialAnalysis(): FundamentalsAnalysis {
  const years = [2023, 2024, 2025];
  const periods = years.map((year) => ({
    id: `fy${year}`,
    periodType: "annual" as const,
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    label: `FY${year}`,
    reportingBasis: "consolidated" as const,
  }));
  const valuesByMetric: Record<string, number[]> = {
    revenue: [80, 90, 100],
    ebitda: [18, 20, 23],
    ebit: [14, 16, 20],
    profitAfterTax: [9, 10, 13],
    profitBeforeTax: [12, 13, 17],
    incomeTaxExpense: [3, 3, 4],
    depreciationAndAmortization: [4, 4.5, 5],
    capitalExpenditures: [-5, -5.4, -6],
    netWorkingCapital: [10, 11, 12],
    cashAndEquivalents: [12, 13, 15],
    shortTermDebt: [12, 11, 10],
    longTermDebt: [18, 17, 15],
    shareholdersEquity: [40, 45, 50],
    sharesOutstanding: [10, 10, 10],
    dilutedSharesOutstanding: [10, 10, 10],
  };
  const financials = Object.entries(valuesByMetric).flatMap(([id, values]) =>
    periods.map((period, index) =>
      createMetric(
        id,
        period.id,
        values[index]!,
        /sharesoutstanding/i.test(id) ? "CRORE_SHARES" : "INR_CRORE",
        period.periodEnd,
      ),
    ),
  );
  return buildFundamentalsAnalysis({
    ...createAnalysis(),
    company: {
      ticker: "TEST.NS",
      companyName: "Example Industrial Company",
      exchange: "NSE",
      companyType: "GENERAL_COMPANY",
      reportingBasis: "consolidated",
    },
    periods,
    financials,
    bankMetrics: [],
    growthMetrics: [],
    provenance: [{
      id: "test-annual-report",
      source: "Official company annual report",
      sourceType: "official_company_filing",
      sourceUrl: "https://example.com/annual-report",
      publicationDate: "2025-12-31",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      reportingBasis: "consolidated",
    }],
    statements: {
      incomeStatement: [],
      balanceSheet: [],
      cashFlowStatement: {
        status: "available",
        metrics: [],
      },
      bankOperatingMetrics: [],
    },
    warnings: [],
  });
}

function createQuote(): MarketQuote {
  return {
    companyId: "test-company",
    ticker: "TEST.NS",
    symbol: "NSE:TEST-EQ",
    asOf: "2026-10-06T06:55:00.000Z",
    open: 148,
    high: 151,
    low: 147,
    price: 150,
    previousClose: 149,
    change: 1,
    changePercent: 1 / 149,
    dayHigh: 151,
    dayLow: 147,
    volume: 1000,
    currency: "INR",
    source: "Verified market-data provider",
    sourceType: "licensed",
    sourceUrl: null,
    retrievedAt: "2026-10-06T06:56:00.000Z",
    provider: "fyers",
    instrument: "equity",
    exchange: "NSE",
    marketTimestamp: "2026-10-06T06:55:00.000Z",
    dataStatus: "LIVE",
    delaySeconds: 0,
    delayStatus: "LIVE",
    marketStatus: "OPEN",
    isUnofficial: false,
    licenseStatus: "REQUIRES_REVIEW",
  };
}

function assumptions(overrides: Partial<Record<keyof ForecastScalarAssumptions, number>> = {}): ForecastAssumptions {
  const source = "user_provided" as const;
  const rationale = "Test analyst input.";
  const withValue = (key: keyof ForecastScalarAssumptions, value: number) => ({
    value,
    source,
    sourceType: "USER_PROVIDED" as const,
    confidence: "NOT_ASSESSED" as const,
    editable: true,
    sourceDescription: "Analyst supplied test assumption.",
    provenance: [],
    basis: "analyst_override" as const,
    method: "test_input",
    rationale: `${rationale} ${key}`,
  });
  const result: ForecastAssumptions = {
    revenueGrowth: withValue("revenueGrowth", 0.1),
    ebitdaMargin: withValue("ebitdaMargin", 0.25),
    ebitMargin: withValue("ebitMargin", 0.2),
    taxRate: withValue("taxRate", 0.22),
    depreciationToRevenue: withValue("depreciationToRevenue", 0.05),
    capexToRevenue: withValue("capexToRevenue", 0.06),
    changeInNwcToRevenue: withValue("changeInNwcToRevenue", 0.01),
    terminalGrowth: withValue("terminalGrowth", 0.03),
    wacc: withValue("wacc", 0.1),
    forecastYears: {
      value: 2,
      source,
      sourceType: "USER_PROVIDED",
      confidence: "NOT_ASSESSED",
      editable: true,
      sourceDescription: "Analyst supplied test horizon.",
      provenance: [],
      basis: "analyst_override",
      method: "test_input",
      rationale,
    },
    annualForecast: [],
  };
  for (const [key, value] of Object.entries(overrides) as Array<
    [keyof ForecastScalarAssumptions, number]
  >) {
    result[key] = withValue(key, value);
  }
  if (result.forecastYears.value !== null) {
    result.annualForecast = buildAnnualForecastAssumptions(
      result,
      2025,
      result.forecastYears.value,
    );
  }
  return result;
}

const completeWaccInputs: WaccInputs = {
  riskFreeRate: 0.06,
  beta: 1.2,
  equityRiskPremium: 0.05,
  costOfDebt: 0.08,
  taxRate: 0.25,
  marketCapitalization: 600,
  debt: 400,
  terminalGrowth: 0.03,
};

const rows: FinancialYearInput[] = [
  {
    fiscalYear: 2023,
    periodEnd: "2023-12-31",
    revenue: 80,
    ebitda: 18,
    ebit: 14,
    netIncome: 9,
    profitBeforeTax: 12,
    incomeTaxExpense: 3,
    depreciation: 4,
    capex: 5,
    workingCapital: 10,
    cash: 12,
    debt: 30,
    equity: 40,
    sharesOutstanding: 10,
    dilutedShares: 10,
  },
  {
    fiscalYear: 2024,
    periodEnd: "2024-12-31",
    revenue: 90,
    ebitda: 20,
    ebit: 16,
    netIncome: 10,
    profitBeforeTax: 13,
    incomeTaxExpense: 3,
    depreciation: 4.5,
    capex: 5.4,
    workingCapital: 11,
    cash: 13,
    debt: 28,
    equity: 45,
    sharesOutstanding: 10,
    dilutedShares: 10,
  },
  {
    fiscalYear: 2025,
    periodEnd: "2025-12-31",
    revenue: 100,
    ebitda: 23,
    ebit: 20,
    netIncome: 13,
    profitBeforeTax: 17,
    incomeTaxExpense: 4,
    depreciation: 5,
    capex: 6,
    workingCapital: 12,
    cash: 15,
    debt: 25,
    equity: 50,
    sharesOutstanding: 10,
    dilutedShares: 10,
  },
];

test("normalizes annual financials, ratios, changes, and explicit availability", () => {
  const normalized = normalizeFinancialYears(rows);
  assert.equal(normalized[2]!.revenueGrowth, 100 / 90 - 1);
  assert.equal(normalized[2]!.ebitMargin, 0.2);
  assert.equal(normalized[2]!.taxRate, 4 / 17);
  assert.equal(normalized[2]!.changeInWorkingCapital, 1);
  assert.equal(normalized[2]!.availability.cash, true);
  assert.equal(normalized[2]!.availability.capex, true);

  const partial = normalizeFinancialYears([
    { fiscalYear: 2025, periodEnd: "2025-12-31", revenue: 100 },
  ])[0]!;
  assert.equal(partial.ebit, null);
  assert.equal(partial.availability.ebit, false);
  assert.equal(partial.taxRate, null);
});

test("calculates CAGR only for valid positive start and nonnegative end values", () => {
  assert.ok(Math.abs(calculateCagr(100, 121, 2)! - 0.1) < 1e-12);
  assert.equal(calculateCagr(0, 121, 2), null);
  assert.equal(calculateCagr(100, -1, 2), null);
  assert.equal(calculateCagr(100, 121, 0), null);
});

test("historical trend engine derives audited growth, margins, returns, and leaves missing data unavailable", () => {
  const normalized = normalizeFinancialYears(rows);
  const trends = calculateHistoricalTrends(normalized);
  const revenueCagr = trends.find((metric) => metric.id === "revenueCagr");
  const latestEbitMargin = trends.find((metric) => metric.id === "ebitMargin:2025");
  const latestRoe = trends.find((metric) => metric.id === "roe:2025");
  const latestRoic = trends.find((metric) => metric.id === "roic:2025");
  assert.ok(Math.abs(revenueCagr!.value! - calculateCagr(80, 100, 2)!) < 1e-12);
  assert.equal(latestEbitMargin!.value, 0.2);
  assert.equal(latestRoe!.value, 13 / ((45 + 50) / 2));
  assert.equal(latestRoic!.value, (20 * (1 - 4 / 17)) / (25 + 50 - 15));
  const missing = calculateHistoricalTrends(
    normalizeFinancialYears([
      { fiscalYear: 2025, periodEnd: "2025-12-31", revenue: 100 },
    ]),
  );
  assert.equal(missing.find((metric) => metric.id === "roic:2025")!.value, null);
  assert.equal(missing.find((metric) => metric.id === "roic:2025")!.sourceType, "UNAVAILABLE");
});

test("rejects invalid and duplicate annual periods", () => {
  assert.throws(
    () =>
      normalizeFinancialYears([
        { fiscalYear: 2025, periodEnd: "2025-12-31" },
        { fiscalYear: 2025, periodEnd: "2025-03-31" },
      ]),
    /Duplicate annual financial period/,
  );
  assert.throws(
    () => normalizeFinancialYears([{ fiscalYear: 2025, periodEnd: "invalid" }]),
    /valid fiscal year and period end/,
  );
  assert.throws(
    () => normalizeFinancialYears([{ fiscalYear: 2025, periodEnd: "2025-02-30" }]),
    /valid fiscal year and period end/,
  );
  assert.throws(
    () => normalizeFinancialYears([{ fiscalYear: 2024, periodEnd: "2025-03-31" }]),
    /valid fiscal year and period end/,
  );
});

test("does not treat skipped fiscal years or stale capital balances as current annual data", () => {
  const gap = normalizeFinancialYears([
    { fiscalYear: 2022, periodEnd: "2022-12-31", revenue: 80, workingCapital: 7 },
    { fiscalYear: 2025, periodEnd: "2025-12-31", revenue: 100, workingCapital: 10 },
  ]);
  assert.equal(gap[1]!.revenueGrowth, null);
  assert.equal(gap[1]!.changeInWorkingCapital, null);

  const noLatestCapital = normalizeFinancialYears([
    {
      fiscalYear: 2024,
      periodEnd: "2024-12-31",
      revenue: 90,
      ebit: 15,
      cash: 10,
      debt: 20,
      sharesOutstanding: 10,
    },
    {
      fiscalYear: 2025,
      periodEnd: "2025-12-31",
      revenue: 100,
      ebit: 18,
    },
  ]);
  const result = calculateFcffDcf(noLatestCapital, assumptions());
  assert.equal(result.status, "insufficient_data");
  if (result.status === "insufficient_data") {
    assert.ok(result.missingInputs.includes("cash"));
    assert.ok(result.missingInputs.includes("debt"));
    assert.ok(result.missingInputs.includes("dilutedShares"));
  }
});

test("derives forecast rates only when comparable historical observations exist", () => {
  const normalized = normalizeFinancialYears(rows);
  const derived = deriveForecastAssumptions(normalized);
  assert.equal(derived.revenueGrowth.source, "derived");
  assert.ok(derived.revenueGrowth.value !== null);
  assert.equal(derived.ebitMargin.source, "derived");
  assert.equal(derived.wacc.source, "unavailable");
  assert.equal(derived.terminalGrowth.source, "unavailable");
  assert.equal(derived.forecastYears.source, "unavailable");
});

test("calculates WACC using CAPM and after-tax debt cost with valid capital weights", () => {
  const result = calculateWacc(completeWaccInputs);
  assert.equal(result.status, "available");
  if (result.status !== "available") {
    return;
  }
  assert.equal(result.costOfEquity, 0.12);
  assert.equal(result.equityWeight, 0.6);
  assert.equal(result.debtWeight, 0.4);
  assert.equal(result.afterTaxCostOfDebt, 0.06);
  assert.equal(result.wacc, 0.096);
});

test("WACC reports missing data and rejects invalid rates, denominator, and terminal growth", () => {
  const missing = calculateWacc({
    ...completeWaccInputs,
    beta: null,
  });
  assert.equal(missing.status, "insufficient_data");
  if (missing.status === "insufficient_data") {
    assert.deepEqual(missing.missingInputs, ["beta"]);
  }
  const badRate = calculateWacc({ ...completeWaccInputs, riskFreeRate: 1.5 });
  assert.equal(badRate.status, "invalid");
  const zeroCapital = calculateWacc({
    ...completeWaccInputs,
    marketCapitalization: 0,
    debt: 0,
  });
  assert.equal(zeroCapital.status, "invalid");
  const terminalGrowth = calculateWacc({
    ...completeWaccInputs,
    terminalGrowth: 0.11,
  });
  assert.equal(terminalGrowth.status, "invalid");
});

test("FCFF DCF produces an auditable forecast, terminal value, and per-share value", () => {
  const result = calculateFcffDcf(
    normalizeFinancialYears(rows),
    assumptions(),
    15,
  );
  assert.equal(result.status, "available");
  if (result.status !== "available") {
    return;
  }
  assert.ok(Math.abs(result.forecast[0]!.revenue - 110) < 1e-10);
  assert.ok(Math.abs(result.forecast[0]!.ebit - 22) < 1e-10);
  assert.ok(Math.abs(result.forecast[0]!.nopat - 17.16) < 1e-10);
  assert.ok(Math.abs(result.forecast[0]!.depreciation - 5.5) < 1e-10);
  assert.ok(Math.abs(result.forecast[0]!.capex - 6.6) < 1e-10);
  assert.ok(Math.abs(result.forecast[0]!.changeInWorkingCapital - 1.1) < 1e-10);
  assert.ok(result.enterpriseValue > 0);
  assert.equal(result.equityValue, result.enterpriseValue - 10);
  assert.equal(result.valuePerShare, result.equityValue / 10);
  assert.equal(result.upsideDownside, result.valuePerShare / 15 - 1);
  assert.equal(
    result.terminalValuePercentOfEnterpriseValue,
    result.terminalValuePresentValue / result.enterpriseValue,
  );
});

test("calculates FCFF from year-specific assumptions and validates the terminal spread", () => {
  const model = assumptions();
  model.annualForecast[0]!.revenueGrowth.value = 0.2;
  model.annualForecast[1]!.revenueGrowth.value = 0.05;
  const result = calculateFcffDcf(normalizeFinancialYears(rows), model);
  assert.equal(result.status, "available");
  if (result.status !== "available") {
    return;
  }
  assert.equal(result.forecast[0]!.revenue, 120);
  assert.equal(result.forecast[1]!.revenue, 126);

  const invalid = calculateFcffDcf(
    normalizeFinancialYears(rows),
    assumptions({ wacc: 0.02, terminalGrowth: 0.03 }),
  );
  assert.equal(invalid.status, "invalid");
});

test("sensitivity analysis returns every WACC/growth combination and rejects invalid cells", () => {
  const model = assumptions({ wacc: 0.04, terminalGrowth: 0.03 });
  const sensitivity = calculateDcfSensitivity(
    normalizeFinancialYears(rows),
    model,
    15,
  );
  assert.equal(sensitivity.status, "available");
  assert.equal(sensitivity.cells.length, 5);
  assert.equal(sensitivity.cells[0]!.length, 5);
  assert.equal(sensitivity.cells[0]![4]!.status, "invalid");
  assert.equal(sensitivity.cells[2]![2]!.status, "available");
});

test("FCFF DCF refuses missing financial inputs and invalid terminal/WACC assumptions", () => {
  const missing = calculateFcffDcf(
    normalizeFinancialYears([
      { fiscalYear: 2025, periodEnd: "2025-12-31", revenue: 100 },
    ]),
    assumptions(),
  );
  assert.equal(missing.status, "insufficient_data");
  if (missing.status === "insufficient_data") {
    assert.ok(missing.missingInputs.includes("cash"));
    assert.ok(missing.missingInputs.includes("dilutedShares"));
  }
  const invalid = calculateFcffDcf(
    normalizeFinancialYears(rows),
    assumptions({ wacc: 0.02, terminalGrowth: 0.03 }),
  );
  assert.equal(invalid.status, "invalid");
});

test("scenario engine derives bull/bear cases from observed historical extremes without arbitrary shifts", () => {
  const normalized = normalizeFinancialYears(rows);
  const base = assumptions();
  const defaults = calculateDcfScenarios(normalized, base, 15);
  assert.equal(defaults[0]!.status, "available");
  assert.equal(defaults[1]!.status, "available");
  assert.equal(defaults[2]!.status, "available");
  assert.equal(defaults[1]!.assumptions.revenueGrowth.sourceType, "DERIVED");
  assert.equal(defaults[1]!.assumptions.revenueGrowth.method, "observed_historical_extreme");
  assert.equal(defaults[2]!.assumptions.ebitMargin.sourceType, "DERIVED");
  assert.notEqual(defaults[1]!.intrinsicValuePerShare, defaults[2]!.intrinsicValuePerShare);
  const scenarios = calculateDcfScenarios(normalized, base, 15, {
    bull: { revenueGrowth: 0.15 },
    bear: { revenueGrowth: 0.02 },
  });
  assert.equal(scenarios[1]!.status, "available");
  assert.equal(scenarios[2]!.status, "available");
  assert.notEqual(
    scenarios[1]!.intrinsicValuePerShare,
    scenarios[2]!.intrinsicValuePerShare,
  );
  assert.equal(scenarios[1]!.assumptions.revenueGrowth.source, "user_provided");
  const longerForecast = calculateDcfScenarios(normalized, base, 15, {
    bull: { forecastYears: 3, revenueGrowth: 0.15 },
  })[1]!;
  assert.equal(longerForecast.assumptions.annualForecast.length, 3);
  assert.equal(
    longerForecast.assumptions.annualForecast[2]!.revenueGrowth.value,
    0.15,
  );
});

test("WACC from explicit CAPM inputs is marked system-derived, not as a direct analyst override", () => {
  const valuation = buildCompanyValuation(
    {
      ticker: "EXAMPLE",
      name: "Example Industries",
      exchange: "NSE",
      sector: "Industrials",
      industry: "Manufacturing",
    },
    null,
    null,
    { waccInputs: completeWaccInputs },
  );
  assert.equal(valuation.assumptions.wacc.value, 0.096);
  assert.equal(valuation.assumptions.wacc.source, "derived");
  assert.equal(valuation.assumptions.wacc.basis, "system_derived");
});

test("company valuation applies explicit overrides to their matching forecast year", () => {
  const valuation = buildCompanyValuation(
    {
      ticker: "EXAMPLE",
      name: "Example Industries",
      exchange: "NSE",
      sector: "Industrials",
      industry: "Manufacturing",
    },
    createAnalysis(),
    null,
    {
      assumptions: { forecastYears: 2 },
      annualForecast: [{ fiscalYear: 2026, revenueGrowth: 0.18 }],
    },
  );
  assert.equal(valuation.assumptions.annualForecast[0]!.fiscalYear, 2026);
  assert.equal(
    valuation.assumptions.annualForecast[0]!.revenueGrowth.value,
    0.18,
  );
  assert.equal(
    valuation.assumptions.annualForecast[0]!.revenueGrowth.basis,
    "analyst_override",
  );
});

test("normalizes non-financial statement inputs with separate debt and source provenance", () => {
  const analysis = createNonFinancialAnalysis();
  const annual = normalizeFundamentalsHistory(analysis);
  const normalized = normalizeFinancialYears(annual);
  assert.equal(normalized[2]!.shortTermDebt, 10);
  assert.equal(normalized[2]!.longTermDebt, 15);
  assert.equal(normalized[2]!.debt, 25);
  assert.equal(normalized[2]!.changeInWorkingCapital, 1);
  assert.equal(normalized[2]!.debt, normalized[2]!.shortTermDebt! + normalized[2]!.longTermDebt!);
  assert.equal(normalized[2]!.provenance?.debt?.sourceType, "calculated");
  assert.equal(normalized[2]!.provenance?.capex?.sourceMetricId, "capitalExpenditures");
  assert.equal(normalized[2]!.provenance?.changeInWorkingCapital?.sourceType, "calculated");
  assert.equal(normalized[2]!.provenance?.revenueGrowth?.sourceType, "calculated");
});

test("builds a sourced non-financial FCFF valuation and derives market capitalization transparently", () => {
  const valuation = buildCompanyValuation(
    {
      ticker: "TEST.NS",
      name: "Example Industrial Company",
      exchange: "NSE",
      sector: "Industrials",
      industry: "Manufacturing",
    },
    createNonFinancialAnalysis(),
    createQuote(),
    {
      assumptions: { forecastYears: 2, terminalGrowth: 0.025 },
      waccInputs: {
        riskFreeRate: 0.06,
        beta: 1.2,
        equityRiskPremium: 0.05,
        costOfDebt: 0.08,
        taxRate: null,
        marketCapitalization: null,
        debt: null,
        terminalGrowth: 0.025,
      },
    },
  );
  assert.equal(valuation.valuationMethod, "NON_FINANCIAL");
  assert.equal(valuation.sectorClassification, "NON_FINANCIAL");
  assert.equal(valuation.dcf.status, "available");
  assert.equal(valuation.wacc.status, "available");
  assert.equal(valuation.waccAssumptions.equity.value, 1500);
  assert.equal(valuation.waccAssumptions.equity.basis, "market_derived");
  assert.equal(valuation.waccAssumptions.debt.value, 25);
  assert.equal(valuation.waccAssumptions.taxRate.source, "derived");
  assert.equal(valuation.waccAssumptions.riskFreeRate.sourceType, "USER_PROVIDED");
  assert.equal(valuation.waccAssumptions.debt.sourceType, "DERIVED");
  assert.equal(valuation.waccAssumptions.equityWeight.value, 0.9836065573770492);
  assert.equal(
    valuation.waccAssumptions.equity.provenance.some(
      (source) => source.sourceType === "market_data",
    ),
    true,
  );
  assert.equal(valuation.assumptions.revenueGrowth.source, "derived");
  assert.ok(valuation.assumptions.revenueGrowth.provenance.length > 0);
  assert.equal(valuation.dataQuality.status, "available");
  assert.equal(valuation.dataQuality.completeness, 1);
  assert.equal(valuation.dataQuality.quality, "HIGH");
  assert.equal(valuation.methodStatus, "SUPPORTED");
  assert.equal(valuation.terminalGrowthGuidance.requiresAnalystConfirmation, true);
  assert.notEqual(valuation.terminalGrowthGuidance.value, valuation.assumptions.terminalGrowth.value);
  assert.equal(valuation.historicalTrends.find((metric) => metric.id === "roe:2025")?.sourceType, "DERIVED");
});

test("normalizes only annual source financials, converts units, and retains metric provenance", () => {
  const analysis = createAnalysis();
  const annual = normalizeFundamentalsHistory(analysis);
  assert.equal(annual.length, 2);
  assert.equal(annual[0]!.revenue, 15777);
  assert.equal(annual[1]!.revenue, 16830);
  assert.equal(annual[0]!.netIncome, 600);
  assert.equal(annual[0]!.capex, 25);
  assert.equal(
    annual[1]!.provenance?.revenue?.sourceUrl,
    "https://example.com/annual-report",
  );
  assert.equal(annual[1]!.provenance?.revenue?.sourceMetricId, "netRevenue");
});

test("does not normalize monetary values without verified INR currency", () => {
  const analysis = createAnalysis();
  analysis.financials[0]!.provenance.currency = null;
  const annual = normalizeFundamentalsHistory(analysis);
  assert.equal(annual[0]!.revenue, null);
  assert.equal(annual[1]!.revenue, 16830);
});

test("keeps USD fundamentals in USD billions and derives market capitalization only from matching price currency", () => {
  const analysis = createNonFinancialAnalysis();
  analysis.company.currency = "USD";
  analysis.financials.forEach((metric) => {
    if (/sharesoutstanding/i.test(metric.id)) {
      metric.provenance.unit = "BILLION_SHARES";
      metric.provenance.currency = null;
    } else {
      metric.provenance.unit = "USD_BILLION";
      metric.provenance.currency = "USD";
    }
  });

  const company = {
    ticker: "TEST",
    name: "Example Operating Company",
    exchange: "NASDAQ",
    sector: null,
    industry: null,
  };
  const inrPriceValuation = buildCompanyValuation(
    company,
    analysis,
    createQuote(),
  );
  assert.equal(inrPriceValuation.financialUnit, "USD billion");
  assert.equal(inrPriceValuation.company.currency, "USD");
  assert.equal(inrPriceValuation.waccAssumptions.equity.value, null);

  const usdQuote = { ...createQuote(), currency: "USD" };
  const usdPriceValuation = buildCompanyValuation(
    company,
    analysis,
    usdQuote,
  );
  assert.equal(usdPriceValuation.waccAssumptions.equity.value, 1500);
});

test("classifies financial companies and blocks FCFF DCF for HDFC Bank", () => {
  assert.equal(
    classifyValuationMethod({ companyName: "Example Bank PLC" }),
    "BANK",
  );
  assert.equal(
    classifyValuationMethod({ companyType: "FINANCIAL_INSTITUTION" }),
    "OTHER_FINANCIAL",
  );
  assert.equal(
    classifyValuationMethod({ companyName: "Example NBFC Limited" }),
    "NBFC",
  );
  assert.equal(
    classifyValuationMethod({ sector: "NBFC", companyType: "FINANCIAL_INSTITUTION" }),
    "NBFC",
  );
  assert.equal(
    classifyValuationMethod({ companyName: "Example Manufacturing Ltd" }),
    "NON_FINANCIAL",
  );
  const result = buildCompanyValuation(
    {
      ticker: "HDFCBANK.NS",
      name: "HDFC Bank Limited",
      exchange: "NSE",
      sector: null,
      industry: null,
    },
    createAnalysis(),
    null,
  );
  assert.equal(result.valuationMethod, "BANK");
  assert.equal(result.methodStatus, "NOT_APPROPRIATE");
  assert.equal(result.dcf.status, "insufficient_data");
  if (result.dcf.status === "insufficient_data") {
    assert.match(result.dcf.missingInputs[0]!, /FCFF DCF is not appropriate for banks/);
  }
  assert.equal(result.scenarios.every((scenario) => scenario.status === "insufficient_data"), true);
});
