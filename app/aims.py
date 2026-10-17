"""Read-only AI management-system snapshot backed by the shared Neon registry."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.database import database_url, registrations
from app.execution import DatabaseTarget


class AIMSUnavailable(RuntimeError):
    pass


def _iso(value: Any) -> Any:
    return value.isoformat() if hasattr(value, "isoformat") else value


def _rows(connection: psycopg.Connection, query: str) -> list[dict[str, Any]]:
    return [{key: _iso(value) for key, value in dict(row).items()} for row in connection.execute(query).fetchall()]


def aims_snapshot() -> dict[str, Any]:
    registry_url = database_url(DatabaseTarget.AGENTIC_GOV_01)
    if not registry_url:
        raise AIMSUnavailable("AIMS registry database is not configured")

    try:
        with psycopg.connect(registry_url, connect_timeout=5, row_factory=dict_row) as connection:
            change_requests = _rows(connection, """
                SELECT request_id, title, description, status, change_type, system_scope,
                       risk_level, requested_by, organizational_owner, operational_owner,
                       decision_authority, evidence_url, rollback_plan, created_at, updated_at
                FROM aims.change_requests
                ORDER BY updated_at DESC, request_id
            """)
            measures = _rows(connection, """
                SELECT measure_id, name, category, control_objective, implementation_status,
                       organizational_owner, operational_owner, evidence_source,
                       review_cadence, last_reviewed_at
                FROM aims.governance_measures
                ORDER BY category, measure_id
            """)
            ownership = _rows(connection, """
                SELECT ownership_id, system_name, layer_name, organizational_owner,
                       operational_owner, accountability, escalation_path, active
                FROM aims.ownership_assignments
                WHERE active = true
                ORDER BY system_name, layer_name
            """)
            registry_record_count = len(change_requests) + len(measures) + len(ownership)
    except psycopg.Error as exc:
        raise AIMSUnavailable("AIMS registry is unavailable") from exc

    database_targets = [
        {"target": item.target.value, "env_var": item.env_var, "configured": item.configured}
        for item in registrations()
    ]
    return {
        "source": "agentic_arena",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "runtime": {
            "status": "operational",
            "backend": "Agentic Arena",
            "configured_database_targets": sum(1 for item in database_targets if item["configured"]),
            "expected_database_targets": len(database_targets),
            "registry_records": registry_record_count,
        },
        "database_targets": database_targets,
        "change_requests": change_requests,
        "governance_measures": measures,
        "ownership": ownership,
        "registry": {
            "database_target": DatabaseTarget.AGENTIC_GOV_01.value,
            "schema": "aims",
            "access": "read_only_api",
        },
    }
