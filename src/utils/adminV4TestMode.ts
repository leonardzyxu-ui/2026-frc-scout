import type { MatchDefenseScoutingV1, MatchScoutingV3, MatchScoutingV4 } from '../types.ts';
import type { TBAMatch } from './mathEngine.ts';

type MatchRow = MatchScoutingV3 | MatchScoutingV4 | MatchDefenseScoutingV1;

const COMP_LEVEL_ORDER: Record<string, number> = {
  pm: 0,
  qm: 1,
  ef: 2,
  qf: 3,
  sf: 4,
  f: 5
};

export interface AdminV4MatchOrder {
  compLevel: string;
  compOrder: number;
  matchNumber: number;
  setNumber: number;
}

export interface AdminV4TestModeScope {
  active: boolean;
  selectedMatch: TBAMatch | null;
  selectedMatchLabel: string;
  matches: TBAMatch[];
  records: MatchScoutingV3[];
  v4Records: MatchScoutingV4[];
  defenseRecords: MatchDefenseScoutingV1[];
  sourceMatchCount: number;
  scopedPlayedMatchCount: number;
  futureMatchCount: number;
  sourceRecordCount: number;
  scopedRecordCount: number;
}

export const normalizeAdminV4MatchKey = (value: string) => value.trim().toLowerCase();

export const getAdminV4MatchLabel = (match: Pick<TBAMatch, 'key' | 'comp_level' | 'match_number' | 'set_number'>) => {
  const shortKey = match.key.split('_')[1];
  if (shortKey) return shortKey.toUpperCase();
  const comp = match.comp_level.toUpperCase();
  return match.set_number && match.set_number > 1 ? `${comp}${match.match_number}M${match.set_number}` : `${comp}${match.match_number}`;
};

const parseMatchKeyOrder = (matchKey: string): AdminV4MatchOrder | null => {
  const normalized = normalizeAdminV4MatchKey(matchKey);
  const match = normalized.match(/(?:^|_)(pm|qm|ef|qf|sf|f)(\d+)(?:m(\d+))?$/i);
  if (!match) return null;
  const compLevel = match[1]!.toLowerCase();
  return {
    compLevel,
    compOrder: COMP_LEVEL_ORDER[compLevel] ?? 99,
    matchNumber: Number(match[2] || 0),
    setNumber: Number(match[3] || 1)
  };
};

export const getAdminV4MatchOrder = (match: Pick<TBAMatch, 'key' | 'comp_level' | 'match_number' | 'set_number'>): AdminV4MatchOrder => {
  const parsed = parseMatchKeyOrder(match.key);
  if (parsed) return parsed;
  const compLevel = (match.comp_level || '').toLowerCase();
  return {
    compLevel,
    compOrder: COMP_LEVEL_ORDER[compLevel] ?? 99,
    matchNumber: Number(match.match_number || 0),
    setNumber: Number(match.set_number || 1)
  };
};

const getRowMatchOrder = (row: MatchRow): AdminV4MatchOrder | null => {
  const parsed = parseMatchKeyOrder(row.matchKey);
  if (parsed) return parsed;
  const compLevel = row.matchType === 'Practice' ? 'pm' : row.matchType === 'Qualification' ? 'qm' : '';
  if (!compLevel || !Number.isFinite(row.matchNumber)) return null;
  return {
    compLevel,
    compOrder: COMP_LEVEL_ORDER[compLevel] ?? 99,
    matchNumber: Number(row.matchNumber || 0),
    setNumber: 1
  };
};

export const compareAdminV4MatchOrder = (left: AdminV4MatchOrder, right: AdminV4MatchOrder) => {
  if (left.compOrder !== right.compOrder) return left.compOrder - right.compOrder;
  if (left.matchNumber !== right.matchNumber) return left.matchNumber - right.matchNumber;
  return left.setNumber - right.setNumber;
};

export const sortAdminV4MatchesForTestMode = (matches: TBAMatch[]) =>
  [...matches].sort((left, right) => compareAdminV4MatchOrder(getAdminV4MatchOrder(left), getAdminV4MatchOrder(right)));

export const findAdminV4TestModeMatch = (matches: TBAMatch[], matchKey: string) => {
  const normalizedKey = normalizeAdminV4MatchKey(matchKey);
  if (!normalizedKey) return null;
  return matches.find(match => normalizeAdminV4MatchKey(match.key) === normalizedKey) || null;
};

const scrubMatchForPrediction = (match: TBAMatch): TBAMatch => ({
  ...match,
  winning_alliance: '',
  actual_time: null,
  alliances: {
    red: { ...match.alliances.red, score: -1 },
    blue: { ...match.alliances.blue, score: -1 }
  },
  score_breakdown: undefined
});

export const scopeAdminV4MatchesForTestMode = (matches: TBAMatch[], selectedMatch: TBAMatch | null) => {
  if (!selectedMatch) return matches;
  const selectedOrder = getAdminV4MatchOrder(selectedMatch);
  return sortAdminV4MatchesForTestMode(matches).map(match =>
    compareAdminV4MatchOrder(getAdminV4MatchOrder(match), selectedOrder) < 0 ? match : scrubMatchForPrediction(match)
  );
};

export const filterAdminV4RowsBeforeTestMatch = <TRow extends MatchRow>(rows: TRow[], selectedMatch: TBAMatch | null): TRow[] => {
  if (!selectedMatch) return rows;
  const selectedOrder = getAdminV4MatchOrder(selectedMatch);
  return rows.filter(row => {
    const rowOrder = getRowMatchOrder(row);
    return rowOrder ? compareAdminV4MatchOrder(rowOrder, selectedOrder) < 0 : false;
  });
};

export const buildAdminV4TestModeScope = ({
  enabled,
  matchKey,
  matches,
  records,
  v4Records,
  defenseRecords
}: {
  enabled: boolean;
  matchKey: string;
  matches: TBAMatch[];
  records: MatchScoutingV3[];
  v4Records: MatchScoutingV4[];
  defenseRecords: MatchDefenseScoutingV1[];
}): AdminV4TestModeScope => {
  const sortedMatches = sortAdminV4MatchesForTestMode(matches);
  const selectedMatch = enabled ? findAdminV4TestModeMatch(sortedMatches, matchKey) : null;
  const scopedMatches = enabled && selectedMatch ? scopeAdminV4MatchesForTestMode(sortedMatches, selectedMatch) : sortedMatches;
  const scopedRecords = enabled && selectedMatch ? filterAdminV4RowsBeforeTestMatch(records, selectedMatch) : records;
  const scopedV4Records = enabled && selectedMatch ? filterAdminV4RowsBeforeTestMatch(v4Records, selectedMatch) : v4Records;
  const scopedDefenseRecords = enabled && selectedMatch ? filterAdminV4RowsBeforeTestMatch(defenseRecords, selectedMatch) : defenseRecords;

  return {
    active: Boolean(enabled && selectedMatch),
    selectedMatch,
    selectedMatchLabel: selectedMatch ? getAdminV4MatchLabel(selectedMatch) : '',
    matches: scopedMatches,
    records: scopedRecords,
    v4Records: scopedV4Records,
    defenseRecords: scopedDefenseRecords,
    sourceMatchCount: sortedMatches.length,
    scopedPlayedMatchCount: scopedMatches.filter(match => match.alliances.red.score !== -1 && match.alliances.blue.score !== -1).length,
    futureMatchCount: scopedMatches.filter(match => match.alliances.red.score === -1 || match.alliances.blue.score === -1).length,
    sourceRecordCount: records.length + v4Records.length + defenseRecords.length,
    scopedRecordCount: scopedRecords.length + scopedV4Records.length + scopedDefenseRecords.length
  };
};
