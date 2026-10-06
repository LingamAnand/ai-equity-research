# Market data usage policy

## API access is not a data redistribution licence

API price, account eligibility, access to a feed, personal development, display to another user, redistribution, commercial use, storage, derived values, and exchange licensing are separate questions. A provider calling an API "free" does not mean its data may be redistributed or publicly displayed for free.

### FYERS

The [FYERS API product page](https://fyers.in/products/api) describes API access as zero-fee. The [FYERS API terms](https://fyers.in/terms-and-conditions-api) contain restrictions on public display, distribution, and reuse of exchange data, and state that written consent is required for specified redistribution/public-use activities. The terms also restrict using API data to develop charting/technical-analysis tools. Since EquityMind contains research and chart surfaces, personal experimentation must remain private and any display/analysis use in the product requires written confirmation from FYERS and any relevant exchange.

The data adapter does not place orders. FYERS' [April 2026 regulatory changes](https://myapi.fyers.in/mandatory-regulatory-changes) state that static IP requirements apply to order placement; the same page does not establish a static-IP requirement for data-only requests.

### Angel One SmartAPI

The [official FAQ](https://smartapi.angelone.in/faq) describes SmartAPI, including historical data, as free of cost. The official materials reviewed did not settle public display, redistribution, commercial use, retention, or exchange licensing. These uses **require confirmation from provider/exchange**. Angel One is not wired into the application.

## Project controls

- Production starts with market data disabled unless an explicitly selected provider is configured.
- Yahoo uses unofficial public endpoints and remains blocked in production while its rights are unknown.
- FYERS production requests are blocked unless `MARKET_DATA_DISPLAY_RIGHTS_APPROVED=true` is deliberately configured after external rights review. This setting is only a deployment guard; it does not grant rights.
- FYERS is blocked in all environments unless `FYERS_DATA_USE_APPROVED=true` is deliberately configured after confirming that the provider terms permit the intended private research/charting use. This is a guard, not a grant of rights.
- Demo data is synthetic and cannot run in production.
- The FYERS adapter has no persistent quote/history cache and sends credentials only in server-to-server API requests.
- Browser responses contain normalized values and provenance, never broker credentials or provider authorization headers.
- Source timestamps are kept separate from retrieval timestamps; missing source timestamps stay unavailable rather than being replaced with the retrieval time. Unknown delivery conditions remain `UNKNOWN`; values are not called real-time by inference.
- NSE session status is calculated in `Asia/Kolkata` using the [NSE 2026 equity holiday circular](https://nsearchives.nseindia.com/content/circulars/CMTR71775.pdf) and its 2026 municipal-election holiday update, pre-open hours, regular-session hours, and weekends. For years without a reviewed holiday calendar, an in-session weekday is reported as `UNKNOWN`, not `OPEN`.
- Technical request state and usage permission are separate fields. FYERS observations remain `REQUIRES_REVIEW` unless both `FYERS_DATA_USE_APPROVED=true` and `MARKET_DATA_DISPLAY_RIGHTS_APPROVED=true` are explicitly configured. Those flags are deployment controls, not a grant of rights. In non-production environments, a successfully retrieved quote can be displayed with a visible rights-review notice; production retains the display-rights guard.

## AI analysis behavior

- `GET /api/ai/analyze` reports whether the server has a Gemini key configured and which model name is selected; it never returns the key.
- `POST /api/ai/analyze` can explain verified HDFC Bank fundamentals even if market data is disabled. In that case no quote or history is supplied and the AI result records this limitation and the financial source list.
- A successful result explicitly reports `response_received`, supplied-data coverage, source names, reporting periods, and retrieval time. Errors report `not_configured` or `request_failed`.
- Gemini receives a compact allowlisted context: company identity, a normalized quote, at most five historical-price samples, the six supported HDFC periods, selected bank metrics, and concise source names. Duplicate statement/snapshot arrays, UI metadata, raw provider payloads, source URLs, and the full price history are not sent. The analysis is instructed not to calculate financial values or fill unavailable inputs; it is explanatory and is not verified financial data.
- The dashboard requests `/api/company/{ticker}?includeFundamentals=true` so the selected market provider is queried once for the quote used by both the quote panel and deterministic valuation inputs. The default `/api/company/{ticker}` response and the standalone fundamentals route remain available with their original behavior.
- FYERS company search currently matches the adapter's fixed six-company NSE instrument mapping. It is not a general NSE symbol-master search; unknown instruments remain unavailable rather than being guessed or sent to an unsupported provider endpoint.

## Valuation foundation

- The dashboard exposes DCF input/output slots for growth assumptions, forecast period, WACC, terminal growth, cash flow, terminal value, enterprise value, equity value, and per-share value.
- These are currently unavailable. No model assumptions or outputs are supplied until a suitable methodology and verified inputs are implemented. Industrial free-cash-flow methods are not silently applied to HDFC Bank.

## Operational limitations

- The configured provider must be used explicitly; there is no automatic Yahoo/demo fallback.
- FYERS access tokens require a daily authentication cycle according to current provider documentation. When missing or expired, requests return an unavailable/authentication error and no value is substituted.
- Quote and history calls are coalesced while in flight. Dashboard loads data on selection; it does not start an aggressive polling loop.
- Selected company metadata, successful live market-price observations, and AI analysis may be persisted best-effort through the server-only Supabase secret-key client. Failed persistence never blocks provider responses. Supabase persistence is not treated as an entitlement to retain or redistribute provider data.
- Public display, multi-user use, derived data, redistribution, and retention must be reviewed with the provider and exchange before deployment.

See [market-data-provider-review.md](./market-data-provider-review.md) for the source-by-source documentation review.
