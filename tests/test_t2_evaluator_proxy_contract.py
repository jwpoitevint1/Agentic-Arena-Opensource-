import re
from pathlib import Path
from urllib.parse import urlsplit


_PROXY_ENTRY_RE = re.compile(
    r'\\{\\s*pattern:\\s*/(?P<pattern>\\^.*?\\$)/,\\s*methods:\\s*new Set\\(\\[(?P<methods>[^\\]]+)\\]\\)\\s*\\}'
)


def _contracts(source: str) -> list[tuple[re.Pattern[str], set[str]]]:
    result = []
    for match in _PROXY_ENTRY_RE.finditer(source):
        pattern = match.group("pattern").replace(r"\\/", "/")
        methods = set(re.findall(r'"([A-Z]+)"', match.group("methods")))
        result.append((re.compile(pattern), methods))
    assert result
    return result


def _allows(contracts: list[tuple[re.Pattern[str], set[str]]], path: str, method: str) -> bool:
    pathname = urlsplit(path).path
    effective_method = "GET" if method == "HEAD" else method
    return any(
        pattern.fullmatch(pathname)
        and (method == "OPTIONS" or effective_method in methods)
        for pattern, methods in contracts
    )


def test_t2_proxy_copies_are_identical() -> None:
    root = Path("api/proxy.js").read_text(encoding="utf-8")
    ui = Path("ui/api/proxy.js").read_text(encoding="utf-8")
    assert root == ui


def test_evaluator_proxy_routes_are_method_bound_and_use_t2_backend() -> None:
    source = Path("api/proxy.js").read_text(encoding="utf-8")
    contracts = _contracts(source)

    assert _allows(contracts, "/api/v1/evaluator/contract", "GET")
    assert not _allows(contracts, "/api/v1/evaluator/contract", "POST")
    assert _allows(contracts, "/api/v1/evaluator/evaluate", "POST")
    assert not _allows(contracts, "/api/v1/evaluator/evaluate", "GET")
    assert "evaluator(?:\\/|$)" in source
    assert "T2_BACKEND_URL" in source


def test_session_evaluation_proxy_route_remains_available() -> None:
    contracts = _contracts(Path("api/proxy.js").read_text(encoding="utf-8"))
    path = "/api/v1/sessions/00000000-0000-0000-0000-000000000000/evaluation"

    assert _allows(contracts, path, "POST")
    assert not _allows(contracts, path, "GET")
