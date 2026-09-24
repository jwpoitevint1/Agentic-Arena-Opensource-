from pathlib import Path

from app.agentic_run_store import _RUNTIME_LOGBOOK_SQL


def test_runtime_logbook_query_reads_complete_records_newest_first() -> None:
    assert _RUNTIME_LOGBOOK_SQL.count("%") == 1
    assert "record" in _RUNTIME_LOGBOOK_SQL
    assert "ORDER BY recorded_at DESC, run_id DESC" in _RUNTIME_LOGBOOK_SQL
    assert "LIMIT %s" in _RUNTIME_LOGBOOK_SQL
    assert "output_excerpt" not in _RUNTIME_LOGBOOK_SQL


def test_runtime_logbook_backend_is_read_only_and_capped_at_25() -> None:
    source = Path("app/agentic_run_store.py").read_text(encoding="utf-8")
    assert "def runtime_logbook_runs(limit: int = 25)" in source
    assert 'safe_limit = max(1, min(int(limit), 25))' in source
    assert 'cursor.execute("BEGIN READ ONLY")' in source
    assert '"record": record' in source
    assert '"runs": runs[:safe_limit]' in source


def test_runtime_logbook_endpoint_and_ui_surface_full_records() -> None:
    backend = Path("app/main.py").read_text(encoding="utf-8")
    ui = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert '/system/runtime-logbook' in backend
    assert '["logbook", "Runtime Logbook", "03"]' in ui
    assert 'apiRequest("/api/v1/system/runtime-logbook?limit=25"' in ui
    assert "Each persisted run record is shown in full for transparency." in ui
    assert "JSON.stringify(record, null, 2)" in ui
    assert "jwpoitevint1@gmail.com" in ui
