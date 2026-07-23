from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import create_access_token, get_current_user, pwd_context
from ..reset_utils import find_user_by_role_identifier, check_reset_code

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


def _check_password(user: models.User) -> None:
    """Общая проверка пароля для обоих логинов — отдельные статусы для "пароль
    ещё не задан" (новый аккаунт, водитель/ИП ни разу не проходил через бота)
    и "неверный пароль", чтобы фронт мог показать разные экраны."""
    if not user.hashed_password:
        raise HTTPException(status_code=401, detail="PASSWORD_NOT_SET")


@router.post("/login/driver", response_model=schemas.TokenResponse)
def login_driver(request: schemas.DriverLoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.driver_id == request.driver_id,
        models.User.role == models.UserRole.driver,
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Водитель с таким номером ВУ не найден")
    _check_password(user)
    if not pwd_context.verify(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный пароль")
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
    _check_password(user)
    if not pwd_context.verify(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный пароль")
    token = create_access_token({"sub": str(user.id), "role": "entrepreneur"})
    return schemas.TokenResponse(
        access_token=token,
        role="entrepreneur",
        user_id=user.id,
        full_name=user.full_name,
    )


@router.post("/password-reset/confirm", response_model=schemas.TokenResponse)
def confirm_password_reset(request: schemas.PasswordResetConfirm, db: Session = Depends(get_db)):
    """Код прислал бот @MyRouteSupport_bot после подтверждения личности через
    "Поделиться номером" в Telegram. Успешная смена пароля сразу логинит —
    не заставляем вводить те же данные ещё раз на экране входа."""
    user = find_user_by_role_identifier(db, request.role, request.identifier)
    if not user or not check_reset_code(user, request.code):
        raise HTTPException(status_code=400, detail="Неверный или истёкший код")

    user.hashed_password = pwd_context.hash(request.new_password)
    user.reset_code = None
    user.reset_code_expires_at = None
    db.commit()

    token = create_access_token({"sub": str(user.id), "role": request.role})
    return schemas.TokenResponse(
        access_token=token,
        role=request.role,
        user_id=user.id,
        full_name=user.full_name,
    )


@router.post("/login/admin", response_model=schemas.TokenResponse)
def login_admin(request: schemas.AdminLoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.role == models.UserRole.admin).first()
    if not user or not user.hashed_password or not pwd_context.verify(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный пароль")
    token = create_access_token({"sub": str(user.id), "role": "admin"})
    return schemas.TokenResponse(
        access_token=token,
        role="admin",
        user_id=user.id,
        full_name=user.full_name,
    )
