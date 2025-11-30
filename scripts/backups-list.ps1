$root = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $root 'backups'
if (-not (Test-Path $backupDir)) { Write-Host "No backups directory found."; exit 0 }
Get-ChildItem -Path $backupDir -Filter '*.zip' | Sort-Object LastWriteTime -Descending |
  Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize