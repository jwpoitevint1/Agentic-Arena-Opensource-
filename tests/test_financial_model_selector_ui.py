from pathlib import Path


def test_financial_analyst_has_visible_four_model_selector() -> None:
    source = Path("ui/src/t2-bot-chat.jsx").read_text(encoding="utf-8")

    assert 'botKey === "t2_financial"' in source
    assert 'aria-label="Financial Risk Analyst model"' in source
    assert "modelOptions.map((item)" in source
    assert "approvedModelLabel(item)" in source


def test_financial_model_change_starts_a_fresh_bound_session() -> None:
    source = Path("ui/src/t2-bot-chat.jsx").read_text(encoding="utf-8")
    selector = source.split('aria-label="Financial Risk Analyst model"', 1)[0]

    assert "changeModel(event.target.value)" in selector[-300:]
    assert "setSession(null);" in source
    assert '" session will use that approved model."' in source
