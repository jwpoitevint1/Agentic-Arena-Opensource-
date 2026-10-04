# Agentic Arena — Contract Register, Failure Modes, and Rectification Runbook

**Document status:** Baseline v0.1  
**Repository:** `jwpoitevint1/Agentic-Arena-`  
**Source branch:** `main`  
**Source commit reviewed:** `d01e67252ea33cf95f87d3f5ad07f2dd35ce07db`  
**Prepared:** 2026-09-24  
**Purpose:** Document the executable contracts that bind the Agentic Arena UI, proxy, API, CV1.1 policy layer, MCP boundary, data plane, model registry, telemetry, and audit chain; identify their expected failure modes; and provide a repeatable rectification procedure.

---

## 1. Operating rule

A contract is an invariant that another component is allowed to depend on.

A failure is not automatically a defect. Agentic Arena intentionally fails closed in multiple locations. The first troubleshooting question is therefore:

> **Did the contract fail, or did the contract correctly reject an invalid/unavailable condition?**

Never "fix" a governed failure by weakening the contract, bypassing CV1.1, routing around MCP, disabling integrity checks, relabeling governed traffic as ungoverned, or releasing output after a failed audit write.

### Standard rectification sequence

1. **Contain** — preserve the current fail-closed behavior.
2. **Identify** — capture HTTP status, request ID, execution-state code, CV1.1 reasons, run ID, and failing test.
3. **Locate the contract owner** — UI, proxy, API schema, policy, MCP, database, provider, telemetry, or audit persistence.
4. **Repair the owner** — do not make downstream consumers compensate for an upstream contract defect unless the contract itself is intentionally changing.
5. **Run the targeted contract test(s).**
6. **Run the full regression suite.**
7. **Run the relevant targeted engineering verification for the changed surface.**
8. **Redeploy and verify `/ready`.**
9. **Execute one bounded governed run and one matched ungoverned control run.**
10. **Verify signed persistence and both integrity chains.**

---

# 2. Contract register

## C-001 — Shared agentic output-budget contract

**Owners:** `app/contracts.py`, governed/ungoverned request models, chatbot workflow invocation, UI.

**Invariant**
- Agentic minimum output budget: **2,500 tokens**.
- Agentic maximum output budget: **5,000 tokens**.
- Governed and ungoverned paired runs must use the same ceiling.
- UI workflow payloads must remain aligned to the same contract.

**Enforced by**
- `AGENTIC_MIN_OUTPUT_TOKENS = 2500`
- `AGENTIC_MAX_OUTPUT_TOKENS = 5000`
- Pydantic request bounds.
- `tests/test_contract_alignment.py`.

**Failure signals**
- HTTP 422 on an otherwise valid request.
- UI shows a different limit than the API.
- Governed and ungoverned catalogs publish different execution contracts.
- Regression failure in `test_matched_agentic_output_budget_is_one_shared_contract`.

**Rectification**
1. Change the shared constants first if the contract is intentionally changing.
2. Update governed, ungoverned, chatbot workflow, CV1.1 policy, and UI consumers together.
3. Do not patch only the UI or one execution path.
4. Run:
   - `pytest -q tests/test_contract_alignment.py`
   - `pytest -q tests/test_ungoverned_workflow.py`

---

## C-002 — UI Guide chat-output contract

**Owners:** `app/contracts.py`, chatbot config/routes, CV1.1 policy, floating chat UI.

**Invariant**
- UI Guide normal chat ceiling: **2,048 tokens**.
- Floating UI default request: **512 tokens**.
- Chatbot model call above 2,048 is denied by CV1.1.

**Failure signals**
- `governed_chatbot_token_limit_exceeded`.
- UI Guide requests agentic 5,000-token chat calls outside workflow execution.
- Contract-alignment test failure.

**Rectification**
1. Determine whether the request is ordinary chat or an agentic workflow.
2. Ordinary chat remains <= 2,048.
3. Workflow execution uses the agentic contract through the governed executor rather than expanding chatbot chat limits.
4. Re-run contract-alignment and UI Guide tests.

---

## C-003 — UI Guide model-binding and failover contract

**Owners:** `app/contracts.py`, `app/chatbot_routes.py`, `policies/cv11.rego`, `ui/src/floating-chat.js`.

**Invariant**
- Primary UI Guide model: `ling_3_0_flash_vl_free`.
- Single failover model: `mistral_small_3_2_24b`.
- Strategy: `primary_then_single_failover`.
- Failover-eligible provider statuses: **404, 408, 429, 500, 502, 503, 504**.
- UI, API capability response, and CV1.1 policy must expose identical allowed keys.

**Failure signals**
- `ui_guide_model_binding_denied`.
- UI offers a model the policy rejects.
- Primary failure does not trigger failover on an eligible status.
- Failover occurs on a non-eligible status.
- `test_ui_guide_model_failover_contract_is_identical_across_api_policy_and_ui` fails.

**Rectification**
1. Treat `app/contracts.py` as the shared application contract.
2. Update CV1.1 `ui_guide_model_keys`.
3. Update floating UI binding.
4. Verify both models exist in the model registry.
5. Run contract-alignment, model-registry, and UI Guide tests.
6. Do not broaden failover to arbitrary registry models.

---

## C-004 — Proxy/API route contract

**Owners:** `api/proxy.js`, `ui/api/proxy.js`, FastAPI routes.

**Invariant**
- Root and UI proxy copies are identical.
- Only allowlisted routes and methods can traverse the Vercel proxy.
- Current allowed families include health/readiness, model GETs, governed/ungoverned execution, chatbot, governed MCP, analytics, and selected system endpoints.
- Path traversal, backslashes, and null bytes are rejected.

**Failure signals**
- Frontend 403 while backend endpoint works directly.
- New backend route exists but proxy rejects it.
- Root/UI proxy copies differ.
- `test_vercel_proxy_contract_copies_are_identical` fails.

**Rectification**
1. Confirm the backend endpoint and HTTP method are intentional.
2. Add/change the route in both proxy copies together.
3. Keep the regex as narrow as practical.
4. Verify content type, body size, response size, and timeout behavior.
5. Run `tests/test_contract_alignment.py`.
6. Deploy UI and test through the public Vercel path, not only direct Railway access.

---

## C-005 — Proxy transport contract

**Owners:** `api/proxy.js`, `ui/api/proxy.js`.

**Invariant**
- Backend URL must use HTTPS.
- Backend target origin cannot change after path resolution.
- JSON POSTs only for proxied request bodies.
- Request maximum defaults to **1 MiB** and is clamped to 16 KiB–16 MiB.
- Response maximum is **4 MiB**.
- Upstream timeout is **120 seconds**.
- Backend invalid JSON on JSON content type returns 502.
- Timeout returns 504.

**Failure signals**
- 413 request too large.
- 415 content type not allowed.
- 502 response too large / invalid JSON / proxy invocation failed.
- 504 backend request timed out.

**Rectification**
1. Do not increase limits until determining why the payload or response grew.
2. Verify the public endpoint is not accidentally shipping raw datasets, full logs, or oversized evidence.
3. If an intentional contract change is required, update both proxy copies and backend request limits together.
4. Re-run proxy contract tests and perform a public-route smoke test.

---

## C-006 — Request security middleware contract

**Owners:** `app/middleware.py`.

**Invariant**
- Allowed HTTP methods: GET, POST, HEAD, OPTIONS.
- Valid client request IDs are preserved; invalid/missing IDs are replaced.
- Security headers are applied.
- API responses are `no-store`.
- Host allowlisting is required by default in production.
- API authentication is required by default in production.
- Direct model POST routes are disabled unless explicitly enabled.
- Database diagnostics are disabled unless explicitly enabled.
- Global and chatbot rate limits are enforced.
- Request size is bounded.

**Failure signals**
- 400 invalid host.
- 401 API authentication required when key exists but is absent/invalid.
- 503 API authentication required when auth is required but server key is missing.
- 404 intentionally disabled diagnostic/direct-model route.
- 405 method not allowed.
- 413 request body too large.
- 429 rate limit exceeded.

**Rectification**
1. Classify the status as expected enforcement or misconfiguration.
2. For production host failure, correct `ALLOWED_HOSTS`; do not disable host validation.
3. For auth 503, configure `ARENA_API_KEY` and matching proxy backend auth header/value.
4. For 401, fix the proxy/client credential path.
5. For 404 diagnostics, enable only when diagnostics are intentionally required.
6. For 429, verify caller behavior before changing rate limits.
7. Run `pytest -q tests/test_security_middleware.py`.

---

## C-007 — Readiness contract

**Owners:** `app/main.py`.

**Invariant**
`/ready` returns ready only when all are true:
- all 12 workload database targets are configured,
- OpenRouter is configured,
- OPA health check succeeds,
- audit integrity is configured and passes self-test.

**Failure signals**
- `/health` = 200 while `/ready` = 503.
- One of:
  - `databases_configured: false`
  - `openrouter_configured: false`
  - `cv11_opa_healthy: false`
  - `audit_integrity_configured: false`

**Rectification**
1. Use the failing readiness field to identify the dependency.
2. Repair only that dependency/configuration.
3. Recheck `/ready`.
4. Do not redefine readiness to ignore a missing critical dependency.
5. Run `tests/test_system_endpoints.py`.

---

## C-008 — Execution-context contract

**Owners:** `app/execution.py`.

**Invariant**
- Governance modes: `governed`, `ungoverned`.
- Workloads: `agentic`, `analytics`.
- Dataset workloads require `system_id`.
- Valid systems: **1–6**.
- Each `(governance, system_id)` resolves to exactly one paired database target.

**Failure signals**
- Pydantic validation error for missing/out-of-range system.
- Key error during target resolution.
- Cross-routed source database.
- Execution-routing tests fail.

**Rectification**
1. Never accept caller-supplied database targets.
2. Repair the server-side system mapping.
3. Verify all 12 mappings.
4. Run `pytest -q tests/test_execution_routing.py`.

---

## C-009 — Database-registration contract

**Owners:** `app/database.py`.

**Invariant**
Twelve workload database environment variables map one-to-one to:
- `DB_AGENTIC_GOV_01` … `DB_AGENTIC_GOV_06`
- `DB_AGENTIC_UNGOV_01` … `DB_AGENTIC_UNGOV_06`

**Failure signals**
- readiness `databases_configured: false`.
- database probe 503.
- dataset execution reports database unavailable.

**Rectification**
1. Identify the specific target from system/governance mapping.
2. Verify the corresponding environment variable exists in Railway.
3. Verify the URL belongs to the intended Neon database.
4. Probe connectivity.
5. Confirm the governed and ungoverned URLs are not accidentally swapped.
6. Re-run execution-routing and dataset tests.

---

## C-010 — Governed database read-only contract

**Owners:** `app/mcp/data_access.py`.

**Invariant**
- Governed reads execute inside `BEGIN READ ONLY`.
- Statement timeout is **5 seconds**.
- Connection timeout is **3 seconds**.
- Transaction is rolled back on completion.
- SQL identifiers are quoted using `psycopg.sql.Identifier`.
- Source schema is fixed server-side to `source`.

**Failure signals**
- `MCPDataUnavailable`.
- `DATABASE_UNAVAILABLE`.
- statement timeout / database unreachable.
- mutation unexpectedly succeeds.

**Rectification**
1. Do not convert the governed transaction to writable.
2. Confirm Neon endpoint and role can read the `source` schema.
3. Confirm PgBouncer/connection mode still supports the explicit transaction behavior.
4. Confirm source tables exist.
5. If timeout is genuine, fix query/data design before increasing the timeout.
6. Run MCP statistics/routing/no-dataset tests.

---

## C-011 — Bounded relational query contract

**Owners:** `app/mcp/data_access.py`, MCP schemas.

**Invariant**
- Sample rows: max 25.
- Query selected columns: max 20.
- Query filters: max 10.
- `in` filter values: 1–50.
- Query rows: max 100.
- Aggregate grouped rows: max 50.
- Statistics rows: max 100.
- Statistics categories: 2–20.

**Failure signals**
- `MCPDataError`.
- empty/truncated result caused by a caller assuming unbounded access.
- model output claims analysis beyond the evidence window.

**Rectification**
1. Keep the bounded contract.
2. Prefer deterministic aggregate/statistics operations over increasing raw row windows.
3. Modify the requested analytical operation rather than exposing a full dataset.
4. Verify UI wording accurately describes bounded evidence.

---

## C-012 — MCP argument-validation contract

**Owners:** `app/mcp/patterns.py`.

**Invariant**
- Max top-level arguments: 25.
- Identifiers: `[A-Za-z_][A-Za-z0-9_]{0,62}`.
- Control characters rejected.
- SQL escape/mutation patterns rejected.
- Role/policy redefinition language rejected unless explicitly permitted by a controlled call.
- Server-controlled keys cannot be supplied by the caller, including database routing/governance/runtime authority values.
- Strings max 100,000 chars.
- Lists max 100 items.
- Nested objects max 25 keys.
- Unsupported argument types rejected.

**Failure signals**
- JSON-RPC `-32602`.
- validation message such as:
  - identifier failed governed regex validation,
  - SQL escape or mutation pattern is not permitted,
  - role/policy redefinition pattern is not permitted,
  - argument is server-controlled,
  - argument/list/object too large.

**Rectification**
1. Determine whether the caller is malformed or the schema and validator drifted.
2. Never make a restricted authority field client-controlled.
3. Normalize the caller payload only if it remains within the published tool schema.
4. Re-run governed MCP routing tests.

---

## C-013 — MCP entity/tool exposure contract

**Owners:** `app/mcp/entities.py`, `app/mcp/routes.py`, CV1.1.

**Invariant**
- `analyst` tools: describe, schema, query, aggregate, statistics, profile, RAG.
- `data_modeler`: same plus sample; read-only workspace.
- `evaluator`/Auditor: no governed MCP dataset tools; reads recorded runs through the audit path.
- `advisor`: describe, query, aggregate, statistics, profile, RAG.
- No mutation MCP tools are exposed.
- `auditor` aliases to `evaluator`.
- A tool may only be invoked through the entity that exposes it.

**Failure signals**
- tool cross-binding succeeds.
- mutation tool appears in `tools/list`.
- evaluator can query source data through MCP.
- `tool is not exposed to ...`.
- CV1.1 `mcp_entity_binding_denied`.

**Rectification**
1. Restore the entity tool matrix.
2. Confirm runtime role and function key remain aligned.
3. Remove accidental mutation/cross-entity exposure.
4. Run `pytest -q tests/test_governed_mcp_routing.py`.

---

## C-014 — MCP database-target binding contract

**Owners:** `policies/cv11.rego`, execution mapping, MCP route.

**Invariant**
For governed MCP calls, system ID maps to the server-derived governed database:
1→`agentic_gov_01` … 6→`agentic_gov_06`.

**Failure signals**
- `mcp_database_target_denied`.
- tool executes against the wrong system database.
- caller attempts to supply database routing.

**Rectification**
1. Verify `ExecutionContext` and server-derived `DatabaseTarget`.
2. Verify the CV1.1 `governed_db_targets` map matches Python mapping.
3. Reject any client-supplied target override.
4. Run policy and execution-routing tests.

---

## C-015 — Data Modeler governed-evidence contract

**Owners:** governed executor, MCP entity matrix, tests.

**Invariant**
The governed Data Modeler must obtain bounded evidence through governed MCP. It must not use the direct Neon fallback.

Expected MCP sequence currently includes:
- `dataset.schema`
- `dataset.profile`
- `dataset.query`
- `dataset.statistics`
- `rag.retrieve`

**Failure signals**
- direct `query_table` path used by Data Modeler.
- `mcp_required` is false.
- MCP tool sequence missing.
- model prompt receives statistics that are supposed to stay outside the prompt.
- `test_data_modeler_requires_bounded_mcp_evidence_path` fails.

**Rectification**
1. Restore Data Modeler routing to `execute_governed_mcp_tool`.
2. Keep deterministic statistics/visualization logic outside the model prompt where specified.
3. Do not fix by allowing direct Neon access.
4. Run Data Modeler MCP and no-dataset tests.

---

## C-016 — Governed/ungoverned isolation contract

**Owners:** governed routes, ungoverned routes, execution mapping, tests.

**Invariant**
- Governed path enforces CV1.1 and governed MCP where required.
- Ungoverned path bypasses CV1.1 by design and does not call governed MCP.
- Ungoverned direct relational reads are labeled `direct.dataset.query`, not MCP.
- Ungoverned prompts remain governance-neutral.
- Data sources are paired by system but isolated by governance.

**Failure signals**
- ungoverned request invokes OPA or governed MCP.
- governed request reaches an ungoverned database.
- ungoverned prompt contains CV1.1 constraints.
- ungoverned direct read is labeled as MCP.

**Rectification**
1. Restore route separation.
2. Verify all 12 DB mappings.
3. Verify telemetry labels reflect the actual execution path.
4. Run `tests/test_ungoverned_isolation.py`, `tests/test_ungoverned_workflow.py`, and execution-routing tests.

---

## C-017 — Dataset-presence contract

**Owners:** governed/ungoverned execution, dataset context.

**Invariant**
- A model must not run when required dataset evidence is unavailable/empty and no valid source context exists.
- Governed empty dataset returns unavailable with `DATASET_EMPTY`.
- Ungoverned paired empty dataset returns unavailable with `DATASET_EMPTY`.
- Database infrastructure failure is represented as unavailable rather than fabricated model analysis.

**Failure signals**
- `execution_state.status = unavailable`
- `DATASET_EMPTY`
- `DATABASE_UNAVAILABLE`
- model call occurs despite no evidence.

**Rectification**
1. Verify correct database target.
2. Verify `source.source_data` exists and contains data.
3. Verify dataset context generation.
4. If manual source context is allowed for that path, validate it is actual evidence rather than schema-only metadata.
5. Never send the model an "empty" analytical task and allow it to invent results.
6. Run `tests/test_no_dataset_guard.py`.

---

## C-018 — Dataset registry contract

**Owners:** `app/datasets.py`, domain profiles, system endpoints.

**Invariant**
- Exactly six established systems/domains are registered.
- Registry metadata must match loaded sources.
- Unknown systems are rejected.
- Provenance must not claim unverified Kaggle sourcing.

**Failure signals**
- count != 6.
- system endpoint 404 for an expected system.
- registry/source mismatch.
- unsupported provenance claim.

**Rectification**
1. Change registry and actual source deployment together.
2. Verify system ID/domain/data binding.
3. Do not infer provenance.
4. Run `tests/test_dataset_registry.py` and system endpoint tests.

---

## C-019 — CV1.1 default-deny contract

**Owners:** `policies/cv11.rego`, `app/cv11.py`.

**Invariant**
- `default allow := false`.
- Governed execution requires a valid OPA decision.
- OPA unreachable, non-200, invalid JSON, missing/malformed decision => fail closed.
- Policy denial => fail closed.

**Failure signals**
- governed API 403 `cv11_policy_denied`.
- governed API 503 `cv11_policy_unavailable`.
- log event `cv11_fail_closed`.

**Rectification**
1. For 403, inspect `reasons`; a denial may be correct behavior.
2. For 503, verify OPA process, `OPA_URL`, policy load, and `/health`.
3. Verify decision path `/v1/data/cv11/gatekeeper/decision`.
4. Validate policy returns a dict containing boolean `allow`.
5. Do not bypass OPA to restore availability.
6. Re-run Rego tests plus governed route tests.

---

## C-020 — CV1.1 role/function binding contract

**Owners:** CV1.1 policy, governed function registry.

**Invariant**
- `analyst` → `analyst_runner`
- `data_modeler` → `data_modeler_runner`
- `evaluator`/`auditor` → `evaluator_runner`
- `advisor` → `advisor_runner`
- chatbot → `chatbot_runner`
- analytics → `analytics_reader`

**Failure signals**
- `role_binding_denied`
- `unknown_governed_function`
- `function_role_binding_denied`

**Rectification**
1. Verify the function registry and policy role maps match.
2. Verify route derives role server-side.
3. Do not accept a client-selected runtime role.
4. Run governed-function and MCP-routing tests.

---

## C-021 — CV1.1 action-authorization contract

**Owners:** `policies/cv11.rego`.

**Invariant**
Each runtime role has an explicit action allowlist. Actions outside that list are denied.

**Failure signal**
- `action_not_permitted_for_role`.

**Rectification**
1. Confirm whether the action belongs to the role's intended responsibility.
2. If not, keep the deny.
3. If the architecture intentionally changes, update the role action list and associated tests/documentation together.
4. Never grant broad wildcard authority.

---

## C-022 — CV1.1 context contract

**Invariant**
Governed policy input must be:
- governance=`governed`,
- workload in `{agentic, analytics}`,
- system ID 1–6.

**Failure signals**
- `governance_mode_must_be_governed`
- `execution_context_invalid`

**Rectification**
Repair the server-side execution context. Do not weaken policy validation.

---

## C-023 — Client system-message prohibition

**Invariant**
A governed `model.chat` request cannot contain a client-supplied message with role `system`.

**Failure signal**
- `client_system_message_forbidden`.

**Rectification**
1. Keep server system prompts server-owned.
2. Convert legitimate caller content to an allowed user/evidence field.
3. Do not permit client-defined system prompts.

---

## C-024 — Redefinition-guard contract

**Owners:** CV1.1 Rego and MCP pattern validation.

**Invariant**
Known attempts to override/redefine policy, role, system prompt, or governance are rejected.

**Failure signals**
- `redefinition_attempt_blocked`
- `role/policy redefinition pattern is not permitted`.

**Rectification**
1. Treat a true redefinition attempt as correct denial.
2. If a false positive occurs in legitimate evidence, isolate evidence as untrusted content rather than disabling the guard globally.
3. Add a regression case before changing any pattern.

---

## C-025 — Model allowlist contract

**Owners:** `app/model_registry.py`, model routes.

**Invariant**
- Requests use internal registry keys.
- Arbitrary provider model IDs are rejected.
- Removed/dynamic aliases are rejected.
- Only agent models may execute agent chat paths where required.
- Registry keys are unique.

**Failure signals**
- unknown model key.
- 404 model catalog lookup.
- arbitrary provider ID rejected.
- registry tests fail.

**Rectification**
1. Add/remove a model in the registry deliberately.
2. Update UI/public choices and tests.
3. Do not allow arbitrary OpenRouter model IDs to bypass registry curation.
4. Run `tests/test_model_registry.py` and `tests/test_model_routes.py`.

---

## C-026 — Model-provider availability contract

**Owners:** OpenRouter client, governed/ungoverned routes, UI Guide failover.

**Invariant**
Provider failure must be represented as unavailable/error and must not be mistaken for a successful analytical run.

**Failure signals**
- execution state ending in `_MODEL_UNAVAILABLE`.
- provider HTTP error.
- UI Guide 502 with `failover_eligible: true`.

**Rectification**
1. Verify model key→provider ID mapping.
2. Verify OpenRouter configuration and account/provider availability.
3. For UI Guide eligible statuses, use only the contracted single failover.
4. For Arena comparative runs, preserve the selected model identity; do not silently substitute another model.
5. Record the failed attempt.

---

## C-027 — Signed audit-persistence gate

**Owners:** governed/ungoverned executors, `app/agentic_run_store.py`.

**Invariant**
**No governed or ungoverned model output is released if the required recording-database write fails.**

**Failure signals**
- governed 503 mentioning signed recording-database write.
- ungoverned 503 mentioning recording-database write.
- `record_agentic_run(...) == False`.

**Rectification**
1. Preserve the 503 fail-closed response.
2. Identify governance path and its recording database configuration.
3. Verify audit HMAC configuration.
4. Verify database connectivity/schema.
5. Verify chain tail.
6. Resolve duplicate run ID if present.
7. Execute a new run; do not retroactively release the blocked output.
8. Run `tests/test_audit_persistence_gate.py` and `tests/test_integrity.py`.

---

## C-028 — Audit integrity-key contract

**Owners:** `app/integrity.py`.

**Invariant**
- Environment: `AGENTIC_AUDIT_HMAC_KEY`.
- Minimum key material: **256 bits / 32 bytes**.
- Key ID: `AGENTIC_AUDIT_HMAC_KEY_ID`, default `v1`, max 128 chars.
- Algorithms: SHA-256 and HMAC-SHA256.

**Failure signals**
- readiness `audit_integrity_configured: false`.
- `signing_key_unavailable`.
- short-key test failure.
- run not recorded due to unconfigured integrity key.

**Rectification**
1. Configure a >=32-byte secret.
2. Keep key ID consistent with the records being verified.
3. Do not put the HMAC key in source code/logs.
4. Run integrity self-test and `/api/v1/system/audit/integrity`.
5. If rotating keys, define an explicit migration/verification strategy before rotation.

---

## C-029 — Audit integrity-envelope contract

**Invariant**
Each signed record contains:
- version,
- SHA-256 payload hash,
- previous event hash,
- event hash,
- HMAC-SHA256 signature,
- chain ID scoped to governance,
- monotonically increasing sequence,
- key ID.

**Failure signals**
Integrity verifier errors including:
- `missing_integrity_envelope`
- `unsupported_integrity_version`
- `unexpected_hash_algorithm`
- `unexpected_mac_algorithm`
- `chain_id_mismatch`
- `invalid_sequence`
- `missing_run_id`
- `missing_key_id`
- `key_id_mismatch`
- `invalid_previous_event_hash`
- `previous_event_hash_mismatch`
- `sequence_mismatch`
- `payload_hash_mismatch`
- `event_hash_mismatch`
- `hmac_mismatch`
- `invalid_hmac_input`
- `invalid_chain_material`

**Rectification**
1. Treat any chain verification error as an integrity incident, not a cosmetic warning.
2. Stop releasing newly generated outputs that cannot be durably appended.
3. Preserve the affected records.
4. Determine whether the cause is configuration/key mismatch, accidental mutation, partial migration, or tampering.
5. Do not rewrite historical records merely to make verification pass.
6. Restore the correct key/config or formally start a new documented chain if recovery of the old chain is impossible.
7. Re-run integrity verification for both governance chains.

---

## C-030 — Governance-separated audit chains

**Invariant**
Governed and ungoverned records use domain-separated HMAC purpose keys and chain IDs.

**Failure signals**
- chain ID mismatch.
- a record verifies only under the opposite governance path.
- governed/ungoverned chain tails are mixed.

**Rectification**
1. Verify correct log database and `governance` value.
2. Verify code did not copy records between chains.
3. Do not merge chains.
4. Run integrity domain-separation tests.

---

## C-031 — Run-record uniqueness and append contract

**Owners:** `app/agentic_run_store.py`.

**Invariant**
- `run_id` must be unique.
- insert conflict does not overwrite existing evidence.
- chain tail must verify before the next signed record is appended.

**Failure signals**
- `duplicate_run_id`.
- `audit_chain_tail_invalid`.
- `audit_chain_tail_incomplete`.
- recording returns false.

**Rectification**
1. Preserve the existing row.
2. Find the run-ID generation defect rather than deleting evidence.
3. For invalid/incomplete tail, investigate chain integrity before appending.
4. Do not use `ON CONFLICT` to update/replace historical evidence.

---

## C-032 — Runtime Logbook contract

**Owners:** run store, system endpoint, UI.

**Invariant**
- Read-only.
- Newest records first.
- Maximum **25** records exposed through the runtime logbook.
- Surface complete stored records for those entries.

**Failure signals**
- >25 records exposed.
- mutation endpoint appears.
- UI omits backend records or alters evidence fields.
- runtime-logbook tests fail.

**Rectification**
1. Restore hard cap and read-only behavior.
2. Verify endpoint/UI field handling.
3. Do not make the logbook the write path.
4. Run `tests/test_runtime_logbook.py`.

---

## C-033 — Telemetry epoch contract

**Owners:** `app/agentic_run_store.py`.

**Invariant**
- Pre-MCP-tuning history remains signed and preserved.
- Current summary analytics exclude archived pre-epoch history where specified.
- Current model summary queries exclude non-model/non-completed calls according to query rules.

**Failure signals**
- historical runs disappear.
- old pre-MCP runs contaminate current comparison metrics.
- archive count/epoch tests fail.

**Rectification**
1. Preserve historical signed records.
2. Repair summary-query filters rather than deleting old rows.
3. Re-run `tests/test_telemetry_epoch.py`.

---

## C-034 — Governed output sanitation contract

**Owners:** `app/verified_evidence.py`, governed routes.

**Invariant**
- Reasoning/scaffold artifacts are removed where detected.
- Governed claim verification is anchored to deterministic evidence.
- Evidence-bound failures are reported instead of inventing values.

**Failure signals**
- reasoning scaffold leaks to public output.
- deterministic metric in output conflicts with verified evidence.
- claim verifier rewrites ordinary narrative incorrectly.
- verified-evidence tests fail.

**Rectification**
1. Identify whether the defect is parsing, deterministic evidence generation, or model-output sanitation.
2. Repair the verifier/sanitizer with a regression test.
3. Do not replace deterministic evidence with a second model judgment.
4. Run `tests/test_verified_evidence.py`.

---

## C-035 — Sensitive-output redaction contract

**Owners:** `app/mcp/patterns.py`, governed routes, verified evidence.

**Invariant**
- Baseline direct identifiers are redacted.
- Finance extends baseline redaction with finance-sensitive identifiers.
- Healthcare extends baseline with PHI-like identifiers/patterns.
- Non-finance/non-healthcare domains still receive baseline privacy handling.

**Failure signals**
- raw account/patient/address/identifier data reaches model/public output.
- structured sensitive field bypasses free-text redaction or vice versa.
- finance/healthcare redaction tests fail.

**Rectification**
1. Contain the output path.
2. Identify whether leak is structured-field, free-text, or verified-evidence generation.
3. Add the missing field/pattern at the correct domain profile.
4. Add a regression test.
5. Re-run finance, healthcare, and verified-evidence tests.

---

## C-036 — RAG retrieval contract

**Owners:** `app/mcp/rag.py`, `app/mcp/data_access.py`.

**Invariant**
- RAG reads only from `source.rag_chunks`.
- Retrieval query passes governed text validation.
- `top_k` is bounded.
- Total returned context characters are bounded.
- Missing RAG store is explicitly unavailable, not silently fabricated.

**Failure signals**
- `RAG store is not initialized; expected source.rag_chunks`.
- governed RAG retrieval failure.
- context exceeds profile bounds.

**Rectification**
1. Confirm whether the system is expected to have a RAG store.
2. If yes, initialize/populate `source.rag_chunks`.
3. If no, handle the unavailable RAG path without inventing retrieval evidence.
4. Keep bounded context limits.

---

## C-037 — Auditor history contract

**Owners:** governed Auditor path, run-store audit history query.

**Invariant**
- Auditor reads historical governed and ungoverned run records through the recording databases.
- Read-only.
- Prior model output is treated as evidence, not instructions.
- Current audit query excludes recursive Auditor operations.
- Per-prior-run output context is bounded.

**Failure signals**
- Auditor recursively audits its own audit runs.
- prior output instructions influence the current system behavior.
- empty history produces fabricated audit findings.
- signed Auditor result cannot be persisted.

**Rectification**
1. Restore audit query exclusions.
2. Preserve prior outputs as untrusted evidence.
3. If history is empty, return unavailable/no-recorded-runs behavior.
4. Verify both integrity chains before relying on historical evidence.
5. Run `tests/test_auditor_history_query.py` and audit-persistence tests.

---

## C-038 — Chatbot disclosure/content boundary

**Owners:** `app/chatbot_guardrails.py`, `app/chatbot_routes.py`.

**Invariant**
The public UI Guide may explain architecture and workflows at a high level but must not reveal:
- raw backend/database rows,
- connection details,
- credentials/secrets/tokens/private keys/HMAC keys,
- hidden/system prompts,
- policy source text,
- internal logs/control records.

It also enforces configured content controls and bounded history.

**Failure signals**
- backend-disclosure guard triggers.
- profanity/explicit-content guard triggers.
- protected material appears in public reply.
- guardrail tests fail.

**Rectification**
1. Preserve the disclosure boundary.
2. If a legitimate public architecture question is blocked, narrow the classifier/guard with a regression test.
3. Never fix a false positive by disabling all disclosure controls.
4. Run `tests/test_chatbot_guardrails.py`.

---

## C-039 — UI Guide governed-workflow contract

**Invariant**
- UI Guide can initiate governed workflows across all six domains.
- Workflow invocation is bounded by the 5,000-token agentic ceiling.
- Selected workflows route through the governed executor.
- Floating UI remains chat-only; workflow execution uses the defined workflow path.
- UI workflow selection offers a bounded set of registry models distinct from the UI Guide chat-binding pair.

**Failure signals**
- UI Guide launches ungoverned execution.
- floating chat directly runs a workflow outside the backend workflow contract.
- unavailable workflow model is returned as a successful run.
- UI Guide tests fail.

**Rectification**
1. Restore workflow routing through the governed executor.
2. Keep UI chat failover separate from workflow-model choice.
3. Re-run `tests/test_ui_guide_agentic_runs.py`.

---

## C-040 — Neutral matched-comparison prompt contract

**Owners:** UI prompts and methodological tests.

**Invariant**
Shared governed vs ungoverned task prompts remain neutral so differences are attributable to execution controls rather than different instructions.

**Failure signal**
- UI prompt-neutrality test fails.
- governed task prompt contains evaluative/governance hints absent from the control prompt.

**Rectification**
1. Restore a shared task prompt.
2. Keep governance instructions in the governed system/control layer rather than altering the analytical task.
3. Run `tests/test_ui_prompt_neutrality.py`.

---

## C-041 — Analytics read contract

**Owners:** analytics routes, CV1.1 analytics role, execution mapping.

**Invariant**
Analytics uses the governed paired source databases through a deterministic read-only path with no model call. Allowed CV1.1 analytics actions are profile/schema/query/aggregate, bound to the governed target for system ID.

**Failure signals**
- analytics invokes a model.
- analytics uses an ungoverned target.
- `analytics_database_target_denied`.
- unauthorized analytics action.

**Rectification**
1. Restore `analytics_reader` role and deterministic read path.
2. Verify system→governed DB mapping.
3. Do not route analytics through agentic model execution.

---

# 3. Failure-mode quick reference

| Failure ID | Signal | Likely contract | First action | Release output? |
|---|---|---|---|---|
| FM-001 | 422 request validation | C-001/C-008 | Compare payload to Pydantic/shared token contract | No |
| FM-002 | 403 `cv11_policy_denied` | C-019–C-024 | Read `reasons`; determine expected denial vs binding drift | No |
| FM-003 | 503 `cv11_policy_unavailable` | C-019 | Check OPA health/config/decision response | No |
| FM-004 | `/ready` 503 | C-007 | Inspect failing readiness boolean | No |
| FM-005 | `DATASET_EMPTY` | C-017 | Verify paired DB/source rows/context | No model output |
| FM-006 | `DATABASE_UNAVAILABLE` | C-009/C-010/C-017 | Verify target env, Neon reachability, source schema | No model output |
| FM-007 | MCP JSON-RPC `-32602` | C-012/C-013 | Validate tool schema, arguments, restricted fields | No |
| FM-008 | MCP `-32003` | C-013/C-014/C-019 | Inspect CV1.1 deny reasons | No |
| FM-009 | MCP `-32004` | C-019 | Restore OPA | No |
| FM-010 | MCP `-32005` | C-010/C-036 | Restore governed data/RAG access | No |
| FM-011 | Model unavailable | C-025/C-026 | Verify registry/provider; apply only contracted failover where allowed | No false success |
| FM-012 | Audit write false / 503 | C-027–C-031 | Restore log DB/integrity chain/key | **No** |
| FM-013 | Integrity verifier error | C-028–C-030 | Treat as integrity incident; preserve records | **No** |
| FM-014 | Proxy 403 | C-004 | Check route allowlist/method/path | No |
| FM-015 | Proxy 413/415 | C-005 | Fix caller/payload contract; don't blindly enlarge limits | No |
| FM-016 | Proxy 502 | C-005/C-026 | Check backend response size/JSON/provider/proxy | No |
| FM-017 | Proxy 504 | C-005 | Check upstream latency/stall; identify blocking dependency | No |
| FM-018 | API auth 401 | C-006 | Fix client/proxy credential presentation | No |
| FM-019 | API auth 503 | C-006 | Configure server API key | No |
| FM-020 | Host 400 | C-006 | Correct production host allowlist | No |
| FM-021 | Rate limit 429 | C-006 | Check caller frequency; retry after header | No |
| FM-022 | Sensitive value in output | C-035 | Contain output, repair redaction, add regression test | No |
| FM-023 | Claim/evidence mismatch | C-034 | Repair deterministic evidence/verifier path | No unverified claim |
| FM-024 | Governed/ungoverned crossover | C-008/C-016 | Stop execution; repair server routing | No |
| FM-025 | Data Modeler direct Neon path | C-015 | Restore governed MCP sequence | No |
| FM-026 | Proxy copies differ | C-004 | Make copies identical and rerun contract tests | No deploy |
| FM-027 | Registry key unknown | C-025 | Correct curated registry/UI binding | No |
| FM-028 | Runtime logbook >25/mutable | C-032 | Restore cap/read-only surface | Stop exposure |
| FM-030 | Full regression fail | Any | Identify owning contract before patching | Engineering review |

---

# 4. Rectification playbooks

## Playbook A — Governed request returns 403

1. Capture request ID and response `detail.reasons`.
2. Match reason:
   - `role_binding_denied`
   - `unknown_governed_function`
   - `function_role_binding_denied`
   - `action_not_permitted_for_role`
   - `execution_context_invalid`
   - `client_system_message_forbidden`
   - `redefinition_attempt_blocked`
   - `token_limit_exceeded`
   - `governed_function_token_limit_exceeded`
   - `governed_chatbot_token_limit_exceeded`
   - `ui_guide_model_binding_denied`
   - `mcp_entity_binding_denied`
   - `mcp_database_target_denied`
   - `analytics_database_target_denied`
3. Decide whether the input was invalid or policy/code bindings drifted.
4. Repair the binding at the source.
5. Run policy tests plus the owning Python contract test.
6. Do not return the denied model output.

## Playbook B — Governed request returns 503 / OPA unavailable

1. Check `/ready` and `/api/v1/system/cv11`.
2. Verify `OPA_URL`.
3. Check OPA `/health`.
4. Verify CV1.1 package and decision path.
5. Validate policy returns `{allow: boolean, ...}`.
6. Re-run Rego tests.
7. Re-run governed execution test.
8. Restore readiness before normal traffic.

## Playbook C — Dataset/database unavailable

1. Determine governance + system ID.
2. Resolve expected `DatabaseTarget`.
3. Map to the expected environment variable.
4. Verify the environment value exists.
5. Verify database network connection.
6. Verify `source` schema.
7. Verify `source_data` or required source tables.
8. Verify read-only role permissions.
9. Execute bounded query/statistics test.
10. Re-run `tests/test_no_dataset_guard.py`.

## Playbook D — MCP tool call rejected

1. Capture JSON-RPC code/message.
2. Verify entity→tool exposure.
3. Verify function/entity/runtime-role match.
4. Verify server-derived DB target.
5. Validate arguments:
   - count,
   - identifiers,
   - restricted keys,
   - string/list/object sizes,
   - mutation/redefinition patterns.
6. Verify data source availability.
7. Re-run governed MCP routing tests.

## Playbook E — Model/provider failure

1. Confirm internal model key.
2. Confirm registry entry and `ModelKind.AGENT`.
3. Confirm provider model ID.
4. Confirm OpenRouter configuration.
5. Capture provider status.
6. UI Guide only: apply single contracted failover if status is eligible.
7. Arena comparison: preserve failure under the selected model; do not silently substitute.
8. Ensure failed attempt is recorded.

## Playbook F — Recording database write fails

1. Do not release output.
2. Identify governed vs ungoverned recording database.
3. Verify logging DB URL/config.
4. Verify HMAC key and key ID.
5. Verify current chain tail.
6. Check duplicate run ID.
7. Check DB errors/schema.
8. Repair.
9. Generate a fresh test run.
10. Verify it is persisted and chain-valid.
11. Run audit-persistence + integrity tests.

## Playbook G — Integrity chain fails verification

1. Stop treating new evidence as trustworthy until the chain issue is understood.
2. Preserve databases and affected records exactly as found.
3. Capture governance chain, run ID, sequence, previous hash, event hash, key ID, and verifier errors.
4. Verify active key/key ID.
5. Determine whether the defect is:
   - wrong key,
   - wrong governance chain,
   - historical record mutation,
   - missing/partial record,
   - sequence discontinuity,
   - migration/configuration defect.
6. Do not edit signed historical payloads to repair hashes.
7. Restore correct verification material or formally document a new chain boundary if required.
8. Re-run full-chain verification for governed and ungoverned stores.

## Playbook H — UI works against direct API but fails publicly

1. Test backend route directly.
2. Test equivalent Vercel proxy route.
3. Compare path/method to `ROUTE_CONTRACTS`.
4. Confirm both proxy copies are identical.
5. Verify backend auth injection.
6. Verify request/response size and content type.
7. Verify timeout.
8. Run contract alignment tests.
9. Redeploy Vercel and retest public route.

# 5. Verification matrix after any contract repair

Minimum post-repair checks:

```text
pytest -q tests/test_contract_alignment.py
pytest -q tests/test_execution_routing.py
pytest -q tests/test_governed_mcp_routing.py
pytest -q tests/test_no_dataset_guard.py
pytest -q tests/test_integrity.py
pytest -q tests/test_audit_persistence_gate.py
pytest -q tests/test_security_middleware.py
pytest -q tests/test_model_registry.py tests/test_model_routes.py
pytest -q tests/test_system_endpoints.py
pytest -q
```

Then verify runtime:

```text
GET /health                         -> 200
GET /ready                          -> 200 / status=ready
GET /api/v1/system/cv11             -> OPA healthy
GET /api/v1/system/audit/integrity  -> configured; governed and ungoverned valid
```

Finally execute:
- one governed bounded run,
- its matched ungoverned control,
- confirm unique run IDs,
- confirm recording succeeded,
- confirm both records appear in the intended stores,
- confirm integrity verification remains valid,
- confirm Runtime Logbook remains read-only and capped at 25.

---

# 6. Change-control rule for contracts

Any intentional contract change should update, in the same change set where applicable:

1. source-of-truth constant/schema,
2. backend consumer,
3. CV1.1 policy,
4. MCP schema/entity definition,
5. proxy route contract,
6. UI consumer,
7. tests,
8. this contract register,
9. deployment configuration/environment variables.

A change is incomplete when the implementation is changed but the tests, policy, UI, or proxy still encode the old contract.

---

# 7. Current source files treated as contract authorities

- `app/contracts.py`
- `app/execution.py`
- `app/main.py`
- `app/middleware.py`
- `app/cv11.py`
- `policies/cv11.rego`
- `app/database.py`
- `app/mcp/data_access.py`
- `app/mcp/patterns.py`
- `app/mcp/entities.py`
- `app/mcp/rag.py`
- `app/governed_routes.py`
- `app/ungoverned_routes.py`
- `app/chatbot_routes.py`
- `app/chatbot_guardrails.py`
- `app/model_registry.py`
- `app/verified_evidence.py`
- `app/integrity.py`
- `app/agentic_run_store.py`
- `api/proxy.js`
- `ui/api/proxy.js`
- all `tests/test_*.py` contract/regression tests.

---

# 8. Next documentation expansion

This baseline captures the executable runtime contracts and their primary failure modes. The next pass should add field-level request/response examples for every public endpoint and JSON-RPC tool, plus a contract ownership/RACI column for an organizational deployment (Product Owner, Technical Risk, Compliance, Engineering, Business Analysis, Quality, and independent Cyber review).