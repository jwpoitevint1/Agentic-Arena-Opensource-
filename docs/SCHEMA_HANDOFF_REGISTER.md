# Schema and Service Handoff Register

**Repository:** `jwpoitevint1/Agentic-Arena-Opensource-`  
**Inventory snapshot:** 2026-11-19, default branch `main` (repository tree and README/source paths reviewed)  
**Document status:** engineering inventory; not an approval, successful runtime test, applied migration, production integration, external audit, or certification.

**System:** Agentic Arena open-source distribution. Separate public distribution of research application; code and contracts may diverge from the private Agentic Arena repository.

## Contract ownership and handoff crosswalk

| Boundary | Producer → consumer | Existing contract / owner | Validation or outstanding handoff |
| --- | --- | --- | --- |
| Public UI to backend | `ui/`, `api/proxy.js` -> `app/main.py` | `app/contracts.py` / Pydantic models; no standalone `.schema.json` found | Compare actual routes/fields with private upstream at pinned commits |
| Governance | `app/cv11.py`, `policies/cv11.rego` -> governed execution routes | Rego/policy source, not an independently approved cross-repo schema | Run policy allow/deny and leakage tests for published distribution |
| Research evidence | `app/integrity.py`, `app/agentic_run_store.py` -> telemetry | Source record formats, no verified versioned transport schema | Verify redaction, signing domain, storage and exclusion of private credentials |

## Cross-repository contract protocol

Use [CyberSuite draft schema-handoff register](https://github.com/jwpoitevint1/CI-CD-Checks-and-Cyber-Suite-/blob/feat/dast-zap-staging-worker-20261119/docs/SCHEMA_HANDOFF_REGISTER.md) as the **reference format** for handoff tracking, not as a deployed schema or a substitute for this repository's own contracts. This CyberSuite source lives in **draft PR #76** as of the snapshot date; changes made there have not been merged into CyberSuite `main`.

For each new service handoff, the implementing repository should record the following before a release is called accepted:

1. **Owner and consumer:** exact service/repository, approved environment, version, source commit and entrypoint. A documented relationship is not proof of a configured live connection.
2. **Message contract:** JSON Schema Draft 2020-12 (`$id`, version, required fields, types, `additionalProperties: false` where appropriate) or other explicit versioned format for non-JSON payloads. Distinguish existing schemas from **not yet created** schemas.
3. **Enforcement:** matching Pydantic/types, OpenAPI/client expectations, OPA/Rego decisions, roles, limits, authenticated publisher and input/output validation. Schema validates shape; policy authorizes execution.
4. **Evidence mapping:** correlation ID, timestamps, final status, error categories, idempotency and (when needed) canonical domain-separated HMAC-SHA256 with independent key custody. No claim of immutability from SHA-256 alone.
5. **Acceptance:** synthetic positive and negative tests at every boundary, no unintended downstream calls, migration/readback validation, exact CI results, and deployed SHA/runtime evidence. `DISABLED`, `UNAVAILABLE`, queued and build-success are not security `PASS`.

**Privacy and security:** Never commit production secrets, payment credentials, raw email content, prompts, customer/student PII, unredacted security payloads or deployment access tokens into this register.

## Verified scope and open gates

Open-source code presence does not certify parity, deployment, or release. Never sync secrets or private dataset fixtures from the internal Arena.

**Integration status:** documented from source. Not independently validated against running Railway/Vercel/Neon systems by the creation of this file. Update the register when actual tests, approvals or source-revision evidence exist. Do not silently convert unknown states to implemented/pass.
