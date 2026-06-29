# Betting System Cartographer 001

- Agent: Bacon (`019f1140-4f43-7820-9d81-656e505d9190`)
- Role: explorer
- Model: `gpt-5.4`
- Reasoning effort: medium
- Scope: read-only map of existing PowerCoin betting/reward code, storage, Admin V4 surfaces, and integration risks.
- Files changed by agent: none.

## Findings

The admin-side PowerCoin engine already exists. `PowerCoinBet` and `PowerCoinLedgerEntry` are defined in `src/types.ts`, and `src/utils/adminV4LocalStore.ts` stores bets/ledger in IndexedDB, starts scouts at 1000 points, computes balances, and settles match bets by splitting the losing pool proportionally among winning scouts. Tie or unknown results refund stakes.

Admin V4 already has the head-scout reward surface through `src/components/adminv4/useAdminV4ScoutRewards.ts` and `src/components/adminv4/AdminV4ScoutRewardsPanel.tsx`. It can load bets and ledger rows, show balances/open stake, settle played matches from official winners, and apply manual ledger adjustments.

The missing product slice is scout-facing betting. `/scout` currently has no betting payload in `MatchScoutingV4`, no bet JSON/archive persistence, and no scout-facing dashboard/history/leaderboard. The natural insertion point is in `src/views/MatchScoutV4View.tsx` before the Auto panel.

## Integration Risks

1. Bet data must be added to `MatchScoutingV4`, `initialMatchScoutingV4`, the normalizer, Firebase writes, offline JSON export, and local archive upsert. A UI-only bet would disappear.
2. Existing balance math is name-based. New work should key bets by `scoutNumber` while preserving `scoutName` for display.
3. Duplicate scout-match bet artifacts can double-count unless IDs are stable by event, match, scout number, and version.
4. Lock-on-first-gameplay-action needs one shared guard across Auto counters, shift action toggles, defense sliders, stockpile choices, fouls/failure controls, and Start Game.
5. Tests are currently structural; we need direct wallet/settlement tests for proportional payout, no-winner refunds, one-sided pools, disqualification, and negative-balance prevention.

## Recommendation

Reuse the existing admin settlement engine, but add a new scout-facing bet object to Match Scout V4 and make the Mac app consume the same contract. Do not invent a second payout system.
