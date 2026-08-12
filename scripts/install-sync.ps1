$CONFIG_DIR = "$env:APPDATA\aic"
$UUID_FILE = "$CONFIG_DIR\uuid"
$SCRIPT_DEST = "$CONFIG_DIR\update-usage.ps1"
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

# Remove any existing aic-related scheduled tasks before registering
Get-ScheduledTask | Where-Object { $_.TaskName -like "*aic*" } | ForEach-Object {
    Unregister-ScheduledTask -TaskName $_.TaskName -Confirm:$false
}

# Create scheduled task (hourly)
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$SCRIPT_DEST`""
$trigger = New-ScheduledTaskTrigger `
    -RepetitionInterval (New-TimeSpan -Minutes 15) `
    -Once -At (Get-Date)
$settings = New-ScheduledTaskSettingsSet -Hidden -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName "aic-usage-sync" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "  aic sync installed"
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
