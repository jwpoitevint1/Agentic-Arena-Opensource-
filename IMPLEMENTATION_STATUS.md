# Agentic Arena Implementation Status

_Last updated: 2026-09-28_

This document records the current private Agentic Arena implementation baseline and separates **functional implementation** from **production verification**. A control can be fully implemented in the repository while a current deployment, database privilege state, or public mirror still requires direct verification. A passing deployment is not treated as proof of a control unless that control was directly verified.

## Status legend

- **COMPLETE** - implemented and verified in the deployed path.
- **ACTIVE** - operating in production and generating evidence.
- **VERIFY** - implementation exists, but the current production or infrastructure state still requires direct verification.
- **PENDING** - work is not yet completed.
- **OPTIONAL** - post-baseline hardening, cleanup, or release hygiene; not required for functional operation.
- **REVIEW** - implemented behavior exists, but the final research or security posture still requires an explicit decision.

## Launch state

The functional Agentic Arena implementation baseline is complete for the current research-lab scope. No additional functional feature is required. Remaining open items are production/infrastructure verification and release hygiene rather than application capability.

| Area | Status | Verified state |
| --- | --- | --- |
| Railway API implementation | COMPLETE | FastAPI runtime, Docker path, health/readiness, governed and ungoverned execution are implemented |
| Vercel UI | COMPLETE | Production deployment is live and serving the Agentic Arena interface |
| Production domain | ACTIVE | `https://www.agenticarena.space` is live on Vercel |
| Python regression suite | COMPLETE | Full pytest regression remains available as an engineering verification tool; it is not a service requirement |
| Python dependency audit | COMPLETE | `pip-audit` remains available as an engineering verification tool; it is not a service requirement |
| Frontend dependency audit/build | COMPLETE | npm audit and the frontend production build remain available as engineering verification tools; they are not service requirements |
| Docker build | COMPLETE | Docker build includes Python compilation and OPA validation; deployment state is tracked separately from implementation status |
| OPA/Rego | COMPLETE | Runtime policy enforcement remains required; policy validation/tests remain engineering verification tools |
| Six paired datasets | COMPLETE | Canonical governed/ungoverned source tables are loaded for all six systems |
| HMAC/SHA-256 event chain | ACTIVE | New governed and ungoverned runs are signed and hash chained |
| Database-level append-only logging | VERIFY | Repository evidence does not prove the current production PostgreSQL grants/triggers; direct database verification is required before claiming DB-level append-only enforcement |
| Per-target PostgreSQL least privilege | VERIFY | Application target isolation is implemented; current production role/grant isolation must be verified directly in PostgreSQL |
| Analytics and comparison views | COMPLETE | Deterministic governed/ungoverned analytics plus Mixed Capability grouped comparisons are implemented in the current UI |
| Public repo synchronization | PENDING | The sanitized public mirror still trails the private repository; its latest observed commit is 2026-09-25 while private main advanced through 2026-09-26 |
| Documentation | COMPLETE for current private state | Implementation status refreshed on 2026-09-28; homepage/runtime-enforcement positioning and downloadable audit/contract documentation are present |

## Backend and deployment

| Capability | Status | Notes |
| --- | --- | --- |
| FastAPI backend | COMPLETE | Application routes, health/readiness, middleware, governed and ungoverned execution |
| Docker runtime | COMPLETE | Python 3.12, non-root runtime, OPA binary included |
| Railway deployment integration | COMPLETE / VERIFY HEAD | Main is wired to Railway auto-deploy, but the latest inspected head deployment failed and needs a terminal-success replacement |
| Railway health check | VERIFY HEAD | Health/readiness routes are implemented; verify them again after a successful deployment of current main |
| Vercel UI | COMPLETE | Production UI is live on Vercel at `https://www.agenticarena.space` |
| Production config names | COMPLETE | Required API/auth/host/model-route/database/audit variables are present |
| Production config values | VERIFY | Railway OAuth exposes required variable names but redacts values, so value correctness cannot be asserted from this verification path |
| Railway staged changes | VERIFY | Railway currently reports a staged EnvironmentPatch/pending work item; reconcile or clear it before release verification is closed |

Production frontend: `https://www.agenticarena.space`

The private main commit inspected immediately before this status update was:

`be7776ddf6e831127a99772e68274a15962be57c`

The latest Railway deployment attempt for that inspected head failed. The most recent observed successful Railway API deployment in the deployment history is commit `23523c841fadb817825698558b1351d577d8831f` on 2026-09-26. Automated verification results may be retained as engineering evidence but are not service requirements or deployment blockers.

## CV 1.1 governance

| Capability | Status | Notes |
| --- | --- | --- |
| OPA/Rego policy decision point | COMPLETE | Governed path fails closed when policy cannot authorize |
| Role/action allowlists | COMPLETE | Runtime roles are bound to permitted actions |
| Function-role binding | COMPLETE | Analyst, Data Modeler, Evaluator/Auditor, Advisor |
| Governed database-target binding | COMPLETE at application layer | System ID resolves to a server-selected governed target |
| MCP entity-role binding | COMPLETE | MCP entity must match the governed runtime role |
| Redefinition guard | COMPLETE | Policy/input patterns reject role/policy override attempts |
| Client system-message restriction | COMPLETE | Governed path does not accept client-defined system control |
| Token/output limits | COMPLETE | Bounded through request/config controls |
| Verified relational evidence path | COMPLETE | Analyst/Evaluator/Advisor can receive server-derived evidence from bounded data access |
| Database credential isolation per target | VERIFY | Server-derived target isolation is implemented; independent production PostgreSQL credential/grant isolation requires direct database verification |
| General RLS/column security | NOT REQUIRED FOR CURRENT LAB CLAIM | Current architecture uses dataset/database routing plus governed egress rather than a universal RLS model |
| Caller-supplied `source_context` | COMPLETE | Retained as an authorized bounded input channel, explicitly labeled untrusted data/not instructions and hashed into provenance metadata |

### Historical database grant observation requiring refresh

As verified on 2026-09-19, the canonical `source.source_data` table in the 12 workload databases is accessible through the same observed role, `agentic_gov_01_role`, with privileges including SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES and TRIGGER.

The application still enforces server-derived system/database routing, but the PostgreSQL permission layer does not yet independently prove the per-target least-privilege isolation described as a desired hardening goal.

## Governed functional agents

Four functional entities are implemented in the backend:

| Function | Runtime role | Primary boundary |
| --- | --- | --- |
| Analyst | `analyst_runner` | Analysis with bounded query/profile/RAG access |
| Data Modeler | `data_modeler_runner` | Schema/modeling work with bounded source inspection |
| Evaluator / Auditor | `evaluator_runner` | Read-only evaluation, controls, reconciliation and traceability |
| Advisor | `advisor_runner` | Read-only decision support and tradeoff analysis |

The runtime combination is:

```text
function + fixed runtime role + allowed MCP tools + selected system/domain + server-selected database target
```

Analyst, Data Modeler, Auditor/Evaluator and Advisor are implemented in the current lab execution surface. Auditor has dedicated governed/ungoverned routing over recorded run evidence, and Data Modeler has since received additional scope, evidence, and visualization regression work.

## Governed MCP

| Capability | Status | Notes |
| --- | --- | --- |
| Separate MCP entities | COMPLETE | Analyst, Data Modeler, Evaluator, Advisor |
| Tool allowlists per entity | COMPLETE | Unsupported tools are rejected |
| Server-derived DB target | COMPLETE | Model/client does not supply arbitrary connection strings |
| Dataset describe/schema | COMPLETE | Governed source metadata access |
| Bounded sample | COMPLETE where permitted | Sample size is constrained |
| Bounded read-only query | COMPLETE | Server-compiled bounded selects/filters/limits |
| Dataset profile | COMPLETE | Deterministic source profiling |
| RAG retrieval | COMPLETE | Bounded top-k/context profile |
| MCP argument validation | COMPLETE | Identifier, mutation/escape, redefinition and size controls |
| Domain-aware MCP egress redaction | COMPLETE for Finance and Healthcare | Structured output is sanitized before return |

## Governed chatbot

The chatbot is implemented as a governed trigger/router rather than a privileged backend console.

Current controls include bounded history/output, IP/rate controls, jailbreak and redefinition patterns, policy protections, PII-style redaction, anti-bias controls, profanity/explicit-sexual-content restrictions, philosophy restrictions except abstract technology concepts, and backend-disclosure restrictions.

The chatbot may explain public architecture at a high level but is intended not to expose raw database rows, database credentials, connection strings, secrets, API keys, environment values, private signing material, hidden/system prompts, raw policy source, or internal control records.

The Vercel interface also exposes a small floating **UI Guide**. It runs through the governed chatbot path with a fixed policy-selected model, bounded history, and a 512-token response ceiling. A blocked input or CV 1.1 policy denial trips a client-side circuit breaker: the guide stops accepting new messages until the user explicitly clicks **Reset**. Reset clears the bounded conversation state and re-arms the guide rather than allowing the failed interaction to continue around the guard.

## Domain-aware output governance

### Finance - system 01

Status: **COMPLETE in governed code path**.

The finance source is synthetic and is treated as production-like sensitive financial data. Governed egress controls include structured-field and regex handling for addresses, email, phone, SSN-like values, card numbers, account numbers, routing numbers, IBAN/SWIFT-style identifiers, and tax identifiers.

Redaction occurs before the governed response leaves the API and before telemetry is built. Direct governed MCP structured content is also sanitized.

### Healthcare - system 03

Status: **COMPLETE in governed code path**.

The healthcare source is treated as production-like PHI. `Merged` is interpreted as patient name and `Patient Id` as a patient identifier. Governed egress controls cover those direct identifiers plus MRN-style identifiers, date-of-birth fields, admission/encounter date and time, and common contact identifiers if present.

Operational and demographic attributes remain available for legitimate aggregate analysis.

### Other domains

Status: **BASE CV 1.1 GOVERNANCE COMPLETE**.

Environmental Operations, Retail, Aviation and Supply Chain remain governed through the same role/function/tool/database boundaries. Additional domain-specific egress rules are added only where the source warrants them.

## Database topology

The active Agentic Arena runtime topology contains 14 primary PostgreSQL databases.

### Workload databases - 12

```text
agentic_gov_01
agentic_gov_02
agentic_gov_03
agentic_gov_04
agentic_gov_05
agentic_gov_06

agentic_ungov_01
agentic_ungov_02
agentic_ungov_03
agentic_ungov_04
agentic_ungov_05
agentic_ungov_06
```

### Logging/evidence databases - 2

```text
log_agentic_cv11_gov
log_agentic_ungov
```

Four legacy harness databases also remain physically present in the Neon project:

```text
harness_cv11_gov
harness_ungov
log_harness_cv11
log_harness_ungov
```

They are not part of the current 14-database Agentic Arena runtime topology and should be treated as cleanup/legacy artifacts unless intentionally retained.

## Dataset ingestion and parity

All six current domain datasets are loaded into paired governed and ungoverned workload databases.

| System | Domain | Dataset ID | Canonical rows in each paired source table | Status |
| --- | --- | --- | ---: | --- |
| 01 | Finance | `5k` | 5,000 | COMPLETE |
| 02 | Environmental Operations | `environmental_iot_telemetry` | 405,184 | COMPLETE |
| 03 | Healthcare | `healthcare_patient_flow` | 9,216 | COMPLETE |
| 04 | Retail | `sample_superstore` | 9,994 | COMPLETE |
| 05 | Aviation | `passengers_carried_1970_2020` | 266 | COMPLETE |
| 06 | Supply Chain | `logistics_shipments` | 2,000 | COMPLETE |

The current `app/datasets.py` registry matches these six lab datasets. The earlier placeholder Kaggle registry mismatch has been resolved.

The canonical governed and ungoverned `source.source_data` row counts match for all six systems.

### Source preservation

- Aviation retains its wide annual structure and missing year values are stored as SQL NULL where applicable.
- Environmental Operations preserves the source dataset including intended duplicate preservation.
- Retail preserves the source dataset including intended duplicate preservation.
- Finance and Healthcare remain production-like governance exercises even where the data is synthetic or open-source.
- Governed and ungoverned copies are intended to remain identical at the source-data layer so governance, not source content, is the experimental variable.

### Legacy/repair tables

Several workload databases still contain repair or backup tables from ingestion recovery work. These are not the canonical `source.source_data` tables and should not be treated as experimental source-of-record tables. They may be removed or hidden from user-facing analytics before public launch if they are no longer needed.

## Agentic run logging and integrity

Status: **ACTIVE FOR NEW AGENTIC RUNS**.

The production evidence databases `log_agentic_cv11_gov` and `log_agentic_ungov` contain active `telemetry.agentic_runs` stores.New records use:

- canonical JSON payload hashing with SHA-256;
- previous-event hash chaining;
- HMAC-SHA256 authentication;
- domain-separated governed and ungoverned signing contexts;
- a PostgreSQL advisory transaction lock to serialize chain appends;
- chain-tail verification before append.

The HMAC master key is stored in Railway secret configuration and is not stored in prompts, source control or Neon event records.

New agentic executions persist the complete final user-visible model output in the signed JSONB run record. For governed execution this is the post-sanitization and post-redaction response; for ungoverned execution it is the response returned by the ungoverned path. Each stored output also carries a SHA-256 digest and character count. Because the output is part of the signed record, subsequent modification changes the integrity payload and is detectable by chain verification. Historical runs created before output persistence remain metadata-only because their original response text was not retained. Full output text is intentionally omitted from ordinary application-log emission so persistence remains confined to the Neon evidence record rather than being duplicated into Railway logs.

At the 2026-09-19 verification point, each chain contained 25 signed events. Historical records created before the integrity cutover remain legacy unsigned evidence and are not retroactively signed.

Read-only verification is exposed through:

`/api/v1/system/audit/integrity`

### Remaining integrity hardening

Database-level append-only/WORM enforcement is **not proven by the repository alone**. The functional signed hash-chain implementation is complete; direct PostgreSQL privilege/trigger verification is required before describing the database layer itself as append-only.

As verified on 2026-09-19:

- `agentic_gov_events_role` retains UPDATE, DELETE and TRUNCATE on governed `telemetry.agentic_runs`;
- `agentic_ungov_events_role` retains UPDATE, DELETE and TRUNCATE on ungoverned `telemetry.agentic_runs`;
- no mutation-blocking trigger is currently installed on either event table.

The event chain is therefore tamper-evident at the application/integrity layer, but the database roles are not yet append-only.

External chain-head anchoring remains optional future hardening if independent tail-deletion detection is required. A key-rotation/keyring procedure should be defined before rotating the active signing key.

## Model registry and parameter metadata

The private model registry is curated and groups models by access/openness class and parameter size where known.

The token telemetry summary exposes:

- model key;
- requested model ID;
- vendor;
- access class;
- parameter size;
- total parameter count where known;
- active parameter count where known;
- run count;
- prompt/completion/total tokens;
- governed and ungoverned token totals.

The parameter-metadata code and tests are deployed. A fresh governed/ungoverned execution pair after the 2026-09-19 metadata deployment is still required to prove the complete persistence-to-analytics path using newly generated production records.

## Analytics

The analytics layer is intentionally deterministic and does not delegate analysis to an AI model.

Implemented side-by-side capabilities include:

- governed and ungoverned source selection;
- source table selection;
- schema/profile/row preview;
- row count comparison;
- shared-field detection;
- deterministic bounded filtering;
- count/sum/avg/min/max aggregation;
- bar, line, table and KPI views;
- the same dimension, measure, aggregation and filter applied to both sides.

The deterministic analytics surface and Mixed Capability comparison views are implemented for the current baseline. Additional visualizations, if added later, are presentation enhancements rather than required execution features.

## Recorded experimental coverage

The current production evidence contains governed and ungoverned runs across Finance, Healthcare, Retail, Aviation and Supply Chain.

At the 2026-09-19 verification point:

- Environmental Operations had no recorded agentic runs in the active evidence tables;
- no Evaluator/Auditor runs were present;
- Data Modeler and Advisor had limited recorded coverage compared with Analyst;
- historical records may contain older rating/score fields from earlier lab iterations.

These are coverage/history observations, not deployment failures.

## Telemetry schema history

The current `telemetry.agentic_runs` table still contains historical columns:

- `execution_rating`;
- `policy_rating`;
- `operational_score`;
- `overall_score`.

Current run persistence no longer writes those scoring fields. Existing non-null values are legacy experimental data and should not be interpreted as the current benchmark methodology.

## Testing and engineering verification

The repository contains tests for security middleware, audit integrity, model routes, system endpoints, execution routing, dataset registry behavior, ungoverned workflows, chatbot guardrails and additional functional/regression paths.

The repository retains automated regression, security, policy, dependency-audit, frontend-build, and Docker verification capabilities for engineering use. These checks are not runtime contracts, service requirements, or deployment prerequisites. Runtime health, policy enforcement, integrity, and deployed service behavior remain the production verification surfaces.

The Docker image itself continues to run Python compilation plus OPA validation during image construction. Full pytest remains an engineering verification tool rather than a runtime service requirement.

## User acceptance testing and governance reliability

UAT is part of the governance-validation process for the Arena. It is not treated only as a visual or usability check.

The UAT objective is to verify that the human-visible behavior of the system matches the intended governed runtime state. Test observations should include whether the user can:

- identify the current governed context, selected domain, and selected or policy-fixed model;
- distinguish governed and ungoverned execution surfaces;
- recognize when CV 1.1 or another runtime control has constrained or denied an action;
- understand the recovery path, including explicit reset behavior where applicable;
- confirm that blocked actions do not silently continue, retry with broader authority, or change execution mode;
- interpret latency, token, cost, and integrity indicators without relying on hidden backend state;
- reproduce the same control behavior under the same tested conditions.

For audit purposes, user-observed UAT behavior should be correlated with runtime evidence where available. Relevant evidence can include policy decisions, telemetry records, request or event identifiers, timestamps, integrity-chain status, model and domain metadata, and the recorded execution path.

A UAT pass therefore means more than "the interface worked." It means the visible control behavior was understandable and consistent with the recorded governance evidence. A discrepancy between the user-facing state and the audit record is a governance-reliability defect and should be investigated even if the underlying application request technically completed.

UAT complements automated regression, policy, security, and integrity testing. It does not replace them.

## Functional implementation baseline checklist

The current research-lab feature baseline is complete:

- [x] Six paired governed/ungoverned domain datasets and server-derived target routing.
- [x] Analyst, Data Modeler, Auditor/Evaluator and Advisor execution surfaces.
- [x] CV 1.1 runtime role/function/MCP/database-target binding with fail-closed OPA/Rego policy enforcement.
- [x] Bounded MCP schema/profile/query/statistics/RAG paths with argument validation and governed egress handling.
- [x] Governed and ungoverned evidence persistence with prompt/model-response retention for current runs, SHA-256/HMAC integrity material and hash chaining.
- [x] Deterministic governed-versus-ungoverned analytics and Mixed Capability comparison visualizations.
- [x] Governed UI Guide with domain switching, bounded workflow launch behavior and explicit reset/circuit-breaker recovery.
- [x] Runtime-enforcement homepage positioning plus downloadable CV 1.1 contract-register/crosswalk and ISO/IEC 42001 AIMS audit-map material.
- [x] Governed caller-supplied `source_context` is explicitly treated as bounded, untrusted data rather than instructions; its presence is hashed into provenance metadata.
- [x] No additional functional application feature is required for the current experiment baseline.

## Open production verification and release hygiene

These items do **not** represent missing functional features, but they remain open before describing the current head as fully release-verified:

- [ ] Directly verify current PostgreSQL logging-role privileges/triggers before claiming database-level append-only/WORM enforcement.
- [ ] Directly verify independent least-privilege credentials/grants for each workload target at the PostgreSQL layer.
- [ ] Obtain a terminal-success Railway deployment for current private main; the latest observed head deployment failed while an earlier 2026-09-26 deployment succeeded.
- [ ] Reconcile or clear the staged Railway EnvironmentPatch/pending work item and verify intended production values that are redacted through OAuth.
- [ ] Run/record the final release smoke test across health, readiness, governed execution, ungoverned execution, telemetry persistence, integrity verification and UI rendering after the head deployment is green.
- [ ] Synchronize the sanitized public mirror through the frozen private baseline.

Optional cleanup that does not block the functional baseline: remove/hide obsolete repair tables if desired, and retain or remove the four legacy harness databases by explicit decision.

## Baseline principle

The functional execution architecture is treated as frozen for the current experiment baseline. Open production-verification and release-hygiene items should be closed through verification, hardening, deployment repair or documentation—not by adding new application features. Subsequent work should favor defect correction, security maintenance, model/dataset curation and evidence accumulation.