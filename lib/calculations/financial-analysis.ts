import type {
  FinancialYear,
  FinancialYearInput,
  ForecastYearAssumptions,
  ForecastAssumptions,
  FinancialMetricProvenance,
  HistoricalTrendMetric,
  ValuationAssumption,
} from "../types/valuation.ts";

function validNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  return numerator === null || denominator === null || denominator <= 0
    ? null
    : numerator / denominator;
}

export function calculateCagr(
  beginningValue: number | null,
  endingValue: number | null,
  years: number,
): number | null {
  if (
    beginningValue === null ||
    endingValue === null ||
    beginningValue <= 0 ||
    endingValue < 0 ||
    !Number.isInteger(years) ||
    years <= 0
  ) {
    return null;
  }
  return (endingValue / beginningValue) ** (1 / years) - 1;
}

export function normalizeFinancialYears(
  inputs: readonly FinancialYearInput[],
): FinancialYear[] {
  const sorted = [...inputs].sort(
    (left, right) =>
      left.fiscalYear - right.fiscalYear ||
      left.periodEnd.localeCompare(right.periodEnd),
  );
  const seenPeriods = new Set<number>();
  for (const item of sorted) {
    const validPeriodEnd =
      /^\d{4}-\d{2}-\d{2}$/.test(item.periodEnd) &&
      new Date(`${item.periodEnd}T00:00:00.000Z`)
        .toISOString()
        .startsWith(item.periodEnd);
    if (
      !Number.isInteger(item.fiscalYear) ||
      !validPeriodEnd ||
      Number(item.periodEnd.slice(0, 4)) !== item.fiscalYear
    ) {
      throw new RangeError("Financial years require a valid fiscal year and period end.");
    }
    if (seenPeriods.has(item.fiscalYear)) {
      throw new RangeError(`Duplicate annual financial period for FY${item.fiscalYear}.`);
    }
    seenPeriods.add(item.fiscalYear);
  }

  return sorted.map((item, index) => {
    const previous = sorted[index - 1];
    const revenue = validNumber(item.revenue);
    let ebitda = validNumber(item.ebitda);
    const ebit = validNumber(item.ebit);
    const netIncome = validNumber(item.netIncome);
    const profitBeforeTax = validNumber(item.profitBeforeTax);
    const depreciation = validNumber(item.depreciation);
    const capex = validNumber(item.capex);
    const workingCapital = validNumber(item.workingCapital);
    const previousWorkingCapital = validNumber(previous?.workingCapital);
    const reportedChangeInWorkingCapital = validNumber(item.changeInWorkingCapital);
    const changeInWorkingCapital =
      reportedChangeInWorkingCapital ??
      (previous?.fiscalYear === item.fiscalYear - 1 &&
      workingCapital !== null && previousWorkingCapital !== null
        ? workingCapital - previousWorkingCapital
        : null);
    let debt = validNumber(item.debt);
    const shortTermDebt = validNumber(item.shortTermDebt);
    const longTermDebt = validNumber(item.longTermDebt);
    const equity = validNumber(item.equity);
    const provenance = { ...(item.provenance ?? {}) };
    if (debt === null && shortTermDebt !== null && longTermDebt !== null) {
      debt = shortTermDebt + longTermDebt;
      const debtSources = [
        provenance.shortTermDebt,
        provenance.longTermDebt,
      ].filter((source): source is FinancialMetricProvenance => Boolean(source));
      if (debtSources.length) {
        provenance.debt = calculatedProvenance(
          "totalDebt",
          debtSources,
          "Total debt calculated as short-term debt plus long-term debt.",
        );
      }
    }
    if (ebitda === null && ebit !== null && depreciation !== null) {
      ebitda = ebit + depreciation;
      const sourceInputs = [provenance.ebit, provenance.depreciation].filter(
        (source): source is FinancialMetricProvenance => Boolean(source),
      );
      if (sourceInputs.length) {
        provenance.ebitda = calculatedProvenance(
          "ebitda",
          sourceInputs,
          "EBITDA calculated as EBIT plus depreciation and amortization.",
        );
      }
    }
    if (
      reportedChangeInWorkingCapital === null &&
      changeInWorkingCapital !== null
    ) {
      const sourceInputs = [
        provenance.workingCapital,
        previous?.provenance?.workingCapital,
      ].filter((source): source is FinancialMetricProvenance => Boolean(source));
      if (sourceInputs.length) {
        provenance.changeInWorkingCapital = calculatedProvenance(
          "changeInWorkingCapital",
          sourceInputs,
          "Change in working capital calculated from consecutive annual balances.",
        );
      }
    }
    const incomeTaxExpense = validNumber(item.incomeTaxExpense);
    const revenueGrowth =
      revenue !== null &&
      previous &&
      previous.fiscalYear === item.fiscalYear - 1 &&
      validNumber(previous.revenue) !== null &&
      previous.revenue! > 0
        ? revenue / previous.revenue! - 1
        : null;
    if (revenueGrowth !== null && previous) {
      const growthSources = [
        provenance.revenue,
        previous.provenance?.revenue,
      ].filter((source): source is FinancialMetricProvenance => Boolean(source));
      if (growthSources.length) {
        provenance.revenueGrowth = {
          ...calculatedProvenance(
            "revenueGrowth",
            growthSources,
            "Revenue growth calculated from consecutive annual revenue observations.",
          ),
          periodEnd: item.periodEnd,
          unit: "PERCENT",
          currency: null,
        };
      }
    }
    const effectiveTaxRate = ratio(incomeTaxExpense, profitBeforeTax);
    const taxRate =
      effectiveTaxRate !== null && effectiveTaxRate >= 0 && effectiveTaxRate <= 1
        ? effectiveTaxRate
        : null;

    const availability = {
      revenue: revenue !== null,
      ebitda: ebitda !== null,
      ebit: ebit !== null,
      netIncome: netIncome !== null,
      profitBeforeTax: profitBeforeTax !== null,
      depreciation: depreciation !== null,
      capex: capex !== null,
      workingCapital: workingCapital !== null,
      changeInWorkingCapital: changeInWorkingCapital !== null,
      shortTermDebt: shortTermDebt !== null,
      longTermDebt: longTermDebt !== null,
      cash: validNumber(item.cash) !== null,
      debt: debt !== null,
      sharesOutstanding: validNumber(item.sharesOutstanding) !== null,
      dilutedShares: validNumber(item.dilutedShares) !== null,
      equity: equity !== null,
      taxRate: taxRate !== null,
    };

    return {
      fiscalYear: item.fiscalYear,
      periodEnd: item.periodEnd,
      revenue,
      revenueGrowth,
      ebitda,
      ebitdaMargin: ratio(ebitda, revenue),
      ebit,
      ebitMargin: ratio(ebit, revenue),
      netIncome,
      profitBeforeTax,
      netMargin: ratio(netIncome, revenue),
      depreciation,
      capex,
      workingCapital,
      changeInWorkingCapital,
      shortTermDebt,
      longTermDebt,
      cash: validNumber(item.cash),
      debt,
      sharesOutstanding: validNumber(item.sharesOutstanding),
      dilutedShares: validNumber(item.dilutedShares),
      equity,
      taxRate,
      provenance,
      availability,
    };
  });
}

function calculatedProvenance(
  sourceMetricId: string,
  sources: FinancialMetricProvenance[],
  sectionReference: string,
): FinancialMetricProvenance {
  const latestRetrievedAt = sources
    .map((source) => source.retrievedAt)
    .sort()
    .at(-1)!;
  const sourceUrls = [...new Set(sources.map((source) => source.sourceUrl).filter(Boolean))];
  const first = sources[0]!;
  return {
    sourceMetricId,
    source: "EquityMind deterministic calculation",
    sourceType: "calculated",
    sourceUrl: sourceUrls.length === 1 ? sourceUrls[0]! : null,
    periodEnd: first.periodEnd,
    publicationDate: sources
      .map((source) => source.publicationDate)
      .sort()
      .at(-1)!,
    retrievedAt: latestRetrievedAt,
    unit: first.unit,
    currency: first.currency,
    pageReference: sources.map((source) => source.pageReference).filter(Boolean).join("; "),
    sectionReference,
  };
}

function derivedMean(
  rows: readonly FinancialYear[],
  key: keyof Pick<
    FinancialYear,
    | "revenueGrowth"
    | "ebitdaMargin"
    | "ebitMargin"
    | "taxRate"
  >,
  minimumObservations = 2,
): ValuationAssumption {
  const recentRows = rows.slice(-3);
  const observations = recentRows
    .map((row) => ({ row, value: row[key] }))
    .filter(
      (entry): entry is { row: FinancialYear; value: number } =>
        entry.value !== null && Number.isFinite(entry.value),
    );
  if (observations.length < minimumObservations) {
    return {
      value: null,
      source: "unavailable",
      sourceType: "UNAVAILABLE",
      confidence: "NOT_ASSESSED",
      editable: true,
      sourceDescription: "Historical observations unavailable or insufficient.",
      provenance: [],
      basis: "unavailable",
      method: "historical_mean",
      rationale: `At least ${minimumObservations} comparable historical observations are required.`,
    };
  }
  const provenance = mergeProvenance(
    observations.flatMap(({ row }) => provenanceForMean(row, key)),
  );
  return {
    value: observations.reduce((sum, entry) => sum + entry.value, 0) / observations.length,
    source: "derived",
    sourceType: "DERIVED",
    confidence: provenance.length
      ? observations.length >= 3
        ? "HIGH"
        : "MODERATE"
      : "LOW",
    editable: true,
    sourceDescription: provenance.length
      ? `Historical observations from ${[...new Set(provenance.map((item) => item.source))].join(", ")}.`
      : "Historical values normalized without attached source references.",
    provenance,
    basis: "historical_derived",
    method: "arithmetic_mean_recent_three_fiscal_years",
    rationale: `Arithmetic mean of ${observations.length} available observations from the most recent three fiscal years.`,
  };
}

function derivedRatioMean(
  rows: readonly FinancialYear[],
  numeratorKey: "depreciation" | "capex" | "changeInWorkingCapital",
): ValuationAssumption {
  const observations = rows
    .slice(-3)
    .map((row) => ({
      row,
      value: ratio(row[numeratorKey], row.revenue),
    }))
    .filter(
      (entry): entry is { row: FinancialYear; value: number } =>
        entry.value !== null && Number.isFinite(entry.value),
    );
  if (observations.length < 2) {
    return {
        value: null,
        source: "unavailable",
        sourceType: "UNAVAILABLE",
        confidence: "NOT_ASSESSED",
        editable: true,
        sourceDescription: "Historical observations unavailable or insufficient.",
        provenance: [],
        basis: "unavailable",
        method: "historical_ratio_mean",
        rationale: "At least two comparable historical ratios are required.",
    };
  }
  const provenance = mergeProvenance(
    observations.flatMap(({ row }) => [
      row.provenance?.[numeratorKey],
      row.provenance?.revenue,
    ]),
  );
  return {
    value: observations.reduce((sum, entry) => sum + entry.value, 0) / observations.length,
    source: "derived",
    sourceType: "DERIVED",
    confidence: provenance.length
      ? observations.length >= 3
        ? "HIGH"
        : "MODERATE"
      : "LOW",
    editable: true,
    sourceDescription: provenance.length
      ? `Historical observations from ${[...new Set(provenance.map((item) => item.source))].join(", ")}.`
      : "Historical values normalized without attached source references.",
    provenance,
    basis: "historical_derived",
    method: "arithmetic_mean_recent_three_fiscal_years",
    rationale: `Arithmetic mean of ${observations.length} available ratios from the most recent three fiscal years.`,
  };
}

function unavailable(rationale: string): ValuationAssumption {
  return {
      value: null,
      source: "unavailable",
      sourceType: "UNAVAILABLE",
      confidence: "NOT_ASSESSED",
      editable: true,
      sourceDescription: "No sourced or analyst-provided value.",
      provenance: [],
      basis: "unavailable",
      method: "requires_explicit_input",
      rationale,
  };
}

function mergeProvenance(
  candidates: Array<FinancialMetricProvenance | undefined>,
): FinancialMetricProvenance[] {
  const byKey = new Map<string, FinancialMetricProvenance>();
  for (const item of candidates) {
    if (item) {
      byKey.set(
        `${item.sourceMetricId}:${item.periodEnd}:${item.sourceUrl ?? ""}`,
        item,
      );
    }
  }
  return [...byKey.values()];
}

function provenanceForMean(
  row: FinancialYear,
  key: "revenueGrowth" | "ebitdaMargin" | "ebitMargin" | "taxRate",
): Array<FinancialMetricProvenance | undefined> {
  switch (key) {
    case "revenueGrowth":
      return [row.provenance?.revenueGrowth];
    case "ebitdaMargin":
      return [row.provenance?.ebitda, row.provenance?.revenue];
    case "ebitMargin":
      return [row.provenance?.ebit, row.provenance?.revenue];
    case "taxRate":
      return [
        row.provenance?.incomeTaxExpense,
        row.provenance?.profitBeforeTax,
      ];
  }
}

export function deriveForecastAssumptions(
  rows: readonly FinancialYear[],
): ForecastAssumptions {
  return {
    revenueGrowth: derivedMean(rows, "revenueGrowth"),
    ebitdaMargin: derivedMean(rows, "ebitdaMargin"),
    ebitMargin: derivedMean(rows, "ebitMargin"),
    taxRate: derivedMean(rows, "taxRate"),
    depreciationToRevenue: derivedRatioMean(rows, "depreciation"),
    capexToRevenue: derivedRatioMean(rows, "capex"),
    changeInNwcToRevenue: derivedRatioMean(rows, "changeInWorkingCapital"),
    terminalGrowth: unavailable(
      "Terminal growth requires an explicit analyst-provided long-run assumption.",
    ),
    wacc: unavailable(
      "WACC requires explicit, sourced market risk and financing assumptions.",
    ),
    forecastYears: {
      value: null,
      source: "unavailable",
      sourceType: "UNAVAILABLE",
      confidence: "NOT_ASSESSED",
      editable: true,
      sourceDescription: "No forecast horizon selected.",
      provenance: [],
      basis: "unavailable",
      method: "analyst_selected_forecast_horizon",
      rationale: "Forecast horizon must be explicitly selected by the analyst.",
    },
    annualForecast: [],
  };
}

export function buildAnnualForecastAssumptions(
  assumptions: ForecastAssumptions,
  lastHistoricalFiscalYear: number,
  forecastYears: number,
): ForecastYearAssumptions[] {
  if (!Number.isInteger(forecastYears) || forecastYears < 1 || forecastYears > 20) {
    throw new RangeError("Forecast years must be an integer between 1 and 20.");
  }
  return Array.from({ length: forecastYears }, (_, index) => ({
    fiscalYear: lastHistoricalFiscalYear + index + 1,
    revenueGrowth: { ...assumptions.revenueGrowth },
    ebitdaMargin: { ...assumptions.ebitdaMargin },
    ebitMargin: { ...assumptions.ebitMargin },
    taxRate: { ...assumptions.taxRate },
    depreciationToRevenue: { ...assumptions.depreciationToRevenue },
    capexToRevenue: { ...assumptions.capexToRevenue },
    changeInNwcToRevenue: { ...assumptions.changeInNwcToRevenue },
  }));
}

export function cagrForFinancialYears(
  rows: readonly FinancialYear[],
  field: "revenue" | "ebitda" | "ebit" | "netIncome",
): number | null {
  if (rows.length < 2) {
    return null;
  }
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  return calculateCagr(
    first[field],
    last[field],
    last.fiscalYear - first.fiscalYear,
  );
}

function trendMetric(
  id: string,
  value: number | null,
  unit: HistoricalTrendMetric["unit"],
  rows: readonly FinancialYear[],
  basis: string,
  sourceKeys: Array<keyof NonNullable<FinancialYear["provenance"]>>,
  observationCount: number,
): HistoricalTrendMetric {
  const provenance = [
    ...new Map(
      rows
        .flatMap((row) => sourceKeys.map((key) => row.provenance?.[key]))
        .filter((source): source is FinancialMetricProvenance => Boolean(source))
        .map((source) => [
          `${source.sourceMetricId}:${source.periodEnd}:${source.sourceUrl ?? ""}`,
          source,
        ]),
    ).values(),
  ];
  const available = value !== null && Number.isFinite(value);
  const confidence = !available
    ? "NOT_ASSESSED"
    : provenance.length >= observationCount * sourceKeys.length
      ? "HIGH"
      : provenance.length > 0
        ? "MODERATE"
        : "LOW";
  return {
    id,
    value: available ? value : null,
    unit,
    periodStart: rows[0]?.periodEnd ?? null,
    periodEnd: rows.at(-1)?.periodEnd ?? null,
    sourceType: available ? "DERIVED" : "UNAVAILABLE",
    basis,
    source: provenance.length
      ? [...new Set(provenance.map((source) => source.source))].join("; ")
      : available
        ? "Normalized financial observations; source references unavailable."
        : "Required financial observations unavailable.",
    provenance,
    confidence,
    completeness: available ? (provenance.length ? "complete" : "partial") : "unavailable",
    observationCount,
  };
}

export function calculateHistoricalTrends(
  rows: readonly FinancialYear[],
): HistoricalTrendMetric[] {
  const metrics: HistoricalTrendMetric[] = [];
  const perYear = (
    id: string,
    unit: HistoricalTrendMetric["unit"],
    getValue: (row: FinancialYear, index: number) => number | null,
    sourceKeys: Array<keyof NonNullable<FinancialYear["provenance"]>>,
    basis: string,
  ) => {
    rows.forEach((row, index) => {
      metrics.push(
        trendMetric(
          `${id}:${row.fiscalYear}`,
          getValue(row, index),
          unit,
          [row],
          basis,
          sourceKeys,
          1,
        ),
      );
    });
  };
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    const hasConsecutiveYear =
      previous !== undefined && previous.fiscalYear === row.fiscalYear - 1;
    metrics.push(
      trendMetric(
        `revenueYoYGrowth:${row.fiscalYear}`,
        row.revenueGrowth,
        "percent",
        hasConsecutiveYear ? [previous, row] : [row],
        "Current-year revenue / prior-year revenue - 1; only consecutive fiscal years.",
        ["revenue"],
        hasConsecutiveYear ? 2 : 1,
      ),
    );
  });
  perYear("ebitdaMargin", "percent", (row) => row.ebitdaMargin, ["ebitda", "revenue"], "EBITDA / revenue for the same fiscal year.");
  perYear("ebitMargin", "percent", (row) => row.ebitMargin, ["ebit", "revenue"], "EBIT / revenue for the same fiscal year.");
  perYear("netMargin", "percent", (row) => row.netMargin, ["netIncome", "revenue"], "Net income / revenue for the same fiscal year.");
  perYear("effectiveTaxRate", "percent", (row) => row.taxRate, ["incomeTaxExpense", "profitBeforeTax"], "Income tax expense / profit before tax; values outside 0–100% are unavailable.");
  perYear("capexToRevenue", "percent", (row) => ratio(row.capex, row.revenue), ["capex", "revenue"], "Capital expenditure / revenue for the same fiscal year.");
  perYear("depreciationToRevenue", "percent", (row) => ratio(row.depreciation, row.revenue), ["depreciation", "revenue"], "Depreciation and amortization / revenue for the same fiscal year.");
  perYear("workingCapitalToRevenue", "percent", (row) => ratio(row.workingCapital, row.revenue), ["workingCapital", "revenue"], "Reported net working capital / revenue for the same fiscal year.");
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    const comparablePrevious =
      previous && previous.fiscalYear === row.fiscalYear - 1
        ? previous
        : undefined;
    const equityAverage =
      comparablePrevious?.equity !== null &&
      comparablePrevious?.equity !== undefined &&
      row.equity !== null
        ? (comparablePrevious.equity + row.equity) / 2
        : null;
    metrics.push(
      trendMetric(
        `roe:${row.fiscalYear}`,
        ratio(row.netIncome, equityAverage),
        "percent",
        comparablePrevious ? [comparablePrevious, row] : [row],
        "Net income / average beginning- and ending-period shareholders' equity; requires consecutive annual equity balances.",
        ["netIncome", "equity"],
        comparablePrevious ? 2 : 1,
      ),
    );
    const investedCapital = (period: FinancialYear) =>
      period.debt !== null && period.equity !== null && period.cash !== null
        ? period.debt + period.equity - period.cash
        : null;
    const currentInvestedCapital = investedCapital(row);
    const priorInvestedCapital = comparablePrevious
      ? investedCapital(comparablePrevious)
      : null;
    const averageInvestedCapital =
      currentInvestedCapital !== null && priorInvestedCapital !== null
        ? (currentInvestedCapital + priorInvestedCapital) / 2
        : null;
    const nopat =
      row.ebit !== null && row.taxRate !== null
        ? row.ebit * (1 - row.taxRate)
        : null;
    metrics.push(
      trendMetric(
        `roic:${row.fiscalYear}`,
        ratio(nopat, averageInvestedCapital),
        "percent",
        comparablePrevious ? [comparablePrevious, row] : [row],
        "NOPAT / average beginning- and ending-period invested capital, where invested capital = debt + equity - cash; requires consecutive annual balances.",
        ["ebit", "incomeTaxExpense", "profitBeforeTax", "debt", "equity", "cash"],
        comparablePrevious ? 2 : 1,
      ),
    );
  });

  const completeRows = [...rows]
    .sort((left, right) => left.fiscalYear - right.fiscalYear)
    .slice(-5);
  const contiguous =
    completeRows.length >= 3 &&
    completeRows.every(
      (row, index) =>
        index === 0 ||
        row.fiscalYear === completeRows[index - 1]!.fiscalYear + 1,
    );
  const first = completeRows[0];
  const last = completeRows.at(-1);
  const revenueCagr =
    contiguous && first && last
      ? calculateCagr(first.revenue, last.revenue, last.fiscalYear - first.fiscalYear)
      : null;
  metrics.push(
    trendMetric(
      "revenueCagr",
      revenueCagr,
      "percent",
      completeRows,
      "Geometric revenue CAGR over up to five consecutive annual fiscal years; historical reference, not a perpetual growth assumption.",
      ["revenue"],
      completeRows.length,
    ),
  );
  return metrics;
}

export function setUserProvidedAssumption(
  assumption: ValuationAssumption,
  value: number,
  rationale: string,
): ValuationAssumption {
  if (!Number.isFinite(value)) {
    throw new RangeError("User-provided valuation assumptions must be finite numbers.");
  }
  return {
    value,
    source: "user_provided",
    sourceType: "USER_PROVIDED",
    confidence: "NOT_ASSESSED",
    editable: true,
    sourceDescription: "Explicit analyst-provided input.",
    provenance: [],
    basis: "analyst_override",
    method: "explicit_analyst_override",
    rationale,
  };
}
