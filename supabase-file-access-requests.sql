-- Download/access request log for documents and Library items.
-- Run after supabase-library.sql.

create table if not exists public.file_access_requests (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null default 'document'
    check (resource_type in ('document', 'library')),
  document_id uuid references public.documents(id) on delete set null,
  library_item_id uuid references public.library_items(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  requester_unit text,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'sent')),
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  constraint file_access_requests_resource_check check (
    (resource_type = 'document' and library_item_id is null)
    or
    (resource_type = 'library' and document_id is null)
  )
);

alter table public.file_access_requests
  drop constraint if exists file_access_requests_resource_check;
alter table public.file_access_requests
  add constraint file_access_requests_resource_check check (
    (resource_type = 'document' and library_item_id is null)
    or
    (resource_type = 'library' and document_id is null)
  );

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'file_access_requests'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format(
      'alter table public.file_access_requests drop constraint if exists %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.file_access_requests
  add constraint file_access_requests_status_check
  check (status in ('pending', 'approved', 'rejected', 'sent'));

create index if not exists idx_file_access_requests_status
  on public.file_access_requests(status, requested_at desc);
create index if not exists idx_file_access_requests_document
  on public.file_access_requests(document_id);
create index if not exists idx_file_access_requests_library_item
  on public.file_access_requests(library_item_id);

alter table public.file_access_requests enable row level security;

drop policy if exists "Public can submit file access requests"
  on public.file_access_requests;
create policy "Public can submit file access requests"
on public.file_access_requests
for insert
to anon
with check (
  status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and admin_note is null
  and (
    (resource_type = 'document' and document_id is not null and library_item_id is null)
    or
    (resource_type = 'library' and library_item_id is not null and document_id is null)
  )
);

drop policy if exists "Authenticated users can submit file access requests"
  on public.file_access_requests;
create policy "Authenticated users can submit file access requests"
on public.file_access_requests
for insert
to authenticated
with check (
  status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and admin_note is null
  and (
    (resource_type = 'document' and document_id is not null and library_item_id is null)
    or
    (resource_type = 'library' and library_item_id is not null and document_id is null)
  )
);

drop policy if exists "Authenticated users can read file access requests"
  on public.file_access_requests;
create policy "Authenticated users can read file access requests"
on public.file_access_requests
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can update file access requests"
  on public.file_access_requests;
create policy "Authenticated users can update file access requests"
on public.file_access_requests
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete file access requests"
  on public.file_access_requests;
create policy "Authenticated users can delete file access requests"
on public.file_access_requests
for delete
to authenticated
using (true);
