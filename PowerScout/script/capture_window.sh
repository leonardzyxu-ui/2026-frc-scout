#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${1:-PowerScout}"
OUTPUT_PATH="${2:-/tmp/powerscout-window.png}"

WINDOW_ID="$(
  /usr/bin/swift - "$APP_NAME" <<'SWIFT'
import CoreGraphics
import Foundation

let appName = CommandLine.arguments.dropFirst().first ?? "PowerScout"
let options = CGWindowListOption(arrayLiteral: [.optionOnScreenOnly, .excludeDesktopElements])

guard let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
  fputs("Unable to read visible window list.\n", stderr)
  exit(2)
}

let candidates = windows.compactMap { info -> (id: UInt32, area: Double)? in
  guard
    let owner = info[kCGWindowOwnerName as String] as? String,
    owner == appName,
    let windowID = info[kCGWindowNumber as String] as? UInt32,
    let layer = info[kCGWindowLayer as String] as? Int,
    layer == 0,
    let alpha = info[kCGWindowAlpha as String] as? Double,
    alpha > 0,
    let bounds = info[kCGWindowBounds as String] as? [String: Any]
  else {
    return nil
  }

  let width = bounds["Width"] as? Double ?? 0
  let height = bounds["Height"] as? Double ?? 0
  guard width >= 120, height >= 120 else { return nil }
  return (windowID, width * height)
}
.sorted { $0.area > $1.area }

guard let windowID = candidates.first?.id else {
  fputs("No visible \(appName) window found. Open the app window before capturing.\n", stderr)
  exit(1)
}

print(windowID)
SWIFT
)"

mkdir -p "$(dirname "$OUTPUT_PATH")"
/usr/sbin/screencapture -x -l "$WINDOW_ID" "$OUTPUT_PATH"
printf '%s\n' "$OUTPUT_PATH"
