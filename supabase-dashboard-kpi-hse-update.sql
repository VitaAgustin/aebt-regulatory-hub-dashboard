-- Dashboard KPI & HSE update model.
-- Run in Supabase Dashboard > SQL Editor after supabase-dashboard-kpi-k3l.sql.

alter table public.dashboard_monthly_data
  add column if not exists triwulan integer,
  add column if not exists piutang_pad_hari numeric,
  add column if not exists kpi_keseluruhan numeric,
  add column if not exists kpi_kategori text,
  add column if not exists kpi_kse numeric,
  add column if not exists lagging_kematian integer,
  add column if not exists lagging_penanganan_medis integer,
  add column if not exists lagging_p3k integer,
  add column if not exists lagging_kejadian_berdampak_lingkungan integer,
  add column if not exists leading_tinjauan_manajemen integer,
  add column if not exists leading_hse_talk integer,
  add column if not exists leading_hse_visit integer,
  add column if not exists leading_po_terintegrasi_k3l integer,
  add column if not exists leading_pro_shot integer,
  add column if not exists leading_tinjauan_ipprk3l integer,
  add column if not exists leading_promosi_edukasi_k3l integer,
  add column if not exists leading_pelatihan_safety_leadership integer,
  add column if not exists leading_brevet_k3 integer,
  add column if not exists leading_hse_orientation integer,
  add column if not exists leading_jsa integer,
  add column if not exists leading_mcu integer,
  add column if not exists pegawai_ls integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dashboard_monthly_data_triwulan_check'
      and conrelid = 'public.dashboard_monthly_data'::regclass
  ) then
    alter table public.dashboard_monthly_data
      add constraint dashboard_monthly_data_triwulan_check
      check (triwulan is null or triwulan between 1 and 4);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'dashboard_monthly_data_kpi_kategori_check'
      and conrelid = 'public.dashboard_monthly_data'::regclass
  ) then
    alter table public.dashboard_monthly_data
      add constraint dashboard_monthly_data_kpi_kategori_check
      check (kpi_kategori is null or kpi_kategori in ('P1', 'P2', 'P3', 'P4', 'P5'));
  end if;
end $$;

update public.dashboard_monthly_data
set triwulan = case
  when month between 1 and 3 then 1
  when month between 4 and 6 then 2
  when month between 7 and 9 then 3
  when month between 10 and 12 then 4
  else triwulan
end
where triwulan is null;

update public.dashboard_monthly_data
set
  kpi_keseluruhan = coalesce(kpi_keseluruhan, kpi_overall_score),
  lagging_kematian = coalesce(lagging_kematian, fatality),
  lagging_penanganan_medis = coalesce(lagging_penanganan_medis, medical_treatment),
  lagging_p3k = coalesce(lagging_p3k, first_aid),
  lagging_kejadian_berdampak_lingkungan =
    coalesce(lagging_kejadian_berdampak_lingkungan, environmental_incident),
  pegawai_ls = coalesce(pegawai_ls, third_party_employees);

update public.dashboard_monthly_data
set kpi_kategori = case
  when kpi_keseluruhan > 106 then 'P1'
  when kpi_keseluruhan > 101 and kpi_keseluruhan <= 106 then 'P2'
  when kpi_keseluruhan > 95 and kpi_keseluruhan <= 101 then 'P3'
  when kpi_keseluruhan > 80 and kpi_keseluruhan <= 95 then 'P4'
  when kpi_keseluruhan is not null then 'P5'
  else null
end
where kpi_keseluruhan is not null;

update public.dashboard_monthly_data
set
  piutang_pad_hari = coalesce(piutang_pad_hari, 45),
  kpi_keseluruhan = coalesce(kpi_keseluruhan, 78.5),
  kpi_kategori = coalesce(kpi_kategori, 'P5'),
  kpi_kse = coalesce(kpi_kse, 92),
  leading_tinjauan_manajemen = coalesce(leading_tinjauan_manajemen, 12),
  leading_hse_talk = coalesce(leading_hse_talk, 28),
  leading_hse_visit = coalesce(leading_hse_visit, 18),
  leading_po_terintegrasi_k3l = coalesce(leading_po_terintegrasi_k3l, 24),
  leading_pro_shot = coalesce(leading_pro_shot, 36),
  leading_tinjauan_ipprk3l = coalesce(leading_tinjauan_ipprk3l, 8),
  leading_promosi_edukasi_k3l = coalesce(leading_promosi_edukasi_k3l, 15),
  leading_pelatihan_safety_leadership = coalesce(leading_pelatihan_safety_leadership, 120),
  leading_brevet_k3 = coalesce(leading_brevet_k3, 45),
  leading_hse_orientation = coalesce(leading_hse_orientation, 90),
  leading_jsa = coalesce(leading_jsa, 340),
  leading_mcu = coalesce(leading_mcu, 210)
where year = 2025 and month = 12;

create index if not exists idx_dashboard_monthly_data_triwulan
  on public.dashboard_monthly_data(year desc, triwulan, month);
