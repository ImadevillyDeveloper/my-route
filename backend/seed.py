"""Seed demo data for development"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.database import SessionLocal, engine
from backend import models
from datetime import date, timedelta
import random

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Skip seeding if real data already exists (protects user-added records)
if db.query(models.User).count() > 0:
    print("База уже содержит данные — сидирование пропущено.")
    print("Чтобы сбросить всё и пересеять, удалите файл marshrut.db вручную.")
    db.close()
    sys.exit(0)

# Entrepreneur
entrepreneur = models.User(
    phone="+79131523645",
    full_name="Черепанов Виктор Геннадьевич",
    role=models.UserRole.entrepreneur,
)
db.add(entrepreneur)

# Drivers
driver_names = [
    ("Черепанов Владимир Георгиевич", "00 00 123456"),
    ("Сидоров Алексей Иванович",      "00 00 234567"),
    ("Петров Николай Фёдорович",       "00 00 345678"),
    ("Кузнецов Дмитрий Викторович",    "00 00 456789"),
]
drivers = []
for name, did in driver_names:
    d = models.User(driver_id=did, full_name=name, role=models.UserRole.driver)
    db.add(d)
    drivers.append(d)

db.commit()

# Routes
routes_data = [
    ("212", "Маршрут 212", "ул. Масленникова", "ТЦ Арена", "Масленникова → Жукова → ТЦ Арена", "МУ-212-2024"),
    ("120", "Маршрут 120", "Центр", "Левый берег", "Центр → Мост → Левый берег", "МУ-120-2024"),
    ("73", "Маршрут 73", "ул. Ленина", "Амурский посёлок", "Ленина → Маркса → Амурский", "МУ-073-2024"),
    ("44", "Маршрут 44", "ул. Б. Хмельницкого", "ОмскТех", "Хмельницкого → Пр. Мира → ОмскТех", "МУ-044-2024"),
]
routes = []
for num, name, start, end, stops, doc in routes_data:
    r = models.Route(number=num, name=name, start_point=start, end_point=end,
                     stops=stops, document_number=doc)
    db.add(r)
    routes.append(r)
db.commit()

# Vehicles
OMSK_LAT, OMSK_LNG = 54.9885, 73.3242
vehicles_data = [
    ("А123БВ55", "ПАЗ-3205", 2019, models.VehicleStatus.on_route),
    ("В456ГД55", "ГАЗель Next", 2021, models.VehicleStatus.on_route),
    ("Е789ЖЗ55", "Ford Transit", 2020, models.VehicleStatus.parked),
    ("И012КЛ55", "ПАЗ-3205", 2018, models.VehicleStatus.repair),
    ("М345НО55", "ГАЗель Next", 2022, models.VehicleStatus.on_route),
]
vehicles = []
for plate, model_name, year, status in vehicles_data:
    lat = OMSK_LAT + random.uniform(-0.05, 0.05)
    lng = OMSK_LNG + random.uniform(-0.05, 0.05)
    v = models.Vehicle(
        plate_number=plate, model=model_name, year=year,
        route_id=random.choice(routes).id,
        status=status, lat=lat, lng=lng,
        speed=random.uniform(0, 60) if status == models.VehicleStatus.on_route else 0,
        driver_id=random.choice(drivers).id,
    )
    db.add(v)
    vehicles.append(v)
db.commit()

# Maintenance & Insurance for each vehicle
for v in vehicles:
    maint = models.Maintenance(
        vehicle_id=v.id, period_km=10000, period_months=6,
        last_date=date.today() - timedelta(days=90),
        next_date=date.today() + timedelta(days=90),
        reminder_enabled=True,
    )
    ins = models.Insurance(
        vehicle_id=v.id,
        policy_number=f"ОСАГО-{random.randint(100000, 999999)}",
        company="Росгосстрах",
        start_date=date.today() - timedelta(days=60),
        end_date=date.today() + timedelta(days=300),
        reminder_enabled=True,
    )
    db.add(maint)
    db.add(ins)
db.commit()

# Reports (last 30 days)
for driver in drivers:
    for i in range(random.randint(8, 15)):
        shift_date = date.today() - timedelta(days=random.randint(0, 30))
        r = models.Report(
            driver_id=driver.id,
            route_number=random.choice(["212", "120", "73", "44"]),
            shift_date=shift_date,
            shift_start=f"{random.randint(6, 9):02d}:00",
            shift_end=f"{random.randint(18, 22):02d}:00",
            total_trips=random.randint(8, 20),
            total_revenue=round(random.uniform(3000, 8000), 2),
            fuel_cost=round(random.uniform(500, 1200), 2),
            notes="",
            status=random.choice([models.ReportStatus.approved, models.ReportStatus.pending]),
        )
        db.add(r)

# Repairs
repair_types = ["Замена масла", "Тормозные колодки", "Шины", "Аккумулятор", "Кузовной ремонт", "ТО"]
for v in vehicles:
    for _ in range(random.randint(1, 4)):
        r = models.Repair(
            vehicle_id=v.id,
            date=date.today() - timedelta(days=random.randint(5, 365)),
            repair_type=random.choice(repair_types),
            cost=round(random.uniform(500, 25000), 2),
            description="Плановые работы",
        )
        db.add(r)

db.commit()
print("OK Seed data created successfully!")
print(f"   Entrepreneur: +79131523645")
print(f"   Drivers: 00 00 123456, 00 00 234567, 00 00 345678, 00 00 456789")
db.close()
