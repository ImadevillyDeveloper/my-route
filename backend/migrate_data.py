"""One-off: load migration_data.json (dumped from the local SQLite DB) into
the Postgres DB configured via DATABASE_URL. Run once from the Render Shell:

    python -m backend.migrate_data

Safe to re-run: it wipes existing rows in each target table first.
"""
import json
import os
import sys
from datetime import date, datetime

from sqlalchemy import create_engine, text

from . import models

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migration_data.json")


def _restore(v):
    if isinstance(v, dict) and "__type__" in v:
        if v["__type__"] == "datetime":
            return datetime.fromisoformat(v["value"])
        if v["__type__"] == "date":
            return date.fromisoformat(v["value"])
    return v


def main():
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        sys.exit("DATABASE_URL is not set in this environment — aborting.")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        dump = json.load(f)

    engine = create_engine(db_url, pool_pre_ping=True)
    tables = models.Base.metadata.sorted_tables

    with engine.begin() as conn:
        # Wipe existing rows, children first (reverse FK order)
        for t in reversed(tables):
            conn.execute(t.delete())

        # Insert dumped rows, parents first (FK order)
        for t in tables:
            rows = dump.get(t.name, [])
            if not rows:
                continue
            clean_rows = [{k: _restore(v) for k, v in row.items()} for row in rows]
            conn.execute(t.insert(), clean_rows)
            print(f"{t.name}: inserted {len(clean_rows)} rows")

        # Reset autoincrement sequences so future inserts don't collide with migrated IDs
        for t in tables:
            pk_cols = [c for c in t.primary_key.columns if c.autoincrement]
            for c in pk_cols:
                conn.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{t.name}', '{c.name}'), "
                    f"COALESCE((SELECT MAX({c.name}) FROM {t.name}), 1), "
                    f"(SELECT MAX({c.name}) FROM {t.name}) IS NOT NULL)"
                ))

    print("Migration complete.")


if __name__ == "__main__":
    main()
