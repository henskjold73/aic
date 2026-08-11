# Remove scheduled task
Unregister-ScheduledTask -TaskName "aic-usage-sync" -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "[aic] Removed scheduled task"

# Remove config dir (uuid + update script)
$CONFIG_DIR = "$env:APPDATA\aic"
if (Test-Path $CONFIG_DIR) {
    Remove-Item -Recurse -Force $CONFIG_DIR
    Write-Host "[aic] Removed $CONFIG_DIR"
}

Write-Host "[aic] Uninstalled — no trace left"
Write-Host ""
Write-Host "  To finish, clear localStorage in your browser at"
Write-Host "  https://aic-jade.vercel.app (DevTools -> Application -> Local Storage -> Clear all)"
