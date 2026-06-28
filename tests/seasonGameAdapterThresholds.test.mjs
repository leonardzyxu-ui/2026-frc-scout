import test from 'node:test';
import assert from 'node:assert/strict';
import { rebuilt2026GameAdapter } from '../src/utils/seasonGameAdapter.ts';

test('REBUILT RP thresholds are inclusive at the exact threshold', () => {
  const result = rebuilt2026GameAdapter.calculateRankingPoints(true, {
    towerMetric: 50,
    fuelMetric: 360
  });

  assert.equal(result.winRp, 3);
  assert.equal(result.towerRp, 1);
  assert.equal(result.energizedRp, 1);
  assert.equal(result.superchargedRp, 1);
  assert.equal(result.totalRp, 6);
});
