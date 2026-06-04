import os, shutil, random
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

UPLOAD_DIR = "uploads"

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.post("/me/photo", response_model=schemas.UserOut)
async def upload_my_photo(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    fname = f"{UPLOAD_DIR}/user_{current_user.id}_{random.randint(1000,9999)}{ext}"
    with open(fname, "wb") as f:
        shutil.copyfileobj(file.file, f)
    current_user.avatar_url = f"/{fname}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me", response_model=schemas.UserOut)
def update_me(
    update: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if update.full_name is not None:
        current_user.full_name = update.full_name
    if update.biometric_enabled is not None:
        current_user.biometric_enabled = update.biometric_enabled
    if update.avatar_url is not None:
        current_user.avatar_url = update.avatar_url
    db.commit()
    db.refresh(current_user)
    return current_user
