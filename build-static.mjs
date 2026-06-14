import { cp, mkdir, rm } from "node:fs/promises";

const outputDirectory = new URL("./dist/", import.meta.url);
const staticFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "knowledge-features.js"
];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const fileName of staticFiles) {
  await cp(new URL(`./${fileName}`, import.meta.url), new URL(fileName, outputDirectory));
}

console.log(`Static build complete: ${staticFiles.join(", ")}`);
