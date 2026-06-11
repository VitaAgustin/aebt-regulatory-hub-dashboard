import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const workspace = path.resolve(import.meta.dirname, "..");
const excludedDirectories = new Set([
  ".git",
  ".next",
  ".npm-cache",
  ".tools",
  "node_modules"
]);
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".env",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ps1",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);
const textFileNames = new Set([".env", ".env.local", ".gitignore"]);
const findings = [];

const secretPrefix = ["sb", "secret"].join("_");
const knownRetiredPassword = ["aebt", "2026"].join("");
const credentialRules = [
  {
    name: "Supabase secret token",
    pattern: new RegExp(`\\b${secretPrefix}_[A-Za-z0-9_-]+`)
  },
  {
    name: "Private key material",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
  },
  {
    name: "Database URL containing credentials",
    pattern:
      /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?)?:?\/\/[^\s:@/]+:[^\s@/]+@/i
  },
  {
    name: "Retired portal password",
    pattern: new RegExp(`\\b${knownRetiredPassword}\\b`, "i")
  }
];
const sensitiveAssignment =
  /^\s*(SUPABASE_SERVICE_ROLE_KEY|DATABASE_PASSWORD|DB_PASSWORD|JWT_SECRET|JWT_SIGNING_SECRET|SECRET_KEY|API_SECRET|ADMIN_PASSWORD)\s*=\s*(.+)\s*$/i;
const placeholderPattern =
  /^(?:["']?)(?:YOUR_|CHANGE_|GANTI_|<|\$\{|REPLACE_)/i;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) {
        files.push(...(await collectFiles(fullPath)));
      }
      continue;
    }

    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (
      textExtensions.has(extension) ||
      textFileNames.has(entry.name) ||
      entry.name.startsWith(".env.")
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function report(filePath, lineNumber, rule) {
  findings.push({
    file: path.relative(workspace, filePath),
    line: lineNumber,
    rule
  });
}

function inspectJwt(filePath, line, lineNumber) {
  const tokens = line.match(
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g
  );
  if (!tokens) return;

  for (const token of tokens) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString("utf8")
      );
      if (payload.role !== "anon") {
        report(filePath, lineNumber, "Non-anon JWT embedded in source");
      }
    } catch {
      report(filePath, lineNumber, "Unrecognized JWT-like token");
    }
  }
}

const files = await collectFiles(workspace);
for (const filePath of files) {
  let content;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    continue;
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    for (const rule of credentialRules) {
      if (rule.pattern.test(line)) report(filePath, lineNumber, rule.name);
    }

    const assignment = line.match(sensitiveAssignment);
    if (assignment) {
      const value = assignment[2].trim();
      if (value && !placeholderPattern.test(value)) {
        report(filePath, lineNumber, `${assignment[1]} contains a value`);
      }
    }

    inspectJwt(filePath, line, lineNumber);
  });
}

const frontendPath = path.join(workspace, "app.js");
const frontend = await readFile(frontendPath, "utf8");
const publicConfigNames = [
  ...frontend.matchAll(
    /\bconst\s+((?:SUPABASE|STORAGE)_[A-Z0-9_]+)\s*=/g
  )
].map((match) => match[1]);
const allowedPublicConfig = new Set([
  "SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "STORAGE_BUCKET"
]);

for (const configName of publicConfigNames) {
  if (!allowedPublicConfig.has(configName)) {
    report(frontendPath, 1, `Unexpected frontend config: ${configName}`);
  }
}

if (findings.length) {
  console.error("Security audit failed. Secret-like material was detected:");
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} (${finding.rule})`
    );
  }
  process.exit(1);
}

console.log(
  `Security audit passed: ${files.length} text files checked; frontend config allowlist verified.`
);
