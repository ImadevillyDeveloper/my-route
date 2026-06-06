from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class UserRole(str, enum.Enum):
    driver = "driver"
    entrepreneur = "entrepreneur"


class VehicleStatus(str, enum.Enum):
    on_route = "on_route"
    parked = "parked"
    repair = "repair"


class ReportStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    adjusted = "adjusted"


class SalaryStatus(str, enum.Enum):
    calculated = "calculated"
    paid = "paid"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(String, unique=True, nullable=True, index=True)
    phone = Column(String, unique=True, nullable=True, index=True)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    hashed_password = Column(String, nullable=True)
    biometric_enabled = Column(Boolean, default=False)
    avatar_url = Column(String, nullable=True)
    vehicle_plate = Column(String, nullable=True)   # назначенное ТС (много водителей → одно ТС)
    route_number  = Column(String, nullable=True)   # назначенный маршрут (прямое поле)
    rival_routes_json  = Column(Text, nullable=True)    # JSON-массив конкурентных маршрутов
    active_shift_start = Column(String, nullable=True)  # ISO datetime начала активной смены
    active_direction   = Column(String, nullable=True)  # "forward" | "back"
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    reports = relationship("Report", back_populates="driver", foreign_keys="Report.driver_id")
    salaries = relationship("Salary", back_populates="user")


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    number = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    start_point = Column(String, nullable=False)
    end_point = Column(String, nullable=False)
    stops = Column(Text, nullable=True)
    document_number = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vehicles = relationship("Vehicle", back_populates="route")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String, unique=True, nullable=False, index=True)
    model = Column(String, nullable=False)
    year = Column(Integer, nullable=True)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=True)
    status = Column(Enum(VehicleStatus), default=VehicleStatus.parked)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    speed = Column(Float, default=0.0)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    avatar_url = Column(String, nullable=True)

    route = relationship("Route", back_populates="vehicles")
    repairs = relationship("Repair", back_populates="vehicle")
    maintenance = relationship("Maintenance", back_populates="vehicle", uselist=False)
    insurance = relationship("Insurance", back_populates="vehicle", uselist=False)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True)
    route_number = Column(String, nullable=True)
    shift_date = Column(Date, nullable=False)
    shift_start = Column(String, nullable=True)
    shift_end = Column(String, nullable=True)
    total_trips = Column(Integer, default=0)
    total_revenue = Column(Float, default=0.0)
    fuel_cost = Column(Float, default=0.0)
    notes = Column(Text, nullable=True)
    receipt_image_url = Column(String, nullable=True)
    status = Column(Enum(ReportStatus), default=ReportStatus.pending)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    driver = relationship("User", back_populates="reports", foreign_keys=[driver_id])


class Repair(Base):
    __tablename__ = "repairs"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    date = Column(Date, nullable=False)
    repair_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cost = Column(Float, default=0.0)
    workshop = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vehicle = relationship("Vehicle", back_populates="repairs")


class Maintenance(Base):
    __tablename__ = "maintenance"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), unique=True, nullable=False)
    period_km = Column(Integer, default=10000)
    period_months = Column(Integer, default=6)
    last_date = Column(Date, nullable=True)
    next_date = Column(Date, nullable=True)
    reminder_enabled = Column(Boolean, default=True)
    reminders_json = Column(Text, nullable=True)   # JSON настройки напоминаний

    vehicle = relationship("Vehicle", back_populates="maintenance")


class Insurance(Base):
    __tablename__ = "insurance"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), unique=True, nullable=False)
    policy_number = Column(String, nullable=True)
    company = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    kasko_end_date = Column(Date, nullable=True)
    reminder_enabled = Column(Boolean, default=True)

    vehicle = relationship("Vehicle", back_populates="insurance")


class RouteNavitransId(Base):
    __tablename__ = "route_navitrans_ids"

    route_number = Column(String, primary_key=True)
    mr_id = Column(String, nullable=False)


class RouteStopList(Base):
    __tablename__ = "route_stop_lists"

    mr_id = Column(String, primary_key=True)
    route_number = Column(String, nullable=False, index=True)
    stops_json = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CompetitorDirectionMap(Base):
    __tablename__ = "competitor_direction_map"

    id = Column(Integer, primary_key=True, index=True)
    our_route_number = Column(String, nullable=False, index=True)
    our_destination = Column(String, nullable=False)
    competitor_route_number = Column(String, nullable=False)
    competitor_destination = Column(String, nullable=False)
    common_stop_count = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint('our_route_number', 'our_destination', 'competitor_route_number',
                         name='uq_competitor_direction'),
    )


class Salary(Base):
    __tablename__ = "salary"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    period = Column(String, nullable=False)
    base_amount = Column(Float, default=0.0)
    bonuses = Column(Float, default=0.0)
    fines = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    status = Column(Enum(SalaryStatus), default=SalaryStatus.calculated)

    user = relationship("User", back_populates="salaries")
