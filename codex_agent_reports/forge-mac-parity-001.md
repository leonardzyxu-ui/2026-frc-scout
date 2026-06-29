# Forge Mac Parity 001

- Agent: Forge-MacParity
- Agent id: `019f11be-1bc8-79a2-bd49-9589247d1f99`
- Task id: `MAC-PARITY-001`
- Role: explorer
- Model: `gpt-5.4-mini`
- Reasoning effort: medium
- Edit permission: read-only
- Status: completed
- Source note: reconstructed from `.codex-conductor/state.json` lifecycle record because the original result was a multi-agent completion message instead of a saved report file.

## Scope

Read-only inventory of native PowerScout Mac app parity gaps for PowerCoin and scout-history features.

## Files Read

- `PowerScout/Sources/PowerScoutCore/Views/ContentView.swift`
- `PowerScout/Sources/PowerScoutCore/Models/PowerScoutModels.swift`
- `PowerScout/Sources/PowerScoutCore/Views/ReportsView.swift`
- `PowerScout/Sources/PowerScoutCore/Views/LiveOpsView.swift`
- `PowerScout/Sources/PowerScoutCore/Views/SystemAuditView.swift`
- `PowerScout/Sources/PowerScoutCore/Views/CommandsView.swift`
- `src/views/MatchScoutV4View.tsx`
- `src/components/adminv4/useAdminV4ScoutRewards.ts`
- `src/components/adminv4/AdminV4ScoutRewardsPanel.tsx`
- `src/views/HistoryView.tsx`
- `src/views/SetupView.tsx`
- `src/utils/adminV4LocalStore.ts`

## Finding

The web/Admin side had PowerCoin and scout-history logic, but the native Mac app did not yet give Leo a useful local command-center mirror for wallet state, recent bets, evidence summaries, or sync-ledger health.

## Recommendation

Implement a first native History / Rewards slice rather than trying to build full editing/sync inside PowerScout immediately. The app should start by showing wallet summary, open stake, recent history, evidence ledger state, and clear links back to Admin V4 / Match Scout.

## Integration Response

- Added `PowerScoutSection.historyRewards`.
- Added `PowerCoinWalletSnapshot`, `PowerCoinHistoryRow`, evidence-ledger summaries, and local sync-ledger models to `PowerScoutModels`.
- Added `PowerScout/Sources/PowerScoutCore/Views/HistoryRewardsView.swift`.
- Added tests in `PowerScout/Tests/PowerScoutCoreTests/PowerScoutCoreTests.swift` for native History / Rewards data.

## Safety Notes

No edits, secrets, pushes, deploys, or protected-file changes were made by the agent.
