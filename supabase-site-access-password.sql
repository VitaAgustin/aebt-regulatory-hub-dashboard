-- AEBT Regulatory Knowledge Hub - viewer access password.
-- Run this file from Supabase Dashboard > SQL Editor.
-- The password hash is never granted for direct frontend reads.
-- This migration intentionally does not contain or seed a plain-text password.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.site_access_settings (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'default',
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_access_settings enable row level security;

-- The frontend may execute the verifier, but cannot read the hash table.
revoke all on table public.site_access_settings from anon, authenticated;

create or replace function public.verify_site_password(input_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_password_hash text;
begin
  if nullif(btrim(input_password), '') is null then
    return false;
  end if;

  select settings.password_hash
  into active_password_hash
  from public.site_access_settings as settings
  where settings.is_active = true
  order by settings.updated_at desc, settings.created_at desc
  limit 1;

  if active_password_hash is null then
    return false;
  end if;

  return extensions.crypt(input_password, active_password_hash) =
    active_password_hash;
end;
$$;

revoke all on function public.verify_site_password(text) from public;
grant execute on function public.verify_site_password(text) to anon, authenticated;

create or replace function public.set_site_password(
  input_password text,
  input_label text default 'default'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_setting_id uuid;
begin
  if length(btrim(coalesce(input_password, ''))) < 12 then
    raise exception 'Password akses minimal 12 karakter.';
  end if;

  update public.site_access_settings
  set is_active = false,
      updated_at = now()
  where is_active = true;

  insert into public.site_access_settings (
    label,
    password_hash,
    is_active
  )
  values (
    coalesce(nullif(btrim(input_label), ''), 'default'),
    extensions.crypt(input_password, extensions.gen_salt('bf')),
    true
  )
  returning id into new_setting_id;

  return new_setting_id;
end;
$$;

-- Only SQL Editor/database administrators may set the password.
revoke all on function public.set_site_password(text, text)
from public, anon, authenticated;
grant execute on function public.set_site_password(text, text) to postgres;

-- After running this migration, set a unique password from a separate SQL
-- Editor query. Replace the placeholder locally; never commit the real value:
--
-- select public.set_site_password('<PASSWORD_UNIK_MINIMAL_12_KARAKTER>');
