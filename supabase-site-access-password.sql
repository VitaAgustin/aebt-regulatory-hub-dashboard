-- AEBT Regulatory Knowledge Hub - viewer access password.
-- Run this file from Supabase Dashboard > SQL Editor.
-- The password hash is never granted for direct frontend reads.

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

insert into public.site_access_settings (label, password_hash, is_active)
select
  'default',
  extensions.crypt('aebt2026', extensions.gen_salt('bf')),
  true
where not exists (
  select 1
  from public.site_access_settings
  where is_active = true
);

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

-- Ganti password akses di masa depan dengan menjalankan contoh berikut.
-- Jangan gunakan password akun admin sebagai password akses portal.
--
-- update public.site_access_settings
-- set is_active = false,
--     updated_at = now()
-- where is_active = true;
--
-- insert into public.site_access_settings (label, password_hash, is_active)
-- values (
--   'default',
--   extensions.crypt('password-baru', extensions.gen_salt('bf')),
--   true
-- );
