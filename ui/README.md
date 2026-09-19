# Agentic Arena UI

This directory contains the React/Vite frontend for Agentic Arena.

## Surfaces

- Project overview
- Arena Lab matched-pair execution
- Evidence and comparative telemetry
- Governed MCP console
- Governed UI guide
- Governance controls
- Standards and regulatory alignment views

The public release omits internal deployment diagnostics and deployment-specific identifiers.

## Security boundary

Browser code does not receive database credentials, model-provider credentials, signing keys, or backend secrets. Requests pass through a server-side proxy with an explicit path allowlist. Configure `BACKEND_URL` and any backend authentication values only in server-side environment configuration.

## Local development

```bash
cd ui
npm install
npm run dev
```

Do not place secrets in client-side variables or source files.

## Compliance language

The UI uses alignment language. Framework mappings do not establish legal compliance or certification.
