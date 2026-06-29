import type {
  MatchScoutingV3Alliance,
  MatchScoutingV4DefenseAssignment,
  MatchScoutingV4Role,
  MatchScoutingV4ScoreAction,
  MatchScoutingV4ShiftAction,
  MatchScoutingV4ShiftEntry,
  MatchScoutingV4ShiftOwner,
  MatchScoutingV4ShiftPhase,
  MatchScoutingV4ShiftRole
} from '../types.ts';
import type { TBAMatch } from './mathEngine.ts';
import { deriveShiftActionCredits } from './shiftActionWeights.ts';

export const MATCH_SCOUT_TIMELINE_SHIFT_COUNT = 8;

const SHIFT_ACTIONS: MatchScoutingV4ShiftAction[] = ['offense', 'defense', 'stockpile'];

const getOppositeAlliance = (alliance: MatchScoutingV3Alliance): MatchScoutingV3Alliance =>
  alliance === 'Red' ? 'Blue' : alliance === 'Blue' ? 'Red' : '';

export const getMatchScoutShiftPhase = (index: number): MatchScoutingV4ShiftPhase => {
  if (index >= MATCH_SCOUT_TIMELINE_SHIFT_COUNT - 1) return 'endgame';
  if (index >= MATCH_SCOUT_TIMELINE_SHIFT_COUNT - 2) return 'transition';
  return 'teleop';
};

export const normalizeMatchScoutShiftActions = (
  entry: Partial<MatchScoutingV4ShiftEntry>
): MatchScoutingV4ShiftAction[] => {
  const directActions = Array.isArray(entry.actions)
    ? entry.actions.filter((action): action is MatchScoutingV4ShiftAction => SHIFT_ACTIONS.includes(action as MatchScoutingV4ShiftAction))
    : [];
  if (directActions.length) return Array.from(new Set(directActions));
  if (entry.role === 'offense') return ['offense'];
  if (entry.role === 'defense') return ['defense'];
  if (entry.role === 'stockpile') return ['stockpile'];
  if (entry.role === 'mixed') return ['defense', 'stockpile'];
  return [];
};

export const deriveMatchScoutShiftRole = (
  actions: MatchScoutingV4ShiftAction[]
): MatchScoutingV4ShiftRole => {
  if (actions.includes('offense') && actions.includes('defense')) return 'mixed';
  if (actions.includes('offense')) return 'offense';
  if (actions.includes('defense') && actions.includes('stockpile')) return 'mixed';
  if (actions.includes('defense')) return 'defense';
  if (actions.includes('stockpile')) return 'stockpile';
  return 'inactive';
};

const sumScoreActions = (entry: MatchScoutingV4ShiftEntry) =>
  (entry.scoreActions || []).reduce((sum, action) => sum + action.delta, 0);

const getShiftAllianceAtIndex = (
  index: number,
  firstShiftAlliance: MatchScoutingV3Alliance
): MatchScoutingV3Alliance => {
  const first = firstShiftAlliance || 'Red';
  return index % 2 === 0 ? first : getOppositeAlliance(first);
};

const getAllianceOccurrenceOrdinal = (
  index: number,
  firstShiftAlliance: MatchScoutingV3Alliance,
  targetAlliance: MatchScoutingV3Alliance
) => {
  let ordinal = 0;
  for (let currentIndex = 0; currentIndex < index; currentIndex += 1) {
    if (getShiftAllianceAtIndex(currentIndex, firstShiftAlliance) === targetAlliance) ordinal += 1;
  }
  return ordinal;
};

const findExistingTimelineEntry = (
  entries: MatchScoutingV4ShiftEntry[],
  index: number,
  firstShiftAlliance: MatchScoutingV3Alliance,
  shiftAlliance: MatchScoutingV3Alliance
) => {
  const sameIndex = entries.find(entry => entry.index === index && entry.shiftAlliance === shiftAlliance);
  if (sameIndex) return sameIndex;

  const targetOrdinal = getAllianceOccurrenceOrdinal(index, firstShiftAlliance, shiftAlliance);
  let seen = 0;
  return entries.find(entry => {
    if (entry.shiftAlliance !== shiftAlliance) return false;
    if (seen === targetOrdinal) return true;
    seen += 1;
    return false;
  });
};

const normalizeDefenseAssignments = (
  assignments: MatchScoutingV4DefenseAssignment[] = []
): MatchScoutingV4DefenseAssignment[] =>
  assignments
    .map(assignment => ({
      targetTeamNumber: assignment.targetTeamNumber,
      claimedSharePercent: Math.max(0, Math.min(100, Number.isFinite(assignment.claimedSharePercent) ? assignment.claimedSharePercent : 0)),
      normalizedSharePercent: assignment.normalizedSharePercent == null
        ? undefined
        : Math.max(0, Math.min(100, Number.isFinite(assignment.normalizedSharePercent) ? assignment.normalizedSharePercent : 0)),
      notes: assignment.notes || ''
    }))
    .filter(assignment => assignment.targetTeamNumber);

export const buildMatchScoutTimelineEntries = (
  entries: MatchScoutingV4ShiftEntry[] = [],
  firstShiftAlliance: MatchScoutingV3Alliance,
  scoutedAlliance: MatchScoutingV3Alliance
) => {
  const first = firstShiftAlliance || 'Red';
  return Array.from({ length: MATCH_SCOUT_TIMELINE_SHIFT_COUNT }, (_, index) => {
    const shiftAlliance = getShiftAllianceAtIndex(index, first);
    const existing = findExistingTimelineEntry(entries, index, first, shiftAlliance);
    const owner: MatchScoutingV4ShiftOwner = scoutedAlliance && shiftAlliance === scoutedAlliance ? 'own' : 'opponent';
    const scoreActions = existing?.scoreActions || [];
    const ballsScored = existing ? Math.max(existing.ballsScored || 0, sumScoreActions(existing)) : 0;
    const actions = normalizeMatchScoutShiftActions(existing || {});
    const allowedActions = owner === 'own'
      ? actions
      : actions.filter(action => action !== 'offense');
    const credits = deriveShiftActionCredits(allowedActions);
    return {
      id: `teleop-shift-${index + 1}`,
      index,
      phase: getMatchScoutShiftPhase(index),
      shiftAlliance,
      owner,
      role: deriveMatchScoutShiftRole(allowedActions),
      actions: allowedActions,
      ballsScored: allowedActions.includes('offense') ? ballsScored : 0,
      scoreActions: allowedActions.includes('offense') ? scoreActions : [] as MatchScoutingV4ScoreAction[],
      stockpileShiftCredit: credits.stockpileShiftCredit,
      defenseShiftCredit: credits.defenseShiftCredit,
      defendedTeams: allowedActions.includes('defense') ? normalizeDefenseAssignments(existing?.defendedTeams) : [],
      notes: existing?.notes || '',
      status: existing?.status || 'draft',
      submittedAt: existing?.submittedAt
    } satisfies MatchScoutingV4ShiftEntry;
  });
};

export const deriveMatchScoutShiftSummary = (entries: MatchScoutingV4ShiftEntry[]) => {
  const offenseEntries = entries.filter(entry => entry.owner === 'own' && normalizeMatchScoutShiftActions(entry).includes('offense'));
  const defenseEntries = entries.filter(entry => normalizeMatchScoutShiftActions(entry).includes('defense'));
  const stockpileEntries = entries.filter(entry => normalizeMatchScoutShiftActions(entry).includes('stockpile'));
  const teleopPoints = offenseEntries.reduce((sum, entry) => sum + entry.ballsScored, 0);
  const defenseAssignments = entries.flatMap(entry => entry.defendedTeams || []);
  let rolePlayed: MatchScoutingV4Role = '';
  if (offenseEntries.length && defenseEntries.length) rolePlayed = 'Mixed';
  else if (offenseEntries.length) rolePlayed = 'Offense';
  else if (defenseEntries.length) rolePlayed = 'Defense';
  else if (stockpileEntries.length) rolePlayed = 'Support';
  else rolePlayed = 'Disabled';

  return {
    teleopPoints,
    rolePlayed,
    defenseAssignments,
    defendedTeamNumber: defenseAssignments[0]?.targetTeamNumber || '',
    defenseIntensity: defenseAssignments.length
      ? Math.min(1, defenseAssignments.reduce((sum, assignment) => sum + assignment.claimedSharePercent, 0) / (defenseAssignments.length * 100))
      : 0
  };
};

const firstNumeric = (value: Record<string, unknown> | undefined, keys: string[]) => {
  if (!value) return null;
  for (const key of keys) {
    const number = Number(value[key]);
    if (Number.isFinite(number)) return Math.max(0, number);
  }
  return null;
};

export const inferFirstShiftAllianceFromFmsAuto = (match: TBAMatch | null | undefined): MatchScoutingV3Alliance => {
  const redBreakdown = match?.score_breakdown?.red as Record<string, unknown> | undefined;
  const blueBreakdown = match?.score_breakdown?.blue as Record<string, unknown> | undefined;
  const redAuto = firstNumeric(redBreakdown, ['autoPoints', 'auto_points', 'autoTotalPoints', 'auto_total_points', 'autoScore', 'auto_score']);
  const blueAuto = firstNumeric(blueBreakdown, ['autoPoints', 'auto_points', 'autoTotalPoints', 'auto_total_points', 'autoScore', 'auto_score']);
  if (redAuto == null || blueAuto == null || redAuto === blueAuto) return '';
  return redAuto > blueAuto ? 'Blue' : 'Red';
};

export const shouldRollSubmitShift = (
  currentIndex: number,
  nextIndex: number,
  entry: MatchScoutingV4ShiftEntry | undefined
) =>
  Boolean(
    entry &&
    nextIndex > currentIndex &&
    entry.status !== 'submitted' &&
    (entry.ballsScored > 0 || normalizeMatchScoutShiftActions(entry).length > 0 || (entry.defendedTeams || []).length > 0)
  );
