"""Add prompt/response evidence columns to both Agentic Arena recording databases.

This migration is idempotent. It does not expose connection strings and it preserves
the existing signed JSONB record as the source of truth.
"""

import os

import psycopg


DATABASES = {
    "governed": "DB_LOG_AGENTIC_GOV",
    "ungoverned": "DB_LOG_AGENTIC_UNGOV",
}

MIGRATION_STATEMENTS = (
    """
    ALTER TABLE telemetry.agentic_runs
        ADD COLUMN IF NOT EXISTS prompt_text text,
        ADD COLUMN IF NOT EXISTS model_response text
    """,
    """
    UPDATE telemetry.agentic_runs
    SET model_response = record #>> '{output,text}'
    WHERE model_response IS NULL
      AND record #>> '{output,text}' IS NOT NULL
    """,
    """
    UPDATE telemetry.agentic_runs
    SET prompt_text = record #>> '{input,prompt_text}'
    WHERE prompt_text IS NULL
      AND record #>> '{input,prompt_text}' IS NOT NULL
    """,
)


def migrate_database(governance: str, env_var: str) -> None:
    url = os.getenv(env_var)
    if not url:
        raise RuntimeError(f"{env_var} is not configured")

    with psycopg.connect(url, connect_timeout=5) as connection:
        with connection.cursor() as cursor:
            for statement in MIGRATION_STATEMENTS:
                cursor.execute(statement)
        connection.commit()

    print(f"agentic_run_text_migration governance={governance} status=ok")


def main() -> None:
    for governance, env_var in DATABASES.items():
        migrate_database(governance, env_var)


if __name__ == "__main__":
    main()
