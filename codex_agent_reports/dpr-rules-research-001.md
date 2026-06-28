# DPR and REBUILT Rules Research - Avicenna

- Agent: Avicenna
- Agent id: `019f0ed9-7b5a-77c1-84cb-19e0aac81954`
- Role: explorer
- Model: `gpt-5.4-mini`
- Reasoning effort: high
- Status: completed, closed
- Files changed by agent: none

## Rule Check

For standard regional/district events, the REBUILT bonus RP thresholds match Leo's stated model assumptions:

- Energized: 100 fuel
- Supercharged: 360 fuel
- Traversal: 50 tower points
- Each bonus RP is worth 1 ranking point

Important correction: Traversal should not be modeled as obsolete. It may be rare at a given event if climbing is weak, but the rule still gives it a full ranking point.

Sources to keep in the morning report / implementation notes:

- FIRST 2026 Season Materials: https://www.firstinspires.org/resources/library/frc/season-materials
- 2026 Game Manual TU22 PDF: https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf

## DPR Math

No official FIRST page was found defining DPR directly. Use the standard OPR-style interpretation:

- Build an alliance appearance matrix `M`, where each row is an alliance in a match and each column is a team.
- OPR solves `M x ~= s`, where `s` is that alliance's score.
- DPR solves `M d ~= o`, where `o` is the opponent alliance's score.
- In the full-rank ideal case: `d = (M^T M)^-1 M^T o`.
- In practice, use least squares / pseudoinverse.

Sources:

- The Blue Alliance OPR intro: https://blog.thebluealliance.com/2017/10/05/the-math-behind-opr-an-introduction/
- Chief Delphi TBA stat discussion: https://www.chiefdelphi.com/t/tba-stat-ratings/412308

## Use DPR Safely

DPR is a context feature, not causal defensive truth.

Use it for:

- Fast event-level signal of how much score tends to come against alliances when a team is present.
- A supporting feature in defense-oriented match prep.
- Early scouting triage when human notes are sparse.

Do not use it as:

- A direct proof of defense skill.
- A stand-alone role assignment.
- A replacement for scout-observed Defense.

Failure modes:

- Strong offense can indirectly suppress the opponent, so DPR can reward things that are not defense.
- Early-event DPR is noisy and schedule-sensitive.
- Games with shared game pieces, heavy interaction, or cooperative/endgame score effects distort attribution.
- OPR-style ratings can be weak when observations are few compared with number of robots.

Implementation implication:

- Show DPR with match count/sample confidence.
- Shrink early DPR toward event average until the sample is meaningful.
- Keep DPR separate from live scout-observed Defense to avoid double counting.
- Let DPR adjust priors, not final strategy by itself.
