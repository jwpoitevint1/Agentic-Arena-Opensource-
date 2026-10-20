BEGIN;

CREATE SCHEMA IF NOT EXISTS aims;

CREATE TABLE IF NOT EXISTS aims.change_requests (
    request_id text PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    status text NOT NULL CHECK (status IN ('proposed', 'in_progress', 'pending_review', 'approved', 'implemented', 'rejected', 'closed')),
    change_type text NOT NULL,
    system_scope text[] NOT NULL DEFAULT '{}',
    risk_level text NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
    requested_by text NOT NULL,
    organizational_owner text NOT NULL,
    operational_owner text NOT NULL,
    decision_authority text NOT NULL,
    evidence_url text,
    rollback_plan text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aims.governance_measures (
    measure_id text PRIMARY KEY,
    name text NOT NULL,
    category text NOT NULL,
    control_objective text NOT NULL,
    implementation_status text NOT NULL CHECK (implementation_status IN ('planned', 'partially_implemented', 'implemented', 'not_applicable')),
    organizational_owner text NOT NULL,
    operational_owner text NOT NULL,
    evidence_source text NOT NULL,
    review_cadence text NOT NULL,
    last_reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS aims.ownership_assignments (
    ownership_id text PRIMARY KEY,
    system_name text NOT NULL,
    layer_name text NOT NULL,
    organizational_owner text NOT NULL,
    operational_owner text NOT NULL,
    accountability text NOT NULL,
    escalation_path text NOT NULL,
    active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_aims_change_requests_status ON aims.change_requests (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_aims_measures_status ON aims.governance_measures (implementation_status, category);
CREATE INDEX IF NOT EXISTS idx_aims_ownership_system ON aims.ownership_assignments (system_name, active);

INSERT INTO aims.change_requests (
    request_id, title, description, status, change_type, system_scope, risk_level,
    requested_by, organizational_owner, operational_owner, decision_authority,
    evidence_url, rollback_plan
) VALUES (
    'CR-2026-001',
    'Activate live AIMS in Execution Pass',
    'Replace the static Execution Pass surface with a Neon-backed management view spanning Agentic Arena and the T-2 benchmark.',
    'pending_review',
    'governance-system',
    ARRAY['agentic-arena', 't2-benchmark', 'neon-evidence'],
    'moderate',
    'Joshua Poitevint',
    'AI System Owner',
    'Platform Operations',
    'Joshua Poitevint',
    'https://github.com/jwpoitevint1/Agentic-Arena-/pull/51',
    'Revert the paired repository changes and retain the existing regulatory reference document.'
) ON CONFLICT (request_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    change_type = EXCLUDED.change_type,
    system_scope = EXCLUDED.system_scope,
    risk_level = EXCLUDED.risk_level,
    organizational_owner = EXCLUDED.organizational_owner,
    operational_owner = EXCLUDED.operational_owner,
    decision_authority = EXCLUDED.decision_authority,
    rollback_plan = EXCLUDED.rollback_plan,
    updated_at = now();

INSERT INTO aims.governance_measures (
    measure_id, name, category, control_objective, implementation_status,
    organizational_owner, operational_owner, evidence_source, review_cadence, last_reviewed_at
) VALUES
    ('AIMS-GOV-001', 'External runtime authorization', 'Runtime governance', 'Keep authority outside model output and fail closed on denied governed actions.', 'implemented', 'AI System Owner', 'Runtime Governance Operations', 'OPA decisions and governed execution records', 'Every release', now()),
    ('AIMS-GOV-002', 'Immutable role and scope binding', 'Agent control', 'Prevent user or model text from redefining assigned role, domain, function, or execution path.', 'implemented', 'AI System Owner', 'Agent Runtime Operations', 'Session bindings, boundary tests, and reset events', 'Every release', now()),
    ('AIMS-GOV-003', 'Bounded MCP capability access', 'Tool governance', 'Allow only registered capabilities with validated arguments and server-resolved resources.', 'implemented', 'AI System Owner', 'MCP Operations', 'Capability manifests, policy decisions, and interaction traces', 'Every release', now()),
    ('AIMS-GOV-004', 'Governed and ungoverned data separation', 'Data governance', 'Preserve separate execution targets and prevent silent cross-path writes.', 'implemented', 'Data Owner', 'Database Operations', 'Neon target registry and database-resolution contracts', 'Monthly', now()),
    ('AIMS-GOV-005', 'Append-only execution evidence', 'Evidence', 'Retain observable outcomes, failures, integrity data, and verification results.', 'implemented', 'AI System Owner', 'Evidence Operations', 'Neon run records, telemetry, and integrity-chain checks', 'Weekly', now()),
    ('AIMS-GOV-006', 'Controlled system change', 'Change management', 'Record scope, risk, ownership, decision authority, evidence, and rollback before release.', 'partially_implemented', 'Change Authority', 'Platform Operations', 'AIMS change-request register and version-controlled pull requests', 'Every change', now()),
    ('AIMS-GOV-007', 'Operational failure and escalation', 'Incident management', 'Surface degraded dependencies, retain failure evidence, and route unresolved failures to accountable owners.', 'implemented', 'AI System Owner', 'Platform Operations', 'Health endpoints, failure codes, logs, and deployment status', 'Weekly', now()),
    ('AIMS-GOV-008', 'Model and supplier change regression', 'Supplier governance', 'Re-evaluate bounded behavior when a provider, model ID, evaluator, or serving path changes.', 'partially_implemented', 'AI System Owner', 'Model Registry Operations', 'Model registry, CI contracts, and benchmark evaluation records', 'Per model change', now())
ON CONFLICT (measure_id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    control_objective = EXCLUDED.control_objective,
    implementation_status = EXCLUDED.implementation_status,
    organizational_owner = EXCLUDED.organizational_owner,
    operational_owner = EXCLUDED.operational_owner,
    evidence_source = EXCLUDED.evidence_source,
    review_cadence = EXCLUDED.review_cadence,
    last_reviewed_at = EXCLUDED.last_reviewed_at;

INSERT INTO aims.ownership_assignments (
    ownership_id, system_name, layer_name, organizational_owner,
    operational_owner, accountability, escalation_path, active
) VALUES
    ('OWN-AA-ORG', 'Agentic Arena', 'Organizational governance', 'Joshua Poitevint · AI System Owner', 'Governance Operations', 'Defines intended use, risk acceptance, governance objectives, and release authority.', 'Escalate control or risk decisions to the AI System Owner.', true),
    ('OWN-AA-OPS', 'Agentic Arena', 'Operational runtime', 'AI System Owner', 'Agentic Arena Platform Operations', 'Maintains backend, OPA boundary, model registry, database bindings, evidence, and recovery.', 'Escalate unresolved runtime or evidence failures to organizational ownership.', true),
    ('OWN-T2-ORG', 'T-2 Benchmark', 'Organizational governance', 'Joshua Poitevint · Benchmark Owner', 'Benchmark Governance Operations', 'Defines benchmark purpose, evaluated behaviors, acceptance criteria, and change authority.', 'Escalate benchmark-scope or interpretation changes to the Benchmark Owner.', true),
    ('OWN-T2-OPS', 'T-2 Benchmark', 'Operational runtime', 'Benchmark Owner', 'T-2 Platform Operations', 'Maintains agent contracts, evaluator separation, execution targets, telemetry, and regression evidence.', 'Escalate contract mismatch, evaluator bleed-over, or database-boundary failures to organizational ownership.', true),
    ('OWN-NEON', 'Shared Neon Project', 'Data and evidence boundary', 'Data Owner', 'Database Operations', 'Maintains database separation, credentials, retention, schema control, and availability.', 'Escalate cross-boundary writes, unavailable evidence, or integrity concerns to the Data Owner.', true)
ON CONFLICT (ownership_id) DO UPDATE SET
    system_name = EXCLUDED.system_name,
    layer_name = EXCLUDED.layer_name,
    organizational_owner = EXCLUDED.organizational_owner,
    operational_owner = EXCLUDED.operational_owner,
    accountability = EXCLUDED.accountability,
    escalation_path = EXCLUDED.escalation_path,
    active = EXCLUDED.active;

COMMIT;
