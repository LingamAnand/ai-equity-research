# Market data provider review

Reviewed 28 September 2026 (IST). This is a documentation review, not legal advice or confirmation of exchange-data rights. Provider API access, data-feed access, public display, storage, redistribution, and commercial use are separate permissions.

## FYERS API v3 — primary adapter

Official references:

- [FYERS API product page](https://fyers.in/products/api)
- [FYERS API v3 documentation](https://myapi.fyers.in/docsv3)
- [FYERS API terms and conditions](https://fyers.in/terms-and-conditions-api)
- [FYERS mandatory regulatory changes](https://myapi.fyers.in/mandatory-regulatory-changes)

The FYERS product page describes its trading APIs as zero-fee and the v3 documentation describes Standard API limits as free. This does not establish that exchange-feed permissions, brokerage, account services, or all other services are free. The current Prime price was not verified.

API access requires a FYERS account. The data adapter requires a server-side client ID and access token. Obtaining that token follows FYERS' user authorization flow: authorize the app, exchange the resulting auth code using the app ID hash (SHA-256 of app ID plus app secret), and complete the current daily authentication requirements. The FYERS documentation says access tokens expire daily at 6:30 AM; the timezone is not specified on the cited page. Its April 2026 regulatory update says refresh-token flow is discontinued. Do not use the older 15-day refresh-token instructions still visible in parts of the v3 documentation. There is no automatic credential renewal in this application.

FYERS documents a Quotes REST API with LTP and daily quote fields, historical candle data, and market-data WebSocket streaming. Historical candles support second, minute, daily, weekly, and monthly resolutions. Per-request limits documented are up to 100 days for minute resolutions, 30 trading days for second-based charts, and 366 days for daily/weekly/monthly candles; history is documented from 3 July 2017. The adapter chunks longer daily requests into at-most-366-day windows. It does not start a WebSocket or poll.

The April 2026 regulatory page gives non-transactional limits of 10 requests/second, 200/minute, and 100,000/day. The adapter batches quotes, coalesces identical concurrent requests, and spaces outbound requests to remain conservative. General v3 limit descriptions differ from some newer specific limits; re-check the provider's current rules before production use.

The regulatory page requires a primary static IP (secondary optional) for order placement. It does not state that requirement for data-only calls. This application does not place orders.

**Rights limitation:** FYERS' API terms restrict use of exchange data and require written consent for public display, distribution, copying, or redistribution/caching for redistribution. The terms also restrict developing charting/technical-analysis tools from the API content. EquityMind includes chart and research-terminal surfaces, so API access alone is not sufficient permission to activate FYERS for public display or to build on its data. Obtain written confirmation from FYERS and any relevant exchange before using FYERS content in those surfaces or exposing it to other users. Production selection is blocked unless `MARKET_DATA_DISPLAY_RIGHTS_APPROVED=true` is explicitly set after that review; this flag is an operational acknowledgement, not proof of legal permission.

## Angel One SmartAPI — secondary, not implemented

Official references:

- [SmartAPI FAQ](https://smartapi.angelone.in/faq)
- [User/authentication documentation](https://smartapi.angelone.in/docs/User)
- [Market Data API](https://smartapi.angelone.in/docs/MarketData)
- [Historical API](https://smartapi.angelone.in/docs/Historical)
- [Rate limits](https://smartapi.angelone.in/docs/RateLimit)
- [WebSocket Streaming 2.0](https://smartapi.angelone.in/docs/WebSocket2)

The official FAQ says SmartAPI is free of cost, including historical data; this is about API service access, not brokerage or other trading charges. Authentication uses the Angel One account/client code, PIN, TOTP, and an API key. Login provides JWT, refresh, and feed tokens; documentation says sessions end at midnight unless logged out and supports token refresh, but the refresh token's lifetime was not verified. The docs reviewed did not establish whether an active trading account is required for every data call.

The API documents LTP, OHLC, FULL market-data modes, historical candles, and WebSocket streaming. Historical per-request limits range from 30 to 2,000 days depending on interval. Its Market Data page states one request/second for up to 50 symbols while the RateLimit table lists quotes at 10/second; use the lower limit unless Angel One clarifies. SmartAPI examples include local/public IP headers; a static-IP/whitelisting mandate for data-only use was not verified.

**Rights limitation:** the official SmartAPI materials reviewed did not establish public-display, redistribution, commercial-use, retention, or exchange-data licensing permissions. Obtain written clarification from Angel One and any relevant exchange before public use. An adapter has not been implemented or selected.

## Current project behavior

- The server-side provider factory selects exactly one provider using `MARKET_DATA_PROVIDER`.
- Missing configuration selects `unavailable`; it never substitutes Yahoo or demo data.
- `fyers` can be selected for local development only when `FYERS_CLIENT_ID`, a server-configured token or an authenticated `/api/fyers/login` session, and `FYERS_DATA_USE_APPROVED=true` are present after confirming the intended private research/charting use with FYERS.
- Production FYERS selection is blocked until the explicit display review flag is set in addition to the data-use review flag. Yahoo remains blocked in production because its endpoints are unofficial and data rights are unverified. Demo remains development-only.
- FYERS quote/data status and delay status remain `UNKNOWN` unless source metadata establishes otherwise. The application does not label REST quote data real-time.
- `/api/fyers/login` creates a CSRF-protected authorization redirect and `/api/fyers/callback` exchanges the returned code server-side. The callback stores the short-lived access token in an HttpOnly cookie scoped to API routes; it never returns or logs the token. Register the exact `FYERS_REDIRECT_URI` in the FYERS app. The token must be re-authorized after expiry; there is no refresh-token flow.
- Successful non-demo company snapshots and explicitly requested historical candles are best-effort persisted through the Supabase repository. AI reports are persisted only after successful generation, keyed by a hash of the supplied prompt to avoid repeated identical records. Persistence respects the existing RLS policies; it does not bypass them or affect successful API responses when unavailable.
- The app does not place orders or start a market-data WebSocket. The FYERS static-IP requirement noted above is not treated as applicable to these read-only calls.
