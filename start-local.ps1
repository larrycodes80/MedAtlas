$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$python = Join-Path $backend ".venv\Scripts\python.exe"
$node = "C:\Program Files\nodejs\node.exe"

if (-not (Test-Path $python)) { throw "Backend virtual environment is missing: $python" }
if (-not (Test-Path (Join-Path $frontend "node_modules"))) { throw "Frontend dependencies are missing. Run npm install in frontend first." }

if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 11434 -InformationLevel Quiet -WarningAction SilentlyContinue)) {
  $ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
  if (-not (Test-Path $ollama)) { throw "Ollama is not running and was not found at $ollama" }
  Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden
}

if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 8765 -InformationLevel Quiet -WarningAction SilentlyContinue)) {
  Start-Process -FilePath $python -WorkingDirectory $backend -ArgumentList @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8765") -WindowStyle Hidden
}

$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:MEDATLAS_BACKEND_URL = "http://127.0.0.1:8765"
Write-Host "MedAtlas local app: http://127.0.0.1:3002"
if (Test-NetConnection -ComputerName 127.0.0.1 -Port 3002 -InformationLevel Quiet -WarningAction SilentlyContinue) {
  Write-Host "Frontend already running; leaving the existing server active."
  exit 0
}
Push-Location $frontend
try {
  & $node (Join-Path $frontend "node_modules\next\dist\bin\next") start -H 127.0.0.1 -p 3002
}
finally {
  Pop-Location
}
