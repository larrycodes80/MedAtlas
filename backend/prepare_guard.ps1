$ErrorActionPreference = 'Stop'
$ollama = (Get-Command ollama.exe -ErrorAction SilentlyContinue).Source
if (-not $ollama) { $ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe' }
if (-not (Test-Path -LiteralPath $ollama)) { throw 'Ollama executable not found.' }

$template = (& $ollama show llama-guard3:1b --template) -join "`n"
if ($LASTEXITCODE -ne 0) { throw 'Cannot read llama-guard3:1b.' }
$old = 'ONLY THE LAST User message'
$new = 'ONLY THE LAST {{ $role }} message'
if (-not $template.Contains('{{- $role := ""}}') -or
    -not $template.Contains('$role = "Agent"') -or
    [regex]::Matches($template, [regex]::Escape($old)).Count -ne 1) {
    throw 'The installed guard template is different; inspect it before changing it.'
}
$template = $template.Replace($old, $new)
$work = Join-Path $PSScriptRoot 'work'
New-Item -ItemType Directory -Force -Path $work | Out-Null
$file = Join-Path $work 'Modelfile.guard'
$contents = "FROM llama-guard3:1b`nTEMPLATE " + '"""' + "`n$template`n" + '"""' + "`nPARAMETER temperature 0.2`n"
[IO.File]::WriteAllText($file, $contents, [Text.UTF8Encoding]::new($false))
& $ollama create medatlas-guard -f $file
if ($LASTEXITCODE -ne 0) { throw 'Could not create medatlas-guard.' }
Write-Host 'Created medatlas-guard.'
