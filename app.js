"use strict";

// Public frontend configuration only. Never place a service-role key here.
const SUPABASE_URL = "https://pbfzjtipyqtsamgqemvx.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_X8aX5wtGRpYOCEaOtok1Ug_77MQdP9K";
const STORAGE_BUCKET = "regulatory-files";
const DOCUMENT_CACHE_KEY = "aebt-documents-v1";
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

let db = null;

const state = {
  documents: [],
  documentsLoaded: false,
  documentsError: null,
  serviceCategories: [],
  serviceItems: [],
  serviceCatalogLoaded: false,
  serviceCatalogError: null,
  session: null,
  editingId: null,
  editingServiceCategoryId: null,
  editingServiceItemId: null,
  pendingEditId: null,
  detailRenderToken: 0,
  selectedServiceCategory: null,
  selectedSubServiceName: null,
  legacyRelatedServices: [],
  signedUrls: new Map(),
  documentsPromise: null,
  serviceCatalogPromise: null,
  supabasePromise: null
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  bindEvents();
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
  const authPromise = state.supabasePromise.then(initializeAuth);
  const [authResult, documentsResult, serviceCatalogResult] = await Promise.allSettled([
    authPromise,
    documentsPromise,
    serviceCatalogPromise
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
  if (serviceCatalogResult.status === "rejected") {
    showToast(readableError(serviceCatalogResult.reason), true);
  }
  if (state.session?.user) {
    await loadServiceCatalog({ force: true }).catch(() => {});
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
    if (db) loadServiceCatalog({ force: true }).catch(() => {});
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
  if (path === "/services" || path === "/service-mapping") return "services";
  if (path === "/admin" || path === "/admin/upload") return "admin";

  const documentMatch = location.pathname.match(/^\/documents\/([^/]+)\/?$/i);
  return documentMatch ? `document/${encodeURIComponent(documentMatch[1])}` : null;
}

function bindEvents() {
  window.addEventListener("hashchange", route);

  $("#document-filters").addEventListener("input", renderDocumentTable);
  $("#document-filters").addEventListener("change", renderDocumentTable);
  $("#document-filters").addEventListener("reset", () => {
    window.setTimeout(() => renderDocumentTable(), 0);
  });

  $("#admin-login-form").addEventListener("submit", handleLogin);
  $("#admin-logout").addEventListener("click", handleLogout);
  $("#document-form").addEventListener("submit", handleDocumentSubmit);
  $("#cancel-edit").addEventListener("click", resetEditor);
  $("#service-category-form").addEventListener(
    "submit",
    handleServiceCategorySubmit
  );
  $("#service-item-form").addEventListener("submit", handleServiceItemSubmit);
  $("#cancel-service-category-edit").addEventListener(
    "click",
    resetServiceCategoryForm
  );
  $("#cancel-service-item-edit").addEventListener(
    "click",
    resetServiceItemForm
  );
  $("#related-services-selector").addEventListener(
    "change",
    syncSelectedServicesSummary
  );
  $$("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => switchAdminTab(button.dataset.adminTab));
  });

  $("#documents-body").addEventListener("click", handleTableAction);
  $("#recent-documents-body").addEventListener("click", handleTableAction);
  $("#document-detail").addEventListener("click", handleDetailAction);
  $("#service-mapping-grid").addEventListener("click", handleServiceCardAction);
  $("#service-documents-panel").addEventListener("click", handleServiceDocumentAction);
  $("#admin-documents-body").addEventListener("click", handleAdminTableAction);
  $("#service-manager").addEventListener("click", handleServiceManagerAction);
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
          .from("service_categories")
          .select("id,name,description,is_active,created_at,updated_at")
          .order("name", { ascending: true }),
        db
          .from("service_items")
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
      renderServiceCheckboxesFromDatabase();
      renderServiceMappingFromDatabase();
      renderServiceManager();
      renderMetrics();
      return getServiceCatalog();
    } catch (error) {
      state.serviceCategories = [];
      state.serviceItems = [];
      state.serviceCatalogLoaded = false;
      state.serviceCatalogError = new Error(
        `Gagal memuat katalog layanan: ${readableError(error)}`
      );
      renderServiceCheckboxesFromDatabase();
      renderServiceMappingFromDatabase();
      renderServiceManager();
      renderMetrics();
      throw state.serviceCatalogError;
    } finally {
      state.serviceCatalogPromise = null;
    }
  })();

  return state.serviceCatalogPromise;
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
  $("#documents-body").innerHTML = emptyRow(6, "Memuat dokumen dari Supabase...");
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
  renderServiceMapping();
  renderAdminDocuments();
}

function route() {
  const routeValue = location.hash.replace(/^#/, "") || "home";
  const [routeName, routeId] = routeValue.split("/");
  const normalizedRoute = routeName === "sop" ? "documents" : routeName;

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

  if (routeName === "sop") {
    $("#documents-title").textContent = "SOP Center";
    $("#filter-type").value = "sop";
    $("#filter-type").disabled = true;
    renderDocumentTable();
  } else if (routeName === "documents") {
    $("#documents-title").textContent = "Database Regulasi";
    if ($("#filter-type").disabled) $("#filter-type").value = "";
    $("#filter-type").disabled = false;
    renderDocumentTable();
  } else if (routeName === "document" && routeId) {
    renderDocumentDetail(routeId);
  } else if (routeName === "admin") {
    updateAdminState();
    if (state.session) {
      loadAdminLogs();
      renderServiceManager();
    }
  }

  window.scrollTo({ top: 0, behavior: "auto" });
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
  $("#metric-review").textContent = docs.filter(
    (doc) => doc.status === "Perlu Review"
  ).length;
  $("#metric-services").textContent = getServiceCatalog().length;
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
  const categories = [...new Set(safeDocuments().map((doc) => doc.category).filter(Boolean))]
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
  const isSopRoute = location.hash.startsWith("#sop");
  const query = $("#filter-search").value.trim().toLowerCase();
  const selectedType = isSopRoute ? "sop" : $("#filter-type").value;
  const category = $("#filter-category").value;
  const status = $("#filter-status").value;

  const docs = safeDocuments().filter((doc) => {
    const haystack = [
      doc.title,
      doc.regulation_number,
      doc.summary,
      doc.category,
      doc.related_services
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
    body.innerHTML = emptyRow(6, "Tidak ada dokumen yang sesuai filter.");
    return;
  }

  body.innerHTML = docs
    .map(
      (doc) => `
        <tr>
          <td>
            <div class="document-title">${escapeHtml(doc.title)}</div>
            <div class="document-meta">${escapeHtml(
              doc.regulation_number || String(doc.document_type).toUpperCase()
            )}</div>
          </td>
          <td>${escapeHtml(doc.category || "-")}</td>
          <td>${statusBadge(doc.status)}</td>
          <td>${escapeHtml(doc.related_services || "-")}</td>
          <td>${formatDate(doc.last_checked_at)}</td>
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

function formatServiceValue(categoryName, serviceName) {
  return `${normalizeServiceName(categoryName)} - ${normalizeServiceName(serviceName)}`;
}

function getServiceCatalog({ includeInactive = false } = {}) {
  const categories = (Array.isArray(state.serviceCategories)
    ? state.serviceCategories
    : []
  ).filter((category) => includeInactive || category.is_active);
  const items = Array.isArray(state.serviceItems) ? state.serviceItems : [];

  return categories.map((category) => ({
    ...category,
    category: category.name,
    items: items.filter(
      (item) =>
        item.category_id === category.id && (includeInactive || item.is_active)
    )
  }));
}

function getServiceEntries({ includeInactive = false } = {}) {
  return getServiceCatalog({ includeInactive }).flatMap((category) =>
    category.items.map((item) => ({
      categoryId: category.id,
      category: category.category,
      categoryKey: normalizeText(category.category),
      serviceId: item.id,
      service: item.name,
      serviceKey: normalizeText(item.name),
      value: formatServiceValue(category.category, item.name),
      valueKey: normalizeText(formatServiceValue(category.category, item.name))
    }))
  );
}

function findServiceCategory(categoryName, { includeInactive = false } = {}) {
  const key = normalizeText(categoryName);
  return getServiceCatalog({ includeInactive }).find(
    (category) =>
      category.id === categoryName || normalizeText(category.category) === key
  );
}

function findServiceEntry(
  subServiceName,
  categoryName = state.selectedServiceCategory,
  { includeInactive = false } = {}
) {
  const serviceKey = normalizeText(subServiceName);
  const categoryKey = normalizeText(categoryName);
  return getServiceEntries({ includeInactive }).find(
    (entry) =>
      (entry.serviceId === subServiceName || entry.serviceKey === serviceKey) &&
      (!categoryKey ||
        entry.categoryId === categoryName ||
        entry.categoryKey === categoryKey)
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

  return relatedText.includes(valueKey) || relatedText.includes(serviceKey);
}

function getDocumentsByServiceCategory(categoryName) {
  const category = findServiceCategory(categoryName);
  if (!category) return [];

  return uniqueDocuments(
    safeDocuments().filter((doc) =>
      category.items.some((item) =>
        documentMatchesSubService(doc, category.category, item.name)
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

function renderServiceMapping() {
  renderServiceMappingFromDatabase();
}

function renderServiceMappingFromDatabase() {
  const container = $("#service-mapping-grid");
  const panel = $("#service-documents-panel");
  const catalog = getServiceCatalog();

  if (!state.serviceCatalogLoaded && !state.serviceCatalogError) {
    container.innerHTML =
      '<div class="service-card empty-service"><strong>Memuat katalog layanan...</strong><p>Mengambil kategori dan sub-layanan dari Supabase.</p></div>';
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  if (!catalog.length) {
    container.innerHTML =
      '<div class="service-card empty-service"><strong>Belum ada data layanan.</strong><p>Tambahkan layanan melalui Admin &rarr; Kelola Layanan.</p></div>';
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

  container.innerHTML = catalog.map((category) => {
    const documents = getDocumentsByServiceCategory(category.category);
    const regulationCount = documents.filter(
      (doc) => doc.document_type === "regulasi"
    ).length;
    const sopCount = documents.filter((doc) => doc.document_type === "sop").length;

    return `
      <article class="service-card category-card ${
        state.selectedServiceCategory === category.category ? "active" : ""
      }" data-service-category="${escapeAttribute(category.category)}">
        <small>${category.items.length} sub-layanan</small>
        <strong>${escapeHtml(category.category)}</strong>
        <div class="service-stats">
          <span>${documents.length} dokumen</span>
          <em>${regulationCount} regulasi</em>
          <em>${sopCount} SOP</em>
        </div>
        <p>Regulasi/SOP yang berkaitan dengan kategori ${escapeHtml(
          category.category
        )}.</p>
        <button class="button secondary small" type="button" data-service-category="${escapeAttribute(
          category.category
        )}">Lihat Dokumen</button>
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
    !category.items.some(
      (item) =>
        normalizeText(item.name) === normalizeText(state.selectedSubServiceName)
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
        <p>${categoryDocuments.length} dokumen terkait kategori ini. Pilih sub-layanan untuk melihat daftar regulasi/SOP.</p>
      </div>
    </div>
    <div class="sub-service-grid">
      ${category.items
        .map((item) => {
          const documents = getDocumentsBySubServiceWithCategory(
            item.name,
            category.category
          );
          return `
            <button class="sub-service-card ${
              normalizeText(state.selectedSubServiceName) === normalizeText(item.name)
                ? "active"
                : ""
            }" type="button" data-sub-service="${escapeAttribute(
              item.name
            )}" data-service-category="${escapeAttribute(category.category)}">
              <strong>${escapeHtml(item.name)}</strong>
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

  const storagePath = validStoragePath(doc.file_path);
  $("#detail-updated").textContent = `Diperbarui ${formatDateTime(doc.updated_at)}`;
  container.innerHTML = `
    <article>
      <header class="detail-header">
        <div class="detail-title-row">
          <div>
            ${typeBadge(doc.document_type)}
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

      <div class="detail-columns">
        <section class="detail-section">
          <h2>Substansi regulasi</h2>
          ${detailField("Ringkasan", doc.summary)}
          ${detailField("Kewajiban utama", doc.key_obligation)}
          ${detailField("Pihak terdampak", doc.impacted_party)}
        </section>
        <section class="detail-section">
          <h2>Service mapping</h2>
          ${detailField(
            "Layanan terkait",
            renderServiceTags(doc.related_services),
            true
          )}
          ${detailField("Peluang layanan", doc.service_opportunity)}
          ${detailField("Risiko compliance", doc.compliance_risk)}
          ${detailField("Action point", doc.action_point)}
        </section>
      </div>

      <section class="detail-section pdf-section">
        <div class="section-heading">
          <div>
            <h2>Preview PDF</h2>
            <p>${escapeHtml(storagePath ? doc.file_name || "Dokumen PDF" : "File belum tersedia")}</p>
          </div>
        </div>
        <div id="pdf-preview" class="pdf-placeholder">${
          storagePath ? "Menyiapkan signed URL..." : "File belum tersedia"
        }</div>
      </section>

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
    </article>
  `;

  if (storagePath) await attachSignedUrls(doc, renderToken);
  else showFileUnavailable();
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

function showFileUnavailable() {
  hideFileActions();
  const preview = $("#pdf-preview");
  if (preview) {
    preview.className = "pdf-placeholder";
    preview.textContent = "File belum tersedia";
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
    await Promise.all([loadAdminLogs(), loadServiceCatalog({ force: true })]);
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
  }
}

function switchAdminTab(tabName) {
  const activeTab = tabName === "services" ? "services" : "documents";
  $$("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === activeTab);
  });
  $("#admin-panel-documents").classList.toggle(
    "hidden",
    activeTab !== "documents"
  );
  $("#admin-panel-services").classList.toggle(
    "hidden",
    activeTab !== "services"
  );
  if (activeTab === "services") renderServiceManager();
}

function renderServiceCheckboxes() {
  renderServiceCheckboxesFromDatabase();
}

function renderServiceCheckboxesFromDatabase() {
  const container = $("#related-services-selector");
  if (!container) return;
  const hiddenField = $('#document-form input[name="related_services"]');
  const currentValue = hiddenField?.value || "";
  const catalog = getServiceCatalog();

  if (!state.serviceCatalogLoaded && !state.serviceCatalogError) {
    container.innerHTML =
      '<div class="service-picker-message">Memuat layanan dari Supabase...</div>';
    syncSelectedServicesSummary();
    return;
  }

  if (!catalog.length) {
    container.innerHTML =
      '<div class="service-picker-message">Belum ada data layanan. Tambahkan layanan melalui Admin &rarr; Kelola Layanan.</div>';
    state.legacyRelatedServices = splitServices(currentValue);
    syncSelectedServicesSummary();
    return;
  }

  container.innerHTML = catalog.map((category, index) => `
    <details class="service-accordion" ${index === 0 ? "open" : ""}>
      <summary>
        <span>${escapeHtml(category.category)}</span>
        <small>${category.items.length} layanan</small>
      </summary>
      <div class="service-option-list">
        ${category.items
          .map((item) => {
            const value = formatServiceValue(category.category, item.name);
            return `
              <label class="service-option">
                <input
                  type="checkbox"
                  value="${escapeAttribute(value)}"
                  data-service-id="${escapeAttribute(item.id)}"
                  data-service-category="${escapeAttribute(category.category)}"
                  data-service-name="${escapeAttribute(item.name)}"
                />
                <span>${escapeHtml(item.name)}</span>
              </label>
            `;
          })
          .join("")}
      </div>
    </details>
  `).join("");

  setSelectedServices(currentValue);
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
  const source = String(relatedServicesString || "").trim();
  const sourceKey = normalizeText(source);
  const terms = splitServices(source);
  const checkboxes = $$('#related-services-selector input[type="checkbox"]');
  const entries = getServiceEntries();
  const matchedValues = new Set();
  const matchedEntries = [];
  state.legacyRelatedServices = [];

  checkboxes.forEach((input) => {
    input.checked = false;
  });

  entries.forEach((entry) => {
    if (
      sourceKey.includes(entry.valueKey) ||
      sourceKey.includes(entry.serviceKey)
    ) {
      matchedValues.add(entry.valueKey);
      matchedEntries.push(entry);
    }
  });

  terms.forEach((term) => {
    const termKey = normalizeText(term);
    const isKnownFragment = matchedEntries.some(
      (entry) =>
        entry.valueKey.includes(termKey) ||
        entry.serviceKey.includes(termKey) ||
        termKey.includes(entry.serviceKey)
    );
    if (term && !isKnownFragment) state.legacyRelatedServices.push(term);
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

function renderServiceManager() {
  const container = $("#service-manager");
  const categorySelect = $("#service-item-category");
  if (!container || !categorySelect) return;

  const previousCategory = categorySelect.value;
  const catalog = getServiceCatalog({ includeInactive: true });
  categorySelect.innerHTML = catalog.length
    ? catalog
        .map(
          (category) => `
            <option value="${escapeAttribute(category.id)}">
              ${escapeHtml(category.category)}${category.is_active ? "" : " (Nonaktif)"}
            </option>
          `
        )
        .join("")
    : '<option value="">Belum ada kategori</option>';
  categorySelect.disabled = !catalog.length;
  if (catalog.some((category) => category.id === previousCategory)) {
    categorySelect.value = previousCategory;
  }

  if (!state.serviceCatalogLoaded && !state.serviceCatalogError) {
    container.innerHTML =
      '<div class="empty-state">Memuat katalog layanan dari Supabase...</div>';
    return;
  }

  if (state.serviceCatalogError) {
    container.innerHTML = `
      <div class="manager-alert">
        <strong>Katalog layanan belum dapat dimuat.</strong>
        <p>${escapeHtml(readableError(state.serviceCatalogError))}</p>
        <p>Jalankan file supabase-service-catalog.sql melalui SQL Editor Supabase.</p>
      </div>
    `;
    return;
  }

  if (!catalog.length) {
    container.innerHTML =
      '<div class="empty-state">Belum ada data layanan. Tambahkan kategori melalui form di atas.</div>';
    return;
  }

  container.innerHTML = catalog
    .map(
      (category) => `
        <article class="manager-category ${category.is_active ? "" : "inactive"}">
          <header>
            <div>
              <div class="manager-title-row">
                <h3>${escapeHtml(category.category)}</h3>
                ${activeStatusBadge(category.is_active)}
              </div>
              <p>${escapeHtml(category.description || "Tanpa deskripsi.")}</p>
            </div>
            <div class="table-actions">
              <button class="button secondary small" type="button"
                data-edit-service-category="${escapeAttribute(category.id)}">Edit</button>
              <button class="button ${category.is_active ? "danger" : "secondary"} small" type="button"
                data-toggle-service-category="${escapeAttribute(category.id)}"
                data-active="${category.is_active}">
                ${category.is_active ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          </header>
          <div class="manager-item-list">
            ${
              category.items.length
                ? category.items
                    .map(
                      (item) => `
                        <div class="manager-item ${item.is_active ? "" : "inactive"}">
                          <div>
                            <div class="manager-title-row">
                              <strong>${escapeHtml(item.name)}</strong>
                              ${activeStatusBadge(item.is_active)}
                            </div>
                            <small>${escapeHtml(item.description || "Tanpa deskripsi.")}</small>
                          </div>
                          <div class="table-actions">
                            <button class="button secondary small" type="button"
                              data-edit-service-item="${escapeAttribute(item.id)}">Edit</button>
                            <button class="button ${item.is_active ? "danger" : "secondary"} small" type="button"
                              data-toggle-service-item="${escapeAttribute(item.id)}"
                              data-active="${item.is_active}">
                              ${item.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          </div>
                        </div>
                      `
                    )
                    .join("")
                : '<div class="empty-state">Belum ada sub-layanan pada kategori ini.</div>'
            }
          </div>
        </article>
      `
    )
    .join("");
}

function activeStatusBadge(isActive) {
  return `<span class="active-status ${isActive ? "active" : "inactive"}">${
    isActive ? "Aktif" : "Nonaktif"
  }</span>`;
}

async function handleServiceCategorySubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;

  const form = new FormData(event.currentTarget);
  const id = cleanText(form.get("id"));
  const payload = {
    name: cleanText(form.get("name")),
    description: cleanText(form.get("description"))
  };
  if (!payload.name) {
    showToast("Nama kategori wajib diisi.", true);
    return;
  }

  setLoading(true, id ? "Memperbarui kategori..." : "Menambahkan kategori...");
  try {
    if (id) await updateServiceCategory(id, payload);
    else await createServiceCategory(payload);
    resetServiceCategoryForm();
    await loadServiceCatalog({ force: true });
    showToast(id ? "Kategori berhasil diperbarui." : "Kategori berhasil ditambahkan.");
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
  }
}

async function createServiceCategory(payload) {
  if (!requireAdmin()) throw new Error("Login admin diperlukan.");
  const { data, error } = await db
    .from("service_categories")
    .insert({ ...payload, is_active: true })
    .select()
    .single();
  if (error) throw error;
  await insertLog(
    null,
    "Tambah kategori layanan",
    `Menambahkan kategori layanan: ${data.name}`,
    {}
  );
  return data;
}

async function updateServiceCategory(id, payload) {
  if (!requireAdmin()) throw new Error("Login admin diperlukan.");
  const { data, error } = await db
    .from("service_categories")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await insertLog(
    null,
    "Edit kategori layanan",
    `Memperbarui kategori layanan: ${data.name}`,
    {}
  );
  return data;
}

async function deactivateServiceCategory(id) {
  return updateServiceCategory(id, { is_active: false });
}

async function handleServiceItemSubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;

  const form = new FormData(event.currentTarget);
  const id = cleanText(form.get("id"));
  const payload = {
    category_id: cleanText(form.get("category_id")),
    name: cleanText(form.get("name")),
    description: cleanText(form.get("description"))
  };
  if (!payload.category_id || !payload.name) {
    showToast("Kategori dan nama sub-layanan wajib diisi.", true);
    return;
  }

  setLoading(true, id ? "Memperbarui sub-layanan..." : "Menambahkan sub-layanan...");
  try {
    if (id) await updateServiceItem(id, payload);
    else await createServiceItem(payload);
    resetServiceItemForm();
    await loadServiceCatalog({ force: true });
    showToast(
      id ? "Sub-layanan berhasil diperbarui." : "Sub-layanan berhasil ditambahkan."
    );
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
  }
}

async function createServiceItem(payload) {
  if (!requireAdmin()) throw new Error("Login admin diperlukan.");
  const { data, error } = await db
    .from("service_items")
    .insert({ ...payload, is_active: true })
    .select()
    .single();
  if (error) throw error;
  await insertLog(
    null,
    "Tambah sub-layanan",
    `Menambahkan sub-layanan: ${data.name}`,
    {}
  );
  return data;
}

async function updateServiceItem(id, payload) {
  if (!requireAdmin()) throw new Error("Login admin diperlukan.");
  const { data, error } = await db
    .from("service_items")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await insertLog(
    null,
    "Edit sub-layanan",
    `Memperbarui sub-layanan: ${data.name}`,
    {}
  );
  return data;
}

async function deactivateServiceItem(id) {
  return updateServiceItem(id, { is_active: false });
}

function handleServiceManagerAction(event) {
  const editCategory = event.target.closest("[data-edit-service-category]");
  const toggleCategory = event.target.closest("[data-toggle-service-category]");
  const editItem = event.target.closest("[data-edit-service-item]");
  const toggleItem = event.target.closest("[data-toggle-service-item]");

  if (editCategory) {
    startServiceCategoryEdit(editCategory.dataset.editServiceCategory);
    return;
  }
  if (editItem) {
    startServiceItemEdit(editItem.dataset.editServiceItem);
    return;
  }
  if (toggleCategory) {
    toggleServiceCategoryStatus(
      toggleCategory.dataset.toggleServiceCategory,
      toggleCategory.dataset.active === "true"
    );
    return;
  }
  if (toggleItem) {
    toggleServiceItemStatus(
      toggleItem.dataset.toggleServiceItem,
      toggleItem.dataset.active === "true"
    );
  }
}

function startServiceCategoryEdit(id) {
  const category = state.serviceCategories.find((item) => item.id === id);
  if (!category) return;
  state.editingServiceCategoryId = id;
  const form = $("#service-category-form");
  form.elements.id.value = category.id;
  form.elements.name.value = category.name;
  form.elements.description.value = category.description || "";
  $("#service-category-form-title").textContent = "Edit kategori";
  $("#cancel-service-category-edit").classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetServiceCategoryForm() {
  state.editingServiceCategoryId = null;
  const form = $("#service-category-form");
  form.reset();
  form.elements.id.value = "";
  $("#service-category-form-title").textContent = "Tambah kategori";
  $("#cancel-service-category-edit").classList.add("hidden");
}

function startServiceItemEdit(id) {
  const item = state.serviceItems.find((entry) => entry.id === id);
  if (!item) return;
  state.editingServiceItemId = id;
  const form = $("#service-item-form");
  form.elements.id.value = item.id;
  form.elements.category_id.value = item.category_id;
  form.elements.name.value = item.name;
  form.elements.description.value = item.description || "";
  $("#service-item-form-title").textContent = "Edit sub-layanan";
  $("#cancel-service-item-edit").classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetServiceItemForm() {
  state.editingServiceItemId = null;
  const form = $("#service-item-form");
  form.reset();
  form.elements.id.value = "";
  $("#service-item-form-title").textContent = "Tambah sub-layanan";
  $("#cancel-service-item-edit").classList.add("hidden");
}

async function toggleServiceCategoryStatus(id, isActive) {
  if (!requireAdmin()) return;
  const category = state.serviceCategories.find((item) => item.id === id);
  if (!category) return;
  if (
    isActive &&
    !window.confirm(
      `Nonaktifkan kategori "${category.name}"? Kategori tidak akan tampil untuk publik.`
    )
  ) {
    return;
  }

  setLoading(true, isActive ? "Menonaktifkan kategori..." : "Mengaktifkan kategori...");
  try {
    if (isActive) await deactivateServiceCategory(id);
    else await updateServiceCategory(id, { is_active: true });
    await loadServiceCatalog({ force: true });
    showToast(isActive ? "Kategori dinonaktifkan." : "Kategori diaktifkan.");
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
  }
}

async function toggleServiceItemStatus(id, isActive) {
  if (!requireAdmin()) return;
  const item = state.serviceItems.find((entry) => entry.id === id);
  if (!item) return;
  if (
    isActive &&
    !window.confirm(
      `Nonaktifkan sub-layanan "${item.name}"? Sub-layanan tidak akan tampil untuk publik.`
    )
  ) {
    return;
  }

  setLoading(
    true,
    isActive ? "Menonaktifkan sub-layanan..." : "Mengaktifkan sub-layanan..."
  );
  try {
    if (isActive) await deactivateServiceItem(id);
    else await updateServiceItem(id, { is_active: true });
    await loadServiceCatalog({ force: true });
    showToast(isActive ? "Sub-layanan dinonaktifkan." : "Sub-layanan diaktifkan.");
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
  }
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

async function handleDocumentSubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;

  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const id = cleanText(form.get("id"));
  const original = id ? state.documents.find((doc) => doc.id === id) : null;
  const file = form.get("file");

  if (!id && (!(file instanceof File) || !file.size)) {
    showToast("File PDF wajib dipilih untuk dokumen baru.", true);
    return;
  }

  if (file instanceof File && file.size && file.type !== "application/pdf") {
    showToast("File harus berformat PDF.", true);
    return;
  }

  setFormBusy(true, id ? "Memperbarui dokumen..." : "Mengunggah dokumen...");

  let uploadedPath = null;
  try {
    const payload = buildDocumentPayload(form);

    if (file instanceof File && file.size) {
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
    } else if (original) {
      payload.file_path = original.file_path;
      payload.file_name = original.file_name;
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

      const originalStoragePath = validStoragePath(original.file_path);
      if (uploadedPath && originalStoragePath && originalStoragePath !== uploadedPath) {
        await removeStorageFile(originalStoragePath);
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
    category: cleanText(form.get("category")),
    sub_category: cleanText(form.get("sub_category")),
    summary: cleanText(form.get("summary")),
    key_obligation: cleanText(form.get("key_obligation")),
    impacted_party: cleanText(form.get("impacted_party")),
    status: cleanText(form.get("status")) || "Berlaku",
    related_services: cleanText(getSelectedServices().join(", ")),
    service_opportunity: cleanText(form.get("service_opportunity")),
    compliance_risk: cleanText(form.get("compliance_risk")),
    action_point: cleanText(form.get("action_point")),
    source_url: cleanText(form.get("source_url")),
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
          <td>${escapeHtml(doc.file_name || "-")}</td>
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
  form.elements.file.required = false;
  setSelectedServices(doc.related_services);

  $("#editor-title").textContent = "Edit dokumen";
  $("#editor-description").textContent = `Mengedit: ${doc.title}`;
  $("#save-document").textContent = "Simpan perubahan";
  $("#cancel-edit").classList.remove("hidden");
  $("#file-required-mark").classList.add("hidden");
  $(".editor-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetEditor() {
  state.editingId = null;
  const form = $("#document-form");
  form.reset();
  form.elements.id.value = "";
  form.elements.existing_file_path.value = "";
  form.elements.existing_file_name.value = "";
  form.elements.file.required = true;
  state.legacyRelatedServices = [];
  setSelectedServices("");
  $("#editor-title").textContent = "Tambah dokumen";
  $("#editor-description").textContent =
    "Upload PDF dan simpan metadata ke Supabase.";
  $("#save-document").textContent = "Simpan dokumen";
  $("#cancel-edit").classList.add("hidden");
  $("#file-required-mark").classList.remove("hidden");
  $("#form-status").textContent = "";
}

async function deleteDocument(id) {
  if (!requireAdmin()) return;
  const doc = safeDocuments().find((item) => item.id === id);
  if (!doc) return;

  const confirmed = window.confirm(
    `Hapus "${doc.title}"? Metadata akan dihapus dan file PDF akan dicoba dihapus dari Storage.`
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
  switchAdminTab("documents");
  window.setTimeout(() => startEdit(id), 0);
}

function renderEmptyApplication(message = "Hubungkan aplikasi ke Supabase untuk memuat data.") {
  state.documents = [];
  state.documentsLoaded = true;
  state.documentsError = null;
  state.serviceCategories = [];
  state.serviceItems = [];
  state.serviceCatalogLoaded = true;
  state.serviceCatalogError = null;
  renderAll();
  $("#recent-documents-body").innerHTML = emptyRow(5, message);
  $("#documents-body").innerHTML = emptyRow(6, message);
}

function renderDocumentFetchError(error) {
  state.documents = [];
  renderAll();
  const message = readableError(error);
  $("#recent-documents-body").innerHTML = emptyRow(5, message);
  $("#documents-body").innerHTML = emptyRow(6, message);
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

function splitServices(value) {
  return String(value || "")
    .split(/[,;\n|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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
  const label = type === "sop" ? "SOP" : "Regulasi";
  return `<span class="badge ${type === "sop" ? "sop" : ""}">${label}</span>`;
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
