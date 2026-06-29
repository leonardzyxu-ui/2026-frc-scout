import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareAllianceStrategies,
  enumerateAllianceRolePlans,
  probabilityAtLeast,
  rankAllianceSelectionCombinations,
  selectAllianceRolePlan
} from '../src/utils/shiftStrategyEngine.ts';

test('alliance role planner can choose two defenders when that maximizes point difference', () => {
  const plans = enumerateAllianceRolePlans([
    { teamNumber: '1', contribution: 15, contributionDeviation: 2, defense: 70, defenseDeviation: 6 },
    { teamNumber: '2', contribution: 20, contributionDeviation: 2, defense: 80, defenseDeviation: 7 },
    { teamNumber: '3', contribution: 55, contributionDeviation: 5, defense: 5, defenseDeviation: 1 }
  ], 200);

  const best = plans[0];
  assert.equal(best.assignments.filter(assignment => assignment.role === 'defense').length, 2);
  assert.equal(best.assignments.find(assignment => assignment.teamNumber === '3').role, 'offense');
});

test('defense is saturated by opponent available offense without wasting extra defenders', () => {
  const best = enumerateAllianceRolePlans([
    { teamNumber: '1', contribution: 0, contributionDeviation: 0, defense: 150, defenseDeviation: 4 },
    { teamNumber: '2', contribution: 0, contributionDeviation: 0, defense: 150, defenseDeviation: 4 },
    { teamNumber: '3', contribution: 0, contributionDeviation: 0, defense: 150, defenseDeviation: 4 }
  ], 100)[0];

  assert.equal(best.rawDefenseMean, 165);
  assert.equal(best.saturatedDefenseMean, 100);
  assert.equal(best.assignments.filter(assignment => assignment.role === 'defense').length, 2);
  assert.match(best.saturationWarning, /Credited defense capped/);
});

test('defenseDuringOwnShiftCredit changes full-match defense strategy value', () => {
  const teams = [
    { teamNumber: 'swing-defender', contribution: 60, contributionDeviation: 4, defense: 100, defenseDeviation: 8 },
    { teamNumber: 'scorer', contribution: 50, contributionDeviation: 4, defense: 0, defenseDeviation: 0 }
  ];
  const lowOwnShiftCredit = enumerateAllianceRolePlans(teams, 200, { defenseDuringOwnShiftCredit: 0 })[0];
  const fullOwnShiftCredit = enumerateAllianceRolePlans(teams, 200, { defenseDuringOwnShiftCredit: 1 })[0];

  assert.equal(lowOwnShiftCredit.assignments.every(assignment => assignment.role === 'offense'), true);
  assert.equal(
    fullOwnShiftCredit.assignments.find(assignment => assignment.teamNumber === 'swing-defender')?.role,
    'defense'
  );
  assert.ok(fullOwnShiftCredit.rawDefenseMean > lowOwnShiftCredit.rawDefenseMean);
});

test('match strategy reports win probability and ranking point probabilities', () => {
  const result = compareAllianceStrategies(
    [
      { teamNumber: '254', contribution: 60, contributionDeviation: 8, defense: 20, defenseDeviation: 4, traversal: 25, traversalDeviation: 3 },
      { teamNumber: '1678', contribution: 55, contributionDeviation: 7, defense: 18, defenseDeviation: 4, traversal: 20, traversalDeviation: 3 },
      { teamNumber: '971', contribution: 35, contributionDeviation: 5, defense: 12, defenseDeviation: 3, traversal: 15, traversalDeviation: 2 }
    ],
    [
      { teamNumber: '1323', contribution: 40, contributionDeviation: 7, defense: 15, defenseDeviation: 5 },
      { teamNumber: '5940', contribution: 36, contributionDeviation: 6, defense: 10, defenseDeviation: 3 },
      { teamNumber: '4414', contribution: 32, contributionDeviation: 6, defense: 9, defenseDeviation: 3 }
    ]
  );

  assert.ok(result.redWinProbability > 0.5);
  assert.ok(result.redTraversalProbability > 0.5);
  assert.ok(result.redEnergizedProbability > result.redSuperchargedProbability);
  assert.equal(Number.isFinite(result.marginDeviation), true);
});

test('normal tail probability handles deterministic thresholds', () => {
  assert.equal(probabilityAtLeast(100, 0, 100), 1);
  assert.equal(probabilityAtLeast(99, 0, 100), 0);
});

test('stockpile support never becomes direct points without an offense robot', () => {
  const best = enumerateAllianceRolePlans([
    { teamNumber: '1', contribution: 0, contributionDeviation: 0, defense: 0, defenseDeviation: 0 },
    { teamNumber: '2', contribution: 0, contributionDeviation: 0, defense: 0, defenseDeviation: 0 },
    { teamNumber: '3', contribution: 0, contributionDeviation: 0, defense: 0, defenseDeviation: 0 }
  ], 0, { stockpileBoostPerRobot: 0.5 })[0];

  assert.equal(best.offenseMean, 0);
  assert.equal(best.pointDifferenceMean, 0);
  assert.equal(best.assignments.every(assignment => assignment.mean === 0), true);
});

test('qualification objective can choose RP threshold over pure point-difference margin', () => {
  const plans = enumerateAllianceRolePlans([
    { teamNumber: 'floor', contribution: 99, contributionDeviation: 1, defense: 0, defenseDeviation: 0 },
    { teamNumber: 'rp-helper', contribution: 10, contributionDeviation: 1, defense: 50, defenseDeviation: 1 }
  ], 200, { strategyObjective: 'point-difference' });
  const marginPlan = selectAllianceRolePlan(plans, { strategyObjective: 'point-difference' });
  const rpPlan = selectAllianceRolePlan(plans, { strategyObjective: 'qualification-rp', rpUtilityWeight: 300, energizedThreshold: 100 });

  assert.ok(marginPlan.pointDifferenceMean > rpPlan.pointDifferenceMean);
  assert.ok(rpPlan.energizedProbability > marginPlan.energizedProbability);
  assert.equal(rpPlan.assignments.every(assignment => assignment.role === 'offense'), true);
});

test('variance-gamble objective can choose a lower-mean higher-variance plan when trailing', () => {
  const safePlan = {
    label: 'safe',
    pointDifferenceMean: 100,
    pointDifferenceDeviation: 2,
    offenseMean: 100,
    energizedProbability: 1,
    superchargedProbability: 0,
    qualificationUtility: 100,
    varianceGambleUtility: 102,
    allianceSelectionUtility: 100,
    assignments: []
  };
  const swingPlan = {
    ...safePlan,
    label: 'swing',
    pointDifferenceMean: 90,
    pointDifferenceDeviation: 30,
    offenseMean: 90,
    qualificationUtility: 90,
    varianceGambleUtility: 120,
    allianceSelectionUtility: 90
  };

  assert.equal(selectAllianceRolePlan([safePlan, swingPlan], { strategyObjective: 'point-difference' }).label, 'safe');
  assert.equal(selectAllianceRolePlan([safePlan, swingPlan], { strategyObjective: 'variance-gamble', trailingBy: 20, varianceGambleWeight: 1 }).label, 'swing');
});

test('alliance-selection objective ignores RP incentives and ranks by point-difference contribution', () => {
  const pointDiffPlan = {
    label: 'point-diff',
    pointDifferenceMean: 120,
    pointDifferenceDeviation: 8,
    offenseMean: 80,
    energizedProbability: 0.2,
    superchargedProbability: 0,
    qualificationUtility: 120,
    varianceGambleUtility: 120,
    allianceSelectionUtility: 120,
    assignments: []
  };
  const rpPlan = {
    ...pointDiffPlan,
    label: 'rp-bait',
    pointDifferenceMean: 90,
    energizedProbability: 1,
    superchargedProbability: 1,
    qualificationUtility: 500,
    allianceSelectionUtility: 90
  };

  assert.equal(selectAllianceRolePlan([pointDiffPlan, rpPlan], { strategyObjective: 'qualification-rp', rpUtilityWeight: 300 }).label, 'rp-bait');
  assert.equal(selectAllianceRolePlan([pointDiffPlan, rpPlan], { strategyObjective: 'alliance-selection', rpUtilityWeight: 300 }).label, 'point-diff');
});

test('alliance-selection combination ranker chooses the best partner set by role-simulated point difference', () => {
  const rankings = rankAllianceSelectionCombinations({
    lockedTeams: [
      { teamNumber: '254', contribution: 80, contributionDeviation: 8, defense: 20, defenseDeviation: 4 }
    ],
    candidateTeams: [
      { teamNumber: 'safe-rp', contribution: 15, contributionDeviation: 2, defense: 5, defenseDeviation: 1, traversal: 100, traversalDeviation: 1 },
      { teamNumber: 'defender', contribution: 25, contributionDeviation: 4, defense: 80, defenseDeviation: 6 },
      { teamNumber: 'scorer', contribution: 70, contributionDeviation: 7, defense: 10, defenseDeviation: 2 }
    ],
    opponentTeams: [
      { teamNumber: 'opp1', contribution: 90, contributionDeviation: 8, defense: 0, defenseDeviation: 0 },
      { teamNumber: 'opp2', contribution: 60, contributionDeviation: 7, defense: 0, defenseDeviation: 0 },
      { teamNumber: 'opp3', contribution: 30, contributionDeviation: 5, defense: 0, defenseDeviation: 0 }
    ]
  });

  assert.deepEqual(rankings[0].candidateTeamNumbers.sort(), ['defender', 'scorer']);
  assert.equal(rankings[0].rank, 1);
  assert.ok(rankings[0].expectedPointDifferenceContribution > rankings[1].expectedPointDifferenceContribution);
});
