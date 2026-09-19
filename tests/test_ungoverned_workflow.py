from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_ungoverned_catalog_mirrors_four_functions() -> None:
    response = client.get("/api/v1/ungoverned/functions")

    assert response.status_code == 200
    payload = response.json()
    assert payload["governance"] == "ungoverned"
    assert payload["cv11_enforced"] is False
    assert payload["count"] == 4
    assert [item["key"] for item in payload["functions"]] == [
        "analyst",
        "data_modeler",
        "evaluator",
        "advisor",
    ]


def test_ungoverned_domain_routes_to_ungoverned_database() -> None:
    response = client.get("/api/v1/ungoverned/functions/1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["system_id"] == 1
    assert payload["database_target"] == "agentic_ungov_01"
    assert payload["cv11_enforced"] is False
