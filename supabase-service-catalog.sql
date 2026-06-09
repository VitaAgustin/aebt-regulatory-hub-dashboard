-- AEBT Regulatory Knowledge Hub - dynamic service catalog.
-- Run this file from Supabase Dashboard > SQL Editor.

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
  category_id uuid not null references public.service_categories(id) on delete cascade,
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
grant insert, update, delete on public.service_categories to authenticated;
grant insert, update, delete on public.service_items to authenticated;

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

drop policy if exists "Authenticated users can delete service categories"
  on public.service_categories;
create policy "Authenticated users can delete service categories"
on public.service_categories
for delete
to authenticated
using ((select auth.uid()) is not null);

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

drop policy if exists "Authenticated users can delete service items"
  on public.service_items;
create policy "Authenticated users can delete service items"
on public.service_items
for delete
to authenticated
using ((select auth.uid()) is not null);

with seed_categories(name, description) as (
  values
    ('Asset Integrity Management (AIM)', 'Layanan pengelolaan integritas aset dan risiko.'),
    ('Drilling Support Services', 'Layanan pendukung kegiatan pengeboran.'),
    ('QA/QC, Inspection and Certification', 'Layanan QA/QC, inspeksi, dan sertifikasi.'),
    ('Professional Services', 'Layanan tenaga profesional teknis.'),
    ('Non Destructive Test (NDT)', 'Layanan pengujian tanpa merusak.'),
    ('Advanced NDT', 'Layanan pengujian tanpa merusak tingkat lanjut.'),
    ('Consultancy', 'Layanan konsultansi teknis dan manajemen.'),
    ('Renewable Energy Services', 'Layanan energi baru dan terbarukan.')
)
insert into public.service_categories (name, description, is_active)
select seed.name, seed.description, true
from seed_categories seed
where not exists (
  select 1
  from public.service_categories category
  where lower(trim(category.name)) = lower(trim(seed.name))
);

with seed_items(category_name, item_name) as (
  values
    ('Asset Integrity Management (AIM)', 'Risk Based Inspection'),
    ('Asset Integrity Management (AIM)', 'Risk Management Services'),
    ('Asset Integrity Management (AIM)', 'Risk Survey'),
    ('Asset Integrity Management (AIM)', 'Risk Valuation'),
    ('Asset Integrity Management (AIM)', 'Technical Due Diligence'),
    ('Asset Integrity Management (AIM)', 'Third Party Liability (TPL)'),
    ('Asset Integrity Management (AIM)', 'Risk Assessment'),
    ('Asset Integrity Management (AIM)', 'Asset Hierarchy'),
    ('Asset Integrity Management (AIM)', 'Pipeline Integrity Services'),
    ('Asset Integrity Management (AIM)', 'Tank Integrity Services'),
    ('Asset Integrity Management (AIM)', 'Robotic Inspection Services'),
    ('Drilling Support Services', 'Oil Country Tubular Goods (OCTG)'),
    ('Drilling Support Services', 'Rig Assessment'),
    ('QA/QC, Inspection and Certification', 'Safety Device'),
    ('QA/QC, Inspection and Certification', 'Pressure Vessel'),
    ('QA/QC, Inspection and Certification', 'Storage Tank'),
    ('QA/QC, Inspection and Certification', 'Rotating Equipment'),
    ('QA/QC, Inspection and Certification', 'Electrical Equipment'),
    ('QA/QC, Inspection and Certification', 'Lifting Equipment'),
    ('QA/QC, Inspection and Certification', 'Metering System Pipeline'),
    ('QA/QC, Inspection and Certification', 'Installation of Geothermal Fluid Field'),
    ('QA/QC, Inspection and Certification', 'Installation of Migas Facility'),
    ('QA/QC, Inspection and Certification', 'Installation of Rig Drilling & Cementing Unit'),
    ('Professional Services', 'Technical Manpower Supply'),
    ('Non Destructive Test (NDT)', 'Magnetic Particle Test'),
    ('Non Destructive Test (NDT)', 'Ultrasonic Test'),
    ('Non Destructive Test (NDT)', 'Penetrant Test'),
    ('Non Destructive Test (NDT)', 'Radiographic Examination'),
    ('Advanced NDT', 'Phased Array Ultrasonic Testing (PAUT)'),
    ('Advanced NDT', 'Long Range Ultrasonic Testing (LRUT)'),
    ('Advanced NDT', 'Real Time Radiography (RTR)'),
    ('Advanced NDT', 'Pulse Eddy Current (PEC)'),
    ('Advanced NDT', 'Magnetic Flux Leakage (MFL)'),
    ('Advanced NDT', 'Computerize RT (CR)'),
    ('Advanced NDT', 'IRIS, RFT and ECT'),
    ('Advanced NDT', 'Intelligent Pigging'),
    ('Advanced NDT', 'Automatic Ultrasonic Testing (AUT)'),
    ('Consultancy', 'Quality Management Services (QMS)'),
    ('Consultancy', 'Quantity Survey'),
    ('Consultancy', 'Project Management Consultancy (PMC)'),
    ('Consultancy', 'Permit Handling Management'),
    ('Renewable Energy Services', 'Geothermal Plant Services'),
    ('Renewable Energy Services', 'Nuclear Power Plant Services'),
    ('Renewable Energy Services', 'Hydrogen Infrastructure'),
    ('Renewable Energy Services', 'Gas Testing for Coal Methane')
)
insert into public.service_items (category_id, name, is_active)
select category.id, seed.item_name, true
from seed_items seed
join public.service_categories category
  on lower(trim(category.name)) = lower(trim(seed.category_name))
where not exists (
  select 1
  from public.service_items item
  where item.category_id = category.id
    and lower(trim(item.name)) = lower(trim(seed.item_name))
);

-- Ask PostgREST to refresh its schema cache immediately.
notify pgrst, 'reload schema';

