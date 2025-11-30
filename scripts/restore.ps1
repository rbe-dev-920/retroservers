param(
  [string]$ArchivePath
)
$ErrorActionPreference = 'Stop'
if (-not $ArchivePath) { Write-Error "Provide -ArchivePath"; exit 1 }
if (-not (Test-Path $ArchivePath)) { Write-Error "Archive not found: $ArchivePath"; exit 1 }
$root = Split-Path -Parent $PSScriptRoot
$temp = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ("api-restore-" + [System.Guid]::NewGuid().ToString()))
Expand-Archive -Path $ArchivePath -DestinationPath $temp.FullName -Force
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