import { useCallback, useEffect, useMemo, useState } from "react";

const TABS = [
  ["overview", "System overview"],
  ["measures", "Governance measures"],
  ["changes", "Change control"],
  ["ownership", "Ownership"],
  ["reference", "Reference map"],
];

async function readJson(path) {
  const response = await fetch("/api/proxy?path=" + encodeURIComponent(path), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || `Request failed (${response.status})`);
  return payload;
}

function statusTone(value) {
  return ["operational", "implemented", "approved", "closed", "active"].includes(String(value || "").toLowerCase())
    ? "ok"
    : ["in_progress", "partially_implemented", "pending_review"].includes(String(value || "").toLowerCase())
      ? "warn"
      : "muted";
}

function Metric({ value, label, detail }) {
  return <article className="aims-metric">
    <strong>{value}</strong>
    <span>{label}</span>
    {detail && <small>{detail}</small>}
  </article>;
}

function RegulatoryLine({ line, index }) {
  const trimmed = line.trim();
  if (!trimmed) return <div className="regulatory-spacer" aria-hidden="true" />;
  if (trimmed === "---") return <hr className="regulatory-rule" />;
  if (trimmed.startsWith("· ")) return <div className="regulatory-bullet"><span aria-hidden="true">•</span><span>{trimmed.slice(2)}</span></div>;
  if (/^\d+\.\s+[A-Z]/.test(trimmed)) return <h2>{trimmed}</h2>;
  if (/^\d+\.\d+\s+/.test(trimmed)) return <h3>{trimmed}</h3>;
  if (/^(P-\d{3}|Gate \d+|Layer \d+|CV-[A-Z]+-\d{3}|C-\d{3}|A\.\d+|\d+\s+—)/.test(trimmed)) return <h4>{trimmed}</h4>;
  if (/^\d+\.\s+/.test(trimmed)) return <div className="regulatory-numbered">{trimmed}</div>;
  if (/^(IMPORTANT BOUNDARY|Claim-Free \/ Evidence-Based Working Document|END OF DOCUMENT)$/.test(trimmed)) return <div className="regulatory-callout-title">{trimmed}</div>;
  return <p key={index}>{line}</p>;
}

export default function RegulatoryFramework() {
  const [activeTab, setActiveTab] = useState("overview");
  const [arena, setArena] = useState(null);
  const [t2, setT2] = useState(null);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [documentText, setDocumentText] = useState("");
  const [documentError, setDocumentError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [arenaResult, t2Result] = await Promise.allSettled([
      readJson("/api/v1/aims/arena"),
      readJson("/api/v1/aims/t2"),
    ]);
    const nextErrors = [];
    if (arenaResult.status === "fulfilled") setArena(arenaResult.value);
    else nextErrors.push(`Agentic Arena: ${arenaResult.reason?.message || "unavailable"}`);
    if (t2Result.status === "fulfilled") setT2(t2Result.value);
    else nextErrors.push(`T-2 Benchmark: ${t2Result.reason?.message || "unavailable"}`);
    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (activeTab !== "reference" || documentText || documentError) return;
    fetch("/cv11-iso42001-working-document.txt", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("The working document could not be loaded.");
        return response.text();
      })
      .then(setDocumentText)
      .catch((failure) => setDocumentError(failure.message));
  }, [activeTab, documentText, documentError]);

  const registry = arena || t2 || {};
  const systems = [arena, t2].filter(Boolean);
  const changeRequests = registry.change_requests || [];
  const measures = registry.governance_measures || [];
  const ownership = registry.ownership || [];
  const configuredTargets = systems.reduce((sum, system) => sum + Number(system.runtime?.configured_database_targets || 0), 0);
  const expectedTargets = systems.reduce((sum, system) => sum + Number(system.runtime?.expected_database_targets || 0), 0);
  const openChanges = changeRequests.filter((item) => !["closed", "rejected", "implemented"].includes(String(item.status).toLowerCase())).length;
  const implementedMeasures = measures.filter((item) => String(item.implementation_status).toLowerCase() === "implemented").length;
  const sourcesAgree = Boolean(arena && t2)
    && JSON.stringify(arena.change_requests) === JSON.stringify(t2.change_requests)
    && JSON.stringify(arena.governance_measures) === JSON.stringify(t2.governance_measures)
    && JSON.stringify(arena.ownership) === JSON.stringify(t2.ownership);

  const lastObserved = useMemo(() => {
    const values = systems.map((item) => item.observed_at).filter(Boolean).sort();
    return values.length ? new Date(values[values.length - 1]).toLocaleString() : "Waiting for live data";
  }, [arena, t2]);

  return <section className="aims-shell" aria-label="AI management system">
    <header className="aims-header">
      <div>
        <div className="eyebrow">Execution Pass · live AIIMS</div>
        <h2>AIIMS control plane</h2>
        <p>One operational view across Agentic Arena, the T-2 benchmark, and their Neon evidence boundaries.</p>
      </div>
      <div className="aims-header-actions">
        <span className={`aims-live ${errors.length ? "warn" : "ok"}`}>{loading ? "SYNCING" : errors.length ? "DEGRADED" : "LIVE"}</span>
        <button type="button" onClick={load} disabled={loading}>Refresh</button>
      </div>
    </header>

    {errors.length > 0 && <div className="notice error-notice">{errors.join(" · ")}</div>}

    <div className="aims-metrics" aria-label="AIIMS summary">
      <Metric value={`${systems.length}/2`} label="Backends reporting" detail="Arena + T-2" />
      <Metric value={`${configuredTargets}/${expectedTargets || "—"}`} label="Neon targets configured" detail="Server-reported bindings" />
      <Metric value={`${implementedMeasures}/${measures.length || "—"}`} label="Measures implemented" detail="Registry status" />
      <Metric value={openChanges} label="Open change requests" detail={`Observed ${lastObserved}`} />
    </div>

    <nav className="aims-tabs" aria-label="AIIMS sections">
      {TABS.map(([key, label]) => <button type="button" key={key} className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)}>{label}</button>)}
    </nav>

    {activeTab === "overview" && <div className="aims-panel">
      <div className="aims-section-heading">
        <div><span className="eyebrow">LIVE SYSTEM BOUNDARY</span><h3>Connected execution environments</h3></div>
        <span className={`aims-consistency ${sourcesAgree ? "ok" : "warn"}`}>{sourcesAgree ? "REGISTRY RECONCILED" : "RECONCILIATION PENDING"}</span>
      </div>
      <div className="aims-system-grid">
        {systems.map((system) => <article className="aims-system-card" key={system.source}>
          <header><div><strong>{system.runtime?.backend}</strong><small>{system.source}</small></div><span className={`aims-badge ${statusTone(system.runtime?.status)}`}>{system.runtime?.status}</span></header>
          <dl>
            <div><dt>Neon boundary</dt><dd>{system.registry?.database_target}</dd></div>
            <div><dt>Configured targets</dt><dd>{system.runtime?.configured_database_targets} / {system.runtime?.expected_database_targets}</dd></div>
            <div><dt>Registry schema</dt><dd>{system.registry?.schema}</dd></div>
            <div><dt>Observed</dt><dd>{new Date(system.observed_at).toLocaleString()}</dd></div>
          </dl>
        </article>)}
      </div>
      <div className="aims-targets">
        {systems.map((system) => <article key={system.source}>
          <h4>{system.runtime?.backend} database bindings</h4>
          <div className="aims-target-list">
            {(system.database_targets || []).map((target) => <span key={target.target} className={target.configured ? "ready" : "missing"}>
              <i aria-hidden="true" />{target.target}
            </span>)}
          </div>
        </article>)}
      </div>
    </div>}

    {activeTab === "measures" && <div className="aims-panel">
      <div className="aims-section-heading"><div><span className="eyebrow">MEASURE → OWNER → EVIDENCE</span><h3>Governance measures</h3></div></div>
      <div className="aims-table-wrap"><table className="aims-table">
        <thead><tr><th>Measure</th><th>Status</th><th>Control objective</th><th>Ownership</th><th>Evidence</th><th>Review</th></tr></thead>
        <tbody>{measures.map((item) => <tr key={item.measure_id}>
          <td><strong>{item.measure_id}</strong><span>{item.name}</span><small>{item.category}</small></td>
          <td><span className={`aims-badge ${statusTone(item.implementation_status)}`}>{item.implementation_status}</span></td>
          <td>{item.control_objective}</td>
          <td><strong>Org:</strong> {item.organizational_owner}<br /><strong>Ops:</strong> {item.operational_owner}</td>
          <td>{item.evidence_source}</td>
          <td>{item.review_cadence}</td>
        </tr>)}</tbody>
      </table></div>
    </div>}

    {activeTab === "changes" && <div className="aims-panel">
      <div className="aims-section-heading"><div><span className="eyebrow">CONTROLLED CHANGE</span><h3>Change-request register</h3></div><small>Read-only public evidence view</small></div>
      <div className="aims-change-list">
        {changeRequests.map((item) => <article key={item.request_id}>
          <header><div><strong>{item.request_id} · {item.title}</strong><small>{item.change_type} · {item.risk_level} risk</small></div><span className={`aims-badge ${statusTone(item.status)}`}>{item.status}</span></header>
          <p>{item.description}</p>
          <dl>
            <div><dt>Systems</dt><dd>{(item.system_scope || []).join(", ")}</dd></div>
            <div><dt>Requested by</dt><dd>{item.requested_by}</dd></div>
            <div><dt>Organizational owner</dt><dd>{item.organizational_owner}</dd></div>
            <div><dt>Operational owner</dt><dd>{item.operational_owner}</dd></div>
            <div><dt>Decision authority</dt><dd>{item.decision_authority}</dd></div>
            <div><dt>Rollback</dt><dd>{item.rollback_plan}</dd></div>
          </dl>
          {item.evidence_url && <a href={item.evidence_url} target="_blank" rel="noreferrer">Open change evidence</a>}
        </article>)}
        {!changeRequests.length && <p className="aims-empty">No change requests are registered.</p>}
      </div>
    </div>}

    {activeTab === "ownership" && <div className="aims-panel">
      <div className="aims-section-heading"><div><span className="eyebrow">ACCOUNTABILITY</span><h3>Organizational and operational ownership</h3></div></div>
      <div className="aims-owner-grid">
        {ownership.map((item) => <article key={item.ownership_id}>
          <span>{item.system_name}</span>
          <h4>{item.layer_name}</h4>
          <dl>
            <div><dt>Organizational</dt><dd>{item.organizational_owner}</dd></div>
            <div><dt>Operational</dt><dd>{item.operational_owner}</dd></div>
            <div><dt>Accountability</dt><dd>{item.accountability}</dd></div>
            <div><dt>Escalation</dt><dd>{item.escalation_path}</dd></div>
          </dl>
        </article>)}
      </div>
    </div>}

    {activeTab === "reference" && <article className="regulatory-document" aria-label="CV 1.1 ISO IEC 42001 working implementation framework">
      <header className="regulatory-document-header">
        <div className="eyebrow">Claim-free reference map</div>
        <h2>CV 1.1 mapped for assessment against ISO/IEC 42001:2023</h2>
        <p>Clause and Annex A reference-control mapping · not a certification claim</p>
      </header>
      {documentError && <div className="notice error-notice">{documentError}</div>}
      {!documentText && !documentError && <div className="regulatory-loading">Loading working document…</div>}
      <div className="regulatory-document-body">{documentText.split(/\r?\n/).map((line, index) => <RegulatoryLine line={line} index={index} key={index} />)}</div>
    </article>}
  </section>;
}
