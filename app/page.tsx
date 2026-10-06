"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  AIResearchResult,
  Company,
  CompanyMarketSnapshot,
  MarketOverviewItem,
  MarketDataLicenseStatus,
  MarketDelayStatus,
  MarketDataStatus,
  MarketTradingStatus,
  MarketPrice,
  MarketQuote,
} from "@/lib/types/financial";
import type { FundamentalsAnalysis } from "@/lib/types/fundamentals";
import { FundamentalsPanel } from "@/components/fundamentals-panel";
import { DcfPanel } from "@/components/dcf-panel";

const navGroups = [
  {
    title: "RESEARCH",
    items: [
      "Overview",
      "Company Research",
      "Financials",
      "Valuation",
      "DCF Model",
      "Scenarios",
      "Filings",
      "News",
    ],
  },
  {
    title: "TOOLS",
    items: ["Stock Screener", "Company Comparison", "Watchlist", "Portfolio"],
  },
  {
    title: "INTELLIGENCE",
    items: ["AI Research Copilot", "Research Reports"],
  },
  {
    title: "SETTINGS",
    items: ["Settings"],
  },
];

const tabs = ["Overview", "Financials", "Valuation", "DCF", "News", "Risk"];

const marketCards = [
  { label: "NIFTY 50", symbol: "^NSEI" },
  { label: "SENSEX", symbol: "^BSESN" },
  { label: "NIFTY BANK", symbol: "^NSEBANK" },
  { label: "INDIA VIX", symbol: "^INDIAVIX" },
];

const riskDimensions = [
  "Credit Risk",
  "Valuation Risk",
  "Rate Sensitivity",
  "Execution Risk",
];

function marketStatusLabel(
  status: MarketDataStatus,
  delaySeconds: number | null,
): string {
  switch (status) {
    case "DEMO":
      return "DEMO · NOT REAL MARKET DATA";
    case "DELAYED":
      return delaySeconds === null
        ? "DELAYED · DURATION UNKNOWN"
        : `DELAYED · ${delaySeconds}s`;
    case "STALE":
      return "STALE · DO NOT TREAT AS CURRENT";
    case "LIVE":
      return "LIVE";
    case "EOD":
      return "END OF DAY";
    case "UNAVAILABLE":
      return "UNAVAILABLE";
    case "UNKNOWN":
      return "PROVIDER DATA · FRESHNESS UNVERIFIED";
  }
}

function marketObservationLabel(
  status: MarketDataStatus,
  delaySeconds: number | null,
  delayStatus: MarketDelayStatus,
  marketStatus: MarketTradingStatus,
): string {
  const tradingStatus =
    marketStatus === "PRE_OPEN"
      ? "PRE-OPEN"
      : marketStatus === "UNKNOWN"
        ? "SESSION STATUS UNAVAILABLE"
        : marketStatus;
  const delayLabel =
    delayStatus === "DELAYED" && delaySeconds !== null
      ? `DELAYED ${delaySeconds}s`
      : delayStatus.replaceAll("_", " ");
  return `${marketStatusLabel(status, delaySeconds)} · ${delayLabel} · MARKET ${tradingStatus}`;
}

function providerNotConfigured(message: string | null): boolean {
  return Boolean(
    message &&
      (/PROVIDER NOT CONFIGURED/i.test(message) ||
        /provider_not_configured/i.test(message) ||
        /set MARKET_DATA_PROVIDER/i.test(message) ||
        /FYERS_CLIENT_ID/i.test(message)),
  );
}

function marketErrorHeading(message: string | null): string {
  if (!message) {
    return "AWAITING MARKET DATA";
  }
  const category = message.split(" — ", 1)[0];
  return category?.toLocaleUpperCase() || "MARKET DATA UNAVAILABLE";
}

interface ApiErrorPayload {
  error?: string;
  code?: string;
  category?: string;
  credentialStatus?: string;
  status?: string;
}

function marketDataErrorMessage(
  payload: ApiErrorPayload,
  statusCode: number,
  fallback: string,
): string {
  const detail = payload.error ?? `${fallback} (${statusCode}).`;
  switch (payload.category) {
    case "PROVIDER_NOT_CONFIGURED":
      return `PROVIDER NOT CONFIGURED — ${detail}`;
    case "CREDENTIALS_NOT_CONFIGURED":
      return `CREDENTIALS NOT CONFIGURED — ${detail}`;
    case "AUTHENTICATION_FAILED":
      return `CREDENTIALS INVALID OR EXPIRED · AUTHENTICATION FAILED — ${detail}`;
    case "DATA_RIGHTS_NOT_APPROVED":
      return `DATA RIGHTS NOT APPROVED — ${detail}`;
    case "DATA_UNAVAILABLE":
      return `DATA UNAVAILABLE — ${detail}`;
    case "PROVIDER_ERROR":
      return `PROVIDER ERROR — ${detail}`;
    default:
      return detail;
  }
}

function geminiErrorMessage(
  payload: ApiErrorPayload,
  statusCode: number,
): string {
  if (payload.code === "gemini_not_configured" || payload.status === "not_configured") {
    return `GEMINI NOT CONFIGURED — ${payload.error ?? "Set GEMINI_API_KEY on the server."}`;
  }
  return `GEMINI REQUEST FAILED — ${payload.error ?? `Request failed (${statusCode}).`}`;
}

function licenseStatusLabel(status: MarketDataLicenseStatus): string {
  switch (status) {
    case "REQUIRES_REVIEW":
      return "RIGHTS REVIEW PENDING · DATA RETRIEVED";
    case "DISPLAY_ALLOWED":
      return "DISPLAY RIGHTS APPROVED";
    case "REDISTRIBUTION_ALLOWED":
      return "REDISTRIBUTION APPROVED";
    case "INTERNAL_ONLY":
      return "INTERNAL USE ONLY";
    case "UNKNOWN":
      return "RIGHTS STATUS UNKNOWN";
  }
}

function formatIndiaTimestamp(
  value: string | null,
  dateStyle: "short" | "medium" = "medium",
): string {
  if (!value) {
    return "timestamp unavailable";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "timestamp unavailable";
  }
  return `${date.toLocaleString("en-IN", {
    dateStyle,
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  })} IST`;
}

export default function Home() {
  const [search, setSearch] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("HDFCBANK.NS");
  const [company, setCompany] = useState<Company | null>(null);
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [historicalPrices, setHistoricalPrices] = useState<MarketPrice[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [fundamentals, setFundamentals] =
    useState<FundamentalsAnalysis | null>(null);
  const [fundamentalsError, setFundamentalsError] = useState<string | null>(
    null,
  );
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [marketIndicators, setMarketIndicators] = useState<MarketOverviewItem[]>([]);
  const [marketOverviewError, setMarketOverviewError] = useState<string | null>(
    null,
  );
  const [marketOverviewLoaded, setMarketOverviewLoaded] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIResearchResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<
    "checking" | "configured" | "not_configured" | "unknown"
  >("checking");
  const companyRequest = useRef<AbortController | null>(null);
  const analysisRequest = useRef<AbortController | null>(null);

  const loadCompany = useCallback(async (ticker: string) => {
    companyRequest.current?.abort();
    analysisRequest.current?.abort();
    setAnalysisLoading(false);
    const controller = new AbortController();
    companyRequest.current = controller;
    setSelectedTicker(ticker);
    setCompany(null);
    setQuote(null);
    setHistoricalPrices([]);
    setHistoryLoaded(false);
    setFundamentals(null);
    setFundamentalsError(null);
    setCompanyError(null);
    setHistoryError(null);
    setAnalysis(null);
    setAnalysisError(null);
    setCompanyLoading(true);
    setFundamentalsLoading(true);

    try {
      const response = await fetch(
        `/api/company/${encodeURIComponent(ticker)}?includeFundamentals=true`,
        { signal: controller.signal },
      );

      if (!response.ok) {
        const result = (await response.json()) as ApiErrorPayload;
        throw new Error(
          marketDataErrorMessage(
            result,
            response.status,
            "Company market data request failed",
          ),
        );
      }

      const result = (await response.json()) as {
        snapshot: CompanyMarketSnapshot | null;
        fundamentals: FundamentalsAnalysis | null;
        marketError: ApiErrorPayload | null;
      };

      if (result.fundamentals) {
        setFundamentals(result.fundamentals);
      } else {
        setFundamentalsError(
          "Verified fundamentals are unavailable for this company.",
        );
      }

      if (result.marketError) {
        setCompanyError(
          marketDataErrorMessage(
            result.marketError,
            typeof result.marketError.status === "number"
              ? result.marketError.status
              : 503,
            "Company market data is unavailable",
          ),
        );
      }

      const snapshot = result.snapshot;
      if (!snapshot) {
        if (!result.marketError) {
          setCompanyError(
            "DATA UNAVAILABLE — The selected market-data provider does not support this ticker.",
          );
        }
        return;
      }

      setCompany(snapshot.company);
      setQuote(snapshot.quote);

      try {
        const historyResponse = await fetch(
          `/api/company/${encodeURIComponent(snapshot.company.ticker)}/prices?range=1mo`,
          { signal: controller.signal },
        );

        if (!historyResponse.ok) {
          const result = (await historyResponse.json()) as ApiErrorPayload;
          throw new Error(
            marketDataErrorMessage(
              result,
              historyResponse.status,
              "Price history request failed",
            ),
          );
        }

        const history = (await historyResponse.json()) as {
          prices: MarketPrice[];
        };
        setHistoricalPrices(history.prices);
        setHistoryLoaded(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setHistoryError(
          error instanceof Error ? error.message : "Price history unavailable.",
        );
        setHistoryLoaded(true);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setCompanyError(
        error instanceof Error ? error.message : "Company data is unavailable.",
      );
      setFundamentalsError(
        error instanceof Error
          ? error.message
          : "Official fundamentals are unavailable.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setCompanyLoading(false);
        setFundamentalsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMarketOverview() {
      setMarketOverviewLoaded(false);
      try {
        const response = await fetch("/api/market/overview", {
          signal: controller.signal,
        });

        if (!response.ok) {
          const result = (await response.json()) as ApiErrorPayload;
          throw new Error(
            marketDataErrorMessage(
              result,
              response.status,
              "Market overview request failed",
            ),
          );
        }

        const result = (await response.json()) as {
          indicators: MarketOverviewItem[];
        };
        setMarketIndicators(result.indicators);
        setMarketOverviewLoaded(true);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setMarketOverviewLoaded(true);
        setMarketOverviewError(
          error instanceof Error
            ? error.message
            : "Market overview is unavailable.",
        );
      }
    }

    const startupTask = setTimeout(() => {
      void loadCompany("HDFCBANK.NS");
      void loadMarketOverview();
      void fetch("/api/ai/analyze", { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Gemini status request failed (${response.status}).`,
            );
          }
          const result = (await response.json()) as {
            configured?: boolean;
            status?: string;
          };
          setGeminiStatus(
            result.configured ? "configured" : "not_configured",
          );
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setGeminiStatus("unknown");
        });
    });

    return () => {
      clearTimeout(startupTask);
      controller.abort();
      companyRequest.current?.abort();
      analysisRequest.current?.abort();
    };
  }, [loadCompany]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();

    if (!query) {
      setSearchError("Enter an NSE ticker or company name.");
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const response = await fetch(
        `/api/company/search?q=${encodeURIComponent(query)}`,
      );
      const result = (await response.json()) as {
        companies?: Company[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? `Search failed (${response.status}).`);
      }

      if (!result.companies?.length) {
        setSearchError("No matching company in the supported NSE universe.");
        return;
      }

      setSearchResults(result.companies);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "Company search is unavailable.",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  async function runAnalysis() {
    if (!company && !fundamentals) {
      setAnalysisError("Load a company before requesting an AI analysis.");
      return;
    }

    analysisRequest.current?.abort();
    const controller = new AbortController();
    analysisRequest.current = controller;
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysis(null);

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: company?.ticker ?? selectedTicker }),
        signal: controller.signal,
      });
      const result = (await response.json()) as
        | AIResearchResult
        | { error?: string };

      if (!response.ok || !("analysis" in result)) {
        throw new Error(
          geminiErrorMessage(
            "error" in result ? result : {},
            response.status,
          ),
        );
      }

      setAnalysis(result);
      setGeminiStatus("configured");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setAnalysisError(
        error instanceof Error ? error.message : "AI analysis unavailable.",
      );
    } finally {
      if (!controller.signal.aborted) {
        setAnalysisLoading(false);
      }
    }
  }

  const closeValues = historicalPrices.map((price) => price.close);
  const closeMin = closeValues.length ? Math.min(...closeValues) : 0;
  const closeMax = closeValues.length ? Math.max(...closeValues) : 0;
  const closeRange = closeMax - closeMin || 1;
  const chartPoints = historicalPrices
    .map((price, index) => {
      const x =
        historicalPrices.length > 1
          ? (index / (historicalPrices.length - 1)) * 100
          : 50;
      const y = 46 - ((price.close - closeMin) / closeRange) * 40;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <main className="min-h-screen bg-[#090b0e] text-[#edf3f8]">
      <header className="border-b border-[#191f27] bg-[#090b0e]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-[1800px] items-center justify-between gap-4 px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f5f8] text-[11px] font-black tracking-[0.18em] text-[#0a0d10]">
              EM
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.26em] text-[#f2f5f8]">
                EQUITYMIND AI
              </div>
              <div className="text-[9px] uppercase tracking-[0.32em] text-[#7d8896]">
                AI EQUITY RESEARCH TERMINAL
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSearch}
            className="hidden flex-1 justify-center xl:flex"
          >
            <div className="flex w-full max-w-[620px] items-center gap-3 rounded-xl border border-[#1e252d] bg-[#11171d] px-4 py-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <span className="text-base text-[#7d8896]">⌕</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search company, ticker or sector..."
                className="w-full bg-transparent text-sm text-[#edf3f8] placeholder:text-[#6b7684] focus:outline-none"
              />
              <button type="submit" className="sr-only">
                Search companies
              </button>
            </div>
          </form>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full border border-[#1e252d] bg-[#11171d] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#efc86b] md:block">
              {quote
                ? marketObservationLabel(
                    quote.dataStatus,
                    quote.delaySeconds,
                    quote.delayStatus,
                    quote.marketStatus,
                  )
                : providerNotConfigured(companyError)
                  ? "MARKET DATA · PROVIDER NOT CONFIGURED"
                  : companyError
                    ? `MARKET DATA · ${marketErrorHeading(companyError)}`
                    : "Awaiting market data"}
            </div>
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1e252d] bg-[#11171d] text-xs font-medium text-[#d8e0e8]">
              ⏺
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1e252d] bg-[#1d2430] text-[11px] font-semibold text-[#edf3f8]">
              AM
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1800px]">
        <aside className="hidden min-h-[calc(100vh-74px)] w-[250px] border-r border-[#191f27] bg-[#0d1116] p-4 lg:block">
          <div className="space-y-7 pt-3">
            {navGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-3 px-3 text-[10px] font-medium uppercase tracking-[0.28em] text-[#687481]">
                  {group.title}
                </div>
                <nav className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = item === "Overview";

                    return (
                      <button
                        key={item}
                        type="button"
                        disabled={!isActive}
                        title={
                          isActive
                            ? "Current workspace"
                            : `${item} is not available in this release.`
                        }
                        aria-current={isActive ? "page" : undefined}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          isActive
                            ? "border-[#1d2d41] bg-[#111b27] text-[#edf3f8] shadow-[inset_0_0_0_1px_rgba(109,157,255,0.18)]"
                            : "cursor-not-allowed border-transparent text-[#626c78]"
                        }`}
                      >
                        <span>{item}</span>
                        {isActive ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#78b5ff]" />
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 p-5 lg:p-6">
          <section className="mb-6 border-b border-[#191f27] pb-5">
            <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#7d8896]">
              <span className="h-2 w-2 rounded-full bg-[#46d39a]" />
              Research terminal online
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#f7f9fb] md:text-4xl">
                  Equity Research Workspace
                </h1>
                <p className="mt-2 text-sm text-[#8d98a8]">
                  Fundamental intelligence for better financial analysis.
                </p>
              </div>

              <form
                onSubmit={handleSearch}
                className="flex w-full max-w-[540px] items-center gap-3 rounded-xl border border-[#1e252d] bg-[#11171d] px-3 py-2.5 xl:max-w-[520px]"
              >
                <span className="text-sm text-[#7d8896]">⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search supported NSE ticker or company..."
                  className="w-full bg-transparent text-sm text-[#edf3f8] placeholder:text-[#6e7a88] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="rounded-md border border-[#283644] px-3 py-1.5 text-xs text-[#dfeaf5] hover:bg-[#19232d] disabled:opacity-50"
                >
                  {searchLoading ? "Searching" : "Search"}
                </button>
              </form>
            </div>
            {searchError ? (
              <p className="mt-2 text-xs text-[#f0a78f]" role="alert">
                {searchError}
              </p>
            ) : null}
            {searchResults.length ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-[#1e252d] bg-[#10171d]">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setSearch(result.ticker);
                      setSearchResults([]);
                      setSearchError(null);
                      void loadCompany(result.ticker);
                    }}
                    className="flex w-full items-center justify-between border-b border-[#1a2129] px-4 py-3 text-left last:border-0 hover:bg-[#17212b]"
                  >
                    <span className="text-sm text-[#edf3f8]">{result.name}</span>
                    <span className="text-xs text-[#8d98a8]">
                      {result.ticker} · {result.exchange}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="mb-6 rounded-[18px] border border-[#1a2129] bg-[#10161c] p-4">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#eef3f7] text-xl font-bold text-[#0d1116]">
                  {company?.name.charAt(0).toLocaleUpperCase() ?? "—"}
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-[#7d8896]">
                    Selected company
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#f5f8fb]">
                    {company?.name ??
                      (companyLoading ? "Loading company…" : "Company unavailable")}
                  </div>
                  <div className="mt-1 text-xs text-[#8d98a8]">
                    {company
                      ? `${company.ticker} • ${company.exchange} • ${company.sector ?? "Sector unavailable"}`
                      : selectedTicker}
                  </div>
                  <div
                    className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#efc86b]"
                    role={companyError ? "alert" : undefined}
                  >
                    {companyError
                      ? providerNotConfigured(companyError)
                        ? "Market data unavailable · Provider not configured"
                        : `Market data unavailable: ${companyError}`
                      : quote
                        ? `${quote.provider.toUpperCase()} · ${marketObservationLabel(quote.dataStatus, quote.delaySeconds, quote.delayStatus, quote.marketStatus)} · ${licenseStatusLabel(quote.licenseStatus)} · as of ${formatIndiaTimestamp(quote.marketTimestamp ?? quote.asOf)}`
                        : companyLoading
                          ? "Loading market data…"
                          : "Market data unavailable"}
                  </div>
                  {company?.sourceUrl ? (
                    <a
                      href={company.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[10px] text-[#9fc2ff] underline underline-offset-2"
                    >
                      Source: {company.source}
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  title="Watchlists are not implemented yet."
                  className="rounded-lg border border-[#1f2a33] bg-[#0f151b] px-3.5 py-2 text-sm text-[#dfeaf5] opacity-50"
                >
                  + Watchlist
                </button>
                <button
                  type="button"
                  disabled
                  title="Report generation is not implemented yet."
                  className="rounded-lg bg-[#f3f6f9] px-3.5 py-2 text-sm font-semibold text-[#0b0d10] opacity-50"
                >
                  Report unavailable
                </button>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.28em] text-[#7d8896]">
              Market overview
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {marketCards.map((card) => {
                const item = marketIndicators.find(
                  (item) => item.symbol === card.symbol,
                );
                const indicator =
                  item && !("status" in item) ? item : undefined;
                const unavailable =
                  item && "status" in item ? item : undefined;
                const positive = (indicator?.change ?? 0) >= 0;

                return (
                  <div
                    key={card.label}
                    className="rounded-[16px] border border-[#1a2129] bg-[#0f151b] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[#7d8896]">
                        {card.label}
                      </div>
                      {indicator ? (
                        <span className="rounded-full border border-[#4b3c1e] bg-[#282216] px-2 py-1 text-[9px] font-medium text-[#efc86b]">
                          {marketObservationLabel(
                            indicator.dataStatus,
                            indicator.delaySeconds,
                            indicator.delayStatus,
                            indicator.marketStatus,
                          )}
                        </span>
                      ) : unavailable ? (
                        <span className="rounded-full border border-[#4b3c1e] bg-[#282216] px-2 py-1 text-[9px] font-medium text-[#efc86b]">
                          UNAVAILABLE · {unavailable.code.replaceAll("_", " ")}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 text-[30px] font-semibold leading-none tracking-[-0.06em] text-[#f8fbff]">
                      {indicator
                        ? new Intl.NumberFormat("en-IN", {
                            maximumFractionDigits: 2,
                          }).format(indicator.value)
                        : unavailable
                          ? "UNAVAILABLE"
                        : marketOverviewError
                          ? marketErrorHeading(marketOverviewError)
                          : marketOverviewLoaded
                            ? "UNAVAILABLE"
                            : "Loading…"}
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div
                        className={`text-sm font-medium ${
                          indicator
                            ? positive
                              ? "text-[#68d7a7]"
                              : "text-[#f0a78f]"
                            : "text-[#8d98a8]"
                        }`}
                      >
                        {indicator
                          ? `${indicator.change < 0 ? "−" : "+"}${new Intl.NumberFormat("en-IN", {
                              maximumFractionDigits: 2,
                            }).format(Math.abs(indicator.change))} (${indicator.changePercent < 0 ? "" : "+"}${indicator.changePercent.toFixed(2)}%)`
                          : unavailable
                            ? unavailable.error
                          : "—"}
                      </div>
                      <div className="text-right text-[10px] text-[#8d98a8]">
                        {indicator
                          ? indicator.asOf
                            ? formatIndiaTimestamp(indicator.asOf, "short")
                            : "Provider timestamp unavailable"
                          : unavailable
                            ? "No provider quote returned"
                          : marketOverviewError
                            ? marketErrorHeading(marketOverviewError)
                            : marketOverviewLoaded
                              ? "No quote returned by provider"
                              : "Awaiting source"}
                      </div>
                    </div>
                    {indicator?.sourceUrl ? (
                      <a
                        href={indicator.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-[10px] text-[#9fc2ff] underline underline-offset-2"
                      >
                        {indicator.source}
                      </a>
                    ) : null}
                    {indicator?.licenseStatus === "REQUIRES_REVIEW" ? (
                      <div className="mt-2 text-[9px] uppercase tracking-[0.14em] text-[#d5b86e]">
                        Display rights review pending · quote retrieval succeeded
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-[20px] border border-[#1a2129] bg-[#10161c] p-4 md:p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-end gap-3">
                <div className="text-[10px] uppercase tracking-[0.28em] text-[#7d8896]">
                  {quote                   ? `${quote.provider.toUpperCase()} market quote` : "Market price"}
                </div>
                <div className="text-4xl font-semibold tracking-[-0.08em] text-[#f5f8fb]">
                  {quote
                    ? new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: quote.currency,
                        minimumFractionDigits: 2,
                      }).format(quote.price)
                    : companyLoading
                      ? "Loading…"
                      : "Data unavailable"}
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span
                  className={
                    quote && quote.change < 0
                      ? "text-[#f0a78f]"
                      : "text-[#68d7a7]"
                  }
                >
                  {quote
                    ? `${quote.change < 0 ? "-" : "+"}${new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: quote.currency,
                        minimumFractionDigits: 2,
                      }).format(Math.abs(quote.change))}`
                    : "—"}
                </span>
                <span
                  className={
                    quote && quote.changePercent < 0
                      ? "text-[#f0a78f]"
                      : "text-[#68d7a7]"
                  }
                >
                  {quote
                    ? `${quote.changePercent < 0 ? "" : "+"}${quote.changePercent.toFixed(2)}%`
                    : "—"}
                </span>
                {quote ? (
                  <span className="rounded-lg border border-[#4b3c1e] bg-[#282216] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#efc86b]">
                    {marketObservationLabel(
                      quote.dataStatus,
                      quote.delaySeconds,
                      quote.delayStatus,
                      quote.marketStatus,
                    )}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="min-h-[96px] rounded-xl border border-[#1a2129] bg-[#0d1318] p-3">
                <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-[#7d8896]">
                  <span>Historical daily close · 1 month</span>
                  <span>
                    {historicalPrices.length
                      ? `${historicalPrices.length} sessions · ${marketStatusLabel(historicalPrices[0].dataStatus, historicalPrices[0].delaySeconds)} · ${licenseStatusLabel(historicalPrices[0].licenseStatus)}`
                      : historyError
                        ? "Unavailable"
                        : historyLoaded
                          ? "No observations returned"
                          : "Loading…"}
                  </span>
                </div>
                {historicalPrices.length > 1 ? (
                  <svg
                    viewBox="0 0 100 52"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Historical daily closing prices"
                    className="h-[68px] w-full overflow-visible"
                  >
                    <polyline
                      points={chartPoints}
                      fill="none"
                      stroke="#78b5ff"
                      strokeWidth="1.4"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                ) : (
                  <div className="flex h-[68px] items-center text-xs text-[#8d98a8]">
                    {historyError ??
                      (historyLoaded
                        ? "No historical observations were returned for this range."
                        : "Loading historical prices…")}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs md:min-w-[280px]">
                <div className="rounded-xl border border-[#1a2129] bg-[#0d1318] p-3">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#7d8896]">Day high</div>
                  <div className="mt-2 font-medium text-[#edf3f8]">
                    {quote?.dayHigh !== null && quote?.dayHigh !== undefined
                      ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(quote.dayHigh)
                      : "Unavailable"}
                  </div>
                </div>
                <div className="rounded-xl border border-[#1a2129] bg-[#0d1318] p-3">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#7d8896]">Day low</div>
                  <div className="mt-2 font-medium text-[#edf3f8]">
                    {quote?.dayLow !== null && quote?.dayLow !== undefined
                      ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(quote.dayLow)
                      : "Unavailable"}
                  </div>
                </div>
                <div className="rounded-xl border border-[#1a2129] bg-[#0d1318] p-3">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#7d8896]">Volume</div>
                  <div className="mt-2 font-medium text-[#edf3f8]">
                    {quote?.volume !== null && quote?.volume !== undefined
                      ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(quote.volume)
                      : "Unavailable"}
                  </div>
                </div>
                <div className="rounded-xl border border-[#1a2129] bg-[#0d1318] p-3">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#7d8896]">Exchange</div>
                  <div className="mt-2 font-medium text-[#edf3f8]">
                    {quote?.exchange ?? "Unavailable"}
                  </div>
                </div>
              </div>
            </div>
            {quote?.sourceUrl ? (
              <div className="mt-3 text-[10px] text-[#8d98a8]">
                As of {formatIndiaTimestamp(quote.marketTimestamp ?? quote.asOf)} · {quote.sourceType} ·{" "}
                <a
                  href={quote.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#9fc2ff] underline underline-offset-2"
                >
                  {quote.source}
                </a>
              </div>
            ) : null}

            <div className="mt-5 flex gap-2 overflow-x-auto border-b border-[#191f27] pb-3">
              {tabs.map((tab) => {
                const isAvailable = tab === "Overview";
                return (
                  <button
                    key={tab}
                    type="button"
                    disabled={!isAvailable}
                    title={
                      isAvailable
                        ? "Current workspace"
                        : `${tab} view is not available in this release.`
                    }
                    aria-current={isAvailable ? "page" : undefined}
                    className={`whitespace-nowrap border-b-2 px-2 pb-2 text-sm transition ${
                      isAvailable
                        ? "border-[#dfeaf5] text-[#f7f9fb]"
                        : "cursor-not-allowed border-transparent text-[#626c78]"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_0.9fr]">
              <div className="space-y-5">
                <div>
                  <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-[#7d8896]">
                    HDFC Bank fundamentals
                  </div>
                  <FundamentalsPanel
                    fundamentals={fundamentals}
                    isLoading={fundamentalsLoading}
                    error={fundamentalsError}
                  />
                </div>

                <div className="rounded-[16px] border border-[#1a2129] bg-[#0d1318] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-[#7d8896]">
                        AI analyst
                      </div>
                      <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#f5f8fb]">
                        Investment intelligence
                      </h2>
                    </div>
                    <div className="rounded-lg border border-[#1b2430] bg-[#101820] px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#8d98a8]">
                      GEMINI · {geminiStatus.replaceAll("_", " ")}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-[#8d98a8]">
                      Explanatory research only—not a substitute for verified financial data or investment advice. Gemini does not calculate financial metrics.
                    </p>
                    <button
                      type="button"
                      onClick={() => void runAnalysis()}
                      disabled={
                        analysisLoading ||
                        (!company && !fundamentals) ||
                        companyLoading
                      }
                      className="rounded-lg bg-[#e9eef5] px-3.5 py-2 text-xs font-semibold text-[#0b0d10] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {analysisLoading ? "Analyzing…" : "Run AI Analysis"}
                    </button>
                  </div>

                  <div className="mt-4 rounded-[14px] border border-[#1a2129] bg-[#101821] p-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#7d8896]">
                      Gemini research analysis
                    </div>
                    <div className="mt-2 text-[10px] text-[#8d98a8]">
                      Connection:{" "}
                      <span className="uppercase">
                        {geminiStatus.replaceAll("_", " ")}
                      </span>
                      {analysis ? ` · Status: ${analysis.status.replaceAll("_", " ")}` : ""}
                    </div>
                    <div className="mt-2 rounded-lg border border-[#1a2129] bg-[#0d1318] p-2 text-[10px] text-[#8d98a8]">
                      <div className="font-medium uppercase tracking-[0.12em] text-[#aab5c1]">
                        Data supplied to Gemini
                      </div>
                      {analysis ? (
                        <div className="mt-1 space-y-1">
                          <div>
                            Market data:{" "}
                            {analysis.suppliedData.marketDataAvailable
                              ? `${analysis.suppliedData.marketProvider?.toUpperCase() ?? "Provider"} · ${analysis.suppliedData.marketSource ?? "source unavailable"} · as of ${analysis.suppliedData.marketAsOf ?? "timestamp unavailable"} · ${analysis.suppliedData.historicalPriceCount} history observations`
                              : "Unavailable; no quote or price history supplied"}
                          </div>
                          <div>
                            Fundamentals:{" "}
                            {analysis.suppliedData.fundamentalsAvailable
                              ? `${analysis.suppliedData.fundamentalsStatus} · ${analysis.suppliedData.reportingPeriods.join(", ")}`
                              : "Unavailable"}
                          </div>
                          <div>
                            Financial sources:
                            {analysis.suppliedData.financialSources.length ? (
                              <ul className="mt-1 list-disc space-y-1 pl-4">
                                {analysis.suppliedData.financialSources.map(
                                  (source) => (
                                    <li key={source.sourceUrl}>
                                      <a
                                        href={source.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[#9fc2ff] underline underline-offset-2"
                                      >
                                        {source.source}
                                      </a>{" "}
                                      · published {source.publicationDate} ·
                                      retrieved {source.retrievedAt}
                                    </li>
                                  ),
                                )}
                              </ul>
                            ) : (
                              " No financial sources supplied."
                            )}
                          </div>
                          <div>
                            Latest supplied-data retrieval:{" "}
                            {analysis.suppliedData.latestDataRetrievedAt
                              ? new Date(
                                  analysis.suppliedData.latestDataRetrievedAt,
                                ).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                  timeZone: "Asia/Kolkata",
                                }) + " IST"
                              : "Unavailable"}
                          </div>
                          <div>
                            Analysis generated:{" "}
                            {new Date(analysis.analyzedAt).toLocaleString(
                              "en-IN",
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                                timeZone: "Asia/Kolkata",
                              },
                            )}{" "}
                            IST · {analysis.modelName}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1">
                          {fundamentals
                            ? `Verified HDFC Bank fundamentals · ${fundamentals.periods.map((period) => period.label).join(", ")} · ${fundamentals.provenance.length} source references.`
                            : "No verified fundamentals are currently loaded."}{" "}
                          {quote
                            ? `${quote.provider.toUpperCase()} market quote · ${quote.source}.`
                            : "No market quote is supplied while the market provider is unavailable."}
                        </div>
                      )}
                    </div>
                    {analysisError ? (
                      <p className="mt-3 text-sm leading-6 text-[#f0a78f]" role="alert">
                        {analysisError}
                      </p>
                    ) : analysis ? (
                      <div className="mt-3 space-y-4">
                        <div>
                          <div className="text-sm font-medium text-[#edf3f8]">
                            Executive summary
                          </div>
                          <p className="mt-1 text-sm leading-6 text-[#b4bec9]">
                            {analysis.analysis.executiveSummary}
                          </p>
                        </div>
                        {(
                          [
                            ["Business quality", analysis.analysis.businessQuality],
                            ["Financial strength", analysis.analysis.financialStrength],
                            ["Valuation observation", analysis.analysis.valuationObservation],
                          ] as const
                        ).map(([title, value]) => (
                          <div key={title}>
                            <div className="text-xs font-medium text-[#dfeaf5]">{title}</div>
                            <p className="mt-1 text-xs leading-5 text-[#8d98a8]">{value}</p>
                          </div>
                        ))}
                        {(
                          [
                            ["Growth drivers", analysis.analysis.growthDrivers],
                            ["Key risks", analysis.analysis.keyRisks],
                            ["Catalysts", analysis.analysis.catalysts],
                            ["Red flags", analysis.analysis.redFlags],
                            ["Research questions", analysis.analysis.researchQuestions],
                            ["Data limitations", analysis.analysis.dataLimitations],
                          ] as const
                        ).map(([title, items]) => (
                          <div key={title}>
                            <div className="text-xs font-medium text-[#dfeaf5]">{title}</div>
                            <ul className="mt-1 list-inside list-disc space-y-1 text-xs leading-5 text-[#8d98a8]">
                              {items.map((item, index) => (
                                <li key={`${title}-${index}`}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        <div className="border-t border-[#1a2129] pt-3 text-[10px] text-[#778391]">
                          Powered by Gemini · Model {analysis.modelName} · Based on{" "}
                          {analysis.company.provider.toUpperCase()} market data (
                          {marketObservationLabel(
                            analysis.company.dataStatus,
                            analysis.company.delaySeconds,
                            analysis.company.delayStatus,
                            analysis.company.marketStatus,
                          )}
                          , license{" "}
                          {licenseStatusLabel(analysis.company.licenseStatus)}), as of{" "}
                          {new Date(analysis.company.retrievedAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Kolkata",
                          })}{" "}
                          IST
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-[#8d98a8]">
                        {analysisLoading
                          ? "Preparing an explanation from the verified data shown above…"
                          : geminiStatus === "not_configured"
                            ? "Gemini is not configured. Add GEMINI_API_KEY to the server environment; the key is never sent to the browser."
                            : "No AI analysis has been generated. Gemini will only explain the supplied sourced data; filings, earnings, and news are not connected."}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <DcfPanel ticker={selectedTicker} />

                <div className="rounded-[16px] border border-[#1a2129] bg-[#0d1318] p-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[#7d8896]">
                    Risk profile
                  </div>
                  <div className="mt-4 space-y-3">
                    {riskDimensions.map((item) => (
                      <div
                        key={item}
                        className="flex items-center justify-between rounded-[12px] border border-[#1a2129] bg-[#10171d] px-3 py-2.5"
                      >
                        <span className="text-sm text-[#dfeaf5]">{item}</span>
                        <span className="text-xs font-medium text-[#8d98a8]">
                          Not assessed
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[18px] border border-[#1a2129] bg-[#10161c] p-4">
              <div className="mb-4 text-[10px] uppercase tracking-[0.24em] text-[#7d8896]">
                Earnings & catalysts
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[14px] border border-[#1a2129] bg-[#0d1318] p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#7d8896]">
                    Earnings
                  </div>
                  <div className="mt-3 text-lg font-semibold text-[#b4bec9]">Data unavailable</div>
                  <div className="mt-2 text-sm text-[#8d98a8]">Earnings data is not connected.</div>
                </div>

                <div className="rounded-[14px] border border-[#1a2129] bg-[#0d1318] p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#7d8896]">
                    Market signal
                  </div>
                  <div className="mt-3 text-lg font-semibold text-[#b4bec9]">Not calculated</div>
                  <div className="mt-2 text-sm text-[#8d98a8]">No technical-signal analysis is implemented.</div>
                </div>

                <div className="rounded-[14px] border border-[#1a2129] bg-[#0d1318] p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#7d8896]">
                    Coverage
                  </div>
                  <div className="mt-3 text-lg font-semibold text-[#b4bec9]">Not calculated</div>
                  <div className="mt-2 text-sm text-[#8d98a8]">Financial and valuation coverage is not connected.</div>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-[#1a2129] bg-[#10161c] p-4">
              <div className="mb-4 text-[10px] uppercase tracking-[0.24em] text-[#7d8896]">
                Latest news
              </div>
              <div className="rounded-[12px] border border-[#1a2129] bg-[#0d1318] p-4 text-sm text-[#8d98a8]">
                News and company filings are not connected. No headlines are
                available.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
