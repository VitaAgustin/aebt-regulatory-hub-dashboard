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
        total_work_hours: hours,
        created_at: now,
        updated_at: now
      }));
      Object.assign(state.kpiRecords[11], {
        kpi_overall_score: 78.5,
        ebitda_portfolio: 97.2,
        portfolio_revenue: 529,
        customer_retention: 89,
        revenue_target: 550,
        revenue_actual: 529,
        economic_social_score: 82,
        business_innovation_score: 70,
        technology_leadership_score: 68,
        investment_score: 74,
        talent_development_score: 61,
        k3l_score: 100,
        permanent_employees: 33,
        temporary_employees: 7,
        project_employees: 5,
        third_party_employees: 6,
        lost_work_hours: 0,
        fatality: 0,
        medical_treatment: 0,
        first_aid: 0,
        environmental_incident: 0,
        near_miss: 0,
        unsafe_condition: 0,
        unsafe_action: 0,
        frequency_rate: 0,
        severity_rate: 0
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

    const dashboard = {
      visible: !document.querySelector("#view-kpi").classList.contains("hidden"),
      activeMenu: document.querySelector(".main-nav a.active")?.textContent.trim(),
      labels: Array.from(document.querySelectorAll(".main-nav a")).map((item) => item.textContent.trim()),
      cards: Array.from(document.querySelectorAll(".kpi-summary-card strong")).map((item) => item.textContent.trim()),
      aspects: Array.from(document.querySelectorAll(".kpi-aspect-row strong")).map((item) => item.textContent.trim()),
      revenueAchievement: document.querySelector("#kpi-revenue-achievement").textContent.trim(),
      employeeTotal: document.querySelector("#kpi-employee-total").textContent.trim(),
      k3lValues: Array.from(document.querySelectorAll(".kpi-k3l-list strong")).map((item) => item.textContent.trim()),
      trendSvg: Boolean(document.querySelector("#kpi-work-hours-chart svg")),
      selectedTrendTotal: document.querySelector("#kpi-trend-selected-total").textContent.trim(),
      bodyKpi: document.body.classList.contains("kpi-active"),
      fitsDesktop:
        document.scrollingElement.scrollHeight <= window.innerHeight + 2 &&
        document.querySelector("#view-kpi").getBoundingClientRect().bottom <= window.innerHeight + 2,
      scrollHeight: document.scrollingElement.scrollHeight,
      viewportHeight: window.innerHeight
    };

    document.querySelector("#kpi-filter-month").value = "1";
    document.querySelector("#kpi-filter-month").dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    const january = {
      workHours: document.querySelector("#kpi-card-work-hours").textContent.trim(),
      score: document.querySelector("#kpi-card-score").textContent.trim()
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
    form.elements.revenue_target.value = "600";
    form.elements.revenue_actual.value = "540";
    form.elements.revenue_actual.dispatchEvent(new Event("input", { bubbles: true }));
    form.elements.permanent_work_hours.value = "100";
    form.elements.temporary_work_hours.value = "50";
    form.elements.permanent_work_hours.dispatchEvent(new Event("input", { bubbles: true }));
    form.elements.temporary_work_hours.dispatchEvent(new Event("input", { bubbles: true }));
    const payload = buildKpiPayload(form);
    const validation = validateKpiPayload(payload);
    const formState = {
      visible: !document.querySelector("#view-kpi-input").classList.contains("hidden"),
      lockedHidden: document.querySelector("#kpi-input-locked").classList.contains("hidden"),
      saveLabel: document.querySelector("#kpi-save-data").textContent.trim(),
      revenueAuto: document.querySelector("#kpi-form-revenue-achievement").value,
      totalAuto: form.elements.total_work_hours.value,
      payloadMonth: payload.month,
      payloadYear: payload.year,
      payloadTarget: payload.revenue_target,
      validation
    };

    return { dashboard, january, locked, formState };
  })()`);

  await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
    .then((shot) =>
      writeFile(
        path.join(toolsDir, "kpi-dashboard-smoke.png"),
        Buffer.from(shot.data, "base64")
      )
    );

  console.log(JSON.stringify(result, null, 2));

  if (!result.dashboard.visible || !result.dashboard.bodyKpi) {
    throw new Error("KPI dashboard did not render as an active route.");
  }
  if (
    result.dashboard.labels.join("|") !==
    "Beranda|Database Regulasi|SOP Center|Data Standar|Service Mapping|Library K3|Dashboard KPI & K3L|Input / Update Data|Admin"
  ) {
    throw new Error("Navigation labels/order changed incorrectly.");
  }
  if (
    result.dashboard.cards.join("|") !==
    "78,5%|Rp 97,2 M|Rp 529 M|89%|8.976 jam|0 kejadian"
  ) {
    throw new Error("KPI summary cards did not render expected December data.");
  }
  if (
    !result.dashboard.aspects.includes("82%") ||
    result.dashboard.revenueAchievement !== "96,2%" ||
    result.dashboard.employeeTotal !== "51" ||
    !result.dashboard.trendSvg ||
    result.dashboard.selectedTrendTotal !== "Total: 8.976 jam"
  ) {
    throw new Error("KPI charts or calculated values are incorrect.");
  }
  if (!result.dashboard.fitsDesktop) {
    throw new Error(
      `KPI dashboard still overflows desktop viewport (${result.dashboard.scrollHeight}/${result.dashboard.viewportHeight}).`
    );
  }
  if (result.january.workHours !== "7.448 jam" || result.january.score !== "-") {
    throw new Error("Monthly filter did not switch to January data safely.");
  }
  if (result.locked.hash !== "#admin" || !result.locked.adminVisible) {
    throw new Error("Input / Update Data was not guarded for public viewers.");
  }
  if (
    !result.formState.visible ||
    !result.formState.lockedHidden ||
    result.formState.saveLabel !== "Update Data" ||
    result.formState.revenueAuto !== "90,0%" ||
    result.formState.totalAuto !== "8976" ||
    result.formState.payloadMonth !== 12 ||
    result.formState.payloadYear !== 2025 ||
    result.formState.payloadTarget !== 600 ||
    result.formState.validation
  ) {
    throw new Error("KPI input form failed to load, calculate, or validate.");
  }
} finally {
  socket.close();
  edge.kill();
  server.kill();
}
