import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFirstShiftCorrectionNotice,
  buildFirstShiftReportsFromMatchScoutingV4,
  detectFirstShiftConsensus,
  normalizeDefenseShares,
  reconcileAllianceContributions,
  resolveFirstShiftAuthority
} from '../src/utils/shiftReconciliation.ts';

test('official score reconciliation preserves contribution ratios', () => {
  const reconciliation = reconcileAllianceContributions([
    { teamNumber: '254', rawContribution: 40 },
    { teamNumber: '1678', rawContribution: 40 },
    { teamNumber: '971', rawContribution: 20 }
  ], 150);

  assert.equal(reconciliation.rawTotal, 100);
  assert.equal(reconciliation.robotOfficialTotal, 150);
  assert.equal(reconciliation.nonRobotPoints, 0);
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

test('official score reconciliation can zero out robot contribution without leaking points', () => {
  const reconciliation = reconcileAllianceContributions([
    { teamNumber: '254', rawContribution: 40 },
    { teamNumber: '1678', rawContribution: 60 }
  ], 0);

  assert.equal(reconciliation.officialTotal, 0);
  assert.equal(reconciliation.robotOfficialTotal, 0);
  assert.equal(reconciliation.scaleFactor, 0);
  assert.deepEqual(reconciliation.rows.map(row => row.adjustedContribution), [0, 0]);
});

test('official score reconciliation holds penalty or non-robot points outside contribution scaling', () => {
  const reconciliation = reconcileAllianceContributions([
    { teamNumber: '254', rawContribution: 40 },
    { teamNumber: '1678', rawContribution: 60 }
  ], 130, { nonRobotPoints: 30 });

  assert.equal(reconciliation.officialTotal, 130);
  assert.equal(reconciliation.robotOfficialTotal, 100);
  assert.equal(reconciliation.nonRobotPoints, 30);
  assert.equal(reconciliation.scaleFactor, 1);
  assert.deepEqual(reconciliation.rows.map(row => row.adjustedContribution), [40, 60]);
  assert.equal(reconciliation.unallocatedPoints, 30);
  assert.match(reconciliation.warnings.join(' '), /outside robot contribution scaling/i);
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

test('defense share normalization splits all-zero defender shares evenly', () => {
  const normalization = normalizeDefenseShares('1678', [
    { defenderTeamNumber: '254', targetTeamNumber: '1678', claimedSharePercent: 0 },
    { defenderTeamNumber: '971', targetTeamNumber: '1678', claimedSharePercent: 0 },
    { defenderTeamNumber: '604', targetTeamNumber: '1678', claimedSharePercent: 0 }
  ]);

  assert.equal(normalization.rawTotalPercent, 0);
  assert.deepEqual(normalization.rows.map(row => Math.round(row.normalizedSharePercent)), [33, 33, 33]);
  assert.match(normalization.warnings.join(' '), /split evenly/i);
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

test('first-shift correction notice supports arbitrary scout counts', () => {
  const assignedScoutNames = Array.from({ length: 15 }, (_, index) => `Scout ${index + 1}`);
  const notice = buildFirstShiftCorrectionNotice({
    matchKey: 'qm15',
    reports: assignedScoutNames.map((scoutName, index) => ({
      scoutName,
      firstShiftAlliance: index % 3 === 0 ? 'Blue' : 'Red'
    })),
    assignedScoutNames
  });

  assert.ok(notice);
  assert.equal(notice.targetScoutNames.length, 15);
  assert.equal(notice.counts.Red, 10);
  assert.equal(notice.counts.Blue, 5);
});

test('first-shift correction notice treats missing first-shift confirmations as action required', () => {
  const notice = buildFirstShiftCorrectionNotice({
    matchKey: 'qm21',
    reports: [
      { scoutName: 'Scout A', firstShiftAlliance: '' },
      { scoutName: 'Scout B', firstShiftAlliance: '' },
      { scoutName: 'Scout C', firstShiftAlliance: '' }
    ]
  });

  assert.ok(notice);
  assert.equal(notice.consensus, null);
  assert.deepEqual(notice.counts, { Red: 0, Blue: 0 });
  assert.deepEqual(notice.targetScoutNames, ['Scout A', 'Scout B', 'Scout C']);
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

test('first-shift authority accepts unanimous scout reports without version bump', () => {
  const resolution = resolveFirstShiftAuthority({
    matchKey: 'qm16',
    reports: [
      { scoutName: 'Scout A', firstShiftAlliance: 'Blue' },
      { scoutName: 'Scout B', firstShiftAlliance: 'Blue' }
    ]
  });

  assert.equal(resolution.authoritativeAlliance, 'Blue');
  assert.equal(resolution.source, 'unanimous-scouts');
  assert.equal(resolution.needsScoutCorrection, false);
  assert.equal(resolution.versionBumpRequired, false);
});

test('first-shift authority uses majority as provisional until correction converges', () => {
  const resolution = resolveFirstShiftAuthority({
    matchKey: 'qm17',
    reports: [
      { scoutName: 'Scout A', firstShiftAlliance: 'Red' },
      { scoutName: 'Scout B', firstShiftAlliance: 'Red' },
      { scoutName: 'Scout C', firstShiftAlliance: 'Blue' }
    ]
  });

  assert.equal(resolution.authoritativeAlliance, 'Red');
  assert.equal(resolution.source, 'majority-provisional');
  assert.equal(resolution.needsScoutCorrection, true);
  assert.equal(resolution.versionBumpRequired, true);
});

test('first-shift authority leaves ties pending unless head scout overrides', () => {
  const tied = resolveFirstShiftAuthority({
    matchKey: 'qm18',
    reports: [
      { scoutName: 'Scout A', firstShiftAlliance: 'Red' },
      { scoutName: 'Scout B', firstShiftAlliance: 'Blue' }
    ]
  });
  const overridden = resolveFirstShiftAuthority({
    matchKey: 'qm18',
    reports: [
      { scoutName: 'Scout A', firstShiftAlliance: 'Red' },
      { scoutName: 'Scout B', firstShiftAlliance: 'Blue' }
    ],
    adminOverride: 'Blue'
  });

  assert.equal(tied.authoritativeAlliance, null);
  assert.equal(tied.source, 'pending-correction');
  assert.equal(overridden.authoritativeAlliance, 'Blue');
  assert.equal(overridden.source, 'admin-override');
  assert.equal(overridden.versionBumpRequired, true);
});
