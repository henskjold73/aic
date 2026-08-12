$ScriptVersion = "1.2.0"
$DB = "$env:USERPROFILE\.copilot\session-store.db"
$UUID_FILE = "$env:APPDATA\aic\uuid"
$PROJECT_FILE = "$env:APPDATA\aic\project"
$API = "https://aic-jade.vercel.app/api/usage"

if (-not (Test-Path $DB)) {
    Write-Error "[aic] DB not found: $DB"; exit 1
}
if (-not (Test-Path $UUID_FILE)) {
    Write-Error "[aic] UUID not found - run install-sync.ps1 first"; exit 1
}
if (-not (Get-Command sqlite3 -ErrorAction SilentlyContinue)) {
    Write-Error "[aic] sqlite3 not found. Install via: winget install SQLite.SQLite"
    exit 1
}

$uuid = (Get-Content $UUID_FILE -Raw).Trim()
$project = if (Test-Path $PROJECT_FILE) { (Get-Content $PROJECT_FILE -Raw).Trim() } else { $null }
$currentMonth = (Get-Date).ToString("yyyy-MM")
$updatedAt = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")

# ── Monthly total ─────────────────────────────────────────────────
$tmpFile = [System.IO.Path]::GetTempFileName()
@"
SELECT strftime('%Y-%m', created_at), ROUND(SUM(total_nano_aiu) / 1000000000.0, 4), SUM(input_tokens), SUM(output_tokens)
FROM assistant_usage_events
WHERE strftime('%Y-%m', created_at) = '$currentMonth'
GROUP BY strftime('%Y-%m', created_at);
"@ | Set-Content $tmpFile -Encoding UTF8

$result = (& sqlite3 "$DB" -separator "|" ".read `"$tmpFile`"")
Remove-Item $tmpFile

if (-not $result) {
    Write-Host "[aic] No usage data for current month"; exit 0
}

$parts = $result -split "\|"
$month = $parts[0]
$aiu = $parts[1]
$inputTokens = $parts[2]
$outputTokens = $parts[3]

$payload = "{`"month`":`"$month`",`"aiu`":$aiu,`"input_tokens`":$inputTokens,`"output_tokens`":$outputTokens,`"script_version`":`"$ScriptVersion`",`"updated_at`":`"$updatedAt`"}"

try {
    Invoke-RestMethod -Uri "$API/$uuid" -Method POST -Body $payload -ContentType "application/json" | Out-Null
    Write-Host "[aic] Uploaded $aiu AIU for $month (uuid: $uuid)"
} catch {
    Write-Host "[aic] Upload failed: $_"
}

# ── Daily breakdown ───────────────────────────────────────────────
$tmpFile2 = [System.IO.Path]::GetTempFileName()
@"
SELECT DATE(created_at), ROUND(SUM(total_nano_aiu) / 1000000000.0, 4), SUM(input_tokens), SUM(output_tokens)
FROM assistant_usage_events
WHERE strftime('%Y-%m', created_at) = '$currentMonth'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at);
"@ | Set-Content $tmpFile2 -Encoding UTF8

$dailyResult = (& sqlite3 "$DB" -separator "|" ".read `"$tmpFile2`"")
Remove-Item $tmpFile2

if (-not $dailyResult) { exit 0 }

$dayRows = @()
foreach ($line in $dailyResult) {
    $p = $line -split "\|"
    $dayRows += "{`"date`":`"$($p[0])`",`"aiu`":$($p[1]),`"input_tokens`":$($p[2]),`"output_tokens`":$($p[3])}"
}

$daysArray = "[" + ($dayRows -join ",") + "]"
$projectField = if ($project) { ",`"project`":`"$project`"" } else { "" }
$daysPayload = "{`"days`":$daysArray$projectField}"

try {
    Invoke-RestMethod -Uri "$API/$uuid/days" -Method POST -Body $daysPayload -ContentType "application/json" | Out-Null
    Write-Host "[aic] Uploaded daily breakdown for $month"
} catch {
    Write-Host "[aic] Daily upload failed: $_"
}
