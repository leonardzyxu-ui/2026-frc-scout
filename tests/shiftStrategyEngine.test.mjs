import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareAllianceStrategies,
  enumerateAllianceRolePlans,
  probabilityAtLeast
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

  assert.equal(best.rawDefenseMean, 150);
  assert.equal(best.saturatedDefenseMean, 100);
  assert.equal(best.assignments.filter(assignment => assignment.role === 'defense').length, 1);
  assert.match(best.saturationWarning, /Defense capped/);
});

test('match strategy reports win probability and ranking point probabilities', () => {
  const result = compareAllianceStrategies(
    [
      { teamNumber: '254', contribution: 60, contributionDeviation: 8, defense: 20, defenseDeviation: 4 },
      { teamNumber: '1678', contribution: 55, contributionDeviation: 7, defense: 18, defenseDeviation: 4 },
      { teamNumber: '971', contribution: 35, contributionDeviation: 5, defense: 12, defenseDeviation: 3 }
    ],
    [
      { teamNumber: '1323', contribution: 40, contributionDeviation: 7, defense: 15, defenseDeviation: 5 },
      { teamNumber: '5940', contribution: 36, contributionDeviation: 6, defense: 10, defenseDeviation: 3 },
      { teamNumber: '4414', contribution: 32, contributionDeviation: 6, defense: 9, defenseDeviation: 3 }
    ]
  );

  assert.ok(result.redWinProbability > 0.5);
  assert.ok(result.redEnergizedProbability > result.redSuperchargedProbability);
  assert.equal(Number.isFinite(result.marginDeviation), true);
});

test('normal tail probability handles deterministic thresholds', () => {
  assert.equal(probabilityAtLeast(100, 0, 100), 1);
  assert.equal(probabilityAtLeast(99, 0, 100), 0);
});
