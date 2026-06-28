# Scout Spec Decoder 001

- Agent: Euclid (`019f0ed9-4d1f-73a3-8608-e87ec05bf8bc`)
- Role: Explorer
- Model: `gpt-5.3-codex-spark`
- Reasoning effort: medium
- Edit permission: read-only
- Status: complete

## Purpose

Translate Leo's long overnight scouting redesign prompt into a compact implementation spec.

## Output Summary

Core redesign:

- Rename `PPC` to `Contribution`.
- Split old `PPA` into `Floor`, `Ceiling`, and `Floor Non Zero`.
- Preserve `EPA` and `OPR`.
- Add `DPR` as a researched external/statistical metric.
- Add internal `Defense` as denied-points value.
- Replace vague reliability with `Contribution Deviation` and `Defense Deviation`.

Scouting requirements:

- Pre-scout and pit scout should carry slow/background information and objective robot facts.
- Match scout should become shift-based, with reversible active/inactive alliance metadata.
- Shift rows should capture offense shots/points, defense targets and defender percentages, and stockpile shifts.

Model requirements:

- Reconcile scout totals to official TBA totals proportionally.
- Reconcile multi-defender shares proportionally to 100%.
- Simulate each alliance's best role combination independently, then compare expected margin and variance.
- Include defense saturation because denial cannot exceed opponent available scoring.
- Include ranking-point incentives for 100-point Energized and 360-point Supercharged thresholds.

Operational requirements:

- Detect first-teleop-shift disagreement within a match and notify only scouts assigned to that match.
- Add detailed JSON export from browser cache with export time and scout metadata.
- Keep Admin web and PowerScout aligned where feasible.

## Ambiguities To Track

- Exact statistical windowing for floor/ceiling/deviation metrics.
- Exact authoritative source and mathematical treatment of DPR.
- Exact number/length of shifts and whether shift count is configurable.
- Global vs event-specific standard deviation calibration.
- Alert channel for match-scoped scout notifications.
- Defense saturation redistribution order when multiple defenders overclaim denial.

## Files Changed

None.

## Safety Notes

No credentials, pushes, deploys, or file changes were performed by the agent.
