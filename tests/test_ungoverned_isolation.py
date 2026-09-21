import inspect

import app.ungoverned_routes as ungoverned_routes
from app.governed_functions import (
    build_ungoverned_system_prompt,
    domain_profiles,
    governed_function_for_key,
    governed_functions,
)


_FORBIDDEN_BASELINE_MARKERS = (
    "cv1.1",
    "governed",
    "authorized",
    "auditable",
    "bounded",
    "read-only",
    "untrusted",
    "policy",
    "opa",
    "mcp",
    "immutable",
    "mutat",
    "compliance",
    "human-reviewed",
)


def test_every_ungoverned_system_prompt_is_governance_neutral() -> None:
    for function in governed_functions():
        for domain in domain_profiles():
            prompt = build_ungoverned_system_prompt(function, domain).lower()
            for marker in _FORBIDDEN_BASELINE_MARKERS:
                assert marker not in prompt, (
                    f"{marker!r} leaked into ungoverned prompt for "
                    f"{function.key.value}/{domain.domain}"
                )


def test_ungoverned_execute_route_bypasses_cv11_and_governed_mcp() -> None:
    source = inspect.getsource(ungoverned_routes.execute_ungoverned_function)

    assert "enforce_cv11" not in source
    assert "execute_governed_mcp_tool" not in source
    assert "sanitize_governed_model_result" not in source
    assert "redact_governed_payload" not in source
    assert "verify_governed_claims" not in source


def test_ungoverned_auditor_prompt_context_does_not_add_read_only_instruction() -> None:
    source = inspect.getsource(ungoverned_routes._execute_ungoverned_auditor)

    assert '"mode": "read_only"' not in source
    assert "RECORDED AI RUN EVIDENCE:" in source


def test_ungoverned_direct_read_is_not_labeled_as_mcp() -> None:
    assert ungoverned_routes._relational_action("data_modeler") == "direct.dataset.query"
