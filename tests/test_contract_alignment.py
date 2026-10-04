import json
import re
from pathlib import Path
from urllib.parse import urlsplit

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.routing import Match

from app.chatbot_routes import WorkflowInvocation
from app.config import settings
from app.contracts import (
    AGENTIC_EVIDENCE_ROW_LIMIT,
    AGENTIC_MAX_OUTPUT_TOKENS,
    AGENTIC_MIN_OUTPUT_TOKENS,
    AGENTIC_PAIRING_CONTRACT,
    AGENTIC_PROFILE_COLUMN_LIMIT,
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


_PROXY_ENTRY_RE = re.compile(
    r'\{\s*pattern:\s*/(?P<pattern>\^.*?\$)/,\s*methods:\s*new Set\(\[(?P<methods>[^\]]+)\]\)\s*\}'
)


def _proxy_contracts(source: str) -> list[tuple[re.Pattern[str], set[str]]]:
    contracts: list[tuple[re.Pattern[str], set[str]]] = []
    for match in _PROXY_ENTRY_RE.finditer(source):
        pattern = match.group("pattern").replace(r"\/", "/")
        methods = set(re.findall(r'"([A-Z]+)"', match.group("methods")))
        contracts.append((re.compile(pattern), methods))
    assert contracts, "proxy route contract table could not be parsed"
    return contracts


def _proxy_allows(contracts: list[tuple[re.Pattern[str], set[str]]], path: str, method: str) -> bool:
    pathname = urlsplit(path).path
    effective_method = "GET" if method == "HEAD" else method
    return any(
        pattern.fullmatch(pathname)
        and (method == "OPTIONS" or effective_method in methods)
        for pattern, methods in contracts
    )


def _backend_allows(path: str, method: str) -> bool:
    pathname = urlsplit(path).path
    scope = {"type": "http", "path": pathname, "method": method}
    return any(route.matches(scope)[0] is Match.FULL for route in app.routes)


_UI_PROXY_CASES = (
    ("GET", "/health"),
    ("GET", "/ready"),
    ("GET", "/api/v1/models"),
    ("GET", "/api/v1/models/gpt_5_6_sol"),
    ("GET", "/api/v1/governed/functions"),
    ("GET", "/api/v1/governed/functions/6"),
    ("POST", "/api/v1/governed/execute"),
    ("POST", "/api/v1/governed/auditor/execute"),
    ("GET", "/api/v1/ungoverned/functions"),
    ("GET", "/api/v1/ungoverned/functions/6"),
    ("POST", "/api/v1/ungoverned/execute"),
    ("POST", "/api/v1/ungoverned/auditor/execute"),
    ("GET", "/api/v1/chatbot/capabilities/6"),
    ("POST", "/api/v1/chatbot/message"),
    ("GET", "/api/v1/mcp/governed/entities"),
    ("POST", "/api/v1/mcp/governed/analyst"),
    ("POST", "/api/v1/mcp/governed/data_modeler"),
    ("POST", "/api/v1/mcp/governed/mixed_capability"),
    ("POST", "/api/v1/mcp/governed/evaluator"),
    ("POST", "/api/v1/mcp/governed/auditor"),
    ("POST", "/api/v1/mcp/governed/advisor"),
    ("POST", "/api/v1/analytics/profile"),
    ("POST", "/api/v1/analytics/schema"),
    ("POST", "/api/v1/analytics/query"),
    ("POST", "/api/v1/analytics/aggregate"),
    ("GET", "/api/v1/system/cv11"),
    ("GET", "/api/v1/system/audit/integrity"),
    ("GET", "/api/v1/system/telemetry/tokens-by-model"),
    ("GET", "/api/v1/system/telemetry/comparison-runs?limit=2000"),
    ("GET", "/api/v1/system/runtime-logbook?limit=25"),
    ("GET", "/api/v1/system/databases"),
    ("GET", "/api/v1/system/datasets"),
    ("GET", "/api/v1/system/datasets/6"),
    ("POST", "/api/v1/system/database/resolve"),
    ("POST", "/api/v1/system/database/probe"),
)


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



def test_governed_and_ungoverned_publish_identical_pairing_contracts() -> None:
    governed = client.get("/api/v1/governed/functions")
    ungoverned = client.get("/api/v1/ungoverned/functions")

    assert governed.status_code == 200
    assert ungoverned.status_code == 200
    assert governed.json()["pairing_contract"] == ungoverned.json()["pairing_contract"]
    assert governed.json()["pairing_contract"] == json.loads(json.dumps(AGENTIC_PAIRING_CONTRACT))
    assert governed.json()["pairing_contract"]["evidence_row_limit"] == AGENTIC_EVIDENCE_ROW_LIMIT == 100
    assert governed.json()["pairing_contract"]["profile_column_limit"] == AGENTIC_PROFILE_COLUMN_LIMIT == 200


def test_domain_catalogs_publish_identical_pairing_contracts() -> None:
    for system_id in range(1, 7):
        governed = client.get(f"/api/v1/governed/functions/{system_id}")
        ungoverned = client.get(f"/api/v1/ungoverned/functions/{system_id}")

        assert governed.status_code == 200
        assert ungoverned.status_code == 200
        assert governed.json()["pairing_contract"] == ungoverned.json()["pairing_contract"]


def test_pairing_contract_allows_only_declared_runtime_differences() -> None:
    assert set(AGENTIC_PAIRING_CONTRACT["allowed_differences"]) == {
        "governance_enforcement",
        "opa_policy_gate",
        "data_access_implementation",
        "mcp_tool_boundary",
        "governed_only_verification",
        "governed_output_sanitation",
        "governed_output_redaction",
    }
    assert AGENTIC_PAIRING_CONTRACT["same_function"] is True
    assert AGENTIC_PAIRING_CONTRACT["same_system_and_dataset"] is True
    assert AGENTIC_PAIRING_CONTRACT["same_model_key"] is True
    assert AGENTIC_PAIRING_CONTRACT["same_task_and_source_context"] is True
    assert AGENTIC_PAIRING_CONTRACT["same_evidence_row_limit"] is True
    assert AGENTIC_PAIRING_CONTRACT["same_profile_column_limit"] is True
    assert AGENTIC_PAIRING_CONTRACT["same_max_tokens"] is True


def test_vercel_proxy_contract_copies_are_identical() -> None:
    root_proxy = Path("api/proxy.js").read_text(encoding="utf-8")
    ui_proxy = Path("ui/api/proxy.js").read_text(encoding="utf-8")

    assert root_proxy == ui_proxy
    root_contracts = _proxy_contracts(root_proxy)
    ui_contracts = _proxy_contracts(ui_proxy)
    assert [(item.pattern, methods) for item, methods in root_contracts] == [
        (item.pattern, methods) for item, methods in ui_contracts
    ]


def test_ui_proxy_routes_match_real_fastapi_routes_and_methods() -> None:
    contracts = _proxy_contracts(Path("api/proxy.js").read_text(encoding="utf-8"))

    for method, path in _UI_PROXY_CASES:
        assert _proxy_allows(contracts, path, method), f"proxy blocks contracted UI route: {method} {path}"
        assert _backend_allows(path, method), f"backend is missing contracted UI route: {method} {path}"

    # Provider-facing model mutation routes exist in FastAPI but are intentionally
    # not browser/proxy routes. The UI must use governed execution/chatbot paths.
    for path in (
        "/api/v1/models/chat/completions",
        "/api/v1/models/embeddings",
        "/api/v1/models/rerank",
        "/api/v1/models/speech",
    ):
        assert not _proxy_allows(contracts, path, "POST")


def test_vercel_proxy_runtime_contracts_match_between_root_and_ui_projects() -> None:
    root = json.loads(Path("vercel.json").read_text(encoding="utf-8"))
    ui = json.loads(Path("ui/vercel.json").read_text(encoding="utf-8"))

    assert root["functions"]["api/proxy.js"] == ui["functions"]["api/proxy.js"]
    assert root["headers"] == ui["headers"]
    assert root["functions"]["api/proxy.js"]["maxDuration"] == 150

    proxy = Path("api/proxy.js").read_text(encoding="utf-8")
    main_ui = Path("ui/src/main.jsx").read_text(encoding="utf-8")
    assert "const UPSTREAM_TIMEOUT_MS = 120000;" in proxy
    assert "options.timeoutMs || 130000" in main_ui


def test_proxy_auth_header_and_api_prefix_are_one_contract() -> None:
    proxy = Path("api/proxy.js").read_text(encoding="utf-8")
    middleware = Path("app/middleware.py").read_text(encoding="utf-8")
    ui_env = Path("ui/.env.example").read_text(encoding="utf-8")

    assert settings.api.prefix == "/api/v1"
    assert 'headers["x-arena-api-key"] = authValue;' in proxy
    assert "BACKEND_AUTH_HEADER" not in proxy
    assert '_API_KEY_HEADER = "x-arena-api-key"' in middleware
    assert "BACKEND_AUTH_HEADER" not in ui_env
    assert "x-arena-api-key" in ui_env


def test_api_and_vercel_security_header_values_are_aligned() -> None:
    root = json.loads(Path("vercel.json").read_text(encoding="utf-8"))
    public_headers = {
        item["key"].lower(): item["value"]
        for item in root["headers"][0]["headers"]
    }
    middleware = Path("app/middleware.py").read_text(encoding="utf-8")

    assert public_headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert public_headers["permissions-policy"] == "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    assert '"referrer-policy": "strict-origin-when-cross-origin"' in middleware
    assert '"permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"' in middleware


def test_ui_mcp_fallback_matches_backend_entity_exposure() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert '{ key: "mixed_capability", runtime_role: "mixed_capability_runner"' in source
    assert '{ key: "evaluator", runtime_role: "evaluator_runner", read_only_workspace: true, tools: [] }' in source
    assert "const executableEntities = effectiveEntities.filter" in source
    assert "{executableEntities.map((item)" in source


def test_ui_payload_matches_backend_workflow_contract() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Number(maxTokens) >= 2500 && Number(maxTokens) <= 5000" in source
    assert "workflow: { function_key: workflowKey, source_context: null, max_tokens: 5000 }, max_tokens: 5000" in source
    assert 'state="5,000 max"' in source


def test_chatbot_token_contract_matches_cv11_and_agentic_workflow_limits() -> None:
    assert settings.chatbot.defaults.max_output_tokens == CHATBOT_MAX_OUTPUT_TOKENS == 4096

    workflow = WorkflowInvocation(function_key="advisor")
    assert workflow.max_tokens == AGENTIC_MAX_OUTPUT_TOKENS == 5000

    policy = Path("policies/cv11.rego").read_text(encoding="utf-8")
    assert 'object.get(input.request, "max_tokens", 0) > 4096' in policy

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
