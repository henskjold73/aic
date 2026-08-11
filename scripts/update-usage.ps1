$DB = "$env:USERPROFILE\.copilot\session-store.db"
$UUID_FILE = "$env:APPDATA\aic\uuid"
$API = "https://aic-jade.vercel.app/api/usage"

if (-not (Test-Path $DB)) {
    Write-Error "[aic] DB not found: $DB"; exit 1
}
if (-not (Test-Path $UUID_FILE)) {
    Write-Error "[aic] UUID not found — run install-sync.ps1 first"; exit 1
}
if (-not (Get-Command sqlite3 -ErrorAction SilentlyContinue)) {
    Write-Error "[aic] sqlite3 not found. Install from https://sqlite.org/download.html or via: winget install SQLite.SQLite"
    exit 1
}

$uuid = (Get-Content $UUID_FILE -Raw).Trim()
$currentMonth = (Get-Date).ToString("yyyy-MM")

$query = "SELECT strftime('%Y-%m', created_at), ROUND(SUM(total_nano_aiu) / 1000000000.0, 2), SUM(input_tokens), SUM(output_tokens) FROM assistant_usage_events WHERE strftime('%Y-%m', created_at) = '$currentMonth' GROUP BY strftime('%Y-%m', created_at);"

$result = ($query | & sqlite3 "$DB" -separator "|")

if (-not $result) {
    Write-Host "[aic] No usage data for current month"; exit 0
}

$parts = $result -split "\|"
$month = $parts[0]
$aiu = $parts[1]
$inputTokens = $parts[2]
$outputTokens = $parts[3]
$updatedAt = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")

$payload = "{`"month`":`"$month`",`"aiu`":$aiu,`"input_tokens`":$inputTokens,`"output_tokens`":$outputTokens,`"updated_at`":`"$updatedAt`"}"

try {
    $response = Invoke-RestMethod -Uri "$API/$uuid" -Method POST -Body $payload -ContentType "application/json"
    Write-Host "[aic] Uploaded $aiu AIU for $month (uuid: $uuid)"
} catch {
    Write-Host "[aic] Upload failed: $_"
}
