from pathlib import Path


def test_evidence_function_filters_include_all_four_arena_functions() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    start = source.index("const EVIDENCE_FUNCTION_OPTIONS")
    end = source.index("function Evidence(", start)
    block = source[start:end]

    assert '["analyst", "Analyst"]' in block
    assert '["data_modeler", "Data Modeler"]' in block
    assert '["auditor", "Auditor"]' in block
    assert '["advisor", "Advisor"]' in block

    assert '{[["all", "All"], ...EVIDENCE_FUNCTION_OPTIONS].map' in source
    assert '{EVIDENCE_FUNCTION_OPTIONS.map' in source
