import hashlib
import json
import logging
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import uuid4

from app.model_registry import ModelDefinition


logger = logging.getLogger("agentic_arena.telemetry")


def _as_int(value: Any) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _as_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _round_decimal(value: Decimal | None, places: int = 10) -> float | None:
    if value is None:
        return None
    quantum = Decimal(1).scaleb(-places)
    return float(value.quantize(quantum))


def _raw_result(result: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(result, dict):
        return {}
    raw = result.get("result")
    return raw if isinstance(raw, dict) else {}


def _usage(raw: dict[str, Any]) -> dict[str, Any]:
    usage = raw.get("usage")
    return usage if isinstance(usage, dict) else {}


def _choice(raw: dict[str, Any]) -> dict[str, Any]:
    choices = raw.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        return {}
    return choices[0]


def _output_text(choice: dict[str, Any]) -> str:
    message = choice.get("message")
    if not isinstance(message, dict):
        return ""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts)
    return ""


def _reasoning_tokens(usage: dict[str, Any]) -> int:
    details = usage.get("completion_tokens_details")
    if not isinstance(details, dict):
        return 0
    return _as_int(details.get("reasoning_tokens"))


def _cached_tokens(usage: dict[str, Any]) -> int:
    details = usage.get("prompt_tokens_details")
    if not isinstance(details, dict):
        return 0
    return _as_int(details.get("cached_tokens"))


def _cache_write_tokens(usage: dict[str, Any]) -> int:
    details = usage.get("prompt_tokens_details")
    if not isinstance(details, dict):
        return 0
    return _as_int(details.get("cache_write_tokens"))


def _capability_snapshot(result: dict[str, Any] | None, model: ModelDefinition) -> dict[str, Any]:
    if isinstance(result, dict) and isinstance(result.get("model_capabilities"), dict):
        capabilities = dict(result["model_capabilities"])
    else:
        capabilities = {}
    capabilities.setdefault("model_id", model.model_id)
    capabilities.setdefault("vendor", model.vendor)
    capabilities.setdefault("kind", model.kind.value)
    capabilities.setdefault("tool_capable", model.tool_capable)
    capabilities.setdefault("free", model.free)
    capabilities.setdefault("access_class", model.access_class)
    capabilities.setdefault("parameter_size", model.parameter_size)
    capabilities.setdefault("parameter_total_b", model.parameter_total_b)
    capabilities.setdefault("parameter_active_b", model.parameter_active_b)
    return capabilities


def _context_capacity(capabilities: dict[str, Any]) -> int | None:
    value = capabilities.get("context_length")
    if value is None:
        value = capabilities.get("context_window")
    try:
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _pricing(capabilities: dict[str, Any]) -> dict[str, Any]:
    pricing = capabilities.get("pricing")
    return pricing if isinstance(pricing, dict) else {}


def _estimated_cost(
    *,
    prompt_tokens: int,
    completion_tokens: int,
    pricing: dict[str, Any],
) -> Decimal | None:
    prompt_rate = _as_decimal(pricing.get("prompt"))
    completion_rate = _as_decimal(pricing.get("completion"))
    if prompt_rate is None and completion_rate is None:
        return None
    return (prompt_rate or Decimal(0)) * prompt_tokens + (completion_rate or Decimal(0)) * completion_tokens


def _behavioral_flags(
    *,
    finish_reason: str | None,
    output_text: str,
    reasoning_tokens: int,
    cached_tokens: int,
    context_utilization_pct: float | None,
    loop_cycles: int,
    tool_calls: int,
    retries: int,
    refusal: bool,
) -> list[str]:
    flags: list[str] = []
    if reasoning_tokens > 0:
        flags.append("reasoning_tokens_used")
    if cached_tokens > 0:
        flags.append("prompt_cache_used")
    if context_utilization_pct is not None and context_utilization_pct >= 75:
        flags.append("high_context_utilization")
    if finish_reason in {"length", "max_tokens"}:
        flags.append("length_limited")
    if refusal:
        flags.append("model_refusal")
    if not output_text.strip():
        flags.append("empty_text_output")
    if loop_cycles > 1:
        flags.append("multi_cycle_execution")
    if tool_calls > 0:
        flags.append("tool_use_observed")
    if retries > 0:
        flags.append("retry_required")
    return flags


def build_test_record(
    *,
    result: dict[str, Any] | None,
    model: ModelDefinition,
    governance: str,
    operation: str,
    system_id: int | None = None,
    domain: str | None = None,
    dataset: str | None = None,
    function_key: str | None = None,
    mcp_entity: str | None = None,
    policy: dict[str, Any] | None = None,
    loop_cycles: int = 1,
    tool_calls: int = 0,
    retries: int = 0,
    error: str | None = None,
    execution_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    raw = _raw_result(result)
    usage = _usage(raw)
    choice = _choice(raw)
    output_text = _output_text(choice)
    capabilities = _capability_snapshot(result, model)
    transport = result.get("transport", {}) if isinstance(result, dict) else {}
    if not isinstance(transport, dict):
        transport = {}

    prompt_tokens = _as_int(usage.get("prompt_tokens"))
    completion_tokens = _as_int(usage.get("completion_tokens"))
    total_tokens = _as_int(usage.get("total_tokens")) or prompt_tokens + completion_tokens
    reasoning_tokens = _reasoning_tokens(usage)
    cached_tokens = _cached_tokens(usage)
    cache_write_tokens = _cache_write_tokens(usage)
    context_capacity = _context_capacity(capabilities)
    context_utilization_pct = (
        round((total_tokens / context_capacity) * 100, 4)
        if context_capacity and total_tokens >= 0
        else None
    )

    pricing = _pricing(capabilities)
    reported_cost = _as_decimal(usage.get("cost"))
    estimated_cost = _estimated_cost(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        pricing=pricing,
    )
    selected_cost = reported_cost if reported_cost is not None else estimated_cost

    latency_ms_raw = transport.get("latency_ms")
    try:
        latency_ms = float(latency_ms_raw) if latency_ms_raw is not None else None
    except (TypeError, ValueError):
        latency_ms = None
    throughput_tps = (
        round(completion_tokens / (latency_ms / 1000), 4)
        if latency_ms and latency_ms > 0 and completion_tokens > 0
        else None
    )

    finish_reason_value = choice.get("finish_reason")
    finish_reason = str(finish_reason_value) if finish_reason_value is not None else None
    message = choice.get("message") if isinstance(choice.get("message"), dict) else {}
    refusal = bool(message.get("refusal")) if isinstance(message, dict) else False
    execution_pass = error is None and bool(raw)

    policy_allowed: bool | None = None
    if governance == "governed" and isinstance(policy, dict):
        allowed_value = policy.get("allowed", policy.get("allow"))
        if isinstance(allowed_value, bool):
            policy_allowed = allowed_value

    behavioral_flags = _behavioral_flags(
        finish_reason=finish_reason,
        output_text=output_text,
        reasoning_tokens=reasoning_tokens,
        cached_tokens=cached_tokens,
        context_utilization_pct=context_utilization_pct,
        loop_cycles=loop_cycles,
        tool_calls=tool_calls,
        retries=retries,
        refusal=refusal,
    )

    record = {
        "run_id": uuid4().hex,
        "schema_version": "1.1",
        "execution": {
            "governance": governance,
            "operation": operation,
            "system_id": system_id,
            "domain": domain,
            "dataset": dataset,
            "function_key": function_key,
            "mcp_entity": mcp_entity,
        },
        "model": {
            "key": model.key,
            "requested_model_id": model.model_id,
            "returned_model_id": raw.get("model"),
            "vendor": model.vendor,
            "kind": model.kind.value,
            "free": model.free,
            "tool_capable": model.tool_capable,
            "access_class": model.access_class,
            "parameter_size": model.parameter_size,
            "parameter_total_b": model.parameter_total_b,
            "parameter_active_b": model.parameter_active_b,
            "capabilities": capabilities,
            "context_capacity_tokens": context_capacity,
        },
        "timing": {
            "started_at": transport.get("started_at"),
            "finished_at": transport.get("finished_at"),
            "latency_ms": round(latency_ms, 3) if latency_ms is not None else None,
            "completion_tokens_per_second": throughput_tps,
        },
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "reasoning_tokens": reasoning_tokens,
            "cached_tokens": cached_tokens,
            "cache_write_tokens": cache_write_tokens,
            "total_tokens": total_tokens,
            "context_utilization_pct": context_utilization_pct,
            "output_to_input_token_ratio": (
                round(completion_tokens / prompt_tokens, 4) if prompt_tokens > 0 else None
            ),
        },
        "cost": {
            "currency": "USD",
            "reported_usd": _round_decimal(reported_cost),
            "estimated_usd": _round_decimal(estimated_cost),
            "selected_usd": _round_decimal(selected_cost),
            "source": "openrouter_usage" if reported_cost is not None else "catalog_estimate",
            "prompt_price_per_token": pricing.get("prompt"),
            "completion_price_per_token": pricing.get("completion"),
            "cost_per_1k_total_tokens_usd": (
                round(float(selected_cost) * 1000 / total_tokens, 10)
                if selected_cost is not None and total_tokens > 0
                else None
            ),
        },
        "behavior": {
            "finish_reason": finish_reason,
            "native_finish_reason": choice.get("native_finish_reason"),
            "output_characters": len(output_text),
            "loop_cycles": max(loop_cycles, 0),
            "model_calls": 0 if transport.get("local_guard") else 1 if result is not None else 0,
            "tool_calls": max(tool_calls, 0),
            "retries": max(retries, 0),
            "refusal_observed": refusal,
            "behavioral_nuances": behavioral_flags,
        },
        "output": {
            "text": output_text,
            "sha256": hashlib.sha256(output_text.encode("utf-8")).hexdigest(),
            "characters": len(output_text),
            "storage": "full_text",
            "user_visible_form": True,
        },
        "outcome": {
            "completed": execution_pass,
            "status": (
                execution_state.get("status")
                if isinstance(execution_state, dict)
                else "completed" if execution_pass else "failed"
            ),
        },
        "control": {
            "policy_applied": governance == "governed",
            "policy_allowed": policy_allowed,
        },
        "provider": {
            "generation_id": raw.get("id") or transport.get("generation_id"),
            "provider": raw.get("provider"),
        },
        "execution_state": execution_state,
        "error": error,
    }
    return record


def emit_test_record(record: dict[str, Any]) -> None:
    log_record = json.loads(json.dumps(record, ensure_ascii=False, default=str))
    output = log_record.get("output")
    if isinstance(output, dict) and "text" in output:
        output["text"] = "[OMITTED_FROM_APPLICATION_LOGS]"
    logger.info("experiment_run=%s", json.dumps(log_record, ensure_ascii=False, separators=(",", ":")))


def pair_delta(governed: dict[str, Any], ungoverned: dict[str, Any]) -> dict[str, Any]:
    def nested(record: dict[str, Any], section: str, key: str) -> float | None:
        value = record.get(section, {}).get(key) if isinstance(record.get(section), dict) else None
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    def delta(section: str, key: str) -> float | None:
        gov = nested(governed, section, key)
        ungov = nested(ungoverned, section, key)
        return round(gov - ungov, 6) if gov is not None and ungov is not None else None

    return {
        "latency_ms_delta_governed_minus_ungoverned": delta("timing", "latency_ms"),
        "total_tokens_delta_governed_minus_ungoverned": delta("usage", "total_tokens"),
        "cost_usd_delta_governed_minus_ungoverned": delta("cost", "selected_usd"),
        "context_utilization_pct_delta": delta("usage", "context_utilization_pct"),
        "loop_cycles_delta": delta("behavior", "loop_cycles"),
    }
