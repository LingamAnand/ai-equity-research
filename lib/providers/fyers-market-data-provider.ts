import type {
  Company,
  HistoricalPriceRange,
  MarketDataLicenseStatus,
  MarketDataStatus,
  MarketIndicator,
  MarketOverviewItem,
  MarketPrice,
  MarketQuote,
} from "../types/financial.ts";
import { getIndiaMarketStatus } from "../market-data/india-market-status.ts";
import { MarketDataError } from "./market-data-error.ts";
import type { MarketDataProvider } from "./market-data-provider.ts";
import {
  fyersEquityInstruments,
  fyersOverviewInstruments,
  normalizeFyersSymbol,
  resolveFyersEquityInstrument,
  type FyersEquityInstrument,
} from "./fyers-symbols.ts";

const FYERS_API_ORIGIN = "https://api-t1.fyers.in";
const FYERS_DATA_API_BASE_URL = `${FYERS_API_ORIGIN}/data`;
const FYERS_DOCS_URL = "https://myapi.fyers.in/docsv3";
const FYERS_SOURCE = "FYERS API v3";
const REQUEST_TIMEOUT_MS = 10_000;
const FYERS_API_VERSION = "2.0";
let requestQueue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

interface FyersCredentials {
  clientId: string;
  accessToken: string;
  licenseStatus?: Company["licenseStatus"];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function epochNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function providerDataStatus(value: string | null): MarketDataStatus {
  if (value === "ok") {
    return "UNKNOWN";
  }
  return "UNAVAILABLE";
}

function failForStatus(status: number): never {
  if (status === 401 || status === 403) {
    throw new MarketDataError(
      "FYERS authentication failed. Regenerate the server-side access token.",
      "authentication_failed",
      "fyers",
    );
  }
  if (status === 429) {
    throw new MarketDataError(
      "FYERS rate limit was reached. Retry after the provider's cooldown.",
      "rate_limited",
      "fyers",
    );
  }
  if (status === 400 || status === 404 || status === 405 || status === 422) {
    throw new MarketDataError(
      "FYERS does not support the requested symbol or market-data request.",
      "unsupported_request",
      "fyers",
    );
  }
  throw new MarketDataError(
    "FYERS market-data service is unavailable.",
    "provider_unavailable",
    "fyers",
  );
}

function networkFailureClassification(error: unknown): string {
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "TIMEOUT";
  }

  let cause: unknown = error;
  for (let depth = 0; depth < 3 && isRecord(cause); depth += 1) {
    const code = cause.code;
    if (typeof code === "string") {
      if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA") {
        return "DNS_FAILURE";
      }
      if (
        code.startsWith("ECONN") ||
        code === "ETIMEDOUT" ||
        code === "UND_ERR_CONNECT_TIMEOUT" ||
        code === "ENETUNREACH" ||
        code === "EHOSTUNREACH"
      ) {
        return code.includes("TIMEOUT") ? "TIMEOUT" : "NETWORK_FAILURE";
      }
    }
    cause = cause.cause;
  }

  return error instanceof Error && error.name === "AbortError"
    ? "TIMEOUT"
    : "NETWORK_FAILURE";
}

function safeProviderText(
  value: unknown,
  credentials: FyersCredentials,
  maxLength: number,
): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const text = String(value);
  if (
    credentials.accessToken.length > 0 &&
    text.includes(credentials.accessToken)
  ) {
    return null;
  }
  if (credentials.clientId.length > 0 && text.includes(credentials.clientId)) {
    return null;
  }
  if (
    /access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|auth[_ -]?code|authorization|cookie|bearer/i.test(
      text,
    )
    || /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/.test(text)
  ) {
    return null;
  }
  return text.replace(/[\r\n\t]/g, " ").slice(0, maxLength);
}

function validProviderResponse(payload: unknown): JsonRecord {
  if (!isRecord(payload)) {
    throw new MarketDataError(
      "FYERS returned a malformed market-data response.",
      "malformed_response",
      "fyers",
    );
  }
  if (payload.s !== "ok") {
    const code = finiteNumber(payload.code);
    if (
      code === -8 ||
      code === -15 ||
      code === -16 ||
      code === -17 ||
      code === -50
    ) {
      throw new MarketDataError(
        "FYERS authentication failed. Regenerate the server-side access token.",
        "authentication_failed",
        "fyers",
      );
    }
    throw new MarketDataError(
      "FYERS did not return market data for the requested symbol.",
      "not_found",
      "fyers",
    );
  }
  return payload;
}

interface FyersRequestContext {
  endpoint: "/data/quotes" | "/data/history";
  category: "quote" | "overview" | "history";
  symbol: string;
}

function asOf(epoch: number | null): string | null {
  if (epoch === null) {
    return null;
  }
  const milliseconds = epoch > 10_000_000_000 ? epoch : epoch * 1000;
  const date = new Date(milliseconds);
  return Number.isNaN(date.valueOf()) ||
    date.getUTCFullYear() < 2000 ||
    date.getUTCFullYear() > 2100
    ? null
    : date.toISOString();
}

function companyFor(
  instrument: FyersEquityInstrument,
  retrievedAt: string,
  licenseStatus: MarketDataLicenseStatus,
): Company {
  return {
    id: `fyers:${instrument.symbol}`,
    ticker: instrument.ticker,
    exchange: instrument.exchange,
    name: instrument.name,
    countryCode: "IN",
    currency: instrument.currency,
    sector: null,
    industry: null,
    marketCap: null,
    isActive: true,
    provider: "fyers",
    instrument: instrument.symbol,
    asOf: null,
    marketTimestamp: null,
    dataStatus: "UNKNOWN",
    delaySeconds: null,
    delayStatus: "UNKNOWN",
    marketStatus: getIndiaMarketStatus(new Date(retrievedAt)).status,
    isUnofficial: false,
    licenseStatus,
    source: "FYERS-supported instrument mapping",
    sourceType: "public_api",
    sourceUrl: FYERS_DOCS_URL,
    retrievedAt,
    createdAt: retrievedAt,
    updatedAt: retrievedAt,
  };
}

function quoteFromRow(
  companyId: string,
  ticker: string,
  symbol: string,
  exchange: string,
  row: unknown,
  retrievedAt: string,
  licenseStatus: MarketDataLicenseStatus,
): MarketQuote {
  if (!isRecord(row)) {
    throw new MarketDataError(
      "FYERS returned malformed quote fields.",
      "malformed_response",
      "fyers",
    );
  }
  const price = finiteNumber(row.lp);
  const previousClose = finiteNumber(row.prev_close_price);
  const timestamp =
    epochNumber(row.exch_feed_time) ??
    epochNumber(row.last_traded_time) ??
    epochNumber(row.tt);
  if (price === null || price <= 0 || previousClose === null || previousClose <= 0) {
    throw new MarketDataError(
      `FYERS omitted required quote values for ${ticker}.`,
      "malformed_response",
      "fyers",
    );
  }
  const asOfValue = asOf(timestamp);
  const change = price - previousClose;
  return {
    companyId,
    ticker,
    symbol,
    exchange,
    instrument: symbol,
    asOf: asOfValue,
    marketTimestamp: asOfValue,
    open: finiteNumber(row.open_price),
    high: finiteNumber(row.high_price),
    low: finiteNumber(row.low_price),
    price,
    previousClose,
    change,
    changePercent: (change / previousClose) * 100,
    dayHigh: finiteNumber(row.high_price),
    dayLow: finiteNumber(row.low_price),
    volume: finiteNumber(row.volume),
    currency: "INR",
    source: FYERS_SOURCE,
    sourceType: "public_api",
    sourceUrl: FYERS_DOCS_URL,
    retrievedAt,
    provider: "fyers",
    dataStatus: providerDataStatus("ok"),
    delaySeconds: null,
    delayStatus: "UNKNOWN",
    marketStatus: getIndiaMarketStatus(new Date(retrievedAt)).status,
    isUnofficial: false,
    licenseStatus,
  };
}

function rangeWindow(
  range: HistoricalPriceRange,
): { from: string; to: string; resolution: string } {
  const daysByRange: Record<HistoricalPriceRange, number> = {
    "1d": 1,
    "1w": 7,
    "1mo": 31,
    "3mo": 92,
    "6mo": 183,
    "1y": 365,
    "5y": 1826,
  };
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - daysByRange[range]);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
    resolution: range === "1d" ? "1" : "D",
  };
}

export class FyersMarketDataProvider implements MarketDataProvider {
  readonly id = "fyers" as const;
  private readonly pending = new Map<string, Promise<unknown>>();
  private readonly credentials: FyersCredentials;
  private readonly fetcher: typeof fetch;

  constructor(
    credentials: FyersCredentials,
    fetcher: typeof fetch = fetch,
  ) {
    this.credentials = credentials;
    this.fetcher = fetcher;
  }

  private async singleFlight<T>(
    key: string,
    load: () => Promise<T>,
  ): Promise<T> {
    const pending = this.pending.get(key);
    if (pending) {
      return pending as Promise<T>;
    }
    const request = load().finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async request(
    endpoint: string,
    context: FyersRequestContext,
  ): Promise<JsonRecord> {
    const queued = requestQueue.then(async () => {
      const delay = Math.max(0, nextRequestAt - Date.now());
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      nextRequestAt = Date.now() + 150;
    });
    requestQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    await queued;
    let response: Response;
    try {
      response = await this.fetcher(new URL(endpoint, FYERS_API_ORIGIN), {
        method: "GET",
        headers: {
          Authorization: `${this.credentials.clientId}:${this.credentials.accessToken}`,
          version: FYERS_API_VERSION,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (error) {
      const classification = networkFailureClassification(error);
      console.error("[fyers] Market-data network failure", {
        provider: "fyers",
        endpointCategory: context.category,
        symbol: context.symbol,
        errorClassification: classification,
      });
      if (classification === "TIMEOUT") {
        throw new MarketDataError(
          "FYERS market-data request timed out.",
          "timeout",
          "fyers",
        );
      }
      throw new MarketDataError(
        "FYERS market-data service could not be reached.",
        "provider_unavailable",
        "fyers",
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (!response.ok) {
        this.logRejection(context, response.status, null);
        failForStatus(response.status);
      }
      this.logMalformedResponse(context, response.status);
      throw new MarketDataError(
        "FYERS returned malformed JSON.",
        "malformed_response",
        "fyers",
      );
    }
    if (!response.ok) {
      this.logRejection(context, response.status, payload);
      failForStatus(response.status);
    }
    if (!isRecord(payload)) {
      this.logMalformedResponse(context, response.status);
    }
    if (isRecord(payload) && payload.s !== "ok") {
      this.logRejection(context, response.status, payload);
    }
    const validPayload = validProviderResponse(payload);
    const hasExpectedData =
      context.category === "history"
        ? Array.isArray(validPayload.candles)
        : Array.isArray(validPayload.d);
    if (!hasExpectedData) {
      this.logMalformedResponse(context, response.status);
    }
    return validPayload;
  }

  private logRejection(
    context: FyersRequestContext,
    httpStatus: number,
    payload: unknown,
  ): void {
    const record = isRecord(payload) ? payload : null;
    const code = safeProviderText(record?.code, this.credentials, 80);
    const rawMessage =
      typeof record?.message === "string"
        ? record.message
        : typeof record?.msg === "string"
          ? record.msg
          : null;
    const message = safeProviderText(rawMessage, this.credentials, 240);

      console.warn("[fyers] Market-data HTTP error", {
      provider: "fyers",
      endpoint: context.endpoint,
      endpointCategory: context.category,
      symbol: context.symbol,
      httpStatus,
      fyersResponseCode: code,
      fyersResponseMessage: message,
      });
  }

  private logMalformedResponse(
    context: FyersRequestContext,
    httpStatus: number,
  ): void {
    console.warn("[fyers] Malformed market-data response", {
      provider: "fyers",
      endpointCategory: context.category,
      symbol: context.symbol,
      httpStatus,
      errorClassification: "MALFORMED_RESPONSE",
    });
  }

  async searchCompanies(query: string): Promise<Company[]> {
    const normalized = query.trim().toLocaleUpperCase();
    if (!normalized || normalized.length > 80) {
      throw new MarketDataError(
        "Search query must contain between 1 and 80 characters.",
        "invalid_symbol",
        "fyers",
      );
    }
    return fyersEquityInstruments
      .filter(
        (item) =>
          item.ticker.includes(normalized) ||
          item.ticker.replace(/\.NS$/, "").includes(normalized) ||
          item.name.toLocaleUpperCase().includes(normalized),
      )
      .map((item) =>
        companyFor(
          item,
          new Date().toISOString(),
          this.credentials.licenseStatus ?? "REQUIRES_REVIEW",
        ),
      );
  }

  async getCompany(identifier: string): Promise<Company | null> {
    const instrument = resolveFyersEquityInstrument(identifier);
    return instrument
      ? companyFor(
          instrument,
          new Date().toISOString(),
          this.credentials.licenseStatus ?? "REQUIRES_REVIEW",
        )
      : null;
  }

  async getQuote(company: Company): Promise<MarketQuote> {
    const [quote] = await this.getQuotes([company]);
    if (!quote) {
      throw new MarketDataError(
        `FYERS did not return a quote for ${company.ticker}.`,
        "not_found",
        "fyers",
      );
    }
    return quote;
  }

  async getQuotes(companies: Company[]): Promise<MarketQuote[]> {
    if (companies.length === 0) {
      return [];
    }
    const symbols = companies.map((company) => {
      const symbol = normalizeFyersSymbol(company.ticker);
      if (!symbol) {
        throw new MarketDataError(
          `FYERS does not support the requested company ${company.ticker}.`,
          "unsupported_request",
          "fyers",
        );
      }
      return symbol;
    });
    const url = new URL(`${FYERS_DATA_API_BASE_URL}/quotes`);
    url.searchParams.set("symbols", symbols.join(","));
    const payload = await this.singleFlight(
      `quotes:${symbols.join(",")}`,
      () =>
        this.request(`${url.pathname}${url.search}`, {
          endpoint: "/data/quotes",
          category: "quote",
          symbol: symbols.join(","),
        }),
    );
    const rows = payload.d;
    if (!Array.isArray(rows)) {
      throw new MarketDataError(
        "FYERS returned malformed bulk-quote data.",
        "malformed_response",
        "fyers",
      );
    }
    const rowsBySymbol = new Map<string, unknown>();
    for (const item of rows) {
      if (isRecord(item) && typeof item.n === "string") {
        rowsBySymbol.set(item.n, item.v);
      }
    }
    const retrievedAt = new Date().toISOString();
    return companies.map((company) => {
      const symbol = normalizeFyersSymbol(company.ticker);
      const row = symbol ? rowsBySymbol.get(symbol) : undefined;
      if (row === undefined) {
        throw new MarketDataError(
          `FYERS did not return a quote for ${company.ticker}.`,
          "not_found",
          "fyers",
        );
      }
      return quoteFromRow(
        company.id,
        company.ticker,
        symbol ?? company.instrument,
        company.exchange,
        row,
        retrievedAt,
        this.credentials.licenseStatus ?? "REQUIRES_REVIEW",
      );
    });
  }

  async getMarketOverview(): Promise<MarketOverviewItem[]> {
    const outcomes = await Promise.all(
      fyersOverviewInstruments.map(async (instrument) => {
        const symbol = normalizeFyersSymbol(instrument.appSymbol);
        if (!symbol) {
          throw new MarketDataError(
            `FYERS has no symbol mapping for ${instrument.label}.`,
            "invalid_symbol",
            "fyers",
          );
        }

        const url = new URL(`${FYERS_DATA_API_BASE_URL}/quotes`);
        url.searchParams.set("symbols", symbol);
        const context: FyersRequestContext = {
          endpoint: "/data/quotes",
          category: "overview",
          symbol,
        };

        try {
          const payload = await this.singleFlight(
            `overview:${symbol}`,
            () =>
              this.request(`${url.pathname}${url.search}`, context),
          );
          if (!Array.isArray(payload.d)) {
            throw new MarketDataError(
              `FYERS returned malformed quote data for ${instrument.label}.`,
              "malformed_response",
              "fyers",
            );
          }
          const row = payload.d.find(
            (item) => isRecord(item) && item.n === symbol,
          );
          if (!isRecord(row) || !("v" in row)) {
            this.logRejection(context, 200, {
              code: "missing_symbol",
              message: `FYERS returned no quote for ${symbol}.`,
            });
            throw new MarketDataError(
              `FYERS did not return ${instrument.label}.`,
              "not_found",
              "fyers",
            );
          }

          const retrievedAt = new Date().toISOString();
          const quote = quoteFromRow(
            `index:${symbol}`,
            instrument.appSymbol,
            symbol,
            symbol.split(":")[0] ?? "UNKNOWN",
            row.v,
            retrievedAt,
            this.credentials.licenseStatus ?? "REQUIRES_REVIEW",
          );
          return {
            indicator: {
              symbol: instrument.appSymbol,
              label: instrument.label,
              value: quote.price,
              change: quote.change,
              changePercent: quote.changePercent,
              currency: instrument.currency,
              asOf: quote.asOf,
              marketTimestamp: quote.marketTimestamp,
              instrument: quote.instrument,
              exchange: quote.exchange,
              source: quote.source,
              sourceType: quote.sourceType,
              sourceUrl: quote.sourceUrl,
              retrievedAt: quote.retrievedAt,
              provider: quote.provider,
              dataStatus: quote.dataStatus,
              delaySeconds: quote.delaySeconds,
              delayStatus: quote.delayStatus,
              marketStatus: quote.marketStatus,
              isUnofficial: quote.isUnofficial,
              licenseStatus: quote.licenseStatus,
            } satisfies MarketIndicator,
            error: null,
          };
        } catch (error) {
          if (error instanceof MarketDataError) {
            return { indicator: null, error };
          }
          throw error;
        }
      }),
    );
    const indicators = outcomes.flatMap((outcome) =>
      outcome.indicator ? [outcome.indicator] : [],
    );
    const failures = outcomes.flatMap((outcome, index) =>
      outcome.error
        ? [{ instrument: fyersOverviewInstruments[index]!, error: outcome.error }]
        : [],
    );
    if (indicators.length === 0) {
      const failure =
        failures.find(
          (candidate) =>
            candidate.error.code !== "unsupported_request" &&
            candidate.error.code !== "not_found",
        )?.error ?? failures[0]?.error;
      if (failure) {
        throw failure;
      }
    }
    const unavailableIndicators = failures.map(({ instrument, error }) => ({
      symbol: instrument.appSymbol,
      label: instrument.label,
      provider: "fyers" as const,
      status: "UNAVAILABLE" as const,
      error: error.message,
      code: error.code,
      source: FYERS_SOURCE,
      sourceType: "public_api" as const,
      sourceUrl: FYERS_DOCS_URL,
      retrievedAt: new Date().toISOString(),
      instrument: instrument.symbol,
      exchange: instrument.symbol.split(":")[0] ?? "UNKNOWN",
      asOf: null,
      marketTimestamp: null,
      dataStatus: "UNAVAILABLE" as const,
      delaySeconds: null,
      delayStatus: "UNKNOWN" as const,
      marketStatus: getIndiaMarketStatus().status,
      isUnofficial: false,
      licenseStatus:
        this.credentials.licenseStatus ?? ("REQUIRES_REVIEW" as const),
    }));
    return [...indicators, ...unavailableIndicators];
  }

  async getHistoricalPrices(
    company: Company,
    range: HistoricalPriceRange,
  ): Promise<MarketPrice[]> {
    const window = rangeWindow(range);
    const symbol = normalizeFyersSymbol(company.ticker);
    if (!symbol) {
      throw new MarketDataError(
        `FYERS does not support historical prices for ${company.ticker}.`,
        "unsupported_request",
        "fyers",
      );
    }
    return this.singleFlight(
      `history:${symbol}:${range}`,
      async () => {
        const url = new URL(`${FYERS_DATA_API_BASE_URL}/history`);
        url.searchParams.set("symbol", symbol);
        url.searchParams.set("resolution", window.resolution);
        url.searchParams.set("date_format", "1");
        url.searchParams.set("cont_flag", "1");
        const start = new Date(`${window.from}T00:00:00.000Z`);
        const end = new Date(`${window.to}T00:00:00.000Z`);
        const candlesByEpoch = new Map<number, unknown>();
        let cursor = start;
        while (cursor <= end) {
          const segmentEnd = new Date(cursor);
          segmentEnd.setUTCDate(segmentEnd.getUTCDate() + 365);
          if (segmentEnd > end) {
            segmentEnd.setTime(end.getTime());
          }
          url.searchParams.set("range_from", cursor.toISOString().slice(0, 10));
          url.searchParams.set("range_to", segmentEnd.toISOString().slice(0, 10));
          const payload = await this.request(
            `${url.pathname}${url.search}`,
            {
              endpoint: "/data/history",
              category: "history",
              symbol,
            },
          );
          if (!Array.isArray(payload.candles)) {
            throw new MarketDataError(
              "FYERS returned malformed historical-price data.",
              "malformed_response",
              "fyers",
            );
          }
          for (const candle of payload.candles) {
            if (Array.isArray(candle) && typeof candle[0] === "number") {
              candlesByEpoch.set(candle[0], candle);
            }
          }
          cursor = new Date(segmentEnd);
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        const retrievedAt = new Date().toISOString();
        const prices = [...candlesByEpoch.values()].map((candle): MarketPrice => {
          if (
            !Array.isArray(candle) ||
            candle.length < 6 ||
            candle.some(
              (value) => typeof value !== "number" || !Number.isFinite(value),
            )
          ) {
            throw new MarketDataError(
              "FYERS returned malformed historical candle values.",
              "malformed_response",
              "fyers",
            );
          }
          const [epoch, open, high, low, close, volume] = candle;
          if (
            typeof epoch !== "number" ||
            typeof open !== "number" ||
            typeof high !== "number" ||
            typeof low !== "number" ||
            typeof close !== "number" ||
            typeof volume !== "number"
          ) {
            throw new MarketDataError(
              "FYERS returned incomplete historical candle values.",
              "malformed_response",
              "fyers",
            );
          }
          const timestamp = asOf(epoch);
          if (!timestamp) {
            throw new MarketDataError(
              "FYERS returned an invalid historical candle timestamp.",
              "malformed_response",
              "fyers",
            );
          }
          return {
            id: `fyers:${company.ticker}:${timestamp}`,
            companyId: company.id,
            date: timestamp.slice(0, 10),
            asOf: timestamp,
            marketTimestamp: timestamp,
            instrument: symbol,
            exchange: company.exchange,
            currency: company.currency,
            open,
            high,
            low,
            close,
            adjustedClose: null,
            volume,
            source: FYERS_SOURCE,
            sourceType: "public_api",
            sourceUrl: FYERS_DOCS_URL,
            retrievedAt,
            provider: "fyers",
            dataStatus: "EOD",
            delaySeconds: null,
            delayStatus: "NOT_APPLICABLE",
            marketStatus: "CLOSED",
            isUnofficial: false,
            licenseStatus:
              this.credentials.licenseStatus ?? "REQUIRES_REVIEW",
          };
        });
        if (prices.length === 0) {
          throw new MarketDataError(
            `FYERS returned no historical prices for ${company.ticker} in ${range}.`,
            "not_found",
            "fyers",
          );
        }
        return prices;
      },
    );
  }
}
