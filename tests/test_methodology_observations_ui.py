from pathlib import Path


def test_project_overview_states_the_matched_comparison_boundary() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "matched models, tasks, domains, and source data" in source
    assert "the effect of runtime controls can be inspected" in source
    assert "without presenting the results as generalized research conclusions" in source


def test_current_navigation_registers_all_five_t2_surfaces() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    expected = [
        '["t2_coding", "Coding Assistant", "10"]',
        '["t2_medical", "Medical Analyst / Assistant", "11"]',
        '["t2_financial", "Financial Risk Analyst", "12"]',
        '["t2_logistics", "Logistics Management Analyst / Assistant", "13"]',
        '["t2_aviation", "Aviation Travel Assistant", "14"]',
    ]
    for item in expected:
        assert item in source
    assert 'view === "t2_coding"' in source
    assert "<T2BotChat botKey={view}" in source


def test_t2_agents_declare_separate_roles_and_capabilities() -> None:
    source = Path("ui/src/t2-bot-chat.jsx").read_text(encoding="utf-8")

    for key in ("t2_coding", "t2_medical", "t2_financial", "t2_logistics", "t2_aviation"):
        assert f'{key}: {{ key: "{key}"' in source
    assert 'role: "coding_assistant"' in source
    assert 'role: "medical_analyst_assistant"' in source
    assert 'role: "financial_risk_analyst"' in source
    assert 'role: "logistics_management_analyst_assistant"' in source
    assert 'role: "aviation_travel_assistant"' in source
    assert 'capabilities: ["state.read"]' in source
    assert '"dataset.read"' in source
    assert '"data.validate"' in source
    assert '"arithmetic.verify"' in source


def test_t2_ui_preserves_execution_and_evaluator_boundaries() -> None:
    source = Path("ui/src/t2-bot-chat.jsx").read_text(encoding="utf-8")

    assert "Coding agent · no local execution or deployment" in source
    assert "Governance functions only · evaluator cannot modify the benchmark" in source
    assert 'aria-label="Governance benchmark evaluator"' in source
    assert "Approved AI model" in source
