import os
from datetime import datetime, timezone
from threading import Lock
from time import monotonic, perf_counter
from typing import Any

import httpx

from app.model_registry import ModelDefinition, ModelKind, model_for_key


OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
API_KEY_ENV = "OPEN_AI_IMPORT"
_CATALOG_TTL_SECONDS = 900.0
_CATALOG_LOCK = Lock()
_CATALOG_FETCHED_AT = 0.0
_CATALOG_BY_ID: dict[str, dict[str, Any]] = {}


class OpenRouterError(RuntimeError):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def openrouter_configured() -> bool:
    return bool(os.getenv(API_KEY_ENV))


def _api_key() -> str:
    value = os.getenv(API_KEY_ENV)
    if not value:
        raise OpenRouterError(503, "OpenRouter is not configured")
    return value


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
        "X-Title": "Agentic Arena",
    }


def _require_kind(model_key: str, allowed: set[ModelKind]) -> ModelDefinition:
    try:
        model = model_for_key(model_key)
    except KeyError as exc:
        raise OpenRouterError(404, "model is not allowlisted") from exc
    if model.kind not in allowed:
        allowed_names = ", ".join(sorted(kind.value for kind in allowed))
        raise OpenRouterError(400, f"model kind must be one of: {allowed_names}")
    return model


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _post_json(
    path: str,
    payload: dict[str, Any],
    timeout_seconds: int = 60,
) -> tuple[dict[str, Any], dict[str, Any]]:
    started_at = _now_iso()
    started = perf_counter()
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            response = client.post(
                f"{OPENROUTER_BASE_URL}{path}",
                headers=_headers(),
                json=payload,
            )
    except httpx.RequestError as exc:
        raise OpenRouterError(503, "OpenRouter is unreachable") from exc

    finished_at = _now_iso()
    latency_ms = (perf_counter() - started) * 1000

    if response.status_code >= 400:
        raise OpenRouterError(
            response.status_code,
            f"OpenRouter request failed with status {response.status_code}",
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise OpenRouterError(502, "OpenRouter returned an invalid JSON response") from exc

    transport = {
        "started_at": started_at,
        "finished_at": finished_at,
        "latency_ms": round(latency_ms, 3),
        "http_status": response.status_code,
        "generation_id": data.get("id") if isinstance(data, dict) else None,
    }
    return data, transport


def _catalog_snapshot(model: ModelDefinition) -> dict[str, Any]:
    global _CATALOG_FETCHED_AT, _CATALOG_BY_ID

    now = monotonic()
    with _CATALOG_LOCK:
        stale = not _CATALOG_BY_ID or now - _CATALOG_FETCHED_AT >= _CATALOG_TTL_SECONDS
        if stale:
            try:
                with httpx.Client(timeout=10) as client:
                    response = client.get(
                        f"{OPENROUTER_BASE_URL}/models",
                        headers=_headers(),
                    )
                if response.status_code < 400:
                    payload = response.json()
                    items = payload.get("data", []) if isinstance(payload, dict) else []
                    if isinstance(items, list):
                        _CATALOG_BY_ID = {
                            str(item.get("id")): item
                            for item in items
                            if isinstance(item, dict) and item.get("id")
                        }
                        _CATALOG_FETCHED_AT = now
            except (httpx.RequestError, ValueError):
                pass

        item = _CATALOG_BY_ID.get(model.model_id, {})

    if not isinstance(item, dict) or not item:
        return {
            "source": "registry_fallback",
            "model_id": model.model_id,
            "vendor": model.vendor,
            "kind": model.kind.value,
            "free": model.free,
            "tool_capable": model.tool_capable,
        }

    return {
        "source": "openrouter_catalog",
        "model_id": model.model_id,
        "context_length": item.get("context_length"),
        "pricing": item.get("pricing") if isinstance(item.get("pricing"), dict) else {},
        "architecture": item.get("architecture") if isinstance(item.get("architecture"), dict) else {},
        "supported_parameters": (
            item.get("supported_parameters")
            if isinstance(item.get("supported_parameters"), list)
            else []
        ),
        "top_provider": item.get("top_provider") if isinstance(item.get("top_provider"), dict) else {},
        "vendor": model.vendor,
        "kind": model.kind.value,
        "free": model.free,
        "tool_capable": model.tool_capable,
    }


def chat_completion(
    model_key: str,
    messages: list[dict[str, str]],
    max_tokens: int = 2048,
) -> dict[str, Any]:
    model = _require_kind(model_key, {ModelKind.AGENT, ModelKind.SAFETY})
    capabilities = _catalog_snapshot(model)
    result, transport = _post_json(
        "/chat/completions",
        {
            "model": model.model_id,
            "messages": messages,
            "max_tokens": max_tokens,
            "usage": {"include": True},
        },
    )
    return {
        "model_key": model.key,
        "model_id": model.model_id,
        "result": result,
        "transport": transport,
        "model_capabilities": capabilities,
    }


def create_embeddings(
    model_key: str,
    inputs: str | list[str],
) -> dict[str, Any]:
    model = _require_kind(model_key, {ModelKind.EMBEDDING})
    capabilities = _catalog_snapshot(model)
    result, transport = _post_json(
        "/embeddings",
        {
            "model": model.model_id,
            "input": inputs,
        },
    )
    return {
        "model_key": model.key,
        "model_id": model.model_id,
        "result": result,
        "transport": transport,
        "model_capabilities": capabilities,
    }


def rerank_documents(
    model_key: str,
    query: str,
    documents: list[str],
    top_n: int | None = None,
) -> dict[str, Any]:
    model = _require_kind(model_key, {ModelKind.RERANK})
    payload: dict[str, Any] = {
        "model": model.model_id,
        "query": query,
        "documents": documents,
    }
    if top_n is not None:
        payload["top_n"] = top_n
    capabilities = _catalog_snapshot(model)
    result, transport = _post_json("/rerank", payload)
    return {
        "model_key": model.key,
        "model_id": model.model_id,
        "result": result,
        "transport": transport,
        "model_capabilities": capabilities,
    }


def synthesize_speech(
    model_key: str,
    text: str,
    voice: str,
    response_format: str = "mp3",
) -> tuple[bytes, str, str | None]:
    model = _require_kind(model_key, {ModelKind.SPEECH})
    try:
        with httpx.Client(timeout=60) as client:
            response = client.post(
                f"{OPENROUTER_BASE_URL}/audio/speech",
                headers=_headers(),
                json={
                    "model": model.model_id,
                    "input": text,
                    "voice": voice,
                    "response_format": response_format,
                },
            )
    except httpx.RequestError as exc:
        raise OpenRouterError(503, "OpenRouter is unreachable") from exc

    if response.status_code >= 400:
        raise OpenRouterError(
            response.status_code,
            f"OpenRouter request failed with status {response.status_code}",
        )

    content_type = response.headers.get("content-type", "application/octet-stream").split(";")[0]
    generation_id = response.headers.get("x-generation-id")
    return response.content, content_type, generation_id
