import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const workspace = path.resolve(import.meta.dirname, "..");
const toolsDir = path.join(workspace, ".tools");
const edgePath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const serverUrl = "http://127.0.0.1:4173";
const debugPort = 10350 + Math.floor(Math.random() * 200);
const profilePath = path.join(toolsDir, `edge-kpi-${Date.now()}`);

await mkdir(profilePath, { recursive: true });
const server = spawn(
  process.execPath,
  [path.join(toolsDir, "static-server.mjs")],
  { cwd: workspace, stdio: "ignore", windowsHide: true }
);
await new Promise((resolve) => setTimeout(resolve, 1200));

const edge = spawn(
  edgePath,
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-sandbox",
    `--user-data-dir=${profilePath}`,
    `--remote-debugging-port=${debugPort}`,
    "about:blank"
  ],
  { stdio: "ignore", windowsHide: true }
);

async function waitForJson(url, attempts = 60) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error(`Cannot open ${url}`);
}

const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
const page = targets.find((target) => target.type === "page");
if (!page?.webSocketDebuggerUrl) throw new Error("Browser target unavailable.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await once(socket, "open");

let nextId = 1;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) =>
    pending.set(id, { resolve, reject })
  );
}

async function evaluate(expression, waitMs = 0) {
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result.value;
}

async function waitForAppRuntime(attempts = 60) {
  let lastType = "undefined";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastType = await evaluate(`typeof state`);
    if (lastType === "object") return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`App runtime did not become available; typeof state=${lastType}.`);
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    mobile: false
  });
  await send("Page.navigate", { url: `${serverUrl}/#kpi` });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await evaluate(`sessionStorage.setItem("aebt_site_unlocked", "true")`);
  await send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 2800));
  await waitForAppRuntime();

  const result = await evaluate(`(async () => {
    const now = new Date().toISOString();
    const monthlyHours = [7448,7840,7600,6656,7208,7208,9752,8904,9504,9504,9152,8976];
    const seedKpiRecords = () => {
      state.kpiRecords = monthlyHours.map((hours, index) => ({
        id: "seed-" + (index + 1),
        year: 2025,
        month: index + 1,
        triwulan: Math.ceil((index + 1) / 3),
        total_work_hours: hours,
        created_at: now,
        updated_at: now
      }));
      Object.assign(state.kpiRecords[2], { kpi_keseluruhan: 64 });
      Object.assign(state.kpiRecords[5], { kpi_keseluruhan: 73.6 });
      Object.assign(state.kpiRecords[8], { kpi_keseluruhan: 76.9 });
      Object.assign(state.kpiRecords[11], {
        piutang_pad_hari: 45,
        kpi_keseluruhan: 78.5,
        kpi_kategori: "P5",
        kpi_kse: 92,
        ebitda_portfolio: 97.2,
        portfolio_revenue: 529,
        customer_retention: 89,
        economic_social_score: 82,
        business_innovation_score: 70,
        technology_leadership_score: 45,
        investment_score: 74,
        talent_development_score: 61,
        permanent_employees: 33,
        temporary_employees: 7,
        project_employees: 5,
        pegawai_ls: 6,
        lagging_kematian: 0,
        lagging_penanganan_medis: 0,
        lagging_p3k: 0,
        lagging_kejadian_berdampak_lingkungan: 0,
        leading_tinjauan_manajemen: 12,
        leading_hse_talk: 28,
        leading_hse_visit: 18,
        leading_po_terintegrasi_k3l: 24,
        leading_pro_shot: 36,
        leading_tinjauan_ipprk3l: 10,
        leading_promosi_edukasi_k3l: 22,
        leading_pelatihan_safety_leadership: 16,
        leading_brevet_k3: 3,
        leading_hse_orientation: 30,
        leading_jsa: 45,
        leading_mcu: 38
      });
    };
    seedKpiRecords();
    state.kpiLoaded = true;
    state.kpiError = null;
    state.selectedKpiMonth = 12;
    state.selectedKpiYear = 2025;
    renderAll();
    location.hash = "#kpi";
    route();
    await new Promise((resolve) => setTimeout(resolve, 250));
    seedKpiRecords();
    state.kpiLoaded = true;
    state.kpiError = null;
    state.selectedKpiMonth = 12;
    state.selectedKpiYear = 2025;
    state.selectedKpiQuarter = 4;
    renderKpiDashboard();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const dashboard = {
      visible: !document.querySelector("#view-kpi").classList.contains("hidden"),
      activeMenu: document.querySelector(".main-nav a.active")?.textContent.trim(),
      title: document.querySelector(".kpi-dashboard-header h1")?.textContent.trim(),
      exportButton: document.querySelector("#kpi-export-dashboard")?.textContent.trim(),
      labels: Array.from(document.querySelectorAll(".main-nav a")).map((item) => item.textContent.trim()),
      groupHeadings: Array.from(document.querySelectorAll(".kpi-group-heading")).map((item) => item.textContent.trim()),
      panelTitles: Array.from(document.querySelectorAll(".kpi-panel-heading h2")).map((item) => item.textContent.trim()),
      summaryLabels: Array.from(document.querySelectorAll(".kpi-summary-card span")).map((item) => item.textContent.trim()),
      cards: Array.from(document.querySelectorAll(".kpi-summary-card strong")).map((item) => item.textContent.trim()),
      quarterFilter: document.querySelector("#kpi-filter-quarter")?.value,
      aspects: Array.from(document.querySelectorAll(".kpi-aspect-row strong")).map((item) => item.textContent.trim()),
      aspectLabels: Array.from(document.querySelectorAll(".kpi-aspect-row span")).map((item) => item.textContent.trim()),
      lowAspectRows: document.querySelectorAll(".kpi-aspect-row.kpi-aspect-low").length,
      lowAspectColor: getComputedStyle(document.querySelector(".kpi-aspect-row.kpi-aspect-low strong")).color,
      normalAspectColor: getComputedStyle(document.querySelector(".kpi-aspect-row:not(.kpi-aspect-low) strong")).color,
      kpiOverall: document.querySelector("#kpi-overall-value").textContent.trim(),
      kpiOverallSize: Number.parseFloat(getComputedStyle(document.querySelector("#kpi-overall-value")).fontSize),
      kpiCategory: document.querySelector("#kpi-category-label").textContent.trim(),
      kpiCategoryRange: document.querySelector("#kpi-category-range").textContent.trim(),
      employeeTotal: document.querySelector("#kpi-employee-total").textContent.trim(),
      laggingValues: Array.from(document.querySelectorAll("#kpi-lagging-list strong")).map((item) => item.textContent.trim()),
      leadingValues: Array.from(document.querySelectorAll("#kpi-leading-list strong")).map((item) => item.textContent.trim()),
      leadingLabels: Array.from(document.querySelectorAll("#kpi-leading-list span")).map((item) => item.textContent.trim()),
      trendSvg: Boolean(document.querySelector("#kpi-work-hours-chart svg")),
      overallTrendSvg: Boolean(document.querySelector("#kpi-overall-trend-chart svg")),
      overallTrendLabels: Array.from(document.querySelectorAll("#kpi-overall-trend-chart svg > .kpi-points text:not(.kpi-point-label)")).map((item) => item.textContent.trim()),
      bodyKpi: document.body.classList.contains("kpi-active"),
      bodyDashboard: document.body.classList.contains("kpi-dashboard-active"),
      kpiColumnLeft:
        document.querySelector(".kpi-performance-kpi").getBoundingClientRect().left <
        document.querySelector(".kpi-performance-hse").getBoundingClientRect().left,
      employeeInHse: document.querySelector(".kpi-performance-hse .kpi-panel-employees") !== null,
      workTrendMissing: document.querySelector(".kpi-panel-trend") === null,
      employeeBelowIndicators:
        document.querySelector(".kpi-panel-employees").getBoundingClientRect().top >
        document.querySelector(".kpi-hse-grid").getBoundingClientRect().top,
      fitsDesktop:
        document.scrollingElement.scrollHeight <= window.innerHeight + 2 &&
        document.querySelector("#view-kpi").getBoundingClientRect().bottom <= window.innerHeight + 2,
      scrollHeight: document.scrollingElement.scrollHeight,
      viewportHeight: window.innerHeight
    };

    let capturedExport = null;
    window.html2canvas = async (element, options) => {
      const area = element.matches(".export-report")
        ? element
        : element.querySelector(".export-report");
      const rect = area?.getBoundingClientRect();
      const sucofindoLogo = element.querySelector(".export-logo-sucofindo");
      const sucofindoLogoStyle = sucofindoLogo ? getComputedStyle(sucofindoLogo) : null;
      capturedExport = {
        className: area?.className || "",
        title: element.querySelector(".export-brand-block h1")?.textContent.trim(),
        period: element.querySelector(".export-report-meta")?.textContent || "",
        groupHeadings: Array.from(element.querySelectorAll(".export-section > h2")).map((item) => item.textContent.trim()),
        hasSidebar: Boolean(element.querySelector(".app-sidebar")),
        hasToolbar: Boolean(element.querySelector("#kpi-filter-month, #kpi-update-data, #kpi-export-dashboard")),
        hasFooter: Boolean(element.querySelector(".export-report-footer")),
        lowAspects: element.querySelectorAll(".export-aspect-row.is-low").length,
        exportCardTitles: Array.from(element.querySelectorAll(".export-card h3")).map((item) => item.textContent.trim()),
        exportMetricLabels: Array.from(element.querySelectorAll(".export-metric-card span")).map((item) => item.textContent.trim()),
        verticalBars: element.querySelectorAll(".export-revenue-bar").length,
        overallCategory: element.querySelector(".export-category-chip")?.textContent.trim() || "",
        exportLaggingValues: Array.from(element.querySelectorAll(".export-hse-list strong")).map((item) => item.textContent.trim()),
        exportLeadingValues: Array.from(element.querySelectorAll(".export-leading-column strong")).map((item) => item.textContent.trim()),
        laggingRows: element.querySelectorAll(".export-hse-list > div").length,
        leadingColumns: element.querySelectorAll(".export-leading-column").length,
        leadingRows: element.querySelectorAll(".export-leading-column > div").length,
        metricSubtexts: element.querySelectorAll(".export-metric-card small").length,
        hasWorkHoursTrend: Boolean(element.querySelector("[aria-label='Tren jam kerja bulanan']")),
        companyLogoCount: element.querySelectorAll(".export-company-logo").length,
        sucofindoLogoFit: sucofindoLogoStyle?.objectFit,
        sucofindoLogoWidthRule: sucofindoLogoStyle?.width,
        sucofindoLogoHeightRule: sucofindoLogoStyle?.height,
        sucofindoLogoHasFixedAttrs: Boolean(
          sucofindoLogo?.getAttribute("width") || sucofindoLogo?.getAttribute("height")
        ),
        donutSlices: element.querySelectorAll(".export-donut-slice").length,
        donutCenter: element.querySelector(".export-donut-center")?.textContent.trim() || "",
        donutLegend: element.querySelector(".export-legend")?.textContent || "",
        quarterLabels: Array.from(element.querySelectorAll(".export-trend-card .export-chart-points text:not(.export-point-label)")).map((item) => item.textContent.trim()),
        width: Math.round(rect?.width || 0),
        height: Math.round(rect?.height || 0),
        fitsTemplate: area ? area.scrollWidth <= area.clientWidth && area.scrollHeight <= area.clientHeight : false,
        canvasOptions: options
      };
      return {
        width: 3840,
        height: 2160,
        toDataURL: () => "data:image/png;base64,"
      };
    };
    window.jspdf = {
      jsPDF: class {
        constructor() {
          this.internal = {
            pageSize: {
              getWidth: () => 297,
              getHeight: () => 210
            }
          };
          window.__kpiPdfCalls = [];
        }
        addImage(...args) {
          window.__kpiPdfCalls.push({ action: "addImage", args });
        }
        save(name) {
          window.__kpiPdfCalls.push({ action: "save", name });
        }
      }
    };
    document.querySelector("#kpi-export-dashboard").click();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const exportResult = {
      ...capturedExport,
      pdfCalls: window.__kpiPdfCalls,
      hostRemoved: !document.querySelector(".dashboard-export-host")
    };

    state.kpiRecords = [
      {
        id: "2026-05",
        year: 2026,
        month: 5,
        triwulan: 2,
        kpi_keseluruhan: 56,
        kpi_kategori: "P5",
        kpi_kse: 79,
        total_work_hours: 7208,
        created_at: now,
        updated_at: now
      }
    ];
    state.selectedKpiYear = 2026;
    state.selectedKpiMonth = 5;
    state.selectedKpiQuarter = 2;
    renderKpiDashboard();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const sparseTrend = {
      selectedValue: document.querySelector("#kpi-overall-trend-selected")?.textContent.trim(),
      labels: Array.from(document.querySelectorAll("#kpi-overall-trend-chart svg > .kpi-points text:not(.kpi-point-label)")).map((item) => item.textContent.trim()),
      pointLabels: Array.from(document.querySelectorAll("#kpi-overall-trend-chart svg .kpi-point-label")).map((item) => item.textContent.trim()),
      circles: document.querySelectorAll("#kpi-overall-trend-chart svg circle").length,
      lines: document.querySelectorAll("#kpi-overall-trend-chart svg .kpi-line").length,
      note: document.querySelector("#kpi-overall-trend-chart .kpi-chart-note")?.textContent.trim() || "",
      empty: Boolean(document.querySelector("#kpi-overall-trend-chart .kpi-chart-empty"))
    };
    const sparseExportHost = ExportDashboardReport();
    document.body.appendChild(sparseExportHost);
    const sparseExport = {
      quarterLabels: Array.from(sparseExportHost.querySelectorAll(".export-trend-card .export-chart-points text:not(.export-point-label)")).map((item) => item.textContent.trim()),
      pointLabels: Array.from(sparseExportHost.querySelectorAll(".export-trend-card .export-chart-points .export-point-label")).map((item) => item.textContent.trim()),
      lines: sparseExportHost.querySelectorAll(".export-trend-card .export-chart-line").length,
      note: sparseExportHost.querySelector(".export-trend-card .export-chart-note")?.textContent.trim() || ""
    };
    sparseExportHost.remove();

    seedKpiRecords();
    state.kpiLoaded = true;
    state.kpiError = null;
    state.selectedKpiMonth = 12;
    state.selectedKpiYear = 2025;
    state.selectedKpiQuarter = 4;
    renderKpiDashboard();
    await new Promise((resolve) => setTimeout(resolve, 100));

    document.querySelector("#kpi-filter-month").value = "1";
    document.querySelector("#kpi-filter-month").dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    const january = {
      workHours: document.querySelector("#kpi-card-work-hours").textContent.trim(),
      score: document.querySelector("#kpi-card-score").textContent.trim(),
      quarter: document.querySelector("#kpi-filter-quarter").value
    };

    location.hash = "#kpi-input";
    route();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const locked = {
      hash: location.hash,
      adminVisible: !document.querySelector("#view-admin").classList.contains("hidden")
    };

    state.session = { user: { email: "admin@aebt.local" } };
    updateAdminState();
    seedKpiRecords();
    state.kpiLoaded = true;
    state.kpiError = null;
    location.hash = "#kpi-input";
    route();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const form = document.querySelector("#kpi-data-form");
    form.elements.month.value = "12";
    form.elements.year.value = "2025";
    form.elements.month.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    form.elements.kpi_keseluruhan.value = "78.5";
    form.elements.kpi_keseluruhan.dispatchEvent(new Event("input", { bubbles: true }));
    form.elements.total_work_hours.value = "8976";
    form.elements.total_work_hours.dispatchEvent(new Event("input", { bubbles: true }));
    const payload = buildKpiPayload(form);
    const validation = validateKpiPayload(payload);
    const formState = {
      visible: !document.querySelector("#view-kpi-input").classList.contains("hidden"),
      lockedHidden: document.querySelector("#kpi-input-locked").classList.contains("hidden"),
      saveLabel: document.querySelector("#kpi-save-data").textContent.trim(),
      categoryAuto: document.querySelector("#kpi-form-kpi-category").value,
      totalAuto: form.elements.total_work_hours.value,
      payloadQuarter: payload.triwulan,
      payloadMonth: payload.month,
      payloadYear: payload.year,
      payloadKpi: payload.kpi_keseluruhan,
      payloadCategory: payload.kpi_kategori,
      validation,
      dashboardClass: document.body.classList.contains("kpi-dashboard-active"),
      bodyOverflow: getComputedStyle(document.body).overflowY,
      appMainOverflow: getComputedStyle(document.querySelector(".app-main")).overflowY,
      scrollable: document.scrollingElement.scrollHeight > window.innerHeight + 20
    };

    return { dashboard, exportResult, sparseTrend, sparseExport, january, locked, formState };
  })()`);

  await evaluate(`location.hash = "#kpi"; route();`, 250);
  await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
    .then((shot) =>
      writeFile(
        path.join(toolsDir, "kpi-dashboard-smoke.png"),
        Buffer.from(shot.data, "base64")
      )
    );

  console.log(JSON.stringify(result, null, 2));

  if (!result.dashboard.visible || !result.dashboard.bodyKpi || !result.dashboard.bodyDashboard) {
    throw new Error("KPI dashboard did not render as an active route.");
  }
  if (
    result.dashboard.labels.join("|") !==
    "Beranda|Database Regulasi|SOP Center|Data Standar|Service Mapping|Library K3|Dashboard KPI & HSE|Input / Update Data|Admin"
  ) {
    throw new Error("Navigation labels/order changed incorrectly.");
  }
  if (
    result.dashboard.title !== "Dashboard KPI & HSE" ||
    result.dashboard.exportButton !== "Export Dashboard" ||
    result.dashboard.groupHeadings.join("|") !== "KPI Performance|HSE Performance" ||
    !result.dashboard.panelTitles.includes("Capaian KPI per Indikator") ||
    result.dashboard.panelTitles.includes("Capaian KPI per Aspek") ||
    !result.dashboard.summaryLabels.includes("HSE Performance") ||
    result.dashboard.summaryLabels.includes("KPI KSE") ||
    !result.dashboard.kpiColumnLeft ||
    !result.dashboard.employeeInHse ||
    !result.dashboard.workTrendMissing ||
    !result.dashboard.employeeBelowIndicators
  ) {
    throw new Error("KPI/HSE split layout did not render as requested.");
  }
  if (
    result.dashboard.cards.join("|") !==
    "45 hari|Rp 97,2 M|Rp 529 M|89%|8.976 jam|92%"
  ) {
    throw new Error("KPI summary cards did not render expected December data.");
  }
  const expectedLowAspectCount = result.dashboard.aspects.filter((value) => {
    const numericValue = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(numericValue) && numericValue < 50;
  }).length;

  if (
    result.dashboard.quarterFilter !== "4" ||
    !result.dashboard.aspects.includes("82%") ||
    !result.dashboard.aspects.includes("45%") ||
    result.dashboard.aspectLabels.includes("HSE") ||
    result.dashboard.aspectLabels.length !== 5 ||
    result.dashboard.lowAspectRows !== expectedLowAspectCount ||
    expectedLowAspectCount < 1 ||
    !result.dashboard.lowAspectColor.includes("220") ||
    result.dashboard.lowAspectColor === result.dashboard.normalAspectColor ||
    result.dashboard.kpiOverall !== "78,5%" ||
    result.dashboard.kpiOverallSize < 36 ||
    result.dashboard.kpiCategory !== "Kategori: P5" ||
    result.dashboard.kpiCategoryRange !== "P5 (<80%)" ||
    result.dashboard.employeeTotal !== "51" ||
    result.dashboard.laggingValues.join("|") !== "0|0%|0%|0%" ||
    result.dashboard.leadingLabels.length !== 12 ||
    !result.dashboard.leadingValues.includes("24%") ||
    !result.dashboard.leadingValues.includes("3/7") ||
    !result.dashboard.leadingValues.includes("45%") ||
    result.dashboard.leadingValues[0] !== "12" ||
    result.dashboard.leadingValues[1] !== "28" ||
    result.dashboard.leadingValues[6] !== "22" ||
    result.dashboard.trendSvg ||
    !result.dashboard.overallTrendSvg ||
    result.dashboard.overallTrendLabels.join("|") !== "I|II|III|IV"
  ) {
    throw new Error("KPI charts or calculated values are incorrect.");
  }
  if (
    result.exportResult.title !== "Dashboard KPI & HSE" ||
    !result.exportResult.className.includes("export-report") ||
    result.exportResult.groupHeadings.join("|") !== "KPI Performance|HSE Performance" ||
    result.exportResult.hasSidebar ||
    result.exportResult.hasToolbar ||
    result.exportResult.hasFooter ||
    result.exportResult.lowAspects !== expectedLowAspectCount ||
    !result.exportResult.exportCardTitles.includes("Capaian KPI per Indikator") ||
    result.exportResult.exportCardTitles.includes("Capaian KPI per Aspek") ||
    !result.exportResult.exportMetricLabels.includes("HSE Performance") ||
    result.exportResult.exportMetricLabels.includes("KPI KSE") ||
    result.exportResult.verticalBars !== 0 ||
    result.exportResult.overallCategory !== "P5 (<80%)" ||
    result.exportResult.exportLaggingValues.join("|") !== "0|0%|0%|0%" ||
    !result.exportResult.exportLeadingValues.includes("24%") ||
    !result.exportResult.exportLeadingValues.includes("3/7") ||
    !result.exportResult.exportLeadingValues.includes("45%") ||
    result.exportResult.exportLeadingValues[0] !== "12" ||
    result.exportResult.exportLeadingValues[1] !== "28" ||
    result.exportResult.exportLeadingValues[6] !== "22" ||
    result.exportResult.laggingRows !== 4 ||
    result.exportResult.leadingColumns !== 2 ||
    result.exportResult.leadingRows !== 12 ||
    result.exportResult.metricSubtexts !== 0 ||
    result.exportResult.hasWorkHoursTrend ||
    result.exportResult.companyLogoCount !== 3 ||
    result.exportResult.sucofindoLogoFit !== "contain" ||
    result.exportResult.sucofindoLogoHasFixedAttrs ||
    result.exportResult.donutSlices !== 4 ||
    !result.exportResult.donutCenter.includes("51") ||
    !result.exportResult.donutLegend.includes("LS") ||
    result.exportResult.quarterLabels.join("|") !== "I|II|III|IV" ||
    result.exportResult.width !== 1920 ||
    result.exportResult.height !== 1080 ||
    !result.exportResult.fitsTemplate ||
    result.exportResult.canvasOptions.scale < 2 ||
    result.exportResult.pdfCalls.at(-1)?.name !== "Dashboard-KPI-HSE-Desember-2025.pdf" ||
    !result.exportResult.hostRemoved
  ) {
    throw new Error("KPI dashboard export did not use the clean report template.");
  }
  if (
    result.sparseTrend.selectedValue !== "56%" ||
    result.sparseTrend.labels.join("|") !== "I|II|III|IV" ||
    result.sparseTrend.pointLabels.join("|") !== "56%" ||
    result.sparseTrend.circles !== 1 ||
    result.sparseTrend.lines !== 0 ||
    result.sparseTrend.note !== "Belum cukup data untuk menampilkan tren." ||
    result.sparseTrend.empty
  ) {
    throw new Error("Sparse yearly KPI trend is still using fallback/dummy data.");
  }
  if (
    result.sparseExport.quarterLabels.join("|") !== "I|II|III|IV" ||
    result.sparseExport.pointLabels.join("|") !== "56%" ||
    result.sparseExport.lines !== 0 ||
    result.sparseExport.note !== "Belum cukup data untuk menampilkan tren."
  ) {
    throw new Error("Sparse export KPI trend is still using fallback/dummy data.");
  }
  if (!result.dashboard.fitsDesktop) {
    throw new Error(
      `KPI dashboard still overflows desktop viewport (${result.dashboard.scrollHeight}/${result.dashboard.viewportHeight}).`
    );
  }
  if (result.january.workHours !== "7.448 jam" || result.january.score !== "-") {
    throw new Error("Monthly filter did not switch to January data safely.");
  }
  if (result.january.quarter !== "1") {
    throw new Error("Quarter filter did not sync with the selected month.");
  }
  if (result.locked.hash !== "#admin" || !result.locked.adminVisible) {
    throw new Error("Input / Update Data was not guarded for public viewers.");
  }
  if (
    !result.formState.visible ||
    !result.formState.lockedHidden ||
    result.formState.saveLabel !== "Update Data" ||
    result.formState.categoryAuto !== "P5 (<80%)" ||
    result.formState.totalAuto !== "8976" ||
    result.formState.payloadQuarter !== 4 ||
    result.formState.payloadMonth !== 12 ||
    result.formState.payloadYear !== 2025 ||
    result.formState.payloadKpi !== 78.5 ||
    result.formState.payloadCategory !== "P5" ||
    result.formState.dashboardClass ||
    result.formState.bodyOverflow === "hidden" ||
    result.formState.appMainOverflow === "hidden" ||
    !result.formState.scrollable ||
    result.formState.validation
  ) {
    throw new Error("KPI input form failed to load, calculate, or validate.");
  }
} finally {
  socket.close();
  edge.kill();
  server.kill();
}
