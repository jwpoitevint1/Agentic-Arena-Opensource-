from pathlib import Path

import pytest
from fastapi import HTTPException

from app.chatbot_routes import (
    ChatbotRequest,
    WorkflowInvocation,
    chatbot_capabilities,
    governed_chatbot,
)


def test_ui_guide_capabilities_expose_all_six_domains() -> None:
    payload = chatbot_capabilities(6)
    domains = payload["domains"]

    assert payload["domain_switching"] is True
    assert [item["system_id"] for item in domains] == [1, 2, 3, 4, 5, 6]
    assert [item["key"] for item in domains] == [
        "finance",
        "environmental_operations",
        "healthcare",
        "retail",
        "aviation",
        "supply_chain",
    ]


def test_ui_guide_workflow_invocation_is_bounded_to_function_ceiling() -> None:
    workflow = WorkflowInvocation(function_key="analyst")
    assert workflow.max_tokens == 5000


def test_ui_guide_launches_selected_domain_through_governed_executor(monkeypatch) -> None:
    captured = {}

    monkeypatch.setattr(
        "app.chatbot_routes._enforce_chatbot_action",
        lambda **kwargs: object(),
    )

    def fake_execute(request, telemetry_operation):
        captured["request"] = request
        captured["telemetry_operation"] = telemetry_operation
        return {
            "result": {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Finance governed run completed.",
                        }
                    }
                ]
            },
            "test_metrics": {"run_id": "G9001"},
            "governed_function": {"mcp_required": False},
            "run_recorded": True,
        }

    monkeypatch.setattr(
        "app.chatbot_routes.execute_governed_function",
        fake_execute,
    )

    response = governed_chatbot(
        ChatbotRequest(
            operation="execute_workflow",
            system_id=1,
            model_key="ling_3_0_flash",
            message="Analyze the finance dataset for notable patterns.",
            workflow=WorkflowInvocation(function_key="analyst", model_key="gemini_3_8_flash"),
            max_tokens=512,
        )
    )

    launched = captured["request"]
    assert launched.system_id == 1
    assert launched.function_key == "analyst"
    assert launched.model_key == "gemini_3_8_flash"
    assert launched.max_tokens == 5000
    assert captured["telemetry_operation"] == "chatbot.execute_workflow"

    run = response["workflow_run"]
    assert run["completed"] is True
    assert run["governance"] == "governed"
    assert run["system_id"] == 1
    assert run["domain"] == "finance"
    assert run["function_key"] == "analyst"
    assert run["run_id"] == "G9001"
    assert run["run_recorded"] is True


def test_floating_ui_guide_is_chat_only_and_keeps_model_failover() -> None:
    source = Path("ui/src/floating-chat.js").read_text(encoding="utf-8")

    for label in (
        "Finance",
        "Environmental Operations",
        "Healthcare",
        "Retail",
        "Aviation",
        "Supply Chain / Freight",
    ):
        assert label in source

    assert 'operation: "chat"' in source
    assert 'system_id: domain.id' in source
    assert "Run Governed" not in source
    assert "cv-chat-run" not in source
    assert "UI_GUIDE_WORKFLOWS" not in source
    assert "UI_GUIDE_RUN_TOKENS" not in source
    assert 'ling_3_0_flash' in source
    assert 'mistral_small_4' in source
    assert 'requestWithFailover' in source
    assert 'isFailoverEligible' in source
    assert 'automatically switched' in source


def test_ui_guide_converts_recorded_model_unavailable_workflow_to_failover_http_error(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.chatbot_routes._enforce_chatbot_action",
        lambda **kwargs: object(),
    )

    monkeypatch.setattr(
        "app.chatbot_routes.execute_governed_function",
        lambda request, telemetry_operation: {
            "execution_state": {
                "status": "unavailable",
                "code": "AUDITOR_MODEL_UNAVAILABLE",
                "message": "The Auditor model call failed.",
            },
            "test_metrics": {"run_id": "GFAIL1"},
            "governed_function": {"mcp_required": False},
            "run_recorded": True,
        },
    )

    with pytest.raises(HTTPException) as exc_info:
        governed_chatbot(
            ChatbotRequest(
                operation="execute_workflow",
                system_id=3,
                model_key="ling_3_0_flash",
                message="Audit the recorded model runs.",
                workflow=WorkflowInvocation(function_key="evaluator"),
                max_tokens=512,
            )
        )

    exc = exc_info.value
    assert exc.status_code == 502
    assert exc.detail["code"] == "ui_guide_model_unavailable"
    assert exc.detail["model_key"] == "ling_3_0_flash"
    assert exc.detail["execution_code"] == "AUDITOR_MODEL_UNAVAILABLE"
    assert exc.detail["failover_eligible"] is True


def test_ui_guide_capabilities_offer_three_registry_workflow_models() -> None:
    payload = chatbot_capabilities(2)
    choices = payload["workflow_model_choices"]

    assert len(choices) == 3
    assert len({item["key"] for item in choices}) == 3
    assert all(item["key"] not in {"ling_3_0_flash", "mistral_small_4"} for item in choices)


def test_chat_workflow_request_returns_three_model_choices_before_execution() -> None:
    response = governed_chatbot(
        ChatbotRequest(
            operation="chat",
            system_id=4,
            model_key="ling_3_0_flash",
            message="Run the analyst workflow on this retail domain.",
            max_tokens=512,
        )
    )

    assert response["operation"] == "chat"
    assert response["chatbot"]["workflow"] == "analyst"
    assert "three random registry options" in response["reply"]
    numbered = [line for line in response["reply"].splitlines() if line[:2] in {"1.", "2.", "3."}]
    assert len(numbered) == 3


def test_chat_model_selection_executes_pending_workflow(monkeypatch) -> None:
    captured = {}

    monkeypatch.setattr(
        "app.chatbot_routes._enforce_chatbot_action",
        lambda **kwargs: object(),
    )

    def fake_execute(request, telemetry_operation):
        captured["request"] = request
        captured["telemetry_operation"] = telemetry_operation
        return {
            "result": {
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "Retail governed run completed.",
                        }
                    }
                ]
            },
            "test_metrics": {"run_id": "G9002"},
            "governed_function": {"mcp_required": False},
            "run_recorded": True,
        }

    monkeypatch.setattr(
        "app.chatbot_routes.execute_governed_function",
        fake_execute,
    )

    response = governed_chatbot(
        ChatbotRequest(
            operation="chat",
            system_id=4,
            model_key="ling_3_0_flash",
            message="Use Gemini 3.8 Flash.",
            history=[
                {
                    "role": "user",
                    "content": "Run the analyst workflow and find the strongest retail pattern.",
                },
                {
                    "role": "assistant",
                    "content": "Choose a model.",
                },
            ],
            max_tokens=512,
        )
    )

    launched = captured["request"]
    assert launched.function_key == "analyst"
    assert launched.model_key == "gemini_3_8_flash"
    assert launched.system_id == 4
    assert launched.task == "Run the analyst workflow and find the strongest retail pattern."
    assert captured["telemetry_operation"] == "chatbot.execute_workflow"
    assert response["workflow_run"]["completed"] is True
    assert response["workflow_run"]["run_id"] == "G9002"
