import json
from typing import Any

from app.execution import DatabaseTarget
from app.mcp.data_access import MCPDataError, MCPDataUnavailable, profile_source

class DatasetContextError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


_SOURCE_TABLE = "source_data"


def neon_dataset_context(target: DatabaseTarget) -> tuple[str | None, dict[str, Any] | None]:
    """Return bounded, authoritative dataset metadata from the selected Neon source.

    Infrastructure and MCP failures remain fail-closed, but are surfaced as explicit
    diagnostic states instead of being mislabeled as an absent dataset.
    """
    try:
        profile = profile_source(target, _SOURCE_TABLE)
    except MCPDataUnavailable as exc:
        raise DatasetContextError(
            "DATABASE_UNAVAILABLE",
            "Authorized dataset database is unavailable or not configured.",
        ) from exc
    except MCPDataError as exc:
        raise DatasetContextError(
            "MCP_DATA_ERROR",
            "Authorized dataset profile could not be read through the governed data layer.",
        ) from exc

    raw_columns = profile.get("columns")
    row_count = profile.get("row_count")
    if not isinstance(raw_columns, list) or not raw_columns:
        return None, profile
    if not isinstance(row_count, int) or row_count <= 0:
        return None, profile

    columns: list[dict[str, Any]] = []
    for item in raw_columns:
        if not isinstance(item, dict):
            continue
        name = item.get("column_name")
        if not isinstance(name, str) or not name:
            continue
        columns.append(
            {
                "column_name": name,
                "data_type": item.get("data_type"),
                "is_nullable": item.get("is_nullable"),
            }
        )

    if not columns:
        return None, profile

    payload = {
        "source": "neon",
        "schema": "source",
        "table": _SOURCE_TABLE,
        "row_count": row_count,
        "columns": columns,
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")), profile
