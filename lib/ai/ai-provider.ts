import type { EquityAnalysis } from "@/lib/types/financial";

export interface AIProvider {
  readonly modelName: string;
  analyzeEquityResearch(context: string): Promise<EquityAnalysis>;
}
