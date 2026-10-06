import type { WaccInputs, WaccResult } from "../types/valuation.ts";

const RATE_LIMITS: Record<string, [number, number]> = {
  riskFreeRate: [0, 1],
  equityRiskPremium: [0, 1],
  costOfDebt: [0, 1],
  taxRate: [0, 1],
};

const REQUIRED_INPUTS = [
  "riskFreeRate",
  "beta",
  "equityRiskPremium",
  "costOfDebt",
  "taxRate",
  "marketCapitalization",
  "debt",
] as const;

export function calculateWacc(inputs: WaccInputs): WaccResult {
  const missingInputs = REQUIRED_INPUTS.filter(
    (key) => inputs[key] === null || inputs[key] === undefined,
  );
  if (missingInputs.length) {
    return {
      status: "insufficient_data",
      missingInputs,
      errors: [],
      assumptions: inputs,
    };
  }

  const errors: string[] = [];
  for (const [key, [minimum, maximum]] of Object.entries(RATE_LIMITS)) {
    const value = inputs[key as keyof WaccInputs] as number;
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      errors.push(`${key} must be between ${minimum} and ${maximum} as a decimal rate.`);
    }
  }
  if (!Number.isFinite(inputs.beta) || inputs.beta! < -5 || inputs.beta! > 5) {
    errors.push("beta must be a finite value between -5 and 5.");
  }
  for (const key of ["marketCapitalization", "debt"] as const) {
    if (!Number.isFinite(inputs[key]) || inputs[key]! < 0) {
      errors.push(`${key} must be a finite non-negative value.`);
    }
  }
  if (inputs.terminalGrowth !== null && inputs.terminalGrowth !== undefined) {
    if (
      !Number.isFinite(inputs.terminalGrowth) ||
      inputs.terminalGrowth < 0 ||
      inputs.terminalGrowth > 1
    ) {
      errors.push("terminalGrowth must be between 0 and 1 as a decimal rate.");
    }
  }
  if (errors.length) {
    return { status: "invalid", missingInputs: [], errors, assumptions: inputs };
  }

  const equity = inputs.marketCapitalization!;
  const debt = inputs.debt!;
  const capital = equity + debt;
  if (!(capital > 0) || !Number.isFinite(capital)) {
    return {
      status: "invalid",
      missingInputs: [],
      errors: ["marketCapitalization plus debt must be greater than zero."],
      assumptions: inputs,
    };
  }

  const equityWeight = equity / capital;
  const debtWeight = debt / capital;
  if (
    !Number.isFinite(equityWeight) ||
    !Number.isFinite(debtWeight) ||
    equityWeight < 0 ||
    debtWeight < 0 ||
    Math.abs(equityWeight + debtWeight - 1) > 1e-10
  ) {
    return {
      status: "invalid",
      missingInputs: [],
      errors: ["Capital weights must be non-negative and sum to one."],
      assumptions: inputs,
    };
  }

  const costOfEquity =
    inputs.riskFreeRate! + inputs.beta! * inputs.equityRiskPremium!;
  const afterTaxCostOfDebt =
    inputs.costOfDebt! * (1 - inputs.taxRate!);
  const wacc =
    equityWeight * costOfEquity + debtWeight * afterTaxCostOfDebt;
  if (
    !Number.isFinite(costOfEquity) ||
    costOfEquity < 0 ||
    costOfEquity > 1 ||
    !Number.isFinite(wacc) ||
    wacc <= 0
  ) {
    return {
      status: "invalid",
      missingInputs: [],
      errors: ["Calculated cost of equity and WACC must be sensible positive rates."],
      assumptions: inputs,
    };
  }
  if (
    inputs.terminalGrowth !== null &&
    inputs.terminalGrowth !== undefined &&
    wacc <= inputs.terminalGrowth
  ) {
    return {
      status: "invalid",
      missingInputs: [],
      errors: ["WACC must be greater than terminal growth."],
      assumptions: inputs,
    };
  }

  return {
    status: "available",
    costOfEquity,
    equityWeight,
    debtWeight,
    afterTaxCostOfDebt,
    wacc,
    assumptions: inputs,
    formula:
      "WACC = E/(D+E) × (Rf + Beta × ERP) + D/(D+E) × Rd × (1 - Tax rate)",
  };
}
