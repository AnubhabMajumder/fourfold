# Start Fourfold: starts the local API if it isn't running, then opens the installed app if there is one,
# otherwise a browser tab. If the API is already running it just opens the app. The desktop shortcut made by
# create-shortcut.ps1 runs this script; it needs `pnpm build` to have been run first.
#
# The parameters are for testing; the shortcut uses none of them.
#   -Port         the port (default: the fixed port, read from packages\core\src\model.ts).
#   -ProgramsDir  the Start Menu folders searched for the installed app (default: the user's and all users').
#   -LogDir       where the API's output goes (default: %LOCALAPPDATA%\Fourfold).
#   -NoOpen       print what would be opened, and any error, instead of opening it or showing a message box.
# FOURFOLD_DB is passed on from the environment, so a test can point the API at a throwaway database.
param(
  [int]$Port,
  [string[]]$ProgramsDir = @(
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
    (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs')
  ),
  [string]$LogDir = (Join-Path $env:LOCALAPPDATA 'Fourfold'),
  [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$Root = Join-Path $PSScriptRoot '..'
$Server = Join-Path $Root 'apps\api\dist\server.js'

function Stop-WithMessage([string]$Message) {
  if ($NoOpen) {
    [Console]::Error.WriteLine($Message)
  } else {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show($Message, 'Start Fourfold', 'OK', 'Warning')
  }
  exit 1
}

if (-not $Port) {
  # The fixed port lives in core; read it from there rather than keep a second copy.
  $model = Join-Path $Root 'packages\core\src\model.ts'
  $match = Select-String -Path $model -Pattern 'export const PORT = (\d+);' -ErrorAction SilentlyContinue
  if (-not $match) { Stop-WithMessage "Start Fourfold can't find Fourfold's port in $model." }
  $Port = [int]$match.Matches[0].Groups[1].Value
}
$Url = "http://localhost:$Port"

function Test-Fourfold {
  try {
    $response = Invoke-WebRequest -Uri "$Url/api/task-list" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Start-Api {
  if (-not (Test-Path $Server)) {
    Stop-WithMessage "Fourfold hasn't been built yet.`n`nRun ``pnpm install`` and then ``pnpm build`` in $(Resolve-Path $Root), then start Fourfold again."
  }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Stop-WithMessage "Fourfold can't start: Node.js isn't installed (or isn't on the PATH)."
  }

  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $log = Join-Path $LogDir 'server.log'
  $errorLog = Join-Path $LogDir 'server-errors.log'
  # Always set: a FOURFOLD_PORT left over in the environment would start the API on a port nobody opens.
  $env:FOURFOLD_PORT = "$Port"

  $process = Start-Process -FilePath $node.Source -ArgumentList "`"$Server`"" -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $log -RedirectStandardError $errorLog

  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline) {
    if (Test-Fourfold) { return }
    if ($process.HasExited) { break }
    Start-Sleep -Milliseconds 300
  }

  if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
  $output = (Get-Content $errorLog, $log -Tail 10 -ErrorAction SilentlyContinue) -join "`n"
  Stop-WithMessage "Fourfold didn't start.`n`n$output`n`nThe full output is in $LogDir."
}

function Find-InstalledApp {
  # Installing Fourfold from Chrome or Edge adds a Start Menu shortcut named after the app that launches it by app id.
  $shell = New-Object -ComObject WScript.Shell
  foreach ($dir in $ProgramsDir) {
    if (-not (Test-Path $dir)) { continue }
    foreach ($file in Get-ChildItem -Path $dir -Filter 'Fourfold.lnk' -Recurse -ErrorAction SilentlyContinue) {
      if ($shell.CreateShortcut($file.FullName).Arguments -match '--app-id=') { return $file.FullName }
    }
  }
  return $null
}

if (-not (Test-Fourfold)) { Start-Api }

$app = Find-InstalledApp
$target = if ($app) { $app } else { $Url }
if ($NoOpen) {
  Write-Output "Would open $target"
} else {
  Start-Process -FilePath $target
}
