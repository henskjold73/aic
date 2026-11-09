#!/bin/bash
set -e

CONFIG_DIR="$HOME/.config/aic"
UUID_FILE="$CONFIG_DIR/uuid"
SCRIPT_DEST="$CONFIG_DIR/update-usage.sh"
PLIST="$HOME/Library/LaunchAgents/com.aic.usage-sync.plist"
RAW="https://raw.githubusercontent.com/henskjold73/aic/main/scripts"

mkdir -p "$CONFIG_DIR"

# Preserve existing UUID if present, otherwise generate a new one
if [ -f "$UUID_FILE" ]; then
  UUID=$(cat "$UUID_FILE")
else
  UUID=$(python3 -c "
import time, random
ms = int(time.time() * 1000)
rand_a = random.getrandbits(12)
rand_b = random.getrandbits(62)
high = (ms << 16) | (0x7 << 12) | rand_a
low = (0b10 << 62) | rand_b
n = (high << 64) | low
h = f'{n:032x}'
print(f'{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}')
")
  echo "$UUID" > "$UUID_FILE"
fi

# Download update script from repo
curl -sL "$RAW/update-usage.sh?t=$(date +%s)" -o "$SCRIPT_DEST"
chmod +x "$SCRIPT_DEST"

# Install launchd plist (macOS only)
if [ "$(uname -s)" = "Darwin" ]; then
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.aic.usage-sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$SCRIPT_DEST</string>
    </array>
    <key>StartInterval</key>
    <integer>1200</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/aic-usage-sync.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/aic-usage-sync.log</string>
</dict>
</plist>
EOF
fi

OS=$(uname -s)

if [ "$OS" = "Darwin" ]; then
  # macOS — launchd
  launchctl unload "$PLIST" 2>/dev/null || true
  launchctl load "$PLIST"
else
  # Linux — cron
  ( crontab -l 2>/dev/null | grep -v "aic/update-usage.sh"; echo "*/20 * * * * bash $SCRIPT_DEST" ) | crontab -
  echo "[aic] Cron job installed (runs hourly)"
fi

# Ask the server for a one-time code that links this machine to a signed-in
# account. Best effort: if it fails we fall back to the plain UUID instructions.
SITE="https://aic-jade.vercel.app"
PAIR_RESPONSE=$(curl -s --max-time 15 -X POST "$SITE/api/usage/$UUID/ping" \
  -H "Content-Type: application/json" \
  -d '{"request_pair_code":true}' 2>/dev/null || true)
PAIR_CODE=$(printf '%s' "$PAIR_RESPONSE" | sed -n 's/.*"pair_code":"\([^"]*\)".*/\1/p')
ALREADY_LINKED=$(printf '%s' "$PAIR_RESPONSE" | grep -c '"linked":true' || true)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  aic sync installed ✓"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ -n "$PAIR_CODE" ]; then
  echo "  Link this machine to your account:"
  echo ""
  echo "    1. Sign in at $SITE/devices"
  echo "    2. Enter this code (valid 15 minutes):"
  echo ""
  echo "       $PAIR_CODE"
  echo ""
  echo "  Not using an account? Paste your sync UUID at $SITE/auto instead:"
  echo "  $UUID"
elif [ "$ALREADY_LINKED" != "0" ]; then
  echo "  This machine is already linked to your account ✓"
  echo "  Manage it at $SITE/devices"
else
  echo "  Your sync UUID:"
  echo ""
  echo "  $UUID"
  echo ""
  echo "  Paste it at: $SITE/auto"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run first sync immediately
bash "$SCRIPT_DEST"
