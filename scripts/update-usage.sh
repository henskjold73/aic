#!/bin/bash
SCRIPT_VERSION="1.5.0"
DB="$HOME/.copilot/session-store.db"
UUID_FILE="$HOME/.config/aic/uuid"
PROJECT_FILE="$HOME/.config/aic/project"
API="https://aic-jade.vercel.app/api/usage"

if [ ! -f "$DB" ]; then
  echo "[aic] DB not found: $DB" && exit 1
fi

if [ ! -f "$UUID_FILE" ]; then
  echo "[aic] UUID not found — run install-sync.sh first" && exit 1
fi

UUID=$(cat "$UUID_FILE")
PROJECT=""
if [ -f "$PROJECT_FILE" ]; then
  PROJECT=$(cat "$PROJECT_FILE" | tr -d '[:space:]')
fi

# ── Version ping ──────────────────────────────────────────────────
# Runs before any DB work so the version is recorded even if the script fails.
# The fingerprint identifies this Copilot DB so the server can warn when two
# sync keys read the same data. It is a hash; no usage content is sent.
FINGERPRINT=""
FIRST_EVENT=$(sqlite3 "$DB" "SELECT session_id || '|' || created_at FROM assistant_usage_events ORDER BY id ASC LIMIT 1;" 2>/dev/null)
if [ -n "$FIRST_EVENT" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    FINGERPRINT=$(printf '%s' "$FIRST_EVENT" | sha256sum | cut -d' ' -f1)
  else
    FINGERPRINT=$(printf '%s' "$FIRST_EVENT" | shasum -a 256 | cut -d' ' -f1)
  fi
fi

FP_FIELD=""
[ -n "$FINGERPRINT" ] && FP_FIELD=",\"db_fingerprint\":\"$FINGERPRINT\""

curl -s -o /dev/null -X POST "$API/$UUID/ping" \
  -H "Content-Type: application/json" \
  -d "{\"script_version\":\"$SCRIPT_VERSION\"$FP_FIELD}"

# ── Monthly total ─────────────────────────────────────────────────
RESULT=$(sqlite3 "$DB" "
SELECT
  strftime('%Y-%m', created_at),
  ROUND(SUM(total_nano_aiu) / 1000000000.0, 4),
  SUM(input_tokens),
  SUM(output_tokens)
FROM assistant_usage_events
WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
GROUP BY strftime('%Y-%m', created_at);
" -separator "|")

if [ -z "$RESULT" ]; then
  month=$(date -u +%Y-%m)
  aiu=0
  input_tokens=0
  output_tokens=0
else
  IFS='|' read -r month aiu input_tokens output_tokens <<< "$RESULT"
fi

PAYLOAD=$(cat <<EOF
{
  "month": "$month",
  "aiu": $aiu,
  "input_tokens": $input_tokens,
  "output_tokens": $output_tokens,
  "script_version": "$SCRIPT_VERSION",
  "updated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$API/$UUID" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

STATUS=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$STATUS" = "200" ]; then
  echo "[aic] Uploaded $aiu AIU for $month (uuid: $UUID)"
else
  echo "[aic] Upload failed — HTTP $STATUS: $BODY"
fi

# ── Daily breakdown ───────────────────────────────────────────────
DAILY=$(sqlite3 "$DB" "
SELECT
  DATE(created_at),
  ROUND(SUM(total_nano_aiu) / 1000000000.0, 4),
  SUM(input_tokens),
  SUM(output_tokens)
FROM assistant_usage_events
WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
GROUP BY DATE(created_at)
ORDER BY DATE(created_at);
" -separator "|")

if [ -z "$DAILY" ]; then
  exit 0
fi

# Build JSON array of daily rows
DAYS_JSON="["
FIRST=1
while IFS='|' read -r date d_aiu d_input d_output; do
  [ "$FIRST" = "1" ] || DAYS_JSON+=","
  DAYS_JSON+="{\"date\":\"$date\",\"aiu\":$d_aiu,\"input_tokens\":$d_input,\"output_tokens\":$d_output}"
  FIRST=0
done <<< "$DAILY"
DAYS_JSON+="]"

PROJECT_FIELD=""
if [ -n "$PROJECT" ]; then
  PROJECT_FIELD=",\"project\":\"$PROJECT\""
fi

DAYS_PAYLOAD="{\"days\":$DAYS_JSON$PROJECT_FIELD}"

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$API/$UUID/days" \
  -H "Content-Type: application/json" \
  -d "$DAYS_PAYLOAD")

STATUS=$(echo "$RESPONSE" | tail -1)
if [ "$STATUS" = "200" ]; then
  echo "[aic] Uploaded daily breakdown for $month"
else
  echo "[aic] Daily upload failed — HTTP $STATUS"
fi
