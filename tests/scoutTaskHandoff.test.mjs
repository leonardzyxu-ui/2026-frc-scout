import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('scout task handoff URLs keep strategy context out of query strings', () => {
  const source = readFileSync('src/utils/scoutTaskHandoff.ts', 'utf8');
  const start = source.indexOf('export const buildScoutTaskHandoffPath');
  const end = source.indexOf('export const buildScoutEvidenceAdminTask');
  assert.ok(start >= 0);
  assert.ok(end > start);

  const builderSource = source.slice(start, end);

  assert.match(builderSource, /saveScoutTaskHandoff\(handoff\)/);
  assert.match(builderSource, /params\.set\('handoff', 'local'\)/);
  assert.match(builderSource, /params\.set\(SCOUT_TASK_HANDOFF_URL_PARAM, handoffId\)/);
  assert.doesNotMatch(builderSource, /ppaExpected|ppaFloor|ppaCeiling|ppaWarning|params\.set\('ask'/);
  assert.doesNotMatch(builderSource, /params\.set\('reason'|params\.set\('detail'|params\.set\('context'|params\.set\('name'/);
  assert.doesNotMatch(builderSource, /params\.set\('team'|params\.set\('event'|params\.set\('match'|params\.set\('matchType'|params\.set\('matchNumber'|params\.set\('alliance'|params\.set\('returnTo'|params\.set\('returnLabel'/);
});

test('scout task handoff can load opaque task ids while keeping old query links readable', () => {
  const source = readFileSync('src/utils/scoutTaskHandoff.ts', 'utf8');
  assert.match(source, /loadScoutTaskHandoffById/);
  assert.match(source, /params\.get\(SCOUT_TASK_HANDOFF_URL_PARAM\)/);
  assert.match(source, /scoutTaskHandoffFromSearch\(search, missionKey\)/);
});
