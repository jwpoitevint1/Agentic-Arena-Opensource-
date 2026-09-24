from pathlib import Path

from app.agentic_run_store import _INSERT_SQL


def test_agentic_run_insert_persists_prompt_and_model_response() -> None:
    assert "prompt_text" in _INSERT_SQL
    assert "model_response" in _INSERT_SQL
    assert "%(prompt_text)s" in _INSERT_SQL
    assert "%(model_response)s" in _INSERT_SQL


def test_prompt_is_signed_before_integrity_envelope() -> None:
    source = Path("app/agentic_run_store.py").read_text(encoding="utf-8")
    input_pos = source.index('persisted["input"] = {')
    integrity_pos = source.index('persisted["integrity"] = build_integrity_envelope(')
    assert input_pos < integrity_pos
    assert '"prompt_text": prompt_text' in source
    assert '"model_response": persisted_output.get("text")' in source


def test_governed_and_ungoverned_routes_pass_raw_user_task() -> None:
    governed = Path("app/governed_routes.py").read_text(encoding="utf-8")
    ungoverned = Path("app/ungoverned_routes.py").read_text(encoding="utf-8")
    chatbot = Path("app/chatbot_routes.py").read_text(encoding="utf-8")

    assert governed.count("prompt_text=request.task") == 2
    assert ungoverned.count("prompt_text=request.task") == 2
    assert chatbot.count("prompt_text=request.message") == 2


def test_migration_targets_both_recording_databases() -> None:
    migration = Path("scripts/migrate_agentic_run_text_fields.py").read_text(
        encoding="utf-8"
    )
    assert '"governed": "DB_LOG_AGENTIC_GOV"' in migration
    assert '"ungoverned": "DB_LOG_AGENTIC_UNGOV"' in migration
    assert "ADD COLUMN IF NOT EXISTS prompt_text text" in migration
    assert "ADD COLUMN IF NOT EXISTS model_response text" in migration
