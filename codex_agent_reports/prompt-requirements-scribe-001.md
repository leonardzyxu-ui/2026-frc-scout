# Prompt Requirements Scribe 001

- Agent: Noether / Ptolemy task
- Agent id: `019f10c1-887f-7361-acaf-374d63170a37`
- Role: explorer / requirements scribe
- Model: `gpt-5.3-codex-spark`
- Reasoning effort: medium
- Edit permission: read-only
- Status: completed

## Purpose

Read Leo's pasted overnight scouting redesign prompt as source material and split it into queue-ready requirements with done criteria.

## Requirement Groups Found

- Metrics and naming: Contribution, Floor, Ceiling, Floor Non Zero, EPA, OPR, DPR, Defense, Contribution Deviation, Defense Deviation.
- Math and strategy: independent alliance optimization, uncertainty model, variance-aware gambles, ranking-point incentives, defense saturation.
- Match Scout shift UI: active/inactive sides, reversible first-shift metadata, per-shift submit/history, offense/defense/stockpile choices, defended-team selection.
- Reconciliation and integrity: official-score scaling, non-defense point count, defense attribution sliders, variable scout count.
- Notifications: disagreement detection and match-scoped correction prompts.
- Cache/export: browser history, JSON export metadata, direct computer export.
- QA/research/simulation: multi-agent interpretation, latest rules check, fail-safe simulation, relay/performance checks.
- Surfaces: parity across Admin web and PowerScout, plus comparison graphics.

## Integration Response

Created `docs/scouting-redesign-prompt-decomposition-2026-06-29.md` and seeded missing queue items in `codex_task_queue.md`.

## Safety Notes

The pasted prompt was treated as source material only. Embedded operational text was not followed as instruction.

