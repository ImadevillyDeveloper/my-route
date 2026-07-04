import os
import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..storage import save_upload

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
            if other.role == models.UserRole.entrepreneur:
                return user.owner_id == other.id
            if other.role == models.UserRole.driver:
                return bool(user.route_number) and user.route_number == other.route_number
            return False
        return other.owner_id == user.id and other.role == models.UserRole.driver

    return False


def _is_route_owner(route: str, user: models.User, db: Session) -> bool:
    """The entrepreneur who has at least one driver on this route."""
    if user.role != models.UserRole.entrepreneur:
        return False
    return db.query(models.User).filter_by(
        owner_id=user.id, role=models.UserRole.driver, route_number=route
    ).first() is not None


def _is_route_admin(route: str, user: models.User, db: Session) -> bool:
    if _is_route_owner(route, user, db):
        return True
    return db.query(models.ChatGroupAdmin).filter_by(
        conversation_key=f"route:{route}", user_id=user.id
    ).first() is not None


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
                convs.append({"key": key, "type": "dm", "title": owner.full_name, "other_user_id": owner.id, "avatar_url": owner.avatar_url})

        # Driver<->driver DMs that already have messages (started from the route member list)
        seen_keys = {c["key"] for c in convs}
        dm_keys = (
            db.query(models.ChatMessage.conversation_key)
            .filter(models.ChatMessage.conversation_key.like("dm:%"))
            .distinct()
            .all()
        )
        for (k,) in dm_keys:
            if k in seen_keys:
                continue
            parts = k.split(":")
            if len(parts) != 3:
                continue
            try:
                ids = {int(parts[1]), int(parts[2])}
            except ValueError:
                continue
            if current_user.id not in ids:
                continue
            other_id = next(iter(ids - {current_user.id}))
            other = db.query(models.User).filter_by(id=other_id, role=models.UserRole.driver).first()
            if not other or not current_user.route_number or other.route_number != current_user.route_number:
                continue
            convs.append({"key": k, "type": "dm", "title": other.full_name, "other_user_id": other.id, "avatar_url": other.avatar_url})
            seen_keys.add(k)
    else:
        drivers = db.query(models.User).filter_by(owner_id=current_user.id, role=models.UserRole.driver).all()
        routes = sorted({d.route_number for d in drivers if d.route_number})
        for route in routes:
            key = f"route:{route}"
            convs.append({"key": key, "type": "route", "title": f"Маршрут №{route}"})
        for d in drivers:
            key = _dm_key(current_user.id, d.id)
            convs.append({"key": key, "type": "dm", "title": d.full_name, "other_user_id": d.id, "avatar_url": d.avatar_url})

    states = {
        s.conversation_key: s
        for s in db.query(models.ChatUserState).filter_by(user_id=current_user.id).all()
    }
    group_keys = [c["key"] for c in convs if c["type"] == "route"]
    groups = {
        g.conversation_key: g
        for g in db.query(models.ChatGroup).filter(models.ChatGroup.conversation_key.in_(group_keys)).all()
    } if group_keys else {}

    visible: list[dict] = []
    for c in convs:
        if c["type"] == "route" and c["key"] in groups:
            c["avatar_url"] = groups[c["key"]].avatar_url
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

        state = states.get(c["key"])

        # "Deleted" chats stay hidden until a new message arrives after the delete.
        if state and state.hidden_at and (not last or last.created_at <= state.hidden_at):
            continue

        default_pinned = c["type"] == "route"
        c["pinned"] = state.pinned if (state and state.pinned is not None) else default_pinned
        visible.append(c)

    visible.sort(key=lambda c: (
        not c["pinned"],
        -(c["last_message_at"].timestamp() if c.get("last_message_at") else -1),
    ))
    return visible


@router.put("/conversations/state")
def set_conversation_state(
    body: schemas.ChatConversationStateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not _can_access(body.conversation_key, current_user, db):
        raise HTTPException(403, "Нет доступа к этому чату")

    row = db.query(models.ChatUserState).filter_by(
        user_id=current_user.id, conversation_key=body.conversation_key
    ).first()
    if not row:
        row = models.ChatUserState(user_id=current_user.id, conversation_key=body.conversation_key)
        db.add(row)

    if body.pinned is not None:
        row.pinned = body.pinned
    if body.hidden is not None:
        row.hidden_at = datetime.now(timezone.utc) if body.hidden else None

    db.commit()
    return {"ok": True}


@router.get("/route-members", response_model=list[schemas.ChatRouteMemberOut])
def list_route_members(
    route_number: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not _can_access(f"route:{route_number}", current_user, db):
        raise HTTPException(403, "Нет доступа к этому маршруту")

    members = db.query(models.User).filter(
        models.User.role == models.UserRole.driver,
        models.User.route_number == route_number,
        models.User.id != current_user.id,
    ).all()
    admin_ids = {
        a.user_id for a in db.query(models.ChatGroupAdmin).filter_by(
            conversation_key=f"route:{route_number}"
        ).all()
    }
    return [
        schemas.ChatRouteMemberOut(
            id=m.id, full_name=m.full_name, avatar_url=m.avatar_url,
            dm_key=_dm_key(current_user.id, m.id), is_admin=m.id in admin_ids, is_owner=False,
        )
        for m in members
    ]


@router.get("/group", response_model=schemas.ChatGroupOut)
def get_group(
    conversation_key: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not conversation_key.startswith("route:"):
        raise HTTPException(400, "Настройки группы доступны только для чата маршрута")
    if not _can_access(conversation_key, current_user, db):
        raise HTTPException(403, "Нет доступа к этому чату")

    route = conversation_key.split(":", 1)[1]
    group = db.query(models.ChatGroup).filter_by(conversation_key=conversation_key).first()
    return schemas.ChatGroupOut(
        conversation_key=conversation_key,
        avatar_url=group.avatar_url if group else None,
        is_admin=_is_route_admin(route, current_user, db),
        is_owner=_is_route_owner(route, current_user, db),
    )


@router.post("/group/avatar", response_model=schemas.ChatGroupOut)
async def upload_group_avatar(
    conversation_key: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not conversation_key.startswith("route:"):
        raise HTTPException(400, "Настройки группы доступны только для чата маршрута")
    route = conversation_key.split(":", 1)[1]
    if not _is_route_admin(route, current_user, db):
        raise HTTPException(403, "Изменять аватар группы может только администратор")

    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"group_{route}_{random.randint(1000,9999)}{ext}"
    avatar_url = save_upload(file.file, filename, file.content_type or "image/jpeg")

    group = db.query(models.ChatGroup).filter_by(conversation_key=conversation_key).first()
    if not group:
        group = models.ChatGroup(conversation_key=conversation_key)
        db.add(group)
    group.avatar_url = avatar_url
    db.commit()

    return schemas.ChatGroupOut(
        conversation_key=conversation_key,
        avatar_url=avatar_url,
        is_admin=True,
        is_owner=_is_route_owner(route, current_user, db),
    )


@router.post("/group/admins")
def add_group_admin(
    body: schemas.ChatGroupAdminUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not body.conversation_key.startswith("route:"):
        raise HTTPException(400, "Доступно только для чата маршрута")
    route = body.conversation_key.split(":", 1)[1]
    if not _is_route_owner(route, current_user, db):
        raise HTTPException(403, "Назначать администраторов может только владелец маршрута")

    target = db.query(models.User).filter_by(
        id=body.user_id, role=models.UserRole.driver, route_number=route
    ).first()
    if not target:
        raise HTTPException(404, "Водитель не найден на этом маршруте")

    existing = db.query(models.ChatGroupAdmin).filter_by(
        conversation_key=body.conversation_key, user_id=body.user_id
    ).first()
    if not existing:
        db.add(models.ChatGroupAdmin(conversation_key=body.conversation_key, user_id=body.user_id))
        db.commit()
    return {"ok": True}


@router.delete("/group/admins/{user_id}")
def remove_group_admin(
    user_id: int,
    conversation_key: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not conversation_key.startswith("route:"):
        raise HTTPException(400, "Доступно только для чата маршрута")
    route = conversation_key.split(":", 1)[1]
    if not _is_route_owner(route, current_user, db):
        raise HTTPException(403, "Снимать права администратора может только владелец маршрута")

    db.query(models.ChatGroupAdmin).filter_by(
        conversation_key=conversation_key, user_id=user_id
    ).delete()
    db.commit()
    return {"ok": True}


def _message_out(m: models.ChatMessage, current_user: models.User, avatar_url: str | None = None) -> schemas.ChatMessageOut:
    deleted = m.deleted_at is not None
    return schemas.ChatMessageOut(
        id=m.id,
        conversation_key=m.conversation_key,
        sender_id=m.sender_id,
        sender_name=m.sender_name,
        sender_role=m.sender_role,
        sender_avatar_url=avatar_url,
        text="" if deleted else m.text,
        created_at=m.created_at,
        mine=(m.sender_id == current_user.id),
        edited=m.edited_at is not None,
        deleted=deleted,
    )


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

    sender_ids = {m.sender_id for m in msgs}
    avatars = {
        u.id: u.avatar_url
        for u in db.query(models.User).filter(models.User.id.in_(sender_ids)).all()
    } if sender_ids else {}

    return [_message_out(m, current_user, avatars.get(m.sender_id)) for m in msgs]


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

    return _message_out(msg, current_user, current_user.avatar_url)


@router.put("/messages/{message_id}", response_model=schemas.ChatMessageOut)
def edit_message(
    message_id: int,
    body: schemas.ChatMessageUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Пустое сообщение")
    if len(text) > 2000:
        raise HTTPException(400, "Слишком длинное сообщение")

    msg = db.query(models.ChatMessage).filter_by(id=message_id).first()
    if not msg or msg.deleted_at is not None:
        raise HTTPException(404, "Сообщение не найдено")
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "Можно редактировать только свои сообщения")

    msg.text = text
    msg.edited_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)

    return _message_out(msg, current_user, current_user.avatar_url)


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = db.query(models.ChatMessage).filter_by(id=message_id).first()
    if not msg or msg.deleted_at is not None:
        raise HTTPException(404, "Сообщение не найдено")
    if msg.sender_id != current_user.id:
        raise HTTPException(403, "Можно удалять только свои сообщения")

    msg.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
