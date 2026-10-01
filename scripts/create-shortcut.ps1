# Creates the `Start Fourfold` shortcut, which runs start-fourfold.ps1 from this checkout.
# Usage: pnpm shortcut   (or: powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1)
#   -Destination  the folder to put it in (default: the desktop).
param(
  [string]$Destination = [Environment]::GetFolderPath('Desktop')
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script = Join-Path $root 'scripts\start-fourfold.ps1'
$path = Join-Path $Destination 'Start Fourfold.lnk'

$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($path)
$shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = Join-Path $root 'apps\web\public\favicon.ico'
$shortcut.Description = 'Start Fourfold and open it'
$shortcut.WindowStyle = 7 # minimised, so no console window flashes up
$shortcut.Save()

Write-Output "Created $path"
