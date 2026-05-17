import { MatchDefenseScoutingV1, MatchScoutingV3, MatchScoutingV4 } from '../types';
import { TBAMatch } from './mathEngine';

export interface TeamHistoricalAverageRow {
  teamNumber: string;
  matchesPlayed: number;
  avgTotalMatchPoints: number;
  avgAutoPoints: number;
  avgAutoCycles: number;
  avgTeleopPoints: number;
  avgTeleopCycles: number;
  avgEndgamePoints: number;
  avgContributionScore: number;
  avgCloseAccuracy: number;
  avgMiddleAccuracy: number;
  avgFarAccuracy: number;
  avgDriverSkill: number;
  avgTeamwork: number;
  avgReliabilityScore: number;
}

export interface PredictedAllianceScore {
  alliance: 'Red' | 'Blue';
  teams: string[];
  predictedScore: number;
}

export interface PredictedMatchV3 {
  key: string;
  title: string;
  compLevel: string;
  scheduledTime: number | null;
  red: PredictedAllianceScore;
  blue: PredictedAllianceScore;
  predictedWinner: 'Red' | 'Blue' | 'Tie';
  predictionLowConfidence: boolean;
}

export interface PredictorRatingLookupResult {
  ratings: Record<string, number>;
  missingTeams: string[];
}

export interface TeamDefenseMetricRow {
  teamNumber: string;
  recordsLogged: number;
  avgDefenseMetric: number;
}

const normalizeTeamNumber = (teamKey: string) => teamKey.replace(/^frc/i, '');

const isPlayedMatch = (match: TBAMatch) =>
  match.alliances.red.score !== -1 && match.alliances.blue.score !== -1;

const getMatchShortKey = (match: TBAMatch) => match.key.split('_')[1]?.toUpperCase() || match.key.toUpperCase();

export const buildTeamHistoricalAverages = (records: MatchScoutingV3[]): TeamHistoricalAverageRow[] => {
  const buckets = new Map<string, MatchScoutingV3[]>();

  records.forEach(record => {
    const bucket = buckets.get(record.teamNumber) || [];
    bucket.push(record);
    buckets.set(record.teamNumber, bucket);
  });

  return Array.from(buckets.entries())
    .map(([teamNumber, teamRecords]) => {
      const matchesPlayed = teamRecords.length;
      const divide = (value: number) => (matchesPlayed === 0 ? 0 : value / matchesPlayed);

      return {
        teamNumber,
        matchesPlayed,
        avgTotalMatchPoints: divide(teamRecords.reduce((sum, record) => sum + record.totalMatchPoints, 0)),
        avgAutoPoints: divide(teamRecords.reduce((sum, record) => sum + record.autoPoints, 0)),
        avgAutoCycles: 0,
        avgTeleopPoints: divide(teamRecords.reduce((sum, record) => sum + record.teleopPoints, 0)),
        avgTeleopCycles: divide(teamRecords.reduce((sum, record) => sum + record.teleopCycles, 0)),
        avgEndgamePoints: 0,
        avgContributionScore: divide(teamRecords.reduce((sum, record) => sum + record.contributionScore, 0)),
        avgCloseAccuracy: divide(teamRecords.reduce((sum, record) => sum + record.closeAccuracy, 0)),
        avgMiddleAccuracy: divide(teamRecords.reduce((sum, record) => sum + record.middleAccuracy, 0)),
        avgFarAccuracy: divide(teamRecords.reduce((sum, record) => sum + record.farAccuracy, 0)),
        avgDriverSkill: divide(teamRecords.reduce((sum, record) => sum + record.driverSkill, 0)),
        avgTeamwork: divide(teamRecords.reduce((sum, record) => sum + record.teamwork, 0)),
        avgReliabilityScore: 0
      };
    })
    .sort((left, right) => {
      const scoreDelta = right.avgTotalMatchPoints - left.avgTotalMatchPoints;
      if (scoreDelta !== 0) return scoreDelta;
      return Number(left.teamNumber) - Number(right.teamNumber);
    });
};

export const buildTeamHistoricalAveragesV4Aware = (
  v3Records: MatchScoutingV3[],
  v4Records: MatchScoutingV4[]
): TeamHistoricalAverageRow[] => {
  const buckets = new Map<string, Array<{
    total: number;
    auto: number;
    autoCycles: number;
    teleop: number;
    teleopCycles: number;
    endgame: number;
    contribution: number;
    close: number;
    middle: number;
    far: number;
    driver: number;
    teamwork: number;
    reliability: number;
  }>>();

  const addRecord = (teamNumber: string, values: {
    total: number;
    auto: number;
    autoCycles?: number;
    teleop: number;
    teleopCycles: number;
    endgame?: number;
    contribution?: number;
    close?: number;
    middle?: number;
    far?: number;
    driver?: number;
    teamwork?: number;
    reliability?: number;
  }) => {
    const bucket = buckets.get(teamNumber) || [];
    bucket.push({
      total: values.total,
      auto: values.auto,
      autoCycles: values.autoCycles ?? 0,
      teleop: values.teleop,
      teleopCycles: values.teleopCycles,
      endgame: values.endgame ?? 0,
      contribution: values.contribution ?? 0,
      close: values.close ?? 0,
      middle: values.middle ?? 0,
      far: values.far ?? 0,
      driver: values.driver ?? 0,
      teamwork: values.teamwork ?? 0,
      reliability: values.reliability ?? 0
    });
    buckets.set(teamNumber, bucket);
  };

  v3Records.forEach(record => addRecord(record.teamNumber, {
    total: record.totalMatchPoints,
    auto: record.autoPoints,
    autoCycles: 0,
    teleop: record.teleopPoints,
    teleopCycles: record.teleopCycles,
    endgame: 0,
    contribution: record.contributionScore,
    close: record.closeAccuracy,
    middle: record.middleAccuracy,
    far: record.farAccuracy,
    driver: record.driverSkill,
    teamwork: record.teamwork
  }));

  v4Records.forEach(record => addRecord(record.teamNumber, {
    total: record.totalMatchPoints,
    auto: record.autoPoints,
    autoCycles: record.autoCycles,
    teleop: record.teleopPoints,
    teleopCycles: record.teleopCycles,
    endgame: record.endgamePoints,
    contribution: record.reliabilityScore * 10,
    driver: record.reliabilityScore * 10,
    teamwork: record.rolePlayed === 'Support' || record.rolePlayed === 'Mixed' ? 8 : 0,
    reliability: record.reliabilityScore
  }));

  return Array.from(buckets.entries())
    .map(([teamNumber, teamRecords]) => {
      const matchesPlayed = teamRecords.length;
      const divide = (value: number) => (matchesPlayed === 0 ? 0 : value / matchesPlayed);

      return {
        teamNumber,
        matchesPlayed,
        avgTotalMatchPoints: divide(teamRecords.reduce((sum, record) => sum + record.total, 0)),
        avgAutoPoints: divide(teamRecords.reduce((sum, record) => sum + record.auto, 0)),
        avgAutoCycles: divide(teamRecords.reduce((sum, record) => sum + record.autoCycles, 0)),
        avgTeleopPoints: divide(teamRecords.reduce((sum, record) => sum + record.teleop, 0)),
        avgTeleopCycles: divide(teamRecords.reduce((sum, record) => sum + record.teleopCycles, 0)),
        avgEndgamePoints: divide(teamRecords.reduce((sum, record) => sum + record.endgame, 0)),
        avgContributionScore: divide(teamRecords.reduce((sum, record) => sum + record.contribution, 0)),
        avgCloseAccuracy: divide(teamRecords.reduce((sum, record) => sum + record.close, 0)),
        avgMiddleAccuracy: divide(teamRecords.reduce((sum, record) => sum + record.middle, 0)),
        avgFarAccuracy: divide(teamRecords.reduce((sum, record) => sum + record.far, 0)),
        avgDriverSkill: divide(teamRecords.reduce((sum, record) => sum + record.driver, 0)),
        avgTeamwork: divide(teamRecords.reduce((sum, record) => sum + record.teamwork, 0)),
        avgReliabilityScore: divide(teamRecords.reduce((sum, record) => sum + record.reliability, 0))
      };
    })
    .sort((left, right) => {
      const scoreDelta = right.avgTotalMatchPoints - left.avgTotalMatchPoints;
      if (scoreDelta !== 0) return scoreDelta;
      return Number(left.teamNumber) - Number(right.teamNumber);
    });
};

export const buildHistoricalAverageLookup = (rows: TeamHistoricalAverageRow[]) =>
  Object.fromEntries(rows.map(row => [row.teamNumber, row.avgTotalMatchPoints]));

export const buildTeamDefenseMetrics = (records: MatchDefenseScoutingV1[]): TeamDefenseMetricRow[] => {
  const buckets = new Map<string, MatchDefenseScoutingV1[]>();

  records.forEach(record => {
    const bucket = buckets.get(record.teamNumber) || [];
    bucket.push(record);
    buckets.set(record.teamNumber, bucket);
  });

  return Array.from(buckets.entries())
    .map(([teamNumber, teamRecords]) => ({
      teamNumber,
      recordsLogged: teamRecords.length,
      avgDefenseMetric:
        teamRecords.length === 0
          ? 0
          : teamRecords.reduce((sum, record) => sum + record.defenseMetric, 0) / teamRecords.length
    }))
    .sort((left, right) => {
      const defenseDelta = right.avgDefenseMetric - left.avgDefenseMetric;
      if (defenseDelta !== 0) return defenseDelta;
      return Number(left.teamNumber) - Number(right.teamNumber);
    });
};

export const buildPredictedMatchesV3 = (
  matches: TBAMatch[],
  teamAverageLookup: Record<string, number>
): PredictedMatchV3[] =>
  buildPredictedMatchesFromRatings(matches, {
    ratings: teamAverageLookup,
    missingTeams: []
  });

export const buildPredictedMatchesFromRatings = (
  matches: TBAMatch[],
  lookup: PredictorRatingLookupResult
): PredictedMatchV3[] => {
  return matches
    .filter(match => !isPlayedMatch(match))
    .map(match => {
      const redTeams = match.alliances.red.team_keys.map(normalizeTeamNumber);
      const blueTeams = match.alliances.blue.team_keys.map(normalizeTeamNumber);
      const redScore = redTeams.reduce((sum, team) => sum + (lookup.ratings[team] ?? 0), 0);
      const blueScore = blueTeams.reduce((sum, team) => sum + (lookup.ratings[team] ?? 0), 0);
      const missingHistoryTeams = [...redTeams, ...blueTeams].filter(team =>
        lookup.missingTeams.includes(team) || !(team in lookup.ratings)
      );
      const predictedWinner: PredictedMatchV3['predictedWinner'] =
        redScore === blueScore ? 'Tie' : redScore > blueScore ? 'Red' : 'Blue';

      return {
        key: match.key,
        title: getMatchShortKey(match),
        compLevel: match.comp_level,
        scheduledTime: match.predicted_time ?? match.time ?? null,
        red: {
          alliance: 'Red' as const,
          teams: redTeams,
          predictedScore: redScore
        },
        blue: {
          alliance: 'Blue' as const,
          teams: blueTeams,
          predictedScore: blueScore
        },
        predictedWinner,
        predictionLowConfidence: missingHistoryTeams.length > 0
      };
    })
    .sort((left, right) => {
      const leftTime = left.scheduledTime ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.scheduledTime ?? Number.MAX_SAFE_INTEGER;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.title.localeCompare(right.title, undefined, { numeric: true });
    });
};
