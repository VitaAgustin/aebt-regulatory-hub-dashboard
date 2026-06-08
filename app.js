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
  session: null,
  editingId: null,
  detailRenderToken: 0,
  selectedServiceKey: null,
  signedUrls: new Map(),
  documentsPromise: null,
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
  const authPromise = state.supabasePromise.then(initializeAuth);
  const [authResult, documentsResult] = await Promise.allSettled([
    authPromise,
    documentsPromise
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

  $("#documents-body").addEventListener("click", handleTableAction);
  $("#recent-documents-body").addEventListener("click", handleTableAction);
  $("#service-mapping-grid").addEventListener("click", handleServiceCardAction);
  $("#service-documents-panel").addEventListener("click", handleServiceDocumentAction);
  $("#admin-documents-body").addEventListener("click", handleAdminTableAction);
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
    if (state.session) loadAdminLogs();
  }

  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderMetrics() {
  const docs = safeDocuments();
  const serviceGroups = getServiceGroups(docs);
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
  $("#metric-services").textContent = serviceGroups.length;
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
          <td><button class="button secondary small" data-detail-id="${doc.id}">Detail</button></td>
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
          <td><button class="button secondary small" data-detail-id="${doc.id}">Detail</button></td>
        </tr>
      `
    )
    .join("");
}

function normalizeServiceName(service) {
  return String(service || "").replace(/\s+/g, " ").trim();
}

function getServiceGroups(documents) {
  const groups = new Map();

  (Array.isArray(documents) ? documents : []).forEach((doc) => {
    splitServices(doc.related_services).forEach((rawService) => {
      const name = normalizeServiceName(rawService);
      if (!name) return;

      const key = name.toLocaleLowerCase("id-ID");
      const current = groups.get(key) || { key, name, docs: [] };
      current.docs.push(doc);
      groups.set(key, current);
    });
  });

  return [...groups.values()].sort(
    (a, b) => b.docs.length - a.docs.length || a.name.localeCompare(b.name, "id")
  );
}

function renderServiceMapping() {
  const items = getServiceGroups(safeDocuments());
  const container = $("#service-mapping-grid");
  const panel = $("#service-documents-panel");

  if (!items.length) {
    container.innerHTML =
      '<div class="service-card empty-service"><strong>Belum ada service mapping</strong><p>Isi field layanan terkait pada dokumen dengan koma, misalnya Kajian EBT, TKDN, Inspeksi Teknis.</p></div>';
    state.selectedServiceKey = null;
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  if (state.selectedServiceKey && !items.some((item) => item.key === state.selectedServiceKey)) {
    state.selectedServiceKey = null;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="service-card ${
          state.selectedServiceKey === item.key ? "active" : ""
        }" data-service-key="${escapeAttribute(item.key)}">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.docs.length} dokumen</span>
          <p>Regulasi/SOP yang berkaitan dengan ${escapeHtml(item.name)}.</p>
          <button class="button secondary small" type="button" data-service-key="${escapeAttribute(
            item.key
          )}">Lihat dokumen</button>
        </article>
      `
    )
    .join("");

  if (state.selectedServiceKey) renderServiceDocuments(state.selectedServiceKey);
  else {
    panel.classList.add("hidden");
    panel.innerHTML = "";
  }
}

function renderServiceDocuments(serviceName) {
  const panel = $("#service-documents-panel");
  const normalized = normalizeServiceName(serviceName);
  const key = normalized.toLocaleLowerCase("id-ID");
  const group = getServiceGroups(safeDocuments()).find(
    (item) => item.key === key || item.name.toLocaleLowerCase("id-ID") === key
  );

  if (!group) {
    state.selectedServiceKey = null;
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  state.selectedServiceKey = group.key;
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>${escapeHtml(group.name)}</h2>
        <p>${group.docs.length} dokumen terkait layanan/jasa ini.</p>
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
          ${group.docs
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
                  <td><button class="button secondary small" type="button" data-detail-id="${escapeAttribute(
                    doc.id
                  )}">Buka Detail</button></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function handleServiceCardAction(event) {
  const target = event.target.closest("[data-service-key]");
  if (!target) return;
  renderServiceDocuments(target.dataset.serviceKey);
  renderServiceMapping();
  $("#service-documents-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleServiceDocumentAction(event) {
  const button = event.target.closest("[data-detail-id]");
  if (button) openDocumentDetail(button.dataset.detailId);
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
          ${detailField("Layanan terkait", doc.related_services)}
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
    await loadAdminLogs();
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
    related_services: cleanText(form.get("related_services")),
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
  const button = event.target.closest("[data-detail-id]");
  if (button) openDocumentDetail(button.dataset.detailId);
}

function openDocumentDetail(documentId) {
  const id = String(documentId || "").trim();
  if (!id) return;
  location.hash = `#document/${encodeURIComponent(id)}`;
}

function renderEmptyApplication(message = "Hubungkan aplikasi ke Supabase untuk memuat data.") {
  state.documents = [];
  state.documentsLoaded = true;
  state.documentsError = null;
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
