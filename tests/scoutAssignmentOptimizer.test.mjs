import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('scout assignment optimizer keeps Shanghai Regional scouts on repeated teams', () => {
  const result = spawnSync(process.execPath, [
    './node_modules/tsx/dist/cli.mjs',
    'tests/fixtures/scoutAssignmentShanghaiScenario.ts'
  ], {
    encoding: 'utf8'
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout.trim().split('\n').at(-1));

  assert.equal(summary.eventKey, '2026cnsh');
  assert.equal(summary.matches, 59);
  assert.equal(summary.assignments, 354);
  assert.equal(summary.ownTeamAssignments, 7);
  assert.equal(Math.max(...Object.values(summary.loads)) - Math.min(...Object.values(summary.loads)), 0);
  assert.ok(summary.optimizedContinuityPairs > summary.stationRotationContinuityPairs);
});
