import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('agentic tuning workflow exposes the variable and metric contract', () => {
  const result = spawnSync(process.execPath, ['SyntheticFullSystemTest/scripts/tune-agentic-workflow.mjs', '--print-contract'], {
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const contract = JSON.parse(result.stdout);
  const selectedVariables = Object.entries(contract.independentVariables)
    .filter(([, variable]) => variable.selected)
    .map(([name]) => name);

  for (const variable of [
    'priorWeight',
    'liveEvidenceWeight',
    'recencyHalfLifeMatches',
    'marginConfidenceScale',
    'scoreScaleCorrection',
    'defenseImpactWeight',
    'reliabilityWeight',
    'scoutNoisePenalty',
    'upsetSensitivity'
  ]) {
    assert.ok(contract.independentVariables[variable], `${variable} must be declared`);
    assert.ok(selectedVariables.includes(variable), `${variable} must be selected for the first tuning workflow`);
  }

  for (const variable of ['foulPenaltyWeight', 'pitClaimTrustWeight', 'confidenceFloor', 'confidenceCeiling']) {
    assert.ok(contract.independentVariables[variable], `${variable} must remain in the full variable universe`);
  }

  for (const metric of [
    'winnerAccuracy',
    'qualificationWinnerAccuracy',
    'playoffWinnerAccuracy',
    'brierScore',
    'scoreMae',
    'marginMae',
    'earlyEventAccuracy',
    'overconfidenceRate',
    'calibrationError',
    'upsetMissRate',
    'objectiveLoss'
  ]) {
    assert.ok(contract.dependentVariables[metric], `${metric} must be declared`);
  }

  assert.ok(selectedVariables.length >= 8, 'the first workflow should test a meaningful tuning set');

  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.ok(packageJson.scripts['sft:tune-agentic'], 'package.json must expose sft:tune-agentic');
});
