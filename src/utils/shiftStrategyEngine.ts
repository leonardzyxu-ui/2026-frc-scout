import { combineIndependentStdDevs } from './shiftMetricContract.ts';

export type ShiftStrategyRole = 'offense' | 'defense' | 'stockpile';
export type ShiftStrategyObjective = 'point-difference' | 'qualification-rp' | 'variance-gamble' | 'alliance-selection';

export interface ShiftStrategyTeamInput {
  teamNumber: string;
  contribution: number;
  contributionDeviation: number;
  defense: number;
  defenseDeviation: number;
  traversal?: number;
  traversalDeviation?: number;
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
  traversalMean: number;
  rawDefenseMean: number;
  saturatedDefenseMean: number;
  pointDifferenceMean: number;
  pointDifferenceDeviation: number;
  offenseCostMean: number;
  stockpileMultiplier: number;
  traversalProbability: number;
  energizedProbability: number;
  superchargedProbability: number;
  qualificationUtility: number;
  varianceGambleUtility: number;
  allianceSelectionUtility: number;
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
  redTraversalProbability: number;
  blueTraversalProbability: number;
  redSuperchargedProbability: number;
  blueSuperchargedProbability: number;
  warnings: string[];
}

export interface ShiftStrategyOptions {
  stockpileBoostPerRobot?: number;
  stockpileDeviationScale?: number;
  defenseDuringOwnShiftCredit?: number;
  energizedThreshold?: number;
  traversalThreshold?: number;
  superchargedThreshold?: number;
  strategyObjective?: ShiftStrategyObjective;
  rpUtilityWeight?: number;
  varianceGambleWeight?: number;
  trailingBy?: number;
}

const DEFAULT_OPTIONS = {
  stockpileBoostPerRobot: 0.08,
  stockpileDeviationScale: 0.5,
  defenseDuringOwnShiftCredit: 0.1,
  energizedThreshold: 100,
  traversalThreshold: 50,
  superchargedThreshold: 360,
  strategyObjective: 'point-difference' as ShiftStrategyObjective,
  rpUtilityWeight: 40,
  varianceGambleWeight: 0.75,
  trailingBy: 0
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

const scorePlanForObjective = (
  plan: ShiftAllianceRolePlan,
  options: Required<Pick<typeof DEFAULT_OPTIONS, 'strategyObjective' | 'rpUtilityWeight' | 'varianceGambleWeight' | 'trailingBy'>>
) => {
  switch (options.strategyObjective) {
    case 'qualification-rp':
      return plan.pointDifferenceMean + (plan.energizedProbability + plan.superchargedProbability) * options.rpUtilityWeight;
    case 'variance-gamble':
      return options.trailingBy > 0
        ? plan.pointDifferenceMean + plan.pointDifferenceDeviation * options.varianceGambleWeight
        : plan.pointDifferenceMean;
    case 'alliance-selection':
    case 'point-difference':
    default:
      return plan.allianceSelectionUtility;
  }
};

export const selectAllianceRolePlan = (
  plans: ShiftAllianceRolePlan[],
  options: ShiftStrategyOptions = {}
) => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  return [...plans].sort((left, right) => {
    const scoreDelta = scorePlanForObjective(right, mergedOptions) - scorePlanForObjective(left, mergedOptions);
    if (scoreDelta !== 0) return scoreDelta;
    return (
      right.pointDifferenceMean - left.pointDifferenceMean ||
      right.offenseMean - left.offenseMean ||
      left.pointDifferenceDeviation - right.pointDifferenceDeviation
    );
  })[0] ?? null;
};

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
      const traversalMean = teams.reduce((sum, team) => sum + Math.max(0, team.traversal ?? 0), 0);
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
      const pointDifferenceDeviation = combineIndependentStdDevs(assignments.map(assignment => assignment.deviation));
      const traversalDeviation = combineIndependentStdDevs(teams.map(team => Math.max(0, team.traversalDeviation ?? 0)));
      const traversalProbability = probabilityAtLeast(traversalMean, traversalDeviation, mergedOptions.traversalThreshold);
      const energizedProbability = probabilityAtLeast(offenseMean, pointDifferenceDeviation, mergedOptions.energizedThreshold);
      const superchargedProbability = probabilityAtLeast(offenseMean, pointDifferenceDeviation, mergedOptions.superchargedThreshold);
      const qualificationUtility = offenseMean
        + saturatedDefenseMean
        + (traversalProbability + energizedProbability + superchargedProbability) * mergedOptions.rpUtilityWeight;
      const varianceGambleUtility = offenseMean
        + saturatedDefenseMean
        + (Math.max(0, mergedOptions.trailingBy) > 0
          ? pointDifferenceDeviation * mergedOptions.varianceGambleWeight
          : 0);

      return {
        label: formatPlanLabel(assignments),
        assignments,
        offenseMean,
        traversalMean,
        rawDefenseMean,
        saturatedDefenseMean,
        pointDifferenceMean: offenseMean + saturatedDefenseMean,
        pointDifferenceDeviation,
        offenseCostMean: Math.max(0, allOffenseMean - offenseMean),
        stockpileMultiplier,
        traversalProbability,
        energizedProbability,
        superchargedProbability,
        qualificationUtility,
        varianceGambleUtility,
        allianceSelectionUtility: offenseMean + saturatedDefenseMean,
        saturationWarning
      };
    })
    .sort((left, right) =>
      scorePlanForObjective(right, { ...DEFAULT_OPTIONS, ...options }) - scorePlanForObjective(left, { ...DEFAULT_OPTIONS, ...options }) ||
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
  const redBestPlan = selectAllianceRolePlan(redPlans, mergedOptions)!;
  const blueBestPlan = selectAllianceRolePlan(bluePlans, mergedOptions)!;
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
    redTraversalProbability: redBestPlan.traversalProbability,
    blueTraversalProbability: blueBestPlan.traversalProbability,
    redSuperchargedProbability: probabilityAtLeast(expectedRedScore, redBestPlan.pointDifferenceDeviation, mergedOptions.superchargedThreshold),
    blueSuperchargedProbability: probabilityAtLeast(expectedBlueScore, blueBestPlan.pointDifferenceDeviation, mergedOptions.superchargedThreshold),
    warnings: [redBestPlan.saturationWarning, blueBestPlan.saturationWarning].filter((warning): warning is string => !!warning)
  };
};
