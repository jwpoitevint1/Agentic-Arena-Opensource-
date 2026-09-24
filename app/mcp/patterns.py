import re
from dataclasses import dataclass
from typing import Any

from app.governed_functions import domain_profile_for_system


IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
SQL_ESCAPE_RE = re.compile(
    r"(?is)(--|/\*|\*/|;\s*(?:drop|alter|insert|update|delete|grant|revoke|truncate)\b|\bpg_sleep\s*\()"
)
REDEFINITION_RE = re.compile(
    r"(?is)(?:\b(?:ignore|disregard)\b.{0,48}\b(?:instructions|policy|governance)\b|"
    r"\b(?:disable|bypass|override|replace)\b.{0,48}\b(?:cv\s*1\.1|governance|system\s+prompt|policy)\b|"
    r"\bredefine\b.{0,32}\brole\b)"
)
RESTRICTED_KEYS = {
    "database_target",
    "database_url",
    "connection_string",
    "governance",
    "runtime_role",
    "role",
    "sql",
    "query_sql",
    "system_prompt",
    "policy",
}

# Baseline privacy controls apply to every governed domain. These patterns target
# direct identifiers that should not be necessary for normal analytical output.
# Domain-specific profiles extend the baseline for finance and healthcare.
BASELINE_SENSITIVE_FIELD_KEYS = {
    "address": "ADDRESS",
    "street_address": "ADDRESS",
    "mailing_address": "ADDRESS",
    "postal_address": "ADDRESS",
    "email": "EMAIL",
    "email_address": "EMAIL",
    "phone": "PHONE",
    "phone_number": "PHONE",
    "telephone": "PHONE",
    "ssn": "SSN",
    "social_security_number": "SSN",
    "credit_card": "CARD",
    "credit_card_number": "CARD",
    "card_number": "CARD",
}

BASELINE_OUTPUT_PATTERNS: tuple[tuple[str, re.Pattern[str], str], ...] = (
    (
        "SSN",
        re.compile(r"(?<!\d)\d{3}[- ]?\d{2}[- ]?\d{4}(?!\d)"),
        "[REDACTED_SSN]",
    ),
    (
        "EMAIL",
        re.compile(r"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"),
        "[REDACTED_EMAIL]",
    ),
    (
        "PHONE",
        re.compile(r"(?<!\d)(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]\d{3}[-.\s]\d{4}(?!\d)"),
        "[REDACTED_PHONE]",
    ),
    (
        "CARD",
        re.compile(r"(?<!\d)(?:\d[ -]*?){13,19}(?!\d)"),
        "[REDACTED_CARD]",
    ),
    (
        "ADDRESS",
        re.compile(
            r"(?i)\b\d{1,6}\s+(?:[A-Z0-9.'-]+\s+){0,6}"
            r"(?:street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|court|ct|circle|cir|way|parkway|pkwy|highway|hwy)\b"
            r"(?:[^\n;]{0,80})?"
        ),
        "[REDACTED_ADDRESS]",
    ),
)

FINANCE_SENSITIVE_FIELD_KEYS = {
    **BASELINE_SENSITIVE_FIELD_KEYS,
    "account_number": "ACCOUNT",
    "bank_account": "ACCOUNT",
    "bank_account_number": "ACCOUNT",
    "routing_number": "ROUTING",
    "aba_routing_number": "ROUTING",
    "iban": "IBAN",
    "swift": "SWIFT",
    "swift_code": "SWIFT",
    "tax_id": "TAX_ID",
    "tax_identifier": "TAX_ID",
}

FINANCE_OUTPUT_PATTERNS: tuple[tuple[str, re.Pattern[str], str], ...] = BASELINE_OUTPUT_PATTERNS + (
    (
        "ROUTING",
        re.compile(r"(?i)(\b(?:routing|aba)(?:\s+number)?\s*[:=#-]?\s*)\d{9}\b"),
        r"\1[REDACTED_ROUTING]",
    ),
    (
        "ACCOUNT",
        re.compile(r"(?i)(\b(?:bank\s+)?account(?:\s+number)?\s*[:=#-]?\s*)\d{4,17}\b"),
        r"\1[REDACTED_ACCOUNT]",
    ),
)

HEALTHCARE_SENSITIVE_FIELD_KEYS = {
    **BASELINE_SENSITIVE_FIELD_KEYS,
    "patient_id": "PATIENT_ID",
    "patient_identifier": "PATIENT_ID",
    "medical_record_number": "MRN",
    "mrn": "MRN",
    "merged": "PATIENT_NAME",
    "patient_name": "PATIENT_NAME",
    "patient_admission_date": "ENCOUNTER_DATE",
    "admission_date": "ENCOUNTER_DATE",
    "date_of_birth": "DOB",
    "dob": "DOB",
    "patient_admission_time": "ENCOUNTER_TIME",
    "admission_time": "ENCOUNTER_TIME",
}

HEALTHCARE_OUTPUT_PATTERNS: tuple[tuple[str, re.Pattern[str], str], ...] = (
    (
        "PATIENT_ID",
        re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)"),
        "[REDACTED_PATIENT_ID]",
    ),
) + BASELINE_OUTPUT_PATTERNS + (
    (
        "MRN",
        re.compile(r"(?i)(\b(?:mrn|medical\s+record\s+number)\s*[:=#-]?\s*)[A-Z0-9-]{4,32}\b"),
        r"\1[REDACTED_MRN]",
    ),
    (
        "PATIENT_NAME",
        re.compile(r"\b[A-Z]\.\s+[A-Z][A-Za-z'’-]{1,40}\b"),
        "[REDACTED_PATIENT_NAME]",
    ),
    (
        "ENCOUNTER_DATE",
        re.compile(r"\b(?:0?[1-9]|1[0-2])/(?:0?[1-9]|[12]\d|3[01])/(?:19|20)\d{2}\b"),
        "[REDACTED_ENCOUNTER_DATE]",
    ),
    (
        "ENCOUNTER_TIME",
        re.compile(r"(?i)\b(?:0?[1-9]|1[0-2]):[0-5]\d(?::[0-5]\d)?\s*(?:AM|PM)\b"),
        "[REDACTED_ENCOUNTER_TIME]",
    ),
)

SENSITIVE_FIELD_KEYS_BY_SYSTEM: dict[int, dict[str, str]] = {
    1: FINANCE_SENSITIVE_FIELD_KEYS,
    2: BASELINE_SENSITIVE_FIELD_KEYS,
    3: HEALTHCARE_SENSITIVE_FIELD_KEYS,
    4: BASELINE_SENSITIVE_FIELD_KEYS,
    5: BASELINE_SENSITIVE_FIELD_KEYS,
    6: BASELINE_SENSITIVE_FIELD_KEYS,
}

OUTPUT_PATTERNS_BY_SYSTEM: dict[int, tuple[tuple[str, re.Pattern[str], str], ...]] = {
    1: FINANCE_OUTPUT_PATTERNS,
    2: BASELINE_OUTPUT_PATTERNS,
    3: HEALTHCARE_OUTPUT_PATTERNS,
    4: BASELINE_OUTPUT_PATTERNS,
    5: BASELINE_OUTPUT_PATTERNS,
    6: BASELINE_OUTPUT_PATTERNS,
}

OUTPUT_PROFILE_BY_SYSTEM = {
    1: "finance_production_like",
    2: "baseline_personal_data",
    3: "healthcare_phi_production_like",
    4: "baseline_personal_data",
    5: "baseline_personal_data",
    6: "baseline_personal_data",
}


@dataclass(frozen=True)
class DomainRegexProfile:
    system_id: int
    domain: str
    semantic_pattern: str

    def to_dict(self) -> dict[str, object]:
        field_keys = SENSITIVE_FIELD_KEYS_BY_SYSTEM.get(self.system_id)
        patterns = OUTPUT_PATTERNS_BY_SYSTEM.get(self.system_id)
        output_redaction: dict[str, object]
        if field_keys is not None and patterns is not None:
            output_redaction = {
                "enabled": True,
                "profile": OUTPUT_PROFILE_BY_SYSTEM[self.system_id],
                "field_categories": sorted(set(field_keys.values())),
                "pattern_categories": [item[0] for item in patterns],
            }
        else:
            output_redaction = {"enabled": False}

        return {
            "system_id": self.system_id,
            "domain": self.domain,
            "identifier_pattern": IDENTIFIER_RE.pattern,
            "semantic_pattern": self.semantic_pattern,
            "security_patterns": {
                "control_characters": CONTROL_RE.pattern,
                "sql_escape": SQL_ESCAPE_RE.pattern,
                "redefinition": REDEFINITION_RE.pattern,
            },
            "governed_output_redaction": output_redaction,
        }


_DOMAIN_PATTERNS: dict[int, re.Pattern[str]] = {
    1: re.compile(r"(?i)\b(income|balance|deposit|withdrawal|transfer|investment|loan|interest|risk|occupation|employment|transaction|account|cost)\w*\b"),
    2: re.compile(r"(?i)\b(sensor|temperature|humidity|co|lpg|smoke|light|motion|reading|threshold|device|timestamp|anomal)\w*\b"),
    3: re.compile(r"(?i)\b(patient|admission|wait|department|satisfaction|age|gender|race|referral|flow)\w*\b"),
    4: re.compile(r"(?i)\b(sales|profit|segment|ship|region|category|sub.?category|quantity|discount|city|state|postal)\w*\b"),
    5: re.compile(r"(?i)\b(passenger|carried|country|year|traffic|volume|aviation|air\s*transport)\w*\b"),
    6: re.compile(r"(?i)\b(shipment|warehouse|destination|carrier|shipment.?date|delivery.?date|weight|cost|status|distance|transit)\w*\b"),
}


def regex_profile(system_id: int) -> DomainRegexProfile:
    domain = domain_profile_for_system(system_id)
    return DomainRegexProfile(
        system_id=system_id,
        domain=domain.domain,
        semantic_pattern=_DOMAIN_PATTERNS[system_id].pattern,
    )


def validate_identifier(value: str) -> str:
    if not IDENTIFIER_RE.fullmatch(value):
        raise ValueError("identifier failed governed regex validation")
    return value


def validate_text(value: str, *, allow_redefinition_language: bool = False) -> str:
    if CONTROL_RE.search(value):
        raise ValueError("control characters are not permitted")
    if SQL_ESCAPE_RE.search(value):
        raise ValueError("SQL escape or mutation pattern is not permitted")
    if not allow_redefinition_language and REDEFINITION_RE.search(value):
        raise ValueError("role/policy redefinition pattern is not permitted")
    return value


def validate_arguments(arguments: dict[str, Any]) -> None:
    if len(arguments) > 25:
        raise ValueError("too many MCP arguments")
    for key, value in arguments.items():
        if key in RESTRICTED_KEYS:
            raise ValueError(f"argument is server-controlled: {key}")
        validate_identifier(key)
        _validate_value(value)


def _validate_value(value: Any) -> None:
    if value is None or isinstance(value, (bool, int, float)):
        return
    if isinstance(value, str):
        if len(value) > 100_000:
            raise ValueError("MCP string argument is too large")
        validate_text(value)
        return
    if isinstance(value, list):
        if len(value) > 100:
            raise ValueError("MCP list argument is too large")
        for item in value:
            _validate_value(item)
        return
    if isinstance(value, dict):
        if len(value) > 25:
            raise ValueError("nested MCP object is too large")
        for key, item in value.items():
            if not isinstance(key, str):
                raise ValueError("MCP object keys must be strings")
            if key in RESTRICTED_KEYS:
                raise ValueError(f"argument is server-controlled: {key}")
            validate_identifier(key)
            _validate_value(item)
        return
    raise ValueError("unsupported MCP argument type")


def _normalized_field_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", key.strip().lower()).strip("_")


def _increment(counts: dict[str, int], category: str, amount: int = 1) -> None:
    counts[category] = counts.get(category, 0) + amount


def governed_output_redaction_enabled(system_id: int) -> bool:
    return system_id in OUTPUT_PATTERNS_BY_SYSTEM


def redact_governed_text(system_id: int, text: str) -> tuple[str, dict[str, int]]:
    """Redact direct identifiers from governed text before external model use or egress."""
    patterns = OUTPUT_PATTERNS_BY_SYSTEM.get(system_id)
    if patterns is None or not text:
        return text, {}

    redacted = text
    counts: dict[str, int] = {}
    for category, pattern, replacement in patterns:
        redacted, substitutions = pattern.subn(replacement, redacted)
        if substitutions:
            _increment(counts, category, substitutions)
    return redacted, counts


def redact_governed_payload(system_id: int, value: Any) -> tuple[Any, dict[str, int]]:
    """Recursively redact sensitive governed fields and text at domain egress."""
    sensitive_fields = SENSITIVE_FIELD_KEYS_BY_SYSTEM.get(system_id)
    if sensitive_fields is None:
        return value, {}

    counts: dict[str, int] = {}

    def walk(item: Any, *, field_key: str | None = None) -> Any:
        if field_key is not None:
            category = sensitive_fields.get(_normalized_field_key(field_key))
            if category is not None and item is not None and item != "":
                _increment(counts, category)
                return f"[REDACTED_{category}]"

        if isinstance(item, str):
            redacted, text_counts = redact_governed_text(system_id, item)
            for category, amount in text_counts.items():
                _increment(counts, category, amount)
            return redacted
        if isinstance(item, list):
            return [walk(child) for child in item]
        if isinstance(item, tuple):
            return tuple(walk(child) for child in item)
        if isinstance(item, dict):
            return {key: walk(child, field_key=str(key)) for key, child in item.items()}
        return item

    return walk(value), counts


def matched_domain_terms(system_id: int, text: str) -> list[str]:
    matches = _DOMAIN_PATTERNS[system_id].findall(text)
    normalized: list[str] = []
    seen: set[str] = set()
    for match in matches:
        term = str(match).lower()
        if term not in seen:
            normalized.append(term)
            seen.add(term)
    return normalized[:12]
