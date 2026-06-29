# QA Math Safety 001 - Archimedes

- Agent: Archimedes / QA-Math-Safety
- Task id: `qa-math-safety-001`
- Role: read-only verifier
- Model: `gpt-5.4`
- Reasoning effort: medium
- Edit permission: read-only; no file changes
- Status: completed; found zero-deviation strategy bug
- Source note: reconstructed from `.codex-conductor/state.json` lifecycle record because the referenced report path was missing on disk.

## Scope

Strategy math, alliance role simulation, variance/win probability, score reconciliation, defense saturation, shift weighting, and local-first conflict rules. The agent was asked to find one concrete math or logic issue.

## Files Read

- `src/utils/strategyBrain.ts`
- `src/utils/shiftStrategyEngine.ts`
- `src/utils/shiftMetricContract.ts`
- `tests/shiftStrategyEngine.test.mjs`
- `tests/strategyBrainProfiles.test.mjs`
- `tests/shiftMetricContract.test.mjs`

## Commands Recorded

- `rg -n defenseDeviation|compareAllianceStrategies|redWinProbability|variance-gamble`
- `tsx compareAllianceStrategies` reproduction
- `node --test` targeted tests

## Finding

Strategy inputs built from Admin/team profiles were passing zero deviation into the role-combination engine even when scouted records contained real Contribution and Defense variance. This made win probability and smart-gamble comparisons look overconfident, especially when the mean margin was close.

## Integration Response

- `src/utils/strategyBrain.ts` now builds contribution and defense deviation lookups from current profiles/defense attributions.
- Admin V4 passes those deviation lookups into strategy match plan generation.
- `tests/adminV4UxStructure.test.mjs` now checks that Admin V4 uses real deviation lookups instead of deterministic zeros.

## Verification

The conductor later ran:

- `npm run typecheck`
- `node --test tests/scoutRelayPager.test.mjs tests/adminV4UxStructure.test.mjs`
- `swift test`

Those checks passed after the integration checkpoint.

## Safety Notes

No secrets, pushes, deploys, or protected-file edits were performed by the agent.
