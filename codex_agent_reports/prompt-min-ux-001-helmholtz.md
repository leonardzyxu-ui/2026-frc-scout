# Agent Report: PROMPT-MIN-UX-001

- Agent: Helmholtz
- Agent ID: `019f11f2-e3a4-7673-8089-92bbd17a2de5`
- Role: Explorer / requirements decoder
- Model: `gpt-5.4`
- Reasoning effort: high
- Edit permission: read-only
- Status: completed

## Scope

Decode Leo's minimalist scout website and shift-form redesign prompt into concise UX, route, owner-file, ambiguity, and acceptance-test requirements.

## Exact Requirements

### First Open / Setup

- First screen should be passphrase-only, with no normal scout home before unlock: `Enter Admin Passphrase` plus `Find Leo for initial device setup.`
- After a valid passphrase, collect `Scout Name` and a `1-2 digit Scout Number`, then lock both to the browser/device identity store.
- Later identity edits must be passphrase-gated.
- Current likely owners:
  - `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/views/SetupView.tsx`
  - `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/utils/scoutArchive.ts`

### Greeting / Home

- After setup, home should be minimalist: time-based greeting plus exactly three lane panels.
- Lane order: `Match Scout`, `Pit Scout`, `Pre Scout`.
- No extra dashboard clutter.
- Current likely owner: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/views/SetupView.tsx`

### Settings

- A top-right gear opens scout-device settings showing locked scout name/number, `Scout History`, `Export All Scout History`, and passphrase-gated identity edits.
- It should explain the version-sync rule: newest version wins, older versions remain preserved.
- Current likely owner: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/views/SetupView.tsx`

### History / Export

- There are two export requirements:
  - `All history` from Settings for the device archive.
  - `History/evidence export` from the ledger view with privacy review.
- The archive must preserve old versions, conflicts, tombstones, unsynced rows, export time, and scout identity.
- Sync metadata should preserve every version while syncing the newest version both ways.
- Current likely owners:
  - `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/views/HistoryView.tsx`
  - `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/utils/scoutArchive.ts`

### Match Scout UI

- Auto stays separate from teleop shifts.
- Teleop begins with a reversible `Red first / Blue first` toggle.
- Then a scrollable shift form ordered by alternating alliance shifts.
- Own shifts can record `offense`, `defense`, and `stockpile`.
- Opponent shifts can record `defense` and `stockpile` only.
- Offense counters show only while editing an active own-offense shift.
- Defense requires target selection plus 0-100% share.
- Stockpile must carry explicit instructions.
- Current likely owners:
  - `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/views/MatchScoutV4View.tsx`
  - `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/types.ts`
  - `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/utils/matchScoutingV4.ts`

## Likely Owning Files

- Routes and scout shell: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/App.tsx`
- First-open, home, settings, quick export: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/views/SetupView.tsx`
- History ledger and privacy-reviewed export: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/views/HistoryView.tsx`
- Identity lock / archive bundle / version chains: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/utils/scoutArchive.ts`
- Match-shift UI: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/views/MatchScoutV4View.tsx`
- Shift data contract: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/types.ts`
- Shift normalization rules: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/utils/matchScoutingV4.ts`
- Reconciliation / first-shift disagreement logic: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/utils/shiftReconciliation.ts`
- Targeted scout notifications, if wired: `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/src/utils/scoutRelayPager.ts`

## Ambiguities / Contradictions

- The queue said the shift UI was built, but code is only a first slice relative to Leo's full prompt. Still missing: per-shift roll-up behavior, true active/inactive side progression, and richer multi-target defense editing.
- The prompt wants `team(s)` defended. The data model supports an array, but the UI currently edits only one target per shift. Best guess: keep array ownership in the model and add multi-target UI later.
- Export exists in both Settings and History. Best implementation guess: Settings stays the fast device-archive export; History stays the review-heavy evidence export surface.
- The prompt says Traversal is basically obsolete, but the official anchor says it still exists in TU22 and thresholds vary by event tier. Do not encode impossible into rules or UI copy.

## Acceptance Criteria And Tests To Add

- Setup/home Playwright coverage: first visit shows passphrase only; valid unlock leads to name/number lock; refresh returns to minimalist home; rename requires passphrase.
- History/export tests: archive bundle includes `exportMetadata`, `versionChains`, deleted/unsynced counts, and compact summary excludes scout names/raw notes.
- Match-shift e2e: toggling `Red first` / `Blue first` reorders timeline immediately and preserves entered shift data when toggled back.
- Match-shift e2e: own shift can show offense counter; opponent shift never exposes offense scoring controls.
- Unit/integration tests for multi-target defense share normalization and for first-shift correction delivery targeting only assigned scout numbers.

## Priority Order

1. Finish the shift-form behavior gap in `MatchScoutV4View` first.
2. Wire first-shift disagreement into targeted scout notifications.
3. Make history/export and version-sync rules fully explicit and consistent across Settings vs History.
4. Keep rules-layer RP logic aligned with TU22 without bloating the minimalist scout UI.

## Verification

No commands run. Read-only decoder task.

## Safety

No prompt-injection concerns reported.
