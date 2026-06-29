# PowerScout macOS SwiftPM Patterns (Direct Reference Notes)

## 1) Package.swift patterns worth copying

- Use a multi-target layout with:
  - one main app executable target,
  - one core/business logic library target,
  - optional checks/validation executable.
  - Seen in DirectChat and The Button:
    - `Package.swift` defines `DirectChat` + `DirectChatChecks` + `DirectChatCore`.
    - `Package.swift` defines `TheReceiver` + `TheReceiverChecks` + `TheReceiverCore`.
  - File refs:
    - [`DirectChat/Package.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/Package.swift:5)
    - [`The_Button/receiver-mac/Package.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/Package.swift:5)

- Consider Swift tools and platform floor separately:
  - DirectChat/The Receiver both pin macOS 14 and SwiftPM 5.10.
  - LiquidGlassDemo pins macOS 26 and Swift tools 6.3 for liquid-glass APIs.
  - File refs:
    - [`DirectChat/Package.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/Package.swift:7)
    - [`The_Button/receiver-mac/Package.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/Package.swift:7)
    - [`LiquidGlassSidebarDemo/Package.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/LiquidGlassSidebarDemo/Package.swift:5)

- Add test target only if you need shared logic tests; a lean pattern is to keep it in a simple checks executable for smoke validation in local/offline environments.
  - File refs:
    - [`DirectChatChecks/main.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/Sources/DirectChatChecks/main.swift:1)
    - [`The_Button/receiver-mac/Package.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/Package.swift:11)
    - [`LiquidGlassSidebarDemo/Package.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/LiquidGlassSidebarDemo/Package.swift:19)

## 2) `build_and_run.sh` app-bundle packaging pattern

- Build-and-package pipeline shared across projects:
  - run `swift build`, get binary via `--show-bin-path`, create/update `dist/<AppName>.app`, copy binary into `Contents/MacOS`, create `Contents/Info.plist`, optionally copy icon, then launch via `open -n`.
  - DirectChat script: explicit scratch path + SDK path + local ad-hoc codesign + kill old process.
    - [`DirectChat/script/build_and_run.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/script/build_and_run.sh:31)
  - Receiver script: same pattern, plus `.icns` copy and explicit `PRODUCT_NAME` mapping.
    - [`The_Button/receiver-mac/script/build_and_run.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/script/build_and_run.sh:5)
  - LiquidGlass script: lean minimal variant (no explicit SDK/codesign); useful as baseline template.
    - [`LiquidGlassSidebarDemo/script/build_and_run.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/LiquidGlassSidebarDemo/script/build_and_run.sh:19)

- Recommended pattern for PowerScout:
  - start from LiquidGlass minimal script,
  - add DirectChat/Receiver hardening (explicit SDK, scratch dir, and optional codesign).

- DMG packaging helper is present in DirectChat only and creates a signed? (ad-hoc) app stage with `/Applications` symlink.
  - [`DirectChat/script/package_dmg.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/script/package_dmg.sh:21)

## 3) SwiftUI app / window / sidebar patterns worth copying

- App bootstrap pattern:
  - `@main` App + `@NSApplicationDelegateAdaptor` + `WindowGroup` + global state object + `Settings` scene.
  - DirectChat uses command group overrides + keyboard shortcuts + settings scene.
  - Receiver uses `onAppear` inside root content to wire store callbacks and startup connect.
  - File refs:
    - [`DirectChat/App/DirectChatApp.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/Sources/DirectChat/App/DirectChatApp.swift:4)
    - [`The_Button/receiver-mac/Sources/TheReceiver/App/TheReceiverApp.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/Sources/TheReceiver/App/TheReceiverApp.swift:3)

- Activation/reopen behavior:
  - `NSApp.setActivationPolicy(.regular)` + `activate(ignoringOtherApps: true)` in AppDelegate.
  - Receiver also restores focus on reopen.
  - File refs:
    - [`DirectChat/App/AppDelegate.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/Sources/DirectChat/App/AppDelegate.swift:5)
    - [`The_Button/receiver-mac/App/AppDelegate.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/Sources/TheReceiver/App/AppDelegate.swift:4)
    - [`LiquidGlassSidebarDemo/App/AppDelegate.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/LiquidGlassSidebarDemo/Sources/LiquidGlassSidebarDemo/App/AppDelegate.swift:4)

- Native-feeling sidebar patterns:
  - Use `List(...).listStyle(.sidebar)` with selection binding and `NavigationSplitView` for master-detail.
  - Add explicit split column constraints for predictable width.
  - File refs:
    - [`LiquidGlassSidebarDemo/Views/SidebarView.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/LiquidGlassSidebarDemo/Sources/LiquidGlassSidebarDemo/Views/SidebarView.swift:18)
    - [`LiquidGlassSidebarDemo/Views/RootSplitView.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/LiquidGlassSidebarDemo/Sources/LiquidGlassSidebarDemo/Views/RootSplitView.swift:28)
    - [`DirectChat/Views/Friends/FriendsSidebarView.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/Sources/DirectChat/Views/Friends/FriendsSidebarView.swift:4)

- Optional window-theming bridge:
  - DirectChat uses `NSViewRepresentable` bridge to set title/toolbar/appearance at runtime.
  - File ref:
    - [`DirectChat/Support/WindowAppearanceBridge.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/Sources/DirectChat/Support/WindowAppearanceBridge.swift:1)

## 4) Gotchas for SwiftPM-built macOS .app

- Product name vs built binary name mismatch is risky.
  - Receiver script uses `APP_NAME="The Receiver"` and `PRODUCT_NAME="TheReceiver"`; Info.plist must match binary.
  - Avoid this by using one canonical executable name.
  - File refs:
    - [`The_Button/receiver-mac/script/build_and_run.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/script/build_and_run.sh:5)

- You must provide `Contents/Info.plist` manually unless you rely on one bundled in repo.
  - Scripts currently generate one fallback if missing.
  - File refs:
    - [`DirectChat/script/build_and_run.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/script/build_and_run.sh:55)
    - [`The_Button/receiver-mac/script/build_and_run.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/script/build_and_run.sh:53)
    - [`LiquidGlassSidebarDemo/script/build_and_run.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/LiquidGlassSidebarDemo/script/build_and_run.sh:27)

- Icon and notification plumbing:
  - Include `.icns` copying and `CFBundleIconFile` if you want app icon.
  - Include alert style/notification keys consistently when using notifications.
  - File refs:
    - [`The_Button/receiver-mac/Info.plist`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/Info.plist:13)
    - [`The_Button/receiver-mac/script/build_and_run.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/The_Button/receiver-mac/script/build_and_run.sh:82)

- Local network permissions / entitlement-like behavior:
  - If using local/private network sockets, include `NSLocalNetworkUsageDescription`.
  - File ref:
    - [`DirectChat/Info.plist`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/Info.plist:27)

- Version/tooling drift:
  - DirectChat pins CLANG module cache path and SDK path explicitly; this avoids some local compiler mismatch issues.
  - File ref:
    - [`DirectChat/script/build_and_run.sh`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/DirectChat/script/build_and_run.sh:8)

- macOS API floor for advanced UI:
  - LiquidGlass uses 26-specific APIs (`.glass`, `navigationSplitViewStyle(.balanced)` + etc) and sets package min 26.
  - File ref:
    - [`LiquidGlassSidebarDemo/Package.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/LiquidGlassSidebarDemo/Package.swift:7)
    - [`LiquidGlassSidebarDemo/App/LiquidGlassSidebarDemoApp.swift`](/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/developer/LiquidGlassSidebarDemo/Sources/LiquidGlassSidebarDemo/App/LiquidGlassSidebarDemoApp.swift:11)

## 5) Minimal PowerScout structure recommendation

Recommended SwiftPM surface:

- `/Sources/PowerScout/App/`
  - `PowerScoutApp.swift` (window bootstrap, commands, settings scene)
  - `AppDelegate.swift` (activation + reopen behavior)
- `/Sources/PowerScout/Core/`
  - domain models, networking, persistence, services
- `/Sources/PowerScoutChecks/`
  - lightweight startup validation executable (ping local data directories, schema checks, relay health checks)
- `/Sources/PowerScoutViews/` or `Sources/PowerScout/App` if you prefer flat app features
- `/Assets/` with `.icns`
- `Info.plist` (version, bundle id, minimum OS, icon, notification usage)
- `/script/build_and_run.sh` (+ optional `/script/package_dmg.sh`)
- `Tests/` for unit tests or decode coverage

Recommended baseline `Package.swift` structure:

- `platforms: [.macOS(.v14)]` unless you specifically need liquid-glass APIs.
- products: executable `PowerScout`, checks executable `PowerScoutChecks`, library `PowerScoutCore`.
- targets map to `Sources/PowerScout`, `Sources/PowerScoutCore`, `Sources/PowerScoutChecks`.

Implementation preference:

- Start with this stack:
  1. direct app bootstrap from DirectChat (`WindowGroup`, state object, commands, settings),
  2. sidebar architecture from LiquidGlass (`NavigationSplitView`, `.listStyle(.sidebar)`, search + detail split),
  3. packaging script from Receiver + DirectChat hardening.
