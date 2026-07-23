#!/usr/bin/env python3
"""
Telegram-бот @MyRouteSupport_bot — восстановление пароля для входа в приложение
"Мой.Маршрут" (водитель или предприниматель).

Личность подтверждается кнопкой "Поделиться номером" в Telegram — Telegram
позволяет поделиться только СВОИМ зарегистрированным номером, поэтому это
надёжнее, чем просто просить ввести номер ВУ/телефона текстом (иначе получить
код мог бы кто угодно, кто просто знает чужой номер).

Тот же бот, что уже используется в backend/routers/support.py для отправки
обращений в техподдержку (TG_BOT_TOKEN там — тот же самый) — этот скрипт
отдельным процессом обслуживает входящие сообщения (support.py — только
исходящие уведомления, у него нет своего слушателя).

Запуск (отдельный процесс, не часть FastAPI-приложения; нужен доступ к той же
базе, что и backend — те же переменные окружения DATABASE_URL/DB_PATH):
    pip install python-telegram-bot requests
    set TELEGRAM_SUPPORT_BOT_TOKEN=<токен>
    python support_bot.py
"""

import os
import logging
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler

from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove, KeyboardButton
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from backend.database import SessionLocal
from backend.reset_utils import find_user_by_phone, generate_reset_code, RESET_CODE_TTL_MINUTES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# Тот же токен, что и в backend/routers/support.py (один бот на обе задачи).
DEFAULT_TOKEN = "8740014585:AAF_rzM8A_b27Bj1Fi16e91IV6YoDrkyl1s"

SHARE_KEYBOARD = ReplyKeyboardMarkup(
    [[KeyboardButton("📱 Поделиться номером", request_contact=True)]],
    resize_keyboard=True, one_time_keyboard=True,
)


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "👋 Это бот восстановления пароля для приложения «Мой.Маршрут».\n\n"
        "Нажмите кнопку ниже, чтобы поделиться номером телефона — так мы убедимся, "
        "что это действительно вы, и пришлём код для сброса пароля.",
        reply_markup=SHARE_KEYBOARD,
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await cmd_start(update, context)


async def on_contact(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    contact = update.message.contact
    if not contact:
        return

    # Кнопка request_contact и так делится только своим номером, но если контакт
    # переслан вручную (не через кнопку) — это может быть чужая карточка.
    if contact.user_id and contact.user_id != update.effective_user.id:
        await update.message.reply_text(
            "Это не похоже на ваш собственный номер — поделитесь контактом через кнопку ниже.",
            reply_markup=SHARE_KEYBOARD,
        )
        return

    db = SessionLocal()
    try:
        user = find_user_by_phone(db, contact.phone_number)
        if not user:
            await update.message.reply_text(
                "Не нашли аккаунт с таким номером телефона в «Мой.Маршрут».\n"
                "Если он указан в приложении по-другому — обратитесь в поддержку через приложение.",
                reply_markup=ReplyKeyboardRemove(),
            )
            return

        code = generate_reset_code(user)
        db.commit()

        if user.role.value == "driver":
            login_hint = f"номер ВУ <b>{user.driver_id}</b>"
        else:
            login_hint = f"номер телефона <b>{user.phone}</b>"

        await update.message.reply_html(
            f"✅ Здравствуйте, {user.full_name}!\n\n"
            f"Код для сброса пароля: <b>{code}</b>\n"
            f"Действует {RESET_CODE_TTL_MINUTES} минут.\n\n"
            f"Введите его в приложении вместе с новым паролем — входить нужно как обычно, через {login_hint}.",
            reply_markup=ReplyKeyboardRemove(),
        )
    finally:
        db.close()


async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Чтобы восстановить пароль, поделитесь номером телефона через кнопку ниже.",
        reply_markup=SHARE_KEYBOARD,
    )


# ── Health-check сервер (для Render / UptimeRobot) ─────────────────

class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")
    def log_message(self, *args):
        pass


def _start_health_server() -> None:
    port = int(os.environ.get("PORT", 8081))
    server = HTTPServer(("0.0.0.0", port), _HealthHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log.info("Health-check сервер запущен на порту %d", port)


def main() -> None:
    token = os.environ.get("TELEGRAM_SUPPORT_BOT_TOKEN", DEFAULT_TOKEN)

    async def post_init(application):
        await application.bot.delete_webhook(drop_pending_updates=True)

    _start_health_server()
    app = Application.builder().token(token).post_init(post_init).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(MessageHandler(filters.CONTACT, on_contact))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, on_text))

    log.info("support_bot запущен")
    app.run_polling(drop_pending_updates=True, allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
