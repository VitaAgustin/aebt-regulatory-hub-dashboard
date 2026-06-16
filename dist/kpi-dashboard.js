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

const KPI_PERCENT_FIELDS = [
  "kpi_overall_score",
  "customer_retention",
  "economic_social_score",
  "business_innovation_score",
  "technology_leadership_score",
  "investment_score",
  "talent_development_score",
  "k3l_score"
];

const KPI_NON_NEGATIVE_FIELDS = [
  "ebitda_portfolio",
  "portfolio_revenue",
  "revenue_target",
  "revenue_actual",
  "permanent_employees",
  "temporary_employees",
  "project_employees",
  "third_party_employees",
  "permanent_work_hours",
  "temporary_work_hours",
  "project_work_hours",
  "third_party_work_hours",
  "overtime_hours",
  "total_work_hours",
  "lost_work_hours",
  "fatality",
  "medical_treatment",
  "first_aid",
  "environmental_incident",
  "near_miss",
  "unsafe_condition",
  "unsafe_action",
  "frequency_rate",
  "severity_rate"
];

const KPI_INTEGER_FIELDS = [
  "year",
  "month",
  "permanent_employees",
  "temporary_employees",
  "project_employees",
  "third_party_employees",
  "fatality",
  "medical_treatment",
  "first_aid",
  "environmental_incident",
  "near_miss",
  "unsafe_condition",
  "unsafe_action"
];

const KPI_ASPECTS = [
  ["Ekonomi dan Sosial", "economic_social_score"],
  ["Inovasi Model Bisnis", "business_innovation_score"],
  ["Kepemimpinan Teknologi", "technology_leadership_score"],
  ["Peningkatan Investasi", "investment_score"],
  ["Pengembangan Talenta", "talent_development_score"],
  ["K3L", "k3l_score"]
];

const KPI_K3L_ITEMS = [
  ["Fatality", "fatality"],
  ["Medical Treatment", "medical_treatment"],
  ["First Aid", "first_aid"],
  ["Near Miss", "near_miss"],
  ["Kondisi Tidak Aman", "unsafe_condition"],
  ["Jam Hilang / LTI", "lost_work_hours"]
];

const KPI_EMPLOYEE_ITEMS = [
  ["Pegawai Tetap", "permanent_employees", "#008b8b"],
  ["Pegawai Tidak Tetap", "temporary_employees", "#f97316"],
  ["PTT Proyek / Non-NPP", "project_employees", "#1d9bf0"],
  ["Tenaga Kerja Pihak Ketiga", "third_party_employees", "#cbd5e1"]
];

function bindKpiDashboardEvents() {
  populateKpiPeriodControls();

  $("#kpi-filter-month")?.addEventListener("change", handleKpiPeriodChange);
  $("#kpi-filter-year")?.addEventListener("change", handleKpiPeriodChange);
  $("#kpi-update-data")?.addEventListener("click", openKpiInputPage);
  $("#kpi-data-form")?.addEventListener("submit", handleKpiDataSubmit);
  $("#kpi-data-form")?.addEventListener("input", handleKpiFormInput);
  $("#kpi-data-form")?.addEventListener("change", handleKpiFormChange);
  $("#kpi-cancel-edit")?.addEventListener("click", () =>
    loadKpiRecordIntoForm()
  );
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
        `Dashboard KPI & K3L belum siap: ${readableError(error)}`
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

function populateKpiMonthSelect(select, selectedMonth) {
  if (!select) return;
  const currentValue = Number(select.value || selectedMonth || 12);
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

function handleKpiPeriodChange() {
  const month = Number($("#kpi-filter-month")?.value);
  const year = Number($("#kpi-filter-year")?.value);
  if (month >= 1 && month <= 12) state.selectedKpiMonth = month;
  if (year >= 2020 && year <= 2100) state.selectedKpiYear = year;
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
      ? "Dashboard belum tersedia. Jalankan supabase-dashboard-kpi-k3l.sql di Supabase SQL Editor."
      : "";
  }

  setText("#kpi-card-score", kpiFormatPercent(record?.kpi_overall_score));
  setText("#kpi-card-ebitda", kpiFormatMoneyMillion(record?.ebitda_portfolio));
  setText("#kpi-card-revenue", kpiFormatMoneyMillion(record?.portfolio_revenue));
  setText("#kpi-card-retention", kpiFormatPercent(record?.customer_retention));
  setText("#kpi-card-work-hours", kpiFormatHours(record?.total_work_hours));
  setText("#kpi-card-incidents", kpiFormatIncidents(getKpiIncidentTotal(record)));

  setText(
    "#kpi-revenue-period",
    `${KPI_MONTHS[state.selectedKpiMonth - 1]} ${state.selectedKpiYear}`
  );
  const revenueAchievement = calculateRevenueAchievement(record);
  setText("#kpi-revenue-achievement", kpiFormatPercent(revenueAchievement));
  setText("#kpi-revenue-target", kpiFormatMoneyMillion(record?.revenue_target));
  setText("#kpi-revenue-actual", kpiFormatMoneyMillion(record?.revenue_actual));
  setText("#kpi-target-label", kpiFormatCompact(record?.revenue_target));
  setText("#kpi-actual-label", kpiFormatCompact(record?.revenue_actual));

  const targetWidth = kpiHasValue(record?.revenue_target) ? 100 : 0;
  const actualWidth = kpiClampPercent(revenueAchievement);
  $("#kpi-target-bar")?.style.setProperty("width", `${targetWidth}%`);
  $("#kpi-actual-bar")?.style.setProperty("width", `${actualWidth}%`);

  renderKpiAspectBars(record);
  renderKpiSummary(record);
  renderKpiEmployeeDonut(record);
  renderKpiWorkHoursTrend();
}

function renderKpiAspectBars(record) {
  const container = $("#kpi-aspect-bars");
  if (!container) return;

  container.innerHTML = KPI_ASPECTS.map(([label, key]) => {
    const value = kpiNumberOrNull(record?.[key]);
    const width = value === null ? 0 : kpiClampPercent(value);
    return `
      <div class="kpi-aspect-row">
        <span>${escapeHtml(label)}</span>
        <div class="kpi-track"><i style="width:${width}%"></i></div>
        <strong>${kpiFormatPercent(value)}</strong>
      </div>
    `;
  }).join("");
}

function renderKpiSummary(record) {
  const container = $("#kpi-k3l-list");
  if (!container) return;
  container.innerHTML = KPI_K3L_ITEMS.map(
    ([label, key]) => `
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${kpiFormatPlain(record?.[key])}</strong>
      </div>
    `
  ).join("");
  setText("#kpi-frequency-rate", kpiFormatDecimal(record?.frequency_rate, 2));
  setText("#kpi-severity-rate", kpiFormatDecimal(record?.severity_rate, 2));
}

function renderKpiEmployeeDonut(record) {
  const donut = $("#kpi-employee-donut");
  const legend = $("#kpi-employee-legend");
  if (!donut || !legend) return;

  const values = KPI_EMPLOYEE_ITEMS.map(([, key, color]) => ({
    key,
    color,
    value: kpiNumberOrNull(record?.[key])
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

  legend.innerHTML = KPI_EMPLOYEE_ITEMS.map(([label, key, color]) => `
    <div>
      <i style="background:${color}"></i>
      <span>${escapeHtml(label)}</span>
      <strong>${kpiFormatInteger(record?.[key])}</strong>
    </div>
  `).join("");
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
  state.selectedKpiMonth = month;
  state.selectedKpiYear = year;

  const record = getSelectedKpiRecord();
  form.reset();
  form.elements.id.value = record?.id || "";
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
  if (event.target.name === "month" || event.target.name === "year") {
    const form = $("#kpi-data-form");
    state.selectedKpiMonth = Number(form.elements.month.value) || 12;
    state.selectedKpiYear = Number(form.elements.year.value) || 2025;
    $("#kpi-filter-month").value = String(state.selectedKpiMonth);
    populateKpiPeriodControls();
    $("#kpi-filter-year").value = String(state.selectedKpiYear);
    loadKpiRecordIntoForm();
  }
}

function handleKpiFormInput(event) {
  if (event.target.name === "total_work_hours") {
    event.target.dataset.autoTotal = "false";
  }
  syncKpiCalculatedFields();
}

function syncKpiCalculatedFields({ resetAutoTotal = false } = {}) {
  const form = $("#kpi-data-form");
  if (!form) return;

  const target = kpiInputNumber(form.elements.revenue_target);
  const actual = kpiInputNumber(form.elements.revenue_actual);
  const achievement = target > 0 && actual !== null ? (actual / target) * 100 : null;
  $("#kpi-form-revenue-achievement").value =
    achievement === null ? "-" : `${kpiFormatDecimal(achievement, 1)}%`;

  const employeeTotal = [
    "permanent_employees",
    "temporary_employees",
    "project_employees",
    "third_party_employees"
  ].reduce((sum, field) => sum + (kpiInputNumber(form.elements[field]) || 0), 0);
  $("#kpi-form-total-employees").value =
    employeeTotal > 0 ? kpiFormatInteger(employeeTotal) : "-";

  const workHourFields = [
    "permanent_work_hours",
    "temporary_work_hours",
    "project_work_hours",
    "third_party_work_hours",
    "overtime_hours"
  ];
  const componentTotal = workHourFields.reduce(
    (sum, field) => sum + (kpiInputNumber(form.elements[field]) || 0),
    0
  );
  const totalInput = form.elements.total_work_hours;
  if (resetAutoTotal) {
    totalInput.dataset.autoTotal = totalInput.value ? "false" : "true";
  }
  if (componentTotal > 0 && totalInput.dataset.autoTotal !== "false") {
    totalInput.value = kpiRound(componentTotal, 2);
    totalInput.dataset.autoTotal = "true";
  }
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

  if (payload.total_work_hours === null) {
    const componentTotal = [
      "permanent_work_hours",
      "temporary_work_hours",
      "project_work_hours",
      "third_party_work_hours",
      "overtime_hours"
    ].reduce((sum, field) => sum + (payload[field] || 0), 0);
    payload.total_work_hours = componentTotal > 0 ? componentTotal : null;
  }

  return payload;
}

function validateKpiPayload(payload) {
  if (!Number.isInteger(payload.month) || payload.month < 1 || payload.month > 12) {
    return "Bulan wajib diisi.";
  }
  if (!Number.isInteger(payload.year) || payload.year < 2020 || payload.year > 2100) {
    return "Tahun wajib diisi dengan nilai yang valid.";
  }
  for (const field of KPI_PERCENT_FIELDS) {
    const value = payload[field];
    if (value !== null && (value < 0 || value > 100)) {
      return "Nilai persentase harus berada antara 0 dan 100.";
    }
  }
  for (const field of KPI_NON_NEGATIVE_FIELDS) {
    const value = payload[field];
    if (value !== null && value < 0) {
      return "Data jumlah, pendapatan, jam kerja, dan kejadian tidak boleh negatif.";
    }
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

function kpiFormatIncidents(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? "-" : `${kpiFormatInteger(number)} kejadian`;
}

function kpiFormatPlain(value) {
  const number = kpiNumberOrNull(value);
  return number === null ? "-" : kpiFormatInteger(number);
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

function setText(selector, text) {
  const element = $(selector);
  if (element) element.textContent = text;
}
