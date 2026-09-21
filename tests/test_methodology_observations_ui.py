from pathlib import Path


def test_project_methodology_documents_neutral_prompt_programming() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert "Neutral programming and prompt language" in source
    assert "Shared experimental code and task language are kept functionally descriptive" in source
    assert "Those treatment concepts are introduced only inside the governed execution path." in source
    assert "Regression tests check the ungoverned system prompts and shared UI task templates" in source


def test_testing_observations_tab_is_registered_and_rendered() -> None:
    source = Path("ui/src/main.jsx").read_text(encoding="utf-8")

    assert '["observations", "Observations", "04"]' in source
    assert 'view === "observations" && <TestingObservations />' in source
    assert "function TestingObservations()" in source
    assert "Development observations, not research conclusions." in source
    assert "Pre-neutrality runs are development evidence, not clean treatment evidence" in source
