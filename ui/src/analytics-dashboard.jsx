import React, { useEffect, useMemo, useState } from "react";

async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 60000);
  try {
    const response = await fetch("/api/proxy?path=" + encodeURIComponent(path), {
      method: options.method || "GET",
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let payload = text;
    try { payload = text ? JSON.parse(text) : {}; } catch { }
    if (!response.ok) {
      const detail = typeof payload === "object" && payload?.detail ? payload.detail : payload;
      const message = typeof detail === "string" ? detail : detail?.message || JSON.stringify(detail);
      throw new Error(message || "Request failed with " + response.status);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Analytics request timed out.");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function fmtNumber(value, digits = 0) {
  if (value === null || value === undefined || value === "") return "N/A";
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString(undefined, { maximumFractionDigits: digits })
    : "N/A";
}

function StatusPill({ good, label }) {
  return <span className="status-pill"><span className={"status-dot " + (good === true ? "good" : good === false ? "bad" : "warn")} />{label}</span>;
}

function Metric({ label, value, foot }) {
  return <div className="card metric-card"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot">{foot}</div></div>;
}

function isNumericType(dataType) {
  const value = String(dataType || "").toLowerCase();
  return ["smallint", "integer", "bigint", "numeric", "decimal", "real", "double", "money"].some((type) => value.includes(type));
}

function dashboardFilters(field, op, value) {
  if (!field || value === "") return [];
  if (op === "in") {
    const values = value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 50);
    return values.length ? [{ field, op, value: values }] : [];
  }
  return [{ field, op, value }];
}

function normalizedAggregate(result) {
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const groupKey = result?.group_by;
  return rows.map((row) => ({
    group: groupKey ? row?.[groupKey] : null,
    value: row?.value,
  }));
}

function DashboardVisual({ type, rows, groupBy, measure, aggregation }) {
  const data = (rows || [])
    .map((row) => ({ group: row.group == null ? "All rows" : String(row.group), value: Number(row.value) }))
    .filter((row) => Number.isFinite(row.value));

  if (!data.length) return <div className="analytics-empty compare-empty">No aggregate result.</div>;

  if (type === "kpi" || !groupBy) {
    const item = data[0];
    return <div className="analytics-kpi compare-kpi">
      <span>{aggregation}{measure ? " · " + measure : ""}</span>
      <strong>{fmtNumber(item?.value, 2)}</strong>
      <small>{groupBy || "Selected table"}</small>
    </div>;
  }

  if (type === "table") {
    return <div className="table-wrap analytics-visual-table">
      <table className="evidence-table compare-result-table">
        <thead><tr><th>{groupBy}</th><th>{aggregation}{measure ? "(" + measure + ")" : ""}</th></tr></thead>
        <tbody>{data.map((item, index) => <tr key={item.group + "-" + index}><td>{item.group}</td><td>{fmtNumber(item.value, 3)}</td></tr>)}</tbody>
      </table>
    </div>;
  }

  if (type === "line") {
    const values = data.map((item) => item.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;
    const width = 620;
    const height = 260;
    const padX = 32;
    const padY = 24;
    const pointX = (index) => data.length === 1 ? width / 2 : padX + (index / (data.length - 1)) * (width - padX * 2);
    const pointY = (value) => height - padY - ((value - min) / spread) * (height - padY * 2);
    const points = data.map((item, index) => pointX(index) + "," + pointY(item.value)).join(" ");
    return <div className="analytics-line-wrap compare-line-wrap">
      <svg className="analytics-line-chart compare-line-chart" viewBox={"0 0 " + width + " " + height}>
        <line x1={padX} y1={height-padY} x2={width-padX} y2={height-padY} className="analytics-axis" />
        <line x1={padX} y1={padY} x2={padX} y2={height-padY} className="analytics-axis" />
        <polyline points={points} className="analytics-line" />
        {data.map((item, index) => <circle key={item.group + "-" + index} cx={pointX(index)} cy={pointY(item.value)} r="4" className="analytics-point"><title>{item.group + ": " + item.value}</title></circle>)}
      </svg>
      <div className="analytics-line-labels"><span>{data[0]?.group}</span><span>{data[data.length - 1]?.group}</span></div>
    </div>;
  }

  const maxAbs = Math.max(...data.map((item) => Math.abs(item.value)), 1);
  return <div className="analytics-bars compare-bars">{data.map((item, index) => <div className="analytics-bar-row" key={item.group + "-" + index}>
    <div className="analytics-bar-label" title={item.group}>{item.group}</div>
    <div className="analytics-bar-track"><div className="analytics-bar-fill" style={{ width: Math.max(1, Math.abs(item.value) / maxAbs * 100) + "%" }} /></div>
    <div className="analytics-bar-value">{fmtNumber(item.value, 2)}</div>
  </div>)}</div>;
}

function DataPreview({ title, tone, table, profile, columns, rows, tables, onTableChange, loading }) {
  const tableColumns = rows.length ? Object.keys(rows[0]).slice(0, 16) : columns.map((item) => item.column_name).slice(0, 16);
  return <div className={"card compare-source-card " + tone}>
    <div className="compare-source-head">
      <div><div className="eyebrow">{title}</div><div className="section-title">{table || "No table selected"}</div></div>
      <StatusPill good={rows.length ? true : null} label={loading ? "Loading" : profile ? "Connected" : "Waiting"} />
    </div>
    <div className="field compare-table-select">
      <label>Source table</label>
      <select value={table || ""} onChange={(e) => onTableChange(e.target.value)} disabled={loading || !tables.length}>
        {tables.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
    <div className="compare-source-metrics">
      <div><span>Rows</span><strong>{profile?.row_count == null ? "N/A" : fmtNumber(profile.row_count)}</strong></div>
      <div><span>Fields</span><strong>{columns.length}</strong></div>
      <div><span>Preview</span><strong>{rows.length}</strong></div>
    </div>
    <div className="table-wrap analytics-preview compare-preview">
      {rows.length ? <table className="evidence-table">
        <thead><tr>{tableColumns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{tableColumns.map((column) => <td key={column}>{row[column] == null ? "" : typeof row[column] === "object" ? JSON.stringify(row[column]) : String(row[column])}</td>)}</tr>)}</tbody>
      </table> : <div className="result-empty compact-empty">No rows returned.</div>}
    </div>
  </div>;
}

export default function AnalyticsDashboard({ domains }) {
  const [systemId, setSystemId] = useState(6);
  const [govTables, setGovTables] = useState([]);
  const [ungovTables, setUngovTables] = useState([]);
  const [govTable, setGovTable] = useState("");
  const [ungovTable, setUngovTable] = useState("");
  const [govProfile, setGovProfile] = useState(null);
  const [ungovProfile, setUngovProfile] = useState(null);
  const [govColumns, setGovColumns] = useState([]);
  const [ungovColumns, setUngovColumns] = useState([]);
  const [govRows, setGovRows] = useState([]);
  const [ungovRows, setUngovRows] = useState([]);
  const [govVisual, setGovVisual] = useState([]);
  const [ungovVisual, setUngovVisual] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visualLoading, setVisualLoading] = useState(false);
  const [error, setError] = useState("");
  const [filterField, setFilterField] = useState("");
  const [filterOp, setFilterOp] = useState("eq");
  const [filterValue, setFilterValue] = useState("");
  const [chartType, setChartType] = useState("bar");
  const [groupBy, setGroupBy] = useState("");
  const [measure, setMeasure] = useState("");
  const [aggregation, setAggregation] = useState("count");

  async function analyticsRequest(operation, governance, body) {
    return apiRequest("/api/v1/analytics/" + operation, {
      method: "POST",
      body: { system_id: Number(body.system_id ?? systemId), governance, ...body },
    });
  }

  async function loadSide(governance, selectedSystem, tableName) {
    const [profile, schema, query] = await Promise.all([
      analyticsRequest("profile", governance, { system_id: selectedSystem, table: tableName }),
      analyticsRequest("schema", governance, { system_id: selectedSystem }),
      analyticsRequest("query", governance, { system_id: selectedSystem, table: tableName, limit: 100 }),
    ]);
    return {
      profile,
      columns: (schema.columns || []).filter((item) => item.table_name === tableName),
      rows: Array.isArray(query.rows) ? query.rows : [],
    };
  }

  function chooseDefaultTable(tables, preferred) {
    if (preferred && tables.includes(preferred)) return preferred;
    if (tables.includes("source_data")) return "source_data";
    return tables[0] || "";
  }

  function chooseSharedDefaults(govCols, ungovCols) {
    const ungovByName = new Map(ungovCols.map((item) => [item.column_name, item]));
    const shared = govCols.filter((item) => ungovByName.has(item.column_name));
    const numeric = shared.filter((item) => isNumericType(item.data_type) && isNumericType(ungovByName.get(item.column_name)?.data_type));
    const categorical = shared.filter((item) => !numeric.some((num) => num.column_name === item.column_name));
    const nextGroup = categorical[0]?.column_name || shared[0]?.column_name || "";
    const nextMeasure = numeric[0]?.column_name || "";
    setGroupBy(nextGroup);
    setMeasure(nextMeasure);
    setFilterField(shared[0]?.column_name || "");
    return { nextGroup, nextMeasure };
  }

  async function loadPair(selectedSystem = systemId, preferredGov = null, preferredUngov = null) {
    setLoading(true);
    setError("");
    try {
      const [govCatalog, ungovCatalog] = await Promise.all([
        analyticsRequest("profile", "governed", { system_id: selectedSystem, table: null }),
        analyticsRequest("profile", "ungoverned", { system_id: selectedSystem, table: null }),
      ]);
      const nextGovTables = Array.isArray(govCatalog.tables) ? govCatalog.tables : [];
      const nextUngovTables = Array.isArray(ungovCatalog.tables) ? ungovCatalog.tables : [];
      const nextGovTable = chooseDefaultTable(nextGovTables, preferredGov);
      const nextUngovTable = chooseDefaultTable(nextUngovTables, preferredUngov);
      if (!nextGovTable || !nextUngovTable) throw new Error("Both governed and ungoverned source databases need at least one source table.");

      setGovTables(nextGovTables);
      setUngovTables(nextUngovTables);
      setGovTable(nextGovTable);
      setUngovTable(nextUngovTable);

      const [gov, ungov] = await Promise.all([
        loadSide("governed", selectedSystem, nextGovTable),
        loadSide("ungoverned", selectedSystem, nextUngovTable),
      ]);
      setGovProfile(gov.profile);
      setUngovProfile(ungov.profile);
      setGovColumns(gov.columns);
      setUngovColumns(ungov.columns);
      setGovRows(gov.rows);
      setUngovRows(ungov.rows);
      setFilterValue("");
      setAggregation("count");
      const defaults = chooseSharedDefaults(gov.columns, ungov.columns);
      await buildVisualPair({
        selectedSystem,
        selectedGovTable: nextGovTable,
        selectedUngovTable: nextUngovTable,
        nextGroup: defaults.nextGroup,
        nextMeasure: defaults.nextMeasure,
        nextAggregation: "count",
        filters: [],
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function buildVisualPair(options = {}) {
    const selectedSystem = options.selectedSystem ?? systemId;
    const selectedGovTable = options.selectedGovTable ?? govTable;
    const selectedUngovTable = options.selectedUngovTable ?? ungovTable;
    const nextGroup = options.nextGroup ?? groupBy;
    const nextMeasure = options.nextMeasure ?? measure;
    const nextAggregation = options.nextAggregation ?? aggregation;
    const filters = options.filters ?? dashboardFilters(filterField, filterOp, filterValue);
    if (!selectedGovTable || !selectedUngovTable) return;
    setVisualLoading(true);
    setError("");
    try {
      const request = {
        system_id: selectedSystem,
        group_by: chartType === "kpi" ? null : (nextGroup || null),
        measure: nextAggregation === "count" ? (nextMeasure || null) : nextMeasure,
        aggregation: nextAggregation,
        filters,
        limit: 25,
      };
      const [gov, ungov] = await Promise.all([
        analyticsRequest("aggregate", "governed", { ...request, table: selectedGovTable }),
        analyticsRequest("aggregate", "ungoverned", { ...request, table: selectedUngovTable }),
      ]);
      setGovVisual(normalizedAggregate(gov));
      setUngovVisual(normalizedAggregate(ungov));
    } catch (e) {
      setError(e.message);
    } finally {
      setVisualLoading(false);
    }
  }

  async function changeTable(governance, nextTable) {
    const preferredGov = governance === "governed" ? nextTable : govTable;
    const preferredUngov = governance === "ungoverned" ? nextTable : ungovTable;
    await loadPair(systemId, preferredGov, preferredUngov);
  }

  async function applyFilter() {
    const filters = dashboardFilters(filterField, filterOp, filterValue);
    setLoading(true);
    setError("");
    try {
      const [gov, ungov] = await Promise.all([
        analyticsRequest("query", "governed", { table: govTable, filters, limit: 100 }),
        analyticsRequest("query", "ungoverned", { table: ungovTable, filters, limit: 100 }),
      ]);
      setGovRows(Array.isArray(gov.rows) ? gov.rows : []);
      setUngovRows(Array.isArray(ungov.rows) ? ungov.rows : []);
      await buildVisualPair({ filters });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPair(systemId); }, []);

  const sharedColumns = useMemo(() => {
    const ungovByName = new Map(ungovColumns.map((item) => [item.column_name, item]));
    return govColumns.filter((item) => ungovByName.has(item.column_name));
  }, [govColumns, ungovColumns]);
  const sharedNumeric = sharedColumns.filter((item) => isNumericType(item.data_type));
  const rowDelta = Number(govProfile?.row_count || 0) - Number(ungovProfile?.row_count || 0);
  const selectedDomain = domains.find((item) => item.id === Number(systemId)) || domains[0];

  return <>
    <div className="notice good-notice">
      Human comparative analytics workspace. No AI model is used here. Governed and ungoverned Neon source tables are read side by side through deterministic, bounded SQL operations.
    </div>

    <section className="section analytics-toolbar compare-toolbar">
      <div className="field"><label>Domain / dataset</label><select value={systemId} onChange={(e) => { const next = Number(e.target.value); setSystemId(next); loadPair(next); }}>{domains.map((d) => <option key={d.id} value={d.id}>{String(d.id).padStart(2,"0") + " · " + d.name}</option>)}</select></div>
      <div className="analytics-mode-card"><span>Comparison</span><strong>Governed vs ungoverned</strong><small>Deterministic SQL · no LLM</small></div>
      <button className="secondary analytics-refresh" onClick={() => loadPair()} disabled={loading}>{loading ? "Reading both databases..." : "Refresh comparison"}</button>
    </section>

    {error && <div className="notice error-notice section">{error}</div>}

    <section className="section grid-4">
      <Metric label="Governed rows" value={govProfile?.row_count == null ? "N/A" : fmtNumber(govProfile.row_count)} foot={(selectedDomain?.name || "Dataset") + " governed source"} />
      <Metric label="Ungoverned rows" value={ungovProfile?.row_count == null ? "N/A" : fmtNumber(ungovProfile.row_count)} foot={(selectedDomain?.name || "Dataset") + " ungoverned source"} />
      <Metric label="Row delta" value={fmtNumber(rowDelta)} foot="Governed minus ungoverned" />
      <Metric label="Shared fields" value={String(sharedColumns.length)} foot={govColumns.length + " governed · " + ungovColumns.length + " ungoverned"} />
    </section>

    <section className="section compare-source-grid">
      <DataPreview title="Governed source" tone="governed-source" table={govTable} profile={govProfile} columns={govColumns} rows={govRows} tables={govTables} onTableChange={(next) => changeTable("governed", next)} loading={loading} />
      <DataPreview title="Ungoverned source" tone="ungoverned-source" table={ungovTable} profile={ungovProfile} columns={ungovColumns} rows={ungovRows} tables={ungovTables} onTableChange={(next) => changeTable("ungoverned", next)} loading={loading} />
    </section>

    <section className="section card compare-controls">
      <div className="section-header">
        <div><div className="section-title">Comparative visual</div><div className="section-note">The same dimension, measure, aggregation, and filter are applied to both selected tables.</div></div>
        <span className="badge">0 AI calls</span>
      </div>
      <div className="compare-control-grid">
        <div className="field"><label>Visual</label><select value={chartType} onChange={(e) => setChartType(e.target.value)}>{["bar","line","table","kpi"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="field"><label>Group / X axis</label><select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} disabled={chartType === "kpi"}><option value="">None</option>{sharedColumns.map((item) => <option key={item.column_name} value={item.column_name}>{item.column_name}</option>)}</select></div>
        <div className="field"><label>Aggregation</label><select value={aggregation} onChange={(e) => setAggregation(e.target.value)}>{["count","sum","avg","min","max"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="field"><label>Measure / Y axis</label><select value={measure} onChange={(e) => setMeasure(e.target.value)}><option value="">Rows</option>{sharedNumeric.map((item) => <option key={item.column_name} value={item.column_name}>{item.column_name}</option>)}</select></div>
        <div className="field"><label>Filter field</label><select value={filterField} onChange={(e) => setFilterField(e.target.value)}><option value="">None</option>{sharedColumns.map((item) => <option key={item.column_name} value={item.column_name}>{item.column_name}</option>)}</select></div>
        <div className="field"><label>Operator</label><select value={filterOp} onChange={(e) => setFilterOp(e.target.value)}>{["eq","ne","gt","gte","lt","lte","contains","in"].map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        <div className="field"><label>Filter value</label><input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder={filterOp === "in" ? "A, B, C" : "Value"} /></div>
        <div className="button-row compare-actions">
          <button className="secondary" onClick={applyFilter} disabled={loading}>Apply filter</button>
          <button className="primary" onClick={() => buildVisualPair()} disabled={visualLoading || (aggregation !== "count" && !measure)}>{visualLoading ? "Building..." : "Build comparison"}</button>
        </div>
      </div>
    </section>

    <section className="section compare-visual-grid">
      <div className="card governed-source">
        <div className="compare-source-head"><div><div className="eyebrow">Governed aggregate</div><div className="section-title">{govTable}</div></div><StatusPill good={govVisual.length ? true : null} label={visualLoading ? "Querying" : "Ready"} /></div>
        <DashboardVisual type={chartType} rows={govVisual} groupBy={groupBy} measure={measure} aggregation={aggregation} />
      </div>
      <div className="card ungoverned-source">
        <div className="compare-source-head"><div><div className="eyebrow">Ungoverned aggregate</div><div className="section-title">{ungovTable}</div></div><StatusPill good={ungovVisual.length ? true : null} label={visualLoading ? "Querying" : "Ready"} /></div>
        <DashboardVisual type={chartType} rows={ungovVisual} groupBy={groupBy} measure={measure} aggregation={aggregation} />
      </div>
    </section>
  </>;
}
