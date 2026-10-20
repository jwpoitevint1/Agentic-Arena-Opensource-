from pathlib import Path


def test_coding_and_medical_load_global_scoped_telemetry() -> None:
    source = Path("ui/src/t2-bot-chat.jsx").read_text(encoding="utf-8")

    assert 'if (botKey === "t2_coding" || botKey === "t2_medical" || botKey === "t2_financial" || botKey === "t2_logistics" || botKey === "t2_aviation") refreshTelemetry();' in source
    assert 'if (!sessionId && botKey !== "t2_coding" && botKey !== "t2_medical" && botKey !== "t2_financial" && botKey !== "t2_logistics" && botKey !== "t2_aviation") {' in source
    assert 'botKey === "t2_medical"' in source
    assert '"/api/v1/telemetry/latest/medical"' in source
    assert 'botKey === "t2_financial"' in source
    assert '"/api/v1/telemetry/latest/financial"' in source
    assert 'botKey === "t2_logistics"' in source
    assert '"/api/v1/telemetry/latest/logistics"' in source
    assert '"/api/v1/telemetry/latest/avia"' in source


def test_other_agents_clear_stale_global_charts() -> None:
    source = Path("ui/src/t2-bot-chat.jsx").read_text(encoding="utf-8")
    guard = source.split(
        'if (!sessionId && botKey !== "t2_coding" && botKey !== "t2_medical" && botKey !== "t2_financial" && botKey !== "t2_logistics" && botKey !== "t2_aviation") {',
        1,
    )[1].split("return;", 1)[0]

    assert "setTelemetry(null);" in guard
    assert "setTelemetryHistory([]);" in guard
    assert "setLatestByModel({});" in guard
    assert 'setTelemetryError("");' in guard


def test_medical_financial_and_logistics_have_approved_model_selector() -> None:
    source = Path("ui/src/t2-bot-chat.jsx").read_text(encoding="utf-8")

    assert '(botKey === "t2_financial" || botKey === "t2_medical" || botKey === "t2_logistics") && <label className="code-editor-language">Approved AI model' in source
    assert 'aria-label={bot.label + " model"}' in source
    assert "modelOptions.map" in source
