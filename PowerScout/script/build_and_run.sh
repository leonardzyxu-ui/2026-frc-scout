#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")/.."

APP_NAME="PowerScout"
CONFIG="debug"
VERIFY_ONLY=0
OPEN_APP=1
SHOW_LOGS=0
DEBUG_RUN=0

for arg in "$@"; do
  case "$arg" in
    --verify)
      VERIFY_ONLY=1
      OPEN_APP=0
      ;;
    --logs)
      SHOW_LOGS=1
      OPEN_APP=0
      ;;
    --telemetry)
      SHOW_LOGS=1
      OPEN_APP=0
      ;;
    --debug)
      DEBUG_RUN=1
      ;;
  esac
done

if [[ "$SHOW_LOGS" -eq 1 ]]; then
  log show --style compact --last 15m --predicate 'process == "PowerScout"' || true
  exit 0
fi

swift build -c "$CONFIG" --product "$APP_NAME"
swift test -c "$CONFIG"

BUILD_DIR="$(swift build -c "$CONFIG" --product "$APP_NAME" --show-bin-path)"
EXECUTABLE="$BUILD_DIR/$APP_NAME"
DIST_DIR="$PWD/dist"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
CONTENTS="$APP_BUNDLE/Contents"
MACOS="$CONTENTS/MacOS"

rm -rf "$APP_BUNDLE"
mkdir -p "$MACOS"
cp "$EXECUTABLE" "$MACOS/$APP_NAME"

cat > "$CONTENTS/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>org.powerhouse.powerscout</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>14.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

echo "Built $APP_BUNDLE"

if [[ "$VERIFY_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ "$DEBUG_RUN" -eq 1 ]]; then
  "$MACOS/$APP_NAME"
  exit 0
fi

if [[ "$OPEN_APP" -eq 1 ]]; then
  /usr/bin/open -n "$APP_BUNDLE"
fi
