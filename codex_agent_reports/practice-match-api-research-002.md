# Practice Match API Research 002

- Agent: Helmholtz (`019f1150-b3e4-7ea0-b2d2-401ba0c95576`)
- Role: explorer
- Model: `gpt-5.4`
- Reasoning effort: medium
- Scope: read-only research into whether TBA, FIRST Events API, and Statbotics expose practice match schedules, scores, breakdowns, winners, and RP-like details.
- Files changed by agent: none.

## Conclusion

PowerScout should have a dedicated practice-scorekeeper/local practice-result path if practice match data matters operationally.

TBA and Statbotics do not document practice-match support. FIRST Events API documents practice schedules and match results through `tournamentLevel=Practice`; score details likely work through the same tournament-level route, but the docs do not show a practice-specific score-detail example.

## Source Conclusions

- TBA: no documented practice support. TBA's `Comp_Level` enum is `qm`, `ef`, `qf`, `sf`, and `f`, and match key docs use the same competition-level set.
- FIRST Events API: yes for practice schedules and practice match results. Schedule and match-results endpoints take `tournamentLevel`, including `Practice`. Score details use `/scores/:eventCode/:tournamentLevel`; likely practice-compatible but less explicitly demonstrated.
- Statbotics: no documented practice support. Public match endpoints and backend competition-level enums are non-practice levels.

## Product Recommendation

Use FIRST Events as an optional sync source for practice day, but treat practice scores as a first-class local/operator workflow:

- assign one practice-scorekeeper or head-scout operator to capture official red/blue totals and threshold/RP-like notes;
- reconcile scout observations against the local official practice totals immediately;
- sync FIRST practice rows when available, but never block PowerScout or the driver team on that sync.
