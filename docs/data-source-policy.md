# EquityMind data-source policy

This policy applies to market prices, company metadata, financial statements, ratios, filings, earnings, news, and any value derived from them.

## 1. Provider selection and failure behavior

- Market data is disabled unless the server explicitly sets `MARKET_DATA_PROVIDER`.
- Current supported choices are `unavailable`, `demo`, and `yahoo`. Named future adapters such as Upstox, Angel One, Twelve Data, and FYERS return an explicit not-implemented error until an adapter exists.
- Never switch providers silently, especially never from a failed live request to demo data.
- An invalid symbol, unsupported company, upstream error, missing credential, or unapproved license must remain an explicit error/unavailable state; it must not become a plausible-looking number.
- Demo data is synthetic, for local development only, and may not be used as a research input or served in production.

## 2. Every market datum carries provenance

Keep provider, instrument/ticker, exchange, currency, source name and URL, retrieval time, source timestamp/as-of, data status, delay seconds (nullable), unofficial flag, and license status with each normalized data point. Preserve source units and period for financial fundamentals. Do not drop provenance when calculating, caching, serializing, or presenting a value.

Use `UNKNOWN` rather than guessing if the provider does not document real-time/EOD/delay status, license, or timestamp meaning. A timestamp by itself does not prove that a quote is live or delayed.

## 3. Separate types of truth

- `REPORTED`: directly transcribed from an official filing/report, with period, unit, currency, reporting basis, page/section, publication date, and source link.
- `CALCULATED`: deterministic application code with formula and references to all input facts. Match periods, units, currencies, reporting basis, and denominator validity first.
- `AI_GENERATED`: narrative only. Gemini must not invent financial inputs or calculate ratios, growth, DCF, or valuation values that application code can calculate.
- `DEMO`: synthetic fixture only and never represented as market or company fact.

Missing, conflicting, unsupported, or incompatible inputs stay null/unavailable with a reason. Do not fill gaps from memory or an unrelated provider.

## 4. Storage, caches, and dynamic requests

- Do not persist or cache a provider's data until its terms and exchange rules explicitly allow the intended retention and display.
- Market API responses use `Cache-Control: no-store`. The Yahoo adapter has no completed-response cache; it coalesces identical concurrent requests only while each request is pending.
- Store official company financial facts only with their provenance, reporting basis, unit/currency, and period. Apply a documented retention policy before adding a database write path.
- HDFC Bank fundamentals are currently a curated, code-bundled snapshot of official disclosures, not a live filing fetch. The API labels this as historical and reports period/source coverage and missing-data limitations. Only HDFC Bank is supported by that fundamentals source; other companies must remain unavailable until a verified provider is implemented.
- Keep market quotes and short-lived provider responses dynamic unless a reviewed provider contract permits a defined cache.
- Do not apply the existing Supabase migration or enable a Supabase client until policies, server-side access, grants, and provenance constraints are reviewed.

## 5. User-interface requirements

- Show provider, source/as-of when available, instrument/exchange, status, and license status near market data.
- Explicitly label all synthetic values `DEMO · NOT REAL MARKET DATA`.
- Do not call a number “live”, “delayed”, “end of day”, or “official” without provider evidence.
- Missing data should say unavailable, not be interpolated or copied from another period/source.
- Keep the existing dashboard components reusable; source adapters and data services should own normalization rather than page components.

## 6. API keys and external services

- Provider API keys, access tokens, Gemini keys, and Supabase service-role credentials are server-only secrets. Never prefix them with `NEXT_PUBLIC_`, return them in API responses, log them, or commit them.
- `.env.example` may contain variable names and blank values only. Local `.env*` files stay ignored.
- Gemini is optional and is not considered available until a server-side key is configured and a real request is deliberately tested. Send only public, non-confidential data after reviewing Google's current free-tier terms.
- The research context passed to an AI provider is a typed server-side contract. Missing filing, earnings, news, risk-engine, and catalyst inputs are explicitly identified rather than filled with inferred facts.
- Apply request validation, bounded provider timeouts, rate limits, and error redaction at each route. The current AI rate limit is process-local and must not be treated as deployment-grade abuse protection.
- AI analysis must not consume synthetic demo quotes/history. The current AI-analysis result cache is disabled; reintroduce caching only after terms for both the source data and derived output allow the intended retention.

## 7. Provider onboarding checklist

Before adding or enabling an adapter, document and test:

1. Official API endpoint and documentation; supported exchanges/instruments and fields.
2. Authentication, credential scope, expiry/rotation, IP allowlist, and whether a credit card or billing account is required.
3. Free-tier quota, throttling, uptime/freshness semantics, and expected failure modes.
4. Rights for internal use, non-display processing, public display, multi-user use, redistribution, derived data, persistence, caching, and attribution.
5. Normalized source/status/provenance mapping, with unknown facts left unknown.
6. Deterministic adapter tests, unsupported-symbol behavior, provider failure behavior, and confirmation that no demo fallback occurs.

Record evidence and date in [data-provider-compliance.md](./data-provider-compliance.md). A “free” API plan is not presumed to permit public redistribution or persistent storage.

## 8. Supabase and deployment security

The current Supabase migration enables RLS but defines no policies, and no client/project is configured. Do not apply it or add browser access until least-privilege policies have been designed. Treat service-role credentials as privileged server-only secrets. Before public deployment, add durable abuse controls for market/AI routes; the current AI throttle is process-local and does not protect a multi-instance deployment.
