# macOS Pattern Scout Report

Agent specs: explorer, `gpt-5.3-codex-spark`, medium reasoning.

The pattern scout inspected DirectChat, The Button receiver, and LiquidGlassSidebarDemo. The full first-write report landed in the sibling folder at `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/Scouting/2026-frc-scout/codex_agent_reports/macos-patterns.md`; this file preserves the usable recommendations in the active scouting repo.

## Recommendations Used

- Use a multi-target SwiftPM structure: a `PowerScout` executable plus `PowerScoutCore` for domain logic and tests.
- Build a manual `.app` bundle in `dist/PowerScout.app` from `swift build --show-bin-path`, with a generated `Info.plist`.
- Keep one canonical executable name, `PowerScout`, so `CFBundleExecutable`, product name, and binary name cannot drift.
- Use a native `NavigationSplitView` with `.listStyle(.sidebar)` for a polished macOS command-center feel.
- Stay on macOS 14 unless advanced macOS 26-only UI APIs become truly necessary.
- Add optional checker/validation executables later if the app needs offline schema or relay health checks.

## Concrete Source Patterns

- DirectChat and The Button receiver both use SwiftPM app/core layouts and manual app-bundle packaging.
- LiquidGlassSidebarDemo gives the simplest sidebar reference: `NavigationSplitView`, sidebar list, and detail panes.
- DirectChat’s build script is the harder production-style pattern; LiquidGlass is the smaller baseline.
