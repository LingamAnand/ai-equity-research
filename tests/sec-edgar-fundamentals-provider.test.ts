import assert from "node:assert/strict";
import test from "node:test";
import { RoutedFundamentalsProvider } from "../lib/providers/routed-fundamentals-provider.ts";
import {
  SecEdgarFundamentalsProvider,
  SecEdgarProviderError,
} from "../lib/providers/sec-edgar-fundamentals-provider.ts";
import type { FundamentalsHistory } from "../lib/types/fundamentals.ts";

const fiscalYears = [
  { fiscalYear: 2024, start: "2023-07-01", end: "2024-06-30" },
  { fiscalYear: 2025, start: "2024-07-01", end: "2025-06-30" },
];

function durationFact(values: number[]) {
  return {
    units: {
      USD: fiscalYears.map((period, index) => ({
        val: values[index]!,
        start: period.start,
        end: period.end,
        filed: `${period.fiscalYear}-08-01`,
        form: "10-K",
        fp: "FY",
        fy: period.fiscalYear,
        accessionNumber: `0000789019-${period.fiscalYear}-000001`,
        primaryDocument: "msft-2025.htm",
      })),
    },
  };
}

function instantFact(values: number[]) {
  return {
    units: {
      USD: fiscalYears.map((period, index) => ({
        val: values[index]!,
        end: period.end,
        filed: `${period.fiscalYear}-08-01`,
        form: "10-K",
        fp: "FY",
        fy: period.fiscalYear,
        accessionNumber: `0000789019-${period.fiscalYear}-000001`,
        primaryDocument: "msft-2025.htm",
      })),
    },
  };
}

function mockSecFetch(url: string | URL | Request): Promise<Response> {
  const requestedUrl = String(url);
  if (requestedUrl.endsWith("/files/company_tickers.json")) {
    return Promise.resolve(
      Response.json({
        0: { cik_str: 789019, ticker: "MSFT", title: "MICROSOFT CORP" },
      }),
    );
  }
  if (requestedUrl.endsWith("/submissions/CIK0000789019.json")) {
    return Promise.resolve(
      Response.json({
        name: "MICROSOFT CORPORATION",
        sic: "7372",
        sicDescription: "Services-Prepackaged Software",
        exchanges: ["Nasdaq"],
      }),
    );
  }
  if (requestedUrl.endsWith("/companyfacts/CIK0000789019.json")) {
    const tags = {
      RevenueFromContractWithCustomerExcludingAssessedTax: durationFact([
        100_000_000_000,
        120_000_000_000,
      ]),
      OperatingIncomeLoss: durationFact([40_000_000_000, 50_000_000_000]),
      Depreciation: durationFact([5_000_000_000, 6_000_000_000]),
      AmortizationOfIntangibleAssets: durationFact([
        1_000_000_000,
        1_200_000_000,
      ]),
      InterestExpenseNonoperating: durationFact([2_000_000_000, 2_100_000_000]),
      IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest:
        durationFact([38_000_000_000, 47_900_000_000]),
      IncomeTaxExpenseBenefit: durationFact([8_000_000_000, 10_000_000_000]),
      NetIncomeLoss: durationFact([30_000_000_000, 37_900_000_000]),
      NetCashProvidedByUsedInOperatingActivities: durationFact([
        35_000_000_000,
        40_000_000_000,
      ]),
      PaymentsToAcquirePropertyPlantAndEquipment: durationFact([
        6_000_000_000,
        7_000_000_000,
      ]),
      CashAndCashEquivalentsAtCarryingValue: instantFact([
        20_000_000_000,
        22_000_000_000,
      ]),
      LongTermDebtCurrent: instantFact([2_000_000_000, 2_500_000_000]),
      LongTermDebtNoncurrent: instantFact([8_000_000_000, 9_000_000_000]),
      StockholdersEquity: instantFact([100_000_000_000, 115_000_000_000]),
      WeightedAverageNumberOfDilutedSharesOutstanding: {
        units: {
          shares: fiscalYears.map((period) => ({
            val: 7_500_000_000,
            start: period.start,
            end: period.end,
            filed: `${period.fiscalYear}-08-01`,
            form: "10-K",
            fp: "FY",
            fy: period.fiscalYear,
            accessionNumber: `0000789019-${period.fiscalYear}-000001`,
            primaryDocument: "msft-2025.htm",
          })),
        },
      },
    };
    const shares = {
      units: {
        shares: fiscalYears.map((period) => ({
          val: 7_400_000_000,
          end: `${period.fiscalYear}-08-01`,
          filed: `${period.fiscalYear}-08-01`,
          form: "10-K",
          fp: "FY",
          fy: period.fiscalYear,
          accessionNumber: `0000789019-${period.fiscalYear}-000001`,
          primaryDocument: "msft-2025.htm",
        })),
      },
    };
    return Promise.resolve(
      Response.json({
        facts: {
          "us-gaap": tags,
          dei: { EntityCommonStockSharesOutstanding: shares },
        },
      }),
    );
  }
  return Promise.resolve(new Response(null, { status: 404 }));
}

function createProvider() {
  return new SecEdgarFundamentalsProvider({
    fetcher: mockSecFetch,
    userAgent: "EquityMind test research contact@example.com",
  });
}

test("SEC provider resolves company search and retrieves normalized annual fundamentals", async () => {
  const provider = createProvider();
  const companies = await provider.searchCompanies("MSFT");
  assert.equal(companies.length, 1);
  assert.equal(companies[0]?.ticker, "MSFT");

  const fundamentals = await provider.getFundamentals("MSFT");
  assert.ok(fundamentals);
  assert.equal(fundamentals.company.companyType, "GENERAL_COMPANY");
  assert.equal(fundamentals.company.currency, "USD");
  assert.deepEqual(
    fundamentals.periods.map((period) => period.periodEnd),
    ["2024-06-30", "2025-06-30"],
  );

  const latest = fundamentals.financials.filter(
    (metric) => metric.periodId === "fy-2025-06-30",
  );
  const revenue = latest.find((metric) => metric.id === "revenue");
  assert.equal(revenue?.status, "reported");
  assert.equal(revenue?.value, 120);
  assert.equal(revenue?.provenance.unit, "USD_BILLION");
  assert.match(revenue?.provenance.sourceUrl ?? "", /sec\.gov/);
  assert.equal(revenue?.provenance.sourceType, "official_company_filing");

  const debt = latest.find((metric) => metric.id === "debt");
  assert.equal(debt?.status, "calculated");
  assert.equal(debt?.value, 11.5);
  const unavailableNwc = latest.find(
    (metric) => metric.id === "changeInWorkingCapital",
  );
  assert.equal(unavailableNwc?.status, "unavailable");
  assert.match(
    unavailableNwc?.status === "unavailable" ? unavailableNwc.reason : "",
    /no annual/i,
  );
});

test("SEC provider classifies financial SIC codes and rejects unsupported tickers", async () => {
  const provider = createProvider();
  assert.equal(await provider.getFundamentals("RELIANCE.NS"), null);
  assert.equal(await provider.getFundamentals("NOTASECURITY"), null);
});

test("SEC provider requires an identifying User-Agent and reports configuration clearly", async () => {
  const provider = new SecEdgarFundamentalsProvider({ fetcher: mockSecFetch });
  await assert.rejects(
    provider.searchCompanies("MSFT"),
    (error: unknown) =>
      error instanceof SecEdgarProviderError &&
      error.code === "configuration_error",
  );
});

test("routed provider keeps HDFC-specific fundamentals ahead of the generic provider", async () => {
  const hdfcHistory = {
    company: { ticker: "HDFCBANK.NS" },
  } as FundamentalsHistory;
  const hdfcProvider = {
    getFundamentals: async (ticker: string) =>
      ticker === "HDFCBANK.NS" ? hdfcHistory : null,
  };
  const routed = new RoutedFundamentalsProvider(
    hdfcProvider,
    createProvider(),
  );

  assert.equal(await routed.getFundamentals("HDFCBANK.NS"), hdfcHistory);
  assert.equal(
    (await routed.getFundamentals("MSFT"))?.company.ticker,
    "MSFT",
  );
  assert.equal(await routed.getFundamentals("UNKNOWN"), null);
});
