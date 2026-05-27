import { QualificationBonusMetrics, TBAEliminationAlliance, TBAEventSummary } from './matchPredictor';
import { TBAMatch } from './mathEngine';

const STORAGE_KEY_PREFIX = 'adminv2_tba_csv_pack:';

export interface UploadedTbaCsvCoprsData {
  fileName: string;
  loadedAt: number;
  headers: string[];
  ratings: Record<string, number>;
  bonusMetrics: Record<string, QualificationBonusMetrics>;
  componentPoints: Record<
    string,
    {
      autoPoints: number | null;
      teleopPoints: number | null;
      fuelPoints: number | null;
      towerPoints: number | null;
      totalPoints: number | null;
    }
  >;
  hasBonusMetrics: boolean;
}

export interface UploadedTbaCsvScheduleData {
  fileName: string;
  loadedAt: number;
  matches: TBAMatch[];
}

export interface UploadedTbaCsvTeamListData {
  fileName: string;
  loadedAt: number;
  teamNames: Record<string, string>;
}

export interface UploadedTbaRankingsData {
  fileName: string;
  loadedAt: number;
  rankings: Record<string, number>;
  rankOrder: string[];
}

export interface UploadedTbaAlliancesData {
  fileName: string;
  loadedAt: number;
  alliances: TBAEliminationAlliance[];
}

export interface UploadedTbaEventSummaryData {
  fileName: string;
  loadedAt: number;
  eventSummary: TBAEventSummary;
}

export interface UploadedTbaCsvPack {
  eventKey: string;
  loadedAt: number;
  coprs?: UploadedTbaCsvCoprsData;
  schedule?: UploadedTbaCsvScheduleData;
  flatSchedule?: UploadedTbaCsvScheduleData;
  teamList?: UploadedTbaCsvTeamListData;
  rankings?: UploadedTbaRankingsData;
  alliances?: UploadedTbaAlliancesData;
  eventSummary?: UploadedTbaEventSummaryData;
}

export interface UploadedTbaCsvImportMessage {
  level: 'info' | 'warning';
  text: string;
}

export interface UploadedTbaCsvImportResult {
  pack: UploadedTbaCsvPack;
  messages: UploadedTbaCsvImportMessage[];
}

type ParsedCsvFile =
  | { type: 'coprs'; data: UploadedTbaCsvCoprsData }
  | { type: 'schedule'; data: UploadedTbaCsvScheduleData }
  | { type: 'flatSchedule'; data: UploadedTbaCsvScheduleData }
  | { type: 'teamList'; data: UploadedTbaCsvTeamListData }
  | { type: 'rankings'; data: UploadedTbaRankingsData }
  | { type: 'alliances'; data: UploadedTbaAlliancesData }
  | { type: 'eventSummary'; data: UploadedTbaEventSummaryData };

type CsvRow = Record<string, string>;
type JsonRecord = Record<string, unknown>;

const normalizeEventKey = (eventKey: string) => eventKey.trim().toLowerCase();

const getStorageKey = (eventKey: string) => `${STORAGE_KEY_PREFIX}${normalizeEventKey(eventKey)}`;

const normalizeHeader = (value: string) => value.trim().toLowerCase();

const normalizeTeamNumber = (value: string) => value.trim().replace(/^frc/i, '');
const normalizeTeamKey = (value: string) => value.trim().replace(/^frc/i, '');

const parseNumber = (value: string | undefined) => {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseInteger = (value: string | undefined) => {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseScore = (value: string | undefined) => {
  const parsed = parseInteger(value);
  return parsed == null ? -1 : parsed;
};

const parseClockTime = (value: string) => {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const [, hoursString = '0', minutes = '00', meridiem = 'AM'] = match;
  let hours = Number.parseInt(hoursString, 10);
  if (meridiem.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  }
  if (meridiem.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${minutes}:00`;
};

const parseScheduledTimestamp = (scheduledDate: string | undefined, scheduledTime: string | undefined) => {
  const normalizedDate = scheduledDate?.trim();
  const normalizedTime = scheduledTime?.trim();
  if (!normalizedDate || !normalizedTime) return null;

  const isoTime = parseClockTime(normalizedTime);
  if (!isoTime) return null;

  const timestamp = new Date(`${normalizedDate}T${isoTime}`).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor(timestamp / 1000);
};

const parseCsvText = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }

      row.push(cell);
      cell = '';
      if (row.some(value => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some(value => value.length > 0)) {
    rows.push(row);
  }

  return rows;
};

const isObject = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isString = (value: unknown): value is string =>
  typeof value === 'string';

const toJsonNumber = (value: unknown) =>
  isNumber(value) ? value : typeof value === 'string' ? parseNumber(value) : null;

const toJsonInteger = (value: unknown) =>
  isNumber(value) ? Math.trunc(value) : typeof value === 'string' ? parseInteger(value) : null;

const toJsonStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter(isString) : [];

const parseCsvObjects = (text: string) => {
  const rows = parseCsvText(text);
  if (rows.length === 0) {
    return { headers: [] as string[], objects: [] as CsvRow[] };
  }

  const headers = (rows[0] ?? []).map(normalizeHeader);
  const objects = rows.slice(1).map(row => {
    const record: CsvRow = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });

  return { headers, objects };
};

const inferFlatMatchDetails = (matchKey: string) => {
  const normalized = matchKey.trim().toLowerCase();
  const suffix = normalized.split('_')[1] ?? '';
  const match = suffix.match(/^([a-z]+)(\d+)$/i);
  if (!match) {
    return {
      compLevel: '',
      matchNumber: 0,
      setNumber: 1
    };
  }

  return {
    compLevel: (match[1] ?? '').toLowerCase(),
    matchNumber: Number.parseInt(match[2] ?? '0', 10) || 0,
    setNumber: 1
  };
};

const buildWinningAlliance = (redScore: number, blueScore: number): TBAMatch['winning_alliance'] => {
  if (redScore === -1 || blueScore === -1) return '';
  if (redScore > blueScore) return 'red';
  if (blueScore > redScore) return 'blue';
  return '';
};

const parseScheduleCsv = (
  fileName: string,
  headers: string[],
  rows: CsvRow[]
): UploadedTbaCsvScheduleData => {
  const matches = rows
    .map(row => {
      const matchKey = row.match_key?.trim().toLowerCase();
      if (!matchKey) return null;

      const redScore = parseScore(row.red_score);
      const blueScore = parseScore(row.blue_score);
      const scheduledTime = parseScheduledTimestamp(row.scheduled_date, row.scheduled_time);
      const redTeams = [row.red1, row.red2, row.red3]
        .map(team => normalizeTeamNumber(team || ''))
        .filter(Boolean)
        .map(team => `frc${team}`);
      const blueTeams = [row.blue1, row.blue2, row.blue3]
        .map(team => normalizeTeamNumber(team || ''))
        .filter(Boolean)
        .map(team => `frc${team}`);

      const inferred = inferFlatMatchDetails(matchKey);

      return {
        key: matchKey,
        event_key: matchKey.split('_')[0],
        comp_level: row.comp_level?.trim().toLowerCase() || inferred.compLevel,
        match_number: parseInteger(row.match_number) ?? inferred.matchNumber,
        set_number: parseInteger(row.set_number) ?? inferred.setNumber,
        time: scheduledTime,
        predicted_time: scheduledTime,
        actual_time: redScore !== -1 && blueScore !== -1 ? scheduledTime : null,
        winning_alliance: buildWinningAlliance(redScore, blueScore),
        alliances: {
          red: { score: redScore, team_keys: redTeams },
          blue: { score: blueScore, team_keys: blueTeams }
        }
      } satisfies TBAMatch;
    })
    .filter(Boolean) as TBAMatch[];

  matches.sort((left, right) => {
    const leftTime = left.predicted_time ?? left.time ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.predicted_time ?? right.time ?? Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.key.localeCompare(right.key, undefined, { numeric: true });
  });

  return {
    fileName,
    loadedAt: Date.now(),
    matches
  };
};

const parseFlatScheduleCsv = (fileName: string, headers: string[], rows: CsvRow[]): UploadedTbaCsvScheduleData => {
  const grouped = new Map<
    string,
    {
      matchKey: string;
      scheduledDate?: string;
      scheduledTime?: string;
      compLevel?: string;
      matchNumber?: string;
      setNumber?: string;
      redTeams: string[];
      blueTeams: string[];
    }
  >();

  rows.forEach(row => {
    const matchKey = row.match_key?.trim().toLowerCase();
    if (!matchKey) return;

    const bucket = grouped.get(matchKey) || {
      matchKey,
      scheduledDate: row.scheduled_date,
      scheduledTime: row.scheduled_time,
      compLevel: row.comp_level,
      matchNumber: row.match_number,
      setNumber: row.set_number,
      redTeams: [],
      blueTeams: []
    };

    const teamNumber = normalizeTeamNumber(row.team || '');
    const color = row.color?.trim().toLowerCase();
    if (teamNumber) {
      if (color === 'red') {
        bucket.redTeams.push(`frc${teamNumber}`);
      } else if (color === 'blue') {
        bucket.blueTeams.push(`frc${teamNumber}`);
      }
    }

    grouped.set(matchKey, bucket);
  });

  const matches = Array.from(grouped.values())
    .map(bucket => {
      const inferred = inferFlatMatchDetails(bucket.matchKey);
      const scheduledTime = parseScheduledTimestamp(bucket.scheduledDate, bucket.scheduledTime);

      return {
        key: bucket.matchKey,
        event_key: bucket.matchKey.split('_')[0],
        comp_level: bucket.compLevel?.trim().toLowerCase() || inferred.compLevel,
        match_number: parseInteger(bucket.matchNumber) ?? inferred.matchNumber,
        set_number: parseInteger(bucket.setNumber) ?? inferred.setNumber,
        time: scheduledTime,
        predicted_time: scheduledTime,
        actual_time: null,
        winning_alliance: '',
        alliances: {
          red: { score: -1, team_keys: bucket.redTeams },
          blue: { score: -1, team_keys: bucket.blueTeams }
        }
      } satisfies TBAMatch;
    })
    .sort((left, right) => {
      const leftTime = left.predicted_time ?? left.time ?? Number.MAX_SAFE_INTEGER;
      const rightTime = right.predicted_time ?? right.time ?? Number.MAX_SAFE_INTEGER;
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.key.localeCompare(right.key, undefined, { numeric: true });
    });

  return {
    fileName,
    loadedAt: Date.now(),
    matches
  };
};

const parseCoprsCsv = (fileName: string, headers: string[], rows: CsvRow[]): UploadedTbaCsvCoprsData => {
  const ratings: Record<string, number> = {};
  const bonusMetrics: Record<string, QualificationBonusMetrics> = {};
  const componentPoints: UploadedTbaCsvCoprsData['componentPoints'] = {};
  let hasBonusMetrics = false;

  rows.forEach(row => {
    const teamNumber = normalizeTeamNumber(row.team_number || '');
    if (!teamNumber) return;

    const opr = parseNumber(row.opr);
    if (opr != null) {
      ratings[teamNumber] = opr;
    }

    const towerPoints = parseNumber(row.totaltowerpoints);
    const fuelPoints = parseNumber(row['hub total fuel count']);
    const autoPoints = parseNumber(row.totalautopoints);
    const teleopPoints = parseNumber(row.totalteleoppoints);
    const totalPoints = parseNumber(row.totalpoints);

    componentPoints[teamNumber] = {
      autoPoints,
      teleopPoints,
      fuelPoints,
      towerPoints,
      totalPoints
    };

    if (towerPoints != null || fuelPoints != null) {
      bonusMetrics[teamNumber] = {
        towerEPA: towerPoints ?? 0,
        fuelEPA: fuelPoints ?? 0
      };
      hasBonusMetrics = true;
    }
  });

  return {
    fileName,
    loadedAt: Date.now(),
    headers,
    ratings,
    bonusMetrics,
    componentPoints,
    hasBonusMetrics
  };
};

const parseTeamListCsv = (fileName: string, headers: string[], rows: CsvRow[]): UploadedTbaCsvTeamListData => {
  const teamNames: Record<string, string> = {};

  rows.forEach(row => {
    const teamNumber = normalizeTeamNumber(row.team_number || '');
    const teamName = row.team_name?.trim();
    if (!teamNumber || !teamName) return;
    teamNames[teamNumber] = teamName;
  });

  return {
    fileName,
    loadedAt: Date.now(),
    teamNames
  };
};

const parseMatchesJson = (fileName: string, payload: unknown): UploadedTbaCsvScheduleData => {
  if (!Array.isArray(payload)) {
    throw new Error(`"${fileName}" is not a valid TBA matches JSON file.`);
  }

  const matches = payload
    .map(item => {
      if (!isObject(item) || !isObject(item.alliances)) return null;
      const red = isObject(item.alliances.red) ? item.alliances.red : null;
      const blue = isObject(item.alliances.blue) ? item.alliances.blue : null;
      if (!red || !blue) return null;

      const key = isString(item.key) ? item.key.trim().toLowerCase() : '';
      if (!key) return null;

      return {
        key,
        event_key: isString(item.event_key) ? item.event_key.trim().toLowerCase() : key.split('_')[0],
        comp_level: isString(item.comp_level) ? item.comp_level.trim().toLowerCase() : '',
        match_number: toJsonInteger(item.match_number) ?? 0,
        set_number: toJsonInteger(item.set_number) ?? 1,
        time: toJsonInteger(item.time),
        predicted_time: toJsonInteger(item.predicted_time),
        actual_time: toJsonInteger(item.actual_time),
        winning_alliance:
          item.winning_alliance === 'red' || item.winning_alliance === 'blue' ? item.winning_alliance : '',
        alliances: {
          red: {
            score: toJsonInteger(red.score) ?? -1,
            team_keys: toJsonStringArray(red.team_keys)
          },
          blue: {
            score: toJsonInteger(blue.score) ?? -1,
            team_keys: toJsonStringArray(blue.team_keys)
          }
        }
      } satisfies TBAMatch;
    })
    .filter(Boolean) as TBAMatch[];

  matches.sort((left, right) => {
    const leftTime = left.predicted_time ?? left.time ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.predicted_time ?? right.time ?? Number.MAX_SAFE_INTEGER;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.key.localeCompare(right.key, undefined, { numeric: true });
  });

  return {
    fileName,
    loadedAt: Date.now(),
    matches
  };
};

const parseTeamListJson = (fileName: string, payload: unknown): UploadedTbaCsvTeamListData => {
  if (!Array.isArray(payload)) {
    throw new Error(`"${fileName}" is not a valid TBA teams JSON file.`);
  }

  const teamNames: Record<string, string> = {};
  payload.forEach(item => {
    if (!isObject(item)) return;
    const teamNumber = toJsonInteger(item.team_number);
    const teamName =
      (isString(item.nickname) && item.nickname.trim()) ||
      (isString(item.name) && item.name.trim()) ||
      '';
    if (!teamNumber || !teamName) return;
    teamNames[String(teamNumber)] = teamName;
  });

  return {
    fileName,
    loadedAt: Date.now(),
    teamNames
  };
};

const parseRankingsJson = (fileName: string, payload: unknown): UploadedTbaRankingsData => {
  if (!isObject(payload) || !Array.isArray(payload.rankings)) {
    throw new Error(`"${fileName}" is not a valid TBA rankings JSON file.`);
  }

  const rankings: Record<string, number> = {};
  const rankOrder: string[] = [];

  payload.rankings.forEach(item => {
    if (!isObject(item)) return;
    const teamKey = isString(item.team_key) ? normalizeTeamKey(item.team_key) : '';
    const rank = toJsonInteger(item.rank);
    if (!teamKey || rank == null) return;
    rankings[teamKey] = rank;
    rankOrder.push(teamKey);
  });

  return {
    fileName,
    loadedAt: Date.now(),
    rankings,
    rankOrder
  };
};

const parseAlliancesJson = (fileName: string, payload: unknown): UploadedTbaAlliancesData => {
  if (!Array.isArray(payload)) {
    throw new Error(`"${fileName}" is not a valid TBA alliances JSON file.`);
  }

  const alliances = payload
    .filter(isObject)
    .filter(item => Array.isArray(item.picks))
    .map(item => ({
      name: isString(item.name) ? item.name : undefined,
      picks: toJsonStringArray(item.picks),
      declines: toJsonStringArray(item.declines),
      backup:
        isObject(item.backup) && isString(item.backup.in) && isString(item.backup.out)
          ? { in: item.backup.in, out: item.backup.out }
          : null
    })) satisfies TBAEliminationAlliance[];

  return {
    fileName,
    loadedAt: Date.now(),
    alliances
  };
};

const parseEventSummaryJson = (fileName: string, payload: unknown): UploadedTbaEventSummaryData => {
  if (!isObject(payload) || !isString(payload.key) || !isString(payload.name)) {
    throw new Error(`"${fileName}" is not a valid TBA event JSON file.`);
  }

  return {
    fileName,
    loadedAt: Date.now(),
    eventSummary: {
      key: payload.key,
      name: payload.name,
      playoff_type: toJsonInteger(payload.playoff_type),
      playoff_type_string: isString(payload.playoff_type_string) ? payload.playoff_type_string : null
    }
  };
};

const buildComponentPointsFromComponentMaps = (
  componentMaps: Record<string, Record<string, number>>
): UploadedTbaCsvCoprsData['componentPoints'] => {
  const teams = new Set<string>();
  Object.values(componentMaps).forEach(map => {
    Object.keys(map).forEach(team => teams.add(team));
  });

  const componentPoints: UploadedTbaCsvCoprsData['componentPoints'] = {};
  teams.forEach(teamNumber => {
    componentPoints[teamNumber] = {
      autoPoints: componentMaps.totalautopoints?.[teamNumber] ?? null,
      teleopPoints: componentMaps.totalteleoppoints?.[teamNumber] ?? null,
      fuelPoints: componentMaps['hub total fuel count']?.[teamNumber] ?? null,
      towerPoints: componentMaps.totaltowerpoints?.[teamNumber] ?? null,
      totalPoints: componentMaps.totalpoints?.[teamNumber] ?? null
    };
  });

  return componentPoints;
};

const parseOprsJson = (fileName: string, payload: unknown): UploadedTbaCsvCoprsData => {
  if (!isObject(payload) || !isObject(payload.oprs)) {
    throw new Error(`"${fileName}" is not a valid TBA OPR JSON file.`);
  }

  const ratings: Record<string, number> = {};
  Object.entries(payload.oprs).forEach(([teamKey, value]) => {
    const teamNumber = normalizeTeamKey(teamKey);
    const rating = toJsonNumber(value);
    if (!teamNumber || rating == null) return;
    ratings[teamNumber] = rating;
  });

  return {
    fileName,
    loadedAt: Date.now(),
    headers: ['json_oprs'],
    ratings,
    bonusMetrics: {},
    componentPoints: {},
    hasBonusMetrics: false
  };
};

const parseCoprsJson = (fileName: string, payload: unknown): UploadedTbaCsvCoprsData => {
  if (!isObject(payload)) {
    throw new Error(`"${fileName}" is not a valid TBA component OPR JSON file.`);
  }

  const componentMaps: Record<string, Record<string, number>> = {};
  Object.entries(payload).forEach(([rawKey, rawValue]) => {
    if (!isObject(rawValue)) return;
    const normalizedKey = normalizeHeader(rawKey);
    const teamMap: Record<string, number> = {};
    Object.entries(rawValue).forEach(([teamKey, value]) => {
      const teamNumber = normalizeTeamKey(teamKey);
      const parsedValue = toJsonNumber(value);
      if (!teamNumber || parsedValue == null) return;
      teamMap[teamNumber] = parsedValue;
    });
    if (Object.keys(teamMap).length > 0) {
      componentMaps[normalizedKey] = teamMap;
    }
  });

  const componentPoints = buildComponentPointsFromComponentMaps(componentMaps);
  const bonusMetrics: Record<string, QualificationBonusMetrics> = {};
  Object.keys(componentPoints).forEach(teamNumber => {
    const points = componentPoints[teamNumber];
    if (!points) return;
    const towerPoints = points.towerPoints;
    const fuelPoints = points.fuelPoints;
    if (towerPoints != null || fuelPoints != null) {
      bonusMetrics[teamNumber] = {
        towerEPA: towerPoints ?? 0,
        fuelEPA: fuelPoints ?? 0
      };
    }
  });

  return {
    fileName,
    loadedAt: Date.now(),
    headers: Object.keys(componentMaps),
    ratings: {},
    bonusMetrics,
    componentPoints,
    hasBonusMetrics: Object.keys(bonusMetrics).length > 0
  };
};

const classifyCsvFile = (fileName: string, headers: string[]): ParsedCsvFile['type'] | null => {
  const normalizedName = fileName.trim().toLowerCase();
  const headerSet = new Set(headers);

  if (normalizedName.includes('coprs') || (headerSet.has('team_number') && headerSet.has('opr'))) {
    return 'coprs';
  }

  if (
    normalizedName.includes('flat_schedule') ||
    (headerSet.has('match_key') && headerSet.has('color') && headerSet.has('team'))
  ) {
    return 'flatSchedule';
  }

  if (
    normalizedName.includes('schedule') ||
    (headerSet.has('match_key') &&
      headerSet.has('red1') &&
      headerSet.has('red2') &&
      headerSet.has('red3') &&
      headerSet.has('blue1') &&
      headerSet.has('blue2') &&
      headerSet.has('blue3'))
  ) {
    return 'schedule';
  }

  if (normalizedName.includes('team_list') || (headerSet.has('team_number') && headerSet.has('team_name'))) {
    return 'teamList';
  }

  return null;
};

const classifyJsonFile = (fileName: string, payload: unknown): ParsedCsvFile['type'] | null => {
  const normalizedName = fileName.trim().toLowerCase();

  if (normalizedName.includes('coprs')) {
    return 'coprs';
  }

  if (normalizedName.includes('oprs')) {
    return 'coprs';
  }

  if (Array.isArray(payload)) {
    const sample = payload.find(Boolean);
    if (isObject(sample) && 'alliances' in sample && 'comp_level' in sample) {
      return 'schedule';
    }
    if (isObject(sample) && Array.isArray(sample.picks)) {
      return 'alliances';
    }
    if (isObject(sample) && 'team_number' in sample) {
      return 'teamList';
    }
  }

  if (isObject(payload)) {
    if (Array.isArray(payload.rankings)) {
      return 'rankings';
    }
    if (isObject(payload.oprs)) {
      return 'coprs';
    }
    if (isString(payload.key) && isString(payload.name)) {
      return 'eventSummary';
    }

    const valueObjects = Object.values(payload).filter(isObject);
    if (valueObjects.length > 0) {
      const sampleEntry = valueObjects[0] ?? {};
      const sampleValue = Object.values(sampleEntry)[0];
      if (typeof sampleValue === 'number') {
        return 'coprs';
      }
    }
  }

  return null;
};

const parseFile = (fileName: string, text: string): ParsedCsvFile => {
  if (fileName.trim().toLowerCase().endsWith('.json')) {
    const payload = JSON.parse(text) as unknown;
    const fileType = classifyJsonFile(fileName, payload);
    if (!fileType) {
      throw new Error(`Could not classify JSON file "${fileName}".`);
    }

    switch (fileType) {
      case 'coprs':
        if (isObject(payload) && isObject(payload.oprs)) {
          return { type: 'coprs', data: parseOprsJson(fileName, payload) };
        }
        return { type: 'coprs', data: parseCoprsJson(fileName, payload) };
      case 'schedule':
        return { type: 'schedule', data: parseMatchesJson(fileName, payload) };
      case 'flatSchedule':
        return { type: 'flatSchedule', data: parseMatchesJson(fileName, payload) };
      case 'teamList':
        return { type: 'teamList', data: parseTeamListJson(fileName, payload) };
      case 'rankings':
        return { type: 'rankings', data: parseRankingsJson(fileName, payload) };
      case 'alliances':
        return { type: 'alliances', data: parseAlliancesJson(fileName, payload) };
      case 'eventSummary':
        return { type: 'eventSummary', data: parseEventSummaryJson(fileName, payload) };
    }
  }

  const { headers, objects } = parseCsvObjects(text);
  const fileType = classifyCsvFile(fileName, headers);
  if (!fileType) {
    throw new Error(`Could not classify CSV file "${fileName}".`);
  }

  switch (fileType) {
    case 'coprs':
      return {
        type: 'coprs',
        data: parseCoprsCsv(fileName, headers, objects)
      };
    case 'schedule':
      return {
        type: 'schedule',
        data: parseScheduleCsv(fileName, headers, objects)
      };
    case 'flatSchedule':
      return {
        type: 'flatSchedule',
        data: parseFlatScheduleCsv(fileName, headers, objects)
      };
    case 'teamList':
      return {
        type: 'teamList',
        data: parseTeamListCsv(fileName, headers, objects)
      };
    case 'rankings':
    case 'alliances':
    case 'eventSummary':
      throw new Error(`Unsupported CSV file type for "${fileName}".`);
  }
};

export const loadUploadedTbaCsvPack = (eventKey: string): UploadedTbaCsvPack | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(getStorageKey(eventKey));
    if (!stored) return null;
    return JSON.parse(stored) as UploadedTbaCsvPack;
  } catch (error) {
    console.error('Failed to load uploaded TBA CSV pack', error);
    return null;
  }
};

export const saveUploadedTbaCsvPack = (eventKey: string, pack: UploadedTbaCsvPack) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    getStorageKey(eventKey),
    JSON.stringify({
      ...pack,
      eventKey: normalizeEventKey(eventKey),
      loadedAt: Date.now()
    } satisfies UploadedTbaCsvPack)
  );
};

export const importUploadedTbaCsvFiles = async (
  eventKey: string,
  files: File[],
  existingPack?: UploadedTbaCsvPack | null
): Promise<UploadedTbaCsvImportResult> => {
  const pack: UploadedTbaCsvPack = {
    eventKey: normalizeEventKey(eventKey),
    loadedAt: Date.now(),
    ...(existingPack || {})
  };
  const messages: UploadedTbaCsvImportMessage[] = [];

  for (const file of files) {
    const text = await file.text();
    const parsed = parseFile(file.name, text);

    if (parsed.type === 'coprs') {
      const previous = pack.coprs;
      pack.coprs = {
        fileName: parsed.data.fileName,
        loadedAt: parsed.data.loadedAt,
        headers: Array.from(new Set([...(previous?.headers || []), ...parsed.data.headers])),
        ratings:
          Object.keys(parsed.data.ratings).length > 0
            ? { ...(previous?.ratings || {}), ...parsed.data.ratings }
            : previous?.ratings || {},
        bonusMetrics:
          Object.keys(parsed.data.bonusMetrics).length > 0
            ? { ...(previous?.bonusMetrics || {}), ...parsed.data.bonusMetrics }
            : previous?.bonusMetrics || {},
        componentPoints:
          Object.keys(parsed.data.componentPoints).length > 0
            ? { ...(previous?.componentPoints || {}), ...parsed.data.componentPoints }
            : previous?.componentPoints || {},
        hasBonusMetrics:
          parsed.data.hasBonusMetrics || previous?.hasBonusMetrics || false
      };
      messages.push({ level: 'info', text: `${file.name} loaded for uploaded TBA OPR data.` });
    } else if (parsed.type === 'schedule') {
      pack.schedule = parsed.data;
      messages.push({ level: 'info', text: `${file.name} loaded as schedule fallback.` });
    } else if (parsed.type === 'flatSchedule') {
      pack.flatSchedule = parsed.data;
      messages.push({ level: 'info', text: `${file.name} loaded as flat schedule fallback.` });
    } else if (parsed.type === 'teamList') {
      pack.teamList = parsed.data;
      messages.push({ level: 'info', text: `${file.name} loaded for team metadata fallback.` });
    } else if (parsed.type === 'rankings') {
      pack.rankings = parsed.data;
      messages.push({ level: 'info', text: `${file.name} loaded as rankings fallback.` });
    } else if (parsed.type === 'alliances') {
      pack.alliances = parsed.data;
      messages.push({ level: 'info', text: `${file.name} loaded as alliances fallback.` });
    } else if (parsed.type === 'eventSummary') {
      pack.eventSummary = parsed.data;
      messages.push({ level: 'info', text: `${file.name} loaded as event summary fallback.` });
    }
  }

  saveUploadedTbaCsvPack(eventKey, pack);
  return {
    pack,
    messages
  };
};

export const getPreferredUploadedSchedule = (pack: UploadedTbaCsvPack | null | undefined) => {
  if (pack?.schedule) {
    return {
      source: 'schedule' as const,
      fileName: pack.schedule.fileName,
      matches: pack.schedule.matches
    };
  }

  if (pack?.flatSchedule) {
    return {
      source: 'flat_schedule' as const,
      fileName: pack.flatSchedule.fileName,
      matches: pack.flatSchedule.matches
    };
  }

  return null;
};

export const getUploadedTeamNameLookup = (pack: UploadedTbaCsvPack | null | undefined) => pack?.teamList?.teamNames || {};
