from pathlib import Path

from app.governed_routes import (
    _build_modeler_visualization_from_flat_sheet,
    _verified_simple_flat_sheet,
)
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
        "mixed_capability": {
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
    for key in ("analyst", "data_modeler", "mixed_capability", "evaluator", "advisor"):
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


def test_data_modeler_visual_is_runtime_derived_from_verified_flat_sheet() -> None:
    source = Path("app/governed_routes.py").read_text(encoding="utf-8")

    assert "DETERMINISTIC MCP STATISTICS — SERVER-COMPUTED FROM THE SAME BOUNDED SOURCE WINDOW" not in source
    assert "_validate_modeler_visualization(" not in source
    assert "MODELER_VISUAL_REQUIRED" not in source
    assert "_verified_simple_flat_sheet(" in source
    assert "_build_modeler_visualization_from_flat_sheet(" in source
    assert '"source": "verified_simple_flat_sheet"' in source
    assert '"visualization_model_validated": False' in source
    assert '"visualization_runtime_validated": bool(' in source
    assert '"mcp_statistics_provided": statistics_context is not None' in source


def test_verified_flat_sheet_generates_visual_without_model_spec() -> None:
    rows = [
        {"warehouse": "ATL", "cost": 10},
        {"warehouse": "ATL", "cost": 20},
        {"warehouse": "MIA", "cost": 30},
    ]
    statistics = {
        "table": "source_data",
        "sample_row_count": 3,
        "sample_limit": 100,
        "max_categories": 20,
        "columns": {
            "warehouse": {
                "non_null_count": 3,
                "null_count": 0,
                "distinct_count": 2,
                "value_counts": {"ATL": 2, "MIA": 1},
            },
            "cost": {
                "non_null_count": 3,
                "null_count": 0,
                "numeric": {
                    "count": 3,
                    "sum": 60.0,
                    "avg": 20.0,
                    "min": 10.0,
                    "max": 30.0,
                },
            },
        },
    }

    flat_sheet = _verified_simple_flat_sheet(rows=rows, statistics=statistics)
    visual, validation = _build_modeler_visualization_from_flat_sheet(flat_sheet)

    assert flat_sheet["row_count"] == 3
    assert flat_sheet["sha256"]
    assert visual["source"] == "verified_simple_flat_sheet"
    assert visual["source_field"] == "warehouse"
    assert visual["statistic"] == "value_counts"
    assert visual["data"] == [
        {"label": "ATL", "value": 2.0},
        {"label": "MIA", "value": 1.0},
    ]
    assert validation["validated"] is True
    assert validation["model_required"] is False
    assert validation["validator"] == "server_deterministic_flat_sheet"
