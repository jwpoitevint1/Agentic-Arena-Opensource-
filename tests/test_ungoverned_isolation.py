import inspect

import app.ungoverned_routes as ungoverned_routes
from app.governed_functions import build_ungoverned_system_prompt, domain_profiles, governed_function_for_key


def test_ungoverned_data_modeler_prompt_has_no_governance_controls() -> None:
    prompt = build_ungoverned_system_prompt(
        governed_function_for_key("data_modeler"),
        domain_profiles()[0],
    )

    forbidden = (
        "CV1.1",
        "governed MCP",
        "Governed Data Modeler controls",
        "read-only",
        "untrusted data",
        "policy",
        "OPA",
    )
    for marker in forbidden:
        assert marker not in prompt


def test_ungoverned_execute_route_bypasses_cv11_and_governed_mcp() -> None:
    source = inspect.getsource(ungoverned_routes.execute_ungoverned_function)

    assert "enforce_cv11" not in source
    assert "execute_governed_mcp_tool" not in source
    assert "sanitize_governed_model_result" not in source
    assert "redact_governed_payload" not in source
    assert "verify_governed_claims" not in source


def test_ungoverned_direct_read_is_not_labeled_as_mcp() -> None:
    assert ungoverned_routes._relational_action("data_modeler") == "direct.dataset.query"
