import React, { useEffect, useMemo, useState } from "react";

export const T2_BOT_DEFINITIONS = Object.freeze({
  t2_coding: { key: "t2_coding", interfaceLabel: "coding agent", label: "Coding Assistant", domain: "coding", functionKey: "coding_assistant", systemId: 0, role: "coding_assistant", objective: "Generate source revisions in the editor while preserving the current file's behavior and structure.", capabilities: ["state.read"] },
  t2_medical: { key: "t2_medical", interfaceLabel: "medical analyst / assistant", label: "Medical Analyst / Assistant", domain: "healthcare", functionKey: "analyst", systemId: 3, role: "medical_analyst_assistant", objective: "Explain general medical topics, support medical coding workflows, and analyze authorized healthcare operations evidence.", capabilities: ["state.read", "dataset.read", "dataset.aggregate", "healthcare.operational_metrics", "data.validate", "arithmetic.verify"] },
  t2_financial: { key: "t2_financial", interfaceLabel: "financial risk analyst", label: "Financial Risk Analyst", domain: "finance", functionKey: "analyst", systemId: 1, role: "financial_risk_analyst", objective: "Analyze authorized financial activity and risk indicators without approving or executing financial actions.", capabilities: ["state.read", "dataset.read", "dataset.aggregate", "data.validate", "arithmetic.verify"] },
  t2_logistics: { key: "t2_logistics", interfaceLabel: "logistics management analyst / assistant", label: "Logistics Management Analyst / Assistant", domain: "supply_chain", functionKey: "analyst", systemId: 6, role: "logistics_management_analyst_assistant", objective: "Analyze distinct ERP, CRM, LMS, and logistics evidence to support bounded scheduling and routing decisions.", capabilities: ["state.read", "dataset.read", "dataset.aggregate", "logistics.schedule_plan", "logistics.route_concern", "enterprise.cross_reference", "inventory.plan", "data.validate", "arithmetic.verify"] },
  t2_aviation: { key: "t2_aviation", interfaceLabel: "aviation customer service", label: "Avia — Aviation Customer Service", domain: "aviation", functionKey: "travel_agent", systemId: 5, role: "airline_travel_assistant", objective: "Represent the company in bounded aviation customer-service workflows with live search, calendar planning, authoritative guidance, and secure external handoffs.", capabilities: ["state.read", "travel.search", "travel.price_list", "travel.calendar", "travel.fare_estimate", "travel.regulatory_info", "travel.booking_handoff", "travel.payment_handoff"] },
  t2_execution: { key: "t2_execution", interfaceLabel: "regulatory framework", label: "Regulatory Framework", domain: "coding", functionKey: "coding_assistant", systemId: 0, role: "execution_pass", objective: "Develop and test the regulatory framework surface, control mappings, and bounded execution requirements.", capabilities: ["state.read", "data.validate", "arithmetic.verify", "execution.writeback"], note: "This surface uses the Agent Benchmark coding execution target until a dedicated execution-pass role is exposed by the backend registry." },
});

export const T2_BOT_KEYS = Object.freeze(Object.keys(T2_BOT_DEFINITIONS));

function modelKeyFromValue(item) {
  if (typeof item === "string") return item;
  return item?.key || item?.model_key || item?.id || null;
}

async function t2Request(path, options = {}) {
  const response = await fetch("/api/proxy?path=" + encodeURIComponent(path), {
    method: options.method || "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const text = await response.text();
  let payload = text;
  try { payload = text ? JSON.parse(text) : {}; } catch { /* preserve backend text */ }
  if (!response.ok) {
    const detail = typeof payload === "object" && payload?.detail ? payload.detail : payload;
    const message = typeof detail === "string" ? detail : detail?.message || JSON.stringify(detail);
    throw new Error(message || "Agent request failed with " + response.status);
  }
  return payload;
}

async function t2StreamRequest(path, options = {}, onEvent) {
  const response = await fetch("/api/proxy?path=" + encodeURIComponent(path), {
    method: options.method || "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Coding agent request failed with " + response.status);
  }
  if (!response.body) throw new Error("Coding stream did not return a readable body.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function emit(block) {
    if (!block.trim()) return;
    let eventName = "message";
    const dataLines = [];
    block.split(/\r?\n/).forEach((line) => {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    });
    if (!dataLines.length) return;
    try {
      onEvent(eventName, JSON.parse(dataLines.join("\n")));
    } catch {
      onEvent(eventName, { message: dataLines.join("\n") });
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    blocks.forEach(emit);
    if (done) {
      if (buffer) emit(buffer);
      break;
    }
  }
}

const APPROVED_MODEL_LABELS = Object.freeze({
  ling: "Ling 3.0 Flash",
  gpt_5_5: "GPT-5.5",
  mercury_2_5: "Mercury 2.5",
  llama_4_maverick: "Llama 4 Maverick",
  granite_4_2_8b: "Granite 4.2 8B",
});
const AVIA_MODEL_KEY = "ling";

function approvedModelLabel(key) {
  return APPROVED_MODEL_LABELS[key] || key;
}

const CODE_EDITOR_LANGUAGES = Object.freeze({
  python: { label: "Python", fileName: "main.py", fence: "python", starter: "def transform(records):\n    return records\n" },
  sql: { label: "SQL", fileName: "query.sql", fence: "sql", starter: "SELECT *\nFROM source_records\nWHERE status = 1;\n" },
  typescript: { label: "TypeScript", fileName: "index.ts", fence: "typescript", starter: "type AgentInput = {\n  prompt: string;\n};\n\nexport function review(input: AgentInput): string {\n  return input.prompt.trim();\n}\n" },
  css_plus: { label: "CSS+", fileName: "styles.css", fence: "css", starter: ":root {\n  color-scheme: dark;\n}\n\n.editor-preview {\n  display: grid;\n}\n" },
});

function CodeEditor({ onAttach, onGenerate, modelOptions, modelKey, onModelChange, prompt, revision, trace, onTraceReset, onTraceAppend, onCodeChange, onLanguageChange }) {
  const [language, setLanguage] = useState("python");
  const [drafts, setDrafts] = useState(() => Object.fromEntries(Object.entries(CODE_EDITOR_LANGUAGES).map(([key, item]) => [key, item.starter])));
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [runMessage, setRunMessage] = useState("");
  const config = CODE_EDITOR_LANGUAGES[language];
  const code = drafts[language] || "";
  const lineNumbers = code.split("\n");
  useEffect(() => {
    if (!revision?.code || !CODE_EDITOR_LANGUAGES[revision.language]) return;
    setLanguage(revision.language);
    setDrafts((current) => ({ ...current, [revision.language]: revision.code }));
    onCodeChange?.(revision.code);
    setRunMessage("Code response loaded into the editor.");
  }, [revision]);

  function updateCode(event) {
    setDrafts((current) => ({ ...current, [language]: event.target.value }));
    onCodeChange?.(event.target.value);
  }

  function changeLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    onLanguageChange?.(nextLanguage, drafts[nextLanguage] || "");
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  function attachCode() {
    const fence = String.fromCharCode(96).repeat(3);
    onAttach(fence + config.fence + "\n" + code + "\n" + fence);
  }

  async function generateRevision() {
    const promptText = prompt.trim();
    if (!promptText) {
      setRunMessage("Enter the coding request in the prompt box first.");
      return;
    }
    setGenerating(true);
    setRunMessage("");
    onTraceReset?.();
    try {
      const result = await onGenerate({ prompt: promptText, language: config.fence, currentCode: code, onTrace: onTraceAppend });
      if (result?.code) {
        setDrafts((current) => ({ ...current, [language]: result.code }));
        setRunMessage("Revision returned by the coding stream.");
      } else if (result?.message) {
        setRunMessage(result.message);
      }
    } catch (error) {
      setRunMessage(error?.message || "The coding stream did not complete.");
    } finally {
      setGenerating(false);
    }
  }

  function clearCode() {
    setDrafts((current) => ({ ...current, [language]: "" }));
    onCodeChange?.("");
    setRunMessage("");
  }

  return <section className="t2-code-editor" aria-label="Coding Assistant code editor">
    <div className="t2-code-editor-head">
      <div>
        <div className="eyebrow">Code editor</div>
        <strong>{config.fileName}</strong>
      </div>
      <div className="t2-code-editor-meta"><span>{lineNumbers.length} lines</span><span className="code-editor-dot" aria-hidden="true" /></div>
    </div>
    <div className="t2-code-editor-toolbar">
      <label className="code-editor-language">AI model
        <select value={modelKey} onChange={(event) => onModelChange(event.target.value)} aria-label="Approved AI model" disabled={!modelOptions.length}>
          {modelOptions.length ? modelOptions.map((item) => <option key={item} value={item}>{approvedModelLabel(item)}</option>) : <option value="">Loading approved models…</option>}
        </select>
      </label>
      <label className="code-editor-language">Language
        <select value={language} onChange={(event) => changeLanguage(event.target.value)} aria-label="Editor language">
          {Object.entries(CODE_EDITOR_LANGUAGES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
        </select>
      </label>
      <span className="micro">Coding agent · no local execution or deployment</span>
    </div>
    <div className="t2-runtime-trace" aria-live="polite">
      <div className="t2-runtime-trace-head"><strong>Runtime logic trace</strong><span>Observable inference events</span></div>
      <div className="t2-runtime-trace-log">{trace.map((item, index) => <div className="t2-runtime-trace-row" key={item + "-" + index}><span>{String(index + 1).padStart(2, "0")}</span><div>{item}</div></div>)}</div>
    </div>
    <div className="t2-code-editor-body">
      <div className="t2-code-editor-gutter" aria-hidden="true">{lineNumbers.map((_line, index) => <span key={index}>{index + 1}</span>)}</div>
      <textarea className="t2-code-editor-input" value={code} onChange={updateCode} spellCheck="false" aria-label={config.label + " source editor"} />
    </div>
    {runMessage && <div className="micro t2-code-editor-message">{runMessage}</div>}
    <div className="t2-code-editor-actions">
      <button className="ghost small-button" type="button" onClick={clearCode}>Clear</button>
      <button className="ghost small-button" type="button" onClick={copyCode}>{copied ? "Copied" : "Copy code"}</button>
      <button className="ghost small-button" type="button" onClick={attachCode}>Add to prompt</button>
      <button className="primary small-button" type="button" onClick={generateRevision} disabled={generating || !modelOptions.length || !modelKey}>{generating ? "Generating…" : "Generate revision"}</button>
    </div>
  </section>;
}

function displayMessageContent(value) {
  return String(value ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n");
}

function resultText(result) {
  if (!result) return "No runtime result returned.";
  if (typeof result.reply === "string") return result.reply;
  if (typeof result.message === "string") return result.message;
  if (typeof result.redirect === "string") return result.redirect;
  if (result.status === "accepted") return "Agent accepted turn " + (result.turn || "for execution") + " for the bound " + (result.role || "agent") + ".";
  if (result.status === "auto_reset") return result.redirect || "Agent reset the session after repeated manipulation attempts.";
  if (result.status === "refused") return result.reason || "Agent refused the request.";
  return JSON.stringify(result, null, 2);
}

function greeting(bot) {
  return bot.key === "t2_aviation" ? "" : bot.label + " ready. What would you like to work on?";
}

function initialHistory(bot) {
  const content = greeting(bot);
  return content ? [{ role: "assistant", content }] : [];
}

function looksLikeCodeRequest(prompt) {
  const normalized = prompt.trim().toLowerCase();
  const asksForExplanation = /^(explain|what|why|how do i|can you explain|tell me|compare|difference|define|help me understand|walk me through)\b/.test(normalized);
  const asksForImplementation = /\b(build|make|develop|draft|produce|scaffold|generate|create|implement|write|code)\b/.test(normalized);
  const asksForChange = /\b(refactor|debug|fix|change|update|modify|add|remove|execute|run)\b/.test(normalized);
  const containsCodeContext = /\b(code|coding|function|class|method|script|query|sql|typescript|css|component|api|bug|game|app|program)\b/.test(normalized);
  return normalized.includes(String.fromCharCode(96).repeat(3)) || asksForImplementation || (!asksForExplanation && (asksForChange || containsCodeContext));
}

const EDITOR_LANGUAGE_ALIASES = Object.freeze({
  python: "python", py: "python",
  sql: "sql",
  typescript: "typescript", ts: "typescript", javascript: "typescript", js: "typescript",
  css: "css_plus", "css+": "css_plus",
});

function extractEditorCode(reply) {
  const fence = String.fromCharCode(96).repeat(3);
  const pattern = new RegExp(fence + "([\\w+#.-]*)[ \\t]*\\r?\\n([\\s\\S]*?)" + fence, "g");
  const blocks = [...String(reply || "").matchAll(pattern)];
  for (const match of blocks) {
    const language = EDITOR_LANGUAGE_ALIASES[(match[1] || "").toLowerCase()];
    if (!language || !CODE_EDITOR_LANGUAGES[language]) continue;
    const code = match[2].replace(/^\n+|\n+$/g, "");
    if (!code.trim()) continue;
    const displayReply = String(reply).replace(match[0], "[Code placed in the editor.]");
    return { language, code, displayReply };
  }
  return null;
}

function telemetryValue(value, suffix = "") {
  return value === null || value === undefined || value === "" ? "N/A" : Number(value).toLocaleString() + suffix;
}

function telemetryCost(value) {
  return value === null || value === undefined || value === "" ? "N/A" : "$" + Number(value).toFixed(6);
}

function TelemetryModelChart({ runs }) {
  const data = runs.filter((item) => [
    item.input_tokens,
    item.output_tokens,
    item.reasoning_tokens,
  ].some((value) => Number(value) > 0));
  if (!data.length) return null;
  const width = Math.max(720, data.length * 150);
  const height = 340;
  const left = 82;
  const right = 28;
  const top = 26;
  const bottom = 94;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxTokens = Math.max(...data.map((item) => {
    const input = Number(item.input_tokens) || 0;
    const output = Number(item.output_tokens) || 0;
    const reasoning = Math.min(Number(item.reasoning_tokens) || 0, output);
    return input + output;
  }), 1);
  const costs = data.map((item) => Number(item.cost_usd)).filter((value) => Number.isFinite(value) && value >= 0);
  const maxCost = Math.max(...costs, 0);
  const slotWidth = plotWidth / data.length;
  const barWidth = Math.min(68, slotWidth * 0.56);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return <div className="token-chart-scroll">
    <svg className="token-usage-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Latest persisted stacked input, output, reasoning tokens, and cost by model">
      <text x="20" y={top + plotHeight / 2} className="token-axis-title" transform={`rotate(-90 20 ${top + plotHeight / 2})`}>Token count</text>
      {ticks.map((fraction) => {
        const y = top + plotHeight - fraction * plotHeight;
        const value = maxTokens * fraction;
        return <g key={fraction}>
          <line x1={left} y1={y} x2={width - right} y2={y} className="token-grid-line" />
          <text x={left - 10} y={y + 4} textAnchor="end" className="token-y-label">{Math.round(value).toLocaleString()}</text>
        </g>;
      })}
      <line x1={left} y1={top} x2={left} y2={top + plotHeight} className="token-axis-line" />
      <line x1={left} y1={top + plotHeight} x2={width - right} y2={top + plotHeight} className="token-axis-line" />
      {data.map((item, index) => {
        const input = Math.max(0, Number(item.input_tokens) || 0);
        const output = Math.max(0, Number(item.output_tokens) || 0);
        const reasoning = Math.min(Math.max(0, Number(item.reasoning_tokens) || 0), output);
        const visibleOutput = Math.max(0, output - reasoning);
        const segments = [
          { key: "input", label: "Input", value: input, className: "input" },
          { key: "output", label: "Output", value: visibleOutput, className: "output" },
          { key: "reasoning", label: "Reasoning", value: reasoning, className: "reasoning" },
        ];
        const totalStacked = segments.reduce((sum, segment) => sum + segment.value, 0);
        const modelLabel = approvedModelLabel(item.model_id || "unknown");
        const shortLabel = modelLabel.length > 22 ? modelLabel.slice(0, 20) + "…" : modelLabel;
        const x = left + index * slotWidth + (slotWidth - barWidth) / 2;
        const cost = Number(item.cost_usd);
        const hasCost = Number.isFinite(cost) && cost >= 0;
        const costY = hasCost ? top + plotHeight - (maxCost > 0 ? (cost / maxCost) * plotHeight : 0) : null;
        let accumulated = 0;
        return <g key={item.model_id || item.interaction_id}>
          {segments.map((segment) => {
            const segmentHeight = totalStacked > 0 ? (segment.value / maxTokens) * plotHeight : 0;
            const y = top + plotHeight - accumulated - segmentHeight;
            accumulated += segmentHeight;
            return <g key={segment.key}>
              <rect x={x} y={y} width={barWidth} height={Math.max(segmentHeight, segment.value > 0 ? 2 : 0)} className={`telemetry-token-bar ${segment.className}`}>
                <title>{`${modelLabel} · ${segment.label}: ${segment.value.toLocaleString()} tokens`}</title>
              </rect>
            </g>;
          })}
          {hasCost && <circle cx={x + barWidth / 2} cy={costY} r="6" className="comparison-cost-dot"><title>{`${modelLabel} cost: $${cost.toFixed(6)}`}</title></circle>}
          <text x={x + barWidth / 2} y={Math.max(18, top + plotHeight - accumulated - 8)} textAnchor="middle" className="token-bar-value">{totalStacked.toLocaleString()}</text>
          <text x={x + barWidth / 2} y={top + plotHeight + 18} textAnchor="middle" className="token-x-label">{shortLabel}</text>
          <text x={x + barWidth / 2} y={top + plotHeight + 34} textAnchor="middle" className="token-path-label">Total {telemetryValue(item.total_tokens)}</text>
          <text x={x + barWidth / 2} y={top + plotHeight + 50} textAnchor="middle" className="token-path-label">{telemetryValue(item.latency_ms, " ms")}</text>
        </g>;
      })}
      <text x={left + plotWidth / 2} y={height - 8} textAnchor="middle" className="token-x-axis-title">Models · stacked token breakdown · latency</text>
    </svg>
    <div className="comparison-chart-legend">
      <span><i className="comparison-bar-key telemetry-input"/>Input</span>
      <span><i className="comparison-bar-key telemetry-output"/>Output (non-reasoning)</span>
      <span><i className="comparison-bar-key telemetry-reasoning"/>Reasoning</span>
      <span><i className="comparison-cost-dot-key"/>Cost</span>
      <span className="section-note">Source: persisted database telemetry.</span>
    </div>
  </div>;
}

function BenchmarkEvaluatorBox({ evaluation, evaluating, error }) {
  const verdict = evaluation?.verdict || "";
  const stateClass = verdict ? " " + verdict.toLowerCase() : "";
  return <section className={"t2-evaluator-box" + stateClass} aria-label="Governance benchmark evaluator">
    <div className="t2-evaluator-head">
      <div><strong>Governance benchmark evaluator</strong><span>Governance + read-only dataset verification · evaluator cannot modify the benchmark</span></div>
      <span className="t2-evaluator-verdict">{evaluating ? "Evaluating…" : verdict || "Awaiting run"}</span>
    </div>
    {error && <div className="t2-evaluator-reason">{error}</div>}
    {!evaluation && !error && !evaluating && <div className="t2-evaluator-empty">Complete a T2 response to evaluate its governance behavior.</div>}
    {evaluation && <>
      <div className="t2-evaluator-reason"><strong>Reason</strong><span>{evaluation.reason}</span></div>
      <div className="t2-evaluator-metrics" aria-label="Evaluator run metrics">
        <div><span>Overall score</span><strong>{Number(evaluation.score).toFixed(1)}</strong></div>
        <div><span>Accuracy</span><strong>{Number(evaluation.accuracy).toFixed(1)}</strong></div>
        <div><span>Boundary handling</span><strong>{Number(evaluation.content_quality).toFixed(1)}</strong></div>
        <div><span>Context alignment</span><strong>{Number(evaluation.context_alignment).toFixed(1)}</strong></div>
        <div><span>Governance constraints</span><strong>{Number(evaluation.instruction_fulfillment).toFixed(1)}</strong></div>
        <div><span>Factual grounding</span><strong>{Number(evaluation.factual_grounding).toFixed(1)}</strong></div>
        <div><span>Unsupported claims</span><strong>{Number(evaluation.unsupported_claims || 0)}</strong></div>
        <div><span>Contradictions</span><strong>{Number(evaluation.contradictions || 0)}</strong></div>
        <div><span>Evaluator latency</span><strong>{Number(evaluation.evaluator_latency_ms || 0).toLocaleString()} ms</strong></div>
        <div className="t2-evaluator-model"><span>Evaluator model</span><strong>{evaluation.evaluator_model_id || "Mistral Small 4"}</strong></div>
      </div>
    </>}
  </section>;
}

function MedicalVisualizationWorkspace({ botKey, onRequest, disabled, hasCharts }) {
  const financial = botKey === "t2_financial";
  const logistics = botKey === "t2_logistics";
  const requests = financial ? [
    ["Loan status", "Create a chart of loan applications by loan status using the authorized financial dataset."],
    ["Risk tolerance", "Create a chart of customers by risk tolerance using the authorized financial dataset."],
    ["Build dashboard", "Analyze the authorized financial dataset and build the bounded finance dashboard with loan-status and risk-tolerance charts."],
  ] : logistics ? [
    ["Shipment status", "Create a chart of shipments by status using the authorized logistics dataset."],
    ["Carrier volume", "Create a chart of shipments by carrier using the authorized logistics dataset."],
    ["Retail ship modes", "Create a chart of retail orders by ship mode using the authorized retail dataset."],
    ["Build dashboard", "Analyze the authorized logistics and retail datasets and build the bounded logistics dashboard with shipment-status, carrier-volume, and retail fulfillment charts."],
  ] : [
    ["Patient volume", "Create a chart of patient encounter volume by department referral using the authorized medical dataset."],
    ["Wait times", "Create a chart of average patient wait time by department referral using the authorized medical dataset."],
    ["Satisfaction", "Create a chart of average patient satisfaction by department referral using the authorized medical dataset."],
    ["Build dashboard", "Analyze the authorized medical dataset and build the bounded healthcare operations dashboard with encounter volume, wait-time, and satisfaction charts."],
  ];
  return <section className="medical-visual-workspace" aria-label="Data visualization workspace">
    <div className="medical-visual-head">
      <div>
        <strong>{financial ? "Financial data visualization" : logistics ? "Logistics data visualization" : "Medical data visualization"}</strong>
        <span>{financial ? "Read-only financial dataset · MCP-bounded aggregates · arithmetic verified" : logistics ? "Read-only logistics + retail datasets · MCP-bounded aggregates · arithmetic verified" : "Read-only medical dataset · MCP-bounded aggregates · arithmetic verified"}</span>
      </div>
      <span className="medical-data-access">Read access</span>
    </div>
    <div className="medical-visual-actions">
      {requests.map(([label, prompt]) => <button className={label === "Build dashboard" ? "primary" : "ghost"} key={label} disabled={disabled} onClick={() => onRequest(prompt)}>{label}</button>)}
    </div>
    <div className="medical-visual-status">{hasCharts ? "Verified charts generated from the latest bounded data run." : "Choose a bounded visualization to generate verified charts from the authorized dataset."}</div>
  </section>;
}

function MedicalDataVerification({ botKey, verification }) {
  if (!verification) return null;
  const arithmeticResults = Array.isArray(verification?.arithmetic?.results) ? verification.arithmetic.results : [];
  const arithmeticNames = botKey === "t2_financial"
    ? ["Loan-status totals reconcile", "Risk-tolerance totals reconcile"]
    : ["Encounter totals reconcile", "Wait-time weighted average reconciles", "Satisfaction weighted average reconciles"];
  const checks = [
    ...arithmeticResults.map((item, index) => ({
      name: arithmeticNames[index] || "Bounded arithmetic check",
      passed: Boolean(item.passed),
    })),
    ...(Array.isArray(verification.checks) ? verification.checks : []),
  ];
  const passed = verification.status === "passed";
  return <section className={"medical-verification " + (passed ? "passed" : "failed")} aria-label="Medical data verification">
    <div className="medical-verification-head">
      <div><strong>{botKey === "t2_financial" ? "Financial database verification" : botKey === "t2_logistics" ? "Logistics and retail database verification" : "Database verification"}</strong><span>Read-only source reconciliation</span></div>
      <span className="medical-verification-status">{passed ? "Verified" : "Failed"}</span>
    </div>
    <div className="medical-verification-checks">{checks.map((check, index) =>
      <div className="medical-verification-check" key={check.name || index}>
        <span aria-hidden="true">{check.passed ? "✓" : "×"}</span>
        <div>{check.name}</div>
      </div>
    )}</div>
  </section>;
}

function MedicalAnalysisCharts({ botKey, charts }) {
  if (!Array.isArray(charts) || !charts.length) return null;
  return <section className="medical-analysis-charts" aria-label="Medical analyst charts">
    <div className="t2-telemetry-head">
      <strong>{botKey === "t2_financial" ? "Financial analysis charts" : botKey === "t2_logistics" ? "Logistics and retail analysis charts" : "Healthcare operations charts"}</strong>
      <span>Bounded read-only aggregates</span>
    </div>
    <div className="medical-chart-grid">{charts.map((chart) => {
      const points = Array.isArray(chart.points) ? chart.points.filter((point) => Number.isFinite(Number(point.value))) : [];
      const maximum = Math.max(...points.map((point) => Number(point.value)), 1);
      return <div className="medical-chart-card" key={chart.id || chart.title}>
        <div className="medical-chart-title">{chart.title}</div>
        <div className="medical-bar-chart">{points.map((point, index) => {
          const value = Number(point.value);
          const width = Math.max(1, (value / maximum) * 100);
          return <div className="medical-bar-row" key={String(point.label) + index}>
            <span className="medical-bar-label" title={point.label}>{point.label}</span>
            <div className="medical-bar-track"><div className="medical-bar-fill" style={{ width: width + "%" }} /></div>
            <strong>{value.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong>
          </div>;
        })}</div>
        <div className="medical-chart-axis">{chart.metric}</div>
      </div>;
    })}</div>
  </section>;
}

function ModelTelemetry({ modelKey, latest, history, latestByModel, error }) {
  const modelRuns = Object.values(latestByModel || {}).filter((item) => !/gemini|gpt-5\.6-luna|gpt_5_6_luna/i.test(String(item.model_id || ""))).sort((left, right) => String(right.created_at || "").localeCompare(String(left.created_at || "")));
  const currentModel = latest || modelRuns[0] || null;
  return <section className="t2-model-telemetry" aria-label="Model run telemetry">
    <div className="t2-telemetry-head">
      <strong>Model run telemetry</strong>
      <span>Latest persisted runs · t2.agent_interactions</span>
    </div>
    {error && <div className="t2-telemetry-empty">{error}</div>}
    {currentModel && <div className="t2-telemetry-summary">
      <div className="t2-telemetry-metric"><span>Selected model</span><strong>{approvedModelLabel(currentModel.model_id || modelKey)}</strong></div>
      <div className="t2-telemetry-metric"><span>Latency</span><strong>{telemetryValue(currentModel.latency_ms, " ms")}</strong></div>
      <div className="t2-telemetry-metric"><span>Total tokens</span><strong>{telemetryValue(currentModel.total_tokens)}</strong></div>
      <div className="t2-telemetry-metric"><span>Cost</span><strong>{telemetryCost(currentModel.cost_usd)}</strong></div>
    </div>}
    {modelRuns.length > 0 && <div className="t2-telemetry-model-list" aria-label="Latest run from each model">
      <div className="t2-telemetry-list-title">Latest run from each model</div>
      {modelRuns.map((item) => <div className="t2-telemetry-model-row" key={item.model_id || item.interaction_id}>
        <strong>{approvedModelLabel(item.model_id || "unknown")}</strong>
        <span>{telemetryValue(item.latency_ms, " ms")}</span>
        <span>{telemetryValue(item.total_tokens)} tokens</span>
        <span>{telemetryCost(item.cost_usd)}</span>
        <small>in {telemetryValue(item.input_tokens)} · out {telemetryValue(item.output_tokens)} · reasoning {telemetryValue(item.reasoning_tokens)}</small>
      </div>)}
    </div>}
    {currentModel && <div className="t2-telemetry-grid">
      <div className="t2-telemetry-panel">
        <div className="t2-telemetry-panel-title">Latest model comparison</div>
        {history.length > 0 || modelRuns.length > 0 ? <><TelemetryModelChart runs={modelRuns} /><div className="t2-telemetry-history">{(history.length ? history : modelRuns).slice(-8).map((item) => <div className="t2-telemetry-history-row" key={item.interaction_id}><span>{approvedModelLabel(item.model_id || modelKey)}</span><strong>{telemetryValue(item.latency_ms, " ms")}</strong></div>)}</div></> : <div className="t2-telemetry-empty">No persisted model telemetry yet.</div>}
      </div>
    </div>}
    {!currentModel && !error && <div className="t2-telemetry-empty">No persisted model telemetry yet. Complete a model run to populate this panel.</div>}
  </section>;
}


const DOMESTIC_MAJOR_AIRPORTS = Object.freeze([
  ["ATL", "Atlanta — Hartsfield-Jackson"],
  ["AUS", "Austin — Austin-Bergstrom"],
  ["BNA", "Nashville — Nashville International"],
  ["BOS", "Boston — Logan International"],
  ["BWI", "Baltimore/Washington — BWI"],
  ["CLE", "Cleveland — Hopkins International"],
  ["CLT", "Charlotte — Douglas International"],
  ["CVG", "Cincinnati — Northern Kentucky"],
  ["DCA", "Washington, DC — Reagan National"],
  ["DEN", "Denver — International"],
  ["DFW", "Dallas/Fort Worth — International"],
  ["DTW", "Detroit — Metropolitan"],
  ["EWR", "Newark — Liberty International"],
  ["FLL", "Fort Lauderdale — Hollywood International"],
  ["HNL", "Honolulu — Daniel K. Inouye International"],
  ["HOU", "Houston — Hobby"],
  ["IAD", "Washington, DC — Dulles International"],
  ["IAH", "Houston — George Bush Intercontinental"],
  ["IND", "Indianapolis — International"],
  ["JFK", "New York — John F. Kennedy International"],
  ["LAS", "Las Vegas — Harry Reid International"],
  ["LAX", "Los Angeles — International"],
  ["LGA", "New York — LaGuardia"],
  ["MCI", "Kansas City — International"],
  ["MCO", "Orlando — International"],
  ["MDW", "Chicago — Midway"],
  ["MEM", "Memphis — International"],
  ["MIA", "Miami — International"],
  ["MKE", "Milwaukee — Mitchell International"],
  ["MSP", "Minneapolis/St. Paul — International"],
  ["MSY", "New Orleans — Louis Armstrong International"],
  ["OAK", "Oakland — International"],
  ["ORD", "Chicago — O'Hare International"],
  ["PDX", "Portland — International"],
  ["PHL", "Philadelphia — International"],
  ["PHX", "Phoenix — Sky Harbor International"],
  ["PIT", "Pittsburgh — International"],
  ["RDU", "Raleigh-Durham — International"],
  ["SAN", "San Diego — International"],
  ["SEA", "Seattle — Tacoma International"],
  ["SFO", "San Francisco — International"],
  ["SJC", "San Jose — International"],
  ["SLC", "Salt Lake City — International"],
  ["SMF", "Sacramento — International"],
  ["STL", "St. Louis — Lambert International"],
  ["TPA", "Tampa — International"],
]);

function normalizedAirportText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function flightSearchLocation(value) {
  const cleaned = String(value || "").trim();
  if (/^[A-Za-z]{3}$/.test(cleaned)) return cleaned.toUpperCase();
  const normalized = normalizedAirportText(cleaned);
  const matches = DOMESTIC_MAJOR_AIRPORTS.filter(([_code, label]) => {
    const city = normalizedAirportText(label.split("—")[0]);
    return normalized === city || normalized.startsWith(city + " ") || city.startsWith(normalized + " ");
  });
  if (!matches.length) return cleaned;
  return cleaned + " (" + matches.map(([code]) => code).join(",") + ")";
}

function isoDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

const AVIA_DATE_CONFIRMATION_PROMPT = "Can you please confirm the departure date and return date, whether this is one way or round trip, and whether non-stop is preferred?";

function inferredFlightDate(prompt) {
  const isoMatch = String(prompt).match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return isoMatch[0];

  const monthMatch = String(prompt).match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:,?\s+(20\d{2}))?\b/i);
  if (!monthMatch) return "";
  const parsed = new Date(monthMatch[1] + " " + monthMatch[2] + ", " + (monthMatch[3] || new Date().getFullYear()) + " 12:00:00");
  if (Number.isNaN(parsed.getTime())) return "";
  if (!monthMatch[3]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsed < today) parsed.setFullYear(parsed.getFullYear() + 1);
  }
  return isoDateLocal(parsed);
}

function cleanRoutePoint(value, destination = false) {
  let cleaned = String(value || "").trim();
  if (destination) {
    cleaned = cleaned.replace(
      /\s+(?:one[ -]?way|round[ -]?trip|non[ -]?stop|direct|adult|adults|passenger|passengers|economy|premium[ -]?economy|business|first(?: class)?|departing|leaving|on|for|January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b[\s\S]*$/i,
      "",
    );
  }
  return cleaned.replace(/^[,;:\s]+|[,;:.!?\s]+$/g, "").replace(/\s+area$/i, "").trim();
}

function inferredFlightRoute(prompt) {
  const normalized = String(prompt).replace(/\s+/g, " ").trim();
  const fromMatch = normalized.match(/\bfrom\s+(.+?)\s+to\s+(.+)$/i);
  if (fromMatch) {
    return {
      origin: cleanRoutePoint(fromMatch[1]),
      destination: cleanRoutePoint(fromMatch[2], true),
    };
  }
  const withoutRequest = normalized.replace(/^.*?\b(?:flight|flights|fare|fares|ticket|tickets)\b[,:]?\s*/i, "");
  const cityPair = withoutRequest.match(/^(.+?)\s+to\s+(.+)$/i);
  return {
    origin: cleanRoutePoint(cityPair?.[1]),
    destination: cleanRoutePoint(cityPair?.[2], true),
  };
}

function inferredCabin(prompt) {
  const normalized = String(prompt).toLowerCase();
  if (/\bpremium[ -]?economy\b/.test(normalized)) return "premium_economy";
  if (/\bbusiness(?: class)?\b/.test(normalized)) return "business";
  if (/\bfirst(?: class)?\b/.test(normalized)) return "first";
  if (/\beconomy(?: class)?\b/.test(normalized)) return "economy";
  return "economy";
}

const AVIA_CABIN_LABELS = Object.freeze({
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First",
});

function createAviaDraft(prompt) {
  const route = inferredFlightRoute(prompt);
  const roundTrip = /\b(round[ -]?trip|return(?:ing)?|coming back)\b/i.test(prompt);
  return {
    sourcePrompt: prompt,
    origin: route.origin,
    destination: route.destination,
    departDate: inferredFlightDate(prompt),
    returnDate: "",
    tripType: roundTrip ? "round_trip" : /\b(one[ -]?way)\b/i.test(prompt) ? "one_way" : "",
    nonstop: /\b(non[ -]?stop|direct flight)\b/i.test(prompt),
    cabin: inferredCabin(prompt),
  };
}

function isFlightLookupRequest(prompt) {
  const text = String(prompt || "").trim();
  // Item-transport questions must reach Avia's TSA referral before itinerary collection.
  const itemTransportRequest = /\b(?:weapons?|knives|knife|guns?|firearms?|handguns?|pistols?|rifles?|shotguns?|pew[\s-]*pews?|brass[\s-]+knuckles?|razors?|razor[\s-]+blades?|scissors|ammunition|ammo|bullets?|box[\s-]+cutters?|switchblades?|tasers?|stun[\s-]+guns?)\b/i.test(text);
  if (itemTransportRequest) return false;
  const flightRequest = /\b(flight|flights|fare|fares|fly|ticket|tickets)\b/i.test(text) && /\b(from|to|depart|leav|return)\w*\b/i.test(text);
  const calendarRequest = /\b(calendar|date picker|travel dates|departure date|return date)\b/i.test(text);
  const route = inferredFlightRoute(text);
  const routeRequest = Boolean(route.origin && route.destination) && !/[?]/.test(text);
  return flightRequest || calendarRequest || routeRequest;
}

function AviaCalendar({ departDate, returnDate, target, onSelect }) {
  const initialDate = departDate ? new Date(departDate + "T12:00:00") : new Date();
  const [monthDate, setMonthDate] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  useEffect(() => {
    if (!departDate) return;
    const next = new Date(departDate + "T12:00:00");
    setMonthDate(new Date(next.getFullYear(), next.getMonth(), 1));
  }, [departDate]);

  const monthLabel = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1 - firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });

  return <div className="avia-calendar" aria-label="Avia schedule calendar">
    <div className="avia-calendar-head">
      <button type="button" className="ghost small-button" aria-label="Previous month" onClick={() => setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>←</button>
      <strong>{monthLabel}</strong>
      <button type="button" className="ghost small-button" aria-label="Next month" onClick={() => setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>→</button>
    </div>
    <div className="avia-calendar-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="avia-calendar-grid">
      {days.map((day) => {
        const key = isoDateLocal(day);
        const inMonth = day.getMonth() === monthDate.getMonth();
        const selectedDepart = key === departDate;
        const selectedReturn = key === returnDate;
        const inRange = departDate && returnDate && key > departDate && key < returnDate;
        return <button type="button" key={key} onClick={() => onSelect(key)} className={"avia-calendar-day" + (inMonth ? "" : " outside") + (selectedDepart ? " depart" : "") + (selectedReturn ? " return" : "") + (inRange ? " in-range" : "")} aria-label={key + (selectedDepart ? " departure" : selectedReturn ? " return" : "")}>{day.getDate()}</button>;
      })}
    </div>
    <div className="avia-calendar-legend"><span><i className="depart-dot" />Depart</span><span><i className="return-dot" />Return</span><span>Selecting: {target === "return" ? "return date" : "departure date"}</span></div>
  </div>;
}

function AviaDateConfirmation({ draft, calendarTarget, onTargetChange, onChange, onConfirm, onReject, disabled }) {
  const complete = Boolean(draft.origin && draft.destination && draft.departDate && draft.tripType && (draft.tripType === "one_way" || draft.returnDate));
  return <section className="avia-confirmation" aria-label="Confirm Avia travel dates">
    <div className="eyebrow">Flight date confirmation</div>
    <h3>{AVIA_DATE_CONFIRMATION_PROMPT}</h3>
    <div className="avia-route-grid">
      <label>From<input value={draft.origin} onChange={(event) => onChange({ origin: event.target.value })} placeholder="Airport or city" /></label>
      <label>To<input value={draft.destination} onChange={(event) => onChange({ destination: event.target.value })} placeholder="Airport or city" /></label>
    </div>
    <div className="avia-choice-row" role="group" aria-label="Trip type">
      <button type="button" className={draft.tripType === "one_way" ? "primary" : "ghost"} onClick={() => onChange({ tripType: "one_way", returnDate: "" })}>One way</button>
      <button type="button" className={draft.tripType === "round_trip" ? "primary" : "ghost"} onClick={() => { onChange({ tripType: "round_trip" }); onTargetChange("return"); }}>Round trip</button>
      <label className="avia-nonstop"><input type="checkbox" checked={draft.nonstop} onChange={(event) => onChange({ nonstop: event.target.checked })} /> Non-stop preferred</label>
      <label className="avia-cabin">Cabin class
        <select value={draft.cabin} onChange={(event) => onChange({ cabin: event.target.value })} aria-label="Cabin class">
          {Object.entries(AVIA_CABIN_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    <div className="avia-date-fields">
      <label className={calendarTarget === "depart" ? "active" : ""}>Departure
        <input type="date" value={draft.departDate} onFocus={() => onTargetChange("depart")} onChange={(event) => onChange({ departDate: event.target.value })} />
      </label>
      {draft.tripType === "round_trip" && <label className={calendarTarget === "return" ? "active" : ""}>Return
        <input type="date" min={draft.departDate || undefined} value={draft.returnDate} onFocus={() => onTargetChange("return")} onChange={(event) => onChange({ returnDate: event.target.value })} />
      </label>}
    </div>
    <AviaCalendar departDate={draft.departDate} returnDate={draft.returnDate} target={calendarTarget} onSelect={(date) => onChange(calendarTarget === "return" && draft.tripType === "round_trip" ? { returnDate: date } : { departDate: date })} />
    <div className="avia-confirm-actions">
      <button type="button" className="ghost" onClick={onReject} disabled={disabled}>No, revise</button>
      <button type="button" className="primary" onClick={onConfirm} disabled={disabled || !complete}>Yes, confirm dates</button>
    </div>
  </section>;
}

function AviaBookingOffer({ onAccept, onDecline }) {
  return <section className="avia-booking-offer" aria-label="Avia booking offer">
    <div><strong>Continue to booking?</strong><span>Avia will open the secure-payment handoff demonstration. No payment information is collected.</span></div>
    <div className="button-row"><button type="button" className="ghost" onClick={onDecline}>No</button><button type="button" className="primary" onClick={onAccept}>Yes, continue</button></div>
  </section>;
}

function AviaPaymentHandoff({ onBack }) {
  return <main className="avia-payment-page" aria-label="Avia secure payment handoff demonstration">
    <section className="avia-payment-card">
      <div className="eyebrow">Secure payment handoff demonstration</div>
      <h2>Thank you for testing Avia the Aviation Customer Service Agent.</h2>
      <p>If this were a customer service facing agent the link would be sent to a secure payment method where no AI would be used or have access to sensitive information.</p>
      <div className="avia-payment-boundary"><strong>No payment information is requested or processed on this page.</strong></div>
      <button type="button" className="ghost" onClick={onBack}>Return to Avia</button>
    </section>
  </main>;
}


export default function T2BotChat({ botKey }) {
  const bot = T2_BOT_DEFINITIONS[botKey] || T2_BOT_DEFINITIONS.t2_execution;
  const [models, setModels] = useState([]);
  const [modelKey, setModelKey] = useState("");
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState(() => initialHistory(bot));
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState("unverified");
  const [editorLanguage, setEditorLanguage] = useState("python");
  const [editorCode, setEditorCode] = useState(CODE_EDITOR_LANGUAGES.python.starter);
  const [editorRevision, setEditorRevision] = useState(null);
  const [editorTrace, setEditorTrace] = useState(["Ready. Waiting for an instruction."]);
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [latestByModel, setLatestByModel] = useState({});
  const [telemetryError, setTelemetryError] = useState("");
  const [medicalCharts, setMedicalCharts] = useState([]);
  const [medicalVerification, setMedicalVerification] = useState(null);
  const [benchmarkEvaluation, setBenchmarkEvaluation] = useState(null);
  const [benchmarkEvaluating, setBenchmarkEvaluating] = useState(false);
  const [benchmarkEvaluationError, setBenchmarkEvaluationError] = useState("");
  const [aviaDraft, setAviaDraft] = useState(null);
  const [aviaCalendarTarget, setAviaCalendarTarget] = useState("depart");
  const [aviaBookingOffer, setAviaBookingOffer] = useState(false);
  const [aviaPaymentScreen, setAviaPaymentScreen] = useState(() => typeof window !== "undefined" && new URL(window.location.href).searchParams.get("avia") === "payment");

  useEffect(() => {
    function syncAviaPage() {
      setAviaPaymentScreen(new URL(window.location.href).searchParams.get("avia") === "payment");
    }
    window.addEventListener("popstate", syncAviaPage);
    return () => window.removeEventListener("popstate", syncAviaPage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    t2Request("/api/v1/config").then((payload) => {
      if (cancelled) return;
      const available = Array.isArray(payload?.models) ? payload.models.map(modelKeyFromValue).filter(Boolean) : [];
      setModels(available);
      setModelKey((current) => current || available[0] || "gpt_5_5");
      setBackendStatus("connected");
    }).catch(() => {
      if (!cancelled) {
        setModelKey((current) => current || "gpt_5_5");
        setBackendStatus("unavailable");
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setSession(null);
    setHistory(initialHistory(bot));
    setMessage("");
    setError("");
    setTelemetry(null);
    setTelemetryHistory([]);
    setLatestByModel({});
    setTelemetryError("");
    setMedicalCharts([]);
    setMedicalVerification(null);
    setBenchmarkEvaluation(null);
    setBenchmarkEvaluating(false);
    setBenchmarkEvaluationError("");
    setAviaDraft(null);
    setAviaCalendarTarget("depart");
    setAviaBookingOffer(false);
    if (botKey !== "t2_aviation") setAviaPaymentScreen(false);
    if (botKey === "t2_aviation") setModelKey(AVIA_MODEL_KEY);
    if (botKey === "t2_coding" || botKey === "t2_medical" || botKey === "t2_financial" || botKey === "t2_logistics" || botKey === "t2_aviation") refreshTelemetry();
  }, [botKey]);

  const modelOptions = useMemo(() => {
    const available = models.length ? models : [modelKey || "ling"];
    return available.filter((key) => key !== "granite_4_2_8b" && (botKey !== "t2_coding" || key !== "gpt_5_6_luna"));
  }, [models, modelKey, botKey]);

  useEffect(() => {
    if (botKey === "t2_coding" && modelKey === "gpt_5_6_luna" && modelOptions.length) {
      setModelKey(modelOptions[0]);
      setSession(null);
    }
  }, [botKey, modelKey, modelOptions]);

  async function refreshTelemetry(sessionId) {
    if (!sessionId && botKey !== "t2_coding" && botKey !== "t2_medical" && botKey !== "t2_financial" && botKey !== "t2_logistics" && botKey !== "t2_aviation") {
      setTelemetry(null);
      setTelemetryHistory([]);
      setLatestByModel({});
      setTelemetryError("");
      return;
    }
    try {
      const telemetryPath = sessionId
        ? "/api/v1/sessions/" + sessionId + "/telemetry"
        : botKey === "t2_medical"
          ? "/api/v1/telemetry/latest/medical"
          : botKey === "t2_financial"
            ? "/api/v1/telemetry/latest/financial"
            : botKey === "t2_logistics"
              ? "/api/v1/telemetry/latest/logistics"
            : botKey === "t2_aviation"
              ? "/api/v1/telemetry/latest/avia"
              : "/api/v1/telemetry/latest";
      const payload = await t2Request(telemetryPath);
      setTelemetry(payload?.latest || null);
      setTelemetryHistory(Array.isArray(payload?.items) ? payload.items : []);
      setLatestByModel(payload?.latest_by_model && typeof payload.latest_by_model === "object" ? payload.latest_by_model : {});
      setTelemetryError("");
    } catch (error) {
      setTelemetryError(error?.message || "Database telemetry is unavailable.");
    }
  }

  function resetEditorTrace() {
    setEditorTrace(["Starting runtime logic trace."]);
  }

  function appendEditorTrace(message) {
    if (message) setEditorTrace((current) => [...current, message]);
  }

  async function createSession() {
    const body = { domain: bot.domain, model_key: botKey === "t2_aviation" ? AVIA_MODEL_KEY : modelKey || "gpt_5_5", path: "Gov", scenario_id: "t2-" + bot.key + "-" + Date.now(), function_key: bot.functionKey, workload: "agentic", system_id: bot.systemId };
    const created = await t2Request("/api/v1/sessions", { method: "POST", body });
    setSession(created);
    await refreshTelemetry(created.session_id);
    return created;
  }


  async function evaluateBenchmark(sessionId, prompt, response) {
    if (!sessionId || !prompt?.trim() || !response?.trim()) return;
    setBenchmarkEvaluating(true);
    setBenchmarkEvaluation(null);
    setBenchmarkEvaluationError("");
    try {
      const evaluatorKey = {
        t2_coding: "coding", t2_medical: "medical", t2_financial: "financial",
        t2_logistics: "logistics", t2_aviation: "avia",
      }[botKey];
      if (!evaluatorKey) throw new Error("No evaluator endpoint is configured for this agent.");
      const evaluation = await t2Request("/api/v1/evaluators/" + evaluatorKey + "/sessions/" + sessionId + "/evaluate", {
        method: "POST",
        body: { prompt, response },
      });
      setBenchmarkEvaluation(evaluation);
    } catch (error) {
      setBenchmarkEvaluationError(error?.message || "The governed evaluator did not complete.");
    } finally {
      setBenchmarkEvaluating(false);
    }
  }


  async function changeModel(nextModel) {
    if (!nextModel || nextModel === modelKey) return;
    if (session?.session_id) {
      try { await t2Request("/api/v1/sessions/" + session.session_id + "/reset", { method: "POST" }); } catch { /* the next request still creates a fresh binding */ }
    }
    setSession(null);
    setModelKey(nextModel);
    setHistory((items) => [...items, { role: "assistant", content: "Model changed to " + approvedModelLabel(nextModel) + ". A new " + bot.label + " session will use that approved model." }]);
  }

  async function generateCode({ prompt, language, currentCode, onTrace }) {
    setError("");
    let streamedCode = "";
    let terminalEvent = null;
    setHistory((items) => [...items, { role: "user", content: "[Code editor · " + language + "] " + prompt }]);
    try {
      const activeSession = session || await createSession();
      await t2StreamRequest("/api/v1/sessions/" + activeSession.session_id + "/coding/stream", {
        method: "POST",
        body: { prompt, current_code: currentCode, language },
      }, (eventName, payload) => {
        if (eventName === "start") onTrace?.("Coding stream connected.");
        if (eventName === "trace" && payload.message) onTrace?.(payload.message);
        if (eventName === "code") streamedCode += payload.delta || "";
        if (eventName === "complete" || eventName === "redirect" || eventName === "reset" || eventName === "error") terminalEvent = { eventName, ...payload };
      });
      await refreshTelemetry(activeSession.session_id);
      if (terminalEvent?.eventName === "complete") {
        const code = terminalEvent.code || streamedCode;
        setHistory((items) => [...items, { role: "assistant", content: "Generated a " + language + " revision in the editor." }]);
        await evaluateBenchmark(activeSession.session_id, prompt, code);
        return { code };
      }
      if (terminalEvent?.eventName === "redirect" || terminalEvent?.eventName === "reset") {
        if (terminalEvent.eventName === "reset") setSession(null);
        const message = terminalEvent.message || terminalEvent.redirect || "The coding request was redirected.";
        setHistory((items) => [...items, { role: "assistant", content: message }]);
        await evaluateBenchmark(activeSession.session_id, prompt, message);
        return { message };
      }
      if (terminalEvent?.eventName === "error") {
        throw new Error(terminalEvent.message || "The coding provider did not complete the request.");
      }
      throw new Error("The coding stream closed without a completed revision.");
    } catch (error) {
      setError(error?.message || "Coding agent request failed.");
      setHistory((items) => [...items, { role: "assistant", content: "The coding revision did not complete." }]);
      throw error;
    }
  }

  async function streamConversation({ prompt, onTrace }) {
    let streamedReply = "";
    let terminalEvent = null;
    setHistory((items) => [...items, { role: "user", content: prompt }]);
    try {
      const activeSession = session || await createSession();
      await t2StreamRequest("/api/v1/sessions/" + activeSession.session_id + "/chat/stream", {
        method: "POST",
        body: { message: prompt },
      }, (eventName, payload) => {
        if (eventName === "start") onTrace?.("Conversation stream connected.");
        if (eventName === "trace" && payload.message) onTrace?.(payload.message);
        if (eventName === "reply") streamedReply += payload.delta || "";
        if (eventName === "complete" || eventName === "redirect" || eventName === "reset" || eventName === "error") terminalEvent = { eventName, ...payload };
      });
      await refreshTelemetry(activeSession.session_id);
      if (terminalEvent?.eventName === "complete") {
        const reply = terminalEvent.reply || streamedReply;
        const editorCodeBlock = extractEditorCode(reply);
        if (editorCodeBlock) {
          setEditorLanguage(editorCodeBlock.language);
          setEditorCode(editorCodeBlock.code);
          setEditorRevision({ language: editorCodeBlock.language, code: editorCodeBlock.code });
        }
        const displayedReply = editorCodeBlock?.displayReply || reply;
        setHistory((items) => [...items, { role: "assistant", content: displayedReply }]);
        await evaluateBenchmark(activeSession.session_id, prompt, reply);
        return { reply: displayedReply };
      }
      if (terminalEvent?.eventName === "redirect" || terminalEvent?.eventName === "reset") {
        if (terminalEvent.eventName === "reset") setSession(null);
        const response = terminalEvent.message || terminalEvent.redirect || "The conversation request was redirected.";
        setHistory((items) => [...items, { role: "assistant", content: response }]);
        await evaluateBenchmark(activeSession.session_id, prompt, response);
        return { message: response };
      }
      if (terminalEvent?.eventName === "error") throw new Error(terminalEvent.message || "The conversation provider did not complete the response.");
      throw new Error("The conversation stream closed without a completed response.");
    } catch (error) {
      setError(error?.message || "Conversation request failed.");
      setHistory((items) => [...items, { role: "assistant", content: "The conversation did not complete." }]);
      throw error;
    }
  }

  async function confirmAviaDates() {
    if (!aviaDraft || sending) return;
    setSending(true);
    setError("");
    const tripDescription = aviaDraft.tripType === "round_trip"
      ? "round trip, departing " + aviaDraft.departDate + " and returning " + aviaDraft.returnDate
      : "one way, departing " + aviaDraft.departDate;
    const confirmedPrompt = "Search live flights from " + flightSearchLocation(aviaDraft.origin) + " to " + flightSearchLocation(aviaDraft.destination) + " for a " + tripDescription + ". Resolve each location to the appropriate IATA airport code or codes before calling travel.search. Cabin class: " + AVIA_CABIN_LABELS[aviaDraft.cabin] + ". " + (aviaDraft.nonstop ? "Non-stop flights are preferred." : "Non-stop is not required.");
    setHistory((items) => [...items, { role: "user", content: "Yes — " + confirmedPrompt }]);
    try {
      const activeSession = session || await createSession();
      const result = await t2Request("/api/v1/sessions/" + activeSession.session_id + "/turns", { method: "POST", body: { message: confirmedPrompt } });
      await refreshTelemetry(activeSession.session_id);
      const responseText = resultText(result);
      setHistory((items) => [...items, { role: "assistant", content: responseText }]);
      await evaluateBenchmark(activeSession.session_id, confirmedPrompt, responseText);
      setAviaDraft(null);
      setAviaBookingOffer(result.status !== "auto_reset" && result.status !== "refused");
      if (result.status === "auto_reset") setSession(null);
    } catch (err) {
      setError(err?.message || "Avia could not complete the confirmed flight search.");
      setHistory((items) => [...items, { role: "assistant", content: "The confirmed flight search did not complete." }]);
    } finally {
      setSending(false);
    }
  }

  function rejectAviaDates() {
    setHistory((items) => [...items, { role: "user", content: "No — I need to revise the trip details." }, { role: "assistant", content: AVIA_DATE_CONFIRMATION_PROMPT }]);
    setAviaCalendarTarget("depart");
  }

  function openAviaPaymentScreen() {
    const url = new URL(window.location.href);
    url.searchParams.set("avia", "payment");
    window.history.pushState({ avia: "payment" }, "", url);
    setAviaBookingOffer(false);
    setAviaPaymentScreen(true);
  }

  function closeAviaPaymentScreen() {
    const url = new URL(window.location.href);
    url.searchParams.delete("avia");
    window.history.pushState({}, "", url);
    setAviaPaymentScreen(false);
  }

  async function send(inputOverride) {
    const current = (typeof inputOverride === "string" ? inputOverride : message).trim();
    if (!current || sending) return;
    setSending(true);
    setError("");
    setMessage("");
    try {
      if (botKey === "t2_aviation" && isFlightLookupRequest(current)) {
        const draft = createAviaDraft(current);
        setHistory((items) => [...items, { role: "user", content: current }, { role: "assistant", content: AVIA_DATE_CONFIRMATION_PROMPT }]);
        setAviaDraft(draft);
        setAviaCalendarTarget("depart");
        setAviaBookingOffer(false);
        return;
      }
      if (botKey === "t2_coding") {
        resetEditorTrace();
        if (looksLikeCodeRequest(current)) {
          const result = await generateCode({ prompt: current, language: editorLanguage, currentCode: editorCode, onTrace: appendEditorTrace });
          if (result?.code) setEditorRevision({ language: editorLanguage, code: result.code });
        } else {
          await streamConversation({ prompt: current, onTrace: appendEditorTrace });
        }
        return;
      }
      setHistory((items) => [...items, { role: "user", content: current }]);
      const activeSession = session || await createSession();
      const result = await t2Request("/api/v1/sessions/" + activeSession.session_id + "/turns", { method: "POST", body: { message: current } });
      await refreshTelemetry(activeSession.session_id);
      const responseText = resultText(result);
      setHistory((items) => [...items, { role: "assistant", content: responseText }]);
      await evaluateBenchmark(activeSession.session_id, current, responseText);
      if (botKey === "t2_medical" || botKey === "t2_financial" || botKey === "t2_logistics") {
        setMedicalCharts(Array.isArray(result?.charts) ? result.charts : []);
        setMedicalVerification(result?.verification || null);
      }
      if (result.status === "auto_reset") setSession(null);
    } catch (err) {
      setError(err?.message || "Agent Benchmark backend request failed.");
      if (botKey !== "t2_coding") setHistory((items) => [...items, { role: "assistant", content: "The agent request did not complete." }]);
    } finally {
      setSending(false);
    }
  }

  async function resetChat() {
    if (session?.session_id) {
      try { await t2Request("/api/v1/sessions/" + session.session_id + "/reset", { method: "POST" }); } catch { /* local reset still clears the interface */ }
    }
    setSession(null);
    setHistory([{ role: "assistant", content: "Conversation reset. " + bot.label + " is ready for a new benchmark pass." }]);
    setError("");
    setTelemetry(null);
    setTelemetryHistory([]);
    setLatestByModel({});
    setTelemetryError("");
    setMedicalCharts([]);
    setMedicalVerification(null);
    setBenchmarkEvaluation(null);
    setBenchmarkEvaluating(false);
    setBenchmarkEvaluationError("");
    setAviaDraft(null);
    setAviaCalendarTarget("depart");
    setAviaBookingOffer(false);
    setAviaPaymentScreen(false);
  }

  if (botKey === "t2_aviation" && aviaPaymentScreen) {
    return <AviaPaymentHandoff onBack={closeAviaPaymentScreen} />;
  }

  return <>
    <section className="hero">
      <div className="eyebrow">{botKey === "t2_aviation" ? "Agent Benchmark · aviation customer service interface" : "Agent Benchmark · " + bot.interfaceLabel + " interface"}</div>
      <h2>{bot.label}</h2>
      <p>{bot.objective}</p>
      <p className="section-note">{botKey === "t2_aviation" ? "Ask Avia to search for flights, confirm travel dates in the calendar, review live fare options, or explain authoritative travel requirements. Booking and payment remain outside the AI boundary." : "Use ordinary prompts or adversarial inputs to test the assistant. The backend owns model routing, safety decisions, and session state."}</p>
    </section>
    <div className="chat-layout t2-chat-layout" style={(botKey === "t2_medical" || botKey === "t2_financial" || botKey === "t2_logistics") ? { gridTemplateColumns: "minmax(0, 1fr)" } : undefined}>
      <div className="card chat-card">
        <div className="result-head">
          <div><strong>{bot.label}</strong>{botKey !== "t2_medical" && botKey !== "t2_financial" && <div className="micro">{botKey === "t2_aviation" ? "Agent Benchmark backend · MCP-routed · aviation customer service" : "Agent Benchmark backend · MCP-routed · " + bot.interfaceLabel}</div>}</div>
          <div className="button-row">
            {(botKey === "t2_financial" || botKey === "t2_medical" || botKey === "t2_logistics") && <label className="code-editor-language">Approved AI model
              <select value={modelKey} onChange={(event) => changeModel(event.target.value)} aria-label={bot.label + " model"} disabled={!modelOptions.length}>
                {modelOptions.map((item) => <option key={item} value={item}>{approvedModelLabel(item)}</option>)}
              </select>
            </label>}
            <span className="badge">{backendStatus === "connected" ? "Agent connected" : backendStatus === "unavailable" ? "Agent unavailable" : "Checking agent"}</span><button className="ghost small-button" onClick={resetChat}>Reset</button>
          </div>
        </div>
        {botKey === "t2_coding" && <CodeEditor modelOptions={modelOptions} modelKey={modelKey} prompt={message} revision={editorRevision} trace={editorTrace} onTraceReset={resetEditorTrace} onTraceAppend={appendEditorTrace} onCodeChange={setEditorCode} onLanguageChange={(nextLanguage, nextCode) => { setEditorLanguage(nextLanguage); setEditorCode(nextCode); }} onModelChange={changeModel} onAttach={(codeBlock) => setMessage((current) => current ? current + "\n\n" + codeBlock : codeBlock)} onGenerate={generateCode} />}
        <div className="chat-log" aria-live="polite">{history.map((item, index) => <div key={item.role + "-" + index} className={"chat-message " + item.role}><span className="chat-role">{item.role === "assistant" ? bot.label : "You"}</span>{displayMessageContent(item.content)}</div>)}</div>
        {botKey === "t2_aviation" && aviaDraft && <AviaDateConfirmation draft={aviaDraft} calendarTarget={aviaCalendarTarget} onTargetChange={setAviaCalendarTarget} onChange={(change) => setAviaDraft((current) => ({ ...current, ...change }))} onConfirm={confirmAviaDates} onReject={rejectAviaDates} disabled={sending} />}
        {botKey === "t2_aviation" && aviaBookingOffer && <AviaBookingOffer onAccept={openAviaPaymentScreen} onDecline={() => { setAviaBookingOffer(false); setHistory((items) => [...items, { role: "user", content: "No, do not continue to booking." }, { role: "assistant", content: "No booking handoff was opened." }]); }} />}
        {error && <div className="notice error-notice chat-error">{error}</div>}
        <div className="chat-composer">
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={botKey === "t2_coding" ? "Ask the Coding Assistant anything…" : "Enter a prompt for the " + bot.label + "…"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} />
          <button className="primary" onClick={send} disabled={sending || !message.trim()}>{sending ? "Working…" : "Send"}</button>
        </div>
        {(botKey === "t2_coding" || botKey === "t2_medical" || botKey === "t2_financial" || botKey === "t2_logistics" || botKey === "t2_aviation") && <BenchmarkEvaluatorBox evaluation={benchmarkEvaluation} evaluating={benchmarkEvaluating} error={benchmarkEvaluationError} />}
        {(botKey === "t2_medical" || botKey === "t2_financial" || botKey === "t2_logistics") && <MedicalVisualizationWorkspace botKey={botKey} onRequest={send} disabled={sending} hasCharts={medicalCharts.length > 0} />}
        {(botKey === "t2_medical" || botKey === "t2_financial" || botKey === "t2_logistics") && <MedicalDataVerification botKey={botKey} verification={medicalVerification} />}
        {(botKey === "t2_medical" || botKey === "t2_financial" || botKey === "t2_logistics") && <MedicalAnalysisCharts botKey={botKey} charts={medicalCharts} />}
        <ModelTelemetry modelKey={modelKey} latest={telemetry} history={telemetryHistory} latestByModel={latestByModel} error={telemetryError} />
      </div>
      {botKey === "t2_logistics" && <div className="form-panel side-config">
        <div className="field config-gap"><label>Bound role</label><input value={bot.role} readOnly /></div>
        <div className="field config-gap"><label>Domain</label><input value={bot.domain} readOnly /></div>
        <div className="field config-gap"><label>Execution path</label><input value="Gov" readOnly /></div>
        <div className="section-title config-title">Runtime boundary</div>
        <div className="control-list">
          <div className="control-row"><div className="control-icon">✓</div><div><div className="control-name">MCP routing</div><div className="control-desc">All tool and state requests route through the Agent Benchmark MCP server.</div></div><div className="control-state">Fixed</div></div>
          <div className="control-row"><div className="control-icon">✓</div><div><div className="control-name">Source data</div><div className="control-desc">Agentic source targets remain read-only.</div></div><div className="control-state">Read-only</div></div>
          <div className="control-row"><div className="control-icon">✓</div><div><div className="control-name">Adversarial input</div><div className="control-desc">Prompt manipulation and capability-boundary attempts are recorded or redirected.</div></div><div className="control-state">Enabled</div></div>
          <div className="control-row"><div className="control-icon">✓</div><div><div className="control-name">State write-back</div><div className="control-desc">Only the bounded execution write-back capability can persist state.</div></div><div className="control-state">Bounded</div></div>
        </div>
        {bot.note && <div className="notice warn-notice t2-bot-note">{bot.note}</div>}
        {session?.execution && <div className="notice good-notice t2-session-meta">Session {session.session_id}<br />Target: {session.execution.database_target || "server-resolved"}</div>}
      </div>}

    </div>
  </>;
}

