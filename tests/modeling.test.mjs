import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ResearchStore } from '../modeling/src/data/store.ts';
import { buildSyntheticResearchData } from '../modeling/src/data/synthetic.ts';
import { buildWalkForwardDataset, summarizeDataset } from '../modeling/src/modeling/features.ts';
import { runModelSearch } from '../modeling/src/modeling/train.ts';

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
