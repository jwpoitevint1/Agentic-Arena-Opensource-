from app.mcp.patterns import redact_governed_payload, redact_governed_text


def test_finance_text_redacts_common_sensitive_values() -> None:
    text = (
        "Address: 123 Main Street, Macon, GA 31201; "
        "email josh@example.com; phone 478-555-1212; "
        "SSN 123-45-6789; card 4111 1111 1111 1111"
    )
    redacted, counts = redact_governed_text(1, text)
    assert "123 Main Street" not in redacted
    assert "josh@example.com" not in redacted
    assert "478-555-1212" not in redacted
    assert "123-45-6789" not in redacted
    assert "4111 1111 1111 1111" not in redacted
    assert counts["ADDRESS"] >= 1
    assert counts["EMAIL"] >= 1
    assert counts["PHONE"] >= 1
    assert counts["SSN"] >= 1
    assert counts["CARD"] >= 1


def test_finance_structured_payload_redacts_sensitive_columns() -> None:
    payload = {
        "Address": "500 Oak Road",
        "Account Number": "1234567890",
        "Routing Number": "123456789",
        "Balance": 2450.75,
        "Risk Tolerance": "Moderate",
    }
    redacted, counts = redact_governed_payload(1, payload)
    assert redacted["Address"] == "[REDACTED_ADDRESS]"
    assert redacted["Account Number"] == "[REDACTED_ACCOUNT]"
    assert redacted["Routing Number"] == "[REDACTED_ROUTING]"
    assert redacted["Balance"] == 2450.75
    assert redacted["Risk Tolerance"] == "Moderate"
    assert sum(counts.values()) == 3


def test_non_finance_domains_are_not_changed_by_finance_profile() -> None:
    text = "123 Main Street and test@example.com"
    redacted, counts = redact_governed_text(5, text)
    assert redacted == text
    assert counts == {}
