# Shift Architecture Review - Cicero

- Agent: Cicero
- Agent id: `019f0edd-f59c-7cf0-82f3-5c54d3d96f7c`
- Role: explorer
- Model: full `gpt-5.4`
- Reasoning effort: high
- Status: completed, closed
- Files changed by agent: task queue only, no product code

## Architecture Read

The safest implementation route is to add a new shift-aware metric contract first, then adapt the existing PPC/PPA surfaces to it. Renaming everything in-place inside Admin V4 would spread churn across the app, model, synthetic tests, and PowerScout at the same time.

## Core Ownership Map

- Match row shape and storage: `src/types.ts`, `src/utils/matchScoutingV4.ts`, `src/utils/scoutingWrites.ts`, `src/views/MatchScoutV4View.tsx`
- Team metric and forecast logic: `src/utils/strategyBrain.ts`, `src/utils/ppaInsights.ts`, `src/utils/adminV4Analytics.ts`
- Admin V4 consumers: `src/views/AdminV4View.tsx`, `src/components/adminv4/AdminV4PpaPanels.tsx`, `src/components/adminv4/AdminV4TeamEvidencePanels.tsx`, `src/components/adminv4/AdminV4TeamsWorkflow.tsx`, `src/components/adminv4/AdminV4StrategyPlanPanel.tsx`, `src/components/adminv4/AdminV4StatDefinitions.ts`, `src/utils/scoutTaskHandoff.ts`
- Modeling pipeline: `modeling/src/types.ts`, `modeling/src/data/ingest.ts`, `modeling/src/data/store.ts`, `modeling/src/modeling/features.ts`
- Synthetic full-system layer: `SyntheticFullSystemTest/scripts/real-event-replay.mjs`, `SyntheticFullSystemTest/scripts/tune-agentic-workflow.mjs`
- PowerScout surfaces: `PowerScout/Sources/PowerScoutCore/Models/PowerScoutModels.swift`, `PowerScout/Sources/PowerScoutCore/Views/AllianceSelectionView.swift`, `PowerScout/Sources/PowerScoutCore/Views/ReportsView.swift`

## Suggested New Files

- `src/utils/shiftMetricContract.ts`
- `src/utils/shiftReconciliation.ts`
- `src/utils/shiftStrategyEngine.ts`
- `src/utils/shiftMatchAggregation.ts`
- `PowerScout/Sources/PowerScoutCore/Models/ShiftStrategySnapshot.swift`
- `PowerScout/Sources/PowerScoutCore/Services/AdminExportLoader.swift`
- `SyntheticFullSystemTest/lib/shiftReplayMetrics.mjs`

## Migration Plan

- Extend `MatchScoutingV4`; do not replace it.
- Keep `schemaVersion: 'v4'`.
- Add optional `shiftBreakdown`, `defenseAssignments`, and `officialReconciliation`.
- Derive new metrics first: `Contribution`, `Floor`, `Ceiling`, `FloorNonZero`, `Defense`, `ContributionDeviation`, and `DefenseDeviation`.
- Keep legacy aliases during one transition cycle:
  - `ppc -> contribution`
  - `ppa.expected -> contribution`
  - `ppa.floor -> floor`
  - `ppa.ceiling -> ceiling`
  - `lowestNonZeroScore -> floorNonZero`
- Do not pretend deviation is the same thing as reliability. Keep `reliability` as a temporary legacy field until old panels and tests are migrated.
- Emit both new names and legacy aliases in modeling/SFT artifacts for one full cycle.

## Overnight Slice

- Add shift-aware row schema and aggregation.
- Update Match Scout V4 to capture fixed teleop shifts, first-shift metadata, offense, defense, stockpile, and reversible active/inactive state if time permits.
- Compute new team metrics from those rows while keeping Admin V4 panels alive as adapters.
- Surface new metrics in team detail/table first.
- Keep the full alliance simulator rewrite behind the new strategy engine and tests before replacing all UI surfaces.

## Recommendation

Do the first slice as "new shift row contract + derived metrics + narrow Admin V4 surfacing," then replace the strategy internals behind that stable contract. This keeps the product moving without breaking half the repo just to rename PPA.
