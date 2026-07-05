import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from . import models
from .database import get_db

SECRET_KEY = os.environ.get("SECRET_KEY", "marshrut-secret-key-2025-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)

PRESENCE_UPDATE_INTERVAL = timedelta(seconds=20)  # throttle last_seen_at writes


def _touch_last_seen(user: models.User, db: Session) -> None:
    now = datetime.now(timezone.utc)
    last_seen = user.last_seen_at
    if last_seen is not None and last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    if last_seen is None or (now - last_seen) > PRESENCE_UPDATE_INTERVAL:
        user.last_seen_at = now
        db.commit()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    _touch_last_seen(user, db)
    return user


def get_current_driver(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != models.UserRole.driver:
        raise HTTPException(status_code=403, detail="Driver access required")
    return current_user


def get_current_entrepreneur(current_user: models.User = Depends(get_current_user)) -> models.User:
    if current_user.role != models.UserRole.entrepreneur:
        raise HTTPException(status_code=403, detail="Entrepreneur access required")
    return current_user
