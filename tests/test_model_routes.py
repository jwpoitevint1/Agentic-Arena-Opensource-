from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_model_catalog_lists_allowlisted_models() -> None:
    response = client.get("/api/v1/models")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 28
    assert len(payload["models"]) == 28
    assert "openrouter_configured" in payload


def test_model_catalog_returns_one_model() -> None:
    response = client.get("/api/v1/models/gpt_5_6_sol")

    assert response.status_code == 200
    assert response.json()["model_id"] == "openai/gpt-5.6-sol"


def test_model_catalog_rejects_unknown_model() -> None:
    response = client.get("/api/v1/models/not_allowed")

    assert response.status_code == 404
