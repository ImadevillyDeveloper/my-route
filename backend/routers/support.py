import json as _json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..auth import get_current_user
from .. import models

try:
    import requests as http_req
    _HAS_REQUESTS = True
except ImportError:
    _HAS_REQUESTS = False

router = APIRouter(prefix="/support", tags=["support"])

# ── Telegram config ───────────────────────────────────────────────
TG_BOT_TOKEN = "8740014585:AAF_rzM8A_b27Bj1Fi16e91IV6YoDrkyl1s"
TG_CHAT_ID   = "684779015"
TG_API_URL   = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"


class SupportRequest(BaseModel):
    topic: str
    message: str
    contact: Optional[str] = None


TOPIC_LABELS = {
    "bug":       "🐛 Техническая проблема",
    "question":  "❓ Вопрос",
    "proposal":  "💡 Предложение",
    "other":     "📝 Другое",
}


@router.post("")
def send_support(
    req: SupportRequest,
    current_user: models.User = Depends(get_current_user),
):
    if TG_BOT_TOKEN == "YOUR_BOT_TOKEN":
        raise HTTPException(503, "Telegram не настроен")

    topic_label = TOPIC_LABELS.get(req.topic, req.topic)
    contact = req.contact or current_user.phone or "не указан"
    role_label = "ИП" if current_user.role == models.UserRole.entrepreneur else "Водитель"

    text = (
        f"📩 <b>Новое обращение в поддержку</b>\n\n"
        f"👤 <b>Пользователь:</b> {current_user.full_name} ({role_label})\n"
        f"📞 <b>Контакт:</b> {contact}\n"
        f"🏷 <b>Тема:</b> {topic_label}\n\n"
        f"💬 <b>Сообщение:</b>\n{req.message}"
    )

    if not _HAS_REQUESTS:
        raise HTTPException(503, "requests не установлен")

    try:
        payload = _json.dumps({
            "chat_id": TG_CHAT_ID,
            "text": text,
            "parse_mode": "HTML",
        }, ensure_ascii=False).encode("utf-8")
        r = http_req.post(
            TG_API_URL,
            data=payload,
            headers={"Content-Type": "application/json; charset=utf-8"},
            timeout=8,
        )
        if not r.ok:
            raise HTTPException(502, f"Telegram error: {r.text}")
    except http_req.RequestException as e:
        raise HTTPException(502, f"Ошибка отправки: {e}")

    return {"ok": True}
