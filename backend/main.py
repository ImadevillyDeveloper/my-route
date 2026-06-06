from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from sqlalchemy import text
from .database import engine
from . import models
from .routers import auth, users, tracking, reports, routes, vehicles, repairs, salary, drivers, support

models.Base.metadata.create_all(bind=engine)

# SQLite migrations — add columns that didn't exist in earlier versions
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/")
def root():
    return {"status": "ok", "app": "Мой.Маршрут"}
