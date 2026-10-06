# Market-data provider and compliance review

**Reviewed:** 2026-09-28  
**Scope:** Providers implemented or named for future adapters in this codebase. This is an engineering risk register, not legal advice or a license grant.

## Current runtime behavior

`MARKET_DATA_PROVIDER` is an explicit server-side selector. It defaults to unavailable. Supported implementations are `demo` and `yahoo`; selecting a named but unimplemented provider returns an explicit 503 instead of falling back to another source.

| Provider | Code status | Data and documented access | Rights, storage, and display status | Decision |
| --- | --- | --- | --- | --- |
| `unavailable` | Implemented | Returns no company, quote, market overview, or price history. | No third-party data is requested or retained. | Safe default; production and development. |
| `demo` | Implemented | Static synthetic values in `lib/data/demo-market-data.ts`; not observed market data. | Internal demo fixture only; never market evidence. It is rejected in production and explicitly watermarked in API data/UI. | Development-only, explicit opt-in. Do not use it in research, reports, or valuation. |
| `yahoo` | Implemented | Uses Yahoo Finance search/chart endpoints (`query1.finance.yahoo.com`). These are unofficial endpoints, not a documented public API contract. Availability, completeness, and schema can change without notice. | No provider permission for public display, redistribution, durable storage, or caching was verified. Quote delay is also undocumented in this implementation; status and delay are therefore `UNKNOWN`/`null`, not “delayed”. Production selection is blocked pending rights review. | Local technical evaluation only, explicit opt-in; not approved for deployment. |
| `upstox` | Planned; no adapter | Official docs describe quote/OHLC, historical candles, feeds, and an Analytics Token. The token is read-only, free, and valid for one year; some account-specific GET APIs require a static IP according to the documentation reviewed. It requires an Upstox account/token and server-side credential handling. | API availability and a free token do not establish public display, redistribution, storage, or exchange-data entitlements. These rights were not confirmed. | Do not implement/serve publicly until written/documented use rights, applicable exchange requirements, IP constraints, and account terms are verified. |
| `angelone` | Planned; no adapter | Official SmartAPI documentation is available. | Data entitlement, free-tier constraints, public display, storage, and redistribution rights were not established by the documentation accessible in this review. | Not approved; re-review the current terms and account entitlements before implementation. |
| `fyers` | Planned; no adapter | Official API documentation/help-center material is available. | Data entitlement, free-tier constraints, public display, storage, and redistribution rights were not established by the documentation accessible in this review. | Not approved; re-review the current terms and account entitlements before implementation. |
| `twelvedata` | Planned; no adapter | The current Basic plan is shown as free, with 8 API credits/minute and 800/day. Pricing identifies real-time US equities, forex/crypto, reference data, and trial symbols; free NSE coverage was not verified. The documented plan is not equivalent to unlimited free data. | Pricing describes Basic as internal, non-display usage. Terms reserve additional third-party/exchange requirements and state customers are responsible for verifying rights. Public display/redistribution cannot be assumed. | Not suitable for this public-display MVP without a different written entitlement. No paid plan is selected. |
| SEC EDGAR | Future filing/fundamentals source; no adapter here | Official submissions and XBRL APIs provide public US filing/company-facts data. SEC documentation was not retrievable from this environment (403), so endpoint limits and current technical requirements must be rechecked before implementation. EDGAR is not a quote feed. | Treat each returned filing/fact with accession, filing date, period, unit, and source URL. Public access is not a blanket license to repackage market data or filing content; follow SEC access policies and attribution requirements. | Preferred official source for US filings/fundamentals after endpoint policy review; not a market-price provider. |
| HDFC Bank investor relations / exchange filings | Existing fundamentals dataset | The HDFC fundamentals layer uses curated values tied to official HDFC Bank reports/filings and stores per-metric provenance. | A public filing/source link is preserved. Public availability alone does not establish unrestricted reproduction of report pages or redistribution rights. Do not strip provenance or represent this as a general company-data API. | Keep separate from Yahoo market prices; review content reuse before public redistribution. |

## Evidence reviewed

Links below point to provider or regulator documentation. The review deliberately distinguishes technical access from permission to display or redistribute data.

- Yahoo Finance: [Yahoo Terms of Service](https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html) and the [Finance quote page](https://finance.yahoo.com/). No public API specification or grant for the endpoints used by this project was verified. Direct endpoint use is therefore recorded as unofficial and rights-unknown.
- Upstox: [Analytics Token](https://upstox.com/developer/api-documentation/analytics-token/), [OAuth authentication](https://upstox.com/developer/api-documentation/authentication/), [market quote/OHLC](https://upstox.com/developer/api-documentation/get-market-quote-ohlc/), [historical candles](https://upstox.com/developer/api-documentation/get-historical-candle-data/), and [market-data feed](https://upstox.com/developer/api-documentation/get-market-data-feed/). The authentication guide describes tokens and endpoints; it does not by itself establish redistribution rights.
- Angel One: [SmartAPI documentation](https://smartapi.angelone.in/docs). The documentation was reachable, but relevant public-display and redistribution terms were not established.
- FYERS: [API documentation help center](https://support.fyers.in/portal/en/kb/api-documentation). Access to the help center did not establish display/redistribution rights.
- Twelve Data: [Individual pricing](https://twelvedata.com/pricing), [API documentation](https://twelvedata.com/docs), and [Terms of Use](https://twelvedata.com/terms) (terms page states an update date of 2026-01-01). The Basic tier and terms distinguish access from internal display and impose third-party/exchange compliance responsibilities.
- SEC: [EDGAR API documentation](https://www.sec.gov/edgar/sec-api-documentation). Direct retrieval from this environment returned HTTP 403; re-check SEC technical access guidance before implementation.
- Gemini: [Gemini API terms](https://ai.google.dev/gemini-api/terms). If configured, submit only public, non-confidential input and review the applicable free/unpaid-tier data-use terms at deployment time. The current project has no configured key; this review is not an API test.
- NSE/BSE: public exchange data terms and redistribution rights were not verified in this review. Do not infer rights from a publicly reachable web page, exchange symbol, or third-party quote.

## Meaning of normalized metadata

`MarketDataMetadata` is attached to company, quote, indicator, and historical-price responses and carries:

- `provider`, `instrument`, and `exchange`;
- `asOf` (nullable) and `retrievedAt`;
- `dataStatus`: `LIVE`, `DELAYED`, `EOD`, `DEMO`, `UNAVAILABLE`, or `UNKNOWN`;
- `delaySeconds` (nullable);
- `isUnofficial`; and
- `licenseStatus`: `INTERNAL_ONLY`, `DISPLAY_ALLOWED`, `REDISTRIBUTION_ALLOWED`, `UNKNOWN`, or `REQUIRES_REVIEW`.

These are facts/configuration supplied by an adapter, not a legal opinion. Yahoo responses use `UNKNOWN` for delay and licensing; demo responses use `DEMO` and `INTERNAL_ONLY`. Do not set a more permissive license status without recording the entitlement and review that supports it.

## Runtime and retention safeguards

- Missing or invalid provider configuration does not select Yahoo or demo implicitly.
- Production rejects Yahoo while its display/redistribution rights remain unverified, and rejects demo entirely.
- API market-data responses use `Cache-Control: no-store`.
- Yahoo's prior time-based in-process response cache has been removed. Only concurrent identical requests are coalesced while the upstream request is in flight; no completed Yahoo response is retained by that adapter.
- AI-analysis results are no longer cached in process; each configured Gemini request is a new external request. Synthetic demo market data is rejected by the AI route.
- No provider credentials belong in browser code or `NEXT_PUBLIC_*` variables. Keep keys/tokens server-side and out of source control.
- A provider outage, unsupported provider, bad configuration, or licensing gate returns structured `UNAVAILABLE` metadata and an HTTP error. There is no demo fallback.

## Required approval before public launch

For each provider, retain the exact terms/order form/account entitlement and document authorized instruments, data types, user audience, display/non-display scope, attribution, update/delay obligations, cache/storage duration, redistribution, derived data, rate limits, and exchange fees. If any item is unknown, keep the provider blocked for that deployment mode.

## Security and Supabase review

- `.gitignore` excludes `.env*` except `.env.example`; the example contains blank values. No provider or Gemini credentials are required for the current Yahoo adapter, and no key is configured by this implementation. Keep Supabase service-role credentials and any future provider token server-side. A `NEXT_PUBLIC_*` prefix must never be used for secrets.
- Gemini configuration is read in the `server-only` AI service. The API route checks for a key before making a Gemini request; no key was added and this review did not test a Gemini call. The current rate limit is an in-memory process-local throttle, not suitable as the only control on a horizontally scaled public deployment.
- The existing Supabase migration enables RLS on its tables but creates no RLS policies. No Supabase client/project is configured and the migration has not been applied. Do not deploy client access until explicit least-privilege policies exist; a service-role key bypasses RLS and must be restricted to server code.
- Market, search, fundamentals, and AI API routes do not implement user authentication. The Yahoo production gate prevents public Yahoo responses under the current configuration, but a future provider must not be enabled publicly until its licensing gate and abuse controls are reviewed. Add durable per-user/IP rate limiting, request limits, logging without secrets, and monitoring before exposing paid/quota-limited providers.
