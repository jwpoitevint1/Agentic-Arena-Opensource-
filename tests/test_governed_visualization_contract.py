import json

from app.governed_routes import (
    _model_message_content,
    _parse_json_object,
    _visualization_candidates_from_statistics,
)


def test_visualization_candidates_preserve_mcp_field_provenance() -> None:
    statistics = {
        "sample_row_count": 100,
        "columns": {
            "segment": {"value_counts": {"Consumer": 60, "Corporate": 40}},
            "sales": {"numeric": {"min": 10, "avg": 55, "max": 100}},
        },
    }

    candidates = _visualization_candidates_from_statistics(statistics)

    assert len(candidates) == 2
    assert candidates[0]["source_field"] == "segment"
    assert candidates[0]["statistic"] == "value_counts"
    assert candidates[0]["data"] == [
        {"label": "Consumer", "value": 60.0},
        {"label": "Corporate", "value": 40.0},
    ]
    assert candidates[1]["source_field"] == "sales"
    assert candidates[1]["statistic"] == "min_avg_max"
    assert candidates[1]["data"] == [
        {"label": "MIN", "value": 10.0},
        {"label": "AVG", "value": 55.0},
        {"label": "MAX", "value": 100.0},
    ]


def test_model_message_content_reads_chat_completion_wrapper() -> None:
    wrapped = {
        "result": {
            "choices": [
                {"message": {"role": "assistant", "content": "modeled output"}}
            ]
        }
    }

    assert _model_message_content(wrapped) == "modeled output"


def test_parse_json_object_accepts_plain_and_fenced_json() -> None:
    expected = {"valid": True, "candidate_index": 0}
    assert _parse_json_object(json.dumps(expected)) == expected
    assert _parse_json_object('''```json
{"valid": true, "candidate_index": 0}
```''') == expected


def test_no_visualization_candidate_is_invented_without_statistics() -> None:
    assert _visualization_candidates_from_statistics(None) == []
    assert _visualization_candidates_from_statistics({"columns": {}}) == []
