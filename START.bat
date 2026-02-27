@echo off
echo ======================================
echo   TechnoFilter - Full Start
echo ======================================
echo.
echo Starting Backend and Frontend...
echo.

:: Start backend in new window
start "TechnoFilter Backend" cmd /k "%~dp0start_backend.bat"

:: Wait a moment for backend to initialize
timeout /t 5 /nobreak >nul

:: Start frontend in new window
start "TechnoFilter Frontend" cmd /k "%~dp0start_frontend.bat"

echo.
echo Both services starting...
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo   API Docs: http://localhost:8000/docs
echo.
pause
echo.
pause
