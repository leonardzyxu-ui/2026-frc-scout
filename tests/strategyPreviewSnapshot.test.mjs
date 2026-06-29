import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFallbackStrategyPreviewSnapshot,
  buildStrategyPreviewSnapshotFromPlan,
  loadStrategyPreviewSnapshot,
  parseStrategyPreviewSnapshot,
  saveStrategyPreviewSnapshot,
  STRATEGY_PREVIEW_STORAGE_KEY
} from '../src/utils/strategyPreviewSnapshot.ts';

test('strategy preview falls back explicitly when no Admin V4 plan is published', () => {
  const resolution = loadStrategyPreviewSnapshot({ getItem: () => null });

  assert.equal(resolution.loadedFromStorage, false);
  assert.equal(resolution.snapshot.source, 'fallback-demo');
  assert.match(resolution.fallbackReason, /No Admin V4 strategy snapshot/);
  assert.equal(resolution.snapshot.redTeams.length, 3);
  assert.equal(resolution.snapshot.blueTeams.length, 3);
});

test('strategy preview loads a valid Admin V4 local plan snapshot from storage', () => {
  const fallback = buildFallbackStrategyPreviewSnapshot(1_000);
  const liveSnapshot = {
    ...fallback,
    source: 'admin-v4-local-plan',
    eventKey: '2026casj',
    matchKey: '2026casj_qm42',
    matchNumber: 42,
    modelName: 'Expected Range',
    redTeams: [{ teamNumber: '254', contribution: 90, contributionDeviation: 4, defense: 10, defenseDeviation: 2 }],
    blueTeams: [{ teamNumber: '1678', contribution: 88, contributionDeviation: 5, defense: 11, defenseDeviation: 3 }]
  };

  const resolution = loadStrategyPreviewSnapshot({
    getItem: key => key === STRATEGY_PREVIEW_STORAGE_KEY ? JSON.stringify(liveSnapshot) : null
  });

  assert.equal(resolution.loadedFromStorage, true);
  assert.equal(resolution.fallbackReason, null);
  assert.equal(resolution.snapshot.source, 'admin-v4-local-plan');
  assert.equal(resolution.snapshot.matchKey, '2026casj_qm42');
  assert.deepEqual(resolution.snapshot.redTeams.map(team => team.teamNumber), ['254']);
});

test('strategy preview rejects a stale Admin V4 snapshot from another event', () => {
  const fallback = buildFallbackStrategyPreviewSnapshot(1_000);
  const staleSnapshot = {
    ...fallback,
    source: 'admin-v4-local-plan',
    eventKey: '2026old',
    matchKey: '2026old_qm1'
  };

  const resolution = loadStrategyPreviewSnapshot({
    getItem: key => key === STRATEGY_PREVIEW_STORAGE_KEY ? JSON.stringify(staleSnapshot) : null
  }, {
    expectedEventKey: '2026new'
  });

  assert.equal(resolution.loadedFromStorage, false);
  assert.equal(resolution.snapshot.source, 'fallback-demo');
  assert.match(resolution.fallbackReason, /2026old/);
  assert.match(resolution.fallbackReason, /2026new/);
});

test('Admin V4 strategy plans can be converted into preview snapshots', () => {
  const snapshot = buildStrategyPreviewSnapshotFromPlan({
    matchKey: '2026casj_qm7',
    matchNumber: 7,
    matchType: 'Qualification',
    compLevel: 'qm',
    modelName: 'Expected Range',
    modelSource: 'Admin V4 test',
    modelLowConfidence: false,
    redTeams: ['254', '971', '604'],
    blueTeams: ['1678', '1323', '4414'],
    baselineRedScore: 210,
    baselineBlueScore: 190,
    optimizedRedScore: 220,
    optimizedBlueScore: 176,
    redDefenseSwing: 10,
    blueDefenseSwing: -14,
    bestRedPlan: '254 offense',
    bestBluePlan: '1678 offense',
    redRoleOptions: [],
    blueRoleOptions: [],
    predictedWinner: 'Red',
    predictedMargin: 44,
    confidence: 0.72,
    redRpPath: {},
    blueRpPath: {},
    opponentCounterStrategy: '',
    riskFlags: [],
    winCondition: ''
  }, {
    eventKey: '2026casj',
    ownTeamNumber: '254',
    ratings: { 254: 82, 971: 48, 604: 35, 1678: 64, 1323: 78, 4414: 58 },
    defenseImpactLookup: { 971: 55, 4414: 27 },
    deviationLookup: { 254: { contributionDeviation: 8 }, 971: { defenseDeviation: 12 } },
    savedAt: 2_000
  });

  assert.equal(snapshot.source, 'admin-v4-local-plan');
  assert.equal(snapshot.ourAlliance, 'Red');
  assert.equal(snapshot.firstShiftAlliance, 'Red');
  assert.equal(snapshot.redTeams.find(team => team.teamNumber === '971')?.defense, 55);
  assert.equal(snapshot.redTeams.find(team => team.teamNumber === '971')?.defenseDeviation, 12);
});

test('saving a strategy preview snapshot writes the known storage key', () => {
  const writes = new Map();
  const snapshot = buildFallbackStrategyPreviewSnapshot(3_000);
  const saved = saveStrategyPreviewSnapshot(snapshot, {
    setItem: (key, value) => writes.set(key, value)
  });

  assert.equal(saved, true);
  assert.equal(parseStrategyPreviewSnapshot(JSON.parse(writes.get(STRATEGY_PREVIEW_STORAGE_KEY)))?.savedAt, 3_000);
});
