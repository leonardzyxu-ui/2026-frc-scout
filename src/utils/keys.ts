export type ScoutMatchType = 'Practice' | 'Qualification';

export interface ParsedMatchKey {
  matchKey: string;
  matchType: ScoutMatchType;
  matchNumber: number;
}

export interface ScoutSlotAssignment {
  name: string;
  alliance: 'Red' | 'Blue';
  positionIndex: number;
  slotLabel: string;
}

export const DEFAULT_NORMALIZED_EVENT_KEY = '2026MNUM';

export const normalizeEventKey = (value: unknown, fallback = DEFAULT_NORMALIZED_EVENT_KEY) => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
  return normalized || fallback;
};

export const normalizeTeamNumber = (value: unknown) => {
  const text = String(value ?? '')
    .trim()
    .replace(/^frc/i, '');
  const digits = text.match(/\d+/g)?.join('') ?? '';
  return digits;
};

export const normalizeTeamKey = (value: unknown) => {
  const teamNumber = normalizeTeamNumber(value);
  return teamNumber ? `frc${teamNumber}` : '';
};

export const buildMatchKey = (matchType: ScoutMatchType, matchNumber: number) => {
  const prefix = matchType === 'Practice' ? 'pm' : 'qm';
  const normalizedNumber = Math.max(1, Math.round(Number.isFinite(matchNumber) ? matchNumber : 1));
  return `${prefix}${normalizedNumber}`;
};

export const parseMatchNumber = (matchKey: unknown) => {
  const match = String(matchKey ?? '').match(/(\d+)/);
  return match ? Math.max(1, parseInt(match[1] ?? '1', 10)) : 1;
};

export const parseMatchType = (matchKey: unknown): ScoutMatchType =>
  String(matchKey ?? '')
    .trim()
    .toLowerCase()
    .startsWith('pm')
    ? 'Practice'
    : 'Qualification';

export const parseMatchKey = (matchKey: unknown): ParsedMatchKey => {
  const matchType = parseMatchType(matchKey);
  const matchNumber = parseMatchNumber(matchKey);
  return {
    matchKey: buildMatchKey(matchType, matchNumber),
    matchType,
    matchNumber
  };
};

export const getScoutAssignment = (
  assignments: ScoutSlotAssignment[],
  query: { name?: string; slotLabel?: string; alliance?: 'Red' | 'Blue'; positionIndex?: number }
) => {
  const targetName = query.name?.trim().toLowerCase();
  const targetSlot = query.slotLabel?.trim().toLowerCase();

  return (
    assignments.find(assignment => {
      if (targetName && assignment.name.trim().toLowerCase() !== targetName) return false;
      if (targetSlot && assignment.slotLabel.trim().toLowerCase() !== targetSlot) return false;
      if (query.alliance && assignment.alliance !== query.alliance) return false;
      if (query.positionIndex != null && assignment.positionIndex !== query.positionIndex) return false;
      return true;
    }) || null
  );
};

export const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'timestamp' && key !== 'deviceId' && key !== 'editHistory')
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value) ?? 'undefined';
};
