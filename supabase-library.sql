-- Dynamic AEBT knowledge Library.
-- Run in Supabase Dashboard > SQL Editor before the access-request migration.

create table if not exists public.library_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists library_folders_name_lower_key
  on public.library_folders (lower(name));

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.library_folders(id) on delete set null,
  title text not null,
  description text,
  item_type text,
  file_source text not null default 'none'
    check (file_source in ('supabase', 'external', 'none')),
  file_path text,
  file_name text,
  external_file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  is_active boolean not null default true
);

create index if not exists idx_library_items_folder
  on public.library_items(folder_id);
create index if not exists idx_library_items_active
  on public.library_items(is_active);

insert into public.library_folders (name, description)
values
  ('HSE Talk', 'Materi singkat keselamatan dan kesehatan kerja.'),
  ('Poster', 'Poster komunikasi, awareness, dan keselamatan.'),
  ('Materi Training', 'Bahan presentasi dan materi pelatihan.'),
  ('Form', 'Formulir pendukung kegiatan operasional.'),
  ('Template', 'Template dokumen dan pekerjaan.'),
  ('Campaign', 'Materi kampanye internal dan eksternal.'),
  ('Toolbox Meeting', 'Materi toolbox meeting dan briefing lapangan.'),
  ('Lainnya', 'Materi pengetahuan lainnya.')
on conflict do nothing;

alter table public.library_folders enable row level security;
alter table public.library_items enable row level security;

drop policy if exists "Public can read active library folders"
  on public.library_folders;
create policy "Public can read active library folders"
on public.library_folders
for select
to anon
using (is_active = true);

drop policy if exists "Authenticated users can read library folders"
  on public.library_folders;
create policy "Authenticated users can read library folders"
on public.library_folders
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage library folders"
  on public.library_folders;
create policy "Authenticated users can manage library folders"
on public.library_folders
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read active library items"
  on public.library_items;
create policy "Public can read active library items"
on public.library_items
for select
to anon
using (is_active = true);

drop policy if exists "Authenticated users can read library items"
  on public.library_items;
create policy "Authenticated users can read library items"
on public.library_items
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can manage library items"
  on public.library_items;
create policy "Authenticated users can manage library items"
on public.library_items
for all
to authenticated
using (true)
with check (true);

