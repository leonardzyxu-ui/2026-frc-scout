import path from 'node:path';
import type { ResearchRun } from '../types.ts';
import { compactResearchRun, writeJsonFile, writeTextFile } from '../util.ts';

const formatNumber = (value: number, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : 'n/a';

const buildLeaderboard = (run: ResearchRun) => {
  const lines = [
    '| Rank | Model | Promote | Benchmark | Overfit Risk | Penalty | Score MAE | Norm Score MAE | Margin MAE | Norm Margin MAE | Brier | Calibration | Coverage | Worst Event MAE | Worst Season MAE | Leakage | Rejection notes |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |'
  ];

  run.modelResults.forEach(result => {
    lines.push(
      `| ${result.benchmarkRank} | ${result.config.name} | ${result.promoted ? 'yes' : 'no'} | ${formatNumber(
        result.benchmarkScore,
        3
      )} | ${formatNumber(result.overfitRiskScore, 3)} | ${formatNumber(result.benchmarkPenalty, 3)} | ${formatNumber(
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
      )} | ${formatNumber(result.worstSeasonScoreMae)} | ${result.config.leakageRisk} | ${result.rejectionReasons.join('; ') || 'none'} |`
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
    '- Fixed before model selection: lower is better.',
    '- Predictive metrics are blended two ways: percentile rank and robust relative magnitude, so a model must be good both ordinally and by actual error size.',
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
    '- Current implemented families include baselines, batch OPR, online EPA, ridge, elastic net, robust ridge, k-nearest-neighbor, and kernel smoothing; tree boosting and conformal stacks are next.',
    '- Defense value is inferred from residual suppression and scout observations where available, so it is weakest for unscouted teams.',
    '- FIRST/TBA score component labels vary by season and game; season-specific adapters should be added before component models are promoted.',
    '- Firebase ingestion requires a local access token and does not upload any model artifact back to Firebase.'
  ].join('\n');
};

export const writeRunArtifacts = (run: ResearchRun, outputDir = path.resolve('modeling/artifacts/runs', run.runId)) => {
  writeJsonFile(path.join(outputDir, 'run.json'), compactResearchRun(run));
  writeTextFile(path.join(outputDir, 'MODEL_CARD.md'), buildModelCard(run));
  const best = run.modelResults.find(result => result.promoted) ?? run.modelResults[0] ?? null;
  if (best) {
    writeJsonFile(path.join(outputDir, 'best-model-predictions.json'), {
      model: best.config,
      scorePredictions: best.scorePredictions,
      matchPredictions: best.matchPredictions
    });
    writeJsonFile(path.join(outputDir, 'best-model-summary.json'), {
      model: best.config,
      metrics: {
        benchmarkScore: best.benchmarkScore,
        benchmarkRank: best.benchmarkRank,
        benchmarkPenalty: best.benchmarkPenalty,
        overfitRiskScore: best.overfitRiskScore,
        benchmarkBreakdown: best.benchmarkBreakdown,
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
