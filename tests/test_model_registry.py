import pytest

from app.model_registry import ModelKind, model_for_key, models, models_by_kind, risk_categories_for
from app.telemetry import build_test_record


EXPECTED_MODEL_KEYS = {
    "gemini_3_8_flash",
    "gemini_3_7_flash",
    "gemini_3_6_flash",
    "gemini_3_5_flash_lite",
    "gemini_3_5_flash",
    "gpt_astra_latest",
    "gpt_5_6_luna",
    "gpt_5_6_terra",
    "gpt_5_6_sol",
    "gpt_5_5",
    "mistral_medium_3_5",
    "mistral_small_4",
    "ministral_3_8b_2512",
    "llama_4_scout",
    "llama_4_maverick",
    "llama_3_8b_lunaris",
    "llama_3_1_euryale_70b_v2_2",
    "mercury_2_5",
    "ling_3_0_flash",
    "glm_5_3_prime",
    "ternary_bonsai_2_27b",
    "muse_spark_1_3",
    "qwen_3_8_27b",
    "qwen_3_7_plus",
    "qwen_3_6_flash",
}


def test_model_allowlist_is_complete_and_unique() -> None:
    items = models()

    assert len(items) == 25
    assert {item.key for item in items} == EXPECTED_MODEL_KEYS
    assert len({item.model_id for item in items}) == 25
    assert {item.key for item in items if item.free} == set()


def test_model_kinds_are_separated() -> None:
    assert len(models_by_kind(ModelKind.AGENT)) == 25
    assert len(models_by_kind(ModelKind.EMBEDDING)) == 0
    assert len(models_by_kind(ModelKind.RERANK)) == 0
    assert len(models_by_kind(ModelKind.SAFETY)) == 0
    assert len(models_by_kind(ModelKind.SPEECH)) == 0


def test_model_curation_metadata_is_present() -> None:
    items = models()
    assert {item.access_class for item in items} == {"open_weights", "frontier"}
    assert all(item.parameter_size for item in items)

    open_models = [item for item in items if item.access_class == "open_weights"]
    frontier_models = [item for item in items if item.access_class == "frontier"]
    assert len(open_models) == 10
    assert len(frontier_models) == 15


def test_model_lookup_uses_internal_allowlist_key() -> None:
    model = model_for_key("gpt_5_6_terra")
    assert model.model_id == "openai/gpt-5.6-terra"


def test_dynamic_astra_alias_is_explicit() -> None:
    model = model_for_key("gpt_astra_latest")
    assert model.model_id == "~openai/gpt-astra-latest"
    assert "Version drift" in risk_categories_for(model)


def test_arbitrary_model_id_is_rejected() -> None:
    with pytest.raises(KeyError):
        model_for_key("some-provider/not-approved")


def test_removed_models_are_rejected() -> None:
    for model_key in (
        "ling_3_0_flash_vl_free",
        "mistral_small_3_2_24b",
        "deepseek_v4_1_flash",
        "glm_5_3_flash",
        "qwen_3_8_flash",
        "qwen_3_8_27b_free",
        "gpt_6_astra",
        "voxtral_mini_3b_2507",
    ):
        with pytest.raises(KeyError):
            model_for_key(model_key)


def test_agentic_telemetry_records_weight_and_parameter_metadata() -> None:
    model = model_for_key("llama_4_maverick")
    record = build_test_record(
        result=None,
        model=model,
        governance="governed",
        operation="test",
    )

    assert record["model"]["access_class"] == "open_weights"
    assert record["model"]["parameter_size"] == "400B total / 17B active"
    assert record["model"]["parameter_total_b"] == 400
    assert record["model"]["parameter_active_b"] == 17


def test_model_risk_categories_are_general_and_metadata_driven() -> None:
    ling = model_for_key("ling_3_0_flash")
    gpt = model_for_key("gpt_5_6_sol")
    lunaris = model_for_key("llama_3_8b_lunaris")

    assert "Probabilistic output variability" in risk_categories_for(ling)
    assert "Tool-use boundary" in risk_categories_for(ling)
    assert "Open-weight deployment variance" in risk_categories_for(ling)

    assert "Provider dependency / opacity" in risk_categories_for(gpt)
    assert "Version drift" not in risk_categories_for(gpt)

    assert "Tool-use boundary" not in risk_categories_for(lunaris)


def test_agentic_telemetry_persists_full_model_output() -> None:
    model = model_for_key("ling_3_0_flash")
    output = "Full model output persisted for behavioral analysis."
    result = {
        "result": {
            "choices": [
                {
                    "message": {"role": "assistant", "content": output},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18},
        },
        "transport": {"latency_ms": 125.0},
    }

    record = build_test_record(
        result=result,
        model=model,
        governance="ungoverned",
        operation="test.output.persistence",
    )

    assert record["output"]["text"] == output
    assert record["output"]["characters"] == len(output)
    assert record["output"]["storage"] == "full_text"
    assert len(record["output"]["sha256"]) == 64
