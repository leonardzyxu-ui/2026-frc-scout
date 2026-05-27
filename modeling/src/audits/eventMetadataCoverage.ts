import path from 'node:path';
import { ResearchStore } from '../data/store.ts';
import type { EventMetadata } from '../types.ts';
import { writeJsonFile, writeTextFile } from '../util.ts';

const countBy = <T>(items: T[], getKey: (item: T) => string) => {
  const counts = new Map<string, number>();
  items.forEach(item => {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
};

export interface EventMetadataCoverageAudit {
  createdAt: string;
  officialMatches: number;
  officialEvents: number;
  metadataRows: number;
  officialEventsWithMetadata: number;
  officialEventsMissingMetadata: number;
  officialEventCoverage: number;
  metadataSources: Record<string, number>;
  officialEventTypes: Record<string, number>;
  missingEventSamples: string[];
  notes: string[];
}

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const buildMarkdown = (audit: EventMetadataCoverageAudit) => `# Event Metadata Coverage Audit

Generated: ${audit.createdAt}

## Summary

| Metric | Value |
| --- | ---: |
| Official matches | ${audit.officialMatches} |
| Official events | ${audit.officialEvents} |
| Metadata rows | ${audit.metadataRows} |
| Official events with metadata | ${audit.officialEventsWithMetadata} |
| Official events missing metadata | ${audit.officialEventsMissingMetadata} |
| Official event coverage | ${formatPercent(audit.officialEventCoverage)} |

## Interpretation

${audit.notes.map(note => `- ${note}`).join('\n')}

## Metadata Sources

${
  Object.keys(audit.metadataSources).length > 0
    ? Object.entries(audit.metadataSources).map(([source, count]) => `- ${source}: ${count}`).join('\n')
    : '- No metadata rows cached.'
}

## Official Event Types

${
  Object.keys(audit.officialEventTypes).length > 0
    ? Object.entries(audit.officialEventTypes).map(([eventType, count]) => `- ${eventType}: ${count}`).join('\n')
    : '- No official events with metadata.'
}

## Missing Official Event Samples

${audit.missingEventSamples.length > 0 ? audit.missingEventSamples.map(eventKey => `- ${eventKey}`).join('\n') : '- None.'}
`;

export const auditEventMetadataCoverage = (
  store: ResearchStore,
  outputDir = path.resolve('modeling/artifacts/audits/event-metadata-coverage')
) => {
  const matches = store.getMatches();
  const metadata = store.getEventMetadata();
  const metadataByKey = new Map(metadata.map(event => [event.eventKey, event]));
  const officialEventKeys = [...new Set(matches.map(match => match.eventKey))].sort();
  const officialMetadata = officialEventKeys
    .map(eventKey => metadataByKey.get(eventKey))
    .filter((event): event is EventMetadata => event != null);
  const missingEventSamples = officialEventKeys.filter(eventKey => !metadataByKey.has(eventKey)).slice(0, 30);
  const officialEventCoverage = officialEventKeys.length > 0 ? officialMetadata.length / officialEventKeys.length : 0;
  const notes = [
    officialEventCoverage === 1
      ? 'Every official event in the cached match set has an event metadata row.'
      : `${missingEventSamples.length} missing event sample(s) are shown below; missing metadata falls back to event-key heuristics where possible.`,
    'Only known-before-match metadata fields are intended to become model features.',
    'Metadata source counts include all cached metadata rows, while event-type counts are restricted to official events present in the match cache.'
  ];
  const audit: EventMetadataCoverageAudit = {
    createdAt: new Date().toISOString(),
    officialMatches: matches.length,
    officialEvents: officialEventKeys.length,
    metadataRows: metadata.length,
    officialEventsWithMetadata: officialMetadata.length,
    officialEventsMissingMetadata: officialEventKeys.length - officialMetadata.length,
    officialEventCoverage,
    metadataSources: countBy(metadata, event => event.source),
    officialEventTypes: countBy(officialMetadata, event => event.eventType),
    missingEventSamples,
    notes
  };

  writeJsonFile(path.join(outputDir, 'audit.json'), audit);
  writeTextFile(path.join(outputDir, 'EVENT_METADATA_COVERAGE.md'), buildMarkdown(audit));
  return audit;
};
