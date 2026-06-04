@echo off
echo ========================================
echo    Мой.Маршрут - Запуск проекта
echo ========================================

echo.
echo [1/4] Установка Python зависимостей...
pip install -r requirements.txt --quiet

echo [2/4] Инициализация базы данных и тестовых данных...
python -m backend.seed

echo [3/4] Запуск бэкенда на порту 8000...
start "Backend - Мой.Маршрут" cmd /k "uvicorn backend.main:app --reload --port 8000"

echo [4/4] Установка npm зависимостей и запуск фронтенда...
cd frontend
if not exist node_modules (
    echo Установка npm пакетов...
    npm install
)
start "Frontend - Мой.Маршрут" cmd /k "npm run dev"

echo.
echo ========================================
echo  Приложение запущено!
echo  Бэкенд:   http://localhost:8000
echo  Фронтенд: http://localhost:3000
echo  API Docs: http://localhost:8000/docs
echo ========================================
pause
