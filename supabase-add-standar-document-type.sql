-- AEBT Regulatory Knowledge Hub
-- Allow documents.document_type to store regulasi, sop, or standar.
-- Run this migration once in Supabase Dashboard > SQL Editor.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.documents'::regclass
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%document_type%'
  loop
    execute format(
      'alter table public.documents drop constraint %I',
      constraint_name
    );
  end loop;
end
$$;

alter table public.documents
  add constraint documents_document_type_check
  check (document_type in ('regulasi', 'sop', 'standar'));

notify pgrst, 'reload schema';
