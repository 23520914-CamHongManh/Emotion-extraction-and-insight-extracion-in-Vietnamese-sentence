@echo off
REM Quick Setup Script for Tennis AI Report (Windows)
REM Run this script to set up the entire project

echo.
echo ===== Tennis AI Report - Auto Setup =====
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js not found. Please install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js found: %NODE_VERSION%

REM Check Python
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Python not found. Please install from https://www.python.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] Python found: %PYTHON_VERSION%

REM Install Frontend Dependencies
echo.
echo Installing Frontend Dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [X] Failed to install frontend dependencies
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed

REM Create Virtual Environment
echo.
echo Creating Python Virtual Environment...
python -m venv venv
if %ERRORLEVEL% NEQ 0 (
    echo [X] Failed to create virtual environment
    pause
    exit /b 1
)
echo [OK] Virtual environment created

REM Activate Virtual Environment and Install Python Dependencies
echo.
echo Installing Python Dependencies...
call venv\Scripts\activate.bat
if exist requirements.txt (
    pip install -r requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo [X] Failed to install Python dependencies
        pause
        exit /b 1
    )
    echo [OK] Python dependencies installed
) else (
    echo [WARNING] requirements.txt not found. Skipping Python setup.
)

echo.
echo ===== Setup Complete! =====
echo.
echo To start the application:
echo.
echo Terminal 1 - Frontend:
echo   npm run dev
echo.
echo Terminal 2 - Backend:
echo   venv\Scripts\activate
echo   python api_server.py
echo.
echo Then open: http://localhost:5173
echo.
pause
