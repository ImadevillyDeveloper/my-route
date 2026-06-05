import os, shutil, random
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

UPLOAD_DIR = "uploads"

router = APIRouter(prefix="/drivers", tags=["drivers"])


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
    fname = f"{UPLOAD_DIR}/driver_{driver_id}_{random.randint(1000,9999)}{ext}"
    with open(fname, "wb") as f:
        shutil.copyfileobj(file.file, f)
    user.avatar_url = f"/{fname}"
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
