@echo off
echo ======================================
echo   TechnoFilter - Starting Backend
echo ======================================
echo.

cd /d "%~dp0backend"

:: Check for virtual environment
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

:: Activate venv
call venv\Scripts\activate.bat

:: Install dependencies
echo Installing dependencies...
pip install -r requirements.txt -q

:: Start server
echo.
echo Starting FastAPI server on http://localhost:8000
echo API docs: http://localhost:8000/docs
echo.
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
