$CONFIG_DIR = "$env:APPDATA\aic"
$UUID_FILE = "$CONFIG_DIR\uuid"
$SCRIPT_DEST = "$CONFIG_DIR\update-usage.ps1"
$RAW = "https://raw.githubusercontent.com/henskjold73/aic/main/scripts"

New-Item -ItemType Directory -Force -Path $CONFIG_DIR | Out-Null

# Generate UUID (unique and unguessable)
$uuid = [System.Guid]::NewGuid().ToString()
Set-Content -Path $UUID_FILE -Value $uuid

# Download update script
Invoke-WebRequest "$RAW/update-usage.ps1" -OutFile $SCRIPT_DEST

# Create scheduled task (hourly)
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -ExecutionPolicy Bypass -File `"$SCRIPT_DEST`""
$trigger = New-ScheduledTaskTrigger `
    -RepetitionInterval (New-TimeSpan -Hours 1) `
    -Once -At (Get-Date)
Register-ScheduledTask -TaskName "aic-usage-sync" -Action $action -Trigger $trigger -Force | Out-Null

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  aic sync installed v"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""
Write-Host "  Your sync UUID:"
Write-Host ""
Write-Host "  $uuid"
Write-Host ""
Write-Host "  Paste it at: https://aic-jade.vercel.app/auto"
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run first sync immediately
& powershell.exe -NonInteractive -ExecutionPolicy Bypass -File $SCRIPT_DEST
