@echo off
setlocal
cd /d "%~dp0"

start "MedAtlas local servers" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1"

powershell.exe -NoProfile -Command "$deadline=(Get-Date).AddSeconds(90); $ready=$false; do { try { $front=Test-NetConnection -ComputerName 127.0.0.1 -Port 3002 -InformationLevel Quiet -WarningAction SilentlyContinue; $health=(Invoke-WebRequest http://127.0.0.1:8765/api/health -TimeoutSec 2 -UseBasicParsing).Content | ConvertFrom-Json; $ready=$front -and ($health.status -eq 'ok') } catch {}; if (-not $ready) { Start-Sleep -Seconds 1 } } while (-not $ready -and (Get-Date) -lt $deadline); if ($ready) { try { Start-Process 'http://127.0.0.1:3002' } catch { Write-Host 'Servers are ready: http://127.0.0.1:3002' } } else { Write-Error 'MedAtlas did not become ready within 90 seconds.'; exit 1 }"
endlocal
