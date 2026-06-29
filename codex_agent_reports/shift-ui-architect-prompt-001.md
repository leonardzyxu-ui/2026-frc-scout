# Shift UI Architect Prompt Review 001

- Agent: Descartes
- Agent id: `019f10c1-8ad8-74d1-bf8c-4bb7e08b125d`
- Role: explorer / shift UI architect
- Model: full `gpt-5.4`
- Reasoning effort: medium
- Edit permission: read-only
- Status: completed

## Purpose

Read Leo's pasted overnight prompt and map the intended Match Scout shift workflow against the current `MatchScoutV4View`.

## Intended UX Chunks

- One continuous scrollable form that starts with auto and then moves through alternating teleop shifts.
- Two-sided active/inactive shift surface, visually separated by red/blue alliance color.
- Reversible first-shift metadata.
- Per-shift submit, rolling upward into visible history.
- Prior shifts remain readable and editable; nothing disappears or becomes irreversibly grayed out.
- Per-shift action choices: offense, defense, stockpile, inactive/mixed as needed.
- Defense attribution inside shift entries: defended team selection plus percentage sliders.

## Current State

- Exists: reversible First Teleop Shift selector in Match Scout V4.
- Exists: shift-aware data model fields in `src/types.ts`.
- Exists: normalization support for shift records and defended-team percentages in `src/utils/matchScoutingV4.ts`.
- Exists: reconciliation utilities in `src/utils/shiftReconciliation.ts`.

## Missing UX

- Current Match Scout V4 is still mainly a whole-match summary form.
- No active/inactive side layout.
- No rolling per-shift submit or shift history stack.
- No per-shift offense/defense/stockpile chooser.
- No defended-team multi-select plus percentage sliders.
- `initialMatchScoutingV4` does not seed a shift timeline.

## Recommended MVP Sequence

1. Metadata shell.
2. Shift card model in UI.
3. Per-shift action capture.
4. Defense attribution.
5. Per-shift submit flow.
6. Non-grayed scroll history.
7. Whole-match final submit using the built shift timeline.

## Safety Notes

No files were changed by the agent. No credentials, pushes, deploys, or protected file edits were performed.

