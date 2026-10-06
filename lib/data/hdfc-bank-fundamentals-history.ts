import {
  HDFC_Q1_FY27_PRESS_RELEASE_URL,
  HDFC_Q1_FY27_REPORTED_VALUES,
  HDFC_Q1_FY27_RESULTS_URL,
} from "./hdfc-bank-q1-fy27.ts";
import type {
  FundamentalPeriod,
  FundamentalSource,
  FundamentalUnit,
  FundamentalsReportingPeriod,
  ReportingBasis,
} from "@/lib/types/fundamentals";

export const HDFC_FUNDAMENTALS_RETRIEVED_AT =
  "2026-09-28T11:25:06+05:30";

const REPORTING_BASIS: ReportingBasis = "standalone";

export const HDFC_FUNDAMENTALS_PERIODS: FundamentalsReportingPeriod[] = [
  {
    id: "q1-fy2026-27",
    periodType: "quarterly",
    periodStart: "2026-04-01",
    periodEnd: "2026-06-30",
    label: "Q1 FY2026-27",
    comparisonGroup: "post-merger",
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q4-fy2025-26",
    periodType: "quarterly",
    periodStart: "2026-01-01",
    periodEnd: "2026-03-31",
    label: "Q4 FY2025-26",
    comparisonGroup: "post-merger",
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q1-fy2025-26",
    periodType: "quarterly",
    periodStart: "2025-04-01",
    periodEnd: "2025-06-30",
    label: "Q1 FY2025-26",
    comparisonGroup: "post-merger",
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "fy2025-26",
    periodType: "annual",
    periodStart: "2025-04-01",
    periodEnd: "2026-03-31",
    label: "FY2025-26",
    comparisonGroup: "post-merger",
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "fy2024-25",
    periodType: "annual",
    periodStart: "2024-04-01",
    periodEnd: "2025-03-31",
    label: "FY2024-25",
    comparisonGroup: "post-merger",
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "fy2023-24",
    periodType: "annual",
    periodStart: "2023-04-01",
    periodEnd: "2024-03-31",
    label: "FY2023-24",
    comparisonGroup: "merger-transition",
    reportingBasis: REPORTING_BASIS,
  },
];

const HDFC_SOURCE_URLS = {
  q1Fy27Results: HDFC_Q1_FY27_RESULTS_URL,
  q1Fy27Press: HDFC_Q1_FY27_PRESS_RELEASE_URL,
  q4Fy26Results:
    "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-4/financial-results-for-the-quarter-and-year-ended-March-31-2026.pdf",
  q4Fy26Press:
    "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-4/press-release-march-2026.pdf",
  q4Fy26Key:
    "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-4/key-parameters-financial-results-for-the-quarter-ended-march-31-2026.pdf",
  q1Fy26Results:
    "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/about-us/financial-results/2025-2026/quarter-1/financial-results-for-the-quarter-ended-june-30-2025.pdf",
  q1Fy26Press:
    "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2025-2026/quarter-1/press-release-june-2025.pdf",
  q1Fy26Key:
    "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2025-2026/quarter-1/key-parameters-financial-results-for-the-quarter-ended-june-30-2025.pdf",
  q4Fy25Results:
    "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-4/financial-results-for-the-quarter-and-year-ended-March-31-2025.pdf",
  q4Fy25Press:
    "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-4/press-release-to-announce-financial-results-for-the-quarter-and-year-ended-march-31-2025.pdf",
  q4Fy25Key:
    "https://www.hdfc.bank.in/content/dam/hdfcbankpws/in/en/pdf/financial-results/2024-2025/quarter-4/key-parameters-financial-results-for-the-quarter-ended-march-31-2025.pdf",
} as const;

export const HDFC_FUNDAMENTALS_SOURCES: FundamentalSource[] = [
  {
    id: "q1-fy27-results",
    source:
      "HDFC Bank unaudited standalone financial results for the quarter ended June 30, 2026",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q1Fy27Results,
    publicationDate: "2026-07-18",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q1-fy27-press",
    source: "HDFC Bank Q1 FY2026-27 press release",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q1Fy27Press,
    publicationDate: "2026-07-18",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q4-fy26-results",
    source:
      "HDFC Bank audited standalone financial results for the quarter and year ended March 31, 2026",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q4Fy26Results,
    publicationDate: "2026-04-18",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q4-fy26-press",
    source: "HDFC Bank Q4 and FY2025-26 press release",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q4Fy26Press,
    publicationDate: "2026-04-18",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q4-fy26-key",
    source: "HDFC Bank Q4 FY2025-26 key parameters",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q4Fy26Key,
    publicationDate: "2026-04-18",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q1-fy26-results",
    source:
      "HDFC Bank unaudited standalone financial results for the quarter ended June 30, 2025",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q1Fy26Results,
    publicationDate: "2025-07-19",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q1-fy26-press",
    source: "HDFC Bank Q1 FY2025-26 press release",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q1Fy26Press,
    publicationDate: "2025-07-19",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q1-fy26-key",
    source: "HDFC Bank Q1 FY2025-26 key parameters",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q1Fy26Key,
    publicationDate: "2025-07-23",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q4-fy25-results",
    source:
      "HDFC Bank audited standalone financial results for the quarter and year ended March 31, 2025",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q4Fy25Results,
    publicationDate: "2025-04-19",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q4-fy25-press",
    source: "HDFC Bank Q4 and FY2024-25 press release",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q4Fy25Press,
    publicationDate: "2025-04-19",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
  {
    id: "q4-fy25-key",
    source: "HDFC Bank Q4 FY2024-25 key parameters",
    sourceType: "official_company_filing",
    sourceUrl: HDFC_SOURCE_URLS.q4Fy25Key,
    publicationDate: "2025-04-19",
    retrievedAt: HDFC_FUNDAMENTALS_RETRIEVED_AT,
    reportingBasis: REPORTING_BASIS,
  },
];

export interface HdfcRawObservation {
  id: string;
  periodId: string;
  value: number | null;
  unit: FundamentalUnit;
  sourceId: string;
  pageReference: string;
  sectionReference: string;
  measurement: "flow" | "instant";
  reason?: string;
}

type ObservationRow = readonly [
  id: string,
  value: number | null,
  unit: FundamentalUnit,
  sectionReference: string,
  measurement?: "flow" | "instant",
  reason?: string,
];

function rows(
  periodId: string,
  sourceId: string,
  pageReference: string,
  entries: readonly ObservationRow[],
  defaultMeasurement: "flow" | "instant",
): HdfcRawObservation[] {
  return entries.map(
    ([id, value, unit, sectionReference, measurement, reason]) => ({
      id,
      periodId,
      value,
      unit,
      sourceId,
      pageReference,
      sectionReference,
      measurement: measurement ?? defaultMeasurement,
      reason,
    }),
  );
}

export const HDFC_FUNDAMENTALS_OBSERVATIONS: HdfcRawObservation[] = [
  ...rows(
    "q1-fy2026-27",
    "q1-fy27-results",
    "1",
    [
      [
        "interestEarned",
        HDFC_Q1_FY27_REPORTED_VALUES.interestEarned,
        "INR_CRORE",
        "Standalone financial results: Interest earned",
      ],
      [
        "interestExpended",
        HDFC_Q1_FY27_REPORTED_VALUES.interestExpended,
        "INR_CRORE",
        "Standalone financial results: Interest expended",
      ],
      [
        "totalIncome",
        HDFC_Q1_FY27_REPORTED_VALUES.totalIncome,
        "INR_CRORE",
        "Standalone financial results: Total income",
      ],
      [
        "profitAfterTax",
        HDFC_Q1_FY27_REPORTED_VALUES.profitAfterTax,
        "INR_CRORE",
        "Standalone financial results: Net profit for the period",
      ],
      [
        "basicEps",
        HDFC_Q1_FY27_REPORTED_VALUES.basicEps,
        "INR_PER_SHARE",
        "Analytical ratios: Basic EPS, not annualized",
      ],
      [
        "dilutedEps",
        HDFC_Q1_FY27_REPORTED_VALUES.dilutedEps,
        "INR_PER_SHARE",
        "Analytical ratios: Diluted EPS, not annualized",
      ],
      [
        "roa",
        HDFC_Q1_FY27_REPORTED_VALUES.returnOnAssets,
        "PERCENT",
        "Analytical ratios: Return on assets (average), not annualized",
      ],
      [
        "grossNpaAmount",
        HDFC_Q1_FY27_REPORTED_VALUES.grossNpaAmount,
        "INR_CRORE",
        "Analytical ratios: Gross NPAs",
        "instant",
      ],
      [
        "netNpaAmount",
        HDFC_Q1_FY27_REPORTED_VALUES.netNpaAmount,
        "INR_CRORE",
        "Analytical ratios: Net NPAs",
        "instant",
      ],
      [
        "grossNpaRatio",
        HDFC_Q1_FY27_REPORTED_VALUES.grossNpaRatio,
        "PERCENT",
        "Analytical ratios: Gross NPAs to gross advances",
        "instant",
      ],
      [
        "netNpaRatio",
        HDFC_Q1_FY27_REPORTED_VALUES.netNpaRatio,
        "PERCENT",
        "Analytical ratios: Net NPAs to net advances",
        "instant",
      ],
      [
        "capitalAdequacyRatio",
        HDFC_Q1_FY27_REPORTED_VALUES.capitalAdequacyRatio,
        "PERCENT",
        "Analytical ratios: Capital Adequacy Ratio",
        "instant",
      ],
      [
        "totalNetWorth",
        HDFC_Q1_FY27_REPORTED_VALUES.totalNetWorth,
        "INR_CRORE",
        "Analytical ratios and other disclosures: Net worth",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q1-fy2026-27",
    "q1-fy27-press",
    "1",
    [
      [
        "netRevenue",
        HDFC_Q1_FY27_REPORTED_VALUES.netRevenue,
        "INR_BILLION",
        "Standalone financial results: Net revenue",
      ],
      [
        "netInterestIncome",
        HDFC_Q1_FY27_REPORTED_VALUES.reportedNetInterestIncome,
        "INR_BILLION",
        "Net interest income (interest earned less interest expended)",
      ],
      [
        "netInterestMargin",
        3.26,
        "PERCENT",
        "Core net interest margin on total assets",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q1-fy2026-27",
    "q1-fy27-press",
    "2",
    [
      [
        "profitBeforeTax",
        HDFC_Q1_FY27_REPORTED_VALUES.profitBeforeTax,
        "INR_BILLION",
        "Profit before tax",
      ],
      [
        "grossAdvances",
        HDFC_Q1_FY27_REPORTED_VALUES.grossAdvances,
        "INR_BILLION",
        "Gross advances as at June 30, 2026",
        "instant",
      ],
      [
        "casaRatio",
        HDFC_Q1_FY27_REPORTED_VALUES.casaRatio,
        "PERCENT",
        "CASA deposits as a percentage of total deposits",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q1-fy2026-27",
    "q1-fy27-results",
    "3",
    [
      [
        "totalAssets",
        HDFC_Q1_FY27_REPORTED_VALUES.totalAssets,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Total assets",
        "instant",
      ],
      [
        "totalDeposits",
        HDFC_Q1_FY27_REPORTED_VALUES.totalDeposits,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Deposits",
        "instant",
      ],
      [
        "balanceSheetAdvances",
        HDFC_Q1_FY27_REPORTED_VALUES.balanceSheetAdvances,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Advances",
        "instant",
      ],
      [
        "cashAndBalancesWithRbi",
        HDFC_Q1_FY27_REPORTED_VALUES.cashAndBalancesWithRbi,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Cash and balances with Reserve Bank of India",
        "instant",
      ],
      [
        "balancesWithBanksAndCall",
        HDFC_Q1_FY27_REPORTED_VALUES.balancesWithBanksAndCall,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Balances with banks and money at call and short notice",
        "instant",
      ],
      [
        "borrowings",
        HDFC_Q1_FY27_REPORTED_VALUES.borrowings,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Borrowings",
        "instant",
      ],
    ],
    "instant",
  ),
  ...rows(
    "q4-fy2025-26",
    "q4-fy26-press",
    "1",
    [
      [
        "netRevenue",
        462.8,
        "INR_BILLION",
        "Profit and loss account: Net revenue for the quarter ended March 31, 2026",
      ],
      [
        "netInterestIncome",
        330.8,
        "INR_BILLION",
        "Net interest income for the quarter ended March 31, 2026",
      ],
      [
        "profitBeforeTax",
        251.9,
        "INR_BILLION",
        "Profit before tax for the quarter ended March 31, 2026",
      ],
      [
        "profitAfterTax",
        192.2,
        "INR_BILLION",
        "Profit after tax for the quarter ended March 31, 2026",
      ],
      [
        "basicEps",
        null,
        "INR_PER_SHARE",
        "Standalone financial results: Basic earnings per share",
        "flow",
        "EPS is not included in the text-extractable official disclosure for this snapshot.",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q4-fy2025-26",
    "q4-fy26-press",
    "2",
    [
      [
        "totalAssets",
        43649,
        "INR_BILLION",
        "Balance sheet size as at March 31, 2026",
        "instant",
      ],
      [
        "totalDeposits",
        31053,
        "INR_BILLION",
        "Total EOP Deposits as at March 31, 2026",
        "instant",
      ],
      [
        "grossAdvances",
        29600,
        "INR_BILLION",
        "Gross advances as at March 31, 2026",
        "instant",
      ],
      [
        "casaRatio",
        34.1,
        "PERCENT",
        "CASA deposits as a percentage of total deposits as at March 31, 2026",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q4-fy2025-26",
    "q4-fy26-press",
    "3",
    [
      [
        "capitalAdequacyRatio",
        19.7,
        "PERCENT",
        "Capital adequacy: Total Capital Adequacy Ratio (Basel III)",
        "instant",
      ],
      [
        "cet1Ratio",
        17.3,
        "PERCENT",
        "Capital adequacy: Common Equity Tier 1 Capital ratio",
        "instant",
      ],
      [
        "grossNpaRatio",
        1.15,
        "PERCENT",
        "Asset quality: Gross NPA as a ratio of gross advances",
        "instant",
      ],
      [
        "netNpaRatio",
        0.38,
        "PERCENT",
        "Asset quality: Net NPA as a ratio of net advances",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q4-fy2025-26",
    "q4-fy26-key",
    "2",
    [
      [
        "netInterestMargin",
        3.4,
        "PERCENT",
        "Financial metrics: Net Interest Margin - assets (31-Mar-26)",
        "flow",
      ],
    ],
    "instant",
  ),
  ...rows(
    "fy2025-26",
    "q4-fy26-press",
    "1",
    [
      [
        "netRevenue",
        1912.2,
        "INR_BILLION",
        "Summary for the financial year ended March 31, 2026: Net revenues",
      ],
      [
        "profitAfterTax",
        746.7,
        "INR_BILLION",
        "Summary for the financial year ended March 31, 2026: Profit after tax",
      ],
      [
        "profitBeforeTax",
        null,
        "INR_CRORE",
        "Audited standalone annual financial results: Profit before tax",
        "flow",
        "The annual statement is available as an official PDF, but its scanned table could not be reliably extracted for this snapshot.",
      ],
      [
        "basicEps",
        null,
        "INR_PER_SHARE",
        "Audited standalone annual financial results: Basic earnings per share",
        "flow",
        "The annual statement is available as an official PDF, but its scanned table could not be reliably extracted for this snapshot.",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2025-26",
    "q4-fy26-press",
    "2",
    [
      [
        "totalAssets",
        43649,
        "INR_BILLION",
        "Balance sheet size as at March 31, 2026",
        "instant",
      ],
      [
        "totalDeposits",
        31053,
        "INR_BILLION",
        "Total EOP Deposits as at March 31, 2026",
        "instant",
      ],
      [
        "grossAdvances",
        29600,
        "INR_BILLION",
        "Gross advances as at March 31, 2026",
        "instant",
      ],
      [
        "casaRatio",
        34.1,
        "PERCENT",
        "CASA ratio as at March 31, 2026",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2025-26",
    "q4-fy26-press",
    "3",
    [
      [
        "capitalAdequacyRatio",
        19.7,
        "PERCENT",
        "Capital adequacy as at March 31, 2026",
        "instant",
      ],
      [
        "cet1Ratio",
        17.3,
        "PERCENT",
        "Common Equity Tier 1 Capital ratio as at March 31, 2026",
        "instant",
      ],
      [
        "grossNpaRatio",
        1.15,
        "PERCENT",
        "Gross NPA ratio as at March 31, 2026",
        "instant",
      ],
      [
        "netNpaRatio",
        0.38,
        "PERCENT",
        "Net NPA ratio as at March 31, 2026",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2025-26",
    "q1-fy27-results",
    "1",
    [
      [
        "totalNetWorth",
        HDFC_Q1_FY27_REPORTED_VALUES.openingNetWorth,
        "INR_CRORE",
        "Analytical ratios and other disclosures: Net worth as at March 31, 2026",
        "instant",
      ],
    ],
    "instant",
  ),
  ...rows(
    "q1-fy2025-26",
    "q1-fy26-press",
    "1",
    [
      [
        "netRevenue",
        531.7,
        "INR_BILLION",
        "Profit and loss account: Net revenue for the quarter ended June 30, 2025",
      ],
      [
        "netInterestIncome",
        314.4,
        "INR_BILLION",
        "Net interest income for the quarter ended June 30, 2025",
      ],
      [
        "netInterestMargin",
        3.35,
        "PERCENT",
        "Core net interest margin on total assets",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q1-fy2025-26",
    "q1-fy26-press",
    "2",
    [
      [
        "profitBeforeTax",
        212.9,
        "INR_BILLION",
        "Profit before tax for the quarter ended June 30, 2025",
      ],
      [
        "casaRatio",
        33.9,
        "PERCENT",
        "CASA deposits as a percentage of total deposits as at June 30, 2025",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q1-fy2025-26",
    "q1-fy26-press",
    "3",
    [
      [
        "grossAdvances",
        26532,
        "INR_BILLION",
        "Gross advances as at June 30, 2025",
        "instant",
      ],
      [
        "cet1Ratio",
        17.4,
        "PERCENT",
        "Capital adequacy: Common Equity Tier 1 Capital ratio",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q1-fy2025-26",
    "q1-fy26-results",
    "1",
    [
      [
        "interestEarned",
        77470.2,
        "INR_CRORE",
        "Standalone financial results: Interest earned",
      ],
      [
        "interestExpended",
        46032.23,
        "INR_CRORE",
        "Standalone financial results: Interest expended",
      ],
      [
        "totalIncome",
        99200.03,
        "INR_CRORE",
        "Standalone financial results: Total income",
      ],
      [
        "profitAfterTax",
        18155.21,
        "INR_CRORE",
        "Standalone financial results: Net profit for the period",
      ],
      [
        "basicEps",
        23.71,
        "INR_PER_SHARE",
        "Analytical ratios: Basic EPS, not annualized",
      ],
      [
        "dilutedEps",
        23.58,
        "INR_PER_SHARE",
        "Analytical ratios: Diluted EPS, not annualized",
      ],
      [
        "roa",
        0.48,
        "PERCENT",
        "Analytical ratios: Return on assets (average), not annualized",
        "flow",
      ],
      [
        "grossNpaAmount",
        37040.8,
        "INR_CRORE",
        "Analytical ratios: Gross NPAs",
        "instant",
      ],
      [
        "netNpaAmount",
        12275.99,
        "INR_CRORE",
        "Analytical ratios: Net NPAs",
        "instant",
      ],
      [
        "grossNpaRatio",
        1.4,
        "PERCENT",
        "Analytical ratios: Gross NPAs to gross advances",
        "instant",
      ],
      [
        "netNpaRatio",
        0.47,
        "PERCENT",
        "Analytical ratios: Net NPAs to net advances",
        "instant",
      ],
      [
        "capitalAdequacyRatio",
        19.88,
        "PERCENT",
        "Analytical ratios: Capital Adequacy Ratio",
        "instant",
      ],
      [
        "totalNetWorth",
        508803.89,
        "INR_CRORE",
        "Analytical ratios and other disclosures: Net worth",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "q1-fy2025-26",
    "q1-fy26-results",
    "3",
    [
      [
        "totalAssets",
        3954076.66,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Total assets",
        "instant",
      ],
      [
        "totalDeposits",
        2764089.02,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Deposits",
        "instant",
      ],
      [
        "balanceSheetAdvances",
        2628434.2,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Advances",
        "instant",
      ],
      [
        "cashAndBalancesWithRbi",
        142538.15,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Cash and balances with Reserve Bank of India",
        "instant",
      ],
      [
        "balancesWithBanksAndCall",
        60057.11,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Balances with banks and money at call and short notice",
        "instant",
      ],
      [
        "borrowings",
        510056.21,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Borrowings",
        "instant",
      ],
    ],
    "instant",
  ),
  ...rows(
    "fy2025-26",
    "q4-fy26-press",
    "1",
    [
      [
        "netInterestIncome",
        null,
        "INR_BILLION",
        "Audited standalone annual financial results: Net interest income",
        "flow",
        "An annual NII value could not be verified from the text-extractable official disclosures; quarterly NII was not substituted.",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2024-25",
    "q4-fy25-press",
    "3",
    [
      [
        "netRevenue",
        1683,
        "INR_BILLION",
        "Year ended March 31, 2025: Net revenues",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2023-24",
    "q4-fy25-press",
    "3",
    [
      [
        "netRevenue",
        1577.7,
        "INR_BILLION",
        "Year ended March 31, 2024: Net revenues",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2024-25",
    "q4-fy25-results",
    "1",
    [
      [
        "interestEarned",
        300517.04,
        "INR_CRORE",
        "Standalone financial results: Interest earned for the year ended March 31, 2025",
      ],
      [
        "interestExpended",
        177846.95,
        "INR_CRORE",
        "Standalone financial results: Interest expended for the year ended March 31, 2025",
      ],
      [
        "totalIncome",
        346149.32,
        "INR_CRORE",
        "Standalone financial results: Total income for the year ended March 31, 2025",
      ],
      [
        "profitBeforeTax",
        88478.06,
        "INR_CRORE",
        "Standalone financial results: Profit before tax for the year ended March 31, 2025",
      ],
      [
        "profitAfterTax",
        67347.36,
        "INR_CRORE",
        "Standalone financial results: Net profit for the year ended March 31, 2025",
      ],
      [
        "basicEps",
        88.29,
        "INR_PER_SHARE",
        "Analytical ratios: Basic EPS, not annualized",
      ],
      [
        "dilutedEps",
        87.9,
        "INR_PER_SHARE",
        "Analytical ratios: Diluted EPS, not annualized",
      ],
      [
        "roa",
        1.91,
        "PERCENT",
        "Analytical ratios: Return on assets (average), annual period",
        "flow",
      ],
      [
        "grossNpaAmount",
        35222.64,
        "INR_CRORE",
        "Analytical ratios: Gross NPAs as at March 31, 2025",
        "instant",
      ],
      [
        "netNpaAmount",
        11320.43,
        "INR_CRORE",
        "Analytical ratios: Net NPAs as at March 31, 2025",
        "instant",
      ],
      [
        "grossNpaRatio",
        1.33,
        "PERCENT",
        "Analytical ratios: Gross NPAs to gross advances as at March 31, 2025",
        "instant",
      ],
      [
        "netNpaRatio",
        0.43,
        "PERCENT",
        "Analytical ratios: Net NPAs to net advances as at March 31, 2025",
        "instant",
      ],
      [
        "capitalAdequacyRatio",
        19.55,
        "PERCENT",
        "Analytical ratios: Capital Adequacy Ratio as at March 31, 2025",
        "instant",
      ],
      [
        "totalNetWorth",
        488899.89,
        "INR_CRORE",
        "Analytical ratios and other disclosures: Net worth as at March 31, 2025",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2024-25",
    "q4-fy25-press",
    "2",
    [
      [
        "totalAssets",
        39102,
        "INR_BILLION",
        "Balance sheet size as at March 31, 2025",
        "instant",
      ],
      [
        "totalDeposits",
        27147,
        "INR_BILLION",
        "Total EOP Deposits as at March 31, 2025",
        "instant",
      ],
      [
        "grossAdvances",
        26435,
        "INR_BILLION",
        "Gross advances as at March 31, 2025",
        "instant",
      ],
      [
        "casaRatio",
        34.8,
        "PERCENT",
        "CASA deposits as a percentage of total deposits as at March 31, 2025",
        "instant",
      ],
      [
        "cet1Ratio",
        17.2,
        "PERCENT",
        "Capital adequacy: Common Equity Tier 1 Capital ratio as at March 31, 2025",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2024-25",
    "q4-fy25-results",
    "3",
    [
      [
        "balanceSheetAdvances",
        2619608.61,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Advances as at March 31, 2025",
        "instant",
      ],
      [
        "cashAndBalancesWithRbi",
        144355.03,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Cash and balances with Reserve Bank of India",
        "instant",
      ],
      [
        "balancesWithBanksAndCall",
        95215.65,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Balances with banks and money at call and short notice",
        "instant",
      ],
      [
        "borrowings",
        547930.9,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Borrowings",
        "instant",
      ],
    ],
    "instant",
  ),
  ...rows(
    "fy2023-24",
    "q4-fy25-results",
    "1",
    [
      [
        "interestEarned",
        258340.56,
        "INR_CRORE",
        "Standalone financial results: Interest earned for the year ended March 31, 2024",
      ],
      [
        "interestExpended",
        149808.1,
        "INR_CRORE",
        "Standalone financial results: Interest expended for the year ended March 31, 2024",
      ],
      [
        "totalIncome",
        307581.55,
        "INR_CRORE",
        "Standalone financial results: Total income for the year ended March 31, 2024",
      ],
      [
        "profitBeforeTax",
        70895.3,
        "INR_CRORE",
        "Standalone financial results: Profit before tax for the year ended March 31, 2024",
      ],
      [
        "profitAfterTax",
        60812.27,
        "INR_CRORE",
        "Standalone financial results: Net profit for the year ended March 31, 2024",
      ],
      [
        "basicEps",
        85.83,
        "INR_PER_SHARE",
        "Analytical ratios: Basic EPS, not annualized",
      ],
      [
        "dilutedEps",
        85.44,
        "INR_PER_SHARE",
        "Analytical ratios: Diluted EPS, not annualized",
      ],
      [
        "roa",
        1.98,
        "PERCENT",
        "Analytical ratios: Return on assets (average), annual period",
        "flow",
      ],
      [
        "grossNpaAmount",
        31173.32,
        "INR_CRORE",
        "Analytical ratios: Gross NPAs as at March 31, 2024",
        "instant",
      ],
      [
        "netNpaAmount",
        8091.74,
        "INR_CRORE",
        "Analytical ratios: Net NPAs as at March 31, 2024",
        "instant",
      ],
      [
        "grossNpaRatio",
        1.24,
        "PERCENT",
        "Analytical ratios: Gross NPAs to gross advances as at March 31, 2024",
        "instant",
      ],
      [
        "netNpaRatio",
        0.33,
        "PERCENT",
        "Analytical ratios: Net NPAs to net advances as at March 31, 2024",
        "instant",
      ],
      [
        "capitalAdequacyRatio",
        18.8,
        "PERCENT",
        "Analytical ratios: Capital Adequacy Ratio as at March 31, 2024",
        "instant",
      ],
      [
        "totalNetWorth",
        427634.18,
        "INR_CRORE",
        "Analytical ratios and other disclosures: Net worth as at March 31, 2024",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2023-24",
    "q4-fy25-press",
    "3",
    [
      [
        "totalAssets",
        36176,
        "INR_BILLION",
        "Balance sheet size as at March 31, 2024",
        "instant",
      ],
      [
        "totalDeposits",
        23798,
        "INR_BILLION",
        "Total EOP Deposits as at March 31, 2024",
        "instant",
      ],
      [
        "grossAdvances",
        25078,
        "INR_BILLION",
        "Gross advances as at March 31, 2024",
        "instant",
      ],
      [
        "casaRatio",
        38.2,
        "PERCENT",
        "CASA ratio as at March 31, 2024",
        "instant",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2023-24",
    "q4-fy25-results",
    "3",
    [
      [
        "balanceSheetAdvances",
        2484861.52,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Advances as at March 31, 2024",
        "instant",
      ],
      [
        "cashAndBalancesWithRbi",
        178683.22,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Cash and balances with Reserve Bank of India",
        "instant",
      ],
      [
        "balancesWithBanksAndCall",
        40464.19,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Balances with banks and money at call and short notice",
        "instant",
      ],
      [
        "borrowings",
        662153.07,
        "INR_CRORE",
        "Standalone statement of assets and liabilities: Borrowings",
        "instant",
      ],
    ],
    "instant",
  ),
  ...rows(
    "q4-fy2025-26",
    "q4-fy26-results",
    "1",
    [
      [
        "basicEps",
        null,
        "INR_PER_SHARE",
        "Standalone financial results: Basic earnings per share",
        "flow",
        "The standalone statement PDF is image-only in the available extraction, so EPS has not been verified.",
      ],
    ],
    "flow",
  ),
  ...rows(
    "fy2025-26",
    "q4-fy26-results",
    "1",
    [
      [
        "interestEarned",
        null,
        "INR_CRORE",
        "Standalone financial results: Interest earned for FY2025-26",
        "flow",
        "The standalone statement PDF is image-only in the available extraction, so annual interest earned has not been verified.",
      ],
      [
        "interestExpended",
        null,
        "INR_CRORE",
        "Standalone financial results: Interest expended for FY2025-26",
        "flow",
        "The standalone statement PDF is image-only in the available extraction, so annual interest expended has not been verified.",
      ],
    ],
    "flow",
  ),
];

export const HDFC_Q1_FY25_COMPARISON_PERIOD: FundamentalPeriod = {
  id: "q1-fy2024-25-comparison",
  periodType: "quarterly",
  periodStart: "2024-04-01",
  periodEnd: "2024-06-30",
  label: "Q1 FY2024-25",
  comparisonGroup: "merger-transition",
};

export const HDFC_FUNDAMENTALS_COMPARISON_INPUTS: HdfcRawObservation[] = [
  {
    id: "profitAfterTax",
    periodId: HDFC_Q1_FY25_COMPARISON_PERIOD.id,
    value: 16174.75,
    unit: "INR_CRORE",
    sourceId: "q1-fy26-results",
    pageReference: "1",
    sectionReference:
      "Comparative standalone results: Net profit for quarter ended June 30, 2024",
    measurement: "flow",
  },
  {
    id: "netInterestIncome",
    periodId: HDFC_Q1_FY25_COMPARISON_PERIOD.id,
    value: 298.4,
    unit: "INR_BILLION",
    sourceId: "q1-fy26-press",
    pageReference: "1",
    sectionReference: "Comparative net interest income for quarter ended June 30, 2024",
    measurement: "flow",
  },
  {
    id: "totalDeposits",
    periodId: HDFC_Q1_FY25_COMPARISON_PERIOD.id,
    value: 2379084.53,
    unit: "INR_CRORE",
    sourceId: "q1-fy26-results",
    pageReference: "3",
    sectionReference:
      "Comparative standalone statement of assets and liabilities: Deposits as at June 30, 2024",
    measurement: "instant",
  },
  {
    id: "grossAdvances",
    periodId: HDFC_Q1_FY25_COMPARISON_PERIOD.id,
    value: 24869,
    unit: "INR_BILLION",
    sourceId: "q1-fy26-key",
    pageReference: "1",
    sectionReference: "Product-wise advances: Gross advances as at June 30, 2024",
    measurement: "instant",
  },
];

export const HDFC_FUNDAMENTALS_GROWTH_PAIRS = [
  {
    periodId: "q1-fy2026-27",
    priorPeriodId: "q1-fy2025-26",
  },
  {
    periodId: "q4-fy2025-26",
    priorPeriodId: "q4-fy2024-25",
  },
  {
    periodId: "q1-fy2025-26",
    priorPeriodId: HDFC_Q1_FY25_COMPARISON_PERIOD.id,
  },
  {
    periodId: "fy2025-26",
    priorPeriodId: "fy2024-25",
  },
  {
    periodId: "fy2024-25",
    priorPeriodId: "fy2023-24",
  },
] as const;

export const HDFC_FUNDAMENTALS_WARNINGS = [
  "The Q4 FY2025-26 official standalone results PDF is available, but its scanned statement tables could not be reliably extracted; affected metrics remain unavailable rather than estimated.",
  "HDFC Bank's FY2024-25 official disclosure notes that HDFC Limited merged into HDFC Bank effective July 1, 2023 and that prior-period numbers are not comparable. Treat FY2023-24 comparisons with caution.",
] as const;

export const HDFC_FUNDAMENTALS_UNAVAILABLE_REASONS: Record<string, string> = {
  "fy2025-26:netInterestIncome":
    "An annual NII value could not be verified from the text-extractable official disclosures; quarterly NII was not substituted.",
  "fy2025-26:netInterestMargin":
    "The verified source reports quarterly NIM, not a full-year NIM. No quarterly value was substituted for the annual period.",
  "fy2024-25:netInterestMargin":
    "The 3.54% source value is for Q4 FY2024-25, not the full year, so annual NIM is unavailable.",
  "fy2023-24:netInterestMargin":
    "The comparative 3.4% source value is for a quarter ended March 31, 2024, not the full year, so annual NIM is unavailable.",
  "fy2025-26:roa":
    "A directly reported full-year ROA was not verified; a deterministic calculation may be used only when period-matched opening and closing assets are available.",
  "fy2023-24:roe":
    "ROE cannot be calculated because the verified source snapshot does not contain the opening FY2023-24 net-worth input.",
  "q4-fy2025-26:roe":
    "Quarterly ROE cannot be calculated because the verified source snapshot does not contain net worth as at December 31, 2025.",
};
