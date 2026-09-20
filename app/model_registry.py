from dataclasses import asdict, dataclass
from enum import Enum


class ModelKind(str, Enum):
    AGENT = "agent"
    EMBEDDING = "embedding"
    RERANK = "rerank"
    SAFETY = "safety"
    SPEECH = "speech"


@dataclass(frozen=True)
class ModelDefinition:
    key: str
    display_name: str
    vendor: str
    model_id: str
    kind: ModelKind
    free: bool = False
    tool_capable: bool = False
    access_class: str = "frontier"
    parameter_size: str = "Undisclosed"
    parameter_total_b: float | None = None
    parameter_active_b: float | None = None

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["kind"] = self.kind.value
        data["risk_categories"] = list(risk_categories_for(self))
        return data


def risk_categories_for(model: ModelDefinition) -> tuple[str, ...]:
    """Return general governance risk categories derived from registry metadata."""
    categories: list[str] = ["Probabilistic output variability"]

    if model.tool_capable:
        categories.append("Tool-use boundary")

    if model.access_class == "frontier":
        categories.append("Provider dependency / opacity")
    elif model.access_class == "open_weights":
        categories.append("Open-weight deployment variance")

    if model.free:
        categories.append("Availability / rate-limit variability")

    if model.model_id.startswith("~") or "dynamic family alias" in model.parameter_size.lower():
        categories.append("Version drift")

    if model.parameter_total_b is not None and model.parameter_total_b >= 500:
        categories.append("Large-model resource exposure")

    return tuple(categories)


_MODELS: tuple[ModelDefinition, ...] = (
    ModelDefinition(
        key="ling_3_0_flash_vl_free",
        display_name="Ling 3.0 Flash VL (free)",
        vendor="inclusionAI",
        model_id="inclusionai/ling-3.0-flash-vl:free",
        kind=ModelKind.AGENT,
        free=True,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="124B total / 5.5B active",
        parameter_total_b=124,
        parameter_active_b=5.5,
    ),
    ModelDefinition(
        key="gemini_3_8_flash",
        display_name="Gemini 3.8 Flash",
        vendor="Google",
        model_id="google/gemini-3.8-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gemini_3_7_flash",
        display_name="Gemini 3.7 Flash",
        vendor="Google",
        model_id="google/gemini-3.7-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gemini_3_6_flash",
        display_name="Gemini 3.6 Flash",
        vendor="Google",
        model_id="google/gemini-3.6-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="llama_4_maverick",
        display_name="Llama 4 Maverick",
        vendor="Meta",
        model_id="meta-llama/llama-4-maverick",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="400B total / 17B active",
        parameter_total_b=400,
        parameter_active_b=17,
    ),
    ModelDefinition(
        key="llama_4_scout",
        display_name="Llama 4 Scout",
        vendor="Meta",
        model_id="meta-llama/llama-4-scout",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="109B total / 17B active",
        parameter_total_b=109,
        parameter_active_b=17,
    ),
    ModelDefinition(
        key="deepseek_v4_1_flash",
        display_name="DeepSeek V4.1 Flash",
        vendor="DeepSeek",
        model_id="deepseek/deepseek-v4.1-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="552B total / 8B input · 16B output active",
        parameter_total_b=552,
        parameter_active_b=16,
    ),
    ModelDefinition(
        key="deepseek_v4_flash_0731_free",
        display_name="DeepSeek V4 Flash 0731 (free)",
        vendor="DeepSeek",
        model_id="deepseek/deepseek-v4-flash-0731:free",
        kind=ModelKind.AGENT,
        free=True,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="284B total / 13B active",
        parameter_total_b=284,
        parameter_active_b=13,
    ),
    ModelDefinition(
        key="glm_5_3_flash",
        display_name="GLM 5.3 Flash",
        vendor="Z.ai",
        model_id="z-ai/glm-5.3-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="320B total / 18B active",
        parameter_total_b=320,
        parameter_active_b=18,
    ),
    ModelDefinition(
        key="gpt_5_6_luna",
        display_name="GPT-5.6 Luna",
        vendor="OpenAI",
        model_id="openai/gpt-5.6-luna",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gpt_5_6_sol",
        display_name="GPT-5.6 Sol",
        vendor="OpenAI",
        model_id="openai/gpt-5.6-sol",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gemini_3_5_flash_lite",
        display_name="Gemini 3.5 Flash Lite",
        vendor="Google",
        model_id="google/gemini-3.5-flash-lite",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="qwen_3_8_flash",
        display_name="Qwen3.8 Flash",
        vendor="Qwen",
        model_id="qwen/qwen3.8-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="125B main + 51B n-gram / 6B active",
        parameter_total_b=176,
        parameter_active_b=6,
    ),
    ModelDefinition(
        key="qwen_3_8_27b_free",
        display_name="Qwen3.8 27B (free)",
        vendor="Qwen",
        model_id="qwen/qwen3.8-27b:free",
        kind=ModelKind.AGENT,
        free=True,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="27B dense",
        parameter_total_b=27,
        parameter_active_b=27,
    ),
    ModelDefinition(
        key="muse_spark_1_3",
        display_name="Muse Spark 1.3",
        vendor="Meta",
        model_id="meta/muse-spark-1.3",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="qwen_3_8_27b",
        display_name="Qwen3.8 27B",
        vendor="Qwen",
        model_id="qwen/qwen3.8-27b",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="27B dense",
        parameter_total_b=27,
        parameter_active_b=27,
    ),
    ModelDefinition(
        key="qwen_3_8_2_4t_a95b",
        display_name="Qwen3.8 2.4T A95B",
        vendor="Qwen",
        model_id="qwen/qwen3.8-2.4t-a95b",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="2.4T total / 95B active",
        parameter_total_b=2400,
        parameter_active_b=95,
    ),
    ModelDefinition(
        key="gpt_6_astra",
        display_name="GPT-6 Astra",
        vendor="OpenAI",
        model_id="openai/gpt-6-astra",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="kimi_k3",
        display_name="Kimi K3",
        vendor="MoonshotAI",
        model_id="moonshotai/kimi-k3",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="2.8T total",
        parameter_total_b=2800,
    ),
    ModelDefinition(
        key="mistral_medium_3_5",
        display_name="Mistral Medium 3.5",
        vendor="Mistral AI",
        model_id="mistralai/mistral-medium-3-5",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="128B dense",
        parameter_total_b=128,
        parameter_active_b=128,
    ),
    ModelDefinition(
        key="qwen_3_6_flash",
        display_name="Qwen3.6 Flash",
        vendor="Qwen",
        model_id="qwen/qwen3.6-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gpt_5_5",
        display_name="GPT-5.5",
        vendor="OpenAI",
        model_id="openai/gpt-5.5",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gemma_4_26b_a4b_free",
        display_name="Gemma 4 26B A4B (free)",
        vendor="Google",
        model_id="google/gemma-4-26b-a4b-it:free",
        kind=ModelKind.AGENT,
        free=True,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="25.2B total / 3.8B active",
        parameter_total_b=25.2,
        parameter_active_b=3.8,
    ),
    ModelDefinition(
        key="gemma_4_31b_free",
        display_name="Gemma 4 31B (free)",
        vendor="Google",
        model_id="google/gemma-4-31b-it:free",
        kind=ModelKind.AGENT,
        free=True,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="30.7B dense",
        parameter_total_b=30.7,
        parameter_active_b=30.7,
    ),
    ModelDefinition(
        key="gemma_4_26b_a4b",
        display_name="Gemma 4 26B A4B",
        vendor="Google",
        model_id="google/gemma-4-26b-a4b-it",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="25.2B total / 3.8B active",
        parameter_total_b=25.2,
        parameter_active_b=3.8,
    ),
    ModelDefinition(
        key="ministral_3_8b_2512",
        display_name="Ministral 3 8B 2512",
        vendor="Mistral AI",
        model_id="mistralai/ministral-8b-2512",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="8B dense",
        parameter_total_b=8,
        parameter_active_b=8,
    ),
    ModelDefinition(
        key="mistral_medium_3",
        display_name="Mistral Medium 3",
        vendor="Mistral AI",
        model_id="mistralai/mistral-medium-3",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="mistral_small_3_2_24b",
        display_name="Mistral Small 3.2 24B",
        vendor="Mistral AI",
        model_id="mistralai/mistral-small-3.2-24b-instruct",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="24B dense",
        parameter_total_b=24,
        parameter_active_b=24,
    ),
)

_MODEL_BY_KEY = {model.key: model for model in _MODELS}


def models() -> list[ModelDefinition]:
    return list(_MODELS)


def model_for_key(model_key: str) -> ModelDefinition:
    try:
        return _MODEL_BY_KEY[model_key]
    except KeyError as exc:
        raise KeyError(f"model is not allowlisted: {model_key}") from exc


def models_by_kind(kind: ModelKind) -> list[ModelDefinition]:
    return [model for model in _MODELS if model.kind is kind]
