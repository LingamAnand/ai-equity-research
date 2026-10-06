import type {
  Company,
  MarketPrice,
  MarketQuote,
} from "@/lib/types/financial";
import { getIndiaMarketStatus } from "../market-data/india-market-status";

const demoRetrievedAt = "2026-09-28T00:00:00.000Z";
const demoSource = {
  source: "EquityMind controlled demo dataset",
  sourceType: "demo" as const,
  sourceUrl: null,
  retrievedAt: demoRetrievedAt,
  provider: "demo" as const,
  dataStatus: "DEMO" as const,
  delaySeconds: null,
  delayStatus: "NOT_APPLICABLE" as const,
  marketStatus: getIndiaMarketStatus().status,
  isUnofficial: false,
  licenseStatus: "INTERNAL_ONLY" as const,
};

export const demoCompany: Company = {
  id: "c63e7174-3f60-4c2b-9c8e-462ca8849676",
  ticker: "HDFCBANK",
  exchange: "NSE",
  instrument: "HDFCBANK",
  asOf: null,
  marketTimestamp: null,
  name: "HDFC Bank",
  countryCode: "IN",
  currency: "INR",
  sector: "Banking",
  industry: "Diversified Banks",
  marketCap: null,
  isActive: true,
  ...demoSource,
  createdAt: demoRetrievedAt,
  updatedAt: demoRetrievedAt,
};

export const demoQuote: MarketQuote = {
  companyId: demoCompany.id,
  exchange: "NSE",
  instrument: demoCompany.ticker,
  ticker: demoCompany.ticker,
  symbol: demoCompany.ticker,
  asOf: demoRetrievedAt,
  marketTimestamp: demoRetrievedAt,
  open: 1718.0,
  high: 1751.2,
  low: 1712.6,
  price: 1742.6,
  previousClose: 1711.48,
  change: 31.12,
  changePercent: 1.8187,
  dayHigh: 1751.2,
  dayLow: 1712.6,
  volume: 9062700,
  currency: "INR",
  ...demoSource,
};

export const demoHistoricalPrices: MarketPrice[] = [
  { date: "2026-09-22", open: 1694.2, high: 1718.5, low: 1688.1, close: 1710.3, adjustedClose: 1710.3, volume: 8423100 },
  { date: "2026-09-23", open: 1712.0, high: 1724.9, low: 1701.6, close: 1718.4, adjustedClose: 1718.4, volume: 7638400 },
  { date: "2026-09-24", open: 1716.3, high: 1720.0, low: 1699.8, close: 1705.2, adjustedClose: 1705.2, volume: 6941200 },
  { date: "2026-09-25", open: 1708.1, high: 1721.7, low: 1698.4, close: 1711.48, adjustedClose: 1711.48, volume: 7156600 },
  { date: "2026-09-28", open: 1718.0, high: 1751.2, low: 1712.6, close: 1742.6, adjustedClose: 1742.6, volume: 9062700 },
].map((price, index): MarketPrice => ({
  id: `demo-price-${index + 1}`,
  companyId: demoCompany.id,
  asOf: `${price.date}T10:00:00.000Z`,
  marketTimestamp: `${price.date}T10:00:00.000Z`,
  instrument: demoCompany.ticker,
  exchange: "NSE",
  currency: demoCompany.currency,
  ...price,
  ...demoSource,
}));
