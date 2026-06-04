# Мой.Маршрут - PowerShell запуск
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "   Мой.Маршрут - Запуск проекта"  -ForegroundColor Cyan
Write-Host "========================================"  -ForegroundColor Cyan

Set-Location $PSScriptRoot

Write-Host "`n[1/4] Установка Python зависимостей..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet

Write-Host "[2/4] Инициализация тестовых данных..." -ForegroundColor Yellow
python -m backend.seed

Write-Host "[3/4] Запуск бэкенда (порт 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; uvicorn backend.main:app --reload --port 8000" -WindowStyle Normal

Start-Sleep 2

Write-Host "[4/4] Запуск фронтенда (порт 3000)..." -ForegroundColor Yellow
Set-Location frontend
if (-not (Test-Path "node_modules")) {
    Write-Host "Установка npm пакетов..." -ForegroundColor Yellow
    npm install
}
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Приложение запускается!" -ForegroundColor Green
Write-Host " Бэкенд:   http://localhost:8000" -ForegroundColor Green
Write-Host " Фронтенд: http://localhost:3000" -ForegroundColor Green
Write-Host " API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Демо данные:" -ForegroundColor Cyan
Write-Host "  Водитель:       DRV001 (или DRV002-DRV004)" -ForegroundColor White
Write-Host "  Предприниматель: +7 (900) 123-45-67" -ForegroundColor White
