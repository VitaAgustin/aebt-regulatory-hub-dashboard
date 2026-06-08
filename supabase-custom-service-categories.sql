-- AEBT Regulatory Knowledge Hub - custom service categories.
-- Run this file from Supabase Dashboard > SQL Editor.
-- This keeps the built-in service catalog in app.js and adds admin-created
-- extra categories from Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.custom_service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  services text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_custom_service_categories_name_lower
  on public.custom_service_categories (lower(trim(name)));

create index if not exists idx_custom_service_categories_active_name
  on public.custom_service_categories (is_active, name);

create or replace function public.set_custom_service_categories_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_custom_service_categories_updated_at
  on public.custom_service_categories;
create trigger set_custom_service_categories_updated_at
before update on public.custom_service_categories
for each row execute function public.set_custom_service_categories_updated_at();

alter table public.custom_service_categories enable row level security;

grant select on public.custom_service_categories to anon, authenticated;
grant insert, update on public.custom_service_categories to authenticated;

drop policy if exists "Public can read active custom service categories"
  on public.custom_service_categories;
create policy "Public can read active custom service categories"
on public.custom_service_categories
for select
to anon
using (is_active = true);

drop policy if exists "Authenticated users can read custom service categories"
  on public.custom_service_categories;
create policy "Authenticated users can read custom service categories"
on public.custom_service_categories
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can insert custom service categories"
  on public.custom_service_categories;
create policy "Authenticated users can insert custom service categories"
on public.custom_service_categories
for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can update custom service categories"
  on public.custom_service_categories;
create policy "Authenticated users can update custom service categories"
on public.custom_service_categories
for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

-- Security note:
-- Keep public sign-up disabled. In this internal static application, every
-- permanent authenticated user can add and update custom service categories.
