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
            'metric-definitions.json',
            'team-metric-timeline.json',
            'future-prediction-snapshots.json',
            'no-future-leakage-audit.json',
            'scout-coverage-audit.json',
            'alliance-selection-replay.json',
            'app-bridge-summary.json',
            'event-history-index.json',
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
  assert.equal(summary.counts.teamMetricSnapshots, 3);
  assert.equal(summary.counts.futurePredictionSnapshots, 3);
  assert.equal(summary.gates.noFutureLeakage, 'passed');
  assert.equal(summary.gates.scoutCoverage, 'passed');
  assert.ok(existsSync(path.join(outputDir, 'morning-report.html')));

  const source = JSON.parse(readFileSync(path.join(outputDir, 'source-page-metadata.json'), 'utf8'));
  assert.equal(source.apiKeyUsed, false);
  const metricDefinitions = JSON.parse(readFileSync(path.join(outputDir, 'metric-definitions.json'), 'utf8'));
  assert.equal(metricDefinitions.contribution.label, 'Contribution');
  assert.equal(metricDefinitions.floorNonZero.label, 'Floor Non Zero');
  assert.equal(metricDefinitions.contributionDeviation.label, 'Contribution Deviation');
  assert.equal(metricDefinitions.defenseDeviation.label, 'Defense Deviation');
  assert.equal(metricDefinitions.ppc.label, 'PPC (legacy alias)');
  assert.equal(metricDefinitions.ppa.label, 'PPA (legacy range alias)');
  const metricTimeline = JSON.parse(readFileSync(path.join(outputDir, 'team-metric-timeline.json'), 'utf8'));
  const firstTeamMetric = metricTimeline.at(-1).teams[0];
  assert.ok('contribution' in firstTeamMetric);
  assert.ok('floorNonZero' in firstTeamMetric);
  assert.ok('contributionDeviation' in firstTeamMetric);
  assert.ok('defenseDeviation' in firstTeamMetric);
  const historyIndex = JSON.parse(readFileSync(path.join(outputDir, 'event-history-index.json'), 'utf8'));
  assert.equal(historyIndex.artifacts.teamMetricTimeline, 'team-metric-timeline.json');
  assert.equal(historyIndex.artifacts.futurePredictionSnapshots, 'future-prediction-snapshots.json');
});

test('agentic real-event replay writes score-consistent V4 scout artifacts', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'powerscout-agentic-replay-'));
  const htmlPath = path.join(temp, 'event.html');
  const manifestPath = path.join(temp, 'manifest.json');
  const outputDir = path.join(temp, 'artifacts');
  writeFileSync(
    htmlPath,
    `<h1 id="event-name">Agentic Fixture Regional 2026</h1>
    ${row({ key: '2026agt_qm1', title: 'Quals 1', red: ['frc1', 'frc2', 'frc3'], blue: ['frc4', 'frc5', 'frc6'], redScore: 150, blueScore: 130 })}
    ${row({ key: '2026agt_qm2', title: 'Quals 2', red: ['frc4', 'frc2', 'frc6'], blue: ['frc1', 'frc5', 'frc3'], redScore: 120, blueScore: 160 })}`
  );
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        simulation: { name: 'fixture-agentic-real-event', mode: 'public-real-event', scoutMode: 'agentic-score-consistent', seed: 254 },
        fixture: {
          eventKey: '2026agt',
          season: 2026,
          sourceUrl: 'file://fixture',
          excludedTeamKeys: [],
          pretendOwnTeamPolicy: { strategy: 'seeded-random-participant', seed: 254 }
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
            'metric-definitions.json',
            'team-metric-timeline.json',
            'future-prediction-snapshots.json',
            'scout-agent-ledger.json',
            'match-scout-v4-records.json',
            'score-reconciliation-ledger.json',
            'alliance-score-residual-buckets.json',
            'score-consistency-audit.json',
            'no-future-leakage-audit.json',
            'scout-coverage-audit.json',
            'alliance-selection-replay.json',
            'app-bridge-summary.json',
            'event-history-index.json',
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
  assert.equal(summary.scoutSimulationMode, 'agentic-score-consistent');
  assert.equal(summary.counts.totalMatches, 2);
  assert.equal(summary.counts.matchScoutRows, 12);
  assert.equal(summary.counts.matchScoutV4Records, 12);
  assert.equal(summary.counts.scoreReconciliationRows, 4);
  assert.equal(summary.counts.residualBucketRows, 4);
  assert.equal(summary.gates.scoreConsistency, 'passed');

  const scoreAudit = JSON.parse(readFileSync(path.join(outputDir, 'score-consistency-audit.json'), 'utf8'));
  assert.equal(scoreAudit.status, 'passed');
  assert.equal(scoreAudit.checkedAlliances, 4);
  assert.deepEqual(scoreAudit.failedChecks, []);

  const reconciliation = JSON.parse(readFileSync(path.join(outputDir, 'score-reconciliation-ledger.json'), 'utf8'));
  assert.equal(reconciliation.length, 4);
  assert.ok(reconciliation.every(entry => entry.passed));
  assert.ok(reconciliation.every(entry => entry.fabricatedRobotPointTotal === entry.officialScore));

  const residualBuckets = JSON.parse(readFileSync(path.join(outputDir, 'alliance-score-residual-buckets.json'), 'utf8'));
  assert.equal(residualBuckets.length, 4);
  assert.ok(residualBuckets.every(entry => entry.passed));
  assert.ok(residualBuckets.every(entry => entry.buckets.officialScoreResidual === 0));

  const v4Rows = JSON.parse(readFileSync(path.join(outputDir, 'match-scout-v4-records.json'), 'utf8'));
  assert.equal(v4Rows.length, 12);
  assert.ok(v4Rows.every(row => row.schemaVersion === 'v4'));
  assert.ok(v4Rows.every(row => row.totalMatchPoints === row.autoPoints + row.teleopPoints + row.endgamePoints));

  const historyIndex = JSON.parse(readFileSync(path.join(outputDir, 'event-history-index.json'), 'utf8'));
  assert.equal(historyIndex.artifacts.scoutAgentLedger, 'scout-agent-ledger.json');
  assert.equal(historyIndex.artifacts.allianceScoreResidualBuckets, 'alliance-score-residual-buckets.json');
});
