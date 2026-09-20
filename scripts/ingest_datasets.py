from __future__ import annotations

import base64
import bz2
import csv
import hashlib
import os
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
class DatasetSpec:
    system_id: int
    name: str
    filename: str
    expected_rows: int
    columns: tuple[str, ...]
    sha256: str
    row_transform: Callable[[list[str]], Sequence[object | None]]
    target_columns: tuple[str, ...] | None = None
    remote_url: str | None = None
    remote_git_blob_sha1: str | None = None
    remote_size: int | None = None

    @property
    def database_columns(self) -> tuple[str, ...]:
        return self.target_columns or self.columns


def _strip_currency(value: str) -> str:
    return value.replace("$", "").replace(",", "").strip()


def _finance(row: list[str]) -> Sequence[object | None]:
    out: list[object | None] = list(row)
    for idx in (4, 6, 7, 8, 9, 10, 11, 12):
        out[idx] = _strip_currency(row[idx])
    out[0] = int(row[0])
    out[15] = int(row[15])
    out[16] = row[16].strip().removesuffix("%")
    return out


def _environmental(row: list[str]) -> Sequence[object | None]:
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


def _supply_chain(row: list[str]) -> Sequence[object | None]:
    out: list[object | None] = list(row)
    out[5] = row[5] if row[5].strip() else None
    out[7] = row[7] if row[7].strip() else None
    out[9] = int(row[9])
    out[10] = int(row[10])
    return out


DATASETS: tuple[DatasetSpec, ...] = (
    DatasetSpec(
        1,
        "finance",
        "5k.csv",
        5000,
        (
            "Age", "Occupation", "Risk Tolerance", "Investment Goals", "Income Level",
            "Address", "Account Balance", "Deposits", "Withdrawals", "Transfers",
            "International Transfers", "Investments", "Loan Amount", "Loan Purpose",
            "Employment Status", "Loan Term (Months)", "Interest Rate", "Loan Status",
            "Transaction Description",
        ),
        "401fdbfeaa81643814a9fa81a65dc0bfb8e29401cf36df025c6e9218af425fdd",
        _finance,
        target_columns=(
            "age", "occupation", "risk_tolerance", "investment_goals", "income_level",
            "address", "account_balance", "deposits", "withdrawals", "transfers",
            "international_transfers", "investments", "loan_amount", "loan_purpose",
            "employment_status", "loan_term_(months)", "interest_rate", "loan_status",
            "transaction_description",
        ),
    ),
    DatasetSpec(
        2,
        "environmental_operations",
        "iot_telemetry_data.csv",
        405184,
        ("ts", "device", "co", "humidity", "light", "lpg", "motion", "smoke", "temp"),
        "811ffbf210c8c454f328b95f7e8affc0ce031fdee927a8dfb76035b7e3334287",
        _environmental,
        remote_url="https://raw.githubusercontent.com/nadamamdouh2024/IoT-Sensor-Data-Analysis/main/iot_telemetry_data.csv",
        remote_git_blob_sha1="fc3101c0b4e0ac39fdffa4a815e6fbb429ea658a",
        remote_size=61926558,
    ),
    DatasetSpec(
        3,
        "healthcare",
        "healthcare_analytics_patient_flow_data.csv",
        9216,
        (
            "Patient Id", "Patient Admission Date", "Patient Admission Time", "Merged",
            "Patient Gender", "Patient Age", "Patient Race", "Department Referral",
            "Patient Admission Flag", "Patient Satisfaction Score", "Patient Waittime",
        ),
        "2707a1eba258b6b37c356cd08f3ae863d7451ce8699794e32a6d89f77003ad7b",
        _healthcare,
        target_columns=(
            "patient_id", "patient_admission_date", "patient_admission_time", "merged",
            "patient_gender", "patient_age", "patient_race", "department_referral",
            "patient_admission_flag", "patient_satisfaction_score", "patient_waittime",
        ),
        remote_url="https://raw.githubusercontent.com/Vinay-ctrl2001/Healthcare-Patient-Insights/316055deb451e8f30b13214f41babface721ebcc/healthcare_analytics_patient_flow_data.csv",
        remote_git_blob_sha1="da8f2a28c1aeb0e22cf1de8eb45a8f6bc5feee85",
        remote_size=864047,
    ),
    DatasetSpec(
        4,
        "retail",
        "SampleSuperstore.csv",
        9994,
        (
            "Ship Mode", "Segment", "Country", "City", "State", "Postal Code", "Region",
            "Category", "Sub-Category", "Sales", "Quantity", "Discount", "Profit",
        ),
        "ce8db84b6b049b19177ecdc43e46f8da6ce9c3d1784da4bf5dcf597c8b763611",
        _retail,
        target_columns=(
            "ship_mode", "segment", "country", "city", "state", "postal_code", "region",
            "category", "sub-category", "sales", "quantity", "discount", "profit",
        ),
        remote_url="https://raw.githubusercontent.com/tejas-95/SuperStore_Analysis/main/SampleSuperstore.csv",
        remote_git_blob_sha1="a555609e8349264d57ac063b55246c1d328d121b",
        remote_size=1113007,
    ),
    DatasetSpec(
        5,
        "aviation",
        "Passengers carried.csv.xls",
        266,
        ("Country Name", "Country Code", *tuple(str(year) for year in range(1970, 2021))),
        "6bab1d68ca0192d2e689963c8429f1e4ff85ec1720a16ba0c4e835c35f910c64",
        _aviation,
        remote_url="https://raw.githubusercontent.com/MainakRepositor/Datasets/f20fd12b065e2aa8d4ee436e984d275655b2de50/Aviation%20History.csv",
        remote_git_blob_sha1="04c6b692eddd0c32135331328e7eb026efff63b0",
        remote_size=86374,
    ),
    DatasetSpec(
        6,
        "supply_chain",
        "logistics_shipments_dataset.csv",
        2000,
        (
            "Shipment_ID", "Origin_Warehouse", "Destination", "Carrier", "Shipment_Date",
            "Delivery_Date", "Weight_kg", "Cost", "Status", "Distance_miles", "Transit_Days",
        ),
        "104b2895972bfa7859b740216411c104ad7832cd441885212fbabd202e620867",
        _supply_chain,
        remote_url="https://raw.githubusercontent.com/IamSaileshSitaula/eta-tracker/780824cd3835ec724be5e7a73eb9af32075f2b2f/data/logistics_shipments_dataset.csv",
        remote_git_blob_sha1="3764a7c34e35318624b214bce195c05edb3d0aaa",
        remote_size=175623,
    ),
)


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _git_blob_sha1(path: Path) -> str:
    size = path.stat().st_size
    h = hashlib.sha1()
    h.update(f"blob {size}\0".encode("ascii"))
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _download_verified(spec: DatasetSpec, destination: Path) -> None:
    if not spec.remote_url:
        raise RuntimeError(f"{spec.name}: no remote source configured")
    request = urllib.request.Request(
        spec.remote_url,
        headers={"User-Agent": "Agentic-Arena-ingest/1.0"},
    )
    with urllib.request.urlopen(request, timeout=180) as response, destination.open("wb") as out:
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            out.write(block)
    if spec.remote_size is not None and destination.stat().st_size != spec.remote_size:
        raise RuntimeError(f"{spec.name}: remote size verification failed")
    if spec.remote_git_blob_sha1 and _git_blob_sha1(destination) != spec.remote_git_blob_sha1:
        raise RuntimeError(f"{spec.name}: remote Git blob verification failed")
    if _sha256_file(destination) != spec.sha256:
        raise RuntimeError(f"{spec.name}: remote SHA-256 verification failed")


def _load_from_staging(run_id: str, dataset_key: str, destination: Path) -> None:
    staging_url = os.getenv("DB_INGEST_STAGING")
    if not staging_url:
        raise RuntimeError("DB_INGEST_STAGING is required for staged ingestion")
    with psycopg.connect(staging_url, connect_timeout=10) as connection, connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT payload_text
            FROM ingest_staging.payload_parts
            WHERE run_id = %s AND dataset_key = %s
            ORDER BY part_no
            """,
            (run_id, dataset_key),
        )
        parts = [str(row[0]) for row in cursor.fetchall()]
    if not parts:
        raise RuntimeError(f"{dataset_key}: staging payload is missing")
    compressed = base64.b64decode("".join(parts), validate=True)
    raw = bz2.decompress(compressed)
    destination.write_bytes(raw)


def _selected_specs() -> tuple[DatasetSpec, ...]:
    raw = os.getenv("INGEST_ONLY", "").strip()
    if not raw:
        return DATASETS
    requested: set[int] = set()
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        requested.add(int(token))
    selected = tuple(spec for spec in DATASETS if spec.system_id in requested)
    if not selected or {spec.system_id for spec in selected} != requested:
        raise RuntimeError(f"INGEST_ONLY contains an unknown system id: {raw}")
    return selected


def _staging_dataset_names() -> set[str]:
    raw = os.getenv("INGEST_STAGING_DATASETS", "").strip()
    names = {item.strip() for item in raw.split(",") if item.strip()}
    names.add("finance")
    return names


def _prepare_sources(root: Path, run_id: str, specs: Sequence[DatasetSpec]) -> dict[int, Path]:
    paths: dict[int, Path] = {}
    staged = _staging_dataset_names()
    for spec in specs:
        path = root / spec.filename
        if spec.name in staged:
            _load_from_staging(run_id, spec.name, path)
        else:
            _download_verified(spec, path)
        if _sha256_file(path) != spec.sha256:
            raise RuntimeError(f"{spec.name}: source SHA-256 verification failed")
        paths[spec.system_id] = path
    return paths


def _iter_rows(spec: DatasetSpec, path: Path) -> Iterator[Sequence[object | None]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader)
        if tuple(header) != spec.columns:
            raise RuntimeError(f"{spec.name}: header does not match the production schema")
        for row_number, row in enumerate(reader, start=2):
            if len(row) != len(spec.columns):
                raise RuntimeError(f"{spec.name}: row {row_number} has {len(row)} fields")
            yield spec.row_transform(row)


def _fingerprint(cursor: psycopg.Cursor[object]) -> tuple[int, str, str]:
    cursor.execute(
        """
        SELECT
            count(*)::bigint,
            coalesce(sum(hashtextextended(row_to_json(t)::text, 0)::numeric), 0)::text,
            coalesce(sum(hashtextextended(row_to_json(t)::text, 1)::numeric), 0)::text
        FROM source.source_data AS t
        """
    )
    row = cursor.fetchone()
    if row is None:
        raise RuntimeError("database fingerprint query returned no row")
    return int(row[0]), str(row[1]), str(row[2])


def _load_target(spec: DatasetSpec, path: Path, database_url: str) -> tuple[psycopg.Connection[object], tuple[int, str, str]]:
    connection: psycopg.Connection[object] = psycopg.connect(database_url, connect_timeout=10)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT count(*) FROM source.source_data")
            existing = int(cursor.fetchone()[0])
            if existing != 0:
                raise RuntimeError(f"{spec.name}: target is not empty ({existing} rows)")

            column_sql = sql.SQL(", ").join(
                sql.Identifier(column) for column in spec.database_columns
            )
            statement = sql.SQL("COPY source.source_data ({}) FROM STDIN").format(column_sql)
            loaded = 0
            with cursor.copy(statement) as copy:
                for row in _iter_rows(spec, path):
                    copy.write_row(row)
                    loaded += 1
            if loaded != spec.expected_rows:
                raise RuntimeError(
                    f"{spec.name}: parsed {loaded} rows, expected {spec.expected_rows}"
                )
            fingerprint = _fingerprint(cursor)
            if fingerprint[0] != spec.expected_rows:
                raise RuntimeError(
                    f"{spec.name}: database contains {fingerprint[0]} rows before commit"
                )
        return connection, fingerprint
    except Exception:
        connection.rollback()
        connection.close()
        raise


def _load_pair(spec: DatasetSpec, path: Path) -> None:
    gov_key = f"DB_AGENTIC_GOV_{spec.system_id:02d}"
    ungov_key = f"DB_AGENTIC_UNGOV_{spec.system_id:02d}"
    gov_url = os.getenv(gov_key)
    ungov_url = os.getenv(ungov_key)
    if not gov_url or not ungov_url:
        raise RuntimeError(f"{spec.name}: {gov_key}/{ungov_key} must both be configured")

    connections: list[psycopg.Connection[object]] = []
    try:
        with ThreadPoolExecutor(max_workers=2, thread_name_prefix=f"ingest-{spec.system_id:02d}") as pool:
            gov_future = pool.submit(_load_target, spec, path, gov_url)
            ungov_future = pool.submit(_load_target, spec, path, ungov_url)
            gov_connection, gov_fingerprint = gov_future.result()
            connections.append(gov_connection)
            ungov_connection, ungov_fingerprint = ungov_future.result()
            connections.append(ungov_connection)

        if gov_fingerprint != ungov_fingerprint:
            raise RuntimeError(f"{spec.name}: governed/ungoverned fingerprints differ")

        for connection in connections:
            connection.commit()
        print(
            f"PAIR_{spec.system_id:02d}_OK domain={spec.name} "
            f"rows={gov_fingerprint[0]} fingerprint={gov_fingerprint[1]}:{gov_fingerprint[2]}",
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


def main() -> None:
    run_id = os.getenv("INGEST_RUN_ID", "").strip()
    if not run_id:
        raise RuntimeError("INGEST_RUN_ID must be set for an intentional ingestion run")
    specs = _selected_specs()
    print(
        f"INGEST_START run_id={run_id} systems={','.join(str(spec.system_id) for spec in specs)}",
        flush=True,
    )

    with tempfile.TemporaryDirectory(prefix="agentic-arena-ingest-") as temp:
        root = Path(temp)
        sources = _prepare_sources(root, run_id, specs)
        for spec in specs:
            print(f"PAIR_{spec.system_id:02d}_START domain={spec.name}", flush=True)
            _load_pair(spec, sources[spec.system_id])

    print(f"INGEST_COMPLETE run_id={run_id}", flush=True)


if __name__ == "__main__":
    main()
