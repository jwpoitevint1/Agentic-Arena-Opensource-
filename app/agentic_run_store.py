import logging
import os
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from app.integrity import (
    GENESIS_HASH,
    IntegrityConfigurationError,
    active_signing_material,
    audit_lock_id,
    build_integrity_envelope,
    integrity_configured,
    integrity_self_test,
    verify_integrity_record,
)
from app.model_registry import model_for_key


logger = logging.getLogger("agentic_arena.agentic_runs")

_ENV_BY_GOVERNANCE = {
    "governed": "DB_LOG_AGENTIC_GOV",
    "ungoverned": "DB_LOG_AGENTIC_UNGOV",
}

# Historical telemetry at or before this instant belongs to the pre-MCP-tuning
# archive epoch. Signed records remain in place so integrity chains and audit
# history are preserved; current analytical summaries exclude the archive.
CURRENT_TELEMETRY_EPOCH_START = datetime(
    2026, 9, 21, 3, 23, 31, tzinfo=timezone.utc
)
CURRENT_TELEMETRY_EPOCH_LABEL = "post_mcp_deterministic_statistics"
ARCHIVED_TELEMETRY_RUNS = 265

_INSERT_SQL = """
    INSERT INTO telemetry.agentic_runs (
        run_id,
        schema_version,
        governance,
        operation,
        system_id,
        domain,
        dataset,
        function_key,
        dataset_source,
        task_hash,
        source_context_hash,
        dataset_context_hash,
        model_key,
        requested_model_id,
        returned_model_id,
        vendor,
        started_at,
        finished_at,
        latency_ms,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        selected_cost_usd,
        finish_reason,
        tool_calls,
        retries,
        error,
        record
    ) VALUES (
        %(run_id)s,
        %(schema_version)s,
        %(governance)s,
        %(operation)s,
        %(system_id)s,
        %(domain)s,
        %(dataset)s,
        %(function_key)s,
        %(dataset_source)s,
        %(task_hash)s,
        %(source_context_hash)s,
        %(dataset_context_hash)s,
        %(model_key)s,
        %(requested_model_id)s,
        %(returned_model_id)s,
        %(vendor)s,
        %(started_at)s,
        %(finished_at)s,
        %(latency_ms)s,
        %(prompt_tokens)s,
        %(completion_tokens)s,
        %(total_tokens)s,
        %(selected_cost_usd)s,
        %(finish_reason)s,
        %(tool_calls)s,
        %(retries)s,
        %(error)s,
        %(record)s
    )
    ON CONFLICT (run_id) DO NOTHING
"""

_TAIL_SQL = """
    SELECT record
    FROM telemetry.agentic_runs
    WHERE governance = %s
      AND record #>> '{integrity,event_hash}' IS NOT NULL
    ORDER BY recorded_at DESC, run_id DESC
    LIMIT 1
"""

_CHAIN_ROWS_SQL = """
    SELECT record
    FROM telemetry.agentic_runs
    WHERE governance = %s
      AND record #>> '{integrity,event_hash}' IS NOT NULL
"""

_UNSIGNED_COUNT_SQL = """
    SELECT count(*)
    FROM telemetry.agentic_runs
    WHERE governance = %s
      AND record #>> '{integrity,event_hash}' IS NULL
"""

_MODEL_TOKEN_SQL = """
    SELECT
        model_key,
        max(requested_model_id) AS requested_model_id,
        max(vendor) AS vendor,
        count(*) AS runs,
        coalesce(sum(total_tokens), 0) AS total_tokens,
        coalesce(sum(prompt_tokens), 0) AS prompt_tokens,
        coalesce(sum(completion_tokens), 0) AS completion_tokens
    FROM telemetry.agentic_runs
    WHERE model_key IS NOT NULL
      AND recorded_at > %s
      AND latency_ms > 0
      AND coalesce(record #>> '{outcome,completed}', 'false') = 'true'
      AND coalesce((record #>> '{behavior,model_calls}')::int, 0) = 1
    GROUP BY model_key
"""

_COMPARISON_RUN_SQL = """
    SELECT
        run_id,
        governance,
        function_key,
        model_key,
        requested_model_id,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        selected_cost_usd,
        recorded_at,
        latency_ms,
        coalesce((record #>> '{usage,reasoning_tokens}')::bigint, 0) AS reasoning_tokens,
        operation
    FROM telemetry.agentic_runs
    WHERE model_key IS NOT NULL
      AND function_key IS NOT NULL
      AND recorded_at > %s
      AND latency_ms > 0
      AND coalesce(record #>> '{outcome,completed}', 'false') = 'true'
      AND coalesce((record #>> '{behavior,model_calls}')::int, 0) = 1
    ORDER BY recorded_at DESC
    LIMIT %s
"""


_AUDIT_RUN_SQL = """
    SELECT
        run_id,
        governance,
        operation,
        system_id,
        domain,
        dataset,
        function_key,
        model_key,
        requested_model_id,
        returned_model_id,
        vendor,
        recorded_at,
        latency_ms,
        prompt_tokens,
        completion_tokens,
        total_tokens,
        selected_cost_usd,
        finish_reason,
        tool_calls,
        retries,
        error,
        record
    FROM telemetry.agentic_runs
    WHERE coalesce(function_key, '') NOT IN ('evaluator', 'auditor')
      AND left(coalesce(operation, ''), 6) <> 'audit.'
      AND left(coalesce(operation, ''), 8) <> 'auditor.'
    ORDER BY recorded_at DESC, run_id DESC
    LIMIT %s
"""


def _section(record: dict[str, Any], key: str) -> dict[str, Any]:
    value = record.get(key)
    return value if isinstance(value, dict) else {}


def _provenance(route_metadata: dict[str, Any]) -> dict[str, object]:
    keys = (
        "dataset_source",
        "task_hash",
        "source_context_hash",
        "dataset_context_hash",
        "relational_action",
        "relational_context_hash",
        "verified_evidence_hash",
        "verified_evidence_provided",
        "audit_scope",
        "audit_source",
        "audit_actions",
        "audit_run_count",
        "audit_run_ids_hash",
        "audit_database_status",
        "audit_read_only",
    )
    return {key: route_metadata.get(key) for key in keys if key in route_metadata}


def audit_integrity_ready() -> bool:
    return integrity_configured() and integrity_self_test() and all(
        bool(os.getenv(env_var)) for env_var in _ENV_BY_GOVERNANCE.values()
    )


def _tail_record(
    cursor: psycopg.Cursor[Any],
    *,
    governance: str,
) -> dict[str, Any] | None:
    cursor.execute(_TAIL_SQL, (governance,))
    row = cursor.fetchone()
    if not row:
        return None
    value = row[0]
    return value if isinstance(value, dict) else None


def _signed_record(
    record: dict[str, Any],
    *,
    governance: str,
    route_metadata: dict[str, Any],
    previous_event_hash: str,
    sequence: int,
    key_id: str,
    master_key: bytes,
) -> dict[str, Any]:
    persisted = deepcopy(record)
    persisted.pop("integrity", None)
    persisted["provenance"] = _provenance(route_metadata)
    persisted["audit_recorded_at"] = datetime.now(timezone.utc).isoformat()
    persisted["integrity"] = build_integrity_envelope(
        persisted,
        governance=governance,
        previous_event_hash=previous_event_hash,
        sequence=sequence,
        key_id=key_id,
        master_key=master_key,
    )
    return persisted


def record_agentic_run(
    *,
    governance: str,
    record: dict[str, Any],
    route_metadata: dict[str, Any],
) -> bool:
    env_var = _ENV_BY_GOVERNANCE.get(governance)
    if env_var is None:
        logger.warning(
            "agentic_run_not_recorded reason=unknown_governance governance=%s",
            governance,
        )
        return False

    url = os.getenv(env_var)
    if not url:
        logger.warning(
            "agentic_run_not_recorded reason=log_database_unconfigured governance=%s",
            governance,
        )
        return False

    try:
        key_id, master_key = active_signing_material()
    except IntegrityConfigurationError:
        logger.error(
            "agentic_run_not_recorded reason=audit_integrity_key_unconfigured governance=%s",
            governance,
        )
        return False

    execution = _section(record, "execution")
    model = _section(record, "model")
    timing = _section(record, "timing")
    usage = _section(record, "usage")
    cost = _section(record, "cost")
    behavior = _section(record, "behavior")

    try:
        with psycopg.connect(url, connect_timeout=3) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT pg_advisory_xact_lock(%s)",
                    (audit_lock_id(governance),),
                )

                previous_record = _tail_record(cursor, governance=governance)
                if previous_record is None:
                    previous_event_hash = GENESIS_HASH
                    sequence = 1
                else:
                    previous_check = verify_integrity_record(
                        previous_record,
                        governance=governance,
                        key_id=key_id,
                        master_key=master_key,
                    )
                    if not previous_check.valid:
                        logger.error(
                            "agentic_run_not_recorded reason=audit_chain_tail_invalid "
                            "governance=%s errors=%s",
                            governance,
                            ",".join(previous_check.errors),
                        )
                        connection.rollback()
                        return False
                    if previous_check.event_hash is None or previous_check.sequence is None:
                        logger.error(
                            "agentic_run_not_recorded reason=audit_chain_tail_incomplete "
                            "governance=%s",
                            governance,
                        )
                        connection.rollback()
                        return False
                    previous_event_hash = previous_check.event_hash
                    sequence = previous_check.sequence + 1

                persisted_record = _signed_record(
                    record,
                    governance=governance,
                    route_metadata=route_metadata,
                    previous_event_hash=previous_event_hash,
                    sequence=sequence,
                    key_id=key_id,
                    master_key=master_key,
                )

                params = {
                    "run_id": persisted_record.get("run_id"),
                    "schema_version": persisted_record.get("schema_version", "1.1"),
                    "governance": governance,
                    "operation": execution.get("operation"),
                    "system_id": execution.get("system_id"),
                    "domain": execution.get("domain"),
                    "dataset": execution.get("dataset"),
                    "function_key": execution.get("function_key"),
                    "dataset_source": route_metadata.get("dataset_source"),
                    "task_hash": route_metadata.get("task_hash"),
                    "source_context_hash": route_metadata.get("source_context_hash"),
                    "dataset_context_hash": route_metadata.get("dataset_context_hash"),
                    "model_key": model.get("key"),
                    "requested_model_id": model.get("requested_model_id"),
                    "returned_model_id": model.get("returned_model_id"),
                    "vendor": model.get("vendor"),
                    "started_at": timing.get("started_at"),
                    "finished_at": timing.get("finished_at"),
                    "latency_ms": timing.get("latency_ms"),
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                    "selected_cost_usd": cost.get("selected_usd"),
                    "finish_reason": behavior.get("finish_reason"),
                    "tool_calls": behavior.get("tool_calls", 0),
                    "retries": behavior.get("retries", 0),
                    "error": persisted_record.get("error"),
                    "record": Jsonb(persisted_record),
                }

                cursor.execute(_INSERT_SQL, params)
                if cursor.rowcount != 1:
                    logger.error(
                        "agentic_run_not_recorded reason=duplicate_run_id governance=%s run_id=%s",
                        governance,
                        persisted_record.get("run_id"),
                    )
                    connection.rollback()
                    return False

            connection.commit()

        record["provenance"] = persisted_record["provenance"]
        record["integrity"] = persisted_record["integrity"]
        logger.info(
            "agentic_run_recorded governance=%s run_id=%s system_id=%s "
            "function_key=%s integrity_sequence=%s integrity_event_hash=%s",
            governance,
            record.get("run_id"),
            execution.get("system_id"),
            execution.get("function_key"),
            persisted_record["integrity"]["sequence"],
            persisted_record["integrity"]["event_hash"],
        )
        return True
    except psycopg.Error:
        logger.exception(
            "agentic_run_not_recorded reason=database_error governance=%s run_id=%s",
            governance,
            record.get("run_id"),
        )
        return False
    except (TypeError, ValueError):
        logger.exception(
            "agentic_run_not_recorded reason=integrity_error governance=%s run_id=%s",
            governance,
            record.get("run_id"),
        )
        return False


def token_usage_by_model() -> dict[str, object]:
    combined: dict[str, dict[str, object]] = {}
    database_status: dict[str, str] = {}

    for governance, env_var in _ENV_BY_GOVERNANCE.items():
        url = os.getenv(env_var)
        if not url:
            database_status[governance] = "unconfigured"
            continue

        try:
            with psycopg.connect(url, connect_timeout=3) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(_MODEL_TOKEN_SQL, (CURRENT_TELEMETRY_EPOCH_START,))
                    rows = cursor.fetchall()
        except psycopg.Error:
            logger.exception(
                "model_token_summary_failed governance=%s",
                governance,
            )
            database_status[governance] = "database_error"
            continue

        database_status[governance] = "ok"
        for row in rows:
            model_key = str(row[0])
            try:
                definition = model_for_key(model_key)
            except KeyError:
                definition = None

            item = combined.setdefault(
                model_key,
                {
                    "model_key": model_key,
                    "requested_model_id": row[1],
                    "vendor": row[2],
                    "access_class": definition.access_class if definition else "unknown",
                    "parameter_size": definition.parameter_size if definition else "Unknown",
                    "parameter_total_b": definition.parameter_total_b if definition else None,
                    "parameter_active_b": definition.parameter_active_b if definition else None,
                    "runs": 0,
                    "total_tokens": 0,
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "governed_tokens": 0,
                    "ungoverned_tokens": 0,
                },
            )
            item["runs"] = int(item["runs"]) + int(row[3] or 0)
            item["total_tokens"] = int(item["total_tokens"]) + int(row[4] or 0)
            item["prompt_tokens"] = int(item["prompt_tokens"]) + int(row[5] or 0)
            item["completion_tokens"] = int(item["completion_tokens"]) + int(row[6] or 0)
            item[f"{governance}_tokens"] = int(item.get(f"{governance}_tokens", 0)) + int(row[4] or 0)

    models = sorted(
        combined.values(),
        key=lambda item: int(item["total_tokens"]),
        reverse=True,
    )
    return {
        "models": models,
        "total_tokens": sum(int(item["total_tokens"]) for item in models),
        "runs": sum(int(item["runs"]) for item in models),
        "database_status": database_status,
        "telemetry_epoch": {
            "label": CURRENT_TELEMETRY_EPOCH_LABEL,
            "starts_after": CURRENT_TELEMETRY_EPOCH_START.isoformat(),
            "archived_runs": ARCHIVED_TELEMETRY_RUNS,
            "archive_policy": "retained_for_audit_excluded_from_current_analytics",
        },
    }



def comparison_runs(limit: int = 1000) -> dict[str, object]:
    safe_limit = max(1, min(int(limit), 2000))
    runs: list[dict[str, object]] = []
    database_status: dict[str, str] = {}

    for governance, env_var in _ENV_BY_GOVERNANCE.items():
        url = os.getenv(env_var)
        if not url:
            database_status[governance] = "unconfigured"
            continue
        try:
            with psycopg.connect(url, connect_timeout=3) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        _COMPARISON_RUN_SQL,
                        (CURRENT_TELEMETRY_EPOCH_START, safe_limit),
                    )
                    rows = cursor.fetchall()
        except psycopg.Error:
            logger.exception("comparison_runs_failed governance=%s", governance)
            database_status[governance] = "database_error"
            continue

        database_status[governance] = "ok"
        for row in rows:
            runs.append({
                "run_id": row[0],
                "governance": row[1],
                "function_key": row[2],
                "model_key": row[3],
                "requested_model_id": row[4],
                "prompt_tokens": int(row[5] or 0),
                "completion_tokens": int(row[6] or 0),
                "total_tokens": int(row[7] or 0),
                "selected_cost_usd": float(row[8]) if row[8] is not None else None,
                "recorded_at": row[9].isoformat() if row[9] is not None else None,
                "latency_ms": float(row[10]) if row[10] is not None else None,
                "reasoning_tokens": int(row[11] or 0),
                "operation": row[12],
            })

    runs.sort(key=lambda item: str(item.get("recorded_at") or ""), reverse=True)
    return {
        "runs": runs[:safe_limit],
        "database_status": database_status,
        "telemetry_epoch": {
            "label": CURRENT_TELEMETRY_EPOCH_LABEL,
            "starts_after": CURRENT_TELEMETRY_EPOCH_START.isoformat(),
            "archived_runs": ARCHIVED_TELEMETRY_RUNS,
            "archive_policy": "retained_for_audit_excluded_from_current_analytics",
        },
    }


def _audit_record_view(
    row: tuple[Any, ...],
    *,
    max_output_chars: int,
) -> dict[str, object]:
    record = row[21] if len(row) > 21 and isinstance(row[21], dict) else {}
    output = _section(record, "output")
    control = _section(record, "control")
    outcome = _section(record, "outcome")
    integrity = _section(record, "integrity")
    provenance = _section(record, "provenance")
    usage = _section(record, "usage")
    behavior = _section(record, "behavior")

    text_value = output.get("text")
    output_text = text_value if isinstance(text_value, str) else ""
    excerpt = output_text[:max_output_chars]

    return {
        "run_id": row[0],
        "governance": row[1],
        "operation": row[2],
        "system_id": row[3],
        "domain": row[4],
        "dataset": row[5],
        "function_key": row[6],
        "model_key": row[7],
        "requested_model_id": row[8],
        "returned_model_id": row[9],
        "vendor": row[10],
        "recorded_at": row[11].isoformat() if row[11] is not None else None,
        "latency_ms": float(row[12]) if row[12] is not None else None,
        "prompt_tokens": int(row[13] or 0),
        "completion_tokens": int(row[14] or 0),
        "total_tokens": int(row[15] or 0),
        "selected_cost_usd": float(row[16]) if row[16] is not None else None,
        "finish_reason": row[17],
        "tool_calls": int(row[18] or 0),
        "retries": int(row[19] or 0),
        "error": row[20],
        "policy_applied": control.get("policy_applied"),
        "policy_allowed": control.get("policy_allowed"),
        "outcome": outcome.get("status"),
        "reasoning_tokens": int(usage.get("reasoning_tokens") or 0),
        "behavioral_nuances": behavior.get("behavioral_nuances", []),
        "output_excerpt": excerpt,
        "output_characters": int(output.get("characters") or len(output_text)),
        "output_sha256": output.get("sha256"),
        "output_truncated_for_audit_context": len(output_text) > len(excerpt),
        "integrity": {
            "signed": bool(integrity.get("event_hash")),
            "sequence": integrity.get("sequence"),
            "event_hash": integrity.get("event_hash"),
            "previous_event_hash": integrity.get("previous_event_hash"),
            "key_id": integrity.get("key_id"),
        },
        "provenance": {
            "dataset_source": provenance.get("dataset_source"),
            "task_hash": provenance.get("task_hash"),
            "source_context_hash": provenance.get("source_context_hash"),
            "dataset_context_hash": provenance.get("dataset_context_hash"),
            "verified_evidence_hash": provenance.get("verified_evidence_hash"),
            "verified_evidence_provided": provenance.get("verified_evidence_provided"),
        },
    }


def audit_run_history(
    *,
    limit_per_governance: int = 12,
    max_output_chars: int = 3500,
) -> dict[str, object]:
    safe_limit = max(1, min(int(limit_per_governance), 25))
    safe_output_chars = max(500, min(int(max_output_chars), 8000))
    runs: list[dict[str, object]] = []
    database_status: dict[str, str] = {}

    for governance, env_var in _ENV_BY_GOVERNANCE.items():
        url = os.getenv(env_var)
        if not url:
            database_status[governance] = "unconfigured"
            continue

        try:
            with psycopg.connect(url, connect_timeout=3) as connection:
                with connection.cursor() as cursor:
                    cursor.execute("BEGIN READ ONLY")
                    cursor.execute("SET LOCAL statement_timeout = 5000")
                    cursor.execute(_AUDIT_RUN_SQL, (safe_limit,))
                    rows = cursor.fetchall()
                    connection.rollback()
        except psycopg.Error:
            logger.exception("audit_run_history_failed governance=%s", governance)
            database_status[governance] = "database_error"
            continue

        database_status[governance] = "ok"
        for row in rows:
            runs.append(
                _audit_record_view(
                    row,
                    max_output_chars=safe_output_chars,
                )
            )

    runs.sort(key=lambda item: str(item.get("recorded_at") or ""), reverse=True)
    return {
        "source": "telemetry.agentic_runs",
        "mode": "read_only",
        "limit_per_governance": safe_limit,
        "max_output_chars_per_run": safe_output_chars,
        "run_count": len(runs),
        "runs": runs,
        "database_status": database_status,
    }


def verify_agentic_run_chain(governance: str) -> dict[str, object]:
    env_var = _ENV_BY_GOVERNANCE.get(governance)
    if env_var is None:
        return {
            "governance": governance,
            "status": "invalid_request",
            "valid": False,
        }

    url = os.getenv(env_var)
    if not url:
        return {
            "governance": governance,
            "status": "database_unconfigured",
            "valid": False,
        }

    try:
        key_id, master_key = active_signing_material()
    except IntegrityConfigurationError:
        return {
            "governance": governance,
            "status": "signing_key_unconfigured",
            "valid": False,
        }

    try:
        with psycopg.connect(url, connect_timeout=3) as connection:
            with connection.cursor() as cursor:
                cursor.execute(_CHAIN_ROWS_SQL, (governance,))
                signed_rows = [
                    row[0]
                    for row in cursor.fetchall()
                    if row and isinstance(row[0], dict)
                ]
                sequence_errors: list[dict[str, object]] = []
                for item in signed_rows:
                    envelope = item.get("integrity")
                    sequence_value = (
                        envelope.get("sequence")
                        if isinstance(envelope, dict)
                        else None
                    )
                    if not isinstance(sequence_value, int) or sequence_value < 1:
                        sequence_errors.append(
                            {
                                "sequence": sequence_value,
                                "errors": ["invalid_sequence"],
                            }
                        )
                if sequence_errors:
                    return {
                        "governance": governance,
                        "status": "invalid",
                        "valid": False,
                        "signed_records": len(signed_rows),
                        "legacy_unsigned_records": 0,
                        "last_sequence": None,
                        "last_event_hash": None,
                        "key_id": key_id,
                        "hash_algorithm": "SHA-256",
                        "mac_algorithm": "HMAC-SHA256",
                        "errors": sequence_errors,
                    }
                signed_rows.sort(
                    key=lambda item: int(item["integrity"]["sequence"])
                )
                cursor.execute(_UNSIGNED_COUNT_SQL, (governance,))
                unsigned_row = cursor.fetchone()
                legacy_unsigned_records = int(unsigned_row[0]) if unsigned_row else 0
    except psycopg.Error:
        logger.exception(
            "agentic_chain_verification_failed reason=database_error governance=%s",
            governance,
        )
        return {
            "governance": governance,
            "status": "database_error",
            "valid": False,
        }

    expected_previous = GENESIS_HASH
    expected_sequence = 1
    last_event_hash: str | None = None
    errors: list[dict[str, object]] = []

    for item in signed_rows:
        verification = verify_integrity_record(
            item,
            governance=governance,
            expected_previous_hash=expected_previous,
            expected_sequence=expected_sequence,
            key_id=key_id,
            master_key=master_key,
        )
        if not verification.valid:
            errors.append(
                {
                    "sequence": verification.sequence,
                    "errors": list(verification.errors),
                }
            )
            break

        last_event_hash = verification.event_hash
        if last_event_hash is None:
            errors.append(
                {
                    "sequence": verification.sequence,
                    "errors": ["missing_event_hash"],
                }
            )
            break

        expected_previous = last_event_hash
        expected_sequence += 1

    return {
        "governance": governance,
        "status": "valid" if not errors else "invalid",
        "valid": not errors,
        "signed_records": len(signed_rows),
        "legacy_unsigned_records": legacy_unsigned_records,
        "last_sequence": len(signed_rows) if not errors else expected_sequence - 1,
        "last_event_hash": last_event_hash,
        "key_id": key_id,
        "hash_algorithm": "SHA-256",
        "mac_algorithm": "HMAC-SHA256",
        "errors": errors,
    }
