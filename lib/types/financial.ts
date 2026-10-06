export type SourceType =
  | "demo"
  | "official"
  | "licensed"
  | "public"
  | "unofficial"
  | "public_api"
  | "official_filing"
  | "company_ir"
  | "calculated"
  | "ai_generated";

export type MarketDataProviderId =
  | "unavailable"
  | "demo"
  | "yahoo"
  | "upstox"
  | "angelone"
  | "twelvedata"
  | "fyers";

export type MarketDataStatus =
  | "LIVE"
  | "DELAYED"
  | "STALE"
  | "EOD"
  | "DEMO"
  | "UNAVAILABLE"
  | "UNKNOWN";

export type MarketDelayStatus = "LIVE" | "DELAYED" | "UNKNOWN" | "NOT_APPLICABLE";
export type MarketTradingStatus = "OPEN" | "PRE_OPEN" | "CLOSED" | "UNKNOWN";

export type MarketDataLicenseStatus =
  | "INTERNAL_ONLY"
  | "DISPLAY_ALLOWED"
  | "REDISTRIBUTION_ALLOWED"
  | "UNKNOWN"
  | "REQUIRES_REVIEW";

export interface DataProvenance {
  source: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  retrievedAt: string;
}

export interface MarketDataMetadata extends DataProvenance {
  provider: MarketDataProviderId;
  instrument: string;
  exchange: string;
  asOf: string | null;
  marketTimestamp: string | null;
  dataStatus: MarketDataStatus;
  delaySeconds: number | null;
  delayStatus: MarketDelayStatus;
  marketStatus: MarketTradingStatus;
  isUnofficial: boolean;
  licenseStatus: MarketDataLicenseStatus;
}

export type Exchange = "NSE" | "BSE" | "NASDAQ" | "NYSE" | "AMEX" | "OTC";

export interface Company extends MarketDataMetadata {
  id: string;
  ticker: string;
  exchange: Exchange | string;
  name: string;
  countryCode: string;
  currency: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketPrice extends MarketDataMetadata {
  id: string;
  companyId: string;
  date: string;
  asOf: string;
  currency: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  adjustedClose: number | null;
  volume: number | null;
}

export interface MarketQuote extends MarketDataMetadata {
  companyId: string;
  ticker: string;
  symbol: string;
  asOf: string | null;
  open: number | null;
  high: number | null;
  low: number | null;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  currency: string;
}

export interface MarketIndicator extends MarketDataMetadata {
  symbol: string;
  label: string;
  value: number;
  change: number;
  changePercent: number;
  currency: string;
  asOf: string | null;
}

export interface UnavailableMarketIndicator {
  symbol: string;
  label: string;
  provider: MarketDataProviderId;
  status: "UNAVAILABLE";
  error: string;
  code: string;
  source: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  retrievedAt: string;
  instrument: string;
  exchange: string;
  asOf: null;
  marketTimestamp: null;
  dataStatus: "UNAVAILABLE";
  delaySeconds: null;
  delayStatus: MarketDelayStatus;
  marketStatus: MarketTradingStatus;
  isUnofficial: boolean;
  licenseStatus: MarketDataLicenseStatus;
}

export type MarketOverviewItem = MarketIndicator | UnavailableMarketIndicator;

export type FinancialPeriodType = "annual" | "quarterly" | "ttm";

export interface FinancialPeriod {
  periodType: FinancialPeriodType;
  periodStart: string | null;
  periodEnd: string;
  currency: string;
}

export interface FinancialStatementBase extends DataProvenance {
  id: string;
  companyId: string;
  period: FinancialPeriod;
}

export interface IncomeStatement extends FinancialStatementBase {
  statementType: "income_statement";
  metrics: {
    revenue?: number | null;
    costOfRevenue?: number | null;
    grossProfit?: number | null;
    operatingExpenses?: number | null;
    ebitda?: number | null;
    depreciationAndAmortization?: number | null;
    ebit?: number | null;
    interestExpense?: number | null;
    incomeTaxExpense?: number | null;
    netIncome?: number | null;
    basicEps?: number | null;
    dilutedEps?: number | null;
  };
}

export interface BalanceSheet extends FinancialStatementBase {
  statementType: "balance_sheet";
  metrics: {
    cashAndEquivalents?: number | null;
    shortTermInvestments?: number | null;
    currentAssets?: number | null;
    currentLiabilities?: number | null;
    totalAssets?: number | null;
    totalLiabilities?: number | null;
    shortTermDebt?: number | null;
    longTermDebt?: number | null;
    totalDebt?: number | null;
    totalEquity?: number | null;
    sharesOutstanding?: number | null;
  };
}

export interface CashFlowStatement extends FinancialStatementBase {
  statementType: "cash_flow";
  metrics: {
    operatingCashFlow?: number | null;
    capitalExpenditures?: number | null;
    investingCashFlow?: number | null;
    financingCashFlow?: number | null;
    depreciationAndAmortization?: number | null;
    changeInWorkingCapital?: number | null;
    freeCashFlow?: number | null;
  };
}

export type FinancialStatement =
  | IncomeStatement
  | BalanceSheet
  | CashFlowStatement;

export interface FinancialRatios extends DataProvenance {
  id: string;
  companyId: string;
  period: FinancialPeriod;
  pe: number | null;
  pb: number | null;
  evEbitda: number | null;
  roe: number | null;
  roce: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  fcfYield: number | null;
}

export interface DCFModel extends DataProvenance {
  id: string;
  companyId: string;
  modelName: string;
  currency: string;
  valuationDate: string;
  forecastYears: number;
  assumptions: Record<string, number | string | boolean | null>;
  results: Record<string, number | string | boolean | null>;
  createdAt: string;
}

export interface DCFScenario extends DataProvenance {
  id: string;
  modelId: string;
  scenarioName: "bear" | "base" | "bull";
  assumptions: Record<string, number | string | boolean | null>;
  results: Record<string, number | string | boolean | null>;
  createdAt: string;
}

export interface AIAnalysis extends DataProvenance {
  id: string;
  companyId: string;
  analysisType: string;
  modelName: string;
  summary: string;
  keyFindings: string[];
  risks: string[];
  catalysts: string[];
  promptHash: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface CompanyMarketSnapshot {
  company: Company;
  quote: MarketQuote;
}

export type HistoricalPriceRange =
  | "1d"
  | "1w"
  | "1mo"
  | "3mo"
  | "6mo"
  | "1y"
  | "5y";

export interface EquityAnalysis {
  executiveSummary: string;
  businessQuality: string;
  financialStrength: string;
  growthDrivers: string[];
  keyRisks: string[];
  valuationObservation: string;
  catalysts: string[];
  redFlags: string[];
  researchQuestions: string[];
  dataLimitations: string[];
}

export interface AIResearchResult extends DataProvenance {
  company: Company;
  modelName: string;
  analyzedAt: string;
  status: "response_received";
  suppliedData: AIResearchDataSummary;
  analysis: EquityAnalysis;
}

export interface AIResearchDataSummary {
  marketDataAvailable: boolean;
  marketProvider: MarketDataProviderId | null;
  marketSource: string | null;
  marketAsOf: string | null;
  historicalPriceCount: number;
  fundamentalsAvailable: boolean;
  fundamentalsStatus: "available" | "partial" | "unavailable" | null;
  reportingPeriods: string[];
  financialSources: {
    source: string;
    sourceUrl: string;
    publicationDate: string;
    retrievedAt: string;
  }[];
  latestDataRetrievedAt: string | null;
}
