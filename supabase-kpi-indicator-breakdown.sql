-- KPI indicator breakdown for Dashboard KPI & HSE.
-- Jalankan di Supabase Dashboard > SQL Editor.
--
-- Catatan:
-- 1. Jalankan setelah tabel public.dashboard_monthly_data sudah ada.
-- 2. SQL ini dibuat idempotent: aman dijalankan lebih dari sekali.
-- 3. Tidak menghapus data lama.

do $$
begin
  if to_regclass('public.dashboard_monthly_data') is null then
    raise notice 'Tabel public.dashboard_monthly_data belum ada. Jalankan supabase-dashboard-kpi-k3l.sql dan supabase-dashboard-kpi-hse-update.sql dulu.';
    return;
  end if;

  alter table public.dashboard_monthly_data
    add column if not exists kpi_indicator_breakdown jsonb;

  comment on column public.dashboard_monthly_data.kpi_indicator_breakdown is
    'Breakdown sub-poin untuk 5 indikator utama KPI. Disimpan sebagai JSONB; total indikator tetap disimpan ke kolom score lama.';
end $$;
