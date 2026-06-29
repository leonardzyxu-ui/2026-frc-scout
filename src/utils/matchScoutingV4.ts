import { initialMatchScoutingV4 } from '../types.ts';
import type {
  MatchScoutingV3Alliance,
  MatchScoutingV3MatchType,
  MatchScoutingV4,
  MatchScoutingV4DefenseAssignment,
  PowerCoinMatchBetSnapshot,
  MatchScoutingV4Role,
  MatchScoutingV4ScoreAction,
  MatchScoutingV4ShiftAction,
  MatchScoutingV4ShiftEntry,
  MatchScoutingV4ShiftOwner,
  MatchScoutingV4ShiftRole,
  MatchScoutingV4SubstituteScoutName
} from '../types.ts';
import { buildMatchKeyV3, parseMatchNumberV3, parseMatchTypeV3, sanitizeEventKeyV3, toNonNegativeInt } from './matchScoutingV3.ts';
import { normalizeTeamNumber } from './keys.ts';
import { deriveShiftActionCredits } from './shiftActionWeights.ts';
import type { ShiftActionCreditWeights } from './shiftActionWeights.ts';

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

const toPositiveIntOrNull = (value: unknown) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 99 ? number : null;
};

const normalizeAlliance = (value: unknown): MatchScoutingV3Alliance =>
  value === 'Red' || value === 'Blue' ? value : '';

const normalizeSubstituteScoutName = (value: unknown): MatchScoutingV4SubstituteScoutName =>
  value === 'Substitute 1' || value === 'Substitute 2' || value === 'Substitute 3' ? value : '';

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

const SHIFT_ACTIONS: MatchScoutingV4ShiftAction[] = ['offense', 'defense', 'stockpile'];

const normalizeShiftActions = (raw: Partial<MatchScoutingV4ShiftEntry> = {}): MatchScoutingV4ShiftAction[] => {
  const directActions = Array.isArray(raw.actions)
    ? raw.actions.filter((action): action is MatchScoutingV4ShiftAction => SHIFT_ACTIONS.includes(action as MatchScoutingV4ShiftAction))
    : [];
  if (directActions.length) return Array.from(new Set(directActions));

  const legacyRole = normalizeShiftRole(raw.role);
  if (legacyRole === 'offense') return ['offense'];
  if (legacyRole === 'defense') return ['defense'];
  if (legacyRole === 'stockpile') return ['stockpile'];
  if (legacyRole === 'mixed') return ['defense', 'stockpile'];
  return [];
};

const deriveShiftRole = (actions: MatchScoutingV4ShiftAction[]): MatchScoutingV4ShiftRole => {
  if (actions.includes('offense') && actions.includes('defense')) return 'mixed';
  if (actions.includes('offense')) return 'offense';
  if (actions.includes('defense') && actions.includes('stockpile')) return 'mixed';
  if (actions.includes('defense')) return 'defense';
  if (actions.includes('stockpile')) return 'stockpile';
  return 'inactive';
};

export interface NormalizeMatchScoutingV4Options {
  shiftActionCreditWeights?: Partial<ShiftActionCreditWeights>;
}

const deriveStockpileShiftCredit = (
  actions: MatchScoutingV4ShiftAction[],
  rawValue: unknown,
  weights: Partial<ShiftActionCreditWeights> = {}
) => {
  if (Number.isFinite(rawValue)) return Math.max(0, Number(rawValue));
  return deriveShiftActionCredits(actions, weights).stockpileShiftCredit;
};

const deriveDefenseShiftCredit = (
  actions: MatchScoutingV4ShiftAction[],
  rawValue: unknown,
  weights: Partial<ShiftActionCreditWeights> = {}
) => {
  if (Number.isFinite(rawValue)) return Math.max(0, Number(rawValue));
  return deriveShiftActionCredits(actions, weights).defenseShiftCredit;
};

const normalizeDefenseAssignment = (raw: Partial<MatchScoutingV4DefenseAssignment> = {}): MatchScoutingV4DefenseAssignment => ({
  targetTeamNumber: normalizeTeamNumber(raw.targetTeamNumber),
  claimedSharePercent: Math.max(0, Math.min(100, Number.isFinite(raw.claimedSharePercent) ? Number(raw.claimedSharePercent) : 0)),
  normalizedSharePercent: raw.normalizedSharePercent == null
    ? undefined
    : Math.max(0, Math.min(100, Number.isFinite(raw.normalizedSharePercent) ? Number(raw.normalizedSharePercent) : 0)),
  notes: raw.notes || ''
});

const normalizeScoreAction = (raw: Partial<MatchScoutingV4ScoreAction> = {}): MatchScoutingV4ScoreAction | null => {
  const delta = Number(raw.delta);
  if (delta !== 1 && delta !== 3 && delta !== 5 && delta !== 10) return null;
  return {
    delta,
    at: raw.at && Number.isFinite(raw.at) ? Number(raw.at) : Date.now()
  };
};

const normalizeShiftEntry = (
  raw: Partial<MatchScoutingV4ShiftEntry> = {},
  fallbackIndex: number,
  options: NormalizeMatchScoutingV4Options = {}
): MatchScoutingV4ShiftEntry => {
  const actions = normalizeShiftActions(raw);
  const role = deriveShiftRole(actions);
  const weights = options.shiftActionCreditWeights ?? {};
  return {
    id: raw.id || `shift-${fallbackIndex + 1}`,
    index: toNonNegativeInt(raw.index ?? fallbackIndex),
    shiftAlliance: normalizeAlliance(raw.shiftAlliance),
    owner: normalizeShiftOwner(raw.owner),
    role,
    actions,
    ballsScored: actions.includes('offense') ? toNonNegativeInt(raw.ballsScored ?? 0) : 0,
    scoreActions: actions.includes('offense') && Array.isArray(raw.scoreActions)
      ? raw.scoreActions.map(action => normalizeScoreAction(action)).filter((action): action is MatchScoutingV4ScoreAction => Boolean(action))
      : [],
    stockpileShiftCredit: deriveStockpileShiftCredit(actions, raw.stockpileShiftCredit, weights),
    defenseShiftCredit: deriveDefenseShiftCredit(actions, raw.defenseShiftCredit, weights),
    defendedTeams: actions.includes('defense') && Array.isArray(raw.defendedTeams)
      ? raw.defendedTeams.map(assignment => normalizeDefenseAssignment(assignment)).filter(assignment => assignment.targetTeamNumber)
      : [],
    notes: raw.notes || '',
    status: raw.status === 'submitted' ? 'submitted' : 'draft',
    submittedAt: raw.submittedAt && Number.isFinite(raw.submittedAt) ? Number(raw.submittedAt) : undefined
  };
};

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

const normalizePowerCoinBetSide = (value: unknown) =>
  value === 'Red' || value === 'Blue' ? value : '';

const normalizePowerCoinBetSendStatus = (value: unknown) =>
  value === 'pending' || value === 'sent' || value === 'failed' || value === 'not_attempted'
    ? value
    : 'not_attempted';

const normalizePowerCoinBetLockReason = (value: unknown) =>
  value === 'start_game' || value === 'gameplay_action' || value === 'submit' || value === 'manual'
    ? value
    : undefined;

const normalizePowerCoinBet = (
  raw: Partial<PowerCoinMatchBetSnapshot> | undefined,
  fallback: Pick<MatchScoutingV4, 'eventKey' | 'matchKey' | 'matchNumber' | 'matchType' | 'scoutName' | 'scoutNumber'>
): PowerCoinMatchBetSnapshot | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const side = normalizePowerCoinBetSide(raw.side);
  const amount = toNonNegativeInt(raw.amount ?? 0);
  const placedAt = raw.placedAt && Number.isFinite(raw.placedAt) ? Number(raw.placedAt) : Date.now();
  const id = raw.id || `${fallback.eventKey}_${fallback.matchKey}_scout_${fallback.scoutNumber || fallback.scoutName || 'unknown'}_bet`;
  return {
    id,
    eventKey: sanitizeEventKeyV3(fallback.eventKey),
    matchKey: String(fallback.matchKey || '').toLowerCase(),
    matchNumber: Math.max(1, toNonNegativeInt(fallback.matchNumber)),
    matchType: fallback.matchType,
    scoutName: (raw.scoutName || fallback.scoutName || '').trim(),
    scoutNumber: toPositiveIntOrNull(raw.scoutNumber) ?? toPositiveIntOrNull(fallback.scoutNumber),
    side,
    amount,
    placedAt,
    lockedAt: raw.lockedAt && Number.isFinite(raw.lockedAt) ? Number(raw.lockedAt) : null,
    lockReason: normalizePowerCoinBetLockReason(raw.lockReason),
    secureMode: !!raw.secureMode,
    directSendStatus: normalizePowerCoinBetSendStatus(raw.directSendStatus),
    directSendError: raw.directSendError || '',
    disqualified: !!raw.disqualified
  };
};

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

export const normalizeMatchScoutingV4 = (
  raw: Partial<MatchScoutingV4>,
  options: NormalizeMatchScoutingV4Options = {}
): MatchScoutingV4 => {
  const matchType = raw.matchType || parseMatchTypeV3(raw.matchKey || initialMatchScoutingV4.matchKey);
  const matchNumber = Math.max(1, raw.matchNumber ?? parseMatchNumberV3(raw.matchKey || 'qm1'));
  const autoPoints = toNonNegativeInt(raw.autoPoints ?? 0);
  const shiftBreakdown = Array.isArray(raw.shiftBreakdown)
    ? raw.shiftBreakdown.map((entry, index) => normalizeShiftEntry(entry, index, options))
    : [];
  const shiftTeleopPoints = shiftBreakdown.reduce((sum, entry) => sum + toNonNegativeInt(entry.ballsScored), 0);
  const teleopPoints = toNonNegativeInt(raw.teleopPoints ?? shiftTeleopPoints);
  const endgamePoints = toNonNegativeInt(raw.endgamePoints ?? 0);
  const logicalId = `${(raw.matchKey || buildMatchKeyV4(matchType, matchNumber)).toLowerCase()}_${normalizeTeamNumber(raw.teamNumber) || 'team'}`;
  const normalizedMatchKey = (raw.matchKey || buildMatchKeyV4(matchType, matchNumber)).toLowerCase();
  const normalizedScoutNumber = toPositiveIntOrNull(raw.scoutNumber);
  const normalizedScoutName = (raw.scoutName || '').trim();
  const versionMetadata = raw.versionMetadata
    ? {
        logicalId: raw.versionMetadata.logicalId || logicalId,
        version: Math.max(1, toNonNegativeInt(raw.versionMetadata.version || 1)),
        parentVersion: raw.versionMetadata.parentVersion == null ? null : Math.max(1, toNonNegativeInt(raw.versionMetadata.parentVersion)),
        currentVersionSubmitted: !!raw.versionMetadata.currentVersionSubmitted,
        submissionNumber: raw.versionMetadata.currentVersionSubmitted || raw.versionMetadata.submissionNumber === 1 ? 1 as const : 0 as const,
        submittedAt: raw.versionMetadata.submittedAt && Number.isFinite(raw.versionMetadata.submittedAt)
          ? Number(raw.versionMetadata.submittedAt)
          : null,
        editedAt: raw.versionMetadata.editedAt && Number.isFinite(raw.versionMetadata.editedAt) ? Number(raw.versionMetadata.editedAt) : Date.now(),
        editedByName: (raw.versionMetadata.editedByName || raw.scoutName || '').trim(),
        editedByScoutNumber: toPositiveIntOrNull(raw.versionMetadata.editedByScoutNumber),
        editedBySurface: raw.versionMetadata.editedBySurface === 'admin' ? 'admin' as const : 'scout' as const
      }
    : undefined;

  return {
    ...initialMatchScoutingV4,
    ...raw,
    schemaVersion: 'v4',
    eventKey: sanitizeEventKeyV3(raw.eventKey || initialMatchScoutingV4.eventKey),
    matchType,
    matchNumber,
    matchKey: normalizedMatchKey,
    teamNumber: normalizeTeamNumber(raw.teamNumber),
    scoutName: normalizedScoutName,
    scoutNumber: normalizedScoutNumber,
    assignedScoutName: (raw.assignedScoutName || '').trim(),
    assignedSlot: (raw.assignedSlot || '').trim(),
    substituteScoutName: normalizeSubstituteScoutName(raw.substituteScoutName),
    alliance: normalizeAlliance(raw.alliance),
    deviceId: raw.deviceId || '',
    timestamp: raw.timestamp || Date.now(),
    editHistory: raw.editHistory || [],

    autoPoints,
    autoCycles: 0,
    teleopPoints,
    teleopCycles: 0,
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

    versionMetadata,
    teleopFirstShiftAlliance: normalizeAlliance(raw.teleopFirstShiftAlliance) || 'Red',
    shiftBreakdown,
    defenseAssignments: Array.isArray(raw.defenseAssignments)
      ? raw.defenseAssignments.map(assignment => normalizeDefenseAssignment(assignment)).filter(assignment => assignment.targetTeamNumber)
      : [],
    officialReconciliation: normalizeOfficialReconciliation(raw.officialReconciliation),
    shiftAuditFlags: Array.isArray(raw.shiftAuditFlags) ? raw.shiftAuditFlags.map(String).filter(Boolean) : [],
    powerCoinBet: normalizePowerCoinBet(raw.powerCoinBet, {
      eventKey: sanitizeEventKeyV3(raw.eventKey || initialMatchScoutingV4.eventKey),
      matchType,
      matchNumber,
      matchKey: normalizedMatchKey,
      scoutName: normalizedScoutName,
      scoutNumber: normalizedScoutNumber
    })
  };
};

export const getMatchScoutingV4DocId = (record: Pick<MatchScoutingV4, 'matchKey' | 'teamNumber'>) =>
  `${record.matchKey}_${record.teamNumber}`;
