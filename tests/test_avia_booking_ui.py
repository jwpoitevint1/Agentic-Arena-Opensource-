from pathlib import Path


def _source() -> str:
    return Path("ui/src/t2-bot-chat.jsx").read_text(encoding="utf-8")


def test_avia_requires_explicit_trip_confirmation_before_search() -> None:
    source = _source()
    assert "AVIA_DATE_CONFIRMATION_PROMPT" in source
    assert "One way" in source
    assert "Round trip" in source
    assert "Non-stop preferred" in source
    assert "Yes, confirm dates" in source
    assert "No, revise" in source


def test_avia_uses_aviation_customer_service_framing() -> None:
    source = _source()
    assert "Agent Benchmark · aviation customer service interface" in source
    assert "Agent Benchmark backend · MCP-routed · aviation customer service" in source
    assert "Booking and payment remain outside the AI boundary." in source


def test_avia_binds_supported_cabin_class_into_confirmed_search() -> None:
    source = _source()
    assert 'premium_economy: "Premium Economy"' in source
    assert 'business: "Business"' in source
    assert 'first: "First"' in source
    assert 'economy: "Economy"' in source
    assert 'aria-label="Cabin class"' in source
    assert 'Cabin class: " + AVIA_CABIN_LABELS[aviaDraft.cabin]' in source


def test_avia_accepts_city_pairs_without_requiring_from_keyword() -> None:
    source = _source()
    assert 'const withoutRequest = normalized.replace' in source
    assert 'const cityPair = withoutRequest.match(/^(.+?)\\s+to\\s+(.+)$/i);' in source
    assert 'destination: cleanRoutePoint(cityPair?.[2], true)' in source
    assert '.replace(/\\s+area$/i, "")' in source


def test_avia_adds_known_airport_ids_without_restricting_free_text() -> None:
    source = _source()
    assert "function flightSearchLocation(value)" in source
    assert 'return cleaned + " (" + matches.map(([code]) => code).join(",") + ")"' in source
    assert "flightSearchLocation(aviaDraft.origin)" in source
    assert "flightSearchLocation(aviaDraft.destination)" in source
    assert "if (!matches.length) return cleaned;" in source
    assert "Resolve each location to the appropriate IATA airport code or codes before calling travel.search." in source


def test_avia_is_fixed_to_ling_without_a_model_dropdown() -> None:
    source = _source()
    assert 'const AVIA_MODEL_KEY = "ling";' in source
    assert 'model_key: botKey === "t2_aviation" ? AVIA_MODEL_KEY' in source
    assert '(botKey === "t2_financial" || botKey === "t2_medical" || botKey === "t2_logistics") && <label className="code-editor-language">Approved AI model' in source
    assert '|| botKey === "t2_aviation") && <label className="code-editor-language">Approved AI model' not in source


def test_avia_calendar_is_visual_and_interactive() -> None:
    source = _source()
    assert 'aria-label="Avia schedule calendar"' in source
    assert 'aria-label="Previous month"' in source
    assert 'aria-label="Next month"' in source
    assert "onSelect(key)" in source


def test_unconfirmed_flight_lookup_does_not_call_backend_turn() -> None:
    source = _source()
    interception = source.split('if (botKey === "t2_aviation" && isFlightLookupRequest(current)) {', 1)[1].split('if (botKey === "t2_coding")', 1)[0]
    assert "createAviaDraft(current)" in interception
    assert "t2Request(" not in interception


def test_confirmed_search_offers_booking_handoff() -> None:
    source = _source()
    assert "confirmAviaDates" in source
    assert "Continue to booking?" in source
    assert "Yes, continue" in source
    assert 'url.searchParams.set("avia", "payment")' in source


def test_payment_handoff_disclosure_is_exact() -> None:
    source = _source()
    assert "Thank you for testing Avia the Aviation Customer Service Agent." in source
    assert "If this were a customer service facing agent the link would be sent to a secure payment method where no AI would be used or have access to sensitive information." in source
    assert "No payment information is requested or processed on this page." in source


def test_avia_item_guidance_bypasses_flight_calendar() -> None:
    import subprocess

    source = _source()
    helpers = source[source.index("function cleanRoutePoint("):source.index("function AviaCalendar(")]
    checks = r"""
const assert = require("node:assert/strict");
for (const prompt of [
  "I’m going hunting in Colorado I need to take my rifle. Where can I get guidance on that",
  "Can I fly from Atlanta to Denver with a firearm?",
  "Can I bring scissors on my flight to Seattle?",
  "Where can I get TSA guidance for ammunition?",
  "Can I fly with pew pews?",
]) assert.equal(isFlightLookupRequest(prompt), false, prompt);
for (const prompt of [
  "Atlanta to Seattle",
  "Find flights from Atlanta to Denver",
  "Business class flights from JFK to LHR",
  "Show the calendar",
]) assert.equal(isFlightLookupRequest(prompt), true, prompt);
assert.equal(isFlightLookupRequest("Hello"), false);
"""
    subprocess.run(["node", "-e", helpers + checks], check=True, capture_output=True, text=True)
