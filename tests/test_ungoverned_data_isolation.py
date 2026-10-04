from pathlib import Path


def test_ungoverned_route_does_not_import_governed_mcp_data_access() -> None:
    source = Path("app/ungoverned_routes.py").read_text(encoding="utf-8")

    assert "app.mcp.data_access" not in source
    assert "neon_dataset_context" not in source
    assert "query_table(" not in source
    assert "ungoverned_dataset_context" in source
    assert "read_source_rows" in source


def test_ungoverned_data_access_is_independent_of_mcp_package() -> None:
    source = Path("app/ungoverned_data_access.py").read_text(encoding="utf-8")

    assert "from app.mcp" not in source
    assert "import app.mcp" not in source
    assert "BEGIN READ ONLY" in source
    assert "source.source_data" in source


def test_ungoverned_metadata_states_direct_access() -> None:
    source = Path("app/ungoverned_routes.py").read_text(encoding="utf-8")

    assert '"data_access_mode": "direct_server_read"' in source
    assert '"cv11_enforced": False' in source
    assert '"opa_called": False' in source
    assert '"mcp_called": False' in source
