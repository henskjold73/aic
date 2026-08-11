#!/bin/bash
set -e

CONFIG_DIR="$HOME/.config/aic"
UUID_FILE="$CONFIG_DIR/uuid"
SCRIPT_DEST="$CONFIG_DIR/update-usage.sh"
PLIST="$HOME/Library/LaunchAgents/com.aic.usage-sync.plist"
RAW="https://raw.githubusercontent.com/henskjold73/aic/main/scripts"

mkdir -p "$CONFIG_DIR"

# Generate UUID v7 (timestamp-based, works on Python 3.8+)
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

# Download update script from repo
curl -sL "$RAW/update-usage.sh" -o "$SCRIPT_DEST"
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
    <integer>3600</integer>
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
  ( crontab -l 2>/dev/null | grep -v "aic/update-usage.sh"; echo "0 * * * * bash $SCRIPT_DEST" ) | crontab -
  echo "[aic] Cron job installed (runs hourly)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  aic sync installed ✓"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Your sync UUID:"
echo ""
echo "  $UUID"
echo ""
echo "  Paste it at: https://aic-jade.vercel.app/auto"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Run first sync immediately
bash "$SCRIPT_DEST"
