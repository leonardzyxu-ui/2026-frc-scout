import { Matrix, solve } from 'ml-matrix';
import { MatchScoutingV2 } from '../types';
import { buildTbaHttpError, TBA_KEY_MISSING_MESSAGE } from './tbaErrors';

export interface TBAMatch {
  key: string;
  event_key?: string;
  comp_level: string;
  match_number: number;
  set_number?: number;
  time: number | null;
  predicted_time?: number | null;
  actual_time?: number | null;
  winning_alliance?: 'red' | 'blue' | '';
  alliances: {
    red: { score: number; team_keys: string[] };
    blue: { score: number; team_keys: string[] };
  };
  score_breakdown?: {
    red: TBAScoreBreakdownAlliance;
    blue: TBAScoreBreakdownAlliance;
  };
}

export interface TBAScoreBreakdownAlliance extends Record<string, unknown> {
  autoPoints?: number;
  teleopPoints?: number;
  endGameTotalStagePoints?: number;
  endGamePoints?: number;
}

export interface TeamMetrics {
  teamNumber: string;
  epa: number;
  epac: number;
  autoEpac: number;
  teleopEpac: number;
  endgameEpac: number;
  epacHistory: { match: number; epac: number }[];
  avgAutoFluidity: number;
  avgTeleopFluidity: number;
  avgDriverPressure: number;
  avgDefenseEffectiveness: number;
  matchesPlayed: number;
}

export interface TestTeamMetrics {
  teamNumber: string;
  matchesLogged: number;
  avgAutoFluidity: number;
  avgTeleopFluidity: number;
  avgDriverPressure: number;
  avgDefenseEffectiveness: number;
  climbReadiness: number;
  reliabilityScore: number;
  syntheticScore: number;
  syntheticHistory: { match: number; syntheticScore: number }[];
}

interface TeamSubjectiveSummary {
  auto: number;
  teleop: number;
  pressure: number;
  defense: number;
  defenseCount: number;
  count: number;
}

interface MatchFluiditySummary {
  auto: number;
  teleop: number;
  count: number;
}

interface RollingFluidityState {
  autoSum: number;
  teleopSum: number;
  count: number;
}

interface MutableTeamState {
  epa: number;
  epac: number;
  autoEpac: number;
  teleopEpac: number;
  endgameEpac: number;
  matchesPlayed: number;
  epacHistory: { match: number; epac: number }[];
}

interface TeamStateSnapshot {
  epa: number;
  epac: number;
  autoEpac: number;
  teleopEpac: number;
  endgameEpac: number;
}

const EPAC_K_FACTOR = 0.29;
const DEFAULT_FLUIDITY_SCORE = 7;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeTeamKey = (teamKey: string) => teamKey.replace('frc', '');

const getMatchSortTimestamp = (match: TBAMatch) =>
  match.actual_time ?? match.predicted_time ?? match.time ?? 0;

const getEndgamePoints = (breakdown?: {
  endGameTotalStagePoints?: number;
  endGamePoints?: number;
}) => breakdown?.endGameTotalStagePoints ?? breakdown?.endGamePoints ?? 0;

const getMatchAliases = (match: TBAMatch) => {
  const aliases = new Set<string>([match.key]);
  const [, shortKey] = match.key.split('_');
  if (shortKey) {
    aliases.add(shortKey);
  }
  return Array.from(aliases);
};

const getFluencyModifier = (score: number) => clamp(score / 10, 0, 1);

const getClimbReadiness = (climbLevel: MatchScoutingV2['climbLevel'] | string) => {
  switch (climbLevel) {
    case 'Parked':
    case 'L1':
      return 4;
    case 'Shallow':
    case 'L2':
      return 7;
    case 'Deep':
    case 'L3':
      return 10;
    case 'None':
    default:
      return 0;
  }
};

const getRecordPenalty = (record: MatchScoutingV2) =>
  (record.robotDied ? 4 : 0) +
  (record.mechanismBroke ? 3 : 0) +
  (record.commsLost ? 2 : 0) +
  (record.tippedOver ? 2 : 0);

const getMatchSequenceNumber = (record: MatchScoutingV2, fallbackIndex: number) => {
  const numericMatch = record.matchKey.match(/(\d+)/);
  return numericMatch ? parseInt(numericMatch[1] ?? `${fallbackIndex + 1}`, 10) : fallbackIndex + 1;
};

const getParsedMatchNumber = (record: MatchScoutingV2) => {
  const numericMatch = record.matchKey.match(/(\d+)/);
  return numericMatch ? parseInt(numericMatch[1] ?? '0', 10) : null;
};

const getSyntheticScoreForRecord = (record: MatchScoutingV2) => {
  const defenseContribution = record.playedDefense ? record.defenseEffectiveness : 0;
  const climbReadiness = getClimbReadiness(record.climbLevel);
  const reliabilityScore = clamp(10 - getRecordPenalty(record), 0, 10);

  return clamp(
    record.autoFluidity * 0.2 +
      record.teleopFluidity * 0.25 +
      record.driverPressure * 0.2 +
      defenseContribution * 0.1 +
      climbReadiness * 0.15 +
      reliabilityScore * 0.1,
    0,
    10
  );
};

const getInitialMutableState = (): MutableTeamState => ({
  epa: 0,
  epac: 0,
  autoEpac: 0,
  teleopEpac: 0,
  endgameEpac: 0,
  matchesPlayed: 0,
  epacHistory: []
});

const getStateSnapshot = (state: MutableTeamState): TeamStateSnapshot => ({
  epa: state.epa,
  epac: state.epac,
  autoEpac: state.autoEpac,
  teleopEpac: state.teleopEpac,
  endgameEpac: state.endgameEpac
});

const getRollingFluidityScore = (state?: RollingFluidityState) => {
  if (!state || state.count === 0) return DEFAULT_FLUIDITY_SCORE;
  return state.autoSum / state.count;
};

const getRollingTeleopScore = (state?: RollingFluidityState) => {
  if (!state || state.count === 0) return DEFAULT_FLUIDITY_SCORE;
  return state.teleopSum / state.count;
};

const getMatchFluidityLookup = (scoutingData: MatchScoutingV2[]) => {
  const lookup = new Map<string, MatchFluiditySummary>();

  scoutingData.forEach(record => {
    if (!record.teamNumber || !record.matchKey) return;
    const key = `${record.teamNumber}|${record.matchKey}`;
    const current = lookup.get(key) || { auto: 0, teleop: 0, count: 0 };
    current.auto += record.autoFluidity || 0;
    current.teleop += record.teleopFluidity || 0;
    current.count += 1;
    lookup.set(key, current);
  });

  return lookup;
};

const getSubjectiveSummaryLookup = (teams: string[], scoutingData: MatchScoutingV2[]) => {
  const summary = new Map<string, TeamSubjectiveSummary>();
  teams.forEach(team =>
    summary.set(team, { auto: 0, teleop: 0, pressure: 0, defense: 0, defenseCount: 0, count: 0 })
  );

  scoutingData.forEach(record => {
    if (!summary.has(record.teamNumber)) return;
    const teamSummary = summary.get(record.teamNumber)!;
    teamSummary.auto += record.autoFluidity || 0;
    teamSummary.teleop += record.teleopFluidity || 0;
    teamSummary.pressure += record.driverPressure || 0;
    teamSummary.count += 1;

    if (record.playedDefense) {
      teamSummary.defense += record.defenseEffectiveness || 0;
      teamSummary.defenseCount += 1;
    }
  });

  return summary;
};

const getTeamMatchFluidity = (
  teamNumber: string,
  matchAliases: string[],
  matchFluidityLookup: Map<string, MatchFluiditySummary>
) => {
  for (const alias of matchAliases) {
    const summary = matchFluidityLookup.get(`${teamNumber}|${alias}`);
    if (summary) {
      return {
        autoScore: summary.auto / summary.count,
        teleopScore: summary.teleop / summary.count
      };
    }
  }
  return null;
};

export const calculateTestMetrics = (scoutingData: MatchScoutingV2[]): Record<string, TestTeamMetrics> => {
  const groupedData = new Map<string, MatchScoutingV2[]>();

  scoutingData.forEach(record => {
    if (!record.teamNumber) return;
    if (!groupedData.has(record.teamNumber)) {
      groupedData.set(record.teamNumber, []);
    }
    groupedData.get(record.teamNumber)!.push(record);
  });

  const metrics: Record<string, TestTeamMetrics> = {};

  groupedData.forEach((records, teamNumber) => {
    const sortedRecords = [...records].sort((a, b) => {
      const aMatchNumber = getParsedMatchNumber(a);
      const bMatchNumber = getParsedMatchNumber(b);
      if (aMatchNumber != null && bMatchNumber != null && aMatchNumber !== bMatchNumber) {
        return aMatchNumber - bMatchNumber;
      }
      return (a.timestamp || 0) - (b.timestamp || 0);
    });

    const defenseRecords = sortedRecords.filter(record => record.playedDefense);
    const avgAutoFluidity = sortedRecords.reduce((sum, record) => sum + record.autoFluidity, 0) / sortedRecords.length;
    const avgTeleopFluidity = sortedRecords.reduce((sum, record) => sum + record.teleopFluidity, 0) / sortedRecords.length;
    const avgDriverPressure = sortedRecords.reduce((sum, record) => sum + record.driverPressure, 0) / sortedRecords.length;
    const avgDefenseEffectiveness =
      defenseRecords.length > 0
        ? defenseRecords.reduce((sum, record) => sum + record.defenseEffectiveness, 0) / defenseRecords.length
        : 0;
    const climbReadiness =
      sortedRecords.reduce((sum, record) => sum + getClimbReadiness(record.climbLevel), 0) / sortedRecords.length;
    const averagePenalty =
      sortedRecords.reduce((sum, record) => sum + getRecordPenalty(record), 0) / sortedRecords.length;
    const reliabilityScore = clamp(10 - averagePenalty, 0, 10);
    const syntheticScore = clamp(
      avgAutoFluidity * 0.2 +
        avgTeleopFluidity * 0.25 +
        avgDriverPressure * 0.2 +
        avgDefenseEffectiveness * 0.1 +
        climbReadiness * 0.15 +
        reliabilityScore * 0.1,
      0,
      10
    );

    metrics[teamNumber] = {
      teamNumber,
      matchesLogged: sortedRecords.length,
      avgAutoFluidity,
      avgTeleopFluidity,
      avgDriverPressure,
      avgDefenseEffectiveness,
      climbReadiness,
      reliabilityScore,
      syntheticScore,
      syntheticHistory: sortedRecords.map((record, index) => ({
        match: getMatchSequenceNumber(record, index),
        syntheticScore: Number(getSyntheticScoreForRecord(record).toFixed(2))
      }))
    };
  });

  return metrics;
};

const solveRidgeRegressionFromAtA = (atA: Matrix, atB: Matrix, lambda: number) => {
  const lambdaI = Matrix.eye(atA.columns).mul(lambda);
  const regularized = atA.add(lambdaI);

  try {
    return solve(regularized, atB).to1DArray();
  } catch (error) {
    console.error('Legacy OPRc solve failed', error);
    return new Array(atA.columns).fill(0);
  }
};

export const calculateLegacyOprcRatings = (
  tbaMatches: TBAMatch[],
  lambda: number = 0.1
): Record<string, number> => {
  const playedMatches = [...tbaMatches]
    .filter(match => match.alliances.red.score !== -1 && match.alliances.blue.score !== -1)
    .sort((a, b) => getMatchSortTimestamp(a) - getMatchSortTimestamp(b));

  const teamSet = new Set<string>();
  playedMatches.forEach(match => {
    match.alliances.red.team_keys.forEach(teamKey => teamSet.add(normalizeTeamKey(teamKey)));
    match.alliances.blue.team_keys.forEach(teamKey => teamSet.add(normalizeTeamKey(teamKey)));
  });

  const teams = Array.from(teamSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (teams.length === 0) return {};

  const teamToIndex = new Map<string, number>();
  teams.forEach((team, index) => teamToIndex.set(team, index));

  const oprcSums = new Map<string, number>();
  const oprcCounts = new Map<string, number>();
  teams.forEach(team => {
    oprcSums.set(team, 0);
    oprcCounts.set(team, 0);
  });

  let rollingAtA = Matrix.zeros(teams.length, teams.length);
  let rollingAtB = Matrix.zeros(teams.length, 1);
  let matchesProcessed = 0;

  const updateRollingMatrices = (teamKeys: string[], score: number) => {
    const indices = teamKeys
      .map(normalizeTeamKey)
      .map(team => teamToIndex.get(team))
      .filter((index): index is number => index !== undefined);

    indices.forEach(i => {
      rollingAtB.set(i, 0, rollingAtB.get(i, 0) + score);
      indices.forEach(j => {
        rollingAtA.set(i, j, rollingAtA.get(i, j) + 1);
      });
    });
  };

  const processAlliance = (teamKeys: string[], allianceScore: number, currentOprs: number[]) => {
    const normalizedTeamKeys = teamKeys.map(normalizeTeamKey);
    normalizedTeamKeys.forEach(teamNumber => {
      const expectedPartnerScore = normalizedTeamKeys
        .filter(partner => partner !== teamNumber)
        .reduce((sum, partner) => {
          const partnerIndex = teamToIndex.get(partner);
          return sum + (partnerIndex !== undefined ? currentOprs[partnerIndex] ?? 0 : 0);
        }, 0);

      const oprc = allianceScore - expectedPartnerScore;
      oprcSums.set(teamNumber, (oprcSums.get(teamNumber) ?? 0) + oprc);
      oprcCounts.set(teamNumber, (oprcCounts.get(teamNumber) ?? 0) + 1);
    });
  };

  playedMatches.forEach(match => {
    const currentOprs =
      matchesProcessed > 0
        ? solveRidgeRegressionFromAtA(rollingAtA, rollingAtB, lambda)
        : new Array(teams.length).fill(0);

    processAlliance(match.alliances.red.team_keys, match.alliances.red.score, currentOprs);
    processAlliance(match.alliances.blue.team_keys, match.alliances.blue.score, currentOprs);

    updateRollingMatrices(match.alliances.red.team_keys, match.alliances.red.score);
    updateRollingMatrices(match.alliances.blue.team_keys, match.alliances.blue.score);
    matchesProcessed += 1;
  });

  return teams.reduce<Record<string, number>>((accumulator, team) => {
    const count = oprcCounts.get(team) ?? 0;
    accumulator[team] = count > 0 ? (oprcSums.get(team) ?? 0) / count : 0;
    return accumulator;
  }, {});
};

export const calculateLegacyOprRatings = (
  tbaMatches: TBAMatch[],
  lambda: number = 0.1
): Record<string, number> => {
  const playedMatches = [...tbaMatches]
    .filter(match => match.alliances.red.score !== -1 && match.alliances.blue.score !== -1)
    .sort((a, b) => getMatchSortTimestamp(a) - getMatchSortTimestamp(b));

  const teamSet = new Set<string>();
  playedMatches.forEach(match => {
    match.alliances.red.team_keys.forEach(teamKey => teamSet.add(normalizeTeamKey(teamKey)));
    match.alliances.blue.team_keys.forEach(teamKey => teamSet.add(normalizeTeamKey(teamKey)));
  });

  const teams = Array.from(teamSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (teams.length === 0) return {};

  const teamToIndex = new Map<string, number>();
  teams.forEach((team, index) => teamToIndex.set(team, index));

  const atA = Matrix.zeros(teams.length, teams.length);
  const atB = Matrix.zeros(teams.length, 1);

  const processAlliance = (teamKeys: string[], allianceScore: number) => {
    const indices = teamKeys
      .map(normalizeTeamKey)
      .map(team => teamToIndex.get(team))
      .filter((index): index is number => index !== undefined);

    indices.forEach(i => {
      atB.set(i, 0, atB.get(i, 0) + allianceScore);
      indices.forEach(j => {
        atA.set(i, j, atA.get(i, j) + 1);
      });
    });
  };

  playedMatches.forEach(match => {
    processAlliance(match.alliances.red.team_keys, match.alliances.red.score);
    processAlliance(match.alliances.blue.team_keys, match.alliances.blue.score);
  });

  const oprValues = solveRidgeRegressionFromAtA(atA, atB, lambda);
  return teams.reduce<Record<string, number>>((accumulator, team, index) => {
    accumulator[team] = oprValues[index] ?? 0;
    return accumulator;
  }, {});
};

export const calculateLegacyDprRatings = (
  tbaMatches: TBAMatch[],
  lambda: number = 0.1
): Record<string, number> => {
  const playedMatches = [...tbaMatches]
    .filter(match => match.alliances.red.score !== -1 && match.alliances.blue.score !== -1)
    .sort((a, b) => getMatchSortTimestamp(a) - getMatchSortTimestamp(b));

  const teamSet = new Set<string>();
  playedMatches.forEach(match => {
    match.alliances.red.team_keys.forEach(teamKey => teamSet.add(normalizeTeamKey(teamKey)));
    match.alliances.blue.team_keys.forEach(teamKey => teamSet.add(normalizeTeamKey(teamKey)));
  });

  const teams = Array.from(teamSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (teams.length === 0) return {};

  const teamToIndex = new Map<string, number>();
  teams.forEach((team, index) => teamToIndex.set(team, index));

  const atA = Matrix.zeros(teams.length, teams.length);
  const atB = Matrix.zeros(teams.length, 1);

  const processAllianceDefense = (defendingTeamKeys: string[], opponentAllianceScore: number) => {
    const indices = defendingTeamKeys
      .map(normalizeTeamKey)
      .map(team => teamToIndex.get(team))
      .filter((index): index is number => index !== undefined);

    indices.forEach(i => {
      atB.set(i, 0, atB.get(i, 0) + opponentAllianceScore);
      indices.forEach(j => {
        atA.set(i, j, atA.get(i, j) + 1);
      });
    });
  };

  playedMatches.forEach(match => {
    processAllianceDefense(match.alliances.red.team_keys, match.alliances.blue.score);
    processAllianceDefense(match.alliances.blue.team_keys, match.alliances.red.score);
  });

  const dprValues = solveRidgeRegressionFromAtA(atA, atB, lambda);
  return teams.reduce<Record<string, number>>((accumulator, team, index) => {
    accumulator[team] = dprValues[index] ?? 0;
    return accumulator;
  }, {});
};

export class MathEngine {
  private tbaApiKey: string;

  constructor(tbaApiKey: string) {
    this.tbaApiKey = tbaApiKey;
  }

  async fetchEventMatches(eventKey: string, options?: { includeUnplayed?: boolean }): Promise<TBAMatch[]> {
    const includeUnplayed = options?.includeUnplayed ?? false;
    if (!this.tbaApiKey) {
      console.warn('No TBA API Key provided. Math Engine cannot fetch matches.');
      throw new Error(TBA_KEY_MISSING_MESSAGE);
    }

    if (eventKey === 'TEST') {
      console.log('Test event selected, skipping TBA fetch.');
      return [];
    }

    try {
      const normalizedEventKey = eventKey.toLowerCase();
      const response = await fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/matches`, {
        headers: {
          'X-TBA-Auth-Key': this.tbaApiKey
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw buildTbaHttpError('TBA matches', response.status, response.statusText, errorText);
      }
      const matches: TBAMatch[] = await response.json();

      const sortedMatches = [...matches].sort((a, b) => getMatchSortTimestamp(a) - getMatchSortTimestamp(b));
      const selectedMatches = includeUnplayed
        ? sortedMatches
        : sortedMatches.filter(match => match.alliances.red.score !== -1 && match.alliances.blue.score !== -1);

      if (selectedMatches.length === 0) {
        throw new Error('ERROR: No Matches Found');
      }

      return selectedMatches;
    } catch (error) {
      console.error('Failed to fetch TBA matches:', error);
      throw error;
    }
  }

  public calculateMetrics(
    tbaMatches: TBAMatch[],
    scoutingData: MatchScoutingV2[],
    _lambda: number = 0.1
  ): Record<string, TeamMetrics> {
    const playedMatches = [...tbaMatches]
      .filter(match => match.alliances.red.score !== -1 && match.alliances.blue.score !== -1)
      .sort((a, b) => getMatchSortTimestamp(a) - getMatchSortTimestamp(b));

    const teamSet = new Set<string>();
    playedMatches.forEach(match => {
      match.alliances.red.team_keys.forEach(teamKey => teamSet.add(normalizeTeamKey(teamKey)));
      match.alliances.blue.team_keys.forEach(teamKey => teamSet.add(normalizeTeamKey(teamKey)));
    });

    const teams = Array.from(teamSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    if (teams.length === 0) return {};

    const subjectiveSummary = getSubjectiveSummaryLookup(teams, scoutingData);
    const matchFluidityLookup = getMatchFluidityLookup(scoutingData);
    const rollingFluidity = new Map<string, RollingFluidityState>();
    const teamStates = new Map<string, MutableTeamState>();

    teams.forEach(team => {
      rollingFluidity.set(team, { autoSum: 0, teleopSum: 0, count: 0 });
      teamStates.set(team, getInitialMutableState());
    });

    playedMatches.forEach(match => {
      const matchAliases = getMatchAliases(match);
      const snapshots = new Map<string, TeamStateSnapshot>();
      teams.forEach(team => {
        snapshots.set(team, getStateSnapshot(teamStates.get(team)!));
      });

      const applyAllianceUpdate = (
        allianceTeamKeys: string[],
        allianceScore: number,
        breakdown?: {
          autoPoints?: number;
          teleopPoints?: number;
          endGameTotalStagePoints?: number;
          endGamePoints?: number;
        }
      ) => {
        const normalizedTeamKeys = allianceTeamKeys.map(normalizeTeamKey);
        const autoScore = breakdown?.autoPoints ?? 0;
        const teleopScore = breakdown?.teleopPoints ?? 0;
        const endgameScore = getEndgamePoints(breakdown);

        normalizedTeamKeys.forEach(teamNumber => {
          const currentState = teamStates.get(teamNumber);
          const currentSnapshot = snapshots.get(teamNumber);
          if (!currentState || !currentSnapshot) return;

          const partnerKeys = normalizedTeamKeys.filter(partner => partner !== teamNumber);
          const expectedPartnerEPA = partnerKeys.reduce(
            (sum, partner) => sum + (snapshots.get(partner)?.epa ?? 0),
            0
          );
          const expectedPartnerEPAc = partnerKeys.reduce(
            (sum, partner) => sum + (snapshots.get(partner)?.epac ?? 0),
            0
          );
          const expectedPartnerAutoEpac = partnerKeys.reduce(
            (sum, partner) => sum + (snapshots.get(partner)?.autoEpac ?? 0),
            0
          );
          const expectedPartnerTeleopEpac = partnerKeys.reduce(
            (sum, partner) => sum + (snapshots.get(partner)?.teleopEpac ?? 0),
            0
          );
          const expectedPartnerEndgameEpac = partnerKeys.reduce(
            (sum, partner) => sum + (snapshots.get(partner)?.endgameEpac ?? 0),
            0
          );

          const matchFluidity = getTeamMatchFluidity(teamNumber, matchAliases, matchFluidityLookup);
          const rollingTeamFluidity = rollingFluidity.get(teamNumber);
          const autoFluidityScore = matchFluidity?.autoScore ?? getRollingFluidityScore(rollingTeamFluidity);
          const teleopFluidityScore = matchFluidity?.teleopScore ?? getRollingTeleopScore(rollingTeamFluidity);
          const overallFluidityScore = (autoFluidityScore + teleopFluidityScore) / 2;

          const contributionEPA = allianceScore - expectedPartnerEPA;
          const contributionEPAc = allianceScore - expectedPartnerEPAc;
          const autoContributionEPAc = autoScore - expectedPartnerAutoEpac;
          const teleopContributionEPAc = teleopScore - expectedPartnerTeleopEpac;
          const endgameContributionEPAc = endgameScore - expectedPartnerEndgameEpac;

          currentState.epa =
            currentSnapshot.epa * (1 - EPAC_K_FACTOR) + contributionEPA * EPAC_K_FACTOR;
          currentState.epac =
            currentSnapshot.epac * (1 - EPAC_K_FACTOR) +
            contributionEPAc * EPAC_K_FACTOR * getFluencyModifier(overallFluidityScore);
          currentState.autoEpac =
            currentSnapshot.autoEpac * (1 - EPAC_K_FACTOR) +
            autoContributionEPAc * EPAC_K_FACTOR * getFluencyModifier(autoFluidityScore);
          currentState.teleopEpac =
            currentSnapshot.teleopEpac * (1 - EPAC_K_FACTOR) +
            teleopContributionEPAc * EPAC_K_FACTOR * getFluencyModifier(teleopFluidityScore);
          currentState.endgameEpac =
            currentSnapshot.endgameEpac * (1 - EPAC_K_FACTOR) +
            endgameContributionEPAc * EPAC_K_FACTOR * getFluencyModifier(overallFluidityScore);

          currentState.matchesPlayed += 1;
          currentState.epacHistory.push({
            match: match.match_number,
            epac: Number(currentState.epac.toFixed(2))
          });

          if (matchFluidity) {
            const nextRollingFluidity = rollingFluidity.get(teamNumber)!;
            nextRollingFluidity.autoSum += matchFluidity.autoScore;
            nextRollingFluidity.teleopSum += matchFluidity.teleopScore;
            nextRollingFluidity.count += 1;
          }
        });
      };

      applyAllianceUpdate(
        match.alliances.red.team_keys,
        match.alliances.red.score,
        match.score_breakdown?.red
      );
      applyAllianceUpdate(
        match.alliances.blue.team_keys,
        match.alliances.blue.score,
        match.score_breakdown?.blue
      );
    });

    const metrics: Record<string, TeamMetrics> = {};
    teams.forEach(team => {
      const state = teamStates.get(team)!;
      const summary = subjectiveSummary.get(team)!;
      const defenseCount = summary.defenseCount || 1;
      const subjectiveCount = summary.count || 1;

      metrics[team] = {
        teamNumber: team,
        epa: state.epa,
        epac: state.epac,
        autoEpac: state.autoEpac,
        teleopEpac: state.teleopEpac,
        endgameEpac: state.endgameEpac,
        epacHistory: state.epacHistory,
        avgAutoFluidity: summary.auto / subjectiveCount,
        avgTeleopFluidity: summary.teleop / subjectiveCount,
        avgDriverPressure: summary.pressure / subjectiveCount,
        avgDefenseEffectiveness: summary.defense / defenseCount,
        matchesPlayed: state.matchesPlayed
      };
    });

    return metrics;
  }
}
