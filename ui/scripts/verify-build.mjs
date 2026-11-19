/** Verify every configured public page and all emitted same-origin assets. */
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ui = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(ui, "dist");
const viteConfig = await readFile(resolve(ui, "vite.config.js"), "utf8");
const inputs = /const pageInputs\s*=\s*\{([\s\S]*?)\};/.exec(viteConfig);
if (!inputs) throw new Error("Cannot verify build: Vite page inventory missing");
const pages = [...inputs[1].matchAll(/\b[A-Za-z]\w*:\s*"([a-z0-9/._-]+\.html)"/g)].map(m => m[1]);
if (pages.length < 10 || new Set(pages).size !== pages.length) {
  throw new Error("Invalid or incomplete Vite multipage inventory");
}
const errors = [];
for (const page of pages) {
  let html;
  try { html = await readFile(resolve(dist, page), "utf8"); }
  catch { errors.push(page + ": missing compiled HTML"); continue; }
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
  const hasBuiltModule = scripts.some(s => /type=["']module["']/.test(s) && /src=["']\/assets\/[^"']+\.js["']/.test(s));
  if (!hasBuiltModule) errors.push(page + ": missing compiled module script");
  if (scripts.some(s => /src=["']\/src\/[^"']+\.(?:js|jsx|mjs)["']/.test(s))) {
    errors.push(page + ": raw source script reference");
  }
  for (const m of html.matchAll(/(?:src|href)=["'](\/(?:assets|src)\/[^"'?#]+)[^"']*["']/g)) {
    const output = resolve(dist, "." + m[1]);
    const rel = relative(dist, output);
    if (rel === ".." || rel.startsWith(".." + sep)) {
      errors.push(page + ": resource escapes build root"); continue;
    }
    try { if (!(await stat(output)).isFile()) errors.push(page + ": missing " + m[1]); }
    catch { errors.push(page + ": missing " + m[1]); }
  }
}
let jsAssets = [];
try { jsAssets = (await readdir(resolve(dist, "assets"))).filter(x => x.endsWith(".js")); }
catch { errors.push("Compiled assets directory missing"); }
if (!jsAssets.length) errors.push("No compiled JavaScript assets");
for (const file of ["robots.txt", "sitemap.xml"]) {
  try { if (!(await stat(resolve(dist, file))).isFile()) errors.push("Missing static " + file); }
  catch { errors.push("Missing static " + file); }
}
try { await stat(resolve(dist, "src/main.jsx")); errors.push("Raw source published"); }
catch { /* raw app source not shipped */ }
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("UI artifact integrity verified across " + pages.length + " configured pages");
}
