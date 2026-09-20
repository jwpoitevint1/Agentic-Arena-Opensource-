from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.cv11 import (
    CV11Decision,
    CV11PolicyDenied,
    CV11PolicyUnavailable,
    enforce_cv11,
)
from app.datasets import dataset_for_system
from app.execution import ExecutionContext
from app.model_registry import ModelKind, model_for_key, models
from app.openrouter import (
    OpenRouterError,
    chat_completion,
    create_embeddings,
    openrouter_configured,
    rerank_documents,
    synthesize_speech,
)
from app.telemetry import build_test_record, emit_test_record


router = APIRouter(prefix="/models", tags=["models"])


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChatMessage(StrictRequest):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1, max_length=100_000)


class ChatRequest(StrictRequest):
    execution: ExecutionContext
    model_key: str = Field(min_length=1, max_length=128)
    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    max_tokens: int = Field(default=2048, ge=1, le=8192)

    @model_validator(mode="after")
    def validate_total_prompt_size(self) -> "ChatRequest":
        if sum(len(message.content) for message in self.messages) > 250_000:
            raise ValueError("combined message content exceeds 250000 characters")
        return self


class EmbeddingRequest(StrictRequest):
    execution: ExecutionContext
    model_key: str = Field(min_length=1, max_length=128)
    input: str | list[str]


class RerankRequest(StrictRequest):
    execution: ExecutionContext
    model_key: str = Field(min_length=1, max_length=128)
    query: str = Field(min_length=1, max_length=100_000)
    documents: list[str] = Field(min_length=1, max_length=1000)
    top_n: int | None = Field(default=None, ge=1, le=1000)


class SpeechRequest(StrictRequest):
    execution: ExecutionContext
    model_key: str = Field(min_length=1, max_length=128)
    input: str = Field(min_length=1, max_length=20_000)
    voice: str = Field(min_length=1, max_length=128)
    response_format: Literal["mp3", "wav", "flac", "opus", "pcm"] = "mp3"


def _raise_openrouter_http(exc: OpenRouterError) -> None:
    raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc


def _enforce_policy(
    *,
    execution: ExecutionContext,
    action: str,
    model_key: str,
    content: str = "",
    message_roles: list[str] | None = None,
    max_tokens: int | None = None,
) -> CV11Decision:
    try:
        return enforce_cv11(
            context=execution,
            action=action,
            model_key=model_key,
            content=content,
            message_roles=message_roles,
            max_tokens=max_tokens,
        )
    except CV11PolicyDenied as exc:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "cv11_policy_denied",
                "message": "CV1.1 denied the governed request.",
                "reasons": list(exc.reasons),
            },
        ) from exc
    except CV11PolicyUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "cv11_policy_unavailable",
                "message": "Governed request was denied because CV1.1 could not produce a valid policy decision.",
            },
        ) from exc


def _attach_decision(result: dict[str, object], decision: CV11Decision) -> dict[str, object]:
    result["cv11"] = decision.to_dict()
    return result


def _dataset_metadata(execution: ExecutionContext) -> tuple[str | None, str | None]:
    if execution.system_id is None:
        return None, None
    try:
        dataset = dataset_for_system(execution.system_id)
    except KeyError:
        return None, None
    return dataset.domain, dataset.kaggle_slug


@router.get("")
def list_models() -> dict[str, object]:
    items = models()
    return {
        "count": len(items),
        "openrouter_configured": openrouter_configured(),
        "models": [item.to_dict() for item in items],
    }


@router.get("/{model_key}")
def get_model(model_key: str) -> dict[str, object]:
    try:
        return model_for_key(model_key).to_dict()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="model is not allowlisted") from exc


@router.post("/chat/completions")
def create_chat_completion(request: ChatRequest) -> dict[str, object]:
    try:
        model = model_for_key(request.model_key)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="model is not allowlisted") from exc

    if model.kind not in {ModelKind.AGENT, ModelKind.SAFETY}:
        raise HTTPException(status_code=400, detail="model kind is not valid for chat completions")

    action = "model.safety" if model.kind is ModelKind.SAFETY else "model.chat"
    messages = [message.model_dump() for message in request.messages]
    decision = _enforce_policy(
        execution=request.execution,
        action=action,
        model_key=request.model_key,
        content="\n".join(message.content for message in request.messages),
        message_roles=[message.role for message in request.messages],
        max_tokens=request.max_tokens,
    )

    try:
        result = chat_completion(
            model_key=request.model_key,
            messages=messages,
            max_tokens=request.max_tokens,
        )
    except OpenRouterError as exc:
        _raise_openrouter_http(exc)

    domain, dataset = _dataset_metadata(request.execution)
    test_metrics = build_test_record(
        result=result,
        model=model,
        governance=request.execution.governance.value,
        operation=action,
        system_id=request.execution.system_id,
        domain=domain,
        dataset=dataset,
        policy=decision.to_dict(),
        loop_cycles=1,
        tool_calls=0,
        retries=0,
    )
    result["test_metrics"] = test_metrics
    emit_test_record(test_metrics)
    return _attach_decision(result, decision)


@router.post("/embeddings")
def create_embedding(request: EmbeddingRequest) -> dict[str, object]:
    if isinstance(request.input, list):
        if not request.input or len(request.input) > 1000:
            raise HTTPException(status_code=422, detail="input list must contain 1 to 1000 items")
        if any(not item or len(item) > 100_000 for item in request.input):
            raise HTTPException(status_code=422, detail="each input item must contain 1 to 100000 characters")
    elif not request.input or len(request.input) > 100_000:
        raise HTTPException(status_code=422, detail="input must contain 1 to 100000 characters")

    decision = _enforce_policy(
        execution=request.execution,
        action="model.embed",
        model_key=request.model_key,
    )

    try:
        result = create_embeddings(model_key=request.model_key, inputs=request.input)
        return _attach_decision(result, decision)
    except OpenRouterError as exc:
        _raise_openrouter_http(exc)


@router.post("/rerank")
def rerank(request: RerankRequest) -> dict[str, object]:
    if any(not document or len(document) > 100_000 for document in request.documents):
        raise HTTPException(status_code=422, detail="each document must contain 1 to 100000 characters")
    if request.top_n is not None and request.top_n > len(request.documents):
        raise HTTPException(status_code=422, detail="top_n cannot exceed document count")

    decision = _enforce_policy(
        execution=request.execution,
        action="model.rerank",
        model_key=request.model_key,
    )

    try:
        result = rerank_documents(
            model_key=request.model_key,
            query=request.query,
            documents=request.documents,
            top_n=request.top_n,
        )
        return _attach_decision(result, decision)
    except OpenRouterError as exc:
        _raise_openrouter_http(exc)


@router.post("/speech")
def speech(request: SpeechRequest) -> Response:
    decision = _enforce_policy(
        execution=request.execution,
        action="model.speech",
        model_key=request.model_key,
    )

    try:
        audio, content_type, generation_id = synthesize_speech(
            model_key=request.model_key,
            text=request.input,
            voice=request.voice,
            response_format=request.response_format,
        )
    except OpenRouterError as exc:
        _raise_openrouter_http(exc)

    headers: dict[str, str] = {
        "x-cv11-mode": "enforced" if decision.enforced else "bypassed",
        "x-cv11-policy-version": decision.policy_version,
    }
    if generation_id:
        headers["x-generation-id"] = generation_id
    return Response(content=audio, media_type=content_type, headers=headers)
