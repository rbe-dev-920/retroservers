param(
  [ValidateSet('quick','full')]
  [string]$Mode = 'quick'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $root 'backups'
$archiveName = "api-backup-$Mode-$timestamp.zip"
$archivePath = Join-Path $backupDir $archiveName

if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }

# Select content to backup
$include = @(
  'package.json', 'package-lock.json', 'Dockerfile', '.env', '.env.example', '.env.local',
  'src', 'uploads', 'prisma'
)

# Exclusions
$exclude = @('node_modules', '.git', '.vercel', '.next', 'logs.txt')

# Build file list
$items = Get-ChildItem -Path $root -Force | Where-Object { $_.Name -in $include -or $_.Name -notin $exclude -and ($Mode -eq 'full') }

# Create archive
if (Test-Path $archivePath) { Remove-Item $archivePath -Force }
Compress-Archive -Path $items.FullName -DestinationPath $archivePath -Force

Write-Host "Backup created: $archivePath" -ForegroundColor Green
