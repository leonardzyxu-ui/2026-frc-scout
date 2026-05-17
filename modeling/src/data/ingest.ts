import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ResearchStore } from './store.ts';
import type {
  AllianceColor,
  AllianceMatchRecord,
  DataSource,
  HistoricalMatch,
  ScoutingObservation,
  StatboticsTeamSignal
} from '../types.ts';
import { normalizeEventKey, normalizeTeamKey, readJsonFile, seasonFromEventKey } from '../util.ts';

const TBA_BASE = 'https://www.thebluealliance.com/api/v3';
const FIRST_BASE = 'https://frc-api.firstinspires.org/v3.0';
const STATBOTICS_BASE = 'https://api.statbotics.io/v3';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const firstNumber = (record: Record<string, unknown>, keys: string[], fallback: number | null = null) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return fallback;
};

const firstString = (record: Record<string, unknown>, keys: string[], fallback = '') => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return fallback;
};

const firstArray = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const getRequiredEnv = (keys: string[], label: string) => {
  const value = keys.map(key => process.env[key]).find(item => item && item.trim().length > 0);
  if (!value) throw new Error(`Missing ${label}. Set one of: ${keys.join(', ')}`);
  return value;
};

const fetchJson = async <T>(url: string, init: RequestInit = {}, retries = 2): Promise<T> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const extractComponentPoints = (breakdown: Record<string, unknown>) => {
  const components: Record<string, number> = {};
  Object.entries(breakdown).forEach(([key, value]) => {
    if (!key.toLowerCase().includes('point')) return;
    if (typeof value === 'number' && Number.isFinite(value)) {
      components[key] = value;
    }
  });
  return components;
};

const normalizeBreakdown = (score: number, rawBreakdown: unknown): AllianceMatchRecord => {
  const breakdown = asRecord(rawBreakdown);
  return {
    score,
    teamKeys: [],
    foulPoints: firstNumber(breakdown, ['foulPoints', 'foul_points']),
    techFoulCount: firstNumber(breakdown, ['techFoulCount', 'tech_foul_count', 'techFouls']),
    foulCount: firstNumber(breakdown, ['foulCount', 'foul_count', 'fouls']),
    componentPoints: extractComponentPoints(breakdown),
    preMatchExpectedScore: null,
    preMatchWinProbability: null,
    rawBreakdown
  };
};

const normalizeTbaMatch = (payload: unknown): HistoricalMatch | null => {
  const row = asRecord(payload);
  const key = firstString(row, ['key']).toLowerCase();
  const eventKey = normalizeEventKey(firstString(row, ['event_key']));
  if (!key || !eventKey) return null;
  const alliances = asRecord(row.alliances);
  const redAlliance = asRecord(alliances.red);
  const blueAlliance = asRecord(alliances.blue);
  const redScore = firstNumber(redAlliance, ['score'], -1) ?? -1;
  const blueScore = firstNumber(blueAlliance, ['score'], -1) ?? -1;
  const breakdown = asRecord(row.score_breakdown);
  const redBreakdown = asRecord(breakdown.red);
  const blueBreakdown = asRecord(breakdown.blue);
  const red = normalizeBreakdown(redScore, redBreakdown);
  const blue = normalizeBreakdown(blueScore, blueBreakdown);
  red.teamKeys = firstArray(redAlliance, ['team_keys']).map(normalizeTeamKey).filter(Boolean);
  blue.teamKeys = firstArray(blueAlliance, ['team_keys']).map(normalizeTeamKey).filter(Boolean);
  if (red.teamKeys.length === 0 || blue.teamKeys.length === 0) return null;

  return {
    key,
    eventKey,
    season: seasonFromEventKey(eventKey),
    compLevel: firstString(row, ['comp_level'], 'qm').toLowerCase(),
    matchNumber: firstNumber(row, ['match_number'], 0) ?? 0,
    setNumber: firstNumber(row, ['set_number'], 1) ?? 1,
    startTime:
      firstNumber(row, ['actual_time']) ??
      firstNumber(row, ['predicted_time']) ??
      firstNumber(row, ['time']) ??
      null,
    red,
    blue,
    winningAlliance: firstString(row, ['winning_alliance']) as HistoricalMatch['winningAlliance'],
    source: 'TBA'
  };
};

const normalizeStatboticsMatch = (payload: unknown): HistoricalMatch | null => {
  const row = asRecord(payload);
  const key = firstString(row, ['key']).toLowerCase();
  const eventKey = normalizeEventKey(firstString(row, ['event']));
  const result = asRecord(row.result);
  const pred = asRecord(row.pred);
  const alliances = asRecord(row.alliances);
  const redAlliance = asRecord(alliances.red);
  const blueAlliance = asRecord(alliances.blue);
  if (!key || !eventKey || !result) return null;

  const redScore = firstNumber(result, ['red_score'], -1) ?? -1;
  const blueScore = firstNumber(result, ['blue_score'], -1) ?? -1;
  const redTeamKeys = firstArray(redAlliance, ['team_keys']).map(normalizeTeamKey).filter(Boolean);
  const blueTeamKeys = firstArray(blueAlliance, ['team_keys']).map(normalizeTeamKey).filter(Boolean);
  if (redTeamKeys.length === 0 || blueTeamKeys.length === 0 || redScore < 0 || blueScore < 0) return null;

  const componentPoints = (alliance: AllianceColor) => {
    const prefix = `${alliance}_`;
    return Object.fromEntries(
      Object.entries(result)
        .filter(([keyName, value]) => keyName.startsWith(prefix) && keyName.endsWith('_points') && typeof value === 'number')
        .map(([keyName, value]) => [keyName.slice(prefix.length), value as number])
    );
  };

  return {
    key,
    eventKey,
    season: firstNumber(row, ['year']) ?? seasonFromEventKey(eventKey),
    compLevel: firstString(row, ['comp_level'], 'qm').toLowerCase(),
    matchNumber: firstNumber(row, ['match_number'], 0) ?? 0,
    setNumber: firstNumber(row, ['set_number'], 1) ?? 1,
    startTime: firstNumber(row, ['time']) ?? firstNumber(row, ['predicted_time']) ?? null,
    red: {
      score: redScore,
      teamKeys: redTeamKeys,
      foulPoints: firstNumber(result, ['blue_foul_points', 'blue_foul']),
      techFoulCount: firstNumber(result, ['blue_tech_fouls', 'blue_tech_foul_count']),
      foulCount: firstNumber(result, ['blue_fouls', 'blue_foul_count']),
      componentPoints: componentPoints('red'),
      preMatchExpectedScore: firstNumber(pred, ['red_score']),
      preMatchWinProbability: firstNumber(pred, ['red_win_prob']),
      rawBreakdown: result
    },
    blue: {
      score: blueScore,
      teamKeys: blueTeamKeys,
      foulPoints: firstNumber(result, ['red_foul_points', 'red_foul']),
      techFoulCount: firstNumber(result, ['red_tech_fouls', 'red_tech_foul_count']),
      foulCount: firstNumber(result, ['red_fouls', 'red_foul_count']),
      componentPoints: componentPoints('blue'),
      preMatchExpectedScore: firstNumber(pred, ['blue_score']),
      preMatchWinProbability:
        firstNumber(pred, ['red_win_prob']) == null ? null : 1 - (firstNumber(pred, ['red_win_prob']) ?? 0),
      rawBreakdown: result
    },
    winningAlliance: redScore === blueScore ? '' : redScore > blueScore ? 'red' : 'blue',
    source: 'Statbotics'
  };
};

const normalizeFirstCompLevel = (value: string, fallback = 'qm') => {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('practice')) return 'pm';
  if (normalized.includes('qual') || normalized === 'q') return 'qm';
  if (normalized.includes('final')) return 'f';
  if (normalized.includes('playoff') || normalized.includes('semi') || normalized.includes('elim')) return 'sf';
  return fallback;
};

const normalizeFirstMatch = (
  payload: unknown,
  season: number,
  eventCode: string,
  fallbackCompLevel: string,
  index: number
): HistoricalMatch | null => {
  const row = asRecord(payload);
  const matchNumber = firstNumber(row, ['matchNumber', 'MatchNumber', 'match_number'], index + 1) ?? index + 1;
  const compLevel = normalizeFirstCompLevel(firstString(row, ['tournamentLevel', 'TournamentLevel', 'level']), fallbackCompLevel);
  const eventKey = normalizeEventKey(`${season}${eventCode}`);
  const teams = firstArray(row, ['teams', 'Teams']);
  const redTeams: string[] = [];
  const blueTeams: string[] = [];

  teams.forEach(team => {
    const teamRow = asRecord(team);
    const teamKey = normalizeTeamKey(firstString(teamRow, ['teamNumber', 'TeamNumber', 'team', 'teamNumber']));
    const station = firstString(teamRow, ['station', 'Station', 'allianceStation']).toLowerCase();
    if (!teamKey) return;
    if (station.includes('red')) redTeams.push(teamKey);
    if (station.includes('blue')) blueTeams.push(teamKey);
  });

  if (redTeams.length === 0 || blueTeams.length === 0) return null;

  const redScore = firstNumber(row, ['scoreRedFinal', 'scoreRed', 'redScore'], -1) ?? -1;
  const blueScore = firstNumber(row, ['scoreBlueFinal', 'scoreBlue', 'blueScore'], -1) ?? -1;
  const rawTime = firstString(row, ['actualStartTime', 'postResultTime', 'startTime', 'date']);
  const parsedTime = rawTime ? Date.parse(rawTime) : Number.NaN;
  const key =
    compLevel === 'qm' || compLevel === 'pm'
      ? `${eventKey}_${compLevel}${matchNumber}`
      : `${eventKey}_${compLevel}${matchNumber}m1`;

  return {
    key,
    eventKey,
    season,
    compLevel,
    matchNumber,
    setNumber: 1,
    startTime: Number.isFinite(parsedTime) ? Math.floor(parsedTime / 1000) : null,
    red: { ...normalizeBreakdown(redScore, row), teamKeys: redTeams },
    blue: { ...normalizeBreakdown(blueScore, row), teamKeys: blueTeams },
    winningAlliance: redScore === blueScore ? '' : redScore > blueScore ? 'red' : 'blue',
    source: 'FIRST'
  };
};

export const ingestTba = async (
  store: ResearchStore,
  options: { year?: number; eventKey?: string; limitEvents?: number }
) => {
  const apiKey = getRequiredEnv(['MODEL_TBA_API_KEY', 'VITE_TBA_API_KEY'], 'TBA API key');
  const headers = { 'X-TBA-Auth-Key': apiKey, Accept: 'application/json' };
  const eventKeys = options.eventKey
    ? [normalizeEventKey(options.eventKey)]
    : (
        await fetchJson<Array<{ key: string }>>(`${TBA_BASE}/events/${options.year}`, {
          headers
        })
      )
        .map(event => normalizeEventKey(event.key))
        .filter(Boolean)
        .slice(0, options.limitEvents ?? Number.POSITIVE_INFINITY);

  const imported: HistoricalMatch[] = [];
  for (const eventKey of eventKeys) {
    const matchesPayload = await fetchJson<unknown[]>(`${TBA_BASE}/event/${eventKey}/matches`, { headers });
    store.upsertRawPayload({
      source: 'TBA',
      endpointKey: `/event/${eventKey}/matches`,
      eventKey,
      season: seasonFromEventKey(eventKey),
      payload: matchesPayload
    });
    const matches = matchesPayload.map(normalizeTbaMatch).filter((match): match is HistoricalMatch => match !== null);
    store.upsertMatches(matches);
    imported.push(...matches);
  }

  return { events: eventKeys.length, matches: imported.length };
};

export const ingestFirst = async (
  store: ResearchStore,
  options: { year: number; eventCode?: string; limitEvents?: number }
) => {
  const username = getRequiredEnv(['FIRST_EVENTS_USERNAME'], 'FIRST Events username');
  const token = getRequiredEnv(['FIRST_EVENTS_AUTH_TOKEN'], 'FIRST Events auth token');
  const auth = Buffer.from(`${username}:${token}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, Accept: 'application/json' };

  const eventCodes = options.eventCode
    ? [options.eventCode.toUpperCase()]
    : (
        await fetchJson<Record<string, unknown>>(`${FIRST_BASE}/${options.year}/events`, { headers })
      ).Events;

  const normalizedCodes = (Array.isArray(eventCodes) ? eventCodes : [])
    .map(event => (typeof event === 'string' ? event : firstString(asRecord(event), ['code', 'eventCode', 'EventCode'])))
    .filter(Boolean)
    .slice(0, options.limitEvents ?? Number.POSITIVE_INFINITY);

  const imported: HistoricalMatch[] = [];
  for (const eventCode of normalizedCodes) {
    for (const [level, endpointLevel] of [
      ['qm', 'qual'],
      ['pm', 'practice'],
      ['sf', 'playoff']
    ] as const) {
      const payload = await fetchJson<Record<string, unknown>>(
        `${FIRST_BASE}/${options.year}/matches/${encodeURIComponent(eventCode)}?tournamentLevel=${endpointLevel}`,
        { headers }
      );
      const eventKey = normalizeEventKey(`${options.year}${eventCode}`);
      store.upsertRawPayload({
        source: 'FIRST',
        endpointKey: `/matches/${eventCode}?tournamentLevel=${endpointLevel}`,
        eventKey,
        season: options.year,
        payload
      });
      const rows = firstArray(payload, ['Matches', 'matches']);
      const matches = rows
        .map((row, index) => normalizeFirstMatch(row, options.year, eventCode, level, index))
        .filter((match): match is HistoricalMatch => match !== null);
      store.upsertMatches(matches);
      imported.push(...matches);
    }
  }

  return { events: normalizedCodes.length, matches: imported.length };
};

export const ingestStatbotics = async (
  store: ResearchStore,
  options: { eventKey?: string; season?: number; limitTeams?: number }
) => {
  const matches = store.getMatches({ eventKey: options.eventKey, season: options.season });
  const eventTeams = new Map<string, { eventKey: string; season: number; teamKey: string }>();
  matches.forEach(match => {
    [...match.red.teamKeys, ...match.blue.teamKeys].forEach(teamKey => {
      eventTeams.set(`${match.eventKey}|${teamKey}`, {
        eventKey: match.eventKey,
        season: match.season,
        teamKey
      });
    });
  });

  const signals: StatboticsTeamSignal[] = [];
  const targets = Array.from(eventTeams.values()).slice(0, options.limitTeams ?? Number.POSITIVE_INFINITY);
  for (const target of targets) {
    const teamNumber = target.teamKey.replace(/^frc/, '');
    let sourceKind: StatboticsTeamSignal['sourceKind'] = 'team_event';
    let payload: Record<string, unknown> | null = null;
    try {
      payload = await fetchJson<Record<string, unknown>>(`${STATBOTICS_BASE}/team_event/${teamNumber}/${target.eventKey}`);
    } catch {
      sourceKind = 'team_year';
      payload = await fetchJson<Record<string, unknown>>(`${STATBOTICS_BASE}/team_year/${teamNumber}/${target.season}`);
    }

    const epa = asRecord(payload?.epa);
    const breakdown = asRecord(epa.breakdown);
    const totalPoints = asRecord(epa.total_points);
    const signal: StatboticsTeamSignal = {
      id: `${sourceKind}:${target.eventKey}:${target.teamKey}`,
      teamKey: target.teamKey,
      season: target.season,
      eventKey: sourceKind === 'team_event' ? target.eventKey : null,
      overallEpa:
        firstNumber(breakdown, ['total_points', 'epa', 'epa_total']) ??
        firstNumber(totalPoints, ['mean']) ??
        null,
      autoEpa: firstNumber(breakdown, ['auto_epa', 'auto_points', 'total_auto_points']),
      teleopEpa: firstNumber(breakdown, ['teleop_epa', 'teleop_points', 'total_teleop_points']),
      endgameEpa: firstNumber(breakdown, ['endgame_epa', 'endgame_points', 'endGamePoints']),
      sourceKind,
      raw: payload
    };
    signals.push(signal);
  }

  store.upsertStatboticsSignals(signals);
  return { teams: signals.length };
};

export const ingestStatboticsMatches = async (
  store: ResearchStore,
  options: { year?: number; eventKey?: string; startYear?: number; endYear?: number; limitMatches?: number }
) => {
  const imported: HistoricalMatch[] = [];
  const years = options.eventKey
    ? [options.year ?? seasonFromEventKey(normalizeEventKey(options.eventKey))]
    : Array.from(
        { length: (options.endYear ?? options.year ?? new Date().getFullYear()) - (options.startYear ?? options.year ?? new Date().getFullYear()) + 1 },
        (_, index) => (options.startYear ?? options.year ?? new Date().getFullYear()) + index
      );
  const pageLimit = Math.min(1000, Math.max(1, options.limitMatches ?? 1000));

  for (const year of years) {
    let offset = 0;
    let remaining = options.limitMatches ?? Number.POSITIVE_INFINITY;
    while (remaining > 0) {
      const limit = Math.min(pageLimit, remaining);
      const url = new URL(`${STATBOTICS_BASE}/matches`);
      url.searchParams.set('year', String(year));
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String(offset));
      if (options.eventKey) url.searchParams.set('event', normalizeEventKey(options.eventKey));
      const payload = await fetchJson<unknown[]>(url.toString());
      store.upsertRawPayload({
        source: 'Statbotics',
        endpointKey: `/matches?${url.searchParams.toString()}`,
        eventKey: options.eventKey ? normalizeEventKey(options.eventKey) : null,
        season: year,
        payload
      });
      const matches = payload.map(normalizeStatboticsMatch).filter((match): match is HistoricalMatch => match !== null);
      store.upsertMatches(matches);
      imported.push(...matches);
      if (payload.length < limit) break;
      offset += payload.length;
      remaining -= payload.length;
    }
  }

  return {
    years: years.length,
    matches: imported.length
  };
};

const decodeFirestoreValue = (value: unknown): unknown => {
  const record = asRecord(value);
  if ('stringValue' in record) return record.stringValue;
  if ('integerValue' in record) return Number(record.integerValue);
  if ('doubleValue' in record) return Number(record.doubleValue);
  if ('booleanValue' in record) return Boolean(record.booleanValue);
  if ('timestampValue' in record) return Date.parse(String(record.timestampValue));
  if ('arrayValue' in record) return asArray(asRecord(record.arrayValue).values).map(decodeFirestoreValue);
  if ('mapValue' in record) {
    return Object.fromEntries(
      Object.entries(asRecord(asRecord(record.mapValue).fields)).map(([key, child]) => [key, decodeFirestoreValue(child)])
    );
  }
  if ('nullValue' in record) return null;
  return value;
};

const decodeFirestoreDocument = (doc: unknown) => {
  const record = asRecord(doc);
  return Object.fromEntries(
    Object.entries(asRecord(record.fields)).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
};

const toObservation = (source: DataSource, raw: unknown, fallbackId: string): ScoutingObservation | null => {
  const row = asRecord(raw);
  const eventKey = normalizeEventKey(firstString(row, ['eventKey', 'event_key', 'event']));
  const matchKey = firstString(row, ['matchKey', 'match_key', 'match']).toLowerCase();
  const teamKey = normalizeTeamKey(firstString(row, ['teamNumber', 'teamKey', 'team_key', 'team']));
  if (!eventKey || !matchKey || !teamKey) return null;

  const allianceRaw = firstString(row, ['alliance', 'allianceColor']).toLowerCase();
  const alliance: AllianceColor | null = allianceRaw.startsWith('r') ? 'red' : allianceRaw.startsWith('b') ? 'blue' : null;
  const playedDefense = row.playedDefense ?? row.defense ?? row.played_defense;
  const defenseValue =
    firstNumber(row, ['defenseValue', 'defense_value', 'defenseMetric']) ??
    (typeof row.defenseIntensity === 'number' ? Number(row.defenseIntensity) * 10 : null);
  const offensePoints =
    firstNumber(row, ['offensePoints', 'offense_points', 'totalPoints', 'syntheticScore']) ??
    firstNumber(row, ['autoPoints', 'teleopPoints']);

  return {
    id:
      firstString(row, ['id']) ||
      crypto.createHash('sha1').update(`${fallbackId}:${eventKey}:${matchKey}:${teamKey}`).digest('hex'),
    source,
    eventKey,
    matchKey,
    teamKey,
    alliance,
    offensePoints,
    defenseValue,
    playedDefense: typeof playedDefense === 'boolean' ? playedDefense : null,
    reliabilityPenalty:
      (row.robotDied ? 4 : 0) +
      (row.mechanismBroke ? 3 : 0) +
      (row.commsLost ? 2 : 0) +
      (row.tippedOver ? 2 : 0),
    observedAt: firstNumber(row, ['timestamp', 'observedAt', 'updatedAt']),
    raw
  };
};

export const ingestFirebase = async (
  store: ResearchStore,
  options: { projectId?: string; accessToken?: string; collections?: string[] }
) => {
  const projectId = options.projectId || getRequiredEnv(['MODEL_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID'], 'Firebase project id');
  const accessToken = options.accessToken || getRequiredEnv(['MODEL_FIREBASE_ACCESS_TOKEN'], 'Firebase access token');
  const collections = options.collections ?? ['matchScouting', 'matchScoutingV3', 'matchScoutingV4', 'matchScoutingDefense'];
  const observations: ScoutingObservation[] = [];

  for (const collection of collections) {
    let pageToken = '';
    do {
      const url = new URL(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}`
      );
      url.searchParams.set('pageSize', '300');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const payload = await fetchJson<Record<string, unknown>>(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
      });
      store.upsertRawPayload({
        source: 'Firebase',
        endpointKey: `/documents/${collection}${pageToken ? `?pageToken=${pageToken}` : ''}`,
        payload
      });
      asArray(payload.documents).forEach((doc, index) => {
        const observation = toObservation('Firebase', decodeFirestoreDocument(doc), `${collection}:${index}`);
        if (observation) observations.push(observation);
      });
      pageToken = firstString(payload, ['nextPageToken']);
    } while (pageToken);
  }

  store.upsertScoutingObservations(observations);
  return { observations: observations.length };
};

const collectJsonObjects = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  const candidates = [
    record.matchScouting,
    record.matchScoutingV3,
    record.matchScoutingV4,
    record.matchScoutingDefense,
    record.records,
    record.data,
    record.items
  ];
  return candidates.flatMap(candidate => (Array.isArray(candidate) ? candidate : []));
};

export const importLocalBackup = (store: ResearchStore, filePath: string) => {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Backup file not found: ${absolute}`);
  }
  const payload = readJsonFile<unknown>(absolute);
  store.upsertRawPayload({
    source: 'LocalBackup',
    endpointKey: absolute,
    payload
  });
  const matches: HistoricalMatch[] = [];
  const adminV2 = asRecord(asRecord(payload).adminV2);
  const cacheEntries = firstArray(adminV2, ['cacheEntries']);
  cacheEntries.forEach((entry, index) => {
    const row = asRecord(entry);
    const source = firstString(row, ['source']);
    const key = firstString(row, ['key']);
    const eventKey = normalizeEventKey(firstString(row, ['eventKey']));
    const season = firstNumber(row, ['year']) ?? (eventKey ? seasonFromEventKey(eventKey) : null);
    const entryPayload = row.payload;
    store.upsertRawPayload({
      source: source === 'TBA' ? 'TBA' : 'LocalBackup',
      endpointKey: `backup:${absolute}:${key || index}`,
      eventKey,
      season,
      payload: entryPayload
    });

    if (source === 'TBA' && key === 'matches' && Array.isArray(entryPayload)) {
      entryPayload.forEach(matchPayload => {
        const match = normalizeTbaMatch(matchPayload);
        if (match) matches.push(match);
      });
    }
  });
  if (matches.length > 0) {
    store.upsertMatches(matches);
  }
  const observations = collectJsonObjects(payload)
    .map((record, index) => toObservation('LocalBackup', record, `${absolute}:${index}`))
    .filter((observation): observation is ScoutingObservation => observation !== null);
  store.upsertScoutingObservations(observations);
  return { observations: observations.length, matches: matches.length };
};
