from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class GovernanceMode(str, Enum):
    GOVERNED = "governed"
    UNGOVERNED = "ungoverned"


class WorkloadType(str, Enum):
    AGENTIC = "agentic"
    ANALYTICS = "analytics"


class DatabaseTarget(str, Enum):
    AGENTIC_GOV_01 = "agentic_gov_01"
    AGENTIC_GOV_02 = "agentic_gov_02"
    AGENTIC_GOV_03 = "agentic_gov_03"
    AGENTIC_GOV_04 = "agentic_gov_04"
    AGENTIC_GOV_05 = "agentic_gov_05"
    AGENTIC_GOV_06 = "agentic_gov_06"
    AGENTIC_UNGOV_01 = "agentic_ungov_01"
    AGENTIC_UNGOV_02 = "agentic_ungov_02"
    AGENTIC_UNGOV_03 = "agentic_ungov_03"
    AGENTIC_UNGOV_04 = "agentic_ungov_04"
    AGENTIC_UNGOV_05 = "agentic_ungov_05"
    AGENTIC_UNGOV_06 = "agentic_ungov_06"


class ExecutionContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    governance: GovernanceMode
    workload: WorkloadType
    system_id: int | None = Field(default=None, ge=1, le=6)

    @model_validator(mode="after")
    def validate_context(self) -> "ExecutionContext":
        if self.workload in {WorkloadType.AGENTIC, WorkloadType.ANALYTICS} and self.system_id is None:
            raise ValueError("system_id is required for dataset workloads")
        return self


_AGENTIC_TARGETS: dict[tuple[GovernanceMode, int], DatabaseTarget] = {
    (GovernanceMode.GOVERNED, 1): DatabaseTarget.AGENTIC_GOV_01,
    (GovernanceMode.GOVERNED, 2): DatabaseTarget.AGENTIC_GOV_02,
    (GovernanceMode.GOVERNED, 3): DatabaseTarget.AGENTIC_GOV_03,
    (GovernanceMode.GOVERNED, 4): DatabaseTarget.AGENTIC_GOV_04,
    (GovernanceMode.GOVERNED, 5): DatabaseTarget.AGENTIC_GOV_05,
    (GovernanceMode.GOVERNED, 6): DatabaseTarget.AGENTIC_GOV_06,
    (GovernanceMode.UNGOVERNED, 1): DatabaseTarget.AGENTIC_UNGOV_01,
    (GovernanceMode.UNGOVERNED, 2): DatabaseTarget.AGENTIC_UNGOV_02,
    (GovernanceMode.UNGOVERNED, 3): DatabaseTarget.AGENTIC_UNGOV_03,
    (GovernanceMode.UNGOVERNED, 4): DatabaseTarget.AGENTIC_UNGOV_04,
    (GovernanceMode.UNGOVERNED, 5): DatabaseTarget.AGENTIC_UNGOV_05,
    (GovernanceMode.UNGOVERNED, 6): DatabaseTarget.AGENTIC_UNGOV_06,
}


def resolve_database_target(context: ExecutionContext) -> DatabaseTarget:
    # Analytics uses the same paired governed source databases as Agentic Arena,
    # but through a deterministic read-only execution path with no model call.
    return _AGENTIC_TARGETS[(context.governance, context.system_id)]
