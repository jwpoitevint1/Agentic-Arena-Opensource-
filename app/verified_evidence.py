import json
import math
import re
from collections import Counter
from copy import deepcopy
from datetime import date, datetime
from decimal import Decimal
from typing import Any


MAX_CATEGORICAL_VALUES = 12

_SCAFFOLD_MARKERS = (
    "user is asking me",
    "analyze the request",
    "important constraints from the governance context",
    "required output sections",
    "perform calculations",
    "mental or scratchpad",
    "let me review what data i have access to",
    "for the p&l statement, i need to",
    "for the p and l statement, i need to",
)

_ANSWER_HEADING_RE = re.compile(
    r"(?im)^(?:#{1,3}\s*)?(?:answer|proposed_grain|scope|decision_question)\b"
)
_THINK_BLOCK_RE = re.compile(r"(?is)<think>.*?</think>")


def _normalized_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def _safe_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float, Decimal)):
        number = float(value)
        return number if math.isfinite(number) else None
    if not isinstance(value, str):
        return None

    text = value.strip()
    if not text:
        return None

    percent = text.endswith("%")
    text = text.rstrip("%").replace("$", "").replace(",", "")
    try:
        number = float(text)
    except ValueError:
        return None
    if not math.isfinite(number):
        return None
    return number / 100.0 if percent else number


def _round_number(value: float) -> float:
    return round(value, 6)


def _sensitive_columns(system_id: int) -> set[str]:
    baseline = {
        "address",
        "street_address",
        "mailing_address",
        "postal_address",
        "email",
        "email_address",
        "phone",
        "phone_number",
        "telephone",
        "ssn",
        "social_security_number",
        "credit_card",
        "credit_card_number",
        "card_number",
    }
    if system_id == 1:
        baseline |= {
            "account_number",
            "bank_account",
            "bank_account_number",
            "routing_number",
            "aba_routing_number",
            "iban",
            "swift",
            "swift_code",
            "tax_id",
            "tax_identifier",
        }
    if system_id == 3:
        baseline |= {
            "patient_id",
            "patient_identifier",
            "medical_record_number",
            "mrn",
            "merged",
            "patient_name",
            "patient_admission_date",
            "admission_date",
            "date_of_birth",
            "dob",
            "patient_admission_time",
            "admission_time",
        }
    return baseline


def _column_summary(rows: list[dict[str, object]], system_id: int) -> dict[str, object]:
    if not rows:
        return {}

    sensitive = _sensitive_columns(system_id)
    columns: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row:
            if key not in seen:
                columns.append(key)
                seen.add(key)

    result: dict[str, object] = {}
    row_count = len(rows)
    for column in columns:
        if _normalized_key(column) in sensitive:
            continue

        values = [row.get(column) for row in rows]
        non_null = [value for value in values if value is not None and value != ""]
        null_count = row_count - len(non_null)
        summary: dict[str, object] = {
            "non_null_count": len(non_null),
            "null_count": null_count,
        }

        numeric = [_safe_number(value) for value in non_null]
        numeric_values = [value for value in numeric if value is not None]
        numeric_ratio = len(numeric_values) / len(non_null) if non_null else 0.0

        if non_null and numeric_ratio >= 0.95:
            summary.update(
                {
                    "numeric_count": len(numeric_values),
                    "min": _round_number(min(numeric_values)),
                    "max": _round_number(max(numeric_values)),
                    "sum": _round_number(sum(numeric_values)),
                    "mean": _round_number(sum(numeric_values) / len(numeric_values)),
                }
            )
        else:
            normalized_values = [
                value.isoformat() if isinstance(value, (date, datetime)) else str(value)
                for value in non_null
            ]
            counts = Counter(normalized_values)
            if len(counts) <= MAX_CATEGORICAL_VALUES:
                summary["value_counts"] = dict(
                    sorted(counts.items(), key=lambda item: (-item[1], item[0]))
                )

        result[column] = summary

    return result


def _group_numeric(
    rows: list[dict[str, object]],
    group_key: str,
    value_keys: tuple[str, ...],
) -> dict[str, object]:
    groups: dict[str, dict[str, float]] = {}
    for row in rows:
        group_value = row.get(group_key)
        if group_value is None:
            continue
        group = str(group_value)
        target = groups.setdefault(group, {key: 0.0 for key in value_keys})
        for key in value_keys:
            number = _safe_number(row.get(key))
            if number is not None:
                target[key] += number

    return {
        group: {key: _round_number(value) for key, value in values.items()}
        for group, values in sorted(groups.items())
    }


def _retail_verified_facts(rows: list[dict[str, object]]) -> dict[str, object]:
    sales = [_safe_number(row.get("sales")) for row in rows]
    profit = [_safe_number(row.get("profit")) for row in rows]
    discount = [_safe_number(row.get("discount")) for row in rows]

    sales_values = [value for value in sales if value is not None]
    profit_values = [value for value in profit if value is not None]
    discount_values = [value for value in discount if value is not None]
    nonzero_discounts = [value for value in discount_values if value != 0]
    negative_profit_count = sum(1 for value in profit_values if value < 0)

    total_sales = sum(sales_values)
    total_profit = sum(profit_values)

    return {
        "total_sales": _round_number(total_sales),
        "total_profit": _round_number(total_profit),
        "profit_margin_pct": (
            _round_number(100.0 * total_profit / total_sales)
            if total_sales
            else None
        ),
        "average_discount": (
            _round_number(sum(discount_values) / len(discount_values))
            if discount_values
            else None
        ),
        "average_nonzero_discount": (
            _round_number(sum(nonzero_discounts) / len(nonzero_discounts))
            if nonzero_discounts
            else None
        ),
        "negative_profit_rows": negative_profit_count,
        "negative_profit_pct": (
            _round_number(100.0 * negative_profit_count / len(profit_values))
            if profit_values
            else None
        ),
        "category_totals": _group_numeric(rows, "category", ("sales", "profit")),
        "region_totals": _group_numeric(rows, "region", ("sales", "profit")),
        "segment_totals": _group_numeric(rows, "segment", ("sales", "profit")),
        "ship_mode_totals": _group_numeric(rows, "ship_mode", ("sales", "profit")),
    }


def build_verified_evidence(
    rows: list[dict[str, object]],
    *,
    system_id: int,
) -> dict[str, object]:
    facts: dict[str, object] = {
        "retrieved_row_count": len(rows),
        "scope": "computed from the bounded retrieved rows only",
        "columns": _column_summary(rows, system_id),
    }
    if system_id == 4:
        facts["retail_metrics"] = _retail_verified_facts(rows)
    return facts


def serialize_verified_evidence(value: dict[str, object]) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)


def _strip_reasoning_text(text: str) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    cleaned, removed_blocks = _THINK_BLOCK_RE.subn("", text)
    if removed_blocks:
        counts["think_blocks_removed"] = removed_blocks

    close_index = cleaned.lower().find("</think>")
    if close_index >= 0:
        prefix = cleaned[:close_index]
        lower_prefix = prefix.lower()
        if any(marker in lower_prefix for marker in _SCAFFOLD_MARKERS):
            cleaned = cleaned[close_index + len("</think>") :]
            counts["orphan_think_prefix_removed"] = 1
        else:
            cleaned = cleaned.replace("</think>", "")
            counts["orphan_think_tag_removed"] = 1

    heading = _ANSWER_HEADING_RE.search(cleaned)
    if heading is not None and heading.start() > 0:
        prefix = cleaned[: heading.start()]
        lower_prefix = prefix.lower()
        if any(marker in lower_prefix for marker in _SCAFFOLD_MARKERS):
            cleaned = cleaned[heading.start() :]
            counts["control_scaffold_prefix_removed"] = 1

    return cleaned.strip(), counts


def sanitize_governed_model_result(
    value: dict[str, object],
) -> tuple[dict[str, object], dict[str, int]]:
    sanitized = deepcopy(value)
    counts: dict[str, int] = {}

    result = sanitized.get("result")
    if not isinstance(result, dict):
        return sanitized, counts

    choices = result.get("choices")
    if not isinstance(choices, list):
        return sanitized, counts

    for choice in choices:
        if not isinstance(choice, dict):
            continue
        message = choice.get("message")
        if not isinstance(message, dict):
            continue

        for key in ("reasoning", "reasoning_details"):
            if key in message:
                message.pop(key, None)
                counts[f"{key}_field_removed"] = counts.get(
                    f"{key}_field_removed", 0
                ) + 1

        content = message.get("content")
        if isinstance(content, str):
            cleaned, text_counts = _strip_reasoning_text(content)
            message["content"] = cleaned
            for key, amount in text_counts.items():
                counts[key] = counts.get(key, 0) + amount

    return sanitized, counts


_CLAIM_NUMBER_RE = re.compile(
    r"(?P<value>[+\-−]?\s*\$?\s*\d[\d,]*(?:\.\d+)?\s*[kKmM]?\s*%?)"
)


def _parse_claim_number(token: str) -> tuple[float | None, bool]:
    text = token.strip().replace("−", "-")
    is_percent = text.endswith("%")
    text = text.rstrip("%").strip()

    multiplier = 1.0
    if text[-1:].lower() == "k":
        multiplier = 1_000.0
        text = text[:-1].strip()
    elif text[-1:].lower() == "m":
        multiplier = 1_000_000.0
        text = text[:-1].strip()

    text = text.replace("$", "").replace(",", "").replace(" ", "")
    try:
        return float(text) * multiplier, is_percent
    except ValueError:
        return None, is_percent


def _money_text(value: float) -> str:
    sign = "-" if value < 0 else ""
    return f"{sign}${abs(value):,.2f}"


def _percent_text(value: float) -> str:
    return f"{value:.2f}%"


def _metric_line_key(line: str) -> str | None:
    normalized = re.sub(r"[*_#>|:]+", " ", line.lower())
    normalized = re.sub(r"\s+", " ", normalized).strip(" -")

    labels = (
        ("average_nonzero_discount", ("average nonzero discount", "average non-zero discount", "avg nonzero discount", "avg non-zero discount")),
        ("average_discount", ("average discount", "avg discount")),
        ("profit_margin_pct", ("profit margin", "gross margin")),
        ("total_sales", ("total sales",)),
        ("total_profit", ("total profit",)),
        ("retrieved_row_count", ("records analyzed", "rows analyzed", "transactions analyzed", "retrieved rows", "visible rows", "row count")),
    )
    for key, prefixes in labels:
        if any(normalized.startswith(prefix) for prefix in prefixes):
            return key
    return None


def _expected_claim_value(
    verified_evidence: dict[str, object],
    metric_key: str,
) -> tuple[float | None, str]:
    if metric_key == "retrieved_row_count":
        value = verified_evidence.get("retrieved_row_count")
        return (float(value), "count") if isinstance(value, int) else (None, "count")

    retail = verified_evidence.get("retail_metrics")
    if not isinstance(retail, dict):
        return None, "unknown"

    value = retail.get(metric_key)
    if not isinstance(value, (int, float)):
        return None, "unknown"

    if metric_key in {"total_sales", "total_profit"}:
        return float(value), "money"
    if metric_key == "profit_margin_pct":
        return float(value), "percent"
    if metric_key in {"average_discount", "average_nonzero_discount"}:
        return float(value) * 100.0, "percent"
    return None, "unknown"


def _claim_matches(
    observed: float,
    *,
    observed_percent: bool,
    expected: float,
    kind: str,
) -> bool:
    candidate = observed
    if kind == "percent" and not observed_percent and abs(observed) <= 1.0:
        candidate = observed * 100.0

    tolerance = 0.5 if kind == "percent" else 0.02 if kind == "money" else 0.0
    return abs(candidate - expected) <= tolerance


def _format_expected_claim(expected: float, kind: str) -> str:
    if kind == "money":
        return _money_text(expected)
    if kind == "percent":
        return _percent_text(expected)
    if kind == "count":
        return str(int(round(expected)))
    return str(expected)


def verify_governed_claims(
    value: dict[str, object],
    *,
    verified_evidence: dict[str, object] | None,
) -> tuple[dict[str, object], dict[str, object]]:
    verified = deepcopy(value)
    report: dict[str, object] = {
        "enabled": verified_evidence is not None,
        "checked": 0,
        "corrected": 0,
        "status": "not_applicable" if verified_evidence is None else "pass",
        "contradictions": [],
    }
    if verified_evidence is None:
        return verified, report

    result = verified.get("result")
    if not isinstance(result, dict):
        return verified, report
    choices = result.get("choices")
    if not isinstance(choices, list):
        return verified, report

    contradictions: list[dict[str, object]] = []
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        message = choice.get("message")
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if not isinstance(content, str) or not content:
            continue

        new_lines: list[str] = []
        for line in content.splitlines():
            metric_key = _metric_line_key(line)
            if metric_key is None:
                new_lines.append(line)
                continue

            expected, kind = _expected_claim_value(verified_evidence, metric_key)
            if expected is None:
                new_lines.append(line)
                continue

            match = _CLAIM_NUMBER_RE.search(line)
            if match is None:
                new_lines.append(line)
                continue

            observed, observed_percent = _parse_claim_number(match.group("value"))
            if observed is None:
                new_lines.append(line)
                continue

            report["checked"] = int(report["checked"]) + 1
            if _claim_matches(
                observed,
                observed_percent=observed_percent,
                expected=expected,
                kind=kind,
            ):
                new_lines.append(line)
                continue

            replacement = _format_expected_claim(expected, kind)
            corrected_line = (
                line[: match.start("value")]
                + replacement
                + line[match.end("value") :]
            )
            new_lines.append(corrected_line)
            contradictions.append(
                {
                    "metric": metric_key,
                    "observed": observed,
                    "expected": expected,
                    "replacement": replacement,
                }
            )

        message["content"] = "\n".join(new_lines)

    if contradictions:
        report["corrected"] = len(contradictions)
        report["status"] = "corrected"
        report["contradictions"] = contradictions

    return verified, report
