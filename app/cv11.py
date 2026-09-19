import hashlib
import logging
import os
from dataclasses import asdict, dataclass
from typing import Any

import httpx

from app.execution import ExecutionContext, GovernanceMode, WorkloadType


logger = logging.getLogger("agentic_arena.cv11")

OPA_URL = os.getenv("OPA_URL", "http://127.0.0.1:8181").rstrip("/")
OPA_DECISION_PATH = "/v1/data/cv11/gatekeeper/decision"
POLICY_VERSION = "1.1"


class CV11PolicyError(RuntimeError):
    pass


class CV11PolicyUnavailable(CV11PolicyError):
    pass


class CV11PolicyDenied(CV11PolicyError):
    def __init__(self, reasons: tuple[str, ...]) -> None:
        self.reasons = reasons or ("policy_denied",)
        super().__init__(", ".join(self.reasons))


@dataclass(frozen=True)
class CV11Decision:
    allow: bool
    enforced: bool
    policy_version: str
    role: str
    reasons: tuple[str, ...]
    prompt_hash: str | None

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["reasons"] = list(self.reasons)
        return data


def opa_healthy(timeout_seconds: float = 1.0) -> bool:
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.get(f"{OPA_URL}/health")
        return response.status_code == 200
    except httpx.RequestError:
        return False


def _runtime_role(context: ExecutionContext) -> str:
    return "agentic_runner"


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _normalize_reasons(value: Any) -> tuple[str, ...]:
    if not isinstance(value, list):
        return ()
    return tuple(sorted(str(item) for item in value))


def enforce_cv11(
    *,
    context: ExecutionContext,
    action: str,
    model_key: str | None,
    content: str = "",
    message_roles: list[str] | None = None,
    max_tokens: int | None = None,
    timeout_seconds: float = 2.0,
    runtime_role: str | None = None,
    function_key: str | None = None,
    mcp_entity: str | None = None,
    database_target: str | None = None,
) -> CV11Decision:
    role = runtime_role or _runtime_role(context)
    prompt_hash = _sha256_text(content) if content else None

    if context.governance is GovernanceMode.UNGOVERNED:
        return CV11Decision(
            allow=True,
            enforced=False,
            policy_version=POLICY_VERSION,
            role=role,
            reasons=("cv11_bypassed_for_ungoverned_control",),
            prompt_hash=prompt_hash,
        )

    policy_input = {
        "actor": {"role": role},
        "request": {
            "action": action,
            "governance": context.governance.value,
            "workload": context.workload.value,
            "system_id": context.system_id,
            "model_key": model_key,
            "function_key": function_key,
            "mcp_entity": mcp_entity,
            "database_target": database_target,
            "content": content,
            "message_roles": message_roles or [],
            "max_tokens": max_tokens or 0,
        },
    }

    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(f"{OPA_URL}{OPA_DECISION_PATH}", json={"input": policy_input})
    except httpx.RequestError as exc:
        logger.error(
            "cv11_fail_closed reason=opa_unreachable action=%s role=%s function=%s mcp_entity=%s system_id=%s database_target=%s model_key=%s prompt_hash=%s",
            action, role, function_key, mcp_entity, context.system_id, database_target, model_key, prompt_hash,
        )
        raise CV11PolicyUnavailable("CV1.1 policy decision service is unavailable") from exc

    if response.status_code != 200:
        logger.error(
            "cv11_fail_closed reason=opa_status status=%s action=%s role=%s function=%s mcp_entity=%s system_id=%s database_target=%s model_key=%s prompt_hash=%s",
            response.status_code, action, role, function_key, mcp_entity, context.system_id, database_target, model_key, prompt_hash,
        )
        raise CV11PolicyUnavailable("CV1.1 policy decision service returned an invalid status")

    try:
        payload = response.json()
    except ValueError as exc:
        raise CV11PolicyUnavailable("CV1.1 policy decision service returned invalid JSON") from exc

    result = payload.get("result")
    if not isinstance(result, dict) or result.get("allow") not in {True, False}:
        raise CV11PolicyUnavailable("CV1.1 policy decision was missing or malformed")

    reasons = _normalize_reasons(result.get("reasons"))
    policy_version = str(result.get("policy_version") or POLICY_VERSION)
    decision = CV11Decision(
        allow=result["allow"] is True,
        enforced=True,
        policy_version=policy_version,
        role=str(result.get("role") or role),
        reasons=reasons,
        prompt_hash=prompt_hash,
    )

    logger.info(
        "cv11_decision allow=%s action=%s role=%s function=%s mcp_entity=%s workload=%s system_id=%s database_target=%s model_key=%s prompt_hash=%s reasons=%s",
        decision.allow, action, decision.role, function_key, mcp_entity, context.workload.value,
        context.system_id, database_target, model_key, prompt_hash,
        ",".join(decision.reasons) if decision.reasons else "none",
    )

    if not decision.allow:
        raise CV11PolicyDenied(decision.reasons)

    return decision
