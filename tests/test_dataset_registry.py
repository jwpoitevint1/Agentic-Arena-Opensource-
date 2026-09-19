import pytest

from app.datasets import dataset_for_system, datasets


EXPECTED = {
    1: ("finance", "synthetic", "5k", "Synthetic Finance 5K"),
    2: ("environmental_operations", "open_dataset", "environmental_iot_telemetry", "Environmental IoT Telemetry"),
    3: ("healthcare", "open_dataset", "healthcare_patient_flow", "Healthcare Patient Flow"),
    4: ("retail", "open_dataset", "sample_superstore", "Sample Superstore"),
    5: ("aviation", "open_dataset", "passengers_carried_1970_2020", "Passengers Carried 1970-2020"),
    6: ("supply_chain", "synthetic", "logistics_shipments", "Logistics Shipments"),
}


def test_dataset_registry_has_six_systems() -> None:
    items = datasets()
    assert len(items) == 6
    assert [item.system_id for item in items] == [1, 2, 3, 4, 5, 6]


@pytest.mark.parametrize("system_id", [1, 2, 3, 4, 5, 6])
def test_dataset_registry_matches_loaded_sources(system_id: int) -> None:
    item = dataset_for_system(system_id)
    domain, source, dataset_id, display_name = EXPECTED[system_id]
    assert item.domain == domain
    assert item.source == source
    assert item.dataset_id == dataset_id
    assert item.display_name == display_name
    assert item.kaggle_slug == dataset_id
    assert item.url is None


def test_registry_does_not_claim_unverified_kaggle_provenance() -> None:
    for item in datasets():
        assert item.source != "kaggle"
        assert item.url is None


def test_unknown_system_is_rejected() -> None:
    with pytest.raises(KeyError):
        dataset_for_system(7)
