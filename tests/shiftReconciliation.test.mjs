import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFirstShiftCorrectionNotice,
  buildFirstShiftReportsFromMatchScoutingV4,
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

test('first-shift correction notice targets only scouts assigned to that match', () => {
  const notice = buildFirstShiftCorrectionNotice({
    matchKey: 'qm12',
    reports: [
      { scoutName: 'Scout A', firstShiftAlliance: 'Red' },
      { scoutName: 'Scout B', firstShiftAlliance: 'Blue' },
      { scoutName: 'Scout C', firstShiftAlliance: 'Red' }
    ],
    assignedScoutNames: ['Scout A', 'Scout B', 'Scout C', 'Scout D', 'Scout E', 'Scout F']
  });

  assert.ok(notice);
  assert.equal(notice.matchKey, 'QM12');
  assert.equal(notice.severity, 'action_required');
  assert.deepEqual(notice.targetScoutNames, ['Scout A', 'Scout B', 'Scout C', 'Scout D', 'Scout E', 'Scout F']);
  assert.match(notice.message, /Red 2 \/ Blue 1/);
  assert.deepEqual(notice.options, ['Red', 'Blue']);
});

test('first-shift correction notice is not created when scouts agree', () => {
  const notice = buildFirstShiftCorrectionNotice({
    matchKey: 'qm13',
    reports: [
      { scoutName: 'Scout A', firstShiftAlliance: 'Blue' },
      { scoutName: 'Scout B', firstShiftAlliance: 'Blue' }
    ]
  });

  assert.equal(notice, null);
});

test('Match Scout V4 first-shift metadata feeds the correction workflow', () => {
  const reports = buildFirstShiftReportsFromMatchScoutingV4([
    { scoutName: 'Device A', assignedScoutName: 'Scout A', teleopFirstShiftAlliance: 'Red' },
    { scoutName: 'Device B', assignedScoutName: 'Scout B', teleopFirstShiftAlliance: 'Blue' },
    { scoutName: 'Device C', assignedScoutName: 'Scout C', teleopFirstShiftAlliance: 'Red' }
  ]);
  const notice = buildFirstShiftCorrectionNotice({
    matchKey: 'qm14',
    reports
  });

  assert.deepEqual(reports, [
    { scoutName: 'Scout A', firstShiftAlliance: 'Red' },
    { scoutName: 'Scout B', firstShiftAlliance: 'Blue' },
    { scoutName: 'Scout C', firstShiftAlliance: 'Red' }
  ]);
  assert.ok(notice);
  assert.equal(notice.consensus, 'Red');
  assert.deepEqual(notice.targetScoutNames, ['Scout A', 'Scout B', 'Scout C']);
  assert.match(notice.message, /QM14/);
});
