FROM node:22-bookworm-slim AS node_runtime
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update -qq && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=node_runtime /usr/local/bin/node /usr/local/bin/node
COPY --from=node_runtime /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm
WORKDIR /work
COPY . .
ENV PYTHONPATH=/work ALLOW_DIRECT_MODEL_ROUTES=true ENABLE_SYSTEM_DIAGNOSTICS=true API_AUTH_REQUIRED=false API_DOCS_ENABLED=false MAX_REQUEST_BYTES=1048576 RATE_LIMIT_PER_MINUTE=10000
RUN python -m pip install --no-cache-dir -r requirements-dev.txt pip-audit
RUN python -m pip check && python -m compileall -q app scripts
RUN curl -fsSL https://openpolicyagent.org/downloads/v1.20.2/opa_linux_amd64_static -o /usr/local/bin/opa && chmod 755 /usr/local/bin/opa
RUN opa check --strict policies && opa test policies
RUN python -m pytest -q
RUN python -m pip_audit -r requirements.lock
RUN npm --prefix ui ci --no-fund --ignore-scripts
RUN npm --prefix ui audit --audit-level=high
RUN npm --prefix ui run build
RUN node ui/scripts/verify-build.mjs
CMD ["true"]
