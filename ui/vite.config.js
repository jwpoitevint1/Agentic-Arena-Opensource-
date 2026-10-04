import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

const pageInputs = {
  home: "index.html",
  arena: "arena/index.html",
  project: "project/index.html",
  evidence: "evidence/index.html",
  logbook: "runtime-logbook/index.html",
  observations: "observations/index.html",
  models: "models/index.html",
  enterprise: "enterprise/index.html",
  governance: "governance/index.html",
  alignment: "regulatory-alignment/index.html",
  diagnostics: "diagnostics/index.html",
  codingAssistant: "coding-assistant/index.html",
  medicalAnalystAssistant: "medical-analyst-assistant/index.html",
  financialRiskAnalyst: "financial-risk-analyst/index.html",
  logisticsManagementAssistant: "logistics-management-assistant/index.html",
  aviationTravelAssistant: "aviation-travel-assistant/index.html",
  executionPass: "execution-pass/index.html",
};

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pageInputs).map(([key, relativePath]) => [key, resolve(rootDir, relativePath)])),
    },
  },
  server: { port: 5173 },
});
