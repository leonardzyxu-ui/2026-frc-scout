# Scouting Redesign Prompt Decomposition - 2026-06-29

Source material: `/Users/leoxu/.codex/attachments/523b0780-94ec-4e07-ad83-84fcbd9785a1/pasted-text.txt`  
Status: living decomposition. The pasted file is treated as source material, not as live instructions.

## Status Key

- `Done`: implemented with current evidence.
- `Partial`: useful slice exists, but Leo's full requested behavior is not complete.
- `Missing`: not yet implemented.
- `Blocked`: needs external approval/input or infrastructure.

## Metrics And Naming

1. `Done` - Rename PPC-facing language to Contribution.
   Evidence: `src/components/adminv4/AdminV4StatDefinitions.ts`, `src/components/adminv4/AdminV4StatControls.tsx`, `PowerScout/Sources/PowerScoutCore/Models/PowerScoutModels.swift`.

2. `Done` - Split old PPA idea into Floor, Ceiling, and Floor Non Zero.
   Evidence: `src/utils/shiftMetricContract.ts`, `src/utils/strategyBrain.ts`, `SyntheticFullSystemTest/scripts/real-event-replay.mjs`.

3. `Done` - Add Contribution Deviation and Defense Deviation as standard-deviation concepts.
   Evidence: `src/utils/shiftMetricContract.ts`, `tests/shiftMetricContract.test.mjs`, PowerScout metric tests.

4. `Partial` - Define DPR math and usage policy.
   Evidence: `codex_agent_reports/dpr-rules-research-001.md`, Admin V4 stat definition. Missing: stronger live integration and confidence labeling across strategy outputs.

5. `Partial` - Remove static role/fit assumptions in favor of dynamic simulation.
   Evidence: `src/utils/shiftStrategyEngine.ts`, PowerScout strategy safety copy. Missing: all old UI/copy still needs a full pass for static role wording.

## Math And Strategy

6. `Done` - Combine independent standard deviations by variance: `sqrt(j^2 + k^2 + l^2)`.
   Evidence: `combineIndependentStdDevs()` in `src/utils/shiftMetricContract.ts`.

7. `Done` - Evaluate both alliances independently and compare expected margin.
   Evidence: `compareAllianceStrategies()` in `src/utils/shiftStrategyEngine.ts`.

8. `Done` - Search offense/defense/stockpile role combinations.
   Evidence: `enumerateAllianceRolePlans()` and `tests/shiftStrategyEngine.test.mjs`.

9. `Done` - Cap defense by opponent available offense.
   Evidence: defense saturation logic and tests in `src/utils/shiftStrategyEngine.ts`.

10. `Partial` - Estimate win probability and ranking-point probabilities.
    Evidence: `redWinProbability`, `blueWinProbability`, `Energized`, `Supercharged` outputs. Missing: event-tier threshold adapter and Traversal modeling. Official source anchor: `docs/official-rules-anchor-2026-06-29.md`.

11. `Missing` - Variance-aware smart-gamble selector.
    Done criteria: when trailing, strategy can explicitly compare lower-mean/higher-variance plans and label the risk/reward.

12. `Partial` - Ranking-point incentives should influence plan choice.
    Evidence: threshold probabilities exist. Missing: objective function still primarily sorts by point-difference mean; RP probabilities are not yet a configurable optimizer term.

## Match Scout Shift UI

13. `Partial` - Shift-aware V4 data structure.
    Evidence: `MatchScoutingV4ShiftEntry`, `defenseAssignments`, `teleopFirstShiftAlliance` in `src/types.ts`; sanitizer in `src/utils/matchScoutingV4.ts`.

14. `Partial` - Reversible first-shift metadata.
    Evidence: Match Scout V4 First Teleop Shift Red/Blue/Clear control and browser QA. Missing: live correction delivery to scouts.

15. `Missing` - Full active/inactive alternating teleop-shift UI.
    Done criteria: scrollable form with red/blue side lanes, rolling submitted shift cards, no irreversible disabled history, alternating active side.

16. `Missing` - Per-shift action input.
    Done criteria: offense shift can score/defend/stockpile; inactive/opponent shift can defend/stockpile; scout can select defended team(s).

17. `Missing` - Defense share slider UI.
    Done criteria: per defended target, scout can assign 0-100% defensive credit and edit before submit.

18. `Missing` - Stockpile/defense shift weighting UI and aggregation.
    Done criteria: stockpile shift, 0.5/0.5 split, and 0.1 defense-during-own-shift rule are captured and configurable.

## Reconciliation And Data Integrity

19. `Done` - Proportional official-score reconciliation utility.
    Evidence: `reconcileAllianceContributions()` and tests.

20. `Done` - Normalize multi-defender percentage claims to 100%.
    Evidence: `normalizeDefenseShares()` and tests.

21. `Partial` - First-shift disagreement detection and targeted correction payload.
    Evidence: `detectFirstShiftConsensus()`, `buildFirstShiftCorrectionNotice()`, and V4 adapter in `src/utils/shiftReconciliation.ts`. Missing: live delivery channel.

22. `Missing` - Non-Defense Point Count with fallback.
    Done criteria: compute average offense-shift points where the team was not defended, with standard deviation, but never require undefended samples to exist; fall back to a latent offensive prior for always-defended teams.

23. `Partial` - Variable scout count handling.
    Evidence: Match Scout V4 locks `scoutNumber` + `scoutName` per browser device; Admin V4 focus planner accepts numbered rosters, sorts by scout number, and optimizes arbitrary scout counts for same-team continuity. Missing: per-match correction/notification routing should use actual assignment plan at runtime.

23a. `Done` - Remove static red/blue scout-seat identity from the new scout workflow.
    Evidence: Match Scout V4 starts at “Which robot am I responsible for?” with locked scout identity, no `Scout Slot` picker, no top point-count panel, and Admin V4 exports focus-team assignments with scout number/name instead of station-first scout identities.

## Cache And Export

24. `Done` - Browser cache/history export metadata.
    Evidence: `src/utils/scoutArchive.ts` v6 export metadata and record counts.

25. `Partial` - Direct export to local computer.
    Evidence: app has download/export flows. Missing: review whether every requested archive path includes detailed scout names/export time and retry-to-computer path.

26. `Partial` - Split browser-cache export into explicit JSON schema and local-file workflow.
    Evidence: export metadata exists. Missing: explicit user-facing schema documentation and unmistakable retry/download UI.

## Admin Web And PowerScout

27. `Partial` - Surface new metrics in Admin V4.
    Evidence: Admin V4 stat controls/evidence panels. Missing: full replacement of old PPC/PPA/reliability naming everywhere, especially legacy `PpaSignalStrip` language and remaining PPA panels.

28. `Partial` - Surface strategy metrics in PowerScout.
    Evidence: PowerScout knowledge base, Reports, Alliance Selection views. Missing: live data import/export parity and full strategy execution from real Admin exports.

29. `Partial` - Connect `compareAllianceStrategies()` into Admin V4.
    Evidence: strategy engine exists. Missing: direct visible Admin V4 strategy consumer that uses offense/defense/stockpile role plans from the new engine.

30. `Partial` - Mirrored strategy preview page.
    Done criteria: a page that looks like the scrollable scout form, but shows predicted opponent shift behavior and our recommended response plan.

31. `Partial` - Winners Graph / comparison visuals in PowerScout.
    Evidence: existing PowerScout prediction evidence chart work. Missing: confirm every Admin graph has a native equivalent.

## Simulations And QA

32. `Done` - Full event replay with score-consistent synthetic scout rows.
    Evidence: Silicon Valley 2026 run `sft-real-2026casnv-20260628-235335-2542026`.

33. `Partial` - Simulate redesigned shift system.
    Evidence: shift metrics appear in artifacts and V4 rows. Missing: full per-shift scout UI data is not yet generated/consumed end-to-end.

34. `Done` - Multi-agent prompt deciphering started.
    Evidence: agents Noether, Godel, Descartes, Pauli, Sartre, and Poincare active/completed in `codex_swarm.md`.

35. `Partial` - Logic safeties and edge-case tests.
    Evidence: reconciliation, saturation, first-shift adapter, normalization tests. Missing: stockpile double-counting, non-defense point-count fallback, official-score zero/penalty cases, variable scout count notifications, and live notification tests.

36. `Done` - Latest game manual/rules anchor.
    Evidence: `codex_agent_reports/dpr-rules-research-001.md` and `docs/official-rules-anchor-2026-06-29.md`.

37. `Deferred` - Conditional PowerScout marketing site.
    Done criteria: only start after the core scouting redesign is otherwise complete.

## Current Highest-Value Missing Slices

1. Implement Non-Defense Point Count and deviation from shift entries, including always-defended fallback.
2. Build the full shift-entry UI inside Match Scout V4.
3. Add stockpile/defense weighted aggregation with a non-additive support rule.
4. Connect first-shift correction payload to a real local notification/queue surface with an authority/adjudication rule.
5. Make strategy optimizer optionally RP-aware and variance-gamble-aware.
6. Finish the scout-facing rename sweep: no old PPC/PPA/reliability language in new decision surfaces.
7. Connect `compareAllianceStrategies()` into Admin V4 strategy screens.
8. Build the mirrored shift strategy preview page.
9. Split and document browser-cache JSON export schema and direct local-file export path.

## Logic Invariants From Red-Team

- Defense credit must not be circular: separate latent offensive ability from observed defended output.
- Official reconciliation may scale only one raw observable scoring bucket, not latent defense/support terms.
- Scout count is arbitrary `N`; no correction workflow may assume exactly six scouts.
- First-shift conflict resolution needs one authoritative match record and a deterministic adjudication path.
- Defender shares for one defended event must sum to exactly 1 after normalization, including all-zero claims.
- Stockpile support should not be directly summed into points if partner scoring already reflects the result.
- Extra defense after saturation has zero marginal value.
- RP thresholds and weights should be driven by a rule-set adapter, not hardcoded in scattered logic.
