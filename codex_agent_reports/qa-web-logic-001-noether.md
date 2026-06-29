# QA Web Logic 001 - Noether

- Agent: Noether / QA-Web-Logic
- Task id: `qa-web-logic-001`
- Role: read-only verifier
- Model: `gpt-5.4`
- Reasoning effort: medium
- Edit permission: read-only; no file changes
- Status: completed; found first-shift default bug
- Source note: reconstructed from `.codex-conductor/state.json` lifecycle record because the referenced report path was missing on disk.

## Scope

Website React/TypeScript scout flows, strategy preview, Match Scout V4, archive/sync utilities, and tests. The agent was asked to find one concrete code, math, or logic issue.

## Files Read

- `src/types.ts`
- `src/utils/matchScoutingV4.ts`
- `src/views/MatchScoutV4View.tsx`
- `src/utils/shiftReconciliation.ts`
- `src/utils/scoutingWrites.ts`

## Commands Recorded

- `rg --files`
- `rg -n teleopFirstShiftAlliance|first shift|normalizeMatchScoutingV4|detectFirstShiftConsensus`
- `nl -ba` on selected files

## Finding

Match Scout V4 first-shift state was effectively defaulting to Red in the normalized flow. That meant a scout who had not confirmed the first teleop shift could still produce a row that looked like a real Red-first report, weakening first-shift conflict detection and correction prompts.

## Integration Response

- `src/types.ts` now initializes `teleopFirstShiftAlliance` as an empty value instead of a real alliance.
- `src/utils/matchScoutingV4.ts` preserves unknown first-shift state instead of silently falling back to Red.
- `src/views/MatchScoutV4View.tsx` requires confirmation and shows `Not confirmed` when the field is unknown.
- `tests/matchScoutingV4.test.mjs` and `tests/shiftReconciliation.test.mjs` cover unknown/missing first-shift behavior.

## Verification

The conductor later ran:

- `npm run typecheck`
- `node --test tests/scoutRelayPager.test.mjs tests/adminV4UxStructure.test.mjs`
- `swift test`

Those checks passed after the integration checkpoint.

## Safety Notes

No secrets, pushes, deploys, or protected-file edits were performed by the agent.
