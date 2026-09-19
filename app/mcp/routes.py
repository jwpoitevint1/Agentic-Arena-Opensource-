from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

from app.cv11 import CV11PolicyDenied, CV11PolicyUnavailable, enforce_cv11
from app.database import database_url
from app.datasets import dataset_for_system
from app.execution import ExecutionContext, GovernanceMode, WorkloadType, resolve_database_target
from app.mcp.data_access import (
    MCPDataError,
    MCPDataUnavailable,
    aggregate_table,
    profile_source,
    query_table,
    rag_retrieve,
    sample_table,
    source_schema,
)
from app.mcp.entities import MCPEntity, entities, entity_for_key, tool_for_entity
from app.mcp.patterns import (
    governed_output_redaction_enabled,
    redact_governed_payload,
    regex_profile,
    validate_arguments,
)
from app.mcp.rag import rag_profile, retrieval_pattern
from app.model_registry import ModelKind, model_for_key


router = APIRouter(prefix="/mcp/governed", tags=["governed-mcp"])


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class JSONRPCRequest(StrictModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: str | int | None = None
    method: Literal["initialize", "tools/list", "tools/call"]
    params: dict[str, Any] = Field(default_factory=dict)


def _result(request_id: str | int | None, result: object) -> dict[str, object]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id: str | int | None, code: int, message: str, data: object | None = None) -> dict[str, object]:
    payload: dict[str, object] = {"code": code, "message": message}
    if data is not None:
        payload["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": payload}


def _tools_call_params(params: dict[str, Any]) -> tuple[int, str, str, dict[str, Any]]:
    allowed = {"system_id", "model_key", "name", "arguments"}
    if set(params) - allowed:
        raise ValueError("tools/call contains unsupported parameters")
    system_id = params.get("system_id")
    model_key = params.get("model_key")
    name = params.get("name")
    arguments = params.get("arguments", {})
    if not isinstance(system_id, int) or not 1 <= system_id <= 6:
        raise ValueError("system_id must be an integer from 1 through 6")
    if not isinstance(model_key, str) or not model_key:
        raise ValueError("model_key is required")
    if not isinstance(name, str) or not name:
        raise ValueError("tool name is required")
    if not isinstance(arguments, dict):
        raise ValueError("arguments must be an object")
    return system_id, model_key, name, arguments


def _describe(entity_key: MCPEntity, system_id: int, target: object) -> dict[str, object]:
    dataset = dataset_for_system(system_id)
    return {
        "entity": entity_key.value,
        "system_id": system_id,
        "domain": dataset.domain,
        "dataset": dataset.to_dict(),
        "database_target": target.value,
        "database_configured": bool(database_url(target)),
        "database_access": "governed_source_read_only",
        "regex_profile": regex_profile(system_id).to_dict(),
        "rag_profile": rag_profile(entity_key, system_id).to_dict(),
    }


def _execute_tool(*, entity_key: MCPEntity, system_id: int, target: object, tool_name: str, arguments: dict[str, Any]) -> dict[str, object]:
    if tool_name == "dataset.describe":
        return _describe(entity_key, system_id, target)
    if tool_name == "dataset.schema":
        return {"schema": "source", "columns": source_schema(target)}
    if tool_name == "dataset.sample":
        table = arguments.get("table")
        limit = arguments.get("limit", 10)
        if not isinstance(table, str):
            raise MCPDataError("table is required")
        return {"table": table, "rows": sample_table(target, table, int(limit))}
    if tool_name == "dataset.query":
        table = arguments.get("table")
        if not isinstance(table, str):
            raise MCPDataError("table is required")
        columns = arguments.get("select")
        filters = arguments.get("filters")
        limit = arguments.get("limit", 50)
        if columns is not None and not isinstance(columns, list):
            raise MCPDataError("select must be an array")
        if filters is not None and not isinstance(filters, list):
            raise MCPDataError("filters must be an array")
        return {
            "table": table,
            "rows": query_table(target, table=table, columns=columns, filters=filters, limit=int(limit)),
        }
    if tool_name == "dataset.aggregate":
        table = arguments.get("table")
        group_by = arguments.get("group_by")
        measure = arguments.get("measure")
        aggregation = arguments.get("aggregation", "count")
        filters = arguments.get("filters")
        limit = arguments.get("limit", 50)
        if not isinstance(table, str):
            raise MCPDataError("table is required")
        if group_by is not None and not isinstance(group_by, str):
            raise MCPDataError("group_by must be a string")
        if measure is not None and not isinstance(measure, str):
            raise MCPDataError("measure must be a string")
        if filters is not None and not isinstance(filters, list):
            raise MCPDataError("filters must be an array")
        return aggregate_table(
            target,
            table=table,
            group_by=group_by,
            measure=measure,
            aggregation=str(aggregation),
            filters=filters,
            limit=int(limit),
        )
    if tool_name == "dataset.profile":
        table = arguments.get("table")
        if table is not None and not isinstance(table, str):
            raise MCPDataError("table must be a string")
        return profile_source(target, table)
    if tool_name == "rag.retrieve":
        query = arguments.get("query")
        if not isinstance(query, str) or not query.strip():
            raise MCPDataError("query is required")
        profile = rag_profile(entity_key, system_id)
        requested_top_k = arguments.get("top_k", profile.max_top_k)
        top_k = min(int(requested_top_k), profile.max_top_k)
        pattern = retrieval_pattern(entity_key, system_id, query)
        return {
            "pattern": pattern,
            "chunks": rag_retrieve(
                target,
                query=query,
                top_k=top_k,
                max_context_chars=profile.max_context_chars,
            ),
        }
    raise MCPDataError("unsupported MCP tool")


@router.get("/entities")
def list_mcp_entities() -> dict[str, object]:
    return {
        "governance": "CV1.1",
        "entities": [entity.to_dict() for entity in entities()],
        "database_routing": "server-derived governed target only",
    }


@router.post("/{entity_key}")
def governed_mcp(entity_key: str, request: JSONRPCRequest) -> dict[str, object]:
    try:
        entity = entity_for_key(entity_key)
    except KeyError as exc:
        return _error(request.id, -32602, str(exc))

    if request.method == "initialize":
        return _result(
            request.id,
            {
                "protocolVersion": "2025-06-18",
                "serverInfo": {"name": f"agentic-arena-cv11-{entity.key.value}", "version": "1.1"},
                "capabilities": {"tools": {"listChanged": False}},
                "entity": entity.to_dict(),
            },
        )

    if request.method == "tools/list":
        return _result(request.id, {"tools": [tool.to_dict() for tool in entity.tools]})

    try:
        system_id, model_key, tool_name, arguments = _tools_call_params(request.params)
        tool_for_entity(entity, tool_name)
        validate_arguments(arguments)
        model = model_for_key(model_key)
        if model.kind is not ModelKind.AGENT:
            raise ValueError("governed MCP tools require an agent model")

        context = ExecutionContext(
            governance=GovernanceMode.GOVERNED,
            workload=WorkloadType.AGENTIC,
            system_id=system_id,
        )
        target = resolve_database_target(context)
        decision = enforce_cv11(
            context=context,
            action=f"mcp.{tool_name}",
            model_key=model_key,
            content="",
            message_roles=[],
            max_tokens=0,
            runtime_role=entity.runtime_role,
            function_key=entity.key.value,
            mcp_entity=entity.key.value,
            database_target=target.value,
        )
        output = _execute_tool(
            entity_key=entity.key,
            system_id=system_id,
            target=target,
            tool_name=tool_name,
            arguments=arguments,
        )
        sanitized_output, output_redactions = redact_governed_payload(system_id, output)
        if not isinstance(sanitized_output, dict):
            raise MCPDataError("governed output sanitation failed")
        output = sanitized_output
    except CV11PolicyDenied as exc:
        return _error(request.id, -32003, "CV1.1 denied the MCP tool call", {"reasons": list(exc.reasons)})
    except CV11PolicyUnavailable:
        return _error(request.id, -32004, "CV1.1 policy service unavailable; MCP failed closed")
    except MCPDataUnavailable as exc:
        return _error(request.id, -32005, str(exc))
    except (MCPDataError, KeyError, ValueError, TypeError) as exc:
        return _error(request.id, -32602, str(exc))

    return _result(
        request.id,
        {
            "content": [{"type": "text", "text": "Governed MCP tool completed."}],
            "structuredContent": output,
            "isError": False,
            "_meta": {
                "entity": entity.key.value,
                "runtime_role": entity.runtime_role,
                "system_id": system_id,
                "database_target": target.value,
                "cv11": decision.to_dict(),
                "output_redaction": {
                    "enabled": governed_output_redaction_enabled(system_id),
                    "total": sum(output_redactions.values()),
                    "categories": output_redactions,
                },
            },
        },
    )
