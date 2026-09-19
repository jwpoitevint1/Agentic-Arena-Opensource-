import os
from dataclasses import dataclass

import psycopg

from app.execution import DatabaseTarget


_ENV_BY_TARGET: dict[DatabaseTarget, str] = {
    DatabaseTarget.AGENTIC_GOV_01: "DB_AGENTIC_GOV_01",
    DatabaseTarget.AGENTIC_GOV_02: "DB_AGENTIC_GOV_02",
    DatabaseTarget.AGENTIC_GOV_03: "DB_AGENTIC_GOV_03",
    DatabaseTarget.AGENTIC_GOV_04: "DB_AGENTIC_GOV_04",
    DatabaseTarget.AGENTIC_GOV_05: "DB_AGENTIC_GOV_05",
    DatabaseTarget.AGENTIC_GOV_06: "DB_AGENTIC_GOV_06",
    DatabaseTarget.AGENTIC_UNGOV_01: "DB_AGENTIC_UNGOV_01",
    DatabaseTarget.AGENTIC_UNGOV_02: "DB_AGENTIC_UNGOV_02",
    DatabaseTarget.AGENTIC_UNGOV_03: "DB_AGENTIC_UNGOV_03",
    DatabaseTarget.AGENTIC_UNGOV_04: "DB_AGENTIC_UNGOV_04",
    DatabaseTarget.AGENTIC_UNGOV_05: "DB_AGENTIC_UNGOV_05",
    DatabaseTarget.AGENTIC_UNGOV_06: "DB_AGENTIC_UNGOV_06",
}


@dataclass(frozen=True)
class DatabaseRegistration:
    target: DatabaseTarget
    env_var: str
    configured: bool


def database_env_var(target: DatabaseTarget) -> str:
    return _ENV_BY_TARGET[target]


def database_url(target: DatabaseTarget) -> str | None:
    return os.getenv(database_env_var(target))


def registrations() -> list[DatabaseRegistration]:
    return [
        DatabaseRegistration(
            target=target,
            env_var=env_var,
            configured=bool(os.getenv(env_var)),
        )
        for target, env_var in _ENV_BY_TARGET.items()
    ]


def all_databases_configured() -> bool:
    return all(item.configured for item in registrations())


def probe_database(target: DatabaseTarget, timeout_seconds: int = 3) -> bool:
    url = database_url(target)
    if not url:
        return False

    try:
        with psycopg.connect(url, connect_timeout=timeout_seconds) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                return cursor.fetchone() == (1,)
    except psycopg.Error:
        return False
