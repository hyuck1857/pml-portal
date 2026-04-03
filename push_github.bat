@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo =========================================
echo Github에 포털 소스코드 업로드 재시작!
echo =========================================
echo.

git config --global user.name "hyuck1857"
git config --global user.email "hyuck1857@github.com"

git init
git add .
git commit -m "Initialize PML portal"
git branch -M main
git remote add origin https://github.com/hyuck1857/pml-portal.git 2>nul
git push -u origin main

echo.
echo =========================================
echo 업로드 완료! (에러 없이 위 명령어가 끝났다면)
echo 브라우저의 Github 창을 새로고침 해보세요.
echo =========================================
pause
