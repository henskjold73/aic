#!/bin/bash
DB="$HOME/.copilot/data.db"
UUID_FILE="$HOME/.config/aic/uuid"
API="https://aic-jade.vercel.app/api/usage"

if [ ! -f "$DB" ]; then
  echo "[aic] DB not found: $DB" && exit 1
fi

if [ ! -f "$UUID_FILE" ]; then
  echo "[aic] UUID not found — run install-sync.sh first" && exit 1
fi

UUID=$(cat "$UUID_FILE")

RESULT=$(sqlite3 "$DB" "
SELECT
  strftime('%Y-%m', created_at),
  ROUND(SUM(total_nano_aiu) / 1000000000.0, 2),
  SUM(total_input_tokens),
  SUM(total_output_tokens)
FROM sessions
WHERE total_nano_aiu > 0
  AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
GROUP BY strftime('%Y-%m', created_at);
" -separator "|")

if [ -z "$RESULT" ]; then
  echo "[aic] No usage data for current month" && exit 0
fi

IFS='|' read -r month aiu input_tokens output_tokens <<< "$RESULT"

PAYLOAD=$(cat <<EOF
{
  "month": "$month",
  "aiu": $aiu,
  "input_tokens": $input_tokens,
  "output_tokens": $output_tokens,
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
