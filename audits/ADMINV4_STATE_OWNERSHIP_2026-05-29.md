# Admin V4 State Ownership Map

This map exists so Admin V4 does not drift back into a hidden global-sidebar app with unclear state.

## Route State

Owner: `src/utils/adminV4Routes.ts`

Route query state is only for shareable, reversible UI position:

- `tab`: top workflow (`now`, `teams`, `matches`, `pick-list`, `visualize`, `data`, `reports`, `wiki`)
- `panel`: focused subview panel
- `mode`: workflow mode such as team detail, match detail, or simulator
- `team`: selected team for a focused team view
- `match`: selected match for a focused match view
- `stat`: focused stat wiki entry
- `from`: wiki/detail return target
- `fixture`, `event`, `eventKey`, `year`: preserved safe event/test context

The route helper deliberately drops unknown params so scout handoff links cannot carry stale strategy context.

## React View State

Owner: `src/views/AdminV4View.tsx`

React state owns transient UI state:

- active workflow and focused detail view
- top search text, suggestions, and search errors
- local model/stat toggles inside the views that need them
- settings modal open/closed state
- stat context menu position and focused wiki stat
- chart stat selections and question presets
- background refresh spinners
- per-view scroll restoration

These values should not be promoted to URL or storage unless the user expects them to survive refresh.

## Local Storage

Owner: `src/utils/adminV4Settings.ts` and `src/utils/adminV4PickListState.ts`

Local storage owns lightweight, non-secret preferences:

- event key
- own team number
- default metric
- last searched team number
- test-mode event key may be remembered for convenience, but test mode itself and the selected cutoff match are session/route context, not permanent real-event state
- pick-list meeting/status board state, event-scoped and normalized through the pick-list state helper

The `admin_v2_settings` key is a compatibility storage name. Product code should refer to this surface as Admin V4.

## IndexedDB

Owner: `src/utils/adminV4LocalStore.ts`

IndexedDB owns larger local/admin-device state:

- TBA API key and FIRST Events credentials
- cached TBA/FIRST/Statbotics/Firebase/upload source payloads
- scout assignment plans
- model validation snapshots
- model feature snapshots
- scout reward prediction and ledger data

Credential values stay local to this browser/device and are not included in full backup exports.

## Firebase

Owner: Firebase utilities and admin/scout sync actions

Firebase owns shared event/scouting records:

- match scout rows
- defense scout rows
- pit scout rows
- app state/current event
- admin role verification

Admin V4 should display cached local data first and refresh Firebase/source data in the background so tab switches do not reset the user's scroll or decision context.

## Uploads And Exports

Owner: Admin V4 Data and Reports workflows

Uploads are explicit user actions:

- TBA/FIRST credential JSON
- TBA CSV/source packs
- local backup JSON
- scout archive QR/JSON

Exports split by risk:

- Reports: audience-safe workbook/report outputs
- Data: full local backup with privacy warning and preview

Destructive or privacy-sensitive actions must stay inside explicit confirmation flows or `DangerZone`.
