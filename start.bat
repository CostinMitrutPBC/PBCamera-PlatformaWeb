@echo off
setlocal

REM mergem în folderul unde e acest .bat (merge pe orice PC)
cd /d "%~dp0"

REM pornește backend-ul într-un terminal separat
start "PBCamera Backend" cmd /k "cd /d backend && npm install && npm start"

REM așteaptă puțin să pornească serverul
timeout /t 2 /nobreak >nul

REM deschide site-ul direct în index
start "" "http://localhost:3000/index.html"

endlocal
