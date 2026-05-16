import {
  MatchScoutingV2,
  MatchScoutingV3,
  MatchScoutingV3Alliance,
  MatchScoutingV3CapabilityRating,
  MatchScoutingV3MatchType,
  MatchScoutingV3ShootingStyle,
  MatchScoutingV3StartingPosition,
  MatchScoutingV3SubstituteScoutName,
  initialMatchScoutingV3
} from '../types';

export const sanitizeEventKeyV3 = (value: string) => value.toUpperCase().replace(/\s+/g, '');

export const clampScore = (value: number, min = 0, max = 10) =>
  Math.min(max, Math.max(min, value));

export const roundScore = (value: number) => Number(clampScore(value).toFixed(2));

export const toNonNegativeInt = (value: number) => Math.max(0, Math.round(Number.isFinite(value) ? value : 0));

export const buildMatchKeyV3 = (matchType: MatchScoutingV3MatchType, matchNumber: number) =>
  `${matchType === 'Practice' ? 'pm' : 'qm'}${Math.max(1, matchNumber)}`;

export const parseMatchNumberV3 = (matchKey: string) => {
  const match = (matchKey || '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
};

export const parseMatchTypeV3 = (matchKey: string): MatchScoutingV3MatchType =>
  (matchKey || '').toLowerCase().startsWith('pm') ? 'Practice' : 'Qualification';

export const calculateTotalMatchPoints = (
  autoPoints: number,
  teleopPoints: number
) => toNonNegativeInt(autoPoints) + toNonNegativeInt(teleopPoints);

export const isMatchScoutingV3 = (value: unknown): value is MatchScoutingV3 =>
  !!value &&
  typeof value === 'object' &&
  (value as Partial<MatchScoutingV3>).schemaVersion === 'v3' &&
  typeof (value as Partial<MatchScoutingV3>).matchKey === 'string' &&
  typeof (value as Partial<MatchScoutingV3>).teamNumber === 'string';

const normalizeCapability = (value: unknown): MatchScoutingV3CapabilityRating =>
  value === 'Cannot' || value === 'Limited' || value === 'Strong' ? value : '';

const normalizeShootingStyle = (value: unknown): MatchScoutingV3ShootingStyle =>
  value === 'On the Fly' || value === 'Stationary' ? value : '';

const normalizeStartingPosition = (value: unknown): MatchScoutingV3StartingPosition =>
  value === 'Left' || value === 'Center' || value === 'Right' ? value : '';

const normalizeAlliance = (value: unknown): MatchScoutingV3Alliance =>
  value === 'Red' || value === 'Blue' ? value : '';

const normalizeSubstituteScoutName = (value: unknown): MatchScoutingV3SubstituteScoutName =>
  value === 'Charlotte' || value === 'Scarlett' ? value : '';

export const normalizeMatchScoutingV3 = (raw: Partial<MatchScoutingV3>): MatchScoutingV3 => {
  const matchType = raw.matchType || parseMatchTypeV3(raw.matchKey || initialMatchScoutingV3.matchKey);
  const matchNumber = Math.max(1, raw.matchNumber ?? parseMatchNumberV3(raw.matchKey || 'qm1'));
  const autoPoints = toNonNegativeInt(raw.autoPoints ?? 0);
  const teleopPoints = toNonNegativeInt(raw.teleopPoints ?? 0);

  return {
    ...initialMatchScoutingV3,
    ...raw,
    schemaVersion: 'v3',
    eventKey: sanitizeEventKeyV3(raw.eventKey || initialMatchScoutingV3.eventKey),
    matchType,
    matchNumber,
    matchKey: (raw.matchKey || buildMatchKeyV3(matchType, matchNumber)).toLowerCase(),
    teamNumber: (raw.teamNumber || '').trim(),
    scoutName: (raw.scoutName || '').trim(),
    assignedScoutName: (raw.assignedScoutName || '').trim(),
    assignedSlot: (raw.assignedSlot || '').trim(),
    substituteScoutName: normalizeSubstituteScoutName(raw.substituteScoutName),
    alliance: normalizeAlliance(raw.alliance),
    deviceId: raw.deviceId || '',
    timestamp: raw.timestamp || Date.now(),
    legacyDerived: !!raw.legacyDerived,
    editHistory: raw.editHistory || [],

    closeAccuracy: roundScore(raw.closeAccuracy ?? 0),
    middleAccuracy: roundScore(raw.middleAccuracy ?? 0),
    farAccuracy: roundScore(raw.farAccuracy ?? 0),
    contributionScore: roundScore(raw.contributionScore ?? 0),

    startingPosition: normalizeStartingPosition(raw.startingPosition),
    autoPoints,
    autoClimbed: !!raw.autoClimbed,

    teleopCycles: toNonNegativeInt(raw.teleopCycles ?? 0),
    teleopPoints,
    teleopClimbed: !!raw.teleopClimbed,

    shootingStyle: normalizeShootingStyle(raw.shootingStyle),
    climbLevel: raw.climbLevel || 'None',
    trenchPushing: normalizeCapability(raw.trenchPushing),
    passing: normalizeCapability(raw.passing),
    driverSkill: roundScore(raw.driverSkill ?? 0),
    teamwork: roundScore(raw.teamwork ?? 0),

    defenseDescription: raw.defenseDescription || '',
    generalEvaluation: raw.generalEvaluation || '',

    totalMatchPoints: calculateTotalMatchPoints(autoPoints, teleopPoints)
  };
};

export const mapLegacyMatchScoutingToV3 = (legacy: MatchScoutingV2): MatchScoutingV3 =>
  normalizeMatchScoutingV3({
    eventKey: legacy.eventKey,
    matchType: legacy.matchType,
    matchNumber: parseMatchNumberV3(legacy.matchKey),
    matchKey: legacy.matchKey,
    teamNumber: legacy.teamNumber,
    scoutName: legacy.scoutName,
    assignedScoutName: legacy.assignedScoutName,
    assignedSlot: legacy.assignedSlot,
    substituteScoutName:
      legacy.substituteScoutName === 'Charlotte' || legacy.substituteScoutName === 'Scarlett'
        ? legacy.substituteScoutName
        : '',
    alliance: legacy.alliance,
    deviceId: legacy.deviceId || '',
    timestamp: legacy.timestamp || Date.now(),
    legacyDerived: true,
    editHistory: legacy.editHistory || [],
    teleopCycles: legacy.totalCycles || 0,
    climbLevel: legacy.climbLevel,
    driverSkill: legacy.driverPressure || 0,
    defenseDescription: legacy.playedDefense
      ? [
          legacy.defenseInstances ? `Defense instances: ${legacy.defenseInstances}` : '',
          legacy.defenseDuration ? `Duration: ${legacy.defenseDuration}` : '',
          legacy.defenseEffectiveness ? `Effectiveness: ${legacy.defenseEffectiveness}/10` : ''
        ]
          .filter(Boolean)
          .join(' | ')
      : '',
    generalEvaluation: [legacy.comments || '', legacy.notes || ''].filter(Boolean).join('\n').trim()
  });

export const getMatchScoutingV3DocId = (record: Pick<MatchScoutingV3, 'matchKey' | 'teamNumber'>) =>
  `${record.matchKey}_${record.teamNumber}`;
