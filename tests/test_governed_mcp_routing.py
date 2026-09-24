from pathlib import Path

from app.governed_routes import _visualization_spec_from_statistics
from app.mcp.entities import entity_for_key, tool_for_entity


def test_governed_mcp_function_read_matrix() -> None:
    expected = {
        "analyst": {
            "dataset.describe", "dataset.schema", "dataset.query", "dataset.aggregate",
            "dataset.statistics", "dataset.profile", "rag.retrieve",
        },
        "data_modeler": {
            "dataset.describe", "dataset.schema", "dataset.sample", "dataset.query",
            "dataset.aggregate", "dataset.statistics", "dataset.profile", "rag.retrieve",
        },
        "evaluator": set(),
        "advisor": {
            "dataset.describe", "dataset.query", "dataset.aggregate",
            "dataset.statistics", "dataset.profile", "rag.retrieve",
        },
    }
    for key, tools in expected.items():
        entity = entity_for_key(key)
        assert {tool.name for tool in entity.tools} == tools


def test_no_governed_mcp_mutation_tools_are_exposed() -> None:
    forbidden = {
        "dataset.insert", "dataset.update", "dataset.delete", "dataset.write",
        "dataset.upsert", "dataset.drop", "dataset.alter", "sql.execute",
    }
    for key in ("analyst", "data_modeler", "evaluator", "advisor"):
        exposed = {tool.name for tool in entity_for_key(key).tools}
        assert exposed.isdisjoint(forbidden)


def test_function_specific_tools_cannot_cross_bind() -> None:
    analyst = entity_for_key("analyst")
    modeler = entity_for_key("data_modeler")
    try:
        tool_for_entity(analyst, "dataset.sample")
        assert False, "analyst must not receive dataset.sample"
    except KeyError:
        pass
    assert tool_for_entity(modeler, "dataset.query").name == "dataset.query"
    assert tool_for_entity(modeler, "dataset.aggregate").name == "dataset.aggregate"


def test_data_modeler_mcp_declares_modeling_only_scope() -> None:
    modeler = entity_for_key("data_modeler")

    assert modeler.scope_instruction == (
        "Your job is that of a data modeler: ONLY create a relational data model representation of how the supplied data is organized, stored, and related. Do nothing else."
    )


def test_mcp_statistics_promote_to_deterministic_visualization() -> None:
    spec = _visualization_spec_from_statistics(
        {
            "sample_row_count": 100,
            "columns": {
                "loan_status": {
                    "non_null_count": 100,
                    "null_count": 0,
                    "distinct_count": 3,
                    "value_counts": {"approved": 45, "pending": 30, "rejected": 25},
                }
            },
        }
    )

    assert spec is not None
    assert spec["source"] == "mcp.dataset.statistics"
    assert spec["type"] == "bar"
    assert spec["title"] == "Loan Status distribution (bounded n=100)"
    assert spec["data"] == [
        {"label": "approved", "value": 45.0},
        {"label": "pending", "value": 30.0},
        {"label": "rejected", "value": 25.0},
    ]


def test_numeric_statistics_have_visualization_fallback() -> None:
    spec = _visualization_spec_from_statistics(
        {
            "sample_row_count": 100,
            "columns": {
                "age": {
                    "numeric": {"count": 100, "min": 18, "avg": 42.5, "max": 85}
                }
            },
        }
    )

    assert spec is not None
    assert spec["data"] == [
        {"label": "MIN", "value": 18.0},
        {"label": "AVG", "value": 42.5},
        {"label": "MAX", "value": 85.0},
    ]


def test_data_modeler_statistics_stay_outside_model_prompt() -> None:
    source = Path("app/governed_routes.py").read_text(encoding="utf-8")

    assert "DETERMINISTIC MCP STATISTICS — SERVER-COMPUTED FROM THE SAME BOUNDED SOURCE WINDOW" not in source
    assert "visualization_spec = _visualization_spec_from_statistics(statistics_payload)" in source
    assert '"mcp_statistics_provided": statistics_context is not None' in source
