from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from sqlalchemy import text
from .database import engine, SQLALCHEMY_DATABASE_URL
from . import models
from .routers import auth, users, tracking, reports, routes, vehicles, repairs, salary, drivers, support
from .storage import UPLOAD_DIR as _UPLOAD_DIR, USE_SUPABASE as _USE_SUPABASE

models.Base.metadata.create_all(bind=engine)

# SQLite migrations — add columns that didn't exist in earlier versions.
# Only relevant for local SQLite files; a fresh Postgres DB already has the
# full schema from create_all(), and PRAGMA is SQLite-only syntax anyway.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    def _add_col(conn, table: str, col: str, col_type: str):
        cols = [row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))]
        if col not in cols:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
            conn.commit()

    with engine.connect() as conn:
        _add_col(conn, "reports",   "reviewed_at",   "DATETIME")
        _add_col(conn, "routes",    "owner_id",       "INTEGER")
        _add_col(conn, "vehicles",  "owner_id",       "INTEGER")
        _add_col(conn, "insurance", "kasko_end_date", "DATE")
        _add_col(conn, "users",        "vehicle_plate",     "VARCHAR")
        _add_col(conn, "users",        "route_number",      "VARCHAR")
        _add_col(conn, "users",        "rival_routes_json", "TEXT")
        _add_col(conn, "users",        "active_shift_start","VARCHAR")
        _add_col(conn, "users",        "active_direction",  "VARCHAR")
        _add_col(conn, "vehicles",     "avatar_url",        "VARCHAR")
        _add_col(conn, "maintenance",  "reminders_json",    "TEXT")

# Seed demo drivers by ВУ number if they don't exist yet
def _seed_demo_drivers():
    from .database import SessionLocal
    db = SessionLocal()
    try:
        if db.query(models.User).filter(models.User.role == models.UserRole.driver).count() == 0:
            demos = [
                ("00 00 123456", "Черепанов Владимир Георгиевич"),
                ("00 00 234567", "Калинин Сергей Александрович"),
                ("00 00 345678", "Пивоваров Иван Алексеевич"),
                ("00 00 456789", "Спринтер Алексей Сергеевич"),
            ]
            for vu, name in demos:
                db.add(models.User(driver_id=vu, full_name=name, role=models.UserRole.driver))
            db.commit()
    finally:
        db.close()

_seed_demo_drivers()

app = FastAPI(
    title="Мой.Маршрут API",
    description="Система управления автопарком и навигации",
    version="1.0.0",
)

_origins_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
_allowed_origins = [o.strip() for o in _origins_env.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(tracking.router)
app.include_router(reports.router)
app.include_router(routes.router)
app.include_router(vehicles.router)
app.include_router(repairs.router)
app.include_router(salary.router)
app.include_router(drivers.router)
app.include_router(support.router)

if not _USE_SUPABASE:
    app.mount("/uploads", StaticFiles(directory=_UPLOAD_DIR), name="uploads")


@app.get("/")
def root():
    return {"status": "ok", "app": "Мой.Маршрут"}


# TEMPORARY — one-off data migration trigger for the free Render tier (no Shell access).
# Remove this endpoint once the migration has run.
@app.post("/admin/migrate")
def admin_migrate(x_migrate_token: str = Header(default="")):
    token = os.environ.get("MIGRATE_TOKEN", "")
    if not token or x_migrate_token != token:
        raise HTTPException(status_code=403, detail="Forbidden")
    from .migrate_data import main as run_migration
    try:
        run_migration()
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"status": "ok"}
