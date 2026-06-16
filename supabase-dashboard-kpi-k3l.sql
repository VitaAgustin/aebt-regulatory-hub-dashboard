-- Dashboard KPI & K3L monthly data.
-- Run in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.dashboard_monthly_data (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  kpi_overall_score numeric check (kpi_overall_score is null or (kpi_overall_score >= 0 and kpi_overall_score <= 100)),
  ebitda_portfolio numeric check (ebitda_portfolio is null or ebitda_portfolio >= 0),
  portfolio_revenue numeric check (portfolio_revenue is null or portfolio_revenue >= 0),
  customer_retention numeric check (customer_retention is null or (customer_retention >= 0 and customer_retention <= 100)),
  revenue_target numeric check (revenue_target is null or revenue_target >= 0),
  revenue_actual numeric check (revenue_actual is null or revenue_actual >= 0),
  economic_social_score numeric check (economic_social_score is null or (economic_social_score >= 0 and economic_social_score <= 100)),
  business_innovation_score numeric check (business_innovation_score is null or (business_innovation_score >= 0 and business_innovation_score <= 100)),
  technology_leadership_score numeric check (technology_leadership_score is null or (technology_leadership_score >= 0 and technology_leadership_score <= 100)),
  investment_score numeric check (investment_score is null or (investment_score >= 0 and investment_score <= 100)),
  talent_development_score numeric check (talent_development_score is null or (talent_development_score >= 0 and talent_development_score <= 100)),
  k3l_score numeric check (k3l_score is null or (k3l_score >= 0 and k3l_score <= 100)),
  permanent_employees integer check (permanent_employees is null or permanent_employees >= 0),
  temporary_employees integer check (temporary_employees is null or temporary_employees >= 0),
  project_employees integer check (project_employees is null or project_employees >= 0),
  third_party_employees integer check (third_party_employees is null or third_party_employees >= 0),
  permanent_work_hours numeric check (permanent_work_hours is null or permanent_work_hours >= 0),
  temporary_work_hours numeric check (temporary_work_hours is null or temporary_work_hours >= 0),
  project_work_hours numeric check (project_work_hours is null or project_work_hours >= 0),
  third_party_work_hours numeric check (third_party_work_hours is null or third_party_work_hours >= 0),
  overtime_hours numeric check (overtime_hours is null or overtime_hours >= 0),
  total_work_hours numeric check (total_work_hours is null or total_work_hours >= 0),
  lost_work_hours numeric check (lost_work_hours is null or lost_work_hours >= 0),
  fatality integer check (fatality is null or fatality >= 0),
  medical_treatment integer check (medical_treatment is null or medical_treatment >= 0),
  first_aid integer check (first_aid is null or first_aid >= 0),
  environmental_incident integer check (environmental_incident is null or environmental_incident >= 0),
  near_miss integer check (near_miss is null or near_miss >= 0),
  unsafe_condition integer check (unsafe_condition is null or unsafe_condition >= 0),
  unsafe_action integer check (unsafe_action is null or unsafe_action >= 0),
  frequency_rate numeric check (frequency_rate is null or frequency_rate >= 0),
  severity_rate numeric check (severity_rate is null or severity_rate >= 0),
  notes text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_monthly_data_year_month_unique unique (year, month)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dashboard_monthly_data_year_month_unique'
      and conrelid = 'public.dashboard_monthly_data'::regclass
  ) then
    alter table public.dashboard_monthly_data
      add constraint dashboard_monthly_data_year_month_unique unique (year, month);
  end if;
end $$;

create index if not exists idx_dashboard_monthly_data_period
  on public.dashboard_monthly_data(year desc, month desc);

alter table public.dashboard_monthly_data enable row level security;

drop policy if exists "Public can read dashboard monthly data"
  on public.dashboard_monthly_data;
create policy "Public can read dashboard monthly data"
on public.dashboard_monthly_data
for select
to anon
using (true);

drop policy if exists "Authenticated users can read dashboard monthly data"
  on public.dashboard_monthly_data;
create policy "Authenticated users can read dashboard monthly data"
on public.dashboard_monthly_data
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert dashboard monthly data"
  on public.dashboard_monthly_data;
create policy "Authenticated users can insert dashboard monthly data"
on public.dashboard_monthly_data
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update dashboard monthly data"
  on public.dashboard_monthly_data;
create policy "Authenticated users can update dashboard monthly data"
on public.dashboard_monthly_data
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete dashboard monthly data"
  on public.dashboard_monthly_data;
create policy "Authenticated users can delete dashboard monthly data"
on public.dashboard_monthly_data
for delete
to authenticated
using (true);

insert into public.dashboard_monthly_data (
  year,
  month,
  total_work_hours
)
values
  (2025, 1, 7448),
  (2025, 2, 7840),
  (2025, 3, 7600),
  (2025, 4, 6656),
  (2025, 5, 7208),
  (2025, 6, 7208),
  (2025, 7, 9752),
  (2025, 8, 8904),
  (2025, 9, 9504),
  (2025, 10, 9504),
  (2025, 11, 9152)
on conflict (year, month) do nothing;

insert into public.dashboard_monthly_data (
  year,
  month,
  kpi_overall_score,
  ebitda_portfolio,
  portfolio_revenue,
  customer_retention,
  revenue_target,
  revenue_actual,
  economic_social_score,
  business_innovation_score,
  technology_leadership_score,
  investment_score,
  talent_development_score,
  k3l_score,
  permanent_employees,
  temporary_employees,
  project_employees,
  third_party_employees,
  total_work_hours,
  lost_work_hours,
  fatality,
  medical_treatment,
  first_aid,
  environmental_incident,
  near_miss,
  unsafe_condition,
  unsafe_action,
  frequency_rate,
  severity_rate,
  notes
)
values (
  2025,
  12,
  78.5,
  97.2,
  529,
  89,
  550,
  529,
  82,
  70,
  68,
  74,
  61,
  100,
  33,
  7,
  5,
  6,
  8976,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  'Seed awal dari Formulir Laporan Data K3L 2025.'
)
on conflict (year, month) do nothing;
