export type ValuationMethodClass =
  | "NON_FINANCIAL"
  | "BANK"
  | "NBFC"
  | "FINANCIAL_SERVICES"
  | "OTHER_FINANCIAL";

export type SectorClassification = ValuationMethodClass;

export type AssumptionSource = "derived" | "user_provided" | "unavailable";
export type ValuationAssumptionSourceType =
  | "OBSERVED"
  | "DERIVED"
  | "USER_PROVIDED"
  | "ASSUMED"
  | "UNAVAILABLE";
export type ValuationConfidence = "HIGH" | "MODERATE" | "LOW" | "NOT_ASSESSED";
export type AssumptionBasis =
  | "historical_derived"
  | "market_derived"
  | "system_derived"
  | "analyst_override"
  | "unavailable";

export interface HistoricalTrendMetric {
  id: string;
  value: number | null;
  unit: "percent" | "currency" | "multiple";
  periodStart: string | null;
  periodEnd: string | null;
  sourceType: "DERIVED" | "UNAVAILABLE";
  basis: string;
  source: string;
  provenance: FinancialMetricProvenance[];
  confidence: ValuationConfidence;
  completeness: "complete" | "partial" | "unavailable";
  observationCount: number;
}

export interface TerminalGrowthGuidance {
  value: number | null;
  sourceType: "DERIVED" | "UNAVAILABLE";
  method: string;
  rationale: string;
  provenance: FinancialMetricProvenance[];
  requiresAnalystConfirmation: true;
}

export interface FinancialMetricProvenance {
  sourceMetricId: string;
  source: string;
  sourceType: "official_company_filing" | "market_data" | "calculated";
  sourceUrl: string | null;
  periodEnd: string;
  publicationDate: string;
  retrievedAt: string;
  unit: string;
  currency: string | null;
  pageReference: string;
  sectionReference: string;
}

export interface FinancialYearInput {
  fiscalYear: number;
  periodEnd: string;
  revenue?: number | null;
  ebitda?: number | null;
  ebit?: number | null;
  netIncome?: number | null;
  profitBeforeTax?: number | null;
  depreciation?: number | null;
  capex?: number | null;
  workingCapital?: number | null;
  changeInWorkingCapital?: number | null;
  cash?: number | null;
  debt?: number | null;
  shortTermDebt?: number | null;
  longTermDebt?: number | null;
  sharesOutstanding?: number | null;
  dilutedShares?: number | null;
  equity?: number | null;
  incomeTaxExpense?: number | null;
  provenance?: Partial<
    Record<
      | "revenue"
      | "revenueGrowth"
      | "ebitda"
      | "ebit"
      | "netIncome"
      | "profitBeforeTax"
      | "depreciation"
      | "capex"
      | "workingCapital"
      | "changeInWorkingCapital"
      | "cash"
      | "debt"
      | "shortTermDebt"
      | "longTermDebt"
      | "sharesOutstanding"
      | "dilutedShares"
      | "equity"
      | "incomeTaxExpense",
      FinancialMetricProvenance
    >
  >;
}

export interface FinancialYear {
  fiscalYear: number;
  periodEnd: string;
  revenue: number | null;
  revenueGrowth: number | null;
  ebitda: number | null;
  ebitdaMargin: number | null;
  ebit: number | null;
  ebitMargin: number | null;
  netIncome: number | null;
  profitBeforeTax: number | null;
  netMargin: number | null;
  depreciation: number | null;
  capex: number | null;
  workingCapital: number | null;
  changeInWorkingCapital: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  cash: number | null;
  debt: number | null;
  sharesOutstanding: number | null;
  dilutedShares: number | null;
  equity: number | null;
  taxRate: number | null;
  provenance: FinancialYearInput["provenance"];
  availability: Record<
    | "revenue"
    | "ebitda"
    | "ebit"
    | "netIncome"
    | "profitBeforeTax"
    | "depreciation"
    | "capex"
    | "workingCapital"
    | "changeInWorkingCapital"
    | "shortTermDebt"
    | "longTermDebt"
    | "cash"
    | "debt"
    | "sharesOutstanding"
    | "dilutedShares"
    | "equity"
    | "taxRate",
    boolean
  >;
}

export interface ValuationAssumption {
  value: number | null;
  source: AssumptionSource;
  sourceType: ValuationAssumptionSourceType;
  confidence: ValuationConfidence;
  editable: boolean;
  sourceDescription: string;
  provenance: FinancialMetricProvenance[];
  basis: AssumptionBasis;
  method: string;
  rationale: string;
}

export interface ForecastYearAssumptions {
  fiscalYear: number;
  revenueGrowth: ValuationAssumption;
  ebitdaMargin: ValuationAssumption;
  ebitMargin: ValuationAssumption;
  taxRate: ValuationAssumption;
  depreciationToRevenue: ValuationAssumption;
  capexToRevenue: ValuationAssumption;
  changeInNwcToRevenue: ValuationAssumption;
}

export interface ForecastAssumptions {
  revenueGrowth: ValuationAssumption;
  ebitdaMargin: ValuationAssumption;
  ebitMargin: ValuationAssumption;
  taxRate: ValuationAssumption;
  depreciationToRevenue: ValuationAssumption;
  capexToRevenue: ValuationAssumption;
  changeInNwcToRevenue: ValuationAssumption;
  terminalGrowth: ValuationAssumption;
  wacc: ValuationAssumption;
  forecastYears: ValuationAssumption;
  annualForecast: ForecastYearAssumptions[];
}

export type ForecastScalarAssumptions = Omit<
  ForecastAssumptions,
  "annualForecast"
>;

export type WaccAssumptionKey =
  | "riskFreeRate"
  | "beta"
  | "equityRiskPremium"
  | "costOfEquity"
  | "preTaxCostOfDebt"
  | "afterTaxCostOfDebt"
  | "equityWeight"
  | "debtWeight"
  | "taxRate"
  | "debt"
  | "equity"
  | "wacc";

export type WaccAssumptionModel = Record<WaccAssumptionKey, ValuationAssumption>;

export interface WaccInputs {
  riskFreeRate: number | null;
  beta: number | null;
  equityRiskPremium: number | null;
  costOfDebt: number | null;
  taxRate: number | null;
  marketCapitalization: number | null;
  debt: number | null;
  terminalGrowth?: number | null;
}

export interface ValuationDataQuality {
  status: "available" | "partial" | "unavailable";
  completeness: number;
  quality: "HIGH" | "MODERATE" | "LOW" | "NOT_ASSESSED";
  rationale: string;
  sourcedMetricCount: number;
  expectedMetricCount: number;
  latestRetrievedAt: string | null;
  sources: FinancialMetricProvenance[];
}

export type WaccResult =
  | {
      status: "available";
      costOfEquity: number;
      equityWeight: number;
      debtWeight: number;
      afterTaxCostOfDebt: number;
      wacc: number;
      assumptions: WaccInputs;
      formula: string;
    }
  | {
      status: "insufficient_data" | "invalid";
      missingInputs: string[];
      errors: string[];
      assumptions: WaccInputs;
    };

export interface ForecastYearBreakdown {
  fiscalYear: number;
  assumptions: ForecastYearAssumptions;
  revenue: number;
  ebitda: number | null;
  ebit: number;
  taxRate: number;
  nopat: number;
  depreciation: number;
  capex: number;
  changeInWorkingCapital: number;
  fcff: number;
  discountPeriod: number;
  discountFactor: number;
  presentValueOfFcff: number;
}

export type DcfResult =
  | {
      status: "available";
      forecast: ForecastYearBreakdown[];
      terminalYearFcff: number;
      terminalValue: number;
      terminalValuePresentValue: number;
      presentValueOfForecastFcff: number;
      enterpriseValue: number;
      netDebt: number;
      cash: number;
      totalDebt: number;
      dilutedShares: number;
      equityValue: number;
      valuePerShare: number;
      terminalValuePercentOfEnterpriseValue: number | null;
      currentPrice: number | null;
      upsideDownside: number | null;
      assumptions: ForecastAssumptions;
    }
  | {
      status: "insufficient_data" | "invalid";
      missingInputs: string[];
      errors: string[];
      assumptions: ForecastAssumptions;
    };

export interface ScenarioOverrides {
  revenueGrowth?: number;
  ebitdaMargin?: number;
  ebitMargin?: number;
  taxRate?: number;
  depreciationToRevenue?: number;
  capexToRevenue?: number;
  changeInNwcToRevenue?: number;
  terminalGrowth?: number;
  wacc?: number;
  forecastYears?: number;
}

export type ValuationScenarioName = "base" | "bull" | "bear";

export interface ValuationScenarioResult {
  name: ValuationScenarioName;
  status: DcfResult["status"];
  assumptions: ForecastAssumptions;
  enterpriseValue: number | null;
  equityValue: number | null;
  intrinsicValuePerShare: number | null;
  upsideDownside: number | null;
  missingInputs: string[];
  errors: string[];
}

export interface SensitivityCell {
  wacc: number;
  terminalGrowth: number;
  status: "available" | "invalid";
  intrinsicValuePerShare: number | null;
  reason: string | null;
}

export interface SensitivityMatrix {
  status: "available" | "insufficient_data";
  waccValues: number[];
  terminalGrowthValues: number[];
  cells: SensitivityCell[][];
  basis: string;
  reason: string | null;
}
