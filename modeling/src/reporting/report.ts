import fs from 'node:fs';
import path from 'node:path';
import type { MatchPrediction, ModelResult, ResearchRun, ScorePrediction } from '../types.ts';
import { compactResearchRun, mean, readJsonFile, rmse, writeJsonFile, writeTextFile } from '../util.ts';

const formatNumber = (value: number, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : 'n/a';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const shortModelName = (name: string) =>
  name
    .replace(
      'No-Future Season-Event-Phase-Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Season+Phase '
    )
    .replace(
      'No-Future Event-Phase-Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Event-Phase '
    )
    .replace(
      'No-Future Season-Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Season '
    )
    .replace(
      'No-Future Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Global Widen '
    )
    .replace(
      'No-Future Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Replace '
    )
    .replace(
      'No-Future Event-Type-Residual Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Event-Type Residual '
    )
    .replace(
      'No-Future ChampsDiv-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'ChampsDiv Scale Residual Ridge '
    )
    .replace(
      'No-Future Residual-Gated ChampsDiv-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Residual-Gated ChampsDiv Scale Residual Ridge '
    )
    .replace(
      'No-Future Residual-Gated Champs-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Residual-Gated Champs Scale Residual Ridge '
    )
    .replace(
      'No-Future Champs-Phase Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Champs Phase Residual Ridge '
    )
    .replace(
      'No-Future Champs-PhaseResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Champs Phase+Residual Boost '
    )
    .replace(
      'No-Future WinCal-NoTail Champs-PhaseResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'WinCal NoTail Champs Phase+Residual Boost '
    )
    .replace(
      'No-Future LearnedTail Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'LearnedTail Residual Ridge '
    )
    .replace(
      'No-Future ConditionalLearnedTail Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Conditional LearnedTail Residual Ridge '
    )
    .replace(
      'No-Future TailRiskInterval Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'TailRisk Interval Residual Ridge '
    )
    .replace(
      'No-Future TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'TailRisk WinProb Residual Ridge '
    )
    .replace(
      'No-Future MarginConfidenceTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Margin+Confidence TailRisk WinProb Residual Ridge '
    )
    .replace(
      'No-Future SmoothTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Smooth TailRisk WinProb Residual Ridge '
    )
    .replace(
      'No-Future LearnedWinCal TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Learned WinCal TailRisk WinProb Residual Ridge '
    )
    .replace(
      'No-Future LearnedWinCal Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Learned WinCal Residual Ridge '
    )
    .replace(
      'No-Future ConditionalTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Conditional TailRisk WinProb Residual Ridge '
    )
    .replace(
      'No-Future Gated Champs-PhaseResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Gated Champs Phase+Residual Boost '
    )
    .replace(
      'No-Future Champs-ResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Champs Residual Boost '
    )
    .replace(
      'No-Future Champs-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Champs Scale Residual Ridge '
    )
    .replace(
      'No-Future Residual-Ridge Component Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Residual Ridge Component '
    )
    .replace(
      'No-Future Strong Role-Feature Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Strong Role-Feature Residual Ridge '
    )
    .replace(
      'No-Future Role-Feature Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Role-Feature Residual Ridge '
    )
    .replace(
      'No-Future Role-Feature Residual-Tree Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Role-Feature Residual Tree '
    )
    .replace(
      'No-Future Residual-Ridge+Tree Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Residual Ridge+Tree '
    )
    .replace(
      'No-Future Residual-Tree Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Residual Tree '
    )
    .replace(
      'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 ',
      'Residual Ridge '
    )
    .replace(
      'No-Future Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050',
      'Scaled CR=0.100 DR=0.050'
    )
    .replace('No-Future Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 ', 'Fixed ')
    .replace('Published Statbotics Match Prediction', 'Published Statbotics');

const buildLeaderboard = (run: ResearchRun) => {
  const lines = [
    '| Rank | Model | Promote | Confidence | Relative Benchmark | Fixed Benchmark | Overfit Risk | Penalty | Score MAE | Norm Score MAE | Margin MAE | Norm Margin MAE | Brier | Calibration | Coverage | Worst Event MAE | Worst Season MAE | Leakage | Promotion notes | Rejection notes |',
    '| ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |'
  ];

  run.modelResults.forEach(result => {
    lines.push(
      `| ${result.benchmarkRank} | ${result.config.name} | ${result.promoted ? 'yes' : 'no'} | ${
        result.promotionConfidence
      } | ${formatNumber(
        result.benchmarkScore,
        3
      )} | ${formatNumber(result.fixedBenchmarkScore, 3)} | ${formatNumber(result.overfitRiskScore, 3)} | ${formatNumber(result.benchmarkPenalty, 3)} | ${formatNumber(
        result.scoreMae
      )} | ${formatNumber(result.normalizedScoreMae, 4)} | ${formatNumber(
        result.marginMae
      )} | ${formatNumber(result.normalizedMarginMae, 4)} | ${formatNumber(result.winBrier, 4)} | ${formatNumber(
        result.calibrationError,
        4
      )} | ${formatNumber(
        result.scoreIntervalCoverage * 100,
        1
      )}% | ${formatNumber(
        result.worstEventScoreMae
      )} | ${formatNumber(result.worstSeasonScoreMae)} | ${result.config.leakageRisk} | ${
        result.promotionNotes.join('; ') || 'none'
      } | ${result.rejectionReasons.join('; ') || 'none'} |`
    );
  });

  return lines.join('\n');
};

const buildDiagnostics = (run: ResearchRun) => {
  const best = run.modelResults.find(result => result.promoted) ?? run.modelResults[0];
  if (!best) return 'No model diagnostics available yet.';

  const vif = best.vifDiagnostics
    .slice(0, 12)
    .map(item => `- ${item.feature}: VIF ${formatNumber(item.vif, 2)}`)
    .join('\n');
  const correlations = best.correlationDiagnostics
    .slice(0, 12)
    .map(item => `- ${item.left} vs ${item.right}: r=${formatNumber(item.correlation, 3)}`)
    .join('\n');
  const importance = best.featureImportance
    .slice(0, 15)
    .map(item => `- ${item.feature}: coef ${formatNumber(item.coefficient, 3)}, standardized ${formatNumber(item.standardizedMagnitude, 3)}`)
    .join('\n');
  const examples = best.matchPredictions
    .slice(0, 8)
    .map(
      prediction =>
        `- ${prediction.matchKey}: red ${formatNumber(prediction.redExpectedScore, 1)} (${formatNumber(
          prediction.redP10Score,
          1
        )}-${formatNumber(prediction.redP90Score, 1)}) vs blue ${formatNumber(prediction.blueExpectedScore, 1)} (${formatNumber(
          prediction.blueP10Score,
          1
        )}-${formatNumber(prediction.blueP90Score, 1)}), red win ${formatNumber(
          prediction.redWinProbability * 100,
          1
        )}% actual ${prediction.redActualScore}-${prediction.blueActualScore}`
    )
    .join('\n');
  const seasonSlices = best.sliceMetrics
    .filter(slice => slice.sliceType === 'season')
    .sort((left, right) => left.sliceKey.localeCompare(right.sliceKey))
    .map(
      slice =>
        `- ${slice.sliceKey}: score MAE ${formatNumber(slice.scoreMae)}, margin MAE ${formatNumber(
          slice.marginMae
        )}, Brier ${formatNumber(slice.winBrier, 4)}, coverage ${formatNumber(slice.scoreIntervalCoverage * 100, 1)}%`
    )
    .join('\n');
  const weakEventSlices = best.sliceMetrics
    .filter(slice => slice.sliceType === 'event' && slice.predictionCount >= 6)
    .sort((left, right) => right.scoreMae - left.scoreMae)
    .slice(0, 10)
    .map(
      slice =>
        `- ${slice.sliceKey}: score MAE ${formatNumber(slice.scoreMae)}, RMSE ${formatNumber(
          slice.scoreRmse
        )}, margin MAE ${formatNumber(slice.marginMae)}, matches ${slice.matchCount}`
    )
    .join('\n');

  return [
    `Best reviewed model: ${best.config.name}`,
    '',
    'Benchmark scoring:',
    '- Lower is better for both leaderboard scores.',
    '- Relative benchmark is used for within-run promotion. It blends percentile rank and robust relative magnitude, so a model must be good both ordinally and by actual error size.',
    '- Fixed benchmark is candidate-set independent. It uses explicit target ratios for score error, margin error, Brier score, calibration, coverage, worst-event behavior, slice instability, and interval width, then adds the same leakage/eligibility/overfit penalties.',
    '- Promotion confidence is downgraded to near_tie when another eligible model is within 0.050 relative-benchmark points or 0.010 fixed-benchmark points, or when the fixed benchmark prefers a different eligible model.',
    '- Weights: score MAE 16%, score RMSE 8%, margin MAE 13%, season-normalized score MAE 7%, season-normalized margin MAE 7%, win Brier 12%, calibration 7%, interval coverage error 8%, worst-event MAE 6%, event instability 5%, worst-season MAE 4%, season instability 3%, interval width 4%.',
    '- Overfit risk is nonlinear: VIF excess, high-correlation excess, rejection count, slice instability, and coverage miss are squared or otherwise magnified.',
    '- Leakage and non-promotable inputs are added as hard penalties after metric scoring.',
    '- The benchmark is computed only from walk-forward predictions, not from in-sample fitted scores.',
    '',
    'Top VIF diagnostics:',
    vif || '- none',
    '',
    'High-correlation diagnostics:',
    correlations || '- none',
    '',
    'Top feature importance:',
    importance || '- baseline model has no coefficients',
    '',
    'Season slices:',
    seasonSlices || '- none',
    '',
    'Weakest event slices:',
    weakEventSlices || '- none',
    '',
    'Prediction report examples:',
    examples || '- none'
  ].join('\n');
};

export const buildModelCard = (run: ResearchRun) => {
  const best = run.modelResults.find(result => result.promoted) ?? run.modelResults[0] ?? null;
  return [
    '# Offline FIRST Match Modeling Model Card',
    '',
    `Run ID: ${run.runId}`,
    `Created: ${run.createdAt}`,
    `Matches replayed: ${run.matches}`,
    `Alliance rows: ${run.rows}`,
    `Evaluation matches: ${run.evaluationMatches ?? run.matches}`,
    `Evaluation alliance rows: ${run.evaluationRows ?? run.rows}`,
    `Best promoted model: ${run.bestModelName ?? 'none yet'}`,
    '',
    '## Purpose',
    '',
    'This is a local research pipeline for predicting historical and future FRC match outcomes from data that would have been available before each match. It is deliberately separate from the website and writes artifacts only under `modeling/artifacts/`.',
    '',
    '## Targets',
    '',
    '- Red and blue expected score.',
    '- Red and blue score uncertainty bands.',
    '- Red and blue win probabilities.',
    '- Role-aware offensive/defensive assignment estimates.',
    '- Foul/component labels when source APIs provide reliable breakdowns.',
    '',
    '## Leakage Controls',
    '',
    '- Feature rows are emitted before the current match updates team state.',
    '- Walk-forward evaluation trains only on prior match groups.',
    '- Statbotics context EPA models are marked non-promotable until historical snapshot safety is proven.',
    '- Published Statbotics match predictions are treated as a non-promotable comparator until their archived pre-match provenance is audited.',
    '- Batch OPR variants solve a prior-match alliance-score matrix and assume each team contribution is linear/additive over the selected history.',
    '- Online EPA variants keep memory: each team rating is used before the match, then updated after the result by an adaptive error correction.',
    '- VIF and feature-correlation diagnostics are generated for every run.',
    '',
    '## Leaderboard',
    '',
    buildLeaderboard(run),
    '',
    '## Diagnostics',
    '',
    buildDiagnostics(run),
    '',
    '## Notes',
    '',
    ...run.notes.map(note => `- ${note}`),
    '',
    '## Current Weaknesses',
    '',
    '- Current implemented families include baselines, batch OPR, online EPA, ridge, elastic net, robust ridge, k-nearest-neighbor, kernel smoothing, no-future conformal interval calibration, no-future residual-ridge stacking, shallow residual trees, and scoped high-score tail corrections.',
    '- Defense value is inferred from residual suppression and scout observations where available, so it is weakest for unscouted teams.',
    '- FIRST/TBA score component labels vary by season and game; season-specific adapters should be added before component models are promoted.',
    '- Firebase ingestion requires a local access token and does not upload any model artifact back to Firebase.'
  ].join('\n');
};

type ComparisonSliceKind = 'all' | 'expected_margin' | 'reference_confidence' | 'season' | 'event';

interface ComparisonSliceAccumulator {
  sliceType: ComparisonSliceKind;
  sliceKey: string;
  matchCount: number;
  referenceBrierTotal: number;
  candidateBrierTotal: number;
  referenceProbabilityTotal: number;
  candidateProbabilityTotal: number;
  actualRedWinTotal: number;
  helpedMatches: number;
}

interface ComparisonSliceSummary {
  sliceType: ComparisonSliceKind;
  sliceKey: string;
  matchCount: number;
  referenceBrier: number;
  candidateBrier: number;
  brierDelta: number;
  referenceCalibrationError: number;
  candidateCalibrationError: number;
  calibrationDelta: number;
  helpedMatches: number;
}

interface ModelComparisonSummary {
  referenceModel: string;
  candidateModel: string;
  comparedMatches: number;
  slices: ComparisonSliceSummary[];
}

const getMatchBrier = (prediction: MatchPrediction) => {
  if (prediction.actualWinner === 'tie') return null;
  const actualRedWin = prediction.actualWinner === 'red' ? 1 : 0;
  return (prediction.redWinProbability - actualRedWin) ** 2;
};

const addComparisonSlice = (
  slices: Map<string, ComparisonSliceAccumulator>,
  sliceType: ComparisonSliceKind,
  sliceKey: string,
  reference: MatchPrediction,
  candidate: MatchPrediction
) => {
  if (reference.actualWinner === 'tie' || candidate.actualWinner === 'tie') return;
  const actualRedWin = reference.actualWinner === 'red' ? 1 : 0;
  const referenceBrier = getMatchBrier(reference);
  const candidateBrier = getMatchBrier(candidate);
  if (referenceBrier == null || candidateBrier == null) return;
  const key = `${sliceType}:${sliceKey}`;
  const accumulator =
    slices.get(key) ??
    {
      sliceType,
      sliceKey,
      matchCount: 0,
      referenceBrierTotal: 0,
      candidateBrierTotal: 0,
      referenceProbabilityTotal: 0,
      candidateProbabilityTotal: 0,
      actualRedWinTotal: 0,
      helpedMatches: 0
    };
  accumulator.matchCount += 1;
  accumulator.referenceBrierTotal += referenceBrier;
  accumulator.candidateBrierTotal += candidateBrier;
  accumulator.referenceProbabilityTotal += reference.redWinProbability;
  accumulator.candidateProbabilityTotal += candidate.redWinProbability;
  accumulator.actualRedWinTotal += actualRedWin;
  if (candidateBrier < referenceBrier) accumulator.helpedMatches += 1;
  slices.set(key, accumulator);
};

const summarizeComparisonSlice = (slice: ComparisonSliceAccumulator): ComparisonSliceSummary => {
  const matchCount = Math.max(1, slice.matchCount);
  const referenceBrier = slice.referenceBrierTotal / matchCount;
  const candidateBrier = slice.candidateBrierTotal / matchCount;
  const actualRedWinRate = slice.actualRedWinTotal / matchCount;
  const referenceCalibrationError = Math.abs(slice.referenceProbabilityTotal / matchCount - actualRedWinRate);
  const candidateCalibrationError = Math.abs(slice.candidateProbabilityTotal / matchCount - actualRedWinRate);
  return {
    sliceType: slice.sliceType,
    sliceKey: slice.sliceKey,
    matchCount: slice.matchCount,
    referenceBrier,
    candidateBrier,
    brierDelta: candidateBrier - referenceBrier,
    referenceCalibrationError,
    candidateCalibrationError,
    calibrationDelta: candidateCalibrationError - referenceCalibrationError,
    helpedMatches: slice.helpedMatches
  };
};

const getExpectedMarginSlice = (prediction: MatchPrediction) => {
  const expectedMargin = Math.abs(prediction.redExpectedScore - prediction.blueExpectedScore);
  if (expectedMargin <= 10) return 'close_expected_margin_<=10';
  if (expectedMargin <= 25) return 'medium_expected_margin_10_25';
  return 'wide_expected_margin_>25';
};

const getReferenceConfidenceSlice = (prediction: MatchPrediction) => {
  const confidence = Math.abs(prediction.redWinProbability - 0.5);
  if (confidence <= 0.1) return 'low_reference_confidence_<=0.10';
  if (confidence <= 0.25) return 'medium_reference_confidence_0.10_0.25';
  return 'high_reference_confidence_>0.25';
};

const isComparisonUncertaintyOnlyModel = (name: string) => /TailRisk (Interval|WinProb)|TailRisk(Interval|WinProb)/i.test(name);

const selectComparisonReference = (run: ResearchRun) => {
  const modelResultsWithPredictions = run.modelResults.filter(result => result.matchPredictions.length > 0);
  const seedReferenceNames = new Set(
    run.modelResults
      .map(result => result.config.simulationSeedName)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  );
  return (
    modelResultsWithPredictions.find(result => seedReferenceNames.has(result.config.name)) ??
    modelResultsWithPredictions.find(result => !isComparisonUncertaintyOnlyModel(result.config.name)) ??
    modelResultsWithPredictions[0] ??
    null
  );
};

const buildModelComparisonSliceDiagnostics = (run: ResearchRun) => {
  const reference = selectComparisonReference(run);
  if (!reference) {
    return {
      referenceModel: 'none',
      comparisons: [] as ModelComparisonSummary[],
      notes: ['No reference match predictions were available while writing run artifacts.']
    };
  }

  const referenceByMatch = new Map(reference.matchPredictions.map(prediction => [prediction.matchKey, prediction]));
  const comparisons: ModelComparisonSummary[] = run.modelResults.filter(candidate => candidate !== reference).map(candidate => {
    const slices = new Map<string, ComparisonSliceAccumulator>();
    candidate.matchPredictions.forEach(candidatePrediction => {
      const referencePrediction = referenceByMatch.get(candidatePrediction.matchKey);
      if (!referencePrediction || referencePrediction.actualWinner === 'tie') return;
      addComparisonSlice(slices, 'all', 'all_matches', referencePrediction, candidatePrediction);
      addComparisonSlice(slices, 'expected_margin', getExpectedMarginSlice(referencePrediction), referencePrediction, candidatePrediction);
      addComparisonSlice(
        slices,
        'reference_confidence',
        getReferenceConfidenceSlice(referencePrediction),
        referencePrediction,
        candidatePrediction
      );
      addComparisonSlice(slices, 'season', String(referencePrediction.season), referencePrediction, candidatePrediction);
      addComparisonSlice(slices, 'event', referencePrediction.eventKey, referencePrediction, candidatePrediction);
    });
    const summaries = Array.from(slices.values())
      .map(summarizeComparisonSlice)
      .sort((left, right) => {
        const typeOrder: Record<ComparisonSliceKind, number> = {
          all: 0,
          expected_margin: 1,
          reference_confidence: 2,
          season: 3,
          event: 4
        };
        return typeOrder[left.sliceType] - typeOrder[right.sliceType] || left.sliceKey.localeCompare(right.sliceKey);
      });
    return {
      referenceModel: reference.config.name,
      candidateModel: candidate.config.name,
      comparedMatches: summaries.find(slice => slice.sliceType === 'all')?.matchCount ?? 0,
      slices: summaries
    };
  });

  return {
    referenceModel: reference.config.name,
    comparisons,
    notes: [
      'Negative brierDelta means the candidate improved win-probability Brier score versus the reference model on that slice.',
      'These diagnostics are computed before run.json compaction, so non-promoted models can be compared without storing all prediction rows in the compact artifact.'
    ]
  };
};

const formatSignedNumber = (value: number, digits = 6) => `${value >= 0 ? '+' : ''}${formatNumber(value, digits)}`;

const buildModelComparisonSliceMarkdown = (diagnostics: ReturnType<typeof buildModelComparisonSliceDiagnostics>) => {
  const lines = [
    '# Model Comparison Slice Diagnostics',
    '',
    `Reference model: ${diagnostics.referenceModel}`,
    '',
    ...diagnostics.notes.map(note => `- ${note}`),
    ''
  ];

  diagnostics.comparisons.forEach(comparison => {
    lines.push(`## ${shortModelName(comparison.candidateModel)}`, '');
    lines.push(`Compared matches: ${comparison.comparedMatches}`, '');
    lines.push(
      '| Slice Type | Slice | Matches | Reference Brier | Candidate Brier | Brier Delta | Reference Cal | Candidate Cal | Cal Delta | Helped |',
      '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
    );
    comparison.slices
      .filter(slice => slice.sliceType !== 'event')
      .forEach(slice => {
        lines.push(
          `| ${slice.sliceType} | ${slice.sliceKey} | ${slice.matchCount} | ${formatNumber(
            slice.referenceBrier,
            6
          )} | ${formatNumber(slice.candidateBrier, 6)} | ${formatSignedNumber(slice.brierDelta)} | ${formatNumber(
            slice.referenceCalibrationError,
            6
          )} | ${formatNumber(slice.candidateCalibrationError, 6)} | ${formatSignedNumber(slice.calibrationDelta)} | ${
            slice.helpedMatches
          } |`
        );
      });
    const eventSlices = comparison.slices.filter(slice => slice.sliceType === 'event' && slice.matchCount >= 12);
    const bestEvents = [...eventSlices].sort((left, right) => left.brierDelta - right.brierDelta).slice(0, 8);
    const worstEvents = [...eventSlices].sort((left, right) => right.brierDelta - left.brierDelta).slice(0, 8);
    lines.push('', 'Best event slices by Brier delta:', '');
    lines.push('| Event | Matches | Brier Delta | Cal Delta | Helped |', '| --- | ---: | ---: | ---: | ---: |');
    bestEvents.forEach(slice => {
      lines.push(
        `| ${slice.sliceKey} | ${slice.matchCount} | ${formatSignedNumber(slice.brierDelta)} | ${formatSignedNumber(
          slice.calibrationDelta
        )} | ${slice.helpedMatches} |`
      );
    });
    lines.push('', 'Worst event slices by Brier delta:', '');
    lines.push('| Event | Matches | Brier Delta | Cal Delta | Helped |', '| --- | ---: | ---: | ---: | ---: |');
    worstEvents.forEach(slice => {
      lines.push(
        `| ${slice.sliceKey} | ${slice.matchCount} | ${formatSignedNumber(slice.brierDelta)} | ${formatSignedNumber(
          slice.calibrationDelta
        )} | ${slice.helpedMatches} |`
      );
    });
    lines.push('');
  });

  return lines.join('\n');
};

export const writeRunArtifacts = (
  run: ResearchRun,
  outputDir = path.resolve('modeling/artifacts/runs', run.runId),
  options: { experimentManifest?: unknown } = {}
) => {
  const comparisonSliceDiagnostics = buildModelComparisonSliceDiagnostics(run);
  writeJsonFile(path.join(outputDir, 'run.json'), compactResearchRun(run));
  writeTextFile(path.join(outputDir, 'MODEL_CARD.md'), buildModelCard(run));
  writeJsonFile(path.join(outputDir, 'model-comparison-slices.json'), comparisonSliceDiagnostics);
  writeTextFile(path.join(outputDir, 'MODEL_COMPARISON_SLICES.md'), buildModelComparisonSliceMarkdown(comparisonSliceDiagnostics));
  if (options.experimentManifest != null) {
    writeJsonFile(path.join(outputDir, 'experiment-manifest.json'), options.experimentManifest);
  }
  const best = run.modelResults.find(result => result.promoted) ?? run.modelResults[0] ?? null;
  if (best) {
    writeJsonFile(path.join(outputDir, 'best-model-predictions.json'), {
      model: best.config,
      scorePredictions: best.scorePredictions,
      matchPredictions: best.matchPredictions
    });
    writeJsonFile(path.join(outputDir, 'best-model-summary.json'), {
      model: best.config,
      runScope: {
        matches: run.matches,
        rows: run.rows,
        evaluationMatches: run.evaluationMatches ?? run.matches,
        evaluationRows: run.evaluationRows ?? run.rows
      },
      metrics: {
        benchmarkScore: best.benchmarkScore,
        fixedBenchmarkScore: best.fixedBenchmarkScore,
        benchmarkRank: best.benchmarkRank,
        benchmarkPenalty: best.benchmarkPenalty,
        overfitRiskScore: best.overfitRiskScore,
        benchmarkBreakdown: best.benchmarkBreakdown,
        fixedBenchmarkBreakdown: best.fixedBenchmarkBreakdown,
        promotionConfidence: best.promotionConfidence,
        promotionNotes: best.promotionNotes,
        averageActualScore: best.averageActualScore,
        scoreMae: best.scoreMae,
        scoreRmse: best.scoreRmse,
        marginMae: best.marginMae,
        normalizedScoreMae: best.normalizedScoreMae,
        normalizedMarginMae: best.normalizedMarginMae,
        winBrier: best.winBrier,
        calibrationError: best.calibrationError,
        scoreIntervalCoverage: best.scoreIntervalCoverage,
        scoreIntervalWidth: best.scoreIntervalWidth,
        worstEventScoreMae: best.worstEventScoreMae,
        eventScoreMaeStd: best.eventScoreMaeStd,
        worstSeasonScoreMae: best.worstSeasonScoreMae,
        seasonScoreMaeStd: best.seasonScoreMaeStd
      },
      promoted: best.promoted,
      promotionConfidence: best.promotionConfidence,
      promotionNotes: best.promotionNotes,
      rejectionReasons: best.rejectionReasons,
      seasonSlices: best.sliceMetrics.filter(slice => slice.sliceType === 'season'),
      weakestEventSlices: best.sliceMetrics
        .filter(slice => slice.sliceType === 'event' && slice.predictionCount >= 6)
        .sort((left, right) => right.scoreMae - left.scoreMae)
        .slice(0, 20),
      topFeatures: best.featureImportance.slice(0, 25),
      topVif: best.vifDiagnostics.slice(0, 25),
      topCorrelations: best.correlationDiagnostics.slice(0, 25)
    });
  }
  return outputDir;
};

const resolveRunJsonPath = (source: string) => {
  const resolved = path.resolve(source);
  return resolved.endsWith('.json') ? resolved : path.join(resolved, 'run.json');
};

const getEventSlugFromKey = (eventKey: string) => eventKey.replace(/^\d+/, '').toLowerCase();

const CHAMPIONSHIP_DIAGNOSTIC_SLUGS = new Set([
  'arc',
  'cur',
  'dal',
  'gal',
  'hop',
  'mil',
  'new',
  'joh',
  'car',
  'tes',
  'roe',
  'dav',
  'ein'
]);

const isChampionshipLikeEventKey = (eventKey: string) => {
  const slug = getEventSlugFromKey(eventKey);
  return CHAMPIONSHIP_DIAGNOSTIC_SLUGS.has(slug) || slug.includes('cmp');
};

const countBy = <T>(values: T[], getKey: (value: T) => string) => {
  const counts = new Map<string, number>();
  values.forEach(value => {
    const key = getKey(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
};

interface CrossRunSummaryRow {
  source: string;
  runName: string;
  runId: string;
  isHoldout: boolean;
  evaluationMatches: number;
  evaluationRows: number;
  relativeModel: string;
  relativeModelShort: string;
  promotionConfidence: string;
  relativeBenchmark: number;
  fixedModel: string;
  fixedModelShort: string;
  fixedBenchmark: number;
  scoreMae: number;
  marginMae: number;
  winBrier: number;
  calibrationError: number;
  scoreIntervalCoverage: number;
  scoreIntervalWidth: number;
  worstEventScoreMae: number;
}

interface StabilityReview {
  holdoutRuns: number;
  fullRuns: number;
  relativeLeader: string;
  relativeLeaderWins: number;
  fixedLeader: string;
  fixedLeaderWins: number;
  status: 'single_run' | 'confirmed' | 'fragmented' | 'mixed';
  notes: string[];
  fullReplayChecks: Array<{
    runName: string;
    relativeModel: string;
    relativeHoldoutWins: number;
    fixedHoldoutWins: number;
    holdoutRuns: number;
    status: 'confirmed' | 'unconfirmed';
  }>;
}

interface DeploymentRunScore {
  pointScore: number;
  robustnessScore: number;
  weight: number;
}

interface DeploymentReviewRow {
  model: string;
  modelShort: string;
  role: string;
  runs: number;
  evaluationMatches: number;
  relativeWins: number;
  fixedWins: number;
  nearTieRuns: number;
  weightedScoreMae: number;
  weightedMarginMae: number;
  weightedBrier: number;
  weightedCalibrationError: number;
  weightedCoverageMiss: number;
  weightedFixedBenchmark: number;
  maxWorstEventScoreMae: number;
  meanRank: number;
  pointDeploymentScore: number;
  pointMeanScore: number;
  pointInstabilityPenalty: number;
  robustnessScore: number;
}

const isUncertaintyOnlyModel = (modelShort: string, modelName = modelShort) =>
  /TailRisk (Interval|WinProb)/i.test(modelShort) || /TailRisk(Interval|WinProb)/i.test(modelName);

const buildStabilityReview = (
  rows: CrossRunSummaryRow[],
  relativeCounts: Array<[string, number]>,
  fixedCounts: Array<[string, number]>
): StabilityReview => {
  const holdoutRows = rows.filter(row => row.isHoldout);
  const fullRows = rows.filter(row => !row.isHoldout);
  const holdoutRelativeCounts = countBy(holdoutRows, row => row.relativeModelShort);
  const holdoutFixedCounts = countBy(holdoutRows, row => row.fixedModelShort);
  const effectiveRelativeCounts = holdoutRows.length > 0 ? holdoutRelativeCounts : relativeCounts;
  const effectiveFixedCounts = holdoutRows.length > 0 ? holdoutFixedCounts : fixedCounts;
  const relativeLeader = effectiveRelativeCounts[0]?.[0] ?? 'none';
  const relativeLeaderWins = effectiveRelativeCounts[0]?.[1] ?? 0;
  const fixedLeader = effectiveFixedCounts[0]?.[0] ?? 'none';
  const fixedLeaderWins = effectiveFixedCounts[0]?.[1] ?? 0;
  const majority = Math.floor(Math.max(1, holdoutRows.length) / 2) + 1;
  const notes: string[] = [];
  const fullReplayChecks = fullRows.map(row => {
    const relativeHoldoutWins = holdoutRows.filter(holdout => holdout.relativeModel === row.relativeModel).length;
    const fixedHoldoutWins = holdoutRows.filter(holdout => holdout.fixedModel === row.relativeModel).length;
    const status: 'confirmed' | 'unconfirmed' =
      relativeHoldoutWins >= majority || fixedHoldoutWins >= majority ? 'confirmed' : 'unconfirmed';
    return {
      runName: row.runName,
      relativeModel: row.relativeModelShort,
      relativeHoldoutWins,
      fixedHoldoutWins,
      holdoutRuns: holdoutRows.length,
      status
    };
  });

  let status: StabilityReview['status'] = 'single_run';
  if (holdoutRows.length > 1) {
    const relativeMajority = relativeLeaderWins >= majority;
    const fixedMajority = fixedLeaderWins >= majority;
    if (relativeMajority && fixedMajority && relativeLeader === fixedLeader) {
      status = 'confirmed';
      notes.push(`${relativeLeader} won a majority of both relative and fixed-score holdouts.`);
    } else if (!relativeMajority && !fixedMajority) {
      status = 'fragmented';
      notes.push('No model won a majority of relative or fixed-score holdouts.');
    } else {
      status = 'mixed';
      notes.push('Relative and fixed-score holdouts disagree, or only one scoring view has a majority winner.');
    }
  } else {
    notes.push('Not enough holdout runs to make a stability claim.');
  }

  fullReplayChecks.forEach(check => {
    if (check.status === 'confirmed') {
      notes.push(
        `Full replay ${check.runName} winner ${check.relativeModel} was confirmed by ${check.relativeHoldoutWins}/${check.holdoutRuns} relative and ${check.fixedHoldoutWins}/${check.holdoutRuns} fixed holdouts.`
      );
    } else if (check.holdoutRuns > 0) {
      notes.push(
        `Full replay ${check.runName} winner ${check.relativeModel} was not confirmed: ${check.relativeHoldoutWins}/${check.holdoutRuns} relative and ${check.fixedHoldoutWins}/${check.holdoutRuns} fixed holdouts.`
      );
    }
  });

  return {
    holdoutRuns: holdoutRows.length,
    fullRuns: fullRows.length,
    relativeLeader,
    relativeLeaderWins,
    fixedLeader,
    fixedLeaderWins,
    status,
    notes,
    fullReplayChecks
  };
};

const isDeploymentCandidate = (result: ModelResult) =>
  result.config.eligibleForPromotion && result.config.leakageRisk === 'low' && result.rejectionReasons.length === 0;

const finiteMin = (values: number[]) => Math.min(...values.filter(Number.isFinite));

const ratioRegret = (value: number, best: number) =>
  Number.isFinite(value) && Number.isFinite(best) && Math.abs(best) > 1e-9
    ? Math.max(0, value / best - 1) * 100
    : 0;

const scaledDifferenceRegret = (value: number, best: number) =>
  Number.isFinite(value) && Number.isFinite(best) ? Math.max(0, value - best) * 100 : 0;

const weightedMean = (values: Array<{ value: number; weight: number }>) => {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
};

const weightedStd = (values: Array<{ value: number; weight: number }>, meanValue: number) => {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  const variance = values.reduce((sum, item) => sum + item.weight * (item.value - meanValue) ** 2, 0) / totalWeight;
  return Math.sqrt(Math.max(0, variance));
};

const buildDeploymentReview = (entries: Array<{ source: string; run: ResearchRun }>) => {
  const targetCoverage = 0.8;
  const byModel = new Map<
    string,
    {
      model: string;
      modelShort: string;
      runs: number;
      evaluationMatches: number;
      relativeWins: number;
      fixedWins: number;
      nearTieRuns: number;
      scoreMae: number;
      marginMae: number;
      brier: number;
      calibration: number;
      coverageMiss: number;
      fixedBenchmark: number;
      maxWorstEventScoreMae: number;
      rank: number;
      runScores: DeploymentRunScore[];
    }
  >();

  entries.forEach(entry => {
    const candidates = entry.run.modelResults.filter(isDeploymentCandidate);
    if (candidates.length === 0) return;
    const weight = entry.run.evaluationMatches ?? entry.run.matches;
    const relativeBestName = entry.run.bestModelName ?? candidates[0]?.config.name ?? '';
    const fixedBestName =
      [...candidates].sort(
        (left, right) =>
          left.fixedBenchmarkScore - right.fixedBenchmarkScore ||
          left.scoreMae - right.scoreMae ||
          left.marginMae - right.marginMae ||
          left.winBrier - right.winBrier
      )[0]?.config.name ?? '';
    const rankDenominator = Math.max(1, candidates.length - 1);
    const best = {
      scoreMae: finiteMin(candidates.map(result => result.scoreMae)),
      marginMae: finiteMin(candidates.map(result => result.marginMae)),
      winBrier: finiteMin(candidates.map(result => result.winBrier)),
      calibrationError: finiteMin(candidates.map(result => result.calibrationError)),
      coverageMiss: finiteMin(candidates.map(result => Math.abs(result.scoreIntervalCoverage - targetCoverage))),
      fixedBenchmarkScore: finiteMin(candidates.map(result => result.fixedBenchmarkScore)),
      worstEventScoreMae: finiteMin(candidates.map(result => result.worstEventScoreMae))
    };

    candidates.forEach(result => {
      const model = result.config.name;
      const existing =
        byModel.get(model) ??
        {
          model,
          modelShort: shortModelName(model),
          runs: 0,
          evaluationMatches: 0,
          relativeWins: 0,
          fixedWins: 0,
          nearTieRuns: 0,
          scoreMae: 0,
          marginMae: 0,
          brier: 0,
          calibration: 0,
          coverageMiss: 0,
          fixedBenchmark: 0,
          maxWorstEventScoreMae: 0,
          rank: 0,
          runScores: []
        };
      const scoreRegret = ratioRegret(result.scoreMae, best.scoreMae);
      const marginRegret = ratioRegret(result.marginMae, best.marginMae);
      const brierRegret = ratioRegret(result.winBrier, best.winBrier);
      const calibrationRegret = scaledDifferenceRegret(result.calibrationError, best.calibrationError);
      const coverageRegret = scaledDifferenceRegret(
        Math.abs(result.scoreIntervalCoverage - targetCoverage),
        best.coverageMiss
      );
      const worstEventRegret = ratioRegret(result.worstEventScoreMae, best.worstEventScoreMae);
      const fixedBenchmarkRegret = ratioRegret(result.fixedBenchmarkScore, best.fixedBenchmarkScore);
      const rankRegret = ((result.benchmarkRank - 1) / rankDenominator) * 10;
      const pointScore =
        0.24 * scoreRegret +
        0.18 * marginRegret +
        0.16 * brierRegret +
        0.08 * calibrationRegret +
        0.08 * coverageRegret +
        0.12 * worstEventRegret +
        0.1 * fixedBenchmarkRegret +
        0.04 * rankRegret;
      const robustnessScore =
        0.3 * worstEventRegret +
        0.2 * coverageRegret +
        0.18 * brierRegret +
        0.12 * calibrationRegret +
        0.12 * fixedBenchmarkRegret +
        0.08 * rankRegret;

      existing.runs += 1;
      existing.evaluationMatches += weight;
      existing.relativeWins += result.config.name === relativeBestName ? 1 : 0;
      existing.fixedWins += result.config.name === fixedBestName ? 1 : 0;
      existing.nearTieRuns += result.promotionConfidence === 'near_tie' ? 1 : 0;
      existing.scoreMae += result.scoreMae * weight;
      existing.marginMae += result.marginMae * weight;
      existing.brier += result.winBrier * weight;
      existing.calibration += result.calibrationError * weight;
      existing.coverageMiss += Math.abs(result.scoreIntervalCoverage - targetCoverage) * weight;
      existing.fixedBenchmark += result.fixedBenchmarkScore * weight;
      existing.maxWorstEventScoreMae = Math.max(existing.maxWorstEventScoreMae, result.worstEventScoreMae);
      existing.rank += result.benchmarkRank * weight;
      existing.runScores.push({ pointScore, robustnessScore, weight });
      byModel.set(model, existing);
    });
  });

  const rows: DeploymentReviewRow[] = Array.from(byModel.values()).map(candidate => {
    const pointScores = candidate.runScores.map(score => ({ value: score.pointScore, weight: score.weight }));
    const robustnessScores = candidate.runScores.map(score => ({ value: score.robustnessScore, weight: score.weight }));
    const pointMeanScore = weightedMean(pointScores);
    const pointStd = weightedStd(pointScores, pointMeanScore);
    const pointMax = Math.max(0, ...candidate.runScores.map(score => score.pointScore));
    const robustnessMeanScore = weightedMean(robustnessScores);
    const robustnessStd = weightedStd(robustnessScores, robustnessMeanScore);
    const robustnessMax = Math.max(0, ...candidate.runScores.map(score => score.robustnessScore));
    const pointInstabilityPenalty = 0.25 * pointStd + 0.15 * pointMax;
    const robustnessInstabilityPenalty = 0.2 * robustnessStd + 0.2 * robustnessMax;

    return {
      model: candidate.model,
      modelShort: candidate.modelShort,
      role: 'review',
      runs: candidate.runs,
      evaluationMatches: candidate.evaluationMatches,
      relativeWins: candidate.relativeWins,
      fixedWins: candidate.fixedWins,
      nearTieRuns: candidate.nearTieRuns,
      weightedScoreMae: candidate.scoreMae / Math.max(1, candidate.evaluationMatches),
      weightedMarginMae: candidate.marginMae / Math.max(1, candidate.evaluationMatches),
      weightedBrier: candidate.brier / Math.max(1, candidate.evaluationMatches),
      weightedCalibrationError: candidate.calibration / Math.max(1, candidate.evaluationMatches),
      weightedCoverageMiss: candidate.coverageMiss / Math.max(1, candidate.evaluationMatches),
      weightedFixedBenchmark: candidate.fixedBenchmark / Math.max(1, candidate.evaluationMatches),
      maxWorstEventScoreMae: candidate.maxWorstEventScoreMae,
      meanRank: candidate.rank / Math.max(1, candidate.evaluationMatches),
      pointDeploymentScore: pointMeanScore + pointInstabilityPenalty,
      pointMeanScore,
      pointInstabilityPenalty,
      robustnessScore: robustnessMeanScore + robustnessInstabilityPenalty
    };
  });

  rows.sort(
    (left, right) =>
      left.pointDeploymentScore - right.pointDeploymentScore ||
      right.relativeWins - left.relativeWins ||
      left.weightedScoreMae - right.weightedScoreMae
  );

  const pointBest = rows[0] ?? null;
  const robustnessBest = [...rows].sort(
    (left, right) =>
      left.robustnessScore - right.robustnessScore ||
      right.fixedWins - left.fixedWins ||
      left.maxWorstEventScoreMae - right.maxWorstEventScoreMae
  )[0] ?? null;

  rows.forEach(row => {
    const roles: string[] = [];
    const uncertaintyOnly = isUncertaintyOnlyModel(row.modelShort, row.model);
    if (pointBest && row.model === pointBest.model) {
      roles.push(uncertaintyOnly ? 'uncertainty/reporting candidate' : 'point default candidate');
    }
    if (robustnessBest && row.model === robustnessBest.model) {
      roles.push(uncertaintyOnly ? 'uncertainty robustness diagnostic' : 'robustness monitor candidate');
    }
    if (roles.length === 0 && row.relativeWins > 0) roles.push('average-error alternate');
    if (roles.length === 0 && row.fixedWins > 0) {
      roles.push(uncertaintyOnly ? 'uncertainty fixed-score diagnostic' : 'fixed-score diagnostic');
    }
    if (roles.length === 0 && row.nearTieRuns > 0) roles.push('near-tie review');
    row.role = roles.join(' + ') || 'review';
  });

  const notes = [
    'Point deployment score is lower-is-better. It averages per-run regret against the best deployable model in each run for score MAE, margin MAE, Brier score, calibration error, interval coverage miss, worst-event MAE, fixed benchmark, and relative rank.',
    'The final point score adds an instability penalty based on weighted standard deviation and worst-run regret, so a model is punished for being good on average but fragile on one holdout.',
    'Robustness score emphasizes worst-event MAE, coverage miss, Brier, calibration, fixed benchmark, and rank. It is an alternate diagnostic, not the same question as exact point prediction.',
    'Uncertainty-only candidates are labeled as reporting or diagnostic models even if their deployment score ranks first, because they intentionally do not claim a new mean-score prediction.',
    'This review is generated from saved run artifacts only; it does not train, tune, or peek at future matches.'
  ];

  return { rows, notes };
};

const buildCrossRunMetricSvg = (rows: CrossRunSummaryRow[]) => {
  const metrics = [
    { key: 'scoreMae', label: 'Score MAE', color: '#2563eb', value: (row: CrossRunSummaryRow) => row.scoreMae },
    { key: 'marginMae', label: 'Margin MAE', color: '#059669', value: (row: CrossRunSummaryRow) => row.marginMae },
    { key: 'winBrier', label: 'Brier', color: '#9333ea', value: (row: CrossRunSummaryRow) => row.winBrier },
    {
      key: 'coverageMiss',
      label: 'Coverage Miss',
      color: '#d97706',
      value: (row: CrossRunSummaryRow) => Math.abs(row.scoreIntervalCoverage - 0.8) * 100
    },
    { key: 'worstEventScoreMae', label: 'Worst Event MAE', color: '#dc2626', value: (row: CrossRunSummaryRow) => row.worstEventScoreMae }
  ];
  const maxByMetric = new Map(metrics.map(metric => [metric.key, Math.max(1e-9, ...rows.map(row => metric.value(row)))]));
  const width = 1180;
  const left = 285;
  const rightPad = 170;
  const barWidth = width - left - rightPad;
  const metricGap = 24;
  const runGap = 46;
  const top = 78;
  const height = top + rows.length * (metrics.length * metricGap + runGap) + 32;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`,
    '<title id="title">Cross-run modeling metric comparison</title>',
    '<desc id="desc">Horizontal normalized bars compare lower-is-better metrics across saved model runs.</desc>',
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    '<text x="24" y="34" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#111827">Cross-Run Metric Comparison</text>',
    '<text x="24" y="58" font-family="Inter, Arial, sans-serif" font-size="13" fill="#4b5563">Bars are normalized within each metric; lower is better for every row shown.</text>'
  ];

  rows.forEach((row, rowIndex) => {
    const yBase = top + rowIndex * (metrics.length * metricGap + runGap);
    const runName = path.basename(path.dirname(resolveRunJsonPath(row.source)));
    parts.push(
      `<text x="24" y="${yBase}" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="700" fill="#111827">${escapeXml(
        runName
      )}</text>`,
      `<text x="24" y="${yBase + 18}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#4b5563">${escapeXml(
        row.relativeModelShort
      )} (${escapeXml(row.promotionConfidence)})</text>`
    );
    metrics.forEach((metric, metricIndex) => {
      const value = metric.value(row);
      const normalizedWidth = Math.max(2, (value / (maxByMetric.get(metric.key) ?? 1)) * barWidth);
      const y = yBase + 34 + metricIndex * metricGap;
      parts.push(
        `<text x="42" y="${y + 12}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#374151">${escapeXml(
          metric.label
        )}</text>`,
        `<rect x="${left}" y="${y}" width="${barWidth}" height="14" rx="3" fill="#f3f4f6"/>`,
        `<rect x="${left}" y="${y}" width="${normalizedWidth.toFixed(1)}" height="14" rx="3" fill="${metric.color}"/>`,
        `<text x="${left + barWidth + 14}" y="${y + 12}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#111827">${formatNumber(
          value,
          metric.key === 'winBrier' ? 4 : 2
        )}</text>`
      );
    });
  });

  parts.push('</svg>');
  return parts.join('\n');
};

export const buildCrossRunSummary = (entries: Array<{ source: string; run: ResearchRun }>) => {
  const rows: CrossRunSummaryRow[] = entries.map(entry => {
    const relativeBest = entry.run.modelResults.find(result => result.config.name === entry.run.bestModelName) ?? entry.run.modelResults[0];
    const fixedBest = [...entry.run.modelResults].sort(
      (left, right) =>
        left.fixedBenchmarkScore - right.fixedBenchmarkScore ||
        left.scoreMae - right.scoreMae ||
        left.marginMae - right.marginMae ||
        left.winBrier - right.winBrier
    )[0];
    if (!relativeBest || !fixedBest) {
      throw new Error(`Run ${entry.source} does not contain model results.`);
    }
    const evaluationRows = entry.run.evaluationRows ?? entry.run.rows;
    return {
      source: entry.source,
      runName: path.basename(path.dirname(resolveRunJsonPath(entry.source))),
      runId: entry.run.runId,
      isHoldout: evaluationRows < entry.run.rows,
      evaluationMatches: entry.run.evaluationMatches ?? entry.run.matches,
      evaluationRows,
      relativeModel: relativeBest.config.name,
      relativeModelShort: shortModelName(relativeBest.config.name),
      promotionConfidence: relativeBest.promotionConfidence,
      relativeBenchmark: relativeBest.benchmarkScore,
      fixedModel: fixedBest.config.name,
      fixedModelShort: shortModelName(fixedBest.config.name),
      fixedBenchmark: fixedBest.fixedBenchmarkScore,
      scoreMae: relativeBest.scoreMae,
      marginMae: relativeBest.marginMae,
      winBrier: relativeBest.winBrier,
      calibrationError: relativeBest.calibrationError,
      scoreIntervalCoverage: relativeBest.scoreIntervalCoverage,
      scoreIntervalWidth: relativeBest.scoreIntervalWidth,
      worstEventScoreMae: relativeBest.worstEventScoreMae
    };
  });

  const relativeCounts = countBy(rows, row => row.relativeModelShort);
  const fixedCounts = countBy(rows, row => row.fixedModelShort);
  const confidenceCounts = countBy(rows, row => row.promotionConfidence);
  const stabilityReview = buildStabilityReview(rows, relativeCounts, fixedCounts);
  const deploymentReview = buildDeploymentReview(entries);
  const markdownRows = rows.map(
    row =>
      `| ${row.runName} | ${row.evaluationMatches} | ${row.relativeModelShort} | ${
        row.promotionConfidence
      } | ${formatNumber(row.relativeBenchmark, 3)} | ${row.fixedModelShort} | ${formatNumber(
        row.fixedBenchmark,
        3
      )} | ${formatNumber(row.scoreMae)} | ${formatNumber(row.marginMae)} | ${formatNumber(row.winBrier, 4)} | ${formatNumber(
        row.calibrationError,
        4
      )} | ${formatNumber(row.scoreIntervalCoverage * 100, 1)}% | ${formatNumber(row.scoreIntervalWidth, 1)} | ${formatNumber(
        row.worstEventScoreMae
      )} |`
  );
  const deploymentRows = deploymentReview.rows.slice(0, 10).map(
    row =>
      `| ${row.modelShort} | ${row.role} | ${row.runs} | ${row.relativeWins} | ${row.fixedWins} | ${
        row.nearTieRuns
      } | ${formatNumber(row.weightedScoreMae)} | ${formatNumber(row.weightedMarginMae)} | ${formatNumber(
        row.weightedBrier,
        4
      )} | ${formatNumber(row.maxWorstEventScoreMae)} | ${formatNumber(row.meanRank, 2)} | ${formatNumber(
        row.pointDeploymentScore,
        3
      )} | ${formatNumber(row.pointInstabilityPenalty, 3)} | ${formatNumber(row.robustnessScore, 3)} |`
  );
  const stabilityLeaderDenominator =
    stabilityReview.holdoutRuns > 0 ? stabilityReview.holdoutRuns : Math.max(1, stabilityReview.fullRuns);
  const stabilityLeaderLabel = stabilityReview.holdoutRuns > 0 ? 'holdouts' : 'runs';

  const markdown = [
    '# Cross-Run Modeling Summary',
    '',
    'This report is generated from saved `run.json` artifacts. It is meant for comparing predeclared holdout runs without re-copying console output by hand.',
    '',
    '## Visual Summary',
    '',
    'Generated chart: `leaderboard-metrics.svg`. Bars are normalized within each metric, and lower is better for every plotted metric.',
    '',
    '## Leaderboard Sweep',
    '',
    '| Run | Eval Matches | Relative Winner | Confidence | Relative Score | Fixed Winner | Fixed Score | Score MAE | Margin MAE | Brier | Calibration | Coverage | Width | Worst Event MAE |',
    '| --- | ---: | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...markdownRows,
    '',
    '## Winner Counts',
    '',
    'Relative winners:',
    ...relativeCounts.map(([name, count]) => `- ${name}: ${count}`),
    '',
    'Fixed-score winners:',
    ...fixedCounts.map(([name, count]) => `- ${name}: ${count}`),
    '',
    'Promotion confidence:',
    ...confidenceCounts.map(([name, count]) => `- ${name}: ${count}`),
    '',
    '## Deployment Rule Review',
    '',
    ...deploymentReview.notes.map(note => `- ${note}`),
    '',
    '| Model | Suggested role | Runs | Relative wins | Fixed wins | Near-tie runs | Weighted score MAE | Weighted margin MAE | Weighted Brier | Max worst-event MAE | Mean rank | Point deployment score | Instability penalty | Robustness score |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...deploymentRows,
    '',
    '## Stability Review',
    '',
    `Status: ${stabilityReview.status}`,
    `Holdout runs: ${stabilityReview.holdoutRuns}`,
    `Full replay runs: ${stabilityReview.fullRuns}`,
    `Relative leader: ${stabilityReview.relativeLeader} (${stabilityReview.relativeLeaderWins}/${stabilityLeaderDenominator} ${stabilityLeaderLabel})`,
    `Fixed-score leader: ${stabilityReview.fixedLeader} (${stabilityReview.fixedLeaderWins}/${stabilityLeaderDenominator} ${stabilityLeaderLabel})`,
    '',
    ...stabilityReview.notes.map(note => `- ${note}`)
  ].join('\n');

  return {
    rows,
    markdown,
    metricsSvg: buildCrossRunMetricSvg(rows),
    relativeCounts,
    fixedCounts,
    confidenceCounts,
    stabilityReview,
    deploymentReview
  };
};

export const writeCrossRunSummaryArtifacts = (
  sources: string[],
  outputDir = path.resolve('modeling/artifacts/reports', `cross-run-${new Date().toISOString().replace(/[:.]/g, '-')}`)
) => {
  if (sources.length === 0) throw new Error('At least one run directory or run.json path is required.');
  const entries = sources.map(source => ({
    source,
    run: readJsonFile<ResearchRun>(resolveRunJsonPath(source))
  }));
  const summary = buildCrossRunSummary(entries);
  writeTextFile(path.join(outputDir, 'CROSS_RUN_SUMMARY.md'), summary.markdown);
  writeTextFile(path.join(outputDir, 'leaderboard-metrics.svg'), summary.metricsSvg);
  writeJsonFile(path.join(outputDir, 'cross-run-summary.json'), {
    createdAt: new Date().toISOString(),
    sources,
    rows: summary.rows,
    relativeCounts: summary.relativeCounts,
    fixedCounts: summary.fixedCounts,
    confidenceCounts: summary.confidenceCounts,
    stabilityReview: summary.stabilityReview,
    deploymentReview: summary.deploymentReview
  });
  return outputDir;
};

interface ResidualAggregate {
  key: string;
  predictionCount: number;
  matchCount: number;
  signedResidual: number;
  scoreMae: number;
  scoreRmse: number;
  actualMean: number;
  expectedMean: number;
  coverage: number;
  intervalWidth: number;
}

interface CalibrationBucket {
  bucket: string;
  matches: number;
  predictedWinRate: number;
  actualWinRate: number;
  brier: number;
}

interface ResidualDiagnosticsEntry {
  source: string;
  runName: string;
  runId: string;
  model: string;
  modelShort: string;
  scoreMae: number;
  marginMae: number;
  winBrier: number;
  worstEventScoreMae: number;
  eventResiduals: ResidualAggregate[];
  overallPhaseResiduals: ResidualAggregate[];
  championshipPhaseResiduals: ResidualAggregate[];
  calibrationBuckets: CalibrationBucket[];
}

const summarizeScorePredictions = (key: string, predictions: ScorePrediction[]): ResidualAggregate => {
  const residuals = predictions.map(prediction => prediction.actualScore - prediction.expectedScore);
  const matchKeys = new Set(predictions.map(prediction => prediction.matchKey));
  const covered = predictions.filter(
    prediction => prediction.actualScore >= prediction.p10Score && prediction.actualScore <= prediction.p90Score
  ).length;
  return {
    key,
    predictionCount: predictions.length,
    matchCount: matchKeys.size,
    signedResidual: mean(residuals),
    scoreMae: mean(residuals.map(Math.abs)),
    scoreRmse: rmse(residuals),
    actualMean: mean(predictions.map(prediction => prediction.actualScore)),
    expectedMean: mean(predictions.map(prediction => prediction.expectedScore)),
    coverage: predictions.length > 0 ? covered / predictions.length : 0,
    intervalWidth: mean(predictions.map(prediction => prediction.p90Score - prediction.p10Score))
  };
};

const summarizeWinCalibration = (matches: MatchPrediction[]): CalibrationBucket[] => {
  const buckets = new Map<string, MatchPrediction[]>();
  matches.forEach(match => {
    const lower = Math.min(90, Math.floor(match.redWinProbability * 10) * 10);
    const label = `${lower}-${lower + 10}%`;
    const bucket = buckets.get(label) ?? [];
    bucket.push(match);
    buckets.set(label, bucket);
  });
  return Array.from(buckets.entries())
    .sort(([left], [right]) => Number.parseInt(left, 10) - Number.parseInt(right, 10))
    .map(([bucket, values]) => ({
      bucket,
      matches: values.length,
      predictedWinRate: mean(values.map(match => match.redWinProbability)),
      actualWinRate: mean(values.map(match => (match.actualWinner === 'red' ? 1 : 0))),
      brier: mean(values.map(match => ((match.actualWinner === 'red' ? 1 : 0) - match.redWinProbability) ** 2))
    }));
};

const buildMatchPhaseLookup = (matches: MatchPrediction[]) => {
  const byEvent = new Map<string, MatchPrediction[]>();
  matches.forEach(match => {
    const bucket = byEvent.get(match.eventKey) ?? [];
    bucket.push(match);
    byEvent.set(match.eventKey, bucket);
  });
  const lookup = new Map<string, string>();
  byEvent.forEach((values, eventKey) => {
    values.forEach((match, index) => {
      const ratio = values.length <= 1 ? 0 : index / (values.length - 1);
      const phase = ratio < 1 / 3 ? 'early' : ratio < 2 / 3 ? 'middle' : 'late';
      lookup.set(`${eventKey}|${match.matchKey}`, phase);
    });
  });
  return lookup;
};

const buildResidualDiagnosticEntry = (source: string, run: ResearchRun): ResidualDiagnosticsEntry => {
  const best = run.modelResults.find(result => result.config.name === run.bestModelName) ?? run.modelResults[0];
  if (!best) throw new Error(`Run ${source} does not contain model results.`);
  if (best.scorePredictions.length === 0 || best.matchPredictions.length === 0) {
    throw new Error(`Run ${source} does not include compacted predictions for its selected model.`);
  }

  const byEvent = new Map<string, ScorePrediction[]>();
  best.scorePredictions.forEach(prediction => {
    const bucket = byEvent.get(prediction.eventKey) ?? [];
    bucket.push(prediction);
    byEvent.set(prediction.eventKey, bucket);
  });
  const eventResiduals = Array.from(byEvent.entries())
    .map(([eventKey, predictions]) => summarizeScorePredictions(eventKey, predictions))
    .sort((left, right) => right.scoreMae - left.scoreMae || left.key.localeCompare(right.key));

  const phaseLookup = buildMatchPhaseLookup(best.matchPredictions);
  const byPhase = new Map<string, ScorePrediction[]>();
  const byChampionshipPhase = new Map<string, ScorePrediction[]>();
  best.scorePredictions.forEach(prediction => {
    const phase = phaseLookup.get(`${prediction.eventKey}|${prediction.matchKey}`) ?? 'unknown';
    const phaseBucket = byPhase.get(phase) ?? [];
    phaseBucket.push(prediction);
    byPhase.set(phase, phaseBucket);
    if (isChampionshipLikeEventKey(prediction.eventKey)) {
      const championshipBucket = byChampionshipPhase.get(phase) ?? [];
      championshipBucket.push(prediction);
      byChampionshipPhase.set(phase, championshipBucket);
    }
  });
  const phaseOrder = new Map([
    ['early', 0],
    ['middle', 1],
    ['late', 2],
    ['unknown', 3]
  ]);
  const sortPhases = (rows: ResidualAggregate[]) =>
    rows.sort((left, right) => (phaseOrder.get(left.key) ?? 99) - (phaseOrder.get(right.key) ?? 99));

  return {
    source,
    runName: path.basename(path.dirname(resolveRunJsonPath(source))),
    runId: run.runId,
    model: best.config.name,
    modelShort: shortModelName(best.config.name),
    scoreMae: best.scoreMae,
    marginMae: best.marginMae,
    winBrier: best.winBrier,
    worstEventScoreMae: best.worstEventScoreMae,
    eventResiduals,
    overallPhaseResiduals: sortPhases(
      Array.from(byPhase.entries()).map(([phase, predictions]) => summarizeScorePredictions(phase, predictions))
    ),
    championshipPhaseResiduals: sortPhases(
      Array.from(byChampionshipPhase.entries()).map(([phase, predictions]) => summarizeScorePredictions(phase, predictions))
    ),
    calibrationBuckets: summarizeWinCalibration(best.matchPredictions)
  };
};

const readRunForResidualDiagnostics = (source: string) => {
  const runJsonPath = resolveRunJsonPath(source);
  const run = readJsonFile<ResearchRun>(runJsonPath);
  const selected = run.modelResults.find(result => result.config.name === run.bestModelName) ?? run.modelResults[0];
  if (!selected || selected.scorePredictions.length > 0) return run;

  const predictionArtifactPath = path.join(path.dirname(runJsonPath), 'best-model-predictions.json');
  if (!fs.existsSync(predictionArtifactPath)) return run;
  const predictionArtifact = readJsonFile<{
    model: { name: string };
    scorePredictions: ScorePrediction[];
    matchPredictions: MatchPrediction[];
  }>(predictionArtifactPath);
  const target = run.modelResults.find(result => result.config.name === predictionArtifact.model.name) ?? selected;
  target.scorePredictions = predictionArtifact.scorePredictions;
  target.matchPredictions = predictionArtifact.matchPredictions;
  return run;
};

const residualRowsToMarkdown = (rows: ResidualAggregate[], limit = rows.length) =>
  rows
    .slice(0, limit)
    .map(
      row =>
        `| ${row.key} | ${row.matchCount} | ${row.predictionCount} | ${formatNumber(row.signedResidual)} | ${formatNumber(
          row.scoreMae
        )} | ${formatNumber(row.scoreRmse)} | ${formatNumber(row.actualMean)} | ${formatNumber(row.expectedMean)} | ${formatNumber(
          row.coverage * 100,
          1
        )}% | ${formatNumber(row.intervalWidth, 1)} |`
    );

const calibrationRowsToMarkdown = (rows: CalibrationBucket[]) =>
  rows.map(
    row =>
      `| ${row.bucket} | ${row.matches} | ${formatNumber(row.predictedWinRate * 100, 1)}% | ${formatNumber(
        row.actualWinRate * 100,
        1
      )}% | ${formatNumber(row.brier, 4)} |`
  );

const buildResidualDiagnosticsSvg = (entries: ResidualDiagnosticsEntry[]) => {
  const rows = entries
    .flatMap(entry =>
      entry.eventResiduals.slice(0, 10).map(event => ({
        label: `${entry.runName}:${event.key}`,
        value: event.scoreMae
      }))
    )
    .slice(0, 18);
  const width = 1100;
  const rowHeight = 28;
  const height = 80 + rows.length * rowHeight;
  const maxValue = Math.max(1, ...rows.map(row => row.value));
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Worst event residual diagnostics">`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    '<text x="24" y="32" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#111827">Worst Event Score MAE</text>'
  ];
  rows.forEach((row, index) => {
    const y = 62 + index * rowHeight;
    const barWidth = (row.value / maxValue) * 560;
    parts.push(
      `<text x="24" y="${y + 16}" font-family="Arial, sans-serif" font-size="12" fill="#374151">${escapeXml(row.label)}</text>`,
      `<rect x="360" y="${y}" width="${barWidth.toFixed(1)}" height="18" rx="3" fill="#2563eb"/>`,
      `<text x="${370 + barWidth}" y="${y + 14}" font-family="Arial, sans-serif" font-size="12" fill="#111827">${formatNumber(
        row.value
      )}</text>`
    );
  });
  parts.push('</svg>');
  return parts.join('\n');
};

export const buildResidualDiagnostics = (entries: Array<{ source: string; run: ResearchRun }>) => {
  const diagnostics = entries.map(entry => buildResidualDiagnosticEntry(entry.source, entry.run));
  const lines = [
    '# Residual Diagnostics',
    '',
    'Generated from saved walk-forward predictions. Positive signed residual means the model underpredicted score; negative means it overpredicted.',
    '',
    '## Run Summary',
    '',
    '| Run | Model | Score MAE | Margin MAE | Brier | Worst Event MAE |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...diagnostics.map(
      entry =>
        `| ${entry.runName} | ${entry.modelShort} | ${formatNumber(entry.scoreMae)} | ${formatNumber(
          entry.marginMae
        )} | ${formatNumber(entry.winBrier, 4)} | ${formatNumber(entry.worstEventScoreMae)} |`
    ),
    ''
  ];

  diagnostics.forEach(entry => {
    const underpredicted = [...entry.eventResiduals]
      .filter(row => row.matchCount >= 8)
      .sort((left, right) => right.signedResidual - left.signedResidual)
      .slice(0, 10);
    const overpredicted = [...entry.eventResiduals]
      .filter(row => row.matchCount >= 8)
      .sort((left, right) => left.signedResidual - right.signedResidual)
      .slice(0, 10);
    lines.push(
      `## ${entry.runName}`,
      '',
      `Model: ${entry.model}`,
      '',
      '### Worst Event MAE',
      '',
      '| Event | Matches | Rows | Signed Residual | Score MAE | Score RMSE | Actual Mean | Expected Mean | Coverage | Width |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...residualRowsToMarkdown(entry.eventResiduals, 12),
      '',
      '### Biggest Underpredictions',
      '',
      '| Event | Matches | Rows | Signed Residual | Score MAE | Score RMSE | Actual Mean | Expected Mean | Coverage | Width |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...residualRowsToMarkdown(underpredicted),
      '',
      '### Biggest Overpredictions',
      '',
      '| Event | Matches | Rows | Signed Residual | Score MAE | Score RMSE | Actual Mean | Expected Mean | Coverage | Width |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...residualRowsToMarkdown(overpredicted),
      '',
      '### Event Phase Residuals',
      '',
      '| Phase | Matches | Rows | Signed Residual | Score MAE | Score RMSE | Actual Mean | Expected Mean | Coverage | Width |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...residualRowsToMarkdown(entry.overallPhaseResiduals),
      '',
      '### Championship-Like Phase Residuals',
      '',
      '| Phase | Matches | Rows | Signed Residual | Score MAE | Score RMSE | Actual Mean | Expected Mean | Coverage | Width |',
      '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...residualRowsToMarkdown(entry.championshipPhaseResiduals),
      '',
      '### Win Calibration',
      '',
      '| Red win-prob bucket | Matches | Predicted red win rate | Actual red win rate | Brier |',
      '| --- | ---: | ---: | ---: | ---: |',
      ...calibrationRowsToMarkdown(entry.calibrationBuckets),
      ''
    );
  });

  return {
    diagnostics,
    markdown: lines.join('\n'),
    residualSvg: buildResidualDiagnosticsSvg(diagnostics)
  };
};

export const writeResidualDiagnosticArtifacts = (
  sources: string[],
  outputDir = path.resolve('modeling/artifacts/reports', `residual-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}`)
) => {
  if (sources.length === 0) throw new Error('At least one run directory or run.json path is required.');
  const entries = sources.map(source => ({
    source,
    run: readRunForResidualDiagnostics(source)
  }));
  const diagnostics = buildResidualDiagnostics(entries);
  writeTextFile(path.join(outputDir, 'RESIDUAL_DIAGNOSTICS.md'), diagnostics.markdown);
  writeTextFile(path.join(outputDir, 'residual-event-mae.svg'), diagnostics.residualSvg);
  writeJsonFile(path.join(outputDir, 'residual-diagnostics.json'), {
    createdAt: new Date().toISOString(),
    sources,
    diagnostics: diagnostics.diagnostics
  });
  return outputDir;
};
