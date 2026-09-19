import pytest
from pydantic import ValidationError

from app.execution import (
    DatabaseTarget,
    ExecutionContext,
    GovernanceMode,
    WorkloadType,
    resolve_database_target,
)


@pytest.mark.parametrize(
    ("system_id", "expected"),
    [
        (1, DatabaseTarget.AGENTIC_GOV_01),
        (2, DatabaseTarget.AGENTIC_GOV_02),
        (3, DatabaseTarget.AGENTIC_GOV_03),
        (4, DatabaseTarget.AGENTIC_GOV_04),
        (5, DatabaseTarget.AGENTIC_GOV_05),
        (6, DatabaseTarget.AGENTIC_GOV_06),
    ],
)
def test_agentic_governed_targets_are_isolated(
    system_id: int, expected: DatabaseTarget
) -> None:
    context = ExecutionContext(
        governance=GovernanceMode.GOVERNED,
        workload=WorkloadType.AGENTIC,
        system_id=system_id,
    )
    assert resolve_database_target(context) is expected


@pytest.mark.parametrize(
    ("system_id", "expected"),
    [
        (1, DatabaseTarget.AGENTIC_UNGOV_01),
        (2, DatabaseTarget.AGENTIC_UNGOV_02),
        (3, DatabaseTarget.AGENTIC_UNGOV_03),
        (4, DatabaseTarget.AGENTIC_UNGOV_04),
        (5, DatabaseTarget.AGENTIC_UNGOV_05),
        (6, DatabaseTarget.AGENTIC_UNGOV_06),
    ],
)
def test_agentic_ungoverned_targets_are_isolated(
    system_id: int, expected: DatabaseTarget
) -> None:
    context = ExecutionContext(
        governance=GovernanceMode.UNGOVERNED,
        workload=WorkloadType.AGENTIC,
        system_id=system_id,
    )
    assert resolve_database_target(context) is expected


def test_agentic_requires_system_id() -> None:
    with pytest.raises(ValidationError):
        ExecutionContext(
            governance=GovernanceMode.GOVERNED,
            workload=WorkloadType.AGENTIC,
        )


def test_agentic_rejects_system_id_above_six() -> None:
    with pytest.raises(ValidationError):
        ExecutionContext(
            governance=GovernanceMode.GOVERNED,
            workload=WorkloadType.AGENTIC,
            system_id=7,
        )

