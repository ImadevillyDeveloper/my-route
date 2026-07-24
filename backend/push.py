"""Отправка push-уведомлений через Firebase Cloud Messaging.

Локально ключ сервисного аккаунта берётся из файла firebase-service-account.json
в корне репозитория (никогда не коммитится — см. .gitignore). На Render его нет
на диске, поэтому там переменная окружения FIREBASE_SERVICE_ACCOUNT_JSON должна
содержать содержимое этого файла целиком (весь JSON одной строкой).
"""

import os
import json
import logging
from typing import Optional

log = logging.getLogger(__name__)

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    _HAS_FIREBASE = True
except ImportError:
    _HAS_FIREBASE = False

_app = None
_init_tried = False


def _init():
    global _app, _init_tried
    if _init_tried or not _HAS_FIREBASE:
        return
    _init_tried = True
    try:
        raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if raw:
            cred = credentials.Certificate(json.loads(raw))
        else:
            path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "firebase-service-account.json")
            if not os.path.exists(path):
                log.warning("Firebase не настроен — нет ни FIREBASE_SERVICE_ACCOUNT_JSON, ни файла ключа")
                return
            cred = credentials.Certificate(path)
        _app = firebase_admin.initialize_app(cred)
    except Exception as e:
        log.warning("Не удалось инициализировать Firebase: %s", e)


def send_push(token: Optional[str], title: str, body: str, data: Optional[dict] = None) -> bool:
    """Тихо ничего не делает, если push не настроен или у пользователя нет токена —
    push всегда best-effort, ничего в основном потоке из-за него ломаться не должно."""
    if not token:
        return False
    _init()
    if _app is None:
        return False
    try:
        messaging.send(messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
        ))
        return True
    except Exception as e:
        log.warning("Push не отправлен: %s", e)
        return False
