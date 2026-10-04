FROM openpolicyagent/opa:1.20.2-static AS opa

FROM python:3.12-slim AS runtime_base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    OPA_URL=http://127.0.0.1:8181

WORKDIR /app

COPY --from=opa /opa /usr/local/bin/opa
COPY requirements.txt requirements.lock ./
RUN pip install --no-cache-dir --requirement requirements.lock

COPY app ./app
COPY api ./api
# One-dataset ingestion utilities are copied for controlled pre-deploy runs.
COPY scripts ./scripts
COPY policies ./policies
COPY config.yaml ./config.yaml

RUN python -m compileall -q app scripts \
    && opa check --strict /app/policies \
    && opa test /app/policies \
    && useradd --create-home --uid 10001 arena \
    && chown -R arena:arena /app

FROM runtime_base AS runtime

USER arena

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/ready', timeout=3)"

CMD ["python", "scripts/start_runtime.py"]
