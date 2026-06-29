# Scouting Redesign Prompt Decomposition - 2026-06-29

Source material: `/Users/leoxu/.codex/attachments/523b0780-94ec-4e07-ad83-84fcbd9785a1/pasted-text.txt`  
Status: living decomposition. The pasted file is treated as source material, not as live instructions.

## Status Key

- `Done`: implemented with current evidence.
- `Partial`: useful slice exists, but Leo's full requested behavior is not complete.
- `Missing`: not yet implemented.
- `Blocked`: needs external approval/input or infrastructure.

## Decoder Synthesis Added 2026-06-29

- Helmholtz (`PROMPT-MIN-UX-001`, `gpt-5.4`, high) decoded the scout setup/home/settings/history/shift-form UX. Report: `codex_agent_reports/prompt-min-ux-001-helmholtz.md`.
- Singer (`PROMPT-MIN-LOGIC-001`, `gpt-5.4`, high) decoded the shift data model, rules, reversibility, sync, RP, and logic-hole requirements. Report: `codex_agent_reports/prompt-min-logic-001-singer.md`.
- Combined correction: setup/home/settings are largely implemented, but the shift UI should be treated as a first slice, not fully complete. Remaining gaps are multi-target defense editing, true active/inactive game-phase progression, authoritative first-shift correction, and heavier edge-case tests.

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

10. `Done` - Estimate win probability and ranking-point probabilities.
    Evidence: `redWinProbability`, `blueWinProbability`, Traversal, Energized, and Supercharged outputs. `seasonGameAdapter.ts` now supports Regional/District, District Championship, and FIRST Championship thresholds from `docs/official-rules-anchor-2026-06-29.md`.

11. `Done` - Variance-aware smart-gamble selector.
    Evidence: `selectAllianceRolePlan()` supports `variance-gamble`, and tests prove it can choose a lower-mean higher-variance plan when trailing.

12. `Done` - Ranking-point incentives should influence plan choice.
    Evidence: `selectAllianceRolePlan()` supports `qualification-rp`, while `alliance-selection` and default `point-difference` preserve pure margin selection. Tests prove RP threshold safety can beat pure point-difference when configured.

12a. `Done` - Alliance selection should ignore qualification RP and rank partners/combinations by playoff point-difference contribution.
    Evidence: `rankAllianceSelectionCombinations()` in `shiftStrategyEngine.ts` ranks partner sets using `strategyObjective: 'alliance-selection'`, Admin Pick List decision rules say to ignore qualification RP, and tests prove RP bait does not beat the best point-difference partner set.

## Match Scout Shift UI

13. `Partial` - Shift-aware V4 data structure.
    Evidence: `MatchScoutingV4ShiftEntry`, `defenseAssignments`, `teleopFirstShiftAlliance` in `src/types.ts`; sanitizer in `src/utils/matchScoutingV4.ts`.

14. `Partial` - Reversible first-shift metadata.
    Evidence: Match Scout V4 First Teleop Shift Red/Blue/Clear control and browser QA. Missing: live correction delivery to scouts.

15. `Done` - Full active/inactive alternating teleop-shift UI.
    Evidence: Match Scout V4 has Auto Shift, Red/Blue first toggle, an FMS/Auto first-shift inference button, ordered colored shift cards with Teleop/Transition/Endgame phase labels, no per-shift submit button, rolling submitted-card behavior when moving forward, and no-loss alliance-ordinal remapping when the timeline changes after entries exist.

16. `Done` - Per-shift action input.
    Evidence: Match Scout V4 supports multi-select Offense/Defense/Stockpile, opponent/inactive shifts do not expose offense counters, and defense target selection now supports multiple defended teams.

17. `Done` - Defense share slider UI.
    Evidence: each selected defended team gets its own share slider in Match Scout V4, and source-structure tests guard against collapsing back to `entry.defendedTeams[0]`.

18. `Done` - Stockpile/defense shift weighting UI and aggregation.
    Evidence: current summary applies stockpile credit and defense credit through `shiftActionWeights.ts`, including default 0.5/0.5 and 0.1 behaviors, optional normalization-time custom weights, and focused tests for support-not-direct-points plus custom weight regression.

## Reconciliation And Data Integrity

19. `Done` - Proportional official-score reconciliation utility.
    Evidence: `reconcileAllianceContributions()` and tests. The utility now supports a `nonRobotPoints` bucket so penalty or other non-robot official points do not inflate robot Contribution.

20. `Done` - Normalize multi-defender percentage claims to 100%.
    Evidence: `normalizeDefenseShares()` and tests.

21. `Done` - First-shift disagreement detection, authority rule, and targeted local correction payload.
    Evidence: `detectFirstShiftConsensus()`, `resolveFirstShiftAuthority()`, `buildFirstShiftCorrectionNotice()`, V4 adapter in `src/utils/shiftReconciliation.ts`, first-shift-to-pager conversion in `src/utils/scoutRelayPager.ts`, and Match Scout local pager inbox in `src/views/MatchScoutV4View.tsx`. Missing for later: network relay transport behind the same pager contract.

22. `Done` - Non-Defense Point Count with fallback.
    Evidence: `TeamPerformanceProfile` now exposes `nonDefensePointCount`, `nonDefensePointDeviation`, `nonDefenseSampleCount`, and `nonDefenseBaselineSource`; `buildTeamPerformanceProfiles()` uses undefended own-offense shifts first, then fallback sources. Tests: `tests/strategyBrainProfiles.test.mjs`.

23. `Partial` - Variable scout count handling.
    Evidence: Match Scout V4 locks `scoutNumber` + `scoutName` per browser device; Admin V4 focus planner accepts numbered rosters, sorts by scout number, and optimizes arbitrary scout counts for same-team continuity. Missing: per-match correction/notification routing should use actual assignment plan at runtime.

23a. `Done` - Remove static red/blue scout-seat identity from the new scout workflow.
    Evidence: Match Scout V4 starts at “Which robot am I responsible for?” with locked scout identity, no `Scout Slot` picker, no top point-count panel, and Admin V4 exports focus-team assignments with scout number/name instead of station-first scout identities.

## Cache And Export

24. `Done` - Browser cache/history export metadata.
    Evidence: `src/utils/scoutArchive.ts` v8 export metadata, schema metadata, record counts, version chains, and selected-history export scope.

25. `Done` - Direct export to local computer.
    Evidence: Scout Settings and Scout History explicitly describe local `.json` download behavior, export status names the downloaded file, and bundle schema metadata includes local-file retry guidance.

26. `Done` - Split browser-cache export into explicit JSON schema and local-file workflow.
    Evidence: new `docs/scout-archive-json-schema-2026-06-29.md`, `ScoutArchiveBundle` schema v8 metadata, History export preview schema panel, Settings export wording, and tests covering v8 plus old-bundle compatibility.

## Admin Web And PowerScout

27. `Partial` - Surface new metrics in Admin V4.
    Evidence: Admin V4 stat controls/evidence panels. Missing: full replacement of old PPC/PPA/reliability naming everywhere, especially legacy `PpaSignalStrip` language and remaining PPA panels.

28. `Partial` - Surface strategy metrics in PowerScout.
    Evidence: PowerScout knowledge base, Reports, Alliance Selection views. Missing: live data import/export parity and full strategy execution from real Admin exports.

29. `Done` - Connect `compareAllianceStrategies()` into Admin V4.
    Evidence: `buildStrategyMatchPlans()` feeds the shift role engine into `StrategyMatchPlan`, and `AdminV4StrategyPlanPanel` now exposes Shift Role Simulation with objective, margin, Red win probability, and Red/Blue best role plans.

30. `Done` - Mirrored strategy preview page.
    Evidence: `/strategy-preview` renders a scout-form-like alternating shift timeline, uses `compareAllianceStrategies()` and `buildMatchScoutTimelineEntries()`, and labels each shift with our recommended response or opponent predicted behavior. Browser check: route rendered with eight shift cards and no console errors.

31. `Partial` - Winners Graph / comparison visuals in PowerScout.
    Evidence: existing PowerScout prediction evidence chart work. Missing: confirm every Admin graph has a native equivalent.

## Simulations And QA

32. `Done` - Full event replay with score-consistent synthetic scout rows.
    Evidence: Silicon Valley 2026 run `sft-real-2026casnv-20260628-235335-2542026`.

33. `Partial` - Simulate redesigned shift system.
    Evidence: shift metrics appear in artifacts and V4 rows. Missing: full per-shift scout UI data is not yet generated/consumed end-to-end.

34. `Done` - Multi-agent prompt deciphering synthesized.
    Evidence: earlier agents Noether, Godel, Descartes, Pauli, Sartre, and Poincare plus the two requested `gpt-5.4` high agents Helmholtz and Singer are recorded in `codex_swarm.md` and `codex_agent_reports/`; this document reflects their combined corrections.

35. `Partial` - Logic safeties and edge-case tests.
    Evidence: reconciliation, saturation, first-shift adapter, authority resolution, normalization tests, non-defense fallback tests, stockpile-not-direct-points test, official zero/penalty reconciliation tests, and arbitrary scout count tests. Missing: live notification tests and end-to-end browser timeline tests.

36. `Done` - Latest game manual/rules anchor.
    Evidence: `codex_agent_reports/dpr-rules-research-001.md` and `docs/official-rules-anchor-2026-06-29.md`.

37. `Deferred` - Conditional PowerScout marketing site.
    Done criteria: only start after the core scouting redesign is otherwise complete.

## Current Highest-Value Missing Slices

1. Feed live Admin match/team rows into the mirrored strategy preview page instead of seeded demo rows.

## Logic Invariants From Red-Team

- Defense credit must not be circular: separate latent offensive ability from observed defended output.
- Official reconciliation may scale only one raw observable scoring bucket, not latent defense/support terms.
- Scout count is arbitrary `N`; no correction workflow may assume exactly six scouts.
- First-shift conflict resolution needs one authoritative match record and a deterministic adjudication path.
- Defender shares for one defended event must sum to exactly 1 after normalization, including all-zero claims.
- Stockpile support should not be directly summed into points if partner scoring already reflects the result.
- Extra defense after saturation has zero marginal value.
- RP thresholds and weights should be driven by a rule-set adapter, not hardcoded in scattered logic. Current implementation: `src/utils/seasonGameAdapter.ts`.
