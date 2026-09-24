from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.chatbot_routes import WorkflowInvocation
from app.config import settings
from app.contracts import (
    AGENTIC_MAX_OUTPUT_TOKENS,
    AGENTIC_MIN_OUTPUT_TOKENS,
    CHATBOT_MAX_OUTPUT_TOKENS,
    UI_GUIDE_ALLOWED_MODEL_KEYS,
    UI_GUIDE_CHAT_DEFAULT_TOKENS,
    UI_GUIDE_FAILOVER_HTTP_STATUSES,
    UI_GUIDE_FAILOVER_MODEL_KEY,
    UI_GUIDE_PRIMARY_MODEL_KEY,
)
from app.governed_routes import GovernedExecuteRequest
from app.main import app
from app.ungoverned_routes import UngovernedExecuteRequest


client = TestClient(app)


def _execute_payload() -> dict[str, object]:
    return {
        "function_key": "advisor",
        "system_id": 1,
        "model_key": "gpt_5_6_sol",
        "task": "Summarize the supplied operational evidence.",
    }


def test_matched_agentic_output_budget_is_one_shared_contract() -> None:
    governed = GovernedExecuteRequest(**_execute_payload())
    ungoverned = UngovernedExecuteRequest(**_execute_payload())

    assert governed.max_tokens == AGENTIC_MAX_OUTPUT_TOKENS == 5000
    assert ungoverned.max_tokens == AGENTIC_MAX_OUTPUT_TOKENS
    assert AGENTIC_MIN_OUTPUT_TOKENS == 2500

    with pytest.raises(ValidationError):
        GovernedExecuteRequest(**_execute_payload(), max_tokens=5001)
    with pytest.raises(ValidationError):
        UngovernedExecuteRequest(**_execute_payload(), max_tokens=5001)


def test_chatbot_workflow_uses_the_same_agentic_output_budget() -> None:
    workflow = WorkflowInvocation(function_key="advisor")
    assert workflow.max_tokens == AGENTIC_MAX_OUTPUT_TOKENS

    with pytest.raises(ValidationError):
        WorkflowInvocation(function_key="advisor", max_tokens=5001)


def test_function_catalogs_publish_the_same_execution_contract() -> None:
    governed = client.get("/api/v1/governed/functions")
    ungoverned = client.get("/api/v1/ungoverned/functions")

    assert governed.status_code == 200
    assert ungoverned.status_code == 200
    assert governed.json()["execution_contract"] == ungoverned.json()["execution_contract"]
    assert governed.json()["execution_contract"]["min_output_tokens"] == 2500
    assert governed.json()["execution_contract"]["max_output_tokens"] == 5000
    assert ungoverned.json()["pairing_contract"]["max_output_tokens"] == 5000


def test_vercel_proxy_contract_copies_are_identical() -> None:
    root_proxy = Path("api/proxy.js").read_text(encoding="utf-8")
    ui_proxy = Path("ui/api/proxy.js").read_text(encoding="utf-8")

    assert root_proxy == ui_proxy
    for route_fragment in (
        r"^\/health$",
        r"^\/ready$",
        r"^\/api\/v1\/models",
        r"^\/api\/v1\/governed\/",
        r"^\/api\/v1\/ungoverned\/",
        r"^\/api\/v1\/chatbot\/",
        r"^\/api\/v1\/mcp\/governed\/",
        r"^\/api\/v1\/analytics\/",
        r"^\/api\/v1\/system\/",
    ):
        assert route_fragment in root_proxy


def test_ui_payload_matches_backend_workflow_contract() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Number(maxTokens) >= 2500 && Number(maxTokens) <= 5000" in source
    assert "workflow: { function_key: workflowKey, source_context: null, max_tokens: 5000 }, max_tokens: 5000" in source
    assert 'state="5,000 max"' in source


def test_chatbot_token_contract_matches_cv11_and_agentic_workflow_limits() -> None:
    assert settings.chatbot.defaults.max_output_tokens == CHATBOT_MAX_OUTPUT_TOKENS == 2048

    workflow = WorkflowInvocation(function_key="advisor")
    assert workflow.max_tokens == AGENTIC_MAX_OUTPUT_TOKENS == 5000

    policy = Path("policies/cv11.rego").read_text(encoding="utf-8")
    assert 'object.get(input.request, "max_tokens", 0) > 2048' in policy

    ui = Path("ui/src/floating-chat.js").read_text(encoding="utf-8")
    assert f"const UI_GUIDE_CHAT_TOKENS = {UI_GUIDE_CHAT_DEFAULT_TOKENS};" in ui
    assert "UI_GUIDE_RUN_TOKENS" not in ui
    assert "Run Governed" not in ui


def test_ui_guide_model_failover_contract_is_identical_across_api_policy_and_ui() -> None:
    response = client.get("/api/v1/chatbot/capabilities/1")
    assert response.status_code == 200
    contract = response.json()["model_contract"]

    assert contract["strategy"] == "primary_then_single_failover"
    assert contract["primary"]["key"] == UI_GUIDE_PRIMARY_MODEL_KEY
    assert contract["failover"]["key"] == UI_GUIDE_FAILOVER_MODEL_KEY
    assert tuple(contract["allowed_keys"]) == UI_GUIDE_ALLOWED_MODEL_KEYS
    assert tuple(contract["failover_http_statuses"]) == UI_GUIDE_FAILOVER_HTTP_STATUSES

    policy = Path("policies/cv11.rego").read_text(encoding="utf-8")
    ui = Path("ui/src/floating-chat.js").read_text(encoding="utf-8")
    for model_key in UI_GUIDE_ALLOWED_MODEL_KEYS:
        assert model_key in policy
        assert model_key in ui

    assert "ui_guide_model_binding_denied" in policy
    assert "syncModelContract" in ui
    assert "requestWithFailover" in ui


def test_ui_guide_capabilities_publish_three_workflow_model_choices() -> None:
    response = client.get("/api/v1/chatbot/capabilities/1")
    assert response.status_code == 200
    choices = response.json()["workflow_model_choices"]

    assert len(choices) == 3
    assert len({item["key"] for item in choices}) == 3
    assert all(item["key"] not in UI_GUIDE_ALLOWED_MODEL_KEYS for item in choices)
