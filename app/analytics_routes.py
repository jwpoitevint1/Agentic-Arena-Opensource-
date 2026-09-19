from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.cv11 import CV11PolicyDenied, CV11PolicyUnavailable, enforce_cv11
from app.execution import ExecutionContext, GovernanceMode, WorkloadType, resolve_database_target
from app.mcp.data_access import (
    MCPDataError,
    MCPDataUnavailable,
    aggregate_table,
    profile_source,
    query_table,
    source_schema,
)
from app.mcp.patterns import redact_governed_payload


router = APIRouter(prefix="/analytics", tags=["analytics"])


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class DatasetRequest(StrictModel):
    system_id: int = Field(ge=1, le=6)
    governance: Literal["governed", "ungoverned"] = "governed"
    table: str | None = None


class QueryRequest(StrictModel):
    system_id: int = Field(ge=1, le=6)
    governance: Literal["governed", "ungoverned"] = "governed"
    table: str = Field(min_length=1, max_length=63)
    select: list[str] | None = Field(default=None, max_length=20)
    filters: list[dict[str, Any]] | None = Field(default=None, max_length=10)
    limit: int = Field(default=100, ge=1, le=100)


class AggregateRequest(StrictModel):
    system_id: int = Field(ge=1, le=6)
    governance: Literal["governed", "ungoverned"] = "governed"
    table: str = Field(min_length=1, max_length=63)
    group_by: str | None = Field(default=None, max_length=63)
    measure: str | None = Field(default=None, max_length=63)
    aggregation: Literal["count", "sum", "avg", "min", "max"] = "count"
    filters: list[dict[str, Any]] | None = Field(default=None, max_length=10)
    limit: int = Field(default=25, ge=1, le=50)


def _context(system_id: int, governance: str) -> ExecutionContext:
    return ExecutionContext(
        governance=GovernanceMode(governance),
        workload=WorkloadType.ANALYTICS,
        system_id=system_id,
    )


def _authorize(system_id: int, governance: str, action: str):
    context = _context(system_id, governance)
    target = resolve_database_target(context)
    try:
        decision = enforce_cv11(
            context=context,
            action=action,
            model_key=None,
            content="",
            message_roles=[],
            max_tokens=0,
            runtime_role="analytics_reader",
            database_target=target.value,
        )
    except CV11PolicyDenied as exc:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "cv11_policy_denied",
                "message": "CV1.1 denied the analytics data request.",
                "reasons": list(exc.reasons),
            },
        ) from exc
    except CV11PolicyUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "cv11_policy_unavailable",
                "message": "Analytics failed closed because CV1.1 was unavailable.",
            },
        ) from exc
    return target, decision


def _sanitize(system_id: int, governance: str, payload: dict[str, Any]) -> dict[str, Any]:
    # Apply the same display-level redaction to both sides so the human comparison
    # does not create a privacy asymmetry unrelated to the underlying data source.
    sanitized, counts = redact_governed_payload(system_id, payload)
    if not isinstance(sanitized, dict):
        raise HTTPException(status_code=500, detail="analytics output sanitation failed")
    sanitized["_analytics"] = {
        "mode": "deterministic_read_only",
        "governance": governance,
        "ai_model_used": False,
        "output_redactions": {
            "total": sum(counts.values()),
            "categories": counts,
        },
    }
    return sanitized


def _data_error(exc: Exception) -> HTTPException:
    if isinstance(exc, MCPDataUnavailable):
        return HTTPException(status_code=503, detail=str(exc))
    return HTTPException(status_code=400, detail=str(exc))


@router.post("/profile")
def analytics_profile(request: DatasetRequest) -> dict[str, Any]:
    target, decision = _authorize(request.system_id, request.governance, "analytics.dataset.profile")
    try:
        payload = profile_source(target, request.table)
    except (MCPDataUnavailable, MCPDataError) as exc:
        raise _data_error(exc) from exc
    result = _sanitize(request.system_id, request.governance, payload)
    result["_analytics"]["cv11"] = decision.to_dict()
    return result


@router.post("/schema")
def analytics_schema(request: DatasetRequest) -> dict[str, Any]:
    target, decision = _authorize(request.system_id, request.governance, "analytics.dataset.schema")
    try:
        payload = {"schema": "source", "columns": source_schema(target)}
    except (MCPDataUnavailable, MCPDataError) as exc:
        raise _data_error(exc) from exc
    result = _sanitize(request.system_id, request.governance, payload)
    result["_analytics"]["cv11"] = decision.to_dict()
    return result


@router.post("/query")
def analytics_query(request: QueryRequest) -> dict[str, Any]:
    target, decision = _authorize(request.system_id, request.governance, "analytics.dataset.query")
    try:
        payload = {
            "table": request.table,
            "rows": query_table(
                target,
                table=request.table,
                columns=request.select,
                filters=request.filters,
                limit=request.limit,
            ),
        }
    except (MCPDataUnavailable, MCPDataError, ValueError, TypeError) as exc:
        raise _data_error(exc) from exc
    result = _sanitize(request.system_id, request.governance, payload)
    result["_analytics"]["cv11"] = decision.to_dict()
    return result


@router.post("/aggregate")
def analytics_aggregate(request: AggregateRequest) -> dict[str, Any]:
    target, decision = _authorize(request.system_id, request.governance, "analytics.dataset.aggregate")
    try:
        payload = aggregate_table(
            target,
            table=request.table,
            group_by=request.group_by,
            measure=request.measure,
            aggregation=request.aggregation,
            filters=request.filters,
            limit=request.limit,
        )
    except (MCPDataUnavailable, MCPDataError, ValueError, TypeError) as exc:
        raise _data_error(exc) from exc
    result = _sanitize(request.system_id, request.governance, payload)
    result["_analytics"]["cv11"] = decision.to_dict()
    return result
