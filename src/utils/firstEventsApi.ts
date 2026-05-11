import { FirstEventsCredentials, buildFirstEventsAuthHeader, putAdminV2CacheEntry } from './adminV2LocalStore';
import { TBAMatch } from './mathEngine';

const FIRST_API_BASE = 'https://frc-api.firstinspires.org/v3.0';

export const getYearFromEventKey = (eventKey: string) => {
  const match = eventKey.match(/^(\d{4})/);
  return match ? Number(match[1]) : new Date().getFullYear();
};

export const getFirstEventCode = (eventKey: string) => eventKey.replace(/^\d{4}/, '').toUpperCase();

export async function fetchFirstEventsJson<T>(
  credentials: FirstEventsCredentials,
  year: number,
  endpoint: string
): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await fetch(`${FIRST_API_BASE}/${year}${normalizedEndpoint}`, {
    headers: {
      Authorization: buildFirstEventsAuthHeader(credentials),
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`FIRST Events API ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export async function fetchAndCacheFirstEventBundle(credentials: FirstEventsCredentials, eventKey: string) {
  const year = getYearFromEventKey(eventKey);
  const eventCode = getFirstEventCode(eventKey);
  const endpoints = [
    ['event', `/events?eventCode=${encodeURIComponent(eventCode)}`],
    ['teams', `/teams?eventCode=${encodeURIComponent(eventCode)}`],
    ['qual-schedule', `/schedule/${encodeURIComponent(eventCode)}?tournamentLevel=qual`],
    ['practice-schedule', `/schedule/${encodeURIComponent(eventCode)}?tournamentLevel=practice`],
    ['qual-matches', `/matches/${encodeURIComponent(eventCode)}?tournamentLevel=qual`],
    ['playoff-matches', `/matches/${encodeURIComponent(eventCode)}?tournamentLevel=playoff`],
    ['rankings', `/rankings/${encodeURIComponent(eventCode)}`],
    ['alliances', `/alliances/${encodeURIComponent(eventCode)}`],
    ['qual-scores', `/scores/${encodeURIComponent(eventCode)}/qual`]
  ] as const;

  const results: Array<{ key: string; ok: boolean; error?: string }> = [];

  for (const [key, endpoint] of endpoints) {
    try {
      const payload = await fetchFirstEventsJson<unknown>(credentials, year, endpoint);
      await putAdminV2CacheEntry({
        eventKey,
        year,
        source: 'FIRST',
        key,
        payload
      });
      results.push({ key, ok: true });
    } catch (error) {
      results.push({ key, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return results;
}

const firstArray = (payload: unknown, keys: string[]) => {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key] ?? record[key.toLowerCase()];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }
  return [];
};

const firstNumber = (record: Record<string, unknown>, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = record[key] ?? record[key.toLowerCase()];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
};

const firstString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key] ?? record[key.toLowerCase()];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const normalizeFirstCompLevel = (level: string, fallbackKey: 'qm' | 'pm' | 'sf') => {
  const normalized = level.trim().toLowerCase();
  if (normalized.includes('practice') || normalized === 'p') return 'pm';
  if (normalized.includes('qual') || normalized === 'q') return 'qm';
  if (normalized.includes('final')) return 'f';
  if (normalized.includes('playoff') || normalized.includes('semi') || normalized.includes('elim')) return 'sf';
  return fallbackKey;
};

const normalizeFirstStation = (station: string) => station.toLowerCase().replace(/[^a-z0-9]/g, '');

const getFirstTeamNumber = (team: Record<string, unknown>) =>
  firstString(team, ['teamNumber', 'team_number', 'team', 'TeamNumber']).replace(/[^\d]/g, '');

const normalizeFirstTeamKey = (teamKey: string) => teamKey.replace(/^frc/i, '');

const getFirstStation = (team: Record<string, unknown>) =>
  firstString(team, ['station', 'Station', 'allianceStation', 'alliance_station']);

const buildFirstMatchKey = (eventKey: string, compLevel: string, matchNumber: number, index: number) => {
  const normalizedEvent = eventKey.trim().toLowerCase();
  if (compLevel === 'qm' || compLevel === 'pm') return `${normalizedEvent}_${compLevel}${matchNumber}`;
  return `${normalizedEvent}_${compLevel}${matchNumber || index + 1}m1`;
};

const parseFirstTimestamp = (record: Record<string, unknown>) => {
  const raw = firstString(record, ['actualStartTime', 'postResultTime', 'startTime', 'time', 'date']);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
};

export const convertFirstEventsPayloadsToTbaMatches = (
  eventKey: string,
  payloads: Array<{ payload: unknown; fallbackCompLevel: 'qm' | 'pm' | 'sf' }>
): TBAMatch[] => {
  const matches: TBAMatch[] = [];

  payloads.forEach(({ payload, fallbackCompLevel }) => {
    const rows = firstArray(payload, ['Matches', 'matches', 'Schedule', 'schedule']);
    rows.forEach((row, index) => {
      const matchNumber = firstNumber(row, ['matchNumber', 'match_number', 'MatchNumber'], index + 1);
      const compLevel = normalizeFirstCompLevel(
        firstString(row, ['tournamentLevel', 'TournamentLevel', 'level', 'compLevel']),
        fallbackCompLevel
      );
      const teams = firstArray(row, ['teams', 'Teams']);
      const redTeams: string[] = [];
      const blueTeams: string[] = [];

      teams.forEach(team => {
        const teamNumber = getFirstTeamNumber(team);
        if (!teamNumber) return;
        const station = normalizeFirstStation(getFirstStation(team));
        if (station.includes('red')) redTeams.push(`frc${teamNumber}`);
        if (station.includes('blue')) blueTeams.push(`frc${teamNumber}`);
      });

      if (redTeams.length === 0 && blueTeams.length === 0) return;

      const redScore = firstNumber(row, ['scoreRedFinal', 'scoreRed', 'redScore', 'score_red_final'], -1);
      const blueScore = firstNumber(row, ['scoreBlueFinal', 'scoreBlue', 'blueScore', 'score_blue_final'], -1);
      const winningAlliance =
        redScore < 0 || blueScore < 0
          ? ''
          : redScore === blueScore
            ? ''
            : redScore > blueScore ? 'red' : 'blue';
      const timestamp = parseFirstTimestamp(row);

      matches.push({
        key: buildFirstMatchKey(eventKey, compLevel, matchNumber, index),
        event_key: eventKey.trim().toLowerCase(),
        comp_level: compLevel,
        match_number: matchNumber,
        set_number: 1,
        time: timestamp,
        predicted_time: timestamp,
        actual_time: timestamp,
        winning_alliance: winningAlliance,
        alliances: {
          red: { score: redScore, team_keys: redTeams },
          blue: { score: blueScore, team_keys: blueTeams }
        }
      });
    });
  });

  const unique = new Map<string, TBAMatch>();
  matches.forEach(match => unique.set(match.key, match));
  return Array.from(unique.values()).sort((left, right) => {
    const compOrder: Record<string, number> = { pm: 0, qm: 1, sf: 2, f: 3 };
    const levelDelta = (compOrder[left.comp_level] ?? 9) - (compOrder[right.comp_level] ?? 9);
    if (levelDelta !== 0) return levelDelta;
    return left.match_number - right.match_number;
  });
};

export const convertFirstTeamsPayloadToTeamNames = (payload: unknown): Record<string, string> => {
  const teams = firstArray(payload, ['Teams', 'teams']);
  const teamNames: Record<string, string> = {};

  teams.forEach(team => {
    const teamNumber = getFirstTeamNumber(team);
    if (!teamNumber) return;
    const nickname =
      firstString(team, ['nameShort', 'shortName', 'nickname', 'teamNameShort', 'name']) ||
      firstString(team, ['nameFull', 'fullName', 'teamName']);
    if (nickname) {
      teamNames[teamNumber] = nickname;
    }
  });

  return teamNames;
};

export const convertFirstRankingsPayloadToTbaRankings = (payload: unknown) => {
  const rankings = firstArray(payload, ['Rankings', 'rankings']);
  const convertedRankings = rankings
    .map(row => {
      const teamNumber = getFirstTeamNumber(row);
      const rank = firstNumber(row, ['rank', 'Rank', 'ranking', 'Ranking'], 0);
      if (!teamNumber || rank <= 0) return null;
      return {
        team_key: `frc${teamNumber}`,
        rank
      };
    })
    .filter((row): row is { team_key: string; rank: number } => row !== null)
    .sort((left, right) => left.rank - right.rank || Number(normalizeFirstTeamKey(left.team_key)) - Number(normalizeFirstTeamKey(right.team_key)));

  return convertedRankings.length > 0 ? { rankings: convertedRankings } : null;
};
