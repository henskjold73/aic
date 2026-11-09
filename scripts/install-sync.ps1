$CONFIG_DIR = "$env:APPDATA\aic"
$UUID_FILE = "$CONFIG_DIR\uuid"
$SCRIPT_DEST = "$CONFIG_DIR\update-usage.ps1"
$LAUNCHER_DEST = "$CONFIG_DIR\sync-hidden.vbs"
$RAW = "https://raw.githubusercontent.com/henskjold73/aic/main/scripts"

New-Item -ItemType Directory -Force -Path $CONFIG_DIR | Out-Null

# Preserve existing UUID if present, otherwise generate a new one
if (Test-Path $UUID_FILE) {
    $uuid = (Get-Content $UUID_FILE -Raw).Trim()
} else {
    $uuid = [System.Guid]::NewGuid().ToString()
    Set-Content -Path $UUID_FILE -Value $uuid
}

# Download update script
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
Invoke-WebRequest "$RAW/update-usage.ps1?t=$ts" -OutFile $SCRIPT_DEST

# Hide PowerShell before its console is created; -WindowStyle alone can flicker.
@'
Option Explicit
Dim shell, fso, scriptPath, powershellPath, command, exitCode
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "update-usage.ps1")
powershellPath = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")
command = """" & powershellPath & """ -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & scriptPath & """"
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
'@ | Set-Content -Path $LAUNCHER_DEST -Encoding ASCII

# Remove any existing aic-related scheduled tasks before registering
Get-ScheduledTask | Where-Object { $_.TaskName -like "*aic*" } | ForEach-Object {
    Unregister-ScheduledTask -TaskName $_.TaskName -Confirm:$false
}

# Create scheduled task (every 20 minutes)
$action = New-ScheduledTaskAction `
    -Execute "$env:SystemRoot\System32\wscript.exe" `
    -Argument "//B //NoLogo `"$LAUNCHER_DEST`""
$trigger = New-ScheduledTaskTrigger `
    -RepetitionInterval (New-TimeSpan -Minutes 20) `
    -Once -At (Get-Date)
$settings = New-ScheduledTaskSettingsSet -Hidden -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName "aic-usage-sync" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

# Ask the server for a one-time code that links this machine to a signed-in
# account. Best effort: if it fails we fall back to the plain UUID instructions.
$site = "https://aic-jade.vercel.app"
$pairCode = $null
$alreadyLinked = $false
try {
    $pair = Invoke-RestMethod -Uri "$site/api/usage/$uuid/ping" -Method POST -Body '{"request_pair_code":true}' -ContentType "application/json" -TimeoutSec 15
    if ($pair.pair_code) { $pairCode = $pair.pair_code }
    if ($pair.linked) { $alreadyLinked = $true }
} catch { }

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  aic sync installed"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
if ($pairCode) {
    Write-Host "  Link this machine to your account:"
    Write-Host ""
    Write-Host "    1. Sign in at $site/devices"
    Write-Host "    2. Enter this code (valid 15 minutes):"
    Write-Host ""
    Write-Host "       $pairCode"
    Write-Host ""
    Write-Host "  Not using an account? Paste your sync UUID at $site/auto instead:"
    Write-Host "  $uuid"
} elseif ($alreadyLinked) {
    Write-Host "  This machine is already linked to your account"
    Write-Host "  Manage it at $site/devices"
} else {
    Write-Host "  Your sync UUID:"
    Write-Host ""
    Write-Host "  $uuid"
    Write-Host ""
    Write-Host "  Paste it at: $site/auto"
}
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run first sync immediately
& powershell.exe -NonInteractive -ExecutionPolicy Bypass -File $SCRIPT_DEST
