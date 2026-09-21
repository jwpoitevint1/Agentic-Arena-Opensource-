from app.verified_evidence import (
    build_verified_evidence,
    sanitize_governed_model_result,
    verify_governed_claims,
)


def test_retail_verified_evidence_computes_exact_metrics() -> None:
    rows = [
        {
            "region": "West",
            "category": "Technology",
            "sales": 100.0,
            "profit": 20.0,
            "discount": 0.2,
        },
        {
            "region": "South",
            "category": "Furniture",
            "sales": 50.0,
            "profit": -10.0,
            "discount": 0.5,
        },
    ]

    facts = build_verified_evidence(rows, system_id=4)
    metrics = facts["retail_metrics"]

    assert facts["retrieved_row_count"] == 2
    assert metrics["total_sales"] == 150.0
    assert metrics["total_profit"] == 10.0
    assert metrics["profit_margin_pct"] == 6.666667
    assert metrics["negative_profit_rows"] == 1
    assert metrics["negative_profit_pct"] == 50.0
    assert metrics["category_totals"]["Technology"]["profit"] == 20.0
    assert metrics["region_totals"]["South"]["profit"] == -10.0
    assert metrics["segment_totals"] == {}
    assert metrics["ship_mode_totals"] == {}


def test_healthcare_verified_evidence_excludes_direct_identifiers() -> None:
    rows = [
        {
            "patient_id": "780-96-6113",
            "merged": "W. Breede",
            "patient_waittime": 10,
            "patient_admission_flag": "Admission",
        },
        {
            "patient_id": "323-30-5176",
            "merged": "A. Example",
            "patient_waittime": 60,
            "patient_admission_flag": "Not Admission",
        },
    ]

    facts = build_verified_evidence(rows, system_id=3)
    columns = facts["columns"]

    assert "patient_id" not in columns
    assert "merged" not in columns
    assert columns["patient_waittime"]["min"] == 10.0
    assert columns["patient_waittime"]["max"] == 60.0
    assert columns["patient_admission_flag"]["value_counts"] == {
        "Admission": 1,
        "Not Admission": 1,
    }


def test_governed_output_sanitation_removes_reasoning_scaffold() -> None:
    payload = {
        "result": {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "reasoning": "private reasoning",
                        "content": (
                            "user is asking me to analyze the request\n"
                            "Important constraints from the governance context\n"
                            "</think>\n"
                            "# Answer\n"
                            "Verified result."
                        ),
                    }
                }
            ]
        }
    }

    sanitized, counts = sanitize_governed_model_result(payload)
    message = sanitized["result"]["choices"][0]["message"]

    assert "reasoning" not in message
    assert message["content"] == "# Answer\nVerified result."
    assert counts["reasoning_field_removed"] == 1
    assert counts["orphan_think_prefix_removed"] == 1



def test_claim_verification_corrects_core_retail_metrics() -> None:
    rows = [
        {
            "region": "West",
            "category": "Technology",
            "sales": 100.0,
            "profit": 20.0,
            "discount": 0.2,
        },
        {
            "region": "South",
            "category": "Furniture",
            "sales": 50.0,
            "profit": -10.0,
            "discount": 0.5,
        },
    ]
    facts = build_verified_evidence(rows, system_id=4)
    payload = {
        "result": {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": (
                            "| Total Sales | $150K |\n"
                            "| Total Profit | $900.00 |\n"
                            "| Profit Margin | 24.9% |\n"
                            "| Average Discount | 0.35 |\n"
                            "| Records Analyzed | 99 |"
                        ),
                    }
                }
            ]
        }
    }

    verified, report = verify_governed_claims(
        payload,
        verified_evidence=facts,
    )
    content = verified["result"]["choices"][0]["message"]["content"]

    assert "| Total Sales | $150.00 |" in content
    assert "| Total Profit | $10.00 |" in content
    assert "| Profit Margin | 6.67% |" in content
    assert "| Average Discount | 35.00% |" in content
    assert "| Records Analyzed | 2 |" in content
    assert report["status"] == "corrected"
    assert report["checked"] == 5
    assert report["corrected"] == 4


def test_claim_verification_accepts_equivalent_discount_ratio() -> None:
    rows = [
        {
            "region": "West",
            "category": "Technology",
            "sales": 100.0,
            "profit": 20.0,
            "discount": 0.2,
        }
    ]
    facts = build_verified_evidence(rows, system_id=4)
    payload = {
        "result": {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "Average Discount: 0.2",
                    }
                }
            ]
        }
    }

    verified, report = verify_governed_claims(
        payload,
        verified_evidence=facts,
    )

    assert verified["result"]["choices"][0]["message"]["content"] == "Average Discount: 0.2"
    assert report["status"] == "pass"
    assert report["checked"] == 1
    assert report["corrected"] == 0


def test_finance_verified_evidence_uses_canonical_accounting_parser() -> None:
    rows = [
        {"income_level": "($25,488.15)", "interest_rate": "11.94%"},
        {"income_level": "$10,000.00 ", "interest_rate": "10.06%"},
    ]

    facts = build_verified_evidence(rows, system_id=1)
    income = facts["columns"]["income_level"]
    rate = facts["columns"]["interest_rate"]

    assert income["numeric_count"] == 2
    assert income["min"] == -25488.15
    assert income["max"] == 10000.0
    assert income["sum"] == -15488.15
    assert rate["numeric_count"] == 2
    assert rate["mean"] == 11.0


def test_claim_verification_reports_evidence_bound_when_no_post_generation_metric_matches() -> None:
    rows = [
        {"income_level": "($25,488.15)", "loan_status": "approved"},
        {"income_level": "$10,000.00", "loan_status": "pending"},
    ]
    facts = build_verified_evidence(rows, system_id=1)
    payload = {
        "result": {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": "The bounded finance sample contains two retrieved rows.",
                    }
                }
            ]
        }
    }

    _, report = verify_governed_claims(payload, verified_evidence=facts)

    assert report["status"] == "evidence_bound"
    assert report["evidence_attached"] is True
    assert report["verification_mode"] == "preverified_evidence_binding"
    assert report["checked"] == 0
    assert report["corrected"] == 0


def test_claim_verification_does_not_rewrite_narrative_retrieved_rows_sentence() -> None:
    rows = [
        {"account_balance": "$100,000.00"},
        {"account_balance": "$1,000.00"},
    ]
    facts = build_verified_evidence(rows, system_id=1)
    original = (
        "Retrieved rows show repeated account_balance values at $100,000.00 "
        "(verified max) and at $1,000.00 (verified min)."
    )
    payload = {
        "result": {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": original,
                    }
                }
            ]
        }
    }

    verified, report = verify_governed_claims(payload, verified_evidence=facts)

    assert verified["result"]["choices"][0]["message"]["content"] == original
    assert report["status"] == "evidence_bound"
    assert report["checked"] == 0
    assert report["corrected"] == 0
