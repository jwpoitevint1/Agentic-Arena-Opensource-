from pathlib import Path

from app.agentic_run_store import (
    ARCHIVED_TELEMETRY_RUNS,
    CURRENT_TELEMETRY_EPOCH_LABEL,
    CURRENT_TELEMETRY_EPOCH_START,
)


def test_current_telemetry_epoch_archives_pre_mcp_history() -> None:
    assert CURRENT_TELEMETRY_EPOCH_START.isoformat() == "2026-09-21T03:23:31+00:00"
    assert CURRENT_TELEMETRY_EPOCH_LABEL == "post_mcp_deterministic_statistics"
    assert ARCHIVED_TELEMETRY_RUNS == 265


def test_current_summary_queries_exclude_archive_and_non_model_calls() -> None:
    source = Path("app/agentic_run_store.py").read_text(encoding="utf-8")
    assert "recorded_at > %s" in source
    assert "latency_ms > 0" in source
    assert "behavior,model_calls" in source
    assert "outcome,completed" in source


def test_browser_evidence_starts_new_epoch_history() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")
    assert 'agentic-arena-experiment-evidence-v2' in source
    assert '2026-09-21T03:23:31Z' in source
    assert "archived for audit/integrity" in source
