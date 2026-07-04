from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


def _dm_key(user_a_id: int, user_b_id: int) -> str:
    a, b = sorted([user_a_id, user_b_id])
    return f"dm:{a}:{b}"


def _can_access(key: str, user: models.User, db: Session) -> bool:
    if key.startswith("route:"):
        route = key.split(":", 1)[1]
        if user.role == models.UserRole.driver:
            return bool(route) and user.route_number == route
        return db.query(models.User).filter_by(
            owner_id=user.id, role=models.UserRole.driver, route_number=route
        ).first() is not None

    if key.startswith("dm:"):
        parts = key.split(":")
        if len(parts) != 3:
            return False
        try:
            ids = {int(parts[1]), int(parts[2])}
        except ValueError:
            return False
        if user.id not in ids:
            return False
        other_id = next(iter(ids - {user.id}))
        other = db.query(models.User).filter_by(id=other_id).first()
        if not other:
            return False
        if user.role == models.UserRole.driver:
            return user.owner_id == other.id and other.role == models.UserRole.entrepreneur
        return other.owner_id == user.id and other.role == models.UserRole.driver

    return False


def _mark_read(user_id: int, key: str, db: Session) -> None:
    row = db.query(models.ChatRead).filter_by(user_id=user_id, conversation_key=key).first()
    now = datetime.now(timezone.utc)
    if row:
        row.last_read_at = now
    else:
        db.add(models.ChatRead(user_id=user_id, conversation_key=key, last_read_at=now))
    db.commit()


def _unread_count(user_id: int, key: str, db: Session) -> int:
    read_row = db.query(models.ChatRead).filter_by(user_id=user_id, conversation_key=key).first()
    q = db.query(models.ChatMessage).filter(
        models.ChatMessage.conversation_key == key,
        models.ChatMessage.sender_id != user_id,
    )
    if read_row:
        q = q.filter(models.ChatMessage.created_at > read_row.last_read_at)
    return q.count()


@router.get("/conversations", response_model=list[schemas.ChatConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    convs: list[dict] = []

    if current_user.role == models.UserRole.driver:
        if current_user.route_number:
            key = f"route:{current_user.route_number}"
            convs.append({"key": key, "type": "route", "title": f"Маршрут №{current_user.route_number}"})
        if current_user.owner_id:
            owner = db.query(models.User).filter_by(id=current_user.owner_id).first()
            if owner:
                key = _dm_key(current_user.id, owner.id)
                convs.append({"key": key, "type": "dm", "title": owner.full_name, "other_user_id": owner.id})
    else:
        drivers = db.query(models.User).filter_by(owner_id=current_user.id, role=models.UserRole.driver).all()
        routes = sorted({d.route_number for d in drivers if d.route_number})
        for route in routes:
            key = f"route:{route}"
            convs.append({"key": key, "type": "route", "title": f"Маршрут №{route}"})
        for d in drivers:
            key = _dm_key(current_user.id, d.id)
            convs.append({"key": key, "type": "dm", "title": d.full_name, "other_user_id": d.id})

    for c in convs:
        c["unread"] = _unread_count(current_user.id, c["key"], db)
        last = (
            db.query(models.ChatMessage)
            .filter_by(conversation_key=c["key"])
            .order_by(models.ChatMessage.created_at.desc())
            .first()
        )
        if last:
            c["last_message"] = last.text
            c["last_message_at"] = last.created_at

    convs.sort(key=lambda c: c["last_message_at"].timestamp() if c.get("last_message_at") else -1, reverse=True)
    return convs


@router.get("/messages", response_model=list[schemas.ChatMessageOut])
def get_messages(
    conversation_key: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not _can_access(conversation_key, current_user, db):
        raise HTTPException(403, "Нет доступа к этому чату")

    msgs = (
        db.query(models.ChatMessage)
        .filter_by(conversation_key=conversation_key)
        .order_by(models.ChatMessage.created_at.asc())
        .limit(300)
        .all()
    )
    _mark_read(current_user.id, conversation_key, db)

    return [
        schemas.ChatMessageOut(
            id=m.id,
            conversation_key=m.conversation_key,
            sender_id=m.sender_id,
            sender_name=m.sender_name,
            sender_role=m.sender_role,
            text=m.text,
            created_at=m.created_at,
            mine=(m.sender_id == current_user.id),
        )
        for m in msgs
    ]


@router.post("/messages", response_model=schemas.ChatMessageOut, status_code=201)
def post_message(
    body: schemas.ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Пустое сообщение")
    if len(text) > 2000:
        raise HTTPException(400, "Слишком длинное сообщение")
    if not _can_access(body.conversation_key, current_user, db):
        raise HTTPException(403, "Нет доступа к этому чату")

    msg = models.ChatMessage(
        conversation_key=body.conversation_key,
        sender_id=current_user.id,
        sender_name=current_user.full_name,
        sender_role=current_user.role,
        text=text,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    _mark_read(current_user.id, body.conversation_key, db)

    return schemas.ChatMessageOut(
        id=msg.id,
        conversation_key=msg.conversation_key,
        sender_id=msg.sender_id,
        sender_name=msg.sender_name,
        sender_role=msg.sender_role,
        text=msg.text,
        created_at=msg.created_at,
        mine=True,
    )
