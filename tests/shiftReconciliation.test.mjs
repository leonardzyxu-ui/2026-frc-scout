import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFirstShiftConsensus,
  normalizeDefenseShares,
  reconcileAllianceContributions
} from '../src/utils/shiftReconciliation.ts';

test('official score reconciliation preserves contribution ratios', () => {
  const reconciliation = reconcileAllianceContributions([
    { teamNumber: '254', rawContribution: 40 },
    { teamNumber: '1678', rawContribution: 40 },
    { teamNumber: '971', rawContribution: 20 }
  ], 150);

  assert.equal(reconciliation.rawTotal, 100);
  assert.equal(reconciliation.scaleFactor, 1.5);
  assert.deepEqual(
    reconciliation.rows.map(row => row.adjustedContribution),
    [60, 60, 30]
  );
});

test('official score reconciliation flags unallocated official points', () => {
  const reconciliation = reconcileAllianceContributions([
    { teamNumber: '254', rawContribution: 0 }
  ], 42);

  assert.equal(reconciliation.unallocatedPoints, 42);
  assert.match(reconciliation.warnings.join(' '), /no allocatable contribution/i);
});

test('defense share normalization preserves ratio when scouts do not sum to 100', () => {
  const normalization = normalizeDefenseShares('1678', [
    { defenderTeamNumber: '254', targetTeamNumber: '1678', claimedSharePercent: 60 },
    { defenderTeamNumber: '971', targetTeamNumber: '1678', claimedSharePercent: 80 }
  ]);

  assert.equal(Math.round(normalization.rows[0].normalizedSharePercent), 43);
  assert.equal(Math.round(normalization.rows[1].normalizedSharePercent), 57);
  assert.match(normalization.warnings.join(' '), /normalized to 100/i);
});

test('first-shift consensus detects scout disagreement for match-specific notification', () => {
  const consensus = detectFirstShiftConsensus([
    { scoutName: 'Scout A', firstShiftAlliance: 'Red' },
    { scoutName: 'Scout B', firstShiftAlliance: 'Blue' },
    { scoutName: 'Scout C', firstShiftAlliance: 'Red' }
  ]);

  assert.equal(consensus.consensus, 'Red');
  assert.equal(consensus.needsScoutCorrection, true);
  assert.deepEqual(consensus.affectedScouts, ['Scout A', 'Scout B', 'Scout C']);
});
