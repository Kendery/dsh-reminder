@echo off
rem Reminder plugin - Windows entry point.
rem Usage: scripts\win.cmd test ^| pack ^| install ^| publish
rem Default execution policy is Restricted, so bypass it for this process only.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0win.ps1" %*
exit /b %errorlevel%
