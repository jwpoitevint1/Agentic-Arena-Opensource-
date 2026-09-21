from app.mcp import data_access


def test_table_statistics_computes_exact_counts_and_numeric_summaries(monkeypatch) -> None:
    rows = [
        {"loan_status": "approved", "loan_amount": "$10,000.00", "interest_rate": "10.0%"},
        {"loan_status": "pending", "loan_amount": "$20,000.00", "interest_rate": "12.5%"},
        {"loan_status": "approved", "loan_amount": "($5,000.00)", "interest_rate": "7.5%"},
        {"loan_status": "rejected", "loan_amount": "$15,000.00", "interest_rate": "9.0%"},
    ]

    monkeypatch.setattr(data_access, "query_table", lambda *args, **kwargs: rows)

    result = data_access.table_statistics(
        object(),
        table="source_data",
        limit=100,
        max_categories=20,
    )

    assert result["sample_row_count"] == 4
    assert result["columns"]["loan_status"]["value_counts"] == {
        "approved": 2,
        "pending": 1,
        "rejected": 1,
    }

    loan = result["columns"]["loan_amount"]["numeric"]
    assert loan["count"] == 4
    assert loan["sum"] == 40000.0
    assert loan["avg"] == 10000.0
    assert loan["min"] == -5000.0
    assert loan["max"] == 20000.0

    rate = result["columns"]["interest_rate"]["numeric"]
    assert rate["sum"] == 39.0
    assert rate["avg"] == 9.75


def test_numeric_parser_rejects_free_text() -> None:
    assert data_access._parse_numeric_like("$1,234.50") == 1234.5
    assert data_access._parse_numeric_like("($25,488.15)") == -25488.15
    assert data_access._parse_numeric_like("11.94%") == 11.94
    assert data_access._parse_numeric_like("merchant purchase $12.00") is None
