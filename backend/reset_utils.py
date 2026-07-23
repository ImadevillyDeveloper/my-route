"""Общие для backend и support_bot.py вещи для восстановления пароля.

Отдельный модуль, а не часть auth.py, потому что support_bot.py — самостоятельный
процесс (не FastAPI-приложение), и ему нужны только эти функции, без всего
остального, что тянет за собой backend.routers.auth (там завязка на FastAPI).
"""

import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from . import models

RESET_CODE_TTL_MINUTES = 10


def normalize_phone(raw: str) -> str:
    """"+7 (900) 123-45-67" / "89001234567" / "79001234567" -> "79001234567" —
    приводим восьмёрку в начале к семёрке, убираем всё, кроме цифр, чтобы
    сравнивать номера из разных источников (форма ввода, карточка водителя,
    Telegram-контакт) без учёта форматирования."""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    return digits


def find_user_by_phone(db: Session, raw_phone: str) -> Optional[models.User]:
    target = normalize_phone(raw_phone)
    if not target:
        return None
    for u in db.query(models.User).filter(models.User.phone.isnot(None)).all():
        if normalize_phone(u.phone) == target:
            return u
    return None


def find_user_by_role_identifier(db: Session, role: str, identifier: str) -> Optional[models.User]:
    """identifier — driver_id для водителя, телефон для ИП (как на экране входа)."""
    if role == "driver":
        return db.query(models.User).filter(
            models.User.driver_id == identifier.strip(),
            models.User.role == models.UserRole.driver,
        ).first()
    if role == "entrepreneur":
        return find_user_by_phone(db, identifier)
    return None


def generate_reset_code(user: models.User) -> str:
    code = f"{random.randint(0, 999999):06d}"
    user.reset_code = code
    user.reset_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_CODE_TTL_MINUTES)
    return code


def check_reset_code(user: models.User, code: str) -> bool:
    if not user.reset_code or not user.reset_code_expires_at:
        return False
    expires = user.reset_code_expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        return False
    return user.reset_code == code.strip()
