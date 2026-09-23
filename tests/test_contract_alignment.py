from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.chatbot_routes import WorkflowInvocation
from app.contracts import AGENTIC_MAX_OUTPUT_TOKENS, AGENTIC_MIN_OUTPUT_TOKENS
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
    assert governed.json()["execution_contract"]["max_output_tokens"] == 5000
    assert ungoverned.json()["pairing_contract"]["max_output_tokens"] == 5000


def test_proxy_surfaces_publish_the_same_route_contracts() -> None:
    root_proxy = Path("api/proxy.js").read_text(encoding="utf-8")
    ui_proxy = Path("ui/api/proxy.js").read_text(encoding="utf-8")

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
        assert route_fragment in ui_proxy
    assert "function allowed(path, method)" in root_proxy
    assert "function allowed(path, method)" in ui_proxy


def test_ui_payload_matches_backend_workflow_contract() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")
    assert "Number(maxTokens) >= 2500 && Number(maxTokens) <= 5000" in source
    assert "workflow: { function_key: workflowKey, source_context: null, max_tokens: 5000 }, max_tokens: 5000" in source
    assert 'state="5,000 max"' in source
