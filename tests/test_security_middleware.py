from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_security_headers_are_present() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cross-origin-opener-policy"] == "same-origin"
    assert response.headers["cross-origin-resource-policy"] == "same-origin"


def test_valid_request_id_is_preserved() -> None:
    response = client.get("/health", headers={"x-request-id": "arena-test-123"})
    assert response.status_code == 200
    assert response.headers["x-request-id"] == "arena-test-123"


def test_untrusted_host_is_rejected(monkeypatch) -> None:
    monkeypatch.setenv("ALLOWED_HOSTS", "arena.example")
    blocked = client.get("/health", headers={"host": "evil.example"})
    allowed = client.get("/health", headers={"host": "arena.example"})
    assert blocked.status_code == 400
    assert allowed.status_code == 200


def test_api_key_enforcement_fails_closed_when_enabled(monkeypatch) -> None:
    monkeypatch.setenv("API_AUTH_REQUIRED", "true")
    monkeypatch.setenv("ARENA_API_KEY", "unit-test-secret")

    blocked = client.get("/api/v1/system/datasets")
    allowed = client.get(
        "/api/v1/system/datasets",
        headers={"x-arena-api-key": "unit-test-secret"},
    )

    assert blocked.status_code == 401
    assert allowed.status_code == 200


def test_direct_model_post_routes_can_be_disabled(monkeypatch) -> None:
    monkeypatch.setenv("ALLOW_DIRECT_MODEL_ROUTES", "false")
    response = client.post("/api/v1/models/chat/completions", json={})
    assert response.status_code == 404


def test_database_diagnostics_can_be_disabled(monkeypatch) -> None:
    monkeypatch.setenv("ENABLE_SYSTEM_DIAGNOSTICS", "false")
    response = client.post("/api/v1/system/database/probe", json={})
    assert response.status_code == 404


def test_unsupported_methods_are_rejected() -> None:
    response = client.put("/api/v1/system/datasets", json={})
    assert response.status_code == 405


def test_global_rate_limit_is_enforced(monkeypatch) -> None:
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "1")
    headers = {"x-forwarded-for": "1.1.1.1"}

    first = client.get("/api/v1/system/datasets", headers=headers)
    second = client.get("/api/v1/system/datasets", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 429


def test_large_request_body_is_rejected() -> None:
    body = "x" * 1_100_000
    response = client.post(
        "/api/v1/chatbot/message",
        content=body,
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 413
