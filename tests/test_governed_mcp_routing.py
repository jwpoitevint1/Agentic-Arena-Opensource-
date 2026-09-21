from app.mcp.entities import entity_for_key, tool_for_entity


def test_governed_mcp_function_read_matrix() -> None:
    expected = {
        "analyst": {"dataset.describe", "dataset.schema", "dataset.query", "dataset.profile", "rag.retrieve"},
        "data_modeler": {"dataset.describe", "dataset.schema", "dataset.sample", "dataset.query", "dataset.aggregate", "dataset.profile", "rag.retrieve"},
        "evaluator": {"dataset.describe", "dataset.schema", "dataset.query", "dataset.profile", "rag.retrieve"},
        "advisor": {"dataset.describe", "dataset.query", "dataset.profile", "rag.retrieve"},
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
