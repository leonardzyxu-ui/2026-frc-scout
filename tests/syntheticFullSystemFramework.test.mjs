import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const requiredFiles = [
  'SyntheticFullSystemTest/README.md',
  'SyntheticFullSystemTest/docs/technical-plan.md',
  'SyntheticFullSystemTest/docs/agent-orchestration.md',
  'SyntheticFullSystemTest/docs/app-bridge-hooks.md',
  'SyntheticFullSystemTest/manifests/example-local-smoke.json',
  'SyntheticFullSystemTest/scripts/validate-framework.mjs',
  'SyntheticFullSystemTest/scripts/dry-run.mjs'
];

test('Synthetic Full System Test framework has contracts and smoke hooks', () => {
  for (const file of requiredFiles) {
    assert.ok(existsSync(file), `${file} should exist`);
  }

  const plan = readFileSync('SyntheticFullSystemTest/docs/technical-plan.md', 'utf8');
  assert.match(plan, /No future leakage/i);
  assert.match(plan, /PowerScout Bridge Checks/i);
  assert.match(plan, /Alliance-Selection Replay/i);

  const bridgeDocs = readFileSync('SyntheticFullSystemTest/docs/app-bridge-hooks.md', 'utf8');
  assert.match(bridgeDocs, /Web App Bridge/i);
  assert.match(bridgeDocs, /Firebase Bridge/i);
  assert.match(bridgeDocs, /PowerScout Mac App Bridge/i);

  const validate = spawnSync(process.execPath, ['SyntheticFullSystemTest/scripts/validate-framework.mjs'], {
    encoding: 'utf8'
  });
  assert.equal(validate.status, 0, validate.stderr || validate.stdout);

  const dryRun = spawnSync(
    process.execPath,
    ['SyntheticFullSystemTest/scripts/dry-run.mjs', '--manifest', 'SyntheticFullSystemTest/manifests/example-local-smoke.json'],
    { encoding: 'utf8' }
  );
  assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);

  const summary = JSON.parse(dryRun.stdout);
  assert.equal(summary.mode, 'synthetic-smoke');
  assert.equal(summary.noFutureAudit.status, 'passed');
  assert.equal(summary.gates.observedScoutRowsPerMatch, 6);
  assert.ok(summary.bridgesPlanned.includes('webApp'));
  assert.ok(summary.bridgesPlanned.includes('powerScout'));
});

