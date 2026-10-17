from pathlib import Path


def test_agentic_arena_ui_replaces_mistral_small_with_granite() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")
    fallback = source.split("const FALLBACK_MODELS = [", 1)[1].split("];", 1)[0]

    assert "granite_4_2_8b" in fallback
    assert "mistral_small_4" not in fallback
    assert "mistral_medium_3_5" in fallback
    assert "ministral_3_8b_2512" in fallback
