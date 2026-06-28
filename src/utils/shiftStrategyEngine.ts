import { combineIndependentStdDevs } from './shiftMetricContract.ts';

export type ShiftStrategyRole = 'offense' | 'defense' | 'stockpile';

export interface ShiftStrategyTeamInput {
  teamNumber: string;
  contribution: number;
  contributionDeviation: number;
  defense: number;
  defenseDeviation: number;
}

export interface ShiftStrategyAssignment {
  teamNumber: string;
  role: ShiftStrategyRole;
  mean: number;
  deviation: number;
}

export interface ShiftAllianceRolePlan {
  label: string;
  assignments: ShiftStrategyAssignment[];
  offenseMean: number;
  rawDefenseMean: number;
  saturatedDefenseMean: number;
  pointDifferenceMean: number;
  pointDifferenceDeviation: number;
  offenseCostMean: number;
  stockpileMultiplier: number;
  saturationWarning: string | null;
}

export interface ShiftMatchStrategyResult {
  redBestPlan: ShiftAllianceRolePlan;
  blueBestPlan: ShiftAllianceRolePlan;
  redPlans: ShiftAllianceRolePlan[];
  bluePlans: ShiftAllianceRolePlan[];
  expectedRedScore: number;
  expectedBlueScore: number;
  expectedMargin: number;
  marginDeviation: number;
  redWinProbability: number;
  blueWinProbability: number;
  redEnergizedProbability: number;
  blueEnergizedProbability: number;
  redSuperchargedProbability: number;
  blueSuperchargedProbability: number;
  warnings: string[];
}

export interface ShiftStrategyOptions {
  stockpileBoostPerRobot?: number;
  stockpileDeviationScale?: number;
  defenseDuringOwnShiftCredit?: number;
  energizedThreshold?: number;
  superchargedThreshold?: number;
}

const DEFAULT_OPTIONS = {
  stockpileBoostPerRobot: 0.08,
  stockpileDeviationScale: 0.5,
  defenseDuringOwnShiftCredit: 0.1,
  energizedThreshold: 100,
  superchargedThreshold: 360
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const normalCdf = (value: number) => {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
};

export const probabilityAtLeast = (mean: number, deviation: number, threshold: number) => {
  if (deviation <= 0) return mean >= threshold ? 1 : 0;
  return 1 - normalCdf((threshold - mean) / deviation);
};

const enumerateRoleCombos = (teams: ShiftStrategyTeamInput[]) => {
  const roles: ShiftStrategyRole[] = ['offense', 'defense', 'stockpile'];
  const combos: ShiftStrategyRole[][] = [[]];
  teams.forEach(() => {
    const next: ShiftStrategyRole[][] = [];
    combos.forEach(combo => {
      roles.forEach(role => next.push([...combo, role]));
    });
    combos.splice(0, combos.length, ...next);
  });
  return combos;
};

const formatPlanLabel = (assignments: ShiftStrategyAssignment[]) =>
  assignments
    .map(assignment => `${assignment.teamNumber} ${assignment.role}`)
    .join(', ');

export const enumerateAllianceRolePlans = (
  teams: ShiftStrategyTeamInput[],
  opponentAvailableOffense: number,
  options: ShiftStrategyOptions = {}
): ShiftAllianceRolePlan[] => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const maxOpponentOffense = Math.max(0, opponentAvailableOffense);
  const allOffenseMean = teams.reduce((sum, team) => sum + Math.max(0, team.contribution), 0);

  return enumerateRoleCombos(teams)
    .map(combo => {
      const stockpileCount = combo.filter(role => role === 'stockpile').length;
      const stockpileMultiplier = 1 + stockpileCount * mergedOptions.stockpileBoostPerRobot;
      const offenseBase = teams.reduce((sum, team, index) => (
        combo[index] === 'offense' ? sum + Math.max(0, team.contribution) : sum
      ), 0);
      const offenseMean = offenseBase * stockpileMultiplier;
      const rawDefenseMean = teams.reduce((sum, team, index) => {
        if (combo[index] === 'defense') return sum + Math.max(0, team.defense);
        return sum;
      }, 0);
      const saturatedDefenseMean = Math.min(rawDefenseMean, maxOpponentOffense);
      const saturationWarning = rawDefenseMean > maxOpponentOffense && maxOpponentOffense > 0
        ? `Defense capped from ${rawDefenseMean.toFixed(1)} to ${saturatedDefenseMean.toFixed(1)} because the opponent cannot lose more offense than it has.`
        : null;

      const assignments = teams.map<ShiftStrategyAssignment>((team, index) => {
        const role = combo[index] || 'offense';
        if (role === 'defense') {
          return {
            teamNumber: team.teamNumber,
            role,
            mean: Math.max(0, team.defense),
            deviation: Math.max(0, team.defenseDeviation)
          };
        }
        if (role === 'stockpile') {
          return {
            teamNumber: team.teamNumber,
            role,
            mean: Math.max(0, team.contribution) * mergedOptions.stockpileBoostPerRobot,
            deviation: Math.max(0, team.contributionDeviation) * mergedOptions.stockpileDeviationScale
          };
        }
        return {
          teamNumber: team.teamNumber,
          role,
          mean: Math.max(0, team.contribution),
          deviation: Math.max(0, team.contributionDeviation)
        };
      });

      return {
        label: formatPlanLabel(assignments),
        assignments,
        offenseMean,
        rawDefenseMean,
        saturatedDefenseMean,
        pointDifferenceMean: offenseMean + saturatedDefenseMean,
        pointDifferenceDeviation: combineIndependentStdDevs(assignments.map(assignment => assignment.deviation)),
        offenseCostMean: Math.max(0, allOffenseMean - offenseMean),
        stockpileMultiplier,
        saturationWarning
      };
    })
    .sort((left, right) =>
      right.pointDifferenceMean - left.pointDifferenceMean ||
      right.offenseMean - left.offenseMean ||
      left.pointDifferenceDeviation - right.pointDifferenceDeviation
    );
};

export const compareAllianceStrategies = (
  redTeams: ShiftStrategyTeamInput[],
  blueTeams: ShiftStrategyTeamInput[],
  options: ShiftStrategyOptions = {}
): ShiftMatchStrategyResult => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const redAvailableOffense = redTeams.reduce((sum, team) => sum + Math.max(0, team.contribution), 0);
  const blueAvailableOffense = blueTeams.reduce((sum, team) => sum + Math.max(0, team.contribution), 0);
  const redPlans = enumerateAllianceRolePlans(redTeams, blueAvailableOffense, mergedOptions);
  const bluePlans = enumerateAllianceRolePlans(blueTeams, redAvailableOffense, mergedOptions);
  const redBestPlan = redPlans[0]!;
  const blueBestPlan = bluePlans[0]!;
  const expectedRedScore = Math.max(0, redBestPlan.offenseMean - blueBestPlan.saturatedDefenseMean);
  const expectedBlueScore = Math.max(0, blueBestPlan.offenseMean - redBestPlan.saturatedDefenseMean);
  const expectedMargin = redBestPlan.pointDifferenceMean - blueBestPlan.pointDifferenceMean;
  const marginDeviation = combineIndependentStdDevs([
    redBestPlan.pointDifferenceDeviation,
    blueBestPlan.pointDifferenceDeviation
  ]);
  const redWinProbability = marginDeviation <= 0
    ? expectedMargin === 0 ? 0.5 : expectedMargin > 0 ? 1 : 0
    : clamp(normalCdf(expectedMargin / marginDeviation), 0.01, 0.99);

  return {
    redBestPlan,
    blueBestPlan,
    redPlans,
    bluePlans,
    expectedRedScore,
    expectedBlueScore,
    expectedMargin,
    marginDeviation,
    redWinProbability,
    blueWinProbability: 1 - redWinProbability,
    redEnergizedProbability: probabilityAtLeast(expectedRedScore, redBestPlan.pointDifferenceDeviation, mergedOptions.energizedThreshold),
    blueEnergizedProbability: probabilityAtLeast(expectedBlueScore, blueBestPlan.pointDifferenceDeviation, mergedOptions.energizedThreshold),
    redSuperchargedProbability: probabilityAtLeast(expectedRedScore, redBestPlan.pointDifferenceDeviation, mergedOptions.superchargedThreshold),
    blueSuperchargedProbability: probabilityAtLeast(expectedBlueScore, blueBestPlan.pointDifferenceDeviation, mergedOptions.superchargedThreshold),
    warnings: [redBestPlan.saturationWarning, blueBestPlan.saturationWarning].filter((warning): warning is string => !!warning)
  };
};
