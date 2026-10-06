import { calculateFcffDcf } from "./dcf.ts";
import type {
  FinancialYear,
  ForecastAssumptions,
  SensitivityMatrix,
} from "../types/valuation.ts";

const SENSITIVITY_OFFSETS = [-0.02, -0.01, 0, 0.01, 0.02] as const;

export function calculateDcfSensitivity(
  rows: readonly FinancialYear[],
  assumptions: ForecastAssumptions,
  currentPrice: number | null,
): SensitivityMatrix {
  const wacc = assumptions.wacc.value;
  const terminalGrowth = assumptions.terminalGrowth.value;
  if (wacc === null || terminalGrowth === null) {
    return {
      status: "insufficient_data",
      waccValues: [],
      terminalGrowthValues: [],
      cells: [],
      basis: "System-derived ±1% and ±2% absolute rate increments around supplied base assumptions.",
      reason: "A valid base WACC and terminal growth assumption are required.",
    };
  }
  const baseline = calculateFcffDcf(rows, assumptions, currentPrice);
  if (baseline.status !== "available") {
    return {
      status: "insufficient_data",
      waccValues: [],
      terminalGrowthValues: [],
      cells: [],
      basis: "System-derived ±1% and ±2% absolute rate increments around supplied base assumptions.",
      reason:
        baseline.status === "insufficient_data"
          ? `Base valuation requires: ${baseline.missingInputs.join(", ")}.`
          : `Base valuation assumptions are invalid: ${baseline.errors.join(", ")}.`,
    };
  }

  const waccValues = SENSITIVITY_OFFSETS.map((offset) => wacc + offset);
  const terminalGrowthValues = SENSITIVITY_OFFSETS.map((offset) =>
    Math.max(0, terminalGrowth + offset),
  );
  const cells = waccValues.map((sensitivityWacc) =>
    terminalGrowthValues.map((sensitivityGrowth) => {
      if (sensitivityWacc <= sensitivityGrowth) {
        return {
          wacc: sensitivityWacc,
          terminalGrowth: sensitivityGrowth,
          status: "invalid" as const,
          intrinsicValuePerShare: null,
          reason: "WACC must be greater than terminal growth.",
        };
      }
      const result = calculateFcffDcf(
        rows,
        {
          ...assumptions,
          wacc: {
            value: sensitivityWacc,
            source: "derived",
            sourceType: "DERIVED",
            confidence: assumptions.wacc.confidence,
            editable: false,
            sourceDescription: "Sensitivity point calculated from the supplied base WACC.",
            provenance: assumptions.wacc.provenance,
            basis: "system_derived",
            method: "sensitivity_grid_rate_offset",
            rationale: "Sensitivity point around the supplied base WACC.",
          },
          terminalGrowth: {
            value: sensitivityGrowth,
            source: "derived",
            sourceType: "DERIVED",
            confidence: assumptions.terminalGrowth.confidence,
            editable: false,
            sourceDescription: "Sensitivity point calculated from the supplied base terminal growth.",
            provenance: assumptions.terminalGrowth.provenance,
            basis: "system_derived",
            method: "sensitivity_grid_rate_offset",
            rationale:
              "Sensitivity point around the supplied base terminal growth.",
          },
        },
        currentPrice,
      );
      return result.status === "available"
        ? {
            wacc: sensitivityWacc,
            terminalGrowth: sensitivityGrowth,
            status: "available" as const,
            intrinsicValuePerShare: result.valuePerShare,
            reason: null,
          }
        : {
            wacc: sensitivityWacc,
            terminalGrowth: sensitivityGrowth,
            status: "invalid" as const,
            intrinsicValuePerShare: null,
            reason:
              result.status === "invalid"
                ? result.errors.join(", ")
                : result.missingInputs.join(", "),
          };
    }),
  );
  return {
    status: "available",
    waccValues,
    terminalGrowthValues,
    cells,
    basis: "System-derived ±1% and ±2% absolute rate increments around supplied base assumptions; no base assumption is inferred from this grid.",
    reason: null,
  };
}
