import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const workspace = path.resolve(import.meta.dirname, "..");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const value = process.argv[index + 1];
  if (value && !value.startsWith("--")) {
    args.set(key, value);
    index += 1;
  } else {
    args.set(key, true);
  }
}

const applyChanges = args.has("--apply");
const sourceDirectory = path.resolve(
  args.get("--source-dir") || path.join(workspace, "..", "up")
);
const optimizedDirectory = path.resolve(
  args.get("--optimized-dir") || path.join(workspace, ".tools", "optimized-pdfs")
);
const manifestPath = path.resolve(
  args.get("--manifest") ||
    path.join(workspace, "data", "regulation-import-2026-06-10.json")
);

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [
          line.slice(0, separator).trim(),
          line
            .slice(separator + 1)
            .trim()
            .replace(/^(['"])(.*)\1$/, "$2")
        ];
      })
  );
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 145);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function findExistingDocument(entry, documents) {
  const match = entry.match || {};
  const fileNames = new Set(
    [entry.file_name, ...(match.file_names || [])].map(normalize)
  );
  const regulationNumbers = new Set(
    [entry.regulation_number, ...(match.regulation_numbers || [])]
      .filter(Boolean)
      .map(normalize)
  );
  const titleContains = normalize(match.title_contains);

  return documents.find((document) => {
    if (fileNames.has(normalize(document.file_name))) return true;
    if (
      regulationNumbers.size &&
      regulationNumbers.has(normalize(document.regulation_number))
    ) {
      return true;
    }
    if (titleContains && normalize(document.title).includes(titleContains)) {
      return true;
    }
    return false;
  });
}

const env = parseEnv(await readFile(path.join(workspace, ".env.local"), "utf8"));
const supabaseUrl = env.SUPABASE_URL?.replace(/\/rest\/v1\/?$/i, "").replace(
  /\/+$/,
  ""
);
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = env.SUPABASE_STORAGE_BUCKET || "regulatory-files";

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum tersedia.");
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const [documentsResult, categoriesResult, itemsResult, portfolioCategoriesResult, portfolioItemsResult] =
  await Promise.all([
    supabase.from("documents").select("*").order("created_at"),
    supabase.from("service_categories").select("id,name,is_active"),
    supabase.from("service_items").select("category_id,name,is_active"),
    supabase.from("portfolio_categories").select("id,code,is_active"),
    supabase.from("portfolio_items").select("category_id,code,is_active")
  ]);

for (const result of [
  documentsResult,
  categoriesResult,
  itemsResult,
  portfolioCategoriesResult,
  portfolioItemsResult
]) {
  if (result.error) throw result.error;
}

const documents = documentsResult.data || [];
const serviceValues = new Set();
for (const category of categoriesResult.data || []) {
  if (!category.is_active) continue;
  for (const item of itemsResult.data || []) {
    if (item.category_id === category.id && item.is_active) {
      serviceValues.add(normalize(`${category.name} - ${item.name}`));
    }
  }
}

const portfolioValues = new Set();
for (const category of portfolioCategoriesResult.data || []) {
  if (!category.is_active) continue;
  for (const item of portfolioItemsResult.data || []) {
    if (item.category_id === category.id && item.is_active) {
      portfolioValues.add(normalize(`${category.code} - ${item.code}`));
    }
  }
}

const plan = [];
for (const entry of manifest) {
  const originalPath = path.join(sourceDirectory, entry.file_name);
  const optimizedPath = path.join(optimizedDirectory, entry.file_name);
  const useOptimized = entry.use_optimized && (await exists(optimizedPath));
  const uploadPath = useOptimized ? optimizedPath : originalPath;
  if (!(await exists(uploadPath))) {
    throw new Error(`File tidak ditemukan: ${uploadPath}`);
  }

  const invalidServices = (entry.related_services || []).filter(
    (value) => !serviceValues.has(normalize(value))
  );
  const invalidPortfolios = (entry.related_portfolios || []).filter(
    (value) => !portfolioValues.has(normalize(value))
  );
  if (invalidServices.length || invalidPortfolios.length) {
    throw new Error(
      `Katalog tidak cocok untuk ${entry.file_name}: ${[
        ...invalidServices,
        ...invalidPortfolios
      ].join(", ")}`
    );
  }

  const existing = findExistingDocument(entry, documents);
  const storagePath =
    existing?.file_path ||
    `documents/imported-2026-06-10-${slugify(entry.file_name)}.pdf`;
  const fileStats = await stat(uploadPath);
  plan.push({
    entry,
    existing,
    uploadPath,
    storagePath,
    sizeMb: Number((fileStats.size / 1024 / 1024).toFixed(2)),
    useOptimized
  });
}

console.log(
  JSON.stringify(
    {
      mode: applyChanges ? "apply" : "dry-run",
      sourceDirectory,
      manifestPath,
      actions: plan.map((item) => ({
        action: item.existing ? "update" : "insert",
        id: item.existing?.id || null,
        title: item.entry.title,
        file: item.entry.file_name,
        sizeMb: item.sizeMb,
        optimized: item.useOptimized,
        storagePath: item.storagePath,
        services: item.entry.related_services.length,
        portfolios: item.entry.related_portfolios.length
      }))
    },
    null,
    2
  )
);

if (!applyChanges) {
  console.log("Dry run selesai. Tambahkan --apply untuk menulis ke Supabase.");
} else {
  let inserted = 0;
  let updated = 0;
  const results = [];

  for (const [index, item] of plan.entries()) {
    const { entry, existing, uploadPath, storagePath } = item;
    console.log(
      `[${index + 1}/${plan.length}] Upload ${entry.file_name} (${item.sizeMb} MB)`
    );
    const fileBuffer = await readFile(uploadPath);
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: true
      });
    if (uploadError) throw uploadError;

    const payload = {
      document_type: entry.document_type,
      title: entry.title,
      regulation_number: entry.regulation_number || null,
      year: entry.year || null,
      issuing_body: entry.issuing_body || null,
      category: entry.category || null,
      summary: entry.summary || null,
      status: entry.status || "Berlaku",
      related_services: (entry.related_services || []).join(", ") || null,
      related_portfolios: (entry.related_portfolios || []).join(", ") || null,
      source_url: entry.source_url || null,
      file_path: storagePath,
      file_name: entry.file_name,
      external_file_url: null,
      file_source: "supabase",
      last_checked_at: "2026-06-10",
      pic_update: "Admin AEBT",
      notes:
        entry.notes ||
        "Diimpor 10 Juni 2026 dari koleksi regulasi AEBT dengan pemetaan layanan dan portofolio."
    };

    let saved;
    if (existing) {
      const { data, error } = await supabase
        .from("documents")
        .update(payload)
        .eq("id", existing.id)
        .select("id,title,document_type,file_path")
        .single();
      if (error) throw error;
      saved = data;
      updated += 1;
    } else {
      const { data, error } = await supabase
        .from("documents")
        .insert(payload)
        .select("id,title,document_type,file_path")
        .single();
      if (error) throw error;
      saved = data;
      documents.push({ ...payload, id: saved.id });
      inserted += 1;
    }

    const { error: logError } = await supabase.from("update_logs").insert({
      document_id: saved.id,
      action_type: existing ? "Import pembaruan regulasi" : "Import regulasi",
      change_note: existing
        ? `Memperbarui metadata, pemetaan, dan PDF: ${entry.title}`
        : `Menambahkan metadata, pemetaan, dan PDF: ${entry.title}`,
      source_url: entry.source_url || null,
      pic: "Admin AEBT"
    });
    if (logError) throw logError;
    results.push(saved);
  }

  console.log(
    JSON.stringify(
      {
        inserted,
        updated,
        processed: results.length,
        documents: results
      },
      null,
      2
    )
  );
}
