"""Shared execution-contract constants for Agentic Arena."""

AGENTIC_MIN_OUTPUT_TOKENS = 2500
AGENTIC_MAX_OUTPUT_TOKENS = 5000

CHATBOT_MAX_OUTPUT_TOKENS = 4096
UI_GUIDE_CHAT_DEFAULT_TOKENS = 4096

UI_GUIDE_PRIMARY_MODEL_KEY = "ling_3_0_flash"
UI_GUIDE_FAILOVER_MODEL_KEY = "mistral_small_4"
UI_GUIDE_ALLOWED_MODEL_KEYS = (
    UI_GUIDE_PRIMARY_MODEL_KEY,
    UI_GUIDE_FAILOVER_MODEL_KEY,
)

UI_GUIDE_FAILOVER_HTTP_STATUSES = (
    404,
    408,
    429,
    500,
    502,
    503,
    504,
)


# Matched governed-vs-ungoverned experimental contract.
# These values define the variables that MUST remain identical across both paths.
# Governance/access implementation is intentionally excluded: it is the independent variable.
AGENTIC_EVIDENCE_ROW_LIMIT = 100
AGENTIC_PROFILE_COLUMN_LIMIT = 200

AGENTIC_PAIRING_CONTRACT = {
    "same_function": True,
    "same_system_and_dataset": True,
    "same_model_key": True,
    "same_task_and_source_context": True,
    "same_evidence_row_limit": True,
    "evidence_row_limit": AGENTIC_EVIDENCE_ROW_LIMIT,
    "same_profile_column_limit": True,
    "profile_column_limit": AGENTIC_PROFILE_COLUMN_LIMIT,
    "same_max_tokens": True,
    "max_output_tokens": AGENTIC_MAX_OUTPUT_TOKENS,
    "allowed_differences": (
        "governance_enforcement",
        "opa_policy_gate",
        "data_access_implementation",
        "mcp_tool_boundary",
        "governed_only_verification",
        "governed_output_sanitation",
        "governed_output_redaction",
    ),
    "intended_difference": (
        "CV1.1/OPA/MCP runtime enforcement and governed-only verification/sanitation; "
        "the ungoverned control uses an independent direct read-only database access implementation."
    ),
}
