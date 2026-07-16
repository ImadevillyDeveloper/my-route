import os, random
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..storage import save_upload

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
    filename = f"user_{current_user.id}_{random.randint(1000,9999)}{ext}"
    current_user.avatar_url = save_upload(file.file, filename, file.content_type or "image/jpeg")
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
    if update.rival_routes_json is not None:
        current_user.rival_routes_json = update.rival_routes_json
    if update.active_shift_start is not None:
        current_user.active_shift_start = update.active_shift_start
    if update.active_direction is not None:
        current_user.active_direction = update.active_direction
    if update.hints_enabled is not None:
        current_user.hints_enabled = update.hints_enabled
    if update.voice_enabled is not None:
        current_user.voice_enabled = update.voice_enabled
    if update.active_trip_id is not None:
        current_user.active_trip_id = update.active_trip_id
    if update.terminal_stops_json is not None:
        current_user.terminal_stops_json = update.terminal_stops_json
    db.commit()
    db.refresh(current_user)
    return current_user
