from pathlib import Path


def test_project_methodology_documents_neutral_prompt_programming() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Neutral programming and prompt language" in source
    assert "Shared experimental code and task language are kept functionally descriptive" in source
    assert "Those treatment concepts are introduced only inside the governed execution path." in source
    assert "Regression tests check the ungoverned system prompts and shared UI task templates" in source


def test_testing_observations_tab_is_registered_and_rendered() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert '["observations", "Observations", "03"]' in source
    assert 'view === "observations" && <TestingObservations />' in source
    assert "function TestingObservations()" in source
    assert "Development observations, not research conclusions." in source
    assert "Pre-neutrality runs are development evidence, not clean treatment evidence" in source


def test_observations_document_three_contamination_surfaces() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Prompt contamination" in source
    assert "Execution-path contamination" in source
    assert "Presentation / UI contamination" in source
    assert "Three surfaces require close attention" in source


def test_numbered_sidebar_navigation_matches_requested_order() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    expected = [
        '["lab", "Arena Lab", "01"]',
        '["evidence", "Evidence", "02"]',
        '["observations", "Observations", "03"]',
        '["models", "Models", "04"]',
        '["enterprise", "Enterprise", "05"]',
        '["mcp", "MCP", "06"]',
        '["governance", "Governance", "07"]',
        '["alignment", "Alignment", "08"]',
        '["diagnostics", "Diagnostics", "09"]',
    ]
    for item in expected:
        assert item in source
    assert '["overview", "Project"' not in source


def test_finance_arithmetic_observation_and_mcp_update_are_documented() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Finance still stumps AI" in source
    assert "models produced useful schemas and careful caveats yet still miscounted" in source
    assert "MCP package update:" in source
    assert "counts, sums, averages, minima, maxima" in source


def test_gpt55_post_mcp_finance_replication_is_documented() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Post-MCP GPT-5.5 Finance runs are highly repeatable under governance" in source
    assert "Governed pairwise output similarity averaged 0.888" in source
    assert "24.48 seconds latency" in source
    assert "2,713 reasoning tokens" in source
    assert "two of four controls reached the 5,000-token ceiling" in source
    assert "not a general causal claim across models or domains" in source


def test_model_family_compatibility_method_note_is_documented() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Potential model-family compatibility effect" in source
    assert "not evidence that CV1.1 is optimized for OpenAI or any other vendor" in source
    assert "Controlled prompt-representation testing" in source


def test_model_aware_governance_tuning_observation_is_documented() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Governance tuning should account for model capacity, capability, and function" in source
    assert "model- and function-aware" in source
    assert "deterministic enforcement boundaries remain consistent" in source


def test_same_family_fallback_observation_is_documented() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Fallback routing should preserve model family where possible" in source
    assert "silent cross-family failover" in source
    assert "cross-family contingency should be explicit" in source


def test_observations_translate_same_evidence_for_three_audiences() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "One evidence stack, three views" in source
    assert "Research / methodology" in source
    assert "Engineering / deployment" in source
    assert "Executive / business impact" in source
    assert "Fallback routing should remain within the same model family when practical" in source
    assert "which model-function-governance combination" in source


def test_enterprise_governance_cell_and_requirements_package_are_documented() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Cross-functional governance cell" in source
    assert "Blended matrix governance" in source
    assert "Configuration specialist" in source
    assert "Business analyst / process owner" in source
    assert "Legal / compliance officer" in source
    assert "From business need to governed deployment" in source
    assert "approved same-family fallback model when one exists" in source
    assert "Cross-family contingency is explicit and separately governed" in source


def test_failure_mode_first_governance_tuning_is_documented() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Tune governance to the observed failure mode, not only the model name" in source
    assert "failure type → risk level → verification method → output contract → escalation requirement" in source
    assert "Numerical or factual fabrication" in source
    assert "summarization drift" in source
