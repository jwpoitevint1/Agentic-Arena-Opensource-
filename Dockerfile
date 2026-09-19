FROM openpolicyagent/opa:1.20.2-static AS opa

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    OPA_URL=http://127.0.0.1:8181

WORKDIR /app

COPY --from=opa /opa /usr/local/bin/opa
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

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

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/health', timeout=3)"

CMD ["sh", "-c", "opa run --server --addr=127.0.0.1:8181 --skip-version-check /app/policies & exec uvicorn app.main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000} --log-level ${LOG_LEVEL:-info}"]
