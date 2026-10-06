import {
  calculateDifference,
  calculateGrowth,
  calculateRoa,
  calculateRoe,
  reportedMetric,
  resolveReportedMetric,
  unavailableMetric,
  validateFundamentalsHistory,
} from "../calculations/fundamentals.ts";
import {
  HDFC_FUNDAMENTALS_COMPARISON_INPUTS,
  HDFC_FUNDAMENTALS_GROWTH_PAIRS,
  HDFC_FUNDAMENTALS_OBSERVATIONS,
  HDFC_FUNDAMENTALS_PERIODS,
  HDFC_FUNDAMENTALS_RETRIEVED_AT,
  HDFC_FUNDAMENTALS_SOURCES,
  HDFC_FUNDAMENTALS_UNAVAILABLE_REASONS,
  HDFC_FUNDAMENTALS_WARNINGS,
  HDFC_Q1_FY25_COMPARISON_PERIOD,
  type HdfcRawObservation,
} from "../data/hdfc-bank-fundamentals-history.ts";
import type {
  FundamentalMetric,
  FundamentalPeriod,
  FundamentalProvenance,
  FundamentalSource,
  FundamentalUnit,
  FundamentalsHistory,
} from "../types/fundamentals.ts";
import type { FundamentalsProvider } from "./fundamentals-provider.ts";

const FINANCIAL_METRICS = new Set([
  "netRevenue",
  "interestEarned",
  "interestExpended",
  "totalIncome",
  "profitBeforeTax",
  "profitAfterTax",
  "basicEps",
  "dilutedEps",
  "sharesOutstanding",
]);

const BANK_METRICS = [
  "netInterestIncome",
  "totalAssets",
  "totalNetWorth",
  "totalDeposits",
  "grossAdvances",
  "balanceSheetAdvances",
  "cashAndBalancesWithRbi",
  "balancesWithBanksAndCall",
  "borrowings",
  "casaRatio",
  "netInterestMargin",
  "roa",
  "roe",
  "grossNpaAmount",
  "netNpaAmount",
  "grossNpaRatio",
  "netNpaRatio",
  "capitalAdequacyRatio",
  "cet1Ratio",
] as const;

const GROWTH_METRICS = [
  ["netRevenue", "netRevenueGrowthYoY"],
  ["totalIncome", "totalIncomeGrowthYoY"],
  ["profitAfterTax", "profitAfterTaxGrowthYoY"],
  ["netInterestIncome", "netInterestIncomeGrowthYoY"],
  ["totalDeposits", "depositGrowthYoY"],
  ["grossAdvances", "grossAdvancesGrowthYoY"],
  ["basicEps", "basicEpsGrowthYoY"],
] as const;

const SOURCE_BY_ID = new Map(
  HDFC_FUNDAMENTALS_SOURCES.map((source) => [source.id, source]),
);
const PERIOD_BY_ID = new Map(
  HDFC_FUNDAMENTALS_PERIODS.map((period) => [period.id, period]),
);
const SOURCE_FOR_PERIOD: Record<string, string> = {
  "q1-fy2026-27": "q1-fy27-results",
  "q4-fy2025-26": "q4-fy26-press",
  "q1-fy2025-26": "q1-fy26-results",
  "fy2025-26": "q4-fy26-press",
  "fy2024-25": "q4-fy25-results",
  "fy2023-24": "q4-fy25-results",
};

function normalizedTicker(identifier: string): string | null {
  const normalized = identifier.trim().toLocaleUpperCase();
  return ["HDFCBANK", "HDFCBANK.NS", "HDFC BANK", "HDFC BANK LIMITED"].includes(
    normalized,
  )
    ? "HDFCBANK.NS"
    : null;
}

function sourceForObservation(
  observation: HdfcRawObservation,
): FundamentalSource {
  const source = SOURCE_BY_ID.get(observation.sourceId);
  if (!source) {
    throw new Error(`Unknown official source ${observation.sourceId}.`);
  }
  return source;
}

function observationPeriod(
  observation: HdfcRawObservation,
): FundamentalPeriod {
  const period =
    PERIOD_BY_ID.get(observation.periodId) ??
    (observation.periodId === HDFC_Q1_FY25_COMPARISON_PERIOD.id
      ? HDFC_Q1_FY25_COMPARISON_PERIOD
      : undefined);
  if (!period) {
    throw new Error(`Unknown reporting period ${observation.periodId}.`);
  }

  if (observation.measurement === "flow") {
    return period;
  }
  return {
    id: `${period.id}:instant`,
    periodType: "instant",
    periodStart: null,
    periodEnd: period.periodEnd,
    label: `As at ${period.periodEnd}`,
  };
}

function provenanceFor(
  observation: HdfcRawObservation,
): FundamentalProvenance {
  const source = sourceForObservation(observation);
  return {
    sourceId: source.id,
    source: source.source,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    period: observationPeriod(observation),
    publicationDate: source.publicationDate,
    unit: observation.unit,
    currency:
      observation.unit === "PERCENT" ||
      observation.unit === "CRORE_SHARES"
        ? null
        : "INR",
    retrievedAt: source.retrievedAt,
    pageReference: observation.pageReference,
    sectionReference: observation.sectionReference,
    reportingBasis: source.reportingBasis,
  };
}

function unavailableFor(
  id: string,
  periodId: string,
  unit: FundamentalUnit,
  reason: string,
  periodEnd: string,
  sourceId: string,
): FundamentalMetric {
  const source = SOURCE_BY_ID.get(sourceId);
  if (!source) {
    throw new Error(`Unknown official source ${sourceId}.`);
  }
  const period = PERIOD_BY_ID.get(periodId);
  if (!period) {
    throw new Error(`Unknown reporting period ${periodId}.`);
  }
  const provenance: FundamentalProvenance = {
    sourceId: source.id,
    source: source.source,
    sourceType: source.sourceType,
    sourceUrl: source.sourceUrl,
    period: {
      id: `${period.id}:unavailable:${periodEnd}`,
      periodType: "instant",
      periodStart: null,
      periodEnd,
      label: `As at ${periodEnd}`,
    },
    publicationDate: source.publicationDate,
    unit,
    currency:
      unit === "PERCENT" || unit === "CRORE_SHARES" ? null : "INR",
    retrievedAt: source.retrievedAt,
    pageReference: "Not available",
    sectionReference: "Not available from verified source",
    reportingBasis: source.reportingBasis,
  };
  return unavailableMetric(id, periodId, provenance, reason);
}

function metricFromObservations(
  id: string,
  periodId: string,
  observations: HdfcRawObservation[],
  unit: FundamentalUnit,
): FundamentalMetric {
  if (observations.length === 0) {
    const period = PERIOD_BY_ID.get(periodId);
    if (!period) {
      throw new Error(`Unknown reporting period ${periodId}.`);
    }
    return unavailableFor(
      id,
      periodId,
      unit,
      HDFC_FUNDAMENTALS_UNAVAILABLE_REASONS[`${periodId}:${id}`] ??
        "Not available from verified source.",
      period.periodEnd,
      SOURCE_FOR_PERIOD[periodId],
    );
  }

  const candidates = observations.map((observation) =>
    reportedMetric(
      id,
      observation.periodId,
      observation.value,
      provenanceFor(observation),
      observation.reason,
    ),
  );
  return resolveReportedMetric(id, candidates);
}

function createCalculationProvenance(
  periodId: string,
  unit: FundamentalUnit,
  sectionReference: string,
): FundamentalProvenance {
  const sourceId = SOURCE_FOR_PERIOD[periodId];
  const source = SOURCE_BY_ID.get(sourceId);
  const period = PERIOD_BY_ID.get(periodId);
  if (!source || !period) {
    throw new Error(`Cannot create calculation provenance for ${periodId}.`);
  }
  return {
    sourceId: null,
    source: "EquityMind deterministic calculation from official HDFC Bank disclosures",
    sourceType: "calculated",
    sourceUrl: source.sourceUrl,
    period,
    publicationDate: source.publicationDate,
    unit,
    currency:
      unit === "PERCENT" || unit === "CRORE_SHARES" ? null : "INR",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    pageReference: "Calculated from cited inputs",
    sectionReference,
    reportingBasis: source.reportingBasis,
  };
}

function rawFor(periodId: string, metricId: string): HdfcRawObservation[] {
  return HDFC_FUNDAMENTALS_OBSERVATIONS.filter(
    (observation) =>
      observation.periodId === periodId && observation.id === metricId,
  );
}

function comparisonObservation(
  periodId: string,
  metricId: string,
): HdfcRawObservation[] {
  return HDFC_FUNDAMENTALS_COMPARISON_INPUTS.filter(
    (observation) =>
      observation.periodId === periodId && observation.id === metricId,
  );
}

function defaultUnit(metricId: string): FundamentalUnit {
  if (metricId.toLowerCase().includes("ratio") ||
      ["casaRatio", "netInterestMargin", "roa", "roe"].includes(metricId)) {
    return "PERCENT";
  }
  if (metricId.toLowerCase().includes("eps")) {
    return "INR_PER_SHARE";
  }
  if (metricId === "sharesOutstanding") {
    return "CRORE_SHARES";
  }
  if (metricId === "netRevenue" || metricId === "netInterestIncome") {
    return "INR_BILLION";
  }
  return "INR_CRORE";
}

function makeMetric(
  metricId: string,
  periodId: string,
): FundamentalMetric {
  return metricFromObservations(
    metricId,
    periodId,
    rawFor(periodId, metricId),
    defaultUnit(metricId),
  );
}

function makeComparisonMetric(
  metricId: string,
  periodId: string,
): FundamentalMetric {
  return metricFromObservations(
    metricId,
    periodId,
    comparisonObservation(periodId, metricId),
    defaultUnit(metricId),
  );
}

function attachRoe(
  periodId: string,
  pat: FundamentalMetric,
  closingNetWorth: FundamentalMetric,
  openingNetWorth: FundamentalMetric,
): FundamentalMetric {
  return calculateRoe(
    "roe",
    periodId,
    pat,
    openingNetWorth,
    closingNetWorth,
    createCalculationProvenance(
      periodId,
      "PERCENT",
      "ROE calculated using reported PAT and opening/closing net worth",
    ),
  );
}

export class HdfcBankFundamentalsProvider implements FundamentalsProvider {
  async getFundamentals(
    identifier: string,
  ): Promise<FundamentalsHistory | null> {
    if (!normalizedTicker(identifier)) {
      return null;
    }

    const financialIds = new Set<string>(FINANCIAL_METRICS);
    const bankIds = new Set<string>(BANK_METRICS);
    for (const observation of HDFC_FUNDAMENTALS_OBSERVATIONS) {
      (FINANCIAL_METRICS.has(observation.id) ? financialIds : bankIds).add(
        observation.id,
      );
    }

    const financials: FundamentalMetric[] = [];
    const bankMetrics: FundamentalMetric[] = [];
    const metricsByPeriod = new Map<string, Map<string, FundamentalMetric>>();

    for (const period of HDFC_FUNDAMENTALS_PERIODS) {
      const byId = new Map<string, FundamentalMetric>();
      const ids = new Set([...financialIds, ...bankIds]);
      for (const id of ids) {
        byId.set(id, makeMetric(id, period.id));
      }

      const interestEarned = byId.get("interestEarned");
      const interestExpended = byId.get("interestExpended");
      const reportedNii = byId.get("netInterestIncome");
      if (
        reportedNii?.status === "unavailable" &&
        interestEarned &&
        interestExpended &&
        interestEarned.status !== "unavailable" &&
        interestExpended.status !== "unavailable"
      ) {
        byId.set(
          "netInterestIncome",
          calculateDifference(
            "netInterestIncome",
            period.id,
            interestEarned,
            interestExpended,
            createCalculationProvenance(
              period.id,
              interestEarned.provenance.unit,
              "Calculated NII as interest earned less interest expended",
            ),
          ),
        );
      }

      const pat = byId.get("profitAfterTax");
      const netWorth = byId.get("totalNetWorth");
      const reportedRoe = byId.get("roe");
      if (pat && netWorth && reportedRoe?.status === "unavailable") {
        const openingPeriodId =
          period.id === "q1-fy2026-27"
            ? "fy2025-26"
            : period.id === "q1-fy2025-26"
              ? "fy2024-25"
              : period.id === "fy2024-25"
                ? "fy2023-24"
              : period.id === "fy2025-26"
                ? "fy2024-25"
                : "";
        const openingNetWorth = openingPeriodId
          ? makeMetric("totalNetWorth", openingPeriodId)
          : unavailableFor(
              "openingNetWorth",
              period.id,
              "INR_CRORE",
              HDFC_FUNDAMENTALS_UNAVAILABLE_REASONS[`${period.id}:roe`] ??
                "Opening net worth is not available from a verified source.",
              period.periodStart
                ? new Date(new Date(`${period.periodStart}T00:00:00Z`).getTime() - 86400000)
                    .toISOString()
                    .slice(0, 10)
                : period.periodEnd,
              SOURCE_FOR_PERIOD[period.id],
            );
        const roe = attachRoe(
          period.id,
          pat,
          netWorth,
          openingNetWorth,
        );
        byId.set("roe", roe);
      }

      const totalAssets = byId.get("totalAssets");
      const reportedRoa = byId.get("roa");
      if (pat && reportedRoa?.status === "unavailable" && totalAssets) {
        const openingPeriodId =
          period.id === "q1-fy2026-27"
            ? "fy2025-26"
            : period.id === "fy2024-25"
              ? "fy2023-24"
              : period.id === "fy2025-26"
                ? "fy2024-25"
                : "";
        const openingTotalAssets = openingPeriodId
          ? makeMetric("totalAssets", openingPeriodId)
          : unavailableFor(
              "openingTotalAssets",
              period.id,
              "INR_CRORE",
              "Opening total assets for the calculation period are not available from a verified source.",
              period.periodStart
                ? new Date(
                    new Date(`${period.periodStart}T00:00:00Z`).getTime() -
                      86400000,
                  )
                    .toISOString()
                    .slice(0, 10)
                : period.periodEnd,
              SOURCE_FOR_PERIOD[period.id],
            );
        byId.set(
          "roa",
          calculateRoa(
            "roa",
            period.id,
            pat,
            openingTotalAssets,
            totalAssets,
            createCalculationProvenance(
              period.id,
              "PERCENT",
              "ROA calculated using reported PAT and opening/closing total assets",
            ),
          ),
        );
      }

      for (const [id, metric] of byId) {
        const target = FINANCIAL_METRICS.has(id) ? financials : bankMetrics;
        target.push(metric);
      }
      metricsByPeriod.set(period.id, byId);
    }

    const growthMetrics: FundamentalMetric[] = [];
    const pairs = new Map<string, (typeof HDFC_FUNDAMENTALS_GROWTH_PAIRS)[number]>(
      HDFC_FUNDAMENTALS_GROWTH_PAIRS.map((pair) => [pair.periodId, pair]),
    );
    for (const [sourceId, growthId] of GROWTH_METRICS) {
      for (const period of HDFC_FUNDAMENTALS_PERIODS) {
        const pair = pairs.get(period.id);
        const current =
          metricsByPeriod.get(period.id)?.get(sourceId) ??
          makeMetric(sourceId, period.id);
        const comparatorObservations = pair
          ? PERIOD_BY_ID.has(pair.priorPeriodId)
            ? null
            : comparisonObservation(pair.priorPeriodId, sourceId)
          : null;
        const previous = pair
          ? PERIOD_BY_ID.has(pair.priorPeriodId)
            ? metricsByPeriod.get(pair.priorPeriodId)?.get(sourceId) ??
              makeMetric(sourceId, pair.priorPeriodId)
            : comparatorObservations?.length
              ? makeComparisonMetric(sourceId, pair.priorPeriodId)
              : null
          : null;

        if (pair && previous) {
          growthMetrics.push(
            calculateGrowth(
              growthId,
              current,
              previous,
              createCalculationProvenance(
                period.id,
                "PERCENT",
                `Year-over-year ${sourceId} growth`,
              ),
            ),
          );
          continue;
        }

        growthMetrics.push(
          unavailableFor(
            growthId,
            period.id,
            "PERCENT",
            "A verified comparable period is not available; growth was not calculated.",
            period.periodEnd,
            SOURCE_FOR_PERIOD[period.id],
          ),
        );
      }
    }

    const history: FundamentalsHistory = {
      company: {
        ticker: "HDFCBANK.NS",
        companyName: "HDFC Bank Limited",
        exchange: "NSE",
        companyType: "FINANCIAL_INSTITUTION",
        reportingBasis: "standalone",
      },
      periods: HDFC_FUNDAMENTALS_PERIODS,
      financials,
      bankMetrics,
      growthMetrics,
      provenance: HDFC_FUNDAMENTALS_SOURCES,
      warnings: [...HDFC_FUNDAMENTALS_WARNINGS],
    };

    validateFundamentalsHistory(history);
    return history;
  }
}
