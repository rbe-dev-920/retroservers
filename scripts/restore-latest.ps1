$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $root 'backups'
if (-not (Test-Path $backupDir)) { Write-Error "No backups directory found at $backupDir"; exit 1 }
$latest = Get-ChildItem -Path $backupDir -Filter '*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latest) { Write-Error "No backup archives found."; exit 1 }
Write-Host "Restoring from: $($latest.FullName)" -ForegroundColor Cyan

# Extract to temp, then copy into place
$temp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ("api-restore-" + [System.Guid]::NewGuid().ToString()))
Expand-Archive -Path $latest.FullName -DestinationPath $temp.FullName -Force

# Copy content (preserve existing node_modules)
$preserve = @('node_modules', '.git')
$items = Get-ChildItem -Path $temp.FullName -Force
foreach ($item in $items) {
  if ($preserve -contains $item.Name) { continue }
  $dest = Join-Path $root $item.Name
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Copy-Item -Path $item.FullName -Destination $dest -Recurse -Force
}

Remove-Item $temp.FullName -Recurse -Force
Write-Host "Restore complete." -ForegroundColor Green