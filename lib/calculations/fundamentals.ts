import type {
  FundamentalCalculationInput,
  FundamentalMetric,
  FundamentalPeriod,
  FundamentalProvenance,
  FundamentalSource,
  FundamentalsHistory,
} from "@/lib/types/fundamentals";

export class FundamentalsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FundamentalsValidationError";
  }
}

export class ConflictingFundamentalsError extends Error {
  readonly metricId: string;

  constructor(metricId: string) {
    super(`Conflicting official source values found for ${metricId}.`);
    this.name = "ConflictingFundamentalsError";
    this.metricId = metricId;
  }
}

export function validateFundamentalProvenance(
  provenance: FundamentalProvenance,
  metricId: string,
): void {
  if (
    !provenance.source.trim() ||
    !provenance.sourceUrl.trim() ||
    !provenance.publicationDate.trim() ||
    !provenance.retrievedAt.trim() ||
    !provenance.pageReference.trim() ||
    !provenance.sectionReference.trim()
  ) {
    throw new FundamentalsValidationError(
      `Source provenance is incomplete for ${metricId}.`,
    );
  }

  const expectedCurrency =
    provenance.unit === "INR_CRORE" ||
    provenance.unit === "INR_BILLION" ||
    provenance.unit === "INR_PER_SHARE"
      ? "INR"
      : provenance.unit === "USD_MILLION" ||
          provenance.unit === "USD_BILLION" ||
          provenance.unit === "USD_PER_SHARE"
        ? "USD"
        : null;
  if (provenance.currency !== expectedCurrency) {
    throw new FundamentalsValidationError(
      `Unit and currency metadata are inconsistent for ${metricId}.`,
    );
  }

  if (
    provenance.sourceType === "official_company_filing" &&
    provenance.sourceId === null
  ) {
    throw new FundamentalsValidationError(
      `Official source reference is missing for ${metricId}.`,
    );
  }

  if (provenance.sourceType === "calculated" && provenance.sourceId !== null) {
    throw new FundamentalsValidationError(
      `Calculated metric ${metricId} cannot claim an official source id.`,
    );
  }
}

export function unavailableMetric(
  id: string,
  periodId: string,
  provenance: FundamentalProvenance,
  reason: string,
): FundamentalMetric {
  if (!reason.trim()) {
    throw new FundamentalsValidationError(
      `Unavailable metric ${id} must include a reason.`,
    );
  }

  validateFundamentalProvenance(provenance, id);
  return { id, periodId, value: null, status: "unavailable", provenance, reason };
}

export function reportedMetric(
  id: string,
  periodId: string,
  value: number | null | undefined,
  provenance: FundamentalProvenance,
  missingReason = "This metric was not available in the cited disclosure.",
): FundamentalMetric {
  if (value === null || value === undefined) {
    return unavailableMetric(id, periodId, provenance, missingReason);
  }

  if (!Number.isFinite(value)) {
    throw new FundamentalsValidationError(
      `Reported value for ${id} must be a finite number.`,
    );
  }

  validateFundamentalProvenance(provenance, id);
  return { id, periodId, value, status: "reported", provenance };
}

function samePeriod(left: FundamentalPeriod, right: FundamentalPeriod): boolean {
  return (
    left.periodType === right.periodType &&
    left.periodStart === right.periodStart &&
    left.periodEnd === right.periodEnd &&
    left.comparisonGroup === right.comparisonGroup
  );
}

function sameReportingBasis(
  left: FundamentalProvenance,
  right: FundamentalProvenance,
  metricId: string,
): void {
  if (left.reportingBasis !== right.reportingBasis) {
    throw new FundamentalsValidationError(
      `Calculation inputs for ${metricId} must use the same reporting basis.`,
    );
  }
}

export function resolveReportedMetric(
  id: string,
  candidates: FundamentalMetric[],
): FundamentalMetric {
  if (candidates.length === 0) {
    throw new FundamentalsValidationError(
      `At least one source candidate is required for ${id}.`,
    );
  }

  if (
    candidates.some(
      (candidate) => candidate.id !== id || candidate.status === "calculated",
    )
  ) {
    throw new FundamentalsValidationError(
      `All source candidates must be reported or unavailable values for ${id}.`,
    );
  }

  const available = candidates.filter(
    (candidate) => candidate.status === "reported",
  );

  if (available.length === 0) {
    return candidates[0];
  }

  const reference = available[0];

  for (const candidate of available.slice(1)) {
    if (
      candidate.periodId !== reference.periodId ||
      candidate.provenance.unit !== reference.provenance.unit ||
      candidate.provenance.currency !== reference.provenance.currency ||
      candidate.provenance.reportingBasis !==
        reference.provenance.reportingBasis ||
      !samePeriod(candidate.provenance.period, reference.provenance.period) ||
      candidate.value !== reference.value
    ) {
      throw new ConflictingFundamentalsError(id);
    }
  }

  return reference;
}

function validatedCalculationInputs(
  id: string,
  inputMetrics: FundamentalMetric[],
): FundamentalCalculationInput[] {
  return inputMetrics.map((metric) => {
    if (metric.status === "unavailable") {
      throw new FundamentalsValidationError(
        `Calculated value for ${id} cannot include unavailable input ${metric.id}.`,
      );
    }

    validateFundamentalProvenance(metric.provenance, metric.id);
    return {
      id: metric.id,
      periodId: metric.periodId,
      value: metric.value,
      provenance: metric.provenance,
    };
  });
}

function calculatedMetric(
  id: string,
  periodId: string,
  value: number,
  provenance: FundamentalProvenance,
  formula: string,
  inputMetrics: FundamentalMetric[],
): FundamentalMetric {
  if (!Number.isFinite(value)) {
    throw new FundamentalsValidationError(
      `Calculated value for ${id} must be a finite number.`,
    );
  }

  validateFundamentalProvenance(provenance, id);
  const inputs = validatedCalculationInputs(id, inputMetrics);

  return {
    id,
    periodId,
    value,
    status: "calculated",
    provenance,
    formula,
    inputMetricIds: inputs.map(
      (input) => `${input.id}@${input.periodId}`,
    ),
    inputs,
    calculatedAt: new Date().toISOString(),
  };
}

export function calculateDifference(
  id: string,
  periodId: string,
  minuend: FundamentalMetric,
  subtrahend: FundamentalMetric,
  provenance: FundamentalProvenance,
): FundamentalMetric {
  if (minuend.status === "unavailable" || subtrahend.status === "unavailable") {
    return unavailableMetric(
      id,
      periodId,
      provenance,
      "The difference cannot be calculated because an input is unavailable.",
    );
  }

  sameReportingBasis(minuend.provenance, subtrahend.provenance, id);
  if (
    minuend.provenance.unit !== subtrahend.provenance.unit ||
    minuend.provenance.currency !== subtrahend.provenance.currency
  ) {
    throw new FundamentalsValidationError(
      `Difference inputs for ${id} must use matching units and currency.`,
    );
  }

  if (!samePeriod(minuend.provenance.period, subtrahend.provenance.period)) {
    throw new FundamentalsValidationError(
      `Difference inputs for ${id} must cover the same reporting period.`,
    );
  }

  return calculatedMetric(
    id,
    periodId,
    minuend.value - subtrahend.value,
    provenance,
    "minuend - subtrahend",
    [minuend, subtrahend],
  );
}

function utcDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function sameMonthAndDay(left: string, right: string): boolean {
  const leftDate = utcDate(left);
  const rightDate = utcDate(right);

  return Boolean(
    leftDate &&
      rightDate &&
      leftDate.getUTCMonth() === rightDate.getUTCMonth() &&
      leftDate.getUTCDate() === rightDate.getUTCDate(),
  );
}

function isYearOverYearComparable(
  current: FundamentalPeriod,
  previous: FundamentalPeriod,
): boolean {
  if (
    current.periodType !== previous.periodType ||
    current.comparisonGroup !== previous.comparisonGroup
  ) {
    return false;
  }

  const currentEnd = utcDate(current.periodEnd);
  const previousEnd = utcDate(previous.periodEnd);
  if (
    !currentEnd ||
    !previousEnd ||
    currentEnd.getUTCFullYear() - previousEnd.getUTCFullYear() !== 1 ||
    !sameMonthAndDay(current.periodEnd, previous.periodEnd)
  ) {
    return false;
  }

  if (current.periodType === "instant") {
    return current.periodStart === null && previous.periodStart === null;
  }

  if (!current.periodStart || !previous.periodStart) {
    return false;
  }

  if (current.periodType === "quarterly") {
    return sameMonthAndDay(current.periodStart, previous.periodStart);
  }

  const currentStart = utcDate(current.periodStart);
  const previousStart = utcDate(previous.periodStart);
  return Boolean(
    currentStart &&
      previousStart &&
      currentStart.getUTCFullYear() - previousStart.getUTCFullYear() === 1 &&
      sameMonthAndDay(current.periodStart, previous.periodStart),
  );
}

function amountInComparableUnits(metric: FundamentalMetric): number {
  if (metric.status === "unavailable") {
    throw new FundamentalsValidationError(
      `Cannot convert unavailable metric ${metric.id}.`,
    );
  }

  if (metric.provenance.currency !== "INR" && metric.provenance.currency !== "USD") {
    throw new FundamentalsValidationError(
      `Metric ${metric.id} does not use a supported currency.`,
    );
  }

  switch (metric.provenance.unit) {
    case "INR_CRORE":
      return metric.value;
    case "INR_BILLION":
      return metric.value * 100;
    case "USD_MILLION":
      return metric.value / 1000;
    case "USD_BILLION":
      return metric.value;
    default:
      throw new FundamentalsValidationError(
        `Growth inputs for ${metric.id} must use supported currency amount units.`,
      );
  }
}

function growthValues(
  current: FundamentalMetric,
  previous: FundamentalMetric,
): { current: number; previous: number; conversionNote: string } {
  if (current.status === "unavailable" || previous.status === "unavailable") {
    throw new FundamentalsValidationError(
      "Cannot calculate growth using an unavailable value.",
    );
  }

  if (
    current.provenance.unit === previous.provenance.unit &&
    current.provenance.currency === previous.provenance.currency
  ) {
    return {
      current: current.value,
      previous: previous.value,
      conversionNote: "",
    };
  }

  if (current.provenance.currency !== previous.provenance.currency) {
    throw new FundamentalsValidationError(
      "Growth inputs must use the same currency.",
    );
  }
  const currentInComparableUnits = amountInComparableUnits(current);
  const previousInComparableUnits = amountInComparableUnits(previous);
  return {
    current: currentInComparableUnits,
    previous: previousInComparableUnits,
    conversionNote:
      current.provenance.currency === "INR"
        ? "; INR billion inputs converted to INR crore at 1 billion = 100 crore"
        : "; USD million inputs converted to USD billion",
  };
}

export function calculateGrowth(
  id: string,
  current: FundamentalMetric,
  previous: FundamentalMetric,
  provenance: FundamentalProvenance,
): FundamentalMetric {
  if (current.status === "unavailable" || previous.status === "unavailable") {
    return unavailableMetric(
      id,
      current.periodId,
      provenance,
      "Growth cannot be calculated because an input is unavailable.",
    );
  }

  sameReportingBasis(current.provenance, previous.provenance, id);
  if (
    current.provenance.period.comparisonGroup !==
    previous.provenance.period.comparisonGroup
  ) {
    return unavailableMetric(
      id,
      current.periodId,
      provenance,
      "Growth cannot be calculated because the source identifies these periods as structurally non-comparable.",
    );
  }
  if (
    !isYearOverYearComparable(
      current.provenance.period,
      previous.provenance.period,
    )
  ) {
    throw new FundamentalsValidationError(
      `Growth inputs for ${id} must cover matching periods one year apart (${current.provenance.period.label}: ${current.provenance.period.periodStart ?? "instant"} to ${current.provenance.period.periodEnd}; ${previous.provenance.period.label}: ${previous.provenance.period.periodStart ?? "instant"} to ${previous.provenance.period.periodEnd}).`,
    );
  }

  if (previous.value === 0) {
    return unavailableMetric(
      id,
      current.periodId,
      provenance,
      "Growth is undefined because the comparison-period value is zero.",
    );
  }

  const values = growthValues(current, previous);
  return calculatedMetric(
    id,
    current.periodId,
    ((values.current - values.previous) / Math.abs(values.previous)) * 100,
    provenance,
    `(current value - comparable prior-year value) / abs(comparable prior-year value) * 100${values.conversionNote}`,
    [current, previous],
  );
}

export function calculateCagr(
  id: string,
  annualMetrics: FundamentalMetric[],
  provenance: FundamentalProvenance,
): FundamentalMetric {
  if (annualMetrics.length < 2) {
    return unavailableMetric(
      id,
      provenance.period.id,
      provenance,
      "CAGR requires at least two comparable annual observations.",
    );
  }

  const unavailable = annualMetrics.find(
    (metric) => metric.status === "unavailable",
  );
  if (unavailable) {
    return unavailableMetric(
      id,
      provenance.period.id,
      provenance,
      `CAGR cannot be calculated because ${unavailable.id} for ${unavailable.provenance.period.label} is unavailable.`,
    );
  }

  const first = annualMetrics[0];
  const last = annualMetrics[annualMetrics.length - 1];
  if (
    !first ||
    !last ||
    first.status === "unavailable" ||
    last.status === "unavailable"
  ) {
    return unavailableMetric(
      id,
      provenance.period.id,
      provenance,
      "CAGR requires comparable annual observations.",
    );
  }

  const conversionNotes = new Set<string>();
  for (let index = 0; index < annualMetrics.length; index += 1) {
    const metric = annualMetrics[index];
    if (!metric || metric.status === "unavailable") {
      return unavailableMetric(
        id,
        provenance.period.id,
        provenance,
        "CAGR requires available annual observations.",
      );
    }
    if (metric.provenance.period.periodType !== "annual") {
      throw new FundamentalsValidationError(
        `CAGR inputs for ${id} must all be annual periods.`,
      );
    }
    if (index > 0) {
      const previous = annualMetrics[index - 1];
      if (!previous) {
        throw new FundamentalsValidationError(
          `CAGR inputs for ${id} are missing an annual period.`,
        );
      }
      const year = utcDate(metric.provenance.period.periodEnd)?.getUTCFullYear();
      const previousYear = utcDate(
        previous.provenance.period.periodEnd,
      )?.getUTCFullYear();
      if (
        !year ||
        !previousYear ||
        year - previousYear !== 1 ||
        metric.provenance.period.comparisonGroup !==
          previous.provenance.period.comparisonGroup
      ) {
        throw new FundamentalsValidationError(
          `CAGR inputs for ${id} must be consecutive annual periods.`,
        );
      }
    }
    sameReportingBasis(first.provenance, metric.provenance, id);
    const normalized = growthValues(first, metric);
    if (normalized.conversionNote) {
      conversionNotes.add(normalized.conversionNote);
    }
  }

  if (first.value <= 0 || last.value <= 0) {
    return unavailableMetric(
      id,
      provenance.period.id,
      provenance,
      "CAGR is unavailable when the first or last annual value is not positive.",
    );
  }

  const firstYear = utcDate(first.provenance.period.periodEnd)?.getUTCFullYear();
  const lastYear = utcDate(last.provenance.period.periodEnd)?.getUTCFullYear();
  if (!firstYear || !lastYear || lastYear <= firstYear) {
    throw new FundamentalsValidationError(
      `CAGR inputs for ${id} do not span a valid time interval.`,
    );
  }
  const years = lastYear - firstYear;
  const normalized = growthValues(last, first);

  return calculatedMetric(
    id,
    provenance.period.id,
    ((normalized.current / normalized.previous) ** (1 / years) - 1) * 100,
    provenance,
    `(last annual value / first annual value) ^ (1 / ${years}) - 1, multiplied by 100${[...conversionNotes, normalized.conversionNote].filter(Boolean).join("")}`,
    annualMetrics,
  );
}

function isExpectedOpeningClosingPair(
  period: FundamentalPeriod,
  opening: FundamentalPeriod,
  closing: FundamentalPeriod,
): boolean {
  if (
    period.periodType === "instant" ||
    !period.periodStart ||
    opening.periodType !== "instant" ||
    closing.periodType !== "instant" ||
    opening.periodStart !== null ||
    closing.periodStart !== null
  ) {
    return false;
  }

  const start = utcDate(period.periodStart);
  if (!start) {
    return false;
  }

  const openingDate = new Date(start.valueOf() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    opening.periodEnd === openingDate &&
    closing.periodEnd === period.periodEnd
  );
}

function calculateReturnOnAverageBalance(
  id: string,
  periodId: string,
  profitAfterTax: FundamentalMetric,
  openingNetWorth: FundamentalMetric,
  closingNetWorth: FundamentalMetric,
  provenance: FundamentalProvenance,
  ratioName: "ROE" | "ROA",
  balanceName: "net worth" | "total assets",
): FundamentalMetric {
  if (
    profitAfterTax.status === "unavailable" ||
    openingNetWorth.status === "unavailable" ||
    closingNetWorth.status === "unavailable"
  ) {
    return unavailableMetric(
      id,
      periodId,
      provenance,
      `${ratioName} cannot be calculated because an input is unavailable.`,
    );
  }

  sameReportingBasis(profitAfterTax.provenance, openingNetWorth.provenance, id);
  sameReportingBasis(profitAfterTax.provenance, closingNetWorth.provenance, id);

  if (
    !["INR_CRORE", "INR_BILLION"].includes(profitAfterTax.provenance.unit) ||
    !["INR_CRORE", "INR_BILLION"].includes(openingNetWorth.provenance.unit) ||
    !["INR_CRORE", "INR_BILLION"].includes(closingNetWorth.provenance.unit) ||
    profitAfterTax.provenance.currency !== "INR" ||
    openingNetWorth.provenance.currency !== "INR" ||
    closingNetWorth.provenance.currency !== "INR"
  ) {
    throw new FundamentalsValidationError(
      `${ratioName} inputs must be INR currency amounts.`,
    );
  }

  const period = profitAfterTax.provenance.period;
  if (
    !isExpectedOpeningClosingPair(
      period,
      openingNetWorth.provenance.period,
      closingNetWorth.provenance.period,
    )
  ) {
    throw new FundamentalsValidationError(
      `${ratioName} inputs must cover the flow period and its opening and closing ${balanceName}.`,
    );
  }

  const profit = amountInCrore(profitAfterTax);
  const opening = amountInCrore(openingNetWorth);
  const closing = amountInCrore(closingNetWorth);
  const averageNetWorth = (opening + closing) / 2;

  if (averageNetWorth <= 0) {
    return unavailableMetric(
      id,
      periodId,
      provenance,
      `${ratioName} is undefined because average ${balanceName} is not positive.`,
    );
  }

  const annualizationFactor = period.periodType === "quarterly" ? 4 : 1;
  const conversionNote =
    "; INR billion inputs converted to INR crore at 1 billion = 100 crore";

  return calculatedMetric(
    id,
    periodId,
    (profit / averageNetWorth) * annualizationFactor * 100,
    provenance,
    `profit after tax / average opening and closing ${balanceName} * ${annualizationFactor} * 100${conversionNote}`,
    [profitAfterTax, openingNetWorth, closingNetWorth],
  );
}

export function calculateRoe(
  id: string,
  periodId: string,
  profitAfterTax: FundamentalMetric,
  openingNetWorth: FundamentalMetric,
  closingNetWorth: FundamentalMetric,
  provenance: FundamentalProvenance,
): FundamentalMetric {
  return calculateReturnOnAverageBalance(
    id,
    periodId,
    profitAfterTax,
    openingNetWorth,
    closingNetWorth,
    provenance,
    "ROE",
    "net worth",
  );
}

export function calculateRoa(
  id: string,
  periodId: string,
  profitAfterTax: FundamentalMetric,
  openingTotalAssets: FundamentalMetric,
  closingTotalAssets: FundamentalMetric,
  provenance: FundamentalProvenance,
): FundamentalMetric {
  return calculateReturnOnAverageBalance(
    id,
    periodId,
    profitAfterTax,
    openingTotalAssets,
    closingTotalAssets,
    provenance,
    "ROA",
    "total assets",
  );
}

function validateMetric(
  metric: FundamentalMetric,
  period: FundamentalsHistory["periods"][number],
  sourcesById: Map<string, FundamentalSource>,
): void {
  validateFundamentalProvenance(metric.provenance, metric.id);

  if (metric.periodId !== period.id) {
    throw new FundamentalsValidationError(
      `Metric ${metric.id} is attached to the wrong reporting period.`,
    );
  }

  if (metric.provenance.reportingBasis !== period.reportingBasis) {
    throw new FundamentalsValidationError(
      `Metric ${metric.id} uses a different reporting basis from its period.`,
    );
  }

  const observationPeriod = metric.provenance.period;
  if (
    observationPeriod.periodType === "instant"
      ? Date.parse(`${observationPeriod.periodEnd}T00:00:00.000Z`) <
          Date.parse(`${period.periodEnd}T00:00:00.000Z`) ||
        Date.parse(`${observationPeriod.periodEnd}T00:00:00.000Z`) >
          Date.parse(`${period.periodEnd}T00:00:00.000Z`) +
            120 * 24 * 60 * 60 * 1000
      : observationPeriod.periodType !== period.periodType ||
        observationPeriod.periodStart !== period.periodStart ||
        observationPeriod.periodEnd !== period.periodEnd
  ) {
    throw new FundamentalsValidationError(
      `Metric ${metric.id} has a reporting period inconsistent with ${period.label}.`,
    );
  }

  if (metric.status === "unavailable") {
    if (metric.value !== null || !metric.reason.trim()) {
      throw new FundamentalsValidationError(
        `Unavailable metric ${metric.id} must have a null value and a reason.`,
      );
    }
    return;
  }

  if (!Number.isFinite(metric.value)) {
    throw new FundamentalsValidationError(
      `Metric ${metric.id} must have a finite value.`,
    );
  }

  if (metric.status === "reported") {
    if (
      metric.formula !== undefined ||
      metric.inputs !== undefined ||
      metric.inputMetricIds !== undefined
    ) {
      throw new FundamentalsValidationError(
        `Reported metric ${metric.id} cannot include calculation metadata.`,
      );
    }
    const source = metric.provenance.sourceId
      ? sourcesById.get(metric.provenance.sourceId)
      : undefined;
    if (
      !source ||
      source.sourceUrl !== metric.provenance.sourceUrl ||
      source.reportingBasis !== metric.provenance.reportingBasis
    ) {
      throw new FundamentalsValidationError(
        `Official source metadata is inconsistent for ${metric.id}.`,
      );
    }
    return;
  }

  if (
    !metric.formula?.trim() ||
    !metric.inputs?.length ||
    !metric.inputMetricIds?.length ||
    !metric.calculatedAt.trim() ||
    Number.isNaN(Date.parse(metric.calculatedAt)) ||
    metric.inputs.length !== metric.inputMetricIds.length ||
    metric.inputs.some(
      (input, index) =>
        input.id !== metric.inputMetricIds?.[index]?.split("@")[0] ||
        `${input.id}@${input.periodId}` !== metric.inputMetricIds?.[index] ||
        !Number.isFinite(input.value),
    )
  ) {
    throw new FundamentalsValidationError(
      `Calculated metric ${metric.id} must include a formula and valid input references.`,
    );
  }
}

function validateCategory(
  metrics: FundamentalMetric[],
  periods: FundamentalsHistory["periods"],
  sourcesById: Map<string, FundamentalSource>,
  categoryName: string,
): void {
  const periodsById = new Map(periods.map((period) => [period.id, period]));
  const seen = new Set<string>();

  for (const metric of metrics) {
    const key = `${metric.periodId}:${metric.id}`;
    if (seen.has(key)) {
      throw new FundamentalsValidationError(
        `Duplicate ${categoryName} metric ${metric.id} for ${metric.periodId}.`,
      );
    }
    seen.add(key);

    const period = periodsById.get(metric.periodId);
    if (!period) {
      throw new FundamentalsValidationError(
        `Metric ${metric.id} refers to an unknown reporting period.`,
      );
    }
    validateMetric(metric, period, sourcesById);
  }
}

export function validateFundamentalsHistory(
  history: FundamentalsHistory,
): void {
  const periodIds = new Set<string>();
  const periodDefinitions = new Set<string>();
  for (const period of history.periods) {
    const identity = [
      period.periodType,
      period.periodStart,
      period.periodEnd,
      period.reportingBasis,
    ].join(":");
    if (periodIds.has(period.id) || periodDefinitions.has(identity)) {
      throw new FundamentalsValidationError(
        `Duplicate reporting period ${period.label}.`,
      );
    }
    periodIds.add(period.id);
    periodDefinitions.add(identity);
  }

  const sourcesById = new Map<string, FundamentalSource>();
  for (const source of history.provenance) {
    if (
      !source.id.trim() ||
      !source.source.trim() ||
      !source.sourceUrl.trim() ||
      !source.publicationDate.trim() ||
      !source.retrievedAt.trim() ||
      source.sourceType !== "official_company_filing"
    ) {
      throw new FundamentalsValidationError(
        "Fundamentals source metadata is incomplete.",
      );
    }
    if (sourcesById.has(source.id)) {
      throw new FundamentalsValidationError(
        `Duplicate source metadata ${source.id}.`,
      );
    }
    sourcesById.set(source.id, source);
  }

  if (
    history.company.companyType === "FINANCIAL_INSTITUTION" &&
    history.company.reportingBasis !== "standalone"
  ) {
    throw new FundamentalsValidationError(
      "Financial-institution fundamentals must declare standalone reporting for this provider.",
    );
  }
  if (
    history.periods.some(
      (period) => period.reportingBasis !== history.company.reportingBasis,
    )
  ) {
    throw new FundamentalsValidationError(
      "Reporting periods must match the company's declared reporting basis.",
    );
  }

  validateCategory(history.financials, history.periods, sourcesById, "financial");
  validateCategory(history.bankMetrics, history.periods, sourcesById, "bank");
  validateCategory(history.growthMetrics, history.periods, sourcesById, "growth");
}
