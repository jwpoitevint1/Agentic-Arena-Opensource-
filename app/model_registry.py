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

    def to_dict(self) -> dict[str, str | bool]:
        data = asdict(self)
        data["kind"] = self.kind.value
        return data


_MODELS: tuple[ModelDefinition, ...] = (
    ModelDefinition(
        key="ling_3_0_flash_vl_free",
        display_name="Ling 3.0 Flash VL (free)",
        vendor="inclusionAI",
        model_id="inclusionai/ling-3.0-flash-vl:free",
        kind=ModelKind.AGENT,
        free=True,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gpt_sol_latest",
        display_name="GPT Sol Latest",
        vendor="OpenAI",
        model_id="~openai/gpt-sol-latest",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="gpt_luna_latest",
        display_name="GPT Luna Latest",
        vendor="OpenAI",
        model_id="~openai/gpt-luna-latest",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="deepseek_v4_1_flash",
        display_name="DeepSeek V4.1 Flash",
        vendor="DeepSeek",
        model_id="deepseek/deepseek-v4.1-flash",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="deepseek_flash_latest",
        display_name="DeepSeek Flash Latest",
        vendor="DeepSeek",
        model_id="~deepseek/deepseek-flash-latest",
        kind=ModelKind.AGENT,
        tool_capable=True,
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
        key="claude_fable_5_1",
        display_name="Claude Fable 5.1",
        vendor="Anthropic",
        model_id="anthropic/claude-fable-5.1",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="glm_flash_latest",
        display_name="GLM Flash Latest",
        vendor="Z.ai",
        model_id="~z-ai/glm-flash-latest",
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
    ),
    ModelDefinition(
        key="glm_5_3",
        display_name="GLM 5.3",
        vendor="Z.ai",
        model_id="z-ai/glm-5.3",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="qwen_3_8_27b_free",
        display_name="Qwen3.8 27B (free)",
        vendor="Qwen",
        model_id="qwen/qwen3.8-27b:free",
        kind=ModelKind.AGENT,
        free=True,
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
        key="deepseek_v4_flash_latest",
        display_name="DeepSeek V4 Flash Latest",
        vendor="DeepSeek",
        model_id="~deepseek/deepseek-v4-flash-latest",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="deepseek_v4_flash_0731_free",
        display_name="DeepSeek V4 Flash 0731 (free)",
        vendor="DeepSeek",
        model_id="deepseek/deepseek-v4-flash-0731:free",
        kind=ModelKind.AGENT,
        free=True,
        tool_capable=True,
    ),
    ModelDefinition(
        key="claude_opus_5",
        display_name="Claude Opus 5",
        vendor="Anthropic",
        model_id="anthropic/claude-opus-5",
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
        key="claude_sonnet_5",
        display_name="Claude Sonnet 5",
        vendor="Anthropic",
        model_id="anthropic/claude-sonnet-5",
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
        key="grok_4_6",
        display_name="Grok 4.6",
        vendor="xAI",
        model_id="x-ai/grok-4.6",
        kind=ModelKind.AGENT,
        tool_capable=True,
    ),
    ModelDefinition(
        key="grok_4_3",
        display_name="Grok 4.3",
        vendor="xAI",
        model_id="x-ai/grok-4.3",
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
    ),
    ModelDefinition(
        key="llama_4_scout",
        display_name="Llama 4 Scout",
        vendor="Meta",
        model_id="meta-llama/llama-4-scout",
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
