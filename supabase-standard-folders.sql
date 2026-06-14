-- Dynamic folders for documents with document_type = 'standar'.
-- Run in Supabase Dashboard > SQL Editor.

create table if not exists public.standard_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists standard_folders_name_lower_key
  on public.standard_folders (lower(name));

alter table public.documents
  add column if not exists standard_folder_id uuid
  references public.standard_folders(id) on delete set null;

create index if not exists idx_documents_standard_folder
  on public.documents(standard_folder_id);

insert into public.standard_folders (name, description)
values
  ('API', 'American Petroleum Institute standards and references.'),
  ('ASME', 'ASME codes and engineering standards.'),
  ('ASTM', 'ASTM standards and technical test methods.'),
  ('ISO', 'International Organization for Standardization documents.'),
  ('SNI', 'Standar Nasional Indonesia.'),
  ('IEC', 'International Electrotechnical Commission standards.'),
  ('NFPA', 'National Fire Protection Association standards.'),
  ('Lainnya', 'Standar dan referensi teknis lainnya.')
on conflict do nothing;

alter table public.standard_folders enable row level security;

drop policy if exists "Public can read active standard folders"
  on public.standard_folders;
create policy "Public can read active standard folders"
on public.standard_folders
for select
to anon
using (is_active = true);

drop policy if exists "Authenticated users can read standard folders"
  on public.standard_folders;
create policy "Authenticated users can read standard folders"
on public.standard_folders
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert standard folders"
  on public.standard_folders;
create policy "Authenticated users can insert standard folders"
on public.standard_folders
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update standard folders"
  on public.standard_folders;
create policy "Authenticated users can update standard folders"
on public.standard_folders
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete standard folders"
  on public.standard_folders;
create policy "Authenticated users can delete standard folders"
on public.standard_folders
for delete
to authenticated
using (true);

