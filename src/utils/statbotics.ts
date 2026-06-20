export interface StatboticsNormalizedTeamEpa {
  teamNumber: string;
  overallEPA: number;
  autoEPA: number | null;
  teleopEPA: number | null;
  fuelEPA: number;
  towerEPA: number;
  source: 'team_event' | 'team_year';
}

export interface FetchEventStatboticsEpaResult {
  epaByTeam: Record<string, StatboticsNormalizedTeamEpa>;
  missingTeams: string[];
  usedTeamYearFallback: number;
}

interface StatboticsTeamResponse {
  team?: number;
  epa?: {
    total_points?: {
      mean?: number;
    };
    breakdown?: Record<string, unknown>;
  };
}

const STATBOTICS_BASE_URL = 'https://api.statbotics.io/v3';

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const firstNumeric = (record: Record<string, unknown> | undefined, keys: string[]) => {
  if (!record) return null;

  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }

  return null;
};

const getTowerEpa = (breakdown: Record<string, unknown> | undefined) => {
  if (!breakdown) return null;

  const explicitTower = firstNumeric(breakdown, [
    'tower_epa',
    'tower_points',
    'towerPoints',
    'tower_progress',
    'towerProgress',
    'total_tower_points',
    'totalTowerPoints'
  ]);
  if (explicitTower != null) return explicitTower;

  const totalTower = firstNumeric(breakdown, ['total_tower', 'tower']);
  if (totalTower != null && totalTower > 5) return totalTower;

  const endgamePoints = firstNumeric(breakdown, ['endgame_points', 'endGamePoints']);
  if (endgamePoints != null) return endgamePoints;

  if (totalTower != null) return totalTower;

  const towerSum = ['auto_tower', 'endgame_tower']
    .map(key => asNumber(breakdown[key]) ?? 0)
    .reduce((sum, value) => sum + value, 0);

  return towerSum > 0 ? towerSum : null;
};

const getAutoEpa = (breakdown: Record<string, unknown> | undefined) =>
  firstNumeric(breakdown, [
    'auto_epa',
    'auto_points',
    'autoPoints',
    'total_auto_points',
    'totalAutoPoints'
  ]);

const getTeleopEpa = (breakdown: Record<string, unknown> | undefined) =>
  firstNumeric(breakdown, [
    'teleop_epa',
    'teleop_points',
    'teleopPoints',
    'total_teleop_points',
    'totalTeleopPoints'
  ]);

const normalizeTeamEpa = (
  teamNumber: string,
  source: 'team_event' | 'team_year',
  payload: StatboticsTeamResponse
): StatboticsNormalizedTeamEpa | null => {
  const breakdown = payload.epa?.breakdown;
  const overallEPA =
    firstNumeric(breakdown, ['total_points', 'epa', 'epa_total']) ??
    asNumber(payload.epa?.total_points?.mean);

  if (overallEPA == null) {
    return null;
  }

  const fuelEPA = firstNumeric(breakdown, ['fuel_epa', 'total_fuel', 'fuel']) ?? 0;
  const towerEPA = getTowerEpa(breakdown) ?? 0;
  const autoEPA = getAutoEpa(breakdown);
  const teleopEPA = getTeleopEpa(breakdown);

  return {
    teamNumber,
    overallEPA,
    autoEPA,
    teleopEPA,
    fuelEPA,
    towerEPA,
    source
  };
};

const fetchStatboticsJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${STATBOTICS_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Statbotics API Error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
};

const fetchSingleTeamEpa = async (
  eventKey: string,
  teamNumber: string
): Promise<StatboticsNormalizedTeamEpa | null> => {
  const normalizedEventKey = eventKey.trim().toLowerCase();
  const year = Number.parseInt(normalizedEventKey.slice(0, 4), 10);

  try {
    const eventPayload = await fetchStatboticsJson<StatboticsTeamResponse>(`/team_event/${teamNumber}/${normalizedEventKey}`);
    const normalized = normalizeTeamEpa(teamNumber, 'team_event', eventPayload);
    if (normalized) return normalized;
  } catch {
    // Fall through to team-year fallback.
  }

  if (!Number.isFinite(year)) {
    return null;
  }

  try {
    const teamYearPayload = await fetchStatboticsJson<StatboticsTeamResponse>(`/team_year/${teamNumber}/${year}`);
    return normalizeTeamEpa(teamNumber, 'team_year', teamYearPayload);
  } catch {
    return null;
  }
};

export const fetchEventStatboticsEpa = async (
  eventKey: string,
  teamNumbers: string[]
): Promise<FetchEventStatboticsEpaResult> => {
  const uniqueTeamNumbers = Array.from(
    new Set(teamNumbers.filter(teamNumber => teamNumber && teamNumber.trim().length > 0))
  ).sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));

  if (uniqueTeamNumbers.length === 0) {
    return {
      epaByTeam: {},
      missingTeams: [],
      usedTeamYearFallback: 0
    };
  }

  const settled = await Promise.allSettled(
    uniqueTeamNumbers.map(async teamNumber => fetchSingleTeamEpa(eventKey, teamNumber))
  );

  const epaByTeam: Record<string, StatboticsNormalizedTeamEpa> = {};
  const missingTeams: string[] = [];
  let usedTeamYearFallback = 0;

  settled.forEach((result, index) => {
    const teamNumber = uniqueTeamNumbers[index];
    if (!teamNumber) return;
    if (result.status !== 'fulfilled' || !result.value) {
      missingTeams.push(teamNumber);
      return;
    }

    epaByTeam[teamNumber] = result.value;
    if (result.value.source === 'team_year') {
      usedTeamYearFallback += 1;
    }
  });

  return {
    epaByTeam,
    missingTeams,
    usedTeamYearFallback
  };
};
