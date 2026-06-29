# Rivet QA - PWR QA 001

- Agent: Rivet-QA
- Agent id: `019f11be-1b66-7c80-85ea-f8f0aef78f19`
- Task id: `PWR-QA-001`
- Role: verifier
- Model: `gpt-5.4-mini`
- Reasoning effort: medium
- Edit permission: read-only
- Status: completed-fail; found actionable PowerCoin QA issues
- Source note: reconstructed from `.codex-conductor/state.json` lifecycle record because the original result was a multi-agent completion message instead of a saved report file.

## Scope

Read-only audit of PowerCoin betting, wallet math, disqualification controls, and tests.

## Files Read

- `src/utils/scoutPowerCoins.ts`
- `src/utils/adminV4LocalStore.ts`
- `src/components/adminv4/useAdminV4ScoutRewards.ts`
- `src/components/adminv4/AdminV4ScoutRewardsPanel.tsx`
- `src/views/HistoryView.tsx`
- `tests/scoutPowerCoins.test.mjs`
- `tests/adminV4UxStructure.test.mjs`

## Commands Recorded

- Targeted tests were run by the agent and passed before the agent still marked the slice failed on product/logic gaps.

## Findings

The agent marked the PowerCoin slice as not yet ready because of:

- name-only adjustment ambiguity when two scouts can share a display name
- stale settlement metadata risk after disqualify/restore flows
- status-copy ambiguity around betting state
- missing direct tests for disqualified bets, restore behavior, and scout-number-first identity

## Integration Response

- PowerCoin wallet logic now keys by scout number before display name.
- Disqualified bets are ignored financially.
- Restore paths clear stale settlement state for future settlement.
- `tests/scoutPowerCoins.test.mjs` covers duplicate-name resolution, disqualified-bet handling, and restore behavior.
- `tests/adminV4UxStructure.test.mjs` checks admin disqualification and scout-number-choice plumbing.
- Native PowerScout now has a History / Rewards mirror for the wallet/evidence story.

## Safety Notes

No edits, secrets, pushes, deploys, or protected-file changes were made by the agent.
