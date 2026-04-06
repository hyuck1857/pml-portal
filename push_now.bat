@echo off
cd /d "%~dp0"

echo Pushing updates to Github...
git add .
git commit -m "add mobile navigation bar"
git push origin main

echo Done!
pause
