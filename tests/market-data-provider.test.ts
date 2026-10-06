import assert from "node:assert/strict";
import test from "node:test";
import { FyersMarketDataProvider } from "../lib/providers/fyers-market-data-provider.ts";
import {
  MarketDataError,
  marketDataErrorCategory,
  marketDataErrorResponse,
} from "../lib/providers/market-data-error.ts";
import { normalizeFyersSymbol } from "../lib/providers/fyers-symbols.ts";
import { getFyersStatus, resolveFyersToken } from "../lib/services/fyers-token.ts";
import {
  getIndiaMarketStatus,
  NSE_2026_HOLIDAYS,
} from "../lib/market-data/india-market-status.ts";
import { getFyersLicenseStatus } from "../lib/market-data/fyers-license.ts";

const CLIENT_ID = "test-client-id";
const ACCESS_TOKEN = "test-access-token-never-return-this";

function createProvider(fetcher: typeof fetch) {
  return new FyersMarketDataProvider(
    { clientId: CLIENT_ID, accessToken: ACCESS_TOKEN },
    fetcher,
  );
}

function quoteRow(symbol: string) {
  return {
    n: symbol,
    v: {
      lp: 1_650,
      prev_close_price: 1_640,
      exch_feed_time: 1_759_622_400,
      open_price: 1_642,
      high_price: 1_655,
      low_price: 1_638,
      volume: 1_000_000,
    },
  };
}

test("FYERS symbol normalization maps canonical equities and dashboard indices", () => {
  assert.equal(normalizeFyersSymbol("HDFCBANK.NS"), "NSE:HDFCBANK-EQ");
  assert.equal(normalizeFyersSymbol("hdfcbank"), "NSE:HDFCBANK-EQ");
  assert.equal(normalizeFyersSymbol("^NSEI"), "NSE:NIFTY50-INDEX");
  assert.equal(normalizeFyersSymbol("NIFTY BANK"), "NSE:NIFTYBANK-INDEX");
  assert.equal(normalizeFyersSymbol("SENSEX"), "BSE:SENSEX-INDEX");
  assert.equal(normalizeFyersSymbol("INDIA VIX"), "NSE:INDIAVIX-INDEX");
  assert.equal(normalizeFyersSymbol("UNKNOWN.NS"), null);
});

test("FYERS resolves supported NSE tickers without inventing a market quote", async () => {
  const provider = createProvider(async () => {
    throw new Error("Network access is not expected for company resolution.");
  });
  const company = await provider.getCompany("HDFCBANK");
  assert.ok(company);
  assert.equal(company.ticker, "HDFCBANK.NS");
  assert.equal(company.instrument, "NSE:HDFCBANK-EQ");
  assert.equal(company.marketCap, null);
  assert.equal(await provider.getCompany("UNSUPPORTED.NS"), null);
});

test("FYERS quotes use the documented data endpoint, GET query, and normalized equity symbol", async () => {
  let requestUrl = "";
  let requestMethod = "";
  let versionHeader = "";
  let authorizationHeader = "";
  const provider = createProvider(async (input, init) => {
    requestUrl = String(input);
    requestMethod = init?.method ?? "";
    versionHeader = new Headers(init?.headers).get("version") ?? "";
    authorizationHeader = new Headers(init?.headers).get("Authorization") ?? "";
    return new Response(
      JSON.stringify({ s: "ok", d: [quoteRow("NSE:HDFCBANK-EQ")] }),
      { status: 200 },
    );
  });
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);

  const quote = await provider.getQuote(company);
  assert.equal(requestUrl, "https://api-t1.fyers.in/data/quotes?symbols=NSE%3AHDFCBANK-EQ");
  assert.equal(requestMethod, "GET");
  assert.equal(versionHeader, "2.0");
  assert.equal(authorizationHeader, `${CLIENT_ID}:${ACCESS_TOKEN}`);
  assert.equal(quote.price, 1_650);
  assert.equal(quote.instrument, "NSE:HDFCBANK-EQ");
});

test("FYERS quote parsing accepts the documented string timestamp field", async () => {
  const provider = createProvider(async () =>
    new Response(
      JSON.stringify({
        s: "ok",
        d: [
          {
            ...quoteRow("NSE:HDFCBANK-EQ"),
            v: {
              ...quoteRow("NSE:HDFCBANK-EQ").v,
              exch_feed_time: undefined,
              tt: "1759622400",
            },
          },
        ],
      }),
      { status: 200 },
    ),
  );
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  const quote = await provider.getQuote(company);
  assert.equal(quote.asOf, new Date(1_759_622_400 * 1000).toISOString());
});

test("FYERS uses the provider timestamp and keeps retrieval time separate", async () => {
  const provider = createProvider(async () =>
    new Response(
      JSON.stringify({
        s: "ok",
        d: [
          {
            ...quoteRow("NSE:HDFCBANK-EQ"),
            v: {
              ...quoteRow("NSE:HDFCBANK-EQ").v,
              exch_feed_time: "1759622400",
              tt: "1759626000",
            },
          },
        ],
      }),
      { status: 200 },
    ),
  );
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  const quote = await provider.getQuote(company);

  assert.equal(quote.asOf, new Date(1_759_622_400 * 1000).toISOString());
  assert.equal(quote.marketTimestamp, quote.asOf);
  assert.notEqual(quote.retrievedAt, quote.asOf);
});

test("FYERS does not substitute retrieval time when the provider timestamp is missing", async () => {
  const provider = createProvider(async () =>
    new Response(
      JSON.stringify({
        s: "ok",
        d: [
          {
            n: "NSE:HDFCBANK-EQ",
            v: { lp: 1_650, prev_close_price: 1_640 },
          },
        ],
      }),
      { status: 200 },
    ),
  );
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  const quote = await provider.getQuote(company);

  assert.equal(quote.asOf, null);
  assert.equal(quote.marketTimestamp, null);
  assert.ok(Number.isFinite(Date.parse(quote.retrievedAt)));
});

test("FYERS company search resolves HDFC Bank from the configured symbol list", async () => {
  const provider = createProvider(async () => {
    throw new Error("Network access is not expected for company search.");
  });

  for (const query of ["hdfc", "HDFC Bank"]) {
    const companies = await provider.searchCompanies(query);
    assert.ok(companies.some((company) => company.ticker === "HDFCBANK.NS"));
  }
});

test("FYERS 401 and 403 responses are classified as authentication failures", async () => {
  const companyProvider = createProvider(async () => {
    throw new Error("Company resolution must not make a request.");
  });
  const company = await companyProvider.getCompany("HDFCBANK.NS");
  assert.ok(company);

  for (const status of [401, 403]) {
    const provider = createProvider(async () =>
      new Response(JSON.stringify({ s: "error", code: -15, message: "Unauthorized" }), {
        status,
      }),
    );
    await assert.rejects(
      provider.getQuote(company),
      (error: unknown) =>
        error instanceof MarketDataError &&
        error.code === "authentication_failed" &&
        error.providerId === "fyers" &&
        !error.message.includes(ACCESS_TOKEN),
    );
  }
});

test("FYERS quote rejection is normalized as unsupported_request", async () => {
  const provider = createProvider(async () =>
    new Response(JSON.stringify({ code: "symbol_not_supported", message: "Invalid symbol" }), {
      status: 404,
    }),
  );
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  await assert.rejects(
    provider.getQuote(company),
    (error: unknown) =>
      error instanceof MarketDataError &&
      error.code === "unsupported_request",
  );
});

test("FYERS rejection logs identify the request without logging token or auth code", async () => {
  const provider = createProvider(async () =>
    new Response(
      JSON.stringify({
        code: "symbol_not_supported",
        message: `Rejected access_token=${ACCESS_TOKEN} auth_code=single-use-code`,
      }),
      { status: 404 },
    ),
  );
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  const originalWarn = console.warn;
  let logOutput = "";
  console.warn = (...values: unknown[]) => {
    logOutput += JSON.stringify(values);
  };
  try {
    await assert.rejects(provider.getQuote(company));
  } finally {
    console.warn = originalWarn;
  }
  assert.match(logOutput, /\/data\/quotes/);
  assert.match(logOutput, /NSE:HDFCBANK-EQ/);
  assert.match(logOutput, /endpointCategory/);
  assert.match(logOutput, /symbol_not_supported/);
  assert.doesNotMatch(logOutput, new RegExp(ACCESS_TOKEN));
  assert.doesNotMatch(logOutput, /single-use-code/);
});

test("FYERS HTTP authentication errors log safe status and context only", async () => {
  const companyProvider = createProvider(async () => {
    throw new Error("Company resolution must not make a request.");
  });
  const company = await companyProvider.getCompany("HDFCBANK.NS");
  assert.ok(company);

  for (const status of [401, 403]) {
    const provider = createProvider(async () =>
      new Response(
        JSON.stringify({
          code: -15,
          message: `Unauthorized cookie=${ACCESS_TOKEN}`,
        }),
        { status },
      ),
    );
    const originalWarn = console.warn;
    let logs = "";
    console.warn = (...values: unknown[]) => {
      logs += values
        .map((value) =>
          typeof value === "string" ? value : JSON.stringify(value),
        )
        .join(" ");
    };
    try {
      await assert.rejects(provider.getQuote(company));
    } finally {
      console.warn = originalWarn;
    }
    assert.match(logs, new RegExp(`"httpStatus":${status}`));
    assert.match(logs, /"provider":"fyers"/);
    assert.match(logs, /"endpointCategory":"quote"/);
    assert.doesNotMatch(logs, new RegExp(ACCESS_TOKEN));
  }
});

test("FYERS network failures log a safe DNS classification without raw error details", async () => {
  const provider = createProvider(async () => {
    throw Object.assign(
      new TypeError(`Unable to resolve ${ACCESS_TOKEN}`),
      { cause: { code: "ENOTFOUND" } },
    );
  });
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  const originalError = console.error;
  let logs = "";
  console.error = (...values: unknown[]) => {
    logs += values
      .map((value) =>
        typeof value === "string" ? value : JSON.stringify(value),
      )
      .join(" ");
  };
  try {
    await assert.rejects(
      provider.getQuote(company),
      (error: unknown) =>
        error instanceof MarketDataError &&
        error.code === "provider_unavailable",
    );
  } finally {
    console.error = originalError;
  }
  assert.match(logs, /"errorClassification":"DNS_FAILURE"/);
  assert.match(logs, /"endpointCategory":"quote"/);
  assert.doesNotMatch(logs, new RegExp(ACCESS_TOKEN));
  assert.doesNotMatch(logs, /Unable to resolve/);
});

test("malformed FYERS quote payloads fail with malformed_response", async () => {
  const provider = createProvider(async () =>
    new Response(JSON.stringify({ s: "ok", d: {} }), { status: 200 }),
  );
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  await assert.rejects(
    provider.getQuote(company),
    (error: unknown) =>
      error instanceof MarketDataError &&
      error.code === "malformed_response",
  );
});

test("malformed FYERS response diagnostics omit credential-like provider messages", async () => {
  const provider = createProvider(async () =>
    new Response(JSON.stringify({ s: "ok", d: "bad", message: ACCESS_TOKEN }), {
      status: 200,
    }),
  );
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  const originalWarn = console.warn;
  let logs = "";
  console.warn = (...values: unknown[]) => {
    logs += values
      .map((value) =>
        typeof value === "string" ? value : JSON.stringify(value),
      )
      .join(" ");
  };
  try {
    await assert.rejects(provider.getQuote(company));
  } finally {
    console.warn = originalWarn;
  }
  assert.match(logs, /MALFORMED_RESPONSE/);
  assert.doesNotMatch(logs, new RegExp(ACCESS_TOKEN));
});

test("FYERS token resolution prefers cookie then environment and supports missing token", () => {
  assert.deepEqual(
    resolveFyersToken(" cookie-token ", "environment-token"),
    {
      accessToken: "cookie-token",
      tokenSource: "cookie",
      tokenPresent: true,
    },
  );
  assert.deepEqual(resolveFyersToken(undefined, " environment-token "), {
    accessToken: "environment-token",
    tokenSource: "environment",
    tokenPresent: true,
  });
  assert.deepEqual(resolveFyersToken(" ", undefined), {
    accessToken: "",
    tokenSource: "none",
    tokenPresent: false,
  });
});

test("FYERS status payload exposes configuration booleans but no credential values", () => {
  const status = getFyersStatus(
    {
      MARKET_DATA_PROVIDER: "fyers",
      FYERS_CLIENT_ID: CLIENT_ID,
      FYERS_ACCESS_TOKEN: "environment-token-secret",
      FYERS_DATA_USE_APPROVED: "true",
      SUPABASE_SECRET_KEY: "supabase-secret-value",
    },
    resolveFyersToken("cookie-token-secret", "environment-token-secret"),
  );
  const serialized = JSON.stringify(status);

  assert.deepEqual(status, {
    provider: "fyers",
    configured: true,
    tokenSource: "cookie",
    tokenPresent: true,
    clientIdConfigured: true,
  });
  assert.doesNotMatch(serialized, /cookie-token-secret/);
  assert.doesNotMatch(serialized, /environment-token-secret/);
  assert.doesNotMatch(serialized, /supabase-secret-value/);
  assert.doesNotMatch(serialized, new RegExp(CLIENT_ID));
});

test("expired FYERS credentials cannot silently fall back to Yahoo or demo data", async () => {
  const provider = createProvider(async () =>
    new Response(JSON.stringify({ s: "error", code: -16 }), {
      status: 200,
    }),
  );
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  await assert.rejects(
    provider.getHistoricalPrices(company, "1mo"),
    (error: unknown) =>
      error instanceof MarketDataError &&
      error.code === "authentication_failed",
  );
});

test("structured market errors expose status and reason but not upstream tokens", async () => {
  const response = marketDataErrorResponse(
    new MarketDataError(
      "FYERS authentication failed. Regenerate the server-side access token.",
      "authentication_failed",
      "fyers",
    ),
    "Market data is unavailable.",
  );
  assert.equal(response.status, 502);
  const payload = (await response.json()) as Record<string, unknown>;
  assert.equal(payload.status, "UNAVAILABLE");
  assert.equal(payload.provider, "fyers");
  assert.equal(payload.dataStatus, "UNAVAILABLE");
  assert.equal(payload.category, "AUTHENTICATION_FAILED");
  assert.equal(payload.credentialStatus, "INVALID_OR_EXPIRED");
  assert.equal(payload.reason, payload.error);
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(ACCESS_TOKEN));
});

test("market error categories distinguish missing setup, rights and provider failures", () => {
  assert.equal(
    marketDataErrorCategory(
      new MarketDataError("Provider is not configured.", "provider_not_configured"),
    ),
    "PROVIDER_NOT_CONFIGURED",
  );
  assert.equal(
    marketDataErrorCategory(
      new MarketDataError("Credentials are missing.", "missing_credentials", "fyers"),
    ),
    "CREDENTIALS_NOT_CONFIGURED",
  );
  assert.equal(
    marketDataErrorCategory(
      new MarketDataError("Rights review is required.", "license_not_approved", "fyers"),
    ),
    "DATA_RIGHTS_NOT_APPROVED",
  );
  assert.equal(
    marketDataErrorCategory(
      new MarketDataError("Malformed response.", "malformed_response", "fyers"),
    ),
    "PROVIDER_ERROR",
  );
  assert.equal(
    marketDataErrorCategory(
      new MarketDataError("Timed out.", "timeout", "fyers"),
    ),
    "DATA_UNAVAILABLE",
  );
});

test("unsupported FYERS history is not replaced with another requested range", async () => {
  const provider = createProvider(async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/data/history");
    assert.equal(init?.method, "GET");
    assert.equal(url.searchParams.get("symbol"), "NSE:HDFCBANK-EQ");
    assert.equal(url.searchParams.get("range_from") !== null, true);
    assert.equal(url.searchParams.get("range_to") !== null, true);
    assert.equal(url.searchParams.get("resolution"), "D");
    return new Response(JSON.stringify({ s: "error", code: -300 }), {
      status: 200,
    });
  });
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  await assert.rejects(
    provider.getHistoricalPrices(company, "5y"),
    (error: unknown) =>
      error instanceof MarketDataError && error.code === "not_found",
  );
});

test("FYERS history requests use the normalized symbol and history endpoint", async () => {
  let requestUrl = "";
  const provider = createProvider(async (input) => {
    requestUrl = String(input);
    return new Response(
      JSON.stringify({
        s: "ok",
        candles: [[1_759_622_400, 1_640, 1_655, 1_638, 1_650, 1_000_000]],
      }),
      { status: 200 },
    );
  });
  const company = await provider.getCompany("HDFCBANK.NS");
  assert.ok(company);
  const prices = await provider.getHistoricalPrices(company, "1mo");

  assert.match(requestUrl, /^https:\/\/api-t1\.fyers\.in\/data\/history\?/);
  assert.match(requestUrl, /symbol=NSE%3AHDFCBANK-EQ/);
  assert.equal(prices.length, 1);
  assert.equal(prices[0]?.instrument, "NSE:HDFCBANK-EQ");
});

test("market overview keeps supported indices when one FYERS instrument is rejected", async () => {
  const requestedSymbols: string[] = [];
  const provider = createProvider(async (input) => {
    const url = new URL(String(input));
    const symbol = url.searchParams.get("symbols");
    assert.equal(url.pathname, "/data/quotes");
    requestedSymbols.push(symbol ?? "");
    if (symbol === "BSE:SENSEX-INDEX") {
      return new Response(
        JSON.stringify({ code: "symbol_not_supported", message: "Invalid symbol" }),
        { status: 404 },
      );
    }
    assert.ok(symbol);
    return new Response(
      JSON.stringify({ s: "ok", d: [quoteRow(symbol)] }),
      { status: 200 },
    );
  });
  const indicators = await provider.getMarketOverview();

  assert.deepEqual(
    indicators
      .filter((item) => !("status" in item))
      .map((indicator) => indicator.symbol)
      .sort(),
    ["^INDIAVIX", "^NSEBANK", "^NSEI"],
  );
  assert.deepEqual(
    indicators
      .filter((item) => "status" in item)
      .map((item) => [item.symbol, item.status, item.code]),
    [["^BSESN", "UNAVAILABLE", "unsupported_request"]],
  );
  assert.deepEqual(requestedSymbols.sort(), [
    "BSE:SENSEX-INDEX",
    "NSE:INDIAVIX-INDEX",
    "NSE:NIFTY50-INDEX",
    "NSE:NIFTYBANK-INDEX",
  ]);
  assert.ok(
    indicators
      .filter((item) => !("status" in item))
      .every((indicator) => !("status" in indicator) && indicator.value === 1_650),
  );
});

test("one transient FYERS overview failure preserves other indexes with a structured unavailable item", async () => {
  const provider = createProvider(async (input) => {
    const url = new URL(String(input));
    const symbol = url.searchParams.get("symbols");
    if (symbol === "NSE:INDIAVIX-INDEX") {
      throw Object.assign(new TypeError("private network details"), {
        cause: { code: "EAI_AGAIN" },
      });
    }
    return new Response(
      JSON.stringify({ s: "ok", d: [quoteRow(symbol ?? "")] }),
      { status: 200 },
    );
  });
  const originalError = console.error;
  console.error = () => undefined;
  let items;
  try {
    items = await provider.getMarketOverview();
  } finally {
    console.error = originalError;
  }

  assert.equal(items.filter((item) => !("status" in item)).length, 3);
  const unavailable = items.find((item) => "status" in item);
  assert.ok(unavailable && "status" in unavailable);
  assert.equal(unavailable.symbol, "^INDIAVIX");
  assert.equal(unavailable.status, "UNAVAILABLE");
  assert.equal(unavailable.code, "provider_unavailable");
});

test("NSE market status uses IST session boundaries, weekends, and the 2026 holiday calendar", () => {
  assert.equal(getIndiaMarketStatus(new Date("2026-10-05T03:30:00.000Z")).status, "PRE_OPEN");
  assert.equal(getIndiaMarketStatus(new Date("2026-10-05T03:45:00.000Z")).status, "OPEN");
  assert.equal(getIndiaMarketStatus(new Date("2026-10-05T10:00:00.000Z")).status, "CLOSED");
  assert.equal(getIndiaMarketStatus(new Date("2026-10-04T04:00:00.000Z")).status, "CLOSED");
  assert.equal(getIndiaMarketStatus(new Date("2026-10-05T03:30:00.000Z")).localTime, "09:00");
  assert.equal(getIndiaMarketStatus(new Date("2026-10-05T03:45:00.000Z")).localTime, "09:15");
  assert.equal(getIndiaMarketStatus(new Date("2026-10-05T10:00:00.000Z")).localTime, "15:30");

  for (const holiday of NSE_2026_HOLIDAYS) {
    assert.equal(
      getIndiaMarketStatus(new Date(`${holiday}T04:00:00.000Z`)).status,
      "CLOSED",
      `NSE holiday ${holiday} must be closed`,
    );
  }
});

test("NSE status does not claim an open session when the annual holiday calendar is not known", () => {
  const status = getIndiaMarketStatus(new Date("2027-01-04T04:00:00.000Z"));
  assert.equal(status.status, "UNKNOWN");
  assert.equal(status.calendarYearSupported, false);
});

test("FYERS display approval is never inferred from provider retrieval approval alone", () => {
  assert.equal(
    getFyersLicenseStatus({
      FYERS_DATA_USE_APPROVED: "true",
      MARKET_DATA_DISPLAY_RIGHTS_APPROVED: "false",
    }),
    "REQUIRES_REVIEW",
  );
  assert.equal(
    getFyersLicenseStatus({
      FYERS_DATA_USE_APPROVED: "true",
      MARKET_DATA_DISPLAY_RIGHTS_APPROVED: "true",
    }),
    "DISPLAY_ALLOWED",
  );
  assert.equal(
    getFyersLicenseStatus({
      FYERS_DATA_USE_APPROVED: "false",
      MARKET_DATA_DISPLAY_RIGHTS_APPROVED: "true",
    }),
    "REQUIRES_REVIEW",
  );
});
