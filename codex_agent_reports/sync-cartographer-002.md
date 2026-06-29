# Sync Cartographer 002

- Agent: Aristotle (`019f11e2-4cf4-7da0-b0c3-d58e376c09a5`)
- Role: explorer
- Model: `gpt-5.4-mini`
- Reasoning effort: medium
- Scope: read-only map of local-first sync across scout browser cache, Firebase/admin, and native PowerScout.
- Files changed by agent: none.

## Findings

The local-first contract and planner exist, but end-to-end sync is still partial. The relevant core files are:

- `src/utils/localFirstSyncContract.ts`: shared sync record shape, content hash, conflict decisions, and version ledger.
- `src/utils/localFirstSyncPlanner.ts`: adapters and plan builder for scout archive and remote payloads.
- `src/utils/scoutArchive.ts`: browser IndexedDB archive, version chains, content hashes, import/export, and conflict preservation.
- `src/utils/scoutArchiveSync.ts`: archive-to-Firebase uploader and sync-state updates.
- `src/utils/scoutingWrites.ts`: Firestore write/read utilities and duplicate/conflict/replace handling.
- `src/views/HistoryView.tsx` and `src/views/AdminV4View.tsx`: scout/admin retry and sync surfaces.
- `PowerScout/Sources/PowerScoutCore/Views/HistoryRewardsView.swift`: native read-only mirror; not yet a sync bridge.

## Missing Bridge Points

- The planner still needs live consumers that fetch remote Firestore rows, plan a move, and apply it to both local cache and Firebase.
- Browser caches are still partly siloed: scout archive has version chains, but Admin V4 local cache and pre-scout cache are not yet one shared ledger.
- Firebase writes are mostly one-way with conflict detection; remote losers are not yet first-class version-chain rows everywhere.
- Native PowerScout has no direct database bridge yet; it can run commands and show static/status surfaces.

## Recommended First Slice

Start with Match Scout V4 only:

- Use `localFirstSyncPlanner.ts` from `scoutArchiveSync.ts`.
- When syncing a local V4 archive record, read the current Firebase V4 row first.
- If local version is newer, replace Firebase.
- If Firebase is newer, import/preserve that remote row locally and keep the local row unsynced for review.
- If same-version content differs, preserve conflict and do not overwrite.
- Then expose bridge health in `HistoryView.tsx`, `AdminV4View.tsx`, and PowerScout after the core behavior is real.

## Tests Suggested

- Extend `tests/localFirstSyncContract.test.mjs` for same-version conflicts, deleted rows, and adapter conversions.
- Add a focused sync test/source guard for `scoutArchiveSync.ts` proving conflict remains unsynced and newer records are promoted without blind overwrite.
- Add export/import round-trip coverage so preserved conflicts and content hashes survive backups.
- Add native PowerScout tests after a real sync-status model exists.

## Risks

- Never collapse separate `recordId`s just because `logicalId` matches.
- Same `version` plus different `contentHash` is a hard conflict.
- `currentVersionSubmitted` is a hint, not authority.
- Tombstones/deleted rows must stay in the ledger.
- Avoid `replace` unless the planner has proved local is the newest usable row.

## Commands Run

- `rg --files`
- `find ... -name AGENTS.md -o -name codex_task_queue.md`
- `rg -n ...` across sync, archive, Firebase, and PowerScout surfaces
- `sed -n ...` on targeted files

