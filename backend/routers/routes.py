from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("", response_model=list[schemas.RouteOut])
def list_routes(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.Route).all()


@router.post("", response_model=schemas.RouteOut, status_code=201)
def create_route(
    route_in: schemas.RouteCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = models.Route(**route_in.model_dump(), owner_id=current_user.id)
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


@router.get("/{route_id}", response_model=schemas.RouteOut)
def get_route(
    route_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(models.Route).filter(models.Route.id == route_id).first()
    if not route:
        raise HTTPException(404, "Route not found")
    return route


@router.put("/{route_id}", response_model=schemas.RouteOut)
def update_route(
    route_id: int,
    update: schemas.RouteUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(models.Route).filter(models.Route.id == route_id).first()
    if not route:
        raise HTTPException(404, "Route not found")
    for k, v in update.model_dump(exclude_none=True).items():
        setattr(route, k, v)
    db.commit()
    db.refresh(route)
    return route


@router.delete("/{route_id}", status_code=204)
def delete_route(
    route_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    route = db.query(models.Route).filter(models.Route.id == route_id).first()
    if not route:
        raise HTTPException(404, "Route not found")
    db.delete(route)
    db.commit()
