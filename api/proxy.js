const crypto = require("node:crypto");

const DEFAULT_BACKEND = "https://api.example.com";
const ALLOWED_PREFIXES = [
  "/health",
  "/ready",
  "/api/v1/models",
  "/api/v1/governed",
  "/api/v1/ungoverned",
  "/api/v1/chatbot",
  "/api/v1/mcp/governed",
  "/api/v1/analytics",
  "/api/v1/system",
];
const ALLOWED_METHODS = new Set(["GET", "POST", "HEAD", "OPTIONS"]);
const MAX_REQUEST_BYTES = Math.min(
  Math.max(Number.parseInt(process.env.MAX_REQUEST_BYTES || "1048576", 10) || 1048576, 16384),
  16777216
);
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 120000;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HEADER_NAME_PATTERN = /^[A-Za-z0-9-]+$/;

function normalizePath(value) {
  if (Array.isArray(value)) value = value[0];
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function allowed(path) {
  return ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function safeRequestId(value) {
  if (Array.isArray(value)) value = value[0];
  if (typeof value === "string") {
    const candidate = value.trim();
    if (REQUEST_ID_PATTERN.test(candidate)) return candidate;
  }
  return crypto.randomUUID();
}

function safeError(error) {
  return {
    name: error && typeof error.name === "string" ? error.name : "Error",
    message: error && typeof error.message === "string"
      ? error.message.slice(0, 300)
      : "unknown proxy error",
  };
}

function backendTarget(path) {
  const backend = process.env.BACKEND_URL || DEFAULT_BACKEND;
  const base = new URL(backend);
  if (base.protocol !== "https:") {
    throw new Error("backend URL must use HTTPS");
  }
  const target = new URL(path, `${base.origin}/`);
  if (target.origin !== base.origin) {
    throw new Error("backend target origin changed");
  }
  return target.toString();
}

module.exports = async function handler(req, res) {
  const requestId = safeRequestId(req?.headers?.["x-request-id"]);
  let timeout = null;

  try {
    const method = (req?.method || "GET").toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
      return res.status(405).json({ detail: "method not allowed", request_id: requestId });
    }

    const path = normalizePath(req?.query?.path);
    if (!path || !allowed(path) || path.includes("..") || path.includes("\\") || path.includes("\0")) {
      return res.status(403).json({ detail: "proxy path is not allowed", request_id: requestId });
    }

    const target = backendTarget(path);
    const headers = {
      accept: "application/json",
      "x-request-id": requestId,
    };

    const authHeader = process.env.BACKEND_AUTH_HEADER;
    const authValue = process.env.BACKEND_AUTH_VALUE;
    if (authHeader && authValue) {
      if (!HEADER_NAME_PATTERN.test(authHeader)) {
        throw new Error("backend auth header name is invalid");
      }
      headers[authHeader] = authValue;
    }

    let body;
    if (!["GET", "HEAD"].includes(method) && req?.body !== undefined) {
      const incomingContentType = req?.headers?.["content-type"] || "";
      if (incomingContentType && !String(incomingContentType).toLowerCase().startsWith("application/json")) {
        return res.status(415).json({ detail: "content type is not allowed", request_id: requestId });
      }

      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BYTES) {
        return res.status(413).json({ detail: "request body too large", request_id: requestId });
      }
      headers["content-type"] = "application/json";
    }

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    const response = await fetch(target, {
      method,
      headers,
      body,
      redirect: "error",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    timeout = null;

    const contentType = response.headers.get("content-type") || "";
    const retryAfter = response.headers.get("retry-after");
    const upstreamRequestId = response.headers.get("x-request-id");
    const contentLength = Number.parseInt(response.headers.get("content-length") || "0", 10);

    if (contentLength > MAX_RESPONSE_BYTES) {
      return res.status(502).json({ detail: "backend response too large", request_id: requestId });
    }

    if (retryAfter) res.setHeader("retry-after", retryAfter);
    res.setHeader("x-request-id", safeRequestId(upstreamRequestId || requestId));
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");

    const payloadText = await response.text();
    if (Buffer.byteLength(payloadText, "utf8") > MAX_RESPONSE_BYTES) {
      return res.status(502).json({ detail: "backend response too large", request_id: requestId });
    }

    if (contentType.includes("application/json")) {
      try {
        return res.status(response.status).json(JSON.parse(payloadText));
      } catch {
        return res.status(502).json({ detail: "backend returned invalid JSON", request_id: requestId });
      }
    }

    return res.status(response.status).send(payloadText);
  } catch (error) {
    if (timeout) clearTimeout(timeout);
    console.error("agentic_arena_proxy_invocation_failed", {
      request_id: requestId,
      ...safeError(error),
    });

    if (!res.headersSent) {
      res.setHeader("cache-control", "no-store");
      res.setHeader("x-request-id", requestId);
      res.setHeader("x-content-type-options", "nosniff");
      const status = error?.name === "AbortError" ? 504 : 502;
      return res.status(status).json({
        detail: status === 504 ? "backend request timed out" : "backend proxy invocation failed",
        request_id: requestId,
      });
    }

    try { res.end(); } catch { /* response already failed */ }
    return undefined;
  }
};
