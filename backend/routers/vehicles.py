import os, shutil, random
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional
from .. import models, schemas
from ..schemas import InsuranceOut, MaintenanceOut
from ..database import get_db
from ..auth import get_current_user

UPLOAD_DIR = "uploads"

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.post("", response_model=schemas.VehicleOut, status_code=201)
def create_vehicle(
    vehicle_in: schemas.VehicleCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(models.Route).filter(models.Route.number == vehicle_in.route_number).first() if vehicle_in.route_number else None
    v = models.Vehicle(
        plate_number=vehicle_in.plate_number,
        model=vehicle_in.model,
        year=vehicle_in.year,
        route_id=route.id if route else None,
        status=models.VehicleStatus.parked,
        owner_id=current_user.id,
    )
    db.add(v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="ТС с таким госномером уже существует")
    db.refresh(v)
    return _vehicle_out(v, db)


@router.get("", response_model=list[schemas.VehicleOut])
def list_vehicles(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Vehicle)
    if current_user.role == models.UserRole.entrepreneur:
        q = q.filter(models.Vehicle.owner_id == current_user.id)
    return [_vehicle_out(v, db) for v in q.all()]


@router.get("/map", response_model=list[schemas.VehicleMapOut])
def get_vehicles_map(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Vehicle)
    if current_user.role == models.UserRole.entrepreneur:
        q = q.filter(models.Vehicle.owner_id == current_user.id)
    vehicles = q.all()
    result = []
    for v in vehicles:
        route = db.query(models.Route).filter(models.Route.id == v.route_id).first() if v.route_id else None
        result.append(schemas.VehicleMapOut(
            id=v.id,
            plate_number=v.plate_number,
            lat=v.lat,
            lng=v.lng,
            status=v.status,
            route_number=route.number if route else None,
        ))
    return result


@router.get("/{vehicle_id}", response_model=schemas.VehicleOut)
def get_vehicle(
    vehicle_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id)
    if current_user.role == models.UserRole.entrepreneur:
        q = q.filter(models.Vehicle.owner_id == current_user.id)
    v = q.first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    return _vehicle_out(v, db)


@router.get("/{vehicle_id}/insurance", response_model=Optional[schemas.InsuranceOut])
def get_insurance(
    vehicle_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Insurance).filter(models.Insurance.vehicle_id == vehicle_id).first()


@router.get("/{vehicle_id}/maintenance", response_model=Optional[schemas.MaintenanceOut])
def get_maintenance(
    vehicle_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Maintenance).filter(models.Maintenance.vehicle_id == vehicle_id).first()


@router.get("/{vehicle_id}/repairs", response_model=list[schemas.RepairOut])
def get_vehicle_repairs(
    vehicle_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Repair).filter(models.Repair.vehicle_id == vehicle_id).order_by(models.Repair.date.desc()).all()


@router.put("/{vehicle_id}", response_model=schemas.VehicleOut)
def update_vehicle(
    vehicle_id: int,
    update: schemas.VehicleUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id)
    if current_user.role == models.UserRole.entrepreneur:
        q = q.filter(models.Vehicle.owner_id == current_user.id)
    v = q.first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    if update.plate_number is not None:
        v.plate_number = update.plate_number
    if update.model is not None:
        v.model = update.model
    if update.year is not None:
        v.year = update.year
    if update.route_number is not None:
        if update.route_number == '':
            v.route_id = None
        else:
            route = db.query(models.Route).filter(models.Route.number == update.route_number).first()
            if route:
                v.route_id = route.id
    db.commit()
    db.refresh(v)
    return _vehicle_out(v, db)


@router.post("/{vehicle_id}/photo", response_model=schemas.VehicleOut)
async def upload_vehicle_photo(
    vehicle_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id).first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    fname = f"{UPLOAD_DIR}/vehicle_{vehicle_id}_{random.randint(1000,9999)}{ext}"
    with open(fname, "wb") as f:
        shutil.copyfileobj(file.file, f)
    v.avatar_url = f"/{fname}"
    db.commit()
    db.refresh(v)
    return _vehicle_out(v, db)


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(
    vehicle_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Vehicle).filter(models.Vehicle.id == vehicle_id)
    if current_user.role == models.UserRole.entrepreneur:
        q = q.filter(models.Vehicle.owner_id == current_user.id)
    v = q.first()
    if not v:
        raise HTTPException(404, "Vehicle not found")
    # Снимаем привязку водителей к этому ТС
    db.query(models.User).filter(
        models.User.vehicle_plate == v.plate_number
    ).update({"vehicle_plate": None})
    # Удаляем связанные данные
    db.query(models.Insurance).filter(models.Insurance.vehicle_id == vehicle_id).delete()
    db.query(models.Maintenance).filter(models.Maintenance.vehicle_id == vehicle_id).delete()
    db.query(models.Repair).filter(models.Repair.vehicle_id == vehicle_id).delete()
    db.delete(v)
    db.commit()


@router.put("/{vehicle_id}/maintenance", response_model=schemas.MaintenanceOut)
def update_maintenance(
    vehicle_id: int,
    update: schemas.MaintenanceUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    maint = db.query(models.Maintenance).filter(models.Maintenance.vehicle_id == vehicle_id).first()
    if not maint:
        maint = models.Maintenance(vehicle_id=vehicle_id)
        db.add(maint)
    for k, v in update.model_dump(exclude_none=True).items():
        setattr(maint, k, v)
    db.commit()
    db.refresh(maint)
    return maint


@router.put("/{vehicle_id}/insurance", response_model=schemas.InsuranceOut)
def update_insurance(
    vehicle_id: int,
    update: schemas.InsuranceUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ins = db.query(models.Insurance).filter(models.Insurance.vehicle_id == vehicle_id).first()
    if not ins:
        ins = models.Insurance(vehicle_id=vehicle_id)
        db.add(ins)
    for k, v in update.model_dump(exclude_none=True).items():
        setattr(ins, k, v)
    db.commit()
    db.refresh(ins)
    return ins


def _vehicle_out(v: models.Vehicle, db: Session) -> schemas.VehicleOut:
    route = db.query(models.Route).filter(models.Route.id == v.route_id).first() if v.route_id else None
    return schemas.VehicleOut(
        id=v.id,
        plate_number=v.plate_number,
        model=v.model,
        year=v.year,
        route_id=v.route_id,
        route_number=route.number if route else None,
        status=v.status,
        lat=v.lat,
        lng=v.lng,
        speed=v.speed,
        owner_id=v.owner_id,
        driver_user_id=v.driver_id,
        avatar_url=v.avatar_url,
    )
