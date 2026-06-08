-- AEBT Regulatory Knowledge Hub - dynamic service catalog migration.
-- Run this file from Supabase Dashboard > SQL Editor.
-- Safe to run more than once. Existing categories/items are preserved.

create extension if not exists "pgcrypto";

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null
    references public.service_categories(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_service_categories_name_lower
  on public.service_categories (lower(trim(name)));

create unique index if not exists uq_service_items_category_name_lower
  on public.service_items (category_id, lower(trim(name)));

create index if not exists idx_service_categories_active_name
  on public.service_categories (is_active, name);

create index if not exists idx_service_items_category_active_name
  on public.service_items (category_id, is_active, name);

create or replace function public.set_service_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_service_categories_updated_at
  on public.service_categories;
create trigger set_service_categories_updated_at
before update on public.service_categories
for each row execute function public.set_service_catalog_updated_at();

drop trigger if exists set_service_items_updated_at
  on public.service_items;
create trigger set_service_items_updated_at
before update on public.service_items
for each row execute function public.set_service_catalog_updated_at();

alter table public.service_categories enable row level security;
alter table public.service_items enable row level security;

grant select on public.service_categories to anon, authenticated;
grant select on public.service_items to anon, authenticated;
grant insert, update on public.service_categories to authenticated;
grant insert, update on public.service_items to authenticated;

drop policy if exists "Public can read active service categories"
  on public.service_categories;
create policy "Public can read active service categories"
on public.service_categories
for select
to anon
using (is_active = true);

drop policy if exists "Authenticated users can read service categories"
  on public.service_categories;
create policy "Authenticated users can read service categories"
on public.service_categories
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can insert service categories"
  on public.service_categories;
create policy "Authenticated users can insert service categories"
on public.service_categories
for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can update service categories"
  on public.service_categories;
create policy "Authenticated users can update service categories"
on public.service_categories
for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Public can read active service items"
  on public.service_items;
create policy "Public can read active service items"
on public.service_items
for select
to anon
using (
  is_active = true
  and exists (
    select 1
    from public.service_categories category
    where category.id = service_items.category_id
      and category.is_active = true
  )
);

drop policy if exists "Authenticated users can read service items"
  on public.service_items;
create policy "Authenticated users can read service items"
on public.service_items
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can insert service items"
  on public.service_items;
create policy "Authenticated users can insert service items"
on public.service_items
for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can update service items"
  on public.service_items;
create policy "Authenticated users can update service items"
on public.service_items
for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

do $$
declare
  category_id_value uuid;
begin
  insert into public.service_categories (name)
  values ('Asset Integrity Management (AIM)')
  on conflict do nothing;
  select id into category_id_value
  from public.service_categories
  where lower(trim(name)) = lower('Asset Integrity Management (AIM)');
  insert into public.service_items (category_id, name)
  values
    (category_id_value, 'Risk Based Inspection'),
    (category_id_value, 'Risk Management Services'),
    (category_id_value, 'Risk Survey'),
    (category_id_value, 'Risk Valuation'),
    (category_id_value, 'Technical Due Diligence'),
    (category_id_value, 'Third Party Liability (TPL)'),
    (category_id_value, 'Risk Assessment'),
    (category_id_value, 'Asset Hierarchy'),
    (category_id_value, 'Pipeline Integrity Services'),
    (category_id_value, 'Tank Integrity Services'),
    (category_id_value, 'Robotic Inspection Services')
  on conflict do nothing;

  insert into public.service_categories (name)
  values ('Drilling Support Services')
  on conflict do nothing;
  select id into category_id_value
  from public.service_categories
  where lower(trim(name)) = lower('Drilling Support Services');
  insert into public.service_items (category_id, name)
  values
    (category_id_value, 'Oil Country Tubular Goods (OCTG)'),
    (category_id_value, 'Rig Assessment')
  on conflict do nothing;

  insert into public.service_categories (name)
  values ('QA/QC, Inspection and Certification')
  on conflict do nothing;
  select id into category_id_value
  from public.service_categories
  where lower(trim(name)) = lower('QA/QC, Inspection and Certification');
  insert into public.service_items (category_id, name)
  values
    (category_id_value, 'Safety Device'),
    (category_id_value, 'Pressure Vessel'),
    (category_id_value, 'Storage Tank'),
    (category_id_value, 'Rotating Equipment'),
    (category_id_value, 'Electrical Equipment'),
    (category_id_value, 'Lifting Equipment'),
    (category_id_value, 'Metering System Pipeline'),
    (category_id_value, 'Installation of Geothermal Fluid Field'),
    (category_id_value, 'Installation of Migas Facility'),
    (category_id_value, 'Installation of Rig Drilling & Cementing Unit')
  on conflict do nothing;

  insert into public.service_categories (name)
  values ('Professional Services')
  on conflict do nothing;
  select id into category_id_value
  from public.service_categories
  where lower(trim(name)) = lower('Professional Services');
  insert into public.service_items (category_id, name)
  values (category_id_value, 'Technical Manpower Supply')
  on conflict do nothing;

  insert into public.service_categories (name)
  values ('Non Destructive Test (NDT)')
  on conflict do nothing;
  select id into category_id_value
  from public.service_categories
  where lower(trim(name)) = lower('Non Destructive Test (NDT)');
  insert into public.service_items (category_id, name)
  values
    (category_id_value, 'Magnetic Particle Test'),
    (category_id_value, 'Ultrasonic Test'),
    (category_id_value, 'Penetrant Test'),
    (category_id_value, 'Radiographic Examination')
  on conflict do nothing;

  insert into public.service_categories (name)
  values ('Advanced NDT')
  on conflict do nothing;
  select id into category_id_value
  from public.service_categories
  where lower(trim(name)) = lower('Advanced NDT');
  insert into public.service_items (category_id, name)
  values
    (category_id_value, 'Phased Array Ultrasonic Testing (PAUT)'),
    (category_id_value, 'Long Range Ultrasonic Testing (LRUT)'),
    (category_id_value, 'Real Time Radiography (RTR)'),
    (category_id_value, 'Pulse Eddy Current (PEC)'),
    (category_id_value, 'Magnetic Flux Leakage (MFL)'),
    (category_id_value, 'Computerize RT (CR)'),
    (category_id_value, 'IRIS, RFT and ECT'),
    (category_id_value, 'Intelligent Pigging'),
    (category_id_value, 'Automatic Ultrasonic Testing (AUT)')
  on conflict do nothing;

  insert into public.service_categories (name)
  values ('Consultancy')
  on conflict do nothing;
  select id into category_id_value
  from public.service_categories
  where lower(trim(name)) = lower('Consultancy');
  insert into public.service_items (category_id, name)
  values
    (category_id_value, 'Quality Management Services (QMS)'),
    (category_id_value, 'Quantity Survey'),
    (category_id_value, 'Project Management Consultancy (PMC)'),
    (category_id_value, 'Permit Handling Management')
  on conflict do nothing;

  insert into public.service_categories (name)
  values ('Renewable Energy Services')
  on conflict do nothing;
  select id into category_id_value
  from public.service_categories
  where lower(trim(name)) = lower('Renewable Energy Services');
  insert into public.service_items (category_id, name)
  values
    (category_id_value, 'Geothermal Plant Services'),
    (category_id_value, 'Nuclear Power Plant Services'),
    (category_id_value, 'Hydrogen Infrastructure'),
    (category_id_value, 'Gas Testing for Coal Methane')
  on conflict do nothing;
end;
$$;

-- Security note:
-- Keep public sign-up disabled. In this internal static application, every
-- permanent authenticated user receives service-catalog write access.
