/**
 * Verify build artifacts independently of bundler exit status.
 * This catches broken references and accidental publication of source code.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const pages = [
  "index.html", "arena/index.html", "project/index.html",
  "evidence/index.html", "runtime-logbook/index.html",
  "observations/index.html", "models/index.html",
  "enterprise/index.html", "governance/index.html",
  "ai-controls/index.html", "regulatory-alignment/index.html",
  "diagnostics/index.html", "holding/index.html",
  "coding-assistant/index.html", "medical-analyst-assistant/index.html",
  "financial-risk-analyst/index.html",
  "logistics-management-assistant/index.html",
  "aviation-travel-assistant/index.html", "execution-pass/index.html",
];

const missing = [];
for (const filename of pages) {
  const html = await readFile(join(root, filename), "utf8");
  if (!html.includes('<script type="module" src="/assets/src-main-v2-jsx.js">')) {
    missing.push(filename + ": no compiled main module");
  }
  if (!html.includes('<script type="module" src="/assets/src-floating-chat-js.js">')) {
    missing.push(filename + ": no compiled floating chat module");
  }
  if (!html.includes('href="/src/neutral-theme.css"')) {
    missing.push(filename + ": missing neutral theme");
  }
  if (!html.includes('href="/src/styles.css"')) {
    missing.push(filename + ": missing dynamically imported React styles");
  }
  if (!html.includes('href="/src/floating-chat.css"')) {
    missing.push(filename + ": missing floating chat styles");
  }
  if (/src="\/src\/[^"]+\.(?:js|jsx)"/.test(html)) {
    missing.push(filename + ": raw script reference remains");
  }
  for (const href of html.matchAll(/(?:src|href)="(\/(?:src|assets)\/[^"]+)"/g)) {
    const output = resolve(root, "." + href[1]);
    if (relative(root, output).startsWith(".." + sep)) {
      missing.push(filename + ": resource path escapes dist");
      continue;
    }
    try { if (!(await stat(output)).isFile()) missing.push(filename + ": missing " + href[1]); }
    catch { missing.push(filename + ": missing " + href[1]); }
  }
}

const artifacts = await readdir(join(root, "assets"));
if (!artifacts.some(x => x.startsWith("chunk-") && x.endsWith(".js"))) {
  missing.push("dynamic import chunk not emitted");
}
for (const required of ["robots.txt", "sitemap.xml", "src/styles.css", "src/floating-chat.css"]) {
  try { await stat(join(root, required)); }
  catch { missing.push("missing static asset " + required); }
}
try { await stat(join(root, "src/main.jsx")); missing.push("raw app source published"); }
catch { /* not bundled as raw source */ }

if (missing.length) {
  console.error(missing.join("\n"));
  process.exitCode = 1;
} else {
  console.log("UI build smoke contract passed for " + pages.length + " pages and assets");
}
