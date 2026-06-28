import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('full synthetic event replay produces complete audited artifacts', () => {
  const outputDir = mkdtempSync(path.join(tmpdir(), 'powerscout-sft-full-'));
  const result = spawnSync(
    process.execPath,
    [
      'SyntheticFullSystemTest/scripts/full-event-replay.mjs',
      '--manifest',
      'SyntheticFullSystemTest/manifests/full-local-event.json',
      '--output',
      outputDir
    ],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const summary = JSON.parse(result.stdout);
  assert.equal(summary.eventKey, '2026fullsynthetic');
  assert.ok(summary.counts.totalMatches >= 80);
  assert.equal(summary.counts.matchScoutRows, summary.counts.totalMatches * 6);
  assert.equal(summary.gates.noFutureLeakage, 'passed');
  assert.equal(summary.gates.scoutCoverage, 'passed');
  assert.ok(summary.metrics.winnerAccuracy >= 0 && summary.metrics.winnerAccuracy <= 1);

  for (const artifact of summary.artifacts) {
    assert.ok(existsSync(artifact), `${artifact} should exist`);
  }

  const ledger = JSON.parse(readFileSync(path.join(outputDir, 'prediction-ledger.json'), 'utf8'));
  assert.equal(ledger.entries.length, summary.counts.totalMatches);
  assert.equal(ledger.metrics.matchesPredicted, summary.counts.totalMatches);

  const noFutureAudit = JSON.parse(readFileSync(path.join(outputDir, 'no-future-leakage-audit.json'), 'utf8'));
  assert.equal(noFutureAudit.status, 'passed');
  assert.equal(noFutureAudit.failedChecks.length, 0);
});

