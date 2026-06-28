#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '..');
const repoRoot = path.resolve(root, '..');

const requiredFiles = [
  'README.md',
  'docs/technical-plan.md',
  'docs/agent-orchestration.md',
  'docs/app-bridge-hooks.md',
  'schemas/simulation-manifest.schema.json',
  'schemas/replay-event.schema.json',
  'schemas/scout-observation.schema.json',
  'schemas/prediction-ledger.schema.json',
  'manifests/example-local-smoke.json',
  'scripts/dry-run.mjs',
  'scripts/validate-framework.mjs'
];

const readJson = relativePath => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));

const missing = requiredFiles.filter(relativePath => !existsSync(path.join(root, relativePath)));
assert.deepEqual(missing, [], `Missing framework files: ${missing.join(', ')}`);

const manifest = readJson('manifests/example-local-smoke.json');
assert.equal(manifest.schemaVersion, 1, 'manifest schemaVersion must be 1');
assert.equal(manifest.simulation.mode, 'synthetic-smoke', 'smoke manifest must avoid network by default');
assert.ok(Number.isInteger(manifest.simulation.seed), 'smoke manifest must have an integer seed');
assert.ok(Array.isArray(manifest.fixture.excludedTeamKeys), 'fixture.excludedTeamKeys must be an array');
assert.equal(manifest.bridges.firebase.productionWrites, false, 'synthetic tests must not write production Firebase');

const phaseIds = new Set(manifest.phases.map(phase => phase.id));
for (const phase of ['pre_scout', 'pit_scout', 'qualification_replay', 'alliance_selection']) {
  assert.ok(phaseIds.has(phase), `manifest missing required phase ${phase}`);
}

for (const bridge of ['modelCore', 'webApp', 'powerScout']) {
  assert.ok(manifest.bridges[bridge], `manifest missing ${bridge} bridge`);
}

for (const schemaPath of [
  'schemas/simulation-manifest.schema.json',
  'schemas/replay-event.schema.json',
  'schemas/scout-observation.schema.json',
  'schemas/prediction-ledger.schema.json'
]) {
  const schema = readJson(schemaPath);
  assert.ok(schema.$schema, `${schemaPath} must declare $schema`);
  assert.ok(schema.title, `${schemaPath} must declare title`);
}

const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
assert.ok(packageJson.scripts['sft:validate'], 'root package.json must expose sft:validate');
assert.ok(packageJson.scripts['sft:dry-run'], 'root package.json must expose sft:dry-run');

console.log(`SyntheticFullSystemTest framework validated: ${requiredFiles.length} required files, ${manifest.phases.length} phases.`);

