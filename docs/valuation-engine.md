# Deterministic valuation foundation

EquityMind calculates financial metrics and valuations in TypeScript. Gemini may
explain supplied outputs, but it must not supply missing financial facts or
calculate metrics that the application can calculate deterministically.

## Current data boundary

`GET /api/company/{ticker}/valuation` returns company classification, normalized
annual observations, historical CAGRs, assumption availability and provenance,
WACC/DCF status, and scenario status. `POST` accepts explicit analyst assumptions
and scenario overrides and returns the same shape. Both methods are `no-store`.
When the forecast horizon is supplied, the response also includes an explicit
assumption set for each forecast year, forecast FCFF, terminal value, enterprise
and equity value, implied per-share value, upside/downside, WACC/terminal-growth
sensitivity, and Bear/Base/Bull scenario results. The dashboard's DCF panel
consumes this endpoint and shows unavailable inputs rather than substituting
defaults.

The current fundamentals adapter uses only annual periods and maps explicitly
recognized reported financial metric IDs. INR billions are converted to INR
crores; INR crores and crore shares are kept in their disclosed units. Monetary
values without verified INR units remain unavailable rather than being mixed
with INR figures, and capex outflows are normalized to positive spending values.
It retains
each mapped metric's filing URL, period, publication date, retrieval date, unit,
page and section references, and the original provider metric ID. Unavailable
or unrecognized metrics stay `null`.
No quarterly values are substituted for annual statements.

The available curated history is for HDFC Bank. It contains bank disclosures,
not the unlevered operating cash-flow inputs required for an industrial FCFF
model. Bank borrowings, deposits, NII or PAT are not re-labeled as non-financial
company debt, revenue, EBIT, cash flow or cash. The API classifies HDFC Bank as
`BANK` and refuses FCFF DCF. Other companies currently receive no verified
historical financials unless a provider is added; quote availability alone does
not make a DCF possible.

## Normalized periods and calculations

Normalized annual money fields use INR crore when a source reports INR crore or
INR billion; shares use crore shares. A per-share value calculated from those
units is INR/share. A future provider for another currency must normalize each
company's statements to one currency/unit before calling the calculation layer.
Fiscal year is the calendar year containing the annual period end.

The normalization layer calculates revenue growth, EBITDA/EBIT/net margins,
effective tax rate only from reported tax expense and profit before tax, and
change in working capital only from consecutive disclosed working-capital
balances. CAGR requires valid positive endpoints and uses elapsed fiscal years.
Missing inputs, invalid denominators, and missing periods remain unavailable.

Forecast operating assumptions use the arithmetic mean of up to the three most
recent comparable historical observations, with at least two observations
required. This is a transparent baseline, not an investment recommendation.
WACC, terminal growth and forecast horizon are never inferred from a default or
an LLM. They require analyst input or explicit sourced WACC inputs.

## WACC and FCFF DCF

All rate inputs use decimal fractions (`0.08` = 8%). WACC uses:

```text
Cost of equity = risk-free rate + beta × equity risk premium
After-tax cost of debt = cost of debt × (1 - tax rate)
WACC = equity weight × cost of equity + debt weight × after-tax cost of debt
```

The implementation validates rate ranges, beta range, non-negative equity and
debt, positive total capital, capital weights, and WACC greater than terminal
growth. Missing inputs produce `insufficient_data`; invalid assumptions produce
`invalid`; neither is converted into a plausible-looking result.

The non-financial FCFF implementation forecasts revenue, EBIT, NOPAT, D&A,
capital expenditure and change in NWC, then discounts FCFF and terminal value.
Cash, debt and shares outstanding must be supplied in consistent units. The
result includes every forecast-year calculation, discount factor, terminal
value, enterprise/equity value and per-share value. Current price is only a
comparison input; it is never used to derive a valuation assumption.
Explicit annual forecast assumptions override the scalar baseline for the
specified fiscal year. Scalar analyst assumptions are applied across the
forecast years unless an individual year's assumption is provided. The WACC
derived from explicit CAPM and capital-structure inputs is marked system-derived
in the response; the constituent inputs retain their own provenance.

The sensitivity matrix varies supplied WACC and terminal growth by absolute
offsets of -2%, -1%, 0%, +1%, and +2%. A cell is invalid when WACC is not greater
than terminal growth; an incomplete base valuation yields an unavailable matrix.
These offsets are a sensitivity device only and do not establish or recommend
base assumptions.

## Scenarios and analyst inputs

Scenario values are not fabricated. The base scenario uses the selected base
assumptions. Bull and bear scenarios remain unavailable until the analyst
provides at least one explicit override for each. The response marks each
assumption as `derived`, `user_provided` or `unavailable` and includes rationale.

POST body example (rates and ratios are decimals):

```json
{
  "assumptions": {
    "terminalGrowth": 0.025,
    "forecastYears": 5
  },
  "waccInputs": {
    "riskFreeRate": 0.065,
    "beta": 1.1,
    "equityRiskPremium": 0.05,
    "costOfDebt": 0.09,
    "taxRate": 0.25,
    "marketCapitalization": 100000,
    "debt": 20000,
    "terminalGrowth": 0.025
  },
  "scenarios": {
    "bull": { "revenueGrowth": 0.14 },
    "bear": { "revenueGrowth": 0.04 }
  }
}
```

This example shows request shape only; those values are not application
defaults, sourced recommendations, or data for any particular company.
Year-specific assumptions may be supplied in the same request:

```json
{
  "annualForecast": [
    { "fiscalYear": 2027, "revenueGrowth": 0.08, "ebitMargin": 0.16 },
    { "fiscalYear": 2028, "revenueGrowth": 0.07, "ebitMargin": 0.17 }
  ]
}
```

Each annual override must be unique and fall inside the explicitly selected
forecast horizon. Unspecified fields for that year retain the derived or scalar
assumption and its provenance.

## Persistence and next data work

Valuation results are currently calculated on request and are not persisted.
Existing Supabase DCF tables do not make missing source statements or ownership
assumptions valid, and the current product has no authenticated analyst-model
workflow for safely associating editable assumptions. Add persistence only after
defining ownership, model versioning, source links, units, timestamps, and
retention behavior. Never store secrets or turn a persistence failure into a
market-data failure.

To support more issuers, add provider adapters that normalize official filings
into the canonical annual statement fields and retain filing provenance. US
SEC/XBRL facts and Indian issuer filings should remain distinguishable by
taxonomy, units, period, consolidation basis and source. Expand metric mappings
only when the source definition is semantically equivalent; do not map bank
operating metrics into non-financial FCFF inputs.
