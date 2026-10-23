@echo off
title DeenDesk Mobile Tunnel
echo ===================================================
echo   Starting DeenDesk Mobile Tunnel to your PC...
echo   Use this to open Antigravity on your phone!
echo ===================================================
echo.
"%USERPROFILE%\.vscode-cli\code.exe" tunnel --accept-server-license-terms
pause
