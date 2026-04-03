@echo off
chcp 65001 > nul
cd /d "%~dp0"
title PML Portal Server

echo ======================================================
echo    PML Portal (Plant Microbiome Lab)
echo ======================================================
echo.

echo [1/3] Node.js 환경 확인 중...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js가 설치되어 있지 않습니다!
    echo 브라우저에서 https://nodejs.org 에 접속하여 LTS 버전을 설치해주세요.
    pause
    exit /b
)

echo [2/3] 필수 패키지 설치 중 (최초 1회만 진행되며 1~3분 소요됩니다)...
call npm install --no-audit --no-fund

echo.
echo [3/3] 포털 서버를 시작합니다...
echo 브라우저에서 http://localhost:3000 에 접속하면 됩니다! (종료하려면 이 창을 닫아주세요)
echo.

call npm run dev
pause
