# QA PowerScout Mac 001 - Galileo

- Agent: Galileo / QA-PowerScout-Mac
- Task id: `qa-powerscout-mac-001`
- Role: read-only verifier
- Model: `gpt-5.4`
- Reasoning effort: medium
- Edit permission: read-only; no file changes
- Status: completed; found synthetic ledger-on-load bug
- Source note: reconstructed from `.codex-conductor/state.json` lifecycle record because the referenced report path was missing on disk.

## Scope

PowerScout SwiftUI app, Swift package tests, local sync ledger, History/Rewards, Live Ops, strategy evidence, and Mac app surface parity. The agent was asked to find one concrete native app bug or logic mismatch.

## Files Read

- `PowerScout/Sources/PowerScoutCore/Services/PowerScoutSyncLedgerStore.swift`
- `PowerScout/Sources/PowerScoutCore/Views/HistoryRewardsView.swift`
- `PowerScout/Sources/PowerScoutCore/Models/PowerScoutModels.swift`
- `PowerScout/Tests/PowerScoutCoreTests/PowerScoutCoreTests.swift`

## Commands Recorded

- `rg --files`
- `rg -n loadSnapshot|refreshSnapshot|Local-First Sync Ledger|Contract ready|Three-way planner active`
- `swift test`

## Finding

`PowerScoutSyncLedgerStore.loadSnapshot()` created a default synthetic ledger when no local ledger existed. Passive reads should not create proof-looking data because that can make the native app appear more synced than it really is.

## Integration Response

- `PowerScout/Sources/PowerScoutCore/Services/PowerScoutSyncLedgerStore.swift` now throws `LedgerError.missingLedger` on passive load when the ledger is absent.
- `refreshSnapshot()` remains the intentional path that writes a new local ledger.
- `PowerScout/Tests/PowerScoutCoreTests/PowerScoutCoreTests.swift` now verifies that passive load does not create a ledger and refresh does.

## Verification

The conductor later ran:

- `swift test`
- `./script/build_and_run.sh`

The native app built, tests passed, and a single fresh `PowerScout.app` process was opened and inspected.

## Safety Notes

No secrets, pushes, deploys, or protected-file edits were performed by the agent.
