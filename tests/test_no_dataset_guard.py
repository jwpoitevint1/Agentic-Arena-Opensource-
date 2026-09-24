from app.governed_routes import GovernedExecuteRequest, execute_governed_function
from app.ungoverned_routes import UngovernedExecuteRequest, execute_ungoverned_function


class Decision:
    allow = True

    def to_dict(self):
        return {"allow": True, "policy_version": "CV1.1", "reasons": []}


def _assistant_content(result: dict[str, object]) -> str:
    return result["result"]["choices"][0]["message"]["content"]


def _model_result(content: str = "grounded") -> dict[str, object]:
    return {
        "model_key": "ling_3_0_flash_vl_free",
        "model_id": "test-model",
        "result": {
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        },
        "transport": {"latency_ms": 1.0},
        "model_capabilities": {},
    }


def _allow_governed(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.governed_routes._enforce_function_policy",
        lambda **kwargs: Decision(),
    )
    monkeypatch.setattr(
        "app.governed_routes._enforce_dataset_policy",
        lambda **kwargs: Decision(),
    )


def test_governed_execute_without_manual_context_uses_authorized_neon(monkeypatch) -> None:
    _allow_governed(monkeypatch)
    neon_context = (
        '{"source":"neon","schema":"source","table":"source_data","row_count":2000,'
        '"columns":[{"column_name":"Shipment_ID","data_type":"text","is_nullable":"NO"}]}'
    )
    monkeypatch.setattr(
        "app.governed_routes.neon_dataset_context",
        lambda target: (neon_context, {"row_count": 2000}),
    )
    monkeypatch.setattr("app.governed_routes.record_agentic_run", lambda **kwargs: True)
    monkeypatch.setattr(
        "app.governed_routes.query_table",
        lambda target, **kwargs: [{"Shipment_ID": "S-001", "Status": "Delivered"}],
    )
    captured: dict[str, object] = {}

    def fake_chat_completion(*, model_key, messages, max_tokens):
        captured["messages"] = messages
        return _model_result()

    monkeypatch.setattr("app.governed_routes.chat_completion", fake_chat_completion)

    result = execute_governed_function(
        GovernedExecuteRequest(
            function_key="analyst",
            system_id=6,
            model_key="ling_3_0_flash_vl_free",
            task="Analyze the freight dataset.",
            source_context=None,
        )
    )

    serialized_messages = "\n".join(item["content"] for item in captured["messages"])
    assert "Shipment_ID" in serialized_messages
    assert "S-001" in serialized_messages
    assert "AUTHORIZED RELATIONAL DATA" in serialized_messages
    assert result["governed_function"]["dataset_provided"] is True
    assert result["governed_function"]["dataset_source"] == "neon_relational"
    assert result["governed_function"]["relational_action"] == "mcp.dataset.query"
    assert result["dataset_cv11"]["allow"] is True
    assert result["test_metrics"]["behavior"]["model_calls"] == 1
    assert result["test_metrics"]["behavior"]["tool_calls"] == 2

def test_ungoverned_execute_without_any_dataset_is_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.ungoverned_routes.neon_dataset_context",
        lambda target: (None, {"row_count": 0}),
    )
    monkeypatch.setattr(
        "app.ungoverned_routes.chat_completion",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("model must not run when the paired Neon dataset is empty")
        ),
    )
    monkeypatch.setattr("app.ungoverned_routes.record_agentic_run", lambda **kwargs: True)

    result = execute_ungoverned_function(
        UngovernedExecuteRequest(
            function_key="analyst",
            system_id=6,
            model_key="ling_3_0_flash_vl_free",
            task="Analyze the freight dataset.",
            source_context=None,
        )
    )

    assert _assistant_content(result) == "Dataset is empty."
    assert result["ungoverned_function"]["dataset_provided"] is False
    assert result["ungoverned_function"]["dataset_source"] is None
    assert result["execution_state"]["status"] == "unavailable"
    assert result["execution_state"]["code"] == "DATASET_EMPTY"
    assert result["test_metrics"]["behavior"]["model_calls"] == 0


def test_governed_empty_neon_without_manual_context_fails_closed(monkeypatch) -> None:
    _allow_governed(monkeypatch)
    monkeypatch.setattr(
        "app.governed_routes.neon_dataset_context",
        lambda target: (None, {"row_count": 0}),
    )
    monkeypatch.setattr(
        "app.governed_routes.chat_completion",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("model must not run when both Neon and source context are absent")
        ),
    )
    monkeypatch.setattr("app.governed_routes.record_agentic_run", lambda **kwargs: True)

    result = execute_governed_function(
        GovernedExecuteRequest(
            function_key="analyst",
            system_id=5,
            model_key="ling_3_0_flash_vl_free",
            task="Analyze passenger trends by country and year.",
            source_context=None,
        )
    )

    assert _assistant_content(result) == "Authorized dataset is empty."
    assert result["governed_function"]["dataset_provided"] is False
    assert result["governed_function"]["dataset_context_hash"] is None
    assert result["execution_state"]["status"] == "unavailable"
    assert result["execution_state"]["code"] == "DATASET_EMPTY"

def test_governed_with_actual_source_context_can_use_neon_schema(monkeypatch) -> None:
    _allow_governed(monkeypatch)
    neon_context = (
        '{"source":"neon","schema":"source","table":"source_data","row_count":2,'
        '"columns":[{"column_name":"Country Name","data_type":"text","is_nullable":"YES"},'
        '{"column_name":"2019","data_type":"text","is_nullable":"YES"}]}'
    )
    monkeypatch.setattr(
        "app.governed_routes.neon_dataset_context",
        lambda target: (neon_context, {"row_count": 2}),
    )
    monkeypatch.setattr("app.governed_routes.record_agentic_run", lambda **kwargs: True)
    monkeypatch.setattr("app.governed_routes.query_table", lambda *args, **kwargs: [])
    monkeypatch.setattr("app.governed_routes.rag_retrieve", lambda *args, **kwargs: [])
    captured: dict[str, object] = {}

    def fake_chat_completion(*, model_key, messages, max_tokens):
        captured["messages"] = messages
        return _model_result()

    monkeypatch.setattr("app.governed_routes.chat_completion", fake_chat_completion)

    result = execute_governed_function(
        GovernedExecuteRequest(
            function_key="analyst",
            system_id=5,
            model_key="ling_3_0_flash_vl_free",
            task="Analyze passenger trends by country and year.",
            source_context="Country Name,2019\nExampleland,12345",
        )
    )

    serialized_messages = "\n".join(item["content"] for item in captured["messages"])
    assert "Country Name" in serialized_messages
    assert "Exampleland,12345" in serialized_messages
    assert "schema alone is not evidence" in serialized_messages
    assert result["governed_function"]["dataset_provided"] is True
    assert result["governed_function"]["dataset_source"] == "neon+source_context"


def test_ungoverned_execute_uses_matched_neon_rows_without_manual_context(monkeypatch) -> None:
    neon_context = (
        '{"source":"neon","schema":"source","table":"source_data","row_count":2000,'
        '"columns":[{"column_name":"Shipment_ID","data_type":"text","is_nullable":"YES"}]}'
    )
    monkeypatch.setattr(
        "app.ungoverned_routes.neon_dataset_context",
        lambda target: (neon_context, {"row_count": 2000}),
    )
    monkeypatch.setattr(
        "app.ungoverned_routes.query_table",
        lambda target, **kwargs: [{"Shipment_ID": "S-001", "Status": "Delivered"}],
    )
    monkeypatch.setattr("app.ungoverned_routes.record_agentic_run", lambda **kwargs: True)
    captured: dict[str, object] = {}

    def fake_chat_completion(*, model_key, messages, max_tokens):
        captured["messages"] = messages
        return _model_result()

    monkeypatch.setattr("app.ungoverned_routes.chat_completion", fake_chat_completion)

    result = execute_ungoverned_function(
        UngovernedExecuteRequest(
            function_key="analyst",
            system_id=6,
            model_key="ling_3_0_flash_vl_free",
            task="Analyze the freight dataset.",
            source_context=None,
        )
    )

    serialized_messages = "\n".join(item["content"] for item in captured["messages"])
    assert "Shipment_ID" in serialized_messages
    assert "S-001" in serialized_messages
    assert "DATA ROWS:" in serialized_messages
    assert result["ungoverned_function"]["dataset_provided"] is True
    assert result["ungoverned_function"]["dataset_source"] == "neon_relational"
    assert result["ungoverned_function"]["relational_action"] == "direct.dataset.query"
    assert result["test_metrics"]["behavior"]["tool_calls"] == 0


def test_governed_dataset_error_is_unavailable(monkeypatch) -> None:
    from app.agentic_dataset_context import DatasetContextError

    _allow_governed(monkeypatch)
    monkeypatch.setattr(
        "app.governed_routes.neon_dataset_context",
        lambda target: (_ for _ in ()).throw(
            DatasetContextError("DATABASE_UNAVAILABLE", "Authorized dataset database is unavailable or not configured.")
        ),
    )
    monkeypatch.setattr(
        "app.governed_routes.chat_completion",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("model must not run after dataset infrastructure failure")
        ),
    )
    monkeypatch.setattr("app.governed_routes.record_agentic_run", lambda **kwargs: True)

    result = execute_governed_function(
        GovernedExecuteRequest(
            function_key="analyst",
            system_id=6,
            model_key="ling_3_0_flash_vl_free",
            task="Analyze the freight dataset.",
            source_context=None,
        )
    )

    assert result["execution_state"]["code"] == "DATABASE_UNAVAILABLE"
    assert result["test_metrics"]["behavior"]["model_calls"] == 0


def test_data_modeler_requires_bounded_mcp_evidence_path(monkeypatch) -> None:
    _allow_governed(monkeypatch)
    monkeypatch.setattr("app.governed_routes.record_agentic_run", lambda **kwargs: True)
    monkeypatch.setattr(
        "app.governed_routes.neon_dataset_context",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("data modeler must not use the direct Neon fallback")
        ),
    )
    monkeypatch.setattr(
        "app.governed_routes.query_table",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("data modeler must not bypass governed MCP")
        ),
    )

    calls: list[str] = []

    def fake_mcp(*, entity_key, system_id, model_key, tool_name, arguments):
        calls.append(tool_name)
        payloads = {
            "dataset.schema": {"columns": [{"column_name": "Shipment_ID", "data_type": "text"}]},
            "dataset.profile": {"row_count": 10, "table": "source_data"},
            "dataset.query": {"rows": [{"Shipment_ID": "S-002"}]},
            "dataset.statistics": {
                "sample_row_count": 1,
                "columns": {"Shipment_ID": {"non_null_count": 1, "null_count": 0, "distinct_count": 1}},
            },
            "rag.retrieve": {"chunks": []},
        }
        return {"structuredContent": payloads[tool_name]}

    monkeypatch.setattr("app.governed_routes.execute_governed_mcp_tool", fake_mcp)
    monkeypatch.setattr("app.governed_routes.chat_completion", lambda **kwargs: _model_result())

    result = execute_governed_function(
        GovernedExecuteRequest(
            function_key="data_modeler",
            system_id=6,
            model_key="ling_3_0_flash_vl_free",
            task="Inspect the freight data model.",
        )
    )
    assert result["governed_function"]["mcp_required"] is True
    assert result["governed_function"]["relational_action"] == "mcp.dataset.query"
    assert result["governed_function"]["mcp_tools_used"] == [
        "dataset.schema",
        "dataset.profile",
        "dataset.query",
        "dataset.statistics",
        "rag.retrieve",
    ]
    assert calls == result["governed_function"]["mcp_tools_used"]
    assert result["test_metrics"]["behavior"]["tool_calls"] == 5

def test_relational_read_failure_is_unavailable(monkeypatch) -> None:
    from app.mcp.data_access import MCPDataUnavailable

    _allow_governed(monkeypatch)
    neon_context = (
        '{"source":"neon","schema":"source","table":"source_data","row_count":10,'
        '"columns":[{"column_name":"Shipment_ID","data_type":"text","is_nullable":"NO"}]}'
    )
    monkeypatch.setattr("app.governed_routes.neon_dataset_context", lambda target: (neon_context, {"row_count": 10}))
    monkeypatch.setattr("app.governed_routes.query_table", lambda *args, **kwargs: (_ for _ in ()).throw(MCPDataUnavailable("read failed")))
    monkeypatch.setattr("app.governed_routes.chat_completion", lambda **kwargs: (_ for _ in ()).throw(AssertionError("model must not run")))
    monkeypatch.setattr("app.governed_routes.record_agentic_run", lambda **kwargs: True)

    result = execute_governed_function(
        GovernedExecuteRequest(
            function_key="analyst",
            system_id=6,
            model_key="ling_3_0_flash_vl_free",
            task="Analyze freight.",
        )
    )
    assert result["execution_state"]["status"] == "unavailable"
    assert result["execution_state"]["code"] == "DATABASE_UNAVAILABLE"
    assert result["test_metrics"]["behavior"]["model_calls"] == 0
