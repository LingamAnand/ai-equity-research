"use client";

import { useEffect, useState } from "react";
import type {
  CompanyValuation,
  ValuationRequestInputs,
} from "@/lib/services/valuation-service";
import type {
  DcfResult,
  ForecastAssumptions,
  ForecastYearBreakdown,
  SensitivityMatrix,
  WaccAssumptionModel,
  ValuationScenarioResult,
  WaccResult,
} from "@/lib/types/valuation";

interface DcfPanelProps {
  ticker: string;
}

function formatMoney(value: number | null, currency = "INR"): string {
  if (value === null || !Number.isFinite(value)) {
    return "Unavailable";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatFinancialAmount(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? "Unavailable"
    : `${formatNumber(value)} INR crore`;
}

function formatRate(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? "Unavailable"
    : `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? "Unavailable"
    : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
}

function AssumptionRows({
  assumptions,
}: {
  assumptions: ForecastAssumptions;
}) {
  const rows = [
    ["Forecast years", assumptions.forecastYears],
    ["Revenue growth", assumptions.revenueGrowth],
    ["EBITDA margin", assumptions.ebitdaMargin],
    ["EBIT margin", assumptions.ebitMargin],
    ["Tax rate", assumptions.taxRate],
    ["D&A / revenue", assumptions.depreciationToRevenue],
    ["Capex / revenue", assumptions.capexToRevenue],
    ["Change in NWC / revenue", assumptions.changeInNwcToRevenue],
    ["WACC", assumptions.wacc],
    ["Terminal growth", assumptions.terminalGrowth],
  ] as const;
  return (
    <div className="space-y-2">
      {rows.map(([label, assumption]) => (
        <div
          key={label}
          className="grid grid-cols-[minmax(8rem,1fr)_auto] gap-3 border-b border-[#1a2129] pb-2 text-xs"
        >
          <span className="text-[#b4bec9]">{label}</span>
          <span className="text-right text-[#edf3f8]">
            {label === "Forecast years"
              ? assumption.value === null
                ? "Unavailable"
                : `${assumption.value} years`
              : formatRate(assumption.value)}
            <span className="block text-[9px] uppercase text-[#84909d]">
              {assumption.sourceType} · {assumption.confidence} · {assumption.basis.replaceAll("_", " ")} · {assumption.method}
            </span>
          </span>
          <span className="col-span-2 text-[10px] leading-4 text-[#84909d]">
            {assumption.sourceDescription} {assumption.rationale}
          </span>
          {assumption.provenance.map((source) => (
            <span key={`${source.sourceMetricId}:${source.periodEnd}`} className="col-span-2 text-[9px] text-[#778391]">
              {source.sourceMetricId} · {source.source} · retrieved {source.retrievedAt}
              {source.sourceUrl ? (
                <> · <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="text-[#9fc2ff] underline">filing</a></>
              ) : null}
            </span>
          ))}
        </div>
      ))}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-[10px]">
          <thead>
            <tr className="text-[#98a5b3]">
              {[
                "Forecast year",
                "Revenue growth",
                "EBIT margin",
                "Tax rate",
                "D&A / revenue",
                "Capex / revenue",
                "Change NWC / revenue",
              ].map((heading) => (
                <th key={heading} className="border-b border-[#29323c] p-2">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {assumptions.annualForecast.map((year) => (
              <tr key={year.fiscalYear} className="text-[#d6dee7]">
                <td className="border-b border-[#1a2129] p-2">FY{year.fiscalYear}</td>
                <td className="border-b border-[#1a2129] p-2">{formatRate(year.revenueGrowth.value)}</td>
                <td className="border-b border-[#1a2129] p-2">{formatRate(year.ebitMargin.value)}</td>
                <td className="border-b border-[#1a2129] p-2">{formatRate(year.taxRate.value)}</td>
                <td className="border-b border-[#1a2129] p-2">{formatRate(year.depreciationToRevenue.value)}</td>
                <td className="border-b border-[#1a2129] p-2">{formatRate(year.capexToRevenue.value)}</td>
                <td className="border-b border-[#1a2129] p-2">{formatRate(year.changeInNwcToRevenue.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!assumptions.annualForecast.length ? (
          <p className="mt-2 text-[10px] text-[#84909d]">
            Per-year assumptions are not populated until a forecast horizon is selected.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ForecastTable({ forecast }: { forecast: ForecastYearBreakdown[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-[10px]">
        <thead>
          <tr className="text-[#98a5b3]">
            {["Year", "Revenue", "EBIT", "Tax on EBIT", "NOPAT", "D&A", "Capex", "Δ NWC", "FCFF", "Discount factor", "PV of FCFF"].map(
              (heading) => (
                <th key={heading} className="border-b border-[#29323c] p-2">{heading}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {forecast.map((year) => (
            <tr key={year.fiscalYear} className="text-[#d6dee7]">
              <td className="border-b border-[#1a2129] p-2">FY{year.fiscalYear}</td>
              <td className="border-b border-[#1a2129] p-2">{formatNumber(year.revenue)}</td>
              <td className="border-b border-[#1a2129] p-2">{formatNumber(year.ebit)}</td>
              <td className="border-b border-[#1a2129] p-2">{formatRate(year.taxRate)}</td>
              <td className="border-b border-[#1a2129] p-2">{formatNumber(year.nopat)}</td>
              <td className="border-b border-[#1a2129] p-2">{formatNumber(year.depreciation)}</td>
              <td className="border-b border-[#1a2129] p-2">{formatNumber(year.capex)}</td>
              <td className="border-b border-[#1a2129] p-2">{formatNumber(year.changeInWorkingCapital)}</td>
              <td className="border-b border-[#1a2129] p-2 font-semibold">{formatNumber(year.fcff)}</td>
              <td className="border-b border-[#1a2129] p-2">{formatNumber(year.discountFactor)}</td>
              <td className="border-b border-[#1a2129] p-2">{formatNumber(year.presentValueOfFcff)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WaccSection({
  wacc,
  assumptions,
}: {
  wacc: WaccResult;
  assumptions: WaccAssumptionModel;
}) {
  const rows = [
    ["Risk-free rate", assumptions.riskFreeRate, formatRate],
    ["Beta", assumptions.beta, formatNumber],
    ["Equity risk premium", assumptions.equityRiskPremium, formatRate],
    ["Cost of equity", assumptions.costOfEquity, formatRate],
    ["Pre-tax cost of debt", assumptions.preTaxCostOfDebt, formatRate],
    ["After-tax cost of debt", assumptions.afterTaxCostOfDebt, formatRate],
    ["WACC tax rate", assumptions.taxRate, formatRate],
    ["Debt", assumptions.debt, formatFinancialAmount],
    ["Equity / market capitalization", assumptions.equity, formatFinancialAmount],
    ["Equity weight", assumptions.equityWeight, formatRate],
    ["Debt weight", assumptions.debtWeight, formatRate],
    ["WACC", assumptions.wacc, formatRate],
  ] as const;
  return (
    <div className="space-y-2 text-xs text-[#b4bec9]">
      <div>Ke = Rf + β × ERP</div>
      <div>WACC = E/(D+E) × Ke + D/(D+E) × Kd × (1 − T)</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, assumption, formatter]) => (
          <div key={label} className="rounded-md border border-[#202a34] p-2">
            <div className="text-[9px] uppercase text-[#8190a0]">{label}</div>
            <div className="mt-1 text-[#e8eef4]">
              {formatter(assumption.value)}
            </div>
            <div className="mt-1 text-[9px] text-[#8190a0]">
              {assumption.sourceType} · {assumption.confidence} · {assumption.basis.replaceAll("_", " ")} · {assumption.method}
            </div>
            <div className="mt-1 text-[9px] leading-4 text-[#8190a0]">
              {assumption.sourceDescription} {assumption.rationale}
            </div>
            {assumption.provenance.map((source) => (
              <div key={`${source.sourceMetricId}:${source.periodEnd}`} className="mt-1 text-[9px] text-[#778391]">
                {source.sourceMetricId} · {source.source} · retrieved {source.retrievedAt}
              </div>
            ))}
          </div>
        ))}
      </div>
      {wacc.status === "available" ? (
        <dl className="grid grid-cols-2 gap-2">
          <dt>Cost of equity (Ke)</dt><dd>{formatRate(wacc.costOfEquity)}</dd>
          <dt>Equity weight</dt><dd>{formatRate(wacc.equityWeight)}</dd>
          <dt>Debt weight</dt><dd>{formatRate(wacc.debtWeight)}</dd>
          <dt>After-tax cost of debt</dt><dd>{formatRate(wacc.afterTaxCostOfDebt)}</dd>
          <dt>WACC</dt><dd className="font-semibold text-[#edf3f8]">{formatRate(wacc.wacc)}</dd>
        </dl>
      ) : (
        <div>
          <div className="font-medium text-[#efc86b]">
            {wacc.status === "invalid" ? "Invalid WACC inputs" : "WACC unavailable"}
          </div>
          {[...wacc.missingInputs, ...wacc.errors].map((item) => (
            <div key={item} className="mt-1 text-[10px]">{item}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function SensitivitySection({
  sensitivity,
}: {
  sensitivity: SensitivityMatrix;
}) {
  if (sensitivity.status !== "available") {
    return <p className="text-xs text-[#98a5b3]">{sensitivity.reason ?? "Sensitivity unavailable."}</p>;
  }
  return (
    <div>
      <p className="mb-2 text-[10px] text-[#98a5b3]">
        Rows: WACC · Columns: terminal growth · Values: intrinsic value/share ·{" "}
        {sensitivity.basis}
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-right text-[10px]">
          <thead>
            <tr>
              <th className="border-b border-[#29323c] p-2 text-left">WACC \ g</th>
              {sensitivity.terminalGrowthValues.map((value) => (
                <th key={value} className="border-b border-[#29323c] p-2">{formatRate(value)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sensitivity.cells.map((row, index) => (
              <tr key={sensitivity.waccValues[index]}>
                <th className="border-b border-[#1a2129] p-2 text-left">{formatRate(sensitivity.waccValues[index]!)}</th>
                {row.map((cell) => (
                  <td
                    key={`${cell.wacc}:${cell.terminalGrowth}`}
                    title={cell.reason ?? undefined}
                    className={`border-b border-[#1a2129] p-2 ${cell.status === "invalid" ? "text-[#778391]" : "text-[#dfeaf5]"}`}
                  >
                    {cell.status === "invalid" ? "Invalid" : formatNumber(cell.intrinsicValuePerShare)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScenarioSection({
  scenarios,
}: {
  scenarios: ValuationScenarioResult[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {scenarios.map((scenario) => (
        <div key={scenario.name} className="rounded-lg border border-[#26313c] p-3">
          <div className="text-xs font-semibold uppercase text-[#dfeaf5]">{scenario.name}</div>
          <div className="mt-1 text-[10px] text-[#98a5b3]">{scenario.status.replaceAll("_", " ")}</div>
          <div className="mt-2 text-sm text-[#edf3f8]">
            {formatMoney(scenario.intrinsicValuePerShare)}
          </div>
          <div className="mt-2 text-[9px] leading-4 text-[#8190a0]">
            Revenue growth {formatRate(scenario.assumptions.revenueGrowth.value)} · {scenario.assumptions.revenueGrowth.sourceType}
            <br />
            EBIT margin {formatRate(scenario.assumptions.ebitMargin.value)} · {scenario.assumptions.ebitMargin.sourceType}
            <br />
            WACC {formatRate(scenario.assumptions.wacc.value)} · terminal growth {formatRate(scenario.assumptions.terminalGrowth.value)}
          </div>
          {scenario.missingInputs.map((item) => (
            <p key={item} className="mt-1 text-[9px] leading-4 text-[#84909d]">{item}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

function AnalystInputsForm({
  ticker,
  onValuation,
}: {
  ticker: string;
  onValuation: (valuation: CompanyValuation) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const number = (key: string): number | undefined => {
      const raw = form.get(key);
      if (typeof raw !== "string" || raw.trim() === "") {
        return undefined;
      }
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    };
    const assumptions: NonNullable<ValuationRequestInputs["assumptions"]> = {};
    for (const key of [
      "forecastYears",
      "terminalGrowth",
      "revenueGrowth",
      "ebitMargin",
      "taxRate",
      "depreciationToRevenue",
      "capexToRevenue",
      "changeInNwcToRevenue",
    ] as const) {
      const value = number(key);
      if (value !== undefined) {
        assumptions[key] = value;
      }
    }
    const waccInputs: NonNullable<ValuationRequestInputs["waccInputs"]> = {
      riskFreeRate: number("riskFreeRate") ?? null,
      beta: number("beta") ?? null,
      equityRiskPremium: number("equityRiskPremium") ?? null,
      costOfDebt: number("costOfDebt") ?? null,
      taxRate: number("waccTaxRate") ?? null,
      marketCapitalization: number("marketCapitalization") ?? null,
      debt: number("debt") ?? null,
    };
    try {
      const response = await fetch(
        `/api/company/${encodeURIComponent(ticker)}/valuation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ assumptions, waccInputs }),
        },
      );
      const payload = (await response.json()) as
        | CompanyValuation
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in payload
            ? payload.error ?? `Valuation request failed (${response.status}).`
            : `Valuation request failed (${response.status}).`,
        );
      }
      onValuation(payload as CompanyValuation);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to calculate valuation from the supplied inputs.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <details className="rounded-lg border border-[#202a34] bg-[#10171d] p-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-[#dfeaf5]">
        Analyst inputs · not saved
      </summary>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <p className="text-[10px] leading-4 text-[#98a5b3]">
          No generic discount-rate, terminal-growth, or forecast-horizon defaults
          are applied. Enter sourced analyst inputs; blank optional operating
          overrides continue to use historical-derived assumptions.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["forecastYears", "Forecast years", "1", "20", "1", true],
            ["terminalGrowth", "Terminal growth (decimal)", "0", "1", "0.001", true],
            ["riskFreeRate", "Risk-free rate (decimal)", "0", "1", "0.001", true],
            ["beta", "Beta", "-5", "5", "0.01", true],
            ["equityRiskPremium", "Equity risk premium (decimal)", "0", "1", "0.001", true],
            ["costOfDebt", "Pre-tax cost of debt (decimal)", "0", "1", "0.001", true],
            ["marketCapitalization", "Market capitalization (INR crore)", "0", undefined, "any", false],
            ["debt", "Debt (INR crore)", "0", undefined, "any", false],
            ["waccTaxRate", "WACC tax rate (decimal)", "0", "1", "0.001", false],
          ].map(([name, label, min, max, step, required]) => (
            <label key={String(name)} className="space-y-1 text-[9px] text-[#98a5b3]">
              <span>{String(label)}</span>
              <input
                name={String(name)}
                type="number"
                min={min === undefined ? undefined : String(min)}
                max={max === undefined ? undefined : String(max)}
                step={String(step)}
                required={Boolean(required)}
                className="w-full rounded border border-[#29323c] bg-[#0d1318] px-2 py-1.5 text-xs text-[#e8eef4]"
              />
            </label>
          ))}
        </div>
        <details className="rounded border border-[#202a34] p-2">
          <summary className="cursor-pointer text-[10px] text-[#b4bec9]">
            Optional analyst overrides for operating assumptions
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              ["revenueGrowth", "Revenue growth"],
              ["ebitMargin", "EBIT margin"],
              ["taxRate", "Forecast tax rate"],
              ["depreciationToRevenue", "D&A / revenue"],
              ["capexToRevenue", "Capex / revenue"],
              ["changeInNwcToRevenue", "Change in NWC / revenue"],
            ].map(([name, label]) => (
              <label key={name} className="space-y-1 text-[9px] text-[#98a5b3]">
                <span>{label} (decimal)</span>
                <input
                  name={name}
                  type="number"
                  step="0.001"
                  className="w-full rounded border border-[#29323c] bg-[#0d1318] px-2 py-1.5 text-xs text-[#e8eef4]"
                />
              </label>
            ))}
          </div>
        </details>
        {error ? <p role="alert" className="text-[10px] text-[#f0a78f]">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded border border-[#55749a] px-3 py-1.5 text-[10px] font-medium text-[#dfeaf5] disabled:opacity-50"
        >
          {submitting ? "Calculating…" : "Calculate with these inputs"}
        </button>
      </form>
    </details>
  );
}

function Detail({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-[#202a34] bg-[#0d1318] p-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-[#dfeaf5]">
        {title}<span className="float-right text-[#8190a0] group-open:rotate-180">⌄</span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function DcfResults({
  valuation,
  ticker,
  onValuation,
}: {
  valuation: CompanyValuation;
  ticker: string;
  onValuation: (valuation: CompanyValuation) => void;
}) {
  const dcf = valuation.dcf;
  const available = dcf.status === "available";
  const currentPrice = valuation.currentPrice;
  const availableDcf = (result: DcfResult): result is Extract<DcfResult, { status: "available" }> =>
    result.status === "available";
  const result = availableDcf(dcf) ? dcf : null;
  const latestFinancials = valuation.historicalFinancials.at(-1);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#202a34] bg-[#10171d] p-3 text-[10px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold uppercase tracking-wide text-[#dfeaf5]">
            {valuation.sectorClassification.replaceAll("_", " ")} · {valuation.valuationMethod.replaceAll("_", " ")}
          </div>
          <div className="text-[#98a5b3]">
            Method {valuation.methodStatus.replaceAll("_", " ")}
          </div>
        </div>
        <p className="mt-2 leading-4 text-[#98a5b3]">{valuation.methodExplanation}</p>
        {valuation.reason ? (
          <p className="mt-2 leading-4 text-[#b8aa8e]">{valuation.reason}</p>
        ) : null}
        <div className="mt-2 grid gap-1 text-[#98a5b3] sm:grid-cols-3">
          <span>Financial data: {valuation.dataQuality.status}</span>
          <span>Completeness: {(valuation.dataQuality.completeness * 100).toFixed(0)}%</span>
          <span>Quality: {valuation.dataQuality.quality}</span>
          <span>
            Latest retrieval: {valuation.dataQuality.latestRetrievedAt ?? "Unavailable"}
          </span>
          <span>
            Sourced metrics: {valuation.dataQuality.sourcedMetricCount}/{valuation.dataQuality.expectedMetricCount}
          </span>
        </div>
        <p className="mt-2 leading-4 text-[#778391]">{valuation.dataQuality.rationale}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {[
          ["Current price", currentPrice.value === null ? "Unavailable" : formatMoney(currentPrice.value, currentPrice.currency ?? "INR")],
          ["Intrinsic value / share", formatMoney(result?.valuePerShare ?? null, currentPrice.currency ?? "INR")],
          ["Enterprise value", formatFinancialAmount(result?.enterpriseValue ?? null)],
          ["Equity value", formatFinancialAmount(result?.equityValue ?? null)],
          ["WACC", formatRate(valuation.assumptions.wacc.value)],
          ["Terminal growth", formatRate(valuation.assumptions.terminalGrowth.value)],
          ["Terminal value", formatFinancialAmount(result?.terminalValue ?? null)],
          ["Terminal value / EV", formatRate(result?.terminalValuePercentOfEnterpriseValue ?? null)],
          ["PV of forecast FCFF", formatFinancialAmount(result?.presentValueOfForecastFcff ?? null)],
          ["PV of terminal value", formatFinancialAmount(result?.terminalValuePresentValue ?? null)],
          ["Upside / downside", formatRate(result?.upsideDownside ?? null)],
          ["Cash", formatFinancialAmount(latestFinancials?.cash ?? null)],
          ["Short-term debt", formatFinancialAmount(latestFinancials?.shortTermDebt ?? null)],
          ["Long-term debt", formatFinancialAmount(latestFinancials?.longTermDebt ?? null)],
          ["Total debt", formatFinancialAmount(latestFinancials?.debt ?? null)],
          ["Net debt / (cash)", formatFinancialAmount(result?.netDebt ?? null)],
          ["Diluted shares", latestFinancials?.dilutedShares === null || latestFinancials?.dilutedShares === undefined ? "Unavailable" : `${formatNumber(latestFinancials.dilutedShares)} crore shares`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[#202a34] bg-[#10171d] p-2">
            <div className="text-[9px] uppercase tracking-wide text-[#8190a0]">{label}</div>
            <div className="mt-1 text-xs font-semibold text-[#e8eef4]">{value}</div>
          </div>
        ))}
      </div>
      <AnalystInputsForm ticker={ticker} onValuation={onValuation} />
      {currentPrice.source ? (
        <p className="text-[9px] text-[#8190a0]">
          Current price source: {currentPrice.source} · retrieved {currentPrice.retrievedAt ?? "Unavailable"} · as of {currentPrice.asOf ?? "Unavailable"} · {currentPrice.dataStatus ?? "Unavailable"}
        </p>
      ) : null}
      {currentPrice.licenseStatus === "REQUIRES_REVIEW" ? (
        <p className="text-[10px] text-[#efc86b]">
          Market price retrieved; data display/use rights remain under review.
        </p>
      ) : null}
      {!available ? (
        <div className="rounded-lg border border-[#58472a] bg-[#18150f] p-3">
          <div className="text-xs font-medium text-[#efc86b]">
            {valuation.valuationMethod.replaceAll("_", " ")} · FCFF DCF unavailable
          </div>
          {[...dcf.missingInputs, ...dcf.errors].map((item) => (
            <p key={item} className="mt-1 text-[10px] leading-4 text-[#b8aa8e]">{item}</p>
          ))}
        </div>
      ) : null}
      <Detail title="A. Assumptions">
        <AssumptionRows assumptions={valuation.assumptions} />
      </Detail>
      <Detail title="B. WACC calculation">
        <WaccSection
          wacc={valuation.wacc}
          assumptions={valuation.waccAssumptions}
        />
      </Detail>
      <Detail title="C–D. Forecast and FCFF">
        {result ? <ForecastTable forecast={result.forecast} /> : (
          <p className="text-xs text-[#98a5b3]">Forecast and FCFF require complete verified inputs.</p>
        )}
      </Detail>
      <Detail title="E. Terminal value">
        <p className="mb-2 text-[10px] leading-4 text-[#98a5b3]">
          Gordon Growth: TV = FCFF in year n × (1 + g) / (WACC − g). Terminal
          growth is not inferred into the model; the historical-growth figure
          below is a reference only and requires analyst confirmation.
        </p>
        <p className="mb-2 text-[10px] text-[#98a5b3]">
          Historical long-term revenue growth reference: {formatRate(valuation.terminalGrowthGuidance.value)} · {valuation.terminalGrowthGuidance.method.replaceAll("_", " ")} · analyst confirmation required.
        </p>
        {result ? (
          <dl className="grid grid-cols-2 gap-2 text-xs text-[#b4bec9]">
            <dt>Terminal growth assumption</dt><dd>{formatRate(valuation.assumptions.terminalGrowth.value)} · {valuation.assumptions.terminalGrowth.sourceType}</dd>
            <dt>Final forecast FCFF</dt><dd>{formatFinancialAmount(result.terminalYearFcff)}</dd>
            <dt>Terminal-year FCFF (n+1)</dt><dd>{valuation.assumptions.terminalGrowth.value === null ? "Unavailable" : formatFinancialAmount(result.terminalYearFcff * (1 + valuation.assumptions.terminalGrowth.value))}</dd>
            <dt>Terminal value</dt><dd>{formatFinancialAmount(result.terminalValue)}</dd>
            <dt>Present value of terminal value</dt><dd>{formatFinancialAmount(result.terminalValuePresentValue)}</dd>
            <dt>PV terminal value / enterprise value</dt><dd>{formatRate(result.terminalValuePercentOfEnterpriseValue)}</dd>
          </dl>
        ) : (
          <p className="text-xs text-[#98a5b3]">Terminal value is unavailable until FCFF, WACC, and terminal growth are available.</p>
        )}
      </Detail>
      <Detail title="F. WACC / terminal-growth sensitivity">
        <SensitivitySection sensitivity={valuation.sensitivity} />
      </Detail>
      <Detail title="G. Bear / Base / Bull scenarios">
        <ScenarioSection scenarios={valuation.scenarios} />
      </Detail>
      <Detail title="H. Historical inputs and data sources">
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {valuation.historicalTrends
              .filter((metric) =>
                metric.id === "revenueCagr" ||
                ["revenueYoYGrowth", "ebitdaMargin", "ebitMargin", "netMargin", "effectiveTaxRate", "capexToRevenue", "depreciationToRevenue", "workingCapitalToRevenue", "roe", "roic"]
                  .some((prefix) => metric.id.startsWith(`${prefix}:`)) &&
                metric.periodEnd === valuation.historicalFinancials.at(-1)?.periodEnd,
              )
              .map((metric) => (
                <div key={metric.id} className="rounded-md border border-[#202a34] p-2 text-[10px]">
                  <div className="font-medium text-[#dfeaf5]">{metric.id.replace(/:\d{4}$/, "").replaceAll(/([A-Z])/g, " $1")}</div>
                  <div className="mt-1 text-[#b4bec9]">{metric.value === null ? "Unavailable" : formatRate(metric.value)} · {metric.sourceType} · {metric.confidence}</div>
                  <p className="mt-1 leading-4 text-[#8190a0]">{metric.basis}</p>
                  {metric.provenance.map((source) => (
                    <p key={`${source.sourceMetricId}:${source.periodEnd}`} className="mt-1 text-[#778391]">
                      {source.sourceMetricId} · {source.source} · retrieved {source.retrievedAt}
                    </p>
                  ))}
                </div>
              ))}
          </div>
          {valuation.historicalFinancials.length ? (
            <div className="overflow-x-auto">
              <p className="mb-2 text-[10px] text-[#98a5b3]">
                Historical monetary values are shown in INR crore; ratios use only
                reported period-matched inputs.
              </p>
              <table className="w-full min-w-[900px] border-collapse text-left text-[10px]">
                <thead>
                  <tr className="text-[#98a5b3]">
                    {[
                      "FY",
                      "Revenue",
                      "Growth",
                      "EBITDA margin",
                      "EBIT margin",
                      "Effective tax",
                      "D&A / revenue",
                      "Capex / revenue",
                      "Δ NWC / revenue",
                    ].map((heading) => (
                      <th key={heading} className="border-b border-[#29323c] p-2">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {valuation.historicalFinancials.map((year) => (
                    <tr key={year.fiscalYear} className="text-[#d6dee7]">
                      <td className="border-b border-[#1a2129] p-2">FY{year.fiscalYear}</td>
                      <td className="border-b border-[#1a2129] p-2">{formatFinancialAmount(year.revenue)}</td>
                      <td className="border-b border-[#1a2129] p-2">{formatRate(year.revenueGrowth)}</td>
                      <td className="border-b border-[#1a2129] p-2">{formatRate(year.ebitdaMargin)}</td>
                      <td className="border-b border-[#1a2129] p-2">{formatRate(year.ebitMargin)}</td>
                      <td className="border-b border-[#1a2129] p-2">{formatRate(year.taxRate)}</td>
                      <td className="border-b border-[#1a2129] p-2">{formatRate(year.revenue && year.depreciation !== null ? year.depreciation / year.revenue : null)}</td>
                      <td className="border-b border-[#1a2129] p-2">{formatRate(year.revenue && year.capex !== null ? year.capex / year.revenue : null)}</td>
                      <td className="border-b border-[#1a2129] p-2">{formatRate(year.revenue && year.changeInWorkingCapital !== null ? year.changeInWorkingCapital / year.revenue : null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {valuation.historicalFinancials.map((year) => (
            <div key={year.periodEnd} className="rounded-lg border border-[#202a34] p-2">
              <div className="text-xs font-semibold text-[#dfeaf5]">FY ended {year.periodEnd}</div>
              <div className="mt-1 grid gap-1 text-[10px] sm:grid-cols-2">
                {Object.entries(year.provenance ?? {}).map(([metric, source]) => (
                  source?.sourceUrl ? (
                    <a
                      key={metric}
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#9fc2ff] underline underline-offset-2"
                      title={`${source.sectionReference} · ${source.pageReference}`}
                    >
                      {metric} · {source.sourceMetricId} · {source.source}
                    </a>
                  ) : (
                    <p key={metric} className="text-[#98a5b3]">
                      {metric} · {source?.sourceMetricId} · {source?.source}
                    </p>
                  )
                ))}
              </div>
            </div>
          ))}
          {!valuation.historicalFinancials.length ? (
            <p className="text-xs text-[#98a5b3]">No verified annual source statements are available.</p>
          ) : null}
          {valuation.warnings.map((warning) => (
            <p key={warning} className="text-[10px] text-[#98a5b3]">{warning}</p>
          ))}
        </div>
      </Detail>
    </div>
  );
}

export function DcfPanel({ ticker }: DcfPanelProps) {
  const [request, setRequest] = useState<{
    ticker: string;
    valuation: CompanyValuation | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/company/${encodeURIComponent(ticker)}/valuation`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json()) as CompanyValuation | { error?: string };
        if (controller.signal.aborted) {
          return;
        }
        if (!response.ok) {
          throw new Error("error" in payload ? payload.error ?? `DCF request failed (${response.status}).` : `DCF request failed (${response.status}).`);
        }
        setRequest({ ticker, valuation: payload as CompanyValuation, error: null });
      })
      .catch((reason: unknown) => {
        if (
          controller.signal.aborted ||
          (reason instanceof DOMException && reason.name === "AbortError")
        ) {
          return;
        }
        setRequest({
          ticker,
          valuation: null,
          error: reason instanceof Error ? reason.message : "DCF valuation unavailable.",
        });
      });
    return () => controller.abort();
  }, [ticker]);
  const currentRequest = request?.ticker === ticker ? request : null;
  const loading = currentRequest === null;
  const error = currentRequest?.error ?? null;
  const valuation = currentRequest?.valuation ?? null;

  return (
    <section className="rounded-[16px] border border-[#1a2129] bg-[#0d1318] p-4">
      <div className="text-[10px] uppercase tracking-[0.24em] text-[#7d8896]">
        Valuation engine · {ticker}
      </div>
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#f5f8fb]">
        Discounted cash flow
      </h3>
      <p className="mt-1 text-[10px] text-[#8190a0]">
        Deterministic FCFF valuation · no assumed WACC or fabricated financial data
      </p>
      {loading ? (
        <p className="mt-4 text-xs text-[#98a5b3]" role="status">Loading sourced valuation inputs…</p>
      ) : error ? (
        <p className="mt-4 text-xs text-[#f0a78f]" role="alert">{error}</p>
      ) : valuation ? (
        <div className="mt-4">
          <DcfResults
            valuation={valuation}
            ticker={ticker}
            onValuation={(updatedValuation) =>
              setRequest({ ticker, valuation: updatedValuation, error: null })
            }
          />
        </div>
      ) : null}
    </section>
  );
}
