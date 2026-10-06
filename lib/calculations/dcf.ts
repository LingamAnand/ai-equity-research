import type {
  DcfResult,
  FinancialYear,
  ForecastAssumptions,
  ForecastScalarAssumptions,
  ForecastYearBreakdown,
} from "../types/valuation.ts";

type AssumptionKey = keyof ForecastScalarAssumptions;

const ASSUMPTION_LIMITS: Record<AssumptionKey, [number, number]> = {
  revenueGrowth: [-1, 2],
  ebitdaMargin: [-1, 1.5],
  ebitMargin: [-1, 1.5],
  taxRate: [0, 1],
  depreciationToRevenue: [0, 1],
  capexToRevenue: [0, 2],
  changeInNwcToRevenue: [-1, 1],
  terminalGrowth: [0, 1],
  wacc: [0, 1],
  forecastYears: [1, 20],
};

const REQUIRED_ASSUMPTIONS: AssumptionKey[] = [
  "terminalGrowth",
  "wacc",
];

const REQUIRED_FORECAST_ASSUMPTIONS = [
  "revenueGrowth",
  "ebitMargin",
  "taxRate",
  "depreciationToRevenue",
  "capexToRevenue",
  "changeInNwcToRevenue",
] as const;

function latestValue(
  rows: readonly FinancialYear[],
  key: "revenue" | "cash" | "debt" | "dilutedShares",
): number | null {
  const latest = rows[rows.length - 1];
  return latest && latest[key] !== null && Number.isFinite(latest[key])
    ? latest[key]
    : null;
}

function validateAssumptions(assumptions: ForecastAssumptions): {
  missingInputs: string[];
  errors: string[];
} {
  const missingInputs: string[] = [];
  const errors: string[] = [];
  const hasAnnualForecast = assumptions.annualForecast.length > 0;
  for (const key of REQUIRED_ASSUMPTIONS) {
    const assumption = assumptions[key];
    if (assumption.value === null) {
      missingInputs.push(key);
      continue;
    }
    const [minimum, maximum] = ASSUMPTION_LIMITS[key];
    if (
      !Number.isFinite(assumption.value) ||
      assumption.value < minimum ||
      assumption.value > maximum
    ) {
      errors.push(`${key} must be between ${minimum} and ${maximum}.`);
    }
  }
  const forecastYears = assumptions.forecastYears.value;
  if (forecastYears === null) {
    missingInputs.push("forecastYears");
  } else if (
    !Number.isInteger(forecastYears) ||
    forecastYears < 1 ||
    forecastYears > 20
  ) {
    errors.push("forecastYears must be an integer between 1 and 20.");
  }
  if (
    assumptions.wacc.value !== null &&
    assumptions.terminalGrowth.value !== null &&
    assumptions.wacc.value <= assumptions.terminalGrowth.value
  ) {
    errors.push("WACC must be greater than terminal growth.");
  }
  if (
    assumptions.annualForecast.length > 0 &&
    assumptions.annualForecast.length !== forecastYears
  ) {
    errors.push("Annual forecast assumption count must match forecastYears.");
  }
  if (hasAnnualForecast) {
    assumptions.annualForecast.forEach((year) => {
      for (const key of REQUIRED_FORECAST_ASSUMPTIONS) {
        const assumption = year[key];
        const [minimum, maximum] = ASSUMPTION_LIMITS[key];
        if (assumption.value === null) {
          missingInputs.push(`FY${year.fiscalYear}.${key}`);
        } else if (
          !Number.isFinite(assumption.value) ||
          assumption.value < minimum ||
          assumption.value > maximum
        ) {
          errors.push(
            `FY${year.fiscalYear}.${key} must be between ${minimum} and ${maximum}.`,
          );
        }
      }
    });
  } else {
    for (const key of REQUIRED_FORECAST_ASSUMPTIONS) {
      if (assumptions[key].value === null) {
        missingInputs.push(key);
      }
    }
  }
  return { missingInputs, errors };
}

export function calculateFcffDcf(
  rows: readonly FinancialYear[],
  assumptions: ForecastAssumptions,
  currentPrice: number | null = null,
): DcfResult {
  const { missingInputs: missingAssumptions, errors } =
    validateAssumptions(assumptions);
  const latestRevenue = latestValue(rows, "revenue");
  const cash = latestValue(rows, "cash");
  const debt = latestValue(rows, "debt");
  const shares = latestValue(rows, "dilutedShares");
  const missingInputs = [...missingAssumptions];
  if (latestRevenue === null || latestRevenue <= 0) {
    missingInputs.push("latestPositiveRevenue");
  }
  if (cash === null) {
    missingInputs.push("cash");
  }
  if (debt === null) {
    missingInputs.push("debt");
  }
  if (shares === null || shares <= 0) {
    missingInputs.push("dilutedShares");
  }
  if (cash !== null && cash < 0) {
    errors.push("Cash must be non-negative.");
  }
  if (debt !== null && debt < 0) {
    errors.push("Debt must be non-negative.");
  }
  if (currentPrice !== null && (!Number.isFinite(currentPrice) || currentPrice <= 0)) {
    errors.push("currentPrice must be a finite positive value when supplied.");
  }
  if (errors.length) {
    return {
      status: "invalid",
      missingInputs: [...new Set(missingInputs)],
      errors,
      assumptions,
    };
  }
  if (missingInputs.length) {
    return {
      status: "insufficient_data",
      missingInputs: [...new Set(missingInputs)],
      errors: [],
      assumptions,
    };
  }

  const terminalGrowth = assumptions.terminalGrowth.value!;
  const wacc = assumptions.wacc.value!;
  const forecastYears = assumptions.forecastYears.value!;
  const latestFiscalYear = Math.max(...rows.map((row) => row.fiscalYear));
  let revenue = latestRevenue!;
  const forecast: ForecastYearBreakdown[] = [];

  for (let period = 1; period <= forecastYears; period += 1) {
    const fiscalYear = latestFiscalYear + period;
    const yearAssumptions = assumptions.annualForecast[period - 1] ?? {
      fiscalYear,
      revenueGrowth: assumptions.revenueGrowth,
      ebitdaMargin: assumptions.ebitdaMargin,
      ebitMargin: assumptions.ebitMargin,
      taxRate: assumptions.taxRate,
      depreciationToRevenue: assumptions.depreciationToRevenue,
      capexToRevenue: assumptions.capexToRevenue,
      changeInNwcToRevenue: assumptions.changeInNwcToRevenue,
    };
    if (yearAssumptions.fiscalYear !== fiscalYear) {
      return {
        status: "invalid",
        missingInputs: [],
        errors: [`Annual forecast year must be FY${fiscalYear}.`],
        assumptions,
      };
    }
    const yearGrowth = yearAssumptions.revenueGrowth.value!;
    const yearEbitMargin = yearAssumptions.ebitMargin.value!;
    const yearTaxRate = yearAssumptions.taxRate.value!;
    const yearDepreciationRatio =
      yearAssumptions.depreciationToRevenue.value!;
    const yearCapexRatio = yearAssumptions.capexToRevenue.value!;
    const yearWorkingCapitalRatio =
      yearAssumptions.changeInNwcToRevenue.value!;
    revenue *= 1 + yearGrowth;
    const ebit = revenue * yearEbitMargin;
    const nopat = ebit * (1 - yearTaxRate);
    const depreciation = revenue * yearDepreciationRatio;
    const capex = revenue * yearCapexRatio;
    const changeInWorkingCapital = revenue * yearWorkingCapitalRatio;
    const fcff = nopat + depreciation - capex - changeInWorkingCapital;
    const discountFactor = 1 / (1 + wacc) ** period;
    const ebitdaMargin = yearAssumptions.ebitdaMargin.value;
    forecast.push({
      fiscalYear,
      assumptions: yearAssumptions,
      revenue,
      ebitda: ebitdaMargin === null ? null : revenue * ebitdaMargin,
      ebit,
      taxRate: yearTaxRate,
      nopat,
      depreciation,
      capex,
      changeInWorkingCapital,
      fcff,
      discountPeriod: period,
      discountFactor,
      presentValueOfFcff: fcff * discountFactor,
    });
  }

  const terminalYearFcff = forecast[forecast.length - 1]!.fcff;
  const terminalValue =
    (terminalYearFcff * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  const terminalValuePresentValue =
    terminalValue / (1 + wacc) ** forecastYears;
  const presentValueOfForecastFcff = forecast.reduce(
    (total, year) => total + year.presentValueOfFcff,
    0,
  );
  const enterpriseValue =
    presentValueOfForecastFcff + terminalValuePresentValue;
  const netDebt = debt! - cash!;
  const equityValue = enterpriseValue - netDebt;
  const valuePerShare = equityValue / shares!;
  const numericResults = [
    terminalYearFcff,
    terminalValue,
    terminalValuePresentValue,
    presentValueOfForecastFcff,
    enterpriseValue,
    netDebt,
    equityValue,
    valuePerShare,
    cash!,
    debt!,
    shares!,
  ];
  if (!numericResults.every(Number.isFinite)) {
    return {
      status: "invalid",
      missingInputs: [],
      errors: ["DCF calculation produced a non-finite result."],
      assumptions,
    };
  }

  return {
    status: "available",
    forecast,
    terminalYearFcff,
    terminalValue,
    terminalValuePresentValue,
    presentValueOfForecastFcff,
    enterpriseValue,
    netDebt,
    cash: cash!,
    totalDebt: debt!,
    dilutedShares: shares!,
    equityValue,
    valuePerShare,
    terminalValuePercentOfEnterpriseValue:
      enterpriseValue === 0
        ? null
        : terminalValuePresentValue / enterpriseValue,
    currentPrice,
    upsideDownside:
      currentPrice === null ? null : valuePerShare / currentPrice - 1,
    assumptions,
  };
}
