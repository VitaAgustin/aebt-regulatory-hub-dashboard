import { cp, mkdir, rm } from "node:fs/promises";

const outputDirectory = new URL("./dist/", import.meta.url);
const assetsDirectory = new URL("./assets/", import.meta.url);
const staticFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "knowledge-features.js",
  "kpi-dashboard.js"
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const fileName of staticFiles) {
  await cp(new URL(`./${fileName}`, import.meta.url), new URL(fileName, outputDirectory));
}

await cp(assetsDirectory, new URL("assets/", outputDirectory), {
  recursive: true
});

console.log(`Static build complete: ${staticFiles.join(", ")}, assets/`);
