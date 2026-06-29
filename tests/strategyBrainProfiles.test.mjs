import test from 'node:test';
import assert from 'node:assert/strict';
import { mean, standardDeviation } from '../src/utils/shiftMetricContract.ts';
import { buildNonDefenseBaseline } from '../src/utils/nonDefenseBaseline.ts';

test('non-defense baseline uses undefended own-offense shifts before fallback data', () => {
  const baseline = buildNonDefenseBaseline({
    observedTotals: [35, 55, 12],
    records: [
    {
      teamNumber: '254',
      matchKey: 'qm1',
      matchNumber: 1,
      totalMatchPoints: 35,
      reliabilityScore: 1,
      defenderFacedTeamNumber: '',
      shiftBreakdown: [
        { owner: 'own', actions: ['offense'], ballsScored: 30 },
        { owner: 'opponent', actions: ['stockpile'], ballsScored: 0 }
      ]
    },
    {
      teamNumber: '254',
      matchKey: 'qm2',
      matchNumber: 2,
      totalMatchPoints: 55,
      reliabilityScore: 1,
      defenderFacedTeamNumber: '',
      shiftBreakdown: [
        { owner: 'own', actions: ['offense'], ballsScored: 50 }
      ]
    },
    {
      teamNumber: '254',
      matchKey: 'qm3',
      matchNumber: 3,
      totalMatchPoints: 12,
      reliabilityScore: 1,
      defenderFacedTeamNumber: '1678',
      shiftBreakdown: [
        { owner: 'own', actions: ['offense'], ballsScored: 10 }
      ]
    }
    ]
  });

  assert.equal(baseline.source, 'undefended-shifts');
  assert.deepEqual(baseline.samples, [30, 50]);
  assert.equal(mean(baseline.samples), 40);
  assert.equal(standardDeviation(baseline.samples), 10);
});

test('non-defense baseline falls back when every row has incoming-defense evidence', () => {
  const baseline = buildNonDefenseBaseline({
    observedTotals: [20, 40],
    records: [
    {
      teamNumber: '971',
      matchKey: 'qm1',
      matchNumber: 1,
      totalMatchPoints: 20,
      reliabilityScore: 1,
      defenderFacedTeamNumber: '254',
      shiftBreakdown: [
        { owner: 'own', actions: ['offense'], ballsScored: 18 }
      ]
    },
    {
      teamNumber: '971',
      matchKey: 'qm2',
      matchNumber: 2,
      totalMatchPoints: 40,
      reliabilityScore: 1,
      defenderFacedTeamNumber: '1678',
      shiftBreakdown: [
        { owner: 'own', actions: ['offense'], ballsScored: 35 }
      ]
    }
    ]
  });

  assert.equal(baseline.source, 'observed-total-fallback');
  assert.deepEqual(baseline.samples, [20, 40]);
  assert.equal(mean(baseline.samples), 30);
  assert.equal(standardDeviation(baseline.samples), 10);
});
