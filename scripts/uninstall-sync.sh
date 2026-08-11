#!/bin/bash
PLIST="$HOME/Library/LaunchAgents/com.aic.usage-sync.plist"
CONFIG_DIR="$HOME/.config/aic"

# Unload and remove launchd agent
if [ -f "$PLIST" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "[aic] Removed launchd agent"
fi

# Remove config dir (uuid + update script)
if [ -d "$CONFIG_DIR" ]; then
  rm -rf "$CONFIG_DIR"
  echo "[aic] Removed $CONFIG_DIR"
fi

# Remove log
rm -f /tmp/aic-usage-sync.log

echo "[aic] Uninstalled — no trace left"
echo ""
echo "  Your UUID is gone. To fully clean up, also clear localStorage"
echo "  in your browser at https://aic-jade.vercel.app (DevTools → Application → Local Storage → Clear all)"
