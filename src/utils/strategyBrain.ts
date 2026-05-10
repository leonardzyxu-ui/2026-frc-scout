import {
  AlliancePickRecommendation,
  DefenseAttributionRecord,
  MatchDefenseScoutingV1,
  MatchScoutingV3,
  MatchScoutingV4,
  ModelBacktestResult,
  ScoutAssignmentPlan,
  StrategyMatchPlan,
  TeamPerformanceProfile
} from '../types';
import { calculateLegacyOprRatings, TBAMatch } from './mathEngine';
import { TeamHistoricalAverageRow } from './adminV2Analytics';

const normalizeTeamKey = (teamKey: string) => teamKey.replace(/^frc/i, '');

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);

const stddev = (values: number[]) => {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length);
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

const sortMatchesByMatchNumber = (matches: TBAMatch[]) =>
  [...matches].sort((left, right) => left.match_number - right.match_number || left.key.localeCompare(right.key));

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

const evaluatePredictions = (
  modelName: string,
  sourceLabel: string,
  predictions: Array<{
    match: TBAMatch;
    redScore: number;
    blueScore: number;
    lowConfidence: boolean;
  }>
): ModelBacktestResult => {
  if (predictions.length === 0) {
    return {
      modelName,
      sourceLabel,
      matchesTested: 0,
      winnerAccuracy: 0,
      scoreMae: 0,
      marginMae: 0,
      calibrationError: 0,
      lowConfidenceRate: 0
    };
  }

  let winnerHits = 0;
  let scoreAbsError = 0;
  let marginAbsError = 0;
  let calibrationError = 0;
  let lowConfidence = 0;

  predictions.forEach(({ match, redScore, blueScore, lowConfidence: isLowConfidence }) => {
    const actualRed = getOfficialAllianceScore(match, 'red');
    const actualBlue = getOfficialAllianceScore(match, 'blue');
    const predictedWinner = redScore === blueScore ? 'Tie' : redScore > blueScore ? 'Red' : 'Blue';
    const actualWinner = actualRed === actualBlue ? 'Tie' : actualRed > actualBlue ? 'Red' : 'Blue';
    if (predictedWinner === actualWinner) winnerHits += 1;
    scoreAbsError += Math.abs(redScore - actualRed) + Math.abs(blueScore - actualBlue);
    marginAbsError += Math.abs((redScore - blueScore) - (actualRed - actualBlue));
    calibrationError += Math.abs(Math.abs(redScore - blueScore) - Math.abs(actualRed - actualBlue));
    if (isLowConfidence) lowConfidence += 1;
  });

  return {
    modelName,
    sourceLabel,
    matchesTested: predictions.length,
    winnerAccuracy: winnerHits / predictions.length,
    scoreMae: scoreAbsError / (predictions.length * 2),
    marginMae: marginAbsError / predictions.length,
    calibrationError: calibrationError / predictions.length,
    lowConfidenceRate: lowConfidence / predictions.length
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
    Ensemble: []
  };

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

    const ensembleScore = (allianceTeams: string[]) =>
      allianceTeams.reduce((sum, team) => {
        const values = [ppcRatings[team], rollingPpcRatings[team], oprRatings[team], epaRatings[team]]
          .filter((value): value is number => value != null && Number.isFinite(value));
        return sum + mean(values);
      }, 0);
    modelPredictions.Ensemble.push({
      match,
      redScore: ensembleScore(redTeams),
      blueScore: ensembleScore(blueTeams),
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
    Ensemble: 'Explainable PPC/OPR/EPA blend'
  };

  return Object.entries(modelPredictions)
    .map(([modelName, predictions]) => evaluatePredictions(modelName, sourceLabels[modelName], predictions))
    .sort((left, right) => {
      if (left.matchesTested !== right.matchesTested) return right.matchesTested - left.matchesTested;
      if (left.scoreMae !== right.scoreMae) return left.scoreMae - right.scoreMae;
      return right.winnerAccuracy - left.winnerAccuracy;
    });
};

export const buildPpaRatings = (
  modelResults: ModelBacktestResult[],
  lookups: Record<string, Record<string, number>>
) => {
  const usableResults = modelResults.filter(result => result.matchesTested > 0 && lookups[result.modelName]);
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

export const backtestRatingModels = (
  matches: TBAMatch[],
  lookups: Array<{ modelName: string; sourceLabel: string; ratings: Record<string, number>; missingTeams?: string[] }>
): ModelBacktestResult[] => {
  const playedQuals = matches.filter(match => match.comp_level === 'qm' && isPlayedMatch(match));

  return lookups.map(lookup => {
    if (playedQuals.length === 0) {
      return {
        modelName: lookup.modelName,
        sourceLabel: lookup.sourceLabel,
        matchesTested: 0,
        winnerAccuracy: 0,
        scoreMae: 0,
        marginMae: 0,
        calibrationError: 0,
        lowConfidenceRate: 0
      };
    }

    let winnerHits = 0;
    let scoreAbsError = 0;
    let marginAbsError = 0;
    let calibrationError = 0;
    let lowConfidence = 0;
    const missingSet = new Set(lookup.missingTeams || []);

    playedQuals.forEach(match => {
      const redTeams = match.alliances.red.team_keys.map(normalizeTeamKey);
      const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamKey);
      const predictedRed = scoreAlliance(redTeams, lookup.ratings);
      const predictedBlue = scoreAlliance(blueTeams, lookup.ratings);
      const actualRed = getOfficialAllianceScore(match, 'red');
      const actualBlue = getOfficialAllianceScore(match, 'blue');
      const predictedWinner = predictedRed === predictedBlue ? 'Tie' : predictedRed > predictedBlue ? 'Red' : 'Blue';
      const actualWinner = actualRed === actualBlue ? 'Tie' : actualRed > actualBlue ? 'Red' : 'Blue';
      if (predictedWinner === actualWinner) winnerHits += 1;
      scoreAbsError += Math.abs(predictedRed - actualRed) + Math.abs(predictedBlue - actualBlue);
      marginAbsError += Math.abs((predictedRed - predictedBlue) - (actualRed - actualBlue));
      calibrationError += Math.abs(Math.abs(predictedRed - predictedBlue) - Math.abs(actualRed - actualBlue));
      if ([...redTeams, ...blueTeams].some(team => missingSet.has(team) || !(team in lookup.ratings))) lowConfidence += 1;
    });

    return {
      modelName: lookup.modelName,
      sourceLabel: lookup.sourceLabel,
      matchesTested: playedQuals.length,
      winnerAccuracy: winnerHits / playedQuals.length,
      scoreMae: scoreAbsError / (playedQuals.length * 2),
      marginMae: marginAbsError / playedQuals.length,
      calibrationError: calibrationError / playedQuals.length,
      lowConfidenceRate: lowConfidence / playedQuals.length
    };
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
  defenseImpactLookup
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
    const curve = scores.map((score, index) => {
      const recentWindow = scores.slice(Math.max(0, index - 2), index + 1).map(item => item.score);
      return {
        matchKey: score.matchKey,
        matchNumber: score.matchNumber,
        score: score.score,
        rollingAverage: mean(recentWindow),
        fittedScore: averageScore + slope * (score.matchNumber - mean(scores.map(item => item.matchNumber)))
      };
    });

    return {
      teamNumber,
      matchesPlayed: scores.length,
      peakScore: rawScores.length ? Math.max(...rawScores) : 0,
      worstScore: rawScores.length ? Math.min(...rawScores) : 0,
      lowestNonZeroScore: rawScores.filter(score => score > 0).sort((left, right) => left - right)[0] ?? null,
      averageScore,
      standardDeviation: deviation,
      volatility: averageScore === 0 ? 0 : deviation / Math.max(1, averageScore),
      reliability: scores.length ? mean(scores.map(score => score.reliability)) : 0,
      recentTrend: slope,
      ppc: ppcLookup[teamNumber] ?? null,
      opr: oprRatings[teamNumber] ?? null,
      dpr: dprRatings[teamNumber] ?? null,
      epa: epaRatings[teamNumber] ?? null,
      ppa: ppaRatings[teamNumber] ?? null,
      defenseImpact: defenseImpactLookup[teamNumber] ?? null,
      curve
    };
  }).sort((left, right) => {
    const scoreDelta = (right.ppa ?? right.ppc ?? 0) - (left.ppa ?? left.ppc ?? 0);
    if (scoreDelta !== 0) return scoreDelta;
    return Number(left.teamNumber) - Number(right.teamNumber);
  });
};

export const buildDefenseAttributions = (
  v4Records: MatchScoutingV4[],
  expectedLookup: Record<string, number>
): DefenseAttributionRecord[] => {
  const recordsByMatchTeam = new Map<string, MatchScoutingV4>();
  v4Records.forEach(record => recordsByMatchTeam.set(`${record.matchKey}:${record.teamNumber}`, record));

  return v4Records
    .filter(record => record.defendedTeamNumber || record.defenderFacedTeamNumber)
    .map(record => {
      const targetTeamNumber = record.defendedTeamNumber || record.teamNumber;
      const defenderTeamNumber = record.defendedTeamNumber ? record.teamNumber : record.defenderFacedTeamNumber;
      const targetRecord = recordsByMatchTeam.get(`${record.matchKey}:${targetTeamNumber}`);
      const expectedTargetPoints = expectedLookup[targetTeamNumber] ?? 0;
      const actualTargetPoints = targetRecord?.totalMatchPoints ?? 0;
      const pointsDenied = Math.max(0, expectedTargetPoints - actualTargetPoints);
      const confidence = Math.min(1, 0.35 + (record.defenseIntensity || 0) * 0.45 + (targetRecord ? 0.2 : 0));

      return {
        id: `${record.matchKey}_${defenderTeamNumber}_${targetTeamNumber}`,
        eventKey: record.eventKey,
        matchKey: record.matchKey,
        targetTeamNumber,
        defenderTeamNumber,
        expectedTargetPoints,
        actualTargetPoints,
        pointsDenied,
        confidence,
        source: 'scouted' as const
      };
    })
    .filter(record => record.defenderTeamNumber && record.targetTeamNumber);
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

export const buildStrategyMatchPlans = (
  matches: TBAMatch[],
  ratings: Record<string, number>,
  defenseImpactLookup: Record<string, number>
): StrategyMatchPlan[] =>
  matches
    .filter(match => match.comp_level === 'qm' && !isPlayedMatch(match))
    .map(match => {
      const redTeams = match.alliances.red.team_keys.map(normalizeTeamKey);
      const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamKey);
      const baselineRedScore = scoreAlliance(redTeams, ratings);
      const baselineBlueScore = scoreAlliance(blueTeams, ratings);
      const bestRedDefender = redTeams
        .map(team => ({ team, value: Math.max(ratings[team] ?? 0, defenseImpactLookup[team] ?? 0) }))
        .sort((left, right) => right.value - left.value)[0];
      const bestBlueDefender = blueTeams
        .map(team => ({ team, value: Math.max(ratings[team] ?? 0, defenseImpactLookup[team] ?? 0) }))
        .sort((left, right) => right.value - left.value)[0];
      const redWithDefense = baselineRedScore - (ratings[bestRedDefender?.team || ''] ?? 0) + Math.max(ratings[bestRedDefender?.team || ''] ?? 0, defenseImpactLookup[bestRedDefender?.team || ''] ?? 0);
      const blueWithDefense = baselineBlueScore - (ratings[bestBlueDefender?.team || ''] ?? 0) + Math.max(ratings[bestBlueDefender?.team || ''] ?? 0, defenseImpactLookup[bestBlueDefender?.team || ''] ?? 0);
      const redFinal = redWithDefense - Math.max(0, defenseImpactLookup[bestBlueDefender?.team || ''] ?? 0);
      const blueFinal = blueWithDefense - Math.max(0, defenseImpactLookup[bestRedDefender?.team || ''] ?? 0);
      const predictedWinner: StrategyMatchPlan['predictedWinner'] =
        redFinal === blueFinal ? 'Tie' : redFinal > blueFinal ? 'Red' : 'Blue';
      const missingTeams = [...redTeams, ...blueTeams].filter(team => !(team in ratings));

      return {
        matchKey: match.key,
        matchNumber: match.match_number,
        matchType: 'Qualification' as const,
        redTeams,
        blueTeams,
        baselineRedScore,
        baselineBlueScore,
        bestRedPlan: bestRedDefender ? `${bestRedDefender.team} flexes between offense and defense` : 'All offense',
        bestBluePlan: bestBlueDefender ? `${bestBlueDefender.team} flexes between offense and defense` : 'All offense',
        predictedWinner,
        confidence: Math.max(0.25, 1 - missingTeams.length / 6),
        riskFlags: [
          missingTeams.length ? `${missingTeams.length} teams missing selected-model data` : '',
          Math.abs(redFinal - blueFinal) < 8 ? 'Close match; role execution matters' : ''
        ].filter(Boolean),
        winCondition:
          predictedWinner === 'Tie'
            ? 'Win condition: prevent penalties and chase bonus RP.'
            : `Win condition for ${predictedWinner}: protect scoring floor and use the best defender only if the opponent starts outpacing baseline.`
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
  const scoutLoad: Record<string, number> = Object.fromEntries(activeScouts.map(name => [name, 0]));
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
    const stations = [
      ...match.alliances.red.team_keys.map((teamKey, index) => ({ station: `Red ${index + 1}`, teamNumber: normalizeTeamKey(teamKey) })),
      ...match.alliances.blue.team_keys.map((teamKey, index) => ({ station: `Blue ${index + 1}`, teamNumber: normalizeTeamKey(teamKey) }))
    ];
    stations.slice(0, Math.min(6, activeScouts.length)).forEach(slot => {
      const scoutName = activeScouts
        .map(name => ({
          name,
          repeats: exposureCounts[name][slot.teamNumber] || 0,
          load: scoutLoad[name] || 0
        }))
        .sort((left, right) => right.repeats - left.repeats || left.load - right.load || left.name.localeCompare(right.name))[0]?.name;
      if (!scoutName) return;
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

  return {
    id: `${eventKey}_${Date.now()}`,
    eventKey,
    createdAt: Date.now(),
    scoutNames: activeScouts,
    scoutCount: activeScouts.length,
    ownTeamNumber,
    assignments,
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
