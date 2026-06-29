import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMatchScoutTimelineEntries,
  getMatchScoutShiftPhase,
  inferFirstShiftAllianceFromFmsAuto,
  shouldRollSubmitShift
} from '../src/utils/matchScoutTimeline.ts';

test('timeline remaps existing shift data by alliance order when first shift changes', () => {
  const redFirst = buildMatchScoutTimelineEntries([], 'Red', 'Red');
  redFirst[0] = {
    ...redFirst[0],
    actions: ['offense'],
    role: 'offense',
    ballsScored: 12,
    scoreActions: [{ delta: 10, at: 1 }, { delta: 1, at: 2 }, { delta: 1, at: 3 }]
  };
  redFirst[1] = {
    ...redFirst[1],
    actions: ['defense'],
    role: 'defense',
    defendedTeams: [{ targetTeamNumber: '971', claimedSharePercent: 70, normalizedSharePercent: 70 }]
  };

  const blueFirst = buildMatchScoutTimelineEntries(redFirst, 'Blue', 'Red');

  assert.equal(blueFirst[0].shiftAlliance, 'Blue');
  assert.equal(blueFirst[0].defendedTeams[0].targetTeamNumber, '971');
  assert.equal(blueFirst[1].shiftAlliance, 'Red');
  assert.equal(blueFirst[1].owner, 'own');
  assert.equal(blueFirst[1].ballsScored, 12);
  assert.deepEqual(blueFirst[1].scoreActions.map(action => action.delta), [10, 1, 1]);
});

test('timeline labels late shift phases for transition and endgame review', () => {
  assert.equal(getMatchScoutShiftPhase(0), 'teleop');
  assert.equal(getMatchScoutShiftPhase(5), 'teleop');
  assert.equal(getMatchScoutShiftPhase(6), 'transition');
  assert.equal(getMatchScoutShiftPhase(7), 'endgame');
});

test('FMS auto inference gives first shift to the alliance that lost auto', () => {
  assert.equal(inferFirstShiftAllianceFromFmsAuto({
    key: '2026test_qm1',
    comp_level: 'qm',
    match_number: 1,
    time: 0,
    predicted_time: 0,
    actual_time: 0,
    alliances: {
      red: { score: -1, team_keys: [] },
      blue: { score: -1, team_keys: [] }
    },
    score_breakdown: {
      red: { autoPoints: 42 },
      blue: { autoPoints: 35 }
    }
  }), 'Blue');
});

test('rolling submit marks only forward moves with real shift content', () => {
  assert.equal(shouldRollSubmitShift(0, 1, {
    id: 'shift-1',
    index: 0,
    phase: 'teleop',
    shiftAlliance: 'Red',
    owner: 'own',
    role: 'offense',
    actions: ['offense'],
    ballsScored: 3,
    scoreActions: [{ delta: 3, at: 1 }],
    stockpileShiftCredit: 0,
    defenseShiftCredit: 0,
    defendedTeams: [],
    status: 'draft'
  }), true);

  assert.equal(shouldRollSubmitShift(2, 1, {
    id: 'shift-3',
    index: 2,
    phase: 'teleop',
    shiftAlliance: 'Red',
    owner: 'own',
    role: 'inactive',
    actions: [],
    ballsScored: 0,
    scoreActions: [],
    stockpileShiftCredit: 0,
    defenseShiftCredit: 0,
    defendedTeams: [],
    status: 'draft'
  }), false);
});
