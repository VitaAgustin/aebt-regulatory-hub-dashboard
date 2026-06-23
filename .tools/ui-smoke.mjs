import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const workspace = path.resolve(import.meta.dirname, "..");
const toolsDir = path.join(workspace, ".tools");
const edgePath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const serverUrl = "http://127.0.0.1:4173";
const debugPort = 9337 + Math.floor(Math.random() * 200);
const profilePath = path.join(toolsDir, `edge-smoke-${Date.now()}`);

await mkdir(profilePath, { recursive: true });

const server = spawn(process.execPath, [path.join(toolsDir, "static-server.mjs")], {
  cwd: workspace,
  stdio: "ignore",
  windowsHide: true
});

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
    `${serverUrl}/#home`
  ],
  { stdio: "ignore", windowsHide: true }
);

async function waitForJson(url, attempts = 40) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error(`Unable to read ${url}`);
}

const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
const page = targets.find((target) => target.type === "page");
if (!page?.webSocketDebuggerUrl) throw new Error("No Edge page target found.");

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
  const id = nextId;
  nextId += 1;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression, waitMs = 0) {
  if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed.");
  }
  return result.result.value;
}

async function navigate(hash, waitMs = 5000) {
  await send("Page.navigate", { url: `${serverUrl}/${hash}` });
  await evaluate("document.readyState", waitMs);
}

async function captureScreenshot(fileName) {
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true
  });
  await writeFile(path.join(toolsDir, fileName), Buffer.from(data, "base64"));
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await evaluate(
    `sessionStorage.setItem("aebt_site_unlocked", "true")`,
    500
  );
  await send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 1200));

  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });
  await navigate("#home", 7000);
  await evaluate(`(async () => {
    await Promise.allSettled(
      [
        state.documentsPromise,
        state.serviceCatalogPromise,
        state.portfolioCatalogPromise
      ].filter(Boolean)
    );
    state.serviceCategories = SERVICE_CATALOG_FALLBACK.map((category, index) => ({
      id: "seed-" + index,
      name: category.category,
      description: "",
      is_active: true
    })).concat([
      {
        id: "service-env",
        name: "Environmental Services",
        description: "Smoke service category",
        is_active: true
      },
      {
        id: "service-off",
        name: "Inactive Custom",
        description: "",
        is_active: false
      }
    ]);
    state.serviceItems = SERVICE_CATALOG_FALLBACK.flatMap((category, categoryIndex) =>
      category.services.map((service, serviceIndex) => ({
        id: "item-" + categoryIndex + "-" + serviceIndex,
        category_id: "seed-" + categoryIndex,
        name: service,
        description: "",
        is_active: true
      }))
    ).concat([
      {
        id: "item-env-1",
        category_id: "service-env",
        name: "Air Emission Review",
        description: "",
        is_active: true
      },
      {
        id: "item-env-2",
        category_id: "service-env",
        name: "Water Quality Audit",
        description: "",
        is_active: true
      },
      {
        id: "item-off-1",
        category_id: "service-off",
        name: "Hidden Service",
        description: "",
        is_active: false
      }
    ]);
    state.serviceCatalogLoaded = true;
    state.serviceCatalogError = null;
    state.portfolioCategories = [
      {
        id: "portfolio-ebt",
        code: "EBT 041",
        name: "Energi Baru dan Terbarukan",
        description: "",
        is_active: true
      },
      {
        id: "portfolio-iappm",
        code: "IAPPM 042",
        name: "Industri, Aset, Peralatan, Permesinan, dan Migas",
        description: "",
        is_active: true
      }
    ];
    state.portfolioItems = [
      ["portfolio-ebt", "AEB - 1A", "Sampling dan Analisa di Bidang EBT"],
      ["portfolio-ebt", "AEB - 1B", "Verifikasi dan Inspeksi Peralatan dan Instalasi di Bidang EBT"],
      ["portfolio-ebt", "AEB - 1C", "Konsultasi di Bidang EBT"],
      ["portfolio-iappm", "AEB - 2A", "Inspeksi Peralatan dan Instalasi Industri Minyak dan Gas Bumi"],
      ["portfolio-iappm", "AEB - 2B", "Konsultasi Kehandalan dan Keamanan Peralatan Migas"],
      ["portfolio-iappm", "AEB - 2C", "QA/QC untuk Fasilitas Industri, Pertambangan, dan Pembangkit Listrik"],
      ["portfolio-iappm", "AEB - 2D", "Verifikasi dan Pemeriksaan Mesin Saat Beroperasi"],
      ["portfolio-iappm", "AEB - 2E", "Verifikasi dan Inspeksi Peralatan Industri Migas"],
      ["portfolio-iappm", "AEB - 2F", "Non-Destructive Test"]
    ].map(([category_id, code, name], index) => ({
      id: "portfolio-item-" + index,
      category_id,
      code,
      name,
      description: "",
      is_active: true
    }));
    state.portfolioCatalogLoaded = true;
    state.portfolioCatalogError = null;
    const libraryDocs = [
      {
        id: "library-regulation",
        document_type: "regulasi",
        title: "Smoke Regulation Library",
        regulation_number: "REG-SMOKE",
        year: 2026,
        category: "AEB-2A - Inspeksi Peralatan dan Instalasi Industri Migas",
        status: "Berlaku",
        related_services: "",
        related_portfolios: "",
        file_path: "",
        file_name: "",
        updated_at: new Date().toISOString()
      },
      {
        id: "library-sop",
        document_type: "sop",
        title: "Smoke SOP Library",
        regulation_number: "SOP-SMOKE",
        year: 2026,
        category: "AEB-2F - Non-Destructive Test",
        status: "Berlaku",
        related_services: "",
        related_portfolios: "IAPPM 042 - AEB - 2F",
        file_path: "",
        file_name: "",
        updated_at: new Date().toISOString()
      },
      {
        id: "library-standard",
        document_type: "standar",
        title: "Smoke Standard Library",
        regulation_number: "STD-SMOKE",
        year: 2026,
        category:
          "AEB-1B - Verifikasi dan Inspeksi Peralatan dan Instalasi di bidang EBT",
        status: "Berlaku",
        related_services: "",
        related_portfolios: "EBT 041 - AEB - 1B",
        file_path: "",
        file_name: "",
        file_source: "none",
        external_file_url: "",
        updated_at: new Date().toISOString()
      },
      {
        id: "library-external",
        document_type: "regulasi",
        title: "Smoke External Link",
        regulation_number: "EXT-SMOKE",
        year: 2026,
        category: "AEB-1C - Konsultasi di bidang EBT",
        status: "Berlaku",
        related_services: "",
        related_portfolios: "",
        file_path: "",
        file_name: "",
        file_source: "external",
        external_file_url: "https://drive.google.com/file/d/smoke/view",
        updated_at: new Date().toISOString()
      }
    ];
    state.documents = [
      ...libraryDocs,
      ...state.documents.filter((doc) => !doc.id?.startsWith("library-"))
    ];
    state.documentsLoaded = true;
    renderAll();
    renderServiceCheckboxes();
    renderPortfolioCheckboxes();
  })()`);
  const home = await evaluate(`(() => ({
    total: document.querySelector("#metric-total")?.textContent,
    regulations: document.querySelector("#metric-regulations")?.textContent,
    sops: document.querySelector("#metric-sops")?.textContent,
    standards: document.querySelector("#metric-standards")?.textContent,
    services: document.querySelector("#metric-services")?.textContent,
    forbiddenText: /Prioritas tinggi|Priority score|Relevansi SBU/.test(document.body.textContent),
    navLabels: Array.from(document.querySelectorAll(".main-nav a")).map((link) => link.textContent.trim()),
    sidebarVisible: document.querySelector("#app-sidebar")?.getBoundingClientRect().left === 0,
    heroFits: document.querySelector(".home-hero")?.scrollWidth <= document.querySelector(".home-hero")?.clientWidth,
    overviewColumns: getComputedStyle(document.querySelector(".home-overview")).gridTemplateColumns.split(" ").length,
    overviewMetricsLeft:
      document.querySelector(".home-summary-column").getBoundingClientRect().left <
      document.querySelector(".home-hero").getBoundingClientRect().left,
    metricCardCount: document.querySelectorAll(".home-summary-column .metric-card").length,
    posterHeight: Math.round(document.querySelector(".poster-slider-track")?.getBoundingClientRect().height || 0),
    posterRightWidth: Math.round(document.querySelector(".home-hero")?.getBoundingClientRect().width || 0),
    bodyFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth
  }))()`);
  await captureScreenshot("home-desktop.png");

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true
  });
  await navigate("#home", 1200);
  const mobile = await evaluate(`(() => {
    const sidebar = document.querySelector("#app-sidebar")?.getBoundingClientRect();
    const hero = document.querySelector(".home-hero");
    const overview = document.querySelector(".home-overview");
    const heroRect = hero?.getBoundingClientRect();
    const metricsRect = document.querySelector(".home-summary-column")?.getBoundingClientRect();
    return {
      sidebarOffCanvas: sidebar ? sidebar.right <= 0 : false,
      toggleVisible: getComputedStyle(document.querySelector("#sidebar-toggle")).display !== "none",
      heroFits: hero ? hero.scrollWidth <= hero.clientWidth : false,
      overviewSingleColumn: getComputedStyle(overview).gridTemplateColumns.split(" ").length === 1,
      posterBeforeMetrics: heroRect && metricsRect ? heroRect.top <= metricsRect.top : false,
      bodyFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth
    };
  })()`);
  await captureScreenshot("home-mobile.png");

  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });

  await navigate("#documents", 1200);
  await captureScreenshot("documents-desktop.png");
  const documents = await evaluate(`(async () => {
    const input = document.querySelector("#filter-search");
    const originalCount = document.querySelector("#documents-count")?.textContent;
    const visibleTypes = Array.from(document.querySelectorAll("#documents-body [data-detail-id]"))
      .map((button) => state.documents.find((doc) => doc.id === button.dataset.detailId)?.document_type);
    const filterType = document.querySelector("#filter-type")?.value;
    const filterDisabled = document.querySelector("#filter-type")?.disabled;
    input.value = "zzzz-no-match";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const emptyCount = document.querySelector("#documents-count")?.textContent;
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("#document-filters").reset();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return {
      originalCount,
      emptyCount,
      restoredCount: document.querySelector("#documents-count")?.textContent,
      hasCategoryFilter: Boolean(document.querySelector("#filter-category")),
      visibleTypes,
      filterTypeAfterReset: document.querySelector("#filter-type")?.value,
      filterDisabled
    };
  })()`);

  await navigate("#sop", 1200);
  const sop = await evaluate(`(() => ({
    title: document.querySelector("#documents-title")?.textContent,
    filterType: document.querySelector("#filter-type")?.value,
    filterDisabled: document.querySelector("#filter-type")?.disabled,
    count: document.querySelector("#documents-count")?.textContent,
    hasCategoryFilter: Boolean(document.querySelector("#filter-category")),
    visibleTypes: Array.from(document.querySelectorAll("#documents-body [data-detail-id]"))
      .map((button) => state.documents.find((doc) => doc.id === button.dataset.detailId)?.document_type)
  }))()`);

  await navigate("#standar", 1200);
  await captureScreenshot("standards-desktop.png");
  const standards = await evaluate(`(() => ({
    title: document.querySelector("#documents-title")?.textContent,
    eyebrow: document.querySelector("#documents-eyebrow")?.textContent,
    description: document.querySelector("#documents-description")?.textContent,
    filterType: document.querySelector("#filter-type")?.value,
    filterDisabled: document.querySelector("#filter-type")?.disabled,
    count: document.querySelector("#documents-count")?.textContent,
    foldersReady: !state.standardFoldersError,
    folderCards: document.querySelectorAll("#standard-folder-grid [data-standard-folder-id]").length,
    hasCategoryFilter: Boolean(document.querySelector("#filter-category")),
    visibleTypes: Array.from(document.querySelectorAll("#standard-folder-documents [data-detail-id]"))
      .map((button) => state.documents.find((doc) => doc.id === button.dataset.detailId)?.document_type)
  }))()`);

  await navigate("#document/library-external", 1200);
  await captureScreenshot("detail-external-desktop.png");
  const externalFile = await evaluate(`(() => ({
    source: getDocumentFileSource(state.documents.find((doc) => doc.id === "library-external")),
    requestVisible: Boolean(document.querySelector("[data-request-download]")),
    directActions: Boolean(document.querySelector("[data-direct-download], [data-open-external]")),
    downloadLabel: document.querySelector("[data-direct-download], [data-open-external]")?.textContent.trim() || "",
    panelText: document.querySelector("#document-detail")?.textContent || "",
    hasFrame: Boolean(document.querySelector(".large-preview-frame")),
    frameSrc: document.querySelector(".large-preview-frame")?.src || "",
    errorToast: Boolean(document.querySelector(".toast.error"))
  }))()`);

  await navigate("#document/library-standard", 1200);
  await captureScreenshot("detail-no-file-desktop.png");
  const noFile = await evaluate(`(() => ({
    source: getDocumentFileSource(state.documents.find((doc) => doc.id === "library-standard")),
    requestVisible: Boolean(document.querySelector("[data-request-download]")),
    directActions: Boolean(document.querySelector("[data-direct-download], [data-open-external]")),
    panelText: document.querySelector("#document-detail")?.textContent || "",
    hasFrame: Boolean(document.querySelector(".large-preview-frame")),
    errorToast: Boolean(document.querySelector(".toast.error"))
  }))()`);

  await navigate("#admin", 1200);
  await captureScreenshot("admin-desktop.png");
  const adminForm = await evaluate(`(() => {
    setSelectedServices("AIM - Risk Based Inspection, Renewable Energy Services - Geothermal Plant Services, Environmental Services - Air Emission Review, Legacy Service");
    setSelectedPortfolios("EBT 041 - AEB - 1B, IAPPM 042 - AEB - 2F, Legacy Portfolio");
    const removedFieldNames = [
      "category",
      "sub_category",
      "key_obligation",
      "impacted_party",
      "service_opportunity",
      "compliance_risk",
      "action_point"
    ];
    const originalSession = state.session;
    state.session = { user: { email: "admin@aebt.local" } };
    const typeSelect = document.querySelector('#document-form [name="document_type"]');
    typeSelect.value = "standar";
    const formElement = document.querySelector("#document-form");
    formElement.elements.file_source.value = "none";
    syncFileSourceFields();
    const noFilePayload = buildDocumentPayload(
      new FormData(document.querySelector("#document-form"))
    );
    const fileIsOptional = !formElement.elements.file.required;
    const noFileFieldsHidden =
      document.querySelector("#supabase-file-fields")?.classList.contains("hidden") &&
      document.querySelector("#external-file-fields")?.classList.contains("hidden");
    formElement.elements.file_source.value = "external";
    formElement.elements.external_file_url.value =
      "https://drive.google.com/file/d/smoke/view";
    syncFileSourceFields();
    const externalPayload = buildDocumentPayload(new FormData(formElement));
    const externalFieldsVisible =
      !document.querySelector("#external-file-fields")?.classList.contains("hidden");
    const validExternal = validExternalUrl(externalPayload.external_file_url);
    const invalidExternal = validExternalUrl("javascript:alert(1)");
    formElement.elements.file_source.value = "supabase";
    syncFileSourceFields();
    const supabaseFieldsVisible =
      !document.querySelector("#supabase-file-fields")?.classList.contains("hidden");
    const checkedCount = document.querySelectorAll(
      "#related-services-selector input[type=checkbox]:checked"
    ).length;
    const hiddenValue = document.querySelector(
      'input[name="related_services"]'
    )?.value;
    const portfolioCheckedCount = document.querySelectorAll(
      "#related-portfolios-selector input[type=checkbox]:checked"
    ).length;
    const portfolioHiddenValue = document.querySelector(
      'input[name="related_portfolios"]'
    )?.value;
    const portfolioSummary = document.querySelector(
      "#related-portfolios-summary"
    )?.textContent;
    const portfolioPayload = noFilePayload.related_portfolios;
    const selectionSummary = document.querySelector(
      "#related-services-summary"
    )?.textContent;
    startEdit("library-standard");
    const editLoadedType = typeSelect.value;
    const editPortfolioChecked = document.querySelectorAll(
      "#related-portfolios-selector input[type=checkbox]:checked"
    ).length;
    typeSelect.value = "sop";
    const editChangedType = buildDocumentPayload(
      new FormData(document.querySelector("#document-form"))
    ).document_type;
    resetEditor();
    state.session = originalSession;
    return {
      checkboxCount: document.querySelectorAll("#related-services-selector input[type=checkbox]").length,
      checkedCount,
      hiddenValue,
      summary: selectionSummary,
      portfolioCheckboxCount: document.querySelectorAll("#related-portfolios-selector input[type=checkbox]").length,
      portfolioCheckedCount,
      portfolioHiddenValue,
      portfolioSummary,
      portfolioPayload,
      editPortfolioChecked,
      catalogManagerCount: document.querySelectorAll("#service-catalog-list .custom-service-card").length,
      categoryOptionCount: document.querySelectorAll("#service-item-category option:not([value=''])").length,
      removedFieldsVisible: removedFieldNames.some((name) =>
        document.querySelector('#document-form [name="' + name + '"]')
      ),
      removedPayloadKeys: removedFieldNames.filter((name) =>
        Object.prototype.hasOwnProperty.call(noFilePayload, name)
      ),
      typeOptions: Array.from(typeSelect.options).map((option) => option.value),
      payloadType: noFilePayload.document_type,
      editLoadedType,
      editChangedType,
      fileIsOptional,
      noFileFieldsHidden,
      noFileSource: noFilePayload.file_source,
      externalSource: externalPayload.file_source,
      externalUrl: externalPayload.external_file_url,
      externalFieldsVisible,
      supabaseFieldsVisible,
      validExternal,
      invalidExternal,
      legacySupabaseSource: getDocumentFileSource({
        file_path: "regulasi/legacy/document.pdf",
        file_name: "document.pdf"
      }),
      legacyNoneSource: getDocumentFileSource({
        file_path: "",
        file_name: ""
      })
    };
  })()`);
  await evaluate(`(() => {
    state.session = { user: { email: "admin@aebt.local" } };
    updateAdminState();
    window.scrollTo({ top: 0, behavior: "auto" });
  })()`);
  await captureScreenshot("admin-workspace-desktop.png");
  await evaluate(`(() => {
    state.session = null;
    updateAdminState();
  })()`);

  await navigate("#services", 1200);
  await captureScreenshot("services-desktop.png");
  const services = await evaluate(`(async () => {
    const sampleDocs = [
      {
        id: "smoke-regulation-aim",
        document_type: "regulasi",
        title: "Smoke Regulation AIM",
        regulation_number: "SMOKE-AIM",
        year: 2026,
        category: "Smoke",
        status: "Berlaku",
        related_services: "Environmental Services - Air Emission Review",
        file_source: "external",
        external_file_url: "https://drive.google.com/file/d/service-smoke/view",
        file_path: "",
        file_name: "",
        updated_at: new Date().toISOString()
      },
      {
        id: "smoke-sop-aim",
        document_type: "sop",
        title: "Smoke SOP AIM",
        regulation_number: "SMOKE-SOP",
        year: 2026,
        category: "Smoke",
        status: "Berlaku",
        related_services: "Environmental Services - Air Emission Review",
        file_path: "",
        file_name: "",
        updated_at: new Date().toISOString()
      },
      {
        id: "smoke-standard-aim",
        document_type: "standar",
        title: "Smoke Standard AIM",
        regulation_number: "SMOKE-STD",
        year: 2026,
        category: "Smoke",
        status: "Berlaku",
        related_services: "Environmental Services - Air Emission Review",
        file_path: "",
        file_name: "",
        updated_at: new Date().toISOString()
      }
    ];
    state.documents = [
      ...sampleDocs,
      ...state.documents.filter((doc) => !doc.id?.startsWith("smoke-"))
    ];
    state.documentsLoaded = true;
    renderAll();
    const cards = Array.from(document.querySelectorAll(".service-card[data-service-category]"));
    const activeCard = cards.find((card) =>
      card.querySelector("strong")?.textContent.trim() === "Environmental Services"
    );
    activeCard?.querySelector(".button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 600));
    window.scrollTo({ top: 0, behavior: "auto" });
    const subServices = Array.from(document.querySelectorAll("#service-documents-panel [data-sub-service]"));
    const activeSubService = subServices.find((button) => !/^0 dokumen/.test(button.querySelector("span")?.textContent || ""));
    activeSubService?.click();
    await new Promise((resolve) => setTimeout(resolve, 600));
    window.scrollTo({ top: 0, behavior: "auto" });
    const detailButton = document.querySelector("#service-documents-panel [data-detail-id]");
    detailButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return {
      cards: cards.length,
      categoryLabels: cards.map((item) => item.querySelector("strong")?.textContent.trim()),
      subServiceCount: subServices.length,
      panelRows: document.querySelectorAll("#service-documents-panel tbody tr").length,
      typeBadges: Array.from(document.querySelectorAll("#service-documents-panel tbody .badge"))
        .map((badge) => badge.textContent.trim()),
      detailHash: location.hash,
      pdfReady: Boolean(document.querySelector(".large-preview-frame")) ||
        /File belum tersedia/.test(document.querySelector("#document-detail")?.textContent || ""),
      requestVisible: Boolean(document.querySelector("[data-request-download]")),
      directActions: Boolean(document.querySelector("[data-direct-download], [data-open-external]")),
      downloadLabel: document.querySelector("[data-direct-download], [data-open-external]")?.textContent.trim() || "",
      errorToast: Boolean(document.querySelector(".toast.error"))
    };
  })()`);
  await captureScreenshot("detail-desktop.png");

  await navigate("#services", 1200);
  const portfolioMapping = await evaluate(`(async () => {
    document.querySelector('[data-mapping-tab="portfolios"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const tabs = Array.from(document.querySelectorAll(".mapping-tab")).map((tab) => ({
      label: tab.textContent.trim(),
      active: tab.classList.contains("active")
    }));
    const cards = Array.from(document.querySelectorAll(
      "#portfolio-mapping-grid [data-portfolio-category-id].portfolio-card"
    ));
    const ebtCard = cards.find((card) =>
      card.querySelector(".portfolio-code")?.textContent.trim() === "EBT 041"
    );
    ebtCard?.querySelector(".button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const items = Array.from(document.querySelectorAll(
      "#portfolio-documents-panel [data-portfolio-item-code]"
    ));
    const targetItem = items.find((item) =>
      item.querySelector(".portfolio-item-code")?.textContent.trim() === "AEB - 1B"
    );
    targetItem?.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    return {
      tabs,
      serviceViewHidden: document.querySelector("#service-mapping-view")?.classList.contains("hidden"),
      portfolioViewVisible: !document.querySelector("#portfolio-mapping-view")?.classList.contains("hidden"),
      cardCount: cards.length,
      cardCodes: cards.map((card) => card.querySelector(".portfolio-code")?.textContent.trim()),
      itemCount: items.length,
      itemCodes: items.map((item) => item.querySelector(".portfolio-item-code")?.textContent.trim()),
      documentRows: document.querySelectorAll("#portfolio-item-documents tbody tr").length,
      documentTitles: Array.from(document.querySelectorAll("#portfolio-item-documents .document-title"))
        .map((item) => item.textContent.trim()),
      typeBadges: Array.from(document.querySelectorAll("#portfolio-item-documents tbody .badge"))
        .map((badge) => badge.textContent.trim())
    };
  })()`);
  await captureScreenshot("portfolios-desktop.png");
  const portfolioDetail = await evaluate(`(async () => {
    document.querySelector("#portfolio-item-documents [data-detail-id]")?.click();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      detailHash: location.hash,
      portfolioText: document.querySelector("#document-detail")?.textContent || "",
      fileReady: Boolean(document.querySelector(".large-preview-frame")) ||
        /File belum tersedia|Preview tidak tersedia/.test(
          document.querySelector("#document-detail")?.textContent || ""
        ),
      errorToast: Boolean(document.querySelector(".toast.error"))
    };
  })()`);
  const portfolio = { ...portfolioMapping, ...portfolioDetail };
  const livePdf = await evaluate(`(async () => {
    const fileDocument = state.documents.find((doc) => validStoragePath(doc.file_path));
    if (!fileDocument) return { hasFile: false, frame: false, request: false, directActions: false, documentType: null, errorToast: false };
    location.hash = "#document/" + encodeURIComponent(fileDocument.id);
    await new Promise((resolve) => setTimeout(resolve, 6000));
    return {
      hasFile: true,
      documentType: fileDocument.document_type,
      frame: Boolean(document.querySelector(".large-preview-frame")),
      request: Boolean(document.querySelector("[data-request-download]")),
      directActions: Boolean(document.querySelector("[data-direct-download], [data-open-external]")),
      errorToast: Boolean(document.querySelector(".toast.error"))
    };
  })()`);

  const result = {
    home,
    mobile,
    documents,
    sop,
    standards,
    externalFile,
    noFile,
    adminForm,
    services,
    portfolio,
    livePdf
  };
  console.log(JSON.stringify(result, null, 2));

  if (home.forbiddenText) throw new Error("Removed priority/SBU text is still visible.");
  if (!home.sidebarVisible || !home.heroFits || !home.bodyFits) {
    throw new Error("Desktop dashboard layout overflowed or sidebar was not visible.");
  }
  if (
    home.overviewColumns !== 2 ||
    !home.overviewMetricsLeft ||
    home.metricCardCount !== 6 ||
    home.posterHeight < 500 ||
    home.posterRightWidth <= 500
  ) {
    throw new Error("Home overview is not using the requested split poster layout.");
  }
  if (
    home.navLabels.join("|") !==
    "Beranda|Database Regulasi|SOP Center|Data Standar|Service Mapping|Library K3|Dashboard KPI & K3L|Input / Update Data|Admin"
  ) {
    throw new Error("Sidebar menu does not include the expected Library navigation.");
  }
  if (
    !mobile.sidebarOffCanvas ||
    !mobile.toggleVisible ||
    !mobile.heroFits ||
    !mobile.overviewSingleColumn ||
    !mobile.posterBeforeMetrics ||
    !mobile.bodyFits
  ) {
    throw new Error("Mobile dashboard layout overflowed or responsive navigation failed.");
  }
  if (Number(home.total) < 1) throw new Error("Home document total did not load.");
  if (Number(home.regulations) < 1 || Number(home.sops) < 1 || Number(home.standards) < 1) {
    throw new Error("Home document-type metrics did not include all three libraries.");
  }
  if (home.services !== "9") throw new Error("Custom service metric did not load.");
  if (!/0 dokumen/.test(documents.emptyCount)) throw new Error("Search empty state failed.");
  if (documents.originalCount !== documents.restoredCount) {
    throw new Error("Search reset did not restore document count.");
  }
  if (documents.hasCategoryFilter) {
    throw new Error("Database Regulasi still renders the category filter.");
  }
  if (
    documents.filterTypeAfterReset !== "regulasi" ||
    !documents.filterDisabled ||
    documents.visibleTypes.some((type) => type !== "regulasi")
  ) {
    throw new Error("Database Regulasi is not locked to regulasi.");
  }
  if (
    sop.title !== "SOP Center" ||
    sop.filterType !== "sop" ||
    !sop.filterDisabled ||
    sop.hasCategoryFilter ||
    sop.visibleTypes.some((type) => type !== "sop")
  ) {
    throw new Error("SOP Center filter is not locked to sop.");
  }
  if (
    standards.title !== "Data Standar" ||
    standards.eyebrow !== "STANDARD LIBRARY" ||
    standards.filterType !== "standar" ||
    !standards.filterDisabled ||
    standards.hasCategoryFilter ||
    standards.visibleTypes.some((type) => type !== "standar") ||
    !standards.description.includes("Kumpulan standar")
  ) {
    throw new Error("Data Standar route or filter is not configured correctly.");
  }
  if (
    externalFile.source !== "external" ||
    externalFile.requestVisible ||
    !externalFile.directActions ||
    externalFile.downloadLabel !== "Download" ||
    !externalFile.hasFrame ||
    !externalFile.frameSrc.includes("/preview") ||
    externalFile.errorToast
  ) {
    throw new Error("External file detail did not render safely.");
  }
  if (
    noFile.source !== "none" ||
    noFile.requestVisible ||
    noFile.directActions ||
    !noFile.panelText.includes("File belum tersedia") ||
    noFile.hasFrame ||
    noFile.errorToast
  ) {
    throw new Error("No-file detail state did not render safely.");
  }
  if (adminForm.checkboxCount !== 47 || adminForm.checkedCount !== 3) {
    throw new Error("Admin service checklist did not render or preselect services.");
  }
  if (!adminForm.hiddenValue.includes("Environmental Services - Air Emission Review") || !adminForm.hiddenValue.includes("Legacy Service")) {
    throw new Error("Admin related_services hidden field did not sync selected services.");
  }
  if (
    adminForm.portfolioCheckboxCount !== 9 ||
    adminForm.portfolioCheckedCount !== 2 ||
    !adminForm.portfolioHiddenValue.includes("EBT 041 - AEB - 1B") ||
    !adminForm.portfolioHiddenValue.includes("IAPPM 042 - AEB - 2F") ||
    !adminForm.portfolioHiddenValue.includes("Legacy Portfolio") ||
    adminForm.portfolioPayload !== adminForm.portfolioHiddenValue ||
    adminForm.editPortfolioChecked !== 1 ||
    !adminForm.portfolioSummary.includes("2 portofolio dipilih")
  ) {
    throw new Error("Admin related_portfolios checklist did not sync or reload correctly.");
  }
  if (adminForm.catalogManagerCount !== 10 || adminForm.categoryOptionCount !== 9) {
    throw new Error("Admin service catalog manager or category dropdown did not render.");
  }
  if (adminForm.removedFieldsVisible || adminForm.removedPayloadKeys.length) {
    throw new Error("Removed admin fields are still visible or included in the payload.");
  }
  if (
    !adminForm.typeOptions.includes("standar") ||
    adminForm.payloadType !== "standar" ||
    adminForm.editLoadedType !== "standar" ||
    adminForm.editChangedType !== "sop"
  ) {
    throw new Error("Admin document type does not support creating or editing standards.");
  }
  if (
    !adminForm.fileIsOptional ||
    !adminForm.noFileFieldsHidden ||
    adminForm.noFileSource !== "none" ||
    adminForm.externalSource !== "external" ||
    !adminForm.externalFieldsVisible ||
    !adminForm.supabaseFieldsVisible ||
    !adminForm.validExternal?.startsWith("https://drive.google.com/") ||
    adminForm.invalidExternal !== null ||
    adminForm.legacySupabaseSource !== "supabase" ||
    adminForm.legacyNoneSource !== "none"
  ) {
    throw new Error("Admin file source selection or legacy inference failed.");
  }
  if (services.cards !== 9 || !services.categoryLabels.includes("Environmental Services") || !services.categoryLabels.includes("Renewable Energy Services")) {
    throw new Error("Service Mapping did not render catalog categories.");
  }
  if (services.subServiceCount < 1) {
    throw new Error("Service Mapping did not render sub-service choices.");
  }
  if (services.panelRows < 3) {
    throw new Error("Service Mapping did not render documents for a sub-service.");
  }
  if (!services.typeBadges.includes("Standar")) {
    throw new Error("Service Mapping did not render the standard document badge.");
  }
  if (!services.detailHash.startsWith("#document/")) {
    throw new Error("Service Mapping detail button did not open document detail.");
  }
  if (!services.pdfReady || services.requestVisible || !services.directActions || services.downloadLabel !== "Download") {
    throw new Error("Service Mapping regulation direct-download access is not ready.");
  }
  if (livePdf.hasFile) {
    const restrictedLivePdf = ["sop", "standar"].includes(String(livePdf.documentType || "").toLowerCase());
    if (
      livePdf.errorToast ||
      (restrictedLivePdf && (!livePdf.request || livePdf.directActions)) ||
      (!restrictedLivePdf && (livePdf.request || !livePdf.directActions))
    ) {
      throw new Error("Live Supabase PDF file access action failed.");
    }
  }
  if (services.errorToast) throw new Error("UI rendered an error toast.");
  if (
    portfolio.tabs.map((tab) => tab.label).join("|") !==
      "Layanan SBU|Portofolio SBU" ||
    !portfolio.tabs.find((tab) => tab.label === "Portofolio SBU")?.active ||
    !portfolio.serviceViewHidden ||
    !portfolio.portfolioViewVisible ||
    portfolio.cardCount !== 2 ||
    !portfolio.cardCodes.includes("EBT 041") ||
    !portfolio.cardCodes.includes("IAPPM 042") ||
    portfolio.itemCount !== 3 ||
    !portfolio.itemCodes.includes("AEB - 1B") ||
    portfolio.documentRows < 1 ||
    !portfolio.documentTitles.includes("Smoke Standard Library") ||
    !portfolio.typeBadges.includes("Standar") ||
    !portfolio.detailHash.startsWith("#document/") ||
    !portfolio.portfolioText.includes("EBT 041 - AEB - 1B") ||
    !portfolio.fileReady ||
    portfolio.errorToast
  ) {
    throw new Error("Portofolio SBU mapping or document detail flow failed.");
  }
} finally {
  socket.close();
  edge.kill();
  server.kill();
}
