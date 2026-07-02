"""One-off: load migration_data.json (dumped from the local SQLite DB) into
the Postgres DB configured via DATABASE_URL. Run once:

    python -m backend.migrate_data

Refuses to run if the target DB already has more than a handful of users —
this is meant for a fresh DB that only has the auto-seeded demo drivers,
not to clobber real data that's already been migrated.
"""
import json
import os
import sys
from datetime import date, datetime

from sqlalchemy import create_engine, text, Integer

from . import models

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migration_data.json")

# Guard against wiping a DB that already has real data — main.py's
# _seed_demo_drivers() creates at most 4 bare driver rows on a fresh DB.
MAX_EXISTING_USERS_TO_OVERWRITE = 4


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
        raise RuntimeError("DATABASE_URL is not set in this environment — aborting.")
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        dump = json.load(f)

    engine = create_engine(db_url, pool_pre_ping=True)
    tables = models.Base.metadata.sorted_tables

    with engine.begin() as conn:
        existing_users = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
        if existing_users > MAX_EXISTING_USERS_TO_OVERWRITE:
            raise RuntimeError(
                f"Refusing to run: users table already has {existing_users} rows "
                f"(> {MAX_EXISTING_USERS_TO_OVERWRITE}) — looks like real data, not just the demo seed."
            )

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

        # Reset autoincrement sequences so future inserts don't collide with migrated IDs.
        # Only integer PKs actually get a Postgres sequence — string PKs (e.g. route_number,
        # mr_id) have autoincrement="auto" by SQLAlchemy default but no real sequence to reset.
        for t in tables:
            pk_cols = [
                c for c in t.primary_key.columns
                if c.autoincrement and isinstance(c.type, Integer)
            ]
            for c in pk_cols:
                conn.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{t.name}', '{c.name}'), "
                    f"COALESCE((SELECT MAX({c.name}) FROM {t.name}), 1), "
                    f"(SELECT MAX({c.name}) FROM {t.name}) IS NOT NULL)"
                ))

    print("Migration complete.")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        sys.exit(str(e))
