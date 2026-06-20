import type {
  MatchDefenseScoutingV1,
  MatchScoutingV3,
  MatchScoutingV4,
  PreMatchTeamProfile
} from '../types';
import { isMatchDefenseScoutingV1 } from './matchDefenseScouting';
import { isMatchScoutingV3 } from './matchScoutingV3';
import { isMatchScoutingV4 } from './matchScoutingV4';
import type { TBAMatch } from './mathEngine';
import type { TBAEliminationAlliance } from './matchPredictor';
import type { EventTeamRosterRow } from './preMatchScouting';
import { sanitizeAdminV4TeamNumber } from './adminV4TeamSearch';
import type { StatboticsNormalizedTeamEpa } from './statbotics';
import { listAdminV4CacheEntries } from './adminV4LocalStore';
import type { AdminV4CacheEntry } from './adminV4LocalStore';

export interface TbaRankingsResponse {
  rankings?: Array<{
    team_key: string;
    rank: number;
  }>;
}

export const getLatestAdminV4CachePayload = <T,>(
  entries: AdminV4CacheEntry[],
  source: AdminV4CacheEntry['source'],
  key: string
): T | null => {
  const entry = entries
    .filter(candidate => candidate.source === source && candidate.key === key)
    .sort((left, right) => right.timestamp - left.timestamp)[0];
  return entry ? entry.payload as T : null;
};

export const isCachedTbaMatches = (value: unknown): value is TBAMatch[] =>
  Array.isArray(value) && value.every(match => !!match && typeof match === 'object' && 'alliances' in match && 'key' in match);

export const isCachedTbaRankings = (value: unknown): value is TbaRankingsResponse =>
  !!value && typeof value === 'object' && Array.isArray((value as TbaRankingsResponse).rankings);

export const isCachedTbaAlliances = (value: unknown): value is TBAEliminationAlliance[] =>
  Array.isArray(value);

export const isCachedStatboticsEpaPayload = (
  value: unknown
): value is { epaByTeam: Record<string, StatboticsNormalizedTeamEpa>; missingTeams?: string[] } =>
  !!value &&
  typeof value === 'object' &&
  !!(value as { epaByTeam?: unknown }).epaByTeam &&
  typeof (value as { epaByTeam?: unknown }).epaByTeam === 'object';

export const isCachedPreMatchTeamProfile = (value: unknown): value is PreMatchTeamProfile =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as Partial<PreMatchTeamProfile>).teamNumber === 'string' &&
  typeof (value as Partial<PreMatchTeamProfile>).teamKey === 'string' &&
  typeof (value as Partial<PreMatchTeamProfile>).nickname === 'string';

export const isCachedMatchScoutingV3Rows = (value: unknown): value is MatchScoutingV3[] =>
  Array.isArray(value) && value.every(isMatchScoutingV3);

export const isCachedMatchScoutingV4Rows = (value: unknown): value is MatchScoutingV4[] =>
  Array.isArray(value) && value.every(isMatchScoutingV4);

export const isCachedDefenseRows = (value: unknown): value is MatchDefenseScoutingV1[] =>
  Array.isArray(value) && value.every(isMatchDefenseScoutingV1);

export const isCachedEventTeamRoster = (value: unknown): value is EventTeamRosterRow[] =>
  Array.isArray(value) &&
  value.every(item =>
    item &&
    typeof item === 'object' &&
    typeof (item as Partial<EventTeamRosterRow>).teamNumber === 'string' &&
    typeof (item as Partial<EventTeamRosterRow>).nickname === 'string'
  );

export const teamRosterToNameLookup = (rows: EventTeamRosterRow[]) =>
  Object.fromEntries(rows.map(row => [sanitizeAdminV4TeamNumber(row.teamNumber), row.nickname || '']).filter(([teamNumber]) => teamNumber));

export const loadLatestCachedPayload = async <T,>(
  eventKey: string,
  source: AdminV4CacheEntry['source'],
  key: string,
  guard: (value: unknown) => value is T
): Promise<{ payload: T; timestamp: number } | null> => {
  const entries = await listAdminV4CacheEntries(eventKey);
  const entry = entries
    .filter(item => item.source === source && item.key === key)
    .sort((left, right) => right.timestamp - left.timestamp)
    .find(item => guard(item.payload));
  if (!entry || !guard(entry.payload)) return null;
  return { payload: entry.payload, timestamp: entry.timestamp };
};
