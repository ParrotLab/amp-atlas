#!/bin/bash
# Brand the DEV Electron.app so it shows "AMP Atlas" + our icon in the menu bar, dock, and tooltip.
# Dev-only: the packaged .dmg gets its name/icon from electron-builder (productName + build/icon.png).
# node_modules is recreated on install, so this also runs on postinstall.
set -e

# macOS only.
[ "$(uname)" = "Darwin" ] || exit 0

APP="node_modules/electron/dist/Electron.app"
[ -d "$APP" ] || { echo "[brand] dev Electron.app not found; skipping"; exit 0; }

PLIST="$APP/Contents/Info.plist"
NAME="AMP Atlas"

# Menu-bar name + dock tooltip come from these keys.
/usr/libexec/PlistBuddy -c "Set :CFBundleName $NAME" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleName string $NAME" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $NAME" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string $NAME" "$PLIST"

# Dock icon: build an .icns from build/icon.png and replace the bundle's electron.icns.
ICON_SRC="build/icon.png"
if [ -f "$ICON_SRC" ]; then
  ICONSET="$(mktemp -d)/AppIcon.iconset"
  mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    d=$((s * 2))
    sips -z $s $s "$ICON_SRC" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
    sips -z $d $d "$ICON_SRC" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/electron.icns"
fi

# Nudge the bundle mtime so the Dock/Finder re-read it.
touch "$APP"
echo "[brand] dev Electron.app branded as \"$NAME\""
