from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])


def _entrepreneur_out(u: models.User, db: Session) -> schemas.EntrepreneurAdminOut:
    vehicles_count = db.query(models.Vehicle).filter(models.Vehicle.owner_id == u.id).count()
    drivers_count = db.query(models.User).filter(
        models.User.owner_id == u.id, models.User.role == models.UserRole.driver
    ).count()
    return schemas.EntrepreneurAdminOut(
        id=u.id,
        full_name=u.full_name,
        phone=u.phone,
        avatar_url=u.avatar_url,
        created_at=u.created_at,
        vehicles_count=vehicles_count,
        drivers_count=drivers_count,
    )


@router.get("/entrepreneurs", response_model=list[schemas.EntrepreneurAdminOut])
def list_entrepreneurs(
    current_admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    users = db.query(models.User).filter(
        models.User.role == models.UserRole.entrepreneur
    ).order_by(models.User.created_at.desc()).all()
    return [_entrepreneur_out(u, db) for u in users]


@router.post("/entrepreneurs", response_model=schemas.EntrepreneurAdminOut, status_code=201)
def create_entrepreneur(
    body: schemas.EntrepreneurAdminCreate,
    current_admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    full_name = body.full_name.strip()
    phone = body.phone.strip()
    if not full_name:
        raise HTTPException(400, "Укажите имя ИП")
    if not phone:
        raise HTTPException(400, "Укажите номер телефона")
    user = models.User(full_name=full_name, phone=phone, role=models.UserRole.entrepreneur)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "ИП с таким номером телефона уже существует")
    db.refresh(user)
    return _entrepreneur_out(user, db)


@router.delete("/entrepreneurs/{entrepreneur_id}", status_code=204)
def delete_entrepreneur(
    entrepreneur_id: int,
    current_admin: models.User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(
        models.User.id == entrepreneur_id, models.User.role == models.UserRole.entrepreneur
    ).first()
    if not user:
        raise HTTPException(404, "ИП не найден")

    vehicles = db.query(models.Vehicle).filter(models.Vehicle.owner_id == entrepreneur_id).all()
    vehicle_ids = [v.id for v in vehicles]
    if vehicle_ids:
        db.query(models.Insurance).filter(models.Insurance.vehicle_id.in_(vehicle_ids)).delete(synchronize_session=False)
        db.query(models.Maintenance).filter(models.Maintenance.vehicle_id.in_(vehicle_ids)).delete(synchronize_session=False)
        db.query(models.Repair).filter(models.Repair.vehicle_id.in_(vehicle_ids)).delete(synchronize_session=False)
        for v in vehicles:
            db.query(models.User).filter(models.User.vehicle_plate == v.plate_number).update({"vehicle_plate": None})
            db.delete(v)

    db.query(models.Route).filter(models.Route.owner_id == entrepreneur_id).delete(synchronize_session=False)

    drivers = db.query(models.User).filter(
        models.User.owner_id == entrepreneur_id, models.User.role == models.UserRole.driver
    ).all()
    driver_ids = [d.id for d in drivers]
    if driver_ids:
        db.query(models.Report).filter(models.Report.driver_id.in_(driver_ids)).delete(synchronize_session=False)
        db.query(models.Salary).filter(models.Salary.user_id.in_(driver_ids)).delete(synchronize_session=False)
        for d in drivers:
            db.delete(d)

    db.delete(user)
    db.commit()
