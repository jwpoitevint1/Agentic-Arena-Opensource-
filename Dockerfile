FROM openpolicyagent/opa:1.20.2-static AS opa

FROM python:3.12-slim AS verification

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    OPA_URL=http://127.0.0.1:8181

WORKDIR /app

COPY --from=opa /opa /usr/local/bin/opa
COPY requirements.txt requirements.lock requirements-dev.txt ./
RUN pip install --no-cache-dir --requirement requirements-dev.txt pip-audit

COPY app ./app
COPY api ./api
COPY scripts ./scripts
COPY policies ./policies
COPY tests ./tests
COPY ui ./ui
COPY config.yaml ./config.yaml

RUN python -m compileall -q app scripts \
    && opa check --strict /app/policies \
    && opa test /app/policies \
    && ALLOW_DIRECT_MODEL_ROUTES=true \
       ENABLE_SYSTEM_DIAGNOSTICS=true \
       API_AUTH_REQUIRED=false \
       API_DOCS_ENABLED=false \
       MAX_REQUEST_BYTES=1048576 \
       RATE_LIMIT_PER_MINUTE=10000 \
       pytest -q \
    && pip-audit -r requirements.lock \
    && touch /verification-passed

FROM node:22-slim AS ui_verification

WORKDIR /ui

COPY ui/package.json ui/package-lock.json ./
RUN npm ci --no-fund --ignore-scripts

COPY ui ./
RUN npm audit --audit-level=high \
    && npm run build \
    && touch /ui-verification-passed

FROM python:3.12-slim AS runtime

COPY --from=verification /verification-passed /verification-passed
COPY --from=ui_verification /ui-verification-passed /ui-verification-passed

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OPA_URL=http://127.0.0.1:8181

WORKDIR /app

COPY --from=opa /opa /usr/local/bin/opa
COPY requirements.txt requirements.lock ./
RUN pip install --no-cache-dir --requirement requirements.lock

COPY app ./app
# One-dataset ingestion utilities are copied for controlled pre-deploy runs.
COPY scripts ./scripts
COPY policies ./policies
COPY config.yaml ./config.yaml

RUN python -m compileall -q app scripts \
    && opa check --strict /app/policies \
    && opa test /app/policies \
    && useradd --create-home --uid 10001 arena \
    && chown -R arena:arena /app

USER arena

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/ready', timeout=3)"

CMD ["python", "scripts/start_runtime.py"]
