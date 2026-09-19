# Agentic Arena

Agentic Arena is an open-source comparative laboratory for testing governed and ungoverned AI workflows against matched tasks, models, functions, and source data.

The governed path uses CV 1.1, OPA/Rego policy, fixed runtime roles, bounded MCP capabilities, server-selected data targets, deterministic verification, egress controls, and tamper-evident telemetry. The ungoverned path is retained as an experimental control.

## Core design

```text
Task
  |
  +--> Governed path
  |      role/function binding
  |      policy authorization
  |      bounded data/tool access
  |      verified evidence
  |      model execution
  |      output controls
  |      integrity + telemetry
  |
  +--> Ungoverned control
         matched task/model/data window
         model execution
         telemetry
```

The intent is to isolate governance as the treatment variable while holding the comparison inputs as constant as practical.

## Functional roles

The reference implementation includes four bounded functions:

- Analyst
- Data Modeler
- Evaluator / Auditor
- Advisor

Each function is bound to a server-derived runtime role and an allowlisted capability set.

## Domains

The lab supports six paired domains:

- Finance
- Environmental Operations
- Healthcare
- Retail
- Aviation
- Supply Chain / Freight

Reference datasets are intended for testing and demonstration. Sensitive domains are handled with production-like privacy and egress controls on the governed path.

## Security posture

The public reference implementation is designed around external secret storage and least-privilege runtime configuration. Credentials, database connection strings, signing keys, and provider secrets must not be committed to source control.

Controls include request-size limits, host and origin controls, optional API authentication, rate limits, bounded model routes, OPA/Rego authorization, output redaction, and HMAC-SHA256/SHA-256 audit integrity.

This public repository intentionally excludes private deployment identifiers, internal work logs, repair utilities, and deployment-specific operational notes.

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
uvicorn app.main:app --reload
```

The UI is in `ui/`:

```bash
cd ui
npm install
npm run dev
```

Use `.env.example` and `ui/.env.example` as templates. Replace placeholders only in local or managed secret storage.

## Project posture

Agentic Arena is an experimental engineering project. Regulatory and standards mappings are alignment aids, not certification, legal advice, or a claim of compliance.

## License

Licensed under the Apache License, Version 2.0. See `LICENSE`.
