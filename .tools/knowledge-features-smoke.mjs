import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const workspace = path.resolve(import.meta.dirname, "..");
const toolsDir = path.join(workspace, ".tools");
const edgePath =
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const serverUrl = "http://127.0.0.1:4173";
const debugPort = 10100 + Math.floor(Math.random() * 200);
const profilePath = path.join(toolsDir, `edge-knowledge-${Date.now()}`);

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
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result.value;
}

async function navigate(hash, waitMs = 900) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: `${serverUrl}/` });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await evaluate(`sessionStorage.setItem("aebt_site_unlocked", "true")`);
  await send("Page.reload", { ignoreCache: true });
  await new Promise((resolve) => setTimeout(resolve, 4500));
  await evaluate(`Promise.allSettled(
    [
      state.documentsPromise,
      state.serviceCatalogPromise,
      state.portfolioCatalogPromise,
      state.standardFoldersPromise,
      state.libraryPromise
    ].filter(Boolean)
  )`);
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  });

  await evaluate(`(() => {
    const now = new Date().toISOString();
    const stores = {
      standard_folders: [
        { id: "folder-api", name: "API", description: "API standards", is_active: true, created_at: now, updated_at: now },
        { id: "folder-astm", name: "ASTM", description: "ASTM standards", is_active: true, created_at: now, updated_at: now }
      ],
      library_folders: [
        { id: "folder-poster", name: "Poster", description: "Home posters", is_active: true, created_at: now, updated_at: now },
        { id: "folder-hse", name: "HSE Talk", description: "Safety talks", is_active: true, created_at: now, updated_at: now },
        { id: "folder-training", name: "Materi Training", description: "Training resources", is_active: true, created_at: now, updated_at: now }
      ],
      library_items: [
        {
          id: "poster-image",
          folder_id: "folder-poster",
          title: "Poster Keselamatan",
          description: "Poster smoke untuk Beranda",
          item_type: "poster",
          file_source: "external",
          file_path: null,
          file_name: null,
          external_file_url: "https://example.com/poster.png",
          created_at: now,
          updated_at: now,
          created_by: "admin@aebt.local",
          is_active: true
        },
        {
          id: "library-drive",
          folder_id: "folder-hse",
          title: "HSE Talk Google Drive",
          description: "Materi eksternal",
          item_type: "hse_talk",
          file_source: "external",
          file_path: null,
          file_name: null,
          external_file_url: "https://drive.google.com/open?id=Drive_File-123",
          created_at: now,
          updated_at: now,
          created_by: "admin@aebt.local",
          is_active: true
        }
      ],
      file_access_requests: [
        {
          id: "request-1",
          resource_type: "document",
          document_id: "standard-api",
          library_item_id: null,
          requester_name: "Requester Smoke",
          requester_email: "requester@example.com",
          requester_unit: "QA",
          reason: "Audit internal",
          status: "pending",
          admin_note: null,
          requested_at: now,
          reviewed_at: null,
          reviewed_by: null
        }
      ]
    };
    window.__knowledgeWrites = [];
    window.__signedUrlRequests = [];
    const mockResult = (data = null) => Promise.resolve({ data, error: null });
    const tableApi = (table) => ({
      select() {
        return {
          order() {
            return mockResult([...(stores[table] || [])]);
          }
        };
      },
      insert(payload) {
        const rows = Array.isArray(payload) ? payload : [payload];
        rows.forEach((row) => {
          const next = { id: row.id || crypto.randomUUID(), ...row, created_at: row.created_at || now, updated_at: row.updated_at || now };
          stores[table] ||= [];
          stores[table].push(next);
          window.__knowledgeWrites.push({ action: "insert", table, payload: next });
        });
        return mockResult(rows);
      },
      update(payload) {
        return {
          eq(field, value) {
            const record = (stores[table] || []).find((item) => item[field] === value);
            if (record) Object.assign(record, payload);
            window.__knowledgeWrites.push({ action: "update", table, id: value, payload });
            return mockResult(record ? [record] : []);
          }
        };
      }
    });
    db = {
      from: tableApi,
      storage: {
        from() {
          return {
            createSignedUrl: async (filePath, expiresIn, options = null) => {
              window.__signedUrlRequests.push({ filePath, expiresIn, options });
              return {
                data: {
                  signedUrl: options?.download
                    ? "https://example.com/download.pdf"
                    : "https://example.com/preview.pdf"
                },
                error: null
              };
            },
            upload: async () => ({ error: null }),
            remove: async () => ({ error: null })
          };
        }
      },
      auth: {
        signOut: async () => {
          window.__adminSignedOut = true;
          return { error: null };
        }
      }
    };
    state.standardFolders = stores.standard_folders;
    state.standardFoldersLoaded = true;
    state.standardFoldersError = null;
    state.libraryFolders = stores.library_folders;
    state.libraryItems = stores.library_items;
    state.libraryLoaded = true;
    state.libraryError = null;
    state.accessRequests = stores.file_access_requests;
    state.accessRequestsLoaded = true;
    state.session = { user: { email: "admin@aebt.local" } };
    state.documents = [
      {
        id: "regulation-file",
        document_type: "regulasi",
        title: "Regulation Supabase Smoke",
        regulation_number: "REG-SMOKE",
        year: 2026,
        issuing_body: "AEBT",
        category: "Regulasi",
        status: "Berlaku",
        file_source: "supabase",
        file_path: "regulasi/smoke/regulation.pdf",
        file_name: "regulation.pdf",
        created_at: now,
        updated_at: now
      },
      {
        id: "standard-api",
        document_type: "standar",
        title: "API Standard Smoke",
        regulation_number: "API-SMOKE",
        year: 2026,
        issuing_body: "API",
        category: "Technical Standard",
        sub_category: "Inspection",
        summary: "Standard smoke summary",
        key_obligation: "Follow technical requirements",
        impacted_party: "Inspector",
        action_point: "Review annually",
        notes: "Smoke note",
        status: "Berlaku",
        standard_folder_id: "folder-api",
        related_services: "AIM - Risk Based Inspection",
        related_portfolios: "IAPPM 042 - AEB - 2A",
        file_source: "external",
        file_path: null,
        file_name: null,
        external_file_url: "https://drive.google.com/file/d/Drive_File-123/view",
        created_at: now,
        updated_at: now
      },
      {
        id: "sop-smoke",
        document_type: "sop",
        title: "SOP Smoke Detail",
        regulation_number: "SOP-SMOKE",
        year: 2026,
        issuing_body: "AEBT",
        category: "Operational",
        status: "Berlaku",
        file_source: "none",
        file_path: null,
        file_name: null,
        external_file_url: null,
        created_at: now,
        updated_at: now
      },
      {
        id: "standard-uncategorized",
        document_type: "standar",
        title: "Uncategorized Standard",
        regulation_number: "UNCAT",
        status: "Berlaku",
        standard_folder_id: null,
        file_source: "none",
        created_at: now,
        updated_at: now
      }
    ];
    state.documentsLoaded = true;
    state.documentsError = null;
    updateAdminState();
    renderAll();
    return true;
  })()`);

  await evaluate(`(() => {
    state.session = null;
    updateAdminState();
  })()`);

  await navigate("#home", 800);
  const posterHero = await evaluate(`(() => ({
    visible: !document.querySelector("#poster-hero")?.classList.contains("hidden"),
    fallbackHidden: document.querySelector("#home-hero-fallback")?.classList.contains("hidden"),
    slideCount: document.querySelectorAll(".poster-slide").length,
    imageSrc: document.querySelector(".poster-slide.active .poster-media")?.getAttribute("src") || "",
    dotsHidden: document.querySelector("#poster-dots")?.classList.contains("hidden")
  }))()`);

  await navigate("#document/sop-smoke", 800);
  const sopDetail = await evaluate(`(() => ({
    activeMenu: document.querySelector(".main-nav a.active")?.textContent.trim(),
    backText: document.querySelector("#detail-back-link")?.textContent.trim(),
    topbarTitle: document.querySelector("#topbar-title")?.textContent.trim()
  }))()`);

  await navigate("#document/regulation-file", 1400);
  const regulationDownload = await evaluate(`(async () => {
    const button = document.querySelector("#document-detail [data-direct-download]");
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      iframe: document.querySelector(".large-preview-frame")?.src || "",
      activeMenu: document.querySelector(".main-nav a.active")?.textContent.trim(),
      backText: document.querySelector("#detail-back-link")?.textContent.trim(),
      requestVisible: Boolean(document.querySelector("#document-detail [data-request-download]")),
      directVisible: Boolean(button),
      label: button?.textContent.trim() || "",
      downloadSigned: window.__signedUrlRequests.some((entry) => entry.options?.download === "regulation.pdf")
    };
  })()`);

  await evaluate(`(() => {
    const now = new Date().toISOString();
    state.standardFolders = [
      { id: "folder-api", name: "API", description: "API standards", is_active: true, created_at: now, updated_at: now },
      { id: "folder-astm", name: "ASTM", description: "ASTM standards", is_active: true, created_at: now, updated_at: now }
    ];
    state.standardFoldersLoaded = true;
    state.standardFoldersError = null;
    renderAll();
  })()`);
  await navigate("#standar");
  const standards = await evaluate(`(() => {
    const apiCard = document.querySelector('[data-standard-folder="folder-api"]');
    apiCard?.querySelector("button")?.click();
    return {
      cards: document.querySelectorAll("[data-standard-folder]").length,
      apiCount: apiCard?.textContent,
      selectedTitles: Array.from(document.querySelectorAll("#standard-folder-documents .document-title")).map((node) => node.textContent.trim()),
      tableHidden: document.querySelector("#document-library-table-view")?.classList.contains("hidden")
    };
  })()`);

  await navigate("#document/standard-api", 1400);
  const documentPreview = await evaluate(`(() => ({
    iframe: document.querySelector(".large-preview-frame")?.src || "",
    previewHeight: document.querySelector(".resource-preview")?.getBoundingClientRect().height || 0,
    requestVisible: Boolean(document.querySelector("[data-request-download]")),
    directActionVisible: Boolean(document.querySelector("[data-direct-download], [data-open-external]")),
    directDownload: /Download PDF|Buka File|Open in New Tab/.test(document.querySelector("#document-detail")?.textContent || ""),
    metadata: document.querySelector(".knowledge-metadata-card")?.textContent || "",
    sourceLabel: document.querySelector(".preview-source-status")?.textContent || "",
    activeMenu: document.querySelector(".main-nav a.active")?.textContent.trim(),
    backText: document.querySelector("#detail-back-link")?.textContent.trim(),
    topbarTitle: document.querySelector("#topbar-title")?.textContent.trim()
  }))()`);

  await evaluate(`(async () => {
    document.querySelector("[data-request-download]")?.click();
    const form = document.querySelector("#download-request-form");
    form.elements.requester_name.value = "Viewer Smoke";
    form.elements.requester_email.value = "viewer@example.com";
    form.elements.requester_unit.value = "Engineering";
    form.elements.reason.value = "Technical review";
    form.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 250));
  })()`);
  const request = await evaluate(`(() => ({
    modalHidden: document.querySelector("#download-request-modal")?.classList.contains("hidden"),
    inserts: window.__knowledgeWrites.filter((item) => item.table === "file_access_requests" && item.action === "insert"),
    policyTextPresent: document.querySelector(".request-policy-note")?.textContent.includes("direview admin")
  }))()`);

  await evaluate(`(() => {
    const now = new Date().toISOString();
    state.libraryFolders = [
      { id: "folder-hse", name: "HSE Talk", description: "Safety talks", is_active: true, created_at: now, updated_at: now },
      { id: "folder-training", name: "Materi Training", description: "Training resources", is_active: true, created_at: now, updated_at: now }
    ];
    state.libraryItems = [
      {
        id: "library-drive",
        folder_id: "folder-hse",
        title: "HSE Talk Google Drive",
        description: "Materi eksternal",
        item_type: "hse_talk",
        file_source: "external",
        file_path: null,
        file_name: null,
        external_file_url: "https://drive.google.com/open?id=Drive_File-123",
        created_at: now,
        updated_at: now,
        created_by: "admin@aebt.local",
        is_active: true
      }
    ];
    state.libraryLoaded = true;
    state.libraryError = null;
    renderAll();
  })()`);
  await navigate("#library");
  const library = await evaluate(`(() => {
    const card = document.querySelector('[data-library-folder="folder-hse"]');
    card?.querySelector("button")?.click();
    document.querySelector('[data-library-item="library-drive"]')?.click();
    return {
      navLabels: Array.from(document.querySelectorAll(".main-nav a")).map((node) => node.textContent.trim()),
      folderCards: document.querySelectorAll("[data-library-folder]").length,
      itemCards: document.querySelectorAll("[data-library-item]").length,
      hash: location.hash
    };
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 800));
  const libraryPreview = await evaluate(`(() => ({
    iframe: document.querySelector("#library-item-detail .large-preview-frame")?.src || "",
    activeMenu: document.querySelector(".main-nav a.active")?.textContent.trim(),
    topbarTitle: document.querySelector("#topbar-title")?.textContent.trim(),
    requestVisible: Boolean(document.querySelector("#library-item-detail [data-request-download]")),
    directDownload: Boolean(document.querySelector("#library-item-detail [data-direct-download], #library-item-detail [data-open-external]")),
    downloadLabel: document.querySelector("#library-item-detail [data-direct-download], #library-item-detail [data-open-external]")?.textContent.trim() || ""
  }))()`);

  await navigate("#admin");
  const admin = await evaluate(`(async () => {
    state.session = { user: { email: "admin@aebt.local" } };
    updateAdminState();
    const documentForm = document.querySelector("#document-form");
    documentForm.elements.document_type.value = "standar";
    documentForm.elements.document_type.dispatchEvent(new Event("change", { bubbles: true }));
    const standardFieldVisible = !document.querySelector("#standard-folder-field")?.classList.contains("hidden");
    const standardOptions = Array.from(documentForm.elements.standard_folder_id.options).map((option) => option.textContent.trim());

    const standardForm = document.querySelector("#standard-folder-form");
    standardForm.elements.name.value = "Smoke Standard Folder";
    standardForm.elements.description.value = "Smoke standards";
    standardForm.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const libraryFolderForm = document.querySelector("#library-folder-form");
    libraryFolderForm.elements.name.value = "Smoke Library Folder";
    libraryFolderForm.elements.description.value = "Smoke library resources";
    libraryFolderForm.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 200));

    const libraryItemForm = document.querySelector("#library-item-form");
    libraryItemForm.elements.title.value = "Training Smoke";
    libraryItemForm.elements.item_type.value = "training_material";
    libraryItemForm.elements.file_source.value = "none";
    libraryItemForm.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve, 250));

    const note = document.querySelector('[data-request-note="request-1"]');
    if (note) note.value = "Approved for internal review";
    document.querySelector('[data-approve-request="request-1"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const approvedActions = {
      copyEmail: Boolean(document.querySelector('[data-copy-request-email="requester@example.com"]')),
      send: Boolean(document.querySelector('[data-sent-request="request-1"]')),
      adminOpen: Boolean(document.querySelector('[data-open-external][data-resource-id="standard-api"]')),
      adminDownload: Boolean(document.querySelector('[data-direct-download][data-resource-id="standard-api"]'))
    };
    document.querySelector('[data-sent-request="request-1"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const sentVisible = document.querySelector("#access-requests-body")?.textContent.includes("Requester Smoke");

    return {
      standardFieldVisible,
      standardOptions,
      writes: window.__knowledgeWrites,
      approvedActions,
      sentVisible,
      logoutLabel: document.querySelector("#admin-logout")?.textContent.trim(),
      portalVisibleBeforeLogout: !document.querySelector("#portal-app")?.classList.contains("hidden")
    };
  })()`);

  await evaluate(`(async () => {
    document.querySelector("#admin-logout")?.click();
    await new Promise((resolve) => setTimeout(resolve, 150));
  })()`);
  const logout = await evaluate(`(() => ({
    signedOut: window.__adminSignedOut === true,
    sessionCleared: state.session === null,
    portalVisible: !document.querySelector("#portal-app")?.classList.contains("hidden"),
    gateHidden: document.querySelector("#site-access-gate")?.classList.contains("hidden"),
    siteSession: sessionStorage.getItem("aebt_site_unlocked"),
    loginVisible: !document.querySelector("#admin-login-panel")?.classList.contains("hidden")
  }))()`);

  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false
  });
  await writeFile(
    path.join(toolsDir, "knowledge-features-smoke.png"),
    Buffer.from(screenshot.data, "base64")
  );

  const result = {
    posterHero,
    sopDetail,
    regulationDownload,
    standards,
    documentPreview,
    request,
    library,
    libraryPreview,
    admin,
    logout
  };
  console.log(JSON.stringify(result, null, 2));

  if (
    !posterHero.visible ||
    !posterHero.fallbackHidden ||
    posterHero.slideCount < 1 ||
    !/^https?:/.test(posterHero.imageSrc) ||
    (posterHero.slideCount === 1 && !posterHero.dotsHidden) ||
    (posterHero.slideCount > 1 && posterHero.dotsHidden)
  ) {
    throw new Error("Home poster slider did not render Poster folder item.");
  }
  if (
    sopDetail.activeMenu !== "SOP Center" ||
    sopDetail.backText !== "Kembali ke SOP Center" ||
    sopDetail.topbarTitle !== "SOP Center"
  ) {
    throw new Error("SOP document detail did not keep SOP Center active.");
  }
  if (
    !regulationDownload.iframe.includes("preview.pdf") ||
    regulationDownload.activeMenu !== "Database Regulasi" ||
    regulationDownload.backText !== "Kembali ke Database Regulasi" ||
    regulationDownload.requestVisible ||
    !regulationDownload.directVisible ||
    regulationDownload.label !== "Download" ||
    !regulationDownload.downloadSigned
  ) {
    throw new Error("Regulation direct-download flow failed.");
  }
  if (
    standards.cards < 2 ||
    !standards.selectedTitles.includes("API Standard Smoke") ||
    !standards.tableHidden
  ) {
    throw new Error("Standard folder browser failed.");
  }
  if (
    !documentPreview.iframe.endsWith("/file/d/Drive_File-123/preview") ||
    documentPreview.previewHeight < 690 ||
    !documentPreview.requestVisible ||
    documentPreview.directActionVisible ||
    documentPreview.directDownload ||
    !documentPreview.metadata.includes("Standard smoke summary") ||
    !documentPreview.sourceLabel.includes("Google Drive") ||
    documentPreview.activeMenu !== "Data Standar" ||
    documentPreview.backText !== "Kembali ke Data Standar" ||
    documentPreview.topbarTitle !== "Data Standar"
  ) {
    throw new Error("Large Google Drive document preview failed.");
  }
  if (
    !request.modalHidden ||
    request.inserts.length !== 1 ||
    request.inserts[0].payload.status !== "pending" ||
    !request.policyTextPresent
  ) {
    throw new Error("Download request submission failed.");
  }
  if (
    !library.navLabels.includes("Library K3") ||
    library.folderCards < 2 ||
    library.itemCards !== 1 ||
    library.hash !== "#library-item/library-drive" ||
    !libraryPreview.iframe.endsWith("/file/d/Drive_File-123/preview") ||
    libraryPreview.activeMenu !== "Library K3" ||
    libraryPreview.topbarTitle !== "Library K3" ||
    libraryPreview.requestVisible ||
    !libraryPreview.directDownload ||
    libraryPreview.downloadLabel !== "Download"
  ) {
    throw new Error("Library folder or preview flow failed.");
  }
  const inserts = admin.writes.filter((item) => item.action === "insert");
  const approval = admin.writes.find(
    (item) =>
      item.table === "file_access_requests" &&
      item.action === "update" &&
      item.payload.status === "approved"
  );
  const sent = admin.writes.find(
    (item) =>
      item.table === "file_access_requests" &&
      item.action === "update" &&
      item.payload.status === "sent"
  );
  if (
    !admin.standardFieldVisible ||
    !admin.standardOptions.includes("API") ||
    !inserts.some((item) => item.table === "standard_folders") ||
    !inserts.some((item) => item.table === "library_folders") ||
    !inserts.some((item) => item.table === "library_items") ||
    !approval ||
    !sent ||
    !sent.payload.sent_at ||
    sent.payload.sent_by !== "admin@aebt.local" ||
    admin.sentVisible ||
    !admin.approvedActions.copyEmail ||
    !admin.approvedActions.send ||
    !admin.approvedActions.adminOpen ||
    admin.logoutLabel !== "Logout Admin"
  ) {
    throw new Error("Admin managers or approval workflow failed.");
  }
  if (
    !logout.signedOut ||
    !logout.sessionCleared ||
    !logout.portalVisible ||
    !logout.gateHidden ||
    logout.siteSession !== "true" ||
    !logout.loginVisible
  ) {
    throw new Error("Admin logout incorrectly locked the viewer portal.");
  }
} finally {
  socket.close();
  edge.kill();
  server.kill();
}
