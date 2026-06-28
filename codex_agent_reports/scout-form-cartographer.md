# ScoutFormCartographer Report

Agent: Kant
Agent id: 019f0d69-6942-7441-ab21-65fc7abe5c86
Task id: scout-form-cartographer
Role: explorer
Model: gpt-5.3-codex-spark
Reasoning effort: medium
Status: complete
Files changed: none
Safety: no credentials used or exposed

Key findings:
- MatchScoutingV4 is the correct fabricated row target.
- Required row shape should include schemaVersion v4, eventKey, matchType, matchNumber, matchKey, teamNumber, scoutName, assignedScoutName, assignedSlot, alliance, deviceId, timestamp, autoPoints, teleopPoints, endgamePoints, totalMatchPoints, rolePlayed, defense fields, foul/failure fields, reliabilityScore, notes, and strategyNotes.
- Normalization clamps points to non-negative integers, defenseIntensity/reliabilityScore to 0..1, and recalculates totalMatchPoints as auto + teleop + endgame.
- Modeling ingest can consume totalMatchPoints, defenseIntensity, role/failure fields, and reliability penalties.
- Score-consistent mode should enforce sum(totalMatchPoints for the three alliance robots) == official alliance score.
