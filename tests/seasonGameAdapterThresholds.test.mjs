import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRebuilt2026GameAdapter,
  getRebuilt2026RpThresholdsForEventTier,
  inferRebuilt2026EventTier,
  rebuilt2026GameAdapter
} from '../src/utils/seasonGameAdapter.ts';

test('REBUILT RP thresholds are inclusive at the exact threshold', () => {
  const result = rebuilt2026GameAdapter.calculateRankingPoints(true, {
    towerMetric: 50,
    fuelMetric: 360
  });

  assert.equal(result.winRp, 3);
  assert.equal(result.towerRp, 1);
  assert.equal(result.traversalRp, 1);
  assert.equal(result.energizedRp, 1);
  assert.equal(result.superchargedRp, 1);
  assert.equal(result.totalRp, 6);
});

test('REBUILT RP thresholds change by event tier', () => {
  assert.deepEqual(getRebuilt2026RpThresholdsForEventTier('regional-district'), {
    traversalRpThreshold: 50,
    energizedRpThreshold: 100,
    superchargedRpThreshold: 360
  });
  assert.deepEqual(getRebuilt2026RpThresholdsForEventTier('district-championship'), {
    traversalRpThreshold: 50,
    energizedRpThreshold: 240,
    superchargedRpThreshold: 360
  });
  assert.deepEqual(getRebuilt2026RpThresholdsForEventTier('first-championship'), {
    traversalRpThreshold: 50,
    energizedRpThreshold: 360,
    superchargedRpThreshold: 500
  });
});

test('REBUILT adapter applies championship thresholds instead of regional defaults', () => {
  const regional = createRebuilt2026GameAdapter('regional-district').calculateRankingPoints(false, {
    towerMetric: 50,
    fuelMetric: 240
  });
  const dcmp = createRebuilt2026GameAdapter('district-championship').calculateRankingPoints(false, {
    towerMetric: 50,
    fuelMetric: 240
  });
  const championship = createRebuilt2026GameAdapter('first-championship').calculateRankingPoints(false, {
    towerMetric: 50,
    fuelMetric: 240
  });

  assert.equal(regional.energizedRp, 1);
  assert.equal(dcmp.energizedRp, 1);
  assert.equal(championship.energizedRp, 0);
  assert.equal(championship.superchargedRp, 0);
});

test('REBUILT event tier inference recognizes district and FIRST Championship names', () => {
  assert.equal(inferRebuilt2026EventTier('Michigan State Championship'), 'district-championship');
  assert.equal(inferRebuilt2026EventTier('FIRST Championship - Milstein Division'), 'first-championship');
  assert.equal(inferRebuilt2026EventTier('Silicon Valley Regional'), 'regional-district');
});
