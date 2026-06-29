# PowerScout Local-First Sync Contract

## Purpose

PowerScout, Firebase, and scout browser caches must preserve every version of every scouting row while still agreeing on which version is current.

This contract is implemented in `src/utils/localFirstSyncContract.ts`.

## Surfaces

- `scout-browser`: the scout device IndexedDB cache and JSON export.
- `head-scout-firebase`: the shared Firebase record used by Admin V4.
- `powerscout-mac`: the native Mac command center local database.

## Record Identity

Every syncable row needs:

- `eventKey`
- `logicalId`
- `version`
- `currentVersionSubmitted`
- `updatedAt`
- `surface`
- `recordId`
- optional `deleted`
- optional `contentHash`

For Match Scout V4, `logicalId` should come from `versionMetadata.logicalId`, and `version` should come from `versionMetadata.version`.

## Decision Rule

1. Different `eventKey` or `logicalId` means conflict. Preserve both.
2. Matching `contentHash` means no-op. Preserve both copies as evidence.
3. Higher `version` wins.
4. Equal version with different `contentHash` means conflict. Preserve both.
5. Equal version without content proof uses timestamp, then submitted-state, then record id as a deterministic tie-breaker.

The losing side is never deleted. It is kept in the version ledger.

## Required Behavior

- If a scout has version 2 and the head scout has version 1, push from scout to head scout.
- If the head scout has version 3 and the scout has version 2, pull back to scout.
- If both sides claim version 2 with different content, preserve both as a conflict and require admin review.
- If any side has a tombstone/deleted record, preserve the tombstone as another versioned row.

## Next Implementation Work

- Add content hashes to scout archive exports.
- Store the same version ledger in PowerScout local storage.
- Teach Admin V4 import to call the contract before applying scout JSON.
- Add a native PowerScout sync panel showing current version, preserved versions, and conflicts.
