import io
import os
import random
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..storage import save_upload
from ..push import send_push

router = APIRouter(prefix="/chat", tags=["chat"])

DELETED_PLACEHOLDER = "Сообщение удалено"
ONLINE_THRESHOLD = timedelta(seconds=45)
MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024  # 20 MB
ATTACHMENT_KINDS = {"image", "file", "voice", "video_note"}


def _presence(user: models.User) -> tuple[bool, "datetime | None"]:
    last_seen = user.last_seen_at
    if not last_seen:
        return False, None
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=timezone.utc)
    online = (datetime.now(timezone.utc) - last_seen) <= ONLINE_THRESHOLD
    return online, user.last_seen_at


def _hidden_message_ids(user_id: int, db: Session):
    return db.query(models.ChatMessageHidden.message_id).filter(
        models.ChatMessageHidden.user_id == user_id
    ).scalar_subquery()


def _dm_key(user_a_id: int, user_b_id: int) -> str:
    a, b = sorted([user_a_id, user_b_id])
    return f"dm:{a}:{b}"


def _is_route_removed(route: str, user_id: int, db: Session) -> bool:
    return db.query(models.ChatGroupRemoved).filter_by(
        conversation_key=f"route:{route}", user_id=user_id
    ).first() is not None


def _can_access(key: str, user: models.User, db: Session) -> bool:
    if key.startswith("route:"):
        route = key.split(":", 1)[1]
        if user.role == models.UserRole.driver:
            if not route or user.route_number != route:
                return False
            return not _is_route_removed(route, user.id, db)
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


def _notify_new_message(key: str, sender: models.User, preview: str, db: Session) -> None:
    """Кому слать push о новом сообщении в этом чате — переиспользует
    _conversation_recipients(key, sender_id, db) ниже по файлу (уже учитывает
    ChatGroupRemoved и т.п.), просто дотягивает push_token по id."""
    recipient_ids = _conversation_recipients(key, sender.id, db)
    if not recipient_ids:
        return
    users = db.query(models.User).filter(models.User.id.in_(recipient_ids)).all()
    for user in users:
        send_push(user.push_token, sender.full_name, preview[:120], {"conversation_key": key})


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


def _conversation_recipients(key: str, sender_id: int, db: Session) -> list[int]:
    """Everyone in the conversation other than the sender (recipients of a 'read' receipt)."""
    if key.startswith("dm:"):
        parts = key.split(":")
        if len(parts) != 3:
            return []
        try:
            ids = {int(parts[1]), int(parts[2])}
        except ValueError:
            return []
        ids.discard(sender_id)
        return list(ids)
    if key.startswith("route:"):
        route = key.split(":", 1)[1]
        removed_ids = {
            r.user_id for r in db.query(models.ChatGroupRemoved).filter_by(conversation_key=key).all()
        }
        drivers = db.query(models.User).filter(
            models.User.role == models.UserRole.driver,
            models.User.route_number == route,
            ~models.User.id.in_(removed_ids),
        ).all()
        owner_ids = {d.owner_id for d in drivers if d.owner_id}
        ids = {d.id for d in drivers} | owner_ids
        ids.discard(sender_id)
        return list(ids)
    return []


def _all_read_at(key: str, sender_id: int, db: Session) -> "datetime | None":
    """The earliest time by which every recipient had read the conversation, or None if
    at least one recipient hasn't read it yet (or never has)."""
    recipient_ids = _conversation_recipients(key, sender_id, db)
    if not recipient_ids:
        return None
    reads = db.query(models.ChatRead).filter(
        models.ChatRead.conversation_key == key,
        models.ChatRead.user_id.in_(recipient_ids),
    ).all()
    if len(reads) < len(recipient_ids):
        return None
    return min(r.last_read_at for r in reads)


def _attachment_preview(attachment_type: "str | None") -> str:
    return {
        "image": "📷 Фото",
        "file": "📎 Файл",
        "voice": "🎤 Голосовое сообщение",
        "video_note": "📹 Видеосообщение",
    }.get(attachment_type or "", "")


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
        if current_user.route_number and not _is_route_removed(current_user.route_number, current_user.id, db):
            key = f"route:{current_user.route_number}"
            convs.append({"key": key, "type": "route", "title": f"Маршрут №{current_user.route_number}"})
        if current_user.owner_id:
            owner = db.query(models.User).filter_by(id=current_user.owner_id).first()
            if owner:
                key = _dm_key(current_user.id, owner.id)
                online, last_seen_at = _presence(owner)
                convs.append({
                    "key": key, "type": "dm", "title": owner.full_name, "other_user_id": owner.id,
                    "avatar_url": owner.avatar_url, "online": online, "last_seen_at": last_seen_at,
                })

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
            online, last_seen_at = _presence(other)
            convs.append({
                "key": k, "type": "dm", "title": other.full_name, "other_user_id": other.id,
                "avatar_url": other.avatar_url, "online": online, "last_seen_at": last_seen_at,
            })
            seen_keys.add(k)
    else:
        drivers = db.query(models.User).filter_by(owner_id=current_user.id, role=models.UserRole.driver).all()
        routes = sorted({d.route_number for d in drivers if d.route_number})
        for route in routes:
            key = f"route:{route}"
            convs.append({"key": key, "type": "route", "title": f"Маршрут №{route}"})
        for d in drivers:
            key = _dm_key(current_user.id, d.id)
            online, last_seen_at = _presence(d)
            convs.append({
                "key": key, "type": "dm", "title": d.full_name, "other_user_id": d.id,
                "avatar_url": d.avatar_url, "online": online, "last_seen_at": last_seen_at,
            })

    states = {
        s.conversation_key: s
        for s in db.query(models.ChatUserState).filter_by(user_id=current_user.id).all()
    }
    group_keys = [c["key"] for c in convs if c["type"] == "route"]
    groups = {
        g.conversation_key: g
        for g in db.query(models.ChatGroup).filter(models.ChatGroup.conversation_key.in_(group_keys)).all()
    } if group_keys else {}

    hidden_sub = _hidden_message_ids(current_user.id, db)

    visible: list[dict] = []
    for c in convs:
        if c["type"] == "route" and c["key"] in groups:
            c["avatar_url"] = groups[c["key"]].avatar_url
            if groups[c["key"]].title:
                c["title"] = groups[c["key"]].title
        c["unread"] = _unread_count(current_user.id, c["key"], db)

        state = states.get(c["key"])

        last_q = (
            db.query(models.ChatMessage)
            .filter(models.ChatMessage.conversation_key == c["key"])
            .filter(~models.ChatMessage.id.in_(hidden_sub))
        )
        if state and state.cleared_at:
            last_q = last_q.filter(models.ChatMessage.created_at > state.cleared_at)
        last = last_q.order_by(models.ChatMessage.created_at.desc()).first()
        if last:
            c["last_message"] = DELETED_PLACEHOLDER if last.deleted_at else (last.text or _attachment_preview(last.attachment_type))
            c["last_message_at"] = last.created_at

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
    if body.hidden and body.conversation_key.startswith("route:"):
        raise HTTPException(400, "Общий чат маршрута нельзя удалить, только очистить у себя")

    row = db.query(models.ChatUserState).filter_by(
        user_id=current_user.id, conversation_key=body.conversation_key
    ).first()
    if not row:
        row = models.ChatUserState(user_id=current_user.id, conversation_key=body.conversation_key)
        db.add(row)

    if body.pinned is not None:
        row.pinned = body.pinned
    if body.hidden is not None:
        if body.hidden:
            now = datetime.now(timezone.utc)
            row.hidden_at = now
            row.cleared_at = now  # deleting a chat also clears its history for the deleter only
        else:
            row.hidden_at = None
    if body.clear:
        row.cleared_at = datetime.now(timezone.utc)

    db.commit()
    if body.clear or body.hidden:
        _mark_read(current_user.id, body.conversation_key, db)
    return {"ok": True}


@router.get("/route-members", response_model=list[schemas.ChatRouteMemberOut])
def list_route_members(
    route_number: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not _can_access(f"route:{route_number}", current_user, db):
        raise HTTPException(403, "Нет доступа к этому маршруту")

    removed_ids = {
        r.user_id for r in db.query(models.ChatGroupRemoved).filter_by(
            conversation_key=f"route:{route_number}"
        ).all()
    }
    drivers = db.query(models.User).filter(
        models.User.role == models.UserRole.driver,
        models.User.route_number == route_number,
        ~models.User.id.in_(removed_ids),
    ).all()
    admin_ids = {
        a.user_id for a in db.query(models.ChatGroupAdmin).filter_by(
            conversation_key=f"route:{route_number}"
        ).all()
    }

    owner_ids = {d.owner_id for d in drivers if d.owner_id}
    owners = db.query(models.User).filter(models.User.id.in_(owner_ids)).all() if owner_ids else []

    result: list[schemas.ChatRouteMemberOut] = []
    for o in owners:
        is_me = o.id == current_user.id
        online, last_seen_at = _presence(o)
        result.append(schemas.ChatRouteMemberOut(
            id=o.id, full_name=o.full_name, avatar_url=o.avatar_url,
            dm_key="" if is_me else _dm_key(current_user.id, o.id),
            is_admin=True, is_owner=True, is_me=is_me,
            online=online, last_seen_at=last_seen_at,
        ))
    for m in drivers:
        is_me = m.id == current_user.id
        online, last_seen_at = _presence(m)
        result.append(schemas.ChatRouteMemberOut(
            id=m.id, full_name=m.full_name, avatar_url=m.avatar_url,
            dm_key="" if is_me else _dm_key(current_user.id, m.id),
            is_admin=m.id in admin_ids, is_owner=False, is_me=is_me,
            online=online, last_seen_at=last_seen_at,
        ))
    return result


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
        title=group.title if group else None,
        is_admin=_is_route_admin(route, current_user, db),
        is_owner=_is_route_owner(route, current_user, db),
    )


@router.put("/group", response_model=schemas.ChatGroupOut)
def update_group_title(
    body: schemas.ChatGroupTitleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not body.conversation_key.startswith("route:"):
        raise HTTPException(400, "Настройки группы доступны только для чата маршрута")
    route = body.conversation_key.split(":", 1)[1]
    if not _is_route_admin(route, current_user, db):
        raise HTTPException(403, "Изменять название группы может только администратор")

    title = body.title.strip()
    if not title:
        raise HTTPException(400, "Название не может быть пустым")

    group = db.query(models.ChatGroup).filter_by(conversation_key=body.conversation_key).first()
    if not group:
        group = models.ChatGroup(conversation_key=body.conversation_key)
        db.add(group)
    group.title = title
    db.commit()

    return schemas.ChatGroupOut(
        conversation_key=body.conversation_key,
        avatar_url=group.avatar_url,
        title=group.title,
        is_admin=True,
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
        title=group.title,
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


@router.delete("/group/members/{user_id}")
def remove_group_member(
    user_id: int,
    conversation_key: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not conversation_key.startswith("route:"):
        raise HTTPException(400, "Доступно только для чата маршрута")
    route = conversation_key.split(":", 1)[1]
    if not _is_route_admin(route, current_user, db):
        raise HTTPException(403, "Удалять участников может только администратор группы")
    if user_id == current_user.id:
        raise HTTPException(400, "Нельзя удалить самого себя")

    target = db.query(models.User).filter_by(
        id=user_id, role=models.UserRole.driver, route_number=route
    ).first()
    if not target:
        raise HTTPException(404, "Водитель не найден на этом маршруте")

    exists = db.query(models.ChatGroupRemoved).filter_by(
        conversation_key=conversation_key, user_id=user_id
    ).first()
    if not exists:
        db.add(models.ChatGroupRemoved(conversation_key=conversation_key, user_id=user_id))
    db.query(models.ChatGroupAdmin).filter_by(
        conversation_key=conversation_key, user_id=user_id
    ).delete()
    db.commit()
    return {"ok": True}


def _message_out(
    m: models.ChatMessage,
    current_user: models.User,
    avatar_url: str | None = None,
    all_read_at: "datetime | None" = None,
    reply_to: "models.ChatMessage | None" = None,
) -> schemas.ChatMessageOut:
    deleted = m.deleted_at is not None
    mine = m.sender_id == current_user.id

    reply_deleted = False
    reply_sender_name = None
    reply_text = None
    if reply_to is not None:
        reply_deleted = reply_to.deleted_at is not None
        reply_sender_name = reply_to.sender_name
        reply_text = DELETED_PLACEHOLDER if reply_deleted else (reply_to.text or _attachment_preview(reply_to.attachment_type))

    return schemas.ChatMessageOut(
        id=m.id,
        conversation_key=m.conversation_key,
        sender_id=m.sender_id,
        sender_name=m.sender_name,
        sender_role=m.sender_role,
        sender_avatar_url=avatar_url,
        text="" if deleted else m.text,
        created_at=m.created_at,
        mine=mine,
        edited=m.edited_at is not None,
        deleted=deleted,
        read=bool(mine and all_read_at and m.created_at <= all_read_at),
        attachment_url=None if deleted else m.attachment_url,
        attachment_type=None if deleted else m.attachment_type,
        attachment_name=None if deleted else m.attachment_name,
        attachment_size=None if deleted else m.attachment_size,
        attachment_duration=None if deleted else m.attachment_duration,
        reply_to_id=None if deleted else m.reply_to_id,
        reply_to_sender_name=None if deleted else reply_sender_name,
        reply_to_text=None if deleted else reply_text,
        reply_to_deleted=reply_deleted,
    )


@router.get("/messages", response_model=list[schemas.ChatMessageOut])
def get_messages(
    conversation_key: str = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not _can_access(conversation_key, current_user, db):
        raise HTTPException(403, "Нет доступа к этому чату")

    hidden_sub = _hidden_message_ids(current_user.id, db)
    state = db.query(models.ChatUserState).filter_by(
        user_id=current_user.id, conversation_key=conversation_key
    ).first()

    q = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.conversation_key == conversation_key)
        .filter(~models.ChatMessage.id.in_(hidden_sub))
    )
    if state and state.cleared_at:
        q = q.filter(models.ChatMessage.created_at > state.cleared_at)
    msgs = q.order_by(models.ChatMessage.created_at.asc()).limit(300).all()
    _mark_read(current_user.id, conversation_key, db)

    sender_ids = {m.sender_id for m in msgs}
    avatars = {
        u.id: u.avatar_url
        for u in db.query(models.User).filter(models.User.id.in_(sender_ids)).all()
    } if sender_ids else {}
    all_read_at = _all_read_at(conversation_key, current_user.id, db)

    reply_ids = {m.reply_to_id for m in msgs if m.reply_to_id}
    replies = {
        r.id: r for r in db.query(models.ChatMessage).filter(models.ChatMessage.id.in_(reply_ids)).all()
    } if reply_ids else {}

    return [
        _message_out(m, current_user, avatars.get(m.sender_id), all_read_at, replies.get(m.reply_to_id))
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

    reply_to = None
    if body.reply_to_id is not None:
        reply_to = db.query(models.ChatMessage).filter_by(
            id=body.reply_to_id, conversation_key=body.conversation_key
        ).first()

    msg = models.ChatMessage(
        conversation_key=body.conversation_key,
        sender_id=current_user.id,
        sender_name=current_user.full_name,
        sender_role=current_user.role,
        text=text,
        reply_to_id=reply_to.id if reply_to else None,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    _mark_read(current_user.id, body.conversation_key, db)
    _notify_new_message(body.conversation_key, current_user, text, db)

    return _message_out(msg, current_user, current_user.avatar_url, reply_to=reply_to)


@router.post("/messages/upload", response_model=schemas.ChatMessageOut, status_code=201)
async def upload_chat_attachment(
    conversation_key: str = Form(...),
    kind: str = Form(...),
    caption: str = Form(""),
    duration: int | None = Form(None),
    reply_to_id: int | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if kind not in ATTACHMENT_KINDS:
        raise HTTPException(400, "Неверный тип вложения")
    if not _can_access(conversation_key, current_user, db):
        raise HTTPException(403, "Нет доступа к этому чату")

    reply_to = None
    if reply_to_id is not None:
        reply_to = db.query(models.ChatMessage).filter_by(
            id=reply_to_id, conversation_key=conversation_key
        ).first()

    caption = caption.strip()
    if len(caption) > 2000:
        raise HTTPException(400, "Слишком длинная подпись")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Пустой файл")
    if len(data) > MAX_ATTACHMENT_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 20 МБ)")

    ext = os.path.splitext(file.filename or "")[1]
    if not ext:
        ext = {"image": ".jpg", "voice": ".webm", "video_note": ".webm"}.get(kind, "")
    filename = f"chat_{current_user.id}_{int(datetime.now(timezone.utc).timestamp())}_{random.randint(1000, 9999)}{ext}"
    attachment_url = save_upload(io.BytesIO(data), filename, file.content_type or "application/octet-stream")

    msg = models.ChatMessage(
        conversation_key=conversation_key,
        sender_id=current_user.id,
        sender_name=current_user.full_name,
        sender_role=current_user.role,
        text=caption,
        attachment_url=attachment_url,
        attachment_type=kind,
        attachment_name=file.filename if kind == "file" else None,
        attachment_size=len(data) if kind == "file" else None,
        attachment_duration=duration if kind in ("voice", "video_note") else None,
        reply_to_id=reply_to.id if reply_to else None,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    _mark_read(current_user.id, conversation_key, db)
    attachment_labels = {"image": "📷 Фото", "file": "📎 Файл", "voice": "🎤 Голосовое", "video_note": "📹 Видео"}
    _notify_new_message(conversation_key, current_user, caption or attachment_labels.get(kind, "Вложение"), db)

    return _message_out(msg, current_user, current_user.avatar_url, reply_to=reply_to)


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

    all_read_at = _all_read_at(msg.conversation_key, current_user.id, db)
    reply_to = db.query(models.ChatMessage).filter_by(id=msg.reply_to_id).first() if msg.reply_to_id else None
    return _message_out(msg, current_user, current_user.avatar_url, all_read_at, reply_to)


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    for_everyone: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = db.query(models.ChatMessage).filter_by(id=message_id).first()
    if not msg:
        raise HTTPException(404, "Сообщение не найдено")

    if for_everyone:
        if msg.deleted_at is not None:
            raise HTTPException(404, "Сообщение не найдено")
        if msg.sender_id != current_user.id:
            raise HTTPException(403, "Можно удалять для всех только свои сообщения")
        msg.deleted_at = datetime.now(timezone.utc)
        db.commit()
    else:
        if not _can_access(msg.conversation_key, current_user, db):
            raise HTTPException(403, "Нет доступа к этому чату")
        exists = db.query(models.ChatMessageHidden).filter_by(
            user_id=current_user.id, message_id=message_id
        ).first()
        if not exists:
            db.add(models.ChatMessageHidden(user_id=current_user.id, message_id=message_id))
            db.commit()

    return {"ok": True}
