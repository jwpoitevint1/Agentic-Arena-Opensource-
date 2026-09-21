from collections import Counter
from contextlib import contextmanager
import re
from typing import Any, Iterator

import psycopg
from psycopg import sql
from psycopg.rows import dict_row

from app.database import database_url
from app.execution import DatabaseTarget
from app.mcp.patterns import validate_text
from app.numeric_parsing import parse_numeric_like as _parse_numeric_like


class MCPDataError(RuntimeError):
    pass


class MCPDataUnavailable(MCPDataError):
    pass


def _validate_source_identifier(value: str) -> str:
    """Validate a literal PostgreSQL source identifier without renaming it.

    Source datasets intentionally retain their original column names, including
    spaces, punctuation such as parentheses/hyphens, and numeric year columns.
    SQL construction always uses psycopg.sql.Identifier and the schema is fixed
    server-side to ``source``; this validator only enforces bounded, printable
    identifier text before quoting.
    """
    if not isinstance(value, str) or not value:
        raise MCPDataError("source identifier must be a non-empty string")
    if len(value.encode("utf-8")) > 63:
        raise MCPDataError("source identifier exceeds PostgreSQL identifier limit")
    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        raise MCPDataError("source identifier contains control characters")
    return value


@contextmanager
def _connection(target: DatabaseTarget) -> Iterator[psycopg.Connection[Any]]:
    url = database_url(target)
    if not url:
        raise MCPDataUnavailable("governed database target is not configured")

    try:
        # Neon production URLs use PgBouncer transaction pooling. Startup-level
        # PostgreSQL options are not a reliable place to enforce session controls
        # through the pooler, so establish one explicit read-only transaction and
        # keep it pinned for the lifetime of this bounded MCP read.
        connection = psycopg.connect(
            url,
            connect_timeout=3,
            row_factory=dict_row,
            autocommit=True,
        )
        with connection.cursor() as cursor:
            cursor.execute("BEGIN READ ONLY")
            cursor.execute("SET LOCAL statement_timeout = 5000")
    except psycopg.Error as exc:
        try:
            connection.close()
        except (NameError, psycopg.Error):
            pass
        raise MCPDataUnavailable("governed database target is unreachable") from exc

    try:
        yield connection
    finally:
        try:
            with connection.cursor() as cursor:
                cursor.execute("ROLLBACK")
        except psycopg.Error:
            pass
        connection.close()


def source_schema(target: DatabaseTarget) -> list[dict[str, Any]]:
    query = """
        SELECT table_name, column_name, data_type, is_nullable, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'source'
        ORDER BY table_name, ordinal_position
        LIMIT 2000
    """
    try:
        with _connection(target) as connection, connection.cursor() as cursor:
            cursor.execute(query)
            return list(cursor.fetchall())
    except psycopg.Error as exc:
        raise MCPDataUnavailable("could not read governed source schema") from exc


def source_tables(target: DatabaseTarget) -> list[str]:
    query = """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'source' AND table_type = 'BASE TABLE'
        ORDER BY table_name
        LIMIT 100
    """
    try:
        with _connection(target) as connection, connection.cursor() as cursor:
            cursor.execute(query)
            return [str(row["table_name"]) for row in cursor.fetchall()]
    except psycopg.Error as exc:
        raise MCPDataUnavailable("could not list governed source tables") from exc


def sample_table(target: DatabaseTarget, table: str, limit: int = 10) -> list[dict[str, Any]]:
    _validate_source_identifier(table)
    limit = max(1, min(int(limit), 25))
    statement = sql.SQL("SELECT * FROM {}.{} LIMIT %s").format(
        sql.Identifier("source"),
        sql.Identifier(table),
    )
    try:
        with _connection(target) as connection, connection.cursor() as cursor:
            cursor.execute(statement, (limit,))
            return list(cursor.fetchall())
    except psycopg.Error as exc:
        raise MCPDataUnavailable("could not sample governed source table") from exc


def query_table(
    target: DatabaseTarget,
    *,
    table: str,
    columns: list[str] | None = None,
    filters: list[dict[str, Any]] | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    _validate_source_identifier(table)
    selected = columns or []
    if len(selected) > 20:
        raise MCPDataError("select cannot exceed 20 columns")
    for column in selected:
        _validate_source_identifier(column)

    filter_items = filters or []
    if len(filter_items) > 10:
        raise MCPDataError("filters cannot exceed 10 entries")

    select_sql = sql.SQL("*") if not selected else sql.SQL(", ").join(
        sql.Identifier(column) for column in selected
    )
    statement = sql.SQL("SELECT {} FROM {}.{}").format(
        select_sql,
        sql.Identifier("source"),
        sql.Identifier(table),
    )

    clauses: list[sql.Composed] = []
    params: list[Any] = []
    operators = {
        "eq": sql.SQL("="),
        "ne": sql.SQL("<>"),
        "gt": sql.SQL(">"),
        "gte": sql.SQL(">="),
        "lt": sql.SQL("<"),
        "lte": sql.SQL("<="),
    }
    for item in filter_items:
        if not isinstance(item, dict):
            raise MCPDataError("each filter must be an object")
        unknown = set(item) - {"field", "op", "value"}
        if unknown:
            raise MCPDataError("filter contains unsupported fields")
        field = item.get("field")
        op = item.get("op", "eq")
        value = item.get("value")
        if not isinstance(field, str):
            raise MCPDataError("filter field must be a string")
        _validate_source_identifier(field)
        if op == "contains":
            if not isinstance(value, str):
                raise MCPDataError("contains filter requires a string value")
            validate_text(value)
            clauses.append(sql.SQL("{}::text ILIKE %s").format(sql.Identifier(field)))
            params.append(f"%{value}%")
        elif op == "in":
            if not isinstance(value, list) or not value or len(value) > 50:
                raise MCPDataError("in filter requires 1 to 50 values")
            placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in value)
            clauses.append(sql.SQL("{} IN ({})").format(sql.Identifier(field), placeholders))
            params.extend(value)
        elif op in operators:
            clauses.append(sql.SQL("{} {} %s").format(sql.Identifier(field), operators[op]))
            params.append(value)
        else:
            raise MCPDataError("unsupported filter operator")

    if clauses:
        statement += sql.SQL(" WHERE ") + sql.SQL(" AND ").join(clauses)
    limit = max(1, min(int(limit), 100))
    statement += sql.SQL(" LIMIT %s")
    params.append(limit)

    try:
        with _connection(target) as connection, connection.cursor() as cursor:
            cursor.execute(statement, params)
            return list(cursor.fetchall())
    except psycopg.Error as exc:
        raise MCPDataUnavailable("governed source query failed") from exc



def aggregate_table(
    target: DatabaseTarget,
    *,
    table: str,
    group_by: str | None = None,
    measure: str | None = None,
    aggregation: str = "count",
    filters: list[dict[str, Any]] | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    """Run one bounded read-only aggregate for dashboard visuals."""
    _validate_source_identifier(table)
    if group_by is not None:
        _validate_source_identifier(group_by)
    if measure is not None:
        _validate_source_identifier(measure)

    aggregation_key = str(aggregation).lower()
    if aggregation_key not in {"count", "sum", "avg", "min", "max"}:
        raise MCPDataError("unsupported aggregation")
    if aggregation_key != "count" and measure is None:
        raise MCPDataError("measure is required for this aggregation")

    filter_items = filters or []
    if len(filter_items) > 10:
        raise MCPDataError("filters cannot exceed 10 entries")

    clauses: list[sql.Composed] = []
    params: list[Any] = []
    operators = {
        "eq": sql.SQL("="),
        "ne": sql.SQL("<>"),
        "gt": sql.SQL(">"),
        "gte": sql.SQL(">="),
        "lt": sql.SQL("<"),
        "lte": sql.SQL("<="),
    }
    for item in filter_items:
        if not isinstance(item, dict):
            raise MCPDataError("each filter must be an object")
        unknown = set(item) - {"field", "op", "value"}
        if unknown:
            raise MCPDataError("filter contains unsupported fields")
        field = item.get("field")
        op = item.get("op", "eq")
        value = item.get("value")
        if not isinstance(field, str):
            raise MCPDataError("filter field must be a string")
        _validate_source_identifier(field)
        if op == "contains":
            if not isinstance(value, str):
                raise MCPDataError("contains filter requires a string value")
            validate_text(value)
            clauses.append(sql.SQL("{}::text ILIKE %s").format(sql.Identifier(field)))
            params.append(f"%{value}%")
        elif op == "in":
            if not isinstance(value, list) or not value or len(value) > 50:
                raise MCPDataError("in filter requires 1 to 50 values")
            placeholders = sql.SQL(", ").join(sql.Placeholder() for _ in value)
            clauses.append(sql.SQL("{} IN ({})").format(sql.Identifier(field), placeholders))
            params.extend(value)
        elif op in operators:
            clauses.append(sql.SQL("{} {} %s").format(sql.Identifier(field), operators[op]))
            params.append(value)
        else:
            raise MCPDataError("unsupported filter operator")

    if aggregation_key == "count":
        value_expression = (
            sql.SQL("count(*)")
            if measure is None
            else sql.SQL("count({})").format(sql.Identifier(measure))
        )
    else:
        value_expression = sql.SQL("{}({})").format(
            sql.SQL(aggregation_key),
            sql.Identifier(measure),
        )

    if group_by is None:
        statement = sql.SQL("SELECT {} AS value FROM {}.{}").format(
            value_expression,
            sql.Identifier("source"),
            sql.Identifier(table),
        )
    else:
        statement = sql.SQL(
            "SELECT {} AS group_value, {} AS value FROM {}.{}"
        ).format(
            sql.Identifier(group_by),
            value_expression,
            sql.Identifier("source"),
            sql.Identifier(table),
        )

    if clauses:
        statement += sql.SQL(" WHERE ") + sql.SQL(" AND ").join(clauses)

    if group_by is not None:
        statement += sql.SQL(" GROUP BY {} ORDER BY value DESC NULLS LAST").format(
            sql.Identifier(group_by)
        )
        limit = max(1, min(int(limit), 50))
        statement += sql.SQL(" LIMIT %s")
        params.append(limit)

    try:
        with _connection(target) as connection, connection.cursor() as cursor:
            cursor.execute(statement, params)
            rows = list(cursor.fetchall())
    except psycopg.Error as exc:
        raise MCPDataUnavailable("governed aggregate query failed") from exc

    normalized: list[dict[str, Any]] = []
    for row in rows:
        item: dict[str, Any] = {"value": row.get("value")}
        if group_by is not None:
            item[group_by] = row.get("group_value")
        normalized.append(item)

    return {
        "table": table,
        "group_by": group_by,
        "measure": measure,
        "aggregation": aggregation_key,
        "rows": normalized,
    }

def table_statistics(
    target: DatabaseTarget,
    *,
    table: str,
    columns: list[str] | None = None,
    limit: int = 100,
    max_categories: int = 20,
) -> dict[str, Any]:
    """Compute deterministic bounded statistics from source rows.

    Numeric-like text supports currency symbols, commas, percentages, whitespace,
    and accounting parentheses. Low-cardinality text receives exact value counts.
    High-cardinality text is summarized without returning its raw distinct values.
    """
    _validate_source_identifier(table)
    selected = columns or []
    if len(selected) > 20:
        raise MCPDataError("statistics columns cannot exceed 20")
    for column in selected:
        _validate_source_identifier(column)

    safe_limit = max(1, min(int(limit), 100))
    safe_categories = max(2, min(int(max_categories), 20))
    rows = query_table(
        target,
        table=table,
        columns=selected or None,
        limit=safe_limit,
    )
    if not rows:
        return {
            "table": table,
            "sample_row_count": 0,
            "sample_limit": safe_limit,
            "columns": {},
        }

    column_names = selected or list(rows[0].keys())[:20]
    summaries: dict[str, Any] = {}

    for column in column_names:
        values = [row.get(column) for row in rows]
        present = [value for value in values if value is not None and str(value).strip() != ""]
        numeric_values = [
            parsed
            for value in present
            if (parsed := _parse_numeric_like(value)) is not None
        ]
        item: dict[str, Any] = {
            "non_null_count": len(present),
            "null_count": len(values) - len(present),
        }

        if present and len(numeric_values) == len(present):
            total = sum(numeric_values)
            item["numeric"] = {
                "count": len(numeric_values),
                "sum": round(total, 6),
                "avg": round(total / len(numeric_values), 6),
                "min": round(min(numeric_values), 6),
                "max": round(max(numeric_values), 6),
                "parser": "numeric_currency_percent_parentheses",
            }
        else:
            counts = Counter(str(value) for value in present)
            item["distinct_count"] = len(counts)
            if counts and len(counts) <= safe_categories:
                item["value_counts"] = dict(
                    sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
                )

        summaries[column] = item

    return {
        "table": table,
        "sample_row_count": len(rows),
        "sample_limit": safe_limit,
        "max_categories": safe_categories,
        "columns": summaries,
    }


def profile_source(target: DatabaseTarget, table: str | None = None) -> dict[str, Any]:
    if table is None:
        return {"tables": source_tables(target)}
    _validate_source_identifier(table)
    count_statement = sql.SQL("SELECT count(*) AS row_count FROM {}.{}").format(
        sql.Identifier("source"),
        sql.Identifier(table),
    )
    columns_query = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'source' AND table_name = %s
        ORDER BY ordinal_position
        LIMIT 200
    """
    try:
        with _connection(target) as connection, connection.cursor() as cursor:
            cursor.execute(count_statement)
            count_row = cursor.fetchone() or {"row_count": 0}
            cursor.execute(columns_query, (table,))
            columns = list(cursor.fetchall())
        return {"table": table, "row_count": count_row["row_count"], "columns": columns}
    except psycopg.Error as exc:
        raise MCPDataUnavailable("could not profile governed source table") from exc


def rag_retrieve(
    target: DatabaseTarget,
    *,
    query: str,
    top_k: int,
    max_context_chars: int,
) -> list[dict[str, Any]]:
    validate_text(query)
    top_k = max(1, min(int(top_k), 20))
    exists_query = "SELECT to_regclass('source.rag_chunks') AS table_name"
    retrieval_query = """
        SELECT
            content,
            metadata,
            ts_rank_cd(
                to_tsvector('english', coalesce(content, '')),
                websearch_to_tsquery('english', %s)
            ) AS rank
        FROM source.rag_chunks
        WHERE to_tsvector('english', coalesce(content, ''))
              @@ websearch_to_tsquery('english', %s)
        ORDER BY rank DESC
        LIMIT %s
    """
    try:
        with _connection(target) as connection, connection.cursor() as cursor:
            cursor.execute(exists_query)
            row = cursor.fetchone()
            if not row or row["table_name"] is None:
                raise MCPDataUnavailable("RAG store is not initialized; expected source.rag_chunks")
            cursor.execute(retrieval_query, (query, query, top_k))
            rows = list(cursor.fetchall())
    except MCPDataUnavailable:
        raise
    except psycopg.Error as exc:
        raise MCPDataUnavailable("governed RAG retrieval failed") from exc

    remaining = max_context_chars
    bounded: list[dict[str, Any]] = []
    for row in rows:
        content = str(row.get("content") or "")
        if remaining <= 0:
            break
        if len(content) > remaining:
            content = content[:remaining]
        bounded.append({"content": content, "metadata": row.get("metadata"), "rank": row.get("rank")})
        remaining -= len(content)
    return bounded
