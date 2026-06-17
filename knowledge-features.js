"use strict";

function bindKnowledgeFeatureEvents() {
  $("#standard-folder-grid")?.addEventListener("click", handleStandardFolderClick);
  $("#standard-folder-documents")?.addEventListener("click", handleTableAction);
  $("#library-folder-grid")?.addEventListener("click", handleLibraryFolderClick);
  $("#library-folder-items")?.addEventListener("click", handleLibraryItemClick);
  $("#library-item-detail")?.addEventListener("click", handleKnowledgeDetailAction);
  $("#document-detail")?.addEventListener("click", handleKnowledgeDetailAction);

  $("#download-request-form")?.addEventListener(
    "submit",
    handleDownloadRequestSubmit
  );
  $("#close-download-request")?.addEventListener("click", closeDownloadRequest);
  $("[data-close-request]")?.addEventListener("click", closeDownloadRequest);
  $("#download-request-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "download-request-modal") closeDownloadRequest();
  });

  $("#standard-folder-form")?.addEventListener(
    "submit",
    handleStandardFolderSubmit
  );
  $("#cancel-standard-folder-edit")?.addEventListener(
    "click",
    resetStandardFolderForm
  );
  $("#standard-folder-manager")?.addEventListener(
    "click",
    handleStandardFolderManagerAction
  );

  $("#library-folder-form")?.addEventListener(
    "submit",
    handleLibraryFolderSubmit
  );
  $("#cancel-library-folder-edit")?.addEventListener(
    "click",
    resetLibraryFolderForm
  );
  $("#library-folder-manager")?.addEventListener(
    "click",
    handleLibraryFolderManagerAction
  );

  $("#library-item-form")?.addEventListener("submit", handleLibraryItemSubmit);
  $("#library-item-form")?.addEventListener("change", (event) => {
    if (event.target.name === "file_source") syncLibraryFileSourceFields();
  });
  $("#cancel-library-item-edit")?.addEventListener(
    "click",
    resetLibraryItemForm
  );
  $("#library-items-admin-body")?.addEventListener(
    "click",
    handleLibraryItemManagerAction
  );

  $("#access-requests-body")?.addEventListener(
    "click",
    handleAccessRequestAction
  );
  $("#refresh-access-requests")?.addEventListener("click", () =>
    loadAccessRequests({ force: true })
  );
}

async function loadStandardFolders({ force = false } = {}) {
  if (state.standardFoldersPromise) {
    if (!force) return state.standardFoldersPromise;
    await state.standardFoldersPromise.catch(() => {});
  }

  state.standardFoldersPromise = (async () => {
    try {
      const { data, error } = await db
        .from(STANDARD_FOLDER_TABLE)
        .select("id,name,description,is_active,created_at,updated_at")
        .order("name", { ascending: true });
      if (error) throw error;
      state.standardFolders = Array.isArray(data) ? data : [];
      state.standardFoldersLoaded = true;
      state.standardFoldersError = null;
    } catch (error) {
      state.standardFolders = [];
      state.standardFoldersLoaded = false;
      state.standardFoldersError = new Error(
        `Folder Data Standar belum siap: ${readableError(error)}`
      );
    } finally {
      state.standardFoldersPromise = null;
      populateStandardFolderSelect();
      renderStandardFolderBrowser();
      renderStandardFolderManager();
    }
    return state.standardFolders;
  })();

  return state.standardFoldersPromise;
}

async function loadLibraryCatalog({ force = false } = {}) {
  if (state.libraryPromise) {
    if (!force) return state.libraryPromise;
    await state.libraryPromise.catch(() => {});
  }

  state.libraryPromise = (async () => {
    try {
      const [folderResult, itemResult] = await Promise.all([
        db
          .from(LIBRARY_FOLDER_TABLE)
          .select("id,name,description,is_active,created_at,updated_at")
          .order("name", { ascending: true }),
        db
          .from(LIBRARY_ITEM_TABLE)
          .select("*")
          .order("updated_at", { ascending: false })
      ]);
      if (folderResult.error) throw folderResult.error;
      if (itemResult.error) throw itemResult.error;
      state.libraryFolders = Array.isArray(folderResult.data)
        ? folderResult.data
        : [];
      state.libraryItems = Array.isArray(itemResult.data) ? itemResult.data : [];
      state.libraryLoaded = true;
      state.libraryError = null;
    } catch (error) {
      state.libraryFolders = [];
      state.libraryItems = [];
      state.libraryLoaded = false;
      state.libraryError = new Error(
        `Library belum siap: ${readableError(error)}`
      );
    } finally {
      state.libraryPromise = null;
      renderLibrary();
      renderLibraryManagers();
      populateLibraryFolderSelect();
    }
    return state.libraryItems;
  })();

  return state.libraryPromise;
}

async function loadAccessRequests({ force = false } = {}) {
  if (!state.session?.user || !db) return [];
  if (state.accessRequestsPromise && !force) return state.accessRequestsPromise;

  state.accessRequestsPromise = (async () => {
    try {
      const { data, error } = await db
        .from(FILE_ACCESS_REQUEST_TABLE)
        .select("*")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      state.accessRequests = Array.isArray(data) ? data : [];
      state.accessRequestsLoaded = true;
      renderAccessRequests();
      return state.accessRequests;
    } catch (error) {
      state.accessRequests = [];
      state.accessRequestsLoaded = false;
      const body = $("#access-requests-body");
      if (body) {
        body.innerHTML = emptyRow(
          5,
          `Permintaan download belum siap. Jalankan supabase-file-access-requests.sql. (${readableError(
            error
          )})`
        );
      }
      return [];
    } finally {
      state.accessRequestsPromise = null;
    }
  })();

  return state.accessRequestsPromise;
}

function renderKnowledgeFeatures() {
  populateStandardFolderSelect();
  renderStandardFolderBrowser();
  renderLibrary();
  renderAdminKnowledgeFeatures();
}

function renderAdminKnowledgeFeatures() {
  populateStandardFolderSelect();
  renderStandardFolderManager();
  populateLibraryFolderSelect();
  renderLibraryManagers();
  renderAccessRequests();
  syncStandardFolderField();
  syncLibraryFileSourceFields();
}

function getActiveStandardFolders() {
  return state.standardFolders.filter((folder) => folder.is_active !== false);
}

function getStandardDocuments(folderId = null) {
  return safeDocuments().filter((doc) => {
    if (doc.document_type !== "standar") return false;
    if (folderId === "uncategorized") return !doc.standard_folder_id;
    return doc.standard_folder_id === folderId;
  });
}

function renderStandardFolderBrowser() {
  const grid = $("#standard-folder-grid");
  if (!grid) return;

  if (state.standardFoldersError) {
    grid.innerHTML = migrationEmptyState(
      "Folder Data Standar belum tersedia.",
      "Jalankan supabase-standard-folders.sql di Supabase SQL Editor."
    );
    $("#standard-folder-documents")?.classList.add("hidden");
    return;
  }
  if (!state.standardFoldersLoaded) {
    grid.innerHTML =
      '<div class="empty-state">Memuat folder Data Standar...</div>';
    return;
  }

  const folders = getActiveStandardFolders();
  const cards = folders.map((folder) =>
    folderCard({
      id: folder.id,
      name: folder.name,
      description: folder.description || `Dokumen standar ${folder.name}.`,
      count: getStandardDocuments(folder.id).length,
      buttonLabel: "Lihat standar",
      dataAttribute: "data-standard-folder"
    })
  );
  const uncategorized = getStandardDocuments("uncategorized");
  if (uncategorized.length) {
    cards.push(
      folderCard({
        id: "uncategorized",
        name: "Belum dikategorikan",
        description: "Dokumen standar yang belum dipetakan ke folder.",
        count: uncategorized.length,
        buttonLabel: "Lihat standar",
        dataAttribute: "data-standard-folder"
      })
    );
  }

  grid.innerHTML = cards.length
    ? cards.join("")
    : '<div class="empty-state">Belum ada folder Data Standar aktif.</div>';

  if (
    state.selectedStandardFolderId &&
    (state.selectedStandardFolderId === "uncategorized" ||
      folders.some((folder) => folder.id === state.selectedStandardFolderId))
  ) {
    renderStandardFolderDocuments(state.selectedStandardFolderId);
  } else {
    $("#standard-folder-documents")?.classList.add("hidden");
  }
  $("#documents-count").textContent = `${
    safeDocuments().filter((doc) => doc.document_type === "standar").length
  } dokumen`;
}

function folderCard({
  id,
  name,
  description,
  count,
  buttonLabel,
  dataAttribute
}) {
  return `
    <article class="folder-card" ${dataAttribute}="${escapeAttribute(id)}">
      <span class="folder-card-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v11H3zM3 10h18" /></svg>
      </span>
      <div>
        <h2>${escapeHtml(name)}</h2>
        <p>${escapeHtml(description || "Tanpa deskripsi.")}</p>
      </div>
      <div class="folder-card-footer">
        <strong>${count} item</strong>
        <button class="button secondary small" type="button">${escapeHtml(
          buttonLabel
        )}</button>
      </div>
    </article>
  `;
}

function handleStandardFolderClick(event) {
  const card = event.target.closest("[data-standard-folder]");
  if (!card) return;
  state.selectedStandardFolderId = card.dataset.standardFolder;
  renderStandardFolderBrowser();
  $("#standard-folder-documents")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderStandardFolderDocuments(folderId) {
  const panel = $("#standard-folder-documents");
  if (!panel) return;
  const folder = state.standardFolders.find((item) => item.id === folderId);
  const name = folder?.name || "Belum dikategorikan";
  const documents = getStandardDocuments(folderId);

  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Folder standar</p>
        <h2>${escapeHtml(name)}</h2>
        <p>${documents.length} dokumen standar dalam folder ini.</p>
      </div>
    </div>
    ${renderResourceTable(documents, "Belum ada dokumen standar dalam folder ini.")}
  `;
}

function renderResourceTable(documents, emptyMessage) {
  return `
    <div class="table-frame">
      <table>
        <thead>
          <tr>
            <th>Dokumen</th>
            <th>Nomor / kode</th>
            <th>Status</th>
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
                      doc.issuing_body || "-"
                    )}</div>
                  </td>
                  <td>${escapeHtml(doc.regulation_number || "-")}</td>
                  <td>${statusBadge(doc.status)}</td>
                  <td>${documentRowActions(doc.id, "Buka Detail")}</td>
                </tr>
              `
                  )
                  .join("")
              : emptyRow(4, emptyMessage)
          }
        </tbody>
      </table>
    </div>
  `;
}

function populateStandardFolderSelect() {
  const select = $('#document-form select[name="standard_folder_id"]');
  if (!select) return;
  const previous = select.value;
  const folders = getActiveStandardFolders();
  select.innerHTML = `
    <option value="">Belum dikategorikan</option>
    ${folders
      .map(
        (folder) =>
          `<option value="${escapeAttribute(folder.id)}">${escapeHtml(
            folder.name
          )}</option>`
      )
      .join("")}
  `;
  if (folders.some((folder) => folder.id === previous)) select.value = previous;
}

function syncStandardFolderField() {
  const form = $("#document-form");
  if (!form) return;
  const isStandard = form.elements.document_type?.value === "standar";
  $("#standard-folder-field")?.classList.toggle("hidden", !isStandard);
  if (!isStandard && form.elements.standard_folder_id) {
    form.elements.standard_folder_id.value = "";
  }
}

function renderStandardFolderManager() {
  const container = $("#standard-folder-manager");
  if (!container) return;
  if (state.standardFoldersError) {
    container.innerHTML = migrationEmptyState(
      "Kelola Folder Data Standar belum siap.",
      "Jalankan supabase-standard-folders.sql."
    );
    return;
  }
  if (!state.standardFoldersLoaded) {
    container.innerHTML =
      '<div class="empty-state">Memuat folder standar...</div>';
    return;
  }
  container.innerHTML = state.standardFolders.length
    ? state.standardFolders
        .map((folder) => {
          const count = getStandardDocuments(folder.id).length;
          return managerCard({
            id: folder.id,
            name: folder.name,
            description: folder.description,
            isActive: folder.is_active,
            meta: `${count} dokumen`,
            editAttribute: "data-edit-standard-folder",
            deactivateAttribute: "data-deactivate-standard-folder"
          });
        })
        .join("")
    : '<div class="empty-state">Belum ada folder standar.</div>';
}

async function handleStandardFolderSubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const id = cleanText(data.get("id"));
  const name = cleanText(data.get("name"));
  const description = cleanText(data.get("description"));
  if (!name) return showToast("Nama folder standar wajib diisi.", true);

  const duplicate = state.standardFolders.some(
    (folder) =>
      folder.id !== id && normalizeText(folder.name) === normalizeText(name)
  );
  if (duplicate) {
    return showToast("Folder standar dengan nama tersebut sudah ada.", true);
  }

  setLoading(true, id ? "Memperbarui folder standar..." : "Menyimpan folder standar...");
  try {
    const query = id
      ? db
          .from(STANDARD_FOLDER_TABLE)
          .update({ name, description, updated_at: new Date().toISOString() })
          .eq("id", id)
      : db
          .from(STANDARD_FOLDER_TABLE)
          .insert({ name, description, is_active: true });
    const { error } = await query;
    if (error) throw error;
    resetStandardFolderForm();
    await loadStandardFolders({ force: true });
    showToast(`Folder standar "${name}" berhasil disimpan.`);
  } catch (error) {
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
  }
}

function handleStandardFolderManagerAction(event) {
  const edit = event.target.closest("[data-edit-standard-folder]");
  const deactivate = event.target.closest("[data-deactivate-standard-folder]");
  if (edit) editStandardFolder(edit.dataset.editStandardFolder);
  if (deactivate) deactivateStandardFolder(deactivate.dataset.deactivateStandardFolder);
}

function editStandardFolder(id) {
  if (!requireAdmin()) return;
  const folder = state.standardFolders.find((item) => item.id === id);
  if (!folder) return;
  const form = $("#standard-folder-form");
  form.elements.id.value = folder.id;
  form.elements.name.value = folder.name;
  form.elements.description.value = folder.description || "";
  state.editingStandardFolderId = id;
  $("#cancel-standard-folder-edit").classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetStandardFolderForm() {
  const form = $("#standard-folder-form");
  form?.reset();
  if (form) form.elements.id.value = "";
  state.editingStandardFolderId = null;
  $("#cancel-standard-folder-edit")?.classList.add("hidden");
}

async function deactivateStandardFolder(id) {
  if (!requireAdmin()) return;
  const folder = state.standardFolders.find((item) => item.id === id);
  if (!folder) return;
  const count = getStandardDocuments(id).length;
  const confirmed = window.confirm(
    `Nonaktifkan folder "${folder.name}"? ${
      count
        ? `${count} dokumen tetap tersimpan tetapi folder tidak tampil untuk publik.`
        : "Folder tidak akan tampil untuk publik."
    }`
  );
  if (!confirmed) return;
  try {
    const { error } = await db
      .from(STANDARD_FOLDER_TABLE)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await loadStandardFolders({ force: true });
    showToast("Folder standar dinonaktifkan.");
  } catch (error) {
    showToast(readableError(error), true);
  }
}

function managerCard({
  id,
  name,
  description,
  isActive,
  meta,
  editAttribute,
  deactivateAttribute
}) {
  return `
    <article class="manager-card ${isActive === false ? "inactive" : ""}">
      <div>
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(description || "Tanpa deskripsi.")}</p>
        <small>${escapeHtml(meta || "")}</small>
      </div>
      <div class="table-actions">
        ${activeStatusBadge(isActive !== false)}
        <button class="button secondary small" type="button" ${editAttribute}="${escapeAttribute(
          id
        )}">Edit</button>
        ${
          isActive === false
            ? ""
            : `<button class="button danger small" type="button" ${deactivateAttribute}="${escapeAttribute(
                id
              )}">Nonaktifkan</button>`
        }
      </div>
    </article>
  `;
}

function getActiveLibraryFolders() {
  return state.libraryFolders.filter((folder) => folder.is_active !== false);
}

function getActiveLibraryItems(folderId = null) {
  return state.libraryItems.filter((item) => {
    if (item.is_active === false) return false;
    if (folderId === "uncategorized") return !item.folder_id;
    if (folderId) return item.folder_id === folderId;
    return true;
  });
}

function renderLibrary() {
  const grid = $("#library-folder-grid");
  if (!grid) return;
  const activeItems = getActiveLibraryItems();
  $("#library-count").textContent = `${activeItems.length} item`;

  if (state.libraryError) {
    grid.innerHTML = migrationEmptyState(
      "Library belum tersedia.",
      "Jalankan supabase-library.sql di Supabase SQL Editor."
    );
    $("#library-folder-items")?.classList.add("hidden");
    return;
  }
  if (!state.libraryLoaded) {
    grid.innerHTML = '<div class="empty-state">Memuat Library...</div>';
    return;
  }

  const folders = getActiveLibraryFolders();
  const cards = folders.map((folder) =>
    folderCard({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      count: getActiveLibraryItems(folder.id).length,
      buttonLabel: "Lihat isi",
      dataAttribute: "data-library-folder"
    })
  );
  const uncategorized = getActiveLibraryItems("uncategorized");
  if (uncategorized.length) {
    cards.push(
      folderCard({
        id: "uncategorized",
        name: "Belum dikategorikan",
        description: "Materi yang belum dipetakan ke folder Library.",
        count: uncategorized.length,
        buttonLabel: "Lihat isi",
        dataAttribute: "data-library-folder"
      })
    );
  }
  grid.innerHTML = cards.length
    ? cards.join("")
    : '<div class="empty-state">Belum ada folder Library aktif.</div>';

  if (state.selectedLibraryFolderId) {
    renderLibraryFolderItems(state.selectedLibraryFolderId);
  } else {
    $("#library-folder-items")?.classList.add("hidden");
  }
}

function handleLibraryFolderClick(event) {
  const card = event.target.closest("[data-library-folder]");
  if (!card) return;
  state.selectedLibraryFolderId = card.dataset.libraryFolder;
  renderLibrary();
  $("#library-folder-items")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderLibraryFolderItems(folderId) {
  const panel = $("#library-folder-items");
  if (!panel) return;
  const folder = state.libraryFolders.find((item) => item.id === folderId);
  const items = getActiveLibraryItems(folderId);
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">Library folder</p>
        <h2>${escapeHtml(folder?.name || "Belum dikategorikan")}</h2>
        <p>${items.length} materi dalam folder ini.</p>
      </div>
    </div>
    <div class="library-item-grid">
      ${
        items.length
          ? items.map(renderLibraryItemCard).join("")
          : '<div class="empty-state">Belum ada materi dalam folder ini.</div>'
      }
    </div>
  `;
}

function renderLibraryItemCard(item) {
  return `
    <article class="library-item-card" data-library-item="${escapeAttribute(
      item.id
    )}">
      <div class="library-item-type">${escapeHtml(
        formatLibraryItemType(item.item_type)
      )}</div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description || "Tanpa deskripsi.")}</p>
      <div class="folder-card-footer">
        ${fileSourceIndicator(item)}
        <button class="button secondary small" type="button">Lihat detail</button>
      </div>
    </article>
  `;
}

function handleLibraryItemClick(event) {
  const card = event.target.closest("[data-library-item]");
  if (!card) return;
  location.hash = `#library-item/${encodeURIComponent(card.dataset.libraryItem)}`;
}

function formatLibraryItemType(value) {
  return (
    {
      hse_talk: "HSE Talk",
      poster: "Poster",
      training_material: "Materi Training",
      form: "Form",
      template: "Template",
      campaign: "Campaign",
      toolbox_meeting: "Toolbox Meeting",
      other: "Lainnya"
    }[value] || value || "Materi"
  );
}

async function renderEnhancedDocumentDetail(id) {
  const container = $("#document-detail");
  const documentId = String(id || "").trim();
  const renderToken = ++state.detailRenderToken;
  if (state.documentsError) {
    container.innerHTML = migrationEmptyState(
      "Dokumen belum dapat dimuat.",
      readableError(state.documentsError)
    );
    return;
  }
  if (!state.documentsLoaded) {
    container.innerHTML =
      '<div class="empty-state">Memuat dokumen dari Supabase...</div>';
    return;
  }
  const doc = safeDocuments().find((item) => item.id === documentId);
  if (!doc) {
    container.innerHTML =
      '<div class="empty-state">Dokumen tidak ditemukan.</div>';
    return;
  }

  const source = getDocumentFileSource(doc);
  const hasFile =
    (source === "supabase" && Boolean(validStoragePath(doc.file_path))) ||
    (source === "external" && Boolean(validExternalUrl(doc.external_file_url)));
  const folder = state.standardFolders.find(
    (item) => item.id === doc.standard_folder_id
  );
  $("#detail-updated").textContent = `Diperbarui ${formatDateTime(doc.updated_at)}`;
  container.innerHTML = renderKnowledgeDetail({
    resourceType: "document",
    id: doc.id,
    title: doc.title,
    subtitle: doc.regulation_number || doc.file_name || "-",
    badges: [
      typeBadge(doc.document_type),
      statusBadge(doc.status),
      doc.category
        ? `<span class="badge neutral">${escapeHtml(doc.category)}</span>`
        : "",
      folder
        ? `<span class="badge folder-badge">${escapeHtml(folder.name)}</span>`
        : ""
    ].join(""),
    editButton: `<button class="button secondary" type="button" data-edit-id="${escapeAttribute(
      doc.id
    )}">Edit dokumen</button>`,
    metadata: [
      ["Nomor regulasi / kode", doc.regulation_number],
      ["Tahun", doc.year],
      ["Instansi penerbit", doc.issuing_body],
      ["Kategori", doc.category],
      ["Sub-kategori", doc.sub_category],
      ["Terakhir dicek", formatDate(doc.last_checked_at)]
    ],
    sections: [
      ["Ringkasan", doc.summary],
      ["Kewajiban utama", doc.key_obligation],
      ["Pihak terdampak", doc.impacted_party],
      ["Action point", doc.action_point],
      ["Catatan", doc.notes]
    ],
    services: doc.related_services,
    portfolios: doc.related_portfolios,
    resource: doc,
    source,
    sourceLabel: getFileSourceLabel(source, doc.external_file_url),
    fileName: doc.file_name || getExternalFileLabel(doc.external_file_url),
    hasFile
  });

  await attachResourcePreview(doc, renderToken, "#document-detail");
}

async function renderLibraryItemDetail(id) {
  const container = $("#library-item-detail");
  const itemId = String(id || "").trim();
  const renderToken = ++state.detailRenderToken;
  if (!state.libraryLoaded) {
    container.innerHTML = '<div class="empty-state">Memuat materi Library...</div>';
    return;
  }
  const item = state.libraryItems.find(
    (entry) => entry.id === itemId && entry.is_active !== false
  );
  if (!item) {
    container.innerHTML = '<div class="empty-state">Materi Library tidak ditemukan.</div>';
    return;
  }
  const folder = state.libraryFolders.find((entry) => entry.id === item.folder_id);
  const source = getDocumentFileSource(item);
  const hasFile =
    (source === "supabase" && Boolean(validStoragePath(item.file_path))) ||
    (source === "external" && Boolean(validExternalUrl(item.external_file_url)));
  $("#library-detail-updated").textContent = `Diperbarui ${formatDateTime(
    item.updated_at
  )}`;
  container.innerHTML = renderKnowledgeDetail({
    resourceType: "library",
    id: item.id,
    title: item.title,
    subtitle: formatLibraryItemType(item.item_type),
    badges: [
      `<span class="badge type-library">Library</span>`,
      `<span class="badge neutral">${escapeHtml(
        formatLibraryItemType(item.item_type)
      )}</span>`,
      folder
        ? `<span class="badge folder-badge">${escapeHtml(folder.name)}</span>`
        : ""
    ].join(""),
    editButton: `<button class="button secondary" type="button" data-edit-library-item="${escapeAttribute(
      item.id
    )}">Edit materi</button>`,
    metadata: [
      ["Folder", folder?.name],
      ["Jenis materi", formatLibraryItemType(item.item_type)],
      ["Dibuat oleh", item.created_by],
      ["Dibuat", formatDateTime(item.created_at)]
    ],
    sections: [["Deskripsi", item.description]],
    services: null,
    portfolios: null,
    resource: item,
    source,
    sourceLabel: getFileSourceLabel(source, item.external_file_url),
    fileName: item.file_name || getExternalFileLabel(item.external_file_url),
    hasFile
  });
  await attachResourcePreview(item, renderToken, "#library-item-detail");
}

function renderKnowledgeDetail({
  resourceType,
  id,
  title,
  subtitle,
  badges,
  editButton,
  metadata,
  sections,
  services,
  portfolios,
  resource,
  source,
  sourceLabel,
  fileName,
  hasFile
}) {
  const fileActions = renderResourceFileActions({
    resourceType,
    id,
    title,
    resource,
    source,
    hasFile
  });

  return `
    <article class="knowledge-detail">
      <header class="knowledge-detail-header">
        <div>
          <div class="detail-badge-row">${badges}</div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle || "-")}</p>
        </div>
        <div class="detail-actions">${editButton}</div>
      </header>

      <section class="knowledge-metadata-card">
        <div class="meta-grid">
          ${metadata
            .map(([label, value]) => metaItem(label, value || "-"))
            .join("")}
        </div>
        <div class="knowledge-description-grid">
          ${sections
            .filter(([, value]) => value)
            .map(
              ([label, value]) => `
                <div class="knowledge-description">
                  <h2>${escapeHtml(label)}</h2>
                  <p>${escapeHtml(value)}</p>
                </div>
              `
            )
            .join("")}
        </div>
        ${
          services || portfolios
            ? `
          <div class="relation-grid">
            <div>
              <h2>Layanan Terkait</h2>
              ${renderServiceTags(services)}
            </div>
            <div>
              <h2>Portofolio Terkait</h2>
              ${renderServiceTags(portfolios)}
            </div>
          </div>
        `
            : ""
        }
      </section>

      <section class="large-preview-panel">
        <div class="preview-toolbar">
          <div>
            <strong>${escapeHtml(fileName || "File belum tersedia")}</strong>
            <span class="preview-source-status source-${escapeAttribute(
              source
            )}">${escapeHtml(sourceLabel)}</span>
          </div>
          ${fileActions}
        </div>
        <div id="resource-preview" class="resource-preview">
          ${previewLoadingMessage(source)}
        </div>
      </section>
    </article>
  `;
}

function renderResourceFileActions({
  resourceType,
  id,
  title,
  resource,
  source,
  hasFile
}) {
  if (!hasFile) return "";

  const admin = Boolean(state.session?.user);
  const directAllowed = admin || canViewerDirectDownload(resourceType, resource);
  if (directAllowed) {
    const isExternal = source === "external";
    const label = admin
      ? isExternal
        ? "Buka File Admin"
        : "Download Admin"
      : "Download";
    const actionAttribute = isExternal ? "data-open-external" : "data-direct-download";
    const buttonClass = admin && isExternal ? "button secondary" : "button primary";
    return `<button
      class="${buttonClass}"
      type="button"
      ${actionAttribute}
      data-resource-type="${escapeAttribute(resourceType)}"
      data-resource-id="${escapeAttribute(id)}"
      data-resource-title="${escapeAttribute(title)}"
    >${escapeHtml(label)}</button>`;
  }

  if (requiresDownloadRequest(resourceType, resource)) {
    return `<button
      class="button primary"
      type="button"
      data-request-download
      data-resource-type="${escapeAttribute(resourceType)}"
      data-resource-id="${escapeAttribute(id)}"
      data-resource-title="${escapeAttribute(title)}"
    >Ajukan Download</button>`;
  }

  return "";
}

function canViewerDirectDownload(resourceType, resource) {
  if (resourceType === "library") return true;
  if (resourceType !== "document") return false;
  return normalizeDocumentType(resource?.document_type) === "regulasi";
}

function requiresDownloadRequest(resourceType, resource) {
  if (state.session?.user) return false;
  if (resourceType !== "document") return false;
  return ["sop", "standar"].includes(normalizeDocumentType(resource?.document_type));
}

function normalizeDocumentType(value) {
  return String(value || "").trim().toLowerCase();
}

function previewLoadingMessage(source) {
  if (source === "none") {
    return '<div class="preview-empty-state">File belum tersedia.</div>';
  }
  return '<div class="preview-empty-state">Menyiapkan preview...</div>';
}

function getGoogleDrivePreviewUrl(url) {
  const safeUrl = validExternalUrl(url);
  if (!safeUrl) return null;
  const parsed = new URL(safeUrl);
  if (!/(^|\.)drive\.google\.com$/i.test(parsed.hostname)) return null;

  const filePathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/i);
  const fileId =
    filePathMatch?.[1] ||
    parsed.searchParams.get("id") ||
    (parsed.pathname === "/open" ? parsed.searchParams.get("id") : null);
  if (!fileId || !/^[A-Za-z0-9_-]+$/.test(fileId)) return null;
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

function getEmbeddablePreviewUrl(url) {
  const safeUrl = validExternalUrl(url);
  if (!safeUrl) return null;
  const drivePreview = getGoogleDrivePreviewUrl(safeUrl);
  if (drivePreview) return drivePreview;
  const parsed = new URL(safeUrl);
  const path = parsed.pathname.toLowerCase();
  if (
    path.endsWith(".pdf") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".webp") ||
    parsed.searchParams.get("format")?.toLowerCase() === "pdf"
  ) {
    return parsed.href;
  }
  return null;
}

async function attachResourcePreview(resource, renderToken, containerSelector) {
  if (renderToken !== state.detailRenderToken) return;
  const source = getDocumentFileSource(resource);
  const preview = $("#resource-preview", $(containerSelector));
  if (!preview) return;

  if (source === "none") {
    preview.innerHTML =
      '<div class="preview-empty-state">File belum tersedia.</div>';
    return;
  }

  if (source === "external") {
    const embedUrl = getEmbeddablePreviewUrl(resource.external_file_url);
    if (!embedUrl) {
      preview.innerHTML =
        '<div class="preview-empty-state">Preview tidak tersedia. Ajukan akses atau hubungi admin.</div>';
      return;
    }
    preview.innerHTML = previewFrame(embedUrl, resource.title);
    return;
  }

  const storagePath = validStoragePath(resource.file_path);
  if (!storagePath) {
    preview.innerHTML =
      '<div class="preview-empty-state">File belum tersedia.</div>';
    return;
  }
  try {
    const client = db || (await ensureSupabaseClient());
    let cached = state.signedUrls.get(storagePath);
    let signedUrl = typeof cached === "string" ? cached : cached?.preview;
    if (!signedUrl) {
      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600);
      if (error) throw error;
      signedUrl = data?.signedUrl;
      if (!signedUrl) throw new Error("Signed URL preview tidak tersedia.");
      state.signedUrls.set(storagePath, { preview: signedUrl });
    }
    if (renderToken !== state.detailRenderToken) return;
    preview.innerHTML = previewFrame(signedUrl, resource.title);
  } catch (error) {
    if (renderToken !== state.detailRenderToken) return;
    preview.innerHTML = `<div class="preview-empty-state">Preview tidak dapat dimuat: ${escapeHtml(
      readableError(error)
    )}</div>`;
  }
}

function previewFrame(url, title) {
  return `<iframe
    class="large-preview-frame"
    src="${escapeAttribute(url)}"
    title="Preview ${escapeAttribute(title || "file")}"
    loading="eager"
    referrerpolicy="no-referrer"
    allow="fullscreen"
  ></iframe>`;
}

function getFileSourceLabel(source, externalUrl) {
  if (source === "supabase") return "Supabase";
  if (source === "external") {
    return getGoogleDrivePreviewUrl(externalUrl) ? "Google Drive" : "External";
  }
  return "Belum tersedia";
}

function getExternalFileLabel(url) {
  const safeUrl = validExternalUrl(url);
  if (!safeUrl) return "";
  try {
    const parsed = new URL(safeUrl);
    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname);
  } catch {
    return "Link eksternal";
  }
}

function handleKnowledgeDetailAction(event) {
  const directDownload = event.target.closest("[data-direct-download]");
  const externalOpen = event.target.closest("[data-open-external]");
  const requestButton = event.target.closest("[data-request-download]");
  const libraryEdit = event.target.closest("[data-edit-library-item]");
  if (directDownload) handleDirectResourceDownload(directDownload.dataset, directDownload);
  if (externalOpen) handleExternalResourceOpen(externalOpen.dataset);
  if (requestButton) openDownloadRequest(requestButton.dataset);
  if (libraryEdit) {
    if (!requireAdmin()) return;
    location.hash = "#admin";
    window.setTimeout(
      () => editLibraryItem(libraryEdit.dataset.editLibraryItem),
      0
    );
  }
}

async function handleDirectResourceDownload(dataset, button = null) {
  const resource = resolveActionResource(dataset.resourceType, dataset.resourceId);
  if (!resource) {
    showToast("File tidak ditemukan.", true);
    return;
  }
  if (!state.session?.user && !canViewerDirectDownload(dataset.resourceType, resource)) {
    showToast("Dokumen ini harus diajukan melalui approval download.", true);
    return;
  }

  const source = getDocumentFileSource(resource);
  if (source === "external") {
    handleExternalResourceOpen(dataset);
    return;
  }

  const storagePath = validStoragePath(resource.file_path);
  if (!storagePath) {
    showToast("File belum tersedia.", true);
    return;
  }

  const previousText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "Menyiapkan...";
  }
  try {
    const client = db || (await ensureSupabaseClient());
    const cached = state.signedUrls.get(storagePath);
    const existing = typeof cached === "object" ? cached?.download : null;
    let signedUrl = existing;
    if (!signedUrl) {
      const { data, error } = await client.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 300, {
          download: getDownloadFileName(resource, dataset.resourceTitle)
        });
      if (error) throw error;
      signedUrl = data?.signedUrl;
      if (!signedUrl) throw new Error("Signed URL download tidak tersedia.");
      const nextCache =
        typeof cached === "string" ? { preview: cached } : { ...(cached || {}) };
      nextCache.download = signedUrl;
      state.signedUrls.set(storagePath, nextCache);
    }
    triggerDownload(signedUrl, getDownloadFileName(resource, dataset.resourceTitle));
  } catch (error) {
    showToast(`Download gagal disiapkan: ${readableError(error)}`, true);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText;
    }
  }
}

function handleExternalResourceOpen(dataset) {
  const resource = resolveActionResource(dataset.resourceType, dataset.resourceId);
  if (!resource) {
    showToast("File tidak ditemukan.", true);
    return;
  }
  if (!state.session?.user && !canViewerDirectDownload(dataset.resourceType, resource)) {
    showToast("Link dokumen ini hanya tersedia melalui approval download.", true);
    return;
  }
  const url = validExternalUrl(resource.external_file_url);
  if (!url) {
    showToast("Link file belum tersedia.", true);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function resolveActionResource(resourceType, resourceId) {
  const id = String(resourceId || "").trim();
  if (!id) return null;
  return resourceType === "library"
    ? state.libraryItems.find((item) => item.id === id && item.is_active !== false)
    : safeDocuments().find((doc) => doc.id === id);
}

function getDownloadFileName(resource, fallbackTitle = "document") {
  const rawName =
    resource?.file_name ||
    resource?.title ||
    fallbackTitle ||
    "document";
  const cleanName = String(rawName).replace(/[\\/:*?"<>|]+/g, "_").trim();
  if (!cleanName) return "document.pdf";
  return /\.[a-z0-9]{2,8}$/i.test(cleanName) ? cleanName : `${cleanName}.pdf`;
}

function triggerDownload(url, fileName) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function openDownloadRequest(dataset) {
  const form = $("#download-request-form");
  form.reset();
  form.elements.resource_type.value = dataset.resourceType;
  form.elements.resource_title.value = dataset.resourceTitle;
  form.elements.document_id.value =
    dataset.resourceType === "document" ? dataset.resourceId : "";
  form.elements.library_item_id.value =
    dataset.resourceType === "library" ? dataset.resourceId : "";
  $("#download-request-modal").classList.remove("hidden");
  document.body.classList.add("modal-open");
  window.setTimeout(() => form.elements.requester_name.focus(), 0);
}

function closeDownloadRequest() {
  $("#download-request-modal")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function handleDownloadRequestSubmit(event) {
  event.preventDefault();
  if (!ensureConfigured()) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const payload = {
    resource_type: cleanText(data.get("resource_type")),
    document_id: cleanText(data.get("document_id")) || null,
    library_item_id: cleanText(data.get("library_item_id")) || null,
    requester_name: cleanText(data.get("requester_name")),
    requester_email: cleanText(data.get("requester_email")).toLowerCase(),
    requester_unit: cleanText(data.get("requester_unit")),
    reason: cleanText(data.get("reason")),
    status: "pending"
  };
  if (
    !payload.requester_name ||
    !payload.requester_email ||
    !payload.reason ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.requester_email)
  ) {
    showToast("Lengkapi nama, email valid, dan alasan kebutuhan.", true);
    return;
  }
  if (payload.reason.length > 2000) {
    showToast("Alasan kebutuhan maksimal 2000 karakter.", true);
    return;
  }

  const submit = $("#submit-download-request");
  submit.disabled = true;
  submit.textContent = "Mengirim...";
  try {
    const { error } = await db.from(FILE_ACCESS_REQUEST_TABLE).insert(payload);
    if (error) throw error;
    closeDownloadRequest();
    showToast("Permintaan download berhasil dikirim untuk review admin.");
    if (state.session?.user) loadAccessRequests({ force: true });
  } catch (error) {
    showToast(
      `Permintaan gagal dikirim. Pastikan supabase-file-access-requests.sql sudah dijalankan. ${readableError(
        error
      )}`,
      true
    );
  } finally {
    submit.disabled = false;
    submit.textContent = "Kirim Permintaan";
  }
}

function renderAccessRequests() {
  const body = $("#access-requests-body");
  if (!body) return;
  if (!state.session?.user) {
    body.innerHTML = emptyRow(5, "Login admin diperlukan.");
    return;
  }
  if (!state.accessRequestsLoaded) {
    body.innerHTML = emptyRow(5, "Memuat permintaan download...");
    return;
  }
  body.innerHTML = state.accessRequests.length
    ? state.accessRequests
        .map((request) => {
          const resource = resolveRequestResource(request);
          return `
            <tr>
              <td>
                <strong>${escapeHtml(request.requester_name)}</strong>
                <small>${escapeHtml(request.requester_email)}</small>
                <small>${escapeHtml(request.requester_unit || "-")}</small>
                <small>${formatDateTime(request.requested_at)}</small>
              </td>
              <td>
                <span class="badge neutral">${escapeHtml(
                  request.resource_type === "library" ? "Library" : "Dokumen"
                )}</span>
                <strong>${escapeHtml(resource?.title || "Resource tidak tersedia")}</strong>
              </td>
              <td>${escapeHtml(request.reason || "-")}</td>
              <td>${requestStatusBadge(request.status)}</td>
              <td>
                ${
                  request.status === "pending"
                    ? `
                      <textarea
                        class="request-admin-note"
                        data-request-note="${escapeAttribute(request.id)}"
                        placeholder="Catatan admin"
                      ></textarea>
                      <div class="table-actions">
                        <button class="button primary small" type="button" data-approve-request="${escapeAttribute(
                          request.id
                        )}">Approve</button>
                        <button class="button danger small" type="button" data-reject-request="${escapeAttribute(
                          request.id
                        )}">Reject</button>
                      </div>
                    `
                    : renderReviewedRequestActions(request, resource)
                }
              </td>
            </tr>
          `;
        })
        .join("")
    : emptyRow(5, "Belum ada permintaan download.");
}

function renderReviewedRequestActions(request, resource) {
  const note = `
    <small>${escapeHtml(request.admin_note || "Tanpa catatan.")}</small>
    <small>${escapeHtml(request.reviewed_by || "-")}</small>
  `;
  const emailButton = `<button
    class="button secondary small"
    type="button"
    data-copy-request-email="${escapeAttribute(request.requester_email)}"
  >Salin Email</button>`;

  if (request.status === "rejected") {
    return `${note}<div class="table-actions request-admin-actions">${emailButton}</div>`;
  }

  const fileAction = renderAdminRequestFileAction(request, resource);
  const sentButton =
    request.status === "approved"
      ? `<button
          class="button primary small"
          type="button"
          data-sent-request="${escapeAttribute(request.id)}"
        >Tandai Sudah Dikirim</button>`
      : "";
  return `
    ${note}
    <div class="table-actions request-admin-actions">
      ${emailButton}
      ${fileAction}
      ${sentButton}
    </div>
  `;
}

function renderAdminRequestFileAction(request, resource) {
  if (!resource) return '<small>Resource tidak tersedia.</small>';
  const source = getDocumentFileSource(resource);
  const hasFile =
    (source === "supabase" && Boolean(validStoragePath(resource.file_path))) ||
    (source === "external" && Boolean(validExternalUrl(resource.external_file_url)));
  if (!hasFile) return '<small>File belum tersedia.</small>';

  const resourceType = request.resource_type === "library" ? "library" : "document";
  const actionAttribute = source === "external" ? "data-open-external" : "data-direct-download";
  const label = source === "external" ? "Buka File Admin" : "Download Admin";
  return `<button
    class="button secondary small"
    type="button"
    ${actionAttribute}
    data-resource-type="${escapeAttribute(resourceType)}"
    data-resource-id="${escapeAttribute(resource.id)}"
    data-resource-title="${escapeAttribute(resource.title || "Resource")}"
  >${escapeHtml(label)}</button>`;
}

function resolveRequestResource(request) {
  return request.resource_type === "library"
    ? state.libraryItems.find((item) => item.id === request.library_item_id)
    : safeDocuments().find((doc) => doc.id === request.document_id);
}

function requestStatusBadge(status) {
  const label =
    { pending: "Pending", approved: "Approved", rejected: "Rejected", sent: "Sent" }[status] ||
    status;
  return `<span class="request-status request-${escapeAttribute(
    status
  )}">${escapeHtml(label)}</span>`;
}

function handleAccessRequestAction(event) {
  const approve = event.target.closest("[data-approve-request]");
  const reject = event.target.closest("[data-reject-request]");
  const sent = event.target.closest("[data-sent-request]");
  const copyEmail = event.target.closest("[data-copy-request-email]");
  const directDownload = event.target.closest("[data-direct-download]");
  const externalOpen = event.target.closest("[data-open-external]");
  if (approve) reviewAccessRequest(approve.dataset.approveRequest, "approved");
  if (reject) reviewAccessRequest(reject.dataset.rejectRequest, "rejected");
  if (sent) reviewAccessRequest(sent.dataset.sentRequest, "sent");
  if (copyEmail) copyRequestEmail(copyEmail.dataset.copyRequestEmail);
  if (directDownload) handleDirectResourceDownload(directDownload.dataset, directDownload);
  if (externalOpen) handleExternalResourceOpen(externalOpen.dataset);
}

async function reviewAccessRequest(id, status) {
  if (!requireAdmin()) return;
  const noteField = $(`[data-request-note="${CSS.escape(id)}"]`);
  const adminNote = cleanText(noteField?.value);
  if (status === "rejected" && !adminNote) {
    showToast("Isi catatan admin sebelum menolak permintaan.", true);
    noteField?.focus();
    return;
  }
  try {
    const payload = {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: state.session.user.email || "Admin"
    };
    if (status !== "sent") payload.admin_note = adminNote || null;
    const { error } = await db
      .from(FILE_ACCESS_REQUEST_TABLE)
      .update(payload)
      .eq("id", id);
    if (error) throw error;
    await loadAccessRequests({ force: true });
    showToast(
      status === "approved"
        ? "Permintaan disetujui. Hubungi pemohon sesuai kebijakan internal."
        : status === "sent"
          ? "Permintaan ditandai sudah dikirim."
          : "Permintaan ditolak."
    );
  } catch (error) {
    showToast(readableError(error), true);
  }
}

async function copyRequestEmail(email) {
  const value = String(email || "").trim();
  if (!value) {
    showToast("Email pemohon tidak tersedia.", true);
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    showToast("Email pemohon disalin.");
  } catch {
    const input = document.createElement("input");
    input.value = value;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast("Email pemohon disalin.");
  }
}

function populateLibraryFolderSelect() {
  const select = $('#library-item-form select[name="folder_id"]');
  if (!select) return;
  const previous = select.value;
  const folders = getActiveLibraryFolders();
  select.innerHTML = `
    <option value="">Belum dikategorikan</option>
    ${folders
      .map(
        (folder) =>
          `<option value="${escapeAttribute(folder.id)}">${escapeHtml(
            folder.name
          )}</option>`
      )
      .join("")}
  `;
  if (folders.some((folder) => folder.id === previous)) select.value = previous;
}

function renderLibraryManagers() {
  renderLibraryFolderManager();
  renderLibraryItemsAdmin();
}

function renderLibraryFolderManager() {
  const container = $("#library-folder-manager");
  if (!container) return;
  if (state.libraryError) {
    container.innerHTML = migrationEmptyState(
      "Kelola Library belum siap.",
      "Jalankan supabase-library.sql."
    );
    return;
  }
  if (!state.libraryLoaded) {
    container.innerHTML = '<div class="empty-state">Memuat folder Library...</div>';
    return;
  }
  container.innerHTML = state.libraryFolders.length
    ? state.libraryFolders
        .map((folder) =>
          managerCard({
            id: folder.id,
            name: folder.name,
            description: folder.description,
            isActive: folder.is_active,
            meta: `${state.libraryItems.filter((item) => item.folder_id === folder.id).length} materi`,
            editAttribute: "data-edit-library-folder",
            deactivateAttribute: "data-deactivate-library-folder"
          })
        )
        .join("")
    : '<div class="empty-state">Belum ada folder Library.</div>';
}

function renderLibraryItemsAdmin() {
  const body = $("#library-items-admin-body");
  if (!body) return;
  if (!state.libraryLoaded) {
    body.innerHTML = emptyRow(5, "Memuat materi Library...");
    return;
  }
  body.innerHTML = state.libraryItems.length
    ? state.libraryItems
        .map((item) => {
          const folder = state.libraryFolders.find(
            (entry) => entry.id === item.folder_id
          );
          return `
            <tr class="${item.is_active === false ? "inactive-row" : ""}">
              <td>
                <strong>${escapeHtml(item.title)}</strong>
                <small>${escapeHtml(formatLibraryItemType(item.item_type))}</small>
              </td>
              <td>${escapeHtml(folder?.name || "Belum dikategorikan")}</td>
              <td>${fileSourceIndicator(item)}</td>
              <td>${activeStatusBadge(item.is_active !== false)}</td>
              <td>
                <div class="table-actions">
                  <button class="button secondary small" type="button" data-edit-library-item="${escapeAttribute(
                    item.id
                  )}">Edit</button>
                  ${
                    item.is_active === false
                      ? ""
                      : `<button class="button danger small" type="button" data-deactivate-library-item="${escapeAttribute(
                          item.id
                        )}">Nonaktifkan</button>`
                  }
                </div>
              </td>
            </tr>
          `;
        })
        .join("")
    : emptyRow(5, "Belum ada materi Library.");
}

async function handleLibraryFolderSubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const id = cleanText(data.get("id"));
  const name = cleanText(data.get("name"));
  const description = cleanText(data.get("description"));
  if (!name) return showToast("Nama folder Library wajib diisi.", true);
  const duplicate = state.libraryFolders.some(
    (folder) =>
      folder.id !== id && normalizeText(folder.name) === normalizeText(name)
  );
  if (duplicate) {
    return showToast("Folder Library dengan nama tersebut sudah ada.", true);
  }
  try {
    const query = id
      ? db
          .from(LIBRARY_FOLDER_TABLE)
          .update({ name, description, updated_at: new Date().toISOString() })
          .eq("id", id)
      : db
          .from(LIBRARY_FOLDER_TABLE)
          .insert({ name, description, is_active: true });
    const { error } = await query;
    if (error) throw error;
    resetLibraryFolderForm();
    await loadLibraryCatalog({ force: true });
    showToast(`Folder Library "${name}" berhasil disimpan.`);
  } catch (error) {
    showToast(readableError(error), true);
  }
}

function handleLibraryFolderManagerAction(event) {
  const edit = event.target.closest("[data-edit-library-folder]");
  const deactivate = event.target.closest("[data-deactivate-library-folder]");
  if (edit) editLibraryFolder(edit.dataset.editLibraryFolder);
  if (deactivate) deactivateLibraryFolder(deactivate.dataset.deactivateLibraryFolder);
}

function editLibraryFolder(id) {
  if (!requireAdmin()) return;
  const folder = state.libraryFolders.find((item) => item.id === id);
  if (!folder) return;
  const form = $("#library-folder-form");
  form.elements.id.value = folder.id;
  form.elements.name.value = folder.name;
  form.elements.description.value = folder.description || "";
  state.editingLibraryFolderId = id;
  $("#cancel-library-folder-edit").classList.remove("hidden");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetLibraryFolderForm() {
  const form = $("#library-folder-form");
  form?.reset();
  if (form) form.elements.id.value = "";
  state.editingLibraryFolderId = null;
  $("#cancel-library-folder-edit")?.classList.add("hidden");
}

async function deactivateLibraryFolder(id) {
  if (!requireAdmin()) return;
  const folder = state.libraryFolders.find((item) => item.id === id);
  if (!folder) return;
  const count = state.libraryItems.filter((item) => item.folder_id === id).length;
  const confirmed = window.confirm(
    `Nonaktifkan folder "${folder.name}"? ${
      count
        ? `${count} materi tetap tersimpan dan dapat dipindahkan saat diedit.`
        : "Folder tidak akan tampil untuk publik."
    }`
  );
  if (!confirmed) return;
  try {
    const { error } = await db
      .from(LIBRARY_FOLDER_TABLE)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await loadLibraryCatalog({ force: true });
    showToast("Folder Library dinonaktifkan.");
  } catch (error) {
    showToast(readableError(error), true);
  }
}

function syncLibraryFileSourceFields() {
  const form = $("#library-item-form");
  if (!form) return;
  const source = normalizeFileSource(form.elements.file_source?.value);
  $("#library-supabase-fields")?.classList.toggle("hidden", source !== "supabase");
  $("#library-external-fields")?.classList.toggle("hidden", source !== "external");
  const externalInput = form.elements.external_file_url;
  if (externalInput) externalInput.required = source === "external";
  if (source !== "supabase" && form.elements.file) form.elements.file.value = "";
  const note = $("#library-existing-file-note");
  if (note) {
    note.textContent = form.elements.existing_file_path?.value
      ? "File lama tetap digunakan jika tidak memilih file baru."
      : "Pilih file yang akan diunggah.";
  }
}

async function handleLibraryItemSubmit(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const id = cleanText(form.get("id"));
  const original = id
    ? state.libraryItems.find((item) => item.id === id)
    : null;
  const fileSource = normalizeFileSource(form.get("file_source"), original);
  const externalUrl = validExternalUrl(form.get("external_file_url"));
  const file = form.get("file");
  const hasNewFile = file instanceof File && file.size > 0;
  const oldPath = validStoragePath(original?.file_path);
  if (!cleanText(form.get("title"))) {
    return showToast("Judul materi Library wajib diisi.", true);
  }
  if (fileSource === "external" && !externalUrl) {
    return showToast("Link eksternal harus berupa URL http/https yang valid.", true);
  }
  if (fileSource === "supabase" && !hasNewFile && !oldPath) {
    return showToast("Pilih file untuk diunggah ke Supabase.", true);
  }
  if (hasNewFile && file.size > 50 * 1024 * 1024) {
    return showToast("Ukuran file Library maksimal 50 MB.", true);
  }

  let uploadedPath = null;
  setLoading(true, id ? "Memperbarui materi Library..." : "Menyimpan materi Library...");
  try {
    const payload = {
      folder_id: cleanText(form.get("folder_id")) || null,
      title: cleanText(form.get("title")),
      description: cleanText(form.get("description")),
      item_type: cleanText(form.get("item_type")) || "other",
      file_source: fileSource,
      external_file_url: fileSource === "external" ? externalUrl : null,
      file_path: original?.file_path || null,
      file_name: original?.file_name || null,
      created_by: original?.created_by || state.session.user.email,
      is_active: true,
      updated_at: new Date().toISOString()
    };
    if (fileSource === "supabase" && hasNewFile) {
      uploadedPath = makeLibraryStoragePath(payload, file.name);
      const { error: uploadError } = await db.storage
        .from(STORAGE_BUCKET)
        .upload(uploadedPath, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false
        });
      if (uploadError) throw uploadError;
      payload.file_path = uploadedPath;
      payload.file_name = file.name;
    }
    const query = id
      ? db.from(LIBRARY_ITEM_TABLE).update(payload).eq("id", id)
      : db.from(LIBRARY_ITEM_TABLE).insert(payload);
    const { error } = await query;
    if (error) throw error;
    state.signedUrls.clear();
    resetLibraryItemForm();
    await loadLibraryCatalog({ force: true });
    showToast(`Materi "${payload.title}" berhasil disimpan.`);
  } catch (error) {
    if (uploadedPath) await removeStorageFile(uploadedPath);
    showToast(readableError(error), true);
  } finally {
    setLoading(false);
  }
}

function makeLibraryStoragePath(payload, originalName) {
  const date = new Date().toISOString().slice(0, 10);
  const fileName = originalName || "library-file";
  const extension = fileName.includes(".")
    ? `.${fileName.split(".").pop().toLowerCase()}`
    : "";
  const baseName = extension
    ? fileName.slice(0, -(extension.length))
    : fileName;
  return `library/${date}_${crypto.randomUUID()}_${slugify(baseName) || "file"}${extension}`;
}

function handleLibraryItemManagerAction(event) {
  const edit = event.target.closest("[data-edit-library-item]");
  const deactivate = event.target.closest("[data-deactivate-library-item]");
  if (edit) editLibraryItem(edit.dataset.editLibraryItem);
  if (deactivate) deactivateLibraryItem(deactivate.dataset.deactivateLibraryItem);
}

function editLibraryItem(id) {
  if (!requireAdmin()) return;
  const item = state.libraryItems.find((entry) => entry.id === id);
  if (!item) return;
  const form = $("#library-item-form");
  form.elements.id.value = item.id;
  form.elements.folder_id.value = item.folder_id || "";
  form.elements.title.value = item.title || "";
  form.elements.description.value = item.description || "";
  form.elements.item_type.value = item.item_type || "other";
  form.elements.file_source.value = getDocumentFileSource(item);
  form.elements.external_file_url.value = item.external_file_url || "";
  form.elements.existing_file_path.value = item.file_path || "";
  form.elements.existing_file_name.value = item.file_name || "";
  state.editingLibraryItemId = id;
  $("#save-library-item").textContent = "Simpan perubahan";
  $("#cancel-library-item-edit").classList.remove("hidden");
  syncLibraryFileSourceFields();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetLibraryItemForm() {
  const form = $("#library-item-form");
  form?.reset();
  if (!form) return;
  form.elements.id.value = "";
  form.elements.existing_file_path.value = "";
  form.elements.existing_file_name.value = "";
  form.elements.file_source.value = "none";
  state.editingLibraryItemId = null;
  $("#save-library-item").textContent = "Simpan materi";
  $("#cancel-library-item-edit").classList.add("hidden");
  syncLibraryFileSourceFields();
}

async function deactivateLibraryItem(id) {
  if (!requireAdmin()) return;
  const item = state.libraryItems.find((entry) => entry.id === id);
  if (!item) return;
  if (!window.confirm(`Nonaktifkan materi "${item.title}"? File Storage tidak akan dihapus.`)) {
    return;
  }
  try {
    const { error } = await db
      .from(LIBRARY_ITEM_TABLE)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    await loadLibraryCatalog({ force: true });
    showToast("Materi Library dinonaktifkan.");
  } catch (error) {
    showToast(readableError(error), true);
  }
}

function migrationEmptyState(title, message) {
  return `
    <div class="empty-state migration-empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}
