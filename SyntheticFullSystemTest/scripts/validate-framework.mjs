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
  'manifests/full-local-event.json',
  'manifests/orlando-2026-public.json',
  'manifests/silicon-valley-2026-public-254.json',
  'scripts/dry-run.mjs',
  'scripts/full-event-replay.mjs',
  'scripts/real-event-replay.mjs',
  'scripts/validate-framework.mjs'
];

const readJson = relativePath => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));

const missing = requiredFiles.filter(relativePath => !existsSync(path.join(root, relativePath)));
assert.deepEqual(missing, [], `Missing framework files: ${missing.join(', ')}`);

const manifest = readJson('manifests/example-local-smoke.json');
const fullManifest = readJson('manifests/full-local-event.json');
const realManifest = readJson('manifests/orlando-2026-public.json');
const siliconValleyManifest = readJson('manifests/silicon-valley-2026-public-254.json');
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
  assert.ok(fullManifest.bridges[bridge], `full manifest missing ${bridge} bridge`);
  assert.ok(realManifest.bridges[bridge], `real manifest missing ${bridge} bridge`);
  assert.ok(siliconValleyManifest.bridges[bridge], `Silicon Valley manifest missing ${bridge} bridge`);
}

assert.equal(fullManifest.simulation.mode, 'synthetic-full-event', 'full manifest must use synthetic-full-event mode');
assert.ok(fullManifest.fixture.qualificationMatches >= 60, 'full manifest must include a full qualification schedule');
assert.ok(fullManifest.fixture.playoffMatches >= 8, 'full manifest must include playoffs');
assert.equal(fullManifest.bridges.firebase.productionWrites, false, 'full replay must not write production Firebase');
assert.equal(realManifest.simulation.mode, 'public-real-event', 'real manifest must use public-real-event mode');
assert.ok(realManifest.fixture.sourceUrl.includes('thebluealliance.com/event/'), 'real manifest must point at a TBA public event page');
assert.equal(realManifest.bridges.firebase.productionWrites, false, 'real replay must not write production Firebase');
assert.equal(siliconValleyManifest.simulation.mode, 'public-real-event', 'Silicon Valley manifest must use public-real-event mode');
assert.equal(siliconValleyManifest.fixture.eventKey, '2026casnv', 'Silicon Valley manifest must target the 2026casnv event');
assert.equal(siliconValleyManifest.fixture.pretendOwnTeamPolicy.teamKey, 'frc254', 'Silicon Valley replay must role-play as frc254');
assert.equal(siliconValleyManifest.fixture.ownTeamLabel, 'The Cheesy Poofs', 'Silicon Valley replay must label frc254 as The Cheesy Poofs');
assert.equal(siliconValleyManifest.bridges.firebase.productionWrites, false, 'Silicon Valley replay must not write production Firebase');
for (const artifact of ['metric-definitions.json', 'team-metric-timeline.json', 'future-prediction-snapshots.json', 'event-history-index.json']) {
  assert.ok(realManifest.gates.requiredArtifacts.includes(artifact), `real manifest missing history artifact ${artifact}`);
  assert.ok(siliconValleyManifest.gates.requiredArtifacts.includes(artifact), `Silicon Valley manifest missing history artifact ${artifact}`);
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
assert.ok(packageJson.scripts['sft:full-replay'], 'root package.json must expose sft:full-replay');
assert.ok(packageJson.scripts['sft:real-replay'], 'root package.json must expose sft:real-replay');
assert.ok(packageJson.scripts['sft:real-replay:silicon-valley'], 'root package.json must expose sft:real-replay:silicon-valley');

console.log(`SyntheticFullSystemTest framework validated: ${requiredFiles.length} required files, ${manifest.phases.length} smoke phases, ${fullManifest.phases.length} full phases, ${realManifest.phases.length} real-event phases, ${siliconValleyManifest.fixture.eventKey} 254 replay manifest.`);
