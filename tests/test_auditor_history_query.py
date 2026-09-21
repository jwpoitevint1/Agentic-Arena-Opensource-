from app.agentic_run_store import _AUDIT_RUN_SQL


def test_auditor_history_query_has_only_bound_limit_placeholder() -> None:
    assert _AUDIT_RUN_SQL.count("%") == 1
    assert "LIMIT %s" in _AUDIT_RUN_SQL
    assert "NOT LIKE" not in _AUDIT_RUN_SQL


def test_auditor_history_query_excludes_recursive_auditor_operations_without_wildcards() -> None:
    assert "left(coalesce(operation, ''), 6) <> 'audit.'" in _AUDIT_RUN_SQL
    assert "left(coalesce(operation, ''), 8) <> 'auditor.'" in _AUDIT_RUN_SQL
    assert "NOT IN ('evaluator', 'auditor')" in _AUDIT_RUN_SQL
