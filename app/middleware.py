import hmac
import ipaddress
import json
import logging
import os
import re
from dataclasses import dataclass
from threading import Lock
from time import monotonic, perf_counter
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings


logger = logging.getLogger("agentic_arena.requests")

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
_API_KEY_HEADER = "x-arena-api-key"
_ALLOWED_METHODS = {"GET", "POST", "HEAD", "OPTIONS"}


@dataclass
class _Bucket:
    tokens: float
    updated_at: float


_BUCKETS: dict[str, _Bucket] = {}
_BUCKET_LOCK = Lock()


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        logger.warning("invalid_integer_environment_variable name=%s", name)
        return default
    return max(minimum, min(value, maximum))


def _request_id(request: Request) -> str:
    candidate = request.headers.get("x-request-id", "").strip()
    if candidate and _REQUEST_ID_PATTERN.fullmatch(candidate):
        return candidate
    return uuid4().hex


def _client_ip(request: Request) -> str:
    controls = settings.chatbot.ip_controls
    if controls.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            valid: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
            for item in forwarded.split(","):
                candidate = item.strip()
                if not candidate:
                    continue
                try:
                    valid.append(ipaddress.ip_address(candidate))
                except ValueError:
                    logger.warning("invalid_x_forwarded_for value=%r", candidate)
            if valid:
                for address in reversed(valid):
                    if address.is_global:
                        return str(address)
                return str(valid[-1])

    host = request.client.host if request.client else "0.0.0.0"
    try:
        return str(ipaddress.ip_address(host))
    except ValueError:
        return host


def _in_cidrs(ip_text: str, cidrs: list[str]) -> bool:
    try:
        address = ipaddress.ip_address(ip_text)
    except ValueError:
        return False
    for cidr in cidrs:
        try:
            if address in ipaddress.ip_network(cidr, strict=False):
                return True
        except ValueError:
            logger.warning("invalid_ip_control_cidr cidr=%r", cidr)
    return False


def _ip_allowed(ip_text: str) -> bool:
    controls = settings.chatbot.ip_controls
    if _in_cidrs(ip_text, controls.denylist):
        return False
    if controls.allowlist and not _in_cidrs(ip_text, controls.allowlist):
        return False
    return True


def _consume_bucket(key: str, *, capacity: float, refill_rate: float) -> tuple[bool, float]:
    now = monotonic()
    with _BUCKET_LOCK:
        bucket = _BUCKETS.get(key)
        if bucket is None:
            bucket = _Bucket(tokens=capacity, updated_at=now)
            _BUCKETS[key] = bucket
        elapsed = max(0.0, now - bucket.updated_at)
        bucket.tokens = min(capacity, bucket.tokens + elapsed * refill_rate)
        bucket.updated_at = now
        if bucket.tokens < 1.0:
            wait_seconds = (1.0 - bucket.tokens) / refill_rate
            return False, max(wait_seconds, 0.0)
        bucket.tokens -= 1.0
        return True, 0.0


def _consume_chatbot_rate_token(ip_text: str) -> tuple[bool, float]:
    cfg = settings.chatbot.rate_limit
    maximum = cfg.capacity * cfg.burst_multiplier
    refill_rate = cfg.refill_tokens / cfg.refill_interval_sec
    return _consume_bucket(
        f"chatbot:{ip_text}",
        capacity=maximum,
        refill_rate=refill_rate,
    )


def _consume_global_rate_token(ip_text: str) -> tuple[bool, float]:
    per_minute = _env_int(
        "RATE_LIMIT_PER_MINUTE",
        120,
        minimum=1,
        maximum=10000,
    )
    return _consume_bucket(
        f"global:{ip_text}",
        capacity=float(per_minute),
        refill_rate=float(per_minute) / 60.0,
    )


def _allowed_hosts() -> list[str]:
    return [
        item.strip().lower()
        for item in os.getenv("ALLOWED_HOSTS", "").split(",")
        if item.strip()
    ]


def _host_allowed(host: str) -> bool:
    allowed = _allowed_hosts()
    if not allowed:
        return True

    normalized = host.lower().rstrip(".")
    for item in allowed:
        candidate = item.rstrip(".")
        if candidate == normalized:
            return True
        if candidate.startswith("*.") and normalized.endswith(candidate[1:]):
            return True
    return False


def _api_key_authorized(request: Request) -> bool:
    if not _env_bool("API_AUTH_REQUIRED", False):
        return True
    if request.method.upper() == "OPTIONS":
        return True

    expected = os.getenv("ARENA_API_KEY", "")
    if not expected:
        return False
    presented = request.headers.get(_API_KEY_HEADER, "")
    return bool(presented) and hmac.compare_digest(presented, expected)


def _secure_headers(request_id: str, *, secure_transport: bool) -> dict[str, str]:
    headers = {
        "x-request-id": request_id,
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "no-referrer",
        "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-resource-policy": "same-origin",
    }
    if secure_transport:
        headers["strict-transport-security"] = "max-age=31536000"
    return headers


def _json_error(
    request: Request,
    *,
    status_code: int,
    detail: str,
    request_id: str,
    retry_after: int | None = None,
) -> JSONResponse:
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip().lower()
    secure_transport = request.url.scheme == "https" or forwarded_proto == "https"
    headers = _secure_headers(request_id, secure_transport=secure_transport)
    headers["cache-control"] = "no-store"
    if retry_after is not None:
        headers["retry-after"] = str(max(1, retry_after))
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail},
        headers=headers,
    )


class RequestSizeLimitMiddleware:
    def __init__(self, app):
        self.app = app
        self.max_bytes = _env_int(
            "MAX_REQUEST_BYTES",
            1_048_576,
            minimum=16_384,
            maximum=16_777_216,
        )

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        headers = {
            key.lower(): value
            for key, value in scope.get("headers", [])
        }
        content_length = headers.get(b"content-length")
        if content_length:
            try:
                if int(content_length) > self.max_bytes:
                    body = json.dumps({"detail": "request body too large"}).encode("utf-8")
                    await send(
                        {
                            "type": "http.response.start",
                            "status": 413,
                            "headers": [
                                (b"content-type", b"application/json"),
                                (b"cache-control", b"no-store"),
                                (b"x-content-type-options", b"nosniff"),
                            ],
                        }
                    )
                    await send({"type": "http.response.body", "body": body})
                    return
            except ValueError:
                body = json.dumps({"detail": "invalid content-length"}).encode("utf-8")
                await send(
                    {
                        "type": "http.response.start",
                        "status": 400,
                        "headers": [
                            (b"content-type", b"application/json"),
                            (b"cache-control", b"no-store"),
                            (b"x-content-type-options", b"nosniff"),
                        ],
                    }
                )
                await send({"type": "http.response.body", "body": body})
                return

        received = 0
        response_started = False

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message.get("type") == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise ValueError("request_body_too_large")
            return message

        async def tracked_send(message):
            nonlocal response_started
            if message.get("type") == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except ValueError as exc:
            if str(exc) != "request_body_too_large":
                raise
            if response_started:
                return
            body = json.dumps({"detail": "request body too large"}).encode("utf-8")
            await send(
                {
                    "type": "http.response.start",
                    "status": 413,
                    "headers": [
                        (b"content-type", b"application/json"),
                        (b"cache-control", b"no-store"),
                        (b"x-content-type-options", b"nosniff"),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": body})


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = _request_id(request)
        started = perf_counter()
        client_ip = _client_ip(request)
        path = request.url.path
        method = request.method.upper()

        if method not in _ALLOWED_METHODS:
            return _json_error(
                request,
                status_code=405,
                detail="method not allowed",
                request_id=request_id,
            )

        request_host = (request.url.hostname or "").lower().rstrip(".")
        if not _host_allowed(request_host):
            logger.warning(
                "request_blocked reason=host path=%s host=%s request_id=%s",
                path,
                request_host,
                request_id,
            )
            return _json_error(
                request,
                status_code=400,
                detail="invalid host",
                request_id=request_id,
            )

        if path.startswith(settings.api.prefix) and not _api_key_authorized(request):
            logger.warning(
                "request_blocked reason=api_auth path=%s client_ip=%s request_id=%s",
                path,
                client_ip,
                request_id,
            )
            status_code = 503 if not os.getenv("ARENA_API_KEY", "") else 401
            return _json_error(
                request,
                status_code=status_code,
                detail="API authentication required",
                request_id=request_id,
            )

        if (
            method == "POST"
            and path.startswith(f"{settings.api.prefix}/models")
            and not _env_bool("ALLOW_DIRECT_MODEL_ROUTES", False)
        ):
            return _json_error(
                request,
                status_code=404,
                detail="route not available",
                request_id=request_id,
            )


        if path.startswith(settings.api.prefix):
            allowed, retry_after = _consume_global_rate_token(client_ip)
            if not allowed:
                logger.warning(
                    "request_blocked reason=global_rate_limit path=%s client_ip=%s request_id=%s",
                    path,
                    client_ip,
                    request_id,
                )
                return _json_error(
                    request,
                    status_code=429,
                    detail="rate limit exceeded",
                    request_id=request_id,
                    retry_after=max(1, int(retry_after + 0.999)),
                )

        if path.startswith(f"{settings.api.prefix}/chatbot"):
            if not _ip_allowed(client_ip):
                logger.warning(
                    "request_blocked reason=ip_control path=%s client_ip=%s request_id=%s",
                    path,
                    client_ip,
                    request_id,
                )
                return _json_error(
                    request,
                    status_code=403,
                    detail="client IP is not permitted",
                    request_id=request_id,
                )

            allowed, retry_after = _consume_chatbot_rate_token(client_ip)
            if not allowed:
                logger.warning(
                    "request_blocked reason=chatbot_rate_limit path=%s client_ip=%s request_id=%s",
                    path,
                    client_ip,
                    request_id,
                )
                return _json_error(
                    request,
                    status_code=429,
                    detail="rate limit exceeded",
                    request_id=request_id,
                    retry_after=max(1, int(retry_after + 0.999)),
                )

        response = await call_next(request)

        duration_ms = (perf_counter() - started) * 1000
        forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip().lower()
        secure_transport = request.url.scheme == "https" or forwarded_proto == "https"

        for key, value in _secure_headers(
            request_id,
            secure_transport=secure_transport,
        ).items():
            response.headers[key] = value

        if path.startswith(settings.api.prefix):
            response.headers["cache-control"] = "no-store"

        logger.info(
            "request_complete method=%s path=%s status=%s duration_ms=%.2f client_ip=%s request_id=%s",
            method,
            path,
            response.status_code,
            duration_ms,
            client_ip,
            request_id,
        )
        return response
