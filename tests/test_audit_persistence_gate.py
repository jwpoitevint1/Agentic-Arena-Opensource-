import pytest
from fastapi import HTTPException

from app.governed_routes import GovernedExecuteRequest, execute_governed_function
from app.ungoverned_routes import UngovernedExecuteRequest, execute_ungoverned_function


class _Decision:
    allow = True

    def to_dict(self):
        return {"allow": True, "policy_version": "CV1.1", "reasons": []}


def _allow_governed(monkeypatch) -> None:
    monkeypatch.setattr("app.governed_routes._enforce_function_policy", lambda **kwargs: _Decision())
    monkeypatch.setattr("app.governed_routes._enforce_dataset_policy", lambda **kwargs: _Decision())


def test_governed_output_is_not_released_when_signed_audit_write_fails(monkeypatch) -> None:
    _allow_governed(monkeypatch)
    monkeypatch.setattr(
        "app.governed_routes.neon_dataset_context",
        lambda target: (None, {"row_count": 0}),
    )
    monkeypatch.setattr("app.governed_routes.record_agentic_run", lambda **kwargs: False)

    with pytest.raises(HTTPException) as exc:
        execute_governed_function(
            GovernedExecuteRequest(
                function_key="analyst",
                system_id=6,
                model_key="ling_3_0_flash",
                task="Analyze freight.",
            )
        )

    assert exc.value.status_code == 503
    assert "signed recording-database write" in str(exc.value.detail)


def test_control_output_is_not_released_when_audit_write_fails(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.ungoverned_routes.neon_dataset_context",
        lambda target: (None, {"row_count": 0}),
    )
    monkeypatch.setattr("app.ungoverned_routes.record_agentic_run", lambda **kwargs: False)

    with pytest.raises(HTTPException) as exc:
        execute_ungoverned_function(
            UngovernedExecuteRequest(
                function_key="analyst",
                system_id=6,
                model_key="ling_3_0_flash",
                task="Analyze freight.",
            )
        )

    assert exc.value.status_code == 503
    assert "recording-database write" in str(exc.value.detail)
