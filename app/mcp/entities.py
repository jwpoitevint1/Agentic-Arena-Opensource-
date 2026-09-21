from dataclasses import asdict, dataclass
from enum import Enum


class MCPEntity(str, Enum):
    ANALYST = "analyst"
    DATA_MODELER = "data_modeler"
    EVALUATOR = "evaluator"
    ADVISOR = "advisor"


@dataclass(frozen=True)
class MCPTool:
    name: str
    description: str
    input_schema: dict[str, object]

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


@dataclass(frozen=True)
class MCPEntityDefinition:
    key: MCPEntity
    runtime_role: str
    read_only_workspace: bool
    tools: tuple[MCPTool, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "key": self.key.value,
            "runtime_role": self.runtime_role,
            "read_only_workspace": self.read_only_workspace,
            "tools": [tool.to_dict() for tool in self.tools],
        }


DESCRIBE = MCPTool(
    name="dataset.describe",
    description="Describe the entity's authorized governed dataset and retrieval controls.",
    input_schema={"type": "object", "properties": {}, "additionalProperties": False},
)
SCHEMA = MCPTool(
    name="dataset.schema",
    description="Read the source-schema tables and columns from the entity's governed database.",
    input_schema={"type": "object", "properties": {}, "additionalProperties": False},
)
SAMPLE = MCPTool(
    name="dataset.sample",
    description="Read a bounded sample from one source table in the governed database.",
    input_schema={
        "type": "object",
        "properties": {
            "table": {"type": "string"},
            "limit": {"type": "integer", "minimum": 1, "maximum": 25},
        },
        "required": ["table"],
        "additionalProperties": False,
    },
)
QUERY = MCPTool(
    name="dataset.query",
    description="Execute a bounded, server-compiled read-only query against a source table.",
    input_schema={
        "type": "object",
        "properties": {
            "table": {"type": "string"},
            "select": {"type": "array", "items": {"type": "string"}, "maxItems": 20},
            "filters": {"type": "array", "maxItems": 10},
            "limit": {"type": "integer", "minimum": 1, "maximum": 100},
        },
        "required": ["table"],
        "additionalProperties": False,
    },
)
AGGREGATE = MCPTool(
    name="dataset.aggregate",
    description="Run a bounded read-only aggregate for governed dashboard visuals.",
    input_schema={
        "type": "object",
        "properties": {
            "table": {"type": "string"},
            "group_by": {"type": ["string", "null"]},
            "measure": {"type": ["string", "null"]},
            "aggregation": {"type": "string", "enum": ["count", "sum", "avg", "min", "max"]},
            "filters": {"type": "array", "maxItems": 10},
            "limit": {"type": "integer", "minimum": 1, "maximum": 50},
        },
        "required": ["table", "aggregation"],
        "additionalProperties": False,
    },
)
STATISTICS = MCPTool(
    name="dataset.statistics",
    description="Compute deterministic bounded counts and numeric statistics from governed source rows.",
    input_schema={
        "type": "object",
        "properties": {
            "table": {"type": "string"},
            "columns": {"type": "array", "items": {"type": "string"}, "maxItems": 20},
            "limit": {"type": "integer", "minimum": 1, "maximum": 100},
            "max_categories": {"type": "integer", "minimum": 2, "maximum": 20},
        },
        "required": ["table"],
        "additionalProperties": False,
    },
)

PROFILE = MCPTool(
    name="dataset.profile",
    description="Return bounded source-table profile metadata from the governed database.",
    input_schema={
        "type": "object",
        "properties": {"table": {"type": "string"}},
        "additionalProperties": False,
    },
)
RAG_RETRIEVE = MCPTool(
    name="rag.retrieve",
    description="Retrieve bounded evidence chunks from source.rag_chunks in the governed database.",
    input_schema={
        "type": "object",
        "properties": {
            "query": {"type": "string", "minLength": 1, "maxLength": 4000},
            "top_k": {"type": "integer", "minimum": 1, "maximum": 20},
        },
        "required": ["query"],
        "additionalProperties": False,
    },
)


_ENTITIES: dict[MCPEntity, MCPEntityDefinition] = {
    MCPEntity.ANALYST: MCPEntityDefinition(
        key=MCPEntity.ANALYST,
        runtime_role="analyst_runner",
        read_only_workspace=False,
        tools=(DESCRIBE, SCHEMA, QUERY, AGGREGATE, STATISTICS, PROFILE, RAG_RETRIEVE),
    ),
    MCPEntity.DATA_MODELER: MCPEntityDefinition(
        key=MCPEntity.DATA_MODELER,
        runtime_role="data_modeler_runner",
        read_only_workspace=True,
        tools=(DESCRIBE, SCHEMA, SAMPLE, QUERY, AGGREGATE, STATISTICS, PROFILE, RAG_RETRIEVE),
    ),
    MCPEntity.EVALUATOR: MCPEntityDefinition(
        key=MCPEntity.EVALUATOR,
        runtime_role="evaluator_runner",
        read_only_workspace=True,
        tools=(),
    ),
    MCPEntity.ADVISOR: MCPEntityDefinition(
        key=MCPEntity.ADVISOR,
        runtime_role="advisor_runner",
        read_only_workspace=True,
        tools=(DESCRIBE, QUERY, AGGREGATE, STATISTICS, PROFILE, RAG_RETRIEVE),
    ),
}


def entity_for_key(key: str) -> MCPEntityDefinition:
    if key == "auditor":
        key = MCPEntity.EVALUATOR.value
    try:
        entity = MCPEntity(key)
    except ValueError as exc:
        raise KeyError(f"unknown governed MCP entity: {key}") from exc
    return _ENTITIES[entity]


def entities() -> list[MCPEntityDefinition]:
    return [_ENTITIES[key] for key in MCPEntity]


def tool_for_entity(entity: MCPEntityDefinition, tool_name: str) -> MCPTool:
    for tool in entity.tools:
        if tool.name == tool_name:
            return tool
    raise KeyError(f"tool is not exposed to {entity.key.value}: {tool_name}")
