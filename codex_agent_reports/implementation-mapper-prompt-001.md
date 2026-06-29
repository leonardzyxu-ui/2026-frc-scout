# Implementation Mapper Prompt Review 001

- Agent: Sartre / Hopper task
- Agent id: `019f10c1-8d18-7ba0-8a9c-ade3ba29da3b`
- Role: explorer / implementation mapper
- Model: `gpt-5.4-mini`
- Reasoning effort: medium
- Edit permission: read-only
- Status: completed

## Purpose

Compare Leo's pasted overnight scouting redesign prompt against the current queue and current repo evidence.

## Status Map

- Partial: metric renaming and stat contract. Core files exist, but old PPC/PPA/reliability framing still needs live UI sweeps.
- Done: shift-based V4 data model, normalization, and reversible first-shift metadata.
- Missing: full alternating shift workflow in Match Scout V4.
- Partial: post-match reconciliation and first-shift correction payload. Missing delivery path.
- Partial: alliance role-combo strategy simulation. Existing engine needs direct Admin V4 strategy consumer.
- Done: archive export/import JSON metadata and retry hints.
- Missing: match-scoped scout disagreement notification loop.
- Partial: native PowerScout surfacing of renamed metrics and strategy vocabulary.

## Top Implementation Slices

1. Build the real per-shift Match Scout V4 composer using `shiftBreakdown`, `defendedTeams`, and `teleopFirstShiftAlliance`.
2. Wire `buildFirstShiftCorrectionNotice()` into a match-scoped notification path.
3. Finish rename sweep in live scout UI, especially `PpaSignalStrip` and `reliabilityScore` framing.
4. Connect `compareAllianceStrategies()` into Admin V4 strategy surfaces.
5. Polish archive export/download UX so JSON export and retry behavior are unmistakable.

## Integration Response

Added the missing and partial slices to `docs/scouting-redesign-prompt-decomposition-2026-06-29.md` and `codex_task_queue.md`.

## Safety Notes

No files were changed by the agent. No credentials, pushes, deploys, or protected file edits were performed.

