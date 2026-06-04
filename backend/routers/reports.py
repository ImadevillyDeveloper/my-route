import os, shutil, random
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import Optional
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/scan", response_model=schemas.ScanResult)
async def scan_receipt(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename)[1]
    fname = f"{UPLOAD_DIR}/receipt_{current_user.id}_{random.randint(1000,9999)}{ext}"
    with open(fname, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return schemas.ScanResult(
        route_number="212",
        shift_date=str(date.today()),
        total_revenue=round(random.uniform(3000, 8000), 2),
        total_trips=random.randint(8, 20),
    )


@router.post("", response_model=schemas.ReportOut, status_code=201)
def create_report(
    report_in: schemas.ReportCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = models.Report(
        driver_id=current_user.id,
        owner_id=current_user.owner_id,
        **report_in.model_dump(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _report_out(report, db)


@router.get("", response_model=list[schemas.ReportOut])
def list_reports(
    driver_id: Optional[int] = None,
    status: Optional[str] = None,
    period: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(models.Report)
    if current_user.role == models.UserRole.driver:
        q = q.filter(models.Report.driver_id == current_user.id)
    elif current_user.role == models.UserRole.entrepreneur:
        q = q.filter(models.Report.owner_id == current_user.id)
    if driver_id:
        q = q.filter(models.Report.driver_id == driver_id)
    if status:
        q = q.filter(models.Report.status == status)
    if period:
        q = q.filter(models.Report.shift_date.like(f"{period}%"))
    reports = q.order_by(models.Report.created_at.desc()).all()
    return [_report_out(r, db) for r in reports]


@router.get("/{report_id}", response_model=schemas.ReportOut)
def get_report(
    report_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    return _report_out(report, db)


@router.put("/{report_id}/status", response_model=schemas.ReportOut)
def update_report_status(
    report_id: int,
    update: schemas.ReportStatusUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = update.status
    report.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)
    return _report_out(report, db)


@router.put("/{report_id}/adjust", response_model=schemas.ReportOut)
def adjust_report(
    report_id: int,
    update: schemas.ReportAdjust,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    report.status = update.status
    if update.notes is not None:
        report.notes = update.notes
    report.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)
    return _report_out(report, db)


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.query(models.Report).filter(models.Report.id == report_id).first()
    if not report:
        raise HTTPException(404, "Report not found")
    db.delete(report)
    db.commit()


def _report_out(report: models.Report, db: Session) -> schemas.ReportOut:
    driver = db.query(models.User).filter(models.User.id == report.driver_id).first()
    return schemas.ReportOut(
        id=report.id,
        driver_id=report.driver_id,
        route_number=report.route_number,
        shift_date=report.shift_date,
        shift_start=report.shift_start,
        shift_end=report.shift_end,
        total_trips=report.total_trips,
        total_revenue=report.total_revenue,
        fuel_cost=report.fuel_cost,
        notes=report.notes,
        receipt_image_url=report.receipt_image_url,
        status=report.status,
        created_at=report.created_at,
        reviewed_at=report.reviewed_at,
        driver_name=driver.full_name if driver else None,
    )
