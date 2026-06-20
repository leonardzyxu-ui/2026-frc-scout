# Admin V4 State Ownership Map

Admin V4 has several kinds of state. This map exists so new work does not quietly add a second owner for the same fact.

## Routing and View Context

Owner: `src/utils/adminV4Routes.ts`

- Owns workflow route changes, focused team/match/wiki state, and preservation of safe context params such as `fixture`, `event`, `eventKey`, and `year`.
- UI code should call route helpers instead of rebuilding query strings by hand.
- Test mode context must survive workflow navigation, team search, handoff returns, and back buttons.

## Event and Admin Settings

Owner: `src/utils/adminV4Settings.ts` and `src/utils/adminV4PickListState.ts`

- Owns saved event key, own team, default workflow settings, and non-secret admin preferences.
- Test mode is not a normal saved setting and must not be persisted as the user's real event state.
- Pick-list alliance seed and status board state are event-scoped, normalized, and kept in the pick-list state utility.
- Settings UI may edit these values, but persistence should stay in the settings utility.

## Local Credentials and Device-Only Secrets

Owner: `src/utils/adminV4LocalStore.ts`

- Owns local TBA API key and FIRST credentials.
- These values are stored only in this browser on this device.
- UI copy must warn not to use shared devices and must provide clear/delete actions in a danger zone.
- Credentials are never exported in safe summaries or shared handoff URLs.

## Local Source Cache and Admin Operation Log

Owner: `src/utils/adminV4LocalStore.ts` and cache guards in `src/utils/adminV4Cache.ts`

- Owns uploaded source snapshots, scout assignment plans, scout reward ledger, staged backup data, and admin audit log entries.
- Cached-first payload guards and latest-cache lookup live outside the main view so workflow tabs consume one normalized cache contract.
- Mutating admin operations should record an audit entry when practical.
- Large operations should use preview, confirmation, and clear status text before writing to Firebase or overwriting local state.

## Live Evidence and Firebase Reads

Owner: `src/views/AdminV4View.tsx` data-loading effects, with collection helpers in utilities.

- Owns loaded scouting rows, pit rows, defense rows, pre-scout evidence, raw editor groups, Firebase status, and source freshness display state.
- Cached data should render first; background refresh should update in place without resetting the user's workflow or scroll position.
- Derived views should consume normalized rows, not refetch the same source just because the user changed tabs.

## Test Mode Fixture Data

Owner: `src/utils/adminV4TestMode.ts` and `src/utils/adminV4TestFixture.ts`

- Owns fixture activation, fixture rewind, synthetic event data, and valid defense metrics.
- Fixture values must remain plausible and normalized, especially defense metrics in the `0..1` range.
- Fixture mode is an explicit route context, not a permanent admin setting.

## Derived Decision State

Owner: memoized selectors in `src/views/AdminV4View.tsx`, helper utilities such as `src/utils/adminV4MatchUtils.ts`, and extracted display components in `src/components/adminv4/`.

- Owns expected ranges, match-day trust labels, future simulations, pick lanes, scout work queue, team evidence summaries, and report rows.
- Match/result interpretation that is reused across workflows belongs in `adminV4MatchUtils.ts`, not inline inside the main coordinator.
- Derived state should have one source of truth and should not be hand-mutated by workflow components.
- Workflow components should receive already-derived props and should focus on rendering and user actions.

## Focused UI State

Owner: `src/views/AdminV4View.tsx`

- Owns the currently focused workflow, team detail, match detail, simulator, settings modal, stat wiki, context menu, and local panel drawers.
- Any button that opens a drill-down view must provide a visible back path.
- Context menus and modals must support keyboard dismissal and restore focus where possible.

## Scout-Facing Task Context

Owner: `src/utils/scoutTaskHandoff.ts` plus local storage.

- Handoff URLs must not carry sensitive strategy, team/match details, return paths, or expected-range detail in query strings.
- New handoff links should use only `handoff=local` plus an opaque local task id; the task payload belongs in this browser's local storage.
- Scout-facing pages may show task context, but model details should stay collapsible and plain-language first.
- Return paths should preserve safe event/test context without exposing private strategy data.
