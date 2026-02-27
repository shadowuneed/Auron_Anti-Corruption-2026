@echo off
echo ======================================
echo   TechnoFilter - Starting Frontend
echo ======================================
echo.

cd /d "%~dp0frontend"

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing npm dependencies...
    npm install
)

:: Start dev server
echo.
echo Starting frontend on http://localhost:3000
echo.
npm run dev
