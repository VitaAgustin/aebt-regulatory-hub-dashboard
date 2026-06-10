-- AEBT Regulatory Knowledge Hub - SBU portfolio catalog.
-- Run this file once in Supabase Dashboard > SQL Editor.

create extension if not exists "pgcrypto";

alter table public.documents
  add column if not exists related_portfolios text;

create table if not exists public.portfolio_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null
    references public.portfolio_categories(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_portfolio_categories_code_lower
  on public.portfolio_categories (lower(trim(code)));

create unique index if not exists uq_portfolio_items_category_code_lower
  on public.portfolio_items (category_id, lower(trim(code)));

create index if not exists idx_portfolio_categories_active_code
  on public.portfolio_categories (is_active, code);

create index if not exists idx_portfolio_items_category_active_code
  on public.portfolio_items (category_id, is_active, code);

create or replace function public.set_portfolio_catalog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_portfolio_categories_updated_at
  on public.portfolio_categories;
create trigger set_portfolio_categories_updated_at
before update on public.portfolio_categories
for each row execute function public.set_portfolio_catalog_updated_at();

drop trigger if exists set_portfolio_items_updated_at
  on public.portfolio_items;
create trigger set_portfolio_items_updated_at
before update on public.portfolio_items
for each row execute function public.set_portfolio_catalog_updated_at();

alter table public.portfolio_categories enable row level security;
alter table public.portfolio_items enable row level security;

grant select on public.portfolio_categories to anon, authenticated;
grant select on public.portfolio_items to anon, authenticated;
grant insert, update, delete on public.portfolio_categories to authenticated;
grant insert, update, delete on public.portfolio_items to authenticated;

drop policy if exists "Public can read active portfolio categories"
  on public.portfolio_categories;
create policy "Public can read active portfolio categories"
on public.portfolio_categories
for select
to anon
using (is_active = true);

drop policy if exists "Authenticated users can read portfolio categories"
  on public.portfolio_categories;
create policy "Authenticated users can read portfolio categories"
on public.portfolio_categories
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can insert portfolio categories"
  on public.portfolio_categories;
create policy "Authenticated users can insert portfolio categories"
on public.portfolio_categories
for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can update portfolio categories"
  on public.portfolio_categories;
create policy "Authenticated users can update portfolio categories"
on public.portfolio_categories
for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can delete portfolio categories"
  on public.portfolio_categories;
create policy "Authenticated users can delete portfolio categories"
on public.portfolio_categories
for delete
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Public can read active portfolio items"
  on public.portfolio_items;
create policy "Public can read active portfolio items"
on public.portfolio_items
for select
to anon
using (
  is_active = true
  and exists (
    select 1
    from public.portfolio_categories category
    where category.id = portfolio_items.category_id
      and category.is_active = true
  )
);

drop policy if exists "Authenticated users can read portfolio items"
  on public.portfolio_items;
create policy "Authenticated users can read portfolio items"
on public.portfolio_items
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can insert portfolio items"
  on public.portfolio_items;
create policy "Authenticated users can insert portfolio items"
on public.portfolio_items
for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can update portfolio items"
  on public.portfolio_items;
create policy "Authenticated users can update portfolio items"
on public.portfolio_items
for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can delete portfolio items"
  on public.portfolio_items;
create policy "Authenticated users can delete portfolio items"
on public.portfolio_items
for delete
to authenticated
using ((select auth.uid()) is not null);

with seed_categories(code, name, description) as (
  values
    (
      'EBT 041',
      'Energi Baru dan Terbarukan',
      'Portofolio layanan energi baru dan terbarukan SBU AEBT.'
    ),
    (
      'IAPPM 042',
      'Industri, Aset, Peralatan, Permesinan, dan Migas',
      'Portofolio layanan industri, aset, peralatan, permesinan, dan migas SBU AEBT.'
    )
)
insert into public.portfolio_categories (code, name, description, is_active)
select seed.code, seed.name, seed.description, true
from seed_categories seed
where not exists (
  select 1
  from public.portfolio_categories category
  where lower(trim(category.code)) = lower(trim(seed.code))
);

with seed_items(category_code, item_code, item_name) as (
  values
    ('EBT 041', 'AEB - 1A', 'Sampling dan Analisa di Bidang EBT'),
    ('EBT 041', 'AEB - 1B', 'Verifikasi dan Inspeksi Peralatan dan Instalasi di Bidang EBT'),
    ('EBT 041', 'AEB - 1C', 'Konsultasi di Bidang EBT'),
    ('IAPPM 042', 'AEB - 2A', 'Inspeksi Peralatan dan Instalasi Industri Minyak dan Gas Bumi'),
    ('IAPPM 042', 'AEB - 2B', 'Konsultasi Kehandalan dan Keamanan Peralatan Migas'),
    ('IAPPM 042', 'AEB - 2C', 'QA/QC untuk Fasilitas Industri, Pertambangan, dan Pembangkit Listrik'),
    ('IAPPM 042', 'AEB - 2D', 'Verifikasi dan Pemeriksaan Mesin Saat Beroperasi'),
    ('IAPPM 042', 'AEB - 2E', 'Verifikasi dan Inspeksi Peralatan Industri Migas'),
    ('IAPPM 042', 'AEB - 2F', 'Non-Destructive Test')
)
insert into public.portfolio_items (category_id, code, name, is_active)
select category.id, seed.item_code, seed.item_name, true
from seed_items seed
join public.portfolio_categories category
  on lower(trim(category.code)) = lower(trim(seed.category_code))
where not exists (
  select 1
  from public.portfolio_items item
  where item.category_id = category.id
    and lower(trim(item.code)) = lower(trim(seed.item_code))
);

notify pgrst, 'reload schema';
