create table public.companies (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  exchange text not null,
  name text not null,
  country_code text not null,
  currency text not null,
  sector text,
  industry text,
  market_cap numeric(24, 4),
  is_active boolean not null default true,
  source text not null,
  source_type text not null check (source_type in ('demo', 'official', 'licensed', 'public', 'unofficial', 'public_api', 'official_filing', 'company_ir', 'calculated', 'ai_generated')),
  source_url text,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_exchange_ticker_unique unique (exchange, ticker),
  constraint companies_ticker_not_blank check (length(trim(ticker)) > 0),
  constraint companies_name_not_blank check (length(trim(name)) > 0)
);

create index companies_ticker_idx on public.companies (ticker);
create index companies_name_lower_idx on public.companies (lower(name));
create index companies_country_exchange_idx on public.companies (country_code, exchange);

create table public.market_prices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  trade_date date not null,
  currency text not null,
  open numeric(20, 6),
  high numeric(20, 6),
  low numeric(20, 6),
  close numeric(20, 6) not null,
  adjusted_close numeric(20, 6),
  volume bigint,
  source text not null,
  source_type text not null check (source_type in ('demo', 'official', 'licensed', 'public', 'unofficial', 'public_api', 'official_filing', 'company_ir', 'calculated', 'ai_generated')),
  source_url text,
  retrieved_at timestamptz not null,
  constraint market_prices_company_date_source_unique unique (company_id, trade_date, source),
  constraint market_prices_nonnegative_close check (close >= 0),
  constraint market_prices_nonnegative_volume check (volume is null or volume >= 0)
);

create index market_prices_company_date_idx on public.market_prices (company_id, trade_date desc);

create table public.financial_statements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  statement_type text not null check (statement_type in ('income_statement', 'balance_sheet', 'cash_flow')),
  period_type text not null check (period_type in ('annual', 'quarterly', 'ttm')),
  period_start date,
  period_end date not null,
  currency text not null,
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  source text not null,
  source_type text not null check (source_type in ('demo', 'official', 'licensed', 'public', 'unofficial', 'public_api', 'official_filing', 'company_ir', 'calculated', 'ai_generated')),
  source_url text,
  retrieved_at timestamptz not null,
  constraint financial_statements_period_valid check (period_start is null or period_start <= period_end),
  constraint financial_statements_company_statement_period_source_unique
    unique (company_id, statement_type, period_type, period_end, source)
);

create index financial_statements_company_period_idx
  on public.financial_statements (company_id, statement_type, period_end desc);

create table public.ratios (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  period_type text not null check (period_type in ('annual', 'quarterly', 'ttm')),
  period_end date not null,
  currency text not null,
  pe numeric(20, 8),
  pb numeric(20, 8),
  ev_ebitda numeric(20, 8),
  roe numeric(20, 8),
  roce numeric(20, 8),
  debt_to_equity numeric(20, 8),
  current_ratio numeric(20, 8),
  gross_margin numeric(20, 8),
  operating_margin numeric(20, 8),
  net_margin numeric(20, 8),
  fcf_yield numeric(20, 8),
  source text not null,
  source_type text not null check (source_type in ('demo', 'official', 'licensed', 'public', 'unofficial', 'public_api', 'official_filing', 'company_ir', 'calculated', 'ai_generated')),
  source_url text,
  retrieved_at timestamptz not null,
  constraint ratios_company_period_source_unique unique (company_id, period_type, period_end, source)
);

create index ratios_company_period_idx on public.ratios (company_id, period_end desc);

create table public.dcf_models (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  model_name text not null,
  currency text not null,
  valuation_date date not null,
  forecast_years smallint not null check (forecast_years between 1 and 20),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'object'),
  results jsonb not null check (jsonb_typeof(results) = 'object'),
  source text not null,
  source_type text not null check (source_type in ('demo', 'official', 'licensed', 'public', 'unofficial', 'public_api', 'official_filing', 'company_ir', 'calculated', 'ai_generated')),
  source_url text,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint dcf_models_name_not_blank check (length(trim(model_name)) > 0)
);

create index dcf_models_company_valuation_idx
  on public.dcf_models (company_id, valuation_date desc, created_at desc);

create table public.dcf_scenarios (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.dcf_models (id) on delete cascade,
  scenario_name text not null check (scenario_name in ('bear', 'base', 'bull')),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'object'),
  results jsonb not null check (jsonb_typeof(results) = 'object'),
  source text not null,
  source_type text not null check (source_type in ('demo', 'official', 'licensed', 'public', 'unofficial', 'public_api', 'official_filing', 'company_ir', 'calculated', 'ai_generated')),
  source_url text,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint dcf_scenarios_model_name_unique unique (model_id, scenario_name)
);

create index dcf_scenarios_model_idx on public.dcf_scenarios (model_id);

create table public.ai_analysis (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  analysis_type text not null,
  model_name text not null,
  summary text not null,
  key_findings jsonb not null default '[]'::jsonb check (jsonb_typeof(key_findings) = 'array'),
  risks jsonb not null default '[]'::jsonb check (jsonb_typeof(risks) = 'array'),
  catalysts jsonb not null default '[]'::jsonb check (jsonb_typeof(catalysts) = 'array'),
  prompt_hash text,
  source text not null,
  source_type text not null default 'ai_generated' check (source_type in ('demo', 'official', 'licensed', 'public', 'unofficial', 'public_api', 'official_filing', 'company_ir', 'calculated', 'ai_generated')),
  source_url text,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint ai_analysis_type_not_blank check (length(trim(analysis_type)) > 0),
  constraint ai_analysis_model_not_blank check (length(trim(model_name)) > 0)
);

create index ai_analysis_company_created_idx on public.ai_analysis (company_id, created_at desc);
create index ai_analysis_expiration_idx on public.ai_analysis (expires_at);

alter table public.companies enable row level security;
alter table public.market_prices enable row level security;
alter table public.financial_statements enable row level security;
alter table public.ratios enable row level security;
alter table public.dcf_models enable row level security;
alter table public.dcf_scenarios enable row level security;
alter table public.ai_analysis enable row level security;
