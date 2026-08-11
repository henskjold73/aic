#!/bin/bash
set -e

CONFIG_DIR="$HOME/.config/aic"
UUID_FILE="$CONFIG_DIR/uuid"
SCRIPT_SRC="$(cd "$(dirname "$0")" && pwd)/update-usage.sh"
SCRIPT_DEST="$CONFIG_DIR/update-usage.sh"
PLIST="$HOME/Library/LaunchAgents/com.aic.usage-sync.plist"

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

# Copy update script to config dir so it works independently of the repo
cp "$SCRIPT_SRC" "$SCRIPT_DEST"
chmod +x "$SCRIPT_DEST"

# Install launchd plist
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

# Load (or reload) the agent
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

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
