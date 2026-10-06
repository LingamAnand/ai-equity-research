import { GeminiProviderError } from "./gemini-errors.ts";
import type { EquityAnalysis } from "../types/financial.ts";

const analysisFields = [
  "executiveSummary",
  "businessQuality",
  "financialStrength",
  "growthDrivers",
  "keyRisks",
  "valuationObservation",
  "catalysts",
  "redFlags",
  "researchQuestions",
  "dataLimitations",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  value: Record<string, unknown>,
  field: (typeof analysisFields)[number],
): string {
  const result = value[field];
  if (typeof result !== "string" || result.length > 3000) {
    throw new GeminiProviderError(
      `Gemini returned an invalid analysis field: ${field}`,
      "invalid_response",
    );
  }
  return result;
}

function requireStringArray(
  value: Record<string, unknown>,
  field: (typeof analysisFields)[number],
): string[] {
  const result = value[field];
  if (
    !Array.isArray(result) ||
    result.length > 12 ||
    result.some(
      (entry) => typeof entry !== "string" || entry.length > 1000,
    )
  ) {
    throw new GeminiProviderError(
      `Gemini returned an invalid list for: ${field}`,
      "invalid_response",
    );
  }
  return result;
}

export function parseGeminiAnalysis(text: string): EquityAnalysis {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new GeminiProviderError(
      "Gemini returned invalid JSON.",
      "invalid_response",
    );
  }

  if (!isRecord(value)) {
    throw new GeminiProviderError(
      "Gemini returned an invalid analysis structure.",
      "invalid_response",
    );
  }
  if (!analysisFields.every((field) => field in value)) {
    throw new GeminiProviderError(
      "Gemini returned an invalid analysis structure.",
      "invalid_response",
    );
  }

  return {
    executiveSummary: requireString(value, "executiveSummary"),
    businessQuality: requireString(value, "businessQuality"),
    financialStrength: requireString(value, "financialStrength"),
    growthDrivers: requireStringArray(value, "growthDrivers"),
    keyRisks: requireStringArray(value, "keyRisks"),
    valuationObservation: requireString(value, "valuationObservation"),
    catalysts: requireStringArray(value, "catalysts"),
    redFlags: requireStringArray(value, "redFlags"),
    researchQuestions: requireStringArray(value, "researchQuestions"),
    dataLimitations: requireStringArray(value, "dataLimitations"),
  };
}
