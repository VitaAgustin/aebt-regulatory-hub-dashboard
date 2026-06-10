-- AEBT Regulatory Knowledge Hub - schema for the static HTML/JS application.
-- Run this file from Supabase Dashboard > SQL Editor.
-- The frontend must use only the project publishable/anon key.

create extension if not exists "pgcrypto";

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('regulasi', 'sop', 'standar')),
  title text not null,
  regulation_number text,
  year integer,
  issuing_body text,
  category text,
  sub_category text,
  summary text,
  key_obligation text,
  impacted_party text,
  status text default 'Berlaku'
    check (status in ('Berlaku', 'Dicabut', 'Diubah', 'Perlu Review')),
  related_services text,
  related_portfolios text,
  sbu_relevance text
    check (sbu_relevance in ('Sangat Tinggi', 'Tinggi', 'Sedang', 'Rendah')),
  service_opportunity text,
  compliance_risk text,
  action_point text,
  priority_score integer check (priority_score between 1 and 25),
  source_url text,
  file_path text,
  file_name text,
  external_file_url text,
  file_source text not null default 'none'
    check (file_source in ('supabase', 'external', 'none')),
  last_checked_at date,
  pic_update text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.update_logs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete set null,
  action_type text not null,
  change_note text,
  source_url text,
  pic text,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_type
  on public.documents(document_type);
create index if not exists idx_documents_category
  on public.documents(category);
create index if not exists idx_documents_status
  on public.documents(status);
create index if not exists idx_documents_updated_at
  on public.documents(updated_at desc);
create index if not exists idx_update_logs_created_at
  on public.update_logs(created_at desc);

create or replace function public.set_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_documents_updated_at();

alter table public.documents enable row level security;
alter table public.update_logs enable row level security;

grant select on public.documents to anon, authenticated;
grant insert, update, delete on public.documents to authenticated;
grant select, insert on public.update_logs to authenticated;

drop policy if exists "Public can read documents" on public.documents;
create policy "Public can read documents"
on public.documents
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can insert documents" on public.documents;
create policy "Authenticated users can insert documents"
on public.documents
for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can update documents" on public.documents;
create policy "Authenticated users can update documents"
on public.documents
for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can delete documents" on public.documents;
create policy "Authenticated users can delete documents"
on public.documents
for delete
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can read update logs" on public.update_logs;
create policy "Authenticated users can read update logs"
on public.update_logs
for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Authenticated users can insert update logs" on public.update_logs;
create policy "Authenticated users can insert update logs"
on public.update_logs
for insert
to authenticated
with check ((select auth.uid()) is not null);

-- Keep the bucket private. Public users receive short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('regulatory-files', 'regulatory-files', false)
on conflict (id) do update
set name = excluded.name,
    public = false;

drop policy if exists "Public can create signed URLs for regulatory files"
  on storage.objects;
create policy "Public can create signed URLs for regulatory files"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'regulatory-files');

drop policy if exists "Authenticated users can upload regulatory files"
  on storage.objects;
create policy "Authenticated users can upload regulatory files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'regulatory-files'
  and (select auth.uid()) is not null
);

drop policy if exists "Authenticated users can update regulatory files"
  on storage.objects;
create policy "Authenticated users can update regulatory files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'regulatory-files'
  and (select auth.uid()) is not null
)
with check (
  bucket_id = 'regulatory-files'
  and (select auth.uid()) is not null
);

drop policy if exists "Authenticated users can delete regulatory files"
  on storage.objects;
create policy "Authenticated users can delete regulatory files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'regulatory-files'
  and (select auth.uid()) is not null
);

-- Security note:
-- Every permanent authenticated user receives admin-level write access in this
-- simple internal application. Disable public sign-ups in Auth settings and
-- create admin users manually from the Supabase Dashboard.
