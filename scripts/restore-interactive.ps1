$root = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $root 'backups'
if (-not (Test-Path $backupDir)) { Write-Error "No backups directory found at $backupDir"; exit 1 }
$choices = Get-ChildItem -Path $backupDir -Filter '*.zip' | Sort-Object LastWriteTime -Descending
if ($choices.Count -eq 0) { Write-Error "No backup archives found."; exit 1 }
$menu = for ($i=0; $i -lt $choices.Count; $i++) { "[$i] " + $choices[$i].Name }
$menu | ForEach-Object { Write-Host $_ }
$sel = Read-Host "Select archive index"
if (-not ($sel -as [int]) -or [int]$sel -lt 0 -or [int]$sel -ge $choices.Count) { Write-Error "Invalid selection"; exit 1 }
$archive = $choices[[int]$sel].FullName
& "$PSScriptRoot\restore.ps1" -ArchivePath $archive