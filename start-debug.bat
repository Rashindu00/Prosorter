@echo off
echo.
echo ========================================
echo    ProSorter Server Startup
echo ========================================
echo.
echo Starting ProSorter Server with Debug Logging...
echo Server will be available at: http://localhost:3000
echo.
echo Login Credentials:
echo   Username: admin
echo   Password: admin123
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

cd /d "c:\Users\Rashindu\Desktop\GitHub Projects\Prosorter"
node server.js

pause
