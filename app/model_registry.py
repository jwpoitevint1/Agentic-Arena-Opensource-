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
        key="gemini_3_5_flash_lite",
        display_name="Gemini 3.5 Flash Lite",
        vendor="Google",
        model_id="google/gemini-3.5-flash-lite",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gemini_3_5_flash",
        display_name="Gemini 3.5 Flash",
        vendor="Google",
        model_id="google/gemini-3.5-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gpt_astra_latest",
        display_name="GPT Astra Latest",
        vendor="OpenAI",
        model_id="~openai/gpt-astra-latest",
        kind=ModelKind.AGENT,
        tool_capable=True,
        parameter_size="Dynamic family alias",
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
        key="gpt_5_6_terra",
        display_name="GPT-5.6 Terra",
        vendor="OpenAI",
        model_id="openai/gpt-5.6-terra",
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
        key="gpt_5_5",
        display_name="GPT-5.5",
        vendor="OpenAI",
        model_id="openai/gpt-5.5",
        kind=ModelKind.AGENT,
        tool_capable=True,
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
        key="mistral_small_4",
        display_name="Mistral Small 4",
        vendor="Mistral AI",
        model_id="mistralai/mistral-small-2603",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="Published open weights",
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
        key="llama_3_8b_lunaris",
        display_name="Llama 3 8B Lunaris",
        vendor="Sao10K",
        model_id="sao10k/l3-lunaris-8b",
        kind=ModelKind.AGENT,
        tool_capable=False,
        access_class="open_weights",
        parameter_size="8B dense",
        parameter_total_b=8,
        parameter_active_b=8,
    ),
    ModelDefinition(
        key="llama_3_1_euryale_70b_v2_2",
        display_name="Llama 3.1 Euryale 70B v2.2",
        vendor="Sao10K",
        model_id="sao10k/l3.1-euryale-70b",
        kind=ModelKind.AGENT,
        tool_capable=False,
        access_class="open_weights",
        parameter_size="70B dense",
        parameter_total_b=70,
        parameter_active_b=70,
    ),
    ModelDefinition(
        key="mercury_2_5",
        display_name="Mercury 2.5",
        vendor="Inception",
        model_id="inception/mercury-2.5",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="ling_3_0_flash",
        display_name="Ling 3.0 Flash",
        vendor="inclusionAI",
        model_id="inclusionai/ling-3.0-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
        access_class="open_weights",
        parameter_size="124B total / 5.1B active",
        parameter_total_b=124,
        parameter_active_b=5.1,
    ),
    ModelDefinition(
        key="glm_5_3_prime",
        display_name="GLM 5.3 Prime",
        vendor="Z.ai",
        model_id="z-ai/glm-5.3-prime",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="ternary_bonsai_2_27b",
        display_name="Ternary Bonsai 2 27B",
        vendor="PrismML",
        model_id="prism-ml/ternary-bonsai-2-27b",
        kind=ModelKind.AGENT,
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
        key="qwen_3_7_plus",
        display_name="Qwen3.7 Plus",
        vendor="Qwen",
        model_id="qwen/qwen3.7-plus",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="qwen_3_6_flash",
        display_name="Qwen3.6 Flash",
        vendor="Qwen",
        model_id="qwen/qwen3.6-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
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
