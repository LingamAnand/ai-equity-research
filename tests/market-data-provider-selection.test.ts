import assert from "node:assert/strict";
import test from "node:test";
import { resolveMarketDataProviderConfiguration } from "../lib/services/market-data-provider-selection.ts";

test("market data is unavailable unless a provider is explicitly selected", () => {
  assert.deepEqual(resolveMarketDataProviderConfiguration({ NODE_ENV: "development" }), {
    providerId: "unavailable",
    failure: "provider_not_configured",
    message:
      "Market data is disabled. Set MARKET_DATA_PROVIDER to an explicitly reviewed provider.",
  });
});

test("demo and Yahoo providers are opt-in in development", () => {
  assert.equal(
    resolveMarketDataProviderConfiguration({
      MARKET_DATA_PROVIDER: "demo",
      NODE_ENV: "development",
    }).failure,
    null,
  );
  assert.equal(
    resolveMarketDataProviderConfiguration({
      MARKET_DATA_PROVIDER: "yahoo",
      NODE_ENV: "development",
    }).failure,
    null,
  );
});

test("synthetic demo values cannot be served in production", () => {
  const result = resolveMarketDataProviderConfiguration({
    MARKET_DATA_PROVIDER: "demo",
    NODE_ENV: "production",
  });

  assert.equal(result.providerId, "demo");
  assert.equal(result.failure, "demo_not_available_in_production");
});

test("Yahoo cannot be served publicly while market-data rights are unknown", () => {
  const result = resolveMarketDataProviderConfiguration({
    MARKET_DATA_PROVIDER: "yahoo",
    NODE_ENV: "production",
  });

  assert.equal(result.providerId, "yahoo");
  assert.equal(result.failure, "license_not_approved");
});

test("FYERS remains unavailable without its required server-side credentials", () => {
  const result = resolveMarketDataProviderConfiguration({
    MARKET_DATA_PROVIDER: "fyers",
    NODE_ENV: "development",
  });
  assert.equal(result.providerId, "fyers");
  assert.equal(result.failure, "missing_credentials");
  assert.match(result.message ?? "", /FYERS_CLIENT_ID.*FYERS_ACCESS_TOKEN/);
  assert.match(result.message ?? "", /\/api\/fyers\/login/);
});

test("FYERS is selectable for development but production requires explicit rights review", () => {
  const credentials = {
    MARKET_DATA_PROVIDER: "fyers",
    FYERS_CLIENT_ID: "example-client-id",
    FYERS_ACCESS_TOKEN: "example-access-token",
    FYERS_DATA_USE_APPROVED: "true",
  };
  assert.equal(
    resolveMarketDataProviderConfiguration({
      ...credentials,
      NODE_ENV: "development",
    }).failure,
    null,
  );
  const production = resolveMarketDataProviderConfiguration({
    ...credentials,
    NODE_ENV: "production",
  });
  assert.equal(production.failure, "license_not_approved");
  assert.doesNotMatch(production.message ?? "", /example-access-token/);
});

test("FYERS data remains disabled in every environment until intended data use is reviewed", () => {
  const result = resolveMarketDataProviderConfiguration({
    MARKET_DATA_PROVIDER: "fyers",
    FYERS_CLIENT_ID: "example-client-id",
    FYERS_ACCESS_TOKEN: "example-access-token",
    NODE_ENV: "development",
  });
  assert.equal(result.failure, "license_not_approved");
  assert.match(result.message ?? "", /private research and charting use/);
});

test("unknown providers fail explicitly and never fall back to demo", () => {
  const invalid = resolveMarketDataProviderConfiguration({
    MARKET_DATA_PROVIDER: "not-a-provider",
    NODE_ENV: "development",
  });
  const planned = resolveMarketDataProviderConfiguration({
    MARKET_DATA_PROVIDER: "upstox",
    NODE_ENV: "development",
  });

  assert.equal(invalid.providerId, "unavailable");
  assert.equal(invalid.failure, "configuration_error");
  assert.equal(planned.providerId, "upstox");
  assert.equal(planned.failure, "provider_not_implemented");
});
