import os, random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, get_current_driver
from ..storage import save_upload

router = APIRouter(prefix="/drivers", tags=["drivers"])


def _plate_busy_query(db: Session, plate: str, exclude_user_id: int):
    """Есть ли ДРУГОЙ водитель с активной сменой на этом гос.номере (с учётом
    временной подмены ТС на смену)?"""
    return db.query(models.User).filter(
        models.User.role == models.UserRole.driver,
        models.User.id != exclude_user_id,
        models.User.active_shift_start.isnot(None),
        or_(
            models.User.active_shift_vehicle_plate == plate,
            and_(models.User.active_shift_vehicle_plate.is_(None), models.User.vehicle_plate == plate),
        ),
    ).first()


@router.get("/me/route-vehicles", response_model=list[schemas.VehicleOut])
def get_my_route_vehicles(
    current_user: models.User = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    """ТС на маршруте водителя, доступные для выбора на смену (т.е. на которых
    прямо сейчас не начата смена другим водителем)."""
    if not current_user.route_number:
        return []
    route = db.query(models.Route).filter(models.Route.number == current_user.route_number).first()
    if not route:
        return []
    from .vehicles import _vehicle_out
    vehicles = db.query(models.Vehicle).filter(
        models.Vehicle.route_id == route.id,
        models.Vehicle.owner_id == current_user.owner_id,
    ).all()
    available = [v for v in vehicles if not _plate_busy_query(db, v.plate_number, current_user.id)]
    return [_vehicle_out(v, db) for v in available]


@router.post("/me/start-shift", response_model=schemas.UserOut)
def start_shift(
    body: schemas.StartShiftRequest,
    current_user: models.User = Depends(get_current_driver),
    db: Session = Depends(get_db),
):
    """Начинает смену. Если передан vehicle_plate, отличный от назначенного
    предпринимателем ТС, — используем его ТОЛЬКО на эту смену (постоянное
    vehicle_plate в личном кабинете не меняется), при условии что на нём прямо
    сейчас не начата смена другим водителем."""
    plate = (body.vehicle_plate or "").strip() or None
    if plate and plate != current_user.vehicle_plate:
        vehicle = db.query(models.Vehicle).filter(
            models.Vehicle.plate_number == plate,
            models.Vehicle.owner_id == current_user.owner_id,
        ).first()
        if not vehicle:
            raise HTTPException(404, "ТС не найдено")
        if _plate_busy_query(db, plate, current_user.id):
            raise HTTPException(409, "На этом ТС уже начата смена другим водителем")
        current_user.active_shift_vehicle_plate = plate
    else:
        current_user.active_shift_vehicle_plate = None

    current_user.active_shift_start = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("", response_model=list[schemas.DriverOut])
def list_drivers(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.User).filter(models.User.role == models.UserRole.driver)
    if current_user.role == models.UserRole.entrepreneur:
        q = q.filter(models.User.owner_id == current_user.id)
    return [_driver_out(d, db) for d in q.all()]


@router.post("", response_model=schemas.DriverOut, status_code=201)
def create_driver(
    driver_in: schemas.DriverCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if db.query(models.User).filter(models.User.driver_id == driver_in.driver_id).first():
        raise HTTPException(409, "Водитель с таким номером ВУ уже существует")
    user = models.User(
        driver_id=driver_in.driver_id,
        full_name=driver_in.full_name,
        phone=driver_in.phone or None,
        role=models.UserRole.driver,
        vehicle_plate=driver_in.plate_number or None,
        route_number=driver_in.route_number or None,
        owner_id=current_user.id,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Водитель с таким номером ВУ уже существует")
    db.refresh(user)
    return _driver_out(user, db)


@router.put("/{driver_id}", response_model=schemas.DriverOut)
def update_driver(
    driver_id: int,
    update: schemas.DriverUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.User).filter(
        models.User.id == driver_id,
        models.User.role == models.UserRole.driver,
    )
    if current_user.role == models.UserRole.entrepreneur:
        q = q.filter(models.User.owner_id == current_user.id)
    user = q.first()
    if not user:
        raise HTTPException(404, "Driver not found")
    if update.full_name is not None:
        user.full_name = update.full_name
    if update.phone is not None:
        user.phone = update.phone or None
    if update.driver_id is not None:
        new_vu = update.driver_id.strip() or None
        if new_vu and db.query(models.User).filter(
            models.User.driver_id == new_vu, models.User.id != user.id
        ).first():
            raise HTTPException(409, "Водитель с таким номером ВУ уже существует")
        user.driver_id = new_vu
    if update.plate_number is not None:
        user.vehicle_plate = update.plate_number or None
    if update.route_number is not None:
        user.route_number = update.route_number or None
    db.commit()
    db.refresh(user)
    return _driver_out(user, db)


@router.delete("/{driver_id}", status_code=204)
def delete_driver(
    driver_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.User).filter(
        models.User.id == driver_id,
        models.User.role == models.UserRole.driver,
    )
    if current_user.role == models.UserRole.entrepreneur:
        q = q.filter(models.User.owner_id == current_user.id)
    user = q.first()
    if not user:
        raise HTTPException(404, "Driver not found")
    db.query(models.Report).filter(models.Report.driver_id == driver_id).delete()
    db.delete(user)
    db.commit()


@router.post("/{driver_id}/photo", response_model=schemas.DriverOut)
async def upload_driver_photo(
    driver_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(
        models.User.id == driver_id,
        models.User.role == models.UserRole.driver,
    ).first()
    if not user:
        raise HTTPException(404, "Driver not found")
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"driver_{driver_id}_{random.randint(1000,9999)}{ext}"
    user.avatar_url = save_upload(file.file, filename, file.content_type or "image/jpeg")
    db.commit()
    db.refresh(user)
    return _driver_out(user, db)


def _driver_out(user: models.User, db: Session) -> schemas.DriverOut:
    return schemas.DriverOut(
        id=user.id,
        full_name=user.full_name,
        driver_id=user.driver_id,
        phone=user.phone,
        route_number=user.route_number,
        plate_number=user.vehicle_plate,
        avatar_url=user.avatar_url,
    )
