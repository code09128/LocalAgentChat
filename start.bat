@echo off
echo ========================================================
echo Local Smart Desktop Quick Start (Windows)
echo ========================================================

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] Installing dependencies...
  call npm install
)

if not exist "dist-backend\main\index.js" (
  echo [INFO] Building backend...
  call npm run build:backend
)

echo [INFO] Starting Local Smart Desktop...
call npm run dev:desktop
