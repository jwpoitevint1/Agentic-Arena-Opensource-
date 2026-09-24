import logging

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.agentic_run_store import audit_integrity_ready, comparison_runs, runtime_logbook_runs, token_usage_by_model, verify_agentic_run_chain
from app.analytics_routes import router as analytics_router
from app.chatbot_routes import router as chatbot_router
from app.config import settings
from app.cv11 import opa_healthy
from app.database import all_databases_configured, database_url, probe_database, registrations
from app.datasets import dataset_for_system, datasets
from app.execution import ExecutionContext, WorkloadType, resolve_database_target
from app.governed_routes import router as governed_router
from app.mcp.routes import router as mcp_router
from app.middleware import RequestContextMiddleware, RequestSizeLimitMiddleware
from app.model_routes import router as model_router
from app.openrouter import openrouter_configured
from app.ungoverned_routes import router as ungoverned_router


logging.basicConfig(
    level=getattr(logging, settings.server.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

logging.getLogger("agentic_arena.integrity").info(
    "audit_integrity_startup_ready=%s",
    audit_integrity_ready(),
)

_is_production = settings.app.environment.strip().lower() in {"production", "prod"}
_docs_enabled = settings.api.docs_enabled and not _is_production

app = FastAPI(
    title=settings.app.name,
    version=settings.app.version,
    description="Backend foundation for Agentic Arena.",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(RequestSizeLimitMiddleware)

app.include_router(model_router, prefix=settings.api.prefix)
app.include_router(governed_router, prefix=settings.api.prefix)
app.include_router(ungoverned_router, prefix=settings.api.prefix)
app.include_router(chatbot_router, prefix=settings.api.prefix)
app.include_router(mcp_router, prefix=settings.api.prefix)
app.include_router(analytics_router, prefix=settings.api.prefix)

if settings.cors.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors.allowed_origins,
        allow_credentials=settings.cors.allow_credentials,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "X-Request-ID",
            "X-Arena-API-Key",
        ],
    )


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"service": settings.app.name, "version": settings.app.version, "status": "running"}


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app.name, "environment": settings.app.environment}


@app.get("/ready", tags=["system"], response_model=None)
def ready():
    checks = {
        "databases_configured": all_databases_configured(),
        "openrouter_configured": openrouter_configured(),
        "cv11_opa_healthy": opa_healthy(),
        "audit_integrity_configured": audit_integrity_ready(),
    }
    is_ready = all(checks.values())
    payload: dict[str, str | bool] = {
        "status": "ready" if is_ready else "not_ready",
        "service": settings.app.name,
        "version": settings.app.version,
        **checks,
    }
    if not is_ready:
        return JSONResponse(status_code=503, content=payload)
    return payload


@app.get(f"{settings.api.prefix}/system/cv11", tags=["system"])
def cv11_status() -> dict[str, str | bool]:
    return {
        "policy": "CV1.1",
        "decision_engine": "OPA",
        "opa_healthy": opa_healthy(),
        "governed_failure_mode": "fail_closed",
        "ungoverned_control_path": "bypass_cv11",
    }


@app.get(f"{settings.api.prefix}/system/audit/integrity", tags=["system"])
def audit_integrity_status() -> dict[str, object]:
    governed = verify_agentic_run_chain("governed")
    ungoverned = verify_agentic_run_chain("ungoverned")
    return {
        "hash_algorithm": "SHA-256",
        "mac_algorithm": "HMAC-SHA256",
        "configured": audit_integrity_ready(),
        "governed": governed,
        "ungoverned": ungoverned,
    }


@app.get(f"{settings.api.prefix}/system/telemetry/tokens-by-model", tags=["system"])
def telemetry_tokens_by_model() -> dict[str, object]:
    return token_usage_by_model()


@app.get(f"{settings.api.prefix}/system/telemetry/comparison-runs", tags=["system"])
def telemetry_comparison_runs(limit: int = 1000) -> dict[str, object]:
    return comparison_runs(limit)


@app.get(f"{settings.api.prefix}/system/runtime-logbook", tags=["system"])
def runtime_logbook(limit: int = 25) -> dict[str, object]:
    return runtime_logbook_runs(limit)


@app.get(f"{settings.api.prefix}/system/databases", tags=["database"])
def list_database_targets() -> dict[str, object]:
    items = registrations()
    return {
        "count": len(items),
        "configured": sum(1 for item in items if item.configured),
        "targets": [{"target": item.target.value, "configured": item.configured} for item in items],
    }


@app.get(f"{settings.api.prefix}/system/datasets", tags=["datasets"])
def list_datasets() -> dict[str, object]:
    items = datasets()
    return {"count": len(items), "datasets": [item.to_dict() for item in items]}


@app.get(f"{settings.api.prefix}/system/datasets/{{system_id}}", tags=["datasets"])
def get_dataset(system_id: int) -> dict[str, int | str]:
    try:
        return dataset_for_system(system_id).to_dict()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="unknown system_id") from exc


@app.post(f"{settings.api.prefix}/system/database/resolve", tags=["database"])
def resolve_database(context: ExecutionContext) -> dict[str, object]:
    target = resolve_database_target(context)
    result: dict[str, object] = {"target": target.value, "configured": bool(database_url(target))}
    if context.workload is WorkloadType.AGENTIC and context.system_id is not None:
        result["dataset"] = dataset_for_system(context.system_id).to_dict()
    return result


@app.post(f"{settings.api.prefix}/system/database/probe", tags=["database"])
def database_probe(context: ExecutionContext) -> dict[str, str | bool]:
    target = resolve_database_target(context)
    if not database_url(target):
        raise HTTPException(status_code=503, detail="database target is not configured")
    if not probe_database(target):
        raise HTTPException(status_code=503, detail="database target is unreachable")
    return {"target": target.value, "healthy": True}
