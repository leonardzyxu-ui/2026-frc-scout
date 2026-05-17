import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, MatchScoutingV4, PitScoutingV2 } from '../types';
import { getMatchScoutingV3DocId } from './matchScoutingV3';
import { getMatchDefenseScoutingV1DocId } from './matchDefenseScouting';
import { getMatchScoutingV4DocId } from './matchScoutingV4';
import { stableStringify } from './keys';

type WriteMode = 'strict' | 'replace';

export interface ScoutingWriteResult {
  outcome: 'created' | 'updated' | 'duplicate' | 'conflict';
  targetCollection: 'matchScouting' | 'matchScoutingV3' | 'matchScoutingV4' | 'matchScoutingDefense' | 'pitScouting';
  docId: string;
  message: string;
}

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : value ?? '');

const canonicalizeMatch = (record: MatchScoutingV2) => ({
  eventKey: normalizeString(record.eventKey),
  matchType: record.matchType,
  matchKey: normalizeString(record.matchKey),
  teamNumber: normalizeString(record.teamNumber),
  scoutName: normalizeString(record.scoutName),
  assignedScoutName: normalizeString(record.assignedScoutName),
  assignedSlot: normalizeString(record.assignedSlot),
  substituteScoutName: normalizeString(record.substituteScoutName || ''),
  alliance: record.alliance,
  playedDefense: !!record.playedDefense,
  defenseInstances: record.defenseInstances ?? 0,
  defenseDuration: normalizeString(record.defenseDuration),
  defenseEffectiveness: record.defenseEffectiveness ?? 0,
  autoFluidity: record.autoFluidity ?? 0,
  teleopFluidity: record.teleopFluidity ?? 0,
  driverPressure: record.driverPressure ?? 0,
  totalCycles: record.totalCycles ?? 0,
  mainPointContributor: !!record.mainPointContributor,
  yellowCard: !!record.yellowCard,
  yellowCardReason: normalizeString(record.yellowCardReason),
  redCard: !!record.redCard,
  redCardReason: normalizeString(record.redCardReason),
  climbLevel: record.climbLevel,
  robotDied: !!record.robotDied,
  commsLost: !!record.commsLost,
  mechanismBroke: !!record.mechanismBroke,
  tippedOver: !!record.tippedOver,
  failureReason: normalizeString(record.failureReason),
  notes: normalizeString(record.notes),
  comments: normalizeString(record.comments || '')
});

const canonicalizeMatchV3 = (record: MatchScoutingV3) => ({
  schemaVersion: 'v3',
  eventKey: normalizeString(record.eventKey),
  matchType: record.matchType,
  matchNumber: record.matchNumber ?? 0,
  matchKey: normalizeString(record.matchKey),
  teamNumber: normalizeString(record.teamNumber),
  scoutName: normalizeString(record.scoutName),
  assignedScoutName: normalizeString(record.assignedScoutName),
  assignedSlot: normalizeString(record.assignedSlot),
  substituteScoutName: normalizeString(record.substituteScoutName || ''),
  alliance: record.alliance,
  legacyDerived: !!record.legacyDerived,
  closeAccuracy: record.closeAccuracy ?? 0,
  middleAccuracy: record.middleAccuracy ?? 0,
  farAccuracy: record.farAccuracy ?? 0,
  contributionScore: record.contributionScore ?? 0,
  startingPosition: record.startingPosition,
  autoPoints: record.autoPoints ?? 0,
  autoClimbed: !!record.autoClimbed,
  teleopCycles: record.teleopCycles ?? 0,
  teleopPoints: record.teleopPoints ?? 0,
  teleopClimbed: !!record.teleopClimbed,
  shootingStyle: record.shootingStyle,
  climbLevel: record.climbLevel,
  trenchPushing: record.trenchPushing,
  passing: record.passing,
  driverSkill: record.driverSkill ?? 0,
  teamwork: record.teamwork ?? 0,
  defenseDescription: normalizeString(record.defenseDescription),
  generalEvaluation: normalizeString(record.generalEvaluation),
  totalMatchPoints: record.totalMatchPoints ?? 0
});

const canonicalizeMatchV4 = (record: MatchScoutingV4) => ({
  schemaVersion: 'v4',
  eventKey: normalizeString(record.eventKey),
  matchType: record.matchType,
  matchNumber: record.matchNumber ?? 0,
  matchKey: normalizeString(record.matchKey),
  teamNumber: normalizeString(record.teamNumber),
  scoutName: normalizeString(record.scoutName),
  assignedScoutName: normalizeString(record.assignedScoutName),
  assignedSlot: normalizeString(record.assignedSlot),
  substituteScoutName: normalizeString(record.substituteScoutName || ''),
  alliance: record.alliance,
  autoPoints: record.autoPoints ?? 0,
  autoCycles: record.autoCycles ?? 0,
  teleopPoints: record.teleopPoints ?? 0,
  teleopCycles: record.teleopCycles ?? 0,
  endgamePoints: record.endgamePoints ?? 0,
  totalMatchPoints: record.totalMatchPoints ?? 0,
  rolePlayed: record.rolePlayed,
  defendedTeamNumber: normalizeString(record.defendedTeamNumber),
  defenderFacedTeamNumber: normalizeString(record.defenderFacedTeamNumber),
  defenseIntensity: record.defenseIntensity ?? 0,
  defenseDurationSeconds: record.defenseDurationSeconds ?? 0,
  fouls: record.fouls ?? 0,
  techFouls: record.techFouls ?? 0,
  robotDied: !!record.robotDied,
  commsLost: !!record.commsLost,
  mechanismBroke: !!record.mechanismBroke,
  tippedOver: !!record.tippedOver,
  failureReason: normalizeString(record.failureReason),
  reliabilityScore: record.reliabilityScore ?? 1,
  notes: normalizeString(record.notes),
  strategyNotes: normalizeString(record.strategyNotes)
});

const canonicalizeMatchDefense = (record: MatchDefenseScoutingV1) => ({
  schemaVersion: 'defense-v1',
  eventKey: normalizeString(record.eventKey),
  matchType: record.matchType,
  matchNumber: record.matchNumber ?? 0,
  matchKey: normalizeString(record.matchKey),
  teamNumber: normalizeString(record.teamNumber),
  scoutName: normalizeString(record.scoutName),
  assignedScoutName: normalizeString(record.assignedScoutName),
  assignedSlot: normalizeString(record.assignedSlot),
  substituteScoutName: normalizeString(record.substituteScoutName || ''),
  alliance: record.alliance,
  defenseMetric: record.defenseMetric ?? 0,
  defenseComments: normalizeString(record.defenseComments),
  generalComments: normalizeString(record.generalComments)
});

const canonicalizePit = (record: PitScoutingV2) => ({
  teamNumber: normalizeString(record.teamNumber),
  teamName: normalizeString(record.teamName),
  scoutName: normalizeString(record.scoutName),
  robotBaseType: record.robotBaseType,
  isWcpBot: !!record.isWcpBot,
  isKitBot: !!record.isKitBot,
  turretCount: record.turretCount,
  customTurretCount: normalizeString(record.customTurretCount),
  canUseHopper: !!record.canUseHopper,
  hopperCapacity: record.hopperCapacity ?? 0,
  canClimbL1: !!record.canClimbL1,
  canClimbL2: !!record.canClimbL2,
  canClimbL3: !!record.canClimbL3,
  noClimbCapability: !!record.noClimbCapability,
  expectedHubBallsPerMatch: record.expectedHubBallsPerMatch ?? 0,
  expectedAutoBalls: record.expectedAutoBalls ?? 0,
  expectedTeleopBalls: record.expectedTeleopBalls ?? 0,
  ballsPerSecond: record.ballsPerSecond ?? 0,
  shootingStyle: record.shootingStyle,
  canCrossTrench: !!record.canCrossTrench,
  isBumpOnly: !!record.isBumpOnly,
  chassisSpeed: record.chassisSpeed ?? 0,
  chassisSpeedDistanceUnit: record.chassisSpeedDistanceUnit,
  chassisSpeedTimeUnit: record.chassisSpeedTimeUnit,
  shootingFlywheelCount: record.shootingFlywheelCount ?? 0,
  hoodAdjustable: !!record.hoodAdjustable,
  notes: normalizeString(record.notes)
});

const areEqual = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);

export const getMatchDocId = (record: Pick<MatchScoutingV2, 'matchKey' | 'teamNumber'>) =>
  `${record.matchKey}_${record.teamNumber}`;

export const getMatchV3DocId = (record: Pick<MatchScoutingV3, 'matchKey' | 'teamNumber'>) =>
  getMatchScoutingV3DocId(record);

export const getMatchV4DocId = (record: Pick<MatchScoutingV4, 'matchKey' | 'teamNumber'>) =>
  getMatchScoutingV4DocId(record);

export const getMatchDefenseDocId = (record: Pick<MatchDefenseScoutingV1, 'matchKey' | 'teamNumber'>) =>
  getMatchDefenseScoutingV1DocId(record);

export const getPitDocId = (record: Pick<PitScoutingV2, 'teamNumber'>) =>
  record.teamNumber;

export async function writeMatchScoutingRecord(
  record: MatchScoutingV2,
  options?: { mode?: WriteMode }
): Promise<ScoutingWriteResult> {
  const mode = options?.mode || 'strict';
  const docId = getMatchDocId(record);
  const targetRef = doc(db, 'events', record.eventKey, 'matchScouting', docId);
  const existing = await getDoc(targetRef);

  if (!existing.exists()) {
    await setDoc(targetRef, record);
    return {
      outcome: 'created',
      targetCollection: 'matchScouting',
      docId,
      message: `Saved match record to matchScouting/${docId}.`
    };
  }

  const existingRecord = existing.data() as MatchScoutingV2;
  if (areEqual(canonicalizeMatch(existingRecord), canonicalizeMatch(record))) {
    return {
      outcome: 'duplicate',
      targetCollection: 'matchScouting',
      docId,
      message: `Duplicate match record already exists at matchScouting/${docId}.`
    };
  }

  if (mode === 'replace') {
    await setDoc(targetRef, record);
    return {
      outcome: 'updated',
      targetCollection: 'matchScouting',
      docId,
      message: `Updated match record at matchScouting/${docId}.`
    };
  }

  return {
    outcome: 'conflict',
    targetCollection: 'matchScouting',
    docId,
    message: `Conflicting match record already exists at matchScouting/${docId}.`
  };
}

export async function writeMatchScoutingV3Record(
  record: MatchScoutingV3,
  options?: { mode?: WriteMode }
): Promise<ScoutingWriteResult> {
  const mode = options?.mode || 'strict';
  const docId = getMatchV3DocId(record);
  const targetRef = doc(db, 'events', record.eventKey, 'matchScoutingV3', docId);
  const existing = await getDoc(targetRef);

  if (!existing.exists()) {
    await setDoc(targetRef, record);
    return {
      outcome: 'created',
      targetCollection: 'matchScoutingV3',
      docId,
      message: `Saved match record to matchScoutingV3/${docId}.`
    };
  }

  const existingRecord = existing.data() as MatchScoutingV3;
  if (areEqual(canonicalizeMatchV3(existingRecord), canonicalizeMatchV3(record))) {
    return {
      outcome: 'duplicate',
      targetCollection: 'matchScoutingV3',
      docId,
      message: `Duplicate match record already exists at matchScoutingV3/${docId}.`
    };
  }

  if (mode === 'replace') {
    await setDoc(targetRef, record);
    return {
      outcome: 'updated',
      targetCollection: 'matchScoutingV3',
      docId,
      message: `Updated match record at matchScoutingV3/${docId}.`
    };
  }

  return {
    outcome: 'conflict',
    targetCollection: 'matchScoutingV3',
    docId,
    message: `Conflicting match record already exists at matchScoutingV3/${docId}.`
  };
}

export async function writeMatchScoutingV4Record(
  record: MatchScoutingV4,
  options?: { mode?: WriteMode }
): Promise<ScoutingWriteResult> {
  const mode = options?.mode || 'strict';
  const docId = getMatchV4DocId(record);
  const targetRef = doc(db, 'events', record.eventKey, 'matchScoutingV4', docId);
  const existing = await getDoc(targetRef);

  if (!existing.exists()) {
    await setDoc(targetRef, record);
    return {
      outcome: 'created',
      targetCollection: 'matchScoutingV4',
      docId,
      message: `Saved match record to matchScoutingV4/${docId}.`
    };
  }

  const existingRecord = existing.data() as MatchScoutingV4;
  if (areEqual(canonicalizeMatchV4(existingRecord), canonicalizeMatchV4(record))) {
    return {
      outcome: 'duplicate',
      targetCollection: 'matchScoutingV4',
      docId,
      message: `Duplicate match record already exists at matchScoutingV4/${docId}.`
    };
  }

  if (mode === 'replace') {
    await setDoc(targetRef, record);
    return {
      outcome: 'updated',
      targetCollection: 'matchScoutingV4',
      docId,
      message: `Updated match record at matchScoutingV4/${docId}.`
    };
  }

  return {
    outcome: 'conflict',
    targetCollection: 'matchScoutingV4',
    docId,
    message: `Conflicting match record already exists at matchScoutingV4/${docId}.`
  };
}

export async function writeMatchDefenseScoutingRecord(
  record: MatchDefenseScoutingV1,
  options?: { mode?: WriteMode }
): Promise<ScoutingWriteResult> {
  const mode = options?.mode || 'strict';
  const docId = getMatchDefenseDocId(record);
  const targetRef = doc(db, 'events', record.eventKey, 'matchScoutingDefense', docId);
  const existing = await getDoc(targetRef);

  if (!existing.exists()) {
    await setDoc(targetRef, record);
    return {
      outcome: 'created',
      targetCollection: 'matchScoutingDefense',
      docId,
      message: `Saved defense record to matchScoutingDefense/${docId}.`
    };
  }

  const existingRecord = existing.data() as MatchDefenseScoutingV1;
  if (areEqual(canonicalizeMatchDefense(existingRecord), canonicalizeMatchDefense(record))) {
    return {
      outcome: 'duplicate',
      targetCollection: 'matchScoutingDefense',
      docId,
      message: `Duplicate defense record already exists at matchScoutingDefense/${docId}.`
    };
  }

  if (mode === 'replace') {
    await setDoc(targetRef, record);
    return {
      outcome: 'updated',
      targetCollection: 'matchScoutingDefense',
      docId,
      message: `Updated defense record at matchScoutingDefense/${docId}.`
    };
  }

  return {
    outcome: 'conflict',
    targetCollection: 'matchScoutingDefense',
    docId,
    message: `Conflicting defense record already exists at matchScoutingDefense/${docId}.`
  };
}

export async function writePitScoutingRecord(
  eventKey: string,
  record: PitScoutingV2,
  options?: { mode?: WriteMode }
): Promise<ScoutingWriteResult> {
  const mode = options?.mode || 'strict';
  const docId = getPitDocId(record);
  const targetRef = doc(db, 'events', eventKey, 'pitScouting', docId);
  const existing = await getDoc(targetRef);

  if (!existing.exists()) {
    await setDoc(targetRef, record);
    return {
      outcome: 'created',
      targetCollection: 'pitScouting',
      docId,
      message: `Saved pit record to pitScouting/${docId}.`
    };
  }

  const existingRecord = existing.data() as PitScoutingV2;
  if (areEqual(canonicalizePit(existingRecord), canonicalizePit(record))) {
    return {
      outcome: 'duplicate',
      targetCollection: 'pitScouting',
      docId,
      message: `Duplicate pit record already exists at pitScouting/${docId}.`
    };
  }

  if (mode === 'replace') {
    await setDoc(targetRef, record);
    return {
      outcome: 'updated',
      targetCollection: 'pitScouting',
      docId,
      message: `Updated pit record at pitScouting/${docId}.`
    };
  }

  return {
    outcome: 'conflict',
    targetCollection: 'pitScouting',
    docId,
    message: `Conflicting pit record already exists at pitScouting/${docId}.`
  };
}
