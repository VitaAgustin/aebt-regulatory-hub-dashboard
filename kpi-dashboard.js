"use strict";

const KPI_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

const KPI_QUARTERS = [
  { value: 1, label: "I", months: [1, 2, 3] },
  { value: 2, label: "II", months: [4, 5, 6] },
  { value: 3, label: "III", months: [7, 8, 9] },
  { value: 4, label: "IV", months: [10, 11, 12] }
];

const KPI_PERCENT_FIELDS = [
  "customer_retention",
  "kpi_keseluruhan",
  "kpi_kse",
  "economic_social_score",
  "business_innovation_score",
  "technology_leadership_score",
  "investment_score",
  "talent_development_score",
  "leading_po_terintegrasi_k3l",
  "leading_pro_shot",
  "leading_tinjauan_ipprk3l",
  "leading_pelatihan_safety_leadership",
  "leading_hse_orientation",
  "leading_jsa",
  "leading_mcu"
];

const KPI_BOUNDED_PERCENT_FIELDS = KPI_PERCENT_FIELDS.filter(
  (field) => field !== "kpi_keseluruhan"
);

const KPI_NON_NEGATIVE_FIELDS = [
  "piutang_pad_hari",
  "ebitda_portfolio",
  "portfolio_revenue",
  "permanent_employees",
  "temporary_employees",
  "project_employees",
  "pegawai_ls",
  "total_work_hours",
  "lagging_kematian",
  "lagging_penanganan_medis",
  "lagging_p3k",
  "lagging_kejadian_berdampak_lingkungan",
  "leading_tinjauan_manajemen",
  "leading_hse_talk",
  "leading_hse_visit",
  "leading_po_terintegrasi_k3l",
  "leading_pro_shot",
  "leading_tinjauan_ipprk3l",
  "leading_promosi_edukasi_k3l",
  "leading_pelatihan_safety_leadership",
  "leading_brevet_k3",
  "leading_hse_orientation",
  "leading_jsa",
  "leading_mcu"
];

const KPI_INTEGER_FIELDS = [
  "year",
  "month",
  "triwulan",
  "permanent_employees",
  "temporary_employees",
  "project_employees",
  "pegawai_ls",
  "lagging_kematian",
  "lagging_penanganan_medis",
  "lagging_p3k",
  "lagging_kejadian_berdampak_lingkungan",
  "leading_tinjauan_manajemen",
  "leading_hse_talk",
  "leading_hse_visit",
  "leading_po_terintegrasi_k3l",
  "leading_pro_shot",
  "leading_tinjauan_ipprk3l",
  "leading_promosi_edukasi_k3l",
  "leading_pelatihan_safety_leadership",
  "leading_brevet_k3",
  "leading_hse_orientation",
  "leading_jsa",
  "leading_mcu"
];

const KPI_INDICATOR_BREAKDOWN = [
  {
    key: "ekonomi_sosial",
    label: "Ekonomi dan Sosial",
    totalField: "economic_social_score",
    groups: [
      {
        name: "Financial",
        items: [
          { key: "ebitda_portofolio", label: "EBITDA Portofolio" },
          { key: "laba_operasi_portofolio", label: "Laba Operasi Portofolio" },
          { key: "piutang_pad_berkualitas", label: "Piutang & PAD Berkualitas" },
          {
            key: "pendapatan_eksisting_portofolio",
            label: "Pendapatan dari Eksisting Portofolio"
          },
          { key: "growth_acceleration", label: "Growth Acceleration" }
        ]
      },
      {
        name: "Operational",
        items: [
          {
            key: "jumlah_titik_layanan_target",
            label: "Jumlah Titik Layanan yang Mencapai Target"
          },
          {
            key: "akurasi_sertifikat_laporan",
            label: "Tingkat Akurasi Sertifikat dan Laporan"
          },
          { key: "cross_selling_upselling", label: "Cross Selling & Upselling" },
          { key: "account_planning", label: "Account Planning" },
          { key: "taksonomi_jasa", label: "Taksonomi Jasa" }
        ]
      },
      {
        name: "Sosial",
        items: [
          { key: "employee_esg_participation", label: "Employee ESG Participation" }
        ]
      }
    ]
  },
  {
    key: "inovasi_model_bisnis",
    label: "Inovasi Model Bisnis",
    totalField: "business_innovation_score",
    groups: [
      {
        name: "Sub-poin",
        items: [
          {
            key: "pemenuhan_sistem_manajemen",
            label: "Pemenuhan Sistem Manajemen Perusahaan"
          },
          { key: "sla_unit_kerja", label: "SLA Unit Kerja / Service Delivery Time" },
          {
            key: "ketercapaian_program_inisiatif",
            label: "Ketercapaian Program Inisiatif"
          }
        ]
      }
    ]
  },
  {
    key: "kepemimpinan_teknologi",
    label: "Kepemimpinan Teknologi",
    totalField: "technology_leadership_score",
    groups: [
      {
        name: "Sub-poin",
        items: [
          { key: "kepatuhan_keamanan_siber", label: "Kepatuhan Keamanan Siber" }
        ]
      }
    ]
  },
  {
    key: "peningkatan_investasi",
    label: "Peningkatan Investasi",
    totalField: "investment_score",
    groups: [
      {
        name: "Sub-poin",
        items: [
          {
            key: "utilisasi_peralatan_operasi",
            label: "Utilisasi Peralatan Operasi Portofolio"
          },
          {
            key: "percepatan_investasi_peralatan",
            label: "Percepatan Investasi Peralatan Operasi"
          }
        ]
      }
    ]
  },
  {
    key: "pengembangan_talenta",
    label: "Pengembangan Talenta",
    totalField: "talent_development_score",
    groups: [
      {
        name: "Sub-poin",
        items: [
          {
            key: "employee_equivalent_expertise",
            label: "Employee with Equivalent Expertise"
          },
          {
            key: "produktivitas_pegawai_portofolio",
            label: "Produktivitas Pegawai Portofolio"
          }
        ]
      }
    ]
  }
];

const KPI_ASPECTS = KPI_INDICATOR_BREAKDOWN.map((indicator) => [
  indicator.label,
  indicator.totalField,
  indicator.key
]);

const KPI_LAGGING_ITEMS = [
  ["Kematian", "lagging_kematian", "fatality"],
  ["Penanganan Medis", "lagging_penanganan_medis", "medical_treatment"],
  ["P3K", "lagging_p3k", "first_aid"],
  [
    "Kejadian Berdampak Lingkungan",
    "lagging_kejadian_berdampak_lingkungan",
    "environmental_incident"
  ]
];

const KPI_LEADING_ITEMS = [
  ["Tinjauan Manajemen", "leading_tinjauan_manajemen"],
  ["HSE Talk", "leading_hse_talk"],
  ["HSE Visit", "leading_hse_visit"],
  ["PO Terintegrasi K3L", "leading_po_terintegrasi_k3l"],
  ["PRO-SHOT", "leading_pro_shot"],
  ["Tinjauan IPPRK3L", "leading_tinjauan_ipprk3l"],
  ["Promosi & Edukasi K3L", "leading_promosi_edukasi_k3l"],
  ["Pelatihan Safety Leadership", "leading_pelatihan_safety_leadership"],
  ["Brevet K3", "leading_brevet_k3"],
  ["HSE Orientation", "leading_hse_orientation"],
  ["JSA", "leading_jsa"],
  ["MCU", "leading_mcu"]
];

const KPI_INDICATOR_PERCENT_FIELDS = new Set([
  "leading_po_terintegrasi_k3l",
  "leading_pro_shot",
  "leading_tinjauan_ipprk3l",
  "leading_pelatihan_safety_leadership",
  "leading_hse_orientation",
  "leading_jsa",
  "leading_mcu"
]);

const KPI_EMPLOYEE_ITEMS = [
  ["Pegawai Tetap", "permanent_employees", "#008b8b"],
  ["Pegawai Tidak Tetap", "temporary_employees", "#f97316"],
  ["PTT Proyek / Non-NPP", "project_employees", "#1d9bf0"],
  ["LS", "pegawai_ls", "#cbd5e1", "third_party_employees"]
];

function bindKpiDashboardEvents() {
  populateKpiPeriodControls();
  renderKpiBreakdownInputs();

  $("#kpi-filter-quarter")?.addEventListener("change", handleKpiQuarterChange);
  $("#kpi-filter-month")?.addEventListener("change", handleKpiPeriodChange);
  $("#kpi-filter-year")?.addEventListener("change", handleKpiPeriodChange);
  $("#kpi-update-data")?.addEventListener("click", openKpiInputPage);
  $("#kpi-export-dashboard")?.addEventListener("click", handleKpiDashboardExport);
  $("#kpi-data-form")?.addEventListener("submit", handleKpiDataSubmit);
  $("#kpi-data-form")?.addEventListener("input", handleKpiFormInput);
  $("#kpi-data-form")?.addEventListener("change", handleKpiFormChange);
  $("#kpi-aspect-bars")?.addEventListener("click", handleKpiIndicatorClick);
  $("#kpi-cancel-edit")?.addEventListener("click", () =>
    loadKpiRecordIntoForm()
  );
  document.addEventListener("click", handleKpiModalDocumentClick);
}

async function loadKpiDashboardData({ force = false } = {}) {
  if (state.kpiPromise) {
    if (!force) return state.kpiPromise;
    await state.kpiPromise.catch(() => {});
  }

  state.kpiPromise = (async () => {
    try {
      const { data, error } = await db
        .from(DASHBOARD_MONTHLY_TABLE)
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (error) throw error;
      state.kpiRecords = Array.isArray(data) ? data : [];
      state.kpiLoaded = true;
      state.kpiError = null;
    } catch (error) {
      state.kpiRecords = [];
      state.kpiLoaded = false;
      state.kpiError = new Error(
        `Dashboard KPI & HSE belum siap: ${readableError(error)}`
      );
    } finally {
      state.kpiPromise = null;
      populateKpiPeriodControls();
      renderKpiDashboard();
      renderKpiInputState();
    }
    return state.kpiRecords;
  })();

  return state.kpiPromise;
}

function populateKpiPeriodControls() {
  const selectedQuarter =
    normalizeKpiQuarter(state.selectedKpiQuarter, state.selectedKpiMonth) ||
    getQuarterFromMonth(state.selectedKpiMonth || 12);
  state.selectedKpiQuarter = selectedQuarter;

  populateKpiQuarterSelect($("#kpi-filter-quarter"), selectedQuarter);
  populateKpiQuarterSelect($("#kpi-data-form select[name='triwulan']"), selectedQuarter);
  populateKpiMonthSelect($("#kpi-filter-month"), state.selectedKpiMonth);
  populateKpiMonthSelect($("#kpi-data-form select[name='month']"), state.selectedKpiMonth);

  const years = new Set([2025, new Date().getFullYear(), state.selectedKpiYear]);
  safeKpiRecords().forEach((record) => years.add(Number(record.year)));
  const sortedYears = [...years]
    .filter((year) => Number.isInteger(year) && year >= 2020 && year <= 2100)
    .sort((a, b) => b - a);

  populateKpiYearSelect($("#kpi-filter-year"), sortedYears, state.selectedKpiYear);

  const formYear = $("#kpi-data-form input[name='year']");
  if (formYear && !formYear.value) formYear.value = state.selectedKpiYear;
}

function populateKpiQuarterSelect(select, selectedQuarter) {
  if (!select) return;
  const currentValue = normalizeKpiQuarter(selectedQuarter, state.selectedKpiMonth) || 4;
  select.innerHTML = KPI_QUARTERS.map(
    (quarter) =>
      `<option value="${quarter.value}">${escapeHtml(quarter.label)}</option>`
  ).join("");
  select.value = String(currentValue);
}

function populateKpiMonthSelect(select, selectedMonth) {
  if (!select) return;
  const currentValue = Number(selectedMonth || select.value || 12);
  select.innerHTML = KPI_MONTHS.map(
    (month, index) =>
      `<option value="${index + 1}">${escapeHtml(month)}</option>`
  ).join("");
  select.value = String(currentValue || selectedMonth || 12);
}

function populateKpiYearSelect(select, years, selectedYear) {
  if (!select) return;
  select.innerHTML = years
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");
  select.value = String(selectedYear || years[0] || 2025);
}

function handleKpiQuarterChange() {
  const quarter = normalizeKpiQuarter($("#kpi-filter-quarter")?.value, state.selectedKpiMonth);
  const month = Number($("#kpi-filter-month")?.value || state.selectedKpiMonth || 12);
  const year = Number($("#kpi-filter-year")?.value);
  if (quarter) state.selectedKpiQuarter = quarter;
  if (year >= 2020 && year <= 2100) state.selectedKpiYear = year;
  if (quarter && getQuarterFromMonth(month) !== quarter) {
    state.selectedKpiMonth = KPI_QUARTERS.find((item) => item.value === quarter)?.months[0] || month;
    const monthSelect = $("#kpi-filter-month");
    if (monthSelect) monthSelect.value = String(state.selectedKpiMonth);
  } else if (month >= 1 && month <= 12) {
    state.selectedKpiMonth = month;
  }
  renderKpiDashboard();
  if (location.hash.replace(/^#/, "") === "kpi-input") loadKpiRecordIntoForm();
}

function handleKpiPeriodChange() {
  const month = Number($("#kpi-filter-month")?.value);
  const year = Number($("#kpi-filter-year")?.value);
  if (month >= 1 && month <= 12) state.selectedKpiMonth = month;
  if (year >= 2020 && year <= 2100) state.selectedKpiYear = year;
  state.selectedKpiQuarter = getQuarterFromMonth(state.selectedKpiMonth);
  const quarterSelect = $("#kpi-filter-quarter");
  if (quarterSelect) quarterSelect.value = String(state.selectedKpiQuarter);
  renderKpiDashboard();
  if (location.hash.replace(/^#/, "") === "kpi-input") loadKpiRecordIntoForm();
}

function renderKpiDashboard() {
  if (!$("#view-kpi")) return;
  populateKpiPeriodControls();

  const record = getSelectedKpiRecord();
  const migrationAlert = $("#kpi-migration-alert");
  if (migrationAlert) {
    migrationAlert.classList.toggle("hidden", !state.kpiError);
    migrationAlert.textContent = state.kpiError
      ? "Dashboard belum tersedia. Jalankan supabase-dashboard-kpi-hse-update.sql di Supabase SQL Editor."
      : "";
  }

  const kpiOverall = getKpiOverallValue(record);
  const kpiCategory = getKpiCategory(kpiOverall);
  setText("#kpi-card-score", kpiFormatDays(record?.piutang_pad_hari));
  setText("#kpi-card-ebitda", kpiFormatMoneyMillion(record?.ebitda_portfolio));
  setText("#kpi-card-revenue", kpiFormatMoneyMillion(record?.portfolio_revenue));
  setText("#kpi-card-retention", kpiFormatPercent(record?.customer_retention));
  setText("#kpi-card-work-hours", kpiFormatHours(record?.total_work_hours));
  setText("#kpi-card-kse", kpiFormatPercent(getKpiKseValue(record)));
  setText("#kpi-overall-value", kpiFormatPercent(kpiOverall));
  setText("#kpi-category-label", kpiCategory ? `Kategori: ${kpiCategory.label}` : "Kategori: -");
  setText("#kpi-category-range", kpiCategory ? `${kpiCategory.label} (${kpiCategory.range})` : "-");
  const categoryChip = $("#kpi-category-chip");
  if (categoryChip) {
    categoryChip.className = `kpi-category-chip ${kpiCategory?.tone || "is-empty"}`;
  }

  renderKpiAspectBars(record);
  renderKpiLaggingIndicators(record);
  renderKpiLeadingIndicators(record);
  renderKpiEmployeeDonut(record);
  renderKpiOverallTrend();
}

function renderKpiAspectBars(record) {
  const container = $("#kpi-aspect-bars");
  if (!container) return;

  container.innerHTML = KPI_ASPECTS.map(([label, key, indicatorKey]) => {
    const value = getKpiAspectValue(record, key, indicatorKey);
    const width = value === null ? 0 : kpiClampPercent(value);
    const lowClass = value !== null && value < 50 ? " kpi-aspect-low" : "";
    return `
      <button
        class="kpi-aspect-row${lowClass}"
        type="button"
        data-kpi-indicator="${escapeHtml(indicatorKey)}"
        title="Lihat rincian ${escapeHtml(label)}"
        aria-label="Lihat rincian ${escapeHtml(label)}"
      >
        <span>${escapeHtml(label)}</span>
        <div class="kpi-track"><i style="width:${width}%"></i></div>
        <strong>${kpiFormatPercent(value)}</strong>
      </button>
    `;
  }).join("");

  container.querySelectorAll("[data-kpi-indicator]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openKpiIndicatorModal(button.dataset.kpiIndicator);
    });
  });
}

function renderKpiBreakdownInputs() {
  const container = $("#kpi-breakdown-inputs");
  if (!container || container.dataset.rendered === "true") return;

  container.innerHTML = KPI_INDICATOR_BREAKDOWN.map((indicator) => `
    <details class="kpi-breakdown-section" open>
      <summary>
        <span>${escapeHtml(indicator.label)}</span>
        <strong data-kpi-breakdown-total="${escapeHtml(indicator.key)}">Total: -</strong>
      </summary>
      <div class="kpi-breakdown-groups">
        ${indicator.groups
          .map((group) => `
            <section class="kpi-breakdown-group">
              <h4>${escapeHtml(group.name)}</h4>
              <div class="form-grid">
                ${group.items
                  .map((item) => `
                    <label>
                      <span>${escapeHtml(item.label)}</span>
                      <input
                        name="${escapeHtml(kpiBreakdownInputName(indicator.key, item.key))}"
                        type="number"
                        min="0"
                        step="0.01"
                        data-kpi-breakdown-input="${escapeHtml(indicator.key)}"
                      />
                    </label>
                  `)
                  .join("")}
              </div>
            </section>
          `)
          .join("")}
      </div>
    </details>
  `).join("");
  container.dataset.rendered = "true";
}

function handleKpiIndicatorClick(event) {
  const button = event.target.closest("[data-kpi-indicator]");
  if (!button) return;
  openKpiIndicatorModal(button.dataset.kpiIndicator);
}

function handleKpiModalDocumentClick(event) {
  const modal = $("#kpi-indicator-modal");
  if (!modal || modal.classList.contains("hidden")) return;
  if (
    event.target.matches("[data-kpi-modal-close]") ||
    event.target.id === "kpi-indicator-modal"
  ) {
    closeKpiIndicatorModal();
  }
}

function openKpiIndicatorModal(indicatorKey) {
  const indicator = getKpiIndicatorDefinition(indicatorKey);
  if (!indicator) return;
  const record = getSelectedKpiRecord();
  const breakdown = getKpiIndicatorBreakdown(record);
  const hasBreakdown = hasKpiIndicatorBreakdownValue(breakdown, indicator.key);
  const total = getKpiAspectValue(record, indicator.totalField, indicator.key);
  const lowClass = total !== null && total < 50 ? " is-low" : "";

  let modal = $("#kpi-indicator-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "kpi-indicator-modal";
    modal.className = "kpi-modal hidden";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="kpi-modal-card" role="dialog" aria-modal="true" aria-labelledby="kpi-modal-title">
      <button class="kpi-modal-close" type="button" data-kpi-modal-close aria-label="Tutup modal">&times;</button>
      <div class="kpi-modal-heading">
        <p>Breakdown sub-poin KPI</p>
        <h2 id="kpi-modal-title">${escapeHtml(indicator.label)}</h2>
      </div>
      ${
        hasBreakdown
          ? buildKpiIndicatorModalGroups(indicator, breakdown)
          : `<div class="kpi-modal-empty">Belum ada breakdown untuk indikator ini.</div>`
      }
      <div class="kpi-modal-total${lowClass}">
        <span>Total ${escapeHtml(indicator.label)}</span>
        <strong>${kpiFormatPercent(total)}</strong>
      </div>
      <div class="kpi-modal-actions">
        <button class="button secondary" type="button" data-kpi-modal-close>Tutup</button>
      </div>
    </div>
  `;
  modal.classList.remove("hidden");
}

function buildKpiIndicatorModalGroups(indicator, breakdown) {
  return indicator.groups
    .map((group) => `
      <section class="kpi-modal-group">
        <h3>${escapeHtml(group.name)}</h3>
        <div>
          ${group.items
            .map((item) => {
              const value = getKpiBreakdownItemValue(breakdown, indicator.key, item.key);
              return `
                <div class="kpi-modal-row">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${kpiFormatBreakdownValue(value)}</strong>
                </div>
              `;
            })
            .join("")}
        </div>
      </section>
    `)
    .join("");
}

function closeKpiIndicatorModal() {
  $("#kpi-indicator-modal")?.classList.add("hidden");
}

function renderKpiLaggingIndicators(record) {
  const container = $("#kpi-lagging-list");
  if (!container) return;
  container.innerHTML = KPI_LAGGING_ITEMS.map(
    ([label, key, fallbackKey]) => `
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${formatKpiIndicatorValue(key, getKpiIndicatorValue(record, key, fallbackKey))}</strong>
      </div>
    `
  ).join("");
}

function renderKpiLeadingIndicators(record) {
  const container = $("#kpi-leading-list");
  if (!container) return;
  container.innerHTML = KPI_LEADING_ITEMS.map(
    ([label, key]) => `
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${formatKpiIndicatorValue(key, record?.[key])}</strong>
      </div>
    `
  ).join("");
}

function renderKpiEmployeeDonut(record) {
  const donut = $("#kpi-employee-donut");
  const legend = $("#kpi-employee-legend");
  if (!donut || !legend) return;

  const values = KPI_EMPLOYEE_ITEMS.map(([, key, color, fallbackKey]) => ({
    key,
    color,
    value: getKpiIndicatorValue(record, key, fallbackKey)
  }));
  const hasData = values.some((item) => item.value !== null);
  const total = values.reduce((sum, item) => sum + (item.value || 0), 0);

  if (!hasData || total <= 0) {
    donut.style.background = "#e2e8f0";
    setText("#kpi-employee-total", "-");
  } else {
    let cursor = 0;
    const stops = values.map((item) => {
      const start = cursor;
      const end = cursor + ((item.value || 0) / total) * 100;
      cursor = end;
      return `${item.color} ${start}% ${end}%`;
    });
    donut.style.background = `conic-gradient(${stops.join(", ")})`;
    setText("#kpi-employee-total", kpiFormatInteger(total));
  }

  legend.innerHTML = KPI_EMPLOYEE_ITEMS.map(([label, key, color, fallbackKey]) => `
    <div>
      <i style="background:${color}"></i>
      <span>${escapeHtml(label)}</span>
      <strong>${kpiFormatInteger(getKpiIndicatorValue(record, key, fallbackKey))}</strong>
    </div>
  `).join("");
}

function renderKpiOverallTrend() {
  const container = $("#kpi-overall-trend-chart");
  if (!container) return;

  const values = getKpiQuarterTrendValues();
  const selectedQuarter = getQuarterFromMonth(state.selectedKpiMonth || 12);
  const selectedValue = values[selectedQuarter - 1];
  setText("#kpi-overall-trend-selected", kpiFormatPercent(selectedValue));

  const numericValues = values.filter((value) => value !== null);
  if (!numericValues.length) {
    container.innerHTML =
      '<div class="kpi-chart-empty">Belum ada data KPI keseluruhan untuk tahun ini.</div>';
    return;
  }

  const width = 720;
  const height = 220;
  const padding = { top: 18, right: 18, bottom: 38, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const points = values.map((value, index) => {
    const x = padding.left + (chartWidth / 3) * index;
    const y =
      value === null
        ? null
        : padding.top + chartHeight - (kpiClampPercent(value) / 100) * chartHeight;
    return { x, y, value, label: KPI_QUARTERS[index]?.label || String(index + 1) };
  });
  const paths = buildSegmentedLinePaths(points)
    .map((path) => `<path class="kpi-line" d="${path}" />`)
    .join("");
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = padding.top + chartHeight - ratio * chartHeight;
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />`;
    })
    .join("");
  const labels = points.map((point, index) => `
    <text x="${point.x}" y="${height - 14}" text-anchor="middle">${escapeHtml(point.label)}</text>
    ${
      point.y === null
        ? ""
        : `<circle cx="${point.x}" cy="${point.y}" r="${
            index + 1 === selectedQuarter ? 5 : 4
          }" />
           <text class="kpi-point-label" x="${point.x}" y="${point.y - 10}" text-anchor="middle">${kpiFormatPercent(point.value)}</text>`
    }
  `).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Tren KPI keseluruhan">
      <g class="kpi-grid-lines">${gridLines}</g>
      ${paths}
      <g class="kpi-points">${labels}</g>
    </svg>
    ${
      numericValues.length < 2
        ? '<div class="kpi-chart-note">Belum cukup data untuk menampilkan tren.</div>'
        : ""
    }
  `;
}

async function handleKpiDashboardExport() {
  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    showToast(
      "Library export belum siap. Periksa koneksi internet lalu coba lagi.",
      true
    );
    return;
  }

  const exportHost = ExportDashboardReport();
  document.body.appendChild(exportHost);
  const exportReport = exportHost.querySelector(".export-report");
  setLoading(true, "Menyiapkan export dashboard...");
  try {
    if (!exportReport) throw new Error("Template export dashboard tidak ditemukan.");
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    const canvas = await window.html2canvas(exportReport, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 1920,
      windowHeight: 1080
    });
    const pdf = new window.jspdf.jsPDF({
      orientation: "landscape",
      unit: "px",
      format: [1920, 1080],
      hotfixes: ["px_scaling"]
    });
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      0,
      1920,
      1080,
      undefined,
      "FAST"
    );
    pdf.save(getKpiExportFileName());
    showToast("Dashboard KPI & HSE berhasil diexport.");
  } catch (error) {
    showToast(`Gagal export dashboard: ${readableError(error)}`, true);
  } finally {
    exportHost.remove();
    setLoading(false);
  }
}

function ExportDashboardReport() {
  const record = getSelectedKpiRecord();
  const selectedQuarter = getQuarterFromMonth(state.selectedKpiMonth || 12);
  const period = `Triwulan ${KPI_QUARTERS[selectedQuarter - 1]?.label || "-"} - ${KPI_MONTHS[state.selectedKpiMonth - 1]} ${state.selectedKpiYear}`;
  const exportedAt = new Date().toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short"
  });
  const kpiOverall = getKpiOverallValue(record);
  const kpiCategory = getKpiCategory(kpiOverall);
  const employees = getKpiEmployeeExportData(record);
  const kpiTrendValues = getKpiQuarterTrendValues();

  const wrapper = document.createElement("div");
  wrapper.className = "dashboard-export-host";
  wrapper.innerHTML = `
    <section class="export-report ExportDashboardReport" aria-label="Dashboard KPI HSE export">
      <header class="export-report-header">
        <div class="export-brand-block">
          <img class="export-aura-logo" src="assets/logo-aura.png" alt="AURA" />
          <div class="export-title-block">
            <h1>Dashboard KPI &amp; HSE</h1>
            <p>Ringkasan Kinerja Perusahaan dan Keselamatan Kerja</p>
          </div>
        </div>
        <div class="export-report-meta">
          <div class="export-company-logos" aria-label="Logo perusahaan">
            <img class="export-company-logo export-logo-danantara" src="assets/logo-danantara.png" alt="Danantara Indonesia" />
            <img class="export-company-logo export-logo-idsurvey" src="assets/logo-idsurvey.png" alt="IDSurvey" />
            <img class="export-company-logo export-logo-sucofindo" src="assets/logo-sucofindo.png" alt="SUCOFINDO" />
          </div>
          <div class="export-date-row">
            <span><strong>Periode Laporan</strong> ${escapeHtml(period)}</span>
            <span><strong>Tanggal Export</strong> ${escapeHtml(exportedAt)}</span>
          </div>
        </div>
      </header>

      <main class="export-body">
        <section class="export-section export-column export-kpi-column">
          <h2>KPI Performance</h2>
          <div class="export-summary-grid export-summary-grid-kpi">
            ${buildKpiExportMetric("Piutang & PAD", kpiFormatDays(record?.piutang_pad_hari), "hari")}
            ${buildKpiExportMetric("EBITDA Portofolio", kpiFormatMoneyMillion(record?.ebitda_portfolio), "YTD")}
            ${buildKpiExportMetric("Pendapatan Portofolio", kpiFormatMoneyMillion(record?.portfolio_revenue), "YTD")}
            ${buildKpiExportMetric("Customer Retention", kpiFormatPercent(record?.customer_retention), "Retention Rate")}
          </div>

          <div class="export-kpi-mid-grid">
            <section class="export-card export-aspect-card">
              <h3>Capaian KPI per Indikator</h3>
              <div class="export-aspect-list">
                ${buildKpiExportAspectRows(record)}
              </div>
            </section>

            <section class="export-card export-overall-card ${kpiCategory?.tone || "is-empty"}">
              <h3>KPI Keseluruhan</h3>
              <div class="export-overall-content">
                <strong>${kpiFormatPercent(kpiOverall)}</strong>
                <span>${escapeHtml(kpiCategory ? `Kategori: ${kpiCategory.label}` : "Kategori: -")}</span>
                <div class="export-category-chip">
                  <i></i>
                  <b>${escapeHtml(kpiCategory ? `${kpiCategory.label} (${kpiCategory.range})` : "-")}</b>
                </div>
              </div>
            </section>
          </div>

          <section class="export-card export-trend-card">
            <div class="export-card-heading">
              <h3>Tren KPI Keseluruhan</h3>
              <strong>${kpiFormatPercent(kpiTrendValues[selectedQuarter - 1])}</strong>
            </div>
            ${buildKpiExportLineChart(kpiTrendValues, {
              color: "#064f83",
              max: 100,
              suffix: "%",
              labels: KPI_QUARTERS.map((item) => item.label),
              selectedIndex: selectedQuarter - 1,
              aria: "Tren KPI keseluruhan per triwulan"
            })}
          </section>
        </section>

        <section class="export-section export-column export-hse-column">
          <h2>HSE Performance</h2>
          <div class="export-summary-grid export-summary-grid-hse">
            ${buildKpiExportMetric("Safety Man Hours", kpiFormatHours(record?.total_work_hours), "jam")}
            ${buildKpiExportMetric("HSE Performance", kpiFormatPercent(getKpiKseValue(record)), "HSE")}
          </div>

          <div class="export-hse-mid-grid">
            <section class="export-card export-hse-summary-card">
              <h3>Lagging Indicator</h3>
              <div class="export-hse-list">
                ${buildKpiExportLaggingRows(record)}
              </div>
            </section>

            <section class="export-card export-leading-card">
              <h3>Leading Indicator</h3>
              <div class="export-leading-list">
                ${buildKpiExportLeadingRows(record)}
              </div>
            </section>
          </div>

          <section class="export-card export-employee-card">
            <h3>Komposisi Jumlah Pegawai</h3>
            <div class="export-donut-layout">
              ${buildKpiExportEmployeeDonut(employees)}
              <div class="export-legend">
                ${employees.items
                  .map((item) => `
                    <div>
                      <i style="background:${item.color}"></i>
                      <span>${escapeHtml(item.label)}</span>
                      <strong>${kpiFormatInteger(item.value)}</strong>
                    </div>
                  `)
                  .join("")}
              </div>
            </div>
          </section>
        </section>
      </main>
    </section>
  `;
  return wrapper;
}

function buildKpiExportMetric(label, value, hint) {
  return `
    <article class="export-metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function buildKpiExportAspectRows(record) {
  return KPI_ASPECTS.map(([label, key, indicatorKey]) => {
    const value = getKpiAspectValue(record, key, indicatorKey);
    const percent = value === null ? 0 : kpiClampPercent(value);
    const lowClass = value !== null && value < 50 ? " is-low" : "";
    return `
      <div class="export-aspect-row${lowClass}">
        <span>${escapeHtml(label)}</span>
        <div><i style="width:${percent}%"></i></div>
        <strong>${kpiFormatPercent(value)}</strong>
      </div>
    `;
  }).join("");
}

function buildKpiExportRevenueBar(label, value, height, tone) {
  return `
    <div class="export-revenue-bar ${tone}">
      <b>${kpiFormatCompact(value)}</b>
      <div><i style="height:${Math.max(0, Math.min(100, height))}%"></i></div>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function buildKpiExportLaggingRows(record) {
  return KPI_LAGGING_ITEMS.map(([label, key, fallbackKey]) => `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${formatKpiIndicatorValue(key, getKpiIndicatorValue(record, key, fallbackKey))}</strong>
    </div>
  `).join("");
}

function buildKpiExportLeadingRows(record) {
  const midpoint = Math.ceil(KPI_LEADING_ITEMS.length / 2);
  return [KPI_LEADING_ITEMS.slice(0, midpoint), KPI_LEADING_ITEMS.slice(midpoint)]
    .map((items) => `
      <div class="export-leading-column">
        ${items
          .map(([label, key]) => `
            <div>
              <span>${escapeHtml(label)}</span>
              <strong>${formatKpiIndicatorValue(key, record?.[key])}</strong>
            </div>
          `)
          .join("")}
      </div>
    `)
    .join("");
}

function buildKpiExportEmployeeDonut(employees) {
  const radius = 66;
  const circumference = 100;
  const strokeWidth = 30;
  let offset = 0;
  const total = employees.total || 0;
  const slices =
    total > 0
      ? employees.items
          .map((item) => {
            const percent = ((item.value || 0) / total) * circumference;
            const circle = `
              <circle
                class="export-donut-slice"
                cx="90"
                cy="90"
                r="${radius}"
                pathLength="${circumference}"
                stroke="${item.color}"
                stroke-width="${strokeWidth}"
                stroke-dasharray="${percent} ${circumference - percent}"
                stroke-dashoffset="${-offset}"
              />`;
            offset += percent;
            return circle;
          })
          .join("")
      : "";

  return `
    <div class="export-donut-wrapper" aria-label="Komposisi pegawai">
      <svg class="export-donut-svg" viewBox="0 0 180 180" role="img" aria-label="Donut komposisi pegawai">
        <circle class="export-donut-track" cx="90" cy="90" r="${radius}" pathLength="${circumference}" />
        <g transform="rotate(-90 90 90)">
          ${slices}
        </g>
      </svg>
      <div class="export-donut-center">
        <strong>${kpiFormatInteger(employees.total)}</strong>
        <span>Pegawai</span>
      </div>
    </div>
  `;
}

function getKpiEmployeeExportData(record) {
  const items = KPI_EMPLOYEE_ITEMS.map(([label, key, color, fallbackKey]) => ({
    label,
    color,
    value: getKpiIndicatorValue(record, key, fallbackKey)
  }));
  const total = items.reduce((sum, item) => sum + (item.value || 0), 0);
  if (total <= 0) {
    return { items, total: null };
  }
  return { items, total };
}

function getKpiYearValues(field) {
  const recordsByMonth = new Map(
    safeKpiRecords()
      .filter((record) => Number(record.year) === Number(state.selectedKpiYear))
      .map((record) => [Number(record.month), record])
  );
  return Array.from({ length: 12 }, (_, index) =>
    kpiNumberOrNull(recordsByMonth.get(index + 1)?.[field])
  );
}

function buildKpiExportLineChart(values, options = {}) {
  const numericValues = values.filter((value) => value !== null);
  if (!numericValues.length) {
    return '<div class="export-chart-empty">Belum ada data untuk periode ini.</div>';
  }
  const width = 760;
  const height = 230;
  const padding = { top: 22, right: 24, bottom: 42, left: 54 };
  const max = options.max || Math.max(...numericValues, 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const labelsSource = options.labels || KPI_MONTHS.map((month) => month.slice(0, 3));
  const selectedIndex = Number.isInteger(options.selectedIndex)
    ? options.selectedIndex
    : state.selectedKpiMonth - 1;
  const step = values.length > 1 ? chartWidth / (values.length - 1) : chartWidth;
  const points = values.map((value, index) => {
    const x = padding.left + step * index;
    const y =
      value === null
        ? null
        : padding.top + chartHeight - (Math.min(max, value) / max) * chartHeight;
    return { x, y, value, label: labelsSource[index] || String(index + 1) };
  });
  const paths = buildSegmentedLinePaths(points)
    .map(
      (path) =>
        `<path class="export-chart-line" style="stroke:${options.color || "#008b8b"}" d="${path}" />`
    )
    .join("");
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const y = padding.top + chartHeight - ratio * chartHeight;
      return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />`;
    })
    .join("");
  const labels = points
    .map((point, index) => `
      <text x="${point.x}" y="${height - 16}" text-anchor="middle">${escapeHtml(point.label)}</text>
      ${
        point.y === null
          ? ""
          : `<circle cx="${point.x}" cy="${point.y}" r="${
              index === selectedIndex ? 6 : 4
            }" />
             <text class="export-point-label" x="${point.x}" y="${point.y - 10}" text-anchor="middle">${escapeHtml(
               options.suffix === "%"
                 ? kpiFormatPercent(point.value)
                 : kpiFormatCompact(point.value)
             )}</text>`
      }
    `)
    .join("");
  return `
    <svg class="export-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.aria || "Tren bulanan")}">
      <g class="export-grid-lines">${gridLines}</g>
      ${paths}
      <g class="export-chart-points" style="--point-color:${options.color || "#008b8b"}">${labels}</g>
    </svg>
    ${
      numericValues.length < 2
        ? '<div class="export-chart-note">Belum cukup data untuk menampilkan tren.</div>'
        : ""
    }
  `;
}

function buildSegmentedLinePaths(points) {
  const segments = [];
  let current = [];
  points.forEach((point) => {
    if (point.y === null) {
      if (current.length > 1) segments.push(current);
      current = [];
      return;
    }
    current.push(point);
  });
  if (current.length > 1) segments.push(current);
  return segments.map((segment) =>
    segment
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join(" ")
  );
}

function getKpiExportFileName() {
  const month = KPI_MONTHS[state.selectedKpiMonth - 1] || "Periode";
  const year = state.selectedKpiYear || new Date().getFullYear();
  return `Dashboard-KPI-HSE-${month}-${year}.pdf`;
}

function renderKpiWorkHoursTrend() {
  const container = $("#kpi-work-hours-chart");
  if (!container) return;

  const recordsByMonth = new Map(
    safeKpiRecords()
      .filter((record) => Number(record.year) === Number(state.selectedKpiYear))
      .map((record) => [Number(record.month), record])
  );
  const values = Array.from({ length: 12 }, (_, index) =>
    kpiNumberOrNull(recordsByMonth.get(index + 1)?.total_work_hours)
  );
  const selectedValue = values[state.selectedKpiMonth - 1];
  setText("#kpi-trend-selected-total", `Total: ${kpiFormatHours(selectedValue)}`);

  const numericValues = values.filter((value) => value !== null);
  if (!numericValues.length) {
    container.innerHTML =
      '<div class="kpi-chart-empty">Belum ada data jam kerja untuk tahun ini.</div>';
    return;
  }

  const max = Math.max(...numericValues, 1000);
  const width = 720;
  const height = 260;
  const padding = { top: 18, right: 18, bottom: 42, left: 52 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const points = values.map((value, index) => {
    const x = padding.left + (chartWidth / 11) * index;
    const y =
      value === null
        ? null
        : padding.top + chartHeight - (value / max) * chartHeight;
    return { x, y, value, month: KPI_MONTHS[index].slice(0, 3) };
  });
  const path = points
    .filter((point) => point.y !== null)
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = padding.top + chartHeight - ratio * chartHeight;
    return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />`;
  }).join("");
  const labels = points.map((point, index) => `
    <text x="${point.x}" y="${height - 16}" text-anchor="middle">${escapeHtml(point.month)}</text>
    ${
      point.y === null
        ? ""
        : `<circle cx="${point.x}" cy="${point.y}" r="${
            index + 1 === state.selectedKpiMonth ? 5 : 4
          }" />
           <text class="kpi-point-label" x="${point.x}" y="${point.y - 10}" text-anchor="middle">${kpiFormatCompact(point.value)}</text>`
    }
  `).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Tren jam kerja bulanan">
      <g class="kpi-grid-lines">${gridLines}</g>
      <path class="kpi-line" d="${path}" />
      <g class="kpi-points">${labels}</g>
    </svg>
  `;
}

function renderKpiInputState() {
  const locked = $("#kpi-input-locked");
  const workspace = $("#kpi-input-workspace");
  if (!locked || !workspace) return;

  const loggedIn = Boolean(state.session?.user);
  locked.classList.toggle("hidden", loggedIn);
  workspace.classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    populateKpiPeriodControls();
    loadKpiRecordIntoForm();
  }
}

function loadKpiRecordIntoForm() {
  const form = $("#kpi-data-form");
  if (!form || !state.session?.user) return;

  const month = Number($("#kpi-filter-month")?.value || state.selectedKpiMonth || 12);
  const year = Number($("#kpi-filter-year")?.value || state.selectedKpiYear || 2025);
  const quarter =
    normalizeKpiQuarter($("#kpi-filter-quarter")?.value, month) || getQuarterFromMonth(month);
  state.selectedKpiMonth = month;
  state.selectedKpiYear = year;
  state.selectedKpiQuarter = quarter;

  const record = getSelectedKpiRecord();
  form.reset();
  renderKpiBreakdownInputs();
  form.elements.id.value = record?.id || "";
  form.elements.triwulan.value = String(quarter);
  form.elements.month.value = String(month);
  form.elements.year.value = String(year);

  const allFields = [
    ...KPI_PERCENT_FIELDS,
    ...KPI_NON_NEGATIVE_FIELDS,
    "notes"
  ];
  allFields.forEach((field) => {
    const input = form.elements.namedItem(field);
    if (!input) return;
    input.value = record?.[field] ?? "";
  });
  setKpiFormValue(form, "kpi_keseluruhan", getKpiOverallValue(record));
  setKpiFormValue(form, "kpi_kse", getKpiKseValue(record));
  setKpiFormValue(form, "pegawai_ls", getKpiIndicatorValue(record, "pegawai_ls", "third_party_employees"));
  KPI_LAGGING_ITEMS.forEach(([, key, fallbackKey]) =>
    setKpiFormValue(form, key, getKpiIndicatorValue(record, key, fallbackKey))
  );
  setKpiBreakdownFormValues(form, record);

  state.editingKpiRecordId = record?.id || null;
  $("#kpi-save-data").textContent = record ? "Update Data" : "Simpan Data";
  setText(
    "#kpi-form-status",
    record
      ? `Memuat data ${KPI_MONTHS[month - 1]} ${year}.`
      : `Belum ada data ${KPI_MONTHS[month - 1]} ${year}.`
  );
  syncKpiCalculatedFields({ resetAutoTotal: true });
}

function handleKpiFormChange(event) {
  if (event.target.name === "triwulan" || event.target.name === "month" || event.target.name === "year") {
    const form = $("#kpi-data-form");
    const month = Number(form.elements.month.value) || 12;
    const quarter =
      event.target.name === "triwulan"
        ? normalizeKpiQuarter(form.elements.triwulan.value, month)
        : getQuarterFromMonth(month);
    state.selectedKpiQuarter = quarter || getQuarterFromMonth(month);
    state.selectedKpiMonth =
      event.target.name === "triwulan" && getQuarterFromMonth(month) !== state.selectedKpiQuarter
        ? KPI_QUARTERS.find((item) => item.value === state.selectedKpiQuarter)?.months[0] || month
        : month;
    state.selectedKpiYear = Number(form.elements.year.value) || 2025;
    $("#kpi-filter-quarter").value = String(state.selectedKpiQuarter);
    $("#kpi-filter-month").value = String(state.selectedKpiMonth);
    form.elements.month.value = String(state.selectedKpiMonth);
    populateKpiPeriodControls();
    $("#kpi-filter-year").value = String(state.selectedKpiYear);
    loadKpiRecordIntoForm();
  }
}

function handleKpiFormInput(event) {
  syncKpiCalculatedFields();
}

function syncKpiCalculatedFields({ resetAutoTotal = false } = {}) {
  const form = $("#kpi-data-form");
  if (!form) return;

  const category = getKpiCategory(kpiInputNumber(form.elements.kpi_keseluruhan));
  $("#kpi-form-kpi-category").value =
    category === null ? "-" : `${category.label} (${category.range})`;

  const employeeTotal = [
    "permanent_employees",
    "temporary_employees",
    "project_employees",
    "pegawai_ls"
  ].reduce((sum, field) => sum + (kpiInputNumber(form.elements[field]) || 0), 0);
  $("#kpi-form-total-employees").value =
    employeeTotal > 0 ? kpiFormatInteger(employeeTotal) : "-";

  const breakdown = buildKpiBreakdownFromForm(form);
  const totals = calculateKpiIndicatorTotals(breakdown);
  KPI_INDICATOR_BREAKDOWN.forEach((indicator) => {
    const totalElement = document.querySelector(
      `[data-kpi-breakdown-total="${indicator.key}"]`
    );
    if (!totalElement) return;
    totalElement.textContent = `Total: ${kpiFormatPercent(totals[indicator.key])}`;
    totalElement.classList.toggle(
      "is-low",
      totals[indicator.key] !== null && totals[indicator.key] < 50
    );
  });
}

async function handleKpiDataSubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;

  const form = event.currentTarget;
  const payload = buildKpiPayload(form);
  const validationError = validateKpiPayload(payload);
  if (validationError) {
    showToast(validationError, true);
    return;
  }

  const existing = getKpiRecord(payload.year, payload.month);
  if (existing) {
    const confirmed = window.confirm(
      `Data ${KPI_MONTHS[payload.month - 1]} ${payload.year} sudah ada. Timpa data lama?`
    );
    if (!confirmed) return;
  }

  setLoading(true, existing ? "Memperbarui data KPI..." : "Menyimpan data KPI...");
  try {
    let result;
    if (existing?.id) {
      result = await db
        .from(DASHBOARD_MONTHLY_TABLE)
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await db
        .from(DASHBOARD_MONTHLY_TABLE)
        .insert(payload)
        .select()
        .single();
    }
    if (result.error) throw result.error;
    await loadKpiDashboardData({ force: true });
    state.selectedKpiQuarter = payload.triwulan;
    state.selectedKpiMonth = payload.month;
    state.selectedKpiYear = payload.year;
    populateKpiPeriodControls();
    renderKpiDashboard();
    loadKpiRecordIntoForm();
    showToast(`Data KPI ${KPI_MONTHS[payload.month - 1]} ${payload.year} berhasil disimpan.`);
  } catch (error) {
    showToast(`Gagal menyimpan data KPI: ${readableError(error)}`, true);
  } finally {
    setLoading(false);
  }
}

function buildKpiPayload(form) {
  const formData = new FormData(form);
  const payload = {
    triwulan: kpiIntegerOrNull(formData.get("triwulan")),
    year: kpiIntegerOrNull(formData.get("year")),
    month: kpiIntegerOrNull(formData.get("month")),
    notes: cleanText(formData.get("notes")),
    updated_by: state.session?.user?.email || null,
    updated_at: new Date().toISOString()
  };

  [...KPI_PERCENT_FIELDS, ...KPI_NON_NEGATIVE_FIELDS].forEach((field) => {
    if (field in payload) return;
    payload[field] = KPI_INTEGER_FIELDS.includes(field)
      ? kpiIntegerOrNull(formData.get(field))
      : kpiNumberOrNull(formData.get(field));
  });

  const breakdown = buildKpiBreakdownFromForm(form);
  const totals = calculateKpiIndicatorTotals(breakdown);
  payload.kpi_indicator_breakdown = hasAnyKpiBreakdownValue(breakdown) ? breakdown : null;
  KPI_INDICATOR_BREAKDOWN.forEach((indicator) => {
    payload[indicator.totalField] = totals[indicator.key];
  });

  const category = getKpiCategory(payload.kpi_keseluruhan);
  payload.kpi_kategori = category?.label || null;

  return payload;
}

function validateKpiPayload(payload) {
  if (!Number.isInteger(payload.month) || payload.month < 1 || payload.month > 12) {
    return "Bulan wajib diisi.";
  }
  if (!Number.isInteger(payload.triwulan) || payload.triwulan < 1 || payload.triwulan > 4) {
    return "Triwulan wajib diisi.";
  }
  if (!Number.isInteger(payload.year) || payload.year < 2020 || payload.year > 2100) {
    return "Tahun wajib diisi dengan nilai yang valid.";
  }
  for (const field of KPI_BOUNDED_PERCENT_FIELDS) {
    const value = payload[field];
    if (value !== null && (value < 0 || value > 100)) {
      return "Nilai persentase harus berada antara 0 dan 100.";
    }
  }
  if (payload.kpi_keseluruhan !== null && payload.kpi_keseluruhan < 0) {
    return "Nilai KPI keseluruhan tidak boleh negatif.";
  }
  for (const field of KPI_NON_NEGATIVE_FIELDS) {
    const value = payload[field];
    if (value !== null && value < 0) {
      return "Data jumlah, pendapatan, jam kerja, dan kejadian tidak boleh negatif.";
    }
  }
  for (const value of listKpiBreakdownValues(payload.kpi_indicator_breakdown)) {
    if (value !== null && value < 0) {
      return "Nilai sub-poin KPI tidak boleh negatif.";
    }
  }
  if (payload.leading_brevet_k3 !== null && payload.leading_brevet_k3 > 7) {
    return "Brevet K3 diisi sebagai capaian dari 7, jadi nilainya maksimal 7.";
  }
  return "";
}

function openKpiInputPage() {
  if (!requireAdmin()) return;
  location.hash = "#kpi-input";
  window.setTimeout(() => loadKpiRecordIntoForm(), 0);
}

function getSelectedKpiRecord() {
  return getKpiRecord(state.selectedKpiYear, state.selectedKpiMonth);
}

function getKpiRecord(year, month) {
  return safeKpiRecords().find(
    (record) => Number(record.year) === Number(year) && Number(record.month) === Number(month)
  );
}

function safeKpiRecords() {
  return Array.isArray(state.kpiRecords) ? state.kpiRecords : [];
}

function getQuarterFromMonth(month) {
  const value = Number(month);
  if (!Number.isInteger(value) || value < 1 || value > 12) return 4;
  return Math.ceil(value / 3);
}

function normalizeKpiQuarter(value, fallbackMonth) {
  const number = Number(value);
  if (Number.isInteger(number) && number >= 1 && number <= 4) return number;
  return getQuarterFromMonth(fallbackMonth || state.selectedKpiMonth || 12);
}

function getKpiOverallValue(record) {
  return kpiNumberOrNull(record?.kpi_keseluruhan) ?? kpiNumberOrNull(record?.kpi_overall_score);
}

function getKpiKseValue(record) {
  return kpiNumberOrNull(record?.kpi_kse) ?? kpiNumberOrNull(record?.k3l_score);
}

function getKpiIndicatorValue(record, key, fallbackKey) {
  return kpiNumberOrNull(record?.[key]) ?? kpiNumberOrNull(record?.[fallbackKey]);
}

function getKpiIndicatorDefinition(indicatorKey) {
  return KPI_INDICATOR_BREAKDOWN.find((indicator) => indicator.key === indicatorKey) || null;
}

function kpiBreakdownInputName(indicatorKey, itemKey) {
  return `kpi_breakdown__${indicatorKey}__${itemKey}`;
}

function getKpiIndicatorBreakdown(record) {
  const raw = record?.kpi_indicator_breakdown;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return typeof raw === "object" ? raw : null;
}

function buildKpiBreakdownFromForm(form) {
  const breakdown = {};
  KPI_INDICATOR_BREAKDOWN.forEach((indicator) => {
    breakdown[indicator.key] = {
      label: indicator.label,
      groups: {}
    };
    indicator.groups.forEach((group) => {
      breakdown[indicator.key].groups[group.name] = group.items.map((item) => {
        const input = form.elements.namedItem(kpiBreakdownInputName(indicator.key, item.key));
        return {
          key: item.key,
          name: item.label,
          value: kpiNumberOrNull(input?.value)
        };
      });
    });
  });
  return breakdown;
}

function setKpiBreakdownFormValues(form, record) {
  renderKpiBreakdownInputs();
  const breakdown = getKpiIndicatorBreakdown(record);
  KPI_INDICATOR_BREAKDOWN.forEach((indicator) => {
    indicator.groups.forEach((group) => {
      group.items.forEach((item) => {
        const input = form.elements.namedItem(kpiBreakdownInputName(indicator.key, item.key));
        if (!input) return;
        const value = getKpiBreakdownItemValue(breakdown, indicator.key, item.key);
        input.value = value ?? "";
      });
    });
  });
}

function getKpiBreakdownItemValue(breakdown, indicatorKey, itemKey) {
  const groups = breakdown?.[indicatorKey]?.groups;
  if (!groups || typeof groups !== "object") return null;
  for (const items of Object.values(groups)) {
    if (!Array.isArray(items)) continue;
    const found = items.find((item) => item?.key === itemKey || item?.name === itemKey);
    if (found) return kpiNumberOrNull(found.value);
  }
  return null;
}

function sumSubIndicators(items) {
  if (!Array.isArray(items)) return null;
  const validValues = items
    .map((item) => kpiNumberOrNull(item?.value))
    .filter((value) => value !== null);
  if (!validValues.length) return null;
  return validValues.reduce((sum, value) => sum + value, 0);
}

function sumKpiIndicatorGroups(indicatorBreakdown) {
  const groups = indicatorBreakdown?.groups;
  if (!groups || typeof groups !== "object") return null;
  const groupTotals = Object.values(groups)
    .map((items) => sumSubIndicators(items))
    .filter((value) => value !== null);
  if (!groupTotals.length) return null;
  return groupTotals.reduce((sum, value) => sum + value, 0);
}

function calculateKpiIndicatorTotals(breakdown) {
  return KPI_INDICATOR_BREAKDOWN.reduce((totals, indicator) => {
    totals[indicator.key] = sumKpiIndicatorGroups(breakdown?.[indicator.key]);
    return totals;
  }, {});
}

function hasKpiIndicatorBreakdownValue(breakdown, indicatorKey) {
  return calculateKpiIndicatorTotals(breakdown)[indicatorKey] !== null;
}

function hasAnyKpiBreakdownValue(breakdown) {
  return Object.values(calculateKpiIndicatorTotals(breakdown)).some((value) => value !== null);
}

function getKpiAspectValue(record, totalField, indicatorKey) {
  const breakdown = getKpiIndicatorBreakdown(record);
  const total = calculateKpiIndicatorTotals(breakdown)[indicatorKey];
  return total ?? kpiNumberOrNull(record?.[totalField]);
}

function listKpiBreakdownValues(breakdown) {
  if (!breakdown || typeof breakdown !== "object") return [];
  return KPI_INDICATOR_BREAKDOWN.flatMap((indicator) =>
    indicator.groups.flatMap((group) =>
      group.items.map((item) =>
        getKpiBreakdownItemValue(breakdown, indicator.key, item.key)
      )
    )
  );
}

function setKpiFormValue(form, field, value) {
  const input = form?.elements?.namedItem(field);
  if (!input) return;
  input.value = value ?? "";
}

function getKpiQuarterTrendValues() {
  return KPI_QUARTERS.map((quarter) => {
    const records = safeKpiRecords()
      .filter((record) => Number(record.year) === Number(state.selectedKpiYear))
      .filter(
        (record) =>
          normalizeKpiQuarter(record.triwulan, record.month) === Number(quarter.value)
      )
      .sort((a, b) => Number(a.month || 0) - Number(b.month || 0));
    const latestRecord = records.at(-1);
    return getKpiOverallValue(latestRecord);
  });
}

function getKpiCategory(value) {
  const score = kpiNumberOrNull(value);
  if (score === null) return null;
  if (score > 106) return { label: "P1", range: ">106%", tone: "is-p1" };
  if (score > 101) return { label: "P2", range: ">101% - 106%", tone: "is-p2" };
  if (score > 95) return { label: "P3", range: ">95% - 101%", tone: "is-p3" };
  if (score > 80) return { label: "P4", range: ">80% - 95%", tone: "is-p4" };
  return { label: "P5", range: "<80%", tone: "is-p5" };
}

function calculateRevenueAchievement(record) {
  const target = kpiNumberOrNull(record?.revenue_target);
  const actual = kpiNumberOrNull(record?.revenue_actual);
  if (target === null || target <= 0 || actual === null) return null;
  return (actual / target) * 100;
}

function getKpiIncidentTotal(record) {
  if (!record) return null;
  const keys = [
    "fatality",
    "medical_treatment",
    "first_aid",
    "environmental_incident",
    "near_miss",
    "unsafe_condition",
    "unsafe_action"
  ];
  const values = keys.map((key) => kpiNumberOrNull(record[key]));
  if (values.every((value) => value === null)) return null;
  return values.reduce((sum, value) => sum + (value || 0), 0);
}

function kpiInputNumber(input) {
  return kpiNumberOrNull(input?.value);
}

function kpiNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function kpiIntegerOrNull(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? null : Math.trunc(number);
}

function kpiHasValue(value) {
  return kpiNumberOrNull(value) !== null;
}

function kpiClampPercent(value) {
  const number = kpiNumberOrNull(value);
  if (number === null) return 0;
  return Math.max(0, Math.min(100, number));
}

function kpiRound(value, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function kpiFormatPercent(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? "-" : `${kpiFormatDecimal(number, number % 1 ? 1 : 0)}%`;
}

function kpiFormatMoneyMillion(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? "-" : `Rp ${kpiFormatDecimal(number, number % 1 ? 1 : 0)} M`;
}

function kpiFormatHours(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? "-" : `${kpiFormatInteger(number)} jam`;
}

function kpiFormatDays(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? "-" : `${kpiFormatDecimal(number, number % 1 ? 1 : 0)} hari`;
}

function kpiFormatIncidents(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? "-" : `${kpiFormatInteger(number)} kejadian`;
}

function kpiFormatPlain(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? "-" : kpiFormatInteger(number);
}

function formatKpiIndicatorValue(key, value) {
  const number = kpiNumberOrNull(value);
  if (number === null) return "-";
  if (key === "leading_brevet_k3") return `${kpiFormatInteger(number)}/7`;
  if (KPI_INDICATOR_PERCENT_FIELDS.has(key)) return kpiFormatPercent(number);
  return kpiFormatPlain(number);
}

function kpiFormatBreakdownValue(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? "-" : kpiFormatDecimal(number, number % 1 ? 1 : 0);
}

function kpiFormatInteger(value) {
  const number = kpiNumberOrNull(value);
  return number === null
    ? "-"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(number);
}

function kpiFormatDecimal(value, decimals = 1) {
  const number = kpiNumberOrNull(value);
  if (number === null) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(number);
}

function kpiFormatCompact(value) {
  const number = kpiNumberOrNull(value);
  if (number === null) return "-";
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: number >= 100 ? 0 : 1
  }).format(number);
}

function setVerticalBar(selector, value) {
  const element = $(selector);
  if (!element) return;
  element.style.removeProperty("width");
  element.style.setProperty("height", `${Math.max(0, Math.min(100, value))}%`);
}

function setText(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text;
}
