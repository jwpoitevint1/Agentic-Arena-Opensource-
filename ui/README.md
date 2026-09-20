# Agentic Arena UI

This directory contains the Vercel-ready frontend for Agentic Arena.

## UI surfaces

The completed frontend exposes eight operator surfaces:

- **Overview** — live backend/CV 1.1 health, six selected domains, the matched-pair design, and the governed execution chain.
- **Arena Lab** — submits the same domain, function, model, task, source context, and token ceiling to governed and ungoverned execution in parallel, then shows both outputs and governed-minus-ungoverned deltas.
- **Evidence** — maintains a browser-local metrics ledger for matched runs and exports metrics-only JSON. Raw model responses, prompts, source context, credentials, and secrets are intentionally not persisted in the local evidence ledger.
- **MCP** — governed MCP console for the Analyst, Data Modeler, Evaluator, and Advisor entities. Tool calls are re-authorized by CV 1.1 server-side; the UI also strips internal target/credential-like fields from the displayed result.
- **Chatbot** — the governed `chatbot_runner` guide using `/api/v1/chatbot/message`.
- **Governance** — displays the CV 1.1 control chain, fail-closed execution posture, role/data/tool boundaries, and ingestion deadman switch.
- **Alignment** — engineering alignment lenses for GDPR, NIST AI RMF/CSF, ISO/IEC 42001/23894/27001/27701, the EU AI Act, and domain overlays without claiming certification or legal compliance.
- **Diagnostics** — read-only browser-to-backend checks for health, readiness, CV 1.1 status, model registry, governed/ungoverned function catalogs, and governed MCP exposure.

Navigation is hash-based so the selected view survives refreshes without requiring client-side routing infrastructure.

## Security boundary

Browser code never receives database credentials, model-provider credentials, or backend secrets. Requests go through a Vercel server-side proxy with an explicit path allowlist.

Optional backend authentication is configured only with server-side Vercel variables:

```text
BACKEND_AUTH_HEADER
BACKEND_AUTH_VALUE
```

Do not expose those values through `VITE_*` variables.

The public mirror uses a placeholder backend host if `BACKEND_URL` is not supplied. Set `BACKEND_URL` explicitly for your deployment. For production, set `BACKEND_URL` explicitly in Vercel.

The frontend keeps experiment evidence intentionally small and non-sensitive: timing, usage, cost, effectiveness, policy version, redaction counts, completion state, and pair deltas. It does not persist raw task text, source context, or model responses in local storage.

## Local development

```bash
cd ui
npm install
npm run dev
```

Vercel Functions are not emulated by plain `vite`. For full proxy behavior locally, use Vercel's local development workflow. Do not put secrets in client-side source.

## Vercel deployment

Two deployment layouts are supported on the `ui-build` branch.

### Repository root

Vercel may remain pointed at the repository root. The root `vercel.json` installs/builds the app in `ui/`, serves `ui/dist`, and uses the root `api/proxy.js` serverless proxy.

### `ui` as project root

Vercel can also be configured with:

```text
Root Directory = ui
```

In that mode `ui/vercel.json` and `ui/api/proxy.js` provide the same frontend/proxy boundary.

Both layouts apply baseline browser security headers. The proxy allowlist includes health/readiness, models, governed/ungoverned execution, chatbot, governed MCP, and approved system status paths.

## Compliance language

The UI deliberately uses **alignment** language. Control mappings do not establish GDPR compliance, ISO certification, NIST conformance, EU AI Act conformity, HIPAA compliance, GLBA compliance, PCI DSS compliance, or any other legal/regulatory status. Those outcomes depend on deployment context, organizational controls, contracts, legal analysis, governance processes, evidence, and where applicable independent assessment.
