-- AEBT Regulatory Knowledge Hub
-- Add optional external document links and an explicit file source.
-- Run this migration once in Supabase Dashboard > SQL Editor.

do $$
declare
  file_source_already_exists boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'documents'
      and column_name = 'file_source'
  ) into file_source_already_exists;

  alter table public.documents
    add column if not exists external_file_url text;

  alter table public.documents
    add column if not exists file_source text;

  if not file_source_already_exists then
    update public.documents
    set file_source = case
      when nullif(btrim(external_file_url), '') is not null then 'external'
      when nullif(btrim(file_path), '') is not null then 'supabase'
      else 'none'
    end;
  else
    update public.documents
    set file_source = case
      when nullif(btrim(external_file_url), '') is not null then 'external'
      when nullif(btrim(file_path), '') is not null then 'supabase'
      else 'none'
    end
    where file_source is null
       or file_source not in ('supabase', 'external', 'none');
  end if;
end
$$;

alter table public.documents
  alter column file_source set default 'none';

update public.documents
set file_source = 'none'
where file_source is null;

alter table public.documents
  alter column file_source set not null;

alter table public.documents
  drop constraint if exists documents_file_source_check;

alter table public.documents
  add constraint documents_file_source_check
  check (file_source in ('supabase', 'external', 'none'));

notify pgrst, 'reload schema';
