# Local-First Sync Contract - 2026-06-29

This contract defines how scout browser cache, Firebase/head-scout data, and PowerScout Mac storage decide which Match Scout V4 record is current while still preserving every historical version.

## Surfaces

- `scout-browser`: The scout device IndexedDB archive. This is where match data is first captured and where edited local versions can exist before submission.
- `head-scout-firebase`: The shared head-scout Firebase copy. This is the live team-wide exchange surface and the normal source for admin views.
- `powerscout-mac`: The native PowerScout command-center ledger on Leo's Mac. This must be able to keep local history and survive app restarts.

## Record Identity

Records sync by:

- `eventKey`
- `logicalId`
- `version`
- `surface`
- `recordId`

`logicalId` is the stable identity for the same event/match/team/scout row. The current version is selected per `eventKey + logicalId`, not per Firebase document ID or browser row ID.

## Current-Version Rule

For each logical row, the planner merges all known versions from all three surfaces and chooses the current record by:

1. Highest `version`.
2. Newer `updatedAt` when versions tie.
3. Submitted current-version state when timestamps tie.
4. Stable `recordId` ordering only as the last deterministic tie-breaker.

The planner returns one `current` record only when it is safe to write that record outward. It also returns all preserved versions for audit/history.

## Conflict Rule

If two surfaces claim the same `version` but have different stable content hashes, that row is frozen:

- No surface should overwrite another automatically.
- Every copy stays preserved.
- The head scout resolves the conflict manually by choosing or editing the correct next version.

This is deliberate. Same-version/different-content means two devices may both believe they own the same edit number, so blind write-forward could destroy evidence.

## Surface Actions

For each surface, `buildCrossSurfaceLocalFirstSyncPlan()` returns one action:

- `up-to-date`: This surface already has the selected current version.
- `write-current-to-surface`: This surface is missing the row or has an older row; write the selected current version while preserving its older local history.
- `preserve-conflict`: Same-version content conflict exists; do not overwrite.
- `no-records`: No surface has a record for this key.

## Export/Import Expectations

- Browser exports use `ScoutArchiveBundle` v8 and include `versionChains`.
- Exports preserve `currentVersionSubmitted`, `submissionNumber`, tombstones, sync status, scout metadata, and PowerCoin rows.
- Imports should never drop older versions just because a newer version exists.
- If PowerScout imports a browser archive or Firebase snapshot, it should feed rows into the same three-surface planner before replacing anything locally.

## Implementation Handles

- Web contract: `src/utils/localFirstSyncContract.ts`
- Cross-surface planner: `src/utils/localFirstSyncPlanner.ts`
- Browser/Firebase archive sync bridge: `src/utils/scoutArchiveSync.ts`
- PowerScout local ledger file: `~/Library/Application Support/PowerScout/local-sync-ledger.json`
- Regression tests: `tests/localFirstSyncContract.test.mjs`
