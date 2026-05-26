import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ResearchStore } from '../modeling/src/data/store.ts';
import { auditEventMetadataCoverage } from '../modeling/src/audits/eventMetadataCoverage.ts';
import { auditLocalBackupInventory } from '../modeling/src/audits/localBackupInventory.ts';
import { auditScoutCoverage } from '../modeling/src/audits/scoutCoverage.ts';
import { auditStatboticsPredictionProvenance } from '../modeling/src/audits/statboticsPredictionProvenance.ts';
import { importLocalBackup, ingestFirebase, normalizeFirstEventMetadata } from '../modeling/src/data/ingest.ts';
import { buildSyntheticResearchData } from '../modeling/src/data/synthetic.ts';
import { buildWalkForwardDataset, summarizeDataset } from '../modeling/src/modeling/features.ts';
import { runModelSearch } from '../modeling/src/modeling/train.ts';
import {
  buildCrossRunSummary,
  buildResidualDiagnostics,
  writeCrossRunSummaryArtifacts,
  writeResidualDiagnosticArtifacts,
  writeRunArtifacts
} from '../modeling/src/reporting/report.ts';
import { findInPageAnchorIssues, findOverclaimWordingIssues } from '../modeling/src/reporting/verifyDashboard.ts';

test('walk-forward features do not include current-match results before update', () => {
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 12,
    matchesPerEvent: 8,
    seed: 7
  });
  const dataset = buildWalkForwardDataset(synthetic.matches, synthetic.observations, synthetic.statboticsSignals, {
    useRoleFeatures: true,
    useContextEpa: true
  });

  assert.equal(dataset.rows.length, 16);
  assert.equal(dataset.rows[0].features.own_season_matches_sum, 0);
  assert.equal(dataset.rows[1].features.own_season_matches_sum, 0);
  assert.match(dataset.leakageNotes.join('\n'), /Statbotics/);
});

test('component scoring features use only prior matches', () => {
  const matches = [
    {
      key: '2026cmp_qm1',
      eventKey: '2026cmp',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 1,
      setNumber: 1,
      startTime: 1770000000,
      red: {
        score: 100,
        teamKeys: ['frc1', 'frc2', 'frc3'],
        foulPoints: 6,
        techFoulCount: null,
        foulCount: null,
        componentPoints: { auto_points: 18, teleop_points: 62, endgame_points: 14 }
      },
      blue: {
        score: 80,
        teamKeys: ['frc4', 'frc5', 'frc6'],
        foulPoints: 0,
        techFoulCount: null,
        foulCount: null,
        componentPoints: { auto_points: 12, teleop_points: 54, endgame_points: 10 }
      },
      winningAlliance: 'red',
      source: 'Synthetic'
    },
    {
      key: '2026cmp_qm2',
      eventKey: '2026cmp',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 2,
      setNumber: 1,
      startTime: 1770000600,
      red: {
        score: 110,
        teamKeys: ['frc1', 'frc2', 'frc3'],
        foulPoints: 0,
        techFoulCount: null,
        foulCount: null,
        componentPoints: { auto_points: 24, teleop_points: 66, endgame_points: 20 }
      },
      blue: {
        score: 90,
        teamKeys: ['frc4', 'frc5', 'frc6'],
        foulPoints: 3,
        techFoulCount: null,
        foulCount: null,
        componentPoints: { auto_points: 15, teleop_points: 60, endgame_points: 12 }
      },
      winningAlliance: 'red',
      source: 'Synthetic'
    }
  ];
  const dataset = buildWalkForwardDataset(matches, [], [], {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const firstRed = dataset.rows.find(row => row.matchKey === '2026cmp_qm1' && row.perspective === 'red');
  const secondRed = dataset.rows.find(row => row.matchKey === '2026cmp_qm2' && row.perspective === 'red');
  const secondBlue = dataset.rows.find(row => row.matchKey === '2026cmp_qm2' && row.perspective === 'blue');
  const assertClose = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);

  assert.equal(firstRed.features.own_component_modeled_score_sum, 0);
  assert.equal(firstRed.features.own_component_foul_sum, 0);
  assert.equal(firstRed.features.own_foul_risk_sum, 0);
  assertClose(secondRed.features.own_component_auto_sum, 18);
  assertClose(secondRed.features.own_component_teleop_sum, 62);
  assertClose(secondRed.features.own_component_endgame_sum, 14);
  assertClose(secondRed.features.own_component_modeled_score_sum, 94);
  assertClose(secondRed.features.own_component_foul_sum, 6);
  assertClose(secondRed.features.own_foul_risk_sum, 0);
  assertClose(secondRed.features.opp_foul_risk_sum, 6);
  assertClose(secondBlue.features.own_foul_risk_sum, 6);
  assertClose(secondBlue.features.opp_foul_risk_sum, 0);
});

test('scout gate features shrink sparse prior observations without future leakage', () => {
  const redTeams = ['frc1', 'frc2', 'frc3'];
  const blueTeams = ['frc4', 'frc5', 'frc6'];
  const match = matchNumber => ({
    key: `2026sg_qm${matchNumber}`,
    eventKey: '2026sg',
    season: 2026,
    compLevel: 'qm',
    matchNumber,
    setNumber: 1,
    startTime: 1770000000 + matchNumber * 600,
    red: {
      score: 120,
      teamKeys: redTeams,
      foulPoints: 0,
      techFoulCount: null,
      foulCount: null,
      componentPoints: {}
    },
    blue: {
      score: 90,
      teamKeys: blueTeams,
      foulPoints: 0,
      techFoulCount: null,
      foulCount: null,
      componentPoints: {}
    },
    winningAlliance: 'red',
    source: 'Synthetic'
  });
  const observations = [
    {
      source: 'test',
      eventKey: '2026sg',
      matchKey: 'qm1',
      teamKey: 'frc1',
      scoutId: 'scout-a',
      offensePoints: 60,
      defenseValue: 20,
      playedDefense: true,
      reliabilityPenalty: null,
      payload: {}
    }
  ];
  const dataset = buildWalkForwardDataset([match(1), match(2)], observations, [], {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const firstRed = dataset.rows.find(row => row.matchKey === '2026sg_qm1' && row.perspective === 'red');
  const secondRed = dataset.rows.find(row => row.matchKey === '2026sg_qm2' && row.perspective === 'red');
  const assertClose = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);

  assert.ok(firstRed);
  assert.ok(secondRed);
  assert.equal(firstRed.features.own_scout_offense_sum, 0);
  assert.equal(firstRed.features.own_scout_gated_offense_sum, 0);
  assert.equal(firstRed.features.own_role_v3_gated_suppression_sum, 0);
  assertClose(secondRed.features.own_scout_offense_sum, 60);
  assert.equal(secondRed.features.own_scout_offense_samples_sum, 1);
  assertClose(secondRed.features.own_scout_offense_confidence_mean, 1 / 9);
  assertClose(secondRed.features.own_scout_gated_offense_sum, 20);
  assertClose(secondRed.features.own_scout_gated_defense_sum, 20 / 3);
  assertClose(secondRed.features.scout_gated_offense_gap, 20);
  assert.ok(
    secondRed.features.own_role_v3_gated_suppression_sum < secondRed.features.own_role_v3_suppression_sum
  );
});

test('role v2 suppression features include failed defense attempts without future leakage', () => {
  const baseRed = ['frc1', 'frc2', 'frc3'];
  const baseBlue = ['frc4', 'frc5', 'frc6'];
  const match = (matchNumber, redScore, blueScore, redFouls = 0, blueFouls = 0) => ({
    key: `2026cmp_qm${matchNumber}`,
    eventKey: '2026cmp',
    season: 2026,
    compLevel: 'qm',
    matchNumber,
    setNumber: 1,
    startTime: 1770000000 + matchNumber * 600,
    red: {
      score: redScore,
      teamKeys: baseRed,
      foulPoints: redFouls,
      techFoulCount: null,
      foulCount: null,
      componentPoints: {}
    },
    blue: {
      score: blueScore,
      teamKeys: baseBlue,
      foulPoints: blueFouls,
      techFoulCount: null,
      foulCount: null,
      componentPoints: {}
    },
    winningAlliance: redScore > blueScore ? 'red' : blueScore > redScore ? 'blue' : '',
    source: 'Synthetic'
  });
  const matches = [
    match(1, 100, 80, 0, 0),
    match(2, 105, 90, 0, 3),
    match(3, 105, 60, 0, 0),
    match(4, 110, 70, 0, 0)
  ];
  const dataset = buildWalkForwardDataset(matches, [], [], {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const fourthRed = dataset.rows.find(row => row.matchKey === '2026cmp_qm4' && row.perspective === 'red');
  const assertClose = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9);

  assert.ok(fourthRed);
  assertClose(fourthRed.features.own_defense_denial_sum, 33.75);
  assertClose(fourthRed.features.own_role_v2_suppression_sum, 11.25);
  assertClose(fourthRed.features.own_role_v2_suppression_rate_mean, 1 / 3);
  assertClose(fourthRed.features.own_foul_risk_sum, 3);
  assertClose(fourthRed.features.own_role_v2_foul_risk_all_sum, 1);
  assertClose(fourthRed.features.own_role_v3_suppression_sum, 11.25);
  assertClose(fourthRed.features.own_role_v3_consistency_mean, 1 / 3);
  assertClose(fourthRed.features.own_role_v3_foul_exposure_sum, 1);
  assertClose(fourthRed.features.own_role_v3_offense_cost_sum, 70.26666666666667);
  assertClose(fourthRed.features.own_role_v3_confidence_mean, 0.44166666666666665);
  assertClose(fourthRed.features.own_role_v3_defender_selected, 0);
});

test('model search produces score distributions and keeps context EPA non-promotable', () => {
  const synthetic = buildSyntheticResearchData({
    seasons: [2025, 2026],
    eventsPerSeason: 2,
    teamsPerEvent: 18,
    matchesPerEvent: 18,
    seed: 2026
  });
  const dataset = buildWalkForwardDataset(synthetic.matches, synthetic.observations, synthetic.statboticsSignals, {
    useRoleFeatures: true,
    useContextEpa: true
  });
  const run = runModelSearch(dataset);
  const contextModel = run.modelResults.find(result => result.config.name.includes('Context EPA'));

  assert.ok(run.modelResults.length >= 4);
  assert.equal(run.rows, dataset.rows.length);
  assert.equal(run.matches, synthetic.matches.length);
  assert.ok(run.modelResults.every(result => result.scorePredictions.length === dataset.rows.length));
  assert.ok(run.modelResults.every(result => result.matchPredictions.length === synthetic.matches.length));
  assert.ok(run.modelResults.every(result => Number.isFinite(result.benchmarkScore)));
  assert.deepEqual(
    run.modelResults.map(result => result.benchmarkRank).sort((left, right) => left - right),
    Array.from({ length: run.modelResults.length }, (_, index) => index + 1)
  );
  assert.equal(contextModel?.promoted, false);
  assert.ok(contextModel?.rejectionReasons.some(reason => reason.includes('leakage')));
});

test('widening conformal intervals never narrow the base score interval', () => {
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 18,
    matchesPerEvent: 36,
    seed: 19
  });
  const dataset = buildWalkForwardDataset(synthetic.matches, synthetic.observations, synthetic.statboticsSignals, {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const baseConfig = {
    name: 'Test Online EPA Base Interval',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    eventAdjustmentScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const wideningConfig = {
    ...baseConfig,
    name: 'Test Online EPA Widening Conformal Interval',
    conformalInterval: true,
    conformalIntervalMode: 'widen',
    conformalTargetCoverage: 0.8,
    conformalMinSamples: 10,
    conformalWindow: 40
  };
  const scopedWideningConfig = {
    ...baseConfig,
    name: 'Test Online EPA Scoped Widening Conformal Interval',
    conformalInterval: true,
    conformalIntervalMode: 'widen',
    conformalScope: 'seasonEventProgress',
    conformalTargetCoverage: 0.8,
    conformalMinSamples: 10,
    conformalWindow: 40
  };
  const run = runModelSearch(dataset, [baseConfig, wideningConfig, scopedWideningConfig]);
  const base = run.modelResults.find(result => result.config.name === baseConfig.name);
  const widening = run.modelResults.find(result => result.config.name === wideningConfig.name);
  const scopedWidening = run.modelResults.find(result => result.config.name === scopedWideningConfig.name);

  assert.ok(base);
  assert.ok(widening);
  assert.ok(scopedWidening);

  const baseByRow = new Map(
    base.scorePredictions.map(prediction => [prediction.rowId, prediction.p90Score - prediction.p10Score])
  );

  [widening, scopedWidening].forEach(modelResult => {
    modelResult.scorePredictions.forEach(prediction => {
      const baseWidth = baseByRow.get(prediction.rowId);
      assert.equal(typeof baseWidth, 'number');
      assert.ok(prediction.p90Score - prediction.p10Score >= baseWidth - 1e-9);
    });
  });
});

test('research store caches normalized matches and scouting observations locally', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-'));
  const store = new ResearchStore(path.join(dir, 'research.sqlite'));
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 12,
    matchesPerEvent: 4,
    seed: 42
  });

  store.upsertMatches(synthetic.matches);
  store.upsertScoutingObservations(synthetic.observations);
  store.upsertStatboticsSignals(synthetic.statboticsSignals);

  assert.equal(store.getMatches().length, synthetic.matches.length);
  assert.equal(store.getScoutingObservations().length, synthetic.observations.length);
  assert.equal(store.getStatboticsSignals().length, synthetic.statboticsSignals.length);

  const dataset = buildWalkForwardDataset(store.getMatches(), store.getScoutingObservations(), store.getStatboticsSignals(), {
    useRoleFeatures: true,
    useContextEpa: true
  });
  assert.equal(summarizeDataset(dataset).matches, synthetic.matches.length);
  store.close();
});

test('statbotics prediction provenance audit keeps undated predictions non-promotable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-audit-'));
  const store = new ResearchStore(path.join(dir, 'research.sqlite'));
  store.upsertRawPayload({
    source: 'Statbotics',
    endpointKey: '/matches?year=2026&limit=2&offset=0',
    season: 2026,
    payload: [
      {
        key: '2026test_qm1',
        event: '2026test',
        status: 'Completed',
        time: 1770000000,
        predicted_time: 1770000300,
        pred: {
          winner: 'red',
          red_win_prob: 0.62,
          red_score: 101,
          blue_score: 95
        }
      },
      {
        key: '2026test_qm2',
        event: '2026test',
        status: 'Completed',
        time: 1770000600,
        pred: {
          generated_at: '2026-03-01T09:00:00Z',
          red_win_prob: 0.48,
          red_score: 88,
          blue_score: 90
        }
      }
    ]
  });

  const audit = auditStatboticsPredictionProvenance(store, path.join(dir, 'audit'));

  assert.equal(audit.matchesWithPredictions, 2);
  assert.equal(audit.matchesWithSpecificPredictionTimestamp, 1);
  assert.equal(audit.matchesWithoutSpecificPredictionTimestamp, 1);
  assert.equal(audit.promotionRecommendation, 'keep_non_promotable');
  assert.ok(fs.existsSync(path.join(dir, 'audit', 'AUDIT.md')));
  store.close();
});

test('local backup import extracts nested scout archive records for modeling enrichment', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-local-backup-'));
  const backupPath = path.join(dir, 'backup.json');
  const store = new ResearchStore(path.join(dir, 'research.sqlite'));
  fs.writeFileSync(
    backupPath,
    JSON.stringify({
      format: 'rebuilt-2026-admin-v2-backup',
      eventKey: '2026TEST',
      adminV2: {
        cacheEntries: [
          {
            source: 'TBA',
            key: 'event-summary',
            eventKey: '2026TEST',
            year: 2026,
            payload: {
              key: '2026test',
              year: 2026,
              name: 'Synthetic Championship Finals',
              event_type: 4,
              week: 8,
              country: 'USA',
              state_prov: 'TX',
              start_date: '2026-05-02',
              end_date: '2026-05-02'
            }
          }
        ]
      },
      scoutArchive: {
        format: 'rebuilt-2026-scout-archive',
        version: 5,
        username: 'model-test',
        exportedAt: 1770001000000,
        deviceId: 'device-a',
        records: [
          {
            recordId: 'matchV4:2026TEST:qm1_1234',
            logicalId: 'matchV4:2026TEST:qm1_1234',
            recordType: 'matchV4',
            eventKey: '2026TEST',
            username: 'model-test',
            deviceId: 'device-a',
            updatedAt: 1770000000000,
            deleted: false,
            source: 'local_submit',
            syncStatus: 'synced',
            payload: {
              schemaVersion: 'v4',
              eventKey: '2026TEST',
              matchType: 'Qualification',
              matchNumber: 1,
              matchKey: 'qm1',
              teamNumber: '1234',
              scoutName: 'Scout A',
              assignedScoutName: 'Scout A',
              assignedSlot: 'Red 1',
              alliance: 'Red',
              timestamp: 1770000000000,
              autoPoints: 10,
              autoCycles: 2,
              teleopPoints: 20,
              teleopCycles: 4,
              endgamePoints: 5,
              totalMatchPoints: 35,
              rolePlayed: 'Defense',
              defendedTeamNumber: '5678',
              defenderFacedTeamNumber: '',
              defenseIntensity: 0.8,
              defenseDurationSeconds: 30,
              fouls: 0,
              techFouls: 0,
              robotDied: false,
              commsLost: false,
              mechanismBroke: false,
              tippedOver: false,
              failureReason: '',
              reliabilityScore: 1,
              notes: '',
              strategyNotes: ''
            }
          },
          {
            recordId: 'matchDefense:2026TEST:qm1_5678',
            logicalId: 'matchDefense:2026TEST:qm1_5678',
            recordType: 'matchDefense',
            eventKey: '2026TEST',
            username: 'model-test',
            deviceId: 'device-a',
            updatedAt: 1770000100000,
            deleted: false,
            source: 'local_submit',
            syncStatus: 'synced',
            payload: {
              schemaVersion: 'defense-v1',
              eventKey: '2026TEST',
              matchType: 'Qualification',
              matchNumber: 1,
              matchKey: 'qm1',
              teamNumber: '5678',
              scoutName: 'Scout B',
              assignedScoutName: 'Scout B',
              assignedSlot: 'Blue 1',
              alliance: 'Blue',
              timestamp: 1770000100000,
              defenseMetric: 0.7,
              defenseComments: '',
              generalComments: ''
            }
          },
          {
            recordId: 'pit:2026TEST:9999',
            logicalId: 'pit:2026TEST:9999',
            recordType: 'pit',
            eventKey: '2026TEST',
            username: 'model-test',
            deviceId: 'device-a',
            updatedAt: 1770000200000,
            deleted: false,
            source: 'local_submit',
            syncStatus: 'synced',
            payload: { eventKey: '2026TEST', teamNumber: '9999' }
          }
        ]
      }
    })
  );
  store.upsertEventMetadata([
    {
      eventKey: '2026test',
      season: 2026,
      name: 'Synthetic Event From Statbotics',
      eventType: 'regional',
      week: 8,
      country: 'USA',
      stateProv: 'TX',
      district: null,
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      teamCount: 75,
      source: 'Statbotics',
      raw: { original: true }
    }
  ]);

  const result = importLocalBackup(store, backupPath);
  const observations = store.getScoutingObservations();
  const metadata = store.getEventMetadata({ eventKey: '2026test' });
  const v4Observation = observations.find(observation => observation.teamKey === 'frc1234');
  const defenseObservation = observations.find(observation => observation.teamKey === 'frc5678');

  assert.equal(result.observations, 2);
  assert.equal(observations.length, 2);
  assert.equal(metadata[0].eventType, 'einstein');
  assert.equal(metadata[0].source, 'TBA');
  assert.equal(metadata[0].teamCount, 75);
  assert.equal(v4Observation.eventKey, '2026test');
  assert.equal(v4Observation.matchKey, 'qm1');
  assert.equal(v4Observation.offensePoints, 35);
  assert.equal(v4Observation.defenseValue, 8);
  assert.equal(v4Observation.playedDefense, true);
  assert.equal(defenseObservation.offensePoints, null);
  assert.equal(defenseObservation.defenseValue, 0.7);
  assert.equal(defenseObservation.playedDefense, null);
  store.close();
});

test('Firebase ingest reads nested event scouting collection groups', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-firebase-ingest-'));
  const store = new ResearchStore(path.join(dir, 'research.sqlite'));
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), init });
    const body = JSON.parse(String(init.body ?? '{}'));
    assert.equal(body.structuredQuery.from[0].collectionId, 'matchScouting');
    assert.equal(body.structuredQuery.from[0].allDescendants, true);
    return new Response(
      JSON.stringify([
        {
          document: {
            name: 'projects/demo/databases/(default)/documents/events/2026TEST/matchScouting/qm1_1234',
            fields: {
              matchKey: { stringValue: 'qm1' },
              teamNumber: { stringValue: '1234' },
              alliance: { stringValue: 'red' },
              totalMatchPoints: { integerValue: '42' },
              defenseIntensity: { doubleValue: 0.7 },
              defenseDurationSeconds: { integerValue: '25' }
            }
          }
        }
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  try {
    const result = await ingestFirebase(store, {
      projectId: 'demo',
      accessToken: 'test-token',
      collections: ['matchScouting'],
      includeRootCollections: false
    });
    const observations = store.getScoutingObservations();

    assert.equal(requests.length, 1);
    assert.equal(result.observations, 1);
    assert.equal(observations.length, 1);
    assert.equal(observations[0].eventKey, '2026test');
    assert.equal(observations[0].matchKey, 'qm1');
    assert.equal(observations[0].teamKey, 'frc1234');
    assert.equal(observations[0].offensePoints, 42);
    assert.equal(observations[0].defenseValue, 7);
    assert.equal(observations[0].playedDefense, true);
  } finally {
    globalThis.fetch = originalFetch;
    store.close();
  }
});

test('local backup inventory counts structure without reading sensitive-looking files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-local-backup-inventory-'));
  const backupPath = path.join(dir, 'adminv2-backup.json');
  const sensitivePath = path.join(dir, 'ADMIN API KEYS.json');
  const outputDir = path.join(dir, 'audit');

  fs.writeFileSync(
    backupPath,
    JSON.stringify({
      format: 'rebuilt-2026-admin-v2-backup',
      adminV2: {
        cacheEntries: [{ source: 'TBA', key: 'event-summary', eventKey: '2026TEST' }]
      },
      scoutArchive: {
        records: [
          {
            recordType: 'matchV4',
            eventKey: '2026TEST',
            deleted: false,
            payload: {
              eventKey: '2026TEST',
              matchKey: 'qm1',
              teamNumber: '1234',
              scoutName: 'Scout A',
              totalMatchPoints: 35
            }
          },
          {
            recordType: 'matchDefense',
            eventKey: '2026TEST',
            deleted: false,
            payload: {
              eventKey: '2026TEST',
              matchKey: 'qm1',
              teamNumber: '5678',
              scoutName: 'Scout B',
              defenseMetric: 0.7
            }
          },
          {
            recordType: 'pit',
            eventKey: '2026TEST',
            deleted: false,
            payload: { eventKey: '2026TEST', teamNumber: '9999', scoutName: 'Scout C' }
          }
        ]
      },
      matchScoutingDefense: [
        {
          eventKey: '2026TEST',
          matchKey: 'qm2',
          teamNumber: '1357',
          scoutName: 'Scout D',
          defenseMetric: 0.4
        }
      ],
      pitScouting: [{ eventKey: '2026TEST', teamNumber: '2468', scoutName: 'Scout E' }]
    })
  );
  fs.writeFileSync(sensitivePath, JSON.stringify({ token: 'SUPER-SECRET', scoutName: 'Sensitive Scout' }));

  const audit = auditLocalBackupInventory([dir], outputDir);
  const markdown = fs.readFileSync(path.join(outputDir, 'LOCAL_BACKUP_INVENTORY.md'), 'utf8');

  assert.equal(audit.jsonFilesFound, 2);
  assert.equal(audit.parsedFiles, 1);
  assert.equal(audit.skippedSensitiveName, 1);
  assert.equal(audit.totalArchiveRecords, 3);
  assert.equal(audit.totalImportableMatchRecords, 3);
  assert.equal(audit.totalDefenseRecords, 2);
  assert.equal(audit.totalPitRecords, 2);
  assert.equal(audit.totalAdminCacheEntries, 1);
  assert.deepEqual(audit.eventKeys, ['2026test']);
  assert.equal(audit.recordTypes.matchV4, 1);
  assert.equal(audit.recordTypes.matchDefense, 1);
  assert.equal(audit.recordTypes.pit, 1);
  assert.equal(audit.recordTypes['matchDefense:matchScoutingDefense'], 1);
  assert.equal(audit.recordTypes['pit:pitScouting'], 1);
  assert.ok(fs.existsSync(path.join(outputDir, 'local-backup-inventory.json')));
  assert.doesNotMatch(markdown, /Scout A|Scout D|SUPER-SECRET|Sensitive Scout/);
});

test('FIRST event metadata maps known event types into modeling archetypes', () => {
  const districtChamp = normalizeFirstEventMetadata(
    {
      code: 'MICMP',
      name: 'Michigan State Championship',
      type: 'District Championship',
      districtCode: 'FIM',
      stateprov: 'MI',
      country: 'USA',
      dateStart: '2026-04-08',
      dateEnd: '2026-04-11'
    },
    2026
  );
  const champsDivision = normalizeFirstEventMetadata(
    {
      EventCode: 'AR',
      Name: 'Archimedes Division',
      EventType: 'Championship Division',
      DivisionCode: 'AR',
      Country: 'USA'
    },
    2026
  );
  const einstein = normalizeFirstEventMetadata(
    {
      code: 'CMP',
      name: 'FIRST Championship Einstein',
      type: 'Championship Finals',
      country: 'USA'
    },
    2026
  );

  assert.equal(districtChamp.eventKey, '2026micmp');
  assert.equal(districtChamp.eventType, 'district_cmp');
  assert.equal(districtChamp.district, 'FIM');
  assert.equal(champsDivision.eventType, 'champs_div');
  assert.equal(einstein.eventType, 'einstein');
});

test('scout coverage audit reports matched and unmatched observations', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-scout-coverage-'));
  const store = new ResearchStore(path.join(dir, 'research.sqlite'));
  store.upsertMatches([
    {
      key: '2026test_qm1',
      eventKey: '2026test',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 1,
      setNumber: 1,
      startTime: 1770000000,
      red: {
        score: 100,
        teamKeys: ['frc1234', 'frc5678', 'frc9012'],
        foulPoints: null,
        techFoulCount: null,
        foulCount: null,
        componentPoints: {}
      },
      blue: {
        score: 90,
        teamKeys: ['frc1111', 'frc2222', 'frc3333'],
        foulPoints: null,
        techFoulCount: null,
        foulCount: null,
        componentPoints: {}
      },
      winningAlliance: 'red',
      source: 'Synthetic'
    }
  ]);
  store.upsertScoutingObservations([
    {
      id: 'matched',
      source: 'LocalBackup',
      eventKey: '2026test',
      matchKey: 'qm1',
      teamKey: 'frc1234',
      alliance: 'red',
      offensePoints: 35,
      defenseValue: 8,
      playedDefense: true,
      reliabilityPenalty: 0,
      observedAt: 1770000000,
      raw: {}
    },
    {
      id: 'unmatched',
      source: 'LocalBackup',
      eventKey: '2026test',
      matchKey: 'qm99',
      teamKey: 'frc9999',
      alliance: 'blue',
      offensePoints: 10,
      defenseValue: null,
      playedDefense: null,
      reliabilityPenalty: 0,
      observedAt: 1770000000,
      raw: {}
    }
  ]);

  const audit = auditScoutCoverage(store, path.join(dir, 'audit'));

  assert.equal(audit.scoutingObservations, 2);
  assert.equal(audit.matchedObservations, 1);
  assert.equal(audit.unmatchedObservations, 1);
  assert.equal(audit.observationMatchCoverage, 0.5);
  assert.ok(fs.existsSync(path.join(dir, 'audit', 'SCOUT_COVERAGE.md')));
  store.close();
});

test('event metadata coverage audit reports official event coverage and missing events', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-event-coverage-'));
  const store = new ResearchStore(path.join(dir, 'research.sqlite'));
  store.upsertMatches([
    {
      key: '2026meta_qm1',
      eventKey: '2026meta',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 1,
      setNumber: 1,
      startTime: 1770000000,
      red: { score: 1, teamKeys: ['frc1'], foulPoints: null, techFoulCount: null, foulCount: null, componentPoints: {} },
      blue: { score: 2, teamKeys: ['frc2'], foulPoints: null, techFoulCount: null, foulCount: null, componentPoints: {} },
      winningAlliance: 'blue',
      source: 'Synthetic'
    },
    {
      key: '2026missing_qm1',
      eventKey: '2026missing',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 1,
      setNumber: 1,
      startTime: 1770000100,
      red: { score: 3, teamKeys: ['frc3'], foulPoints: null, techFoulCount: null, foulCount: null, componentPoints: {} },
      blue: { score: 4, teamKeys: ['frc4'], foulPoints: null, techFoulCount: null, foulCount: null, componentPoints: {} },
      winningAlliance: 'blue',
      source: 'Synthetic'
    }
  ]);
  store.upsertEventMetadata([
    {
      eventKey: '2026meta',
      season: 2026,
      name: 'Metadata Event',
      eventType: 'regional',
      week: 1,
      country: 'USA',
      stateProv: 'CA',
      district: null,
      startDate: '2026-03-01',
      endDate: '2026-03-02',
      teamCount: 40,
      source: 'TBA',
      raw: {}
    }
  ]);

  const audit = auditEventMetadataCoverage(store, path.join(dir, 'audit'));

  assert.equal(audit.officialEvents, 2);
  assert.equal(audit.officialEventsWithMetadata, 1);
  assert.equal(audit.officialEventsMissingMetadata, 1);
  assert.equal(audit.officialEventCoverage, 0.5);
  assert.deepEqual(audit.missingEventSamples, ['2026missing']);
  assert.ok(fs.existsSync(path.join(dir, 'audit', 'EVENT_METADATA_COVERAGE.md')));
  store.close();
});

test('event metadata is cached and exposed as known-before-match features', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-events-'));
  const store = new ResearchStore(path.join(dir, 'research.sqlite'));
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 12,
    matchesPerEvent: 4,
    seed: 43
  });
  const eventKey = synthetic.matches[0].eventKey;
  const metadata = {
    eventKey,
    season: 2026,
    name: 'Synthetic Championship Division',
    eventType: 'champs_div',
    week: 8,
    country: 'USA',
    stateProv: 'TX',
    district: null,
    startDate: '2026-04-29',
    endDate: '2026-05-02',
    teamCount: 75,
    source: 'Statbotics',
    raw: {
      epa: { mean: 1000 },
      metrics: { score_pred: { rmse: 1 } }
    }
  };

  store.upsertMatches(synthetic.matches);
  store.upsertEventMetadata([metadata]);

  assert.deepEqual(store.getEventMetadata({ eventKey })[0].eventType, 'champs_div');

  const dataset = buildWalkForwardDataset(
    store.getMatches(),
    [],
    [],
    { useRoleFeatures: true, useContextEpa: false },
    store.getEventMetadata()
  );
  const firstRow = dataset.rows[0];
  const summary = summarizeDataset(dataset);

  assert.equal(summary.eventMetadataRows, dataset.rows.length);
  assert.equal(firstRow.eventMetadata.eventType, 'champs_div');
  assert.equal(firstRow.features.event_is_champs_division, 1);
  assert.equal(firstRow.features.event_week, 8);
  assert.equal(firstRow.features.event_team_count, 75);
  assert.equal(firstRow.features.event_is_regional, 0);
  assert.equal(firstRow.features.event_epa_mean, undefined);
  store.close();
});

test('event-type residual correction runs as a no-future online model candidate', () => {
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 2,
    teamsPerEvent: 18,
    matchesPerEvent: 26,
    seed: 51
  });
  const events = [...new Set(synthetic.matches.map(match => match.eventKey))].map((eventKey, index) => ({
    eventKey,
    season: 2026,
    name: `Synthetic Event ${index + 1}`,
    eventType: index === 0 ? 'regional' : 'champs_div',
    week: index + 1,
    country: 'USA',
    stateProv: 'TX',
    district: null,
    startDate: '2026-03-01',
    endDate: '2026-03-02',
    teamCount: 18,
    source: 'Synthetic',
    raw: {}
  }));
  const dataset = buildWalkForwardDataset(
    synthetic.matches,
    synthetic.observations,
    synthetic.statboticsSignals,
    { useRoleFeatures: true, useContextEpa: false },
    events
  );
  const config = {
    name: 'Test Event-Type Residual Candidate',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 20,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.1,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.1,
    eventResidualShiftMinSamples: 4,
    eventResidualShiftWindow: 8,
    eventTypeResidualShiftWeight: 0.1,
    eventTypeResidualShiftMinSamples: 4,
    eventTypeResidualShiftWindow: 12,
    championshipDivisionScoreShiftRatio: 0.05,
    championshipEventScoreShiftRatio: 0.025,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };

  const run = runModelSearch(dataset, [config]);
  const result = run.modelResults[0];

  assert.equal(result.predictionCount, dataset.rows.length);
  assert.equal(result.rejectionReasons.length, 0);
  assert.equal(result.config.eventTypeResidualShiftWeight, 0.1);
});

test('championship-scoped event score scale leaves regional predictions unchanged', () => {
  const makeAlliance = (score, teamOffset) => ({
    score,
    teamKeys: [`frc${teamOffset}`, `frc${teamOffset + 1}`, `frc${teamOffset + 2}`],
    foulPoints: 0,
    techFoulCount: null,
    foulCount: null,
    componentPoints: null
  });
  const matches = [
    {
      key: '2026tx_qm1',
      eventKey: '2026tx',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 1,
      setNumber: 1,
      startTime: 1770000000,
      red: makeAlliance(55, 1),
      blue: makeAlliance(60, 4),
      winningAlliance: 'blue',
      source: 'Synthetic'
    },
    {
      key: '2026tx_qm2',
      eventKey: '2026tx',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 2,
      setNumber: 1,
      startTime: 1770000600,
      red: makeAlliance(65, 1),
      blue: makeAlliance(58, 4),
      winningAlliance: 'red',
      source: 'Synthetic'
    },
    {
      key: '2026gal_qm1',
      eventKey: '2026gal',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 1,
      setNumber: 1,
      startTime: 1770001200,
      red: makeAlliance(210, 7),
      blue: makeAlliance(190, 10),
      winningAlliance: 'red',
      source: 'Synthetic'
    },
    {
      key: '2026gal_qm2',
      eventKey: '2026gal',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 2,
      setNumber: 1,
      startTime: 1770001800,
      red: makeAlliance(220, 7),
      blue: makeAlliance(205, 13),
      winningAlliance: 'red',
      source: 'Synthetic'
    },
    {
      key: '2026gal_qm3',
      eventKey: '2026gal',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 3,
      setNumber: 1,
      startTime: 1770002400,
      red: makeAlliance(230, 7),
      blue: makeAlliance(210, 13),
      winningAlliance: 'red',
      source: 'Synthetic'
    }
  ];
  const events = [
    {
      eventKey: '2026tx',
      season: 2026,
      name: 'Synthetic Regional',
      eventType: 'regional',
      week: 1,
      country: 'USA',
      stateProv: 'TX',
      district: null,
      startDate: '2026-03-01',
      endDate: '2026-03-02',
      teamCount: 6,
      source: 'Synthetic',
      raw: {}
    },
    {
      eventKey: '2026gal',
      season: 2026,
      name: 'Synthetic Galileo Division',
      eventType: 'champs_div',
      week: 8,
      country: 'USA',
      stateProv: 'TX',
      district: null,
      startDate: '2026-04-15',
      endDate: '2026-04-18',
      teamCount: 6,
      source: 'Synthetic',
      raw: {}
    }
  ];
  const dataset = buildWalkForwardDataset(matches, [], [], { useRoleFeatures: false, useContextEpa: false }, events);
  const baseConfig = {
    name: 'Test No Scale',
    family: 'onlineEpa',
    lambda: 1,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const scopedConfig = {
    ...baseConfig,
    name: 'Test Championship Scoped Scale',
    eventScoreScaleWeight: 0.5,
    eventScoreScaleMinSamples: 2,
    eventScoreScaleWindow: 4,
    eventScoreScaleThreshold: 0,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championship'
  };
  const residualGateBlockedConfig = {
    ...scopedConfig,
    name: 'Test Residual-Gated Championship Scoped Scale Blocked',
    eventScoreScaleResidualGateMinSamples: 4,
    eventScoreScaleResidualGateWindow: 4,
    eventScoreScaleResidualGateThreshold: 0,
    eventScoreScaleResidualGateFullAt: 24
  };
  const residualGateOpenConfig = {
    ...scopedConfig,
    name: 'Test Residual-Gated Championship Scoped Scale Open',
    eventScoreScaleResidualGateMinSamples: 2,
    eventScoreScaleResidualGateWindow: 4,
    eventScoreScaleResidualGateThreshold: 0,
    eventScoreScaleResidualGateFullAt: 24
  };
  const phaseConfig = {
    ...baseConfig,
    name: 'Test Championship Phase Shift',
    championshipPhaseEarlyScoreShift: 5,
    championshipPhaseMiddleScoreShift: 9,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseEarlyRows: 2,
    championshipPhaseMiddleRows: 4,
    championshipPhaseScope: 'championship'
  };
  const residualBoostConfig = {
    ...baseConfig,
    name: 'Test Championship Residual Boost',
    championshipPhaseEarlyRows: 2,
    championshipPhaseMiddleRows: 8,
    championshipPhaseResidualShiftEarlyWeight: 0.3,
    championshipPhaseResidualShiftMiddleWeight: 0.5,
    championshipPhaseResidualShiftLateWeight: 0,
    championshipPhaseResidualShiftMinSamples: 2,
    championshipPhaseResidualShiftWindow: 4,
    championshipPhaseResidualShiftPositiveOnly: true,
    championshipPhaseResidualShiftScope: 'championship'
  };
  const gatedTailBlockedConfig = {
    ...residualBoostConfig,
    name: 'Test Gated Championship Tail Blocked',
    championshipPhaseEarlyScoreShift: 5,
    championshipPhaseMiddleScoreShift: 9,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseScope: 'championship',
    championshipTailResidualGateMinSamples: 4,
    championshipTailResidualGateWindow: 4,
    championshipTailResidualGateThreshold: 0,
    championshipTailResidualGateFullAt: 24
  };
  const gatedTailOpenConfig = {
    ...gatedTailBlockedConfig,
    name: 'Test Gated Championship Tail Open',
    championshipTailResidualGateMinSamples: 2
  };
  const phaseResidualBoostConfig = {
    ...residualBoostConfig,
    name: 'Test Championship Phase Residual Boost',
    championshipPhaseEarlyScoreShift: 5,
    championshipPhaseMiddleScoreShift: 9,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseScope: 'championship'
  };
  const winCalNoTailConfig = {
    ...phaseResidualBoostConfig,
    name: 'Test WinCal NoTail Championship Phase Residual Boost',
    winProbabilityScoreSource: 'noChampionshipTailOnlineEpa'
  };
  const phaseResidualBoostEnsembleConfig = {
    ...phaseResidualBoostConfig,
    name: 'Test Championship Phase Residual Boost Ensemble',
    family: 'ensembleEpa',
    simulationCount: 100,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0
  };
  const winCalNoTailEnsembleConfig = {
    ...phaseResidualBoostEnsembleConfig,
    name: 'Test WinCal NoTail Championship Phase Residual Boost Ensemble',
    simulationSeedName: phaseResidualBoostEnsembleConfig.name,
    winProbabilityScoreSource: 'noChampionshipTailOnlineEpa'
  };

  const baseResult = runModelSearch(dataset, [baseConfig]).modelResults[0];
  const scopedResult = runModelSearch(dataset, [scopedConfig]).modelResults[0];
  const gatedBlockedResult = runModelSearch(dataset, [residualGateBlockedConfig]).modelResults[0];
  const gatedOpenResult = runModelSearch(dataset, [residualGateOpenConfig]).modelResults[0];
  const phaseResult = runModelSearch(dataset, [phaseConfig]).modelResults[0];
  const residualBoostResult = runModelSearch(dataset, [residualBoostConfig]).modelResults[0];
  const gatedTailBlockedResult = runModelSearch(dataset, [gatedTailBlockedConfig]).modelResults[0];
  const gatedTailOpenResult = runModelSearch(dataset, [gatedTailOpenConfig]).modelResults[0];
  const phaseResidualBoostResult = runModelSearch(dataset, [phaseResidualBoostConfig]).modelResults[0];
  const winCalNoTailResult = runModelSearch(dataset, [winCalNoTailConfig]).modelResults[0];
  const phaseResidualBoostEnsembleResult = runModelSearch(dataset, [phaseResidualBoostEnsembleConfig]).modelResults[0];
  const winCalNoTailEnsembleResult = runModelSearch(dataset, [winCalNoTailEnsembleConfig]).modelResults[0];
  const baseByRow = new Map(baseResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore]));
  const phaseResidualBoostByRow = new Map(
    phaseResidualBoostResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore])
  );
  const phaseResidualBoostEnsembleByRow = new Map(
    phaseResidualBoostEnsembleResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore])
  );
  const phaseResidualBoostWinByMatch = new Map(
    phaseResidualBoostResult.matchPredictions.map(prediction => [prediction.matchKey, prediction.redWinProbability])
  );
  const phaseResidualBoostEnsembleWinByMatch = new Map(
    phaseResidualBoostEnsembleResult.matchPredictions.map(prediction => [prediction.matchKey, prediction.redWinProbability])
  );
  const regionalScopedPredictions = scopedResult.scorePredictions.filter(prediction => prediction.eventKey === '2026tx');
  const championshipScopedPredictions = scopedResult.scorePredictions.filter(prediction => prediction.matchKey === '2026gal_qm2');
  const championshipGatedBlockedPredictions = gatedBlockedResult.scorePredictions.filter(
    prediction => prediction.matchKey === '2026gal_qm2'
  );
  const championshipGatedOpenPredictions = gatedOpenResult.scorePredictions.filter(
    prediction => prediction.matchKey === '2026gal_qm2'
  );
  const phaseRegionalPredictions = phaseResult.scorePredictions.filter(prediction => prediction.eventKey === '2026tx');
  const phaseEarlyPredictions = phaseResult.scorePredictions.filter(prediction => prediction.matchKey === '2026gal_qm1');
  const phaseMiddlePredictions = phaseResult.scorePredictions.filter(prediction => prediction.matchKey === '2026gal_qm2');
  const residualBoostRegionalPredictions = residualBoostResult.scorePredictions.filter(prediction => prediction.eventKey === '2026tx');
  const residualBoostEarlyPredictions = residualBoostResult.scorePredictions.filter(
    prediction => prediction.matchKey === '2026gal_qm1'
  );
  const residualBoostMiddlePredictions = residualBoostResult.scorePredictions.filter(
    prediction => prediction.matchKey === '2026gal_qm2'
  );
  const gatedTailBlockedPredictions = gatedTailBlockedResult.scorePredictions.filter(
    prediction => prediction.matchKey === '2026gal_qm2'
  );
  const gatedTailOpenPredictions = gatedTailOpenResult.scorePredictions.filter(
    prediction => prediction.matchKey === '2026gal_qm2'
  );

  regionalScopedPredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseByRow.get(prediction.rowId));
  });
  assert.ok(
    championshipScopedPredictions.some(prediction => Math.abs(prediction.expectedScore - baseByRow.get(prediction.rowId)) > 1e-9)
  );
  championshipGatedBlockedPredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseByRow.get(prediction.rowId));
  });
  assert.ok(
    championshipGatedOpenPredictions.some(
      prediction => Math.abs(prediction.expectedScore - baseByRow.get(prediction.rowId)) > 1e-9
    )
  );
  phaseRegionalPredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseByRow.get(prediction.rowId));
  });
  assert.ok(
    phaseEarlyPredictions.some(prediction => Math.abs(prediction.expectedScore - baseByRow.get(prediction.rowId)) >= 4.9)
  );
  assert.ok(
    phaseMiddlePredictions.some(prediction => Math.abs(prediction.expectedScore - baseByRow.get(prediction.rowId)) > 1e-9)
  );
  residualBoostRegionalPredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseByRow.get(prediction.rowId));
  });
  residualBoostEarlyPredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseByRow.get(prediction.rowId));
  });
  assert.ok(
    residualBoostMiddlePredictions.some(prediction => Math.abs(prediction.expectedScore - baseByRow.get(prediction.rowId)) > 1e-9)
  );
  gatedTailBlockedPredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseByRow.get(prediction.rowId));
  });
  assert.ok(
    gatedTailOpenPredictions.some(prediction => Math.abs(prediction.expectedScore - baseByRow.get(prediction.rowId)) > 1e-9)
  );
  winCalNoTailResult.scorePredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, phaseResidualBoostByRow.get(prediction.rowId));
  });
  assert.ok(
    winCalNoTailResult.matchPredictions.some(
      prediction => Math.abs(prediction.redWinProbability - phaseResidualBoostWinByMatch.get(prediction.matchKey)) > 1e-9
    )
  );
  winCalNoTailEnsembleResult.scorePredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, phaseResidualBoostEnsembleByRow.get(prediction.rowId));
  });
  assert.ok(
    winCalNoTailEnsembleResult.matchPredictions.some(
      prediction => Math.abs(prediction.redWinProbability - phaseResidualBoostEnsembleWinByMatch.get(prediction.matchKey)) > 1e-9
    )
  );
  assert.equal(scopedResult.config.eventScoreScaleScope, 'championship');
  assert.equal(gatedOpenResult.config.eventScoreScaleResidualGateMinSamples, 2);
  assert.equal(phaseResult.config.championshipPhaseMiddleScoreShift, 9);
  assert.equal(residualBoostResult.config.championshipPhaseResidualShiftMiddleWeight, 0.5);
  assert.equal(gatedTailOpenResult.config.championshipTailResidualGateMinSamples, 2);
  assert.equal(winCalNoTailResult.config.winProbabilityScoreSource, 'noChampionshipTailOnlineEpa');
  assert.equal(winCalNoTailEnsembleResult.config.simulationSeedName, phaseResidualBoostEnsembleConfig.name);
});

test('robust online update clips outlier rating movement for future predictions', () => {
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 12,
    matchesPerEvent: 10,
    seed: 81
  });
  synthetic.matches[0].red.score = 650;
  synthetic.matches[0].blue.score = 20;
  const dataset = buildWalkForwardDataset(synthetic.matches, [], [], {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const baseConfig = {
    name: 'Test Unclipped Online EPA',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    eventAdjustmentScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const robustConfig = {
    ...baseConfig,
    name: 'Test Robust Online EPA',
    ratingUpdateErrorClip: 50,
    residualMemoryErrorClip: 60
  };
  const run = runModelSearch(dataset, [baseConfig, robustConfig]);
  const base = run.modelResults.find(result => result.config.name === baseConfig.name);
  const robust = run.modelResults.find(result => result.config.name === robustConfig.name);

  assert.ok(base);
  assert.ok(robust);
  assert.equal(robust.config.ratingUpdateErrorClip, 50);
  assert.notDeepEqual(
    base.scorePredictions.map(prediction => prediction.expectedScore),
    robust.scorePredictions.map(prediction => prediction.expectedScore)
  );
});

test('learned tail correction waits for championship prior residuals', () => {
  const makeAlliance = (score, teamOffset) => ({
    score,
    teamKeys: [`frc${teamOffset}`, `frc${teamOffset + 1}`, `frc${teamOffset + 2}`],
    foulPoints: 0,
    techFoulCount: null,
    foulCount: null,
    componentPoints: null
  });
  const matches = [
    {
      key: '2026tx_qm1',
      eventKey: '2026tx',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 1,
      setNumber: 1,
      startTime: 1770000000,
      red: makeAlliance(55, 1),
      blue: makeAlliance(60, 4),
      winningAlliance: 'blue',
      source: 'Synthetic'
    },
    {
      key: '2026tx_qm2',
      eventKey: '2026tx',
      season: 2026,
      compLevel: 'qm',
      matchNumber: 2,
      setNumber: 1,
      startTime: 1770000600,
      red: makeAlliance(65, 1),
      blue: makeAlliance(58, 4),
      winningAlliance: 'red',
      source: 'Synthetic'
    }
  ];
  for (let matchNumber = 1; matchNumber <= 14; matchNumber += 1) {
    const teamOffset = 100 + matchNumber * 10;
    matches.push({
      key: `2026gal_qm${matchNumber}`,
      eventKey: '2026gal',
      season: 2026,
      compLevel: 'qm',
      matchNumber,
      setNumber: 1,
      startTime: 1770001200 + matchNumber * 600,
      red: makeAlliance(210 + matchNumber, teamOffset),
      blue: makeAlliance(195 + matchNumber, teamOffset + 3),
      winningAlliance: 'red',
      source: 'Synthetic'
    });
  }
  const events = [
    {
      eventKey: '2026tx',
      season: 2026,
      name: 'Synthetic Regional',
      eventType: 'regional',
      week: 1,
      country: 'USA',
      stateProv: 'TX',
      district: null,
      startDate: '2026-03-01',
      endDate: '2026-03-02',
      teamCount: 6,
      source: 'Synthetic',
      raw: {}
    },
    {
      eventKey: '2026gal',
      season: 2026,
      name: 'Synthetic Galileo Division',
      eventType: 'champs_div',
      week: 8,
      country: 'USA',
      stateProv: 'TX',
      district: null,
      startDate: '2026-04-15',
      endDate: '2026-04-18',
      teamCount: 120,
      source: 'Synthetic',
      raw: {}
    }
  ];
  const dataset = buildWalkForwardDataset(matches, [], [], { useRoleFeatures: false, useContextEpa: false }, events);
  const baseConfig = {
    name: 'Test No Learned Tail',
    family: 'onlineEpa',
    lambda: 1,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const learnedConfig = {
    ...baseConfig,
    name: 'Test Learned Tail',
    learnedTailCorrectionWeight: 1,
    learnedTailCorrectionLambda: 1,
    learnedTailCorrectionMinRows: 12,
    learnedTailCorrectionClip: 45,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phase',
    learnedTailCorrectionPositiveOnly: true
  };
  const gatedClosedConfig = {
    ...learnedConfig,
    name: 'Test Gated Learned Tail Closed',
    learnedTailCorrectionGateMinSamples: 2,
    learnedTailCorrectionGateWindow: 4,
    learnedTailCorrectionGateResidualThreshold: 999,
    learnedTailCorrectionGateFullAt: 1
  };
  const gatedOpenConfig = {
    ...learnedConfig,
    name: 'Test Gated Learned Tail Open',
    learnedTailCorrectionGateMinSamples: 2,
    learnedTailCorrectionGateWindow: 4,
    learnedTailCorrectionGateResidualThreshold: -1,
    learnedTailCorrectionGateFullAt: 1
  };
  const gatedMinClosedConfig = {
    ...learnedConfig,
    name: 'Test Gated Learned Tail Min Closed',
    learnedTailCorrectionGateMinSamples: 2,
    learnedTailCorrectionGateWindow: 4,
    learnedTailCorrectionGateResidualThreshold: -1,
    learnedTailCorrectionGateScoreDeltaThreshold: 999,
    learnedTailCorrectionGateMode: 'min',
    learnedTailCorrectionGateFullAt: 1
  };
  const intervalOnlyConfig = {
    ...learnedConfig,
    name: 'Test Learned Tail Interval Only',
    learnedTailCorrectionApplyToMean: false,
    learnedTailUncertaintyWeight: 1,
    learnedTailUncertaintyClip: 45
  };
  const winProbabilityOnlyConfig = {
    ...learnedConfig,
    name: 'Test Learned Tail Win Probability Only',
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1,
    learnedTailWinProbabilityClip: 45
  };
  const winProbabilityGatedClosedConfig = {
    ...winProbabilityOnlyConfig,
    name: 'Test Learned Tail Win Probability Gated Closed',
    learnedTailWinProbabilityMinExpectedMargin: 999,
    learnedTailWinProbabilityMinConfidence: 0.99
  };
  const winProbabilitySmoothShrinkConfig = {
    ...winProbabilityOnlyConfig,
    name: 'Test Learned Tail Win Probability Smooth Shrink',
    learnedTailWinProbabilityMarginRamp: 999999,
    learnedTailWinProbabilityConfidenceRamp: 999999,
    learnedTailWinProbabilityShrinkFloor: 0
  };

  const baseResult = runModelSearch(dataset, [baseConfig]).modelResults[0];
  const learnedResult = runModelSearch(dataset, [learnedConfig]).modelResults[0];
  const gatedClosedResult = runModelSearch(dataset, [gatedClosedConfig]).modelResults[0];
  const gatedOpenResult = runModelSearch(dataset, [gatedOpenConfig]).modelResults[0];
  const gatedMinClosedResult = runModelSearch(dataset, [gatedMinClosedConfig]).modelResults[0];
  const intervalOnlyResult = runModelSearch(dataset, [intervalOnlyConfig]).modelResults[0];
  const winProbabilityOnlyResult = runModelSearch(dataset, [winProbabilityOnlyConfig]).modelResults[0];
  const winProbabilityGatedClosedResult = runModelSearch(dataset, [winProbabilityGatedClosedConfig]).modelResults[0];
  const winProbabilitySmoothShrinkResult = runModelSearch(dataset, [winProbabilitySmoothShrinkConfig]).modelResults[0];
  const baseByRow = new Map(baseResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore]));
  const baseP90ByRow = new Map(baseResult.scorePredictions.map(prediction => [prediction.rowId, prediction.p90Score]));
  const baseP10ByRow = new Map(baseResult.scorePredictions.map(prediction => [prediction.rowId, prediction.p10Score]));
  const baseWinProbabilityByMatch = new Map(
    baseResult.matchPredictions.map(prediction => [prediction.matchKey, prediction.redWinProbability])
  );
  const gatedClosedByRow = new Map(gatedClosedResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore]));
  const gatedOpenByRow = new Map(gatedOpenResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore]));
  const gatedMinClosedByRow = new Map(
    gatedMinClosedResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore])
  );
  const intervalOnlyByRow = new Map(intervalOnlyResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore]));
  const winProbabilityOnlyByRow = new Map(
    winProbabilityOnlyResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore])
  );
  const learnedRegionalPredictions = learnedResult.scorePredictions.filter(prediction => prediction.eventKey === '2026tx');
  const learnedFirstChampionshipPredictions = learnedResult.scorePredictions.filter(
    prediction => prediction.matchKey === '2026gal_qm1'
  );
  const learnedLateChampionshipPredictions = learnedResult.scorePredictions.filter(
    prediction => Number(prediction.matchKey.replace('2026gal_qm', '')) >= 12
  );

  learnedRegionalPredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseByRow.get(prediction.rowId));
  });
  learnedFirstChampionshipPredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseByRow.get(prediction.rowId));
  });
  assert.ok(
    learnedLateChampionshipPredictions.some(
      prediction => Math.abs(prediction.expectedScore - baseByRow.get(prediction.rowId)) > 1e-9
    )
  );
  learnedResult.scorePredictions.forEach(prediction => {
    assert.equal(gatedClosedByRow.get(prediction.rowId), baseByRow.get(prediction.rowId));
    assert.equal(gatedMinClosedByRow.get(prediction.rowId), baseByRow.get(prediction.rowId));
  });
  assert.ok(
    learnedLateChampionshipPredictions.some(
      prediction => Math.abs(gatedOpenByRow.get(prediction.rowId) - baseByRow.get(prediction.rowId)) > 1e-9
    )
  );
  intervalOnlyResult.scorePredictions.forEach(prediction => {
    assert.equal(intervalOnlyByRow.get(prediction.rowId), baseByRow.get(prediction.rowId));
  });
  winProbabilityOnlyResult.scorePredictions.forEach(prediction => {
    assert.equal(winProbabilityOnlyByRow.get(prediction.rowId), baseByRow.get(prediction.rowId));
    assert.equal(prediction.p10Score, baseP10ByRow.get(prediction.rowId));
    assert.equal(prediction.p90Score, baseP90ByRow.get(prediction.rowId));
  });
  assert.ok(
    intervalOnlyResult.scorePredictions
      .filter(prediction => Number(prediction.matchKey.replace('2026gal_qm', '')) >= 12)
      .some(prediction => prediction.p90Score > (baseP90ByRow.get(prediction.rowId) ?? 0))
  );
  assert.ok(
    winProbabilityOnlyResult.scorePredictions
      .filter(prediction => prediction.perspective === 'red')
      .some(prediction => prediction.winProbability != null)
  );
  winProbabilityGatedClosedResult.matchPredictions.forEach(prediction => {
    assert.equal(prediction.redWinProbability, baseWinProbabilityByMatch.get(prediction.matchKey));
  });
  winProbabilitySmoothShrinkResult.scorePredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseByRow.get(prediction.rowId));
    assert.equal(prediction.p10Score, baseP10ByRow.get(prediction.rowId));
    assert.equal(prediction.p90Score, baseP90ByRow.get(prediction.rowId));
  });
  const fullTailWinProbabilityDelta = winProbabilityOnlyResult.matchPredictions.reduce(
    (total, prediction) => total + Math.abs(prediction.redWinProbability - baseWinProbabilityByMatch.get(prediction.matchKey)),
    0
  );
  const smoothTailWinProbabilityDelta = winProbabilitySmoothShrinkResult.matchPredictions.reduce(
    (total, prediction) => total + Math.abs(prediction.redWinProbability - baseWinProbabilityByMatch.get(prediction.matchKey)),
    0
  );
  assert.ok(smoothTailWinProbabilityDelta <= fullTailWinProbabilityDelta + 1e-12);
  assert.equal(learnedResult.config.learnedTailCorrectionFeatureSet, 'phase');
  assert.equal(gatedOpenResult.config.learnedTailCorrectionGateMinSamples, 2);
  assert.equal(gatedMinClosedResult.config.learnedTailCorrectionGateMode, 'min');
  assert.equal(intervalOnlyResult.config.learnedTailCorrectionApplyToMean, false);
  assert.equal(winProbabilityOnlyResult.config.learnedTailWinProbabilityWeight, 1);
  assert.equal(winProbabilityGatedClosedResult.config.learnedTailWinProbabilityMinExpectedMargin, 999);
  assert.equal(winProbabilitySmoothShrinkResult.config.learnedTailWinProbabilityShrinkFloor, 0);
});

test('residual correction waits for prior prediction errors before changing scores', () => {
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 12,
    matchesPerEvent: 24,
    seed: 82
  });
  synthetic.matches[0].red.score = 300;
  synthetic.matches[0].blue.score = 20;
  synthetic.matches[1].red.score = 260;
  synthetic.matches[1].blue.score = 30;
  const dataset = buildWalkForwardDataset(synthetic.matches, [], [], {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const baseConfig = {
    name: 'Test Residual Base Online EPA',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    eventAdjustmentScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const residualConfig = {
    ...baseConfig,
    name: 'Test Residual Corrected Online EPA',
    residualCorrectionWeight: 0.8,
    residualCorrectionLambda: 1,
    residualCorrectionMinRows: 2,
    residualCorrectionClip: 80,
    featureSet: 'minimal'
  };
  const treeResidualConfig = {
    ...baseConfig,
    name: 'Test Tree Residual Corrected Online EPA',
    residualTreeCorrectionWeight: 0.8,
    residualTreeCorrectionMinRows: 2,
    residualTreeCorrectionRefitRows: 1,
    residualTreeCorrectionSampleRows: 100,
    residualTreeCorrectionTrees: 4,
    residualTreeCorrectionLearningRate: 0.2,
    residualTreeCorrectionClip: 80,
    featureSet: 'minimal'
  };
  const run = runModelSearch(dataset, [baseConfig, residualConfig, treeResidualConfig]);
  const base = run.modelResults.find(result => result.config.name === baseConfig.name);
  const residual = run.modelResults.find(result => result.config.name === residualConfig.name);
  const treeResidual = run.modelResults.find(result => result.config.name === treeResidualConfig.name);

  assert.ok(base);
  assert.ok(residual);
  assert.ok(treeResidual);
  assert.equal(base.scorePredictions[0].expectedScore, residual.scorePredictions[0].expectedScore);
  assert.equal(base.scorePredictions[0].expectedScore, treeResidual.scorePredictions[0].expectedScore);
  assert.notDeepEqual(
    base.scorePredictions.map(prediction => prediction.expectedScore).slice(4),
    residual.scorePredictions.map(prediction => prediction.expectedScore).slice(4)
  );
  assert.notDeepEqual(
    base.scorePredictions.map(prediction => prediction.expectedScore).slice(4),
    treeResidual.scorePredictions.map(prediction => prediction.expectedScore).slice(4)
  );
});

test('learned win-probability calibration is local-first and score-neutral', () => {
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 18,
    matchesPerEvent: 36,
    seed: 191
  });
  synthetic.matches.forEach((match, index) => {
    if (index % 2 === 0) {
      match.red.score += 60;
      match.winningAlliance = 'red';
    } else {
      match.blue.score += 60;
      match.winningAlliance = 'blue';
    }
  });
  const dataset = buildWalkForwardDataset(synthetic.matches, [], [], {
    useRoleFeatures: false,
    useContextEpa: false
  });
  const baseConfig = {
    name: 'Test Calibration Base',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'Test Calibration Shared Seed',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const calibratedConfig = {
    ...baseConfig,
    name: 'Test Learned Win Calibration',
    winProbabilityCalibrationWeight: 1,
    winProbabilityCalibrationLambda: 1,
    winProbabilityCalibrationMinMatches: 6,
    winProbabilityCalibrationWindow: 24,
    winProbabilityCalibrationClip: 0.2,
    winProbabilityCalibrationFeatureSet: 'marginConfidence'
  };
  const baseResult = runModelSearch(dataset, [baseConfig]).modelResults[0];
  const calibratedResult = runModelSearch(dataset, [calibratedConfig]).modelResults[0];
  const baseExpectedByRow = new Map(baseResult.scorePredictions.map(prediction => [prediction.rowId, prediction.expectedScore]));
  const baseP10ByRow = new Map(baseResult.scorePredictions.map(prediction => [prediction.rowId, prediction.p10Score]));
  const baseP90ByRow = new Map(baseResult.scorePredictions.map(prediction => [prediction.rowId, prediction.p90Score]));
  const baseWinByMatch = new Map(baseResult.matchPredictions.map(prediction => [prediction.matchKey, prediction.redWinProbability]));

  calibratedResult.scorePredictions.forEach(prediction => {
    assert.equal(prediction.expectedScore, baseExpectedByRow.get(prediction.rowId));
    assert.equal(prediction.p10Score, baseP10ByRow.get(prediction.rowId));
    assert.equal(prediction.p90Score, baseP90ByRow.get(prediction.rowId));
  });
  assert.ok(
    calibratedResult.matchPredictions.some(
      prediction => Math.abs(prediction.redWinProbability - baseWinByMatch.get(prediction.matchKey)) > 1e-9
    )
  );
  assert.equal(calibratedResult.config.winProbabilityCalibrationFeatureSet, 'marginConfidence');
});

test('einstein event metadata is treated as championship context', () => {
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 12,
    matchesPerEvent: 4,
    seed: 44
  });
  const eventKey = synthetic.matches[0].eventKey;
  const dataset = buildWalkForwardDataset(
    synthetic.matches,
    [],
    [],
    { useRoleFeatures: true, useContextEpa: false },
    [
      {
        eventKey,
        season: 2026,
        name: 'Synthetic Einstein Field',
        eventType: 'Einstein',
        week: 8,
        country: 'USA',
        stateProv: 'TX',
        district: null,
        startDate: '2026-05-02',
        endDate: '2026-05-02',
        teamCount: 8,
        source: 'Statbotics',
        raw: {}
      }
    ]
  );
  const firstRow = dataset.rows[0];

  assert.equal(firstRow.features.event_is_champs, 1);
  assert.equal(firstRow.features.event_is_champs_division, 0);
});

test('cross-run summary report is generated from saved run artifacts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-report-'));
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 12,
    matchesPerEvent: 10,
    seed: 33
  });
  const dataset = buildWalkForwardDataset(synthetic.matches, synthetic.observations, synthetic.statboticsSignals, {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const config = {
    name: 'Test Report Online EPA',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    eventAdjustmentScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const run = runModelSearch(dataset, [config]);
  const runDir = writeRunArtifacts(run, path.join(dir, 'run-a'));
  const reportDir = writeCrossRunSummaryArtifacts([runDir], path.join(dir, 'summary'));

  assert.ok(fs.existsSync(path.join(reportDir, 'CROSS_RUN_SUMMARY.md')));
  assert.ok(fs.existsSync(path.join(reportDir, 'cross-run-summary.json')));
  assert.ok(fs.existsSync(path.join(reportDir, 'leaderboard-metrics.svg')));
  assert.match(fs.readFileSync(path.join(reportDir, 'CROSS_RUN_SUMMARY.md'), 'utf8'), /Cross-Run Modeling Summary/);
  assert.match(fs.readFileSync(path.join(reportDir, 'CROSS_RUN_SUMMARY.md'), 'utf8'), /Deployment Rule Review/);
  assert.match(fs.readFileSync(path.join(reportDir, 'CROSS_RUN_SUMMARY.md'), 'utf8'), /Stability Review/);
  assert.match(fs.readFileSync(path.join(reportDir, 'leaderboard-metrics.svg'), 'utf8'), /Cross-Run Metric Comparison/);
});

test('run artifacts include model comparison slice diagnostics before compaction', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-comparison-slices-'));
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 12,
    matchesPerEvent: 14,
    seed: 108
  });
  const dataset = buildWalkForwardDataset(synthetic.matches, synthetic.observations, synthetic.statboticsSignals, {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const referenceConfig = {
    name: 'Test Comparison Reference EPA',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    eventAdjustmentScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const candidateConfig = {
    ...referenceConfig,
    name: 'Test Comparison Candidate EPA',
    lambda: 0.8,
    simulationSeedName: referenceConfig.name
  };
  const run = runModelSearch(dataset, [referenceConfig, candidateConfig]);
  const runDir = writeRunArtifacts(run, path.join(dir, 'run-a'));
  const compactRun = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'));
  const diagnostics = JSON.parse(fs.readFileSync(path.join(runDir, 'model-comparison-slices.json'), 'utf8'));
  const markdown = fs.readFileSync(path.join(runDir, 'MODEL_COMPARISON_SLICES.md'), 'utf8');

  assert.ok(compactRun.modelResults.some(result => !result.promoted && result.matchPredictions.length === 0));
  assert.equal(diagnostics.referenceModel, referenceConfig.name);
  assert.equal(diagnostics.comparisons.length, 1);
  assert.equal(diagnostics.comparisons[0].candidateModel, candidateConfig.name);
  assert.ok(diagnostics.comparisons[0].comparedMatches > 0);
  assert.ok(
    diagnostics.comparisons[0].slices.some(
      slice => slice.sliceType === 'all' && slice.sliceKey === 'all_matches' && Number.isFinite(slice.brierDelta)
    )
  );
  assert.match(markdown, /Model Comparison Slice Diagnostics/);
  assert.match(markdown, /Negative brierDelta/);
});

test('cross-run summary labels TailRisk models as uncertainty diagnostics', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-tailrisk-report-'));
  const runDir = path.join(dir, 'run-a');
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(
    path.join(runDir, 'run.json'),
    JSON.stringify(
      {
        runId: 'tailrisk-role-test',
        createdAt: '2026-05-20T00:00:00.000Z',
        matches: 10,
        rows: 20,
        evaluationMatches: 10,
        evaluationRows: 20,
        bestModelName: 'No-Future TailRiskInterval Residual-Ridge Test TU=1.25',
        notes: [],
        modelResults: [
          {
            config: {
              name: 'No-Future TailRiskInterval Residual-Ridge Test TU=1.25',
              eligibleForPromotion: true,
              leakageRisk: 'low'
            },
            scorePredictions: [],
            matchPredictions: [],
            averageActualScore: 100,
            scoreMae: 20,
            scoreRmse: 25,
            marginMae: 30,
            normalizedScoreMae: 0.2,
            normalizedMarginMae: 0.3,
            winBrier: 0.16,
            calibrationError: 0.02,
            scoreIntervalCoverage: 0.8,
            scoreIntervalWidth: 80,
            coverageError: 0,
            eventScoreMaeStd: 0,
            worstEventScoreMae: 40,
            seasonScoreMaeStd: 0,
            worstSeasonScoreMae: 40,
            benchmarkScore: 1,
            fixedBenchmarkScore: 1,
            benchmarkRank: 1,
            benchmarkPenalty: 0,
            overfitRiskScore: 0,
            benchmarkBreakdown: {},
            fixedBenchmarkBreakdown: {},
            predictionCount: 20,
            promoted: true,
            promotionConfidence: 'near_tie',
            promotionNotes: [],
            rejectionReasons: [],
            sliceMetrics: [],
            vifDiagnostics: [],
            correlationDiagnostics: [],
            featureImportance: []
          }
        ]
      },
      null,
      2
    )
  );
  const reportDir = writeCrossRunSummaryArtifacts([runDir], path.join(dir, 'summary'));
  const summary = fs.readFileSync(path.join(reportDir, 'CROSS_RUN_SUMMARY.md'), 'utf8');

  assert.match(summary, /uncertainty\/reporting candidate/);
  assert.doesNotMatch(summary, /point default candidate/);
});

test('residual diagnostics report is generated from saved run artifacts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-residual-diagnostics-'));
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 2,
    teamsPerEvent: 12,
    matchesPerEvent: 8,
    seed: 94
  });
  const dataset = buildWalkForwardDataset(synthetic.matches, [], [], {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const config = {
    name: 'Diagnostic Residual Test EPA',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const run = runModelSearch(dataset, [config]);
  const runDir = writeRunArtifacts(run, path.join(dir, 'run-a'));
  const diagnostics = buildResidualDiagnostics([{ source: runDir, run }]);
  const reportDir = writeResidualDiagnosticArtifacts([runDir], path.join(dir, 'diagnostics'));

  assert.match(diagnostics.markdown, /Residual Diagnostics/);
  assert.ok(diagnostics.diagnostics[0].eventResiduals.length > 0);
  assert.ok(fs.existsSync(path.join(reportDir, 'RESIDUAL_DIAGNOSTICS.md')));
  assert.ok(fs.existsSync(path.join(reportDir, 'residual-diagnostics.json')));
  assert.ok(fs.existsSync(path.join(reportDir, 'residual-event-mae.svg')));
});

test('cross-run stability review flags full replay winners that fail holdout confirmation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-modeling-stability-'));
  const synthetic = buildSyntheticResearchData({
    seasons: [2026],
    eventsPerSeason: 1,
    teamsPerEvent: 12,
    matchesPerEvent: 12,
    seed: 73
  });
  const dataset = buildWalkForwardDataset(synthetic.matches, synthetic.observations, synthetic.statboticsSignals, {
    useRoleFeatures: true,
    useContextEpa: false
  });
  const baseConfig = {
    name: 'Test Stability Full Replay Winner',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    eventAdjustmentScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  };
  const holdoutConfig = {
    ...baseConfig,
    name: 'Test Stability Holdout Winner',
    lambda: 1.2
  };
  const run = runModelSearch(dataset, [baseConfig, holdoutConfig]);
  const fullRun = JSON.parse(JSON.stringify(run));
  const holdoutRun = JSON.parse(JSON.stringify(run));

  fullRun.bestModelName = baseConfig.name;
  holdoutRun.bestModelName = holdoutConfig.name;
  holdoutRun.evaluationMatches = Math.floor(run.matches / 2);
  holdoutRun.evaluationRows = Math.floor(run.rows / 2);
  holdoutRun.modelResults.forEach(result => {
    result.fixedBenchmarkScore = result.config.name === holdoutConfig.name ? 0.1 : 10;
  });

  const summary = buildCrossRunSummary([
    { source: path.join(dir, 'full-run', 'run.json'), run: fullRun },
    { source: path.join(dir, 'holdout-run', 'run.json'), run: holdoutRun }
  ]);

  assert.equal(summary.stabilityReview.fullReplayChecks[0].status, 'unconfirmed');
  assert.match(summary.markdown, /was not confirmed/);
});

test('dashboard verifier flags unsafe overclaim wording outside audit contexts', () => {
  const unsafeIssues = findOverclaimWordingIssues(
    'README.md',
    'This is the best possible model, and package verification proves the model is correct.'
  );
  const safeWarningIssues = findOverclaimWordingIssues('README.md', 'Do not say this is the best possible model.');
  const auditExampleIssues = findOverclaimWordingIssues(
    'PRESENTATION_WORDING_AUDIT.md',
    '| The model is accurate. | Use measured walk-forward errors instead. |'
  );

  assert.ok(unsafeIssues.some(issue => issue.includes('best possible model')));
  assert.ok(unsafeIssues.some(issue => issue.includes('model correctness')));
  assert.equal(safeWarningIssues.length, 0);
  assert.equal(auditExampleIssues.length, 0);
});

test('dashboard verifier flags broken in-page jump anchors', () => {
  const validHtml = `
    <a href="#start-here-story">Start Here</a>
    <a href="#final-gate-proof">Final Gate Proof</a>
    <a href="#screenshot-proof-index">Screenshot Proof</a>
    <a href="#documentation-proof-index">Docs Proof</a>
    <a href="#live-demo-runbook">Live Demo</a>
    <a href="#claim-boundaries">Claim Safety</a>
    <a href="#leakage-audit">Leakage Guard</a>
    <a href="#hostile-judge-cross-exam">Cross-Exam</a>
    <a href="#judge-rubric-alignment">Rubric Fit</a>
    <a href="#judge-dry-run-scorecard">Dry Run</a>
    <a href="#judge-story-spine">Story Spine</a>
    <a href="#finalist-comparison">Finalists</a>
    <a href="#model-anatomy">Model Visual</a>
    <a href="#model-source-map">Source Map</a>
    <a href="#prediction-behavior">Accuracy Stats</a>
    <a href="#strategy-example">Strategy Use</a>
    <a href="#failure-mode-atlas">Failure Modes</a>
    <a href="#evidence-matrix">Evidence Map</a>
    <a href="#risk-register">Risk Register</a>
    <a href="#final-readiness-check">Ready Check</a>
    <a href="#final-package-map">Final Package Map</a>
    <a href="#model-leaderboard">Model Scores</a>
    <a href="#what-should-surprise">Judge Surprises</a>
    <a href="#starred-html-coverage">Starred Coverage</a>
    <a href="#source-code-evidence-lock">Code Evidence</a>
    <section id="start-here-story"></section>
    <section id="final-gate-proof"></section>
    <section id="screenshot-proof-index"></section>
    <section id="documentation-proof-index"></section>
    <section id="live-demo-runbook"></section>
    <section id="claim-boundaries"></section>
    <section id="leakage-audit"></section>
    <section id="hostile-judge-cross-exam"></section>
    <section id="judge-rubric-alignment"></section>
    <section id="judge-dry-run-scorecard"></section>
    <section id="judge-story-spine"></section>
    <section id="finalist-comparison"></section>
    <section id="model-anatomy"></section>
    <section id="model-source-map"></section>
    <section id="prediction-behavior"></section>
    <section id="strategy-example"></section>
    <section id="failure-mode-atlas"></section>
    <section id="evidence-matrix"></section>
    <section id="risk-register"></section>
    <section id="final-readiness-check"></section>
    <section id="final-package-map"></section>
    <section id="model-leaderboard"></section>
    <section id="what-should-surprise"></section>
    <section id="starred-html-coverage"></section>
    <section id="source-code-evidence-lock"></section>
  `;
  const brokenHtml = `
    <a href="#final-gate-proof">Final Gate Proof</a>
    <a href="#missing-map">Final Package Map</a>
  `;
  const wrongRouteHtml = `
    <a href="#final-gate-proof">Final Gate Proof</a>
    <a href="#final-package-map">Final Package Map</a>
    <a href="#model-leaderboard">Model Scores</a>
    <a href="#what-should-surprise">Judge Surprises</a>
    <a href="#some-other-section">Something Else</a>
    <section id="final-gate-proof"></section>
    <section id="final-package-map"></section>
    <section id="model-leaderboard"></section>
    <section id="what-should-surprise"></section>
    <section id="some-other-section"></section>
  `;

  assert.deepEqual(findInPageAnchorIssues(validHtml), []);
  assert.ok(findInPageAnchorIssues(brokenHtml).some(issue => issue.includes('#missing-map')));
  assert.ok(findInPageAnchorIssues(brokenHtml).some(issue => issue.includes('at least')));
  assert.ok(findInPageAnchorIssues(wrongRouteHtml).some(issue => issue.includes('#starred-html-coverage')));
});
