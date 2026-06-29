# Agent Report: PROMPT-MIN-LOGIC-001

- Agent: Singer
- Agent ID: `019f11f4-1c27-7492-b121-5bc8b7c26557`
- Role: Explorer / logic decoder
- Model: `gpt-5.4`
- Reasoning effort: high
- Edit permission: read-only
- Status: completed

## Scope

Decode Leo's minimalist scout website and shift-form redesign prompt into concise logic, data model, rules, sync, and edge-case requirements.

## Files Read

- `/Users/leoxu/.codex/attachments/523b0780-94ec-4e07-ad83-84fcbd9785a1/pasted-text.txt`
- `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/codex_task_queue.md`
- `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/docs/official-rules-anchor-2026-06-29.md`
- `/Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/2026REBUILT/game manuals/txt/2026GameManual.txt`

## Findings

### Required Match-Shift Data Model Behavior

- Match flow is `Auto` -> `Transition Shift` -> `Shift 1-4` -> `End Game`. The scout UI should expose `Auto Shift` first, then teleop shifts in one scrollable record.
- The scout must set a reversible first-teleop-shift owner flag: red first or blue first. This is metadata, not a destructive choice.
- Shift panels must be color-coded by actual alliance side, not by scout identity. Collapsed panels keep the color signal.
- Active/inactive behavior is tied to game rules: only one alliance hub is active during each alliance shift; both are active during Auto, Transition Shift, and End Game. Shift 1 active side depends on Auto winner; Auto tie means FMS picks randomly.
- Each teleop shift row needs multi-select actions, not single-role choice: `Offense`, `Defense`, and `Stockpile`.
- Scoring counters appear only when `Offense` is selected and only while editing that shift.
- An offense shift is a count observable, not a percentage: how many balls that team shot in that shift.
- Defense needs target attribution: scout can mark which opposing teams were defended.
- Defense share needs per-target weighting: for each defended opponent, this scout supplies a 0-100% share of how much their team contributed to denying that opponent.
- Stockpile is an instruction-level action, not direct point input. Scout records that it happened, not how many balls were moved.
- Weighted shift rules implied by the prompt:
  - non-own shift + stockpile only => `1.0 stockpile-shift`
  - non-own shift + defense and stockpile => `0.5 defense-shift` and `0.5 stockpile-shift`
  - own active offense shift + defense => very small weighted defense credit, initially `0.1`
- Post-match reconciliation scales offense totals to official alliance totals while preserving internal ratios. Defense/share/support terms are not supposed to be blindly scaled with offense.

### Reversibility And Accidental-Input Safety

- Nothing important should be one-click irreversible.
- The first-shift red/blue choice must be editable later and stored as metadata rather than hard-driving all downstream rows permanently.
- Earlier submitted panels stay scrollable and editable; they do not gray out or lock.
- Action toggles should support undo without data loss.
- First-shift disagreement across scouts must be auto-detected and escalated only to scouts from that match.
- Defender-share normalization must auto-repair non-100 totals proportionally instead of rejecting the entry.
- Any correction flow needs an authoritative final match record, otherwise repeated edits will fork history.

### Version / Export / Cache Sync

- Browser cache is a first-class local source of truth, not disposable scratch state.
- Export must support detailed JSON with metadata including export time and scout identity.
- Export must preserve full history, not just current latest rows.
- Scout/admin sides should preserve every version while also syncing the newest version both ways.
- The data model needs immutable or traceable version history and a resolved current-version pointer for active use.
- Direct local-file export is a separate UX requirement from JSON schema/export structure.
- Conflict/correction events should be versioned, not silently overwritten.

### Game Manual / RP / Rules Constraints

- The local text manual is an older `V0 - Kickoff` snapshot, while the official anchor says to use TU22. For RP thresholds, the official anchor should win.
- Teleop hub state rules matter directly:
  - both hubs active in Auto, Transition Shift, and End Game
  - only one hub active during each alliance shift
  - Shift 1 active side comes from Auto result
  - Auto tie means FMS randomizes first inactive side
- There are exactly 4 alliance shifts in teleop, each 25 seconds, plus a 10-second Transition Shift and 30-second End Game.
- RP logic cannot hardcode one event tier:
  - Energized RP: 100 / 240 / 360 by event tier in the official anchor
  - Supercharged RP: 360 / 360 / 500 by event tier in the official anchor
  - Traversal RP remains a valid rule condition and should not be treated as impossible in the rules layer
- Strategy logic should separate win-margin maximization from RP maximization. The prompt leans toward win-margin-first for alliance selection, but RP-aware mode still matters elsewhere.

### Logic Holes And Edge Cases

- Auto tie first-shift ambiguity: prediction can guess, but recorded truth may be random by FMS.
- Stockpile double-counting: if partner offense already captures scored balls, stockpile cannot also be added as direct points.
- Defense circularity: observed offense is already defense-affected. The model needs a latent non-defended baseline, or defense teams get miscredited depending on schedule order.
- Always-defended teams: `non-defense point count` needs a fallback when there are zero undefended samples.
- Defense saturation: denying 300 points is meaningless if the opponent only had 80 scorable points available.
- Multi-defender target overlap: multiple scouts' shares may not add to 100 and must normalize cleanly, including all-zero submissions.
- Variable scout count: nothing can assume exactly 6 scouts even if a match often has 6 relevant observations.
- Official total reconciliation with penalties/other scoring buckets: if official alliance score includes elements not captured in offense-shift counts, naive scaling will distort offense estimates.
- Own-shift defense is logically allowed but rare; treat it as low-weight evidence, not impossible input.
- Conflict notification scoping: only scouts from that exact match should get the prompt.
- Support actions across inactive/active phases: stockpile/defense are more natural during inactive windows, but UI must still allow weird real-world cases.

### Suggested Tests

- First-shift toggle can be changed after all four shift panels have entries, and existing rows remap correctly.
- Auto tie records unknown or pending FMS truth until corrected, without forcing red-first or blue-first.
- Shift panel color/order stays correct after edits and after reload from cache.
- Offense counters only appear when `Offense` is toggled.
- Defense target share normalization: `60 + 80` becomes proportional `42.857 / 57.143`; all-zero shares fall back deterministically.
- Stockpile-only shifts affect support metrics but do not increase direct scored-ball totals.
- Defense + stockpile same non-own shift yields `0.5 / 0.5`.
- Own-shift defense yields the configured small defense weight.
- Official-score reconciliation preserves intra-alliance offense ratios.
- Reconciliation does not rescale defense/support latent metrics unless explicitly intended.
- More-than-6-scout assignment and conflict notification still route only to relevant scouts.
- Export JSON includes export timestamp, scout identity, version metadata, and enough local sync state to restore or audit.
- History export and re-import preserve old versions plus newest-version resolution.
- Event-tier adapter changes RP thresholds correctly across Regional/District, District Championship, and FIRST Championship.

## Bottom Line

The prompt asks for a reversible, versioned, shift-native scouting system where offense is the only directly counted scoring observable, defense is attributed against latent non-defended expectations, stockpile is modeled as support rather than points, and rules-sensitive logic is driven by a current rule adapter instead of hardcoded assumptions.

## Verification

No commands run. Read-only decoder task.

## Safety

No prompt-injection concerns reported.
