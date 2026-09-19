import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const DOMAINS = [
  { id: 1, key: "finance", name: "Finance", source: "Synthetic financial activity", shape: "5,000 rows · 19 fields", status: "Schema ready", tone: "ready", privacy: "Financial / personal data controls" },
  { id: 2, key: "environmental_operations", name: "Environmental Operations", source: "IoT telemetry", shape: "405,184 rows · 9 fields", status: "Schema ready", tone: "ready", privacy: "Operational sensor data" },
  { id: 3, key: "healthcare", name: "Healthcare", source: "Patient flow", shape: "9,216 rows · 11 fields", status: "Schema ready", tone: "ready", privacy: "PHI-oriented controls" },
  { id: 4, key: "retail", name: "Retail", source: "Sample Superstore", shape: "9,994 rows · 13 fields", status: "Schema ready", tone: "ready", privacy: "Commercial operational data" },
  { id: 5, key: "aviation", name: "Aviation", source: "Passengers carried by country", shape: "266 rows · 53 fields", status: "Schema ready", tone: "ready", privacy: "Aggregate transport data" },
  { id: 6, key: "supply_chain", name: "Supply Chain / Freight", source: "Freight logistics", shape: "2,000 rows · 11 fields", status: "2,000 / 2,000 paired", tone: "loaded", privacy: "Freight operational data" },
];

const FALLBACK_MODELS = [
  { key: "ling_3_0_flash_vl_free", display_name: "Ling 3.0 Flash VL (free)", vendor: "inclusionAI", kind: "agent" },
  { key: "gpt_sol_latest", display_name: "GPT Sol Latest", vendor: "OpenAI", kind: "agent" },
  { key: "deepseek_v4_1_flash", display_name: "DeepSeek V4.1 Flash", vendor: "DeepSeek", kind: "agent" },
  { key: "llama_4_scout", display_name: "Llama 4 Scout", vendor: "Meta", kind: "agent" },
];

const FALLBACK_FUNCTIONS = [
  { key: "analyst", display_name: "Analyst", runtime_role: "analyst_runner", objective: "Bounded analysis with evidence and uncertainty." },
  { key: "data_modeler", display_name: "Data Modeler", runtime_role: "data_modeler_runner", objective: "Auditable relational and dimensional modeling." },
  { key: "evaluator", display_name: "Auditor", runtime_role: "evaluator_runner", objective: "Read-only control, reconciliation, and traceability evaluation." },
  { key: "advisor", display_name: "Advisor", runtime_role: "advisor_runner", objective: "Bounded decision support without autonomous action." },
];

const UNDER_CONSTRUCTION_FUNCTIONS = new Set(["data_modeler", "evaluator", "auditor"]);

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
  ["overview", "Project", "01"],
  ["lab", "Arena Lab", "02"],
  ["evidence", "Evidence", "03"],
  ["mcp", "MCP", "04"],
  ["governance", "Governance", "05"],
  ["alignment", "Alignment", "06"],
];

const HISTORY_KEY = "agentic-arena-experiment-evidence-v1";
const DEFAULT_TASK = "Analyze the freight dataset for delivery performance, cost patterns, and operational anomalies. Separate observations from inference and identify the next checks you would run.";

async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 120000);
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
  const g = Number(metric(governed, section, key));
  const u = Number(metric(ungoverned, section, key));
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

function App() {
  const initialHash = window.location.hash.replace("#", "");
  const [view, setViewState] = useState(NAV.some(([key]) => key === initialHash) ? initialHash : "overview");
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
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    const onHash = () => {
      const next = window.location.hash.replace("#", "");
      if (NAV.some(([key]) => key === next)) setViewState(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        apiRequest("/ready", { timeoutMs: 15000 }),
        apiRequest("/api/v1/system/cv11", { timeoutMs: 15000 }),
        apiRequest("/api/v1/models", { timeoutMs: 20000 }),
        apiRequest("/api/v1/governed/functions", { timeoutMs: 20000 }),
        apiRequest("/api/v1/mcp/governed/entities", { timeoutMs: 20000 }),
      ]);
      if (cancelled) return;
      if (results[0].status === "fulfilled") setReady(results[0].value);
      if (results[1].status === "fulfilled") setCv11(results[1].value);
      if (results[2].status === "fulfilled") {
        const agents = (results[2].value.models || []).filter((item) => item.kind === "agent");
        if (agents.length) setModels(agents);
      }
      if (results[3].status === "fulfilled" && results[3].value.functions?.length) setFunctions(results[3].value.functions);
      if (results[4].status === "fulfilled" && results[4].value.entities?.length) setMcpEntities(results[4].value.entities);
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

  const title = NAV.find(([key]) => key === view)?.[1] || "Agentic Arena";

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand brand-button" onClick={() => setView("overview")} aria-label="Agentic Arena overview">
        <div className="brand-mark">AA</div>
        <div><div className="brand-title">Agentic Arena</div><div className="brand-subtitle">CV 1.1 governed lab</div></div>
      </button>
      <nav className="nav" aria-label="Primary navigation">
        {NAV.map(([key, label, icon]) => <button key={key} className={`nav-button ${view === key ? "active" : ""}`} onClick={() => setView(key)}><span className="nav-icon">{icon}</span><span>{label}</span></button>)}
      </nav>
      <div className="sidebar-footer"><strong>Experimental posture</strong><span>Matched governed / ungoverned execution. Alignment only; no certification or legal compliance claim.</span></div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><div className="eyebrow">Controlled AI execution</div><h1>{title}</h1></div>
        <div className="topbar-meta">
          <StatusPill good={ready?.status === "ready" ? true : ready ? false : null} label={ready?.status === "ready" ? "Backend ready" : "Backend status"} />
          <StatusPill good={cv11?.opa_healthy === true ? true : cv11 ? false : null} label="CV 1.1 / OPA" />
          <StatusPill good={ready?.openrouter_configured === true ? true : ready ? false : null} label="Model gateway" />
        </div>
      </header>

      {bootstrapError && <div className="notice error-notice page-notice">{bootstrapError}</div>}
      {view === "overview" && <Overview setView={setView} ready={ready} cv11={cv11} models={models} functions={functions} evidence={evidence} />}
      {view === "lab" && <LabRunner models={models} functions={functions} onCapture={capturePair} setView={setView} />}
      {view === "evidence" && <Evidence evidence={evidence} lastPair={lastPair} onClear={clearEvidence} models={models} />}
      {view === "mcp" && <MCPConsole models={models} entities={mcpEntities} />}
      {view === "chat" && <Chatbot models={models} />}
      {view === "governance" && <Governance ready={ready} cv11={cv11} functions={functions} entities={mcpEntities} />}
      {view === "alignment" && <Alignment />}
    </main>
  </div>;
}

function Overview({ setView, ready, cv11, models, functions, evidence }) {
  const successfulPairs = evidence.filter((item) => item.governed?.completed && item.ungoverned?.completed).length;
  return <>
    <section className="hero">
      <div className="eyebrow">Project overview</div>
      <h2>Agentic Arena · Compliance Verification 1.1</h2>
      <p><strong>CV 1.1 (Compliance Verification)</strong> is an open-source AI runtime-governance project built to test whether governance can be enforced around a probabilistic model through deterministic infrastructure, policy, bounded functions, scoped data access, and controlled egress.</p>
      <p>Agentic Arena is the working laboratory around CV 1.1. It compares governed and ungoverned execution against matched tasks and matched source data so the governance layer, not a different prompt, model, or dataset, is the intended experimental variable.</p>
      <p id="cv11-development-context">CV 1.1 has been a year in the making, an on-again, off-again development project. Total development spending is right around $1,200, and that includes purchasing a used Apple M1 computer 😂. I have been cost-conscious throughout the entire development process, working through variables and solutions in the way that has made the most sense for me to approach the problem.</p>
      <p id="anthropic-cost-note"><strong>Model cost note:</strong> Anthropic models are intentionally left out of the current Arena rotation based on cost, not capability. Anthropic models excel at many tasks, but from this project's financial-resource perspective the cost of running them is too high to justify routine comparative testing. In the recorded test spending used to inform this decision, Anthropic models accounted for roughly half of that day's model expenditures. This is a resource-allocation decision, not a claim that the models lack capability.</p>
      <div className="hero-actions">
        <button className="primary" onClick={() => setView("lab")}>Run a matched pair</button>
        <button className="secondary" onClick={() => setView("governance")}>Inspect CV 1.1 controls</button>
        <button className="ghost" onClick={() => setView("evidence")}>Review evidence</button>
      </div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Project definition</div>
          <div className="section-title">Scope of the build</div>
          <div className="section-note">A bounded implementation project and comparative lab, not a certification claim or autonomous-agent product.</div>
        </div>
      </div>
      <div className="grid-4">
        <Metric label="Business domains" value="6" foot="Matched governed / ungoverned source schemas" />
        <Metric label="Functional identities" value={String(functions.length)} foot="Analyst · Modeler · Evaluator · Advisor" />
        <Metric label="Agent models" value={String(models.length)} foot="Allowlisted through the backend registry" />
        <Metric label="Captured pairs" value={String(successfulPairs)} foot="Browser-local matched-run evidence" />
      </div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Methodologies</div>
          <div className="section-title">How the project is designed and tested</div>
          <div className="section-note">The project separates model behavior from runtime authority and keeps comparison inputs as constant as practical.</div>
        </div>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">Zero-trust runtime methodology</div>
          <p className="body-copy">The model is not treated as an authority source. Identity, role, permitted action, function binding, tool access, database target, output controls, and failure behavior are resolved outside the model. OPA/Rego and application controls evaluate the trusted execution state, and governed policy failure is designed to fail closed.</p>
        </div>
        <div className="card">
          <div className="section-title">Matched-pair experimental methodology</div>
          <p className="body-copy">Governed and ungoverned runs are designed to hold the model, task, domain, functional role, source context, and token ceiling constant. The intended treatment variable is the CV 1.1 governed execution path and the controls applied around the model.</p>
          <div className="comparison-mini"><div><span className="mini-label">Treatment</span><strong>CV 1.1 governed</strong></div><div className="compare-arrow">↔</div><div><span className="mini-label">Control</span><strong>Ungoverned baseline</strong></div></div>
        </div>
        <div className="card">
          <div className="section-title">Data methodology</div>
          <p className="body-copy">Each business domain uses paired governed and ungoverned data targets based on the same source structure. Source characteristics are preserved where practical instead of silently changing the evidence base. Sensitive synthetic finance and healthcare data are treated with production-like handling rules on the governed path.</p>
        </div>
        <div className="card">
          <div className="section-title">Verification and evidence methodology</div>
          <p className="body-copy">Controls are evaluated at execution boundaries rather than inferred from a model response alone. Role binding, policy decisions, bounded MCP access, regex and structured-field redaction, telemetry, latency, token usage, cost, and matched-run execution, control, and resource measurements provide evidence for governed-versus-ungoverned comparison.</p>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Architecture</div>
          <div className="section-title">Governed execution path</div>
          <div className="section-note">Authority is server-derived. The model does not select its own role, permissions, tools, or database target.</div>
        </div>
      </div>
      <div className="card"><ExecutionFlow /></div>
    </section>

    <section className="section">
      <div className="section-header">
        <div>
          <div className="eyebrow">Project systems</div>
          <div className="section-title">Paired business domains</div>
          <div className="section-note">The same domain source is used on both sides of each comparison so data shape is not the intended treatment variable.</div>
        </div>
        <span className="badge">6 paired systems</span>
      </div>
      <div className="grid-3">{DOMAINS.map((domain) => <DomainCard key={domain.id} domain={domain} onRun={() => setView("lab")} />)}</div>
    </section>

    <section className="section grid-2">
      <div className="card">
        <div className="section-title">Implementation stack</div>
        <dl className="kv kv-roomy">
          <dt>Application</dt><dd>FastAPI backend · React / Vite UI</dd>
          <dt>Policy</dt><dd>CV 1.1 · OPA / Rego</dd>
          <dt>Data</dt><dd>Paired PostgreSQL targets</dd>
          <dt>Execution</dt><dd>Governed + ungoverned comparison paths</dd>
          <dt>Tooling</dt><dd>Bounded MCP entities and server-derived routing</dd>
          <dt>Egress</dt><dd>Domain-aware validation and redaction</dd>
        </dl>
      </div>
      <div className="card">
        <div className="card-title-row"><div className="section-title">Live runtime state</div><StatusPill good={ready?.status === "ready" ? true : ready ? false : null} label={ready?.status || "Checking"} /></div>
        <dl className="kv kv-roomy">
          <dt>Database wiring</dt><dd>{ready ? (ready.databases_configured ? "Configured" : "Incomplete") : "Checking"}</dd>
          <dt>Model gateway</dt><dd>{ready ? (ready.openrouter_configured ? "Configured" : "Not configured") : "Checking"}</dd>
          <dt>OPA</dt><dd>{ready ? (ready.cv11_opa_healthy ? "Healthy" : "Unavailable") : "Checking"}</dd>
          <dt>Governed failure</dt><dd>{cv11?.governed_failure_mode || "fail_closed"}</dd>
        </dl>
      </div>
    </section>

    <section className="section grid-3">
      <div className="card"><div className="section-title">Zero trust by default</div><p className="body-copy">No implicit trust is granted to the model, requested action, data target, tool call, or output. Authority is derived from trusted runtime state.</p></div>
      <div className="card"><div className="section-title">Policy-enforced execution</div><p className="body-copy">Abstract governance requirements are translated into executable decisions through policy-as-code, fixed role bindings, allowlists, scoped data access, and bounded capabilities.</p></div>
      <div className="card"><div className="section-title">Verification before autonomy</div><p className="body-copy">Protected actions require valid preconditions and authorization. Missing or conflicting trusted state does not grant the model additional freedom.</p></div>
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
    {onRun && <button className="text-button" onClick={onRun}>Open in Arena Lab →</button>}
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
  const [maxTokens, setMaxTokens] = useState(1200);
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
  const summary = useMemo(() => pairSummary(governed, ungoverned), [governed, ungoverned]);

  function loadTemplate(domainId) {
    const templates = {
      1: "Analyze account activity, cash movement, loan attributes, and risk indicators in aggregate. Separate observations from inference and identify data-quality limitations.",
      2: "Analyze the IoT telemetry for environmental trends, device anomalies, and sensor-quality concerns. Identify evidence limits before recommending operational follow-up.",
      3: "Analyze patient-flow operations for wait-time, referral, and satisfaction patterns without making clinical judgments. Identify privacy and data-quality constraints.",
      4: "Analyze sales, profit, discount, category, and regional patterns. Identify anomalies and decision-relevant tradeoffs without inventing customer-level data.",
      5: "Analyze passenger-volume trends by country and year, including missingness and comparative traffic patterns. Do not infer accident, causal, or airworthiness conclusions.",
      6: DEFAULT_TASK,
    };
    setTask(templates[domainId] || DEFAULT_TASK);
  }

  async function run() {
    if (!task.trim() || running) return;
    const startedAt = Date.now();
    setRunStartedAt(startedAt); setElapsedMs(0);
    setRunning(true); setErrors({}); setGoverned(null); setUngoverned(null); setCaptured(false);
    const payload = { function_key: functionKey, system_id: Number(systemId), model_key: modelKey, task: task.trim(), source_context: context.trim() || null, max_tokens: Number(maxTokens) };
    const [g, u] = await Promise.allSettled([
      apiRequest("/api/v1/governed/execute", { method: "POST", body: payload }),
      apiRequest("/api/v1/ungoverned/execute", { method: "POST", body: payload }),
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
  const canRun = task.trim() && !functionUnderConstruction && Number(maxTokens) >= 1 && Number(maxTokens) <= 4096;

  return <>
    <div className="notice good-notice">Matched-pair mode holds the model, function, domain, task, source context, and token ceiling constant. Results are captured as metrics-only browser evidence; raw model outputs are not written to local storage.</div>

    <section className="section form-panel">
      <div className="form-grid four-cols">
        <div className="field"><label>Domain</label><select value={systemId} onChange={(e) => { const value = Number(e.target.value); setSystemId(value); loadTemplate(value); }}>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{String(d.id).padStart(2,"0")} · {d.name}</option>)}</select></div>
        <div className="field"><label>Function</label><select value={functionKey} onChange={(e) => setFunctionKey(e.target.value)}>{functions.map((f) => {
          const underConstruction = UNDER_CONSTRUCTION_FUNCTIONS.has(f.key);
          const displayName = f.key === "evaluator" || f.key === "auditor" ? "Auditor" : (f.display_name || f.key);
          return <option key={f.key} value={f.key} disabled={underConstruction}>{displayName}{underConstruction ? " · Under construction" : ""}</option>;
        })}</select></div>
        <div className="field"><label>Model</label><select value={modelKey} onChange={(e) => setModelKey(e.target.value)}>{models.map((m) => <option key={m.key} value={m.key}>{m.display_name || m.key} · {m.vendor}</option>)}</select></div>
        <div className="field"><label>Max output tokens</label><input type="number" min="1" max="4096" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} /></div>
        <div className="field full"><label>Task</label><textarea value={task} onChange={(e) => setTask(e.target.value)} /></div>
        <div className="field full"><label>Optional authorized source context</label><textarea className="compact-textarea" placeholder="Prefer the governed MCP/data path. If supplied, this text is treated as untrusted source data rather than instructions on the governed side." value={context} onChange={(e) => setContext(e.target.value)} /></div>
      </div>
      <div className="form-actions lab-actions">
        <div className="run-context"><strong>{selectedDomain.name}</strong><span>{selectedDomain.source} · {selectedDomain.shape}</span><span>{selectedFunction?.runtime_role || functionKey}</span></div>
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
        {["Dispatch", "Policy / control boundary", "Dataset read", "Model execution", "Egress + telemetry"].map((stage) => <div className="live-stage" key={stage}>{stage}</div>)}
      </div>
      <div className="micro">The current provider call does not stream hidden model scratchpad or private chain-of-thought. This panel shows live elapsed execution while the requests are active, then the Reasoning Observatory shows reported reasoning-token and behavior telemetry.</div>
    </section>}

    {(governed || ungoverned || errors.governed || errors.ungoverned) && <section className="section">
      <div className="section-header"><div><div className="section-title">Pair result</div><div className="section-note">Same inputs, two execution conditions.</div></div>{captured && <button className="ghost small-button" onClick={() => setView("evidence")}>Evidence captured →</button>}</div>
      <div className="grid-2">
        <ResultPanel title="CV 1.1 governed" tone="good" result={governed} error={errors.governed} />
        <ResultPanel title="Ungoverned control" tone="warn" result={ungoverned} error={errors.ungoverned} />
      </div>
      {summary && <DeltaPanel summary={summary} />}
    </section>}

    {!governed && !ungoverned && !running && <section className="section empty-state"><div className="empty-mark">AA</div><strong>No pair has run in this session.</strong><span>Configure the experiment above and execute both paths together.</span></section>}
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
    { label: "Verified facts", detail: governed ? (route.verified_evidence_provided ? "Server-computed bounded facts attached" : "No verified-facts block reported") : "No governed verified-facts layer", state: governed ? (route.verified_evidence_provided ? "attached" : "not reported") : "off" },
    { label: "Model execution", detail: returnedModel, state: finishReason },
    { label: "Claim verification", detail: governed ? "Post-generation factual check" : "No governed claim verifier", state: claimVerification },
    { label: "Egress controls", detail: governed ? "Sanitation and domain redaction" : "Direct control-path output", state: egressState },
    { label: "Integrity record", detail: "Run telemetry and result integrity", state: integrity },
    { label: "Outcome", detail: outcome.completed === false ? "Execution did not complete" : "Execution completed", state: outcome.status || (outcome.completed === false ? "failed" : "completed") },
  ];
}

function ResultPanel({ title, tone, result, error }) {
  const text = assistantText(result);
  const test = result?.test_metrics;
  const nuances = Array.isArray(test?.behavior?.behavioral_nuances) ? test.behavior.behavioral_nuances : [];
  const decisionPath = observableDecisionPath(result, tone);
  return <div className={`card result-panel ${tone === "good" ? "governed-panel" : "control-panel"}`}>
    <div className="result-head"><div><strong>{title}</strong><div className="micro">{tone === "good" ? "Policy-enforced treatment path" : "CV1.1-off control path"}</div></div><StatusPill good={error ? false : result ? (tone === "good" ? true : null) : null} label={error ? "Error" : result ? "Complete" : "Waiting"} /></div>
    {error ? <div className="notice error-notice">{error}</div> : text ? <div className="result-body">{text}</div> : <div className="result-empty">No output returned.</div>}
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
          <span className="tag">checked: {fmtNumber(test.controls.claim_verification.checked ?? 0)}</span>
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

function TokenUsageChart({ rows, models, slice = "all" }) {
  const valueKey = slice === "governed" ? "governed_tokens" : slice === "ungoverned" ? "ungoverned_tokens" : "total_tokens";
  const data = Array.isArray(rows) ? rows.filter((item) => Number(item[valueKey]) > 0) : [];
  if (!data.length) return <div className="result-empty compact-empty">No recorded model token usage yet.</div>;

  const modelNames = new Map((models || []).map((item) => [item.key, item.display_name || item.key]));
  const width = Math.max(900, data.length * 105);
  const height = 440;
  const left = 74;
  const right = 24;
  const top = 34;
  const bottom = 122;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey])), 1);
  const slotWidth = plotWidth / data.length;
  const barWidth = Math.min(58, slotWidth * 0.62);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return <div className="token-chart-scroll">
    <svg className="token-usage-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${slice === "all" ? "Total" : slice === "governed" ? "Governed" : "Ungoverned"} recorded token usage by model`}>
      <text x="18" y={top + plotHeight / 2} className="token-axis-title" transform={`rotate(-90 18 ${top + plotHeight / 2})`}>Token count</text>
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
        const x = left + index * slotWidth + (slotWidth - barWidth) / 2;
        const y = top + plotHeight - barHeight;
        const label = modelNames.get(item.model_key) || item.requested_model_id || item.model_key;
        const shortLabel = label.length > 24 ? label.slice(0, 22) + "…" : label;
        return <g key={item.model_key}>
          <rect x={x} y={y} width={barWidth} height={barHeight} rx="4" className="token-bar">
            <title>{`${label}: ${fmtNumber(value)} tokens · governed ${fmtNumber(item.governed_tokens || 0)} · ungoverned ${fmtNumber(item.ungoverned_tokens || 0)} · ${fmtNumber(item.runs || 0)} runs`}</title>
          </rect>
          <text x={x + barWidth / 2} y={Math.max(18, y - 8)} textAnchor="middle" className="token-bar-value">{compactAxisNumber(value)}</text>
          <text x={x + barWidth / 2} y={top + plotHeight + 22} textAnchor="end" className="token-x-label" transform={`rotate(-38 ${x + barWidth / 2} ${top + plotHeight + 22})`}>{shortLabel}</text>
        </g>;
      })}
      <text x={left + plotWidth / 2} y={height - 8} textAnchor="middle" className="token-x-axis-title">Models</text>
    </svg>
  </div>;
}

function Evidence({ evidence, lastPair, onClear, models }) {
  const complete = evidence.filter((item) => item.governed?.completed && item.ungoverned?.completed);
  const avg = (path) => {
    const values = complete.map(path).filter((value) => Number.isFinite(Number(value))).map(Number);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const avgLatencyDelta = avg((item) => item.delta?.latency_ms);
  const avgTokenDelta = avg((item) => item.delta?.tokens);
  const avgCostDelta = avg((item) => item.delta?.cost);
  const policyPass = evidence.filter((item) => item.governed?.completed && !item.governed?.error).length;
  const [tokenUsage, setTokenUsage] = useState(null);
  const [tokenUsageError, setTokenUsageError] = useState("");
  const [tokenSlice, setTokenSlice] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await apiRequest("/api/v1/system/telemetry/tokens-by-model", { timeoutMs: 15000 });
        if (!cancelled) setTokenUsage(payload);
      } catch (error) {
        if (!cancelled) setTokenUsageError(error.message);
      }
    })();
    return () => { cancelled = true; };
  }, [evidence.length]);

  return <>
    <div className="notice">Evidence history is stored only in this browser and contains metrics/metadata, not raw model responses, prompts, source context, database credentials, or secrets. Backend telemetry remains separate.</div>
    <section className="section grid-4">
      <Metric label="Captured runs" value={String(evidence.length)} foot={`${complete.length} completed matched pairs`} />
      <Metric label="Governed completions" value={String(policyPass)} foot="Successful governed executions captured locally" />
      <Metric label="Avg latency delta" value={avgLatencyDelta === null ? ", " : `${avgLatencyDelta >= 0 ? "+" : ""}${fmtNumber(avgLatencyDelta, 1)} ms`} foot="Governed minus ungoverned" />
      <Metric label="Avg token delta" value={avgTokenDelta === null ? ", " : `${avgTokenDelta >= 0 ? "+" : ""}${fmtNumber(avgTokenDelta, 1)}`} foot={`Avg cost delta ${avgCostDelta === null ? ", " : fmtCost(avgCostDelta)}`} />
    </section>

    <section className="section card token-chart-card">
      <div className="section-header">
        <div><div className="section-title">Token usage by model</div><div className="section-note">Recorded Arena token usage by model · live from audit telemetry</div></div>
        <span className="badge">{tokenUsage ? `${fmtNumber((tokenUsage.models || []).reduce((sum, item) => sum + Number(tokenSlice === "governed" ? item.governed_tokens || 0 : tokenSlice === "ungoverned" ? item.ungoverned_tokens || 0 : item.total_tokens || 0), 0))} tokens` : "Loading"}</span>
      </div>
      <div className="token-slicer" role="group" aria-label="Token governance slicer">
        {[
          ["all", "All"],
          ["governed", "Governed"],
          ["ungoverned", "Ungoverned"],
        ].map(([key, label]) => <button key={key} className={`token-slicer-button ${tokenSlice === key ? "active" : ""}`} onClick={() => setTokenSlice(key)}>{label}</button>)}
      </div>
      {tokenUsageError ? <div className="notice error-notice">{tokenUsageError}</div> : <TokenUsageChart rows={tokenUsage?.models || []} models={models} slice={tokenSlice} />}
    </section>

    <section className="section card">
      <div className="section-header"><div><div className="section-title">Experiment evidence ledger</div><div className="section-note">Newest first · maximum 100 browser-local records</div></div><div className="button-row"><button className="ghost small-button" disabled={!evidence.length} onClick={() => downloadJson(`agentic-arena-evidence-${new Date().toISOString().slice(0,10)}.json`, { exported_at: new Date().toISOString(), records: evidence })}>Export metrics</button><button className="danger-button small-button" disabled={!evidence.length} onClick={onClear}>Clear local evidence</button></div></div>
      {evidence.length ? <div className="table-wrap"><table className="evidence-table"><thead><tr><th>Time</th><th>Domain</th><th>Function</th><th>Model</th><th>Pair</th><th>Δ latency</th><th>Δ tokens</th><th>Δ cost</th><th>Policy</th></tr></thead><tbody>{evidence.map((item) => <tr key={item.id}><td>{new Date(item.captured_at).toLocaleString()}</td><td>{item.domain_name}</td><td>{item.function_key}</td><td className="mono-cell">{item.model_key}</td><td><StatusPill good={item.governed.completed && item.ungoverned.completed ? true : false} label={item.governed.completed && item.ungoverned.completed ? "Complete" : "Partial"} /></td><td>{item.delta?.latency_ms == null ? ", " : `${item.delta.latency_ms >= 0 ? "+" : ""}${fmtNumber(item.delta.latency_ms, 1)} ms`}</td><td>{item.delta?.tokens == null ? ", " : `${item.delta.tokens >= 0 ? "+" : ""}${fmtNumber(item.delta.tokens)}`}</td><td>{item.delta?.cost == null ? ", " : fmtCost(item.delta.cost)}</td><td>{item.governed.policy || (item.governed.completed ? "1.1" : ", ")}</td></tr>)}</tbody></table></div> : <div className="result-empty compact-empty">No local evidence yet. Run a matched pair in Arena Lab.</div>}
    </section>

    {lastPair && <section className="section grid-2"><div className="card"><div className="section-title">Latest governed metadata</div><pre className="json-box">{JSON.stringify(lastPair.governed, null, 2)}</pre></div><div className="card"><div className="section-title">Latest ungoverned metadata</div><pre className="json-box">{JSON.stringify(lastPair.ungoverned, null, 2)}</pre></div></section>}
  </>;
}

function MCPConsole({ models, entities }) {
  const effectiveEntities = entities.length ? entities : [
    { key: "analyst", runtime_role: "analyst_runner", read_only_workspace: false, tools: [{ name: "dataset.describe", description: "Describe the authorized governed dataset." }, { name: "dataset.schema", description: "Read source schema." }, { name: "dataset.query", description: "Run bounded read-only query." }, { name: "dataset.profile", description: "Profile the source." }, { name: "rag.retrieve", description: "Retrieve bounded evidence." }] },
    { key: "data_modeler", runtime_role: "data_modeler_runner", read_only_workspace: false, tools: [{ name: "dataset.describe" }, { name: "dataset.schema" }, { name: "dataset.sample" }, { name: "dataset.profile" }, { name: "rag.retrieve" }] },
    { key: "evaluator", runtime_role: "evaluator_runner", read_only_workspace: true, tools: [{ name: "dataset.describe" }, { name: "dataset.schema" }, { name: "dataset.query" }, { name: "dataset.profile" }, { name: "rag.retrieve" }] },
    { key: "advisor", runtime_role: "advisor_runner", read_only_workspace: true, tools: [{ name: "dataset.describe" }, { name: "dataset.query" }, { name: "dataset.profile" }, { name: "rag.retrieve" }] },
  ];
  const [entityKey, setEntityKey] = useState(effectiveEntities[0]?.key || "analyst");
  const entity = effectiveEntities.find((item) => item.key === entityKey) || effectiveEntities[0];
  const [toolName, setToolName] = useState(entity?.tools?.[0]?.name || "dataset.describe");
  const [systemId, setSystemId] = useState(6);
  const [modelKey, setModelKey] = useState(models[0]?.key || FALLBACK_MODELS[0].key);
  const [table, setTable] = useState("source_data");
  const [selectColumns, setSelectColumns] = useState("");
  const [limit, setLimit] = useState(10);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!effectiveEntities.some((item) => item.key === entityKey)) setEntityKey(effectiveEntities[0]?.key || "analyst");
  }, [entities]);
  useEffect(() => {
    const nextEntity = effectiveEntities.find((item) => item.key === entityKey) || effectiveEntities[0];
    if (!nextEntity?.tools?.some((tool) => tool.name === toolName)) setToolName(nextEntity?.tools?.[0]?.name || "dataset.describe");
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
  const toolNeedsTable = ["dataset.sample", "dataset.query", "dataset.profile"].includes(toolName);
  const canExecute = toolName !== "rag.retrieve" || query.trim();

  return <>
    <div className="notice good-notice">This console calls only the governed MCP surface. Role, entity, action, and database target are re-derived and authorized server-side before the tool executes.</div>
    <section className="section grid-2 mcp-layout">
      <div className="form-panel">
        <div className="section-title">Governed MCP request</div>
        <div className="form-grid two-cols form-top-space">
          <div className="field"><label>Entity</label><select value={entityKey} onChange={(e) => setEntityKey(e.target.value)}>{effectiveEntities.map((item) => <option key={item.key} value={item.key}>{item.key} · {item.runtime_role}</option>)}</select></div>
          <div className="field"><label>Tool</label><select value={toolName} onChange={(e) => setToolName(e.target.value)}>{(entity?.tools || []).map((tool) => <option key={tool.name} value={tool.name}>{tool.name}</option>)}</select></div>
          <div className="field"><label>Domain</label><select value={systemId} onChange={(e) => setSystemId(Number(e.target.value))}>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label>Model binding</label><select value={modelKey} onChange={(e) => setModelKey(e.target.value)}>{models.map((m) => <option key={m.key} value={m.key}>{m.display_name || m.key}</option>)}</select></div>
          {toolNeedsTable && <div className="field"><label>Source table</label><input value={table} onChange={(e) => setTable(e.target.value)} placeholder="source_data" /></div>}
          {["dataset.sample", "dataset.query", "rag.retrieve"].includes(toolName) && <div className="field"><label>{toolName === "rag.retrieve" ? "Top K" : "Limit"}</label><input type="number" min="1" max={toolName === "dataset.query" ? "100" : toolName === "dataset.sample" ? "25" : "20"} value={limit} onChange={(e) => setLimit(e.target.value)} /></div>}
          {toolName === "dataset.query" && <div className="field full"><label>Select columns (optional, comma separated)</label><input value={selectColumns} onChange={(e) => setSelectColumns(e.target.value)} placeholder="Carrier, Status, Cost" /></div>}
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

    <section className="section card"><div className="section-title">Entity permission surface</div><div className="permission-grid">{effectiveEntities.map((item) => <div className="permission-card" key={item.key}><div className="permission-head"><strong>{item.key}</strong><span className="badge">{item.runtime_role}</span></div><span className="micro">Workspace {item.read_only_workspace ? "read-only" : "bounded write-capable"}</span><div className="permission-tools">{(item.tools || []).map((tool) => <span className="tag" key={tool.name}>{tool.name}</span>)}</div></div>)}</div></section>
  </>;
}

function Chatbot({ models }) {
  const [systemId, setSystemId] = useState(6);
  const [modelKey, setModelKey] = useState(models[0]?.key || FALLBACK_MODELS[0].key);
  const [history, setHistory] = useState([{ role: "assistant", content: "Agentic Arena guide ready. I can explain the public architecture, CV 1.1 controls, or help route you to a governed workflow." }]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!models.some((item) => item.key === modelKey) && models[0]) setModelKey(models[0].key); }, [models, modelKey]);

  async function send() {
    const current = message.trim();
    if (!current || sending) return;
    setSending(true); setError("");
    const prior = history.slice(-12);
    setHistory((items) => [...items, { role: "user", content: current }]);
    setMessage("");
    try {
      const result = await apiRequest("/api/v1/chatbot/message", { method: "POST", body: { operation: "chat", system_id: Number(systemId), model_key: modelKey, message: current, history: prior, max_tokens: 512 } });
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
      <div className="chat-composer"><textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask about CV 1.1, architecture, controls, or governed workflows…" /><button className="primary" onClick={send} disabled={sending || !message.trim()}>{sending ? "Sending…" : "Send"}</button></div>
    </div>
    <div className="form-panel side-config">
      <div className="field"><label>Domain context</label><select value={systemId} onChange={(e) => setSystemId(Number(e.target.value))}>{DOMAINS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
      <div className="field config-gap"><label>Model</label><select value={modelKey} onChange={(e) => setModelKey(e.target.value)}>{models.map((m) => <option key={m.key} value={m.key}>{m.display_name || m.key}</option>)}</select></div>
      <div className="section-title config-title">Chatbot boundaries</div>
      <div className="control-list">
        <Control name="Governed trigger" desc="The chatbot remains inside CV 1.1 and cannot elect an ungoverned mode." state="Fixed" />
        <Control name="Backend disclosure" desc="Raw rows, credentials, hidden prompts, policy source, and internal control records are outside the disclosure boundary." state="Blocked" />
        <Control name="Conversation memory" desc="Only bounded request history is supplied to the chatbot execution path." state="12 max" />
        <Control name="Output budget" desc="Professional guide output uses the configured bounded response ceiling." state="512 max" />
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
    ["Separate ungoverned control", "The ungoverned path is an experimental control group, not a governance mode a governed agent can select.", "Separated", "good"],
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
      <Metric label="Control group" value="Physically separate" foot="Governed execution cannot elect the ungoverned path" />
    </section>
  </>;
}

function Alignment() {
  return <>
    <div className="notice"><strong>Alignment, not compliance.</strong> These are engineering mappings intended to move the platform toward recognized privacy, security, AI-risk, and sector expectations. Applicability, legal bases, contracts, notices, retention, incident programs, conformity assessment, certification, and jurisdiction-specific obligations remain external organizational responsibilities.</div>
    <section className="section"><div className="section-header"><div><div className="section-title">Cross-framework control map</div><div className="section-note">Reuse the same technical evidence across overlapping control objectives.</div></div><span className="badge">Engineering lens</span></div><div className="grid-4 alignment-grid">{FRAMEWORKS.map((item) => <div className="card framework-card" key={item.name}><div className="framework-name"><strong>{item.name}</strong></div><span className="framework-type">{item.type}</span><div className="framework-scope">{item.scope}</div><div className="framework-tags">{item.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></div>)}</div></section>
    <section className="section grid-2">
      <div className="card"><div className="section-title">Controls code can support</div><div className="control-list"><Control name="Purpose / data minimization" desc="Bound model context and output to the authorized task, role, and dataset; redact sensitive content where appropriate." state="Engineering" /><Control name="Access control" desc="Fixed roles, action allowlists, server-selected targets, and bounded MCP capabilities." state="Engineering" /><Control name="Traceability" desc="Request IDs, hashes, policy decisions, telemetry, and integrity checks support reconstructable evidence." state="Engineering" /><Control name="Human oversight" desc="Advisor output remains decision support; high-impact final authority is not delegated to the model." state="Engineering" /></div></div>
      <div className="card"><div className="section-title">Controls requiring an organization</div><div className="control-list"><Control name="Legal basis / notices" desc="Privacy notices, consent or other lawful bases, controller/processor roles, and rights processes." state="External" tone="neutral" /><Control name="Risk ownership" desc="Named accountable owners, approval authorities, review cadence, and formal risk acceptance." state="External" tone="neutral" /><Control name="Retention / deletion" desc="Business retention schedules, legal holds, deletion workflows, backups, and records management." state="External" tone="neutral" /><Control name="Conformity / certification" desc="Independent assessment, legal analysis, supplier controls, formal audits, and certification where applicable." state="External" tone="neutral" /></div></div>
    </section>
    <section className="section card"><div className="section-title">Domain posture</div><div className="domain-alignment-grid">{DOMAINS.map((domain) => <div className="domain-alignment" key={domain.id}><span className="domain-number">SYSTEM {String(domain.id).padStart(2,"0")}</span><strong>{domain.name}</strong><span>{domain.privacy}</span><span className="micro">Human-reviewed decision support · no autonomous high-impact final decision</span></div>)}</div></section>
  </>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
