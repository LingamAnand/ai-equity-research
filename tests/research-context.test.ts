import assert from "node:assert/strict";
import test from "node:test";
import { buildEquityAnalysisPrompt } from "../lib/ai/prompts/equity-analysis.ts";
import { buildFundamentalsAnalysis } from "../lib/calculations/fundamentals-analysis.ts";
import { HdfcBankFundamentalsProvider } from "../lib/providers/hdfc-bank-fundamentals-provider.ts";
import { buildResearchContext } from "../lib/services/research-context.ts";
import type { Company, MarketPrice } from "../lib/types/financial.ts";

const company: Company = {
  id: "test:hdfcbank",
  ticker: "HDFCBANK.NS",
  exchange: "NSE",
  name: "HDFC Bank Limited",
  countryCode: "IN",
  currency: "INR",
  sector: null,
  industry: null,
  marketCap: null,
  isActive: true,
  provider: "unavailable",
  instrument: "HDFCBANK.NS",
  asOf: null,
  marketTimestamp: null,
  dataStatus: "UNAVAILABLE",
  delaySeconds: null,
  delayStatus: "UNKNOWN",
  marketStatus: "UNKNOWN",
  isUnofficial: false,
  licenseStatus: "UNKNOWN",
  source: "Official company filing",
  sourceType: "official_filing",
  sourceUrl: "https://example.invalid/source",
  retrievedAt: "2026-10-01T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function makePrice(index: number): MarketPrice {
  const date = new Date(Date.UTC(2026, 0, index + 1))
    .toISOString()
    .slice(0, 10);
  return {
    id: `price-${index}`,
    companyId: company.id,
    date,
    asOf: `${date}T10:00:00.000Z`,
    marketTimestamp: `${date}T10:00:00.000Z`,
    instrument: company.instrument,
    exchange: "NSE",
    currency: "INR",
    open: null,
    high: null,
    low: null,
    close: 100 + index,
    adjustedClose: null,
    volume: null,
    source: "FYERS API",
    sourceType: "public_api",
    sourceUrl: "https://example.invalid/market",
    retrievedAt: "2026-10-01T00:00:00.000Z",
    provider: "fyers",
    dataStatus: "UNKNOWN",
    delaySeconds: null,
    delayStatus: "UNKNOWN",
    marketStatus: "UNKNOWN",
    isUnofficial: false,
    licenseStatus: "REQUIRES_REVIEW",
  };
}

test("builds compact AI context without sending duplicated dashboard payloads", async () => {
  const history = await new HdfcBankFundamentalsProvider().getFundamentals(
    "HDFCBANK.NS",
  );
  assert.ok(history);
  const fundamentals = buildFundamentalsAnalysis(history, null);
  const context = buildResearchContext(
    company,
    null,
    Array.from({ length: 30 }, (_, index) => makePrice(index)),
    fundamentals,
    "Market data is unavailable.",
  );
  const prompt = buildEquityAnalysisPrompt(context);
  const promptData = JSON.parse(prompt) as {
    suppliedData: Record<string, unknown>;
  };
  const suppliedData = promptData.suppliedData;
  const suppliedFundamentals = suppliedData.fundamentals as {
    periods: unknown[];
    metrics: Array<{ id: string; status: string }>;
  };
  const allowedMetrics = new Set([
    "profitAfterTax",
    "netInterestIncome",
    "totalDeposits",
    "grossAdvances",
    "roa",
    "roe",
    "grossNpaRatio",
    "netNpaRatio",
    "casaRatio",
    "capitalAdequacyRatio",
    "cet1Ratio",
    "basicEps",
    "profitAfterTaxGrowthYoY",
    "netInterestIncomeGrowthYoY",
    "depositGrowthYoY",
    "grossAdvancesGrowthYoY",
  ]);

  assert.equal(suppliedFundamentals.periods.length, 6);
  assert.ok(
    suppliedFundamentals.metrics.every((metric) =>
      allowedMetrics.has(metric.id),
    ),
  );
  assert.ok(
    suppliedFundamentals.metrics.some((metric) => metric.status === "reported"),
  );
  assert.ok(
    suppliedFundamentals.metrics.some(
      (metric) => metric.status === "calculated",
    ),
  );
  const calculatedMetric = suppliedFundamentals.metrics.find(
    (metric) => metric.status === "calculated",
  );
  assert.ok(calculatedMetric);
  assert.ok("formula" in calculatedMetric && calculatedMetric.formula);
  assert.ok(
    "inputs" in calculatedMetric &&
      Array.isArray(calculatedMetric.inputs) &&
      calculatedMetric.inputs.length > 0,
  );
  assert.ok(
    suppliedFundamentals.metrics.some(
      (metric) => metric.status === "unavailable",
    ),
  );
  assert.equal(
    (suppliedData.priceHistory as { samples: unknown[] }).samples.length,
    5,
  );
  assert.equal("financialSnapshot" in suppliedFundamentals, false);
  assert.equal("valuationInputs" in suppliedFundamentals, false);
  assert.equal(prompt.includes('"sourceUrl"'), false);
  assert.equal("unavailableData" in promptData, false);
  assert.ok(
    prompt.length < 25_000,
    `AI context should stay bounded: ${prompt.length} characters`,
  );
});
