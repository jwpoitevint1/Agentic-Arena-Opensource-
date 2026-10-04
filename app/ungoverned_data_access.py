import json
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

from app.contracts import AGENTIC_EVIDENCE_ROW_LIMIT, AGENTIC_PROFILE_COLUMN_LIMIT
from app.database import database_url
from app.execution import DatabaseTarget


class UngovernedDataError(RuntimeError):
    pass


class UngovernedDataUnavailable(UngovernedDataError):
    pass


@contextmanager
def _connection(target: DatabaseTarget) -> Iterator[psycopg.Connection[Any]]:
    """Direct read-only connection for the ungoverned control path.

    This module intentionally does not import or call app.mcp.*. Database-level
    read-only safety remains in place, but CV 1.1/MCP semantic validation,
    policy routing, tool contracts, and governed data-access helpers do not.
    """
    url = database_url(target)
    if not url:
        raise UngovernedDataUnavailable("ungoverned database target is not configured")

    connection: psycopg.Connection[Any] | None = None
    try:
        connection = psycopg.connect(
            url,
            connect_timeout=3,
            row_factory=dict_row,
            autocommit=True,
        )
        with connection.cursor() as cursor:
            cursor.execute("BEGIN READ ONLY")
            cursor.execute("SET LOCAL statement_timeout = 5000")
        yield connection
    except psycopg.Error as exc:
        raise UngovernedDataUnavailable("ungoverned database target is unreachable") from exc
    finally:
        if connection is not None:
            try:
                with connection.cursor() as cursor:
                    cursor.execute("ROLLBACK")
            except psycopg.Error:
                pass
            connection.close()


def profile_source_data(target: DatabaseTarget) -> dict[str, Any]:
    """Read neutral source metadata directly from the ungoverned database."""
    count_query = 'SELECT count(*) AS row_count FROM source.source_data'
    columns_query = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'source' AND table_name = 'source_data'
        ORDER BY ordinal_position
        LIMIT %s
    """
    try:
        with _connection(target) as connection, connection.cursor() as cursor:
            cursor.execute(count_query)
            count_row = cursor.fetchone() or {"row_count": 0}
            cursor.execute(columns_query, (AGENTIC_PROFILE_COLUMN_LIMIT,))
            columns = list(cursor.fetchall())
    except psycopg.Error as exc:
        raise UngovernedDataUnavailable("could not profile ungoverned source data") from exc

    return {
        "table": "source_data",
        "row_count": count_row["row_count"],
        "columns": columns,
    }


def dataset_context(target: DatabaseTarget) -> tuple[str, dict[str, Any]]:
    profile = profile_source_data(target)
    context = json.dumps(profile, ensure_ascii=False, separators=(",", ":"), default=str)
    return context, profile


def read_source_rows(target: DatabaseTarget, *, limit: int = AGENTIC_EVIDENCE_ROW_LIMIT) -> list[dict[str, Any]]:
    """Read the fixed source table directly; no MCP/governed helper is involved."""
    safe_limit = max(1, min(int(limit), AGENTIC_EVIDENCE_ROW_LIMIT))
    try:
        with _connection(target) as connection, connection.cursor() as cursor:
            cursor.execute("SELECT * FROM source.source_data LIMIT %s", (safe_limit,))
            return list(cursor.fetchall())
    except psycopg.Error as exc:
        raise UngovernedDataUnavailable("could not read ungoverned source data") from exc
