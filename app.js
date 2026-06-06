"use strict";

// Public frontend configuration only. Never place a service-role key here.
const SUPABASE_URL = "https://pbfzjtipyqtsamgqemvx.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_X8aX5wtGRpYOCEaOtok1Ug_77MQdP9K";
const STORAGE_BUCKET = "regulatory-files";
const SUPABASE_CLIENT_URL = SUPABASE_URL.trim()
  .replace(/\/rest\/v1\/?$/i, "")
  .replace(/\/+$/, "");

const configured =
  SUPABASE_CLIENT_URL.startsWith("https://") &&
  !SUPABASE_CLIENT_URL.includes("YOUR_PROJECT") &&
  SUPABASE_ANON_KEY.length > 30 &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

const db = configured
  ? window.supabase.createClient(SUPABASE_CLIENT_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

const state = {
  documents: [],
  documentsLoaded: false,
  documentsError: null,
  session: null,
  editingId: null,
  signedUrls: new Map()
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

  if (!configured) {
    $("#config-alert").classList.remove("hidden");
    renderEmptyApplication();
    route();
    return;
  }

  setLoading(true, "Menghubungkan ke Supabase...");
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

    db.auth.onAuthStateChange((_event, nextSession) => {
      state.session = nextSession;
      updateAdminState();
      if (nextSession) loadAdminLogs();
    });
  } catch (error) {
    showToast(`Session admin tidak dapat diperiksa: ${readableError(error)}`, true);
  }

  try {
    await loadDocuments();
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
    route();
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
  $("#admin-documents-body").addEventListener("click", handleAdminTableAction);
}

async function loadDocuments() {
  if (!db) {
    state.documents = [];
    state.documentsLoaded = true;
    state.documentsError = null;
    renderAll();
    return [];
  }

  try {
    const { data, error } = await db
      .from("documents")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    state.documents = Array.isArray(data) ? data : [];
    state.documentsLoaded = true;
    state.documentsError = null;
    renderAll();
    return state.documents;
  } catch (error) {
    const fetchError = new Error(`Gagal memuat data dokumen: ${readableError(error)}`);
    state.documents = [];
    state.documentsLoaded = false;
    state.documentsError = fetchError;
    renderDocumentFetchError(fetchError);
    throw fetchError;
  }
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
  $("#metric-total").textContent = docs.length;
  $("#metric-regulations").textContent = docs.filter(
    (doc) => doc.document_type === "regulasi"
  ).length;
  $("#metric-sops").textContent = docs.filter(
    (doc) => doc.document_type === "sop"
  ).length;
  $("#metric-priority").textContent = docs.filter(
    (doc) => Number(doc.priority_score || 0) >= 16
  ).length;
  $("#metric-review").textContent = docs.filter(
    (doc) => doc.status === "Perlu Review"
  ).length;
}

function loadRecentDocuments() {
  const body = $("#recent-documents-body");
  const rows = safeDocuments().slice(0, 5);

  if (!rows.length) {
    body.innerHTML = emptyRow(6, "Belum ada dokumen.");
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
          <td>${priorityMarkup(doc.priority_score)}</td>
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
    body.innerHTML = emptyRow(7, "Tidak ada dokumen yang sesuai filter.");
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
          <td>${priorityMarkup(doc.priority_score)}</td>
          <td>${formatDate(doc.last_checked_at)}</td>
          <td><button class="button secondary small" data-detail-id="${doc.id}">Detail</button></td>
        </tr>
      `
    )
    .join("");
}

function renderServiceMapping() {
  const services = new Map();

  safeDocuments().forEach((doc) => {
    splitServices(doc.related_services).forEach((service) => {
      const key = service.toLowerCase();
      const current = services.get(key) || { name: service, docs: [] };
      current.docs.push(doc);
      services.set(key, current);
    });
  });

  const items = [...services.values()].sort(
    (a, b) => b.docs.length - a.docs.length || a.name.localeCompare(b.name, "id")
  );
  const container = $("#service-mapping-grid");

  if (!items.length) {
    container.innerHTML =
      '<div class="service-card"><strong>Belum ada service mapping</strong><p>Isi field layanan terkait pada dokumen.</p></div>';
    return;
  }

  container.innerHTML = items
    .map(
      (item) => `
        <article class="service-card">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.docs.length}</span>
          <p>${escapeHtml(
            item.docs
              .slice(0, 3)
              .map((doc) => doc.title)
              .join(" | ")
          )}</p>
        </article>
      `
    )
    .join("");
}

async function renderDocumentDetail(id) {
  const container = $("#document-detail");
  const documentId = String(id || "").trim();

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
          ${metaItem("Relevansi SBU", doc.sbu_relevance || "-")}
          ${metaItem("Priority score", doc.priority_score ? `${doc.priority_score} / 25` : "-")}
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

  if (storagePath) await attachSignedUrls(doc);
  else showFileUnavailable();
}

async function attachSignedUrls(doc) {
  const storagePath = validStoragePath(doc?.file_path);
  if (!storagePath) {
    showFileUnavailable();
    return;
  }

  try {
    let signedUrl = state.signedUrls.get(storagePath);
    if (!signedUrl) {
      const { data, error } = await db.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Supabase tidak mengembalikan signed URL preview.");
      signedUrl = data.signedUrl;
      state.signedUrls.set(storagePath, signedUrl);
    }

    const { data: downloadData, error: downloadError } = await db.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, 3600, {
        download: doc.file_name || "dokumen.pdf"
      });
    if (downloadError) throw downloadError;
    if (!downloadData?.signedUrl) {
      throw new Error("Supabase tidak mengembalikan signed URL download.");
    }

    const openLink = $("#open-file-link");
    openLink.href = signedUrl;
    openLink.classList.remove("hidden");

    const downloadLink = $("#download-file-link");
    downloadLink.href = downloadData.signedUrl;
    downloadLink.classList.remove("hidden");

    $("#pdf-preview").outerHTML = `<iframe class="pdf-frame" src="${escapeAttribute(
      signedUrl
    )}" title="Preview ${escapeAttribute(doc.title)}"></iframe>`;
  } catch (error) {
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
  const priority = numberOrNull(form.get("priority_score"));

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
    sbu_relevance: cleanText(form.get("sbu_relevance")),
    service_opportunity: cleanText(form.get("service_opportunity")),
    compliance_risk: cleanText(form.get("compliance_risk")),
    action_point: cleanText(form.get("action_point")),
    priority_score: priority,
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
  if (button) location.hash = `#document/${button.dataset.detailId}`;
}

function renderEmptyApplication(message = "Hubungkan aplikasi ke Supabase untuk memuat data.") {
  state.documents = [];
  state.documentsLoaded = true;
  state.documentsError = null;
  renderAll();
  $("#recent-documents-body").innerHTML = emptyRow(6, message);
  $("#documents-body").innerHTML = emptyRow(7, message);
}

function renderDocumentFetchError(error) {
  state.documents = [];
  renderAll();
  const message = readableError(error);
  $("#recent-documents-body").innerHTML = emptyRow(6, message);
  $("#documents-body").innerHTML = emptyRow(7, message);
}

function ensureConfigured() {
  if (configured) return true;
  showToast("Konfigurasi Supabase belum lengkap.", true);
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

function priorityMarkup(score) {
  if (!score) return '<span class="muted">Belum dinilai</span>';
  const label =
    score >= 21
      ? "Sangat Tinggi"
      : score >= 16
        ? "Tinggi"
        : score >= 11
          ? "Sedang"
          : "Rendah";
  return `<span class="priority ${score >= 16 ? "high" : ""}">${escapeHtml(label)} (${score})</span>`;
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
