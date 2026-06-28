# SFT Tuning Variable Contract

## Independent Variables

- `priorWeight`: default `1`, range `0.55-1.45`, selected `true`. Controls early-event dependence on pre-scout/public prior strength.
- `liveEvidenceWeight`: default `0.32`, range `0.12-0.72`, selected `true`. Controls how strongly match scout evidence updates team ratings.
- `recencyHalfLifeMatches`: default `2`, range `0.75-8`, selected `true`. Controls how quickly recent match evidence outweighs old evidence.
- `marginConfidenceScale`: default `42`, range `22-74`, selected `true`. Controls conversion from predicted margin to win probability.
- `scoreScaleCorrection`: default `1`, range `0.72-1.28`, selected `true`. Controls global correction for predicted red and blue scores.
- `defenseImpactWeight`: default `0.6`, range `0.15-1.4`, selected `true`. Controls how much opponent defense suppresses projected scoring.
- `reliabilityWeight`: default `18`, range `4-38`, selected `true`. Controls how much robot reliability lifts projected alliance score.
- `foulPenaltyWeight`: default `2`, range `0-9`, selected `false`. Future harsh-mode variable for how much foul concern lowers team value.
- `scoutNoisePenalty`: default `0`, range `0-0.9`, selected `true`. Controls discounting of low-confidence or reliability-questionable scout data.
- `pitClaimTrustWeight`: default `0`, range `0-0.45`, selected `false`. Future variable for trusting subjective pit claims before match evidence.
- `upsetSensitivity`: default `0`, range `0-1`, selected `true`. Controls how quickly the model reacts when results contradict priors.
- `playoffAdaptationWeight`: default `1`, range `0.65-1.55`, selected `false`. Future variable for late-event/playoff-specific adaptation.
- `scoreConsistencyStrictness`: default `1`, range `0.5-1.5`, selected `false`. Audit strictness variable; inactive while score-consistent rows are mandatory.
- `missingScoutRowPenalty`: default `0`, range `0-1`, selected `false`. Future harsh-mode variable for missing scout rows or upload delays.
- `confidenceFloor`: default `0.025`, range `0.005-0.15`, selected `false`. Future calibration bound preventing impossible certainty.
- `confidenceCeiling`: default `0.975`, range `0.85-0.995`, selected `false`. Future calibration bound preventing impossible certainty.

## Dependent Variables

- `winnerAccuracy`: Correct winner rate across decisive matches. Higher is better.
- `qualificationWinnerAccuracy`: Correct winner rate in qualification matches. Higher is better.
- `playoffWinnerAccuracy`: Correct winner rate in playoff matches. Higher is better.
- `brierScore`: Probability calibration error for red alliance win probability. Lower is better.
- `scoreMae`: Mean absolute error of red/blue predicted scores. Lower is better.
- `marginMae`: Mean absolute error of predicted score margin. Lower is better.
- `earlyEventAccuracy`: Winner accuracy in the first quarter of the event. Higher is better.
- `lateEventAccuracy`: Winner accuracy after more event evidence exists. Higher is better.
- `overconfidenceRate`: Share of confident predictions that were wrong. Lower is better.
- `calibrationError`: Average binned probability calibration gap. Lower is better.
- `upsetMissRate`: Share of underdog wins the model failed to anticipate. Lower is better.
- `objectiveLoss`: Weighted combined loss used by the tuner. Lower is better.
