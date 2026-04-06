@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================
echo  포털 업데이트 Github 업로드 중...
echo ========================================
git add .
git commit -m "Fix mobile navigation: add bottom tab bar"
git push origin main
echo.
echo ========================================
echo 완료! Vercel이 자동으로 업데이트합니다.
echo 1-2분 후 포털을 새로고침해보세요.
echo ========================================
pause
