@echo off
title Damz Agent — Frontend Server
color 0A

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║        DAMZ AGENT — Frontend UI          ║
echo  ║      Obsidian Sentinel Design System     ║
echo  ║           v1.0.0-alpha                   ║
echo  ╚══════════════════════════════════════════╝
echo.
echo  [*] Starting local server...
echo  [*] URL: http://localhost:3010
echo  [*] Press Ctrl+C to stop
echo.

cd /d "%~dp0frontend"
npx -y serve . -l 3010 --no-clipboard

pause
