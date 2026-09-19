import hashlib
import hmac
import json
import os
import re
from copy import deepcopy
from dataclasses import dataclass
from typing import Any


INTEGRITY_VERSION = "1"
HASH_ALGORITHM = "SHA-256"
MAC_ALGORITHM = "HMAC-SHA256"
GENESIS_HASH = "0" * 64

HMAC_KEY_ENV = "AGENTIC_AUDIT_HMAC_KEY"
HMAC_KEY_ID_ENV = "AGENTIC_AUDIT_HMAC_KEY_ID"

_HEX_64 = re.compile(r"^[0-9a-f]{64}$")


class IntegrityConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class IntegrityVerification:
    valid: bool
    errors: tuple[str, ...]
    event_hash: str | None
    sequence: int | None

    def to_dict(self) -> dict[str, object]:
        return {
            "valid": self.valid,
            "errors": list(self.errors),
            "event_hash": self.event_hash,
            "sequence": self.sequence,
        }


def canonical_json_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
        default=str,
    ).encode("utf-8")


def sha256_hex(value: bytes | str) -> str:
    payload = value.encode("utf-8") if isinstance(value, str) else value
    return hashlib.sha256(payload).hexdigest()


def integrity_configured() -> bool:
    try:
        active_signing_material()
        return True
    except IntegrityConfigurationError:
        return False


def active_signing_material() -> tuple[str, bytes]:
    key_text = os.getenv(HMAC_KEY_ENV, "").strip()
    if not key_text:
        raise IntegrityConfigurationError(f"{HMAC_KEY_ENV} is not configured")

    if len(key_text) % 2 == 0 and re.fullmatch(r"[0-9a-fA-F]+", key_text):
        try:
            key = bytes.fromhex(key_text)
        except ValueError as exc:
            raise IntegrityConfigurationError(f"{HMAC_KEY_ENV} is invalid") from exc
    else:
        key = key_text.encode("utf-8")

    if len(key) < 32:
        raise IntegrityConfigurationError(
            f"{HMAC_KEY_ENV} must contain at least 256 bits of key material"
        )

    key_id = os.getenv(HMAC_KEY_ID_ENV, "v1").strip() or "v1"
    if len(key_id) > 128:
        raise IntegrityConfigurationError(f"{HMAC_KEY_ID_ENV} is too long")
    return key_id, key


def integrity_self_test() -> bool:
    try:
        key_id, master_key = active_signing_material()
        record: dict[str, object] = {
            "run_id": "integrity-self-test",
            "schema_version": "self-test",
            "execution": {"governance": "governed", "operation": "integrity.self_test"},
        }
        record["integrity"] = build_integrity_envelope(
            record,
            governance="governed",
            previous_event_hash=GENESIS_HASH,
            sequence=1,
            key_id=key_id,
            master_key=master_key,
        )
        result = verify_integrity_record(
            record,
            governance="governed",
            expected_previous_hash=GENESIS_HASH,
            expected_sequence=1,
            key_id=key_id,
            master_key=master_key,
        )
        return result.valid
    except (IntegrityConfigurationError, TypeError, ValueError):
        return False


def _purpose_key(master_key: bytes, governance: str) -> bytes:
    purpose = f"agentic-arena:audit:{governance}:v1".encode("utf-8")
    return hmac.new(master_key, purpose, hashlib.sha256).digest()


def _payload_without_integrity(record: dict[str, Any]) -> dict[str, Any]:
    payload = deepcopy(record)
    payload.pop("integrity", None)
    return payload


def _validate_hash(value: object, *, field: str) -> str:
    if not isinstance(value, str) or not _HEX_64.fullmatch(value):
        raise ValueError(f"{field} must be a lowercase SHA-256 hex digest")
    return value


def _chain_material(
    *,
    governance: str,
    run_id: str,
    sequence: int,
    key_id: str,
    payload_sha256: str,
    previous_event_hash: str,
) -> bytes:
    return canonical_json_bytes(
        {
            "version": INTEGRITY_VERSION,
            "governance": governance,
            "run_id": run_id,
            "sequence": sequence,
            "key_id": key_id,
            "payload_sha256": payload_sha256,
            "previous_event_hash": previous_event_hash,
        }
    )


def audit_lock_id(governance: str) -> int:
    digest = hashlib.sha256(
        f"agentic-arena:audit-lock:{governance}:v1".encode("utf-8")
    ).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=True)


def build_integrity_envelope(
    record: dict[str, Any],
    *,
    governance: str,
    previous_event_hash: str = GENESIS_HASH,
    sequence: int = 1,
    key_id: str | None = None,
    master_key: bytes | None = None,
) -> dict[str, object]:
    if sequence < 1:
        raise ValueError("sequence must be at least 1")

    previous_event_hash = _validate_hash(
        previous_event_hash,
        field="previous_event_hash",
    )

    run_id_value = record.get("run_id")
    if not isinstance(run_id_value, str) or not run_id_value:
        raise ValueError("record run_id is required")
    run_id = run_id_value

    if key_id is None or master_key is None:
        configured_key_id, configured_key = active_signing_material()
        key_id = key_id or configured_key_id
        master_key = master_key or configured_key

    payload = _payload_without_integrity(record)
    payload_sha256 = sha256_hex(canonical_json_bytes(payload))

    chain_material = _chain_material(
        governance=governance,
        run_id=run_id,
        sequence=sequence,
        key_id=key_id,
        payload_sha256=payload_sha256,
        previous_event_hash=previous_event_hash,
    )
    event_hash = sha256_hex(chain_material)
    signature = hmac.new(
        _purpose_key(master_key, governance),
        event_hash.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()

    return {
        "version": INTEGRITY_VERSION,
        "hash_algorithm": HASH_ALGORITHM,
        "mac_algorithm": MAC_ALGORITHM,
        "key_id": key_id,
        "chain_id": f"agentic-arena:{governance}:v1",
        "sequence": sequence,
        "payload_sha256": payload_sha256,
        "previous_event_hash": previous_event_hash,
        "event_hash": event_hash,
        "hmac_sha256": signature,
    }


def verify_integrity_record(
    record: dict[str, Any],
    *,
    governance: str,
    expected_previous_hash: str | None = None,
    expected_sequence: int | None = None,
    key_id: str | None = None,
    master_key: bytes | None = None,
) -> IntegrityVerification:
    errors: list[str] = []
    envelope = record.get("integrity")
    if not isinstance(envelope, dict):
        return IntegrityVerification(False, ("missing_integrity_envelope",), None, None)

    sequence_value = envelope.get("sequence")
    sequence = sequence_value if isinstance(sequence_value, int) else None
    event_hash_value = envelope.get("event_hash")
    event_hash = event_hash_value if isinstance(event_hash_value, str) else None

    if envelope.get("version") != INTEGRITY_VERSION:
        errors.append("unsupported_integrity_version")
    if envelope.get("hash_algorithm") != HASH_ALGORITHM:
        errors.append("unexpected_hash_algorithm")
    if envelope.get("mac_algorithm") != MAC_ALGORITHM:
        errors.append("unexpected_mac_algorithm")
    if envelope.get("chain_id") != f"agentic-arena:{governance}:v1":
        errors.append("chain_id_mismatch")
    if sequence is None or sequence < 1:
        errors.append("invalid_sequence")

    run_id_value = record.get("run_id")
    if not isinstance(run_id_value, str) or not run_id_value:
        errors.append("missing_run_id")
        run_id = ""
    else:
        run_id = run_id_value

    stored_key_id = envelope.get("key_id")
    if not isinstance(stored_key_id, str) or not stored_key_id:
        errors.append("missing_key_id")
        stored_key_id = ""

    if key_id is None or master_key is None:
        try:
            configured_key_id, configured_key = active_signing_material()
        except IntegrityConfigurationError:
            errors.append("signing_key_unavailable")
            configured_key_id = ""
            configured_key = b""
        key_id = key_id or configured_key_id
        master_key = master_key or configured_key

    if stored_key_id != key_id:
        errors.append("key_id_mismatch")

    previous_value = envelope.get("previous_event_hash")
    previous_hash = previous_value if isinstance(previous_value, str) else ""
    if not _HEX_64.fullmatch(previous_hash):
        errors.append("invalid_previous_event_hash")

    if expected_previous_hash is not None and previous_hash != expected_previous_hash:
        errors.append("previous_event_hash_mismatch")

    if expected_sequence is not None and sequence != expected_sequence:
        errors.append("sequence_mismatch")

    payload = _payload_without_integrity(record)
    calculated_payload_hash = sha256_hex(canonical_json_bytes(payload))
    stored_payload_hash = envelope.get("payload_sha256")
    if not isinstance(stored_payload_hash, str) or not hmac.compare_digest(
        stored_payload_hash,
        calculated_payload_hash,
    ):
        errors.append("payload_hash_mismatch")

    if (
        sequence is not None
        and sequence >= 1
        and run_id
        and stored_key_id
        and _HEX_64.fullmatch(previous_hash)
        and isinstance(stored_payload_hash, str)
        and _HEX_64.fullmatch(stored_payload_hash)
    ):
        calculated_event_hash = sha256_hex(
            _chain_material(
                governance=governance,
                run_id=run_id,
                sequence=sequence,
                key_id=stored_key_id,
                payload_sha256=stored_payload_hash,
                previous_event_hash=previous_hash,
            )
        )
        if not isinstance(event_hash_value, str) or not hmac.compare_digest(
            event_hash_value,
            calculated_event_hash,
        ):
            errors.append("event_hash_mismatch")

        stored_signature = envelope.get("hmac_sha256")
        if (
            master_key
            and stored_key_id == key_id
            and isinstance(event_hash_value, str)
            and _HEX_64.fullmatch(event_hash_value)
        ):
            calculated_signature = hmac.new(
                _purpose_key(master_key, governance),
                event_hash_value.encode("ascii"),
                hashlib.sha256,
            ).hexdigest()
            if not isinstance(stored_signature, str) or not hmac.compare_digest(
                stored_signature,
                calculated_signature,
            ):
                errors.append("hmac_mismatch")
        elif "signing_key_unavailable" not in errors and "key_id_mismatch" not in errors:
            errors.append("invalid_hmac_input")
    else:
        errors.append("invalid_chain_material")

    return IntegrityVerification(
        valid=not errors,
        errors=tuple(dict.fromkeys(errors)),
        event_hash=event_hash,
        sequence=sequence,
    )
