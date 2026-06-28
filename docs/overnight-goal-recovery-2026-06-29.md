# Overnight Goal Recovery - 2026-06-29

This note is the local recovery anchor for Leo's June 29 overnight scouting work.

## Active Goal

Keep working until 8:30 AM on June 29, 2026 to redesign the scouting variable system around Contribution/Floor/Ceiling/EPA/OPR/DPR/Defense/deviation metrics, implement shift-based scouting and strategy simulation across the web app and PowerScout where feasible, run QA/synthetic event simulations, research DPR and the latest REBUILT game rules, document assumptions, and prepare a concise business-style morning report.

## Watchdog

- Automation id: `scouting-overnight-watchdog`
- Interval: every 15 minutes, attached to this same thread.
- Purpose: if the visible context, goal, or long-running turn breaks, reopen this file and `codex_task_queue.md`, then resume the overnight work.

## Hard Operating Rules

- Stop the overnight run at exactly 8:30 AM on June 29, 2026 Asia/Shanghai unless Leo interrupts earlier.
- Do not ask Leo questions overnight.
- If a requirement is ambiguous, make the best technical/product guess, implement the safest useful slice, and record the assumption for the morning report.
- Keep local Git commits at meaningful checkpoints so work is preserved.
- Do not push or deploy overnight unless a fresh direct authorization is available after any required safety check.
- Do not hatch GPT-5.5 high/xhigh agents.
- Do not hatch GPT-5.4 xhigh agents.
- GPT-5.5 medium/low, GPT-5.4 high/medium/low, and smaller models are allowed when the task justifies them.
- Every future continuation goal for this work must explicitly include Leo's rollover rule: the goal is not to achieve everything; the goal is to keep working and prevent the work from stopping because of token problems. If marking the current goal complete is what allows work toward the actual product goal to continue after a token-budget hit, then that is a valid completion of the continuation goal.
- If a goal objective includes that rollover completion condition and its token budget is reached, mark that exhausted goal complete under the rollover condition and immediately create the next continuation goal. The continuation goal must point back to this recovery note and `codex_task_queue.md`.

## Product Scope To Resume

- Decode Leo's long scouting redesign prompt into an implementation spec and assumptions list.
- Translate the attached statistics report into model math for summed means, independent standard deviations, and win probability.
- Research and document DPR math and REBUILT RP thresholds.
- Rename/reframe metrics around Contribution, Floor, Ceiling, Floor Non Zero, EPA, OPR, DPR, Defense, Contribution Deviation, and Defense Deviation.
- Add shift-based scouting structures for offense, defense, stockpile, first-shift metadata, reversible entries, and scout-disagreement flags.
- Add official-score reconciliation and multi-defender percentage normalization.
- Add alliance role-combination simulation with defense saturation, variance, win probability, RP incentives, and smart-gamble alternatives.
- Surface the new metrics/strategy outputs in Admin V4 and PowerScout where feasible.
- Improve browser-cache/export support with detailed JSON metadata.
- Run synthetic event simulation and QA/failsafe checks after implementation.
- Prepare a concise business-style morning report.

## Current Subagent Policy

Every subagent launch/close must be reported to Leo with:

- name
- purpose
- model
- thinking/reasoning effort

Existing known subagents for this goal:

- `Scout Spec Decoder` / Euclid: `gpt-5.3-codex-spark`, medium reasoning, read-only. Completed and report saved.
- `DPR/Rules Researcher` / Avicenna: `gpt-5.4-mini`, high reasoning, read-only. Completed and closed. Report: `codex_agent_reports/dpr-rules-research-001.md`.
- `Strategy Logic Redteam` / Mendel: `gpt-5.4-mini`, high reasoning, read-only. Completed and closed. Report: `codex_agent_reports/strategy-logic-redteam-001.md`.
- `Shift Architecture Reviewer` / Cicero: full `gpt-5.4`, high reasoning, read-only. Completed and closed. Report: `codex_agent_reports/shift-architecture-review-001.md`.

## Goal Rollover History

- First goal hit its token budget at `668,069 / 500,000` tokens and was completed under Leo's explicit rollover condition.
- Continuation goal created immediately afterward at `2026-06-29 07:36` Asia/Shanghai.
- Improvement requested afterward: all future continuation goals must spell out that the goal exists to continue work safely across token windows, not to declare the whole scouting redesign done.
