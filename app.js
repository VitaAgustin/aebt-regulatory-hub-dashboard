"use strict";

// Public frontend configuration only. Never place a service-role key here.
const SUPABASE_URL = "https://pbfzjtipyqtsamgqemvx.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_X8aX5wtGRpYOCEaOtok1Ug_77MQdP9K";
const STORAGE_BUCKET = "regulatory-files";
const DOCUMENT_CACHE_KEY = "aebt-documents-v1";
const SERVICE_CATEGORY_TABLE = "service_categories";
const SERVICE_ITEM_TABLE = "service_items";
const PORTFOLIO_CATEGORY_TABLE = "portfolio_categories";
const PORTFOLIO_ITEM_TABLE = "portfolio_items";
const SUPABASE_CLIENT_CDN =
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.107.0/dist/umd/supabase.min.js";
const SUPABASE_CLIENT_URL = SUPABASE_URL.trim()
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/+$/, "");

const configured =
  SUPABASE_CLIENT_URL.startsWith("https://") &&
  !SUPABASE_CLIENT_URL.includes("YOUR_PROJECT") &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

const SERVICE_CATALOG_FALLBACK = [
  {
    category: "Asset Integrity Management (AIM)",
    services: [
      "Risk Based Inspection",
      "Risk Management Services",
      "Risk Survey",
      "Risk Valuation",
      "Technical Due Diligence",
      "Third Party Liability (TPL)",
      "Risk Assessment",
      "Asset Hierarchy",
      "Pipeline Integrity Services",
      "Tank Integrity Services",
      "Robotic Inspection Services"
    ]
  },
  {
    category: "Drilling Support Services",
    services: ["Oil Country Tubular Goods (OCTG)", "Rig Assessment"]
  },
  {
    category: "QA/QC, Inspection and Certification",
    services: [
      "Safety Device",
      "Pressure Vessel",
      "Storage Tank",
      "Rotating Equipment",
      "Electrical Equipment",
      "Lifting Equipment",
      "Metering System Pipeline",
      "Installation of Geothermal Fluid Field",
      "Installation of Migas Facility",
      "Installation of Rig Drilling & Cementing Unit"
    ]
  },
  {
    category: "Professional Services",
    services: ["Technical Manpower Supply"]
  },
  {
    category: "Non Destructive Test (NDT)",
    services: [
      "Magnetic Particle Test",
      "Ultrasonic Test",
      "Penetrant Test",
      "Radiographic Examination"
    ]
  },
  {
    category: "Advanced NDT",
    services: [
      "Phased Array Ultrasonic Testing (PAUT)",
      "Long Range Ultrasonic Testing (LRUT)",
      "Real Time Radiography (RTR)",
      "Pulse Eddy Current (PEC)",
      "Magnetic Flux Leakage (MFL)",
      "Computerize RT (CR)",
      "IRIS, RFT and ECT",
      "Intelligent Pigging",
      "Automatic Ultrasonic Testing (AUT)"
    ]
  },
  {
    category: "Consultancy",
    services: [
      "Quality Management Services (QMS)",
      "Quantity Survey",
      "Project Management Consultancy (PMC)",
      "Permit Handling Management"
    ]
  },
  {
    category: "Renewable Energy Services",
    services: [
      "Geothermal Plant Services",
      "Nuclear Power Plant Services",
      "Hydrogen Infrastructure",
      "Gas Testing for Coal Methane"
    ]
  }
];

let db = null;

const state = {
  documents: [],
  documentsLoaded: false,
  documentsError: null,
  serviceCategories: [],
  serviceItems: [],
  serviceCatalogLoaded: false,
  serviceCatalogError: null,
  portfolioCategories: [],
  portfolioItems: [],
  portfolioCatalogLoaded: false,
  portfolioCatalogError: null,
  session: null,
  editingId: null,
  pendingEditId: null,
  detailRenderToken: 0,
  selectedServiceCategory: null,
  selectedSubServiceName: null,
  activeMappingTab: "services",
  selectedPortfolioCategoryId: null,
  selectedPortfolioItemCode: null,
  legacyRelatedServices: [],
  legacyRelatedPortfolios: [],
  signedUrls: new Map(),
  documentsPromise: null,
  serviceCatalogPromise: null,
  portfolioCatalogPromise: null,
  supabasePromise: null
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  bindEvents();
  syncFileSourceFields();
  renderServiceCheckboxes();
  renderPortfolioCheckboxes();
  if (!location.hash) {
    const legacyRoute = routeFromPathname();
    history.replaceState(null, "", `/#${legacyRoute || "home"}`);
  }

  const hasCachedDocuments = hydrateDocumentCache();
  if (!hasCachedDocuments) renderDocumentLoadingState();
  route();

  if (!configured) {
    $("#config-alert").classList.remove("hidden");
    renderEmptyApplication();
    return;
  }

  state.supabasePromise = loadSupabaseClient();
  const documentsPromise = loadDocuments({ preserveExisting: hasCachedDocuments });
  const serviceCatalogPromise = state.supabasePromise.then(() =>
    loadServiceCatalog()
  );
  const portfolioCatalogPromise = state.supabasePromise.then(() =>
    loadPortfolioCatalog()
  );
  const authPromise = state.supabasePromise.then(initializeAuth);
  const [authResult, documentsResult] = await Promise.allSettled([
    authPromise,
    documentsPromise,
    serviceCatalogPromise,
    portfolioCatalogPromise
  ]);

  if (authResult.status === "rejected") {
    showToast(
      `Session admin tidak dapat diperiksa: ${readableError(authResult.reason)}`,
      true
    );
  }
  if (documentsResult.status === "rejected") {
    showToast(readableError(documentsResult.reason), true);
  }

  route();
}

async function loadSupabaseClient() {
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SUPABASE_CLIENT_CDN;
      script.async = true;
      script.onload = resolve;
      script.onerror = () =>
        reject(new Error("Library Supabase tidak dapat dimuat dari CDN."));
      document.head.append(script);
    });
  }

  db = window.supabase.createClient(SUPABASE_CLIENT_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return db;
}

async function initializeAuth() {
  db.auth.onAuthStateChange((_event, nextSession) => {
    state.session = nextSession;
    updateAdminState();
    if (nextSession) loadAdminLogs();
    if (db) {
      loadServiceCatalog({ force: true }).catch(() => {});
      loadPortfolioCatalog({ force: true }).catch(() => {});
    }
  });

  try {
    const {
      data: { session },
      error
    } = await db.auth.getSession();
    if (error) {
      showToast(`Session admin tidak dapat diperiksa: ${readableError(error)}`, true);
    }

    state.session = session;
    updateAdminState();
  } catch (error) {
    throw error;
  }
}

function routeFromPathname() {
  const path = decodeURIComponent(location.pathname)
    .replace(/\/+$/, "")
    .toLowerCase();

  if (!path) return "home";
  if (path === "/documents") return "documents";
  if (path === "/sop") return "sop";
  if (path === "/standar" || path === "/standards") return "standar";
  if (path === "/services" || path === "/service-mapping") return "services";
  if (path === "/admin" || path === "/admin/upload") return "admin";

  const documentMatch = location.pathname.match(/^\/documents\/([^/]+)\/?$/i);
  return documentMatch ? `document/${encodeURIComponent(documentMatch[1])}` : null;
}

function bindEvents() {
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1080) setSidebarOpen(false);
  });

  $("#sidebar-toggle").addEventListener("click", () => {
    setSidebarOpen(!document.body.classList.contains("sidebar-open"));
  });
  $("#sidebar-backdrop").addEventListener("click", () => setSidebarOpen(false));

  $("#document-filters").addEventListener("input", renderDocumentTable);
  $("#document-filters").addEventListener("change", renderDocumentTable);
  $("#document-filters").addEventListener("reset", () => {
    window.setTimeout(() => {
      const routeName = location.hash.replace(/^#/, "").split("/")[0];
      if (getDocumentLibraryType(routeName)) configureDocumentLibrary(routeName);
      renderDocumentTable();
    }, 0);
  });

  $("#admin-login-form").addEventListener("submit", handleLogin);
  $("#admin-logout").addEventListener("click", handleLogout);
  $("#document-form").addEventListener("submit", handleDocumentSubmit);
  $("#document-form").addEventListener("change", handleDocumentFormChange);
  $("#cancel-edit").addEventListener("click", resetEditor);
  $("#service-category-form").addEventListener("submit", handleServiceCategorySubmit);
  $("#service-item-form").addEventListener("submit", handleServiceItemSubmit);
  $("#related-services-selector").addEventListener(
    "change",
    syncSelectedServicesSummary
  );
  $("#related-portfolios-selector").addEventListener(
    "change",
    syncSelectedPortfoliosSummary
  );

  $("#documents-body").addEventListener("click", handleTableAction);
  $("#recent-documents-body").addEventListener("click", handleTableAction);
  $("#document-detail").addEventListener("click", handleDetailAction);
  $("#service-mapping-grid").addEventListener("click", handleServiceCardAction);
  $("#service-documents-panel").addEventListener("click", handleServiceDocumentAction);
  $(".mapping-tabs").addEventListener("click", handleMappingTabAction);
  $("#portfolio-mapping-grid").addEventListener(
    "click",
    handlePortfolioCardAction
  );
  $("#portfolio-documents-panel").addEventListener(
    "click",
    handlePortfolioDocumentAction
  );
  $("#admin-documents-body").addEventListener("click", handleAdminTableAction);
  $("#service-catalog-list").addEventListener("click", handleServiceCatalogAction);
}

function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
  $("#sidebar-toggle")?.setAttribute("aria-expanded", String(open));
  $("#sidebar-backdrop")?.classList.toggle("hidden", !open);
}

async function loadDocuments({ preserveExisting = state.documents.length > 0 } = {}) {
  if (state.documentsPromise) return state.documentsPromise;

  state.documentsPromise = (async () => {
    try {
      const data = await fetchDocumentsFromRest();

      state.documents = Array.isArray(data) ? data : [];
      state.documentsLoaded = true;
      state.documentsError = null;
      writeDocumentCache(state.documents);
      renderAll();
      route();
      return state.documents;
    } catch (error) {
      const fetchError = new Error(`Gagal memuat data dokumen: ${readableError(error)}`);
      if (preserveExisting && state.documents.length) {
        state.documentsLoaded = true;
        state.documentsError = null;
        renderAll();
      } else {
        state.documents = [];
        state.documentsLoaded = false;
        state.documentsError = fetchError;
        renderDocumentFetchError(fetchError);
      }
      throw fetchError;
    } finally {
      state.documentsPromise = null;
    }
  })();

  return state.documentsPromise;
}

async function loadServiceCatalog({ force = false } = {}) {
  if (state.serviceCatalogPromise) {
    if (!force) return state.serviceCatalogPromise;
    await state.serviceCatalogPromise.catch(() => {});
  }

  state.serviceCatalogPromise = (async () => {
    try {
      const [categoryResult, itemResult] = await Promise.all([
        db
          .from(SERVICE_CATEGORY_TABLE)
          .select("id,name,description,is_active,created_at,updated_at")
          .order("name", { ascending: true }),
        db
          .from(SERVICE_ITEM_TABLE)
          .select(
            "id,category_id,name,description,is_active,created_at,updated_at"
          )
          .order("name", { ascending: true })
      ]);

      if (categoryResult.error) throw categoryResult.error;
      if (itemResult.error) throw itemResult.error;

      state.serviceCategories = Array.isArray(categoryResult.data)
        ? categoryResult.data
        : [];
      state.serviceItems = Array.isArray(itemResult.data) ? itemResult.data : [];
      state.serviceCatalogLoaded = true;
      state.serviceCatalogError = null;
    } catch (error) {
      state.serviceCategories = [];
      state.serviceItems = [];
      state.serviceCatalogLoaded = false;
      state.serviceCatalogError = new Error(
        `Katalog layanan belum siap: ${readableError(error)}`
      );
    } finally {
      state.serviceCatalogPromise = null;
      renderAll();
      renderServiceCheckboxes();
      renderServiceCatalogManager();
      populateServiceCategorySelect();
    }

    return getMergedServiceCatalog();
  })();

  return state.serviceCatalogPromise;
}

async function loadPortfolioCatalog({ force = false } = {}) {
  if (state.portfolioCatalogPromise) {
    if (!force) return state.portfolioCatalogPromise;
    await state.portfolioCatalogPromise.catch(() => {});
  }

  state.portfolioCatalogPromise = (async () => {
    try {
      const [categoryResult, itemResult] = await Promise.all([
        db
          .from(PORTFOLIO_CATEGORY_TABLE)
          .select("id,code,name,description,is_active,created_at,updated_at")
          .order("code", { ascending: true }),
        db
          .from(PORTFOLIO_ITEM_TABLE)
          .select(
            "id,category_id,code,name,description,is_active,created_at,updated_at"
          )
          .order("code", { ascending: true })
      ]);

      if (categoryResult.error) throw categoryResult.error;
      if (itemResult.error) throw itemResult.error;

      state.portfolioCategories = Array.isArray(categoryResult.data)
        ? categoryResult.data
        : [];
      state.portfolioItems = Array.isArray(itemResult.data)
        ? itemResult.data
        : [];
      state.portfolioCatalogLoaded = true;
      state.portfolioCatalogError = null;
    } catch (error) {
      state.portfolioCategories = [];
      state.portfolioItems = [];
      state.portfolioCatalogLoaded = false;
      state.portfolioCatalogError = new Error(
        `Katalog portofolio belum siap: ${readableError(error)}`
      );
    } finally {
      state.portfolioCatalogPromise = null;
      renderPortfolioCheckboxes();
      renderServiceMappingTabs();
      renderPortfolioMapping();
    }

    return getPortfolioCatalog();
  })();

  return state.portfolioCatalogPromise;
}

async function fetchDocumentsFromRest() {
  const endpoint = new URL(`${SUPABASE_CLIENT_URL}/rest/v1/documents`);
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("order", "updated_at.desc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.message || `Supabase mengembalikan HTTP ${response.status}.`
    );
  }

  return response.json();
}

function hydrateDocumentCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(DOCUMENT_CACHE_KEY) || "null");
    if (!Array.isArray(cached?.documents)) return false;

    state.documents = cached.documents;
    state.documentsLoaded = true;
    state.documentsError = null;
    renderAll();
    return true;
  } catch {
    localStorage.removeItem(DOCUMENT_CACHE_KEY);
    return false;
  }
}

function writeDocumentCache(documents) {
  try {
    localStorage.setItem(
      DOCUMENT_CACHE_KEY,
      JSON.stringify({ cachedAt: Date.now(), documents })
    );
  } catch {
    // The live Supabase response remains usable when browser storage is unavailable.
  }
}

function renderDocumentLoadingState() {
  $("#documents-count").textContent = "Memuat...";
  $("#recent-documents-body").innerHTML = emptyRow(
    5,
    "Memuat dokumen dari Supabase..."
  );
  $("#documents-body").innerHTML = emptyRow(4, "Memuat dokumen dari Supabase...");
  $("#admin-documents-body").innerHTML = emptyRow(
    5,
    "Memuat dokumen dari Supabase..."
  );
}

function renderAll() {
  renderMetrics();
  loadRecentDocuments();
  populateCategoryFilter();
  renderDocumentTable();
  renderServiceMappingTabs();
  renderServiceMapping();
  renderPortfolioMapping();
  renderAdminDocuments();
  renderServiceCatalogManager();
  populateServiceCategorySelect();
  renderPortfolioCheckboxes();
}

function route() {
  const routeValue = location.hash.replace(/^#/, "") || "home";
  const [routeName, routeId] = routeValue.split("/");
  const normalizedRoute = ["sop", "standar"].includes(routeName)
    ? "documents"
    : routeName;
  const routeContext = {
    home: ["Regulatory Intelligence", "Dashboard Home"],
    documents: ["Document Repository", "Database Regulasi"],
    sop: ["Document Library", "SOP Center"],
    standar: ["Standard Library", "Data Standar"],
    services: ["Business Relevance", "Service Mapping"],
    admin: ["Restricted Access", "Admin Management"],
    document: ["Document Repository", "Detail Dokumen"]
  };
  const [eyebrow, title] = routeContext[routeName] || routeContext.home;

  $$(".view").forEach((view) => view.classList.add("hidden"));
  $(`[data-view="${normalizedRoute === "document" ? "detail" : normalizedRoute}"]`)
    ?.classList.remove("hidden");

  $$(".main-nav a").forEach((link) => {
    const target = link.dataset.nav;
    link.classList.toggle(
      "active",
      target === routeName || (routeName === "document" && target === "documents")
    );
  });
  $("#topbar-eyebrow").textContent = eyebrow;
  $("#topbar-title").textContent = title;
  setSidebarOpen(false);

  if (getDocumentLibraryType(routeName)) {
    configureDocumentLibrary(routeName);
    renderDocumentTable();
  } else if (routeName === "document" && routeId) {
    renderDocumentDetail(routeId);
  } else if (routeName === "admin") {
    updateAdminState();
    if (state.session) loadAdminLogs();
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function getDocumentLibraryType(routeName = location.hash.replace(/^#/, "").split("/")[0]) {
  return {
    documents: "regulasi",
    sop: "sop",
    standar: "standar"
  }[routeName] || null;
}

function configureDocumentLibrary(routeName) {
  const libraries = {
    documents: {
      eyebrow: "DOCUMENT REPOSITORY",
      title: "Database Regulasi",
      description: "Kumpulan regulasi yang digunakan dalam kegiatan layanan AEBT."
    },
    sop: {
      eyebrow: "DOCUMENT LIBRARY",
      title: "SOP Center",
      description: "Kumpulan prosedur operasional yang digunakan dalam kegiatan layanan AEBT."
    },
    standar: {
      eyebrow: "STANDARD LIBRARY",
      title: "Data Standar",
      description:
        "Kumpulan standar, referensi teknis, dan dokumen pendukung yang digunakan dalam kegiatan layanan AEBT."
    }
  };
  const library = libraries[routeName] || libraries.documents;
  $("#documents-eyebrow").textContent = library.eyebrow;
  $("#documents-title").textContent = library.title;
  $("#documents-description").textContent = library.description;
  $("#filter-type").value = getDocumentLibraryType(routeName);
  $("#filter-type").disabled = true;
  populateCategoryFilter();
}

function renderMetrics() {
  const docs = safeDocuments();
  $("#metric-total").textContent = docs.length;
  $("#metric-regulations").textContent = docs.filter(
    (doc) => doc.document_type === "regulasi"
  ).length;
  $("#metric-sops").textContent = docs.filter(
    (doc) => doc.document_type === "sop"
  ).length;
  $("#metric-standards").textContent = docs.filter(
    (doc) => doc.document_type === "standar"
  ).length;
  $("#metric-review").textContent = docs.filter(
    (doc) => doc.status === "Perlu Review"
  ).length;
  $("#metric-services").textContent = getMergedServiceCatalog().length;
}

function loadRecentDocuments() {
  const body = $("#recent-documents-body");
  const rows = safeDocuments().slice(0, 5);

  if (!rows.length) {
    body.innerHTML = emptyRow(5, "Belum ada dokumen.");
    return;
  }

  body.innerHTML = rows
    .map(
      (doc) => `
        <tr>
          <td>
            <div class="document-title">${escapeHtml(doc.title)}</div>
            <div class="document-meta">${escapeHtml(doc.regulation_number || "-")}</div>
            ${fileSourceIndicator(doc)}
          </td>
          <td>${typeBadge(doc.document_type)}</td>
          <td>${escapeHtml(doc.category || "-")}</td>
          <td>${statusBadge(doc.status)}</td>
          <td>${documentRowActions(doc.id)}</td>
        </tr>
      `
    )
    .join("");
}

function populateCategoryFilter() {
  const select = $("#filter-category");
  const current = select.value;
  const libraryType = getDocumentLibraryType();
  const categories = [
    ...new Set(
      safeDocuments()
        .filter((doc) => !libraryType || doc.document_type === libraryType)
        .map((doc) => doc.category)
        .filter(Boolean)
    )
  ]
    .sort((a, b) => a.localeCompare(b, "id"));

  select.innerHTML =
    '<option value="">Semua kategori</option>' +
    categories
      .map(
        (category) =>
          `<option value="${escapeAttribute(category)}">${escapeHtml(category)}</option>`
      )
      .join("");
  select.value = categories.includes(current) ? current : "";
}

function renderDocumentTable() {
  const body = $("#documents-body");
  const query = $("#filter-search").value.trim().toLowerCase();
  const selectedType = getDocumentLibraryType() || $("#filter-type").value;
  const category = $("#filter-category").value;
  const status = $("#filter-status").value;

  const docs = safeDocuments().filter((doc) => {
    const haystack = [
      doc.title,
      doc.regulation_number,
      doc.summary,
      doc.category
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!query || haystack.includes(query)) &&
      (!selectedType || doc.document_type === selectedType) &&
      (!category || doc.category === category) &&
      (!status || doc.status === status)
    );
  });

  $("#documents-count").textContent = `${docs.length} dokumen`;

  if (!docs.length) {
    body.innerHTML = emptyRow(4, "Tidak ada dokumen yang sesuai filter.");
    return;
  }

  body.innerHTML = docs
    .map(
      (doc) => `
        <tr>
          <td>
            <div class="document-title">${escapeHtml(doc.title)}</div>
          </td>
          <td>${escapeHtml(
            doc.regulation_number || String(doc.document_type).toUpperCase()
          )}</td>
          <td>${statusBadge(doc.status)}</td>
          <td>${documentRowActions(doc.id)}</td>
        </tr>
      `
    )
    .join("");
}

function normalizeServiceName(service) {
  return String(service || "").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return normalizeServiceName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/&/g, " dan ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getServiceCategoryPrefix(categoryName) {
  const category = normalizeServiceName(categoryName);
  const shortName = category.match(/\(([^)]+)\)\s*$/)?.[1]?.trim();
  return shortName || category;
}

function formatServiceValue(categoryName, serviceName) {
  return `${getServiceCategoryPrefix(categoryName)} - ${normalizeServiceName(
    serviceName
  )}`;
}

function getMergedServiceCatalog({ includeInactive = false } = {}) {
  if (!state.serviceCatalogLoaded) {
    return SERVICE_CATALOG_FALLBACK.map((category) => ({
      ...category,
      description: "",
      id: null,
      isFallback: true,
      is_active: true
    }));
  }

  return state.serviceCategories
    .filter((category) => includeInactive || category.is_active)
    .map((category) => ({
      id: category.id,
      category: normalizeServiceName(category.name),
      description: category.description || "",
      services: state.serviceItems
        .filter(
          (item) =>
            item.category_id === category.id && (includeInactive || item.is_active)
        )
        .map((item) => normalizeServiceName(item.name))
        .filter(Boolean),
      isFallback: false,
      is_active: Boolean(category.is_active)
    }))
    .filter((category) => category.category);
}

function getServiceEntries() {
  return getMergedServiceCatalog().flatMap((category) =>
    category.services.map((service) => ({
      category: category.category,
      categoryKey: normalizeText(category.category),
      categoryPrefix: getServiceCategoryPrefix(category.category),
      service,
      serviceKey: normalizeText(service),
      value: formatServiceValue(category.category, service),
      valueKey: normalizeText(formatServiceValue(category.category, service))
    }))
  );
}

function findServiceCategory(categoryName) {
  const key = normalizeText(categoryName);
  return getMergedServiceCatalog().find(
    (category) => normalizeText(category.category) === key
  );
}

function findServiceEntry(subServiceName, categoryName = state.selectedServiceCategory) {
  const serviceKey = normalizeText(subServiceName);
  const categoryKey = normalizeText(categoryName);
  return getServiceEntries().find(
    (entry) =>
      entry.serviceKey === serviceKey &&
      (!categoryKey || entry.categoryKey === categoryKey)
  );
}

function uniqueDocuments(documents) {
  const map = new Map();
  (Array.isArray(documents) ? documents : []).forEach((doc) => {
    if (doc?.id && !map.has(doc.id)) map.set(doc.id, doc);
  });
  return [...map.values()];
}

function documentMatchesSubService(doc, categoryName, subServiceName) {
  if (!doc?.related_services) return false;

  const serviceKey = normalizeText(subServiceName);
  const valueKey = normalizeText(formatServiceValue(categoryName, subServiceName));
  const relatedText = normalizeText(doc.related_services);
  const relatedTerms = splitServices(doc.related_services).map(normalizeText);

  return (
    relatedTerms.some(
      (term) =>
        term === serviceKey ||
        term === valueKey ||
        term.endsWith(` ${serviceKey}`) ||
        term.includes(serviceKey)
    ) || relatedText.includes(serviceKey)
  );
}

function getDocumentsByServiceCategory(categoryName) {
  const category = findServiceCategory(categoryName);
  if (!category) return [];

  return uniqueDocuments(
    safeDocuments().filter((doc) =>
      category.services.some((service) =>
        documentMatchesSubService(doc, category.category, service)
      )
    )
  );
}

function getDocumentsBySubService(subServiceName) {
  const entry = findServiceEntry(subServiceName);
  if (!entry) return [];

  return uniqueDocuments(
    safeDocuments().filter((doc) =>
      documentMatchesSubService(doc, entry.category, entry.service)
    )
  );
}

function getPortfolioCatalog({ includeInactive = false } = {}) {
  if (!state.portfolioCatalogLoaded) return [];

  return state.portfolioCategories
    .filter((category) => includeInactive || category.is_active)
    .map((category) => ({
      id: category.id,
      code: normalizeServiceName(category.code),
      name: normalizeServiceName(category.name),
      description: category.description || "",
      is_active: Boolean(category.is_active),
      items: state.portfolioItems
        .filter(
          (item) =>
            item.category_id === category.id &&
            (includeInactive || item.is_active)
        )
        .map((item) => ({
          id: item.id,
          category_id: item.category_id,
          code: normalizeServiceName(item.code),
          name: normalizeServiceName(item.name),
          description: item.description || "",
          is_active: Boolean(item.is_active)
        }))
        .filter((item) => item.code)
    }))
    .filter((category) => category.code);
}

function formatPortfolioValue(categoryCode, itemCode) {
  return `${normalizeServiceName(categoryCode)} - ${normalizeServiceName(
    itemCode
  )}`;
}

function getPortfolioEntries() {
  return getPortfolioCatalog().flatMap((category) =>
    category.items.map((item) => ({
      categoryId: category.id,
      categoryCode: category.code,
      categoryName: category.name,
      itemId: item.id,
      itemCode: item.code,
      itemName: item.name,
      itemCodeKey: normalizeText(item.code),
      value: formatPortfolioValue(category.code, item.code),
      valueKey: normalizeText(formatPortfolioValue(category.code, item.code))
    }))
  );
}

function findPortfolioCategory(categoryIdOrCode) {
  const value = String(categoryIdOrCode || "").trim();
  const key = normalizeText(value);
  return getPortfolioCatalog().find(
    (category) => category.id === value || normalizeText(category.code) === key
  );
}

function findPortfolioItem(itemCode, categoryId = state.selectedPortfolioCategoryId) {
  const itemKey = normalizeText(itemCode);
  return getPortfolioEntries().find(
    (entry) =>
      entry.itemCodeKey === itemKey &&
      (!categoryId || entry.categoryId === categoryId)
  );
}

function documentMatchesPortfolioItem(doc, categoryCode, itemCode) {
  if (!doc?.related_portfolios) return false;

  const itemCodeKey = normalizeText(itemCode);
  const valueKey = normalizeText(formatPortfolioValue(categoryCode, itemCode));
  const relatedTerms = splitServices(doc.related_portfolios).map(normalizeText);

  return relatedTerms.some(
    (term) =>
      term === valueKey ||
      term === itemCodeKey ||
      term.endsWith(` ${itemCodeKey}`)
  );
}

function getDocumentsByPortfolioItem(itemCode) {
  const entry = findPortfolioItem(itemCode);
  if (!entry) return [];

  return uniqueDocuments(
    safeDocuments().filter((doc) =>
      documentMatchesPortfolioItem(doc, entry.categoryCode, entry.itemCode)
    )
  );
}

function getDocumentsByPortfolioCategory(categoryId) {
  const category = findPortfolioCategory(categoryId);
  if (!category) return [];

  return uniqueDocuments(
    category.items.flatMap((item) => {
      const entry = findPortfolioItem(item.code, category.id);
      if (!entry) return [];
      return safeDocuments().filter((doc) =>
        documentMatchesPortfolioItem(
          doc,
          entry.categoryCode,
          entry.itemCode
        )
      );
    })
  );
}

function renderServiceMappingTabs() {
  const activeTab =
    state.activeMappingTab === "portfolios" ? "portfolios" : "services";
  state.activeMappingTab = activeTab;

  $$(".mapping-tab").forEach((button) => {
    const active = button.dataset.mappingTab === activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("#service-mapping-view")?.classList.toggle("hidden", activeTab !== "services");
  $("#portfolio-mapping-view")?.classList.toggle(
    "hidden",
    activeTab !== "portfolios"
  );
}

function handleMappingTabAction(event) {
  const button = event.target.closest("[data-mapping-tab]");
  if (!button) return;
  state.activeMappingTab =
    button.dataset.mappingTab === "portfolios" ? "portfolios" : "services";
  renderServiceMappingTabs();
  if (state.activeMappingTab === "portfolios") renderPortfolioMapping();
  else renderServiceMapping();
}

function renderServiceMapping() {
  const container = $("#service-mapping-grid");
  const panel = $("#service-documents-panel");

  const catalog = getMergedServiceCatalog();

  if (!catalog.length) {
    container.innerHTML =
      '<div class="service-card empty-service"><strong>Belum ada service mapping</strong><p>Katalog layanan belum tersedia.</p></div>';
    state.selectedServiceCategory = null;
    state.selectedSubServiceName = null;
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  if (
    state.selectedServiceCategory &&
    !findServiceCategory(state.selectedServiceCategory)
  ) {
    state.selectedServiceCategory = null;
    state.selectedSubServiceName = null;
  }

  container.innerHTML = catalog.map((category, index) => {
    const documents = getDocumentsByServiceCategory(category.category);
    const regulationCount = documents.filter(
      (doc) => doc.document_type === "regulasi"
    ).length;
    const sopCount = documents.filter((doc) => doc.document_type === "sop").length;
    const standardCount = documents.filter(
      (doc) => doc.document_type === "standar"
    ).length;

    return `
      <article class="service-card category-card accent-${index % 4} ${
        state.selectedServiceCategory === category.category ? "active" : ""
      }" data-service-category="${escapeAttribute(category.category)}">
        <span class="service-card-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 3 20 7v5c0 4.5-2.7 7.6-8 9-5.3-1.4-8-4.5-8-9V7z" />
            <path d="M8.5 12h7M12 8.5v7" />
          </svg>
        </span>
        <small>${category.services.length} sub-layanan</small>
        <strong>${escapeHtml(category.category)}</strong>
        <div class="service-stats">
          <span>${documents.length} dokumen</span>
          <em>${regulationCount} regulasi</em>
          <em>${sopCount} SOP</em>
          <em>${standardCount} standar</em>
        </div>
        <p>Regulasi, SOP, dan standar yang berkaitan dengan kategori ${escapeHtml(
          category.category
        )}.</p>
        <button class="button secondary small" type="button" data-service-category="${escapeAttribute(
          category.category
        )}">Lihat Layanan</button>
      </article>
    `;
  }).join("");

  if (state.selectedServiceCategory) {
    renderServiceCategoryDetail(state.selectedServiceCategory);
  }
  else {
    panel.classList.add("hidden");
    panel.innerHTML = "";
  }
}

function renderPortfolioMapping() {
  const container = $("#portfolio-mapping-grid");
  const panel = $("#portfolio-documents-panel");
  if (!container || !panel) return;

  if (state.portfolioCatalogError) {
    container.innerHTML = `
      <div class="service-card empty-service portfolio-empty">
        <strong>Portofolio SBU belum siap</strong>
        <p>${escapeHtml(readableError(state.portfolioCatalogError))}</p>
        <p>Jalankan supabase-add-portfolio-to-service-mapping.sql di Supabase SQL Editor.</p>
      </div>
    `;
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  if (!state.portfolioCatalogLoaded) {
    container.innerHTML =
      '<div class="service-card empty-service portfolio-empty"><strong>Memuat Portofolio SBU...</strong></div>';
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  const catalog = getPortfolioCatalog();
  if (!catalog.length) {
    container.innerHTML =
      '<div class="service-card empty-service portfolio-empty"><strong>Belum ada data portofolio.</strong><p>Tambahkan data ke portfolio_categories dan portfolio_items.</p></div>';
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  if (
    state.selectedPortfolioCategoryId &&
    !findPortfolioCategory(state.selectedPortfolioCategoryId)
  ) {
    state.selectedPortfolioCategoryId = null;
    state.selectedPortfolioItemCode = null;
  }

  container.innerHTML = catalog
    .map((category, index) => {
      const documents = getDocumentsByPortfolioCategory(category.id);
      return `
        <article class="service-card portfolio-card accent-${index % 4} ${
          state.selectedPortfolioCategoryId === category.id ? "active" : ""
        }" data-portfolio-category-id="${escapeAttribute(category.id)}">
          <span class="portfolio-code">${escapeHtml(category.code)}</span>
          <strong>${escapeHtml(category.name)}</strong>
          <div class="service-stats">
            <span>${category.items.length} sub-portofolio</span>
            <em>${documents.length} dokumen</em>
          </div>
          <p>${escapeHtml(
            category.description ||
              `Portofolio ${category.code} SBU AEBT.`
          )}</p>
          <button
            class="button secondary small"
            type="button"
            data-portfolio-category-id="${escapeAttribute(category.id)}"
          >Lihat Detail</button>
        </article>
      `;
    })
    .join("");

  if (state.selectedPortfolioCategoryId) {
    renderPortfolioCategoryDetail(state.selectedPortfolioCategoryId);
  } else {
    panel.classList.add("hidden");
    panel.innerHTML = "";
  }
}

function renderPortfolioCategoryDetail(categoryId) {
  const panel = $("#portfolio-documents-panel");
  const category = findPortfolioCategory(categoryId);
  if (!panel || !category) {
    state.selectedPortfolioCategoryId = null;
    state.selectedPortfolioItemCode = null;
    panel?.classList.add("hidden");
    if (panel) panel.innerHTML = "";
    return;
  }

  state.selectedPortfolioCategoryId = category.id;
  if (
    state.selectedPortfolioItemCode &&
    !category.items.some(
      (item) =>
        normalizeText(item.code) ===
        normalizeText(state.selectedPortfolioItemCode)
    )
  ) {
    state.selectedPortfolioItemCode = null;
  }

  const documents = getDocumentsByPortfolioCategory(category.id);
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">${escapeHtml(category.code)}</p>
        <h2>${escapeHtml(category.name)}</h2>
        <p>${documents.length} dokumen terkait portofolio ini. Pilih sub-portofolio untuk melihat dokumen.</p>
      </div>
    </div>
    <div class="sub-service-grid portfolio-item-grid">
      ${category.items
        .map((item) => {
          const itemDocuments = getDocumentsByPortfolioItemWithCategory(
            item.code,
            category.id
          );
          return `
            <button
              class="sub-service-card portfolio-item-card ${
                normalizeText(state.selectedPortfolioItemCode) ===
                normalizeText(item.code)
                  ? "active"
                  : ""
              }"
              type="button"
              data-portfolio-item-code="${escapeAttribute(item.code)}"
              data-portfolio-category-id="${escapeAttribute(category.id)}"
            >
              <span class="portfolio-item-code">${escapeHtml(item.code)}</span>
              <strong>${escapeHtml(item.name)}</strong>
              <span>${itemDocuments.length} dokumen terkait</span>
            </button>
          `;
        })
        .join("")}
    </div>
    <div id="portfolio-item-documents" class="sub-service-documents">
      <div class="empty-state">Pilih sub-portofolio untuk melihat dokumen terkait.</div>
    </div>
  `;

  if (state.selectedPortfolioItemCode) {
    renderPortfolioItemDocuments(state.selectedPortfolioItemCode);
  }
}

function getDocumentsByPortfolioItemWithCategory(itemCode, categoryId) {
  const entry = findPortfolioItem(itemCode, categoryId);
  if (!entry) return [];
  return uniqueDocuments(
    safeDocuments().filter((doc) =>
      documentMatchesPortfolioItem(doc, entry.categoryCode, entry.itemCode)
    )
  );
}

function renderPortfolioItemDocuments(itemCode) {
  const container = $("#portfolio-item-documents");
  if (!container) return;

  const entry = findPortfolioItem(itemCode);
  if (!entry) {
    container.innerHTML =
      '<div class="empty-state">Sub-portofolio tidak ditemukan.</div>';
    return;
  }

  state.selectedPortfolioItemCode = entry.itemCode;
  const documents = getDocumentsByPortfolioItem(entry.itemCode);
  container.innerHTML = `
    <div class="section-heading sub-service-heading">
      <div>
        <p class="eyebrow">${escapeHtml(entry.itemCode)}</p>
        <h3>${escapeHtml(entry.itemName)}</h3>
        <p>${documents.length} dokumen terkait sub-portofolio ini.</p>
      </div>
    </div>
    <div class="table-frame">
      <table>
        <thead>
          <tr>
            <th>Judul dokumen</th>
            <th>Tipe</th>
            <th>Status</th>
            <th>Tahun</th>
            <th>Sumber file</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            documents.length
              ? documents
                  .map(
                    (doc) => `
                <tr>
                  <td>
                    <div class="document-title">${escapeHtml(doc.title)}</div>
                    <div class="document-meta">${escapeHtml(
                      doc.regulation_number || "-"
                    )}</div>
                  </td>
                  <td>${typeBadge(doc.document_type)}</td>
                  <td>${statusBadge(doc.status)}</td>
                  <td>${escapeHtml(doc.year || "-")}</td>
                  <td>${fileSourceIndicator(doc)}</td>
                  <td>${documentRowActions(doc.id, "Buka Detail")}</td>
                </tr>
              `
                  )
                  .join("")
              : emptyRow(6, "Belum ada dokumen terkait sub-portofolio ini.")
          }
        </tbody>
      </table>
    </div>
  `;
}

function handlePortfolioCardAction(event) {
  const target = event.target.closest("[data-portfolio-category-id]");
  if (!target) return;
  state.selectedPortfolioCategoryId = target.dataset.portfolioCategoryId;
  state.selectedPortfolioItemCode = null;
  renderPortfolioMapping();
  $("#portfolio-documents-panel")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function handlePortfolioDocumentAction(event) {
  const itemButton = event.target.closest("[data-portfolio-item-code]");
  const editButton = event.target.closest("[data-edit-id]");
  const detailButton = event.target.closest("[data-detail-id]");

  if (itemButton) {
    state.selectedPortfolioCategoryId =
      itemButton.dataset.portfolioCategoryId ||
      state.selectedPortfolioCategoryId;
    state.selectedPortfolioItemCode = itemButton.dataset.portfolioItemCode;
    renderPortfolioCategoryDetail(state.selectedPortfolioCategoryId);
    $("#portfolio-item-documents")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
  if (editButton) openDocumentEditor(editButton.dataset.editId);
  if (detailButton) openDocumentDetail(detailButton.dataset.detailId);
}

function renderServiceCategoryDetail(categoryName) {
  const panel = $("#service-documents-panel");
  const category = findServiceCategory(categoryName);

  if (!category) {
    state.selectedServiceCategory = null;
    state.selectedSubServiceName = null;
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  state.selectedServiceCategory = category.category;
  if (
    state.selectedSubServiceName &&
    !category.services.some(
      (service) => normalizeText(service) === normalizeText(state.selectedSubServiceName)
    )
  ) {
    state.selectedSubServiceName = null;
  }

  const categoryDocuments = getDocumentsByServiceCategory(category.category);
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>${escapeHtml(category.category)}</h2>
        <p>${categoryDocuments.length} dokumen terkait kategori ini. Pilih sub-layanan untuk melihat daftar regulasi, SOP, dan standar.</p>
      </div>
    </div>
    <div class="sub-service-grid">
      ${category.services
        .map((service) => {
          const documents = getDocumentsBySubServiceWithCategory(
            service,
            category.category
          );
          return `
            <button class="sub-service-card ${
              normalizeText(state.selectedSubServiceName) === normalizeText(service)
                ? "active"
                : ""
            }" type="button" data-sub-service="${escapeAttribute(
              service
            )}" data-service-category="${escapeAttribute(category.category)}">
              <strong>${escapeHtml(service)}</strong>
              <span>${documents.length} dokumen terkait</span>
            </button>
          `;
        })
        .join("")}
    </div>
    <div id="sub-service-documents" class="sub-service-documents">
      <div class="empty-state">Pilih sub-layanan untuk melihat dokumen terkait.</div>
    </div>
  `;

  if (state.selectedSubServiceName) renderSubServiceDocuments(state.selectedSubServiceName);
}

function getDocumentsBySubServiceWithCategory(subServiceName, categoryName) {
  const entry = findServiceEntry(subServiceName, categoryName);
  if (!entry) return [];

  return uniqueDocuments(
    safeDocuments().filter((doc) =>
      documentMatchesSubService(doc, entry.category, entry.service)
    )
  );
}

function renderSubServiceDocuments(subServiceName) {
  const container = $("#sub-service-documents");
  if (!container) return;

  const entry = findServiceEntry(subServiceName);
  if (!entry) {
    container.innerHTML =
      '<div class="empty-state">Sub-layanan tidak ditemukan dalam katalog.</div>';
    return;
  }

  state.selectedSubServiceName = entry.service;
  const documents = getDocumentsBySubService(entry.service);
  container.innerHTML = `
    <div class="section-heading sub-service-heading">
      <div>
        <h3>${escapeHtml(entry.service)}</h3>
        <p>${documents.length} dokumen terkait sub-layanan ini.</p>
      </div>
    </div>
    <div class="table-frame">
      <table>
        <thead>
          <tr>
            <th>Judul dokumen</th>
            <th>Tipe</th>
            <th>Kategori</th>
            <th>Status</th>
            <th>Tahun</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${
            documents.length
              ? documents
                  .map(
                    (doc) => `
                <tr>
                  <td>
                    <div class="document-title">${escapeHtml(doc.title)}</div>
                    <div class="document-meta">${escapeHtml(
                      doc.regulation_number || doc.file_name || "-"
                    )}</div>
                    ${fileSourceIndicator(doc)}
                  </td>
                  <td>${typeBadge(doc.document_type)}</td>
                  <td>${escapeHtml(doc.category || "-")}</td>
                  <td>${statusBadge(doc.status)}</td>
                  <td>${escapeHtml(doc.year || "-")}</td>
                  <td>${documentRowActions(doc.id, "Buka Detail")}</td>
                </tr>
              `
                  )
                  .join("")
              : emptyRow(6, "Belum ada dokumen yang terkait dengan sub-layanan ini.")
          }
        </tbody>
      </table>
    </div>
  `;
}

function handleServiceCardAction(event) {
  const target = event.target.closest("[data-service-category]");
  if (!target) return;
  state.selectedServiceCategory = target.dataset.serviceCategory;
  state.selectedSubServiceName = null;
  renderServiceMapping();
  $("#service-documents-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleServiceDocumentAction(event) {
  const subServiceButton = event.target.closest("[data-sub-service]");
  const editButton = event.target.closest("[data-edit-id]");
  const detailButton = event.target.closest("[data-detail-id]");
  if (subServiceButton) {
    state.selectedServiceCategory =
      subServiceButton.dataset.serviceCategory || state.selectedServiceCategory;
    state.selectedSubServiceName = subServiceButton.dataset.subService;
    renderServiceCategoryDetail(state.selectedServiceCategory);
    $("#sub-service-documents")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
  if (editButton) openDocumentEditor(editButton.dataset.editId);
  if (detailButton) openDocumentDetail(detailButton.dataset.detailId);
}

async function renderDocumentDetail(id) {
  const container = $("#document-detail");
  const documentId = String(id || "").trim();
  const renderToken = ++state.detailRenderToken;

  if (state.documentsError) {
    container.innerHTML = `
      <section class="detail-section">
        <h1>Dokumen belum dapat dimuat</h1>
        <p class="muted">${escapeHtml(readableError(state.documentsError))}</p>
      </section>
    `;
    return;
  }

  if (!state.documentsLoaded) {
    container.innerHTML =
      '<section class="detail-section"><h1>Memuat dokumen...</h1><p class="muted">Mohon tunggu data dari Supabase.</p></section>';
    return;
  }

  const doc = safeDocuments().find((item) => item.id === documentId);

  if (!doc) {
    container.innerHTML =
      '<section class="detail-section"><h1>Dokumen tidak ditemukan</h1><p class="muted">Data mungkin sudah dihapus atau belum dimuat.</p></section>';
    return;
  }

  const fileSource = getDocumentFileSource(doc);
  const storagePath =
    fileSource === "supabase" ? validStoragePath(doc.file_path) : null;
  const externalFileUrl =
    fileSource === "external" ? validExternalUrl(doc.external_file_url) : null;
  const filePanel = getFilePanelContent(doc, fileSource);
  $("#detail-updated").textContent = `Diperbarui ${formatDateTime(doc.updated_at)}`;
  container.innerHTML = `
    <article>
      <header class="detail-header">
        <div class="detail-title-row">
          <div>
            ${typeBadge(doc.document_type)}
            ${fileSourceIndicator(doc)}
            <h1>${escapeHtml(doc.title)}</h1>
            <p class="muted">${escapeHtml(doc.regulation_number || doc.file_name || "-")}</p>
          </div>
          <div class="detail-actions">
            <button id="edit-detail-document" class="button secondary" type="button" data-edit-id="${escapeAttribute(
              doc.id
            )}">Edit dokumen</button>
            <a id="open-file-link" class="button secondary hidden" target="_blank" rel="noopener">Buka file</a>
            <a id="download-file-link" class="button primary hidden">Download PDF</a>
          </div>
        </div>
        <div class="meta-grid">
          ${metaItem("Tahun", doc.year || "-")}
          ${metaItem("Instansi penerbit", doc.issuing_body || "-")}
          ${metaItem("Kategori", doc.category || "-")}
          ${metaItem("Sub-kategori", doc.sub_category || "-")}
          ${metaItem("Status", doc.status || "-")}
          ${metaItem("Terakhir dicek", formatDate(doc.last_checked_at))}
        </div>
      </header>

      <div class="document-detail-layout">
        <div class="document-detail-info">
          <div class="detail-columns">
            <section class="detail-section">
              <h2>Substansi regulasi</h2>
              ${detailField("Ringkasan", doc.summary)}
            </section>
            <section class="detail-section">
              <h2>Keterkaitan SBU</h2>
              ${detailField(
                "Layanan terkait",
                renderServiceTags(doc.related_services),
                true
              )}
              ${detailField(
                "Portofolio terkait",
                renderServiceTags(doc.related_portfolios),
                true
              )}
            </section>
          </div>

          <section class="detail-section pdf-section">
            <h2>Sumber dan catatan</h2>
            ${detailField(
              "Sumber resmi",
              doc.source_url
                ? `<a href="${escapeAttribute(doc.source_url)}" target="_blank" rel="noopener">${escapeHtml(
                    doc.source_url
                  )}</a>`
                : "-",
              true
            )}
            ${detailField("PIC update", doc.pic_update)}
            ${detailField("Catatan", doc.notes)}
          </section>
        </div>

        <aside class="document-pdf-panel">
          <section class="detail-section pdf-section">
            <div class="section-heading">
              <div>
                <h2>${escapeHtml(filePanel.title)}</h2>
                <p>${escapeHtml(filePanel.subtitle)}</p>
              </div>
            </div>
            <div id="pdf-preview" class="pdf-placeholder">${escapeHtml(
              filePanel.message
            )}</div>
          </section>
        </aside>
      </div>
    </article>
  `;

  if (storagePath) await attachSignedUrls(doc, renderToken);
  else if (externalFileUrl) attachExternalFile(doc, externalFileUrl, renderToken);
  else showFileUnavailable();
}

function getFilePanelContent(doc, fileSource = getDocumentFileSource(doc)) {
  if (fileSource === "supabase") {
    return {
      title: "Preview PDF",
      subtitle: doc.file_name || "Dokumen PDF",
      message: "Menyiapkan signed URL..."
    };
  }
  if (fileSource === "external") {
    return {
      title: "File eksternal",
      subtitle: "Google Drive / link eksternal",
      message: "File tersimpan di link eksternal"
    };
  }
  return {
    title: "File dokumen",
    subtitle: "File belum tersedia",
    message: "File belum tersedia"
  };
}

async function attachSignedUrls(doc, renderToken) {
  const storagePath = validStoragePath(doc?.file_path);
  if (!storagePath) {
    showFileUnavailable();
    return;
  }

  try {
    const storageClient = db || (await state.supabasePromise);
    let signedUrls = state.signedUrls.get(storagePath);
    if (!signedUrls) {
      const [previewResult, downloadResult] = await Promise.all([
        storageClient.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(storagePath, 3600),
        storageClient.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(storagePath, 3600, {
            download: doc.file_name || "dokumen.pdf"
          })
      ]);

      if (previewResult.error) throw previewResult.error;
      if (downloadResult.error) throw downloadResult.error;
      if (!previewResult.data?.signedUrl || !downloadResult.data?.signedUrl) {
        throw new Error("Supabase tidak mengembalikan signed URL PDF.");
      }

      signedUrls = {
        preview: previewResult.data.signedUrl,
        download: downloadResult.data.signedUrl
      };
      state.signedUrls.set(storagePath, signedUrls);
    }

    if (renderToken !== state.detailRenderToken) return;

    const openLink = $("#open-file-link");
    openLink.href = signedUrls.preview;
    openLink.classList.remove("hidden");

    const downloadLink = $("#download-file-link");
    downloadLink.href = signedUrls.download;
    downloadLink.classList.remove("hidden");

    $("#pdf-preview").outerHTML = `<iframe class="pdf-frame" src="${escapeAttribute(
      signedUrls.preview
    )}" title="Preview ${escapeAttribute(doc.title)}"></iframe>`;
  } catch (error) {
    if (renderToken !== state.detailRenderToken) return;
    hideFileActions();
    const preview = $("#pdf-preview");
    if (preview) {
      preview.className = "pdf-placeholder";
      preview.textContent = `Preview tidak dapat dimuat: ${readableError(error)}`;
    }
  }
}

function attachExternalFile(doc, externalFileUrl, renderToken) {
  if (renderToken !== state.detailRenderToken) return;
  const safeUrl = validExternalUrl(externalFileUrl);
  if (!safeUrl) {
    showFileUnavailable();
    return;
  }

  hideFileActions();
  const openLink = $("#open-file-link");
  openLink.href = safeUrl;
  openLink.textContent = "Buka File";
  openLink.classList.remove("hidden");

  const preview = $("#pdf-preview");
  if (preview) {
    const hostname = new URL(safeUrl).hostname.replace(/^www\./, "");
    preview.className = "pdf-placeholder external-file-placeholder";
    preview.innerHTML = `
      <span class="external-file-icon" aria-hidden="true">URL</span>
      <strong>File tersimpan di link eksternal</strong>
      <small>${escapeHtml(hostname)}</small>
      <a class="button primary" href="${escapeAttribute(
        safeUrl
      )}" target="_blank" rel="noopener noreferrer">Buka File</a>
    `;
  }
}

function showFileUnavailable() {
  hideFileActions();
  const preview = $("#pdf-preview");
  if (preview) {
    preview.className = "pdf-placeholder";
    preview.textContent = "File belum tersedia.";
  }
}

function hideFileActions() {
  ["#open-file-link", "#download-file-link"].forEach((selector) => {
    const link = $(selector);
    if (!link) return;
    link.classList.add("hidden");
    link.removeAttribute("href");
  });
}

async function handleLogin(event) {
  event.preventDefault();
  if (!ensureConfigured()) return;

  const form = new FormData(event.currentTarget);
  setLoading(true, "Memverifikasi akun admin...");
  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || "")
    });
    if (error) throw error;
    state.session = data.session;
    event.currentTarget.reset();
    updateAdminState();
    await loadAdminLogs();
    if (state.pendingEditId) {
      const pendingId = state.pendingEditId;
      state.pendingEditId = null;
      startEdit(pendingId);
    }
    showToast("Login berhasil.");
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
  }
}

async function handleLogout() {
  setLoading(true, "Mengakhiri session...");
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    state.session = null;
    resetEditor();
    updateAdminState();
    showToast("Anda sudah logout.");
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
  }
}

function updateAdminState() {
  const loggedIn = Boolean(state.session?.user);
  $("#admin-login-panel").classList.toggle("hidden", loggedIn);
  $("#admin-workspace").classList.toggle("hidden", !loggedIn);
  $("#admin-session-badge").classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    const email = state.session.user.email || "Admin";
    $("#admin-user-email").textContent = email;
    $("#admin-session-badge").textContent = "Authenticated";
    $("#sidebar-account-name").textContent = "Admin AEBT";
    $("#sidebar-account-state").textContent = email;
  } else {
    $("#sidebar-account-name").textContent = "Akses publik";
    $("#sidebar-account-state").textContent = "Regulatory workspace";
  }
}

function renderServiceCheckboxes() {
  const container = $("#related-services-selector");
  if (!container) return;

  container.innerHTML = getMergedServiceCatalog().map((category, index) => `
    <details class="service-accordion" ${index === 0 ? "open" : ""}>
      <summary>
        <span>${escapeHtml(category.category)}</span>
        <small>${category.services.length} layanan</small>
      </summary>
      <div class="service-option-list">
        ${category.services
          .map((service) => {
            const value = formatServiceValue(category.category, service);
            return `
              <label class="service-option">
                <input
                  type="checkbox"
                  value="${escapeAttribute(value)}"
                  data-service-category="${escapeAttribute(category.category)}"
                  data-service-name="${escapeAttribute(service)}"
                />
                <span>${escapeHtml(service)}</span>
              </label>
            `;
          })
          .join("")}
      </div>
    </details>
  `).join("");

  syncSelectedServicesSummary();
}

function getSelectedServices() {
  const selected = $$(
    '#related-services-selector input[type="checkbox"]:checked'
  ).map((input) => input.value);
  const selectedKeys = new Set(selected.map(normalizeText));
  const legacy = state.legacyRelatedServices.filter(
    (service) => !selectedKeys.has(normalizeText(service))
  );
  return [...selected, ...legacy];
}

function setSelectedServices(relatedServicesString) {
  const terms = splitServices(relatedServicesString);
  const checkboxes = $$('#related-services-selector input[type="checkbox"]');
  const entries = getServiceEntries();
  const matchedValues = new Set();
  state.legacyRelatedServices = [];

  checkboxes.forEach((input) => {
    input.checked = false;
  });

  terms.forEach((term) => {
    const termKey = normalizeText(term);
    const entry = entries.find(
      (item) =>
        termKey === item.valueKey ||
        termKey === item.serviceKey ||
        termKey.endsWith(` ${item.serviceKey}`) ||
        termKey.includes(item.serviceKey)
    );

    if (entry) matchedValues.add(entry.valueKey);
    else if (term) state.legacyRelatedServices.push(term);
  });

  checkboxes.forEach((input) => {
    input.checked = matchedValues.has(normalizeText(input.value));
  });

  syncSelectedServicesSummary();
}

function syncSelectedServicesSummary() {
  const hiddenField = $('#document-form input[name="related_services"]');
  const summary = $("#related-services-summary");
  if (!hiddenField || !summary) return;

  const selected = $$(
    '#related-services-selector input[type="checkbox"]:checked'
  ).map((input) => input.value);
  const allServices = getSelectedServices();
  hiddenField.value = allServices.join(", ");

  if (!selected.length && !state.legacyRelatedServices.length) {
    summary.textContent = "Belum ada layanan dipilih.";
    return;
  }

  const selectedLine = selected.length
    ? `${selected.length} layanan dipilih: ${selected.join(", ")}`
    : "Belum ada layanan katalog yang dipilih.";
  const legacyLine = state.legacyRelatedServices.length
    ? `<br><span>Data lama tetap disimpan: ${escapeHtml(
        state.legacyRelatedServices.join(", ")
      )}</span>`
    : "";

  summary.innerHTML = `${escapeHtml(selectedLine)}${legacyLine}`;
}

function renderPortfolioCheckboxes() {
  const container = $("#related-portfolios-selector");
  if (!container) return;

  if (state.portfolioCatalogError) {
    container.innerHTML = `
      <div class="manager-alert portfolio-selector-alert">
        <strong>Portofolio SBU belum siap.</strong>
        <p>Jalankan supabase-add-portfolio-to-service-mapping.sql di Supabase SQL Editor.</p>
      </div>
    `;
    syncSelectedPortfoliosSummary();
    return;
  }

  if (!state.portfolioCatalogLoaded) {
    container.innerHTML =
      '<div class="empty-state compact-empty">Memuat katalog portofolio...</div>';
    syncSelectedPortfoliosSummary();
    return;
  }

  const catalog = getPortfolioCatalog();
  if (!catalog.length) {
    container.innerHTML =
      '<div class="empty-state compact-empty">Belum ada katalog portofolio.</div>';
    syncSelectedPortfoliosSummary();
    return;
  }

  container.innerHTML = catalog
    .map(
      (category, index) => `
      <details class="service-accordion portfolio-accordion" ${
        index === 0 ? "open" : ""
      }>
        <summary>
          <span>
            <strong>${escapeHtml(category.code)}</strong>
            ${escapeHtml(category.name)}
          </span>
          <small>${category.items.length} sub-portofolio</small>
        </summary>
        <div class="service-option-list">
          ${category.items
            .map((item) => {
              const value = formatPortfolioValue(category.code, item.code);
              return `
                <label class="service-option portfolio-option">
                  <input
                    type="checkbox"
                    value="${escapeAttribute(value)}"
                    data-portfolio-category-id="${escapeAttribute(category.id)}"
                    data-portfolio-item-code="${escapeAttribute(item.code)}"
                  />
                  <span>
                    <strong>${escapeHtml(item.code)}</strong>
                    ${escapeHtml(item.name)}
                  </span>
                </label>
              `;
            })
            .join("")}
        </div>
      </details>
    `
    )
    .join("");

  syncSelectedPortfoliosSummary();
}

function getSelectedPortfolios() {
  const selected = $$(
    '#related-portfolios-selector input[type="checkbox"]:checked'
  ).map((input) => input.value);
  const selectedKeys = new Set(selected.map(normalizeText));
  const legacy = state.legacyRelatedPortfolios.filter(
    (portfolio) => !selectedKeys.has(normalizeText(portfolio))
  );
  return [...selected, ...legacy];
}

function setSelectedPortfolios(relatedPortfoliosString) {
  const terms = splitServices(relatedPortfoliosString);
  const checkboxes = $$(
    '#related-portfolios-selector input[type="checkbox"]'
  );
  const entries = getPortfolioEntries();
  const matchedValues = new Set();
  state.legacyRelatedPortfolios = [];

  checkboxes.forEach((input) => {
    input.checked = false;
  });

  terms.forEach((term) => {
    const termKey = normalizeText(term);
    const entry = entries.find(
      (item) =>
        termKey === item.valueKey ||
        termKey === item.itemCodeKey ||
        termKey.endsWith(` ${item.itemCodeKey}`)
    );
    if (entry) matchedValues.add(entry.valueKey);
    else if (term) state.legacyRelatedPortfolios.push(term);
  });

  checkboxes.forEach((input) => {
    input.checked = matchedValues.has(normalizeText(input.value));
  });

  syncSelectedPortfoliosSummary();
}

function syncSelectedPortfoliosSummary() {
  const hiddenField = $('#document-form input[name="related_portfolios"]');
  const summary = $("#related-portfolios-summary");
  if (!hiddenField || !summary) return;

  const selected = $$(
    '#related-portfolios-selector input[type="checkbox"]:checked'
  ).map((input) => input.value);
  const allPortfolios = getSelectedPortfolios();
  hiddenField.value = allPortfolios.join(", ");

  if (!selected.length && !state.legacyRelatedPortfolios.length) {
    summary.textContent = "Belum ada portofolio dipilih.";
    return;
  }

  const selectedLine = selected.length
    ? `${selected.length} portofolio dipilih: ${selected.join(", ")}`
    : "Belum ada portofolio katalog yang dipilih.";
  const legacyLine = state.legacyRelatedPortfolios.length
    ? `<br><span>Data lama tetap disimpan: ${escapeHtml(
        state.legacyRelatedPortfolios.join(", ")
      )}</span>`
    : "";
  summary.innerHTML = `${escapeHtml(selectedLine)}${legacyLine}`;
}

function renderServiceCatalogManager() {
  const container = $("#service-catalog-list");
  if (!container) return;

  if (state.serviceCatalogError) {
    container.innerHTML = `
      <div class="manager-alert">
        <strong>Kelola Layanan belum siap.</strong>
        <p>${escapeHtml(readableError(state.serviceCatalogError))}</p>
        <p>Jalankan file supabase-service-catalog.sql di SQL Editor Supabase.</p>
      </div>
    `;
    return;
  }

  if (!state.serviceCatalogLoaded) {
    container.innerHTML =
      '<div class="empty-state">Memuat katalog layanan...</div>';
    return;
  }

  const categories = getMergedServiceCatalog({ includeInactive: true });
  if (!categories.length) {
    container.innerHTML =
      '<div class="empty-state">Belum ada kategori layanan.</div>';
    return;
  }

  container.innerHTML = categories
    .map(
      (category) => `
        <article class="custom-service-card ${category.is_active ? "" : "inactive"}">
          <header>
            <div>
              <h3>${escapeHtml(category.category)}</h3>
              <p>${escapeHtml(category.description || "Tanpa deskripsi.")}</p>
            </div>
            ${activeStatusBadge(category.is_active)}
          </header>
          <div>
            <div class="tag-list">
              ${
                category.services.length
                  ? category.services
                      .map(
                        (service) =>
                          `<span class="service-tag">${escapeHtml(service)}</span>`
                      )
                      .join("")
                  : '<span class="muted">Belum ada sub-layanan.</span>'
              }
            </div>
          </div>
          <div class="table-actions">
            ${
              category.is_active
                ? `<button class="button danger small" type="button" data-deactivate-service-category="${escapeAttribute(
                    category.id
                  )}">Nonaktifkan</button>`
                : '<span class="muted">Nonaktif</span>'
            }
          </div>
        </article>
      `
    )
    .join("");
}

function activeStatusBadge(isActive) {
  return `<span class="${isActive ? "status-active" : "status-inactive"}">${
    isActive ? "Aktif" : "Nonaktif"
  }</span>`;
}

function populateServiceCategorySelect() {
  const select = $("#service-item-category");
  if (!select) return;

  const previousValue = select.value;
  const categories = state.serviceCategories.filter((category) => category.is_active);
  select.innerHTML = `
    <option value="">Pilih kategori layanan</option>
    ${categories
      .map(
        (category) =>
          `<option value="${escapeAttribute(category.id)}">${escapeHtml(
            category.name
          )}</option>`
      )
      .join("")}
  `;
  if (categories.some((category) => category.id === previousValue)) {
    select.value = previousValue;
  }
  select.disabled = !categories.length;
}

async function handleServiceCategorySubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;

  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    name: cleanText(data.get("name")),
    description: cleanText(data.get("description"))
  };

  if (!payload.name) {
    showToast("Nama kategori layanan wajib diisi.", true);
    return;
  }
  const duplicateCategory = state.serviceCategories.some(
    (category) => normalizeText(category.name) === normalizeText(payload.name)
  );
  if (duplicateCategory) {
    showToast("Kategori layanan dengan nama tersebut sudah ada.", true);
    return;
  }

  setServiceCatalogBusy(true, "Menyimpan kategori layanan...");
  try {
    const category = await createServiceCategory(payload);
    form.reset();
    await loadServiceCatalog({ force: true });
    $("#service-item-category").value = category.id;
    showToast(`Kategori layanan "${payload.name}" berhasil ditambahkan.`);
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setServiceCatalogBusy(false);
  }
}

async function createServiceCategory(payload) {
  if (!requireAdmin()) throw new Error("Login admin diperlukan.");
  const { data, error } = await db
    .from(SERVICE_CATEGORY_TABLE)
    .insert({ ...payload, is_active: true })
    .select()
    .single();
  if (error) throw error;

  await insertLog(
    null,
    "Tambah kategori layanan",
    `Menambahkan kategori layanan: ${data.name}`,
    { pic_update: state.session.user.email }
  );
  return data;
}

async function handleServiceItemSubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;

  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    category_id: cleanText(data.get("category_id")),
    name: cleanText(data.get("name")),
    description: cleanText(data.get("description"))
  };
  const category = state.serviceCategories.find(
    (item) => item.id === payload.category_id && item.is_active
  );

  if (!category || !payload.name) {
    showToast("Pilih kategori dan isi nama sub-layanan.", true);
    return;
  }
  const duplicateItem = state.serviceItems.some(
    (item) =>
      item.category_id === payload.category_id &&
      normalizeText(item.name) === normalizeText(payload.name)
  );
  if (duplicateItem) {
    showToast("Sub-layanan tersebut sudah ada di kategori yang dipilih.", true);
    return;
  }

  setServiceCatalogBusy(true, "Menyimpan sub-layanan...");
  try {
    await createServiceItem(payload, category);
    form.reset();
    await loadServiceCatalog({ force: true });
    showToast(
      `Sub-layanan "${payload.name}" berhasil ditambahkan ke ${category.name}.`
    );
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setServiceCatalogBusy(false);
  }
}

async function createServiceItem(payload, category) {
  if (!requireAdmin()) throw new Error("Login admin diperlukan.");
  const { data, error } = await db
    .from(SERVICE_ITEM_TABLE)
    .insert({ ...payload, is_active: true })
    .select()
    .single();
  if (error) throw error;

  await insertLog(
    null,
    "Tambah sub-layanan",
    `Menambahkan sub-layanan ${data.name} ke kategori ${category.name}`,
    { pic_update: state.session.user.email }
  );
  return data;
}

function handleServiceCatalogAction(event) {
  const button = event.target.closest("[data-deactivate-service-category]");
  if (!button) return;
  deactivateServiceCategory(button.dataset.deactivateServiceCategory);
}

async function deactivateServiceCategory(id) {
  if (!requireAdmin()) return;
  const category = state.serviceCategories.find((item) => item.id === id);
  if (!category) return;

  const confirmed = window.confirm(
    `Nonaktifkan kategori layanan "${category.name}"? Kategori tidak akan tampil untuk publik.`
  );
  if (!confirmed) return;

  setServiceCatalogBusy(true, "Menonaktifkan kategori layanan...");
  try {
    const { error } = await db
      .from(SERVICE_CATEGORY_TABLE)
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw error;

    await insertLog(
      null,
      "Nonaktifkan kategori layanan",
      `Menonaktifkan kategori layanan: ${category.name}`,
      { pic_update: state.session.user.email }
    );
    await loadServiceCatalog({ force: true });
    showToast("Kategori layanan dinonaktifkan.");
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setServiceCatalogBusy(false);
  }
}

function setServiceCatalogBusy(active, message = "") {
  ["#service-category-form", "#service-item-form"].forEach((selector) => {
    const form = $(selector);
    if (form) {
      $$("button, input, select, textarea", form).forEach((field) => {
        field.disabled = active;
      });
    }
  });
  ["#service-category-status", "#service-item-status"].forEach((selector) => {
    const status = $(selector);
    if (status) {
      status.textContent = active ? message : "";
    }
  });
  if (!active) populateServiceCategorySelect();
}

function documentRowActions(documentId, detailLabel = "Detail") {
  const id = escapeAttribute(documentId);
  return `
    <div class="table-actions">
      <button class="button secondary small" type="button" data-detail-id="${id}">${escapeHtml(
        detailLabel
      )}</button>
      <button class="button primary small" type="button" data-edit-id="${id}">Edit</button>
    </div>
  `;
}

function handleDocumentFormChange(event) {
  if (event.target.name === "file_source") syncFileSourceFields();
}

function syncFileSourceFields() {
  const form = $("#document-form");
  if (!form) return;

  const source = normalizeFileSource(form.elements.file_source?.value);
  const supabaseFields = $("#supabase-file-fields");
  const externalFields = $("#external-file-fields");
  const fileInput = form.elements.file;
  const externalInput = form.elements.external_file_url;
  const existingPath = validStoragePath(form.elements.existing_file_path?.value);

  supabaseFields?.classList.toggle("hidden", source !== "supabase");
  externalFields?.classList.toggle("hidden", source !== "external");

  if (fileInput) {
    fileInput.required = false;
    if (source !== "supabase") fileInput.value = "";
  }
  if (externalInput) externalInput.required = source === "external";

  const note = $("#existing-file-note");
  if (note) {
    note.textContent =
      source === "supabase" && existingPath
        ? "File Supabase lama tetap digunakan jika tidak memilih PDF baru."
        : "Pilih PDF yang akan diunggah ke Supabase Storage.";
  }
}

async function handleDocumentSubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;

  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const id = cleanText(form.get("id"));
  const original = id ? state.documents.find((doc) => doc.id === id) : null;
  const file = form.get("file");
  const hasNewFile = file instanceof File && file.size > 0;
  const fileSource = normalizeFileSource(form.get("file_source"), original);
  const originalStoragePath = validStoragePath(original?.file_path);
  const externalFileUrl = validExternalUrl(form.get("external_file_url"));

  if (fileSource === "supabase" && !hasNewFile && !originalStoragePath) {
    showToast("Pilih file PDF untuk sumber file Supabase.", true);
    return;
  }

  if (fileSource === "external" && !externalFileUrl) {
    showToast(
      "Link file eksternal wajib diisi dan harus diawali http:// atau https://.",
      true
    );
    return;
  }

  if (
    fileSource === "supabase" &&
    hasNewFile &&
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    showToast("File harus berformat PDF.", true);
    return;
  }

  setFormBusy(true, id ? "Memperbarui dokumen..." : "Menyimpan dokumen...");

  let uploadedPath = null;
  try {
    const payload = buildDocumentPayload(form);
    payload.file_source = fileSource;
    payload.external_file_url =
      fileSource === "external" ? externalFileUrl : null;
    payload.file_path = original?.file_path || null;
    payload.file_name = original?.file_name || null;

    if (fileSource === "supabase" && hasNewFile) {
      uploadedPath = makeStoragePath(payload, file.name);
      const { error: uploadError } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(uploadedPath, file, {
          cacheControl: "3600",
          contentType: "application/pdf",
          upsert: false
        });
      if (uploadError) throw uploadError;
      payload.file_path = uploadedPath;
      payload.file_name = file.name;
    }

    if (id && original) {
      const { data, error } = await db
        .from("documents")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;

      const logError = await insertLog(
        id,
        "Edit dokumen",
        `Memperbarui dokumen: ${payload.title}`,
        payload
      );
      if (logError) {
        await db.from("documents").update(stripSystemFields(original)).eq("id", id);
        if (uploadedPath) await removeStorageFile(uploadedPath);
        throw logError;
      }

      showToast(`Dokumen "${data.title}" berhasil diperbarui.`);
    } else {
      const { data, error } = await db
        .from("documents")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      const logError = await insertLog(
        data.id,
        "Tambah dokumen",
        `Menambahkan dokumen: ${payload.title}`,
        payload
      );
      if (logError) {
        await db.from("documents").delete().eq("id", data.id);
        if (uploadedPath) await removeStorageFile(uploadedPath);
        throw logError;
      }
      showToast(`Dokumen "${data.title}" berhasil ditambahkan.`);
    }

    state.signedUrls.clear();
    resetEditor();
    await loadDocuments();
    await loadAdminLogs();
  } catch (error) {
    if (uploadedPath) await removeStorageFile(uploadedPath);
    showToast(readableError(error), true);
  } finally {
    setFormBusy(false);
  }
}

function buildDocumentPayload(form) {
  const year = numberOrNull(form.get("year"));

  return {
    document_type: cleanText(form.get("document_type")) || "regulasi",
    title: cleanText(form.get("title")),
    regulation_number: cleanText(form.get("regulation_number")),
    year,
    issuing_body: cleanText(form.get("issuing_body")),
    summary: cleanText(form.get("summary")),
    status: cleanText(form.get("status")) || "Berlaku",
    related_services: cleanText(getSelectedServices().join(", ")),
    related_portfolios: cleanText(getSelectedPortfolios().join(", ")),
    source_url: cleanText(form.get("source_url")),
    file_source: normalizeFileSource(form.get("file_source")),
    external_file_url: cleanText(form.get("external_file_url")),
    last_checked_at: cleanText(form.get("last_checked_at")),
    pic_update: cleanText(form.get("pic_update")) || state.session.user.email,
    notes: cleanText(form.get("notes"))
  };
}

async function insertLog(documentId, actionType, changeNote, payload) {
  const { error } = await db.from("update_logs").insert({
    document_id: documentId,
    action_type: actionType,
    change_note: changeNote,
    source_url: payload.source_url || null,
    pic: payload.pic_update || state.session.user.email
  });
  return error;
}

function renderAdminDocuments() {
  const body = $("#admin-documents-body");
  const documents = safeDocuments();
  if (!documents.length) {
    body.innerHTML = emptyRow(5, "Belum ada dokumen.");
    return;
  }

  body.innerHTML = documents
    .map(
      (doc) => `
        <tr>
          <td>
            <div class="document-title">${escapeHtml(doc.title)}</div>
            <div class="document-meta">${escapeHtml(doc.regulation_number || "-")}</div>
          </td>
          <td>${typeBadge(doc.document_type)}</td>
          <td>${statusBadge(doc.status)}</td>
          <td>${fileSourceIndicator(doc)}</td>
          <td>
            <div class="table-actions">
              <button class="button secondary small" data-edit-id="${doc.id}">Edit</button>
              <button class="button danger small" data-delete-id="${doc.id}">Hapus</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function handleAdminTableAction(event) {
  const editButton = event.target.closest("[data-edit-id]");
  const deleteButton = event.target.closest("[data-delete-id]");
  if (editButton) startEdit(editButton.dataset.editId);
  if (deleteButton) deleteDocument(deleteButton.dataset.deleteId);
}

function startEdit(id) {
  if (!requireAdmin()) return;
  const doc = safeDocuments().find((item) => item.id === id);
  if (!doc) return;

  state.editingId = id;
  const form = $("#document-form");
  Object.entries(doc).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (field && "value" in field) field.value = value ?? "";
  });
  form.elements.id.value = doc.id;
  form.elements.existing_file_path.value = doc.file_path || "";
  form.elements.existing_file_name.value = doc.file_name || "";
  form.elements.file_source.value = getDocumentFileSource(doc);
  form.elements.external_file_url.value = doc.external_file_url || "";
  form.elements.file.required = false;
  setSelectedServices(doc.related_services);
  setSelectedPortfolios(doc.related_portfolios);
  syncFileSourceFields();

  $("#editor-title").textContent = "Edit dokumen";
  $("#editor-description").textContent = `Mengedit: ${doc.title}`;
  $("#save-document").textContent = "Simpan perubahan";
  $("#cancel-edit").classList.remove("hidden");
  $(".editor-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetEditor() {
  state.editingId = null;
  const form = $("#document-form");
  form.reset();
  form.elements.id.value = "";
  form.elements.existing_file_path.value = "";
  form.elements.existing_file_name.value = "";
  form.elements.file.required = false;
  form.elements.file_source.value = "none";
  state.legacyRelatedServices = [];
  state.legacyRelatedPortfolios = [];
  setSelectedServices("");
  setSelectedPortfolios("");
  syncFileSourceFields();
  $("#editor-title").textContent = "Tambah dokumen";
  $("#editor-description").textContent =
    "Simpan metadata dengan PDF Supabase, link eksternal, atau tanpa file.";
  $("#save-document").textContent = "Simpan dokumen";
  $("#cancel-edit").classList.add("hidden");
  $("#form-status").textContent = "";
}

async function deleteDocument(id) {
  if (!requireAdmin()) return;
  const doc = safeDocuments().find((item) => item.id === id);
  if (!doc) return;

  const confirmed = window.confirm(
    `Hapus "${doc.title}"? Metadata akan dihapus dan file Supabase terkait akan dicoba dihapus dari Storage.`
  );
  if (!confirmed) return;

  setLoading(true, "Menghapus dokumen...");
  try {
    const logError = await insertLog(
      doc.id,
      "Hapus dokumen",
      `Menghapus dokumen: ${doc.title}`,
      doc
    );
    if (logError) throw logError;

    const { error } = await db.from("documents").delete().eq("id", doc.id);
    if (error) throw error;

    let storageWarning = "";
    const storagePath = validStoragePath(doc.file_path);
    if (storagePath) {
      const removalError = await removeStorageFile(storagePath);
      if (removalError) storageWarning = " Metadata terhapus, tetapi file perlu dicek manual.";
    }

    if (storagePath) state.signedUrls.delete(storagePath);
    await loadDocuments();
    await loadAdminLogs();
    showToast(`Dokumen berhasil dihapus.${storageWarning}`);
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
  }
}

async function removeStorageFile(path) {
  const storagePath = validStoragePath(path);
  if (!storagePath) return null;
  const { error } = await db.storage.from(STORAGE_BUCKET).remove([storagePath]);
  return error;
}

async function loadAdminLogs() {
  if (!state.session) return;
  const { data, error } = await db
    .from("update_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    $("#update-log-list").innerHTML = `<div class="activity-item"><span class="muted">${escapeHtml(
      readableError(error)
    )}</span></div>`;
    return;
  }

  const container = $("#update-log-list");
  if (!data?.length) {
    container.innerHTML =
      '<div class="activity-item"><span class="muted">Belum ada riwayat perubahan.</span></div>';
    return;
  }

  container.innerHTML = data
    .map(
      (item) => `
        <div class="activity-item">
          <strong>${escapeHtml(item.action_type)}</strong>
          <span>${escapeHtml(item.change_note || "-")}<br><small class="muted">${escapeHtml(
            item.pic || "-"
          )}</small></span>
          <time>${formatDateTime(item.created_at)}</time>
        </div>
      `
    )
    .join("");
}

function handleTableAction(event) {
  const editButton = event.target.closest("[data-edit-id]");
  const detailButton = event.target.closest("[data-detail-id]");
  if (editButton) openDocumentEditor(editButton.dataset.editId);
  if (detailButton) openDocumentDetail(detailButton.dataset.detailId);
}

function handleDetailAction(event) {
  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) openDocumentEditor(editButton.dataset.editId);
}

function openDocumentDetail(documentId) {
  const id = String(documentId || "").trim();
  if (!id) return;
  location.hash = `#document/${encodeURIComponent(id)}`;
}

function openDocumentEditor(documentId) {
  const id = String(documentId || "").trim();
  if (!id) return;

  if (!ensureConfigured()) return;
  if (!state.session?.user) {
    state.pendingEditId = id;
    location.hash = "#admin";
    showToast("Login admin diperlukan untuk mengedit dokumen.", true);
    return;
  }

  location.hash = "#admin";
  window.setTimeout(() => startEdit(id), 0);
}

function renderEmptyApplication(message = "Hubungkan aplikasi ke Supabase untuk memuat data.") {
  state.documents = [];
  state.documentsLoaded = true;
  state.documentsError = null;
  state.serviceCategories = [];
  state.serviceItems = [];
  state.serviceCatalogLoaded = false;
  state.serviceCatalogError = null;
  state.portfolioCategories = [];
  state.portfolioItems = [];
  state.portfolioCatalogLoaded = false;
  state.portfolioCatalogError = null;
  state.selectedPortfolioCategoryId = null;
  state.selectedPortfolioItemCode = null;
  renderAll();
  $("#recent-documents-body").innerHTML = emptyRow(5, message);
  $("#documents-body").innerHTML = emptyRow(4, message);
}

function renderDocumentFetchError(error) {
  state.documents = [];
  renderAll();
  const message = readableError(error);
  $("#recent-documents-body").innerHTML = emptyRow(5, message);
  $("#documents-body").innerHTML = emptyRow(4, message);
}

function ensureConfigured() {
  if (!configured) {
    showToast("Konfigurasi Supabase belum lengkap.", true);
    return false;
  }
  if (db) return true;
  showToast("Koneksi Supabase masih disiapkan. Coba lagi sebentar.", true);
  return false;
}

function requireAdmin() {
  if (!ensureConfigured()) return false;
  if (state.session?.user) return true;
  showToast("Login admin diperlukan untuk melakukan tindakan ini.", true);
  location.hash = "#admin";
  return false;
}

function setLoading(active, message = "Memuat data...") {
  $("#loading-message").textContent = message;
  $("#loading-overlay").classList.toggle("hidden", !active);
}

function setFormBusy(active, message = "") {
  $("#save-document").disabled = active;
  $("#form-status").textContent = active ? message : "";
}

function showToast(message, isError = false) {
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  $("#toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 5200);
}

function makeStoragePath(payload, originalName) {
  const date = new Date().toISOString().slice(0, 10);
  const safeName = slugify(originalName.replace(/\.pdf$/i, "")) || "document";
  const category = slugify(payload.category || "umum");
  return `${payload.document_type}/${category}/${date}_${crypto.randomUUID()}_${safeName}.pdf`;
}

function safeDocuments() {
  return Array.isArray(state.documents) ? state.documents : [];
}

function validStoragePath(value) {
  if (typeof value !== "string") return null;

  const path = value.trim();
  if (!path || path.startsWith("/") || path.startsWith("\\")) return null;
  if (/^https?:\/\//i.test(path) || path.includes("\\") || path.includes("?") || path.includes("#")) {
    return null;
  }

  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return null;
  }

  return path;
}

function validExternalUrl(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function getDocumentFileSource(doc) {
  const declaredSource = String(doc?.file_source || "").trim().toLowerCase();
  const hasStorageFile = Boolean(validStoragePath(doc?.file_path));
  const hasExternalFile = Boolean(validExternalUrl(doc?.external_file_url));

  if (declaredSource === "external") return hasExternalFile ? "external" : "none";
  if (declaredSource === "supabase") return hasStorageFile ? "supabase" : "none";
  if (declaredSource === "none") return "none";
  if (hasExternalFile) return "external";
  if (hasStorageFile) return "supabase";
  return "none";
}

function normalizeFileSource(value, doc = null) {
  const source = String(value || "").trim().toLowerCase();
  if (["supabase", "external", "none"].includes(source)) return source;
  return doc ? getDocumentFileSource(doc) : "none";
}

function splitServices(value) {
  let remaining = String(value || "").trim();
  if (!remaining) return [];

  const knownServices = getServiceEntries()
    .map((entry) => entry.value)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  const services = [];

  while (remaining) {
    remaining = remaining.replace(/^[,;\n|]+\s*/, "");
    if (!remaining) break;

    const lowerRemaining = remaining.toLocaleLowerCase("id-ID");
    const knownService = knownServices.find((service) => {
      const lowerService = service.toLocaleLowerCase("id-ID");
      if (!lowerRemaining.startsWith(lowerService)) return false;
      const nextCharacter = remaining.slice(service.length).trimStart().charAt(0);
      return !nextCharacter || /[,;\n|]/.test(nextCharacter);
    });

    if (knownService) {
      services.push(knownService);
      remaining = remaining.slice(knownService.length);
      continue;
    }

    const separatorIndex = remaining.search(/[,;\n|]/);
    if (separatorIndex === -1) {
      services.push(remaining.trim());
      break;
    }

    services.push(remaining.slice(0, separatorIndex).trim());
    remaining = remaining.slice(separatorIndex + 1);
  }

  return services.filter(Boolean);
}

function sanitizeServiceList(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "").split(/[\n;|]+/);
  const seen = new Set();
  return list
    .map(normalizeServiceName)
    .filter(Boolean)
    .filter((service) => {
      const key = normalizeText(service);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function slugify(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 90);
}

function stripSystemFields(doc) {
  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...payload
  } = doc;
  return payload;
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function typeBadge(type) {
  const badge = {
    regulasi: { label: "Regulasi", className: "regulasi" },
    sop: { label: "SOP", className: "sop" },
    standar: { label: "Standar", className: "standar" }
  }[type] || { label: String(type || "-"), className: "" };
  return `<span class="badge ${badge.className}">${escapeHtml(badge.label)}</span>`;
}

function fileSourceIndicator(doc) {
  const source = getDocumentFileSource(doc);
  const sourceMeta = {
    supabase: { label: "Supabase PDF", className: "supabase" },
    external: { label: "Link Drive/Eksternal", className: "external" },
    none: { label: "Belum ada file", className: "none" }
  }[source];

  return `<span class="file-source-indicator ${sourceMeta.className}">${escapeHtml(
    sourceMeta.label
  )}</span>`;
}

function statusBadge(status) {
  const className =
    status === "Perlu Review"
      ? "review"
      : status === "Dicabut"
        ? "revoked"
        : "";
  return `<span class="badge ${className}">${escapeHtml(status || "-")}</span>`;
}

function metaItem(label, value) {
  return `<div class="meta-item"><span>${escapeHtml(label)}</span>${escapeHtml(
    String(value)
  )}</div>`;
}

function detailField(label, value, trustedHtml = false) {
  const content = value || "-";
  return `<div class="detail-field"><h3>${escapeHtml(label)}</h3><p>${
    trustedHtml ? content : escapeHtml(String(content))
  }</p></div>`;
}

function renderServiceTags(value) {
  const services = splitServices(value);
  if (!services.length) return "-";
  return `<span class="tag-list">${services
    .map((service) => `<span class="service-tag">${escapeHtml(service)}</span>`)
    .join("")}</span>`;
}

function emptyRow(columns, message) {
  return `<tr><td class="empty-state" colspan="${columns}">${escapeHtml(message)}</td></tr>`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function readableError(error) {
  if (!error) return "Terjadi kesalahan yang tidak diketahui.";
  if (error.message) return error.message;
  return String(error);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
