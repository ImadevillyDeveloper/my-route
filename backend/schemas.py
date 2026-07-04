from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


class UserRole(str, Enum):
    driver = "driver"
    entrepreneur = "entrepreneur"


class VehicleStatus(str, Enum):
    on_route = "on_route"
    parked = "parked"
    repair = "repair"


class ReportStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    adjusted = "adjusted"


class SalaryStatus(str, Enum):
    calculated = "calculated"
    paid = "paid"


# Drivers
class DriverCreate(BaseModel):
    full_name: str
    driver_id: str          # номер ВУ — используется для входа
    phone: Optional[str] = None
    plate_number: Optional[str] = None
    route_number: Optional[str] = None


class DriverUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    driver_id: Optional[str] = None
    plate_number: Optional[str] = None  # "" — снять ТС, иначе назначить
    route_number: Optional[str] = None  # "" — снять маршрут, иначе назначить


class DriverOut(BaseModel):
    id: int
    full_name: str
    driver_id: Optional[str] = None
    phone: Optional[str] = None
    route_number: Optional[str] = None
    plate_number: Optional[str] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


# Auth
class DriverLoginRequest(BaseModel):
    driver_id: str


class EntrepreneurLoginRequest(BaseModel):
    phone: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    full_name: str


class UserOut(BaseModel):
    id: int
    driver_id: Optional[str] = None
    phone: Optional[str] = None
    full_name: str
    role: UserRole
    biometric_enabled: bool
    avatar_url: Optional[str] = None
    vehicle_plate: Optional[str] = None
    route_number: Optional[str] = None
    rival_routes_json: Optional[str] = None
    active_shift_start: Optional[str] = None
    active_direction: Optional[str] = None
    hints_enabled: Optional[bool] = True

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    biometric_enabled: Optional[bool] = None
    avatar_url: Optional[str] = None
    rival_routes_json: Optional[str] = None
    active_shift_start: Optional[str] = None
    active_direction: Optional[str] = None
    hints_enabled: Optional[bool] = None


# Tracking
class PositionOut(BaseModel):
    lat: float
    lng: float
    speed: float


class RivalOut(BaseModel):
    id: int
    unit_id: Optional[str] = None
    lat: float
    lng: float
    speed: float
    direction: str
    route_number: Optional[str] = None
    plate_number: Optional[str] = None
    model: Optional[str] = None
    status: Optional[str] = None


class HintRival(BaseModel):
    route: str
    plate: Optional[str] = None
    distance_m: int
    gap_s: Optional[int] = None  # seconds we arrive before rival (positive = we first)

class HintOut(BaseModel):
    type: str  # "slow_down" | "speed_up" | "maintain" | "none"
    message: Optional[str] = None
    ahead: Optional[HintRival] = None
    behind: Optional[HintRival] = None


class NearestStopOut(BaseModel):
    name: Optional[str] = None


class ChatConversationOut(BaseModel):
    key: str
    type: str  # "route" | "dm"
    title: str
    other_user_id: Optional[int] = None
    unread: int = 0
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None


class ChatMessageOut(BaseModel):
    id: int
    conversation_key: str
    sender_id: int
    sender_name: str
    sender_role: str
    text: str
    created_at: datetime
    mine: bool = False


class ChatMessageCreate(BaseModel):
    conversation_key: str
    text: str


class TrackingRequest(BaseModel):
    direction: str


class RecommendationOut(BaseModel):
    recommended_speed: float
    message: str


# Reports
class ReportCreate(BaseModel):
    route_number: Optional[str] = None
    plate_number: Optional[str] = None
    shift_date: date
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    total_trips: int = 0
    total_revenue: float = 0.0
    fuel_cost: float = 0.0
    notes: Optional[str] = None


class ReportOut(BaseModel):
    id: int
    driver_id: int
    route_number: Optional[str] = None
    plate_number: Optional[str] = None
    shift_date: date
    shift_start: Optional[str] = None
    shift_end: Optional[str] = None
    total_trips: int
    total_revenue: float
    fuel_cost: float
    notes: Optional[str] = None
    receipt_image_url: Optional[str] = None
    status: ReportStatus
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    driver_name: Optional[str] = None

    class Config:
        from_attributes = True


class ReportStatusUpdate(BaseModel):
    status: ReportStatus


class ReportAdjust(BaseModel):
    status: ReportStatus
    notes: Optional[str] = None


class ScanResult(BaseModel):
    route_number: Optional[str] = None
    shift_date: Optional[str] = None
    total_revenue: Optional[float] = None
    total_trips: Optional[int] = None


# Routes
class RouteCreate(BaseModel):
    number: str
    name: str
    start_point: str
    end_point: str
    stops: Optional[str] = None
    document_number: Optional[str] = None


class RouteOut(BaseModel):
    id: int
    number: str
    name: str
    start_point: str
    end_point: str
    stops: Optional[str] = None
    document_number: Optional[str] = None
    is_active: bool
    owner_id: Optional[int] = None

    class Config:
        from_attributes = True


class RouteUpdate(BaseModel):
    number: Optional[str] = None
    name: Optional[str] = None
    start_point: Optional[str] = None
    end_point: Optional[str] = None
    stops: Optional[str] = None
    document_number: Optional[str] = None
    is_active: Optional[bool] = None


# Vehicles
class VehicleCreate(BaseModel):
    plate_number: str
    model: str
    year: Optional[int] = None
    route_number: Optional[str] = None


class VehicleUpdate(BaseModel):
    plate_number: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    route_number: Optional[str] = None


class VehicleOut(BaseModel):
    id: int
    plate_number: str
    model: str
    year: Optional[int] = None
    route_id: Optional[int] = None
    route_number: Optional[str] = None
    status: VehicleStatus
    lat: Optional[float] = None
    lng: Optional[float] = None
    speed: float
    owner_id: Optional[int] = None
    driver_user_id: Optional[int] = None
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class VehicleMapOut(BaseModel):
    id: int
    plate_number: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    status: VehicleStatus
    route_number: Optional[str] = None

    class Config:
        from_attributes = True


# Repairs
class RepairCreate(BaseModel):
    vehicle_id: int
    repair_type: str
    cost: float = 0.0
    comment: Optional[str] = None
    date: Optional[date] = None


class RepairOut(BaseModel):
    id: int
    vehicle_id: int
    date: date
    repair_type: str
    description: Optional[str] = None
    cost: float

    class Config:
        from_attributes = True


class MaintenanceUpdate(BaseModel):
    period_km: Optional[int] = None
    period_months: Optional[int] = None
    reminder_enabled: Optional[bool] = None
    next_date: Optional[date] = None
    reminders_json: Optional[str] = None


class MaintenanceOut(BaseModel):
    id: int
    period_km: int
    period_months: int
    next_date: Optional[date] = None
    reminder_enabled: bool
    reminders_json: Optional[str] = None

    class Config:
        from_attributes = True


class InsuranceUpdate(BaseModel):
    policy_number: Optional[str] = None
    company: Optional[str] = None
    end_date: Optional[date] = None
    kasko_end_date: Optional[date] = None
    reminder_enabled: Optional[bool] = None


class InsuranceOut(BaseModel):
    id: int
    policy_number: Optional[str] = None
    company: Optional[str] = None
    end_date: Optional[date] = None
    kasko_end_date: Optional[date] = None
    reminder_enabled: bool

    class Config:
        from_attributes = True


# Salary
class SalaryOut(BaseModel):
    driver_id: int
    driver_name: str
    total: float
    base_amount: float
    bonuses: float
    fines: float
    status: Optional[SalaryStatus] = None
