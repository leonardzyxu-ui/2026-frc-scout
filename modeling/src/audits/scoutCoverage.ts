import path from 'node:path';
import { ResearchStore } from '../data/store.ts';
import type { HistoricalMatch, ScoutingObservation } from '../types.ts';
import { writeJsonFile, writeTextFile } from '../util.ts';

const observationKey = (eventKey: string, matchKey: string, teamKey: string) => `${eventKey}|${matchKey}|${teamKey}`;

const matchAliases = (match: HistoricalMatch) => {
  const suffix = match.key.split('_').pop() ?? match.key;
  return new Set([match.key, suffix, `${match.compLevel}${match.matchNumber}`.toLowerCase()]);
};

const buildOfficialObservationKeys = (matches: HistoricalMatch[]) => {
  const keys = new Set<string>();
  matches.forEach(match => {
    const aliases = matchAliases(match);
    [...match.red.teamKeys, ...match.blue.teamKeys].forEach(teamKey => {
      aliases.forEach(alias => keys.add(observationKey(match.eventKey, alias, teamKey)));
    });
  });
  return keys;
};

const countBy = <T>(items: T[], getKey: (item: T) => string) => {
  const counts = new Map<string, number>();
  items.forEach(item => {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
};

export interface ScoutCoverageAudit {
  createdAt: string;
  officialMatches: number;
  officialTeamSlots: number;
  scoutingObservations: number;
  matchedObservations: number;
  unmatchedObservations: number;
  observationMatchCoverage: number;
  eventsWithScoutData: number;
  teamsWithScoutData: number;
  sources: Record<string, number>;
  events: Record<string, number>;
  unmatchedSamples: Array<Pick<ScoutingObservation, 'eventKey' | 'matchKey' | 'teamKey' | 'source'>>;
  notes: string[];
}

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const buildMarkdown = (audit: ScoutCoverageAudit) => `# Scout Coverage Audit

Generated: ${audit.createdAt}

## Summary

| Metric | Value |
| --- | ---: |
| Official matches | ${audit.officialMatches} |
| Official team slots | ${audit.officialTeamSlots} |
| Scouting observations | ${audit.scoutingObservations} |
| Matched observations | ${audit.matchedObservations} |
| Unmatched observations | ${audit.unmatchedObservations} |
| Observation match coverage | ${formatPercent(audit.observationMatchCoverage)} |
| Events with scout data | ${audit.eventsWithScoutData} |
| Teams with scout data | ${audit.teamsWithScoutData} |

## Interpretation

${audit.notes.map(note => `- ${note}`).join('\n')}

## Sources

${
  Object.keys(audit.sources).length > 0
    ? Object.entries(audit.sources).map(([source, count]) => `- ${source}: ${count}`).join('\n')
    : '- No scouting observations cached.'
}

## Events

${
  Object.keys(audit.events).length > 0
    ? Object.entries(audit.events).map(([eventKey, count]) => `- ${eventKey}: ${count}`).join('\n')
    : '- No scouting observations cached.'
}

## Unmatched Samples

${
  audit.unmatchedSamples.length > 0
    ? audit.unmatchedSamples
        .map(sample => `- ${sample.source} ${sample.eventKey} ${sample.matchKey} ${sample.teamKey}`)
        .join('\n')
    : '- None.'
}
`;

export const auditScoutCoverage = (
  store: ResearchStore,
  outputDir = path.resolve('modeling/artifacts/audits/scout-coverage')
) => {
  const matches = store.getMatches();
  const observations = store.getScoutingObservations();
  const officialKeys = buildOfficialObservationKeys(matches);
  const matched = observations.filter(observation =>
    officialKeys.has(observationKey(observation.eventKey, observation.matchKey, observation.teamKey))
  );
  const unmatched = observations.filter(
    observation => !officialKeys.has(observationKey(observation.eventKey, observation.matchKey, observation.teamKey))
  );
  const observationMatchCoverage = observations.length > 0 ? matched.length / observations.length : 0;
  const notes = [
    observations.length === 0
      ? 'No scouting observations are currently cached, so official-data model runs are not scout-enriched.'
      : `${matched.length} of ${observations.length} scouting observation(s) align with cached official match/team rows.`,
    'A row is counted as matched only when event key, match key or common match-key alias, and team key agree with an official match row.',
    'This audit validates data availability; it does not by itself prove that scout labels improve the model leaderboard.'
  ];
  const audit: ScoutCoverageAudit = {
    createdAt: new Date().toISOString(),
    officialMatches: matches.length,
    officialTeamSlots: matches.reduce((sum, match) => sum + match.red.teamKeys.length + match.blue.teamKeys.length, 0),
    scoutingObservations: observations.length,
    matchedObservations: matched.length,
    unmatchedObservations: unmatched.length,
    observationMatchCoverage,
    eventsWithScoutData: new Set(observations.map(observation => observation.eventKey)).size,
    teamsWithScoutData: new Set(observations.map(observation => observation.teamKey)).size,
    sources: countBy(observations, observation => observation.source),
    events: countBy(observations, observation => observation.eventKey),
    unmatchedSamples: unmatched.slice(0, 20).map(observation => ({
      eventKey: observation.eventKey,
      matchKey: observation.matchKey,
      teamKey: observation.teamKey,
      source: observation.source
    })),
    notes
  };

  writeJsonFile(path.join(outputDir, 'audit.json'), audit);
  writeTextFile(path.join(outputDir, 'SCOUT_COVERAGE.md'), buildMarkdown(audit));
  return audit;
};
