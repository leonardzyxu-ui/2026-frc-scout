import { MatchScoutingV2 } from '../types';

export type PracticeLeaderboardMetric =
  | 'avgAutoFluidity'
  | 'avgTeleopFluidity'
  | 'avgDriverPressure'
  | 'avgTotalCycles'
  | 'avgDefenseEffectiveness'
  | 'defensePlayRate'
  | 'mainPointContributorRate'
  | 'robotFailureRate'
  | 'cardCount';

export type PracticeTrendMetric =
  | 'autoFluidity'
  | 'teleopFluidity'
  | 'driverPressure'
  | 'totalCycles';

export interface PracticeSummary {
  totalRecords: number;
  distinctTeams: number;
  distinctMatches: number;
  avgAutoFluidity: number;
  avgTeleopFluidity: number;
  avgDriverPressure: number;
  avgTotalCycles: number;
  defensePlayRate: number;
}

export interface PracticeTeamSummary {
  teamNumber: string;
  matches: number;
  scouts: string[];
  avgAutoFluidity: number;
  avgTeleopFluidity: number;
  avgDriverPressure: number;
  avgTotalCycles: number;
  avgDefenseEffectiveness: number;
  defensePlayRate: number;
  mainPointContributorRate: number;
  robotFailureRate: number;
  yellowCards: number;
  redCards: number;
  climbCounts: Record<MatchScoutingV2['climbLevel'], number>;
}

export interface PracticeMatchRecordSummary {
  teamNumber: string;
  scoutName: string;
  alliance: MatchScoutingV2['alliance'];
  autoFluidity: number;
  teleopFluidity: number;
  driverPressure: number;
  totalCycles: number;
  climbLevel: MatchScoutingV2['climbLevel'];
  playedDefense: boolean;
  failureFlags: string[];
}

export interface PracticeMatchSummary {
  matchKey: string;
  matchLabel: string;
  matchNumber: number;
  rowCount: number;
  distinctTeams: number;
  avgAutoFluidity: number;
  avgTeleopFluidity: number;
  avgDriverPressure: number;
  avgTotalCycles: number;
  records: PracticeMatchRecordSummary[];
}

export type PracticeTrendPoint = {
  matchNumber: number;
  matchLabel: string;
} & Record<string, string | number | undefined>;

export interface PracticeScatterPoint {
  teamNumber: string;
  scoutName: string;
  matchLabel: string;
  matchNumber: number;
  autoFluidity: number;
  teleopFluidity: number;
  driverPressure: number;
  totalCycles: number;
  defenseEffectiveness: number;
}

export interface PracticeBarPoint {
  label: string;
  count: number;
}

export interface PracticeAnalyticsData {
  summary: PracticeSummary;
  teams: PracticeTeamSummary[];
  matches: PracticeMatchSummary[];
  coverage: { matchNumber: number; matchLabel: string; rows: number; distinctTeams: number }[];
  trendTeams: string[];
  trends: Record<PracticeTrendMetric, PracticeTrendPoint[]>;
  scatterCycleVsTeleop: PracticeScatterPoint[];
  scatterPressureVsCycles: PracticeScatterPoint[];
  scatterDefenseVsPressure: PracticeScatterPoint[];
  climbDistribution: PracticeBarPoint[];
  failureDistribution: PracticeBarPoint[];
}

const safeAverage = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const parsePracticeMatchNumber = (matchKey: string) => {
  const normalized = (matchKey || '').trim().toLowerCase();
  const directMatch = normalized.match(/pm(\d+)/);
  if (directMatch) {
    return parseInt(directMatch[1], 10) || 0;
  }

  const firstNumber = normalized.match(/\d+/);
  return firstNumber ? parseInt(firstNumber[0], 10) || 0 : 0;
};

const toPracticeMatchLabel = (matchKey: string) => {
  const matchNumber = parsePracticeMatchNumber(matchKey);
  return matchNumber > 0 ? `PM ${matchNumber}` : (matchKey || 'Unknown').toUpperCase();
};

const hasFailure = (record: MatchScoutingV2) =>
  record.robotDied || record.commsLost || record.mechanismBroke || record.tippedOver;

const getFailureFlags = (record: MatchScoutingV2) => {
  const flags: string[] = [];
  if (record.robotDied) flags.push('Robot Died');
  if (record.commsLost) flags.push('Comms Lost');
  if (record.mechanismBroke) flags.push('Mechanism Broke');
  if (record.tippedOver) flags.push('Tipped Over');
  return flags;
};

const sortPracticeRecords = (records: MatchScoutingV2[]) =>
  [...records].sort((left, right) => {
    const matchDelta = parsePracticeMatchNumber(left.matchKey) - parsePracticeMatchNumber(right.matchKey);
    if (matchDelta !== 0) return matchDelta;
    const teamDelta = Number(left.teamNumber || 0) - Number(right.teamNumber || 0);
    if (teamDelta !== 0) return teamDelta;
    return (left.timestamp || 0) - (right.timestamp || 0);
  });

export const getPracticeLeaderboardMetricValue = (
  row: PracticeTeamSummary,
  metric: PracticeLeaderboardMetric
) => {
  switch (metric) {
    case 'avgAutoFluidity':
      return row.avgAutoFluidity;
    case 'avgTeleopFluidity':
      return row.avgTeleopFluidity;
    case 'avgDriverPressure':
      return row.avgDriverPressure;
    case 'avgTotalCycles':
      return row.avgTotalCycles;
    case 'avgDefenseEffectiveness':
      return row.avgDefenseEffectiveness;
    case 'defensePlayRate':
      return row.defensePlayRate;
    case 'mainPointContributorRate':
      return row.mainPointContributorRate;
    case 'robotFailureRate':
      return row.robotFailureRate;
    case 'cardCount':
      return row.yellowCards + row.redCards;
    default:
      return 0;
  }
};

export const buildPracticeAnalytics = (records: MatchScoutingV2[]): PracticeAnalyticsData => {
  const practiceRecords = sortPracticeRecords(records);
  const summary: PracticeSummary = {
    totalRecords: practiceRecords.length,
    distinctTeams: new Set(practiceRecords.map(record => record.teamNumber)).size,
    distinctMatches: new Set(practiceRecords.map(record => record.matchKey)).size,
    avgAutoFluidity: safeAverage(practiceRecords.map(record => record.autoFluidity || 0)),
    avgTeleopFluidity: safeAverage(practiceRecords.map(record => record.teleopFluidity || 0)),
    avgDriverPressure: safeAverage(practiceRecords.map(record => record.driverPressure || 0)),
    avgTotalCycles: safeAverage(practiceRecords.map(record => record.totalCycles || 0)),
    defensePlayRate:
      practiceRecords.length === 0
        ? 0
        : practiceRecords.filter(record => record.playedDefense).length / practiceRecords.length
  };

  const teamBuckets = new Map<string, MatchScoutingV2[]>();
  const matchBuckets = new Map<string, MatchScoutingV2[]>();

  practiceRecords.forEach(record => {
    const teamBucket = teamBuckets.get(record.teamNumber) || [];
    teamBucket.push(record);
    teamBuckets.set(record.teamNumber, teamBucket);

    const matchBucket = matchBuckets.get(record.matchKey) || [];
    matchBucket.push(record);
    matchBuckets.set(record.matchKey, matchBucket);
  });

  const teams = Array.from(teamBuckets.entries())
    .map<PracticeTeamSummary>(([teamNumber, teamRecords]) => ({
      teamNumber,
      matches: teamRecords.length,
      scouts: Array.from(new Set(teamRecords.map(record => record.scoutName).filter(Boolean))).sort(),
      avgAutoFluidity: safeAverage(teamRecords.map(record => record.autoFluidity || 0)),
      avgTeleopFluidity: safeAverage(teamRecords.map(record => record.teleopFluidity || 0)),
      avgDriverPressure: safeAverage(teamRecords.map(record => record.driverPressure || 0)),
      avgTotalCycles: safeAverage(teamRecords.map(record => record.totalCycles || 0)),
      avgDefenseEffectiveness: safeAverage(teamRecords.map(record => record.defenseEffectiveness || 0)),
      defensePlayRate:
        teamRecords.length === 0 ? 0 : teamRecords.filter(record => record.playedDefense).length / teamRecords.length,
      mainPointContributorRate:
        teamRecords.length === 0
          ? 0
          : teamRecords.filter(record => record.mainPointContributor).length / teamRecords.length,
      robotFailureRate:
        teamRecords.length === 0 ? 0 : teamRecords.filter(record => hasFailure(record)).length / teamRecords.length,
      yellowCards: teamRecords.filter(record => record.yellowCard).length,
      redCards: teamRecords.filter(record => record.redCard).length,
      climbCounts: {
        None: teamRecords.filter(record => record.climbLevel === 'None').length,
        L1: teamRecords.filter(record => record.climbLevel === 'L1').length,
        L2: teamRecords.filter(record => record.climbLevel === 'L2').length,
        L3: teamRecords.filter(record => record.climbLevel === 'L3').length
      }
    }))
    .sort((left, right) => {
      const cycleDelta = right.avgTotalCycles - left.avgTotalCycles;
      if (cycleDelta !== 0) return cycleDelta;
      return Number(left.teamNumber) - Number(right.teamNumber);
    });

  const matches = Array.from(matchBuckets.entries())
    .map<PracticeMatchSummary>(([matchKey, matchRecords]) => ({
      matchKey,
      matchLabel: toPracticeMatchLabel(matchKey),
      matchNumber: parsePracticeMatchNumber(matchKey),
      rowCount: matchRecords.length,
      distinctTeams: new Set(matchRecords.map(record => record.teamNumber)).size,
      avgAutoFluidity: safeAverage(matchRecords.map(record => record.autoFluidity || 0)),
      avgTeleopFluidity: safeAverage(matchRecords.map(record => record.teleopFluidity || 0)),
      avgDriverPressure: safeAverage(matchRecords.map(record => record.driverPressure || 0)),
      avgTotalCycles: safeAverage(matchRecords.map(record => record.totalCycles || 0)),
      records: sortPracticeRecords(matchRecords).map(record => ({
        teamNumber: record.teamNumber,
        scoutName: record.scoutName,
        alliance: record.alliance,
        autoFluidity: record.autoFluidity,
        teleopFluidity: record.teleopFluidity,
        driverPressure: record.driverPressure,
        totalCycles: record.totalCycles,
        climbLevel: record.climbLevel,
        playedDefense: record.playedDefense,
        failureFlags: getFailureFlags(record)
      }))
    }))
    .sort((left, right) => left.matchNumber - right.matchNumber);

  const coverage = matches.map(match => ({
    matchNumber: match.matchNumber,
    matchLabel: match.matchLabel,
    rows: match.rowCount,
    distinctTeams: match.distinctTeams
  }));

  const trendTeams = teams.slice(0, 5).map(team => team.teamNumber);
  const trends = {
    autoFluidity: new Map<number, PracticeTrendPoint>(),
    teleopFluidity: new Map<number, PracticeTrendPoint>(),
    driverPressure: new Map<number, PracticeTrendPoint>(),
    totalCycles: new Map<number, PracticeTrendPoint>()
  };

  trendTeams.forEach(teamNumber => {
    const teamRecords = teamBuckets.get(teamNumber) || [];
    teamRecords.forEach(record => {
      const matchNumber = parsePracticeMatchNumber(record.matchKey);
      const matchLabel = toPracticeMatchLabel(record.matchKey);

      (
        [
          ['autoFluidity', record.autoFluidity],
          ['teleopFluidity', record.teleopFluidity],
          ['driverPressure', record.driverPressure],
          ['totalCycles', record.totalCycles]
        ] as const
      ).forEach(([metricKey, value]) => {
        const bucket = trends[metricKey];
        if (!bucket.has(matchNumber)) {
          bucket.set(matchNumber, { matchNumber, matchLabel });
        }
        bucket.get(matchNumber)![teamNumber] = value;
      });
    });
  });

  const scatterPoints = practiceRecords.map<PracticeScatterPoint>(record => ({
    teamNumber: record.teamNumber,
    scoutName: record.scoutName,
    matchLabel: toPracticeMatchLabel(record.matchKey),
    matchNumber: parsePracticeMatchNumber(record.matchKey),
    autoFluidity: record.autoFluidity,
    teleopFluidity: record.teleopFluidity,
    driverPressure: record.driverPressure,
    totalCycles: record.totalCycles,
    defenseEffectiveness: record.defenseEffectiveness
  }));

  const climbDistribution: PracticeBarPoint[] = (['None', 'L1', 'L2', 'L3'] as const).map(level => ({
    label: level,
    count: practiceRecords.filter(record => record.climbLevel === level).length
  }));

  const failureDistribution: PracticeBarPoint[] = [
    { label: 'Robot Died', count: practiceRecords.filter(record => record.robotDied).length },
    { label: 'Comms Lost', count: practiceRecords.filter(record => record.commsLost).length },
    { label: 'Mechanism Broke', count: practiceRecords.filter(record => record.mechanismBroke).length },
    { label: 'Tipped Over', count: practiceRecords.filter(record => record.tippedOver).length }
  ];

  return {
    summary,
    teams,
    matches,
    coverage,
    trendTeams,
    trends: {
      autoFluidity: Array.from(trends.autoFluidity.values()).sort((left, right) => left.matchNumber - right.matchNumber),
      teleopFluidity: Array.from(trends.teleopFluidity.values()).sort((left, right) => left.matchNumber - right.matchNumber),
      driverPressure: Array.from(trends.driverPressure.values()).sort((left, right) => left.matchNumber - right.matchNumber),
      totalCycles: Array.from(trends.totalCycles.values()).sort((left, right) => left.matchNumber - right.matchNumber)
    },
    scatterCycleVsTeleop: scatterPoints,
    scatterPressureVsCycles: scatterPoints,
    scatterDefenseVsPressure: scatterPoints,
    climbDistribution,
    failureDistribution
  };
};
