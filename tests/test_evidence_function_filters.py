from pathlib import Path


def test_evidence_function_filters_include_all_five_arena_functions() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    start = source.index("const EVIDENCE_FUNCTION_OPTIONS")
    end = source.index("function Evidence(", start)
    block = source[start:end]

    assert '["analyst", "Analyst"]' in block
    assert '["data_modeler", "Data Modeler"]' in block
    assert '["mixed_capability", "Mixed Capability"]' in block
    assert '["auditor", "Auditor"]' in block
    assert '["advisor", "Advisor"]' in block

    assert '{[["all", "All"], ...EVIDENCE_FUNCTION_OPTIONS].map' in source
    assert '{EVIDENCE_FUNCTION_OPTIONS.map' in source


def test_data_modeler_ui_keeps_visualization_in_same_function() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert 'const visualizerTask' not in source
    assert 'functionKey === "visualizer"' not in source
    assert '/#{0,6}\\s*VISUALIZATION_SPEC\\s*:?\\s*/gi' in source
    assert 'dataModeler={dataModelerSelected}' in source


def test_data_modeler_ui_prefers_api_backed_visualization() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "payload?.visualization_spec" in source
    assert "apiVisualization || modelVisualization" in source
    assert "mcp.dataset.statistics" in source


def test_mixed_capability_evidence_compares_latest_governed_and_ungoverned_runs() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "function MixedCapabilityLatestComparison" in source
    assert 'String(run?.function_key || "").toLowerCase() === "mixed_capability"' in source
    assert 'run.governance === "governed"' in source
    assert 'run.governance === "ungoverned"' in source
    assert "slice(0, 4)" in source
    assert "Latest governed and ungoverned run for four models" in source
    assert "function MixedCapabilityLatestComparison({ runs, models })" in source
