import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import AnalyticsDashboard from "./analytics-dashboard.jsx";
import "./styles.css";
import T2BotChat, { T2_BOT_KEYS } from "./t2-bot-chat.jsx";
import RegulatoryFramework from "./regulatory-framework.jsx";

const DOMAINS = [
  { id: 1, key: "finance", name: "Finance", source: "Synthetic financial activity", shape: "5,000 rows · 19 fields", status: "Schema Paired", tone: "ready", privacy: "Financial / personal data controls" },
  { id: 2, key: "environmental_operations", name: "Environmental Operations", source: "IoT telemetry", shape: "405,184 rows · 9 fields", status: "Schema Paired", tone: "ready", privacy: "Operational sensor data" },
  { id: 3, key: "healthcare", name: "Healthcare", source: "Patient flow", shape: "9,216 rows · 11 fields", status: "Schema Paired", tone: "ready", privacy: "PHI-oriented controls" },
  { id: 4, key: "retail", name: "Retail", source: "Sample Superstore", shape: "9,994 rows · 13 fields", status: "Schema Paired", tone: "ready", privacy: "Commercial operational data" },
  { id: 5, key: "aviation", name: "Aviation", source: "Passengers carried by country", shape: "266 rows · 53 fields", status: "Schema Paired", tone: "ready", privacy: "Aggregate transport data" },
  { id: 6, key: "supply_chain", name: "Supply Chain / Freight", source: "Freight logistics", shape: "2,000 rows · 11 fields", status: "Schema Paired", tone: "loaded", privacy: "Freight operational data" },
];

const FALLBACK_MODELS = [
  { key: "gemini_3_8_flash", display_name: "Gemini 3.8 Flash", vendor: "Google", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "gemini_3_7_flash", display_name: "Gemini 3.7 Flash", vendor: "Google", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "gemini_3_6_flash", display_name: "Gemini 3.6 Flash", vendor: "Google", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "gemini_3_5_flash_lite", display_name: "Gemini 3.5 Flash Lite", vendor: "Google", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "gemini_3_5_flash", display_name: "Gemini 3.5 Flash", vendor: "Google", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "gpt_astra_latest", display_name: "GPT Astra Latest", vendor: "OpenAI", kind: "agent", access_class: "frontier", parameter_size: "Dynamic family alias", parameter_total_b: null },
  { key: "gpt_5_6_luna", display_name: "GPT-5.6 Luna", vendor: "OpenAI", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "gpt_5_6_terra", display_name: "GPT-5.6 Terra", vendor: "OpenAI", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "gpt_5_6_sol", display_name: "GPT-5.6 Sol", vendor: "OpenAI", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "gpt_5_5", display_name: "GPT-5.5", vendor: "OpenAI", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "mistral_medium_3_5", display_name: "Mistral Medium 3.5", vendor: "Mistral AI", kind: "agent", access_class: "open_weights", parameter_size: "128B dense", parameter_total_b: 128 },
  { key: "mistral_small_4", display_name: "Mistral Small 4", vendor: "Mistral AI", kind: "agent", access_class: "open_weights", parameter_size: "Published open weights", parameter_total_b: null },
  { key: "ministral_3_8b_2512", display_name: "Ministral 3 8B 2512", vendor: "Mistral AI", kind: "agent", access_class: "open_weights", parameter_size: "8B dense", parameter_total_b: 8 },
  { key: "llama_4_scout", display_name: "Llama 4 Scout", vendor: "Meta", kind: "agent", access_class: "open_weights", parameter_size: "109B total / 17B active", parameter_total_b: 109 },
  { key: "llama_4_maverick", display_name: "Llama 4 Maverick", vendor: "Meta", kind: "agent", access_class: "open_weights", parameter_size: "400B total / 17B active", parameter_total_b: 400 },
  { key: "llama_3_8b_lunaris", display_name: "Llama 3 8B Lunaris", vendor: "Sao10K", kind: "agent", access_class: "open_weights", parameter_size: "8B dense", parameter_total_b: 8 },
  { key: "llama_3_1_euryale_70b_v2_2", display_name: "Llama 3.1 Euryale 70B v2.2", vendor: "Sao10K", kind: "agent", access_class: "open_weights", parameter_size: "70B dense", parameter_total_b: 70 },
  { key: "mercury_2_5", display_name: "Mercury 2.5", vendor: "Inception", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "ling_3_0_flash", display_name: "Ling 3.0 Flash", vendor: "inclusionAI", kind: "agent", access_class: "open_weights", parameter_size: "124B total / 5.1B active", parameter_total_b: 124 },
  { key: "muse_spark_1_3", display_name: "Muse Spark 1.3", vendor: "Meta", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "qwen_3_8_27b", display_name: "Qwen3.8 27B", vendor: "Qwen", kind: "agent", access_class: "open_weights", parameter_size: "27B dense", parameter_total_b: 27 },
  { key: "qwen_3_7_plus", display_name: "Qwen3.7 Plus", vendor: "Qwen", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
  { key: "qwen_3_6_flash", display_name: "Qwen3.6 Flash", vendor: "Qwen", kind: "agent", access_class: "frontier", parameter_size: "Undisclosed", parameter_total_b: null },
];

const PROVIDER_STATED_CAPABILITIES = {
  gemini_3_8_flash: "Google describes Gemini 3.8 Flash for long-horizon software engineering, autonomous agents, complex enterprise workflows, multimodal input, function calling, structured output, code execution, search grounding, and configurable thinking.",
  gemini_3_7_flash: "Google describes Gemini 3.7 Flash as a previous-generation Flash model for complex coding, agentic workflows, and reliable multi-step execution.",
  gemini_3_6_flash: "Google describes Gemini 3.6 Flash as balancing speed and multimodal capabilities across general agentic and everyday tasks.",
  gemini_3_5_flash: "Google describes Gemini 3.5 Flash as a legacy Flash model for baseline speed and routine, high-throughput workloads.",
  gemini_3_5_flash_lite: "Google describes Gemini 3.5 Flash-Lite as its fastest, most cost-effective 3.5 model for high-throughput execution.",
  gpt_5_6_sol: "OpenAI describes GPT-5.6 Sol as the flagship GPT-5.6 model, with strengths across coding, knowledge work, cybersecurity, science, tool use, computer use, and long-horizon professional workflows.",
  gpt_5_6_terra: "OpenAI describes GPT-5.6 Terra as a balanced lower-cost GPT-5.6 option for everyday work, with capability positioned between Sol and Luna.",
  gpt_5_6_luna: "OpenAI describes GPT-5.6 Luna as the fastest and most cost-efficient GPT-5.6 tier, intended for cost-sensitive, high-volume workloads and supporting configurable reasoning effort.",
};

function providerCapabilitySummary(model) {
  return model?.provider_capabilities || PROVIDER_STATED_CAPABILITIES[model?.key] || "No provider capability summary is asserted here. Consult the model provider's current documentation for supported capabilities and limits.";
}

const ARENA_MODEL_KEYS = new Set(FALLBACK_MODELS.map((model) => model.key));

const MODEL_GROUPS = [
  ["frontier", "Frontier / hosted models"],
  ["open_dynamic", "Open weights · published / unspecified size"],
  ["open_small", "Open weights · ≤30B total"],
  ["open_mid", "Open weights · 31B–150B total"],
  ["open_large", "Open weights · 151B–500B total"],
  ["open_xlarge", "Open weights · 501B–999B total"],
  ["open_trillion", "Open weights · 1T+ total"],
];

function modelGroupKey(model) {
  if (model.access_class !== "open_weights") return "frontier";
  const total = Number(model.parameter_total_b);
  if (!Number.isFinite(total) || total <= 0) return "open_dynamic";
  if (total <= 30) return "open_small";
  if (total <= 150) return "open_mid";
  if (total <= 500) return "open_large";
  if (total < 1000) return "open_xlarge";
  return "open_trillion";
}

const MODEL_RISK_DEFINITIONS = {
  "Probabilistic output variability": "Model outputs can vary across runs or context changes, so important results require validation and evidence.",
  "Tool-use boundary": "Tool-capable execution increases the importance of authorization, argument validation, scoped permissions, and fail-closed controls.",
  "Provider dependency / opacity": "Hosted frontier behavior, implementation details, and model lifecycle are partly controlled outside the Arena.",
  "Open-weight deployment variance": "Runtime, provider, packaging, quantization, and deployment choices can change behavior or operational characteristics.",
  "Availability / rate-limit variability": "Free endpoints can introduce capacity, throttling, or availability variability during testing.",
  "Version drift": "Dynamic family aliases can change the underlying served model while the Arena-facing alias remains stable.",
  "Large-model resource exposure": "Very large published parameter counts can increase sensitivity to latency, infrastructure, and execution-resource constraints.",
};

function modelRiskCategories(model) {
  if (Array.isArray(model?.risk_categories) && model.risk_categories.length) return model.risk_categories;
  const categories = ["Probabilistic output variability"];
  if (model?.tool_capable === true || (model?.tool_capable === undefined && model?.kind === "agent")) categories.push("Tool-use boundary");
  if (model?.access_class === "frontier") categories.push("Provider dependency / opacity");
  if (model?.access_class === "open_weights") categories.push("Open-weight deployment variance");
  if (model?.free) categories.push("Availability / rate-limit variability");
  if (String(model?.model_id || "").startsWith("~") || String(model?.parameter_size || "").toLowerCase().includes("dynamic family alias")) categories.push("Version drift");
  const total = Number(model?.parameter_total_b);
  if (Number.isFinite(total) && total >= 500) categories.push("Large-model resource exposure");
  return categories;
}

function ModelOptions({ models }) {
  return MODEL_GROUPS.map(([key, label]) => {
    const items = models
      .filter((model) => modelGroupKey(model) === key)
      .sort((a, b) => {
        const aTotal = Number(a.parameter_total_b);
        const bTotal = Number(b.parameter_total_b);
        if (Number.isFinite(aTotal) && Number.isFinite(bTotal) && aTotal !== bTotal) return aTotal - bTotal;
        return (a.display_name || a.key).localeCompare(b.display_name || b.key);
      });
    if (!items.length) return null;
    return <optgroup key={key} label={label}>
      {items.map((model) => <option key={model.key} value={model.key}>{model.display_name || model.key} · {model.vendor} · {model.parameter_size || "parameters undisclosed"}</option>)}
    </optgroup>;
  });
}

const FALLBACK_FUNCTIONS = [
  { key: "analyst", display_name: "Analyst", runtime_role: "analyst_runner", objective: "Analyze domain data and summarize patterns and findings." },
  { key: "data_modeler", display_name: "Data Modeler", runtime_role: "data_modeler_runner", objective: "Relational and dimensional modeling with visualization output." },
  { key: "mixed_capability", display_name: "Mixed Capability", runtime_role: "mixed_capability_runner", objective: "Triggered Modeler → Visualizer → Analyst workflow." },
  { key: "evaluator", display_name: "Auditor", runtime_role: "evaluator_runner", objective: "Review recorded runs for patterns, inconsistencies, anomalies, and differences." },
  { key: "advisor", display_name: "Advisor", runtime_role: "advisor_runner", objective: "Compare options, tradeoffs, risks, and next steps using domain data." },
];

const UNDER_CONSTRUCTION_FUNCTIONS = new Set();

const FRAMEWORKS = [
  { name: "GDPR", type: "Conditional law", scope: "Privacy by design/default, minimization, purpose limitation, security, accountability, and rights-supporting architecture.", tags: ["privacy", "minimization", "accountability"] },
  { name: "EU AI Act", type: "Conditional law", scope: "Risk classification, transparency, human oversight, logging, data governance, technical documentation, and monitoring readiness where applicable.", tags: ["risk", "transparency", "oversight"] },
  { name: "NIST AI RMF", type: "Voluntary framework", scope: "Govern, Map, Measure, and Manage concepts mapped to bounded execution, testing, evidence, and human oversight.", tags: ["govern", "measure", "manage"] },
  { name: "NIST CSF 2.0", type: "Voluntary framework", scope: "Cybersecurity governance, protection, detection, response, and recovery around the AI execution layer.", tags: ["security", "risk", "resilience"] },
  { name: "ISO/IEC 42001", type: "Management system", scope: "AI management-system alignment around roles, objectives, lifecycle controls, monitoring, and continual-improvement evidence.", tags: ["AIMS", "lifecycle", "oversight"] },
  { name: "ISO/IEC 23894", type: "Risk guidance", scope: "AI risk-management alignment through context, identification, analysis, treatment, monitoring, and documentation.", tags: ["AI risk", "controls", "monitoring"] },
  { name: "ISO/IEC 27001 + 27701", type: "Security / privacy", scope: "Information-security and privacy-management lenses for access control, secrets, logging, data handling, and accountability.", tags: ["ISMS", "PIMS", "access"] },
  { name: "Domain overlays", type: "Conditional", scope: "Healthcare, finance, aviation, environmental, retail, and freight controls are applied according to intended use and the data actually processed.", tags: ["sector", "context", "human review"] },
];

const NAV = [
  ["lab", "Runtime Testbed", "01"],
  ["enterprise", "Performance", "02"],
  ["holding", "Agent Benchmark Testing Suite", "03"],
  ["models", "Model Registry", "04"],
  ["evidence", "KPIs + Performance Metrics", "04"],
  ["logbook", "Runtime Logbook", "05"],
  ["observations", "Systems Stress Indicators", "06"],
  ["governance", "Governance Plan Implementation", "07"],
  ["alignment", "Alignment", "08"],
  ["diagnostics", "Operational Assurance", "09"],
  ["t2_coding", "Coding Assistant", "10"],
  ["t2_medical", "Medical Analyst / Assistant", "11"],
  ["t2_financial", "Financial Risk Analyst", "12"],
  ["t2_logistics", "Logistics Management Analyst / Assistant", "13"],
  ["t2_aviation", "Aviation Travel Assistant", "14"],
  ["t2_execution", "Regulatory Framework", "15"],
];

const VIEW_ROUTES = {
  home: "/",
  lab: "/arena/",
  overview: "/project/",
  evidence: "/evidence/",
  logbook: "/runtime-logbook/",
  observations: "/observations/",
  models: "/models/",
  enterprise: "/enterprise/",
  holding: "/holding/",
  governance: "/governance/",
  alignment: "/regulatory-alignment/",
  diagnostics: "/diagnostics/",
  t2_coding: "/coding-assistant/",
  t2_medical: "/medical-analyst-assistant/",
  t2_financial: "/financial-risk-analyst/",
  t2_logistics: "/logistics-management-assistant/",
  t2_aviation: "/aviation-travel-assistant/",
  t2_execution: "/regulatory-framework/",
};

const ROUTE_VIEWS = { ...Object.fromEntries(Object.entries(VIEW_ROUTES).map(([viewKey, route]) => [route, viewKey])), "/execution-pass/": "t2_execution" };

const VIEW_META = {
  home: { title: "Joshua Poitevint | AI Systems Engineering Portfolio · Agentic Arena", description: "Working AI systems engineering portfolio featuring Agentic Arena, CV 1.1 runtime enforcement, governed agent systems, analytics, operational evidence, and deployment architecture." },
  lab: { title: "Runtime Testbed | Governed vs. Ungoverned AI Runtime Comparison", description: "Run matched governed and ungoverned AI tasks across business domains and compare model output, latency, token usage, cost telemetry, policy decisions, and evidence." },
  overview: { title: "CV 1.1 Project | Agentic Arena Runtime Governance Architecture", description: "Technical overview of CV 1.1: deterministic AI runtime governance, bounded authority, fail-closed controls, scoped MCP tools, evidence, and enterprise adaptation." },
  evidence: { title: "KPIs + Performance Metrics | Agentic Arena", description: "Inspect governed and ungoverned AI execution KPIs and performance metrics, including latency, token usage, cost telemetry, policy outcomes, and captured comparison records." },
  logbook: { title: "Runtime Logbook | Agentic Arena", description: "Inspect recent Agentic Arena execution records and runtime evidence from governed and ungoverned AI paths." },
  observations: { title: "Systems Stress Indicators | Agentic Arena", description: "Review documented systems stress indicators from governed and ungoverned AI testing across models, functions, and business-domain datasets." },
  models: { title: "Model Registry | Agentic Arena", description: "Explore the curated Agentic Arena model registry, model classes, parameter information, access classes, and runtime risk categories." },
  enterprise: { title: "Performance | Agentic Arena", description: "Inspect runtime telemetry, token usage, latency, cost, and recorded execution evidence." },
  holding: { title: "Agent Benchmark Testing Suite | Agentic Arena", description: "Benchmark testing suite for the five agent styles currently in Agent Benchmark: Coding Assistant, Medical Analyst / Assistant, Financial Risk Analyst, Logistics Management Analyst / Assistant, and Aviation Travel Assistant." },
  governance: { title: "Governance Plan Implementation | Agentic Arena CV 1.1", description: "See how governance requirements are translated into runtime roles, policy-as-code, bounded tools and data, validation, evidence, monitoring, exception handling, and change control." },
  alignment: { title: "Regulatory Alignment | Agentic Arena CV 1.1", description: "Engineering alignment mappings for AI governance, privacy, security, and risk frameworks. Alignment only; no certification or legal compliance claim." },
  diagnostics: { title: "Operational Assurance | Agentic Arena", description: "Enterprise operational view of service readiness, control status, evidence integrity, model configuration, governed capabilities, and integration health." },
  t2_coding: { title: "Coding Assistant | Agent Benchmark", description: "Agent Benchmark coding agent interface for the Coding Assistant." },
  t2_medical: { title: "Medical Analyst / Assistant | Agent Benchmark", description: "Agent Benchmark chat interface for the Medical Analyst / Assistant." },
  t2_financial: { title: "Financial Risk Analyst | Agent Benchmark", description: "Agent Benchmark chat interface for the Financial Risk Analyst." },
  t2_logistics: { title: "Logistics Management Analyst / Assistant | Agent Benchmark", description: "Agent Benchmark chat interface for logistics management and assistant workflows." },
  t2_aviation: { title: "Aviation Travel Assistant | Agent Benchmark", description: "Agent Benchmark chat interface for bounded live travel search and price listing." },
  t2_execution: { title: "Regulatory Framework | CV 1.1", description: "Claim-free working implementation framework mapping candidate CV 1.1 runtime controls for assessment against ISO/IEC 42001:2023." },
};

function isKnownView(value) {
  return value === "home" || value === "overview" || NAV.some(([key]) => key === value);
}

function normalizedPathname(pathname = window.location.pathname) {
  const collapsed = (pathname || "/").replace(/\/{2,}/g, "/");
  if (collapsed === "/") return "/";
  return `${collapsed.replace(/\/+$/, "")}/`;
}

function viewFromLocation() {
  const hashView = window.location.hash.replace("#", "");
  if (isKnownView(hashView)) return hashView;
  return ROUTE_VIEWS[normalizedPathname()] || "home";
}

function applyViewMeta(view) {
  const meta = VIEW_META[view] || VIEW_META.home;
  const canonical = `https://agenticarena.space${VIEW_ROUTES[view] || "/"}`;
  document.title = meta.title;
  const setMeta = (selector, attribute, value) => {
    const node = document.querySelector(selector);
    if (node) node.setAttribute(attribute, value);
  };
  setMeta('meta[name="description"]', "content", meta.description);
  setMeta('meta[property="og:title"]', "content", meta.title);
  setMeta('meta[property="og:description"]', "content", meta.description);
  setMeta('meta[property="og:url"]', "content", canonical);
  setMeta('meta[name="twitter:title"]', "content", meta.title);
  setMeta('meta[name="twitter:description"]', "content", meta.description);
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  if (canonicalLink) canonicalLink.setAttribute("href", canonical);
}

const HISTORY_KEY = "agentic-arena-experiment-evidence-v2";
const TELEMETRY_EPOCH_START = "2026-09-21T03:23:31Z";
const ARCHIVED_TELEMETRY_RUNS = 265;
const DEFAULT_TASK = "Analyze the freight dataset for delivery performance, cost patterns, and operational anomalies. Summarize notable findings and supporting data.";
const dataModelerTask = (domain) => `Create a relational or dimensional model of the ${domain.name} dataset. Describe the grain, entities or facts, dimensions, keys and relationships, constraints, and quality checks.`;
const AUDIT_TASK = "Review the recent recorded AI runs. Identify notable patterns, anomalies, differences, and the evidence supporting each finding.";

async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 130000);
  try {
    const response = await fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
      method: options.method || "GET",
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let payload = text;
    try { payload = text ? JSON.parse(text) : {}; } catch { /* preserve text */ }
    if (!response.ok) {
      const detail = typeof payload === "object" && payload?.detail ? payload.detail : payload;
      const message = typeof detail === "string" ? detail : detail?.message || JSON.stringify(detail);
      const error = new Error(message || `Request failed with ${response.status}`);
      error.status = response.status;
      error.detail = detail;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Request timed out before the backend completed.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function assistantText(payload) {
  if (!payload) return "";
  if (typeof payload.reply === "string") return payload.reply;
  const content = payload?.result?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((item) => item?.text || "").filter(Boolean).join("\n");
  return "";
}

function metric(payload, section, key) {
  return payload?.test_metrics?.[section]?.[key] ?? null;
}

function fmtNumber(value, digits = 0) {
  if (value === null || value === undefined || value === "") return "N/A";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: digits }) : ", ";
}

function fmtMs(value) {
  return value === null || value === undefined ? ", " : `${fmtNumber(value, 1)} ms`;
}

function fmtCost(value) {
  if (value === null || value === undefined) return "N/A";
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  if (number === 0) return "$0";
  return number < 0.01 ? `$${number.toFixed(6)}` : `$${number.toFixed(4)}`;
}

function safeDelta(governed, ungoverned, section, key) {
  const gRaw = metric(governed, section, key);
  const uRaw = metric(ungoverned, section, key);
  if (gRaw === null || gRaw === undefined || gRaw === "" || uRaw === null || uRaw === undefined || uRaw === "") return null;
  const g = Number(gRaw);
  const u = Number(uRaw);
  return Number.isFinite(g) && Number.isFinite(u) ? g - u : null;
}

function pairSummary(governed, ungoverned) {
  if (!governed && !ungoverned) return null;
  return {
    latency_ms: safeDelta(governed, ungoverned, "timing", "latency_ms"),
    tokens: safeDelta(governed, ungoverned, "usage", "total_tokens"),
    cost: safeDelta(governed, ungoverned, "cost", "selected_usd"),
    context_pct: safeDelta(governed, ungoverned, "usage", "context_utilization_pct"),
  };
}

function buildEvidenceRecord({ domain, functionKey, modelKey, task, governed, ungoverned, errors }) {
  const g = governed?.test_metrics || {};
  const u = ungoverned?.test_metrics || {};
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    captured_at: new Date().toISOString(),
    system_id: domain.id,
    domain: domain.key,
    domain_name: domain.name,
    function_key: functionKey,
    model_key: modelKey,
    task_characters: task.length,
    governed: {
      completed: Boolean(governed),
      error: errors?.governed || null,
      run_id: g.run_id || null,
      policy: governed?.cv11?.policy_version || null,
      policy_reasons: governed?.cv11?.reasons || [],
      latency_ms: g?.timing?.latency_ms ?? null,
      total_tokens: g?.usage?.total_tokens ?? null,
      reasoning_tokens: g?.usage?.reasoning_tokens ?? 0,
      cost_usd: g?.cost?.selected_usd ?? null,
      context_utilization_pct: g?.usage?.context_utilization_pct ?? null,
      tool_calls: g?.behavior?.tool_calls ?? 0,
      retries: g?.behavior?.retries ?? 0,
      behavioral_nuances: g?.behavior?.behavioral_nuances || [],
      redactions: governed?.governed_function?.output_redaction || null,
      finish_reason: g?.behavior?.finish_reason ?? null,
      integrity: g?.integrity || null,
    },
    ungoverned: {
      completed: Boolean(ungoverned),
      error: errors?.ungoverned || null,
      run_id: u.run_id || null,
      latency_ms: u?.timing?.latency_ms ?? null,
      total_tokens: u?.usage?.total_tokens ?? null,
      reasoning_tokens: u?.usage?.reasoning_tokens ?? 0,
      cost_usd: u?.cost?.selected_usd ?? null,
      context_utilization_pct: u?.usage?.context_utilization_pct ?? null,
      tool_calls: u?.behavior?.tool_calls ?? 0,
      retries: u?.behavior?.retries ?? 0,
      behavioral_nuances: u?.behavior?.behavioral_nuances || [],
      finish_reason: u?.behavior?.finish_reason ?? null,
      integrity: u?.integrity || null,
    },
    delta: pairSummary(governed, ungoverned),
  };
}

function loadEvidence() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
  } catch { return []; }
}

function saveEvidence(records) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(records.slice(0, 100))); } catch { /* browser storage unavailable */ }
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function sanitizeForDisplay(value) {
  const blocked = /(database_target|database_url|connection_string|authorization|api[_-]?key|secret|token|password|env_var)/i;
  if (Array.isArray(value)) return value.map(sanitizeForDisplay);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.test(key)).map(([key, child]) => [key, sanitizeForDisplay(child)]));
  }
  return value;
}

function StatusPill({ good, label }) {
  return <span className="status-pill"><span className={`status-dot ${good === true ? "good" : good === false ? "bad" : "warn"}`} />{label}</span>;
}

function Metric({ label, value, foot, tone = "" }) {
  return <div className={`card metric-card ${tone}`}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></div>;
}

function Control({ name, desc, state, tone = "good" }) {
  return <div className="control-row"><div className={`control-icon ${tone}`}>{tone === "warn" ? "!" : tone === "neutral" ? "•" : "✓"}</div><div><div className="control-name">{name}</div><div className="control-desc">{desc}</div></div><div className="control-state">{state}</div></div>;
}

const UNDER_DEVELOPMENT_VIEWS = new Set(["t2_financial", "t2_logistics", "t2_aviation"]);
const SITE_STATUS_NOTE = "Agentic Arena is functional. Financial Analyst, Logistics Analyst, and Aviation Assistant are under development and locked.";

function App() {
  const [view, setViewState] = useState(viewFromLocation);
  const [ready, setReady] = useState(null);
  const [cv11, setCv11] = useState(null);
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [functions, setFunctions] = useState(FALLBACK_FUNCTIONS);
  const [mcpEntities, setMcpEntities] = useState([]);
  const [bootstrapError, setBootstrapError] = useState("");
  const [evidence, setEvidence] = useState(loadEvidence);
  const [lastPair, setLastPair] = useState(null);

  function setView(next) {
    setViewState(next);
    const route = VIEW_ROUTES[next] || "/";
    if (normalizedPathname() !== route || window.location.hash) {
      window.history.pushState({ view: next }, "", route);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    const syncView = () => setViewState(viewFromLocation());
    window.addEventListener("popstate", syncView);
    window.addEventListener("hashchange", syncView);
    const hashView = window.location.hash.replace("#", "");
    if (isKnownView(hashView)) {
      window.history.replaceState({ view: hashView }, "", VIEW_ROUTES[hashView] || "/");
      setViewState(hashView);
    }
    return () => {
      window.removeEventListener("popstate", syncView);
      window.removeEventListener("hashchange", syncView);
    };
  }, []);

  useEffect(() => {
    applyViewMeta(view);
  }, [view]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        apiRequest("/ready", { timeoutMs: 15000 }),
        apiRequest("/api/v1/models", { timeoutMs: 20000 }),
        apiRequest("/api/v1/governed/functions", { timeoutMs: 20000 }),
        apiRequest("/api/v1/mcp/governed/entities", { timeoutMs: 20000 }),
      ]);
      if (cancelled) return;
      if (results[0].status === "fulfilled") {
        const readiness = results[0].value;
        setReady(readiness);
        setCv11({
          policy: "CV1.1",
          decision_engine: "OPA / Rego",
          opa_healthy: readiness.cv11_opa_healthy === true,
          governed_failure_mode: "fail_closed",
        });
      }
      if (results[1].status === "fulfilled") {
        const agents = (results[1].value.models || [])
          .filter((item) => item.kind === "agent" && ARENA_MODEL_KEYS.has(item.key));
        if (agents.length) setModels(agents);
      }
      if (results[2].status === "fulfilled" && results[2].value.functions?.length) setFunctions(results[2].value.functions);
      if (results[3].status === "fulfilled" && results[3].value.entities?.length) setMcpEntities(results[3].value.entities);
      const failed = results.filter((item) => item.status === "rejected");
      if (failed.length) setBootstrapError(`${failed.length} live bootstrap call${failed.length > 1 ? "s" : ""} unavailable. Static lab metadata remains available.`);
    })();
    return () => { cancelled = true; };
  }, []);

  function capturePair(record) {
    setLastPair(record);
    setEvidence((current) => {
      const next = [record, ...current].slice(0, 100);
      saveEvidence(next);
      return next;
    });
  }

  function clearEvidence() {
    setEvidence([]);
    setLastPair(null);
    saveEvidence([]);
  }

  const title = view === "home" ? "Home" : view === "overview" ? "Project" : (NAV.find(([key]) => key === view)?.[1] || "Agentic Arena");
  const isAgentBenchmarkView = view === "holding" || T2_BOT_KEYS.includes(view);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand brand-button" href="/" onClick={(event) => { event.preventDefault(); setView("home"); }} aria-label="Agentic Arena home">
        <div className="brand-mark"><img src="/agentic-arena-mark.svg" alt="" aria-hidden="true" /></div>
        <div><div className="brand-title">Agentic Arena</div><div className="brand-subtitle">{isAgentBenchmarkView ? "Agent Benchmark" : "CV 1.1 runtime enforcement"}</div></div>
      </a>
      <nav className="nav" aria-label="Primary navigation">
        {NAV.map(([key, label, icon]) => <a key={key} href={UNDER_DEVELOPMENT_VIEWS.has(key) ? undefined : VIEW_ROUTES[key]} aria-disabled={UNDER_DEVELOPMENT_VIEWS.has(key) || undefined} tabIndex={UNDER_DEVELOPMENT_VIEWS.has(key) ? -1 : undefined} className={`nav-button nav-${key} ${view === key ? "active" : ""}`} onClick={(event) => { event.preventDefault(); if (!UNDER_DEVELOPMENT_VIEWS.has(key)) setView(key); }}><span className="nav-icon">{icon}</span><span>{label}{UNDER_DEVELOPMENT_VIEWS.has(key) && <small style={{ display: "block" }}>🔒 Under development</small>}</span></a>)}
      </nav>
      <div className="sidebar-footer">{isAgentBenchmarkView ? <><strong>Agent Benchmark</strong><span>Five role-specific agent styles for domain testing and adversarial input.</span></> : <><strong>Engineering test posture</strong><span>Matched governed / ungoverned execution. Portfolio evidence only; no certification or legal compliance claim.</span></>}</div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><div className="eyebrow">{isAgentBenchmarkView ? "Agent Benchmark" : "Runtime enforcement layer"}</div><h1>{title}</h1></div>
        <div className="topbar-meta">
          <StatusPill good={ready?.status === "ready" ? true : ready ? false : null} label={ready?.status === "ready" ? "Backend ready" : "Backend status"} />
          {!isAgentBenchmarkView && <StatusPill good={cv11?.opa_healthy === true ? true : cv11 ? false : null} label="CV 1.1 / OPA" />}
          <StatusPill good={ready?.openrouter_configured === true ? true : ready ? false : null} label="Model gateway" />
        </div>
      </header>

      <div className="notice page-notice" role="status">{SITE_STATUS_NOTE}</div>
      {UNDER_DEVELOPMENT_VIEWS.has(view) && <section className="section card"><div className="eyebrow">🔒 Under development</div><h2>{title}</h2><p>This tab is locked while development is in progress.</p></section>}
      {bootstrapError && <div className="notice error-notice page-notice">{bootstrapError}</div>}
      {view === "home" && <Home setView={setView} models={models} functions={functions} />}
      {view === "overview" && <Overview setView={setView} ready={ready} cv11={cv11} models={models} functions={functions} evidence={evidence} />}
      {view === "lab" && <LabRunner models={models} functions={functions} onCapture={capturePair} setView={setView} />}
      {view === "evidence" && <Evidence evidence={evidence} onClear={clearEvidence} models={models} />}
      {view === "logbook" && <RuntimeLogbook />}
      {view === "observations" && <TestingObservations />}
      {view === "models" && <ModelRegistry models={models} />}
      {view === "enterprise" && <Performance evidence={evidence} onClear={clearEvidence} models={models} />}
      {view === "holding" && !UNDER_DEVELOPMENT_VIEWS.has(view) && <Holding />}
      {view === "t2_execution" && <RegulatoryFramework />}
      {T2_BOT_KEYS.includes(view) && view !== "t2_execution" && !UNDER_DEVELOPMENT_VIEWS.has(view) && <T2BotChat botKey={view} />}
      {view === "chat" && <Chatbot models={models} />}
      {view === "governance" && <div className="governance-mcp-view"><Governance ready={ready} cv11={cv11} functions={functions} entities={mcpEntities} /><MCPConsole models={models} entities={mcpEntities} /></div>}
      {view === "alignment" && <Alignment />}
      {view === "diagnostics" && <Diagnostics models={models} functions={functions} entities={mcpEntities} />}
    </main>
  </div>;
}

function PerformanceLiveTotals() {
  const [totals, setTotals] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const payload = await apiRequest("/api/v1/system/telemetry/totals", { timeoutMs: 15000 });
        if (!cancelled) {
          setTotals(payload);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Live telemetry totals unavailable");
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const runCount = Number(totals?.runs || 0);
  const foot = error ? error : `Runtime Enforced + OEM Settings Neon telemetry · ${fmtNumber(runCount)} persisted records · refreshes every 5 seconds`;
  return <div className="grid-2 performance-live-totals">
    <Metric label="Live total token count" value={totals ? fmtNumber(totals.total_tokens || 0) : "—"} foot={foot} />
    <Metric label="Live total cost" value={totals ? fmtCost(totals.total_cost_usd || 0) : "—"} foot="All-time aggregate from both Neon evidence databases" />
  </div>;
}

function Performance({ evidence, onClear, models }) {
  return <>
    <section className="hero">
      <div className="eyebrow">Operational performance</div>
      <h2>Runtime KPIs and comparative analytics</h2>
      <p>Inspect model token consumption, latency, cost, run history, and recorded execution evidence.</p>
      <PerformanceLiveTotals />
    </section>
    <Evidence evidence={evidence} onClear={onClear} models={models} showLedger={false} />
  </>;
}

function Holding() {
  const agents = [
    {
      number: "01",
      name: "Coding Assistant",
      domain: "Software engineering",
      reason: "Tests whether an agent can translate an intended change into structured code while respecting repository boundaries, interface contracts, and review requirements.",
      conditions: "Incomplete requirements, existing architecture, dependency constraints, syntax accuracy, change isolation, and CI feedback.",
      capability: "Planning, code generation, revision, debugging, and traceable delivery into a controlled repository workflow.",
    },
    {
      number: "02",
      name: "Medical Analyst / Assistant",
      domain: "Healthcare operations",
      reason: "Tests analysis in a sensitive domain where missing values, inconsistent records, privacy boundaries, and unsupported conclusions carry greater consequences.",
      conditions: "Synthetic healthcare records, incomplete observations, limited data scope, arithmetic verification, privacy controls, and strict output boundaries.",
      capability: "Evidence-based analysis, uncertainty handling, data minimization, anomaly identification, and refusal when support is insufficient.",
    },
    {
      number: "03",
      name: "Financial Risk Analyst",
      domain: "Financial analysis",
      reason: "Tests whether an agent can distinguish recorded facts, calculated values, risk signals, and interpretation without inventing precision or authority.",
      conditions: "Synthetic financial records, deterministic arithmetic checks, model selection, inconsistent inputs, restricted fields, and bounded recommendations.",
      capability: "Reconciliation, numeric reasoning, risk classification, exception detection, and supportable explanation of financial findings.",
    },
    {
      number: "04",
      name: "Logistics Management Analyst / Assistant",
      domain: "ERP, CRM, LMS, and logistics operations",
      reason: "Tests multi-system operational reasoning across related records that remain distinct, as they would across enterprise business systems.",
      conditions: "Relational records across separate sources, shipment status, schedules, missed dates, contact routing, planning constraints, and data-quality conflicts.",
      capability: "Cross-source reasoning, scheduling support, operational prioritization, exception routing, and bounded coordination across business functions.",
    },
    {
      number: "05",
      name: "Aviation Travel Assistant",
      domain: "Travel search and service operations",
      reason: "Tests a time-sensitive assistant that must separate live availability from model knowledge and present changing external results without overstating certainty.",
      conditions: "Date and route constraints, live API dependency, price volatility, incomplete availability, traveler requirements, and no authority to complete a purchase.",
      capability: "Constraint resolution, live search, option comparison, source-aware responses, and graceful failure when current data is unavailable.",
    },
  ];

  return <>
    <section className="hero">
      <div className="eyebrow">Agent Benchmark</div>
      <h2>Agent Benchmark Testing Suite</h2>
      <p>The suite uses five agent styles because each one places a different kind of pressure on the model and the system around it. Together they test code creation, sensitive analysis, numeric judgment, multi-system operations, and live external information.</p>
      <p>The purpose is to observe how agent behavior changes when the job, data, tools, permissions, verification requirements, and failure conditions change by domain.</p>
    </section>

    <section className="section card">
      <div className="eyebrow">Selection logic</div>
      <div className="section-title">Five roles that expose different operating demands</div>
      <p className="body-copy">A single generic prompt cannot represent the range of work expected from an operational agent. These roles were selected to create distinct tests of reasoning, data handling, tool use, verification, uncertainty, and bounded authority. The benchmark evaluates the agent inside each working environment rather than treating every task as the same conversation.</p>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Current benchmark set</div>
          <div className="section-title">Five agent types across five domains</div>
          <div className="section-note">Each role has its own task structure, source context, permitted capabilities, and failure conditions.</div>
        </div>
        <span className="badge">5 agent styles</span>
      </div>
      <div className="grid-2">
        {agents.map((agent) => <article className="card" key={agent.number}>
          <div className="card-title-row">
            <div>
              <div className="domain-number">{agent.number} · {agent.domain}</div>
              <div className="section-title">{agent.name}</div>
            </div>
            <span className="badge">Benchmark role</span>
          </div>
          <div className="eyebrow">Why this agent is included</div>
          <p className="body-copy">{agent.reason}</p>
          <dl className="kv kv-roomy">
            <dt>Operating conditions</dt><dd>{agent.conditions}</dd>
            <dt>Capability tested</dt><dd>{agent.capability}</dd>
          </dl>
        </article>)}
      </div>
    </section>

    <section className="section grid-3">
      <div className="card"><div className="eyebrow">Across roles</div><div className="section-title">Reasoning under constraints</div><p className="body-copy">The agent must work within the assigned function, use only the available context and tools, and state what the evidence can support.</p></div>
      <div className="card"><div className="eyebrow">Across domains</div><div className="section-title">Different failure consequences</div><p className="body-copy">A coding defect, unsupported clinical inference, incorrect financial calculation, missed shipment dependency, and stale travel result fail in different ways and require different controls.</p></div>
      <div className="card"><div className="eyebrow">Across executions</div><div className="section-title">Comparable runtime evidence</div><p className="body-copy">Outputs, tool use, latency, tokens, cost, validation results, and failures provide a common evidence layer while the work itself remains domain-specific.</p></div>
    </section>
  </>;
}

function Home({ setView, models, functions }) {
  return <>
    <section className="hero">
      <div className="eyebrow">Joshua Poitevint · AI systems engineering portfolio</div>
      <h2>Downstream AI engineering built around the environment where AI actually operates.</h2>
      <p>I design and build AI systems around operational reality: data, APIs, business rules, permissions, failure conditions, evidence, and existing workflows. My work sits at the intersection of AI deployment, analytics, runtime enforcement, governance implementation, and process transformation.</p>
      <p><strong>Agentic Arena is my working engineering portfolio.</strong> It is a live environment I built to develop, deploy, break, observe, and refine governed agent systems across multiple operational domains. CV 1.1 places deterministic controls around probabilistic execution so authority remains outside the model.</p>
      <p>The portfolio is intentionally inspectable: runtime records, policy decisions, model behavior, performance telemetry, integrity evidence, system stress indicators, and working control documentation are exposed as artifacts of the engineering work.</p>
      <div className="hero-actions">
        <a className="primary" href="/arena/" onClick={(event) => { event.preventDefault(); setView("lab"); }}>Explore the Live Arena</a>
        <a className="secondary" href="/project/" onClick={(event) => { event.preventDefault(); setView("overview"); }}>View Architecture</a>
      </div>
    </section>

    <section className="section grid-4">
      <Metric label="Portfolio focus" value="AI systems" foot="Deployment · runtime enforcement · analytics" />
      <Metric label="Evidence" value="Live" foot="Runtime decisions · telemetry · integrity records" />
      <Metric label="Test surface" value="6 domains" foot={`${functions.length} bounded functions · ${models.length} curated models`} />
      <Metric label="Comparison" value="Matched" foot="Governed vs. ungoverned execution" />
    </section>

    <section className="section grid-3">
      <div className="card">
        <div className="eyebrow">01 · AI runtime engineering</div>
        <div className="section-title">Build around the operating environment</div>
        <p className="body-copy">Multi-model execution, agent workflows, bounded capabilities, data interfaces, failure handling, and deployment architecture are treated as one operational system.</p>
      </div>
      <div className="card">
        <div className="eyebrow">02 · Runtime enforcement</div>
        <div className="section-title">Keep authority outside the model</div>
        <p className="body-copy">OPA/Rego policy, fixed roles, bounded MCP operations, validation, output controls, and fail-closed behavior constrain what the AI can access and do.</p>
      </div>
      <div className="card">
        <div className="eyebrow">03 · Operational evidence</div>
        <div className="section-title">Engineering leaves evidence behind</div>
        <p className="body-copy">Policy outcomes, telemetry, integrity records, test results, failures, and implementation documentation make the work inspectable instead of relying on architecture claims alone.</p>
      </div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Flagship project · Agentic Arena</div>
          <div className="section-title">Run it instead of taking the architecture on faith</div>
          <div className="section-note">A working environment for developing, pressure-testing, and observing governed agent systems across multiple operational domains.</div>
        </div>
      </div>
      <div className="grid-3">
        <div className="card">
          <div className="eyebrow">Choose</div>
          <div className="section-title">Select the workload</div>
          <p className="body-copy">Choose a paired business domain, bounded function, curated model, and task.</p>
        </div>
        <div className="card">
          <div className="eyebrow">Execute</div>
          <div className="section-title">Run both conditions</div>
          <p className="body-copy">Agentic Arena executes the governed runtime path and its matched ungoverned control path against the same business problem.</p>
        </div>
        <div className="card">
          <div className="eyebrow">Inspect</div>
          <div className="section-title">Review output and evidence</div>
          <p className="body-copy">Compare responses, latency, tokens, cost telemetry, policy decisions, control outcomes, and the evidence left behind by execution.</p>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Documentation & audit materials</div>
          <div className="section-title">Download the working control documentation</div>
          <div className="section-note">Claim-free working material for architecture review, traceability, implementation planning, and independent assessment. Mapping is not certification or conformity.</div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="eyebrow">ISO/IEC 42001:2023</div>
          <div className="section-title">AIMS Implementation & Audit Map</div>
          <p className="body-copy">Maps the organizational governance, management, runtime-enforcement, assurance, evidence, audit, and certification-readiness responsibilities surrounding a CV 1.1 deployment.</p>
          <div className="hero-actions">
            <a className="secondary" href="/docs/cv11-iso-iec-42001-aims-implementation-audit-map-claim-free.txt" download>Download Audit Map</a>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">CV 1.1 contracts</div>
          <div className="section-title">Full Contract Register + Agentic Arena Crosswalk</div>
          <p className="body-copy">Defines the working CV 1.1 contract taxonomy and cross-references Agentic Arena implementation contracts while keeping architectural invariants separate from lab-specific behavior.</p>
          <div className="hero-actions">
            <a className="secondary" href="/docs/cv11-full-contract-register-agentic-arena-crosswalk.txt" download>Download Contract Register</a>
          </div>
        </div>
      </div>
    </section>

    <section className="section card">
      <div className="eyebrow">Engineering approach</div>
      <div className="section-title">Work from the operating environment backward</div>
      <p className="body-copy">Business outcome → requirements and obligations → data governance → authoritative context / RAG → bounded APIs and MCP → runtime policy enforcement → validation and output sanitation → evidence and monitoring → change control.</p>
      <p className="body-copy">The model is one component of the system, not the system itself. Agentic Arena is a portfolio implementation—not a scientific benchmark or a claim of universal deployment suitability.</p>
    </section>

    <section className="section grid-2">
      <div className="card">
        <div className="eyebrow">Evidence path</div>
        <div className="section-title">The result does not end at model output</div>
        <p className="body-copy">Use Evidence for side-by-side comparison and Runtime Logbook for recent recorded executions. Source datasets remain separate from the AI runtime.</p>
        <div className="hero-actions">
          <a className="secondary" href="/evidence/" onClick={(event) => { event.preventDefault(); setView("evidence"); }}>Open Evidence</a>
          <a className="ghost" href="/runtime-logbook/" onClick={(event) => { event.preventDefault(); setView("logbook"); }}>Runtime Logbook</a>
        </div>
      </div>
      <div className="card">
        <div className="eyebrow">Iteration method</div>
        <div className="section-title">Build → Execute → Observe → Break → Diagnose → Correct → Verify</div>
        <p className="body-copy">Agentic Arena intentionally stresses controls, models, contracts, interfaces, and imperfect datasets to expose failure boundaries. Problems are traced through the surrounding architecture before a fix is treated as complete.</p>
        <div className="hero-actions">
          <a className="primary" href="/arena/" onClick={(event) => { event.preventDefault(); setView("lab"); }}>Open Runtime Testbed</a>
        </div>
      </div>
    </section>
    <section className="section card">
      <div className="eyebrow">About the engineer</div>
      <div className="section-title">Operations, analytics, process engineering, and AI deployment</div>
      <p className="body-copy">I'm Joshua Poitevint. I spent most of my career in aircraft maintenance and Air Force operations, leading 31 people across six work centers before moving into operational analysis and automation. That shift felt natural because both domains rely on the same core principle. You find where a system breaks, trace the cause, and build tools people can actually rely on. I later completed an MBA in Project Management.</p>
      <p className="body-copy">Agentic Arena grew out of that operational mindset. I built it to test how AI models behave when they step out of polished demos and into real-world conditions. In the Arena, a model gets a job, specific data, limited tools, and immutable guardrails. To mirror real operating environments, the underlying data is intentionally messy.</p>
      <p className="body-copy">This isn't a formal scientific benchmark, and I didn't build it to declare a winning model. It is a practical engineering lab where I can stress test failure points, adapt the surrounding system architecture, and measure what happens next. The model generates the response, but the system dictates its authority.</p>
      <p className="body-copy"><strong>Build Disclosure:</strong> I designed Agentic Arena and used Codex as my primary coding tool to implement the application and its supporting architecture.</p>
      <div className="hero-actions">
        <a className="primary" href="/project/" onClick={(event) => { event.preventDefault(); setView("overview"); }}>Technical Project Overview</a>
        <a className="secondary" href="/governance/" onClick={(event) => { event.preventDefault(); setView("governance"); }}>Governance Implementation</a>
        <a className="ghost" href="https://github.com/jwpoitevint1/Agentic-Arena-Opensource-" target="_blank" rel="noreferrer">Open-Source Repository</a>
      </div>
    </section>

  </>;
}

function Overview({ setView, ready, cv11, models, functions, evidence }) {
  const successfulPairs = evidence.filter((item) => item.governed?.completed && item.ungoverned?.completed).length;
  return <>
    <section className="hero project-hero">
      <div className="project-logo-panel"><img src="/agentic-arena-logo.svg" alt="Agentic Arena: Test, Govern, Deploy with Confidence" /></div>
      <div className="eyebrow">Enterprise AI systems architecture</div>
      <h2>Governed AI execution with bounded authority and operational evidence</h2>
      <p><strong>Agentic Arena</strong> demonstrates an enterprise-oriented approach to implementing AI around existing systems, data, and business authority. <strong>CV 1.1 (Compliance Verification)</strong> is the open-source runtime-enforcement reference architecture used to apply deterministic policy, bounded functions, scoped data and tool access, fail-closed controls, and verifiable operational evidence around probabilistic AI execution.</p>
      <p>The environment combines architecture, governance implementation, model integration, operational controls, and performance evidence in one working portfolio system. Governed and comparison paths use matched models, tasks, domains, and source data so the effect of runtime controls can be inspected without presenting the results as generalized research conclusions.</p>
      <p><strong>Open-source repository:</strong> <a href="https://github.com/jwpoitevint1/Agentic-Arena-Opensource-" target="_blank" rel="noreferrer">github.com/jwpoitevint1/Agentic-Arena-Opensource-</a></p>
      <p>This architecture is licensed under the Apache 2.0 license and is intended to be adapted to deployment-specific business, technical, regulatory, and operational requirements.</p>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">At a glance</div>
          <div className="section-note">Enterprise AI architecture · runtime enforcement · governed integration · operational assurance.</div>
        </div>
      </div>
      <div className="grid-4">
        <Metric label="Domains" value="6" foot="Paired governed / ungoverned schemas" />
        <Metric label="Functions" value={String(functions.length)} foot="Analyst · Modeler · Mixed Capability · Auditor · Advisor" />
        <Metric label="Models" value={String(models.filter((model) => model.key !== "glm_5_3_prime").slice(0, 23).length)} foot="Approved UI registry" />
        <Metric label="Comparisons" value={String(successfulPairs)} foot="Recorded matched execution evidence" />
      </div>
    </section>

    <section className="section grid-3">
      <div className="card">
        <div className="section-title">Bounded authority</div>
        <p className="body-copy">The model does not choose its own role, permissions, tools, data target, or execution authority. Those controls are resolved outside the model.</p>
      </div>
      <div className="card">
        <div className="section-title">Control validation</div>
        <p className="body-copy">Matched execution paths provide a practical way to inspect how runtime controls affect behavior, tool use, performance, and evidence without changing the underlying business task.</p>
      </div>
      <div className="card">
        <div className="section-title">Operational traceability</div>
        <p className="body-copy">Runtime telemetry, policy decisions, integrity records, and execution history provide traceability for operational review, governance assessment, and control verification.</p>
      </div>
    </section>

    <section className="section card">
      <div className="eyebrow">Enterprise architecture principle</div>
      <div className="section-title">Preserve systems of record while governing AI access</div>
      <p className="body-copy">The six domain datasets are intentionally separated from the AI runtime. In this environment, they act as stand-ins for external operational systems while the AI accesses them only through bounded application and governance interfaces. CV 1.1 controls the bridge between the source-data plane and the AI execution plane rather than making the source system part of the AI itself.</p>
      <p className="body-copy">That separation models an enterprise deployment in which systems such as ERP, maintenance, finance, logistics, or analytics platforms remain the systems of record. If the AI or its governance runtime fails closed, the underlying operational system does not have to fail with it. Deterministic automation, monitoring streams, and human workflows can remain available as continuity paths. Agentic Arena demonstrates this architectural separation; it is not a claim that the portfolio environment itself is a production-certified deployment.</p>
    </section>

    <section className="section card">
      <div className="eyebrow">Execution model</div>
      <div className="section-title">Event-driven, bounded agentic workflows</div>
      <p className="body-copy">The workflows shown here are agentic but currently trigger-based. In an autonomous deployment, execution triggers could be tied to changes in input conditions—such as time or date, file updates, changes in system output, or streaming data crossing defined operating ranges. Those external events would initiate the bounded workflow; they would not expand the model's authority or bypass its runtime controls.</p>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Architecture</div>
          <div className="section-title">Governed execution path</div>
          <div className="section-note">Authority is server-derived and checked at each execution boundary.</div>
        </div>
      </div>
      <div className="card"><ExecutionFlow /></div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Business-domain coverage</div>
          <div className="section-title">Cross-domain implementation environment</div>
          <div className="section-note">Six representative business domains support governed and comparison execution across consistent underlying workloads.</div>
        </div>
        <span className="badge">6 paired systems</span>
      </div>
      <div className="grid-3">{DOMAINS.map((domain) => <DomainCard key={domain.id} domain={domain} onRun={() => setView("lab")} />)}</div>
    </section>

    <section className="section grid-2">
      <div className="card">
        <div className="section-title">Technology and control stack</div>
        <dl className="kv kv-roomy">
          <dt>Application</dt><dd>FastAPI backend · React / Vite UI</dd>
          <dt>Policy</dt><dd>CV 1.1 · OPA / Rego</dd>
          <dt>Data</dt><dd>Paired PostgreSQL / Neon targets</dd>
          <dt>Execution</dt><dd>Governed + ungoverned comparison paths</dd>
          <dt>Tooling</dt><dd>Bounded MCP entities and server-derived routing</dd>
          <dt>Egress</dt><dd>Domain-aware validation and redaction</dd>
        </dl>
      </div>
      <div className="card">
        <div className="card-title-row"><div className="section-title">Current platform status</div><StatusPill good={ready?.status === "ready" ? true : ready ? false : null} label={ready?.status || "Checking"} /></div>
        <dl className="kv kv-roomy">
          <dt>Database wiring</dt><dd>{ready ? (ready.databases_configured ? "Configured" : "Incomplete") : "Checking"}</dd>
          <dt>Model gateway</dt><dd>{ready ? (ready.openrouter_configured ? "Configured" : "Not configured") : "Checking"}</dd>
          <dt>OPA</dt><dd>{ready ? (ready.cv11_opa_healthy ? "Healthy" : "Unavailable") : "Checking"}</dd>
          <dt>Governed failure</dt><dd>{cv11?.governed_failure_mode || "fail_closed"}</dd>
        </dl>
      </div>
    </section>
  </>;
}

function DomainCard({ domain, onRun }) {
  return <div className="card domain-card">
    <div className="domain-number">SYSTEM {String(domain.id).padStart(2, "0")}</div>
    <div className="domain-name">{domain.name}</div>
    <div className="domain-source">{domain.source}<br />{domain.shape}</div>
    <div className="domain-privacy">{domain.privacy}</div>
    <div className="domain-status"><span>Paired workload</span><span className={domain.tone}>{domain.status}</span></div>
    {onRun && <button className="text-button" onClick={onRun}>Open in Runtime Testbed →</button>}
  </div>;
}

function ExecutionFlow() {
  const steps = ["Trigger", "Function binding", "Fixed runtime role", "OPA / Rego", "Allowed MCP", "Scoped data", "Model", "Egress controls", "Telemetry"];
  return <div className="flow">{steps.map((item, index) => <React.Fragment key={item}><div className="flow-node">{item}</div>{index < steps.length - 1 && <div className="flow-arrow">→</div>}</React.Fragment>)}</div>;
}

function LabRunner({ models, functions, onCapture, setView }) {
  const [systemId, setSystemId] = useState(6);
  const [functionKey, setFunctionKey] = useState("analyst");
  const [modelKey, setModelKey] = useState(models[0]?.key || FALLBACK_MODELS[0].key);
  const [task, setTask] = useState(DEFAULT_TASK);
  const [context, setContext] = useState("");
  const [maxTokens, setMaxTokens] = useState(5000);
  const [running, setRunning] = useState(false);
  const [governed, setGoverned] = useState(null);
  const [ungoverned, setUngoverned] = useState(null);
  const [errors, setErrors] = useState({});
  const [captured, setCaptured] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => { if (!models.some((item) => item.key === modelKey) && models[0]) setModelKey(models[0].key); }, [models, modelKey]);
  useEffect(() => {
    if (!running || !runStartedAt) return undefined;
    const timer = window.setInterval(() => setElapsedMs(Date.now() - runStartedAt), 100);
    return () => window.clearInterval(timer);
  }, [running, runStartedAt]);
  const selectedDomain = DOMAINS.find((item) => item.id === Number(systemId)) || DOMAINS[5];
  const selectedFunction = functions.find((item) => item.key === functionKey);
  const auditorSelected = functionKey === "evaluator" || functionKey === "auditor";
  const dataModelerSelected = functionKey === "data_modeler";
  const mixedCapabilitySelected = functionKey === "mixed_capability";
  const summary = useMemo(() => pairSummary(governed, ungoverned), [governed, ungoverned]);

  function loadTemplate(domainId, nextFunctionKey = functionKey) {
    const domain = DOMAINS.find((item) => item.id === Number(domainId)) || DOMAINS[5];
    if (nextFunctionKey === "mixed_capability") {
      setTask(`Model the ${domain.name} evidence, create a simple visualization of the modeled information, then analyze the completed model and visualization.`);
      return;
    }
    if (nextFunctionKey === "data_modeler") {
      setTask(dataModelerTask(domain));
      return;
    }
    const templates = {
      1: "Analyze account activity, cash movement, loan attributes, and risk indicators. Summarize notable patterns and data-quality issues.",
      2: "Analyze the IoT telemetry for environmental trends, device anomalies, and sensor-quality patterns. Summarize notable findings and operational patterns.",
      3: "Analyze patient-flow operations for wait-time, referral, satisfaction, and demographic patterns. Summarize notable findings and data-quality issues.",
      4: "Analyze sales, profit, discount, category, and regional patterns. Summarize notable findings and tradeoffs.",
      5: "Analyze passenger-volume trends by country and year, including missing values and comparative traffic patterns. Summarize notable findings.",
      6: DEFAULT_TASK,
    };
    setTask(templates[domainId] || DEFAULT_TASK);
  }

  async function run() {
    if (!task.trim() || running) return;
    const startedAt = Date.now();
    setRunStartedAt(startedAt); setElapsedMs(0);
    setRunning(true); setErrors({}); setGoverned(null); setUngoverned(null); setCaptured(false);
    const payload = auditorSelected
      ? { system_id: Number(systemId), model_key: modelKey, task: task.trim(), max_tokens: Number(maxTokens) }
      : { function_key: functionKey, system_id: Number(systemId), model_key: modelKey, task: task.trim(), source_context: context.trim() || null, max_tokens: Number(maxTokens) };
    const governedPath = auditorSelected ? "/api/v1/governed/auditor/execute" : "/api/v1/governed/execute";
    const ungovernedPath = auditorSelected ? "/api/v1/ungoverned/auditor/execute" : "/api/v1/ungoverned/execute";
    const [g, u] = await Promise.allSettled([
      apiRequest(governedPath, { method: "POST", body: payload }),
      apiRequest(ungovernedPath, { method: "POST", body: payload }),
    ]);
    const nextErrors = {};
    const gValue = g.status === "fulfilled" ? g.value : null;
    const uValue = u.status === "fulfilled" ? u.value : null;
    if (gValue) setGoverned(gValue); else nextErrors.governed = g.reason?.message || "Governed request failed.";
    if (uValue) setUngoverned(uValue); else nextErrors.ungoverned = u.reason?.message || "Ungoverned request failed.";
    setErrors(nextErrors);
    const record = buildEvidenceRecord({ domain: selectedDomain, functionKey, modelKey, task: task.trim(), governed: gValue, ungoverned: uValue, errors: nextErrors });
    onCapture(record);
    setCaptured(true);
    setElapsedMs(Date.now() - startedAt);
    setRunning(false);
  }

  const functionUnderConstruction = UNDER_CONSTRUCTION_FUNCTIONS.has(functionKey);
  const canRun = task.trim() && !functionUnderConstruction && Number(maxTokens) >= 2500 && Number(maxTokens) <= 5000;

  return <>
    <div className="notice good-notice">{auditorSelected
      ? "Auditor mode reads a bounded window of prior governed and ungoverned AI runs from the recording databases. It is read-only against source and workspace state. Every audit execution and its action ledger are written to the signed recording database; manual source context is disabled."
      : mixedCapabilitySelected
        ? "Mixed Capability is a triggered three-agent workflow: Modeler → Visualizer → Analyst. In the governed path, the visual must pass verification against governed MCP evidence before the Analyst is triggered. The ungoverned control runs the matched functional sequence without the governed verification gate."
        : dataModelerSelected
          ? "Data Modeler returns two output artifacts in the Lab: a Simple Data Model and a data visualization. The governed path requires its schema and bounded row context through the governed MCP boundary and fails closed if that context is unavailable. Persisted source and workspace state remain read-only."
          : "Matched-pair mode holds the model, function, domain, task, source context, and token ceiling constant. Results are captured as metrics-only browser evidence; raw model outputs are not written to local storage."}</div>

    <div className="notice">
      <strong>Intentional dirty-data test surface.</strong> The datasets intentionally include null values, missing entries, inconsistent or mismatched headers, and other imperfect structures—including a field named <span className="mono-cell">merged</span>. These defects are retained on purpose rather than cleaned away. The testbed uses them to stress AI workflows and demonstrate how poor data quality can affect model interpretation, aggregation, downstream output, and runtime controls. Observed effects are development evidence from this portfolio environment, not generalized scientific conclusions.
    </div>

    <section className="section form-panel">
      <div className="form-grid four-cols">
        <div className="field"><label>{auditorSelected ? "Trace domain" : "Domain"}</label><select value={systemId} onChange={(e) => { const value = Number(e.target.value); setSystemId(value); if (!auditorSelected) loadTemplate(value, functionKey); }}>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{String(d.id).padStart(2,"0")} · {d.name}</option>)}</select></div>
        <div className="field"><label>Function</label><select value={functionKey} onChange={(e) => { const value = e.target.value; setFunctionKey(value); if (value === "evaluator" || value === "auditor") { setTask(AUDIT_TASK); setContext(""); } else { loadTemplate(Number(systemId), value); } }}>{functions.map((f) => {
          const underConstruction = UNDER_CONSTRUCTION_FUNCTIONS.has(f.key);
          const displayName = f.key === "evaluator" || f.key === "auditor" ? "Auditor" : (f.display_name || f.key);
          return <option key={f.key} value={f.key} disabled={underConstruction}>{displayName}{underConstruction ? " · Under construction" : ""}</option>;
        })}</select></div>
        <div className="field"><label>Model</label><select value={modelKey} onChange={(e) => setModelKey(e.target.value)}><ModelOptions models={models} /></select></div>
        <div className="field"><label>Max output tokens</label><input type="number" value="5000" disabled readOnly /></div>
        <div className="field full"><label>Task</label><textarea value={task} onChange={(e) => setTask(e.target.value)} /></div>
        <div className="field full"><label>{auditorSelected ? "Audit evidence source" : "Optional source context"}</label>{auditorSelected
          ? <input type="text" value="Recording databases · telemetry.agentic_runs · read only" disabled readOnly />
          : <textarea className="compact-textarea" placeholder="Optional additional context supplied unchanged to both execution paths." value={context} onChange={(e) => setContext(e.target.value)} />}</div>
      </div>
      <div className="form-actions lab-actions">
        <div className="run-context"><strong>{auditorSelected ? "Recorded AI runs" : selectedDomain.name}</strong><span>{auditorSelected ? "Governed + ungoverned signed evidence" : `${selectedDomain.source} · ${selectedDomain.shape}`}</span><span>{selectedFunction?.runtime_role || functionKey}</span></div>
        <button className="primary" disabled={running || !canRun} onClick={run}>{running ? <><span className="spinner inline-spinner" />Running matched pair</> : "Run governed + ungoverned"}</button>
      </div>
    </section>

    {running && <section className="section card live-observatory">
      <div className="section-header">
        <div><div className="eyebrow">Live execution observatory</div><div className="section-title">Matched pair in flight</div><div className="section-note">Real-time request timing and observable execution state. Provider reasoning telemetry attaches when each response completes.</div></div>
        <div className="live-elapsed">{(elapsedMs / 1000).toFixed(1)}s</div>
      </div>
      <div className="live-path-grid">
        <div className="live-path-card governed-live"><strong>CV 1.1 governed</strong><span><span className="spinner inline-spinner" />Request in flight</span></div>
        <div className="live-path-card control-live"><strong>Ungoverned control</strong><span><span className="spinner inline-spinner" />Request in flight</span></div>
      </div>
      <div className="live-stage-strip">
        {(auditorSelected
          ? ["Dispatch", "Policy / control boundary", "Recording database read", "Audit model execution", "Signed audit telemetry"]
          : mixedCapabilitySelected
            ? ["Dispatch", "Policy / control boundary", "Governed MCP evidence", "Simple Data Model", "Visualization", "Verification gate", "Triggered Analyst", "Egress + telemetry"]
            : dataModelerSelected
              ? ["Dispatch", "Policy / control boundary", "Required governed MCP read", "Derived data modeling", "Model + visualization output", "Egress + telemetry"]
              : ["Dispatch", "Policy / control boundary", "Neon dataset read", "Model execution", "Egress + telemetry"]
        ).map((stage) => <div className="live-stage" key={stage}>{stage}</div>)}
      </div>
    </section>}

    {(governed || ungoverned || errors.governed || errors.ungoverned) && <section className="section">
      <div className="section-header"><div><div className="section-title">Pair result</div><div className="section-note">Same inputs, two execution conditions.</div></div>{captured && <button className="ghost small-button" onClick={() => setView("evidence")}>Evidence captured →</button>}</div>
      <div className="grid-2">
        <ResultPanel title="CV 1.1 governed" tone="good" result={governed} error={errors.governed} dataModeler={dataModelerSelected} mixedCapability={mixedCapabilitySelected} />
        <ResultPanel title="Ungoverned control" tone="warn" result={ungoverned} error={errors.ungoverned} dataModeler={dataModelerSelected} mixedCapability={mixedCapabilitySelected} />
      </div>
      {summary && <DeltaPanel summary={summary} />}
    </section>}

    {!governed && !ungoverned && !running && <section className="section empty-state"><div className="empty-mark">AA</div><strong>No pair has run in this session.</strong><span>Configure the test above and execute both paths together.</span></section>}
  </>;
}

function observableDecisionPath(result, tone) {
  const test = result?.test_metrics || {};
  const execution = test?.execution || {};
  const behavior = test?.behavior || {};
  const control = test?.control || {};
  const outcome = test?.outcome || {};
  const governed = tone === "good";
  const route = governed ? (result?.governed_function || {}) : (result?.ungoverned_function || {});
  const controls = test?.controls || {};

  const domain = execution.domain || route.domain || "domain";
  const functionKey = execution.function_key || route.function_key || "function";
  const datasetSource = route.dataset_source || (route.dataset_provided ? "authorized source" : "not reported");
  const relational = route.relational_action || "no relational action reported";
  const returnedModel = test?.model?.returned_model_id || test?.model?.requested_model_id || "model";
  const finishReason = behavior.finish_reason || "not reported";
  const integrity = test?.integrity?.hmac_sha256
    ? `signed #${test?.integrity?.sequence ?? "?"}`
    : "not signed";

  const policyState = governed
    ? control.policy_allowed === false
      ? "denied"
      : control.policy_allowed === true
        ? "allowed"
        : result?.cv11
          ? "applied"
          : "not reported"
    : "CV1.1 off";

  const claimVerification = governed
    ? (controls?.claim_verification?.status || (route.verified_evidence_provided ? "checked" : "not reported"))
    : "not applied";

  const sanitationTotal = Number(controls?.output_sanitation?.total ?? route?.output_sanitation?.total ?? 0);
  const redactionTotal = Number(controls?.output_redaction?.total ?? route?.output_redaction?.total ?? 0);
  const egressState = governed
    ? `sanitized ${Number.isFinite(sanitationTotal) ? sanitationTotal : 0} · redacted ${Number.isFinite(redactionTotal) ? redactionTotal : 0}`
    : "CV1.1 egress controls off";

  return [
    { label: "Scope binding", detail: `${domain} · ${functionKey}`, state: "bound" },
    { label: "Policy boundary", detail: governed ? "CV1.1 / OPA authorization" : "Control path bypasses CV1.1", state: policyState },
    { label: "Dataset acquisition", detail: datasetSource, state: route.dataset_provided === false ? "none" : "read" },
    { label: "Relational evidence", detail: relational, state: `${Number(behavior.tool_calls ?? 0)} tool call${Number(behavior.tool_calls ?? 0) === 1 ? "" : "s"}` },
    { label: "Verified facts", detail: governed ? (route.mcp_statistics_provided ? "Deterministic MCP statistics attached" : route.verified_evidence_provided ? "Server-computed bounded facts attached" : "No verified-facts block reported") : "No governed verified-facts layer", state: governed ? (route.mcp_statistics_provided || route.verified_evidence_provided ? "attached" : "not reported") : "off" },
    { label: "Model execution", detail: returnedModel, state: finishReason },
    { label: "Claim verification", detail: governed ? "Post-generation factual check" : "No governed claim verifier", state: claimVerification },
    { label: "Egress controls", detail: governed ? "Sanitation and domain redaction" : "Direct control-path output", state: egressState },
    { label: "Integrity record", detail: "Run telemetry and result integrity", state: integrity },
    { label: "Outcome", detail: outcome.completed === false ? "Execution did not complete" : "Execution completed", state: outcome.status || (outcome.completed === false ? "failed" : "completed") },
  ];
}


function normalizeDataModelVisualization(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const type = parsed?.type === "line" ? "line" : "bar";
  const data = Array.isArray(parsed?.data)
    ? parsed.data.slice(0, 12).map((item, index) => {
        const value = Number(item?.value ?? item?.y);
        const label = String(item?.label ?? item?.x ?? index + 1).slice(0, 48);
        return Number.isFinite(value) ? { label, value } : null;
      }).filter(Boolean)
    : [];
  if (!data.length) return null;
  return {
    type,
    title: String(parsed?.title || "Data Model visualization").slice(0, 120),
    xLabel: String(parsed?.x_label || parsed?.xLabel || "").slice(0, 80),
    yLabel: String(parsed?.y_label || parsed?.yLabel || "").slice(0, 80),
    data,
  };
}

function parseDataModelerOutput(payload) {
  const raw = assistantText(payload);
  const apiVisualization = normalizeDataModelVisualization(payload?.visualization_spec);
  if (!raw) return { text: "", visualization: apiVisualization };
  const markerMatches = [...raw.matchAll(/#{0,6}\s*VISUALIZATION_SPEC\s*:?\s*/gi)];
  const markerMatch = markerMatches[markerMatches.length - 1];
  if (!markerMatch || markerMatch.index == null) return { text: raw, visualization: apiVisualization };

  const markerIndex = markerMatch.index;
  const text = raw.slice(0, markerIndex).trim();
  let candidate = raw.slice(markerIndex + markerMatch[0].length).trim();
  candidate = candidate.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return { text: text || raw, visualization: null };

  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    const modelVisualization = normalizeDataModelVisualization(parsed);
    return {
      text: text || raw,
      visualization: apiVisualization || modelVisualization,
    };
  } catch {
    return { text: text || raw, visualization: apiVisualization };
  }
}

function DataModelVisualization({ spec }) {
  if (!spec?.data?.length) {
    return <div className="result-empty modeler-chart-empty">No valid visualization specification was returned by this model.</div>;
  }

  const width = 720;
  const height = 310;
  const left = 64;
  const right = 20;
  const top = 46;
  const bottom = 72;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = spec.data.map((item) => Number(item.value));
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const yFor = (value) => top + ((maxValue - value) / range) * plotHeight;
  const zeroY = yFor(0);
  const slot = plotWidth / spec.data.length;
  const barWidth = Math.min(44, slot * 0.62);
  const points = spec.data.map((item, index) => {
    const x = left + index * slot + slot / 2;
    return [x, yFor(item.value)];
  });
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return <div className="modeler-chart-wrap">
    <svg className="modeler-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={spec.title}>
      <text x={left} y="20" className="modeler-chart-title">{spec.title}</text>
      {ticks.map((fraction) => {
        const value = minValue + range * fraction;
        const y = yFor(value);
        return <g key={fraction}>
          <line x1={left} x2={left + plotWidth} y1={y} y2={y} className="modeler-grid-line" />
          <text x={left - 9} y={y + 4} textAnchor="end" className="modeler-axis-value">{compactAxisNumber(value)}</text>
        </g>;
      })}
      <line x1={left} x2={left + plotWidth} y1={zeroY} y2={zeroY} className="modeler-zero-line" />
      {spec.type === "line"
        ? <>
            <polyline points={points.map(([x, y]) => `${x},${y}`).join(" ")} className="modeler-line" />
            {points.map(([x, y], index) => <circle key={spec.data[index].label + index} cx={x} cy={y} r="4" className="modeler-point"><title>{`${spec.data[index].label}: ${fmtNumber(spec.data[index].value, 2)}`}</title></circle>)}
          </>
        : spec.data.map((item, index) => {
            const x = left + index * slot + (slot - barWidth) / 2;
            const valueY = yFor(item.value);
            const y = Math.min(valueY, zeroY);
            const barHeight = Math.max(2, Math.abs(zeroY - valueY));
            return <rect key={item.label + index} x={x} y={y} width={barWidth} height={barHeight} rx="3" className="modeler-bar">
              <title>{`${item.label}: ${fmtNumber(item.value, 2)}`}</title>
            </rect>;
          })}
      {spec.data.map((item, index) => {
        const x = left + index * slot + slot / 2;
        const short = item.label.length > 14 ? item.label.slice(0, 12) + "…" : item.label;
        return <text key={item.label + "-label-" + index} x={x} y={top + plotHeight + 17} textAnchor="middle" className="modeler-x-label">{short}</text>;
      })}
      {spec.xLabel && <text x={left + plotWidth / 2} y={height - 9} textAnchor="middle" className="modeler-axis-label">{spec.xLabel}</text>}
      {spec.yLabel && <text x="15" y={top + plotHeight / 2} textAnchor="middle" className="modeler-axis-label" transform={`rotate(-90 15 ${top + plotHeight / 2})`}>{spec.yLabel}</text>}
    </svg>
  </div>;
}

function ResultPanel({ title, tone, result, error, dataModeler = false, mixedCapability = false }) {
  const text = assistantText(result);
  const modelerOutput = dataModeler ? parseDataModelerOutput(result) : null;
  const mixed = mixedCapability ? result?.mixed_capability : null;
  const mixedVisual = mixedCapability ? normalizeDataModelVisualization(mixed?.visualization_spec || result?.visualization_spec) : null;
  const test = result?.test_metrics;
  const nuances = Array.isArray(test?.behavior?.behavioral_nuances) ? test.behavior.behavioral_nuances : [];
  const decisionPath = observableDecisionPath(result, tone);
  return <div className={`card result-panel ${tone === "good" ? "governed-panel" : "control-panel"}`}>
    <div className="result-head"><div><strong>{title}</strong><div className="micro">{tone === "good" ? "Policy-enforced governed path" : "CV1.1-off baseline path"}</div></div><StatusPill good={error ? false : result ? (tone === "good" ? true : null) : null} label={error ? "Error" : result ? "Complete" : "Waiting"} /></div>
    {error ? <div className="notice error-notice">{error}</div> : mixedCapability ? <div className="modeler-output-stack">
      <div className="modeler-output-box">
        <div className="section-title">Simple Data Model</div>
        <div className="section-note">{tone === "good" ? "Scope-bound Modeler · governed MCP evidence" : "Modeler · direct control-path data"}</div>
        {mixed?.simple_data_model ? <div className="result-body modeler-result-body">{mixed.simple_data_model}</div> : <div className="result-empty compact-empty">No modeled output returned.</div>}
      </div>
      <div className="modeler-output-box">
        <div className="section-title">Data visualization</div>
        <div className="section-note">{tone === "good" ? "Model-designed visual · verification required before Analyst trigger" : "Visualizer output · no governed verification gate"}</div>
        <DataModelVisualization spec={mixedVisual} />
        {tone === "good" && mixed?.visualization_verification && <div className="framework-tags"><span className="tag">verification: {mixed.visualization_verification.valid === true ? "passed" : "failed"}</span>{mixed.visualization_verification.reason && <span className="tag">{String(mixed.visualization_verification.reason)}</span>}</div>}
      </div>
      <div className="modeler-output-box">
        <div className="section-title">Triggered Analyst</div>
        <div className="section-note">{tone === "good" ? "Triggered only after model + visual + verification PASS" : "Triggered after model + visual completion"}</div>
        {mixed?.analysis ? <div className="result-body modeler-result-body">{mixed.analysis}</div> : <div className="result-empty compact-empty">Analyst was not triggered.</div>}
      </div>
    </div> : dataModeler ? <div className="modeler-output-stack">
      <div className="modeler-output-box">
        <div className="section-title">Simple Data Model</div>
        <div className="section-note">{tone === "good" ? "Output artifact only · source and workspace remain read-only" : "Model-generated data representation from the supplied task and data"}</div>
        {modelerOutput?.text ? <div className="result-body modeler-result-body">{modelerOutput.text}</div> : <div className="result-empty compact-empty">No modeled output returned.</div>}
      </div>
      <div className="modeler-output-box">
        <div className="section-title">Data visualization</div>
        <div className="section-note">{tone === "good" ? (result?.governed_function?.visualization_source === "mcp.dataset.statistics" ? "Deterministic visualization generated from the same bounded governed MCP statistics" : "Bounded visualization generated from the governed data context") : "Visualization generated from the same model response and supplied data context"}</div>
        <DataModelVisualization spec={modelerOutput?.visualization} />
      </div>
    </div> : text ? <div className="result-body">{text}</div> : <div className="result-empty">No output returned.</div>}
    {result && <div className="result-metrics">
      <MetricChip label="Latency" value={fmtMs(test?.timing?.latency_ms)} />
      <MetricChip label="Tokens" value={fmtNumber(test?.usage?.total_tokens)} />
      <MetricChip label="Cost" value={fmtCost(test?.cost?.selected_usd)} />
      <MetricChip label="Integrity" value={test?.integrity?.hmac_sha256 ? `Signed #${test?.integrity?.sequence ?? "?"}` : "Not signed"} />
      {tone === "good" && <MetricChip label="CV1.1" value={result?.cv11?.policy_version || "1.1"} />}
      {tone === "good" && <MetricChip label="Redactions" value={fmtNumber(result?.governed_function?.output_redaction?.total ?? 0)} />}
    </div>}
    {result && <details className="observatory-panel" open>
      <summary>Reasoning observatory</summary>
      <div className="micro">Observable execution decisions and passive runtime telemetry only. This view does not expose hidden model scratchpad, add reasoning instructions, or alter the test prompt.</div>
      <div className="decision-path" aria-label="Observable execution decision path">
        {decisionPath.map((step, index) => <div className="decision-step" key={`${step.label}-${index}`}>
          <span className="decision-step-index">{String(index + 1).padStart(2, "0")}</span>
          <div className="decision-step-body"><strong>{step.label}</strong><span>{step.detail}</span></div>
          <span className="decision-step-state">{step.state}</span>
        </div>)}
      </div>
      <div className="result-metrics observatory-metrics">
        <MetricChip label="Reasoning tokens" value={fmtNumber(test?.usage?.reasoning_tokens ?? 0)} />
        <MetricChip label="Prompt tokens" value={fmtNumber(test?.usage?.prompt_tokens ?? 0)} />
        <MetricChip label="Completion tokens" value={fmtNumber(test?.usage?.completion_tokens ?? 0)} />
        <MetricChip label="Context used" value={test?.usage?.context_utilization_pct == null ? "N/A" : `${fmtNumber(test.usage.context_utilization_pct, 2)}%`} />
        <MetricChip label="Tool calls" value={fmtNumber(test?.behavior?.tool_calls ?? 0)} />
        <MetricChip label="Retries" value={fmtNumber(test?.behavior?.retries ?? 0)} />
        <MetricChip label="Finish reason" value={test?.behavior?.finish_reason || "N/A"} />
        <MetricChip label="Model calls" value={fmtNumber(test?.behavior?.model_calls ?? 0)} />
      </div>
      <div className="observatory-flags">
        <span className="micro">Observed behavioral flags</span>
        <div className="framework-tags">{nuances.length ? nuances.map((item) => <span className="tag" key={item}>{item}</span>) : <span className="tag">none reported</span>}</div>
      </div>
      {tone === "good" && test?.controls?.claim_verification && <div className="observatory-flags">
        <span className="micro">Governed claim verification</span>
        <div className="framework-tags">
          <span className="tag">status: {test.controls.claim_verification.status || "unknown"}</span>
          <span className="tag">evidence: {test.controls.claim_verification.evidence_attached ? "attached" : "none"}</span>
          <span className="tag">post-gen checked: {fmtNumber(test.controls.claim_verification.checked ?? 0)}</span>
          <span className="tag">corrected: {fmtNumber(test.controls.claim_verification.corrected ?? 0)}</span>
        </div>
      </div>}
    </details>}
  </div>;
}

function MetricChip({ label, value }) {
  return <div className="metric-chip"><span>{label}</span><strong>{value}</strong></div>;
}

function DeltaPanel({ summary }) {
  const rows = [
    ["Latency", summary.latency_ms, "ms", 1],
    ["Total tokens", summary.tokens, "", 0],
    ["Cost", summary.cost, "$", 6],
    ["Context utilization", summary.context_pct, "pp", 3],
  ];
  return <div className="card delta-card">
    <div className="card-title-row"><div><div className="section-title">Governed − ungoverned delta</div><div className="section-note">Positive means the governed value was higher.</div></div><span className="badge">Pair comparison</span></div>
    <div className="delta-grid">{rows.map(([label, value, suffix, digits]) => <div className="delta-item" key={label}><span>{label}</span><strong className={value > 0 ? "delta-positive" : value < 0 ? "delta-negative" : ""}>{value === null ? ", " : `${value > 0 ? "+" : ""}${Number(value).toFixed(digits)}${suffix === "$" ? " USD" : suffix ? ` ${suffix}` : ""}`}</strong></div>)}</div>
  </div>;
}

function compactAxisNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(number >= 100_000 ? 0 : 1)}K`;
  return String(Math.round(number));
}

function latencyAxisLabel(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) return "0 s";
  if (Math.abs(milliseconds) >= 1000) {
    const seconds = milliseconds / 1000;
    return `${seconds.toFixed(Math.abs(seconds) >= 10 ? 0 : 1)} s`;
  }
  return `${Math.round(milliseconds)} ms`;
}

function TokenUsageChart({ rows, models, slice = "all" }) {
  const valueKey = slice === "governed" ? "governed_tokens" : slice === "ungoverned" ? "ungoverned_tokens" : "total_tokens";
  const data = Array.isArray(rows) ? rows.filter((item) => Number(item[valueKey]) > 0) : [];
  if (!data.length) return <div className="result-empty compact-empty">No recorded model token usage yet.</div>;

  const modelNames = new Map((models || []).map((item) => [item.key, item.display_name || item.key]));
  const paired = data.every((item) => String(item.model_key || "").includes("::"));
  const groupKeys = paired ? [...new Set(data.map((item) => String(item.model_key).split("::")[0]))] : data.map((item) => item.model_key);
  const width = Math.max(900, groupKeys.length * (paired ? 220 : 105));
  const height = 460;
  const left = 96;
  const right = 24;
  const top = 34;
  const bottom = 140;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey])), 1);
  const costs = data.map((item) => Number(item.cost_usd)).filter((value) => Number.isFinite(value) && value >= 0);
  const maxCost = Math.max(...costs, 0);
  const slotWidth = plotWidth / groupKeys.length;
  const barWidth = Math.min(62, slotWidth * (paired ? 0.3 : 0.62));
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return <div className="token-chart-scroll">
    <svg className="token-usage-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${slice === "all" ? "Total" : slice === "governed" ? "Runtime Enforced" : "OEM Settings"} recorded token usage by model`}>
      <text x="20" y={top + plotHeight / 2} className="token-axis-title" transform={`rotate(-90 20 ${top + plotHeight / 2})`}>Token count</text>
      {ticks.map((fraction) => {
        const y = top + plotHeight - fraction * plotHeight;
        const value = maxValue * fraction;
        return <g key={fraction}>
          <line x1={left} y1={y} x2={width-right} y2={y} className="token-grid-line" />
          <text x={left-10} y={y+4} textAnchor="end" className="token-y-label">{compactAxisNumber(value)}</text>
        </g>;
      })}
      <line x1={left} y1={top} x2={left} y2={top+plotHeight} className="token-axis-line" />
      <line x1={left} y1={top+plotHeight} x2={width-right} y2={top+plotHeight} className="token-axis-line" />
      {data.map((item, index) => {
        const value = Number(item[valueKey]);
        const barHeight = Math.max(2, (value / maxValue) * plotHeight);
        const baseKey = paired ? String(item.model_key).split("::")[0] : item.model_key;
        const groupIndex = paired ? groupKeys.indexOf(baseKey) : index;
        const governed = Number(item.governed_tokens || 0) > 0;
        const pairIndex = governed ? 0 : 1;
        const x = paired
          ? left + groupIndex * slotWidth + (slotWidth - barWidth * 2) / 2 + pairIndex * barWidth
          : left + groupIndex * slotWidth + (slotWidth - barWidth) / 2;
        const y = top + plotHeight - barHeight;
        const cost = Number(item.cost_usd);
        const hasCost = Number.isFinite(cost) && cost >= 0;
        const costY = hasCost ? top + plotHeight - (maxCost > 0 ? (cost / maxCost) * plotHeight : 0) : null;
        const label = modelNames.get(item.model_key) || item.requested_model_id || item.model_key;
        const baseLabel = paired ? String(label).replace(/ · (Runtime Enforced|OEM Settings)$/, "") : label;
        const shortLabel = baseLabel.length > 24 ? baseLabel.slice(0, 22) + "…" : baseLabel;
        return <g key={item.model_key}>
          <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" className={`token-bar ${governed ? "token-bar-governed" : "token-bar-ungoverned"}`}>
            <title>{`${label}: ${fmtNumber(value)} tokens · ${fmtNumber(item.runs || 0)} run${Number(item.runs || 0) === 1 ? "" : "s"}`}</title>
          </rect>
          {hasCost && <circle cx={x + barWidth / 2} cy={costY} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5"><title>{`${label} cost: ${fmtCost(cost)}`}</title></circle>}
          <text x={x + barWidth / 2} y={Math.max(18, y - 8)} textAnchor="middle" className="token-bar-value">{compactAxisNumber(value)}</text>
          {(!paired || pairIndex === 0) && <text x={paired ? left + groupIndex * slotWidth + slotWidth / 2 : x + barWidth / 2} y={top + plotHeight + 15} textAnchor="middle" className="token-x-label">{shortLabel}</text>}
        </g>;
      })}
      <text x={left + plotWidth / 2} y={height - 8} textAnchor="middle" className="token-x-axis-title">Models</text>
    </svg>
    <div className="comparison-chart-legend">
      <span><i className="comparison-cost-dot-key"/>Cost</span>
      <span className="section-note">Red dot position is scaled to selected-model cost. Hover for exact USD.</span>
    </div>
  </div>;
}

function telemetryUse(run) {
  const operation = String(run?.operation || "").toLowerCase();
  const fn = String(run?.function_key || "").toLowerCase();
  return operation === "chat" ||
    operation === "chatbot" ||
    operation.startsWith("chatbot.") ||
    fn === "chat" ||
    fn === "chatbot"
    ? "chatbot"
    : "arena";
}

function OverallConsumptionCharts({ runs, models, splitByUse = false }) {
  const names = new Map((models || []).map((m) => [m.key, m.display_name || m.key]));
  const totals = new Map();

  for (const run of runs || []) {
    if (!run?.model_key) continue;
    const use = telemetryUse(run);
    const bucketKey = splitByUse ? `${run.model_key}::${use}` : run.model_key;
    const item = totals.get(bucketKey) || {
      modelKey: run.model_key,
      use,
      prompt: 0,
      reasoning: 0,
      completion: 0,
      latency: 0,
      runs: 0,
    };
    const prompt = Number(run.prompt_tokens || 0);
    const reasoning = Number(run.reasoning_tokens || 0);
    const completion = Math.max(0, Number(run.completion_tokens || 0) - reasoning);
    item.prompt += prompt;
    item.reasoning += reasoning;
    item.completion += completion;
    item.latency += Number(run.latency_ms || 0);
    item.runs += 1;
    totals.set(bucketKey, item);
  }

  const rows = [...totals.entries()]
    .map(([key, v]) => {
      const baseLabel = names.get(v.modelKey) || v.modelKey;
      const useLabel = v.use === "chatbot" ? "Chatbot" : "Arena";
      return {
        key,
        label: splitByUse ? `${baseLabel} · ${useLabel}` : baseLabel,
        ...v,
      };
    })
    .sort((a, b) => (b.prompt + b.reasoning + b.completion) - (a.prompt + a.reasoning + a.completion));

  const render = (metric) => {
    const labelChars = Math.max(8, ...rows.map((r) => String(r.label || "").length));
    const labelSpace = Math.min(220, Math.max(90, labelChars * 6.5));
    const width = Math.max(760, rows.length * Math.max(90, Math.min(125, 900 / Math.max(1, rows.length))));
    const height = 280 + labelSpace;
    const left = 70;
    const right = 24;
    const top = 30;
    const bottom = labelSpace;
    const pw = width - left - right;
    const ph = height - top - bottom;
    const slot = rows.length ? pw / rows.length : pw;
    const bw = Math.min(58, slot * .62);
    const latencyValue = (r) => r.runs > 0 ? r.latency / r.runs : 0;
    const max = Math.max(1, ...rows.map((r) => metric === "latency" ? latencyValue(r) : r.prompt + r.reasoning + r.completion));

    return <div className="token-chart-shell">
      <div className="section-title">{metric === "latency" ? "Average model latency" : "Overall model token consumption"}</div>
      <div className="section-note">
        {metric === "latency"
          ? (splitByUse ? "Average post-MCP latency per completed model call by model and use" : "Average post-MCP latency per completed model call by model")
          : (splitByUse ? "Cumulative prompt, reasoning, and completion token usage across completed model calls by model and use" : "Cumulative prompt, reasoning, and completion token usage across completed model calls by model")}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="token-chart">
        {[0, .25, .5, .75, 1].map((p) => <g key={p}>
          <line x1={left} x2={left + pw} y1={top + ph - p * ph} y2={top + ph - p * ph} className="token-grid-line" />
          <text x={left - 10} y={top + ph - p * ph + 4} textAnchor="end" className="token-y-label">{metric === "latency" ? latencyAxisLabel(max * p) : compactAxisNumber(max * p)}</text>
        </g>)}
        {rows.map((r, i) => {
          const x = left + i * slot + (slot - bw) / 2;
          if (metric === "latency") {
            const value = latencyValue(r);
            const h = (value / max) * ph;
            return <g key={r.key}>
              <rect x={x} y={top + ph - h} width={bw} height={h} rx="3" className="token-bar token-bar-governed">
                <title>{`${r.label}: ${fmtNumber(value, 1)} ms average across ${fmtNumber(r.runs)} run${r.runs === 1 ? "" : "s"}`}</title>
              </rect>
              <text x={x + bw / 2} y={top + ph + 12} textAnchor="middle" className="token-x-label">{r.label}</text>
            </g>;
          }
          const parts = [["prompt", r.prompt, "var(--accent)"], ["reasoning", r.reasoning, "#ffffff"], ["completion", r.completion, "#8b5cf6"]];
          let used = 0;
          return <g key={r.key}>
            {parts.map(([name, val, color]) => {
              const h = (val / max) * ph;
              const y = top + ph - used - h;
              used += h;
              return <rect key={name} x={x} y={y} width={bw} height={h} fill={color}>
                <title>{`${r.label} · ${name}: ${fmtNumber(val)} tokens`}</title>
              </rect>;
            })}
            <text x={x + bw / 2} y={top + ph + 12} textAnchor="middle" className="token-x-label">{r.label}</text>
          </g>;
        })}
      </svg>
      {metric !== "latency" && <div className="chart-inline-legend">
        <span><i style={{ background: "var(--accent)" }} />Prompt</span>
        <span className="reasoning-legend-label" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff", fontWeight: "400" }}><i style={{ background: "#ffffff" }} />Reasoning</span>
        <span><i style={{ background: "#8b5cf6" }} />Completion</span>
      </div>}
    </div>;
  };

  return <div className="overall-consumption-charts">{render("tokens")}{render("latency")}</div>;
}

function FreeModelUsageTable({ runs, models }) {
  const names = new Map((models || []).map((m) => [m.key, m.display_name || m.key]));
  const totals = { arena: { prompt:0, reasoning:0, completion:0, total:0, latency:0, runs:0 }, chatbot: { prompt:0, reasoning:0, completion:0, total:0, latency:0, runs:0 } };
  for (const run of runs || []) {
    const operation = String(run.operation || "").toLowerCase();
    const fn = String(run.function_key || "").toLowerCase();
    const use = operation === "chat" || operation === "chatbot" || operation.startsWith("chatbot.") || fn === "chat" || fn === "chatbot" ? "chatbot" : "arena";
    const bucket = totals[use];
    const reasoning = Number(run.reasoning_tokens || 0);
    bucket.prompt += Number(run.prompt_tokens || 0);
    bucket.reasoning += reasoning;
    bucket.completion += Math.max(0, Number(run.completion_tokens || 0) - reasoning);
    bucket.total += Number(run.total_tokens || 0);
    bucket.latency += Number(run.latency_ms || 0);
    bucket.runs += 1;
  }
  const rows = [["arena","Arena"],["chatbot","Chatbot"]].map(([key,label]) => ({ key,label,...totals[key] }));
  const freeNames = [...new Set((runs || []).map((run) => names.get(run.model_key) || run.model_key).filter(Boolean))].join(", ") || "Free model";
  return <div className="free-model-metrics">
    <div className="section-title">Free model usage metrics</div>
    <div className="section-note">{freeNames} · Arena vs Chatbot from recorded telemetry</div>
    <div className="table-wrap"><table className="evidence-table"><thead><tr><th>Use</th><th>Runs</th><th>Prompt tokens</th><th>Reasoning tokens</th><th>Completion tokens</th><th>Total tokens</th><th>Avg latency</th></tr></thead><tbody>
      {rows.map((r) => <tr key={r.key}><td>{r.label}</td><td>{fmtNumber(r.runs)}</td><td>{fmtNumber(r.prompt)}</td><td>{fmtNumber(r.reasoning)}</td><td>{fmtNumber(r.completion)}</td><td>{fmtNumber(r.total)}</td><td>{fmtMs(r.runs > 0 ? r.latency / r.runs : null)}</td></tr>)}
    </tbody></table></div>
  </div>;
}


function MixedCapabilityLatestComparison({ runs, models }) {
  const mixedRuns = useMemo(() => [...(runs || [])]
    .filter((run) => String(run?.function_key || "").toLowerCase() === "mixed_capability")
    .sort((a, b) => String(b?.recorded_at || "").localeCompare(String(a?.recorded_at || ""))), [runs]);

  const modelNames = useMemo(
    () => new Map((models || []).map((model) => [model.key, model.display_name || model.key])),
    [models],
  );

  const rows = useMemo(() => {
    const latestOrder = [];
    const pathsByModel = new Map();
    for (const run of mixedRuns) {
      if (!run?.model_key) continue;
      if (!latestOrder.includes(run.model_key)) latestOrder.push(run.model_key);
      const paths = pathsByModel.get(run.model_key) || new Set();
      if (run.governance === "governed" || run.governance === "ungoverned") paths.add(run.governance);
      pathsByModel.set(run.model_key, paths);
    }
    const ordered = [
      ...latestOrder.filter((key) => (pathsByModel.get(key)?.size || 0) === 2),
      ...latestOrder.filter((key) => (pathsByModel.get(key)?.size || 0) !== 2),
    ].slice(0, 4);
    return ordered.map((modelKey) => ({
      modelKey,
      label: modelNames.get(modelKey) || modelKey,
      governed: mixedRuns.find((run) => run.model_key === modelKey && run.governance === "governed") || null,
      ungoverned: mixedRuns.find((run) => run.model_key === modelKey && run.governance === "ungoverned") || null,
    }));
  }, [mixedRuns, modelNames]);

  if (!rows.length) {
    return <div className="mixed-comparison-block">
      <div className="section-header"><div><div className="section-title">Latest Mixed Capability comparison</div><div className="section-note">Governed and ungoverned telemetry by model.</div></div></div>
      <div className="result-empty compact-empty">No Mixed Capability telemetry has been recorded yet.</div>
    </div>;
  }

  const pair = (row, key, formatter) => <div className="mixed-compact-pair">
    <span title={row.governed?.run_id ? `Governed run ${row.governed.run_id}` : ""}>G&nbsp; {row.governed?.[key] == null ? "N/A" : formatter(row.governed[key])}</span>
    <span title={row.ungoverned?.run_id ? `Ungoverned run ${row.ungoverned.run_id}` : ""}>U&nbsp; {row.ungoverned?.[key] == null ? "N/A" : formatter(row.ungoverned[key])}</span>
  </div>;

  return <div className="mixed-comparison-block">
    <div className="section-header">
      <div><div className="section-title">Latest Mixed Capability comparison</div><div className="section-note">Latest governed and ungoverned run for four models. Hover a value for its run ID.</div></div>
      <span className="badge">{rows.length} model{rows.length === 1 ? "" : "s"}</span>
    </div>
    <div className="table-wrap mixed-latest-run-table">
      <table className="evidence-table">
        <thead><tr><th>Model</th><th>Latency</th><th>Total tokens</th><th>Cost</th><th>Recorded</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.modelKey}>
          <td><strong>{row.label}</strong></td>
          <td>{pair(row, "latency_ms", fmtMs)}</td>
          <td>{pair(row, "total_tokens", (value) => fmtNumber(value))}</td>
          <td>{pair(row, "selected_cost_usd", fmtCost)}</td>
          <td className="mixed-compact-pair">
            <span>G&nbsp; {row.governed?.recorded_at ? new Date(row.governed.recorded_at).toLocaleString() : "N/A"}</span>
            <span>U&nbsp; {row.ungoverned?.recorded_at ? new Date(row.ungoverned.recorded_at).toLocaleString() : "N/A"}</span>
          </td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}

const EVIDENCE_FUNCTION_OPTIONS = [
  ["analyst", "Analyst"],
  ["data_modeler", "Data Modeler"],
  ["mixed_capability", "Mixed Capability"],
  ["auditor", "Auditor"],
  ["advisor", "Advisor"],
];

function Evidence({ evidence, onClear, models, showLedger = true }) {
  const complete = evidence.filter((item) => item.governed?.completed && item.ungoverned?.completed);
  const avg = (path) => {
    const values = complete.map(path).filter((value) => Number.isFinite(Number(value))).map(Number);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const avgLatencyDelta = avg((item) => item.delta?.latency_ms);
  const avgTokenDelta = avg((item) => item.delta?.tokens);
  const avgCostDelta = avg((item) => item.delta?.cost);
  const policyPass = evidence.filter((item) => item.governed?.completed && !item.governed?.error).length;

  const [comparisonRuns, setComparisonRuns] = useState([]);
  const [comparisonError, setComparisonError] = useState("");
  const [domainSlice, setDomainSlice] = useState("6");
  const [pathSlice, setPathSlice] = useState("governed");
  const [functionSlice, setFunctionSlice] = useState("analyst");
  const [modelOne, setModelOne] = useState("");
  const [modelTwo, setModelTwo] = useState("");
  const [modelThree, setModelThree] = useState("");
  const [modelFour, setModelFour] = useState("");
  const [overallPathSlice, setOverallPathSlice] = useState("all");
  const [overallFunctionSlice, setOverallFunctionSlice] = useState("all");
  const [overallFamily, setOverallFamily] = useState("all");
  const [overallUseSlice, setOverallUseSlice] = useState("arena");

  useEffect(() => {
    let cancelled = false;
    const refreshComparisonRuns = async () => {
      try {
        const payload = await apiRequest("/api/v1/system/telemetry/comparison-runs?limit=2000", { timeoutMs: 15000 });
        if (!cancelled) {
          setComparisonRuns(Array.isArray(payload?.runs) ? payload.runs : []);
          setComparisonError("");
        }
      } catch (error) {
        if (!cancelled) setComparisonError(error.message);
      }
    };
    refreshComparisonRuns();
    const refreshTimer = window.setInterval(refreshComparisonRuns, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [evidence.length]);

  const normalizeFunction = (value) => value === "evaluator" ? "auditor" : String(value || "").toLowerCase();
  const runMatchesDomain = (run, domainId) => {
    const domain = DOMAINS.find((item) => String(item.id) === String(domainId));
    if (!domain) return true;
    const numericId = run.system_id ?? run.domain_id;
    if (numericId != null && String(numericId) === String(domain.id)) return true;
    const recordedDomain = String(run.domain_key ?? run.domain ?? run.domain_name ?? "").toLowerCase();
    return recordedDomain === domain.key.toLowerCase() || recordedDomain === domain.name.toLowerCase();
  };
  const availableModels = useMemo(() => {
    const keys = [];
    for (const run of comparisonRuns) {
      if (!runMatchesDomain(run, domainSlice) || normalizeFunction(run.function_key) !== functionSlice) continue;
      if (run.model_key && !keys.includes(run.model_key)) keys.push(run.model_key);
    }
    return keys;
  }, [comparisonRuns, domainSlice, functionSlice]);

  useEffect(() => {
    if (!availableModels.length) {
      setModelOne("");
      setModelTwo("");
      return;
    }
    setModelOne((current) => availableModels.includes(current) ? current : availableModels[0]);
    setModelTwo((current) => availableModels.includes(current) ? current : (availableModels[1] || availableModels[0]));
    setModelThree((current) => availableModels.includes(current) ? current : (availableModels[2] || ""));
    setModelFour((current) => availableModels.includes(current) ? current : (availableModels[3] || ""));
  }, [availableModels.join("|")]);

  const selectedRuns = useMemo(() => {
    const selected = [modelOne, modelTwo, modelThree, modelFour].filter(Boolean).filter((key, index, values) => values.indexOf(key) === index);
    const numericMean = (runs, key) => {
      const values = runs.map((run) => Number(run[key])).filter(Number.isFinite);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };
    return selected.flatMap((modelKey) => ["governed", "ungoverned"].map((governance) => {
      const matches = comparisonRuns
        .filter((run) =>
          run.model_key === modelKey &&
          runMatchesDomain(run, domainSlice) &&
          run.governance === governance &&
          normalizeFunction(run.function_key) === functionSlice
        )
        .sort((a, b) => new Date(b.recorded_at || 0) - new Date(a.recorded_at || 0));
      if (!matches.length) return null;
      if (functionSlice === "mixed_capability") {
        return { ...matches[0], sample_size: 1, aggregation: "latest" };
      }
      return {
        ...matches[0],
        prompt_tokens: numericMean(matches, "prompt_tokens"),
        reasoning_tokens: numericMean(matches, "reasoning_tokens"),
        completion_tokens: numericMean(matches, "completion_tokens"),
        total_tokens: numericMean(matches, "total_tokens"),
        latency_ms: numericMean(matches, "latency_ms"),
        selected_cost_usd: numericMean(matches, "selected_cost_usd"),
        sample_size: matches.length,
        aggregation: "mean",
      };
    }).filter(Boolean));
  }, [comparisonRuns, domainSlice, functionSlice, modelOne, modelTwo, modelThree, modelFour]);

  const comparisonChartRows = selectedRuns.map((run) => ({
    model_key: `${run.model_key}::${run.governance}`,
    total_tokens: Number(run.total_tokens || 0),
    governed_tokens: run.governance === "governed" ? Number(run.total_tokens || 0) : 0,
    ungoverned_tokens: run.governance === "ungoverned" ? Number(run.total_tokens || 0) : 0,
    cost_usd: run.selected_cost_usd == null ? null : Number(run.selected_cost_usd),
    runs: run.sample_size || 1,
  }));
  const comparisonChartModels = selectedRuns.map((run) => ({
    key: `${run.model_key}::${run.governance}`,
    display_name: `${(models || []).find((model) => model.key === run.model_key)?.display_name || run.model_key} · ${run.governance === "governed" ? "Runtime Enforced" : "OEM Settings"}`,
  }));

  const modelFamilyClass = (key) => {
    const model = (models || []).find((item) => item.key === key);
    const identity = [key, model?.display_name, model?.model_id, model?.requested_model_id].filter(Boolean).join(" ").toLowerCase();
    if (!model) return "unknown";
    if (model.access_class === "open_weights") return "open_weights";
    if (model.access_class === "frontier") return "frontier";
    return "other";
  };
  const overallConsumptionRuns = useMemo(() => comparisonRuns.filter((run) =>
    (overallUseSlice === "all" || telemetryUse(run) === overallUseSlice) &&
    (overallPathSlice === "all" || run.governance === overallPathSlice) &&
    (overallFunctionSlice === "all" || normalizeFunction(run.function_key) === overallFunctionSlice) &&
    (overallFamily === "all" || modelFamilyClass(run.model_key) === overallFamily)
  ), [comparisonRuns, overallUseSlice, overallPathSlice, overallFunctionSlice, overallFamily, models]);

  const freeModelMetricRuns = useMemo(() => comparisonRuns.filter((run) =>
    modelFamilyClass(run.model_key) === "free_model"
  ), [comparisonRuns, models]);

  const modelLabel = (key) => (models || []).find((model) => model.key === key)?.display_name || key;
  const domainLabel = DOMAINS.find((domain) => String(domain.id) === String(domainSlice))?.name || "All domains";
  const functionLabel = EVIDENCE_FUNCTION_OPTIONS.find(([key]) => key === functionSlice)?.[1] || functionSlice;
  const pathLabel = "Runtime Enforced + OEM Settings";
  const comparisonBasis = functionSlice === "mixed_capability"
    ? "Latest logged Runtime Enforced and latest logged OEM Settings Mixed Capability run for each selected model."
    : `Separate Runtime Enforced and OEM Settings means across all logged ${functionLabel} runs for each selected model and domain.`;

  return <>
    <div className="notice">
      <strong>Development note:</strong> During testing, a 1,200-output-token limit was found to truncate model output in Agentic Arena. The output-token limit was therefore increased from 1,200 to 2,500, and then increased a final time to 5,000 tokens.
    </div>
    <section className="section card token-chart-card">


      {comparisonError ? <div className="notice error-notice">{comparisonError}</div> : <>
        <div className="overall-chart-controls">
          <div className="field">
            <label>Overall chart use</label>
            <div className="token-slicer" role="group" aria-label="Overall chart use slicer">
              {[["arena","Arena"],["chatbot","Chatbot"],["all","All (split)"]].map(([key,label]) =>
                <button key={key} className={`token-slicer-button ${overallUseSlice === key ? "active" : ""}`} onClick={() => setOverallUseSlice(key)}>{label}</button>
              )}
            </div>
          </div>
          <div className="field">
            <label>Overall chart path</label>
            <div className="token-slicer" role="group" aria-label="Overall chart governance path slicer">
              {[["all","All"],["governed","Runtime Enforced"],["ungoverned","OEM Settings"]].map(([key,label]) =>
                <button key={key} className={`token-slicer-button ${overallPathSlice === key ? "active" : ""}`} onClick={() => setOverallPathSlice(key)}>{label}</button>
              )}
            </div>
          </div>
          <div className="field">
            <label>Overall chart function</label>
            <div className="token-slicer" role="group" aria-label="Overall chart function slicer">
              {[["all", "All"], ...EVIDENCE_FUNCTION_OPTIONS].map(([key,label]) =>
                <button key={key} className={`token-slicer-button ${overallFunctionSlice === key ? "active" : ""}`} onClick={() => setOverallFunctionSlice(key)}>{label}</button>
              )}
            </div>
          </div>
          <div className="field">
            <label>Overall chart family class</label>
            <div className="token-slicer" role="group" aria-label="Overall chart family class slicer">
              {[["all","All"],["frontier","Frontier / hosted"],["open_weights","Open weights"],["free_model","Free Model"]].map(([key,label]) =>
                <button key={key} className={`token-slicer-button ${overallFamily === key ? "active" : ""}`} onClick={() => setOverallFamily(key)}>{label}</button>
              )}
            </div>
          </div>
        </div>
        <OverallConsumptionCharts runs={overallConsumptionRuns} models={models} splitByUse={overallUseSlice === "all"} />
        {overallFamily === "free_model" && <FreeModelUsageTable runs={freeModelMetricRuns} models={models} />}
        <div className="section-header">
        <div>
          <div className="section-title">Four-model performance comparison</div>
          <div className="section-note">{comparisonBasis}</div>
        </div>
        <span className="badge">{domainLabel} · {pathLabel} · {functionLabel}</span>
      </div>

      <div className="evidence-comparison-controls evidence-comparison-controls-vertical">
        <div className="comparison-slicer-row">
          <div className="field">
            <label>Domain</label>
            <select value={domainSlice} onChange={(event) => setDomainSlice(event.target.value)} aria-label="Comparison domain">
              {DOMAINS.map((domain) => <option key={domain.id} value={String(domain.id)}>{domain.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Function</label>
            <div className="token-slicer" role="group" aria-label="Function slicer">
              {EVIDENCE_FUNCTION_OPTIONS.map(([key,label]) =>
                <button key={key} className={`token-slicer-button ${functionSlice === key ? "active" : ""}`} onClick={() => setFunctionSlice(key)}>{label}</button>
              )}
            </div>
          </div>
          <div className="field">
            <label>Paths shown</label>
            <div className="token-slicer" role="group" aria-label="Execution paths shown">
              <button className="token-slicer-button active" type="button">Runtime Enforced</button>
              <button className="token-slicer-button active" type="button">OEM Settings</button>
            </div>
          </div>
        </div>
        <div className="model-comparison-grid">
          <div className="field"><label>Model 1</label><select value={modelOne} onChange={(e) => setModelOne(e.target.value)}>{availableModels.map((key) => <option key={key} value={key}>{modelLabel(key)}</option>)}</select></div>
          <div className="field"><label>Model 2</label><select value={modelTwo} onChange={(e) => setModelTwo(e.target.value)}>{availableModels.map((key) => <option key={key} value={key}>{modelLabel(key)}</option>)}</select></div>
          <div className="field"><label>Model 3</label><select value={modelThree} onChange={(e) => setModelThree(e.target.value)}><option value="">None</option>{availableModels.map((key) => <option key={key} value={key}>{modelLabel(key)}</option>)}</select></div>
          <div className="field"><label>Model 4</label><select value={modelFour} onChange={(e) => setModelFour(e.target.value)}><option value="">None</option>{availableModels.map((key) => <option key={key} value={key}>{modelLabel(key)}</option>)}</select></div>
        </div>
      </div>
        <TokenUsageChart rows={comparisonChartRows} models={comparisonChartModels} slice="all" />
        <div className="table-wrap model-telemetry-table-wrap">
          <table className="evidence-table">
            <thead><tr><th>Model</th><th>Function</th><th>Path</th><th>Prompt tokens</th><th>Reasoning tokens</th><th>Total tokens</th><th>Latency</th><th>Cost</th><th>Basis</th></tr></thead>
            <tbody>
              {selectedRuns.map((run) => <tr key={`${run.model_key}-${run.governance}`}>
                <td>{modelLabel(run.model_key)}</td>
                <td>{functionLabel}</td>
                <td>{run.governance === "governed" ? "Runtime Enforced" : "OEM Settings"}</td>
                <td>{fmtNumber(run.prompt_tokens || 0)}</td>
                <td>{fmtNumber(run.reasoning_tokens || 0)}</td>
                <td>{fmtNumber(run.total_tokens || 0)}</td>
                <td>{run.latency_ms == null ? ", " : `${fmtNumber(run.latency_ms, 1)} ms`}</td>
                <td>{fmtCost(run.selected_cost_usd)}</td>
                <td className="mono-cell">{run.aggregation === "latest" ? run.run_id : `Mean of ${run.sample_size} runs`}</td>
              </tr>)}
              {!selectedRuns.length && <tr><td colSpan="9">No recorded runs match these slicers.</td></tr>}
            </tbody>
          </table>
        </div>
      </>}
    </section>

    {showLedger && <section className="section card">
      <div className="section-header"><div><div className="section-title">Test evidence ledger</div><div className="section-note">Newest first · maximum 100 browser-local records</div></div><div className="button-row"><button className="ghost small-button" disabled={!evidence.length} onClick={() => downloadJson(`agentic-arena-evidence-${new Date().toISOString().slice(0,10)}.json`, { exported_at: new Date().toISOString(), records: evidence })}>Export metrics</button><button className="danger-button small-button" disabled={!evidence.length} onClick={onClear}>Clear local evidence</button></div></div>
      {evidence.length ? <div className="table-wrap"><table className="evidence-table"><thead><tr><th>Time</th><th>Domain</th><th>Function</th><th>Model</th><th>Pair</th><th>Δ latency</th><th>Δ tokens</th><th>Δ cost</th><th>Policy</th></tr></thead><tbody>{evidence.map((item) => <tr key={item.id}><td>{new Date(item.captured_at).toLocaleString()}</td><td>{item.domain_name}</td><td>{item.function_key}</td><td className="mono-cell">{item.model_key}</td><td><StatusPill good={item.governed.completed && item.ungoverned.completed ? true : false} label={item.governed.completed && item.ungoverned.completed ? "Complete" : "Partial"} /></td><td>{item.delta?.latency_ms == null ? ", " : `${item.delta.latency_ms >= 0 ? "+" : ""}${fmtNumber(item.delta.latency_ms, 1)} ms`}</td><td>{item.delta?.tokens == null ? ", " : `${item.delta.tokens >= 0 ? "+" : ""}${fmtNumber(item.delta.tokens)}`}</td><td>{item.delta?.cost == null ? ", " : fmtCost(item.delta.cost)}</td><td>{item.governed.policy || (item.governed.completed ? "1.1" : ", ")}</td></tr>)}</tbody></table></div> : <div className="result-empty compact-empty">No local evidence yet. Run a matched pair in Runtime Testbed.</div>}
    </section>}

  </>;
}

function RuntimeLogbook() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadLogbook() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/api/v1/system/runtime-logbook?limit=25", { timeoutMs: 20000 });
      setPayload(result);
    } catch (err) {
      setError(err?.message || "Runtime Logbook could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogbook();
  }, []);

  const runs = Array.isArray(payload?.runs) ? payload.runs : [];
  const status = payload?.database_status || {};

  return <>
    <section className="section card">
      <div className="section-header">
        <div>
          <div className="section-title">Runtime Logbook</div>
          <div className="section-note">Neon evidence databases · newest 25 recorded runs · read only</div>
        </div>
        <button className="secondary small-button" onClick={loadLogbook} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
      </div>
      <p className="body-copy">This logbook surfaces the 25 most recent recorded Arena runs from the Neon evidence databases. Each persisted run record is shown in full for transparency.</p>
      <div className="flow compact-flow" aria-label="Runtime execution flow">
        {["Prompt", "Backend", "Governed / ungoverned split", "Static Neon system database", "API", "Output"].map((item, index, items) => <React.Fragment key={item}><div className="flow-node">{item}</div>{index < items.length - 1 && <div className="flow-arrow">→</div>}</React.Fragment>)}
      </div>
      <p className="body-copy">The static source datasets themselves are not published here. Signed run records are written separately to the governed and ungoverned Neon evidence databases and merged here by recorded time, newest first. To request a copy of the static datasets, email <a href="mailto:jwpoitevint1@gmail.com">jwpoitevint1@gmail.com</a>.</p>
      <div className="button-row logbook-status-row">
        <StatusPill good={status.governed === "ok" ? true : status.governed ? false : null} label={`Governed evidence: ${status.governed || "checking"}`} />
        <StatusPill good={status.ungoverned === "ok" ? true : status.ungoverned ? false : null} label={`Ungoverned evidence: ${status.ungoverned || "checking"}`} />
        <span className="badge">{runs.length} / 25 runs surfaced</span>
      </div>
      {error && <div className="notice error-notice page-notice">{error}</div>}
    </section>

    <section className="section">
      {loading && !runs.length && <div className="empty-state"><div className="spinner" /><strong>Loading Runtime Logbook</strong><span>Reading the newest signed records from Neon.</span></div>}
      {!loading && !error && !runs.length && <div className="empty-state"><div className="empty-mark">25</div><strong>No recorded runs available</strong><span>The evidence databases returned no run records.</span></div>}
      <div className="logbook-list">
        {runs.map((item, index) => {
          const record = item?.record && typeof item.record === "object" ? item.record : {};
          const execution = record?.execution || {};
          const model = record?.model || {};
          const integrity = record?.integrity || {};
          return <details className="card logbook-run" key={item.run_id || `${item.recorded_at}-${index}`}>
            <summary className="logbook-summary">
              <span className="logbook-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="logbook-summary-main">
                <strong>{item.governance || execution.governance || "run"}</strong>
                <span>{item.recorded_at ? new Date(item.recorded_at).toLocaleString() : "Recorded time unavailable"}</span>
              </span>
              <span className="logbook-summary-meta">
                <span>{execution.domain || "domain"}</span>
                <span>{execution.function_key || "function"}</span>
                <span>{model.key || "model"}</span>
              </span>
            </summary>
            <div className="logbook-record-meta">
              <span className="tag">Run ID: {item.run_id || record.run_id || "N/A"}</span>
              <span className="tag">Integrity sequence: {integrity.sequence ?? "N/A"}</span>
              <span className="tag">{integrity.event_hash ? "Signed" : "Unsigned"}</span>
            </div>
            <pre className="json-box logbook-json">{JSON.stringify(record, null, 2)}</pre>
          </details>;
        })}
      </div>
    </section>
  </>;
}

function TestingObservations() {
  const observationGroups = [
    {
      key: "method",
      eyebrow: "01 · Test design and comparison integrity",
      title: "Control the comparison before interpreting the result",
      note: "These observations define what has to stay stable, what can contaminate a matched pair, and what historical evidence can or cannot support.",
      items: [
        {
          title: "Prompt language can contaminate the control condition",
          status: "Observed",
          detail: "During Data Modeler testing, shared task wording used terms such as authorized, auditable, bounded, and no mutation. Ungoverned outputs echoed that language even though CV1.1, OPA, governed MCP execution, and governed egress controls were bypassed. Task hashes and UI review traced the effect to shared prompt wording. Shared task templates and ungoverned system prompts were then neutralized."
        },
        {
          title: "Governed and ungoverned paths must be verified independently",
          status: "Observed",
          detail: "The control path can be free of CV1.1, OPA, governed MCP execution, claim verification, and governed egress controls while still being linguistically contaminated by shared language. Runtime isolation and prompt neutrality are therefore tested as separate conditions."
        },
        {
          title: "UI testing can expose comparison drift",
          status: "Observed",
          detail: "Backend isolation tests can pass while shared UI task text or result labels still introduce governance-specific language. Visual review after changes is therefore used as a regression step alongside code tests, telemetry inspection, and prompt-hash checks."
        },
        {
          title: "Output-token ceilings can change the apparent result",
          status: "Observed",
          detail: "A 1,200-output-token ceiling truncated some model responses. The ceiling was increased to 2,500 and then to 5,000 tokens. Reasoning-heavy routes may consume completion budget before a visible final answer is emitted, so a missing or cut-off answer is not automatically treated as a model or gateway failure."
        },
      ],
    },
    {
      key: "evidence",
      eyebrow: "02 · Evidence and verification",
      title: "Move exact facts toward deterministic computation",
      note: "These observations separate what the model can usefully interpret from what the platform should compute, verify, or fail closed on.",
      items: [
        {
          title: "Plausible modeling does not guarantee reliable aggregation",
          status: "Observed",
          detail: "A model can produce a structurally useful relational or dimensional design while manually deriving an incorrect count from row context. Other runs reproduced directly supplied numeric values correctly. This distinction led to tighter separation between model-generated structure and database-computed quantitative evidence."
        },
        {
          title: "Required MCP boundaries need fail-closed execution",
          status: "Observed",
          detail: "Data Modeler testing showed that allowing a direct-data fallback weakens the meaning of an MCP-required governed path. The governed path now requires its declared MCP evidence boundary and stops before model execution when required context is unavailable."
        },
        {
          title: "Tune governance to the observed failure mode, not only the model name",
          status: "Observed",
          detail: "Current testing supports a failure-mode-first tuning approach. Governance should be adjusted to the error the model is actually producing, not merely to the vendor or model label. A practical control chain is: failure type → risk level → verification method → output contract → escalation requirement. Numerical or factual fabrication should trigger deterministic verification and stronger factual checks; summarization drift should trigger a tighter definition of summary, source-faithfulness requirements, and explicit highlighting of factual data; secondary aggregation or semantic expansion should require deterministic grouped evidence or clearer separation between observed facts, derived values, and interpretation. Higher-impact information can justify multiple independent verification checks before release."
        },
      ],
    },
    {
      key: "fit",
      eyebrow: "03 · Model and function fit",
      title: "The same governance representation does not affect every model the same way",
      note: "These observations focus on capability, response characteristics, repeatability, and compatibility with a particular function and evidence path.",
      items: [
        {
          title: "Post-MCP GPT-5.5 Finance runs are highly repeatable under governance",
          status: "Observed",
          detail: "Across four post-MCP Finance Analyst matched pairs using GPT-5.5, governed responses repeatedly converged on the same bounded factual analysis. Governed pairwise output similarity averaged 0.888, versus 0.822 for controls. Governed runs averaged 24.48 seconds latency, 735 reasoning tokens, 2,698 completion tokens, and $0.1160 selected cost; controls averaged 43.61 seconds, 2,713 reasoning tokens, 4,672 completion tokens, and $0.1708. All four governed runs ended normally with stop, while two of four controls reached the 5,000-token ceiling. This remains a repeated observation within this model, domain, and function configuration, not a general causal claim."
        },
        {
          title: "Governance tuning should account for model capacity, capability, and function",
          status: "Observed",
          detail: "Current matched-pair runs show that the same governance representation does not produce the same response or operational effect across models. Differences appear in evidence handling, secondary aggregation, semantic expansion, reasoning use, latency, completion length, and response stability. Model capacity, native capabilities, tool use, assigned function, domain, and evidence requirements should inform tuning while deterministic enforcement boundaries remain consistent."
        },
      ],
    },
    {
      key: "runtime",
      eyebrow: "04 · Runtime and deployment implications",
      title: "Observed execution differences feed back into architecture",
      note: "These observations translate test results into routing, resilience, cost, and deployment requirements without turning the Arena into a model-ranking product.",
      items: [
        {
          title: "Model substitution can leave the governance architecture unchanged",
          status: "Observed · September 21, 2026",
          detail: "The UI Guide model was changed from Ling 3.0 Flash VL to GPT-6 Astra while the CV1.1 rules, execution path, data boundaries, Neon persistence path, disclosure restrictions, fail-closed behavior, and governed workflows remained unchanged. This is a direct architectural observation: the model is a replaceable component operating inside the governance architecture rather than being the governance architecture itself. Different model, same box, same rules, same authorized paths."
        },
        {
          title: "Governance overhead is measurable",
          status: "Observed",
          detail: "Matched runs expose changes in latency, token use, cost, tool calls, context utilization, response length, and completion state. These measurements are treated as execution characteristics, not benchmark scores or automatic quality judgments."
        },
        {
          title: "Dirty data can trigger false-positive runtime enforcement",
          status: "Observed · September 28, 2026",
          detail: "Runtime enforcement operating against dirty, malformed, inconsistent, or unexpected data can interpret data-quality defects as policy, contract, or execution violations. In a fail-closed architecture, those false-positive detections can stop an otherwise authorized workflow. This observation reinforces the need to treat upstream data quality, schema validation, normalization, and deterministic verification as part of the governed execution boundary rather than assuming every enforcement trigger represents an actual policy breach."
        },
        {
          title: "Capability additions are the primary source of contract mismatch",
          status: "Observed · September 23, 2026",
          detail: "Most contract mismatches observed during Agentic Arena iteration have followed intentional capability changes such as adding models, workflow behavior, UI controls, token rules, failover paths, or execution options. The failure is therefore usually change-induced contract drift rather than spontaneous runtime degradation: one layer has moved forward while a dependent UI, API, policy, schema, or test contract still describes the prior state. In this role, fail-closed build and runtime checks act as regression signals by identifying which dependent contract has not yet been propagated to the new capability. The maintenance task is to synchronize the intentional change across its governed dependencies without weakening the underlying security invariant."
        },
      ],
    },
  ];

  const observationCount = observationGroups.reduce((total, group) => total + group.items.length, 0);
  const empiricalLoop = [
    ["01", "Observe", "Capture the output, telemetry, and failure pattern without assuming a cause."],
    ["02", "Isolate", "Hold model, task, function, data window, and token ceiling constant where the comparison requires it."],
    ["03", "Compare", "Run the governed path and the CV1.1-off baseline against the matched condition."],
    ["04", "Verify", "Check important claims against deterministic evidence, policy decisions, logs, and signed run records."],
    ["05", "Repeat", "Run enough matched trials to separate a recurring pattern from a one-off result."],
    ["06", "Tune", "Change the control that maps to the observed failure mode, risk, function, or model profile."],
    ["07", "Retest", "Run the same bounded comparison again and keep the prior result as development evidence."],
  ];

  return <>
    <div className="notice">
      <strong>Portfolio systems stress indicators, not generalized claims.</strong> Agentic Arena uses matched comparisons, repeat runs, deterministic verification, and traceable test-design changes to guide engineering decisions. Observations are retained as development evidence and are limited to the tested model, function, domain, and execution condition.
    </div>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Engineering validation loop</div>
          <div className="section-title">Observe, isolate, compare, verify, repeat, tune, retest</div>
          <div className="section-note">This is an engineering portfolio testbed. Comparisons use matched conditions, explicit uncertainty, repeat runs, deterministic checks, traceable evidence, and documented changes to pressure-test the architecture.</div>
        </div>
        <span className="badge">{observationCount} documented stress indicators</span>
      </div>
      <div className="enterprise-stage-grid">
        {empiricalLoop.map(([step, title, detail]) => <div className="card enterprise-stage-card" key={step}>
          <div className="enterprise-stage-number">{step}</div>
          <div>
            <div className="section-title">{title}</div>
            <p className="body-copy">{detail}</p>
          </div>
        </div>)}
      </div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Comparison integrity</div>
          <div className="section-title">Three contamination surfaces stay under active review</div>
          <div className="section-note">A matched pair is only useful when the difference between paths is understood. Prompt wording, execution helpers, and presentation can each create a false apparent difference.</div>
        </div>
      </div>
      <div className="grid-3">
        <div className="card">
          <div className="section-title">Prompt contamination</div>
          <p className="body-copy">Shared tasks, system prompts, context wrappers, output contracts, and helper text can introduce governance-coded language into the control condition. Governance-specific language stays on the governed path unless it is intentionally shared.</p>
        </div>
        <div className="card">
          <div className="section-title">Execution-path contamination</div>
          <p className="body-copy">Shared fallback logic, data-access helpers, MCP calls, CV1.1 or OPA checks, claim verification, sanitation, redaction, or other governed controls can bleed into the control path. Runtime isolation is therefore verified separately from prompt neutrality.</p>
        </div>
        <div className="card">
          <div className="section-title">Presentation / UI contamination</div>
          <p className="body-copy">Labels, templates, cached state, stale bundles, and UI defaults can make one path appear more governed than it is or reintroduce governance-specific language. Visual review is part of regression testing, not just presentation polish.</p>
        </div>
      </div>
    </section>

    <div className="notice good-notice">
      <strong>Evidence principle:</strong> exact arithmetic and bounded aggregates belong in deterministic computation whenever practical. Models remain useful for interpretation, synthesis, comparison, and explanation, but verified facts should be supplied upstream rather than reconstructed from visible rows when the platform can compute them directly.
    </div>

    {observationGroups.map((group) => <section className="section" key={group.key}>
      <div className="section-header">
        <div>
          <div className="eyebrow">{group.eyebrow}</div>
          <div className="section-title">{group.title}</div>
          <div className="section-note">{group.note}</div>
        </div>
        <span className="badge">{group.items.length} observations</span>
      </div>
      <div className="grid-2">
        {group.items.map((item) => <article className="card" key={item.title}>
          <div className="card-title-row">
            <div className="section-title">{item.title}</div>
            <span className="badge">{item.status}</span>
          </div>
          <p className="body-copy">{item.detail}</p>
        </article>)}
      </div>
    </section>)}

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">One evidence stack, three views</div>
          <div className="section-title">Translate the same findings by audience</div>
          <div className="section-note">The evidence does not change. The question changes depending on whether the reader is validating the method, building the system, or deciding whether the deployment is acceptable.</div>
        </div>
      </div>
      <div className="grid-3">
        <article className="card">
          <div className="eyebrow">Validation / test design</div>
          <div className="section-title">Can the observed difference be traced to the changed runtime condition?</div>
          <p className="body-copy">Review matched conditions, contamination surfaces, confounds, bounded evidence, repeatability, and scope limits. Preserve historical runs when the test design changes so development evidence remains traceable.</p>
        </article>
        <article className="card">
          <div className="eyebrow">Engineering / deployment</div>
          <div className="section-title">Can the control boundary stay stable while tuning changes?</div>
          <p className="body-copy">Keep deterministic enforcement shared, then tune the model-facing layer by function, model profile, and failure mode. Use segmented APIs, scoped MCP tools, read-only data paths, deterministic statistics, OPA authorization, redaction, integrity records, and observable fallback routing.</p>
        </article>
        <article className="card">
          <div className="eyebrow">Executive / business impact</div>
          <div className="section-title">Is the model-function-governance combination acceptable for this workload?</div>
          <p className="body-copy">Translate the same evidence into risk, cost, latency, reliability, fallback, human-review, and audit requirements. The decision is not simply which model is strongest, but which governed configuration is fit for the intended use.</p>
        </article>
      </div>
    </section>

    <section className="section grid-3">
      <Metric label="Method posture" value="Matched + repeatable" foot="Variables controlled where the comparison requires it" />
      <Metric label="Evidence posture" value="Deterministic first" foot="Facts computed upstream when practical" />
      <Metric label="Interpretation" value="No model ranking" foot="Results guide governance configuration and further testing" />
    </section>
  </>;
}

function ModelRegistry({ models }) {
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState("all");

  const uiRegistryModels = useMemo(() => models.filter((model) => model.key !== "glm_5_3_prime").slice(0, 23), [models]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return uiRegistryModels
      .filter((model) => access === "all" || model.access_class === access)
      .filter((model) => !needle || [
        model.display_name,
        model.vendor,
        model.model_id,
        model.parameter_size,
        ...modelRiskCategories(model),
      ].some((value) => String(value || "").toLowerCase().includes(needle)))
      .sort((a, b) => (a.vendor || "").localeCompare(b.vendor || "") || (a.display_name || a.key).localeCompare(b.display_name || b.key));
  }, [uiRegistryModels, query, access]);

  const allRisks = Array.from(new Set(uiRegistryModels.flatMap(modelRiskCategories))).sort();
  const openCount = uiRegistryModels.filter((model) => model.access_class === "open_weights").length;
  const frontierCount = uiRegistryModels.filter((model) => model.access_class === "frontier").length;

  return <>
    <div className="notice">
      <strong>Provider statements + planning assumptions.</strong> Capability summaries on this page are attributed to model-provider documentation or exposed registry metadata; Agentic Arena does not independently certify those capabilities. General risk categories are conservative assumptions used to think through controls and testing. They are not observed defects, vendor safety scores, capability rankings, predictions of model behavior, or claims that any model is safe or unsafe. Actual behavior depends on model version, provider, configuration, context, tools, data, and deployment.
    </div>

    <section className="section grid-3">
      <Metric label="Registry models" value={String(uiRegistryModels.length)} foot="UI-visible agent models" />
      <Metric label="Open weights" value={String(openCount)} foot="Models classified as open weights" />
      <Metric label="Frontier / hosted" value={String(frontierCount)} foot="Hosted models with external provider dependency" />
    </section>

    <section className="section card">
      <div className="section-header">
        <div>
          <div className="section-title">Risk-assumption legend</div>
          <div className="section-note">Broad, non-model-specific assumptions used to identify what may need verification or control in a deployment. Presence of a label does not mean the risk has occurred.</div>
        </div>
        <span className="badge">{allRisks.length} categories in use</span>
      </div>
      <div className="risk-legend-grid">
        {allRisks.map((risk) => <div className="risk-legend-item" key={risk}>
          <strong>{risk}</strong>
          <span>{MODEL_RISK_DEFINITIONS[risk] || "General governance consideration."}</span>
        </div>)}
      </div>
    </section>

    <section className="section form-panel">
      <div className="form-grid two-cols">
        <div className="field"><label>Search registry</label><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Model, vendor, parameter size, or risk category" /></div>
        <div className="field"><label>Access class</label><select value={access} onChange={(e) => setAccess(e.target.value)}><option value="all">All models</option><option value="frontier">Frontier / hosted</option><option value="open_weights">Open weights</option></select></div>
      </div>
      <div className="section-note model-filter-note">Showing {visible.length} of {uiRegistryModels.length} UI registry models.</div>
    </section>

    <section className="section model-registry-grid">
      {visible.map((model) => {
        const risks = modelRiskCategories(model);
        return <article className="card model-registry-card" key={model.key}>
          <div className="model-registry-head">
            <div>
              <div className="domain-number">{model.vendor || "Unknown vendor"}</div>
              <h3>{model.display_name || model.key}</h3>
            </div>
            <span className="badge">{model.access_class === "open_weights" ? "Open weights" : "Frontier / hosted"}</span>
          </div>
          <dl className="model-registry-meta">
            <dt>Registry key</dt><dd>{model.key}</dd>
            <dt>Model ID</dt><dd>{model.model_id || "Not exposed"}</dd>
            <dt>Parameters</dt><dd>{model.parameter_size || "Undisclosed / not verified here"}</dd>
            <dt>Tool metadata</dt><dd>{model.tool_capable === false ? "Registry marks unsupported" : model.tool_capable === true ? "Registry marks supported" : "Not asserted from local metadata"}</dd>
            <dt>Free route</dt><dd>{model.free ? "Registry route marked free" : "No free-route claim"}</dd>
          </dl>
          <div className="model-risk-block">
            <div className="model-risk-title">Provider-stated capability summary</div>
            <p className="body-copy">{providerCapabilitySummary(model)}</p>
          </div>
          <div className="model-risk-block">
            <div className="model-risk-title">General risk assumptions for control planning</div>
            <div className="model-risk-tags">{risks.map((risk) => <span className="risk-tag" key={risk}>{risk}</span>)}</div>
          </div>
        </article>;
      })}
    </section>
    {!visible.length && <div className="empty-state"><div className="empty-mark">MR</div><strong>No matching models</strong><span>Change the search or access-class filter.</span></div>}
  </>;
}

function MCPConsole({ models, entities }) {
  const effectiveEntities = entities.length ? entities : [
    { key: "analyst", runtime_role: "analyst_runner", read_only_workspace: false, tools: [{ name: "dataset.describe", description: "Describe the authorized governed dataset." }, { name: "dataset.schema", description: "Read source schema." }, { name: "dataset.query", description: "Run bounded read-only query." }, { name: "dataset.aggregate", description: "Run deterministic aggregate." }, { name: "dataset.statistics", description: "Compute deterministic bounded statistics." }, { name: "dataset.profile", description: "Profile the source." }, { name: "rag.retrieve", description: "Retrieve bounded evidence." }] },
    { key: "data_modeler", runtime_role: "data_modeler_runner", read_only_workspace: true, tools: [{ name: "dataset.describe" }, { name: "dataset.schema" }, { name: "dataset.sample" }, { name: "dataset.query" }, { name: "dataset.aggregate" }, { name: "dataset.statistics" }, { name: "dataset.profile" }, { name: "rag.retrieve" }] },
    { key: "mixed_capability", runtime_role: "mixed_capability_runner", read_only_workspace: true, tools: [{ name: "dataset.describe" }, { name: "dataset.schema" }, { name: "dataset.sample" }, { name: "dataset.query" }, { name: "dataset.aggregate" }, { name: "dataset.statistics" }, { name: "dataset.profile" }, { name: "rag.retrieve" }] },
    { key: "evaluator", runtime_role: "evaluator_runner", read_only_workspace: true, tools: [] },
    { key: "advisor", runtime_role: "advisor_runner", read_only_workspace: true, tools: [{ name: "dataset.describe" }, { name: "dataset.query" }, { name: "dataset.aggregate" }, { name: "dataset.statistics" }, { name: "dataset.profile" }, { name: "rag.retrieve" }] },
  ];
  const executableEntities = effectiveEntities.filter((item) => Array.isArray(item.tools) && item.tools.length > 0);
  const [entityKey, setEntityKey] = useState(executableEntities[0]?.key || "analyst");
  const entity = executableEntities.find((item) => item.key === entityKey) || executableEntities[0];
  const [toolName, setToolName] = useState(entity?.tools?.[0]?.name || "dataset.describe");
  const [systemId, setSystemId] = useState(6);
  const [modelKey, setModelKey] = useState(models[0]?.key || FALLBACK_MODELS[0].key);
  const [table, setTable] = useState("source_data");
  const [selectColumns, setSelectColumns] = useState("");
  const [groupBy, setGroupBy] = useState("");
  const [measure, setMeasure] = useState("");
  const [aggregation, setAggregation] = useState("count");
  const [limit, setLimit] = useState(10);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!executableEntities.some((item) => item.key === entityKey)) setEntityKey(executableEntities[0]?.key || "analyst");
  }, [entities, entityKey]);
  useEffect(() => {
    const nextEntity = executableEntities.find((item) => item.key === entityKey) || executableEntities[0];
    if (!nextEntity?.tools?.some((tool) => tool.name === toolName)) setToolName(nextEntity?.tools?.[0]?.name || "");
  }, [entityKey, entities]);
  useEffect(() => { if (!models.some((item) => item.key === modelKey) && models[0]) setModelKey(models[0].key); }, [models, modelKey]);

  function toolArgs() {
    if (toolName === "dataset.sample") return { table, limit: Math.min(25, Math.max(1, Number(limit) || 10)) };
    if (toolName === "dataset.query") {
      const args = { table, limit: Math.min(100, Math.max(1, Number(limit) || 25)) };
      const columns = selectColumns.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
      if (columns.length) args.select = columns;
      return args;
    }
    if (toolName === "dataset.aggregate") {
      const args = {
        table,
        aggregation,
        limit: Math.min(50, Math.max(1, Number(limit) || 25)),
      };
      if (groupBy.trim()) args.group_by = groupBy.trim();
      if (measure.trim()) args.measure = measure.trim();
      return args;
    }
    if (toolName === "dataset.statistics") {
      const args = { table, limit: Math.min(100, Math.max(1, Number(limit) || 100)), max_categories: 20 };
      const columns = selectColumns.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
      if (columns.length) args.columns = columns;
      return args;
    }
    if (toolName === "dataset.profile") return table.trim() ? { table: table.trim() } : {};
    if (toolName === "rag.retrieve") return { query: query.trim(), top_k: Math.min(20, Math.max(1, Number(limit) || 5)) };
    return {};
  }

  async function execute() {
    setRunning(true); setError(""); setResult(null);
    try {
      const response = await apiRequest(`/api/v1/mcp/governed/${entityKey}`, { method: "POST", body: { jsonrpc: "2.0", id: `ui-${Date.now()}`, method: "tools/call", params: { system_id: Number(systemId), model_key: modelKey, name: toolName, arguments: toolArgs() } } });
      if (response.error) throw new Error(response.error.message || "MCP returned an error.");
      setResult(sanitizeForDisplay(response?.result?.structuredContent || response?.result || response));
    } catch (e) { setError(e.message); }
    finally { setRunning(false); }
  }

  const selectedTool = entity?.tools?.find((item) => item.name === toolName);
  const toolNeedsTable = ["dataset.sample", "dataset.query", "dataset.aggregate", "dataset.statistics", "dataset.profile"].includes(toolName);
  const canExecute = Boolean(entity && toolName) && (toolName !== "rag.retrieve" || Boolean(query.trim()));

  const governanceImplementation = [
    ["01", "Identify requirements", "Define the business purpose, authorized outcome, applicable obligations, data classification, risk tolerance, human authority, and evidence expectations before selecting controls."],
    ["02", "Translate requirements into controls", "Convert governance language into explicit roles, permitted actions, prohibited actions, data boundaries, tool permissions, output rules, escalation points, and failure behavior."],
    ["03", "Encode deterministic enforcement", "Implement enforceable controls outside the model through identity, OPA/Rego policy, server-side resource selection, validation contracts, bounded MCP capabilities, and fail-closed execution."],
    ["04", "Bind the probabilistic component", "Assign the model a fixed runtime role and only the context, data, tools, and operations required for the approved function. The model does not define its own authority."],
    ["05", "Verify execution", "Capture policy outcomes, request and trace identifiers, tool activity, telemetry, integrity evidence, and output checks so execution can be reconstructed and reviewed."],
    ["06", "Operate the governance plan", "Monitor exceptions, review evidence, manage policy and schema changes, test regressions, age exceptions, and update controls when the business process, data, model, or risk changes."],
  ];

  return <>
    <div className="notice good-notice"><strong>Governance plan implementation.</strong> This page shows how governance intent can be translated into executable technical controls. CV 1.1 is the implementation example used here; it does not establish that a governance program is complete, compliant, certified, or appropriate for another organization.</div>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Plan → control → evidence</div>
          <div className="section-title">Governance becomes useful when requirements reach the runtime</div>
          <div className="section-note">Policies and frameworks describe obligations and objectives. Implementation requires those requirements to be converted into system boundaries that can be enforced, observed, tested, reviewed, and changed.</div>
        </div>
        <span className="badge">CV 1.1 implementation example</span>
      </div>
      <div className="enterprise-stage-grid">
        {governanceImplementation.map(([step, title, detail]) => <div className="card enterprise-stage-card" key={step}>
          <div className="enterprise-stage-number">{step}</div>
          <div><div className="section-title">{title}</div><p className="body-copy">{detail}</p></div>
        </div>)}
      </div>
    </section>

    <section className="section grid-2">
      <article className="card">
        <div className="eyebrow">Governance requirement</div>
        <div className="section-title">What the organization decides</div>
        <div className="control-list">
          <Control name="Purpose + authority" desc="What the workflow is allowed to do, for whom, and where human or business authority remains." state="Requirement" />
          <Control name="Data governance" desc="Which data may be accessed, its classification, purpose limitations, quality expectations, retention, and handling constraints." state="Requirement" />
          <Control name="Risk + exceptions" desc="What failure means, what must fail closed, what requires escalation, and who can approve an exception." state="Requirement" />
          <Control name="Evidence + review" desc="What must be logged, retained, verified, reviewed, and available to support operational oversight or audit." state="Requirement" />
        </div>
      </article>
      <article className="card">
        <div className="eyebrow">Runtime implementation</div>
        <div className="section-title">What the architecture enforces</div>
        <div className="control-list">
          <Control name="Identity + role binding" desc="Resolve trusted identity and bind execution to a fixed role rather than allowing conversational redefinition." state="Enforced" />
          <Control name="Policy-as-code" desc="Evaluate allowed actions and trusted runtime state through deterministic OPA/Rego policy before execution." state="Enforced" />
          <Control name="Bounded data + tools" desc="Server-select resources and expose only approved MCP operations, arguments, limits, and data scopes." state="Enforced" />
          <Control name="Validation + evidence" desc="Validate contracts, constrain egress, fail closed on protected mismatches, and preserve traceable runtime evidence." state="Enforced" />
        </div>
      </article>
    </section>

    <section className="section card">
      <div className="eyebrow">Implementation traceability</div>
      <div className="section-title">A governance requirement should have somewhere to land</div>
      <div className="enterprise-flow">
        {["Business / regulatory requirement", "Control objective", "Technical requirement", "Policy + contract", "Runtime enforcement", "Telemetry + evidence", "Review + change control"].map((item,index,items)=><React.Fragment key={item}><div className="enterprise-flow-node">{item}</div>{index<items.length-1&&<div className="enterprise-flow-arrow">→</div>}</React.Fragment>)}
      </div>
      <p className="body-copy">The implementation goal is traceability in both directions: a runtime control should map back to a requirement, and a material governance requirement should map forward to an owner, control, evidence source, or documented external process. Not every governance obligation belongs in code.</p>
    </section>

    <section className="section">
      <div className="section-header"><div><div className="eyebrow">Implementation example</div><div className="section-title">MCP as a bounded execution surface</div><div className="section-note">MCP is one mechanism used by this implementation to expose approved operations. The governance decision exists above the protocol: role, action, arguments, resource target, and model binding are re-derived and authorized server-side before execution.</div></div></div>
    </section>
    <section className="section grid-2 mcp-layout">
      <div className="form-panel">
        <div className="section-title">Governed MCP request</div>
        <div className="form-grid two-cols form-top-space">
          <div className="field"><label>Entity</label><select value={entityKey} onChange={(e) => setEntityKey(e.target.value)}>{executableEntities.map((item) => <option key={item.key} value={item.key}>{item.key} · {item.runtime_role}</option>)}</select></div>
          <div className="field"><label>Tool</label><select value={toolName} onChange={(e) => setToolName(e.target.value)}>{(entity?.tools || []).map((tool) => <option key={tool.name} value={tool.name}>{tool.name}</option>)}</select></div>
          <div className="field"><label>Domain</label><select value={systemId} onChange={(e) => setSystemId(Number(e.target.value))}>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label>Model binding</label><select value={modelKey} onChange={(e) => setModelKey(e.target.value)}><ModelOptions models={models} /></select></div>
          {toolNeedsTable && <div className="field"><label>Source table</label><input value={table} onChange={(e) => setTable(e.target.value)} placeholder="source_data" /></div>}
          {["dataset.sample", "dataset.query", "dataset.aggregate", "dataset.statistics", "rag.retrieve"].includes(toolName) && <div className="field"><label>{toolName === "rag.retrieve" ? "Top K" : "Limit"}</label><input type="number" min="1" max={toolName === "dataset.aggregate" ? "50" : toolName === "dataset.query" || toolName === "dataset.statistics" ? "100" : toolName === "dataset.sample" ? "25" : "20"} value={limit} onChange={(e) => setLimit(e.target.value)} /></div>}
          {(toolName === "dataset.query" || toolName === "dataset.statistics") && <div className="field full"><label>Columns (optional, comma separated)</label><input value={selectColumns} onChange={(e) => setSelectColumns(e.target.value)} placeholder="Carrier, Status, Cost" /></div>}
          {toolName === "dataset.aggregate" && <>
            <div className="field"><label>Aggregation</label><select value={aggregation} onChange={(e) => setAggregation(e.target.value)}><option value="count">Count</option><option value="sum">Sum</option><option value="avg">Average</option><option value="min">Minimum</option><option value="max">Maximum</option></select></div>
            <div className="field"><label>Group by (optional)</label><input value={groupBy} onChange={(e) => setGroupBy(e.target.value)} placeholder="loan_status" /></div>
            <div className="field full"><label>Measure (required except count)</label><input value={measure} onChange={(e) => setMeasure(e.target.value)} placeholder="loan_amount" /></div>
          </>}
          {toolName === "rag.retrieve" && <div className="field full"><label>Retrieval query</label><textarea className="compact-textarea" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Evidence to retrieve from the governed RAG surface…" /></div>}
        </div>
        <div className="tool-description">{selectedTool?.description || "Bounded governed MCP operation."}</div>
        <div className="form-actions"><button className="primary" onClick={execute} disabled={running || !canExecute}>{running ? <><span className="spinner inline-spinner" />Executing</> : "Execute governed tool"}</button></div>
      </div>
      <div className="card mcp-result-card">
        <div className="card-title-row"><div><div className="section-title">Sanitized result</div><div className="section-note">Client display strips internal target/credential-like fields in addition to backend controls.</div></div><StatusPill good={error ? false : result ? true : null} label={error ? "Error" : result ? "Complete" : "Waiting"} /></div>
        {error ? <div className="notice error-notice">{error}</div> : result ? <pre className="json-box tall-json">{JSON.stringify(result, null, 2)}</pre> : <div className="result-empty">Choose a bounded MCP operation and execute it through CV 1.1.</div>}
      </div>
    </section>

    <section className="section card"><div className="eyebrow">Implemented authorization</div><div className="section-title">Entity permission surface</div><div className="permission-grid">{effectiveEntities.map((item) => <div className="permission-card" key={item.key}><div className="permission-head"><strong>{item.key}</strong><span className="badge">{item.runtime_role}</span></div><span className="micro">Workspace {item.read_only_workspace ? "read-only" : "bounded write-capable"}</span><div className="permission-tools">{(item.tools || []).length ? (item.tools || []).map((tool) => <span className="tag" key={tool.name}>{tool.name}</span>) : <span className="tag">No MCP dataset tools · recorded-run audit path</span>}</div></div>)}</div></section>
  </>;
}

function Chatbot({ models }) {
  const chatbotModels = useMemo(
    () => models.filter((item) => ARENA_MODEL_KEYS.has(item.key)),
    [models],
  );
  const [systemId, setSystemId] = useState(1);
  const [workflowKey, setWorkflowKey] = useState("analyst");
  const [modelKey, setModelKey] = useState(chatbotModels[0]?.key || FALLBACK_MODELS[0].key);
  const [history, setHistory] = useState([{ role: "assistant", content: "Agentic Arena guide ready. I can explain the public architecture, CV 1.1 controls, or help route you to a governed workflow." }]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!chatbotModels.some((item) => item.key === modelKey) && chatbotModels[0]) setModelKey(chatbotModels[0].key); }, [chatbotModels, modelKey]);

  async function send() {
    const current = message.trim();
    if (!current || sending) return;
    setSending(true); setError("");
    const prior = history.slice(-12);
    setHistory((items) => [...items, { role: "user", content: current }]);
    setMessage("");
    try {
      const result = await apiRequest("/api/v1/chatbot/message", { method: "POST", body: { operation: "execute_workflow", system_id: Number(systemId), model_key: modelKey, message: current, history: prior, workflow: { function_key: workflowKey, source_context: null, max_tokens: 5000 }, max_tokens: 5000 } });
      setHistory((items) => [...items, { role: "assistant", content: result.reply || assistantText(result) || "No response returned." }]);
    } catch (e) {
      setError(e.message);
      setHistory((items) => [...items, { role: "assistant", content: "The governed chatbot request did not complete." }]);
    } finally { setSending(false); }
  }

  function clearChat() {
    setHistory([{ role: "assistant", content: "Conversation reset. Agentic Arena guide ready." }]);
    setError("");
  }

  return <div className="chat-layout">
    <div className="card chat-card">
      <div className="result-head"><div><strong>Governed lab guide</strong><div className="micro">Professional · safe mode · bounded history</div></div><div className="button-row"><StatusPill good={true} label="CV 1.1" /><button className="ghost small-button" onClick={clearChat}>Reset</button></div></div>
      <div className="chat-log" aria-live="polite">{history.map((item, i) => <div key={`${item.role}-${i}`} className={`chat-message ${item.role}`}><span className="chat-role">{item.role}</span>{item.content}</div>)}</div>
      {error && <div className="notice error-notice chat-error">{error}</div>}
      <div className="chat-composer"><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Enter a task for the selected governed domain and workflow…" /><button className="primary" onClick={send} disabled={sending || !message.trim()}>{sending ? "Sending…" : "Send"}</button></div>
    </div>
    <div className="form-panel side-config">
      <div className="field config-gap"><label>Model</label><select value={modelKey} onChange={(e) => setModelKey(e.target.value)}><ModelOptions models={chatbotModels} /></select></div>
      <div className="field config-gap"><label>Domain</label><select value={systemId} onChange={(e) => setSystemId(Number(e.target.value))}>{DOMAINS.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}</select></div>
      <div className="field config-gap"><label>Workflow</label><select value={workflowKey} onChange={(e) => setWorkflowKey(e.target.value)}><option value="analyst">Analyst</option><option value="auditor">Auditor</option><option value="data_modeler">Data Modeler</option><option value="mixed_capability">Mixed Capability</option><option value="evaluator">Evaluator</option><option value="advisor">Advisor</option></select></div>
      <div className="section-title config-title">Chatbot boundaries</div>
      <div className="control-list">
        <Control name="Governed trigger" desc="The chatbot remains inside CV 1.1 and cannot elect an ungoverned mode." state="Fixed" />
        <Control name="Backend disclosure" desc="Raw rows, credentials, hidden prompts, policy source, and internal control records are outside the disclosure boundary." state="Blocked" />
        <Control name="Conversation memory" desc="Only bounded request history is supplied to the chatbot execution path." state="12 max" />
        <Control name="Output budget" desc="Governed workflow execution uses the shared Arena output ceiling." state="5,000 max" />
        <Control name="Content scope" desc="No sexual/explicit content or profanity; philosophy is limited to abstract technology concepts." state="Scoped" />
      </div>
    </div>
  </div>;
}

function Governance({ ready, cv11, functions, entities }) {
  const controls = [
    ["Fail-closed OPA gate", "Governed requests require a valid CV 1.1 authorization decision before execution. OPA unavailability denies rather than bypasses.", ready?.cv11_opa_healthy ? "Healthy" : "Check", ready?.cv11_opa_healthy ? "good" : "warn"],
    ["Immutable function binding", "Analyst, Data Modeler, Evaluator, Advisor, and Chatbot execute through fixed runtime roles rather than model-selected identities.", `${functions.length} functions`, "good"],
    ["Server-derived data target", "System/domain determines the governed database target. Client/model-supplied target, SQL, role, policy, and connection arguments are rejected.", "Active", "good"],
    ["Bounded MCP surface", "Each entity receives only its allowlisted describe/schema/query/sample/profile/RAG capabilities with server-side bounds.", `${entities.length || 4} entities`, "good"],
    ["Domain-aware redaction", "Baseline identifier redaction applies across governed domains, with additional finance and healthcare profiles.", "Active", "good"],
    ["Tamper-evident audit chain", "New run records are SHA-256 hashed, chained to the previous signed event, and authenticated with HMAC-SHA256 before evidence storage.", "HMAC-SHA256", "good"],
    ["Telemetry boundary", "Hashes, model/usage/timing/cost, policy outcome, behavior, and control metadata support evidence without intentionally persisting raw task/output in the browser ledger.", "Active", "good"],
    ["Ingestion deadman switch", "A target that is no longer empty causes ingestion to abort instead of silently appending or overwriting state.", "Armed", "good"],
    ["Separate ungoverned baseline", "The ungoverned path is a physically separate comparison baseline, not a governance mode a governed agent can select.", "Separated", "good"],
  ];

  return <>
    <div className="notice good-notice">CV 1.1 is the permanent governed control plane. Domain regex, RAG, data, and output rules are policy modules inside that execution path, not substitutes for authorization.</div>
    <section className="section"><div className="card"><ExecutionFlow /></div></section>
    <section className="section grid-2">
      <div className="card"><div className="card-title-row"><div className="section-title">Live control-plane status</div><StatusPill good={cv11?.opa_healthy === true ? true : cv11 ? false : null} label="OPA" /></div><dl className="kv kv-roomy"><dt>Policy</dt><dd>{cv11?.policy || "CV1.1"}</dd><dt>Decision engine</dt><dd>{cv11?.decision_engine || "OPA / Rego"}</dd><dt>OPA health</dt><dd>{cv11?.opa_healthy === true ? "Healthy" : "Not confirmed"}</dd><dt>Failure mode</dt><dd>{cv11?.governed_failure_mode || "fail_closed"}</dd><dt>Database wiring</dt><dd>{ready?.databases_configured ? "Configured" : ready ? "Incomplete" : "Checking"}</dd></dl></div>
      <div className="card"><div className="section-title">Mutation invariant</div><div className="flow compact-flow">{["Precondition", "Authorize", "Execute", "Verify", "Commit"].map((item, i, arr) => <React.Fragment key={item}><div className="flow-node">{item}</div>{i < arr.length - 1 && <div className="flow-arrow">→</div>}</React.Fragment>)}</div><p className="body-copy governance-copy">If the expected trusted state is absent, the protected operation stops. The design preserves the last known-good state and emits a visible failure signal rather than escalating autonomy to recover silently.</p></div>
    </section>
    <section className="section card"><div className="section-title">Implemented control surfaces</div><div className="control-list controls-two-column">{controls.map(([name, desc, state, tone]) => <Control key={name} name={name} desc={desc} state={state} tone={tone} />)}</div></section>
    <section className="section grid-3">
      <Metric label="Authorization" value="Default deny" foot="Rego policy allows only valid role/action/context bindings" />
      <Metric label="State handling" value="Fail closed" foot="Untrusted or conflicting state does not earn more autonomy" />
      <Metric label="Comparison baseline" value="Physically separate" foot="Governed execution cannot elect the ungoverned path" />
    </section>
  </>;
}

function EnterpriseDeployment() {
  const deploymentStages = [
    ["01", "Segment the API surface", "Give each functional division its own REST API boundary, identity scope, approved data sources, tool permissions, rate limits, and policy modules."],
    ["02", "Containerize bounded services", "Package each division API as a separately deployable service. Keep credentials, model-provider keys, and data bindings server-side."],
    ["03", "Run replicated workloads", "Deploy multiple API replicas in Kubernetes so a pod or node failure does not make the business function unavailable."],
    ["04", "Balance only healthy traffic", "Use ingress and load balancers with readiness and liveness checks so requests route only to healthy service replicas."],
    ["05", "Fail over the model, not the policy", "Route a governed request envelope to an approved same-family fallback model when one exists. If same-family fallback is unavailable, any cross-family contingency must be explicit, separately governed, and visible in telemetry. Authorization, data scope, tool limits, and egress controls remain unchanged."],
    ["06", "Observe and prove execution", "Centralize health, latency, cost, policy decisions, failover events, output controls, and signed audit evidence without granting the model additional authority."],
  ];

  const divisionApis = [
    ["Finance API", "Finance data and approved analytical functions", "/api/v1/finance/*"],
    ["Operations API", "Operational data, planning, logistics, and bounded analytics", "/api/v1/operations/*"],
    ["Human Resources API", "HR workflows with separate privacy and access policy", "/api/v1/hr/*"],
    ["Engineering API", "Approved repositories, technical workflows, and controlled tooling", "/api/v1/engineering/*"],
    ["Legal / Compliance API", "Document review, policy evidence, and bounded advisory workflows", "/api/v1/legal/*"],
  ];

  const runtimeFlow = [
    "Employee / application",
    "SSO + enterprise gateway",
    "Division REST API",
    "K8s service + replicas",
    "CV 1.1 policy boundary",
    "Model router",
    "Primary or approved backup AI",
    "Bounded data + tools",
    "Egress + signed telemetry",
  ];

  return <>
    <div className="notice good-notice"><strong>Enterprise architecture showcase.</strong> This section documents how I reason about translating an AI use case into a bounded enterprise architecture. It is a portfolio design example—not a packaged product, managed service, or claim that Agentic Arena is deployed in this topology.</div>

    <section className="section card">
      <div className="eyebrow">Portfolio intent</div>
      <div className="section-title">The point is the engineering judgment, not the diagram</div>
      <p className="body-copy">Enterprise AI work starts before model selection. I would first identify the substantiated business outcome, determine whether AI is needed, inspect the available data and its governance, map the existing systems and interfaces, identify failure and security boundaries, and define human authority. Only then should model capacity, orchestration, runtime controls, infrastructure, and evidence requirements be selected.</p>
      <p className="body-copy">The topology below is one worked example of that reasoning. A different organization or use case could justify a simpler deterministic workflow, a different cloud pattern, different APIs, different controls, or no AI at all.</p>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Architecture reasoning</div>
          <div className="section-title">From business requirement to bounded AI system</div>
          <div className="section-note">A worked architecture example showing how I separate business authority, infrastructure, model execution, data access, policy, resilience, and evidence rather than treating the model as the system.</div>
        </div>
        <span className="badge">REST · Kubernetes · load balanced</span>
      </div>
      <div className="card enterprise-flow-card">
        <div className="enterprise-flow">
          {runtimeFlow.map((item, index) => <React.Fragment key={item}>
            <div className="enterprise-flow-node">{item}</div>
            {index < runtimeFlow.length - 1 && <div className="enterprise-flow-arrow">→</div>}
          </React.Fragment>)}
        </div>
      </div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Functional isolation</div>
          <div className="section-title">One governed API boundary per division</div>
          <div className="section-note">A shared employee interface can sit above these services, but execution authority remains segmented by business function.</div>
        </div>
      </div>
      <div className="grid-3 enterprise-api-grid">
        {divisionApis.map(([name, scope, route]) => <div className="card enterprise-api-card" key={name}>
          <div className="section-title">{name}</div>
          <p className="body-copy">{scope}</p>
          <span className="mono-cell">{route}</span>
          <div className="model-risk-tags">
            <span className="tag">separate auth scope</span>
            <span className="tag">bounded data</span>
            <span className="tag">policy enforced</span>
          </div>
        </div>)}
      </div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Requirements reasoning</div>
          <div className="section-title">Who has to define the system before it is built</div>
          <div className="section-note">CV 1.1 deployment requirements are built as a blended matrix, not as a pure Scrum ceremony or a traditional project handoff. Technical configuration, business requirements, and legal or compliance constraints are developed together into one deployable control package.</div>
        </div>
        <span className="badge">Blended matrix governance</span>
      </div>

      <div className="grid-3">
        <article className="card">
          <div className="eyebrow">Configuration specialist</div>
          <div className="section-title">Translate requirements into enforceable configuration</div>
          <p className="body-copy">Define model routes, API boundaries, MCP tools, identity scopes, data bindings, fallback rules, policy modules, logging, redaction, telemetry, and technical enforcement points. Confirm what the deployed model and surrounding infrastructure can actually support.</p>
        </article>
        <article className="card">
          <div className="eyebrow">Business analyst / process owner</div>
          <div className="section-title">Define the business function and acceptable outcome</div>
          <p className="body-copy">Document the workflow, authorized purpose, required data, decision points, output expectations, exceptions, service levels, and success criteria. Separate what the AI may assist with from what remains a human or business authority.</p>
        </article>
        <article className="card">
          <div className="eyebrow">Legal / compliance officer</div>
          <div className="section-title">Define obligations, restrictions, and evidence requirements</div>
          <p className="body-copy">Identify applicable law, policy, contractual restrictions, privacy requirements, human-review points, retention rules, prohibited uses, required disclosures, and audit evidence. Convert these requirements into controls that can be tested and monitored.</p>
        </article>
      </div>

      <div className="card enterprise-flow-card">
        <div className="eyebrow">Requirements package</div>
        <div className="section-title">From business need to governed deployment</div>
        <div className="enterprise-flow">
          {[
            "Business requirement",
            "Permitted function",
            "Authorized data",
            "Model capacity + capability",
            "Governance controls",
            "Evidence requirements",
            "Fallback rules",
            "Human approval points",
            "Audit requirements",
            "Deployment configuration",
          ].map((item, index, items) => <React.Fragment key={item}>
            <div className="enterprise-flow-node">{item}</div>
            {index < items.length - 1 && <div className="enterprise-flow-arrow">→</div>}
          </React.Fragment>)}
        </div>
      </div>

      <div className="notice enterprise-inner-notice"><strong>Operating principle:</strong> each function or API path receives its own requirements and control package. The control package can be tuned to model capacity, capability, domain, and function while deterministic enforcement boundaries remain common across the platform.</div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Architecture walkthrough</div>
          <div className="section-title">How the design changes from testbed pattern to enterprise topology</div>
          <div className="section-note">This sequence demonstrates the engineering decisions I would evaluate; the actual topology depends on the organization, business outcome, data, risk, and existing infrastructure.</div>
        </div>
      </div>
      <div className="enterprise-stage-grid">
        {deploymentStages.map(([step, title, detail]) => <div className="card enterprise-stage-card" key={step}>
          <div className="enterprise-stage-number">{step}</div>
          <div>
            <div className="section-title">{title}</div>
            <p className="body-copy">{detail}</p>
          </div>
        </div>)}
      </div>
    </section>

    <section className="section grid-2">
      <div className="card">
        <div className="eyebrow">Service resilience</div>
        <div className="section-title">Kubernetes and load balancing</div>
        <div className="control-list">
          <Control name="Replicated division APIs" desc="Run multiple stateless API replicas behind a Kubernetes Service so individual pod loss does not remove the function." state="Scale out" />
          <Control name="Health-aware routing" desc="Readiness checks remove unhealthy replicas from traffic while liveness checks support controlled restart behavior." state="Required" />
          <Control name="Failure-domain isolation" desc="Keep division services independently deployable so a failure in one business function does not require a platform-wide outage." state="Isolated" />
          <Control name="Horizontal scaling" desc="Scale API replicas based on measured demand while preserving the same authorization and policy contract for every replica." state="Elastic" />
        </div>
      </div>
      <div className="card">
        <div className="eyebrow">Model resilience</div>
        <div className="section-title">Approved primary and backup AI</div>
        <div className="control-list">
          <Control name="Model router" desc="Select only allowlisted models approved for the division, task type, data sensitivity, and function-specific governance profile." state="Bounded" />
          <Control name="Circuit breaker" desc="Repeated provider failures or timeouts can open the primary route and direct eligible requests to an approved same-family fallback when one exists." state="Fail over" />
          <Control name="Governance invariant" desc="Failover changes the inference dependency, not identity, data authorization, tool permissions, policy evaluation, or egress controls. Cross-family contingency is explicit and separately governed." state="Fixed" />
          <Control name="High-risk degradation" desc="Mutation-capable or high-impact workflows can degrade to read-only or require human approval instead of replaying automatically." state="Controlled" />
        </div>
      </div>
    </section>

    <section className="section grid-2">
      <div className="card">
        <div className="section-title">REST contract</div>
        <dl className="kv kv-roomy">
          <dt>Identity</dt><dd>SSO identity and division role resolved before execution</dd>
          <dt>Request</dt><dd>Validated operation, bounded inputs, and explicit business function</dd>
          <dt>Policy</dt><dd>OPA / Rego authorization against trusted runtime state</dd>
          <dt>Execution</dt><dd>Approved data, tools, and model route only</dd>
          <dt>Response</dt><dd>Verified and sanitized output with request and trace identifiers</dd>
          <dt>Evidence</dt><dd>Latency, usage, policy outcome, failover state, and signed telemetry</dd>
        </dl>
      </div>
      <div className="card">
        <div className="section-title">Failover guardrails</div>
        <p className="body-copy">Read-only inference can usually be retried or routed to a backup model safely when the request envelope is unchanged. Mutation-capable operations require idempotency keys, transaction state, explicit retry rules, and confirmation that the first attempt did not commit before any replay.</p>
        <div className="notice enterprise-inner-notice"><strong>Design rule:</strong> infrastructure can reroute execution, but an outage never grants broader authority. If the approved fallback cannot satisfy the same policy contract, the governed operation fails closed.</div>
      </div>
    </section>
  </>;
}

function Alignment() {
  const scenarios = [
    ["Healthcare","U.S. healthcare operations + governed AI decision support",
      "Permission-aware RAG over approved clinical, operational, policy, and procedure sources; retrieve only context allowed for the workforce role and purpose.",
      "Bounded MCP or equivalent APIs expose approved retrieval/query operations. Consequential actions receive separate deterministic authorization, transaction constraints, and fail-closed release conditions.",
      "OPA/Rego evaluates identity, role, purpose, data scope, action, and trusted runtime state before execution; protected mismatches fail closed.",
      "Validate output structure, minimize or redact unauthorized sensitive content, preserve source support, and fail closed when required verification or release conditions are not satisfied.",
      "Data-flow mapping; minimum-necessary access; privacy/security risk assessment; bounded autonomous authority; exception/change management; evidence and incident review.",
      "HIPAA Privacy/Security Rules and HITECH where applicable; NIST AI RMF; NIST CSF 2.0; ISO/IEC 42001 and 27001 as voluntary references. GDPR is conditional on its actual material and territorial scope."],
    ["ERP / CRM","Manufacturing, services, or utility operations assistant",
      "RAG retrieves approved SOPs, asset/service knowledge, and permission-scoped business context while authoritative transactional facts remain tied to governed ERP/CRM records.",
      "Wrap ERP/CRM APIs as explicit tools rather than unrestricted database/API access. Separate read operations from controlled writes and transactions.",
      "OPA/Rego evaluates business role, unit, record scope, action type, tool permission, and write authority; validate arguments and server-select resource targets.",
      "Schema-check payloads, validate identifiers and business rules, suppress internal control fields/secrets, and require deterministic preconditions plus fail-closed transaction controls for consequential writes.",
      "Process ownership; segregation of duties; data/master-data governance; access review; configuration/change management; reconciliation; exceptions; audit and recovery planning.",
      "NIST AI RMF; NIST CSF 2.0; ISO/IEC 42001; ISO/IEC 27001; plus applicable privacy, sector, contractual, records, utility, or manufacturing requirements."],
    ["Finance","Financial analytics, review + controlled advisory workflow",
      "Use RAG for policies and explanatory context; use deterministic governed queries and aggregations for balances, transactions, reconciliations, and authoritative numeric facts.",
      "Expose bounded read, aggregate, reconcile, retrieval, and approved case-management tools. Keep consequential financial actions behind separate deterministic authorization, transaction constraints, and fail-closed release conditions.",
      "OPA/Rego enforces role, account/data scope, action class, thresholds, tool permissions, and escalation rules; deterministic checks verify figures and preconditions.",
      "Reconcile cited figures to deterministic evidence, redact restricted data, separate facts/derived values/interpretation, and block unsupported transaction instructions.",
      "Use-case inventory; financial/model risk assessment; lineage and data quality; segregation of duties; validation cadence; monitoring; change control; evidence retention and independent review.",
      "NIST AI RMF; NIST CSF 2.0; ISO/IEC 42001; ISO/IEC 27001; GLBA/privacy and institution-specific model-risk, consumer-protection, recordkeeping, and supervisory requirements where applicable."],
    ["Education","Student-services + institutional knowledge assistant",
      "RAG retrieves approved catalogs, policies, procedures, and permission-scoped student context while keeping public knowledge separate from protected student records.",
      "Bounded tools support approved lookups and workflow assistance. Grade, discipline, aid, enrollment, or other consequential changes remain outside autonomous authority unless an explicitly governed deployment permits them under deterministic authorization and release controls.",
      "OPA/Rego evaluates role, student relationship, purpose, record scope, tool, and action class so conversational instructions cannot cross institutional boundaries.",
      "Redact unauthorized student information, constrain permitted fields, preserve source-backed policy answers, prevent cross-student leakage, and fail closed or route uncertain/consequential cases outside the autonomous execution path.",
      "FERPA-aware data mapping; role/access governance; policy ownership; bounded autonomous authority; retention/data-quality rules; vendor assessment; accessibility; change and incident management.",
      "FERPA and applicable U.S. education/privacy requirements; NIST AI RMF; NIST CSF 2.0; ISO/IEC 42001 and 27001 as voluntary references; applicable state, contractual, accessibility, and institutional requirements."]
  ];
  return <>
    <div className="notice"><strong>Autonomous implementation scenarios, not compliance claims.</strong> These examples intentionally exclude human-in-the-loop as the runtime control mechanism. Authority is bounded through deterministic policy, scoped data and actions, validation, sanitation, stop conditions, and fail-closed behavior. This design choice does not override laws, regulations, contracts, or organizational responsibilities that may independently require human accountability or intervention.</div>
    <section className="section">
      <div className="section-header"><div><div className="eyebrow">Condensed alignment</div><div className="section-title">Governance frameworks provide the lens; implementation provides the control</div><div className="section-note">Requirements and risk → governed retrieval/data → bounded actions → deterministic authorization → output controls → bounded autonomous authority → evidence, monitoring, and change management.</div></div><span className="badge">4 worked scenarios</span></div>
      <div className="grid-4 alignment-grid">{FRAMEWORKS.slice(0,7).map((item)=><div className="card framework-card" key={item.name}><div className="framework-name"><strong>{item.name}</strong></div><span className="framework-type">{item.type}</span><div className="framework-scope">{item.scope}</div></div>)}</div>
    </section>
    <section className="section">
      <div className="section-header"><div><div className="eyebrow">Deployment + governance initiatives</div><div className="section-title">Four examples of translating governance into architecture</div><div className="section-note">Illustrative tooling only. Each implementation should follow the actual business outcome, data, risk, system boundaries, and existing technology.</div></div></div>
      <div className="scenario-stack">{scenarios.map(([sector,title,rag,mcp,enforcement,sanitation,governance,frameworks],index)=><article className="card" key={sector}>
        <div className="card-title-row"><div><div className="domain-number">SCENARIO {String(index+1).padStart(2,"0")} · {sector}</div><div className="section-title">{title}</div></div><span className="badge">Illustrative</span></div>
        <div className="grid-2">
          <div><div className="eyebrow">RAG / governed context</div><p className="body-copy">{rag}</p></div>
          <div><div className="eyebrow">MCP / action surface</div><p className="body-copy">{mcp}</p></div>
          <div><div className="eyebrow">OPA / runtime enforcement</div><p className="body-copy">{enforcement}</p></div>
          <div><div className="eyebrow">Output sanitation + release</div><p className="body-copy">{sanitation}</p></div>
          <div><div className="eyebrow">Governance method</div><p className="body-copy">{governance}</p></div>
          <div><div className="eyebrow">Applicable governance / frameworks</div><p className="body-copy">{frameworks}</p></div>
        </div>
      </article>)}</div>
    </section>
    
  </>;
}
function Diagnostics({ models, functions, entities }) {
  const checks = [
    ["Service health", "/health"],
    ["Service readiness", "/ready"],
    ["Runtime control status", "/api/v1/system/cv11"],
    ["Evidence integrity", "/api/v1/system/audit/integrity"],
    ["Model registry", "/api/v1/models"],
    ["Governed capabilities", "/api/v1/governed/functions"],
    ["Comparison-path availability", "/api/v1/ungoverned/functions"],
    ["Governed integration surface", "/api/v1/mcp/governed/entities"],
  ];
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  async function runChecks() {
    setRunning(true);
    const output = {};
    await Promise.all(checks.map(async ([name, path]) => {
      const start = performance.now();
      try {
        const payload = await apiRequest(path, { timeoutMs: 15000 });
        output[path] = { name, ok: true, latency: performance.now() - start, summary: summarizeDiagnostic(path, payload) };
      } catch (e) {
        output[path] = { name, ok: false, latency: performance.now() - start, summary: e.message };
      }
    }));
    setResults(output);
    setRunning(false);
  }

  useEffect(() => { runChecks(); }, []);
  const passed = Object.values(results).filter((item) => item.ok).length;

  return <>
    <div className="notice"><strong>Operational assurance view.</strong> These read-only checks provide a current view of platform availability, runtime-control status, evidence integrity, governed capabilities, and integration reachability. The assurance view does not change infrastructure, policy, data, configuration, or enforcement state.</div>
    <section className="section grid-4"><Metric label="Assurance checks" value={String(checks.length)} foot="Read-only operational control points" /><Metric label="Available" value={Object.keys(results).length ? String(passed) : ", "} foot="Current service and control reachability" /><Metric label="Approved models" value={String(models.filter((model) => model.key !== "glm_5_3_prime").slice(0, 23).length)} foot="Models exposed through the current UI registry" /><Metric label="Governed interfaces" value={String(entities.length || 4)} foot={`${functions.length} configured functional identities`} /></section>
    <section className="section card"><div className="section-header"><div><div className="section-title">Platform assurance checks</div><div className="section-note">Current reachability and response status across the published service and control interfaces.</div></div><button className="secondary small-button" onClick={runChecks} disabled={running}>{running ? "Assessing…" : "Refresh assurance status"}</button></div><div className="diagnostic-list">{checks.map(([name, path]) => { const item = results[path]; return <div className="diagnostic-row" key={path}><div><strong>{name}</strong><span className="mono-cell">{path}</span></div><div className="diagnostic-summary">{item?.summary || "Waiting"}</div><div className="diagnostic-latency">{item ? fmtMs(item.latency) : ", "}</div><StatusPill good={item ? item.ok : null} label={item ? (item.ok ? "Available" : "Exception") : "Pending"} /></div>; })}</div></section>
    <section className="section grid-2"><div className="card"><div className="section-title">Service boundary</div><p className="body-copy">Client requests pass through a server-side gateway with an explicit path allowlist. Backend and provider credentials remain outside the client boundary, and assurance responses are not retained by the browser proxy.</p></div><div className="card"><div className="section-title">Control exception handling</div><p className="body-copy">A protected control may intentionally report an exception when a required precondition is no longer valid. Fail-closed behavior prevents the affected operation from proceeding while preserving the distinction between a control exception and the availability of the last known-good application state.</p></div></section>
  </>;
}

function summarizeDiagnostic(path, payload) {
  if (path === "/health") return payload?.status || "responded";
  if (path === "/ready") return `status=${payload?.status || "unknown"}; OPA=${payload?.cv11_opa_healthy ? "healthy" : "check"}`;
  if (path.endsWith("/cv11")) return `${payload?.policy || "CV1.1"}; ${payload?.governed_failure_mode || "fail_closed"}`;
  if (path.endsWith("/audit/integrity")) return `gov=${payload?.governed?.valid ? "valid" : "check"}; ungov=${payload?.ungoverned?.valid ? "valid" : "check"}; HMAC-SHA256`;
  if (path.endsWith("/models")) return `${payload?.models?.length ?? payload?.count ?? 0} registered models`;
  if (path.includes("governed/functions")) return `${payload?.functions?.length ?? 0} functions · ${payload?.domains?.length ?? 0} domains`;
  if (path.includes("ungoverned/functions")) return payload?.pairing_contract ? "pairing contract exposed" : "control path responded";
  if (path.includes("mcp/governed/entities")) return `${payload?.entities?.length ?? 0} governed entities`;
  return "responded";
}

const rootElement = document.getElementById("root");
rootElement.replaceChildren();
createRoot(rootElement).render(<React.StrictMode><App /><Analytics /></React.StrictMode>);
