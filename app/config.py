from functools import lru_cache
from pathlib import Path
import os

import yaml
from pydantic import BaseModel, Field


class AppConfig(BaseModel):
    name: str
    version: str
    environment: str


class ServerConfig(BaseModel):
    host: str
    port: int
    log_level: str


class ApiConfig(BaseModel):
    prefix: str
    docs_enabled: bool


class CorsConfig(BaseModel):
    allowed_origins: list[str]
    allow_credentials: bool


class ChatbotDefaultsConfig(BaseModel):
    tone: str = "professional"
    max_history: int = Field(default=12, ge=0, le=50)
    max_output_tokens: int = Field(default=512, ge=1, le=2048)
    safe_mode: bool = True


class ToneProfileConfig(BaseModel):
    style: str


class IpControlsConfig(BaseModel):
    denylist: list[str] = Field(default_factory=list)
    allowlist: list[str] = Field(default_factory=list)
    trust_proxy_headers: bool = True


class RateLimitConfig(BaseModel):
    capacity: float = Field(default=60, gt=0)
    refill_tokens: float = Field(default=30, gt=0)
    refill_interval_sec: float = Field(default=60, gt=0)
    burst_multiplier: float = Field(default=1.0, ge=1.0)


class BiasLexiconConfig(BaseModel):
    high_severity: list[str] = Field(default_factory=list)
    medium_severity: list[str] = Field(default_factory=list)
    low_severity: list[str] = Field(default_factory=list)


class BiasClassifierConfig(BaseModel):
    mode: str = "rule"
    threshold: float = Field(default=0.6, ge=0.0, le=1.0)
    protected_classes: list[str] = Field(default_factory=list)
    lexicon: BiasLexiconConfig = Field(default_factory=BiasLexiconConfig)


class ExternalClassifierConfig(BaseModel):
    endpoint: str = ""
    token: str = ""
    timeout_sec: float = Field(default=3, gt=0)


class AntiBiasConfig(BaseModel):
    refuse_on: list[str] = Field(default_factory=list)
    mitigate_language: list[str] = Field(default_factory=list)
    classifier: BiasClassifierConfig = Field(default_factory=BiasClassifierConfig)
    external: ExternalClassifierConfig = Field(default_factory=ExternalClassifierConfig)


class JailbreakIndicatorsConfig(BaseModel):
    patterns: list[str] = Field(default_factory=list)
    action_on_detect: str = "BLOCK_AND_EXPLAIN"


class ProtectedLexiconConfig(BaseModel):
    redefinition_ban: bool = True
    terms: list[str] = Field(default_factory=list)
    action_on_attempt: str = "BLOCK_AND_LOG"


class PhilosophyConfig(BaseModel):
    allowed: bool = False
    abstract_technology_exception: bool = True
    constraints: list[str] = Field(default_factory=list)
    drift_indicators: list[str] = Field(default_factory=list)
    drift_action: str = "WARN_AND_REFOCUS"


class ContentControlRule(BaseModel):
    allowed: bool = False
    action: str = "BLOCK_AND_EXPLAIN"


class ContentControlsConfig(BaseModel):
    sexual_content: ContentControlRule = Field(default_factory=ContentControlRule)
    profanity: ContentControlRule = Field(default_factory=ContentControlRule)
    explicit_language: ContentControlRule = Field(default_factory=ContentControlRule)


class RedactionsConfig(BaseModel):
    pii_like_patterns: list[str] = Field(default_factory=list)
    on_match: str = "REDACT"


class ResponsesConfig(BaseModel):
    blocked_msg: str
    redefinition_msg: str
    jailbreak_msg: str
    bias_msg: str
    sexual_msg: str
    profanity_msg: str
    philosophy_msg: str


class ChatbotConfig(BaseModel):
    defaults: ChatbotDefaultsConfig = Field(default_factory=ChatbotDefaultsConfig)
    tone_profiles: dict[str, ToneProfileConfig]
    ip_controls: IpControlsConfig = Field(default_factory=IpControlsConfig)
    rate_limit: RateLimitConfig = Field(default_factory=RateLimitConfig)
    anti_bias: AntiBiasConfig = Field(default_factory=AntiBiasConfig)
    jailbreak_indicators: JailbreakIndicatorsConfig = Field(default_factory=JailbreakIndicatorsConfig)
    protected_lexicon: ProtectedLexiconConfig = Field(default_factory=ProtectedLexiconConfig)
    philosophy: PhilosophyConfig = Field(default_factory=PhilosophyConfig)
    content_controls: ContentControlsConfig = Field(default_factory=ContentControlsConfig)
    redactions: RedactionsConfig = Field(default_factory=RedactionsConfig)
    responses: ResponsesConfig
    outbound_allowlist: list[str] = Field(default_factory=list)


class Settings(BaseModel):
    app: AppConfig
    server: ServerConfig
    api: ApiConfig
    cors: CorsConfig
    chatbot: ChatbotConfig


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name: str, default: list[str]) -> list[str]:
    value = os.getenv(name)
    if value is None:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    config_path = Path(os.getenv("APP_CONFIG_PATH", "config.yaml"))
    if not config_path.exists():
        raise RuntimeError(f"Configuration file not found: {config_path}")

    with config_path.open("r", encoding="utf-8") as config_file:
        data = yaml.safe_load(config_file) or {}

    app_config = data.setdefault("app", {})
    server_config = data.setdefault("server", {})
    api_config = data.setdefault("api", {})
    cors_config = data.setdefault("cors", {})
    chatbot_config = data.setdefault("chatbot", {})
    chatbot_defaults = chatbot_config.setdefault("defaults", {})

    app_config["name"] = os.getenv("APP_NAME", app_config.get("name", "Agentic Arena"))
    app_config["version"] = os.getenv("APP_VERSION", app_config.get("version", "0.1.0"))
    app_config["environment"] = os.getenv(
        "APP_ENV", app_config.get("environment", "development")
    )

    server_config["host"] = os.getenv("HOST", server_config.get("host", "0.0.0.0"))
    server_config["port"] = int(os.getenv("PORT", server_config.get("port", 8000)))
    server_config["log_level"] = os.getenv(
        "LOG_LEVEL", server_config.get("log_level", "INFO")
    )

    api_config["prefix"] = os.getenv("API_PREFIX", api_config.get("prefix", "/api/v1"))
    api_config["docs_enabled"] = _env_bool(
        "API_DOCS_ENABLED", api_config.get("docs_enabled", True)
    )

    cors_config["allowed_origins"] = _env_list(
        "CORS_ORIGINS", cors_config.get("allowed_origins", [])
    )
    cors_config["allow_credentials"] = _env_bool(
        "CORS_ALLOW_CREDENTIALS", cors_config.get("allow_credentials", False)
    )

    chatbot_defaults["safe_mode"] = _env_bool(
        "CHATBOT_SAFE_MODE", chatbot_defaults.get("safe_mode", True)
    )
    chatbot_defaults["tone"] = os.getenv(
        "CHATBOT_TONE", chatbot_defaults.get("tone", "professional")
    )
    chatbot_defaults["max_history"] = int(
        os.getenv("CHATBOT_MAX_HISTORY", chatbot_defaults.get("max_history", 12))
    )
    chatbot_defaults["max_output_tokens"] = int(
        os.getenv(
            "CHATBOT_MAX_OUTPUT_TOKENS",
            chatbot_defaults.get("max_output_tokens", 512),
        )
    )

    return Settings.model_validate(data)


settings = get_settings()
