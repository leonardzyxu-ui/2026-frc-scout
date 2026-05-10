import { MatchScoutingV3, MatchScoutingV3Alliance, MatchScoutingV3MatchType } from '../types';
import { TBAMatch } from './mathEngine';
import { getScoutAssignmentByName, getScoutAssignmentBySlot, SCOUT_ASSIGNMENTS } from './scoutAssignments';

export type MatchRowAnomaly =
  | 'wrong_team_for_slot'
  | 'scout_assignment_mismatch'
  | 'unexpected_team'
  | 'duplicate_record';

export interface MatchValidationLike {
  id: string;
  eventKey: string;
  matchType: MatchScoutingV3MatchType;
  matchKey: string;
  matchNumber?: number;
  teamNumber: string;
  scoutName: string;
  assignedScoutName: string;
  assignedSlot: string;
  substituteScoutName?: string;
  alliance: MatchScoutingV3Alliance;
}

export interface MatchValidationRecordBase extends MatchScoutingV3 {
  id: string;
}

export interface MatchEditorRecord extends MatchValidationRecordBase {}

export interface ExpectedMatchSlot {
  key: string;
  slotLabel: string;
  alliance: 'Red' | 'Blue';
  positionIndex: number;
  teamNumber: string;
  assignedScoutName: string;
}

export interface ValidatedMatchRow<TRecord extends MatchValidationLike = MatchEditorRecord> {
  record: TRecord;
  anomalies: MatchRowAnomaly[];
  expectedSlotLabel: string;
  expectedTeamNumber: string;
}

export interface MatchValidationGroup<TRecord extends MatchValidationLike = MatchEditorRecord> {
  matchKey: string;
  displayMatchKey: string;
  scheduleKnown: boolean;
  warnings: string[];
  expectedSlots: ExpectedMatchSlot[];
  missingSlots: ExpectedMatchSlot[];
  rows: ValidatedMatchRow<TRecord>[];
  sortIndex: number;
}

const MATCH_LEVEL_ORDER: Record<string, number> = {
  pm: 0,
  qm: 1,
  ef: 2,
  qf: 3,
  sf: 4,
  f: 5
};

const normalizeMatchKey = (matchKey: string) => {
  const trimmed = (matchKey || '').trim().toLowerCase();
  if (!trimmed) return '';
  const parts = trimmed.split('_');
  return parts[parts.length - 1];
};

const normalizeTeamNumber = (teamNumber: string) => teamNumber.replace(/^frc/i, '').trim();

const getMatchOrderFromKey = (matchKey: string) => {
  const normalized = normalizeMatchKey(matchKey);
  const prefixMatch = normalized.match(/^[a-z]+/);
  const prefix = prefixMatch?.[0] || 'zz';
  const numericParts = normalized.match(/\d+/g) || [];
  const firstNumber = parseInt(numericParts[0] || '0', 10);
  const secondNumber = parseInt(numericParts[1] || '0', 10);
  return (MATCH_LEVEL_ORDER[prefix] ?? 99) * 1_000_000 + firstNumber * 1_000 + secondNumber;
};

const getDisplayMatchKey = (matchKey: string) => normalizeMatchKey(matchKey).toUpperCase() || 'UNKNOWN MATCH';

const matchUsesFixedAssignments = (matchKey: string, matchType?: MatchScoutingV3['matchType']) => {
  if (matchType === 'Practice' || matchType === 'Qualification') return true;
  const normalized = normalizeMatchKey(matchKey);
  return normalized.startsWith('pm') || normalized.startsWith('qm');
};

const buildExpectedSlots = (match: TBAMatch): ExpectedMatchSlot[] => {
  const normalizedKey = normalizeMatchKey(match.key);
  const useFixedAssignments = matchUsesFixedAssignments(normalizedKey);
  const slots: ExpectedMatchSlot[] = [];

  (['red', 'blue'] as const).forEach(allianceKey => {
    const alliance = allianceKey === 'red' ? 'Red' : 'Blue';
    const teamKeys = match.alliances[allianceKey].team_keys || [];
    teamKeys.forEach((teamKey, index) => {
      const assignment = SCOUT_ASSIGNMENTS.find(
        option => option.alliance === alliance && option.positionIndex === index
      );
      const slotLabel = assignment?.slotLabel || `${alliance} ${index + 1}`;
      slots.push({
        key: `${normalizedKey}:${slotLabel}`,
        slotLabel,
        alliance,
        positionIndex: index,
        teamNumber: normalizeTeamNumber(teamKey),
        assignedScoutName: useFixedAssignments ? assignment?.name || '' : ''
      });
    });
  });

  return slots;
};

const rowMatchesSearch = (row: MatchValidationLike, query: string) =>
  row.matchKey.toLowerCase().includes(query) ||
  row.teamNumber.toLowerCase().includes(query) ||
  row.scoutName.toLowerCase().includes(query) ||
  (row.assignedScoutName || '').toLowerCase().includes(query) ||
  (row.assignedSlot || '').toLowerCase().includes(query);

export const getRowAnomalyLabel = (anomaly: MatchRowAnomaly) => {
  switch (anomaly) {
    case 'wrong_team_for_slot':
      return 'Wrong Team for Slot';
    case 'scout_assignment_mismatch':
      return 'Scout Assignment Mismatch';
    case 'unexpected_team':
      return 'Unexpected Team';
    case 'duplicate_record':
      return 'Duplicate Record';
    default:
      return anomaly;
  }
};

export const buildMatchValidationGroups = <TRecord extends MatchValidationLike = MatchEditorRecord>(
  records: TRecord[],
  scheduleMatches: TBAMatch[]
): MatchValidationGroup<TRecord>[] => {
  const groups = new Map<string, MatchValidationGroup<TRecord>>();

  scheduleMatches.forEach(match => {
    const normalizedKey = normalizeMatchKey(match.key);
    groups.set(normalizedKey, {
      matchKey: normalizedKey,
      displayMatchKey: getDisplayMatchKey(normalizedKey),
      scheduleKnown: true,
      warnings: [],
      expectedSlots: buildExpectedSlots(match),
      missingSlots: [],
      rows: [],
      sortIndex: getMatchOrderFromKey(normalizedKey)
    });
  });

  records.forEach(record => {
    const normalizedKey = normalizeMatchKey(record.matchKey);
    if (!groups.has(normalizedKey)) {
      groups.set(normalizedKey, {
        matchKey: normalizedKey,
        displayMatchKey: getDisplayMatchKey(record.matchKey),
        scheduleKnown: false,
        warnings: ['Schedule Unknown'],
        expectedSlots: [],
        missingSlots: [],
        rows: [],
        sortIndex: 10_000_000 + getMatchOrderFromKey(record.matchKey)
      });
    }
  });

  const rowsByMatch = new Map<string, TRecord[]>();
  records.forEach(record => {
    const normalizedKey = normalizeMatchKey(record.matchKey);
    const bucket = rowsByMatch.get(normalizedKey) || [];
    bucket.push(record);
    rowsByMatch.set(normalizedKey, bucket);
  });

  groups.forEach(group => {
    const rows = rowsByMatch.get(group.matchKey) || [];
    const expectedSlots = group.expectedSlots;
    const scheduledTeams = new Set(expectedSlots.map(slot => slot.teamNumber).filter(Boolean));
    const teamCounts = new Map<string, number>();
    const slotCounts = new Map<string, number>();

    rows.forEach(row => {
      const normalizedTeam = row.teamNumber.trim();
      if (normalizedTeam) {
        teamCounts.set(normalizedTeam, (teamCounts.get(normalizedTeam) || 0) + 1);
      }
      const slotKey = row.assignedSlot?.trim();
      if (slotKey) {
        slotCounts.set(slotKey, (slotCounts.get(slotKey) || 0) + 1);
      }
    });

    const validatedRows = rows.map<ValidatedMatchRow<TRecord>>(row => {
      const anomalies: MatchRowAnomaly[] = [];
      const assignmentByName = row.assignedScoutName ? getScoutAssignmentByName(row.assignedScoutName) : null;
      const assignmentBySlot = row.assignedSlot ? getScoutAssignmentBySlot(row.assignedSlot) : null;
      const expectedSlot =
        (assignmentBySlot && expectedSlots.find(slot => slot.slotLabel === assignmentBySlot.slotLabel)) ||
        (assignmentByName && expectedSlots.find(slot => slot.slotLabel === assignmentByName.slotLabel)) ||
        expectedSlots.find(slot => slot.teamNumber === row.teamNumber);

      if (group.scheduleKnown && row.teamNumber && !scheduledTeams.has(row.teamNumber)) {
        anomalies.push('unexpected_team');
      }

      if (teamCounts.get(row.teamNumber.trim()) && (teamCounts.get(row.teamNumber.trim()) || 0) > 1) {
        anomalies.push('duplicate_record');
      }

      if (row.assignedSlot && (slotCounts.get(row.assignedSlot.trim()) || 0) > 1) {
        anomalies.push('duplicate_record');
      }

      if (assignmentByName && row.assignedSlot && assignmentByName.slotLabel !== row.assignedSlot) {
        anomalies.push('scout_assignment_mismatch');
      }

      if (row.assignedSlot && !assignmentBySlot) {
        anomalies.push('scout_assignment_mismatch');
      }

      if (row.assignedSlot && !row.assignedScoutName && matchUsesFixedAssignments(row.matchKey, row.matchType)) {
        anomalies.push('scout_assignment_mismatch');
      }

      if (row.assignedScoutName && !assignmentByName && matchUsesFixedAssignments(row.matchKey, row.matchType)) {
        anomalies.push('scout_assignment_mismatch');
      }

      if (
        row.assignedScoutName &&
        row.scoutName &&
        row.scoutName !== row.assignedScoutName &&
        row.scoutName !== row.substituteScoutName
      ) {
        anomalies.push('scout_assignment_mismatch');
      }

      if (group.scheduleKnown && expectedSlot?.teamNumber && expectedSlot.teamNumber !== row.teamNumber) {
        anomalies.push('wrong_team_for_slot');
      }

      return {
        record: row,
        anomalies: Array.from(new Set(anomalies)),
        expectedSlotLabel: expectedSlot?.slotLabel || '',
        expectedTeamNumber: expectedSlot?.teamNumber || ''
      };
    });

    const presentExpectedTeams = new Set(
      validatedRows
        .filter(row => row.record.teamNumber && scheduledTeams.has(row.record.teamNumber))
        .map(row => row.record.teamNumber)
    );

    group.rows = validatedRows.sort((left, right) => {
      const leftSlot = left.expectedSlotLabel || left.record.assignedSlot || 'ZZZ';
      const rightSlot = right.expectedSlotLabel || right.record.assignedSlot || 'ZZZ';
      const slotOrder = leftSlot.localeCompare(rightSlot);
      if (slotOrder !== 0) return slotOrder;
      return left.record.teamNumber.localeCompare(right.record.teamNumber, undefined, { numeric: true });
    });

    group.missingSlots = expectedSlots.filter(slot => slot.teamNumber && !presentExpectedTeams.has(slot.teamNumber));

    if (group.missingSlots.length > 0) {
      group.warnings.push(`Missing ${group.missingSlots.length} slot${group.missingSlots.length === 1 ? '' : 's'}`);
    }
    if (validatedRows.some(row => row.anomalies.includes('unexpected_team'))) {
      group.warnings.push('Unexpected Team');
    }
    if (validatedRows.some(row => row.anomalies.includes('wrong_team_for_slot'))) {
      group.warnings.push('Wrong Team for Slot');
    }
    if (validatedRows.some(row => row.anomalies.includes('scout_assignment_mismatch'))) {
      group.warnings.push('Scout Assignment Mismatch');
    }
    if (validatedRows.some(row => row.anomalies.includes('duplicate_record'))) {
      group.warnings.push('Duplicate Record');
    }

    group.warnings = Array.from(new Set(group.warnings));
  });

  return Array.from(groups.values()).sort((left, right) => left.sortIndex - right.sortIndex);
};

export const filterMatchValidationGroups = <TRecord extends MatchValidationLike = MatchEditorRecord>(
  groups: MatchValidationGroup<TRecord>[],
  rawQuery: string
) => {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return groups;

  return groups.filter(group => {
    if (group.displayMatchKey.toLowerCase().includes(query)) return true;
    if (group.warnings.some(warning => warning.toLowerCase().includes(query))) return true;
    if (group.expectedSlots.some(slot =>
      slot.teamNumber.toLowerCase().includes(query) ||
      slot.slotLabel.toLowerCase().includes(query) ||
      slot.assignedScoutName.toLowerCase().includes(query)
    )) {
      return true;
    }
    if (group.missingSlots.some(slot =>
      slot.teamNumber.toLowerCase().includes(query) ||
      slot.slotLabel.toLowerCase().includes(query) ||
      slot.assignedScoutName.toLowerCase().includes(query)
    )) {
      return true;
    }
    return group.rows.some(row => rowMatchesSearch(row.record, query));
  });
};
