import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContributionSummary,
  buildDefenseSummary,
  buildShiftMetricContract,
  combineIndependentStdDevs
} from '../src/utils/shiftMetricContract.ts';

test('shift metric contract separates floor, non-zero floor, and contribution deviation', () => {
  const summary = buildContributionSummary([0, 38, 42, 50]);

  assert.equal(summary.contribution, 32.5);
  assert.equal(summary.floor, 0);
  assert.equal(summary.ceiling, 50);
  assert.equal(summary.floorNonZero, 38);
  assert.equal(summary.zeroRate, 0.25);
  assert.ok(summary.contributionDeviation > 18);
});

test('shift metric contract keeps legacy aliases while publishing new names', () => {
  const contract = buildShiftMetricContract({
    teamNumber: '254',
    contributionSamples: [40, 44, 48],
    defenseSamples: [18, 24, 30],
    stockpileShiftCount: 2,
    epa: 51,
    opr: 49,
    dpr: 21
  });

  assert.equal(contract.contribution, 44);
  assert.equal(contract.defense, 24);
  assert.equal(contract.floorNonZero, 40);
  assert.equal(contract.legacyAliases.ppc, contract.contribution);
  assert.equal(contract.legacyAliases.ppaExpected, contract.contribution);
  assert.equal(contract.legacyAliases.ppaFloor, contract.floor);
  assert.equal(contract.legacyAliases.ppaCeiling, contract.ceiling);
  assert.equal(contract.sampleCounts.stockpileShifts, 2);
});

test('independent standard deviations combine by variance, not direct addition', () => {
  assert.equal(combineIndependentStdDevs([3, 4]), 5);
  assert.equal(buildDefenseSummary([10, 10, 10]).defenseDeviation, 0);
});
