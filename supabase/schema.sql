-- Run this script in Supabase SQL Editor before starting the app.
-- It creates the table for regulations/SOP and an update log.

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
  status text check (status in ('Berlaku', 'Dicabut', 'Diubah', 'Perlu Review')) default 'Berlaku',
  related_services text,
  sbu_relevance text check (sbu_relevance in ('Sangat Tinggi', 'Tinggi', 'Sedang', 'Rendah')),
  service_opportunity text,
  compliance_risk text,
  action_point text,
  priority_score integer check (priority_score between 1 and 25),
  source_url text,
  file_path text,
  file_name text,
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

create index if not exists idx_documents_type on public.documents(document_type);
create index if not exists idx_documents_category on public.documents(category);
create index if not exists idx_documents_status on public.documents(status);
create index if not exists idx_documents_year on public.documents(year);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

-- Enable RLS to avoid accidental public access.
alter table public.documents enable row level security;
alter table public.update_logs enable row level security;

-- This app uses SUPABASE_SERVICE_ROLE_KEY only from the server.
-- Therefore, no public RLS policy is required for MVP usage.

-- Create private storage bucket. If this fails because the bucket already exists, create it manually in Supabase Dashboard > Storage.
insert into storage.buckets (id, name, public)
values ('regulatory-files', 'regulatory-files', false)
on conflict (id) do nothing;
