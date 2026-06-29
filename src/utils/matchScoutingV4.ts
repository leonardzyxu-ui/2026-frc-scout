import { initialMatchScoutingV4 } from '../types.ts';
import type {
  MatchScoutingV3Alliance,
  MatchScoutingV3MatchType,
  MatchScoutingV4,
  MatchScoutingV4DefenseAssignment,
  MatchScoutingV4Role,
  MatchScoutingV4ShiftEntry,
  MatchScoutingV4ShiftOwner,
  MatchScoutingV4ShiftRole,
  MatchScoutingV4SubstituteScoutName
} from '../types.ts';
import { buildMatchKeyV3, parseMatchNumberV3, parseMatchTypeV3, sanitizeEventKeyV3, toNonNegativeInt } from './matchScoutingV3.ts';
import { normalizeTeamNumber } from './keys.ts';

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const normalizeAlliance = (value: unknown): MatchScoutingV3Alliance =>
  value === 'Red' || value === 'Blue' ? value : '';

const normalizeSubstituteScoutName = (value: unknown): MatchScoutingV4SubstituteScoutName =>
  value === 'Charlotte' || value === 'Scarlett' ? value : '';

const normalizeRole = (value: unknown): MatchScoutingV4Role =>
  value === 'Offense' || value === 'Defense' || value === 'Mixed' || value === 'Support' || value === 'Disabled'
    ? value
    : '';

const normalizeShiftOwner = (value: unknown): MatchScoutingV4ShiftOwner =>
  value === 'own' || value === 'opponent' ? value : 'own';

const normalizeShiftRole = (value: unknown): MatchScoutingV4ShiftRole =>
  value === 'offense' || value === 'defense' || value === 'stockpile' || value === 'inactive' || value === 'mixed'
    ? value
    : 'inactive';

const normalizeDefenseAssignment = (raw: Partial<MatchScoutingV4DefenseAssignment> = {}): MatchScoutingV4DefenseAssignment => ({
  targetTeamNumber: normalizeTeamNumber(raw.targetTeamNumber),
  claimedSharePercent: Math.max(0, Math.min(100, Number.isFinite(raw.claimedSharePercent) ? Number(raw.claimedSharePercent) : 0)),
  normalizedSharePercent: raw.normalizedSharePercent == null
    ? undefined
    : Math.max(0, Math.min(100, Number.isFinite(raw.normalizedSharePercent) ? Number(raw.normalizedSharePercent) : 0)),
  notes: raw.notes || ''
});

const normalizeShiftEntry = (raw: Partial<MatchScoutingV4ShiftEntry> = {}, fallbackIndex: number): MatchScoutingV4ShiftEntry => ({
  id: raw.id || `shift-${fallbackIndex + 1}`,
  index: toNonNegativeInt(raw.index ?? fallbackIndex),
  owner: normalizeShiftOwner(raw.owner),
  role: normalizeShiftRole(raw.role),
  ballsScored: toNonNegativeInt(raw.ballsScored ?? 0),
  stockpileShiftCredit: Math.max(0, Number.isFinite(raw.stockpileShiftCredit) ? Number(raw.stockpileShiftCredit) : 0),
  defenseShiftCredit: Math.max(0, Number.isFinite(raw.defenseShiftCredit) ? Number(raw.defenseShiftCredit) : 0),
  defendedTeams: Array.isArray(raw.defendedTeams)
    ? raw.defendedTeams.map(assignment => normalizeDefenseAssignment(assignment)).filter(assignment => assignment.targetTeamNumber)
    : [],
  notes: raw.notes || '',
  submittedAt: raw.submittedAt && Number.isFinite(raw.submittedAt) ? Number(raw.submittedAt) : undefined
});

const normalizeOfficialReconciliation = (raw: MatchScoutingV4['officialReconciliation']) => raw
  ? {
      officialAllianceFuelPoints: toNonNegativeInt(raw.officialAllianceFuelPoints),
      rawAllianceFuelPoints: toNonNegativeInt(raw.rawAllianceFuelPoints),
      scaleFactor: Number.isFinite(raw.scaleFactor) ? Number(raw.scaleFactor) : 0,
      adjustedTeamFuelPoints: Math.max(0, Number.isFinite(raw.adjustedTeamFuelPoints) ? Number(raw.adjustedTeamFuelPoints) : 0),
      warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String).filter(Boolean) : [],
      reconciledAt: raw.reconciledAt && Number.isFinite(raw.reconciledAt) ? Number(raw.reconciledAt) : Date.now()
    }
  : undefined;

export const calculateTotalMatchPointsV4 = (
  autoPoints: number,
  teleopPoints: number,
  endgamePoints: number
) => toNonNegativeInt(autoPoints) + toNonNegativeInt(teleopPoints) + toNonNegativeInt(endgamePoints);

export const buildMatchKeyV4 = (matchType: MatchScoutingV3MatchType, matchNumber: number) =>
  buildMatchKeyV3(matchType, matchNumber);

export const isMatchScoutingV4 = (value: unknown): value is MatchScoutingV4 =>
  !!value &&
  typeof value === 'object' &&
  (value as Partial<MatchScoutingV4>).schemaVersion === 'v4' &&
  typeof (value as Partial<MatchScoutingV4>).matchKey === 'string' &&
  typeof (value as Partial<MatchScoutingV4>).teamNumber === 'string';

export const normalizeMatchScoutingV4 = (raw: Partial<MatchScoutingV4>): MatchScoutingV4 => {
  const matchType = raw.matchType || parseMatchTypeV3(raw.matchKey || initialMatchScoutingV4.matchKey);
  const matchNumber = Math.max(1, raw.matchNumber ?? parseMatchNumberV3(raw.matchKey || 'qm1'));
  const autoPoints = toNonNegativeInt(raw.autoPoints ?? 0);
  const teleopPoints = toNonNegativeInt(raw.teleopPoints ?? 0);
  const endgamePoints = toNonNegativeInt(raw.endgamePoints ?? 0);

  return {
    ...initialMatchScoutingV4,
    ...raw,
    schemaVersion: 'v4',
    eventKey: sanitizeEventKeyV3(raw.eventKey || initialMatchScoutingV4.eventKey),
    matchType,
    matchNumber,
    matchKey: (raw.matchKey || buildMatchKeyV4(matchType, matchNumber)).toLowerCase(),
    teamNumber: normalizeTeamNumber(raw.teamNumber),
    scoutName: (raw.scoutName || '').trim(),
    assignedScoutName: (raw.assignedScoutName || '').trim(),
    assignedSlot: (raw.assignedSlot || '').trim(),
    substituteScoutName: normalizeSubstituteScoutName(raw.substituteScoutName),
    alliance: normalizeAlliance(raw.alliance),
    deviceId: raw.deviceId || '',
    timestamp: raw.timestamp || Date.now(),
    editHistory: raw.editHistory || [],

    autoPoints,
    autoCycles: toNonNegativeInt(raw.autoCycles ?? 0),
    teleopPoints,
    teleopCycles: toNonNegativeInt(raw.teleopCycles ?? 0),
    endgamePoints,
    totalMatchPoints: calculateTotalMatchPointsV4(autoPoints, teleopPoints, endgamePoints),

    rolePlayed: normalizeRole(raw.rolePlayed),
    defendedTeamNumber: (raw.defendedTeamNumber || '').trim(),
    defenderFacedTeamNumber: (raw.defenderFacedTeamNumber || '').trim(),
    defenseIntensity: Number(clamp01(raw.defenseIntensity ?? 0).toFixed(4)),
    defenseDurationSeconds: toNonNegativeInt(raw.defenseDurationSeconds ?? 0),

    fouls: toNonNegativeInt(raw.fouls ?? 0),
    techFouls: toNonNegativeInt(raw.techFouls ?? 0),
    robotDied: !!raw.robotDied,
    commsLost: !!raw.commsLost,
    mechanismBroke: !!raw.mechanismBroke,
    tippedOver: !!raw.tippedOver,
    failureReason: raw.failureReason || '',
    reliabilityScore: Number(clamp01(raw.reliabilityScore ?? 1).toFixed(4)),

    notes: raw.notes || '',
    strategyNotes: raw.strategyNotes || '',

    teleopFirstShiftAlliance: normalizeAlliance(raw.teleopFirstShiftAlliance),
    shiftBreakdown: Array.isArray(raw.shiftBreakdown)
      ? raw.shiftBreakdown.map((entry, index) => normalizeShiftEntry(entry, index))
      : [],
    defenseAssignments: Array.isArray(raw.defenseAssignments)
      ? raw.defenseAssignments.map(assignment => normalizeDefenseAssignment(assignment)).filter(assignment => assignment.targetTeamNumber)
      : [],
    officialReconciliation: normalizeOfficialReconciliation(raw.officialReconciliation),
    shiftAuditFlags: Array.isArray(raw.shiftAuditFlags) ? raw.shiftAuditFlags.map(String).filter(Boolean) : []
  };
};

export const getMatchScoutingV4DocId = (record: Pick<MatchScoutingV4, 'matchKey' | 'teamNumber'>) =>
  `${record.matchKey}_${record.teamNumber}`;
