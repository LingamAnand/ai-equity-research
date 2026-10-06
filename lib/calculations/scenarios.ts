import { calculateFcffDcf } from "./dcf.ts";
import {
  buildAnnualForecastAssumptions,
  setUserProvidedAssumption,
} from "./financial-analysis.ts";
import type {
  DcfResult,
  FinancialYear,
  ForecastAssumptions,
  ScenarioOverrides,
  ValuationAssumption,
  ValuationScenarioName,
  ValuationScenarioResult,
} from "../types/valuation.ts";

const OVERRIDE_KEYS = [
  "revenueGrowth",
  "ebitdaMargin",
  "ebitMargin",
  "taxRate",
  "depreciationToRevenue",
  "capexToRevenue",
  "changeInNwcToRevenue",
  "terminalGrowth",
  "wacc",
] as const;

const YEARLY_OVERRIDE_KEYS = [
  "revenueGrowth",
  "ebitdaMargin",
  "ebitMargin",
  "taxRate",
  "depreciationToRevenue",
  "capexToRevenue",
  "changeInNwcToRevenue",
] as const;

function unavailableScenario(
  name: ValuationScenarioName,
  assumptions: ForecastAssumptions,
  reason: string,
): ValuationScenarioResult {
  return {
    name,
    status: "insufficient_data",
    assumptions,
    enterpriseValue: null,
    equityValue: null,
    intrinsicValuePerShare: null,
    upsideDownside: null,
    missingInputs: [reason],
    errors: [],
  };
}

function applyOverrides(
  base: ForecastAssumptions,
  overrides: ScenarioOverrides,
  name: ValuationScenarioName,
  sourceType: "USER_PROVIDED" | "DERIVED" = "USER_PROVIDED",
  rows: readonly FinancialYear[] = [],
): ForecastAssumptions {
  const result: ForecastAssumptions = {
    ...base,
    forecastYears: { ...base.forecastYears },
    annualForecast: base.annualForecast.map((year) => ({
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
  for (const key of OVERRIDE_KEYS) {
    const value = overrides[key];
    if (value !== undefined) {
      const assumption = result[key] as ValuationAssumption;
      if (sourceType === "USER_PROVIDED") {
        result[key] = setUserProvidedAssumption(
          assumption,
          value,
          "Explicit analyst scenario override supplied to the deterministic valuation engine.",
        );
      } else {
        const metricKeys = {
          revenueGrowth: ["revenue"],
          ebitdaMargin: ["ebitda", "revenue"],
          ebitMargin: ["ebit", "revenue"],
          taxRate: ["incomeTaxExpense", "profitBeforeTax"],
          depreciationToRevenue: ["depreciation", "revenue"],
          capexToRevenue: ["capex", "revenue"],
          changeInNwcToRevenue: ["changeInWorkingCapital", "workingCapital", "revenue"],
          terminalGrowth: ["revenue"],
          wacc: [],
        } as const;
        const keys = metricKeys[key as keyof typeof metricKeys] ?? [];
        const provenance = [
          ...new Map(
            rows
              .flatMap((row) =>
                keys.flatMap((metric) => {
                  const provenanceKey =
                    metric === "incomeTaxExpense" ||
                    metric === "profitBeforeTax" ||
                    metric === "changeInWorkingCapital"
                      ? metric
                      : metric;
                  return [
                    row.provenance?.[
                      provenanceKey as keyof NonNullable<FinancialYear["provenance"]>
                    ],
                  ];
                }),
              )
              .filter((source) => Boolean(source))
              .map((source) => [
                `${source!.sourceMetricId}:${source!.periodEnd}:${source!.sourceUrl ?? ""}`,
                source!,
              ]),
          ).values(),
        ];
        result[key] = {
          ...assumption,
          value,
          source: "derived",
          sourceType: "DERIVED",
          confidence: provenance.length ? "MODERATE" : "LOW",
          editable: true,
          sourceDescription: "Derived from observed historical scenario ranges.",
          provenance,
          basis: "historical_derived",
          method: "observed_historical_extreme",
          rationale: `The ${name} scenario uses the observed ${name === "bear" ? "adverse" : "favorable"} extreme from available historical data; no arbitrary percentage adjustment is applied.`,
        };
      }
    }
  }
  if (overrides.forecastYears !== undefined) {
    if (
      !Number.isInteger(overrides.forecastYears) ||
      overrides.forecastYears < 1 ||
      overrides.forecastYears > 20
    ) {
      throw new RangeError("Scenario forecastYears must be an integer from 1 to 20.");
    }
    result.forecastYears = setUserProvidedAssumption(
      result.forecastYears,
      overrides.forecastYears,
      "Explicit analyst scenario override.",
    );
    const firstForecastYear = result.annualForecast[0]?.fiscalYear;
    if (firstForecastYear !== undefined) {
      result.annualForecast = buildAnnualForecastAssumptions(
        result,
        firstForecastYear - 1,
        overrides.forecastYears,
      );
    }
  }
  for (const key of YEARLY_OVERRIDE_KEYS) {
    const value = overrides[key];
    if (value === undefined) {
      continue;
    }
    for (const year of result.annualForecast) {
      year[key] = setUserProvidedAssumption(
        year[key],
        value,
        `Explicit analyst ${name} scenario override.`,
      );
    }
  }
  return result;
}

function toScenario(
  name: ValuationScenarioName,
  result: DcfResult,
): ValuationScenarioResult {
  if (result.status !== "available") {
    return {
      name,
      status: result.status,
      assumptions: result.assumptions,
      enterpriseValue: null,
      equityValue: null,
      intrinsicValuePerShare: null,
      upsideDownside: null,
      missingInputs: result.missingInputs,
      errors: result.errors,
    };
  }
  return {
    name,
    status: result.status,
    assumptions: result.assumptions,
    enterpriseValue: result.enterpriseValue,
    equityValue: result.equityValue,
    intrinsicValuePerShare: result.valuePerShare,
    upsideDownside: result.upsideDownside,
    missingInputs: [],
    errors: [],
  };
}

export function calculateDcfScenarios(
  rows: readonly FinancialYear[],
  base: ForecastAssumptions,
  currentPrice: number | null,
  overrides: Partial<Record<ValuationScenarioName, ScenarioOverrides>> = {},
): ValuationScenarioResult[] {
  return (["base", "bull", "bear"] as const).map((name) => {
    const suppliedOverrides = overrides[name] ?? {};
    const scenarioOverrides =
      name === "base" || Object.keys(suppliedOverrides).length
        ? suppliedOverrides
        : deriveHistoricalScenarioOverrides(rows, name);
    if (name !== "base" && Object.keys(scenarioOverrides).length === 0) {
      return unavailableScenario(
        name,
        base,
        `At least two sourced historical observations for operating assumptions are required; no arbitrary scenario deviation is applied.`,
      );
    }
    const assumptions = applyOverrides(
      base,
      scenarioOverrides,
      name,
      name !== "base" && Object.keys(suppliedOverrides).length === 0
        ? "DERIVED"
        : "USER_PROVIDED",
      rows,
    );
    return toScenario(
      name,
      calculateFcffDcf(rows, assumptions, currentPrice),
    );
  });
}

function deriveHistoricalScenarioOverrides(
  rows: readonly FinancialYear[],
  name: "bull" | "bear",
): ScenarioOverrides {
  const recentRows = rows.slice(-5);
  const ranges = {
    revenueGrowth: recentRows.map((row) => row.revenueGrowth),
    ebitMargin: recentRows.map((row) => row.ebitMargin),
    taxRate: recentRows.map((row) => row.taxRate),
    depreciationToRevenue: recentRows.map((row) =>
      row.revenue !== null && row.revenue > 0 && row.depreciation !== null
        ? row.depreciation / row.revenue
        : null,
    ),
    capexToRevenue: recentRows.map((row) =>
      row.revenue !== null && row.revenue > 0 && row.capex !== null
        ? row.capex / row.revenue
        : null,
    ),
    changeInNwcToRevenue: recentRows.map((row) =>
      row.revenue !== null && row.revenue > 0 && row.changeInWorkingCapital !== null
        ? row.changeInWorkingCapital / row.revenue
        : null,
    ),
  } as const;
  const result: ScenarioOverrides = {};
  for (const [key, values] of Object.entries(ranges) as Array<
    [keyof typeof ranges, readonly (number | null)[]]
  >) {
    const observations = values.filter(
      (value): value is number => value !== null && Number.isFinite(value),
    );
    if (observations.length < 2) {
      continue;
    }
    const preferLow =
      (name === "bear" &&
        ["revenueGrowth", "ebitMargin", "depreciationToRevenue"].includes(key)) ||
      (name === "bull" &&
        ["taxRate", "capexToRevenue", "changeInNwcToRevenue"].includes(key));
    const value = preferLow
      ? Math.min(...observations)
      : Math.max(...observations);
    result[key] = value;
  }
  return result;
}
