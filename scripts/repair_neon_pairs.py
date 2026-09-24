from __future__ import annotations

import csv
import hashlib
import os
import re
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterator, Sequence

import psycopg
from psycopg import sql


@dataclass(frozen=True)
class RepairSpec:
    system_id: int
    name: str
    filename: str
    expected_rows: int
    source_columns: tuple[str, ...]
    target_columns: tuple[str, ...]
    target_types: tuple[str, ...]
    sha256: str
    row_transform: Callable[[list[str]], Sequence[object | None]]
    remote_url: str
    remote_git_blob_sha1: str
    remote_size: int


def _identity(row: list[str]) -> Sequence[object | None]:
    return row


def _healthcare(row: list[str]) -> Sequence[object | None]:
    out: list[object | None] = list(row)
    out[1] = datetime.strptime(row[1], "%d/%m/%Y").date().isoformat()
    out[2] = datetime.strptime(row[2], "%I:%M:%S %p").time().isoformat()
    out[5] = int(row[5])
    out[9] = int(row[9]) if row[9].strip() else None
    out[10] = int(row[10])
    return out


def _retail(row: list[str]) -> Sequence[object | None]:
    out: list[object | None] = list(row)
    out[10] = int(row[10])
    return out


def _aviation(row: list[str]) -> Sequence[object | None]:
    return [row[0], row[1], *[value if value.strip() else None for value in row[2:]]]


REPAIRS: dict[int, RepairSpec] = {
    2: RepairSpec(
        system_id=2,
        name="environmental_operations",
        filename="iot_telemetry_data.csv",
        expected_rows=405184,
        source_columns=("ts", "device", "co", "humidity", "light", "lpg", "motion", "smoke", "temp"),
        target_columns=("ts", "device", "co", "humidity", "light", "lpg", "motion", "smoke", "temp"),
        target_types=(
            "double precision", "text", "double precision", "double precision", "boolean",
            "double precision", "boolean", "double precision", "double precision",
        ),
        sha256="811ffbf210c8c454f328b95f7e8affc0ce031fdee927a8dfb76035b7e3334287",
        row_transform=_identity,
        remote_url="https://raw.githubusercontent.com/nadamamdouh2024/IoT-Sensor-Data-Analysis/main/iot_telemetry_data.csv",
        remote_git_blob_sha1="fc3101c0b4e0ac39fdffa4a815e6fbb429ea658a",
        remote_size=61926558,
    ),
    3: RepairSpec(
        system_id=3,
        name="healthcare",
        filename="healthcare_analytics_patient_flow_data.csv",
        expected_rows=9216,
        source_columns=(
            "Patient Id", "Patient Admission Date", "Patient Admission Time", "Merged",
            "Patient Gender", "Patient Age", "Patient Race", "Department Referral",
            "Patient Admission Flag", "Patient Satisfaction Score", "Patient Waittime",
        ),
        target_columns=(
            "patient_id", "patient_admission_date", "patient_admission_time", "merged",
            "patient_gender", "patient_age", "patient_race", "department_referral",
            "patient_admission_flag", "patient_satisfaction_score", "patient_waittime",
        ),
        target_types=(
            "text", "timestamp without time zone", "text", "text", "text", "integer",
            "text", "text", "text", "integer", "integer",
        ),
        sha256="2707a1eba258b6b37c356cd08f3ae863d7451ce8699794e32a6d89f77003ad7b",
        row_transform=_healthcare,
        remote_url="https://raw.githubusercontent.com/Vinay-ctrl2001/Healthcare-Patient-Insights/316055deb451e8f30b13214f41babface721ebcc/healthcare_analytics_patient_flow_data.csv",
        remote_git_blob_sha1="da8f2a28c1aeb0e22cf1de8eb45a8f6bc5feee85",
        remote_size=864047,
    ),
    4: RepairSpec(
        system_id=4,
        name="retail",
        filename="SampleSuperstore.csv",
        expected_rows=9994,
        source_columns=(
            "Ship Mode", "Segment", "Country", "City", "State", "Postal Code", "Region",
            "Category", "Sub-Category", "Sales", "Quantity", "Discount", "Profit",
        ),
        target_columns=(
            "ship_mode", "segment", "country", "city", "state", "postal_code", "region",
            "category", "sub-category", "sales", "quantity", "discount", "profit",
        ),
        target_types=(
            "text", "text", "text", "text", "text", "integer", "text", "text", "text",
            "json", "integer", "json", "json",
        ),
        sha256="ce8db84b6b049b19177ecdc43e46f8da6ce9c3d1784da4bf5dcf597c8b763611",
        row_transform=_retail,
        remote_url="https://raw.githubusercontent.com/tejas-95/SuperStore_Analysis/main/SampleSuperstore.csv",
        remote_git_blob_sha1="a555609e8349264d57ac063b55246c1d328d121b",
        remote_size=1113007,
    ),
    5: RepairSpec(
        system_id=5,
        name="aviation",
        filename="Passengers carried.csv.xls",
        expected_rows=266,
        source_columns=("Country Name", "Country Code", *tuple(str(year) for year in range(1970, 2021))),
        target_columns=("Country Name", "Country Code", *tuple(str(year) for year in range(1970, 2021))),
        target_types=("text", "text", *("double precision" for _ in range(1970, 2021))),
        sha256="6bab1d68ca0192d2e689963c8429f1e4ff85ec1720a16ba0c4e835c35f910c64",
        row_transform=_aviation,
        remote_url="https://raw.githubusercontent.com/MainakRepositor/Datasets/f20fd12b065e2aa8d4ee436e984d275655b2de50/Aviation%20History.csv",
        remote_git_blob_sha1="04c6b692eddd0c32135331328e7eb026efff63b0",
        remote_size=86374,
    ),
}


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _git_blob_sha1(path: Path) -> str:
    size = path.stat().st_size
    digest = hashlib.sha1()
    digest.update(f"blob {size}\0".encode("ascii"))
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_verified(spec: RepairSpec, destination: Path) -> None:
    request = urllib.request.Request(
        spec.remote_url,
        headers={"User-Agent": "Agentic-Arena-repair/1.0"},
    )
    with urllib.request.urlopen(request, timeout=180) as response, destination.open("wb") as out:
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            out.write(block)

    if destination.stat().st_size != spec.remote_size:
        raise RuntimeError(f"{spec.name}: remote size verification failed")
    if _git_blob_sha1(destination) != spec.remote_git_blob_sha1:
        raise RuntimeError(f"{spec.name}: remote Git blob verification failed")
    if _sha256_file(destination) != spec.sha256:
        raise RuntimeError(f"{spec.name}: remote SHA-256 verification failed")


def _iter_rows(spec: RepairSpec, path: Path) -> Iterator[Sequence[object | None]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        if tuple(header) != spec.source_columns:
            raise RuntimeError(f"{spec.name}: source header does not match the verified schema")
        for row_number, row in enumerate(reader, start=2):
            if len(row) != len(spec.source_columns):
                raise RuntimeError(
                    f"{spec.name}: row {row_number} has {len(row)} fields, expected {len(spec.source_columns)}"
                )
            yield spec.row_transform(row)


def _safe_suffix(raw: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_]+", "_", raw).strip("_").lower()
    if not cleaned:
        raise RuntimeError("REPAIR_RUN_ID must contain letters or numbers")
    return cleaned[:20]


def _table_exists(cursor: psycopg.Cursor[object], table_name: str) -> bool:
    cursor.execute("SELECT to_regclass(%s)", (f"source.{table_name}",))
    row = cursor.fetchone()
    return bool(row and row[0] is not None)


def _create_repair_table(
    cursor: psycopg.Cursor[object],
    spec: RepairSpec,
    staging_table: str,
) -> None:
    if _table_exists(cursor, staging_table):
        raise RuntimeError(f"{spec.name}: staging table already exists: source.{staging_table}")

    columns = []
    for name, type_name in zip(spec.target_columns, spec.target_types, strict=True):
        columns.append(
            sql.SQL("{} {}").format(
                sql.Identifier(name),
                sql.SQL(type_name),
            )
        )
    statement = sql.SQL("CREATE TABLE {}.{} ({})").format(
        sql.Identifier("source"),
        sql.Identifier(staging_table),
        sql.SQL(", ").join(columns),
    )
    cursor.execute("CREATE SCHEMA IF NOT EXISTS source")
    cursor.execute(statement)


def _fingerprint(
    cursor: psycopg.Cursor[object],
    table_name: str,
) -> tuple[int, str, str]:
    statement = sql.SQL(
        """
        SELECT
            count(*)::bigint,
            coalesce(sum(hashtextextended(row_to_json(t)::text, 0)::numeric), 0)::text,
            coalesce(sum(hashtextextended(row_to_json(t)::text, 1)::numeric), 0)::text
        FROM {}.{} AS t
        """
    ).format(sql.Identifier("source"), sql.Identifier(table_name))
    cursor.execute(statement)
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError("fingerprint query returned no row")
    return int(row[0]), str(row[1]), str(row[2])


def _load_target(
    spec: RepairSpec,
    path: Path,
    database_url: str,
    run_suffix: str,
) -> tuple[psycopg.Connection[object], str, tuple[int, str, str]]:
    connection: psycopg.Connection[object] = psycopg.connect(database_url, connect_timeout=10)
    staging_table = f"source_data_repair_{run_suffix}_{spec.system_id:02d}"
    try:
        with connection.cursor() as cursor:
            _create_repair_table(cursor, spec, staging_table)
            column_sql = sql.SQL(", ").join(sql.Identifier(column) for column in spec.target_columns)
            copy_statement = sql.SQL("COPY {}.{} ({}) FROM STDIN").format(
                sql.Identifier("source"),
                sql.Identifier(staging_table),
                column_sql,
            )
            loaded = 0
            with cursor.copy(copy_statement) as copy:
                for row in _iter_rows(spec, path):
                    copy.write_row(row)
                    loaded += 1

            if loaded != spec.expected_rows:
                raise RuntimeError(
                    f"{spec.name}: parsed {loaded} rows, expected {spec.expected_rows}"
                )
            fingerprint = _fingerprint(cursor, staging_table)
            if fingerprint[0] != spec.expected_rows:
                raise RuntimeError(
                    f"{spec.name}: staged table contains {fingerprint[0]} rows, expected {spec.expected_rows}"
                )
        return connection, staging_table, fingerprint
    except Exception:
        connection.rollback()
        connection.close()
        raise


def _swap_repaired_table(
    connection: psycopg.Connection[object],
    staging_table: str,
    backup_table: str,
) -> None:
    with connection.cursor() as cursor:
        if _table_exists(cursor, backup_table):
            raise RuntimeError(f"backup table already exists: source.{backup_table}")
        if _table_exists(cursor, "source_data"):
            cursor.execute(
                sql.SQL("ALTER TABLE {}.{} RENAME TO {}").format(
                    sql.Identifier("source"),
                    sql.Identifier("source_data"),
                    sql.Identifier(backup_table),
                )
            )
        cursor.execute(
            sql.SQL("ALTER TABLE {}.{} RENAME TO {}").format(
                sql.Identifier("source"),
                sql.Identifier(staging_table),
                sql.Identifier("source_data"),
            )
        )


def _repair_pair(spec: RepairSpec, path: Path, run_suffix: str) -> None:
    gov_key = f"DB_AGENTIC_GOV_{spec.system_id:02d}"
    ungov_key = f"DB_AGENTIC_UNGOV_{spec.system_id:02d}"
    gov_url = os.getenv(gov_key)
    ungov_url = os.getenv(ungov_key)
    if not gov_url or not ungov_url:
        raise RuntimeError(f"{spec.name}: {gov_key}/{ungov_key} must both be configured")

    connections: list[psycopg.Connection[object]] = []
    try:
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix=f"repair-{spec.system_id:02d}") as pool:
            gov_future = pool.submit(_load_target, spec, path, gov_url, run_suffix)
            ungov_future = pool.submit(_load_target, spec, path, ungov_url, run_suffix)
            gov_connection, gov_staging, gov_fingerprint = gov_future.result()
            connections.append(gov_connection)
            ungov_connection, ungov_staging, ungov_fingerprint = ungov_future.result()
            connections.append(ungov_connection)

        if gov_fingerprint != ungov_fingerprint:
            raise RuntimeError(f"{spec.name}: governed/ungoverned staged fingerprints differ")

        backup_table = f"source_data_backup_{run_suffix}_{spec.system_id:02d}"
        _swap_repaired_table(gov_connection, gov_staging, backup_table)
        _swap_repaired_table(ungov_connection, ungov_staging, backup_table)

        for connection in connections:
            connection.commit()

        print(
            f"REPAIR_PAIR_{spec.system_id:02d}_OK domain={spec.name} "
            f"rows={gov_fingerprint[0]} fingerprint={gov_fingerprint[1]}:{gov_fingerprint[2]} "
            f"backup={backup_table}",
            flush=True,
        )
    except Exception:
        for connection in connections:
            try:
                connection.rollback()
            except Exception:
                pass
        raise
    finally:
        for connection in connections:
            try:
                connection.close()
            except Exception:
                pass


def _selected_specs() -> tuple[RepairSpec, ...]:
    raw = os.getenv("REPAIR_ONLY", "").strip()
    if not raw:
        raise RuntimeError("REPAIR_ONLY is required; example: REPAIR_ONLY=2,3,4,5")
    requested = {int(token.strip()) for token in raw.split(",") if token.strip()}
    unknown = requested - set(REPAIRS)
    if unknown:
        raise RuntimeError(f"unsupported repair system ids: {sorted(unknown)}")
    return tuple(REPAIRS[system_id] for system_id in sorted(requested))


def main() -> None:
    run_id = os.getenv("REPAIR_RUN_ID", "").strip()
    if not run_id:
        raise RuntimeError("REPAIR_RUN_ID is required")
    run_suffix = _safe_suffix(run_id)
    specs = _selected_specs()

    print(
        f"REPAIR_START run_id={run_suffix} systems={','.join(str(spec.system_id) for spec in specs)}",
        flush=True,
    )

    with tempfile.TemporaryDirectory(prefix="agentic-arena-repair-") as temp:
        root = Path(temp)
        for spec in specs:
            path = root / spec.filename
            print(f"REPAIR_PAIR_{spec.system_id:02d}_DOWNLOAD domain={spec.name}", flush=True)
            _download_verified(spec, path)
            print(f"REPAIR_PAIR_{spec.system_id:02d}_LOAD domain={spec.name}", flush=True)
            _repair_pair(spec, path, run_suffix)

    print(f"REPAIR_COMPLETE run_id={run_suffix}", flush=True)


if __name__ == "__main__":
    main()
