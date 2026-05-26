import path from 'node:path';
import { ResearchStore } from '../data/store.ts';
import type { RawPayload } from '../types.ts';
import { writeJsonFile, writeTextFile } from '../util.ts';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const lowerKeys = (record: Record<string, unknown>) => new Set(Object.keys(record).map(key => key.toLowerCase()));

const increment = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const extractRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  for (const key of ['matches', 'data', 'results']) {
    const rows = asArray(record[key]);
    if (rows.length > 0) return rows;
  }
  return [];
};

const predictionValueKeys = new Set([
  'winner',
  'red_win_prob',
  'red_score',
  'blue_score',
  'red_rp_1',
  'blue_rp_1',
  'red_rp_2',
  'blue_rp_2'
]);

const predictionTimestampKeys = new Set([
  'as_of',
  'created_at',
  'generated_at',
  'pred_generated_at',
  'pred_time',
  'pred_timestamp',
  'pred_updated_at',
  'prediction_generated_at',
  'prediction_time',
  'prediction_timestamp',
  'prediction_updated_at',
  'timestamp',
  'updated_at'
]);

const predictionSpecificRowTimestampKeys = new Set([
  'pred_generated_at',
  'pred_time',
  'pred_timestamp',
  'pred_updated_at',
  'prediction_generated_at',
  'prediction_time',
  'prediction_timestamp',
  'prediction_updated_at'
]);

const timeLikePattern = /(time|date|created|generated|updated|timestamp|as_of)/i;

const hasPredictionValues = (pred: Record<string, unknown>) => {
  const keys = lowerKeys(pred);
  return [...predictionValueKeys].some(key => keys.has(key));
};

const timeLikeKeys = (record: Record<string, unknown>) => Object.keys(record).filter(key => timeLikePattern.test(key));

const timestampKeysFromPred = (pred: Record<string, unknown>) =>
  Object.keys(pred).filter(key => predictionTimestampKeys.has(key.toLowerCase()));

const timestampKeysFromRow = (row: Record<string, unknown>) =>
  Object.keys(row).filter(key => predictionSpecificRowTimestampKeys.has(key.toLowerCase()));

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export interface StatboticsPredictionProvenanceAudit {
  createdAt: string;
  rawPayloadBatches: number;
  rawMatches: number;
  completedMatches: number;
  matchesWithPredictions: number;
  matchesWithSpecificPredictionTimestamp: number;
  matchesWithoutSpecificPredictionTimestamp: number;
  predictionTimestampCoverage: number;
  promotionRecommendation: 'candidate_for_promotable_review' | 'keep_non_promotable';
  riskLevel: 'low' | 'high';
  predictionFieldCounts: Record<string, number>;
  topLevelTimeFieldCounts: Record<string, number>;
  predTimeFieldCounts: Record<string, number>;
  sampleMatches: Array<{
    matchKey: string;
    eventKey: string;
    season: number | null;
    status: string;
    topLevelTimeLikeKeys: string[];
    predTimeLikeKeys: string[];
    predictionKeys: string[];
  }>;
  notes: string[];
}

const buildMarkdown = (audit: StatboticsPredictionProvenanceAudit) => `# Statbotics Prediction Provenance Audit

Generated: ${audit.createdAt}

## Summary

| Metric | Value |
| --- | ---: |
| Raw payload batches | ${audit.rawPayloadBatches} |
| Raw match rows | ${audit.rawMatches} |
| Completed match rows | ${audit.completedMatches} |
| Rows with prediction values | ${audit.matchesWithPredictions} |
| Rows with prediction-specific timestamps | ${audit.matchesWithSpecificPredictionTimestamp} |
| Prediction timestamp coverage | ${formatPercent(audit.predictionTimestampCoverage)} |
| Risk level | ${audit.riskLevel} |
| Recommendation | ${audit.promotionRecommendation} |

## Interpretation

${audit.notes.map(note => `- ${note}`).join('\n')}

## Prediction Fields Seen

${Object.entries(audit.predictionFieldCounts)
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .map(([key, count]) => `- \`${key}\`: ${count}`)
  .join('\n')}

## Time-Like Fields

Top-level fields:

${Object.entries(audit.topLevelTimeFieldCounts)
  .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  .map(([key, count]) => `- \`${key}\`: ${count}`)
  .join('\n')}

Prediction-object fields:

${
  Object.keys(audit.predTimeFieldCounts).length > 0
    ? Object.entries(audit.predTimeFieldCounts)
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([key, count]) => `- \`${key}\`: ${count}`)
        .join('\n')
    : '- None found.'
}

## Sample Rows

${audit.sampleMatches
  .map(
    sample =>
      `- \`${sample.matchKey}\` (${sample.eventKey}, ${sample.status || 'unknown'}): pred keys ${sample.predictionKeys
        .map(key => `\`${key}\``)
        .join(', ')}; top-level time-like keys ${sample.topLevelTimeLikeKeys.map(key => `\`${key}\``).join(', ') || 'none'}; pred time-like keys ${
        sample.predTimeLikeKeys.map(key => `\`${key}\``).join(', ') || 'none'
      }`
  )
  .join('\n')}
`;

export const auditStatboticsPredictionProvenance = (
  store: ResearchStore,
  outputDir = path.resolve('modeling/artifacts/audits/statbotics-prediction-provenance')
) => {
  const payloads = store.getRawPayloads({ source: 'Statbotics', endpointKeyPrefix: '/matches' });
  const predictionFieldCounts: Record<string, number> = {};
  const topLevelTimeFieldCounts: Record<string, number> = {};
  const predTimeFieldCounts: Record<string, number> = {};
  const sampleMatches: StatboticsPredictionProvenanceAudit['sampleMatches'] = [];
  let rawMatches = 0;
  let completedMatches = 0;
  let matchesWithPredictions = 0;
  let matchesWithSpecificPredictionTimestamp = 0;

  payloads.forEach((payload: RawPayload) => {
    extractRows(payload.payload).forEach(rawRow => {
      rawMatches += 1;
      const row = asRecord(rawRow);
      const pred = asRecord(row.pred);
      const status = String(row.status ?? '');
      const predictionKeys = Object.keys(pred);
      const topTimeKeys = timeLikeKeys(row);
      const predTimeKeys = timestampKeysFromPred(pred);
      const rowPredictionTimeKeys = timestampKeysFromRow(row);

      if (status.toLowerCase() === 'completed') completedMatches += 1;
      predictionKeys.forEach(key => increment(predictionFieldCounts, key));
      topTimeKeys.forEach(key => increment(topLevelTimeFieldCounts, key));
      predTimeKeys.forEach(key => increment(predTimeFieldCounts, key));

      if (!hasPredictionValues(pred)) return;
      matchesWithPredictions += 1;
      if (predTimeKeys.length > 0 || rowPredictionTimeKeys.length > 0) {
        matchesWithSpecificPredictionTimestamp += 1;
      }
      if (sampleMatches.length < 8) {
        sampleMatches.push({
          matchKey: String(row.key ?? ''),
          eventKey: String(row.event ?? ''),
          season: typeof payload.season === 'number' ? payload.season : null,
          status,
          topLevelTimeLikeKeys: topTimeKeys,
          predTimeLikeKeys: [...predTimeKeys, ...rowPredictionTimeKeys],
          predictionKeys
        });
      }
    });
  });

  const matchesWithoutSpecificPredictionTimestamp = matchesWithPredictions - matchesWithSpecificPredictionTimestamp;
  const predictionTimestampCoverage =
    matchesWithPredictions > 0 ? matchesWithSpecificPredictionTimestamp / matchesWithPredictions : 0;
  const promotionRecommendation =
    matchesWithPredictions > 0 && predictionTimestampCoverage === 1
      ? 'candidate_for_promotable_review'
      : 'keep_non_promotable';
  const riskLevel = promotionRecommendation === 'candidate_for_promotable_review' ? 'low' : 'high';
  const notes = [
    'Published Statbotics match predictions are strong comparators, but they are not safe model features unless each archived prediction can be tied to a generated-before-match timestamp.',
    '`time` and `predicted_time` appear on match rows, but those describe match timing, not when the prediction object was generated.',
    matchesWithoutSpecificPredictionTimestamp > 0
      ? `${matchesWithoutSpecificPredictionTimestamp} prediction row(s) lack a prediction-specific timestamp, so the published-prediction model remains non-promotable.`
      : 'Every prediction row has a prediction-specific timestamp; this still needs source-level documentation before promotion.'
  ];

  const audit: StatboticsPredictionProvenanceAudit = {
    createdAt: new Date().toISOString(),
    rawPayloadBatches: payloads.length,
    rawMatches,
    completedMatches,
    matchesWithPredictions,
    matchesWithSpecificPredictionTimestamp,
    matchesWithoutSpecificPredictionTimestamp,
    predictionTimestampCoverage,
    promotionRecommendation,
    riskLevel,
    predictionFieldCounts,
    topLevelTimeFieldCounts,
    predTimeFieldCounts,
    sampleMatches,
    notes
  };

  writeJsonFile(path.join(outputDir, 'audit.json'), audit);
  writeTextFile(path.join(outputDir, 'AUDIT.md'), buildMarkdown(audit));
  return audit;
};
