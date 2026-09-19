import pytest

from app.model_registry import ModelKind, model_for_key, models, models_by_kind


EXPECTED_MODEL_KEYS = {
    "ling_3_0_flash_vl_free",
    "gpt_sol_latest",
    "gpt_luna_latest",
    "deepseek_v4_1_flash",
    "deepseek_flash_latest",
    "gemini_3_8_flash",
    "claude_fable_5_1",
    "glm_flash_latest",
    "qwen_3_8_flash",
    "glm_5_3",
    "qwen_3_8_27b_free",
    "gemini_3_7_flash",
    "deepseek_v4_flash_latest",
    "deepseek_v4_flash_0731_free",
    "claude_opus_5",
    "gemini_3_6_flash",
    "gpt_5_6_luna",
    "gpt_5_6_sol",
    "claude_sonnet_5",
    "gemini_3_5_flash",
    "grok_4_6",
    "grok_4_3",
    "llama_4_maverick",
    "llama_4_scout",
}


def test_model_allowlist_is_complete_and_unique() -> None:
    items = models()

    assert len(items) == 24
    assert {item.key for item in items} == EXPECTED_MODEL_KEYS
    assert len({item.model_id for item in items}) == 24
    assert {item.key for item in items if item.free} == {
        "ling_3_0_flash_vl_free",
        "qwen_3_8_27b_free",
        "deepseek_v4_flash_0731_free",
    }


def test_model_kinds_are_separated() -> None:
    assert len(models_by_kind(ModelKind.AGENT)) == 24
    assert len(models_by_kind(ModelKind.EMBEDDING)) == 0
    assert len(models_by_kind(ModelKind.RERANK)) == 0
    assert len(models_by_kind(ModelKind.SAFETY)) == 0
    assert len(models_by_kind(ModelKind.SPEECH)) == 0


def test_ling_remains_first_default_agent() -> None:
    assert models()[0].key == "ling_3_0_flash_vl_free"


def test_model_lookup_uses_internal_allowlist_key() -> None:
    model = model_for_key("gpt_sol_latest")

    assert model.model_id == "~openai/gpt-sol-latest"


def test_arbitrary_model_id_is_rejected() -> None:
    with pytest.raises(KeyError):
        model_for_key("some-provider/not-approved")
