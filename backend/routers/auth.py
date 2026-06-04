from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def get_or_create_demo_entrepreneur(db: Session, phone: str) -> models.User:
    user = db.query(models.User).filter(models.User.phone == phone).first()
    if not user:
        user = models.User(
            phone=phone,
            full_name="Предприниматель",
            role=models.UserRole.entrepreneur,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.post("/login/driver", response_model=schemas.TokenResponse)
def login_driver(request: schemas.DriverLoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.driver_id == request.driver_id,
        models.User.role == models.UserRole.driver,
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Водитель с таким номером ВУ не найден")
    token = create_access_token({"sub": str(user.id), "role": "driver"})
    return schemas.TokenResponse(
        access_token=token,
        role="driver",
        user_id=user.id,
        full_name=user.full_name,
    )


@router.post("/login/entrepreneur", response_model=schemas.TokenResponse)
def login_entrepreneur(request: schemas.EntrepreneurLoginRequest, db: Session = Depends(get_db)):
    user = get_or_create_demo_entrepreneur(db, request.phone)
    token = create_access_token({"sub": str(user.id), "role": "entrepreneur"})
    return schemas.TokenResponse(
        access_token=token,
        role="entrepreneur",
        user_id=user.id,
        full_name=user.full_name,
    )


@router.post("/login/gosuslugi", response_model=schemas.TokenResponse)
def login_gosuslugi(db: Session = Depends(get_db)):
    user = get_or_create_demo_entrepreneur(db, "+70000000000")
    token = create_access_token({"sub": str(user.id), "role": "entrepreneur"})
    return schemas.TokenResponse(
        access_token=token,
        role="entrepreneur",
        user_id=user.id,
        full_name=user.full_name,
    )
