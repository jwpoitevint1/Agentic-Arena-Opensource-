from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class DatasetDefinition:
    system_id: int
    domain: str
    source: str
    dataset_id: str
    display_name: str
    url: str | None = None

    @property
    def kaggle_slug(self) -> str:
        """Backward-compatible identifier used by existing telemetry/UI code."""
        return self.dataset_id

    def to_dict(self) -> dict[str, int | str | None]:
        return asdict(self)


_DATASETS: dict[int, DatasetDefinition] = {
    1: DatasetDefinition(
        system_id=1,
        domain="finance",
        source="synthetic",
        dataset_id="5k",
        display_name="Synthetic Finance 5K",
    ),
    2: DatasetDefinition(
        system_id=2,
        domain="environmental_operations",
        source="open_dataset",
        dataset_id="environmental_iot_telemetry",
        display_name="Environmental IoT Telemetry",
    ),
    3: DatasetDefinition(
        system_id=3,
        domain="healthcare",
        source="open_dataset",
        dataset_id="healthcare_patient_flow",
        display_name="Healthcare Patient Flow",
    ),
    4: DatasetDefinition(
        system_id=4,
        domain="retail",
        source="open_dataset",
        dataset_id="sample_superstore",
        display_name="Sample Superstore",
    ),
    5: DatasetDefinition(
        system_id=5,
        domain="aviation",
        source="open_dataset",
        dataset_id="passengers_carried_1970_2020",
        display_name="Passengers Carried 1970-2020",
    ),
    6: DatasetDefinition(
        system_id=6,
        domain="supply_chain",
        source="synthetic",
        dataset_id="logistics_shipments",
        display_name="Logistics Shipments",
    ),
}


def dataset_for_system(system_id: int) -> DatasetDefinition:
    if system_id not in _DATASETS:
        raise KeyError(f"unknown system_id: {system_id}")
    return _DATASETS[system_id]


def datasets() -> list[DatasetDefinition]:
    return [_DATASETS[system_id] for system_id in sorted(_DATASETS)]
