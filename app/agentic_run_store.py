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


logger = logging.getLogger("agentic_arena.agentic_runs")

_ENV_BY_GOVERNANCE = {
    "governed": "DB_LOG_AGENTIC_GOV",
    "ungoverned": "DB_LOG_AGENTIC_UNGOV",
}

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
    GROUP BY model_key
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
                    cursor.execute(_MODEL_TOKEN_SQL)
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
            item = combined.setdefault(
                model_key,
                {
                    "model_key": model_key,
                    "requested_model_id": row[1],
                    "vendor": row[2],
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
