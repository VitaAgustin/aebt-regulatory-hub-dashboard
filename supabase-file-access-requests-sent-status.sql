-- Allow admins to mark approved download/access requests as sent.
-- Safe to run after supabase-file-access-requests.sql.

alter table public.file_access_requests
  add column if not exists sent_at timestamptz;
alter table public.file_access_requests
  add column if not exists sent_by text;

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
