# Synthetic Full System Test Tuning Ledger

This text ledger records every replay/tuning cycle, selected variables, metric changes, convergence decisions, and GitHub sync status.

Note: `sft-tune-2026-20260628T111818-20260628` is retained as a harness-debug record, not as a valid model-tuning result. It exposed that candidate labels were changing synthetic scout seeds, so candidate comparisons were not deterministic. The tuner was fixed to use stable event-level seeds before the accepted converged run `sft-tune-2026-20260628T112002-20260628`.


## 2026-06-28T11:18:22.982Z - sft-tune-2026-20260628T111818-20260628 - 2026azdd

Event: Duel in the Desert Week 0

Selected variables: priorWeight, liveEvidenceWeight, recencyHalfLifeMatches, marginConfidenceScale, scoreScaleCorrection, defenseImpactWeight, reliabilityWeight, scoutNoisePenalty, upsetSensitivity

- Event 2026azdd failed: Command failed: /opt/homebrew/Cellar/node/23.11.0/bin/node /Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/SyntheticFullSystemTest/scripts/real-event-replay.mjs --manifest /Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-2

## 2026-06-28T11:18:24.364Z - sft-tune-2026-20260628T111818-20260628 - 2026nywz

Event: Regal Eagles Rampage

Selected variables: priorWeight, liveEvidenceWeight, recencyHalfLifeMatches, marginConfidenceScale, scoreScaleCorrection, defenseImpactWeight, reliabilityWeight, scoutNoisePenalty, upsetSensitivity

- Event 2026nywz failed: Command failed: /opt/homebrew/Cellar/node/23.11.0/bin/node /Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-26/Scouting/2026-frc-scout/SyntheticFullSystemTest/scripts/real-event-replay.mjs --manifest /Users/leoxu/Library/CloudStorage/OneDrive-YKPaoSchool上海民办包玉刚实验学校/FRC2025-2

## 2026-06-28T11:18:27.261Z - sft-tune-2026-20260628T111818-20260628 - 2026ilpe

Event: Central Illinois Regional

Selected variables: priorWeight, liveEvidenceWeight, recencyHalfLifeMatches, marginConfidenceScale, scoreScaleCorrection, defenseImpactWeight, reliabilityWeight, scoutNoisePenalty, upsetSensitivity

- Baseline objective 57.616328, winner 0.763, Brier 0.177, score MAE 68.03, margin MAE 98.55.
- Pass 1: priorWeight held at 1; step now 0.06.
- Pass 1: liveEvidenceWeight held at 0.32; step now 0.04.
- Pass 1: recencyHalfLifeMatches held at 2; step now 0.4.
- Pass 1: marginConfidenceScale held at 42; step now 3.5.
- Pass 1: scoreScaleCorrection held at 1; step now 0.03.
- Pass 1: defenseImpactWeight held at 0.6; step now 0.08.
- Pass 1: reliabilityWeight held at 18; step now 2.
- Pass 1: scoutNoisePenalty held at 0; step now 0.06.
- Pass 1: upsetSensitivity held at 0; step now 0.07.
- Pass 2: priorWeight changed 1 -> 1.06; objective 56.105681.
- Pass 2: liveEvidenceWeight held at 0.32; step now 0.02.
- Pass 2: recencyHalfLifeMatches changed 2 -> 1.6; objective 55.597305.
- Pass 2: marginConfidenceScale held at 42; step now 1.75.
- Pass 2: scoreScaleCorrection held at 1; step now 0.015.
- Pass 2: defenseImpactWeight held at 0.6; step now 0.04.
- Pass 2: reliabilityWeight held at 18; step now 1.
- Pass 2: scoutNoisePenalty held at 0; step now 0.03.
- Pass 2: upsetSensitivity held at 0; step now 0.035.
- Pass 3: priorWeight held at 1.06; step now 0.03.
- Pass 3: recencyHalfLifeMatches held at 1.6; step now 0.2.
- Pass 4: priorWeight held at 1.06; step now 0.015.
- Pass 4: recencyHalfLifeMatches held at 1.6; step now 0.1.
- Final objective 67.766281, winner 0.72, Brier 0.202, score MAE 72.4, margin MAE 106.54.
- Final parameters: {"priorWeight":1.06,"liveEvidenceWeight":0.32,"recencyHalfLifeMatches":1.6,"marginConfidenceScale":42,"scoreScaleCorrection":1,"defenseImpactWeight":0.6,"reliabilityWeight":18,"foulPenaltyWeight":2,"scoutNoisePenalty":0,"pitClaimTrustWeight":0,"upsetSensitivity":0,"playoffAdaptationWeight":1,"scoreConsistencyStrictness":1,"missingScoutRowPenalty":0,"confidenceFloor":0.025,"confidenceCeiling":0.975}
- Variable status: {"priorWeight":"converged","liveEvidenceWeight":"converged","recencyHalfLifeMatches":"converged","marginConfidenceScale":"converged","scoreScaleCorrection":"converged","defenseImpactWeight":"converged","reliabilityWeight":"converged","scoutNoisePenalty":"converged","upsetSensitivity":"converged"}

## 2026-06-28T11:19:41.880Z - sft-tune-2026-20260628T111939-20260628 - 2026ilpe

Event: 2026ilpe

Selected variables: priorWeight, liveEvidenceWeight, recencyHalfLifeMatches, marginConfidenceScale, scoreScaleCorrection, defenseImpactWeight, reliabilityWeight, scoutNoisePenalty, upsetSensitivity

- Baseline objective 61.293639, winner 0.714, Brier 0.177, score MAE 66.69, margin MAE 97.76.
- Pass 1: priorWeight changed 1 -> 0.88; objective 60.848388.
- Pass 1: liveEvidenceWeight changed 0.32 -> 0.4; objective 60.472902.
- Pass 1: recencyHalfLifeMatches held at 2; step now 0.4.
- Pass 1: marginConfidenceScale changed 42 -> 49; objective 59.948651.
- Pass 1: scoreScaleCorrection held at 1; step now 0.03.
- Pass 1: defenseImpactWeight changed 0.6 -> 0.76; objective 59.830938.
- Pass 1: reliabilityWeight held at 18; step now 2.
- Pass 1: scoutNoisePenalty changed 0 -> 0.12; objective 59.56702.
- Pass 1: upsetSensitivity held at 0; step now 0.07.
- Pass 2: priorWeight changed 0.88 -> 0.76; objective 59.136078.
- Pass 2: liveEvidenceWeight held at 0.4; step now 0.04.
- Pass 2: recencyHalfLifeMatches held at 2; step now 0.2.
- Pass 2: marginConfidenceScale changed 49 -> 56; objective 58.984156.
- Pass 2: scoreScaleCorrection held at 1; step now 0.015.
- Pass 2: defenseImpactWeight held at 0.76; step now 0.08.
- Pass 2: reliabilityWeight held at 18; step now 1.
- Pass 2: scoutNoisePenalty changed 0.12 -> 0; objective 58.839901.
- Pass 2: upsetSensitivity held at 0; step now 0.035.
- Pass 3: priorWeight changed 0.76 -> 0.64; objective 57.934691.
- Pass 3: liveEvidenceWeight changed 0.4 -> 0.44; objective 57.780797.
- Pass 3: marginConfidenceScale changed 56 -> 63; objective 57.446552.
- Pass 3: defenseImpactWeight changed 0.76 -> 0.68; objective 57.300018.
- Pass 3: scoutNoisePenalty changed 0 -> 0.12; objective 57.03257.
- Pass 4: priorWeight changed 0.64 -> 0.55; objective 55.624425.
- Pass 4: liveEvidenceWeight changed 0.44 -> 0.48; objective 55.221758.
- Pass 4: marginConfidenceScale held at 63; step now 3.5.
- Pass 4: defenseImpactWeight changed 0.68 -> 0.76; objective 54.98116.
- Final objective 54.98116, winner 0.754, Brier 0.165, score MAE 66.09, margin MAE 95.08.
- Final parameters: {"priorWeight":0.55,"liveEvidenceWeight":0.48,"recencyHalfLifeMatches":2,"marginConfidenceScale":63,"scoreScaleCorrection":1,"defenseImpactWeight":0.76,"reliabilityWeight":18,"foulPenaltyWeight":2,"scoutNoisePenalty":0.06,"pitClaimTrustWeight":0,"upsetSensitivity":0,"playoffAdaptationWeight":1,"scoreConsistencyStrictness":1,"missingScoutRowPenalty":0,"confidenceFloor":0.025,"confidenceCeiling":0.975}
- Variable status: {"priorWeight":"active","liveEvidenceWeight":"active","recencyHalfLifeMatches":"converged","marginConfidenceScale":"active","scoreScaleCorrection":"converged","defenseImpactWeight":"active","reliabilityWeight":"converged","scoutNoisePenalty":"stabilized","upsetSensitivity":"converged"}

## 2026-06-28T11:20:05.663Z - sft-tune-2026-20260628T112002-20260628 - 2026ilpe

Event: 2026ilpe

Selected variables: priorWeight, liveEvidenceWeight, recencyHalfLifeMatches, marginConfidenceScale, scoreScaleCorrection, defenseImpactWeight, reliabilityWeight, scoutNoisePenalty, upsetSensitivity

- Baseline objective 61.293639, winner 0.714, Brier 0.177, score MAE 66.69, margin MAE 97.76.
- Pass 1: priorWeight changed 1 -> 0.88; objective 60.848388.
- Pass 1: liveEvidenceWeight changed 0.32 -> 0.4; objective 60.472902.
- Pass 1: recencyHalfLifeMatches held at 2; step now 0.4.
- Pass 1: marginConfidenceScale changed 42 -> 49; objective 59.948651.
- Pass 1: scoreScaleCorrection held at 1; step now 0.03.
- Pass 1: defenseImpactWeight changed 0.6 -> 0.76; objective 59.830938.
- Pass 1: reliabilityWeight held at 18; step now 2.
- Pass 1: scoutNoisePenalty changed 0 -> 0.12; objective 59.56702.
- Pass 1: upsetSensitivity held at 0; step now 0.07.
- Pass 2: priorWeight changed 0.88 -> 0.76; objective 59.136078.
- Pass 2: liveEvidenceWeight held at 0.4; step now 0.04.
- Pass 2: recencyHalfLifeMatches held at 2; step now 0.2.
- Pass 2: marginConfidenceScale changed 49 -> 56; objective 58.984156.
- Pass 2: scoreScaleCorrection held at 1; step now 0.015.
- Pass 2: defenseImpactWeight held at 0.76; step now 0.08.
- Pass 2: reliabilityWeight held at 18; step now 1.
- Pass 2: scoutNoisePenalty changed 0.12 -> 0; objective 58.839901.
- Pass 2: upsetSensitivity held at 0; step now 0.035.
- Pass 3: priorWeight changed 0.76 -> 0.64; objective 57.934691.
- Pass 3: liveEvidenceWeight changed 0.4 -> 0.44; objective 57.780797.
- Pass 3: marginConfidenceScale changed 56 -> 63; objective 57.446552.
- Pass 3: defenseImpactWeight changed 0.76 -> 0.68; objective 57.300018.
- Pass 3: scoutNoisePenalty changed 0 -> 0.12; objective 57.03257.
- Pass 4: priorWeight changed 0.64 -> 0.55; objective 55.624425.
- Pass 4: liveEvidenceWeight changed 0.44 -> 0.48; objective 55.221758.
- Pass 4: marginConfidenceScale held at 63; step now 3.5.
- Pass 4: defenseImpactWeight changed 0.68 -> 0.76; objective 54.98116.
- Pass 5: priorWeight held at 0.55; step now 0.06.
- Pass 5: liveEvidenceWeight held at 0.48; step now 0.02.
- Pass 5: marginConfidenceScale held at 63; step now 1.75.
- Pass 5: defenseImpactWeight held at 0.76; step now 0.04.
- Pass 6: priorWeight held at 0.55; step now 0.03.
- Pass 6: liveEvidenceWeight held at 0.48; step now 0.01.
- Pass 6: defenseImpactWeight held at 0.76; step now 0.02.
- Final objective 54.98116, winner 0.754, Brier 0.165, score MAE 66.09, margin MAE 95.08.
- Final parameters: {"priorWeight":0.55,"liveEvidenceWeight":0.48,"recencyHalfLifeMatches":2,"marginConfidenceScale":63,"scoreScaleCorrection":1,"defenseImpactWeight":0.76,"reliabilityWeight":18,"foulPenaltyWeight":2,"scoutNoisePenalty":0.06,"pitClaimTrustWeight":0,"upsetSensitivity":0,"playoffAdaptationWeight":1,"scoreConsistencyStrictness":1,"missingScoutRowPenalty":0,"confidenceFloor":0.025,"confidenceCeiling":0.975}
- Variable status: {"priorWeight":"converged","liveEvidenceWeight":"converged","recencyHalfLifeMatches":"converged","marginConfidenceScale":"converged","scoreScaleCorrection":"converged","defenseImpactWeight":"converged","reliabilityWeight":"converged","scoutNoisePenalty":"stabilized","upsetSensitivity":"converged"}
