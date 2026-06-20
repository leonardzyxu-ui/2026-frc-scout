import type { MatchScoutingV2, MatchScoutingV3 } from '../types';
import type { PredictedMatchRow, ProjectedQualificationTeamRow } from './matchPredictor';
import type { TBAMatch } from './mathEngine';

export type AdminV4PredictorDisplayTab = 'ranking' | 'quals' | 'finals';
export type AdminV4ResultsDisplayTab = 'quals' | 'practice';

export const normalizeAdminV4TeamKey = (teamKey: string) => teamKey.replace(/^frc/i, '');

export const isAdminV4PlayedMatch = (match: TBAMatch) =>
  match.alliances.red.score !== -1 && match.alliances.blue.score !== -1;

export const getAdminV4PlayedMatchWinner = (match: TBAMatch): 'Red' | 'Blue' | 'Tie' | 'Unknown' => {
  if (!isAdminV4PlayedMatch(match)) return 'Unknown';
  if (match.alliances.red.score === match.alliances.blue.score) return 'Tie';
  return match.alliances.red.score > match.alliances.blue.score ? 'Red' : 'Blue';
};

export const sortAdminV4ScoutRowsByMatchThenTeam = <
  T extends { matchNumber: number; teamNumber: string; timestamp?: number }
>(rows: T[]) =>
  [...rows].sort((left, right) => {
    const matchDelta = left.matchNumber - right.matchNumber;
    if (matchDelta !== 0) return matchDelta;
    const teamDelta = Number(left.teamNumber) - Number(right.teamNumber);
    if (teamDelta !== 0) return teamDelta;
    return (left.timestamp || 0) - (right.timestamp || 0);
  });

export const getAdminV4V3LogicalId = (record: Pick<MatchScoutingV3, 'matchKey' | 'teamNumber'>) =>
  `${record.matchKey}_${record.teamNumber}`;

export const mergeAdminV4V3WithLegacyRows = (
  legacyRows: MatchScoutingV3[],
  v3Rows: MatchScoutingV3[]
) => {
  const merged = new Map<string, MatchScoutingV3>();
  legacyRows.forEach(row => merged.set(getAdminV4V3LogicalId(row), row));
  v3Rows.forEach(row => merged.set(getAdminV4V3LogicalId(row), row));
  return sortAdminV4ScoutRowsByMatchThenTeam([...merged.values()]);
};

export const isLegacyAdminV4MatchScoutingV2 = (value: unknown): value is MatchScoutingV2 =>
  !!value &&
  typeof value === 'object' &&
  (value as { schemaVersion?: unknown }).schemaVersion !== 'v3' &&
  typeof (value as Partial<MatchScoutingV2>).matchKey === 'string' &&
  typeof (value as Partial<MatchScoutingV2>).teamNumber === 'string' &&
  typeof (value as Partial<MatchScoutingV2>).eventKey === 'string';

export const getAdminV4CompLevelLabel = (compLevel: string) => {
  switch (compLevel) {
    case 'qm':
      return 'Qual';
    case 'sf':
      return 'Semi';
    case 'qf':
      return 'Quarter';
    case 'f':
      return 'Final';
    case 'pm':
      return 'Practice';
    default:
      return compLevel.toUpperCase();
  }
};

export const formatAdminV4Record = (
  row: Pick<ProjectedQualificationTeamRow, 'wins' | 'losses' | 'ties'>
) => `${row.wins}-${row.losses}-${row.ties}`;

export const getAdminV4PredictorViewDescription = (view: AdminV4PredictorDisplayTab) => {
  switch (view) {
    case 'ranking':
      return 'Projected end-of-quals ranking using the selected model.';
    case 'quals':
      return 'Future qualification match forecasts using the selected model.';
    case 'finals':
      return 'Full playoff bracket forecast using the selected model with published alliance and playoff structure.';
  }
};

export const getAdminV4ResultsViewDescription = (view: AdminV4ResultsDisplayTab) => {
  switch (view) {
    case 'quals':
      return 'Qualification match results ordered from Qual 1 upward.';
    case 'practice':
      return 'Practice match results ordered from Practice 1 upward.';
  }
};

export const getAdminV4PlayoffStatusLabel = (status: PredictedMatchRow['status']) => {
  switch (status) {
    case 'played':
      return 'Played';
    case 'predicted':
      return 'Predicted';
    case 'bye':
      return 'Bye';
    case 'if-necessary':
      return 'If Necessary';
    default:
      return 'Pending';
  }
};
