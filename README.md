# Agentic Arena

**Version: v1.0**

Agentic Arena is a controlled AI research lab for comparing governed and ungoverned agentic workflows against the same tasks and source data. The governed path is constrained by CV 1.1, OPA/Rego policy, fixed runtime roles, bounded MCP capabilities, server-selected database targets, domain-aware output controls, and tamper-evident telemetry. The ungoverned path is retained as the experimental control.

> Project status: launch hardening and analytical presentation. The core execution paths, six paired datasets, telemetry, integrity chain, Railway backend, Vercel UI, Security CI and deterministic comparative analytics are operational. Remaining work is primarily database-level hardening, final production verification, a post-metadata smoke run, additional data views, cleanup and public-repository synchronization.

## Operational scope

Agentic Arena is intentionally scoped to **analytics and auditing workflows** in the current testing baseline. This is a deliberate experimental boundary, not a claim that analytics and auditing are the only important uses of AI.

Coding, programming, data propagation, automation, orchestration and other operational workloads are equally important areas for AI deployment and governance. They are outside the present test surface because they introduce additional mutation paths, tool permissions, external state and infrastructure variables that would make runtime-governance effects more difficult to isolate.

Analytics and auditing were selected because they are pivotal business functions across the chosen domains and provide repeatable conditions for evaluating runtime behavior. These workflows require models to interpret structured data, operate within defined roles, access bounded resources, use evidence, comply with policy and produce controlled outputs.

For this phase of the platform, that narrower task surface provides a more viable way to observe and compare role binding, scoped data access, policy enforcement, egress controls, telemetry and integrity under governed and ungoverned execution. The Arena therefore demonstrates runtime-governance capabilities **within the tested analytics and auditing scope**. It does not claim to represent every enterprise AI workload.

## Experimental methodology

Agentic Arena uses matched governed and ungoverned runs to separate model behavior from runtime authority. The comparison is designed to hold the model, task, domain, function, source context and output-token ceiling constant while changing the execution condition around the model.

### Neutral programming and prompt language

Shared experimental code and task language are kept functionally descriptive rather than governance-prescriptive. Shared prompts do not instruct the ungoverned control that data are authorized, bounded, auditable, read-only, policy-governed or MCP-derived. Those concepts are introduced only on the governed execution path.

Neutral programming applies the same principle to shared application logic. Code used by both paths should perform matching, experiment orchestration, telemetry and common output formatting without silently embedding governed semantics into the control condition. Governed-only modules add authorization, MCP requirements, policy checks, redaction, verification and fail-closed behavior.

Regression tests inspect every ungoverned function prompt across all six domains and the shared UI task templates for governance-coded language. Prompt hashes and UI review are also used during root-cause analysis when output wording suggests possible contamination.

### Observations during testing

Development observations are retained separately from research conclusions. Current examples include prompt-language contamination discovered through UI review and task hashes, output-token truncation at lower ceilings, cases where plausible data modeling did not guarantee correct manual aggregation, and the need to fail closed when governed MCP context is required.

Historical runs created before prompt neutralization remain useful as development evidence, but they should not be interpreted as clean evidence of runtime-governance effects alone because prompt wording was an additional variable.

## Architecture

The governed execution model is:

```text
User / Chatbot trigger
        |
        v
Governed function selection
        |
        v
Fixed runtime role
        |
        v
CV 1.1 -> OPA / Rego authorization
        |
        v
Allowed MCP entity + bounded tools
        |
        v
Server-selected system/domain database
        |
        v
Verified relational evidence where applicable
        |
        v
Model execution
        |
        v
Domain-aware governed output controls
        |
        v
Telemetry + SHA-256/HMAC integrity chain
        |
        v
API response
```

The governed agent cannot elect to become ungoverned. Governed and ungoverned workflows are separate execution paths.

## Governed functions

Four governed functional entities exist in the backend:

| Function | Runtime role | Purpose | MCP posture |
| --- | --- | --- | --- |
| Analyst | `analyst_runner` | Bounded analysis, evidence and uncertainty | Read/query/profile/RAG |
| Data Modeler | `data_modeler_runner` | Relational/dimensional modeling | Describe/schema/sample/profile/RAG |
| Evaluator / Auditor | `evaluator_runner` | Controls, reconciliation and traceability | Read-only source/workspace posture |
| Advisor | `advisor_runner` | Decision support, options and tradeoffs | Read-only source/workspace posture |

OPA/Rego binds each function to its expected runtime role, permitted actions, MCP entity, system ID and governed database target. Governed policy failure is fail-closed.

The current direct-run UI still marks Data Modeler and Evaluator/Auditor as under construction. Their backend function definitions and bounded MCP entities remain implemented.

## Governed MCP

The governed MCP layer uses separate bounded entities rather than one unrestricted agent.

Supported capabilities include:

- dataset description;
- schema inspection;
- bounded sampling where permitted;
- server-compiled read-only queries;
- deterministic profiling;
- bounded RAG retrieval;
- argument validation;
- server-derived database routing;
- domain-aware governed egress controls.

The model does not select arbitrary connection strings or database targets.

## Chatbot governance

The chatbot is implemented as a governed trigger/router rather than an unrestricted backend interface.

Controls include:

- CV 1.1 authorization and role binding;
- bounded conversation history and output-token defaults;
- IP/rate controls;
- jailbreak/redefinition detection;
- protected governance terminology;
- PII-style redaction;
- anti-bias controls;
- prohibited profanity/explicit sexual content;
- philosophy blocked except when tied to abstract technology concepts;
- backend-disclosure restrictions for secrets, credentials, environment values, hidden prompts, raw policy source and internal control records.

The chatbot may explain the public architecture at a high level without exposing private implementation data.

### Floating UI Guide and circuit breaker

A small **UI Guide** launcher is available at the bottom of the Vercel interface. The guide is itself governed by CV 1.1 and uses a fixed, policy-selected model, bounded conversation history, and a 512-token response ceiling.

The guide is intentionally scoped to the Arena interface, CV 1.1 controls, architecture, and governed workflows. If user input violates the configured runtime/content boundary or CV 1.1 denies the action, the guide trips a client-visible circuit breaker. Further messages are disabled until the user clicks **Reset**, which clears the bounded conversation state and re-arms the guide.

The reset requirement is deliberate. A policy violation does not cause the guide to improvise around the control, silently retry with broader authority, or continue the same conversation state. The protected interaction stops and requires an explicit reset before another request can be submitted.

## Domain systems and datasets

The lab uses six domain IDs. Each domain has a governed and ungoverned copy of the same canonical source data.

| System | Domain | Dataset ID | Governed DB | Ungoverned DB | Canonical rows per side |
| --- | --- | --- | --- | --- | ---: |
| 01 | Finance | `5k` | `agentic_gov_01` | `agentic_ungov_01` | 5,000 |
| 02 | Environmental Operations | `environmental_iot_telemetry` | `agentic_gov_02` | `agentic_ungov_02` | 405,184 |
| 03 | Healthcare | `healthcare_patient_flow` | `agentic_gov_03` | `agentic_ungov_03` | 9,216 |
| 04 | Retail | `sample_superstore` | `agentic_gov_04` | `agentic_ungov_04` | 9,994 |
| 05 | Aviation | `passengers_carried_1970_2020` | `agentic_gov_05` | `agentic_ungov_05` | 266 |
| 06 | Supply Chain | `logistics_shipments` | `agentic_gov_06` | `agentic_ungov_06` | 2,000 |

The canonical governed and ungoverned source row counts match across all six systems. `app/datasets.py` reflects the current six-dataset registry.

### Source preservation rules

- Aviation retains the wide annual structure; missing annual values are represented as SQL NULL where applicable.
- Environmental Operations retains the intended source rows, including duplicate preservation.
- Retail retains the intended source rows, including duplicate preservation.
- Finance and Healthcare are governed as production-like sensitive workloads even where the data is synthetic or open-source.
- Governance/redaction occurs at the governed execution and egress boundaries rather than by altering the paired source data.

## Domain-aware governed egress controls

### Finance - system 01

The governed finance path applies production-like redaction for direct or patterned sensitive values such as addresses, email, phone, SSN-like identifiers, card numbers, account numbers, routing identifiers, IBAN/SWIFT-style values and tax identifiers.

Structured field names are recognized so the system does not rely only on free-text regex matching.

### Healthcare - system 03

The healthcare path treats the source as production-like PHI. `Merged` is interpreted semantically as patient name and `Patient Id` as a patient identifier.

Governed output controls cover patient names, patient IDs, MRN-style identifiers, date-of-birth fields, encounter/admission dates and times, and common contact identifiers if present.

Operational and demographic attributes remain available for legitimate aggregate analysis.

## Database topology

The active Agentic Arena topology contains 14 primary PostgreSQL databases:

- 6 governed workload databases: `agentic_gov_01` through `agentic_gov_06`
- 6 ungoverned workload databases: `agentic_ungov_01` through `agentic_ungov_06`
- 2 evidence databases: `log_agentic_cv11_gov`, `log_agentic_ungov`

Four legacy harness databases remain physically present in the Neon project but are not part of the active Agentic Arena runtime topology.

## Telemetry and integrity

The active evidence layer writes new governed and ungoverned runs to `telemetry.agentic_runs`.

New records use:

- canonical JSON payload hashing;
- SHA-256 payload and event hashes;
- previous-event hash chaining;
- HMAC-SHA256 authentication;
- domain-separated governed and ungoverned signing contexts;
- PostgreSQL advisory transaction locking before append;
- current-tail verification before the next record is accepted.

The signing secret remains in deployment secret storage and is not written to prompts, source control or event records.

Records created before the integrity cutover remain legacy unsigned evidence. They are not retroactively signed.

New agentic runs also persist the complete final model output inside the signed JSONB evidence record. Governed records store the final post-governance, post-redaction text returned to the user; ungoverned records store the ungoverned text returned for that run. The stored output includes its SHA-256 digest and character count and is therefore covered by the run's existing tamper-evident HMAC/SHA-256 chain. Historical runs created before this output-persistence change cannot be reconstructed and remain metadata-only. Full output text is intentionally omitted from ordinary application-log emission; those logs retain only the non-text output metadata such as hashes and character counts.

Read-only chain verification is exposed at:

`/api/v1/system/audit/integrity`

### Integrity limitation still open

The evidence chain is tamper-evident, but database-level append-only enforcement is not yet complete. The current event roles still retain UPDATE, DELETE and TRUNCATE privileges on the event tables.

This is a remaining hardening item, not a missing integrity implementation.

## Model curation and telemetry

The model registry is curated and groups models by access/openness class and parameter size where known.

Token telemetry exposes model-level execution dimensions including:

- model/vendor;
- model access class;
- parameter size;
- total and active parameter counts where known;
- run counts;
- prompt/completion/total tokens;
- governed and ungoverned token totals.

The parameter-metadata code is deployed and covered by the current test suite. One fresh governed/ungoverned post-deployment run remains useful as the final production proof of the persistence-to-analytics path.

## Deterministic analytics

The analytics workspace is deliberately not AI-driven.

The existing side-by-side analytics layer supports:

- governed and ungoverned source selection;
- source-table selection;
- schema/profile/row preview;
- row counts and shared-field comparison;
- deterministic filtering;
- count/sum/avg/min/max aggregation;
- bar, line, table and KPI views;
- identical analytical operations applied to both selected source tables.

Additional planned views are lenses over the existing experimental record, not new agent functionality.

## User acceptance testing for governance reliability

User acceptance testing (UAT) is treated as part of the governance evidence model, not only as interface validation. The purpose is to verify that a user can recognize when the system is operating in a governed state, understand when a control has intervened, follow the intended recovery path, and distinguish a blocked or constrained action from an application failure.

From a governance-reliability perspective, UAT should exercise visible state and behavior such as domain and model context, governed/ungoverned labeling, policy-denial messaging, bounded chatbot behavior, reset/recovery controls, analytics selections, and the presentation of latency, cost, token, and integrity information. The expected result is that the same user action produces a consistent control response without silent bypass, hidden escalation, or ambiguous state.

From an audit perspective, UAT observations should be correlated with the corresponding runtime evidence where available, including request or event identifiers, policy outcomes, telemetry, integrity status, and timestamps. This connects what the user observed at the interface to what the governed runtime recorded. A successful UAT result therefore supports both usability and control effectiveness, while any mismatch between visible behavior and recorded evidence is treated as a governance defect requiring investigation.

UAT does not replace automated security, policy, or integrity testing. It provides the human-facing verification layer needed to assess whether implemented controls are understandable, repeatable, recoverable, and auditable in actual use.

## Deployment and testing

The FastAPI backend is deployed on Railway and the UI is deployed through Vercel.

The Docker image runs as a non-root user and includes OPA.

Security CI currently performs:

```text
Python 3.12 setup
compile app + scripts
security gate pytest suite
full pytest regression run
pip-audit
Docker build
OPA strict validation and policy tests
npm dependency audit
frontend production build
```

The latest verified private-repo Security CI run passed both backend and frontend jobs.

## Local run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Local development endpoints:

- `http://localhost:8000/`
- `http://localhost:8000/health`
- `http://localhost:8000/ready`
- `http://localhost:8000/docs`

Production disables API documentation when configured for the production environment.

## Docker

```bash
docker build -t agentic-arena .
docker run --rm -p 8000:8000 agentic-arena
```

## Remaining launch work

No additional functional feature is required for the current lab scope.

The remaining work is:

1. close or explicitly accept the workload-database least-privilege gap;
2. make the two evidence roles append-only at the database layer or explicitly document the accepted risk;
3. decide whether governed caller-supplied `source_context` remains an authorized input channel;
4. reconcile the currently staged Railway production changes and verify intended production security values;
5. perform a fresh governed/ungoverned post-parameter-metadata smoke run;
6. finish the remaining analytical views already defined for presentation;
7. remove or hide obsolete repair/backup tables from user-facing analytics if no longer needed;
8. decide whether to retain or remove the four legacy harness databases;
9. synchronize the sanitized public repository after the private baseline is frozen;
10. run the final launch smoke test.

See [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) for the detailed verified state.

## License

Licensed under the Apache License, Version 2.0. See `LICENSE` for the full license text.
