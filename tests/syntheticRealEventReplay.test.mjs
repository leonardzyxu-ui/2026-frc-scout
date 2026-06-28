import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const row = ({ key, title, red, blue, redScore, blueScore }) => `
<tr class="visible-lg">
  <td><a href="/match/${key}">${title}</a></td>
  ${red.map(team => `<td class="red"><svg data-team="${team}" data-match="${key}"></svg><a href="/team/${team.slice(3)}/2026">${team.slice(3)}</a></td>`).join('')}
  ${blue.map(team => `<td class="blue"><svg data-team="${team}" data-match="${key}"></svg><a href="/team/${team.slice(3)}/2026">${team.slice(3)}</a></td>`).join('')}
  <td class="redScore"><span>${redScore}</span></td>
  <td class="blueScore"><span>${blueScore}</span></td>
</tr>`;

test('real-event replay parser can run from a TBA public-page fixture', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'powerscout-real-replay-'));
  const htmlPath = path.join(temp, 'event.html');
  const manifestPath = path.join(temp, 'manifest.json');
  const outputDir = path.join(temp, 'artifacts');
  writeFileSync(
    htmlPath,
    `<h1 id="event-name">Fixture Regional 2026</h1>
    ${row({ key: '2026fix_qm1', title: 'Quals 1', red: ['frc1', 'frc2', 'frc3'], blue: ['frc4', 'frc5', 'frc6'], redScore: 150, blueScore: 130 })}
    ${row({ key: '2026fix_qm2', title: 'Quals 2', red: ['frc4', 'frc2', 'frc6'], blue: ['frc1', 'frc5', 'frc3'], redScore: 120, blueScore: 160 })}`
  );
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        simulation: { name: 'fixture-real-event', mode: 'public-real-event', seed: 91 },
        fixture: {
          eventKey: '2026fix',
          season: 2026,
          sourceUrl: 'file://fixture',
          excludedTeamKeys: [],
          pretendOwnTeamPolicy: { strategy: 'seeded-random-participant', seed: 91 }
        },
        phases: [{ id: 'qualification_replay', startsAt: 'MATCH_1_POSTED' }],
        bridges: { modelCore: {}, webApp: {}, powerScout: {}, firebase: { productionWrites: false } },
        gates: {
          minMatches: 2,
          minScoutRowsPerMatch: 6,
          requiredArtifacts: [
            'run-summary.json',
            'source-page-metadata.json',
            'replay-event.json',
            'scout-observations.json',
            'prediction-ledger.json',
            'model-metrics.json',
            'no-future-leakage-audit.json',
            'scout-coverage-audit.json',
            'alliance-selection-replay.json',
            'app-bridge-summary.json',
            'morning-report.html'
          ]
        },
        artifacts: { root: outputDir, keepGeneratedOutOfGit: true }
      },
      null,
      2
    )
  );

  const result = spawnSync(
    process.execPath,
    ['SyntheticFullSystemTest/scripts/real-event-replay.mjs', '--manifest', manifestPath, '--html-file', htmlPath, '--output', outputDir],
    { encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);

  const summary = JSON.parse(result.stdout);
  assert.equal(summary.eventKey, '2026fix');
  assert.equal(summary.counts.totalMatches, 2);
  assert.equal(summary.counts.matchScoutRows, 12);
  assert.equal(summary.gates.noFutureLeakage, 'passed');
  assert.equal(summary.gates.scoutCoverage, 'passed');
  assert.ok(existsSync(path.join(outputDir, 'morning-report.html')));

  const source = JSON.parse(readFileSync(path.join(outputDir, 'source-page-metadata.json'), 'utf8'));
  assert.equal(source.apiKeyUsed, false);
});

