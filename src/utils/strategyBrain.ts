import {
  AlliancePickRecommendation,
  DefenseAttributionRecord,
  MatchDefenseScoutingV1,
  MatchScoutingV3,
  MatchScoutingV4,
  ModelCalibrationBin,
  ModelBacktestResult,
  ModelFeatureSnapshot,
  ScoutAssignmentPlan,
  ScoutCalibrationRow,
  StrategyAllianceRpPath,
  StrategyRoleOption,
  StrategyMatchPlan,
  TeamPerformanceProfile
} from '../types';
import { calculateLegacyOprRatings, TBAMatch } from './mathEngine';
import { TeamHistoricalAverageRow } from './adminV2Analytics';
import { rebuilt2026GameAdapter } from './seasonGameAdapter';

const normalizeTeamKey = (teamKey: string) => teamKey.replace(/^frc/i, '');

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);

const stddev = (values: number[]) => {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
};

const percentile = (values: number[], target: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, (sorted.length - 1) * target));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

const linearSlope = (points: Array<{ x: number; y: number }>) => {
  if (points.length <= 1) return 0;
  const avgX = mean(points.map(point => point.x));
  const avgY = mean(points.map(point => point.y));
  const numerator = points.reduce((sum, point) => sum + (point.x - avgX) * (point.y - avgY), 0);
  const denominator = points.reduce((sum, point) => sum + (point.x - avgX) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
};

const getOfficialAllianceScore = (match: TBAMatch, alliance: 'red' | 'blue') => match.alliances[alliance].score;

const isPlayedMatch = (match: TBAMatch) =>
  match.alliances.red.score !== -1 && match.alliances.blue.score !== -1;

const scoreAlliance = (teams: string[], ratings: Record<string, number>) =>
  teams.reduce((sum, team) => sum + (ratings[team] ?? 0), 0);

const sumAllianceBonusMetric = (
  teams: string[],
  lookup: Record<string, { towerMetric: number; fuelMetric: number }>,
  metric: 'towerMetric' | 'fuelMetric'
) => teams.reduce((sum, team) => sum + (lookup[team]?.[metric] ?? 0), 0);

const sortMatchesByMatchNumber = (matches: TBAMatch[]) =>
  [...matches].sort((left, right) => left.match_number - right.match_number || left.key.localeCompare(right.key));

const normalizeMatchKey = (matchKey: string) => {
  const normalized = matchKey.trim().toLowerCase();
  const parts = normalized.split('_');
  return parts[parts.length - 1] || normalized;
};

const getPredictionConfidence = (redScore: number, blueScore: number, lowConfidence: boolean) => {
  if (redScore === blueScore) return 0.5;
  const baseConfidence = 0.5 + Math.min(0.45, Math.abs(redScore - blueScore) / 140);
  return Math.max(0.5, Math.min(0.95, baseConfidence - (lowConfidence ? 0.12 : 0)));
};

const buildCalibrationBins = (
  modelName: string,
  rows: Array<{ confidence: number; hit: boolean }>
): ModelCalibrationBin[] => {
  const bins = [
    { label: '50-60%', min: 0.5, max: 0.6 },
    { label: '60-70%', min: 0.6, max: 0.7 },
    { label: '70-80%', min: 0.7, max: 0.8 },
    { label: '80-90%', min: 0.8, max: 0.9 },
    { label: '90-95%', min: 0.9, max: 0.951 }
  ];

  return bins.map(bin => {
    const binRows = rows.filter(row => row.confidence >= bin.min && row.confidence < bin.max);
    const predictedWinRate = mean(binRows.map(row => row.confidence));
    const actualWinRate = mean(binRows.map(row => row.hit ? 1 : 0));
    return {
      modelName,
      binLabel: bin.label,
      minConfidence: bin.min,
      maxConfidence: Math.min(0.95, bin.max),
      matches: binRows.length,
      predictedWinRate,
      actualWinRate,
      calibrationGap: Math.abs(predictedWinRate - actualWinRate)
    };
  }).filter(bin => bin.matches > 0);
};

const buildScoutingRatingsBefore = (
  v3Records: MatchScoutingV3[],
  v4Records: MatchScoutingV4[],
  beforeMatchNumber: number,
  rollingWindow?: number
) => {
  const buckets = new Map<string, Array<{ matchNumber: number; points: number }>>();
  const add = (teamNumber: string, matchNumber: number, points: number) => {
    if (!teamNumber || matchNumber >= beforeMatchNumber) return;
    const bucket = buckets.get(teamNumber) || [];
    bucket.push({ matchNumber, points });
    buckets.set(teamNumber, bucket);
  };

  v3Records
    .filter(record => record.matchType === 'Qualification')
    .forEach(record => add(record.teamNumber, record.matchNumber, record.totalMatchPoints));
  v4Records
    .filter(record => record.matchType === 'Qualification')
    .forEach(record => add(record.teamNumber, record.matchNumber, record.totalMatchPoints));

  return Object.fromEntries(
    Array.from(buckets.entries()).map(([teamNumber, rows]) => {
      const orderedRows = rows.sort((left, right) => left.matchNumber - right.matchNumber);
      const windowRows = rollingWindow ? orderedRows.slice(-rollingWindow) : orderedRows;
      return [teamNumber, mean(windowRows.map(row => row.points))];
    })
  );
};

const buildScoutingStatsBefore = (
  v3Records: MatchScoutingV3[],
  v4Records: MatchScoutingV4[],
  beforeMatchNumber: number,
  rollingWindow = 3
) => {
  const buckets = new Map<string, Array<{ matchNumber: number; points: number }>>();
  const add = (teamNumber: string, matchNumber: number, points: number) => {
    if (!teamNumber || matchNumber >= beforeMatchNumber) return;
    const bucket = buckets.get(teamNumber) || [];
    bucket.push({ matchNumber, points });
    buckets.set(teamNumber, bucket);
  };

  v3Records
    .filter(record => record.matchType === 'Qualification')
    .forEach(record => add(record.teamNumber, record.matchNumber, record.totalMatchPoints));
  v4Records
    .filter(record => record.matchType === 'Qualification')
    .forEach(record => add(record.teamNumber, record.matchNumber, record.totalMatchPoints));

  return Object.fromEntries(
    Array.from(buckets.entries()).map(([teamNumber, rows]) => {
      const orderedRows = rows.sort((left, right) => left.matchNumber - right.matchNumber);
      return [teamNumber, {
        scoutingRowsBefore: orderedRows.length,
        ppcBefore: mean(orderedRows.map(row => row.points)),
        rollingPpcBefore: mean(orderedRows.slice(-rollingWindow).map(row => row.points))
      }];
    })
  );
};

const countOfficialAppearancesBefore = (matches: TBAMatch[]) => {
  const counts: Record<string, number> = {};
  matches.forEach(match => {
    [...match.alliances.red.team_keys, ...match.alliances.blue.team_keys]
      .map(normalizeTeamKey)
      .forEach(team => {
        counts[team] = (counts[team] || 0) + 1;
      });
  });
  return counts;
};

const solveLinearSystem = (matrix: number[][], vector: number[]) => {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let pivotRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[pivotRow][pivot])) {
        pivotRow = row;
      }
    }
    [augmented[pivot], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivot]];

    const pivotValue = augmented[pivot][pivot] || 1e-9;
    for (let column = pivot; column <= size; column += 1) {
      augmented[pivot][column] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= size; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return augmented.map(row => row[size]);
};

const trainRidgeRegression = (
  samples: Array<{ features: number[]; target: number }>,
  lambda = 30
) => {
  if (samples.length === 0) return null;
  const featureCount = samples[0].features.length + 1;
  const xtx = Array.from({ length: featureCount }, () => Array.from({ length: featureCount }, () => 0));
  const xty = Array.from({ length: featureCount }, () => 0);

  samples.forEach(sample => {
    const row = [1, ...sample.features];
    row.forEach((leftValue, leftIndex) => {
      xty[leftIndex] += leftValue * sample.target;
      row.forEach((rightValue, rightIndex) => {
        xtx[leftIndex][rightIndex] += leftValue * rightValue;
      });
    });
  });

  for (let index = 1; index < featureCount; index += 1) {
    xtx[index][index] += lambda;
  }

  return solveLinearSystem(xtx, xty);
};

const predictRidge = (weights: number[] | null, features: number[]) =>
  weights ? weights.reduce((sum, weight, index) => sum + weight * (index === 0 ? 1 : features[index - 1]), 0) : 0;

const buildRidgeFeatureVector = ({
  match,
  playedQuals,
  v3Records,
  v4Records,
  epaRatings,
  includeEpa,
  maxMatchNumber
}: {
  match: TBAMatch;
  playedQuals: TBAMatch[];
  v3Records: MatchScoutingV3[];
  v4Records: MatchScoutingV4[];
  epaRatings: Record<string, number>;
  includeEpa: boolean;
  maxMatchNumber: number;
}) => {
  const redTeams = match.alliances.red.team_keys.map(normalizeTeamKey);
  const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamKey);
  const priorOfficialMatches = playedQuals.filter(prior => prior.match_number < match.match_number);
  const ppcRatings = buildScoutingRatingsBefore(v3Records, v4Records, match.match_number);
  const rollingPpcRatings = buildScoutingRatingsBefore(v3Records, v4Records, match.match_number, 3);
  const oprRatings = calculateLegacyOprRatings(priorOfficialMatches);
  const rollingOprRatings = calculateLegacyOprRatings(priorOfficialMatches.slice(-18));
  const ratingDelta = (ratings: Record<string, number>) =>
    (scoreAlliance(redTeams, ratings) - scoreAlliance(blueTeams, ratings)) / 100;
  const features = [
    ratingDelta(ppcRatings),
    ratingDelta(rollingPpcRatings),
    ratingDelta(oprRatings),
    ratingDelta(rollingOprRatings),
    match.match_number / Math.max(1, maxMatchNumber)
  ];
  if (includeEpa) features.push(ratingDelta(epaRatings));

  return {
    features,
    missingSignal:
      [...redTeams, ...blueTeams].some(team =>
        !(team in ppcRatings) &&
        !(team in rollingPpcRatings) &&
        !(team in oprRatings) &&
        (!includeEpa || !(team in epaRatings))
      )
  };
};

const buildRidgePredictions = ({
  playedQuals,
  v3Records,
  v4Records,
  epaRatings,
  includeEpa
}: {
  playedQuals: TBAMatch[];
  v3Records: MatchScoutingV3[];
  v4Records: MatchScoutingV4[];
  epaRatings: Record<string, number>;
  includeEpa: boolean;
}) => {
  const maxMatchNumber = Math.max(1, ...playedQuals.map(match => match.match_number));

  return playedQuals.map(match => {
    const priorOfficialMatches = playedQuals.filter(prior => prior.match_number < match.match_number);
    const trainingSamples = priorOfficialMatches.map(prior => ({
      features: buildRidgeFeatureVector({
        match: prior,
        playedQuals,
        v3Records,
        v4Records,
        epaRatings,
        includeEpa,
        maxMatchNumber
      }).features,
      target: (getOfficialAllianceScore(prior, 'red') - getOfficialAllianceScore(prior, 'blue')) / 100
    }));
    const weights = trainRidgeRegression(trainingSamples);
    const { features, missingSignal } = buildRidgeFeatureVector({
      match,
      playedQuals,
      v3Records,
      v4Records,
      epaRatings,
      includeEpa,
      maxMatchNumber
    });
    const predictedMargin = predictRidge(weights, features) * 100;
    const priorAllianceAverage = mean(priorOfficialMatches.flatMap(prior => [
      getOfficialAllianceScore(prior, 'red'),
      getOfficialAllianceScore(prior, 'blue')
    ]));
    const fallbackAverage = mean([
      getOfficialAllianceScore(match, 'red'),
      getOfficialAllianceScore(match, 'blue')
    ]);
    const allianceAverage = Number.isFinite(priorAllianceAverage) && priorAllianceAverage > 0 ? priorAllianceAverage : fallbackAverage;

    return {
      match,
      redScore: Math.max(0, allianceAverage + predictedMargin / 2),
      blueScore: Math.max(0, allianceAverage - predictedMargin / 2),
      lowConfidence: trainingSamples.length < 10 || missingSignal
    };
  });
};

const buildRidgeFuturePredictions = ({
  matches,
  v3Records,
  v4Records,
  epaRatings,
  includeEpa
}: {
  matches: TBAMatch[];
  v3Records: MatchScoutingV3[];
  v4Records: MatchScoutingV4[];
  epaRatings: Record<string, number>;
  includeEpa: boolean;
}) => {
  const playedQuals = sortMatchesByMatchNumber(matches.filter(match => match.comp_level === 'qm' && isPlayedMatch(match)));
  const futureQuals = sortMatchesByMatchNumber(matches.filter(match => match.comp_level === 'qm' && !isPlayedMatch(match)));
  const maxMatchNumber = Math.max(1, ...matches.filter(match => match.comp_level === 'qm').map(match => match.match_number));
  const trainingSamples = playedQuals.map(match => ({
    features: buildRidgeFeatureVector({
      match,
      playedQuals,
      v3Records,
      v4Records,
      epaRatings,
      includeEpa,
      maxMatchNumber
    }).features,
    target: (getOfficialAllianceScore(match, 'red') - getOfficialAllianceScore(match, 'blue')) / 100
  }));
  const weights = trainRidgeRegression(trainingSamples);
  const allianceAverage = mean(playedQuals.flatMap(match => [
    getOfficialAllianceScore(match, 'red'),
    getOfficialAllianceScore(match, 'blue')
  ]));
  const safeAllianceAverage = Number.isFinite(allianceAverage) && allianceAverage > 0 ? allianceAverage : 0;

  return Object.fromEntries(
    futureQuals.map(match => {
      const { features, missingSignal } = buildRidgeFeatureVector({
        match,
        playedQuals,
        v3Records,
        v4Records,
        epaRatings,
        includeEpa,
        maxMatchNumber
      });
      const predictedMargin = predictRidge(weights, features) * 100;
      return [match.key, {
        redScore: Math.max(0, safeAllianceAverage + predictedMargin / 2),
        blueScore: Math.max(0, safeAllianceAverage - predictedMargin / 2),
        lowConfidence: trainingSamples.length < 10 || missingSignal
      }];
    })
  );
};

const evaluatePredictions = (
  modelName: string,
  sourceLabel: string,
  predictions: Array<{
    match: TBAMatch;
    redScore: number;
    blueScore: number;
    lowConfidence: boolean;
  }>,
  metadata: Pick<ModelBacktestResult, 'eligibleForPromotion' | 'supportsTeamRatings' | 'leakageRisk' | 'uncertaintyNote'>
): ModelBacktestResult => {
  if (predictions.length === 0) {
    return {
      modelName,
      sourceLabel,
      ...metadata,
      matchesTested: 0,
      winnerAccuracy: 0,
      averageConfidence: 0,
      brierScore: 0,
      scoreMae: 0,
      marginMae: 0,
      calibrationError: 0,
      lowConfidenceRate: 0,
      calibrationBins: [],
      comparisonRows: []
    };
  }

  let winnerHits = 0;
  let confidenceTotal = 0;
  let brierTotal = 0;
  let scoreAbsError = 0;
  let marginAbsError = 0;
  let calibrationError = 0;
  let lowConfidence = 0;
  const calibrationRows: Array<{ confidence: number; hit: boolean }> = [];
  const comparisonRows: ModelBacktestResult['comparisonRows'] = [];

  predictions.forEach(({ match, redScore, blueScore, lowConfidence: isLowConfidence }) => {
    const actualRed = getOfficialAllianceScore(match, 'red');
    const actualBlue = getOfficialAllianceScore(match, 'blue');
    const predictedWinner = redScore === blueScore ? 'Tie' : redScore > blueScore ? 'Red' : 'Blue';
    const actualWinner = actualRed === actualBlue ? 'Tie' : actualRed > actualBlue ? 'Red' : 'Blue';
    const hit = predictedWinner === actualWinner;
    const confidence = getPredictionConfidence(redScore, blueScore, isLowConfidence);
    comparisonRows.push({
      matchKey: match.key,
      matchNumber: match.match_number,
      title: `Q${match.match_number}`,
      predictedRedScore: redScore,
      predictedBlueScore: blueScore,
      actualRedScore: actualRed,
      actualBlueScore: actualBlue,
      predictedWinner,
      actualWinner,
      winnerPickCorrect: hit,
      confidence,
      lowConfidence: isLowConfidence
    });
    if (hit) winnerHits += 1;
    confidenceTotal += confidence;
    brierTotal += (confidence - (hit ? 1 : 0)) ** 2;
    calibrationRows.push({ confidence, hit });
    scoreAbsError += Math.abs(redScore - actualRed) + Math.abs(blueScore - actualBlue);
    marginAbsError += Math.abs((redScore - blueScore) - (actualRed - actualBlue));
    calibrationError += Math.abs(Math.abs(redScore - blueScore) - Math.abs(actualRed - actualBlue));
    if (isLowConfidence) lowConfidence += 1;
  });

  return {
    modelName,
    sourceLabel,
    ...metadata,
    matchesTested: predictions.length,
    winnerAccuracy: winnerHits / predictions.length,
    averageConfidence: confidenceTotal / predictions.length,
    brierScore: brierTotal / predictions.length,
    scoreMae: scoreAbsError / (predictions.length * 2),
    marginMae: marginAbsError / predictions.length,
    calibrationError: calibrationError / predictions.length,
    lowConfidenceRate: lowConfidence / predictions.length,
    calibrationBins: buildCalibrationBins(modelName, calibrationRows),
    comparisonRows
  };
};

export const backtestTimeAwareModels = ({
  matches,
  v3Records,
  v4Records,
  epaRatings
}: {
  matches: TBAMatch[];
  v3Records: MatchScoutingV3[];
  v4Records: MatchScoutingV4[];
  epaRatings: Record<string, number>;
}): ModelBacktestResult[] => {
  const playedQuals = sortMatchesByMatchNumber(matches.filter(match => match.comp_level === 'qm' && isPlayedMatch(match)));
  const modelPredictions: Record<string, Array<{
    match: TBAMatch;
    redScore: number;
    blueScore: number;
    lowConfidence: boolean;
  }>> = {
    PPC: [],
    'Rolling PPC': [],
    OPR: [],
    'Rolling OPR': [],
    EPA: [],
    'Recency EPA': [],
    'No-Future Blend': [],
    'No-Future Ridge': [],
    'Context Blend': [],
    'Context Ridge': []
  };

  modelPredictions['No-Future Ridge'] = buildRidgePredictions({
    playedQuals,
    v3Records,
    v4Records,
    epaRatings,
    includeEpa: false
  });
  modelPredictions['Context Ridge'] = buildRidgePredictions({
    playedQuals,
    v3Records,
    v4Records,
    epaRatings,
    includeEpa: true
  });

  playedQuals.forEach(match => {
    const redTeams = match.alliances.red.team_keys.map(normalizeTeamKey);
    const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamKey);
    const teams = [...redTeams, ...blueTeams];
    const priorOfficialMatches = playedQuals.filter(prior => prior.match_number < match.match_number);
    const ppcRatings = buildScoutingRatingsBefore(v3Records, v4Records, match.match_number);
    const rollingPpcRatings = buildScoutingRatingsBefore(v3Records, v4Records, match.match_number, 3);
    const oprRatings = calculateLegacyOprRatings(priorOfficialMatches);
    const rollingOprRatings = calculateLegacyOprRatings(priorOfficialMatches.slice(-18));
    const modelRatings = [
      { key: 'PPC', ratings: ppcRatings },
      { key: 'Rolling PPC', ratings: rollingPpcRatings },
      { key: 'OPR', ratings: oprRatings },
      { key: 'Rolling OPR', ratings: rollingOprRatings },
      { key: 'EPA', ratings: epaRatings },
      { key: 'Recency EPA', ratings: epaRatings }
    ];

    modelRatings.forEach(({ key, ratings }) => {
      modelPredictions[key].push({
        match,
        redScore: scoreAlliance(redTeams, ratings),
        blueScore: scoreAlliance(blueTeams, ratings),
        lowConfidence: teams.some(team => !(team in ratings))
      });
    });

    const noFutureBlendScore = (allianceTeams: string[]) =>
      allianceTeams.reduce((sum, team) => {
        const values = [ppcRatings[team], rollingPpcRatings[team], oprRatings[team], rollingOprRatings[team]]
          .filter((value): value is number => value != null && Number.isFinite(value));
        return sum + mean(values);
      }, 0);
    modelPredictions['No-Future Blend'].push({
      match,
      redScore: noFutureBlendScore(redTeams),
      blueScore: noFutureBlendScore(blueTeams),
      lowConfidence: teams.some(team => {
        const values = [ppcRatings[team], rollingPpcRatings[team], oprRatings[team], rollingOprRatings[team]]
          .filter((value): value is number => value != null && Number.isFinite(value));
        return values.length === 0;
      })
    });

    const contextBlendScore = (allianceTeams: string[]) =>
      allianceTeams.reduce((sum, team) => {
        const values = [ppcRatings[team], rollingPpcRatings[team], oprRatings[team], epaRatings[team]]
          .filter((value): value is number => value != null && Number.isFinite(value));
        return sum + mean(values);
      }, 0);
    modelPredictions['Context Blend'].push({
      match,
      redScore: contextBlendScore(redTeams),
      blueScore: contextBlendScore(blueTeams),
      lowConfidence: teams.some(team => {
        const values = [ppcRatings[team], rollingPpcRatings[team], oprRatings[team], epaRatings[team]]
          .filter((value): value is number => value != null && Number.isFinite(value));
        return values.length === 0;
      })
    });
  });

  const sourceLabels: Record<string, string> = {
    PPC: 'No-future scouting average before each match',
    'Rolling PPC': 'No-future last-three scouting average',
    OPR: 'No-future official score least-squares',
    'Rolling OPR': 'No-future rolling official score least-squares',
    EPA: 'Current Statbotics EPA context',
    'Recency EPA': 'Current Statbotics EPA recency proxy',
    'No-Future Blend': 'No-future PPC/rolling PPC/OPR blend',
    'No-Future Ridge': 'No-future ridge regression over PPC/OPR/match timing',
    'Context Blend': 'Explainable PPC/OPR/current EPA blend',
    'Context Ridge': 'Ridge regression with current EPA context'
  };
  const metadataByModel: Record<string, Pick<ModelBacktestResult, 'eligibleForPromotion' | 'supportsTeamRatings' | 'leakageRisk' | 'uncertaintyNote'>> = {
    PPC: {
      eligibleForPromotion: true,
      supportsTeamRatings: true,
      leakageRisk: 'none',
      uncertaintyNote: 'Uses only scouting rows saved before the tested match.'
    },
    'Rolling PPC': {
      eligibleForPromotion: true,
      supportsTeamRatings: true,
      leakageRisk: 'none',
      uncertaintyNote: 'Uses only the recent scouting window before the tested match.'
    },
    OPR: {
      eligibleForPromotion: true,
      supportsTeamRatings: true,
      leakageRisk: 'none',
      uncertaintyNote: 'Uses only official match scores played before the tested match.'
    },
    'Rolling OPR': {
      eligibleForPromotion: true,
      supportsTeamRatings: true,
      leakageRisk: 'none',
      uncertaintyNote: 'Uses only recent official match scores played before the tested match.'
    },
    EPA: {
      eligibleForPromotion: false,
      supportsTeamRatings: true,
      leakageRisk: 'high',
      uncertaintyNote: 'Current EPA is useful context but not a historical no-future backtest until EPA snapshots are cached.'
    },
    'Recency EPA': {
      eligibleForPromotion: false,
      supportsTeamRatings: true,
      leakageRisk: 'high',
      uncertaintyNote: 'Current EPA recency proxy can leak future information into old matches.'
    },
    'No-Future Blend': {
      eligibleForPromotion: true,
      supportsTeamRatings: true,
      leakageRisk: 'none',
      uncertaintyNote: 'Blends only no-future PPC and OPR family predictions.'
    },
    'No-Future Ridge': {
      eligibleForPromotion: true,
      supportsTeamRatings: false,
      leakageRisk: 'none',
      uncertaintyNote: 'Trains a ridge margin model only on matches before each test match; useful for match prediction, not direct team PPA ratings.'
    },
    'Context Blend': {
      eligibleForPromotion: false,
      supportsTeamRatings: true,
      leakageRisk: 'medium',
      uncertaintyNote: 'Includes current EPA context, so it is not promoted until historical EPA snapshots exist.'
    },
    'Context Ridge': {
      eligibleForPromotion: false,
      supportsTeamRatings: false,
      leakageRisk: 'high',
      uncertaintyNote: 'Adds current EPA to the ridge feature set, so it is a live context experiment rather than a true historical backtest.'
    }
  };

  return Object.entries(modelPredictions)
    .map(([modelName, predictions]) => evaluatePredictions(modelName, sourceLabels[modelName], predictions, metadataByModel[modelName]))
    .sort((left, right) => {
      if (left.eligibleForPromotion !== right.eligibleForPromotion) return Number(right.eligibleForPromotion) - Number(left.eligibleForPromotion);
      if (left.matchesTested !== right.matchesTested) return right.matchesTested - left.matchesTested;
      if (left.scoreMae !== right.scoreMae) return left.scoreMae - right.scoreMae;
      return right.winnerAccuracy - left.winnerAccuracy;
    });
};

export const buildPpaRatings = (
  modelResults: ModelBacktestResult[],
  lookups: Record<string, Record<string, number>>
) => {
  const eligibleResults = modelResults.filter(result =>
    result.matchesTested > 0 &&
    result.eligibleForPromotion &&
    result.supportsTeamRatings &&
    lookups[result.modelName]
  );
  const usableResults = eligibleResults.length > 0
    ? eligibleResults
    : modelResults.filter(result => result.matchesTested > 0 && lookups[result.modelName]);
  if (usableResults.length === 0) return {};

  const weights = usableResults.map(result => ({
    modelName: result.modelName,
    weight: 1 / Math.max(1, result.scoreMae)
  }));
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0) || 1;
  const teams = new Set<string>();
  usableResults.forEach(result => Object.keys(lookups[result.modelName]).forEach(team => teams.add(team)));

  return Object.fromEntries(
    Array.from(teams).map(team => [
      team,
      weights.reduce((sum, item) => sum + (lookups[item.modelName][team] ?? 0) * (item.weight / totalWeight), 0)
    ])
  );
};

export const buildAverageBlendLookup = (lookups: Array<Record<string, number>>) => {
  const teams = new Set<string>();
  lookups.forEach(lookup => Object.keys(lookup).forEach(team => teams.add(team)));

  return Object.fromEntries(
    Array.from(teams).map(team => {
      const values = lookups
        .map(lookup => lookup[team])
        .filter((value): value is number => value != null && Number.isFinite(value));
      return [team, mean(values)];
    })
  );
};

export const buildBestModelFutureForecasts = ({
  matches,
  v3Records,
  v4Records,
  epaRatings,
  modelResults,
  ratingLookups
}: {
  matches: TBAMatch[];
  v3Records: MatchScoutingV3[];
  v4Records: MatchScoutingV4[];
  epaRatings: Record<string, number>;
  modelResults: ModelBacktestResult[];
  ratingLookups: Record<string, Record<string, number>>;
}) => {
  const bestModel = modelResults.find(result => result.matchesTested > 0 && result.eligibleForPromotion) ||
    modelResults.find(result => result.matchesTested > 0);
  if (!bestModel) {
    return {
      modelName: 'Selected Team Rating',
      modelSource: 'No validated model yet',
      forecasts: {} as Record<string, { redScore: number; blueScore: number; lowConfidence: boolean }>
    };
  }

  if (bestModel.modelName === 'No-Future Ridge' || bestModel.modelName === 'Context Ridge') {
    return {
      modelName: bestModel.modelName,
      modelSource: bestModel.sourceLabel,
      forecasts: buildRidgeFuturePredictions({
        matches,
        v3Records,
        v4Records,
        epaRatings,
        includeEpa: bestModel.modelName === 'Context Ridge'
      })
    };
  }

  const ratings = ratingLookups[bestModel.modelName] || {};
  const futureQuals = sortMatchesByMatchNumber(matches.filter(match => match.comp_level === 'qm' && !isPlayedMatch(match)));
  return {
    modelName: bestModel.modelName,
    modelSource: bestModel.sourceLabel,
    forecasts: Object.fromEntries(
      futureQuals.map(match => {
        const redTeams = match.alliances.red.team_keys.map(normalizeTeamKey);
        const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamKey);
        return [match.key, {
          redScore: scoreAlliance(redTeams, ratings),
          blueScore: scoreAlliance(blueTeams, ratings),
          lowConfidence: [...redTeams, ...blueTeams].some(team => !(team in ratings))
        }];
      })
    )
  };
};

export const buildNoFutureFeatureMatchSnapshots = ({
  matches,
  v3Records,
  v4Records
}: {
  matches: TBAMatch[];
  v3Records: MatchScoutingV3[];
  v4Records: MatchScoutingV4[];
}): NonNullable<ModelFeatureSnapshot['matchSnapshots']> => {
  const playedQuals = sortMatchesByMatchNumber(matches.filter(match => match.comp_level === 'qm' && isPlayedMatch(match)));

  return playedQuals.map(match => {
    const priorOfficialMatches = playedQuals.filter(prior => prior.match_number < match.match_number);
    const priorRecentOfficialMatches = priorOfficialMatches.slice(-18);
    const scoutingStats = buildScoutingStatsBefore(v3Records, v4Records, match.match_number);
    const oprBefore = calculateLegacyOprRatings(priorOfficialMatches);
    const rollingOprBefore = calculateLegacyOprRatings(priorRecentOfficialMatches);
    const officialAppearancesBefore = countOfficialAppearancesBefore(priorOfficialMatches);
    const redTeams = match.alliances.red.team_keys.map(normalizeTeamKey);
    const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamKey);
    const teams = [...redTeams, ...blueTeams];

    return {
      matchKey: match.key,
      matchNumber: match.match_number,
      redTeams,
      blueTeams,
      featuresByTeam: Object.fromEntries(
        teams.map(team => {
          const stats = scoutingStats[team];
          return [team, {
            ppcBefore: stats?.ppcBefore ?? 0,
            rollingPpcBefore: stats?.rollingPpcBefore ?? 0,
            scoutingRowsBefore: stats?.scoutingRowsBefore ?? 0,
            oprBefore: oprBefore[team] ?? 0,
            rollingOprBefore: rollingOprBefore[team] ?? 0,
            officialMatchesBefore: officialAppearancesBefore[team] ?? 0
          }];
        })
      )
    };
  });
};

export const backtestRatingModels = (
  matches: TBAMatch[],
  lookups: Array<{ modelName: string; sourceLabel: string; ratings: Record<string, number>; missingTeams?: string[] }>
): ModelBacktestResult[] => {
  const playedQuals = matches.filter(match => match.comp_level === 'qm' && isPlayedMatch(match));

  return lookups.map(lookup => {
    const missingSet = new Set(lookup.missingTeams || []);
    const predictions = playedQuals.map(match => {
      const redTeams = match.alliances.red.team_keys.map(normalizeTeamKey);
      const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamKey);
      return {
        match,
        redScore: scoreAlliance(redTeams, lookup.ratings),
        blueScore: scoreAlliance(blueTeams, lookup.ratings),
        lowConfidence: [...redTeams, ...blueTeams].some(team => missingSet.has(team) || !(team in lookup.ratings))
      };
    });

    return evaluatePredictions(lookup.modelName, lookup.sourceLabel, predictions, {
      eligibleForPromotion: false,
      supportsTeamRatings: true,
      leakageRisk: 'medium',
      uncertaintyNote: 'Static rating backtest; useful for context, but not a rolling no-future promotion candidate.'
    });
  }).sort((left, right) => {
    if (left.matchesTested !== right.matchesTested) return right.matchesTested - left.matchesTested;
    if (left.scoreMae !== right.scoreMae) return left.scoreMae - right.scoreMae;
    return right.winnerAccuracy - left.winnerAccuracy;
  });
};

export const buildTeamPerformanceProfiles = ({
  v4Records,
  v3Records,
  defenseRecords,
  ppcRows,
  oprRatings,
  dprRatings,
  epaRatings,
  ppaRatings,
  defenseImpactLookup,
  featureMatchSnapshots = []
}: {
  v4Records: MatchScoutingV4[];
  v3Records: MatchScoutingV3[];
  defenseRecords: MatchDefenseScoutingV1[];
  ppcRows: TeamHistoricalAverageRow[];
  oprRatings: Record<string, number>;
  dprRatings: Record<string, number>;
  epaRatings: Record<string, number>;
  ppaRatings: Record<string, number>;
  defenseImpactLookup: Record<string, number>;
  featureMatchSnapshots?: NonNullable<ModelFeatureSnapshot['matchSnapshots']>;
}): TeamPerformanceProfile[] => {
  const teams = new Set<string>();
  v4Records.forEach(record => teams.add(record.teamNumber));
  v3Records.forEach(record => teams.add(record.teamNumber));
  defenseRecords.forEach(record => teams.add(record.teamNumber));
  ppcRows.forEach(row => teams.add(row.teamNumber));
  Object.keys(oprRatings).forEach(team => teams.add(team));
  Object.keys(epaRatings).forEach(team => teams.add(team));

  const ppcLookup = Object.fromEntries(ppcRows.map(row => [row.teamNumber, row.avgTotalMatchPoints]));

  return Array.from(teams).map(teamNumber => {
    const scores = [
      ...v4Records
        .filter(record => record.teamNumber === teamNumber)
        .map(record => ({ matchKey: record.matchKey, matchNumber: record.matchNumber, score: record.totalMatchPoints, reliability: record.reliabilityScore })),
      ...v3Records
        .filter(record => record.teamNumber === teamNumber)
        .map(record => ({ matchKey: record.matchKey, matchNumber: record.matchNumber, score: record.totalMatchPoints, reliability: 1 }))
    ].sort((left, right) => left.matchNumber - right.matchNumber);

    const rawScores = scores.map(score => score.score);
    const averageScore = mean(rawScores);
    const deviation = stddev(rawScores);
    const slope = linearSlope(scores.map(score => ({ x: score.matchNumber, y: score.score })));
    const matchNumbers = scores.map(score => score.matchNumber);
    const avgMatchNumber = mean(matchNumbers);
    const nextMatchNumber = matchNumbers.length ? Math.max(...matchNumbers) + 1 : 1;
    const projectedNextScore = Math.max(0, averageScore + slope * (nextMatchNumber - avgMatchNumber));
    const floorScore = Math.max(0, percentile(rawScores, 0.2));
    const ceilingScore = percentile(rawScores, 0.8);
    const volatility = averageScore === 0 ? 0 : deviation / Math.max(1, averageScore);
    const consistencyIndex = scores.length === 0
      ? 0
      : Math.max(0, Math.min(1, (1 - Math.min(1, volatility)) * mean(scores.map(score => score.reliability))));
    const upsetPotential = ceilingScore + Math.max(0, slope) * 2 + (defenseImpactLookup[teamNumber] ?? 0);
    const zeroRate = rawScores.length === 0 ? 0 : rawScores.filter(score => score <= 0).length / rawScores.length;
    const curve = scores.map((score, index) => {
      const recentWindow = scores.slice(Math.max(0, index - 2), index + 1).map(item => item.score);
      const fittedScore = Math.max(0, averageScore + slope * (score.matchNumber - avgMatchNumber));
      return {
        matchKey: score.matchKey,
        matchNumber: score.matchNumber,
        score: score.score,
        rollingAverage: mean(recentWindow),
        fittedScore,
        lowerBand: Math.max(0, fittedScore - deviation),
        upperBand: fittedScore + deviation
      };
    });
    const modelCurve = featureMatchSnapshots
      .filter(snapshot => snapshot.featuresByTeam[teamNumber])
      .map(snapshot => {
        const features = snapshot.featuresByTeam[teamNumber] || {};
        return {
          matchKey: snapshot.matchKey,
          matchNumber: snapshot.matchNumber,
          ppcBefore: features.ppcBefore ?? 0,
          rollingPpcBefore: features.rollingPpcBefore ?? 0,
          oprBefore: features.oprBefore ?? 0,
          rollingOprBefore: features.rollingOprBefore ?? 0,
          epa: epaRatings[teamNumber] ?? null,
          ppa: ppaRatings[teamNumber] ?? null
        };
      })
      .sort((left, right) => left.matchNumber - right.matchNumber);

    return {
      teamNumber,
      matchesPlayed: scores.length,
      peakScore: rawScores.length ? Math.max(...rawScores) : 0,
      worstScore: rawScores.length ? Math.min(...rawScores) : 0,
      lowestNonZeroScore: rawScores.filter(score => score > 0).sort((left, right) => left - right)[0] ?? null,
      averageScore,
      standardDeviation: deviation,
      floorScore,
      ceilingScore,
      projectedNextScore,
      volatility,
      consistencyIndex,
      upsetPotential,
      zeroRate,
      reliability: scores.length ? mean(scores.map(score => score.reliability)) : 0,
      recentTrend: slope,
      ppc: ppcLookup[teamNumber] ?? null,
      opr: oprRatings[teamNumber] ?? null,
      dpr: dprRatings[teamNumber] ?? null,
      epa: epaRatings[teamNumber] ?? null,
      ppa: ppaRatings[teamNumber] ?? null,
      defenseImpact: defenseImpactLookup[teamNumber] ?? null,
      normalLowScore: Math.max(0, averageScore - deviation),
      normalHighScore: averageScore + deviation,
      curve,
      modelCurve
    };
  }).sort((left, right) => {
    const scoreDelta = (right.ppa ?? right.ppc ?? 0) - (left.ppa ?? left.ppc ?? 0);
    if (scoreDelta !== 0) return scoreDelta;
    return Number(left.teamNumber) - Number(right.teamNumber);
  });
};

export const buildScoutCalibrationRows = (
  v4Records: MatchScoutingV4[],
  matches: TBAMatch[]
): ScoutCalibrationRow[] => {
  const playedMatches = new Map(
    matches
      .filter(isPlayedMatch)
      .map(match => [normalizeMatchKey(match.key), match])
  );
  const recordsByMatchAlliance = new Map<string, MatchScoutingV4[]>();

  v4Records.forEach(record => {
    if (!record.alliance) return;
    const key = `${normalizeMatchKey(record.matchKey)}:${record.alliance.toLowerCase()}`;
    const bucket = recordsByMatchAlliance.get(key) || [];
    bucket.push(record);
    recordsByMatchAlliance.set(key, bucket);
  });

  const buckets = new Map<string, {
    scoutName: string;
    assignedScoutName: string;
    matchKeys: Set<string>;
    rows: number;
    totalScoutedPoints: number;
    officialSharePoints: number;
    signedErrors: number[];
    absoluteErrors: number[];
  }>();

  recordsByMatchAlliance.forEach((allianceRecords, key) => {
    const [matchKey, allianceKey] = key.split(':') as [string, 'red' | 'blue'];
    const match = playedMatches.get(matchKey);
    if (!match || allianceRecords.length === 0) return;

    const officialScore = getOfficialAllianceScore(match, allianceKey);
    if (officialScore < 0) return;

    const scoutedScore = allianceRecords.reduce((sum, record) => sum + record.totalMatchPoints, 0);
    const allianceDelta = officialScore - scoutedScore;
    const perRobotDelta = allianceDelta / allianceRecords.length;
    const officialShare = officialScore / allianceRecords.length;

    allianceRecords.forEach(record => {
      const scoutName = record.scoutName || record.assignedScoutName || 'Unknown Scout';
      const existing = buckets.get(scoutName) || {
        scoutName,
        assignedScoutName: record.assignedScoutName || '',
        matchKeys: new Set<string>(),
        rows: 0,
        totalScoutedPoints: 0,
        officialSharePoints: 0,
        signedErrors: [],
        absoluteErrors: []
      };
      existing.assignedScoutName = existing.assignedScoutName || record.assignedScoutName || '';
      existing.matchKeys.add(matchKey);
      existing.rows += 1;
      existing.totalScoutedPoints += record.totalMatchPoints;
      existing.officialSharePoints += officialShare;
      existing.signedErrors.push(perRobotDelta);
      existing.absoluteErrors.push(Math.abs(perRobotDelta));
      buckets.set(scoutName, existing);
    });
  });

  return Array.from(buckets.values())
    .map<ScoutCalibrationRow>(bucket => {
      const averageOfficialMinusScout = mean(bucket.signedErrors);
      const averageAbsoluteError = mean(bucket.absoluteErrors);
      return {
        scoutName: bucket.scoutName,
        assignedScoutName: bucket.assignedScoutName,
        rows: bucket.rows,
        matches: bucket.matchKeys.size,
        totalScoutedPoints: bucket.totalScoutedPoints,
        officialSharePoints: bucket.officialSharePoints,
        averageOfficialMinusScout,
        averageAbsoluteError,
        biasLabel:
          Math.abs(averageOfficialMinusScout) < 2
            ? 'balanced'
            : averageOfficialMinusScout > 0
              ? 'under-counting'
              : 'over-counting'
      };
    })
    .sort((left, right) => right.averageAbsoluteError - left.averageAbsoluteError || left.scoutName.localeCompare(right.scoutName));
};

export const buildDefenseAttributions = (
  v4Records: MatchScoutingV4[],
  expectedLookup: Record<string, number>
): DefenseAttributionRecord[] => {
  const recordsByMatchTeam = new Map<string, MatchScoutingV4>();
  v4Records.forEach(record => recordsByMatchTeam.set(`${record.matchKey}:${record.teamNumber}`, record));

  const candidateGroups = new Map<string, Array<{
    record: MatchScoutingV4;
    targetTeamNumber: string;
    defenderTeamNumber: string;
    targetRecord: MatchScoutingV4 | undefined;
    expectedTargetPoints: number;
    actualTargetPoints: number;
    intensity: number;
  }>>();

  v4Records
    .filter(record => record.defendedTeamNumber || record.defenderFacedTeamNumber)
    .forEach(record => {
      const targetTeamNumber = record.defendedTeamNumber || record.teamNumber;
      const defenderTeamNumber = record.defendedTeamNumber ? record.teamNumber : record.defenderFacedTeamNumber;
      if (!targetTeamNumber || !defenderTeamNumber || targetTeamNumber === defenderTeamNumber) return;

      const targetRecord = recordsByMatchTeam.get(`${record.matchKey}:${targetTeamNumber}`);
      const expectedTargetPoints = expectedLookup[targetTeamNumber] ?? 0;
      const actualTargetPoints = targetRecord?.totalMatchPoints ?? expectedTargetPoints;
      const intensity = Math.max(0.05, Math.min(1, record.defenseIntensity || 0));
      const groupKey = `${record.matchKey}:${targetTeamNumber}`;
      const group = candidateGroups.get(groupKey) || [];
      group.push({
        record,
        targetTeamNumber,
        defenderTeamNumber,
        targetRecord,
        expectedTargetPoints,
        actualTargetPoints,
        intensity
      });
      candidateGroups.set(groupKey, group);
    });

  return Array.from(candidateGroups.values()).flatMap(group => {
    const totalIntensity = group.reduce((sum, candidate) => sum + candidate.intensity, 0) || group.length || 1;
    const groupExpectedPoints = Math.max(...group.map(candidate => candidate.expectedTargetPoints), 0);
    const groupActualPoints = Math.min(...group.map(candidate => candidate.actualTargetPoints));
    const directPointsDenied = Math.max(0, groupExpectedPoints - groupActualPoints);
    const hasTargetRecord = group.some(candidate => candidate.targetRecord);

    return group.map(candidate => {
      const intensityShare = candidate.intensity / totalIntensity;
      const pointsDenied = hasTargetRecord
        ? directPointsDenied * intensityShare
        : candidate.expectedTargetPoints * candidate.intensity * 0.35;
      const ambiguityPenalty = group.length > 1 ? 0.12 : 0;
      const confidence = Math.max(
        0.05,
        Math.min(1, 0.2 + candidate.intensity * 0.3 + (hasTargetRecord ? 0.35 : 0) - ambiguityPenalty)
      );

      return {
        id: `${candidate.record.matchKey}_${candidate.defenderTeamNumber}_${candidate.targetTeamNumber}`,
        eventKey: candidate.record.eventKey,
        matchKey: candidate.record.matchKey,
        targetTeamNumber: candidate.targetTeamNumber,
        defenderTeamNumber: candidate.defenderTeamNumber,
        expectedTargetPoints: candidate.expectedTargetPoints,
        actualTargetPoints: candidate.actualTargetPoints,
        pointsDenied,
        confidence,
        source: hasTargetRecord ? 'calibrated' as const : 'scouted' as const
      };
    });
  });
};

export const buildDefenseImpactLookup = (records: DefenseAttributionRecord[]) => {
  const buckets = new Map<string, DefenseAttributionRecord[]>();
  records.forEach(record => {
    const bucket = buckets.get(record.defenderTeamNumber) || [];
    bucket.push(record);
    buckets.set(record.defenderTeamNumber, bucket);
  });

  return Object.fromEntries(
    Array.from(buckets.entries()).map(([team, teamRecords]) => [
      team,
      mean(teamRecords.map(record => record.pointsDenied * record.confidence))
    ])
  );
};

export const buildScoutedBonusMetricLookup = (
  v3Records: MatchScoutingV3[],
  v4Records: MatchScoutingV4[]
): Record<string, { towerMetric: number; fuelMetric: number }> => {
  const buckets = new Map<string, Array<{ towerMetric: number; fuelMetric: number }>>();
  const add = (teamNumber: string, metrics: { towerMetric: number; fuelMetric: number }) => {
    const bucket = buckets.get(teamNumber) || [];
    bucket.push(metrics);
    buckets.set(teamNumber, bucket);
  };

  v3Records
    .filter(record => record.matchType === 'Qualification')
    .forEach(record => add(record.teamNumber, {
      towerMetric: 0,
      fuelMetric: record.autoPoints + record.teleopPoints
    }));

  v4Records
    .filter(record => record.matchType === 'Qualification')
    .forEach(record => add(record.teamNumber, {
      towerMetric: record.endgamePoints,
      fuelMetric: record.autoPoints + record.teleopPoints
    }));

  return Object.fromEntries(
    Array.from(buckets.entries()).map(([teamNumber, rows]) => [
      teamNumber,
      {
        towerMetric: mean(rows.map(row => row.towerMetric)),
        fuelMetric: mean(rows.map(row => row.fuelMetric))
      }
    ])
  );
};

const formatBestPlanText = (option: StrategyRoleOption, swing: number) =>
  option.defenderTeamNumber
    ? `${option.defenderTeamNumber} defends; net swing ${swing.toFixed(1)}`
    : 'All offense; defense costs more than it saves';

export const buildStrategyMatchPlans = (
  matches: TBAMatch[],
  ratings: Record<string, number>,
  defenseImpactLookup: Record<string, number>,
  bonusMetricLookup: Record<string, { towerMetric: number; fuelMetric: number }> = {},
  forecastLayer?: {
    modelName: string;
    modelSource: string;
    forecasts: Record<string, { redScore: number; blueScore: number; lowConfidence: boolean }>;
  }
): StrategyMatchPlan[] =>
  matches
    .filter(match =>
      !isPlayedMatch(match) &&
      match.alliances.red.team_keys.length > 0 &&
      match.alliances.blue.team_keys.length > 0
    )
    .map(match => {
      const redTeams = match.alliances.red.team_keys.map(normalizeTeamKey);
      const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamKey);
      const isQualification = match.comp_level === 'qm';
      const forecast = forecastLayer?.forecasts[match.key];
      const baselineRedScore = forecast?.redScore ?? scoreAlliance(redTeams, ratings);
      const baselineBlueScore = forecast?.blueScore ?? scoreAlliance(blueTeams, ratings);

      const buildRoleOptions = (
        alliance: 'Red' | 'Blue',
        ownTeams: string[],
        ownBaseline: number,
        opponentBaseline: number
      ): StrategyRoleOption[] => {
        const allOffense: StrategyRoleOption = {
          alliance,
          label: 'All offense',
          defenderTeamNumber: '',
          ownScore: ownBaseline,
          opponentScore: opponentBaseline,
          netMargin: ownBaseline - opponentBaseline,
          offenseCost: 0,
          defenseValue: 0,
          recommended: false,
          rationale: 'Keep all three robots scoring.'
        };

        const defenderOptions = ownTeams.map(team => {
          const offenseCost = ratings[team] ?? 0;
          const defenseValue = defenseImpactLookup[team] ?? 0;
          const ownScore = Math.max(0, ownBaseline - offenseCost);
          const opponentScore = Math.max(0, opponentBaseline - defenseValue);
          const netSwing = defenseValue - offenseCost;
          return {
            alliance,
            label: `${team} defends`,
            defenderTeamNumber: team,
            ownScore,
            opponentScore,
            netMargin: ownScore - opponentScore,
            offenseCost,
            defenseValue,
            recommended: false,
            rationale:
              defenseValue > offenseCost
                ? `Defense gains ${netSwing.toFixed(1)} net points before opponent counter-play.`
                : `Defense costs ${Math.abs(netSwing).toFixed(1)} net points before opponent counter-play.`
          };
        });

        const options = [allOffense, ...defenderOptions].sort((left, right) =>
          right.netMargin - left.netMargin ||
          right.defenseValue - left.defenseValue ||
          left.offenseCost - right.offenseCost
        );
        return options.map((option, index) => ({
          ...option,
          recommended: index === 0
        }));
      };

      const redRoleOptions = buildRoleOptions('Red', redTeams, baselineRedScore, baselineBlueScore);
      const blueRoleOptions = buildRoleOptions('Blue', blueTeams, baselineBlueScore, baselineRedScore);
      const bestRedOption = redRoleOptions[0];
      const bestBlueOption = blueRoleOptions[0];
      const redDefenseSwing = bestRedOption.defenseValue - bestRedOption.offenseCost;
      const blueDefenseSwing = bestBlueOption.defenseValue - bestBlueOption.offenseCost;
      const optimizedRedScore = Math.max(0, baselineRedScore - bestRedOption.offenseCost - bestBlueOption.defenseValue);
      const optimizedBlueScore = Math.max(0, baselineBlueScore - bestBlueOption.offenseCost - bestRedOption.defenseValue);
      const predictedWinner: StrategyMatchPlan['predictedWinner'] =
        optimizedRedScore === optimizedBlueScore ? 'Tie' : optimizedRedScore > optimizedBlueScore ? 'Red' : 'Blue';
      const missingTeams = [...redTeams, ...blueTeams].filter(team => !(team in ratings));
      const predictedMargin = optimizedRedScore - optimizedBlueScore;
      const anyDefenseRecommended = !!bestRedOption.defenderTeamNumber || !!bestBlueOption.defenderTeamNumber;
      const buildRpPath = (
        alliance: 'Red' | 'Blue',
        teams: string[],
        isWinner: boolean,
        ownBestOption: StrategyRoleOption,
        opponentBestOption: StrategyRoleOption
      ): StrategyAllianceRpPath => {
        if (!isQualification) {
          return {
            alliance,
            projectedRp: 0,
            winRp: 0,
            towerRp: 0,
            energizedRp: 0,
            superchargedRp: 0,
            towerMetric: 0,
            fuelMetric: 0,
            missingComponentTeams: [],
            note: 'Ranking points are only modeled for qualification matches.'
          };
        }

        const missingComponentTeams = teams.filter(team => !(team in bonusMetricLookup));
        const rawTowerMetric = sumAllianceBonusMetric(teams, bonusMetricLookup, 'towerMetric');
        const rawFuelMetric = sumAllianceBonusMetric(teams, bonusMetricLookup, 'fuelMetric');
        const projectedTowerMetric = Math.max(0, rawTowerMetric);
        const projectedFuelMetric = Math.max(0, rawFuelMetric - ownBestOption.offenseCost - opponentBestOption.defenseValue);
        const rpBreakdown = rebuilt2026GameAdapter.calculateRankingPoints(isWinner, {
          towerMetric: projectedTowerMetric,
          fuelMetric: projectedFuelMetric
        });
        const componentSource =
          missingComponentTeams.length === 0
            ? 'uses scouted component averages'
            : `${missingComponentTeams.length} team${missingComponentTeams.length === 1 ? '' : 's'} missing component averages`;

        return {
          alliance,
          projectedRp: rpBreakdown.totalRp,
          winRp: rpBreakdown.winRp,
          towerRp: rpBreakdown.towerRp,
          energizedRp: rpBreakdown.energizedRp,
          superchargedRp: rpBreakdown.superchargedRp,
          towerMetric: projectedTowerMetric,
          fuelMetric: projectedFuelMetric,
          missingComponentTeams,
          note: `${rebuilt2026GameAdapter.label}; ${componentSource}.`
        };
      };
      const redRpPath = buildRpPath('Red', redTeams, predictedWinner === 'Red', bestRedOption, bestBlueOption);
      const blueRpPath = buildRpPath('Blue', blueTeams, predictedWinner === 'Blue', bestBlueOption, bestRedOption);
      const bestRedPlan = formatBestPlanText(bestRedOption, redDefenseSwing);
      const bestBluePlan = formatBestPlanText(bestBlueOption, blueDefenseSwing);
      const opponentCounterStrategy =
        predictedWinner === 'Red'
          ? `Blue counter: ${bestBluePlan}. Red should protect its highest-output scorer and avoid giving away foul/RP leakage.`
          : predictedWinner === 'Blue'
            ? `Red counter: ${bestRedPlan}. Blue should protect its highest-output scorer and avoid giving away foul/RP leakage.`
            : 'Both alliances are modeled even; expect the counter-strategy to be role denial, clean driving, and preserving bonus RP paths.';

      return {
        matchKey: match.key,
        matchNumber: match.match_number,
        matchType: match.comp_level === 'pm' ? 'Practice' as const : 'Qualification' as const,
        compLevel: match.comp_level,
        modelName: forecastLayer?.modelName || 'Selected Team Rating',
        modelSource: forecastLayer?.modelSource || 'Current selected team-rating model',
        modelLowConfidence: forecast?.lowConfidence ?? missingTeams.length > 0,
        redTeams,
        blueTeams,
        baselineRedScore,
        baselineBlueScore,
        optimizedRedScore,
        optimizedBlueScore,
        redDefenseSwing,
        blueDefenseSwing,
        bestRedPlan,
        bestBluePlan,
        redRoleOptions,
        blueRoleOptions,
        predictedWinner,
        predictedMargin,
        confidence: Math.max(0.25, Math.min(0.95, 1 - missingTeams.length / 6 + Math.min(0.15, Math.abs(predictedMargin) / 120))),
        redRpPath,
        blueRpPath,
        opponentCounterStrategy,
        riskFlags: [
          missingTeams.length ? `${missingTeams.length} teams missing selected-model data` : '',
          forecast?.lowConfidence ? `${forecastLayer?.modelName || 'Forecast'} is low confidence` : '',
          [...redRpPath.missingComponentTeams, ...blueRpPath.missingComponentTeams].length ? 'RP path has missing component averages' : '',
          !isQualification ? 'Non-qualification match; RP path not applied' : '',
          Math.abs(predictedMargin) < 8 ? 'Close match; role execution matters' : '',
          anyDefenseRecommended ? 'Defense changes the model outcome; verify roles with drive team' : ''
        ].filter(Boolean),
        winCondition:
          predictedWinner === 'Tie'
            ? 'Win condition: prevent penalties and chase bonus RP.'
            : `Win condition for ${predictedWinner}: protect scoring floor, avoid foul leakage, and only send defense when the modeled net swing stays positive.`
      };
    })
    .sort((left, right) => left.matchNumber - right.matchNumber);

export const optimizeScoutAssignments = (
  eventKey: string,
  matches: TBAMatch[],
  scoutNames: string[],
  ownTeamNumber: string
): ScoutAssignmentPlan => {
  const activeScouts = scoutNames.map(name => name.trim()).filter(Boolean);
  const exposureCounts: Record<string, Record<string, number>> = Object.fromEntries(activeScouts.map(name => [name, {}]));
  const assignments: ScoutAssignmentPlan['assignments'] = [];
  const coverageGaps: NonNullable<ScoutAssignmentPlan['coverageGaps']> = [];
  const scoutLoad: Record<string, number> = Object.fromEntries(activeScouts.map(name => [name, 0]));
  const getStationPriority = (station: string) => {
    const match = station.match(/(Red|Blue)\s+(\d+)/);
    if (!match) return 99;
    const allianceOffset = match[1] === 'Red' ? 0 : 3;
    return allianceOffset + Number(match[2]) - 1;
  };
  const selectStations = (stations: Array<{ station: string; teamNumber: string }>) => {
    if (activeScouts.length >= stations.length) return stations;
    return [...stations]
      .sort((left, right) => {
        const ownTeamDelta = Number(right.teamNumber === ownTeamNumber) - Number(left.teamNumber === ownTeamNumber);
        if (ownTeamDelta !== 0) return ownTeamDelta;
        const leftRepeat = Math.max(0, ...activeScouts.map(name => exposureCounts[name][left.teamNumber] || 0));
        const rightRepeat = Math.max(0, ...activeScouts.map(name => exposureCounts[name][right.teamNumber] || 0));
        if (leftRepeat !== rightRepeat) return rightRepeat - leftRepeat;
        return getStationPriority(left.station) - getStationPriority(right.station);
      })
      .slice(0, activeScouts.length)
      .sort((left, right) => getStationPriority(left.station) - getStationPriority(right.station));
  };
  const sortedMatches = [...matches]
    .filter(match => match.comp_level === 'qm' || match.comp_level === 'pm')
    .sort((left, right) => {
      const leftTeams = [...left.alliances.red.team_keys, ...left.alliances.blue.team_keys].map(normalizeTeamKey);
      const rightTeams = [...right.alliances.red.team_keys, ...right.alliances.blue.team_keys].map(normalizeTeamKey);
      const ownDiff = Number(rightTeams.includes(ownTeamNumber)) - Number(leftTeams.includes(ownTeamNumber));
      if (ownDiff !== 0) return ownDiff;
      return left.match_number - right.match_number;
    });

  sortedMatches.forEach(match => {
    const usedScoutsThisMatch = new Set<string>();
    const stations = [
      ...match.alliances.red.team_keys.map((teamKey, index) => ({ station: `Red ${index + 1}`, teamNumber: normalizeTeamKey(teamKey) })),
      ...match.alliances.blue.team_keys.map((teamKey, index) => ({ station: `Blue ${index + 1}`, teamNumber: normalizeTeamKey(teamKey) }))
    ];
    const selectedSlots = selectStations(stations);
    const selectedStations = new Set(selectedSlots.map(slot => slot.station));
    const gapReason = activeScouts.length === 0
      ? 'No scout roster provided'
      : `Only ${activeScouts.length} scout${activeScouts.length === 1 ? '' : 's'} available for six stations`;

    stations
      .filter(slot => !selectedStations.has(slot.station))
      .forEach(slot => {
        coverageGaps.push({
          matchKey: match.key,
          matchNumber: match.match_number,
          matchType: match.comp_level === 'pm' ? 'Practice' : 'Qualification',
          station: slot.station,
          teamNumber: slot.teamNumber,
          reason: gapReason
        });
      });

    selectedSlots.forEach(slot => {
      const scoutName = activeScouts
        .filter(name => !usedScoutsThisMatch.has(name))
        .map(name => ({
          name,
          repeats: exposureCounts[name][slot.teamNumber] || 0,
          load: scoutLoad[name] || 0
        }))
        .sort((left, right) => right.repeats - left.repeats || left.load - right.load || left.name.localeCompare(right.name))[0]?.name;
      if (!scoutName) {
        coverageGaps.push({
          matchKey: match.key,
          matchNumber: match.match_number,
          matchType: match.comp_level === 'pm' ? 'Practice' : 'Qualification',
          station: slot.station,
          teamNumber: slot.teamNumber,
          reason: 'No unused scout remained for this station'
        });
        return;
      }
      usedScoutsThisMatch.add(scoutName);
      exposureCounts[scoutName][slot.teamNumber] = (exposureCounts[scoutName][slot.teamNumber] || 0) + 1;
      scoutLoad[scoutName] += 1;
      assignments.push({
        matchKey: match.key,
        matchNumber: match.match_number,
        matchType: match.comp_level === 'pm' ? 'Practice' : 'Qualification',
        station: slot.station,
        teamNumber: slot.teamNumber,
        scoutName,
        priorityReason: ownTeamNumber && [...match.alliances.red.team_keys, ...match.alliances.blue.team_keys].map(normalizeTeamKey).includes(ownTeamNumber)
          ? 'Our match priority'
          : 'Repeated exposure optimization'
      });
    });
  });

  assignments.sort((left, right) =>
    left.matchNumber - right.matchNumber ||
    left.matchKey.localeCompare(right.matchKey) ||
    getStationPriority(left.station) - getStationPriority(right.station)
  );

  return {
    id: `${eventKey}_${Date.now()}`,
    eventKey,
    createdAt: Date.now(),
    scoutNames: activeScouts,
    scoutCount: activeScouts.length,
    ownTeamNumber,
    assignments,
    coverageGaps,
    exposureCounts
  };
};

export const buildAlliancePickRecommendations = (
  profiles: TeamPerformanceProfile[],
  allianceSeed: number,
  pickedTeamStatuses: Record<string, { status: AlliancePickRecommendation['status']; pickedBy?: string }>,
  ownTeamNumber: string
): AlliancePickRecommendation[] => {
  const seedRisk = Math.min(1, Math.max(0, (allianceSeed - 1) / 7));

  return profiles
    .filter(profile => profile.teamNumber !== ownTeamNumber)
    .map(profile => {
      const status = pickedTeamStatuses[profile.teamNumber]?.status || 'available';
      const highFloorScore = (profile.lowestNonZeroScore ?? profile.averageScore) + profile.averageScore - profile.standardDeviation;
      const upsetScore = profile.peakScore + profile.volatility * 20 + (profile.defenseImpact ?? 0);
      const score = highFloorScore * (1 - seedRisk) + upsetScore * seedRisk + profile.reliability * 10;

      return {
        teamNumber: profile.teamNumber,
        score,
        seedFit: allianceSeed <= 2 ? 'Floor + reliability' : allianceSeed >= 7 ? 'Upset peak + volatility' : 'Balanced value',
        roleFit: (profile.defenseImpact ?? 0) > profile.averageScore * 0.25 ? 'Defense/specialist upside' : 'Primary scoring fit',
        rationale: `Avg ${profile.averageScore.toFixed(1)}, Peak ${profile.peakScore.toFixed(1)}, SD ${profile.standardDeviation.toFixed(1)}, Defense ${(profile.defenseImpact ?? 0).toFixed(1)}.`,
        status,
        pickedBy: pickedTeamStatuses[profile.teamNumber]?.pickedBy
      };
    })
    .sort((left, right) => {
      if (left.status === 'available' && right.status !== 'available') return -1;
      if (left.status !== 'available' && right.status === 'available') return 1;
      return right.score - left.score;
    });
};
