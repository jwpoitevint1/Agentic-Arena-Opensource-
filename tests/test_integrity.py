from copy import deepcopy

import pytest

from app.integrity import (
    GENESIS_HASH,
    IntegrityConfigurationError,
    active_signing_material,
    build_integrity_envelope,
    canonical_json_bytes,
    sha256_hex,
    verify_integrity_record,
)


MASTER_KEY = bytes.fromhex(
    "11" * 32
)


def _record(run_id: str = "run-1") -> dict[str, object]:
    return {
        "run_id": run_id,
        "schema_version": "1.1",
        "execution": {
            "governance": "governed",
            "operation": "governed_function.execute",
            "system_id": 4,
        },
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 20,
            "total_tokens": 120,
        },
    }


def test_canonical_json_and_sha256_are_stable() -> None:
    left = {"b": 2, "a": {"y": 2, "x": 1}}
    right = {"a": {"x": 1, "y": 2}, "b": 2}

    assert canonical_json_bytes(left) == canonical_json_bytes(right)
    assert sha256_hex(canonical_json_bytes(left)) == sha256_hex(
        canonical_json_bytes(right)
    )


def test_integrity_envelope_verifies() -> None:
    record = _record()
    record["integrity"] = build_integrity_envelope(
        record,
        governance="governed",
        previous_event_hash=GENESIS_HASH,
        sequence=1,
        key_id="test-v1",
        master_key=MASTER_KEY,
    )

    verified = verify_integrity_record(
        record,
        governance="governed",
        expected_previous_hash=GENESIS_HASH,
        expected_sequence=1,
        key_id="test-v1",
        master_key=MASTER_KEY,
    )

    assert verified.valid is True
    assert verified.errors == ()
    assert verified.sequence == 1
    assert isinstance(verified.event_hash, str)
    assert len(verified.event_hash) == 64


def test_payload_tampering_is_detected() -> None:
    record = _record()
    record["integrity"] = build_integrity_envelope(
        record,
        governance="governed",
        key_id="test-v1",
        master_key=MASTER_KEY,
    )

    tampered = deepcopy(record)
    tampered["usage"]["total_tokens"] = 999

    verified = verify_integrity_record(
        tampered,
        governance="governed",
        key_id="test-v1",
        master_key=MASTER_KEY,
    )

    assert verified.valid is False
    assert "payload_hash_mismatch" in verified.errors


def test_chain_linkage_is_verified() -> None:
    first = _record("run-1")
    first["integrity"] = build_integrity_envelope(
        first,
        governance="governed",
        sequence=1,
        key_id="test-v1",
        master_key=MASTER_KEY,
    )
    first_hash = first["integrity"]["event_hash"]

    second = _record("run-2")
    second["integrity"] = build_integrity_envelope(
        second,
        governance="governed",
        previous_event_hash=first_hash,
        sequence=2,
        key_id="test-v1",
        master_key=MASTER_KEY,
    )

    verified = verify_integrity_record(
        second,
        governance="governed",
        expected_previous_hash=first_hash,
        expected_sequence=2,
        key_id="test-v1",
        master_key=MASTER_KEY,
    )
    assert verified.valid is True

    broken = verify_integrity_record(
        second,
        governance="governed",
        expected_previous_hash=GENESIS_HASH,
        expected_sequence=2,
        key_id="test-v1",
        master_key=MASTER_KEY,
    )
    assert broken.valid is False
    assert "previous_event_hash_mismatch" in broken.errors


def test_governance_paths_are_domain_separated() -> None:
    governed = _record()
    governed["integrity"] = build_integrity_envelope(
        governed,
        governance="governed",
        key_id="test-v1",
        master_key=MASTER_KEY,
    )

    ungoverned = _record()
    ungoverned["integrity"] = build_integrity_envelope(
        ungoverned,
        governance="ungoverned",
        key_id="test-v1",
        master_key=MASTER_KEY,
    )

    assert governed["integrity"]["event_hash"] != ungoverned["integrity"]["event_hash"]
    assert (
        governed["integrity"]["hmac_sha256"]
        != ungoverned["integrity"]["hmac_sha256"]
    )


def test_short_environment_key_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AGENTIC_AUDIT_HMAC_KEY", "short")
    monkeypatch.setenv("AGENTIC_AUDIT_HMAC_KEY_ID", "test")

    with pytest.raises(IntegrityConfigurationError):
        active_signing_material()
