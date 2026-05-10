import { TBAMatch, TBAScoreBreakdownAlliance } from './mathEngine';

export interface TBAEventSummary {
  key: string;
  name: string;
  playoff_type?: number | null;
  playoff_type_string?: string | null;
}

export interface TBAEliminationAlliance {
  name?: string;
  picks: string[];
  declines: string[];
  backup?: {
    in: string;
    out: string;
  } | null;
}

export interface PredictorModelSummary {
  label: string;
  calibrationMatches: number;
  winnerAccuracy: number;
  meanAbsoluteError: number;
}

export interface PredictedAllianceSide {
  label: string;
  seed?: number | null;
  teamKeys: string[];
  score: number | null;
  actualScore: number | null;
  isBye?: boolean;
}

export interface PredictedMatchRow {
  id: string;
  matchKey: string;
  title: string;
  scheduledTime: number | null;
  red: PredictedAllianceSide;
  blue: PredictedAllianceSide;
  predictedWinner: 'red' | 'blue' | null;
  predictedWinnerLabel: string;
  confidence: number | null;
  status: 'played' | 'predicted' | 'pending' | 'bye' | 'if-necessary';
}

export interface CompletedMatchComparisonRow {
  id: string;
  matchKey: string;
  title: string;
  phase: 'qualification' | 'playoff';
  compLevel: string;
  matchNumber: number;
  scheduledTime: number | null;
  redLabel: string;
  blueLabel: string;
  redTeamKeys: string[];
  blueTeamKeys: string[];
  predictedRedScore: number;
  predictedBlueScore: number;
  actualRedScore: number;
  actualBlueScore: number;
  predictedWinnerLabel: string;
  predictedWinnerScore: number;
  predictedLoserLabel: string;
  predictedLoserScore: number;
  actualWinnerLabel: string;
  actualWinnerScore: number;
  actualLoserLabel: string;
  actualLoserScore: number;
  winnerPickCorrect: boolean | null;
  scoreDeltaWinner: number;
  scoreDeltaLoser: number;
  absoluteErrorMean: number;
  predictedTie: boolean;
  actualTie: boolean;
}

export interface PlayoffProjection {
  supported: boolean;
  alliancesAvailable: boolean;
  reason?: string;
  rounds: Array<{
    title: string;
    matches: PredictedMatchRow[];
  }>;
  champion: PredictedAllianceSide | null;
  finalist: PredictedAllianceSide | null;
}

export type QualificationModel = 'epa' | 'oprc' | 'opr';

export interface QualificationBonusMetrics {
  fuelEPA: number;
  towerEPA: number;
}

export interface ProjectedQualificationTeamRow {
  projectedRank: number;
  teamNumber: string;
  currentTbaRank: number | null;
  projectedTotalRp: number;
  projectedWinRp: number;
  projectedTowerRp: number;
  projectedEnergizedRp: number;
  projectedSuperchargedRp: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface QualificationProjectionSummary {
  activeModelLabel: string;
  leader: ProjectedQualificationTeamRow | null;
  totalTeams: number;
}

export interface QualificationProjectionResult {
  rows: ProjectedQualificationTeamRow[];
  summary: QualificationProjectionSummary;
}

interface ResolvedAlliance {
  label: string;
  seed?: number | null;
  teamKeys: string[];
}

interface ResolvedMatchSides {
  red: ResolvedAlliance | null;
  blue: ResolvedAlliance | null;
}

interface ResolvedPlayoffNode {
  card: PredictedMatchRow;
  winner: ResolvedAlliance | null;
  loser: ResolvedAlliance | null;
}

type PlayoffSource =
  | { type: 'seed'; seed: number }
  | { type: 'winner'; nodeId: string }
  | { type: 'loser'; nodeId: string };

interface PlayoffNodeDefinition {
  id: string;
  title: string;
  roundTitle: string;
  compLevel: 'sf' | 'f';
  setNumber: number;
  matchNumber: number;
  redSource: PlayoffSource;
  blueSource: PlayoffSource;
  ifNecessary?: boolean;
}

const PLAYOFF_NODE_DEFINITIONS: PlayoffNodeDefinition[] = [
  { id: 'sf1', title: 'M1', roundTitle: 'Upper Bracket - Round 1', compLevel: 'sf', setNumber: 1, matchNumber: 1, redSource: { type: 'seed', seed: 1 }, blueSource: { type: 'seed', seed: 8 } },
  { id: 'sf2', title: 'M2', roundTitle: 'Upper Bracket - Round 1', compLevel: 'sf', setNumber: 2, matchNumber: 1, redSource: { type: 'seed', seed: 4 }, blueSource: { type: 'seed', seed: 5 } },
  { id: 'sf3', title: 'M3', roundTitle: 'Upper Bracket - Round 1', compLevel: 'sf', setNumber: 3, matchNumber: 1, redSource: { type: 'seed', seed: 2 }, blueSource: { type: 'seed', seed: 7 } },
  { id: 'sf4', title: 'M4', roundTitle: 'Upper Bracket - Round 1', compLevel: 'sf', setNumber: 4, matchNumber: 1, redSource: { type: 'seed', seed: 3 }, blueSource: { type: 'seed', seed: 6 } },
  { id: 'sf5', title: 'M5', roundTitle: 'Lower Bracket - Round 2', compLevel: 'sf', setNumber: 5, matchNumber: 1, redSource: { type: 'loser', nodeId: 'sf2' }, blueSource: { type: 'loser', nodeId: 'sf1' } },
  { id: 'sf6', title: 'M6', roundTitle: 'Lower Bracket - Round 2', compLevel: 'sf', setNumber: 6, matchNumber: 1, redSource: { type: 'loser', nodeId: 'sf4' }, blueSource: { type: 'loser', nodeId: 'sf3' } },
  { id: 'sf7', title: 'M7', roundTitle: 'Upper Bracket - Round 2', compLevel: 'sf', setNumber: 7, matchNumber: 1, redSource: { type: 'winner', nodeId: 'sf2' }, blueSource: { type: 'winner', nodeId: 'sf1' } },
  { id: 'sf8', title: 'M8', roundTitle: 'Upper Bracket - Round 2', compLevel: 'sf', setNumber: 8, matchNumber: 1, redSource: { type: 'winner', nodeId: 'sf4' }, blueSource: { type: 'winner', nodeId: 'sf3' } },
  { id: 'sf9', title: 'M9', roundTitle: 'Lower Bracket - Round 3', compLevel: 'sf', setNumber: 9, matchNumber: 1, redSource: { type: 'winner', nodeId: 'sf6' }, blueSource: { type: 'loser', nodeId: 'sf7' } },
  { id: 'sf10', title: 'M10', roundTitle: 'Lower Bracket - Round 3', compLevel: 'sf', setNumber: 10, matchNumber: 1, redSource: { type: 'winner', nodeId: 'sf5' }, blueSource: { type: 'loser', nodeId: 'sf8' } },
  { id: 'sf11', title: 'M11', roundTitle: 'Upper Bracket - Round 4', compLevel: 'sf', setNumber: 11, matchNumber: 1, redSource: { type: 'winner', nodeId: 'sf8' }, blueSource: { type: 'winner', nodeId: 'sf7' } },
  { id: 'sf12', title: 'M12', roundTitle: 'Lower Bracket - Round 4', compLevel: 'sf', setNumber: 12, matchNumber: 1, redSource: { type: 'winner', nodeId: 'sf9' }, blueSource: { type: 'winner', nodeId: 'sf10' } },
  { id: 'sf13', title: 'M13', roundTitle: 'Lower Bracket - Round 5', compLevel: 'sf', setNumber: 13, matchNumber: 1, redSource: { type: 'winner', nodeId: 'sf12' }, blueSource: { type: 'loser', nodeId: 'sf11' } },
  { id: 'f1', title: 'Finals 1', roundTitle: 'Finals', compLevel: 'f', setNumber: 1, matchNumber: 1, redSource: { type: 'winner', nodeId: 'sf13' }, blueSource: { type: 'winner', nodeId: 'sf11' } },
  { id: 'f2', title: 'Finals 2', roundTitle: 'Finals', compLevel: 'f', setNumber: 1, matchNumber: 2, redSource: { type: 'winner', nodeId: 'sf13' }, blueSource: { type: 'winner', nodeId: 'sf11' } },
  { id: 'f3', title: 'Finals 3', roundTitle: 'Finals', compLevel: 'f', setNumber: 1, matchNumber: 3, redSource: { type: 'winner', nodeId: 'sf13' }, blueSource: { type: 'winner', nodeId: 'sf11' }, ifNecessary: true }
];

const isPlayedMatch = (match: TBAMatch) =>
  match.alliances.red.score !== -1 && match.alliances.blue.score !== -1;

const normalizeTeamKey = (teamKey: string) => teamKey.replace('frc', '');

const getScheduledTimestamp = (match: TBAMatch) =>
  match.actual_time ?? match.predicted_time ?? match.time ?? null;

const getMatchTitle = (match: TBAMatch) => {
  if (match.comp_level === 'qm') {
    return `QM ${match.match_number}`;
  }
  if (match.comp_level === 'f') {
    return `Finals ${match.match_number}`;
  }
  if (match.comp_level === 'sf' && match.set_number) {
    return `M${match.set_number}`;
  }
  return `${match.comp_level.toUpperCase()} ${match.match_number}`;
};

const sumOprc = (
  teamKeys: string[],
  ratings: Record<string, number>
) => teamKeys.reduce((sum, teamKey) => sum + (ratings[normalizeTeamKey(teamKey)] ?? 0), 0);

const getPredictionLabel = (
  winner: 'red' | 'blue' | null,
  redLabel: string,
  blueLabel: string
) =>
  winner === 'red'
    ? redLabel
    : winner === 'blue'
      ? blueLabel
      : 'Too Close to Call';

const pickWinnerColor = (
  redScore: number,
  blueScore: number,
  redSeed?: number | null,
  blueSeed?: number | null
): 'red' | 'blue' => {
  if (redScore > blueScore) return 'red';
  if (blueScore > redScore) return 'blue';

  if (redSeed != null && blueSeed != null) {
    return redSeed < blueSeed ? 'red' : 'blue';
  }

  return 'red';
};

const getActualWinnerColor = (match: TBAMatch): 'red' | 'blue' | null => {
  if (match.winning_alliance === 'red' || match.winning_alliance === 'blue') {
    return match.winning_alliance;
  }
  if (match.alliances.red.score > match.alliances.blue.score) return 'red';
  if (match.alliances.blue.score > match.alliances.red.score) return 'blue';
  return null;
};

const computeConfidence = (
  predictedMargin: number,
  completedMatches: TBAMatch[]
) => {
  if (!Number.isFinite(predictedMargin)) return 50;

  const actualMargins = completedMatches
    .filter(isPlayedMatch)
    .map(match => Math.abs(match.alliances.red.score - match.alliances.blue.score))
    .filter(margin => Number.isFinite(margin));

  const meanMargin = actualMargins.length > 0
    ? actualMargins.reduce((sum, margin) => sum + margin, 0) / actualMargins.length
    : 18;
  const variance = actualMargins.length > 1
    ? actualMargins.reduce((sum, margin) => sum + Math.pow(margin - meanMargin, 2), 0) / actualMargins.length
    : Math.pow(meanMargin, 2);
  const scale = Math.max(8, Math.sqrt(variance) || meanMargin || 18);

  let confidence = 50 + (1 - Math.exp(-Math.abs(predictedMargin) / scale)) * 44;

  if (completedMatches.length < 6) {
    confidence = Math.min(confidence, 74);
  } else if (completedMatches.length < 12) {
    confidence = Math.min(confidence, 84);
  } else {
    confidence = Math.min(confidence, 94);
  }

  return Math.round(confidence);
};

interface ResolvedPrediction {
  redScore: number;
  blueScore: number;
  predictedWinner: 'red' | 'blue' | null;
  confidence: number | null;
}

const getRatingsPrediction = (
  redTeamKeys: string[],
  blueTeamKeys: string[],
  completedMatches: TBAMatch[],
  ratings: Record<string, number>,
  redSeed?: number | null,
  blueSeed?: number | null,
  forceNoConfidence: boolean = false
): ResolvedPrediction => {
  const redScore = sumOprc(redTeamKeys, ratings);
  const blueScore = sumOprc(blueTeamKeys, ratings);
  const predictedWinner = Math.abs(redScore - blueScore) < 0.01
    ? null
    : pickWinnerColor(redScore, blueScore, redSeed, blueSeed);

  return {
    redScore,
    blueScore,
    predictedWinner,
    confidence: forceNoConfidence || !predictedWinner ? null : computeConfidence(redScore - blueScore, completedMatches)
  };
};

const getSourceLabel = (source: PlayoffSource) => {
  switch (source.type) {
    case 'seed':
      return `Alliance ${source.seed}`;
    case 'winner':
      return `Winner ${source.nodeId.toUpperCase()}`;
    case 'loser':
      return `Loser ${source.nodeId.toUpperCase()}`;
  }
};

const getAllianceTeamKeys = (alliance: TBAEliminationAlliance | null | undefined) => {
  if (!alliance) return [];

  const teamKeys = [...alliance.picks];
  if (alliance.backup?.in && alliance.backup?.out) {
    const replacedIndex = teamKeys.findIndex(teamKey => teamKey === alliance.backup?.out);
    if (replacedIndex >= 0) {
      teamKeys[replacedIndex] = alliance.backup.in;
    } else {
      teamKeys.push(alliance.backup.in);
    }
  }

  return teamKeys.map(normalizeTeamKey);
};

const hasPublishedTeams = (match?: TBAMatch) =>
  !!match && (match.alliances.red.team_keys.length > 0 || match.alliances.blue.team_keys.length > 0);

const getPublishedTeamKeys = (match: TBAMatch | undefined, color: 'red' | 'blue') =>
  match ? match.alliances[color].team_keys.map(normalizeTeamKey) : [];

const sameTeamSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every(teamKey => b.includes(teamKey));

const getOverlapCount = (publishedTeamKeys: string[], candidateTeamKeys: string[]) =>
  publishedTeamKeys.filter(teamKey => candidateTeamKeys.includes(teamKey)).length;

const getAlignmentScore = (
  publishedTeamKeys: string[],
  candidate: ResolvedAlliance | null
) => {
  if (!candidate || publishedTeamKeys.length === 0) return 0;

  const overlap = getOverlapCount(publishedTeamKeys, candidate.teamKeys);
  return sameTeamSet(publishedTeamKeys, candidate.teamKeys) ? 100 + overlap : overlap;
};

const alignPublishedSourcesToSides = (
  publishedRedTeamKeys: string[],
  publishedBlueTeamKeys: string[],
  sourceRed: ResolvedAlliance | null,
  sourceBlue: ResolvedAlliance | null
) => {
  if (!sourceRed || !sourceBlue) {
    return { redSource: sourceRed, blueSource: sourceBlue };
  }

  const identityScore =
    getAlignmentScore(publishedRedTeamKeys, sourceRed) +
    getAlignmentScore(publishedBlueTeamKeys, sourceBlue);
  const swappedScore =
    getAlignmentScore(publishedRedTeamKeys, sourceBlue) +
    getAlignmentScore(publishedBlueTeamKeys, sourceRed);

  if (swappedScore > identityScore) {
    return { redSource: sourceBlue, blueSource: sourceRed };
  }

  return { redSource: sourceRed, blueSource: sourceBlue };
};

const getAllianceIdentity = (alliance: { teamKeys: string[]; seed?: number | null; label: string } | null | undefined) => {
  if (!alliance || alliance.teamKeys.length === 0) return '';
  return [...alliance.teamKeys].sort().join('|') || `seed:${alliance.seed ?? 'na'}:${alliance.label}`;
};

const buildSeededAllianceMap = (alliances: TBAEliminationAlliance[] | null) => {
  const seededAlliances = new Map<number, ResolvedAlliance | null>();
  for (let seed = 1; seed <= 8; seed++) {
    const alliance = alliances?.[seed - 1];
    seededAlliances.set(seed, alliance ? {
      label: alliance.name || `Alliance ${seed}`,
      seed,
      teamKeys: getAllianceTeamKeys(alliance)
    } : null);
  }
  return seededAlliances;
};

const resolvePublishedPlayoffSides = (
  publishedRedTeamKeys: string[],
  publishedBlueTeamKeys: string[],
  seededAlliances: Map<number, ResolvedAlliance | null>
): ResolvedMatchSides => {
  const candidates = Array.from(seededAlliances.values()).filter((alliance): alliance is ResolvedAlliance => !!alliance);

  if (candidates.length === 0) {
    return { red: null, blue: null };
  }

  let bestPair: ResolvedMatchSides = { red: null, blue: null };
  let bestScore = 0;

  for (const redCandidate of [null, ...candidates]) {
    for (const blueCandidate of [null, ...candidates]) {
      if (redCandidate && blueCandidate && redCandidate.seed === blueCandidate.seed) {
        continue;
      }

      const score =
        getAlignmentScore(publishedRedTeamKeys, redCandidate) +
        getAlignmentScore(publishedBlueTeamKeys, blueCandidate);

      if (score > bestScore) {
        bestScore = score;
        bestPair = { red: redCandidate, blue: blueCandidate };
      }
    }
  }

  return bestPair;
};

const getMatchPhase = (match: TBAMatch): 'qualification' | 'playoff' =>
  match.comp_level === 'qm' ? 'qualification' : 'playoff';

const normalizeComparisonSides = (
  highScore: number,
  lowScore: number,
  highLabel: string,
  lowLabel: string,
  isTie: boolean
) => {
  if (isTie) {
    return {
      winnerLabel: 'Tie',
      winnerScore: highScore,
      loserLabel: 'Tie',
      loserScore: lowScore
    };
  }

  return {
    winnerLabel: highLabel,
    winnerScore: highScore,
    loserLabel: lowLabel,
    loserScore: lowScore
  };
};

export const getPredictorModelSummary = (
  completedComparisons: CompletedMatchComparisonRow[]
): PredictorModelSummary => {
  if (completedComparisons.length === 0) {
    return {
      label: 'Local OPRc',
      calibrationMatches: 0,
      winnerAccuracy: 0,
      meanAbsoluteError: 0
    };
  }

  const decisiveRows = completedComparisons.filter(row => row.winnerPickCorrect !== null);
  const correctRows = decisiveRows.filter(row => row.winnerPickCorrect).length;

  return {
    label: 'Local OPRc',
    calibrationMatches: completedComparisons.length,
    winnerAccuracy: decisiveRows.length > 0 ? correctRows / decisiveRows.length : 0,
    meanAbsoluteError:
      completedComparisons.reduce((sum, row) => sum + row.absoluteErrorMean, 0) /
      completedComparisons.length
  };
};

interface QualificationAccumulator {
  teamNumber: string;
  currentTbaRank: number | null;
  projectedTotalRp: number;
  projectedWinRp: number;
  projectedTowerRp: number;
  projectedEnergizedRp: number;
  projectedSuperchargedRp: number;
  wins: number;
  losses: number;
  ties: number;
}

interface QualificationProjectionOptions {
  matches: TBAMatch[];
  currentTbaRanks?: Record<string, number>;
  currentTbaRankOrder?: string[];
  modelLabel: string;
  overallRatings: Record<string, number>;
  qualificationBonusMetrics?: Record<string, QualificationBonusMetrics>;
}

interface QualificationRpBreakdown {
  totalRp: number;
  winRp: number;
  towerRp: number;
  energizedRp: number;
  superchargedRp: number;
}

const getNumericBreakdownValue = (
  breakdown: TBAScoreBreakdownAlliance | undefined,
  keys: string[]
) => {
  if (!breakdown) return null;

  for (const key of keys) {
    const value = breakdown[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
};

const getBooleanBreakdownValue = (
  breakdown: TBAScoreBreakdownAlliance | undefined,
  keys: string[]
) => {
  if (!breakdown) return null;

  for (const key of keys) {
    const value = breakdown[key];
    if (typeof value === 'boolean') {
      return value;
    }
  }

  return null;
};

const getActualRankingPoints = (
  match: TBAMatch,
  color: 'red' | 'blue'
): QualificationRpBreakdown => {
  const breakdown = match.score_breakdown?.[color];
  const allianceScore = match.alliances[color].score;
  const opponentScore = match.alliances[color === 'red' ? 'blue' : 'red'].score;

  let winRp = 0;
  let towerRp = 0;
  let energizedRp = 0;
  let superchargedRp = 0;
  if (allianceScore > opponentScore) {
    winRp = 3;
  }

  const towerBonus = getBooleanBreakdownValue(breakdown, [
    'tower_rp',
    'towerRp',
    'tower_bonus',
    'towerBonus',
    'traversal_rp',
    'traversalRp'
  ]);
  if (towerBonus === true) {
    towerRp = 1;
  }

  const energizedBonus = getBooleanBreakdownValue(breakdown, [
    'energized_rp',
    'energizedRp',
    'fuel_rp',
    'fuelRp'
  ]);
  if (energizedBonus === true) {
    energizedRp = 1;
  }

  const superchargedBonus = getBooleanBreakdownValue(breakdown, [
    'supercharged_rp',
    'superchargedRp'
  ]);
  if (superchargedBonus === true) {
    superchargedRp = 1;
  }

  const directRankingPoints = getNumericBreakdownValue(breakdown, [
    'ranking_points',
    'rankingPoints',
    'rp',
    'rp_total',
    'rpTotal',
    'total_rp',
    'totalRp'
  ]);

  if (towerBonus != null || energizedBonus != null || superchargedBonus != null) {
    const booleanTotal = winRp + towerRp + energizedRp + superchargedRp;
    return {
      totalRp: directRankingPoints ?? booleanTotal,
      winRp,
      towerRp,
      energizedRp,
      superchargedRp
    };
  }

  if (directRankingPoints != null) {
    return {
      totalRp: directRankingPoints,
      winRp,
      towerRp: 0,
      energizedRp: 0,
      superchargedRp: 0
    };
  }

  const towerMetric =
    getNumericBreakdownValue(breakdown, [
      'tower_epa',
      'tower_points',
      'towerPoints',
      'tower_progress',
      'towerProgress'
    ]) ??
    getNumericBreakdownValue(breakdown, ['endgame_points', 'endGamePoints']) ??
    getNumericBreakdownValue(breakdown, ['total_tower', 'tower']) ??
    0;

  const fuelMetric =
    getNumericBreakdownValue(breakdown, [
      'fuel_epa',
      'fuel_points',
      'fuelPoints',
      'fuel_progress',
      'fuelProgress',
      'total_fuel',
      'fuel'
    ]) ?? 0;

  if (towerMetric > 50) {
    towerRp = 1;
  }
  if (fuelMetric > 100) {
    energizedRp = 1;
  }
  if (fuelMetric > 360) {
    superchargedRp = 1;
  }

  return {
    totalRp: winRp + towerRp + energizedRp + superchargedRp,
    winRp,
    towerRp,
    energizedRp,
    superchargedRp
  };
};

const createQualificationAccumulator = (
  teamNumber: string,
  currentTbaRanks: Record<string, number>
): QualificationAccumulator => ({
  teamNumber,
  currentTbaRank: currentTbaRanks[teamNumber] ?? null,
  projectedTotalRp: 0,
  projectedWinRp: 0,
  projectedTowerRp: 0,
  projectedEnergizedRp: 0,
  projectedSuperchargedRp: 0,
  wins: 0,
  losses: 0,
  ties: 0
});

const applyFutureQualificationRp = (
  accumulator: QualificationAccumulator,
  bonusMetrics: QualificationBonusMetrics | null,
  isWinner: boolean
) => {
  if (isWinner) {
    accumulator.projectedWinRp += 3;
    accumulator.projectedTotalRp += 3;
    accumulator.wins += 1;
  }

  if (bonusMetrics) {
    if (bonusMetrics.towerEPA > 50) {
      accumulator.projectedTowerRp += 1;
      accumulator.projectedTotalRp += 1;
    }
    if (bonusMetrics.fuelEPA > 100) {
      accumulator.projectedEnergizedRp += 1;
      accumulator.projectedTotalRp += 1;
    }
    if (bonusMetrics.fuelEPA > 360) {
      accumulator.projectedSuperchargedRp += 1;
      accumulator.projectedTotalRp += 1;
    }
  }
};

const getQualificationTeamNumbers = (matches: TBAMatch[]) =>
  Array.from(
    new Set(
      matches
        .filter(match => match.comp_level === 'qm')
        .flatMap(match => [
          ...match.alliances.red.team_keys.map(normalizeTeamKey),
          ...match.alliances.blue.team_keys.map(normalizeTeamKey)
        ])
        .filter(teamNumber => teamNumber.length > 0)
    )
  ).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

const getCurrentRankOrderIndex = (
  teamNumber: string,
  currentTbaRankOrder: string[],
  currentTbaRanks: Record<string, number>
) => {
  const explicitOrder = currentTbaRankOrder.indexOf(teamNumber);
  if (explicitOrder >= 0) return explicitOrder;
  const rank = currentTbaRanks[teamNumber];
  if (Number.isFinite(rank)) return rank - 1;
  return Number.MAX_SAFE_INTEGER;
};

const sumBonusMetrics = (
  teamNumbers: string[],
  qualificationBonusMetrics?: Record<string, QualificationBonusMetrics>
) => {
  if (!qualificationBonusMetrics) return null;

  let fuelEPA = 0;
  let towerEPA = 0;

  for (const teamNumber of teamNumbers) {
    const metrics = qualificationBonusMetrics[teamNumber];
    if (!metrics) {
      return null;
    }
    fuelEPA += metrics.fuelEPA;
    towerEPA += metrics.towerEPA;
  }

  return { fuelEPA, towerEPA };
};

export const buildQualificationProjection = ({
  matches,
  currentTbaRanks = {},
  currentTbaRankOrder = [],
  modelLabel,
  overallRatings,
  qualificationBonusMetrics
}: QualificationProjectionOptions): QualificationProjectionResult => {
  const qualificationMatches = matches.filter(match => match.comp_level === 'qm');
  const teamNumbers = getQualificationTeamNumbers(qualificationMatches);

  const accumulators = new Map<string, QualificationAccumulator>();
  teamNumbers.forEach(teamNumber => {
    accumulators.set(teamNumber, createQualificationAccumulator(teamNumber, currentTbaRanks));
  });

  qualificationMatches.forEach(match => {
    const redTeams = match.alliances.red.team_keys.map(normalizeTeamKey);
    const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamKey);
    const isPlayed = isPlayedMatch(match);

    if (isPlayed) {
      const redRp = getActualRankingPoints(match, 'red');
      const blueRp = getActualRankingPoints(match, 'blue');

      redTeams.forEach(teamNumber => {
        const accumulator = accumulators.get(teamNumber);
        if (!accumulator) return;
        accumulator.projectedTotalRp += redRp.totalRp;
        accumulator.projectedWinRp += redRp.winRp;
        accumulator.projectedTowerRp += redRp.towerRp;
        accumulator.projectedEnergizedRp += redRp.energizedRp;
        accumulator.projectedSuperchargedRp += redRp.superchargedRp;
        if (match.alliances.red.score > match.alliances.blue.score) accumulator.wins += 1;
        else if (match.alliances.red.score < match.alliances.blue.score) accumulator.losses += 1;
        else accumulator.ties += 1;
      });

      blueTeams.forEach(teamNumber => {
        const accumulator = accumulators.get(teamNumber);
        if (!accumulator) return;
        accumulator.projectedTotalRp += blueRp.totalRp;
        accumulator.projectedWinRp += blueRp.winRp;
        accumulator.projectedTowerRp += blueRp.towerRp;
        accumulator.projectedEnergizedRp += blueRp.energizedRp;
        accumulator.projectedSuperchargedRp += blueRp.superchargedRp;
        if (match.alliances.blue.score > match.alliances.red.score) accumulator.wins += 1;
        else if (match.alliances.blue.score < match.alliances.red.score) accumulator.losses += 1;
        else accumulator.ties += 1;
      });

      return;
    }

    const redScore = redTeams.reduce((sum, teamNumber) => sum + (overallRatings[teamNumber] ?? 0), 0);
    const blueScore = blueTeams.reduce((sum, teamNumber) => sum + (overallRatings[teamNumber] ?? 0), 0);
    const redBonusMetrics = sumBonusMetrics(redTeams, qualificationBonusMetrics);
    const blueBonusMetrics = sumBonusMetrics(blueTeams, qualificationBonusMetrics);

    if (Math.abs(redScore - blueScore) < 0.01) {
      redTeams.forEach(teamNumber => {
        const accumulator = accumulators.get(teamNumber);
        if (!accumulator) return;
        accumulator.ties += 1;
        applyFutureQualificationRp(accumulator, redBonusMetrics, false);
      });
      blueTeams.forEach(teamNumber => {
        const accumulator = accumulators.get(teamNumber);
        if (!accumulator) return;
        accumulator.ties += 1;
        applyFutureQualificationRp(accumulator, blueBonusMetrics, false);
      });
      return;
    }

    const redWins = redScore > blueScore;
    redTeams.forEach(teamNumber => {
      const accumulator = accumulators.get(teamNumber);
      if (!accumulator) return;
      if (!redWins) {
        accumulator.losses += 1;
      }
      applyFutureQualificationRp(accumulator, redBonusMetrics, redWins);
    });
    blueTeams.forEach(teamNumber => {
      const accumulator = accumulators.get(teamNumber);
      if (!accumulator) return;
      if (redWins) {
        accumulator.losses += 1;
      }
      applyFutureQualificationRp(accumulator, blueBonusMetrics, !redWins);
    });
  });

  const rows = Array.from(accumulators.values())
    .sort((a, b) => {
      if (b.projectedTotalRp !== a.projectedTotalRp) {
        return b.projectedTotalRp - a.projectedTotalRp;
      }

      const aOrder = getCurrentRankOrderIndex(a.teamNumber, currentTbaRankOrder, currentTbaRanks);
      const bOrder = getCurrentRankOrderIndex(b.teamNumber, currentTbaRankOrder, currentTbaRanks);
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }

      return Number.parseInt(a.teamNumber, 10) - Number.parseInt(b.teamNumber, 10);
    })
    .map((row, index) => ({
      projectedRank: index + 1,
      teamNumber: row.teamNumber,
      currentTbaRank: row.currentTbaRank,
      projectedTotalRp: row.projectedTotalRp,
      projectedWinRp: row.projectedWinRp,
      projectedTowerRp: row.projectedTowerRp,
      projectedEnergizedRp: row.projectedEnergizedRp,
      projectedSuperchargedRp: row.projectedSuperchargedRp,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties
    }));

  return {
    rows,
    summary: {
      activeModelLabel: modelLabel,
      leader: rows[0] ?? null,
      totalTeams: rows.length
    }
  };
};

export const buildQualificationPredictions = (
  allMatches: TBAMatch[],
  localOprcRatings: Record<string, number>
): PredictedMatchRow[] => {
  const completedMatches = allMatches.filter(isPlayedMatch);

  return allMatches
    .filter(match => match.comp_level === 'qm' && !isPlayedMatch(match))
    .sort((a, b) => {
      const aTime = getScheduledTimestamp(a) ?? Number.MAX_SAFE_INTEGER;
      const bTime = getScheduledTimestamp(b) ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return a.match_number - b.match_number;
    })
    .map(match => {
      const redTeamKeys = match.alliances.red.team_keys.map(normalizeTeamKey);
      const blueTeamKeys = match.alliances.blue.team_keys.map(normalizeTeamKey);
      const resolvedPrediction = getRatingsPrediction(
        redTeamKeys,
        blueTeamKeys,
        completedMatches,
        localOprcRatings
      );

      return {
        id: match.key,
        matchKey: match.key,
        title: `QM ${match.match_number}`,
        scheduledTime: getScheduledTimestamp(match),
        red: {
          label: 'Red Alliance',
          teamKeys: redTeamKeys,
          score: Number(resolvedPrediction.redScore.toFixed(1)),
          actualScore: null
        },
        blue: {
          label: 'Blue Alliance',
          teamKeys: blueTeamKeys,
          score: Number(resolvedPrediction.blueScore.toFixed(1)),
          actualScore: null
        },
        predictedWinner: resolvedPrediction.predictedWinner,
        predictedWinnerLabel: getPredictionLabel(resolvedPrediction.predictedWinner, 'Red Alliance', 'Blue Alliance'),
        confidence: resolvedPrediction.confidence,
        status: 'predicted'
      };
    });
};

export const buildCompletedMatchComparisons = (
  allMatches: TBAMatch[],
  localOprcRatings: Record<string, number>,
  alliances: TBAEliminationAlliance[] | null,
  _eventSummary?: TBAEventSummary | null
): CompletedMatchComparisonRow[] => {
  const seededAlliances = buildSeededAllianceMap(alliances);
  const completedMatches = allMatches.filter(isPlayedMatch);

  return completedMatches
    .sort((a, b) => {
      const aTime = getScheduledTimestamp(a) ?? Number.MAX_SAFE_INTEGER;
      const bTime = getScheduledTimestamp(b) ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) {
        return aTime - bTime;
      }
      if (a.comp_level !== b.comp_level) {
        return a.comp_level === 'qm' ? -1 : 1;
      }
      return a.match_number - b.match_number;
    })
    .map(match => {
      const redTeamKeys = match.alliances.red.team_keys.map(normalizeTeamKey);
      const blueTeamKeys = match.alliances.blue.team_keys.map(normalizeTeamKey);
      const resolvedPrediction = getRatingsPrediction(
        redTeamKeys,
        blueTeamKeys,
        completedMatches,
        localOprcRatings
      );
      const predictedRedScore = Number(resolvedPrediction.redScore.toFixed(1));
      const predictedBlueScore = Number(resolvedPrediction.blueScore.toFixed(1));
      const actualRedScore = match.alliances.red.score;
      const actualBlueScore = match.alliances.blue.score;

      const phase = getMatchPhase(match);
      const publishedPlayoffSides = phase === 'playoff'
        ? resolvePublishedPlayoffSides(redTeamKeys, blueTeamKeys, seededAlliances)
        : { red: null, blue: null };

      const redLabel = publishedPlayoffSides.red?.label || 'Red Alliance';
      const blueLabel = publishedPlayoffSides.blue?.label || 'Blue Alliance';

      const predictedTie = Math.abs(predictedRedScore - predictedBlueScore) < 0.01;
      const actualTie = actualRedScore === actualBlueScore;

      const predictedRedHigher = predictedRedScore >= predictedBlueScore;
      const actualRedHigher = actualRedScore >= actualBlueScore;

      const predictedNormalized = normalizeComparisonSides(
        Math.max(predictedRedScore, predictedBlueScore),
        Math.min(predictedRedScore, predictedBlueScore),
        predictedRedHigher ? redLabel : blueLabel,
        predictedRedHigher ? blueLabel : redLabel,
        predictedTie
      );
      const actualNormalized = normalizeComparisonSides(
        Math.max(actualRedScore, actualBlueScore),
        Math.min(actualRedScore, actualBlueScore),
        actualRedHigher ? redLabel : blueLabel,
        actualRedHigher ? blueLabel : redLabel,
        actualTie
      );

      return {
        id: match.key,
        matchKey: match.key,
        title: getMatchTitle(match),
        phase,
        compLevel: match.comp_level,
        matchNumber: match.match_number,
        scheduledTime: getScheduledTimestamp(match),
        redLabel,
        blueLabel,
        redTeamKeys,
        blueTeamKeys,
        predictedRedScore,
        predictedBlueScore,
        actualRedScore,
        actualBlueScore,
        predictedWinnerLabel: predictedNormalized.winnerLabel,
        predictedWinnerScore: predictedNormalized.winnerScore,
        predictedLoserLabel: predictedNormalized.loserLabel,
        predictedLoserScore: predictedNormalized.loserScore,
        actualWinnerLabel: actualNormalized.winnerLabel,
        actualWinnerScore: actualNormalized.winnerScore,
        actualLoserLabel: actualNormalized.loserLabel,
        actualLoserScore: actualNormalized.loserScore,
        winnerPickCorrect:
          predictedTie || actualTie
            ? null
            : predictedRedHigher === actualRedHigher,
        scoreDeltaWinner: Number((actualNormalized.winnerScore - predictedNormalized.winnerScore).toFixed(1)),
        scoreDeltaLoser: Number((actualNormalized.loserScore - predictedNormalized.loserScore).toFixed(1)),
        absoluteErrorMean: Number((
          (Math.abs(actualNormalized.winnerScore - predictedNormalized.winnerScore) +
            Math.abs(actualNormalized.loserScore - predictedNormalized.loserScore)) / 2
        ).toFixed(1)),
        predictedTie,
        actualTie
      };
    });
};

export const buildPlayoffProjection = (
  alliances: TBAEliminationAlliance[] | null,
  playoffMatches: TBAMatch[],
  completedEventMatches: TBAMatch[],
  teamRatings: Record<string, number>,
  eventSummary?: TBAEventSummary | null
): PlayoffProjection => {
  if (!alliances || alliances.length === 0) {
    return {
      supported: true,
      alliancesAvailable: false,
      rounds: [],
      champion: null,
      finalist: null
    };
  }

  const playoffTypeString = eventSummary?.playoff_type_string?.toLowerCase() ?? '';
  if (playoffTypeString && !playoffTypeString.includes('double elimination')) {
    return {
      supported: false,
      alliancesAvailable: true,
      reason: `Unsupported playoff format: ${eventSummary?.playoff_type_string}`,
      rounds: [],
      champion: null,
      finalist: null
    };
  }

  const seededAlliances = buildSeededAllianceMap(alliances);

  const matchLookup = new Map<string, TBAMatch>();
  playoffMatches.forEach(match => {
    if (match.comp_level === 'sf') {
      matchLookup.set(`sf${match.set_number}`, match);
    } else if (match.comp_level === 'f') {
      matchLookup.set(`f${match.match_number}`, match);
    }
  });

  const cache = new Map<string, ResolvedPlayoffNode>();

  const resolveSource = (source: PlayoffSource): ResolvedAlliance | null => {
    if (source.type === 'seed') {
      return seededAlliances.get(source.seed) ?? null;
    }

    const resolvedNode = resolveNode(source.nodeId);
    return source.type === 'winner' ? resolvedNode.winner : resolvedNode.loser;
  };

  const resolveNode = (nodeId: string): ResolvedPlayoffNode => {
    const cached = cache.get(nodeId);
    if (cached) return cached;

    const definition = PLAYOFF_NODE_DEFINITIONS.find(node => node.id === nodeId);
    if (!definition) {
      throw new Error(`Unknown playoff node: ${nodeId}`);
    }

    const sourceRed = resolveSource(definition.redSource);
    const sourceBlue = resolveSource(definition.blueSource);
    const publishedMatch = matchLookup.get(nodeId);
    const publishedTeamsAvailable = hasPublishedTeams(publishedMatch);
    const publishedRedTeamKeys = publishedTeamsAvailable ? getPublishedTeamKeys(publishedMatch, 'red') : [];
    const publishedBlueTeamKeys = publishedTeamsAvailable ? getPublishedTeamKeys(publishedMatch, 'blue') : [];
    const alignedSources = publishedTeamsAvailable
      ? alignPublishedSourcesToSides(publishedRedTeamKeys, publishedBlueTeamKeys, sourceRed, sourceBlue)
      : { redSource: sourceRed, blueSource: sourceBlue };

    const redTeamKeys = publishedTeamsAvailable ? publishedRedTeamKeys : alignedSources.redSource?.teamKeys ?? [];
    const blueTeamKeys = publishedTeamsAvailable ? publishedBlueTeamKeys : alignedSources.blueSource?.teamKeys ?? [];

    const redAlliance: PredictedAllianceSide = {
      label: alignedSources.redSource?.label || getSourceLabel(definition.redSource),
      seed: alignedSources.redSource?.seed ?? null,
      teamKeys: redTeamKeys,
      score: null,
      actualScore: null,
      isBye: redTeamKeys.length === 0
    };
    const blueAlliance: PredictedAllianceSide = {
      label: alignedSources.blueSource?.label || getSourceLabel(definition.blueSource),
      seed: alignedSources.blueSource?.seed ?? null,
      teamKeys: blueTeamKeys,
      score: null,
      actualScore: null,
      isBye: blueTeamKeys.length === 0
    };

    let predictedWinner: 'red' | 'blue' | null = null;
    let predictedWinnerLabel = 'Pending';
    let confidence: number | null = null;
    let status: PredictedMatchRow['status'] = definition.ifNecessary ? 'if-necessary' : 'pending';
    let winner: ResolvedAlliance | null = null;
    let loser: ResolvedAlliance | null = null;

    if (redAlliance.teamKeys.length === 0 && blueAlliance.teamKeys.length > 0) {
      status = 'bye';
      predictedWinner = 'blue';
      predictedWinnerLabel = blueAlliance.label;
      winner = {
        label: blueAlliance.label,
        seed: blueAlliance.seed,
        teamKeys: blueAlliance.teamKeys
      };
      loser = null;
    } else if (blueAlliance.teamKeys.length === 0 && redAlliance.teamKeys.length > 0) {
      status = 'bye';
      predictedWinner = 'red';
      predictedWinnerLabel = redAlliance.label;
      winner = {
        label: redAlliance.label,
        seed: redAlliance.seed,
        teamKeys: redAlliance.teamKeys
      };
      loser = null;
    } else if (publishedMatch && isPlayedMatch(publishedMatch)) {
      status = 'played';
      redAlliance.actualScore = publishedMatch.alliances.red.score;
      blueAlliance.actualScore = publishedMatch.alliances.blue.score;
      redAlliance.score = publishedMatch.alliances.red.score;
      blueAlliance.score = publishedMatch.alliances.blue.score;

      predictedWinner = getActualWinnerColor(publishedMatch);
      predictedWinnerLabel = predictedWinner === 'red' ? redAlliance.label : predictedWinner === 'blue' ? blueAlliance.label : 'Tie / Replay';
      confidence = predictedWinner ? 100 : null;

      const actualRed: ResolvedAlliance = {
        label: redAlliance.label,
        seed: redAlliance.seed,
        teamKeys: redAlliance.teamKeys
      };
      const actualBlue: ResolvedAlliance = {
        label: blueAlliance.label,
        seed: blueAlliance.seed,
        teamKeys: blueAlliance.teamKeys
      };

      if (predictedWinner === 'red') {
        winner = actualRed;
        loser = actualBlue;
      } else if (predictedWinner === 'blue') {
        winner = actualBlue;
        loser = actualRed;
      }
    } else if (redAlliance.teamKeys.length > 0 && blueAlliance.teamKeys.length > 0) {
      const resolvedPrediction = getRatingsPrediction(
        redAlliance.teamKeys,
        blueAlliance.teamKeys,
        completedEventMatches,
        teamRatings,
        redAlliance.seed,
        blueAlliance.seed,
        !publishedMatch
      );

      redAlliance.score = Number(resolvedPrediction.redScore.toFixed(1));
      blueAlliance.score = Number(resolvedPrediction.blueScore.toFixed(1));
      predictedWinner = resolvedPrediction.predictedWinner;
      predictedWinnerLabel = getPredictionLabel(predictedWinner, redAlliance.label, blueAlliance.label);
      confidence = resolvedPrediction.confidence;
      status = definition.ifNecessary ? 'if-necessary' : 'predicted';

      const predictedRed: ResolvedAlliance = {
        label: redAlliance.label,
        seed: redAlliance.seed,
        teamKeys: redAlliance.teamKeys
      };
      const predictedBlue: ResolvedAlliance = {
        label: blueAlliance.label,
        seed: blueAlliance.seed,
        teamKeys: blueAlliance.teamKeys
      };

      if (predictedWinner === 'red') {
        winner = predictedRed;
        loser = predictedBlue;
      } else if (predictedWinner === 'blue') {
        winner = predictedBlue;
        loser = predictedRed;
      }
    }

    const resolvedNode: ResolvedPlayoffNode = {
      card: {
        id: definition.id,
        matchKey: publishedMatch?.key || definition.id,
        title: definition.title,
        scheduledTime: publishedMatch ? getScheduledTimestamp(publishedMatch) : null,
        red: redAlliance,
        blue: blueAlliance,
        predictedWinner,
        predictedWinnerLabel,
        confidence,
        status
      },
      winner,
      loser
    };

    cache.set(nodeId, resolvedNode);
    return resolvedNode;
  };

  const resolvedNodes = PLAYOFF_NODE_DEFINITIONS.map(definition => resolveNode(definition.id));
  const finals1 = cache.get('f1');
  const finals2 = cache.get('f2');
  const finals3 = cache.get('f3');

  const finalsParticipants = new Map<string, { label: string; seed?: number | null; teamKeys: string[] }>();
  const finalsWins = new Map<string, number>();

  [finals1, finals2].forEach(node => {
    if (!node) return;

    [node.card.red, node.card.blue].forEach(side => {
      const identity = getAllianceIdentity(side);
      if (!identity) return;
      finalsParticipants.set(identity, {
        label: side.label,
        seed: side.seed,
        teamKeys: side.teamKeys
      });
      if (!finalsWins.has(identity)) {
        finalsWins.set(identity, 0);
      }
    });

    const winnerSide =
      node.card.predictedWinner === 'red'
        ? node.card.red
        : node.card.predictedWinner === 'blue'
          ? node.card.blue
          : null;

    const winnerIdentity = getAllianceIdentity(winnerSide);
    if (winnerIdentity) {
      finalsWins.set(winnerIdentity, (finalsWins.get(winnerIdentity) ?? 0) + 1);
    }
  });

  if (finals3) {
    const finalsParticipantsStable =
      finals1 &&
      finals2 &&
      [getAllianceIdentity(finals1.card.red), getAllianceIdentity(finals1.card.blue)].sort().join('||') ===
        [getAllianceIdentity(finals2.card.red), getAllianceIdentity(finals2.card.blue)].sort().join('||');
    const alreadyClinched = Array.from(finalsWins.values()).some(wins => wins >= 2);

    if (finalsParticipantsStable && alreadyClinched && finals3.card.status !== 'played') {
      finals3.card.status = 'if-necessary';
      finals3.card.predictedWinner = null;
      finals3.card.predictedWinnerLabel = 'Not Required';
      finals3.card.confidence = null;
      finals3.card.red.score = null;
      finals3.card.blue.score = null;
    } else {
      [finals3.card.red, finals3.card.blue].forEach(side => {
        const identity = getAllianceIdentity(side);
        if (!identity) return;
        finalsParticipants.set(identity, {
          label: side.label,
          seed: side.seed,
          teamKeys: side.teamKeys
        });
        if (!finalsWins.has(identity)) {
          finalsWins.set(identity, 0);
        }
      });

      const finals3WinnerSide =
        finals3.card.predictedWinner === 'red'
          ? finals3.card.red
          : finals3.card.predictedWinner === 'blue'
            ? finals3.card.blue
            : null;
      const finals3WinnerIdentity = getAllianceIdentity(finals3WinnerSide);
      if (finals3WinnerIdentity) {
        finalsWins.set(finals3WinnerIdentity, (finalsWins.get(finals3WinnerIdentity) ?? 0) + 1);
      }
    }
  }

  const rankedFinalists = Array.from(finalsWins.entries())
    .map(([identity, wins]) => ({
      identity,
      wins,
      alliance: finalsParticipants.get(identity) ?? null
    }))
    .filter(entry => entry.alliance)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const aSeed = a.alliance?.seed ?? Number.MAX_SAFE_INTEGER;
      const bSeed = b.alliance?.seed ?? Number.MAX_SAFE_INTEGER;
      return aSeed - bSeed;
    });

  const finalsChampionSource =
    rankedFinalists.length > 0 && (rankedFinalists.length === 1 || rankedFinalists[0].wins > rankedFinalists[1].wins)
      ? rankedFinalists[0].alliance
      : null;
  const finalsFinalistSource =
    finalsChampionSource && rankedFinalists.length > 1
      ? rankedFinalists.find(entry => entry.identity !== rankedFinalists[0].identity)?.alliance ?? null
      : null;

  const rounds = Array.from(new Set(PLAYOFF_NODE_DEFINITIONS.map(node => node.roundTitle))).map(roundTitle => ({
    title: roundTitle,
    matches: resolvedNodes.filter(node => {
      const definition = PLAYOFF_NODE_DEFINITIONS.find(item => item.id === node.card.id);
      return definition?.roundTitle === roundTitle;
    }).map(node => node.card)
  }));

  return {
    supported: true,
    alliancesAvailable: true,
    rounds,
    champion: finalsChampionSource ? {
      label: finalsChampionSource.label,
      seed: finalsChampionSource.seed,
      teamKeys: finalsChampionSource.teamKeys,
      score: null,
      actualScore: null
    } : null,
    finalist: finalsFinalistSource ? {
      label: finalsFinalistSource.label,
      seed: finalsFinalistSource.seed,
      teamKeys: finalsFinalistSource.teamKeys,
      score: null,
      actualScore: null
    } : null
  };
};
