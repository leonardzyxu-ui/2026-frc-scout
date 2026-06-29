import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMatchScoutingV4 } from '../src/utils/matchScoutingV4.ts';
import { deriveShiftActionCredits } from '../src/utils/shiftActionWeights.ts';

test('Match Scout V4 normalization preserves and sanitizes shift-aware fields', () => {
  const normalized = normalizeMatchScoutingV4({
    matchKey: 'qm7',
    teamNumber: 'frc254',
    teleopFirstShiftAlliance: 'Red',
    shiftBreakdown: [
      {
        id: '',
        index: 0,
        shiftAlliance: 'Blue',
        owner: 'opponent',
        role: 'inactive',
        actions: ['defense', 'stockpile'],
        ballsScored: 3,
        scoreActions: [{ delta: 5, at: 222 }, { delta: 2, at: 333 }],
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
    versionMetadata: {
      logicalId: 'qm7_254',
      version: 3,
      parentVersion: 2,
      currentVersionSubmitted: false,
      submissionNumber: 0,
      submittedAt: null,
      editedAt: 45678,
      editedByName: 'Leo',
      editedByScoutNumber: 101,
      editedBySurface: 'scout'
    },
    shiftAuditFlags: ['first_shift_disagreement', '']
  });

  assert.equal(normalized.teamNumber, '254');
  assert.equal(normalized.teleopFirstShiftAlliance, 'Red');
  assert.equal(normalized.shiftBreakdown?.length, 1);
  assert.equal(normalized.shiftBreakdown?.[0].id, 'shift-1');
  assert.equal(normalized.shiftBreakdown?.[0].shiftAlliance, 'Blue');
  assert.equal(normalized.shiftBreakdown?.[0].owner, 'opponent');
  assert.equal(normalized.shiftBreakdown?.[0].role, 'mixed');
  assert.deepEqual(normalized.shiftBreakdown?.[0].actions, ['defense', 'stockpile']);
  assert.deepEqual(normalized.shiftBreakdown?.[0].scoreActions, []);
  assert.equal(normalized.shiftBreakdown?.[0].ballsScored, 0);
  assert.equal(normalized.shiftBreakdown?.[0].defendedTeams.length, 1);
  assert.equal(normalized.shiftBreakdown?.[0].defendedTeams[0].targetTeamNumber, '1678');
  assert.equal(normalized.shiftBreakdown?.[0].defendedTeams[0].claimedSharePercent, 100);
  assert.equal(normalized.shiftBreakdown?.[0].defendedTeams[0].normalizedSharePercent, 100);
  assert.equal(normalized.defenseAssignments?.length, 1);
  assert.equal(normalized.defenseAssignments?.[0].targetTeamNumber, '971');
  assert.equal(normalized.defenseAssignments?.[0].claimedSharePercent, 0);
  assert.equal(normalized.officialReconciliation?.scaleFactor, 1.25);
  assert.equal(normalized.versionMetadata?.version, 3);
  assert.equal(normalized.versionMetadata?.currentVersionSubmitted, false);
  assert.equal(normalized.versionMetadata?.submissionNumber, 0);
  assert.equal(normalized.versionMetadata?.submittedAt, null);
  assert.equal(normalized.versionMetadata?.editedByScoutNumber, null);
  assert.deepEqual(normalized.shiftAuditFlags, ['first_shift_disagreement']);
});

test('Match Scout V4 normalization defaults optional shift arrays to safe empty arrays', () => {
  const normalized = normalizeMatchScoutingV4({ matchKey: 'qm1' });

  assert.deepEqual(normalized.shiftBreakdown, []);
  assert.deepEqual(normalized.defenseAssignments, []);
  assert.deepEqual(normalized.shiftAuditFlags, []);
  assert.equal(normalized.officialReconciliation, undefined);
  assert.equal(normalized.teleopFirstShiftAlliance, 'Red');
  assert.equal(normalized.autoCycles, 0);
  assert.equal(normalized.teleopCycles, 0);
});

test('Match Scout V4 rejects scout numbers outside the locked device range', () => {
  assert.equal(normalizeMatchScoutingV4({ matchKey: 'qm1', scoutNumber: 99 }).scoutNumber, 99);
  assert.equal(normalizeMatchScoutingV4({ matchKey: 'qm1', scoutNumber: 100 }).scoutNumber, null);
  assert.equal(normalizeMatchScoutingV4({ matchKey: 'qm1', scoutNumber: 0 }).scoutNumber, null);
});

test('Match Scout V4 derives shift credits from the shared configurable weight contract', () => {
  assert.deepEqual(deriveShiftActionCredits(['defense', 'stockpile']), {
    defenseShiftCredit: 0.5,
    stockpileShiftCredit: 0.5
  });
  assert.deepEqual(deriveShiftActionCredits(['offense', 'defense']), {
    defenseShiftCredit: 0.1,
    stockpileShiftCredit: 0
  });

  const normalized = normalizeMatchScoutingV4({
    matchKey: 'qm3',
    shiftBreakdown: [
      { actions: ['defense', 'stockpile'], owner: 'opponent', shiftAlliance: 'Blue' },
      { actions: ['offense', 'defense'], owner: 'own', shiftAlliance: 'Red', ballsScored: 9 }
    ]
  }, {
    shiftActionCreditWeights: {
      defenseStockpileDefenseCredit: 0.35,
      defenseStockpileStockpileCredit: 0.65,
      defenseDuringOffenseCredit: 0.2
    }
  });

  assert.equal(normalized.shiftBreakdown?.[0].defenseShiftCredit, 0.35);
  assert.equal(normalized.shiftBreakdown?.[0].stockpileShiftCredit, 0.65);
  assert.equal(normalized.shiftBreakdown?.[1].defenseShiftCredit, 0.2);
  assert.equal(normalized.shiftBreakdown?.[1].stockpileShiftCredit, 0);
});

test('Match Scout V4 normalizes PowerCoin bet snapshots with scout-number identity', () => {
  const normalized = normalizeMatchScoutingV4({
    eventKey: '2026mnum',
    matchType: 'Qualification',
    matchNumber: 12,
    matchKey: 'QM12',
    scoutName: 'Leo',
    scoutNumber: 7,
    powerCoinBet: {
      id: '',
      eventKey: 'bad',
      matchKey: 'bad',
      matchNumber: 0,
      matchType: 'Practice',
      scoutName: '',
      scoutNumber: 123,
      side: 'Green',
      amount: -5,
      placedAt: Number.NaN,
      lockedAt: Number.NaN,
      lockReason: 'weird',
      secureMode: true,
      directSendStatus: 'teleported',
      directSendError: 'x',
      disqualified: true
    }
  });

  assert.equal(normalized.powerCoinBet?.eventKey, '2026MNUM');
  assert.equal(normalized.powerCoinBet?.matchKey, 'qm12');
  assert.equal(normalized.powerCoinBet?.matchNumber, 12);
  assert.equal(normalized.powerCoinBet?.scoutName, 'Leo');
  assert.equal(normalized.powerCoinBet?.scoutNumber, 7);
  assert.equal(normalized.powerCoinBet?.side, '');
  assert.equal(normalized.powerCoinBet?.amount, 0);
  assert.equal(normalized.powerCoinBet?.lockedAt, null);
  assert.equal(normalized.powerCoinBet?.lockReason, undefined);
  assert.equal(normalized.powerCoinBet?.directSendStatus, 'not_attempted');
  assert.equal(normalized.powerCoinBet?.secureMode, true);
  assert.equal(normalized.powerCoinBet?.disqualified, true);
});
