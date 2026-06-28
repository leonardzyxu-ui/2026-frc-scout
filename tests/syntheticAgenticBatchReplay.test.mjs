import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const writeRunSummary = (artifactRoot, eventKey) => {
  const outputDir = path.join(artifactRoot, `sft-real-${eventKey}-fixture`);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(
    path.join(outputDir, 'run-summary.json'),
    JSON.stringify(
      {
        eventKey,
        eventName: `${eventKey} Fixture Regional`,
        sourceUrl: `https://www.thebluealliance.com/event/${eventKey}`,
        runId: `sft-real-${eventKey}-fixture`,
        outputDir,
        scoutSimulationMode: 'agentic-score-consistent',
        pretendOwnTeam: 'frc9999',
        ownTeamLabel: '9999 Fixture Robotics',
        counts: {
          totalMatches: 42,
          matchScoutV4Records: 252,
          scoreReconciliationRows: 84
        },
        gates: {
          noFutureLeakage: 'passed',
          scoutCoverage: 'passed',
          scoreConsistency: 'passed'
        },
        metrics: {
          winnerAccuracy: 0.75
        }
      },
      null,
      2
    )
  );
  return outputDir;
};

test('agentic replay batch backfills local successes into the durable catalog', () => {
  const artifactRoot = mkdtempSync(path.join(tmpdir(), 'powerscout-agentic-batch-'));
  writeRunSummary(artifactRoot, '2026backfill');

  const result = spawnSync(
    process.execPath,
    [
      'SyntheticFullSystemTest/scripts/run-agentic-event-batch.mjs',
      '--event-keys',
      '2026backfill',
      '--limit',
      '0',
      '--artifact-root',
      artifactRoot
    ],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const catalogLines = readFileSync(path.join(artifactRoot, 'agentic-event-replay-catalog.jsonl'), 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(JSON.parse);
  assert.equal(catalogLines.length, 1);
  assert.equal(catalogLines[0].status, 'success');
  assert.equal(catalogLines[0].reason, 'backfilled-local-agentic-artifact');
  assert.equal(catalogLines[0].eventKey, '2026backfill');

  const summary = JSON.parse(readFileSync(path.join(artifactRoot, 'agentic-event-replay-catalog-summary.json'), 'utf8'));
  assert.equal(summary.totalEntries, 1);
  assert.equal(summary.successes, 1);
  assert.equal(summary.knownAgenticSuccesses, 1);
  assert.deepEqual(summary.successfulEvents.map(event => event.eventKey), ['2026backfill']);
});

test('agentic replay batch does not persist already-replayed skips', () => {
  const artifactRoot = mkdtempSync(path.join(tmpdir(), 'powerscout-agentic-batch-'));
  const outputDir = writeRunSummary(artifactRoot, '2026skip');
  const catalogPath = path.join(artifactRoot, 'agentic-event-replay-catalog.jsonl');
  writeFileSync(
    catalogPath,
    `${JSON.stringify({
      recordedAt: '2026-06-28T00:00:00.000Z',
      status: 'success',
      eventKey: '2026skip',
      eventName: '2026skip Fixture Regional',
      sourceUrl: 'https://www.thebluealliance.com/event/2026skip',
      runId: 'sft-real-2026skip-fixture',
      outputDir,
      counts: { totalMatches: 42, matchScoutV4Records: 252, scoreReconciliationRows: 84 },
      gates: { noFutureLeakage: 'passed', scoutCoverage: 'passed', scoreConsistency: 'passed' },
      metrics: { winnerAccuracy: 0.75 }
    })}\n`
  );

  const result = spawnSync(
    process.execPath,
    [
      'SyntheticFullSystemTest/scripts/run-agentic-event-batch.mjs',
      '--event-keys',
      '2026skip',
      '--limit',
      '1',
      '--artifact-root',
      artifactRoot
    ],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const catalogLines = readFileSync(catalogPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  assert.equal(catalogLines.length, 1);
  assert.equal(catalogLines[0].status, 'success');

  const summary = JSON.parse(readFileSync(path.join(artifactRoot, 'agentic-event-replay-catalog-summary.json'), 'utf8'));
  assert.equal(summary.totalEntries, 1);
  assert.equal(summary.successes, 1);
  assert.equal(summary.skipped, 0);
  assert.equal(summary.latestBatchSkippedExisting, 1);
  assert.deepEqual(summary.latestBatch, []);
});
