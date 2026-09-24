import pytest

from app.model_registry import ModelKind, model_for_key, models, models_by_kind, risk_categories_for
from app.telemetry import build_test_record


EXPECTED_MODEL_KEYS = {
    "ling_3_0_flash_vl_free",
    "gemini_3_8_flash",
    "gemini_3_7_flash",
    "gemini_3_6_flash",
    "llama_4_maverick",
    "llama_4_scout",
    "deepseek_v4_1_flash",
    "deepseek_v4_flash_0731_free",
    "glm_5_3_flash",
    "gpt_5_6_luna",
    "gpt_5_6_sol",
    "gemini_3_5_flash_lite",
    "qwen_3_8_flash",
    "qwen_3_8_27b_free",
    "muse_spark_1_3",
    "qwen_3_8_27b",
    "qwen_3_8_2_4t_a95b",
    "gpt_6_astra",
    "kimi_k3",
    "mistral_medium_3_5",
    "qwen_3_6_flash",
    "gpt_5_5",
    "gemma_4_26b_a4b_free",
    "gemma_4_31b_free",
    "gemma_4_26b_a4b",
    "ministral_3_8b_2512",
    "mistral_medium_3",
    "mistral_small_3_2_24b",
}


def test_model_allowlist_is_complete_and_unique() -> None:
    items = models()

    assert len(items) == 28
    assert {item.key for item in items} == EXPECTED_MODEL_KEYS
    assert len({item.model_id for item in items}) == 28
    assert {item.key for item in items if item.free} == {
        "ling_3_0_flash_vl_free",
        "deepseek_v4_flash_0731_free",
        "qwen_3_8_27b_free",
        "gemma_4_26b_a4b_free",
        "gemma_4_31b_free",
    }


def test_model_kinds_are_separated() -> None:
    assert len(models_by_kind(ModelKind.AGENT)) == 28
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
    assert len(open_models) == 17
    assert len(frontier_models) == 11


def test_ling_remains_first_default_agent() -> None:
    assert models()[0].key == "ling_3_0_flash_vl_free"


def test_model_lookup_uses_internal_allowlist_key() -> None:
    model = model_for_key("gpt_5_6_sol")

    assert model.model_id == "openai/gpt-5.6-sol"


def test_arbitrary_model_id_is_rejected() -> None:
    with pytest.raises(KeyError):
        model_for_key("some-provider/not-approved")


def test_removed_dynamic_aliases_are_rejected() -> None:
    for model_key in (
        "deepseek_v4_flash_latest",
        "gpt_sol_latest",
        "gpt_luna_latest",
        "glm_flash_latest",
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
    ling = model_for_key("ling_3_0_flash_vl_free")
    gpt = model_for_key("gpt_5_6_sol")
    kimi = model_for_key("kimi_k3")

    assert "Probabilistic output variability" in risk_categories_for(ling)
    assert "Tool-use boundary" in risk_categories_for(ling)
    assert "Open-weight deployment variance" in risk_categories_for(ling)
    assert "Availability / rate-limit variability" in risk_categories_for(ling)

    assert "Provider dependency / opacity" in risk_categories_for(gpt)
    assert "Version drift" not in risk_categories_for(gpt)

    assert "Large-model resource exposure" in risk_categories_for(kimi)


def test_agentic_telemetry_persists_full_model_output() -> None:
    model = model_for_key("ling_3_0_flash_vl_free")
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
