# Scout Archive JSON Schema - 2026-06-29

This document describes the browser-local scout archive export created from Scout Settings and Scout History.

## Bundle

- `format`: Always `rebuilt-2026-scout-archive`.
- `version`: Current export version is `8`.
- `username`: Locked scout display name for the exporting device.
- `exportedAt`: Millisecond timestamp when the JSON file was created.
- `deviceId`: Local browser device identifier when available.
- `schema`: Machine-readable summary of this schema, including local-file download behavior.
- `exportMetadata`: Export time, export source, deleted-record inclusion, PowerCoin inclusion, and retry guidance.
- `recordCounts`: Active/deleted/sync counts by record type and event key.
- `versionChains`: Per-logical-record Match Scout V4 version history.
- `records`: Full local archive rows, including tombstones when present.
- `powerCoinBets`: Local PowerCoin bet rows for the scout.
- `powerCoinLedger`: Local PowerCoin wallet ledger rows for the scout.

## Match Scout V4 Versioning

Every Match Scout V4 record may contain `versionMetadata`.

- `logicalId`: Stable identity for the same match/team/scout record.
- `version`: Monotonic version number for edits to that logical record.
- `parentVersion`: Previous version if known.
- `currentVersionSubmitted`: Whether the newest version on this device has reached the head-scout side.
- `submissionNumber`: `1` when the current version is submitted, otherwise `0`.
- `submittedAt`: Timestamp for the submitted current version.
- `editedAt`: Timestamp for this version's edit.
- `editedByName`: Scout/admin display name that made the edit.
- `editedByScoutNumber`: Scout number when the edit came from a scout device.
- `editedBySurface`: `scout` or `admin`.

Both scout and head-scout sides should preserve every version. During sync, the side with the larger version wins; if versions match, submitted status and content hash decide conflict handling.

## Local File Export

History and Settings exports download a `.json` file directly to the current computer using browser download behavior.

If automatic download is blocked, no local data is deleted. Reopen Scout History or Scout Settings and export again. The source of truth remains the browser's IndexedDB archive until the file is successfully downloaded or synced to the head-scout side.
