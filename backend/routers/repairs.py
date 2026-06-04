from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/repairs", tags=["repairs"])


@router.post("", response_model=schemas.RepairOut, status_code=201)
def create_repair(
    repair_in: schemas.RepairCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    repair = models.Repair(
        vehicle_id=repair_in.vehicle_id,
        repair_type=repair_in.repair_type,
        cost=repair_in.cost,
        description=repair_in.comment,
        date=repair_in.date or date.today(),
    )
    db.add(repair)
    db.commit()
    db.refresh(repair)
    return repair
