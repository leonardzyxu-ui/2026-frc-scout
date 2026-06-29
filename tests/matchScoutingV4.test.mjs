import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatchScoutingV4 } from '../src/utils/matchScoutingV4.ts';

test('Match Scout V4 normalization preserves and sanitizes shift-aware fields', () => {
  const normalized = normalizeMatchScoutingV4({
    matchKey: 'qm7',
    teamNumber: 'frc254',
    teleopFirstShiftAlliance: 'Red',
    shiftBreakdown: [
      {
        id: '',
        index: 0,
        owner: 'opponent',
        role: 'defense',
        ballsScored: 3,
        stockpileShiftCredit: 0.5,
        defenseShiftCredit: 0.5,
        defendedTeams: [
          { targetTeamNumber: 'frc1678', claimedSharePercent: 140, normalizedSharePercent: 120, notes: 'double team' },
          { targetTeamNumber: '', claimedSharePercent: 50 }
        ],
        notes: 'messy first shift',
        submittedAt: 12345
      }
    ],
    defenseAssignments: [
      { targetTeamNumber: 'frc971', claimedSharePercent: -10 },
      { targetTeamNumber: '', claimedSharePercent: 90 }
    ],
    officialReconciliation: {
      officialAllianceFuelPoints: 100,
      rawAllianceFuelPoints: 80,
      scaleFactor: 1.25,
      adjustedTeamFuelPoints: 37.5,
      warnings: ['scaled'],
      reconciledAt: 98765
    },
    shiftAuditFlags: ['first_shift_disagreement', '']
  });

  assert.equal(normalized.teamNumber, '254');
  assert.equal(normalized.teleopFirstShiftAlliance, 'Red');
  assert.equal(normalized.shiftBreakdown?.length, 1);
  assert.equal(normalized.shiftBreakdown?.[0].id, 'shift-1');
  assert.equal(normalized.shiftBreakdown?.[0].owner, 'opponent');
  assert.equal(normalized.shiftBreakdown?.[0].role, 'defense');
  assert.equal(normalized.shiftBreakdown?.[0].defendedTeams.length, 1);
  assert.equal(normalized.shiftBreakdown?.[0].defendedTeams[0].targetTeamNumber, '1678');
  assert.equal(normalized.shiftBreakdown?.[0].defendedTeams[0].claimedSharePercent, 100);
  assert.equal(normalized.shiftBreakdown?.[0].defendedTeams[0].normalizedSharePercent, 100);
  assert.equal(normalized.defenseAssignments?.length, 1);
  assert.equal(normalized.defenseAssignments?.[0].targetTeamNumber, '971');
  assert.equal(normalized.defenseAssignments?.[0].claimedSharePercent, 0);
  assert.equal(normalized.officialReconciliation?.scaleFactor, 1.25);
  assert.deepEqual(normalized.shiftAuditFlags, ['first_shift_disagreement']);
});

test('Match Scout V4 normalization defaults optional shift arrays to safe empty arrays', () => {
  const normalized = normalizeMatchScoutingV4({ matchKey: 'qm1' });

  assert.deepEqual(normalized.shiftBreakdown, []);
  assert.deepEqual(normalized.defenseAssignments, []);
  assert.deepEqual(normalized.shiftAuditFlags, []);
  assert.equal(normalized.officialReconciliation, undefined);
});
