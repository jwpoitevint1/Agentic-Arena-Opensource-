from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class AlignmentFramework:
    key: str
    name: str
    status: str
    scope: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True)
class DomainAlignmentProfile:
    system_id: int
    domain: str
    data_classification: str
    personal_data_risk: str
    human_oversight_required: bool
    automated_high_impact_decision_allowed: bool
    sector_references: tuple[str, ...]
    prohibited_or_restricted_uses: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["sector_references"] = list(self.sector_references)
        data["prohibited_or_restricted_uses"] = list(self.prohibited_or_restricted_uses)
        return data


FRAMEWORKS: tuple[AlignmentFramework, ...] = (
    AlignmentFramework(
        key="gdpr",
        name="EU General Data Protection Regulation (GDPR)",
        status="conditional_law",
        scope="Personal-data processing where GDPR territorial/material scope applies.",
    ),
    AlignmentFramework(
        key="eu_ai_act",
        name="EU Artificial Intelligence Act",
        status="conditional_law",
        scope="AI systems placed on the EU market, put into service, or otherwise within Act scope.",
    ),
    AlignmentFramework(
        key="nist_ai_rmf",
        name="NIST AI RMF 1.0 + Generative AI Profile",
        status="voluntary_framework",
        scope="Govern, Map, Measure, and Manage AI risk across the lifecycle.",
    ),
    AlignmentFramework(
        key="nist_csf",
        name="NIST Cybersecurity Framework 2.0",
        status="voluntary_framework",
        scope="Govern, Identify, Protect, Detect, Respond, and Recover cybersecurity risk.",
    ),
    AlignmentFramework(
        key="iso_42001",
        name="ISO/IEC 42001:2023",
        status="management_system_standard",
        scope="AI management system governance, risk, transparency, traceability, and continual improvement.",
    ),
    AlignmentFramework(
        key="iso_23894",
        name="ISO/IEC 23894:2023",
        status="risk_management_guidance",
        scope="AI-specific risk management integrated into organizational risk processes.",
    ),
    AlignmentFramework(
        key="iso_27001",
        name="ISO/IEC 27001:2022",
        status="management_system_standard",
        scope="Information security management for confidentiality, integrity, and availability.",
    ),
    AlignmentFramework(
        key="iso_27701",
        name="ISO/IEC 27701:2025",
        status="privacy_management_standard",
        scope="Privacy information management for PII controllers and processors.",
    ),
)


_COMMON_RESTRICTIONS = (
    "Do not present AI output as the sole final decision for a legally or materially significant decision about a person.",
    "Do not perform social scoring, manipulative vulnerability exploitation, or prohibited biometric/sensitive-trait inference.",
    "Do not infer protected or highly sensitive attributes that are not supported and authorized by the approved use case.",
    "Require meaningful human review for decisions affecting rights, safety, credit, insurance, healthcare, employment, housing, or essential services.",
    "Keep governed execution to the declared purpose and authorized dataset; no autonomous expansion of purpose or data scope.",
)


_PROFILES: dict[int, DomainAlignmentProfile] = {
    1: DomainAlignmentProfile(
        system_id=1,
        domain="finance",
        data_classification="financial_sensitive",
        personal_data_risk="high",
        human_oversight_required=True,
        automated_high_impact_decision_allowed=False,
        sector_references=(
            "GLBA / FTC Safeguards Rule when covered customer information is processed",
            "FCRA when consumer-report information is used for covered eligibility decisions",
            "ECOA / Regulation B when credit decisions are made",
            "PCI DSS when payment-card data enters scope (industry standard, not a statute)",
            "SEC/FINRA obligations when the use case becomes regulated investment advice or brokerage activity",
        ),
        prohibited_or_restricted_uses=_COMMON_RESTRICTIONS
        + (
            "No autonomous approval, denial, pricing, or eligibility decision for credit, loans, insurance, or investment access.",
            "Do not use protected traits or proxies as unauthorized decision criteria.",
        ),
    ),
    2: DomainAlignmentProfile(
        system_id=2,
        domain="environmental_operations",
        data_classification="operational_sensor",
        personal_data_risk="low_unless_device_or_location_data_identifies_people",
        human_oversight_required=True,
        automated_high_impact_decision_allowed=False,
        sector_references=(
            "EPA and applicable environmental recordkeeping/monitoring rules when telemetry is used as regulated compliance evidence",
            "Operational-technology cybersecurity requirements where sector or contract scope applies",
        ),
        prohibited_or_restricted_uses=_COMMON_RESTRICTIONS
        + (
            "Do not represent generic IoT sensor data as certified regulatory emissions or environmental compliance evidence without validation.",
        ),
    ),
    3: DomainAlignmentProfile(
        system_id=3,
        domain="healthcare",
        data_classification="health_sensitive",
        personal_data_risk="very_high",
        human_oversight_required=True,
        automated_high_impact_decision_allowed=False,
        sector_references=(
            "HIPAA Privacy/Security/Breach rules and HITECH when covered entity/business associate scope applies",
            "Applicable state health-data and breach-notification laws",
            "42 CFR Part 2 when substance-use-disorder records enter scope",
            "FDA medical-device / clinical decision-support requirements if the system becomes a regulated clinical product",
        ),
        prohibited_or_restricted_uses=_COMMON_RESTRICTIONS
        + (
            "No diagnosis, treatment, triage, admission/discharge, coverage, or clinical decision as an autonomous AI action.",
            "Do not expose direct patient identifiers or exact encounter identifiers at governed egress.",
        ),
    ),
    4: DomainAlignmentProfile(
        system_id=4,
        domain="retail",
        data_classification="commercial_operational",
        personal_data_risk="moderate_if_customer_data_is_added",
        human_oversight_required=True,
        automated_high_impact_decision_allowed=False,
        sector_references=(
            "CCPA/CPRA and other state comprehensive privacy laws when covered consumer data enters scope",
            "FTC Act unfair/deceptive-practices principles",
            "PCI DSS when payment-card data enters scope (industry standard, not a statute)",
            "COPPA when an online service knowingly processes covered data from children under 13",
        ),
        prohibited_or_restricted_uses=_COMMON_RESTRICTIONS
        + (
            "Do not use sensitive personal traits for discriminatory customer treatment or access decisions.",
        ),
    ),
    5: DomainAlignmentProfile(
        system_id=5,
        domain="aviation",
        data_classification="transport_operational_aggregate",
        personal_data_risk="low_for_current_aggregate_passenger_dataset",
        human_oversight_required=True,
        automated_high_impact_decision_allowed=False,
        sector_references=(
            "FAA/EASA and applicable aviation safety requirements if AI becomes part of operational or safety-critical decision support",
            "EU AI Act product-safety/high-risk requirements if a future use is embedded in regulated aviation products or safety components",
        ),
        prohibited_or_restricted_uses=_COMMON_RESTRICTIONS
        + (
            "Current passenger-volume data must not be represented as accident, airworthiness, or causal safety evidence.",
            "No autonomous safety-critical dispatch, maintenance-release, or airworthiness decision.",
        ),
    ),
    6: DomainAlignmentProfile(
        system_id=6,
        domain="supply_chain",
        data_classification="freight_operational",
        personal_data_risk="low_unless driver/customer identifiers are added",
        human_oversight_required=True,
        automated_high_impact_decision_allowed=False,
        sector_references=(
            "DOT/FMCSA requirements when motor-carrier operational decisions enter scope",
            "49 CFR hazardous-materials requirements if hazmat data/operations enter scope",
            "Customs/import-export and sanctions requirements when cross-border decisions enter scope",
        ),
        prohibited_or_restricted_uses=_COMMON_RESTRICTIONS
        + (
            "Do not treat generic shipment optimization as authority to violate safety, hazmat, customs, sanctions, labor, or contractual constraints.",
        ),
    ),
}


def alignment_frameworks() -> list[AlignmentFramework]:
    return list(FRAMEWORKS)


def alignment_profile_for_system(system_id: int) -> DomainAlignmentProfile:
    try:
        return _PROFILES[system_id]
    except KeyError as exc:
        raise KeyError(f"unknown system_id: {system_id}") from exc


def alignment_profiles() -> list[DomainAlignmentProfile]:
    return [_PROFILES[key] for key in sorted(_PROFILES)]


def alignment_prompt_lines(system_id: int) -> tuple[str, ...]:
    profile = alignment_profile_for_system(system_id)
    return (
        "Regulatory/standards alignment guardrails (alignment only; not a compliance certification):",
        f"- Data classification: {profile.data_classification}.",
        "- Apply purpose limitation, data minimization, need-to-know access, traceability, and privacy/security by design.",
        "- Treat personal/sensitive data as restricted and minimize it before external model processing.",
        "- Human oversight is mandatory for materially significant or safety-related decisions.",
        "- The AI may analyze, explain, evaluate, and advise; it may not be the sole final decision-maker for a high-impact individual decision.",
        "- State uncertainty, data-quality limits, and provenance limitations; do not overstate regulatory status or compliance.",
        *tuple(f"- Restricted: {item}" for item in profile.prohibited_or_restricted_uses),
    )


def alignment_metadata(system_id: int) -> dict[str, object]:
    profile = alignment_profile_for_system(system_id)
    return {
        "claim": "alignment_not_certification",
        "human_oversight_required": profile.human_oversight_required,
        "automated_high_impact_decision_allowed": profile.automated_high_impact_decision_allowed,
        "data_classification": profile.data_classification,
        "personal_data_risk": profile.personal_data_risk,
        "frameworks": [item.key for item in FRAMEWORKS],
        "sector_references": list(profile.sector_references),
    }
