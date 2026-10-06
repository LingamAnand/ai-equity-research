import type {
  FundamentalPeriod,
  FundamentalProvenance,
  FundamentalUnit,
} from "@/lib/types/fundamentals";

export const HDFC_Q1_FY27_RETRIEVED_AT =
  "2026-09-28T11:25:06+05:30";
export const HDFC_Q1_FY27_PUBLICATION_DATE = "2026-07-18";

export const HDFC_Q1_FY27_REPORTED_VALUES = {
  interestEarned: 79362.78,
  interestExpended: 45828.83,
  priorYearInterestEarned: 77470.2,
  priorYearInterestExpended: 46032.23,
  profitAfterTax: 19059.72,
  priorYearProfitAfterTax: 18155.21,
  totalDeposits: 3170830.09,
  priorYearTotalDeposits: 2764089.02,
  balanceSheetAdvances: 3037303.31,
  priorYearBalanceSheetAdvances: 2628434.2,
  totalNetWorth: 566201.13,
  openingNetWorth: 546325.46,
  returnOnAssets: 0.46,
  netRevenue: 463.6,
  reportedNetInterestIncome: 335.3,
  totalIncome: 92184.38,
  profitBeforeTax: 251.1,
  basicEps: 12.38,
  dilutedEps: 12.35,
  totalAssets: 4397461.28,
  grossAdvances: 30608,
  cashAndBalancesWithRbi: 150562.42,
  balancesWithBanksAndCall: 73002,
  borrowings: 461812.65,
  grossNpaAmount: 35846.35,
  netNpaAmount: 12357.27,
  grossNpaRatio: 1.17,
  netNpaRatio: 0.41,
  casaRatio: 32.3,
  capitalAdequacyRatio: 19.57,
  cet1Ratio: 17.4,
} as const;

export const HDFC_Q1_FY27_RESULTS_URL =
  "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2026-2027/quarter-1/financial-results-for-the-quarter-ended-june-30-2026.pdf";
export const HDFC_Q1_FY27_PRESS_RELEASE_URL =
  "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2026-2027/quarter-1/press-release-june-2026.pdf";

export const HDFC_Q1_FY27_PERIOD: FundamentalPeriod = {
  id: "q1-fy2026-27",
  periodType: "quarterly",
  periodStart: "2026-04-01",
  periodEnd: "2026-06-30",
  label: "Q1 FY2026-27",
};

export const HDFC_Q1_FY26_PERIOD: FundamentalPeriod = {
  id: "q1-fy2025-26",
  periodType: "quarterly",
  periodStart: "2025-04-01",
  periodEnd: "2025-06-30",
  label: "Q1 FY2025-26",
};

export const HDFC_Q4_FY26_PERIOD: FundamentalPeriod = {
  id: "as-at-fy2025-26",
  periodType: "instant",
  periodStart: null,
  periodEnd: "2026-03-31",
  label: "As at 31 March 2026",
};

export const HDFC_Q1_FY27_INSTANT_PERIOD: FundamentalPeriod = {
  id: "as-at-q1-fy2026-27",
  periodType: "instant",
  periodStart: null,
  periodEnd: "2026-06-30",
  label: "As at 30 June 2026",
};

export const HDFC_Q1_FY26_INSTANT_PERIOD: FundamentalPeriod = {
  id: "as-at-q1-fy2025-26",
  periodType: "instant",
  periodStart: null,
  periodEnd: "2025-06-30",
  label: "As at 30 June 2025",
};

export function hdfcProvenance(
  options: {
    sourceUrl?: string;
    period: FundamentalPeriod;
    unit: FundamentalUnit;
    pageReference: string;
    sectionReference: string;
  },
): FundamentalProvenance {
  const sourceUrl = options.sourceUrl ?? HDFC_Q1_FY27_RESULTS_URL;
  const isPressRelease = sourceUrl === HDFC_Q1_FY27_PRESS_RELEASE_URL;

  return {
    sourceId: isPressRelease ? "q1-fy27-press" : "q1-fy27-results",
    source: isPressRelease
      ? "HDFC Bank Q1 FY2026-27 press release"
      : "HDFC Bank unaudited standalone financial results for Q1 FY2026-27",
    sourceType: "official_company_filing",
    sourceUrl,
    period: options.period,
    publicationDate: HDFC_Q1_FY27_PUBLICATION_DATE,
    unit: options.unit,
    currency: options.unit === "PERCENT" ? null : "INR",
    retrievedAt: HDFC_Q1_FY27_RETRIEVED_AT,
    pageReference: options.pageReference,
    sectionReference: options.sectionReference,
    reportingBasis: "standalone",
  };
}
