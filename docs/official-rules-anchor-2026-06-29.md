# Official Rules Anchor - 2026 REBUILT

Verified on: 2026-06-29  
Purpose: keep PowerScout's ranking-point and rules assumptions tied to official FIRST-hosted sources.

## Official Sources

- FIRST Season Materials page: <https://www.firstinspires.org/resources/library/frc/season-materials>
- REBUILT Game Manual, Version TU22: <https://firstfrc.blob.core.windows.net/frc2026/Manual/2026GameManual.pdf>
- Team Update 22: <https://firstfrc.blob.core.windows.net/frc2026/Manual/TeamUpdates/REBUILT_TeamUpdate22.pdf>

The Season Materials page links both the REBUILT Game Manual and Team Update 22. The manual PDF identifies itself as Version TU22.

## Ranking Point Thresholds From Manual TU22

Table 6-5 lists REBUILT BONUS RP thresholds:

| Bonus RP | Regional/District Events | District Championships | FIRST Championship |
| --- | ---: | ---: | ---: |
| Energized RP | 100 | 240 | 360 |
| Supercharged RP | 360 | 360 | 500 |
| Traversal RP | 50 | 50 | 50 |

Manual implication for PowerScout:

- Do not hardcode only regional thresholds into generic strategy code.
- Do not treat Traversal as impossible in the rules layer. It may be low-probability at an event, but it remains a valid RP condition.
- Strategy code should accept an event-tier/rule-set adapter for RP thresholds.

## Current Implementation Gap

`src/utils/shiftStrategyEngine.ts` currently defaults to Energized 100 and Supercharged 360. That is correct for normal Regional/District events, but incomplete for District Championships/FIRST Championship and does not yet model Traversal RP.

