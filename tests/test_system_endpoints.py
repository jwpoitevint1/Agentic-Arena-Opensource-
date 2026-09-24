from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app


client = TestClient(app)


def test_root() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"
    assert "x-request-id" in response.headers


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ready(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "all_databases_configured", lambda: True)
    monkeypatch.setattr(main_module, "openrouter_configured", lambda: True)
    monkeypatch.setattr(main_module, "opa_healthy", lambda: True)
    monkeypatch.setattr(main_module, "audit_integrity_ready", lambda: True)

    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_ready_fails_closed_when_a_critical_dependency_is_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(main_module, "all_databases_configured", lambda: True)
    monkeypatch.setattr(main_module, "openrouter_configured", lambda: True)
    monkeypatch.setattr(main_module, "opa_healthy", lambda: False)
    monkeypatch.setattr(main_module, "audit_integrity_ready", lambda: True)

    response = client.get("/ready")
    assert response.status_code == 503
    payload = response.json()
    assert payload["status"] == "not_ready"
    assert payload["cv11_opa_healthy"] is False


def test_dataset_api_exposes_schema_paired_contract() -> None:
    response = client.get("/api/v1/system/datasets")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 6
    assert all(item["schema_status"] == "Schema Paired" for item in payload["datasets"])


def test_governed_function_catalog_exposes_schema_paired_domains() -> None:
    response = client.get("/api/v1/governed/functions")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload["domains"]) == 6
    assert all(item["schema_status"] == "Schema Paired" for item in payload["domains"])
