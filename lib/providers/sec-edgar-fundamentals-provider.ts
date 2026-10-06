import type { Company } from "../types/financial.ts";
import type {
  FundamentalMetric,
  FundamentalPeriod,
  FundamentalProvenance,
  FundamentalSource,
  FundamentalUnit,
  FundamentalsHistory,
  FundamentalsReportingPeriod,
} from "../types/fundamentals.ts";
import { reportedMetric, unavailableMetric, validateFundamentalsHistory } from "../calculations/fundamentals.ts";
import type { FundamentalsProvider } from "./fundamentals-provider.ts";

const COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_DATA_URL = "https://data.sec.gov";
const SEC_ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data";
const COMPANY_TICKERS_TTL_MS = 24 * 60 * 60 * 1000;
const COMPANY_FACTS_TTL_MS = 6 * 60 * 60 * 1000;
const SUBMISSIONS_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ANNUAL_PERIODS = 6;
const ANNUAL_FORMS = new Set(["10-K", "20-F", "40-F"]);

interface SecTickerRecord {
  cik_str: number;
  ticker: string;
  title: string;
}

interface SecObservation {
  val: number;
  end: string;
  start?: string;
  filed: string;
  form: string;
  fp?: string;
  fy?: number;
  accessionNumber?: string;
  primaryDocument?: string;
}

interface SecFact {
  label?: string;
  units?: Record<string, SecObservation[]>;
}

interface SecCompanyFacts {
  entityName?: string;
  facts?: Record<string, Record<string, SecFact>>;
}

interface SecSubmissions {
  name?: string;
  sic?: string;
  sicDescription?: string;
  exchanges?: string[];
  tickers?: string[];
}

interface CachedValue {
  value: unknown;
  expiresAt: number;
}

interface AnnualPeriodCandidate {
  end: string;
  start: string;
  fiscalYear: number;
  revenueObservation: SecObservation;
}

export class SecEdgarProviderError extends Error {
  readonly code: "configuration_error" | "upstream_error" | "invalid_response";

  constructor(
    message: string,
    code: SecEdgarProviderError["code"],
  ) {
    super(message);
    this.name = "SecEdgarProviderError";
    this.code = code;
  }
}

type SecFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  );
}

function annualDuration(observation: SecObservation): boolean {
  if (
    !ANNUAL_FORMS.has(observation.form) ||
    observation.fp !== "FY" ||
    !observation.start ||
    !validIsoDate(observation.start) ||
    !validIsoDate(observation.end)
  ) {
    return false;
  }
  const days =
    (Date.parse(`${observation.end}T00:00:00.000Z`) -
      Date.parse(`${observation.start}T00:00:00.000Z`)) /
    (24 * 60 * 60 * 1000);
  return days >= 300 && days <= 400;
}

function annualObservations(
  facts: SecCompanyFacts,
  taxonomy: string,
  tags: readonly string[],
  unit: string,
): SecObservation[] {
  const namespace = facts.facts?.[taxonomy];
  if (!namespace) {
    return [];
  }
  for (const tag of tags) {
    const observations = namespace[tag]?.units?.[unit];
    if (observations?.length) {
      return observations.filter(annualDuration);
    }
  }
  return [];
}

function selectAnnualObservation(
  facts: SecCompanyFacts,
  taxonomy: string,
  tags: readonly string[],
  period: AnnualPeriodCandidate,
  unit: string,
): SecObservation | null {
  const observations = annualObservations(facts, taxonomy, tags, unit)
    .filter(
      (observation) =>
        observation.end === period.end &&
        observation.start === period.start &&
        observation.fy === period.fiscalYear,
    )
    .sort((left, right) => right.filed.localeCompare(left.filed));
  return observations[0] ?? null;
}

function factObservation(
  facts: SecCompanyFacts,
  taxonomy: string,
  tags: readonly string[],
  unit: string,
  predicate: (observation: SecObservation) => boolean,
): SecObservation | null {
  const namespace = facts.facts?.[taxonomy];
  if (!namespace) {
    return null;
  }
  for (const tag of tags) {
    const observations = namespace[tag]?.units?.[unit];
    if (!observations?.length) {
      continue;
    }
    const match = observations
      .filter(predicate)
      .sort((left, right) => right.filed.localeCompare(left.filed))[0];
    if (match) {
      return match;
    }
  }
  return null;
}

function filingUrl(
  cik: number,
  observation: SecObservation | null,
  companyFactsUrl: string,
): string {
  if (
    observation?.accessionNumber &&
    observation.primaryDocument &&
    /^[a-zA-Z0-9._-]+$/.test(observation.primaryDocument)
  ) {
    const accession = observation.accessionNumber.replaceAll("-", "");
    return `${SEC_ARCHIVE_URL}/${cik}/${accession}/${observation.primaryDocument}`;
  }
  return companyFactsUrl;
}

function sourceIdForObservation(
  cik: number,
  observation: SecObservation | null,
  periodEnd: string,
): string {
  return observation?.accessionNumber
    ? `sec-${cik}-${observation.accessionNumber.replaceAll("-", "")}`
    : `sec-${cik}-${periodEnd}`;
}

function financialPeriod(
  candidate: AnnualPeriodCandidate,
  reportingBasis: "consolidated",
): FundamentalsReportingPeriod {
  return {
    id: `fy-${candidate.end}`,
    periodType: "annual",
    periodStart: candidate.start,
    periodEnd: candidate.end,
    label: `FY ended ${candidate.end}`,
    reportingBasis,
  };
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toLocaleUpperCase("en-US");
}

function amountUnit(unit: string): FundamentalUnit | null {
  return unit === "USD" ? "USD_BILLION" : null;
}

function currencyForUnit(unit: FundamentalUnit): string | null {
  return unit === "USD_BILLION" || unit === "USD_MILLION" ? "USD" : null;
}

function isFinancialIssuer(submissions: SecSubmissions): boolean {
  const sic = Number(submissions.sic);
  return (
    !Number.isInteger(sic) ||
    (sic >= 6000 && sic <= 6999) ||
    /\b(bank|finance|financial|insurance|securities|broker|investment|credit union)\b/i.test(
      submissions.sicDescription ?? "",
    )
  );
}

export class SecEdgarFundamentalsProvider implements FundamentalsProvider {
  private readonly fetcher: SecFetch;
  private readonly configuredUserAgent?: string;
  private readonly now: () => number;
  private readonly cache = new Map<string, CachedValue>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private lastRequestAt = 0;
  private readonly knownCompanies = new Map<string, Company>();

  constructor(options: {
    fetcher?: SecFetch;
    userAgent?: string;
    now?: () => number;
  } = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.configuredUserAgent = options.userAgent;
    this.now = options.now ?? Date.now;
  }

  private userAgent(): string {
    const userAgent =
      this.configuredUserAgent ?? process.env.SEC_USER_AGENT?.trim();
    if (!userAgent) {
      throw new SecEdgarProviderError(
        "SEC EDGAR access requires SEC_USER_AGENT to identify this application and provide a monitored contact address.",
        "configuration_error",
      );
    }
    return userAgent;
  }

  private async getJson(url: string, ttlMs: number): Promise<unknown> {
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > this.now()) {
      return cached.value;
    }
    const pending = this.inFlight.get(url);
    if (pending) {
      return pending;
    }

    const request = (async () => {
      const waitMs = Math.max(0, 120 - (this.now() - this.lastRequestAt));
      if (waitMs) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastRequestAt = this.now();
      let response: Response;
      try {
        response = await this.fetcher(url, {
          headers: {
            "User-Agent": this.userAgent(),
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(20_000),
        });
      } catch (error) {
        throw new SecEdgarProviderError(
          `SEC EDGAR request failed: ${error instanceof Error ? error.message : "network error"}`,
          "upstream_error",
        );
      }
      if (!response.ok) {
        throw new SecEdgarProviderError(
          `SEC EDGAR returned HTTP ${response.status}.`,
          "upstream_error",
        );
      }
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new SecEdgarProviderError(
          "SEC EDGAR returned malformed JSON.",
          "invalid_response",
        );
      }
      this.cache.set(url, { value: data, expiresAt: this.now() + ttlMs });
      return data;
    })();
    this.inFlight.set(url, request);
    try {
      return await request;
    } finally {
      this.inFlight.delete(url);
    }
  }

  private async tickerRecords(): Promise<SecTickerRecord[]> {
    const data = await this.getJson(COMPANY_TICKERS_URL, COMPANY_TICKERS_TTL_MS);
    if (!isRecord(data)) {
      throw new SecEdgarProviderError(
        "SEC company ticker lookup returned an unexpected response.",
        "invalid_response",
      );
    }
    const records = Object.values(data).flatMap((value) => {
      if (
        !isRecord(value) ||
        typeof value.cik_str !== "number" ||
        typeof value.ticker !== "string" ||
        typeof value.title !== "string"
      ) {
        return [];
      }
      return [
        {
          cik_str: value.cik_str,
          ticker: value.ticker,
          title: value.title,
        },
      ];
    });
    if (!records.length) {
      throw new SecEdgarProviderError(
        "SEC company ticker lookup contained no valid issuer records.",
        "invalid_response",
      );
    }
    return records;
  }

  private async findTicker(ticker: string): Promise<SecTickerRecord | null> {
    const normalized = normalizeTicker(ticker);
    if (!normalized || /\.(NS|BO)$/.test(normalized)) {
      return null;
    }
    const records = await this.tickerRecords();
    return (
      records.find(
        (record) => normalizeTicker(record.ticker) === normalized,
      ) ?? null
    );
  }

  private async submissions(cik: number): Promise<SecSubmissions> {
    const paddedCik = String(cik).padStart(10, "0");
    const data = await this.getJson(
      `${SEC_DATA_URL}/submissions/CIK${paddedCik}.json`,
      SUBMISSIONS_TTL_MS,
    );
    if (!isRecord(data)) {
      throw new SecEdgarProviderError(
        "SEC issuer submissions returned an unexpected response.",
        "invalid_response",
      );
    }
    return data as SecSubmissions;
  }

  private async companyFacts(cik: number): Promise<SecCompanyFacts> {
    const paddedCik = String(cik).padStart(10, "0");
    const data = await this.getJson(
      `${SEC_DATA_URL}/api/xbrl/companyfacts/CIK${paddedCik}.json`,
      COMPANY_FACTS_TTL_MS,
    );
    if (!isRecord(data) || !isRecord(data.facts)) {
      throw new SecEdgarProviderError(
        "SEC company facts returned an unexpected response.",
        "invalid_response",
      );
    }
    return data as SecCompanyFacts;
  }

  private companyFrom(
    record: SecTickerRecord,
    submissions: SecSubmissions,
    currency: string,
  ): Company {
    const ticker = normalizeTicker(record.ticker);
    const retrievedAt = new Date(this.now()).toISOString();
    const exchange = submissions.exchanges?.[0] ?? "UNAVAILABLE";
    const company: Company = {
      id: `sec-${record.cik_str}`,
      ticker,
      symbol: ticker,
      name: submissions.name ?? record.title,
      exchange,
      countryCode: "US",
      currency,
      sector: null,
      industry: submissions.sicDescription ?? null,
      marketCap: null,
      isActive: true,
      createdAt: retrievedAt,
      updatedAt: retrievedAt,
      source: "SEC EDGAR company submissions and ticker mapping",
      sourceType: "public_api",
      sourceUrl: `https://www.sec.gov/edgar/browse/?CIK=${record.cik_str}&owner=exclude`,
      retrievedAt,
      provider: "unavailable",
      instrument: ticker,
      asOf: null,
      marketTimestamp: null,
      dataStatus: "UNAVAILABLE",
      delaySeconds: null,
      delayStatus: "UNKNOWN",
      marketStatus: "UNKNOWN",
      isUnofficial: false,
      licenseStatus: "UNKNOWN",
    };
    this.knownCompanies.set(ticker, company);
    return company;
  }

  async getCompany(ticker: string): Promise<Company | null> {
    const normalized = normalizeTicker(ticker);
    const cached = this.knownCompanies.get(normalized);
    if (cached) {
      return cached;
    }
    const record = await this.findTicker(ticker);
    if (!record) {
      return null;
    }
    return this.companyFrom(record, await this.submissions(record.cik_str), "UNAVAILABLE");
  }

  async searchCompanies(query: string): Promise<Company[]> {
    const normalized = query.trim().toLocaleUpperCase("en-US");
    if (!normalized) {
      return [];
    }
    const records = await this.tickerRecords();
    return records
      .filter(
        (record) =>
          normalizeTicker(record.ticker).includes(normalized) ||
          record.title.toLocaleUpperCase("en-US").includes(normalized),
      )
      .sort((left, right) => {
        const leftExact = normalizeTicker(left.ticker) === normalized ? 0 : 1;
        const rightExact = normalizeTicker(right.ticker) === normalized ? 0 : 1;
        return leftExact - rightExact || left.title.localeCompare(right.title);
      })
      .slice(0, 10)
      .map((record) =>
        this.companyFrom(
          record,
          { name: record.title },
          "UNAVAILABLE",
        ),
      );
  }

  async getFundamentals(ticker: string): Promise<FundamentalsHistory | null> {
    const tickerRecord = await this.findTicker(ticker);
    if (!tickerRecord) {
      return null;
    }

    const cik = tickerRecord.cik_str;
    const [submissions, facts] = await Promise.all([
      this.submissions(cik),
      this.companyFacts(cik),
    ]);
    const reportingBasis = "consolidated" as const;
    const companyName = submissions.name ?? tickerRecord.title;
    const isFinancial = isFinancialIssuer(submissions);
    const companyFactsUrl = `${SEC_DATA_URL}/api/xbrl/companyfacts/CIK${String(cik).padStart(10, "0")}.json`;
    const revenueObservations = annualObservations(
      facts,
      "us-gaap",
      [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "SalesRevenueNet",
        "Revenues",
        "SalesRevenueGoodsNet",
      ],
      "USD",
    );
    const annualCandidates = [
      ...new Map(
        revenueObservations
          .filter(
            (observation) =>
              typeof observation.fy === "number" &&
              observation.start !== undefined,
          )
          .sort((left, right) => right.end.localeCompare(left.end))
          .map((observation) => [
            observation.end,
            {
              end: observation.end,
              start: observation.start!,
              fiscalYear: observation.fy!,
              revenueObservation: observation,
            },
          ]),
      ).values(),
    ]
      .slice(0, MAX_ANNUAL_PERIODS)
      .sort((left, right) => left.end.localeCompare(right.end));
    if (!annualCandidates.length) {
      return null;
    }

    const sourcesById = new Map<string, FundamentalSource>();
    const sourceFor = (
      candidate: AnnualPeriodCandidate,
      observation: SecObservation | null,
    ) => {
      const sourceId = sourceIdForObservation(cik, observation, candidate.end);
      const publicationDate = observation?.filed ?? candidate.end;
      const sourceUrl = filingUrl(cik, observation, companyFactsUrl);
      if (!sourcesById.has(sourceId)) {
        sourcesById.set(sourceId, {
          id: sourceId,
          source: "SEC EDGAR Form 10-K/20-F XBRL filing",
          sourceType: "official_company_filing",
          sourceUrl,
          publicationDate,
          retrievedAt: new Date(this.now()).toISOString(),
          reportingBasis,
        });
      }
      return { sourceId, sourceUrl, publicationDate };
    };

    const periods = annualCandidates.map((candidate) =>
      financialPeriod(candidate, reportingBasis),
    );
    const metricsByPeriod = new Map<string, FundamentalMetric[]>();

    for (let index = 0; index < annualCandidates.length; index += 1) {
      const candidate = annualCandidates[index]!;
      const period = periods[index]!;
      const periodMetrics: FundamentalMetric[] = [];
      const baseSource = sourceFor(candidate, candidate.revenueObservation);

      const metricProvenance = (
        id: string,
        unit: FundamentalUnit,
        observation: SecObservation | null,
        periodOverride?: FundamentalPeriod,
      ): FundamentalProvenance => {
        const source = sourceFor(candidate, observation);
        return {
          sourceId: source.sourceId,
          source: "SEC EDGAR XBRL company facts",
          sourceType: "official_company_filing",
          sourceUrl: source.sourceUrl,
          period: periodOverride ?? period,
          publicationDate: source.publicationDate,
          unit,
          currency: currencyForUnit(unit),
          retrievedAt: new Date(this.now()).toISOString(),
          pageReference: "SEC EDGAR XBRL company facts",
          sectionReference: id,
          reportingBasis,
        };
      };

      const reportedAmount = (
        id: string,
        tags: readonly string[],
        duration = true,
      ): FundamentalMetric => {
        const observation = duration
          ? selectAnnualObservation(facts, "us-gaap", tags, candidate, "USD")
          : factObservation(
              facts,
              "us-gaap",
              tags,
              "USD",
              (item) =>
                item.end === candidate.end &&
                ANNUAL_FORMS.has(item.form) &&
                item.fp === "FY",
            );
        const unit = amountUnit("USD")!;
        const instantPeriod =
          !duration && observation
            ? {
                id: `${id}-${observation.end}`,
                periodType: "instant" as const,
                periodStart: null,
                periodEnd: observation.end,
                label: `${id} as of ${observation.end}`,
              }
            : undefined;
        const provenance = metricProvenance(
          id,
          unit,
          observation,
          instantPeriod,
        );
        const metric = observation
          ? reportedMetric(
              id,
              period.id,
              observation.val / 1_000_000_000,
              provenance,
            )
          : unavailableMetric(
              id,
              period.id,
              {
                ...metricProvenance(id, unit, null),
                sourceId: baseSource.sourceId,
                sourceUrl: baseSource.sourceUrl,
                publicationDate: baseSource.publicationDate,
              },
              `No annual ${tags.join(" or ")} observation is available in the SEC filing for ${period.label}; no value is substituted.`,
            );
        periodMetrics.push(metric);
        return metric;
      };

      const reportedShares = (
        id: string,
        tags: readonly string[],
        useCoverPage: boolean,
      ): FundamentalMetric => {
        const observation = useCoverPage
          ? factObservation(
              facts,
              "dei",
              tags,
              "shares",
              (item) =>
                item.fy === candidate.fiscalYear &&
                item.fp === "FY" &&
                ANNUAL_FORMS.has(item.form) &&
                Date.parse(item.end) >= Date.parse(candidate.end) &&
                Date.parse(item.end) <=
                  Date.parse(candidate.end) + 120 * 24 * 60 * 60 * 1000,
            )
          : selectAnnualObservation(facts, "us-gaap", tags, candidate, "shares");
        const unit: FundamentalUnit = "BILLION_SHARES";
        let metricPeriod = period as FundamentalPeriod;
        if (observation && useCoverPage) {
          metricPeriod = {
            id: `shares-${observation.end}`,
            periodType: "instant",
            periodStart: null,
            periodEnd: observation.end,
            label: `Shares outstanding as of ${observation.end}`,
          };
        }
        const provenance = metricProvenance(
          id,
          unit,
          observation,
          metricPeriod,
        );
        const metric = observation
          ? reportedMetric(
              id,
              period.id,
              observation.val / 1_000_000_000,
              provenance,
            )
          : unavailableMetric(
              id,
              period.id,
              {
                ...metricProvenance(id, unit, null),
                sourceId: baseSource.sourceId,
                sourceUrl: baseSource.sourceUrl,
                publicationDate: baseSource.publicationDate,
              },
              `No annual ${tags.join(" or ")} share observation is available for ${period.label}.`,
            );
        periodMetrics.push(metric);
        return metric;
      };

      const revenue = reportedAmount("revenue", [
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "SalesRevenueNet",
        "Revenues",
        "SalesRevenueGoodsNet",
      ]);
      const ebit = reportedAmount("ebit", ["OperatingIncomeLoss"]);
      const depreciationTotal = reportedAmount("depreciation", [
        "DepreciationDepletionAndAmortization",
        "DepreciationAndAmortization",
      ]);
      let depreciation = depreciationTotal;
      if (depreciation.status === "unavailable") {
        const depreciationOnly = reportedAmount("depreciationExpense", [
          "Depreciation",
        ]);
        const amortizationOnly = reportedAmount(
          "amortizationExpense",
          ["AmortizationOfIntangibleAssets"],
        );
        if (
          depreciationOnly.status !== "unavailable" &&
          amortizationOnly.status !== "unavailable"
        ) {
          periodMetrics.splice(periodMetrics.indexOf(depreciationTotal), 1);
          const inputs = [depreciationOnly, amortizationOnly];
          const sources = inputs.map((metric) => metric.provenance);
          const sourceUrls = [
            ...new Set(sources.map((source) => source.sourceUrl)),
          ];
          const provenance: FundamentalProvenance = {
            ...sources[0]!,
            sourceId: null,
            source: "EquityMind deterministic calculation from SEC observations",
            sourceType: "calculated",
            sourceUrl: sourceUrls.length === 1 ? sourceUrls[0]! : companyFactsUrl,
            publicationDate: sources
              .map((source) => source.publicationDate)
              .sort()
              .at(-1)!,
            unit: "USD_BILLION",
            currency: "USD",
            pageReference: "Calculated from cited SEC XBRL facts",
            sectionReference: "depreciationExpense + amortizationExpense",
          };
          depreciation = {
            id: "depreciation",
            periodId: period.id,
            value: depreciationOnly.value + amortizationOnly.value,
            status: "calculated",
            provenance,
            formula: "depreciation expense + amortization expense",
            inputMetricIds: inputs.map(
              (metric) => `${metric.id}@${metric.periodId}`,
            ),
            inputs: inputs.map((metric) => ({
              id: metric.id,
              periodId: metric.periodId,
              value: metric.value,
              provenance: metric.provenance,
            })),
            calculatedAt: new Date(this.now()).toISOString(),
          };
          periodMetrics.push(depreciation);
        }
      }
      const interestExpense = reportedAmount("interestExpense", [
        "InterestExpenseNonoperating",
        "InterestExpense",
        "InterestAndDebtExpense",
      ]);
      const profitBeforeTax = reportedAmount("profitBeforeTax", [
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItems",
      ]);
      const incomeTaxExpense = reportedAmount("incomeTaxExpense", [
        "IncomeTaxExpenseBenefit",
      ]);
      const netIncome = reportedAmount("netIncome", [
        "NetIncomeLoss",
        "ProfitLoss",
      ]);
      const operatingCashFlow = reportedAmount("operatingCashFlow", [
        "NetCashProvidedByUsedInOperatingActivities",
      ]);
      const capex = reportedAmount("capex", [
        "PaymentsToAcquirePropertyPlantAndEquipment",
      ]);
      const cash = reportedAmount(
        "cash",
        [
          "CashAndCashEquivalentsAtCarryingValue",
          "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
        ],
        false,
      );
      const shortTermDebt = reportedAmount(
        "shortTermDebt",
        [
          "LongTermDebtCurrent",
          "ShortTermBorrowings",
          "ShortTermDebtCurrent",
        ],
        false,
      );
      const longTermDebt = reportedAmount(
        "longTermDebt",
        ["LongTermDebtNoncurrent", "LongTermDebt"],
        false,
      );
      const equity = reportedAmount(
        "equity",
        [
          "StockholdersEquity",
          "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
        ],
        false,
      );
      const dilutedShares = reportedShares(
        "dilutedShares",
        ["WeightedAverageNumberOfDilutedSharesOutstanding"],
        false,
      );
      reportedShares("sharesOutstanding", ["EntityCommonStockSharesOutstanding"], true);

      const directWorkingCapital = reportedAmount(
        "workingCapital",
        ["WorkingCapital", "OperatingWorkingCapital"],
        false,
      );
      const changeInWorkingCapital = reportedAmount(
        "changeInWorkingCapital",
        [
          "IncreaseDecreaseInWorkingCapital",
          "IncreaseDecreaseInOperatingWorkingCapital",
        ],
      );
      const balanceComponents = [
        ["accountsReceivable", ["AccountsReceivableNetCurrent"]],
        ["inventory", ["InventoryNet"]],
        ["accountsPayable", ["AccountsPayableCurrent"]],
        ["otherCurrentAssets", ["OtherCurrentAssets"]],
        ["otherCurrentLiabilities", ["OtherCurrentLiabilities"]],
      ] as const;
      for (const [id, tags] of balanceComponents) {
        reportedAmount(id, tags, false);
      }

      const totalDebt = (() => {
        if (
          shortTermDebt.status === "unavailable" ||
          longTermDebt.status === "unavailable"
        ) {
          const unit: FundamentalUnit = "USD_BILLION";
          return unavailableMetric(
            "debt",
            period.id,
            {
              ...metricProvenance("debt", unit, null),
              sourceId: baseSource.sourceId,
              sourceUrl: baseSource.sourceUrl,
              publicationDate: baseSource.publicationDate,
            },
            "Total debt cannot be calculated because the SEC filing does not report both current and non-current interest-bearing debt.",
          );
        }
        const inputs = [shortTermDebt, longTermDebt];
        const sourceUrls = [
          ...new Set(inputs.map((metric) => metric.provenance.sourceUrl)),
        ];
        return {
          id: "debt",
          periodId: period.id,
          value: shortTermDebt.value + longTermDebt.value,
          status: "calculated" as const,
          provenance: {
            ...shortTermDebt.provenance,
            sourceId: null,
            source: "EquityMind deterministic calculation from SEC observations",
            sourceType: "calculated" as const,
            sourceUrl: sourceUrls.length === 1 ? sourceUrls[0]! : companyFactsUrl,
            pageReference: "Calculated from cited SEC XBRL facts",
            sectionReference: "shortTermDebt + longTermDebt",
          },
          formula: "short-term interest-bearing debt + long-term interest-bearing debt",
          inputMetricIds: inputs.map(
            (metric) => `${metric.id}@${metric.periodId}`,
          ),
          inputs: inputs.map((metric) => ({
            id: metric.id,
            periodId: metric.periodId,
            value: metric.value,
            provenance: metric.provenance,
          })),
          calculatedAt: new Date(this.now()).toISOString(),
        };
      })();
      periodMetrics.push(totalDebt);
      if (revenue.status === "unavailable") {
        return null;
      }
      void ebit;
      void interestExpense;
      void profitBeforeTax;
      void incomeTaxExpense;
      void netIncome;
      void operatingCashFlow;
      void capex;
      void cash;
      void equity;
      void dilutedShares;
      metricsByPeriod.set(period.id, periodMetrics);
    }

    const actualPeriods = periods.filter((period) =>
      metricsByPeriod.has(period.id),
    );
    if (!actualPeriods.length) {
      return null;
    }
    const selectedCurrency =
      amountUnit("USD") === null ? "UNAVAILABLE" : "USD";
    const company = this.companyFrom(
      tickerRecord,
      submissions,
      selectedCurrency,
    );
    const financials = actualPeriods.flatMap(
      (period) => metricsByPeriod.get(period.id) ?? [],
    );
    const incomeStatementIds = new Set([
      "revenue",
      "ebit",
      "depreciation",
      "depreciationExpense",
      "amortizationExpense",
      "interestExpense",
      "profitBeforeTax",
      "incomeTaxExpense",
      "netIncome",
    ]);
    const balanceSheetIds = new Set([
      "cash",
      "shortTermDebt",
      "longTermDebt",
      "debt",
      "equity",
      "dilutedShares",
      "sharesOutstanding",
      "workingCapital",
      "accountsReceivable",
      "inventory",
      "accountsPayable",
      "otherCurrentAssets",
      "otherCurrentLiabilities",
    ]);
    const incomeStatement = financials.filter((metric) =>
      incomeStatementIds.has(metric.id),
    );
    const balanceSheet = financials.filter((metric) =>
      balanceSheetIds.has(metric.id),
    );
    const cashFlowMetrics = financials.filter((metric) =>
      ["operatingCashFlow", "capex", "changeInWorkingCapital"].includes(
        metric.id,
      ),
    );
    const warnings = [
      "SEC Company Facts contains standardized XBRL facts only; company-specific taxonomy extensions and footnote-only values are not included.",
      "SEC does not provide a current market price or market capitalization in Company Facts; these must come from an approved market-data provider or explicit analyst input.",
      ...(!financials.some(
        (metric) =>
          metric.id === "changeInWorkingCapital" &&
          metric.status !== "unavailable",
      )
        ? [
            "Complete change in net working capital is unavailable from standardized facts; it is not reconstructed from an incomplete subset of balance-sheet components.",
          ]
        : []),
    ];
    const history: FundamentalsHistory = {
      company: {
        ticker: normalizeTicker(tickerRecord.ticker),
        companyName,
        exchange: submissions.exchanges?.[0] ?? "UNAVAILABLE",
        companyType: isFinancial ? "FINANCIAL_INSTITUTION" : "GENERAL_COMPANY",
        reportingBasis,
        currency: selectedCurrency,
      },
      sourceMode: "SEC_COMPANYFACTS",
      periods: actualPeriods,
      financials,
      statements: {
        incomeStatement,
        balanceSheet,
        cashFlowStatement: {
          status: cashFlowMetrics.some(
            (metric) => metric.status !== "unavailable",
          )
            ? "partial"
            : "unavailable",
          metrics: cashFlowMetrics,
          reason:
            "Only standardized SEC XBRL cash-flow facts are returned; missing observations remain unavailable.",
        },
        bankOperatingMetrics: [],
      },
      bankMetrics: [],
      growthMetrics: [],
      provenance: [...sourcesById.values()],
      warnings,
    };
    validateFundamentalsHistory(history);
    return history;
  }
}
