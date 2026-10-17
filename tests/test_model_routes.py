from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_model_catalog_lists_allowlisted_models() -> None:
    response = client.get("/api/v1/models")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 25
    assert len(payload["models"]) == 25
    assert "openrouter_configured" in payload


def test_model_catalog_returns_one_model() -> None:
    response = client.get("/api/v1/models/gpt_5_6_terra")

    assert response.status_code == 200
    assert response.json()["model_id"] == "openai/gpt-5.6-terra"


def test_model_catalog_rejects_unknown_model() -> None:
    response = client.get("/api/v1/models/not_allowed")

    assert response.status_code == 404


def test_granite_4_2_8b_is_available_to_dual_run_by_exact_registry_identity() -> None:
    response = client.get("/api/v1/models/granite_4_2_8b")

    assert response.status_code == 200
    model = response.json()
    assert model["display_name"] == "Granite 4.2 8B"
    assert model["vendor"] == "IBM"
    assert model["model_id"] == "ibm-granite/granite-4.2-8b"
    assert model["kind"] == "agent"
    assert model["tool_capable"] is True
