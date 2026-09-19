from app.mcp.patterns import (
    governed_output_redaction_enabled,
    redact_governed_payload,
    redact_governed_text,
    regex_profile,
)


def test_healthcare_redaction_profile_is_enabled() -> None:
    assert governed_output_redaction_enabled(3)
    profile = regex_profile(3).to_dict()["governed_output_redaction"]
    assert profile["enabled"] is True
    assert profile["profile"] == "healthcare_phi_production_like"


def test_healthcare_structured_fields_are_redacted() -> None:
    payload = {
        "Patient Id": "780-96-6113",
        "Merged": "W. Breede",
        "Patient Admission Date": "9/9/2024",
        "Patient Admission Time": "9:25:00 AM",
        "Patient Gender": "Female",
        "Patient Age": 63,
        "Patient Race": "African American",
        "Patient Waittime": 32,
    }
    redacted, counts = redact_governed_payload(3, payload)

    assert redacted["Patient Id"] == "[REDACTED_PATIENT_ID]"
    assert redacted["Merged"] == "[REDACTED_PATIENT_NAME]"
    assert redacted["Patient Admission Date"] == "[REDACTED_ENCOUNTER_DATE]"
    assert redacted["Patient Admission Time"] == "[REDACTED_ENCOUNTER_TIME]"
    assert redacted["Patient Gender"] == "Female"
    assert redacted["Patient Age"] == 63
    assert redacted["Patient Race"] == "African American"
    assert redacted["Patient Waittime"] == 32
    assert counts["PATIENT_ID"] == 1
    assert counts["PATIENT_NAME"] == 1
    assert counts["ENCOUNTER_DATE"] == 1
    assert counts["ENCOUNTER_TIME"] == 1


def test_healthcare_free_text_fallback_redacts_phi_patterns() -> None:
    text = (
        "Patient 780-96-6113 W. Breede arrived 9/9/2024 at 9:25:00 AM. "
        "Contact patient@example.com or 478-555-1212."
    )
    redacted, counts = redact_governed_text(3, text)

    assert "780-96-6113" not in redacted
    assert "W. Breede" not in redacted
    assert "9/9/2024" not in redacted
    assert "9:25:00 AM" not in redacted
    assert "patient@example.com" not in redacted
    assert "478-555-1212" not in redacted
    assert counts["PATIENT_ID"] == 1
    assert counts["PATIENT_NAME"] == 1
    assert counts["ENCOUNTER_DATE"] == 1
    assert counts["ENCOUNTER_TIME"] == 1
    assert counts["EMAIL"] == 1
    assert counts["PHONE"] == 1


def test_ungoverned_or_other_domains_are_not_redacted_by_healthcare_profile() -> None:
    payload = {"Patient Id": "780-96-6113", "Merged": "W. Breede"}
    unchanged, counts = redact_governed_payload(2, payload)
    assert unchanged == payload
    assert counts == {}
