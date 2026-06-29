import type {
  MatchDefenseScoutingV1,
  MatchScoutingV3Alliance,
  MatchScoutingV3MatchType
} from '../types.ts';
import {
  initialMatchDefenseScoutingV1
} from '../types.ts';
import { buildMatchKeyV3, parseMatchNumberV3, parseMatchTypeV3, sanitizeEventKeyV3 } from './matchScoutingV3.ts';

const normalizeAlliance = (value: unknown): MatchScoutingV3Alliance =>
  value === 'Red' || value === 'Blue' ? value : '';

const normalizeSubstituteScoutName = (value: unknown): MatchDefenseScoutingV1['substituteScoutName'] =>
  value === 'Substitute 1' || value === 'Substitute 2' || value === 'Substitute 3' ? value : '';

const clampDefenseMetric = (value: number) => {
  const numeric = Number.isFinite(value) ? value : 0;
  return Math.min(1, Math.max(0, Number(numeric.toFixed(4))));
};

export const isMatchDefenseScoutingV1 = (value: unknown): value is MatchDefenseScoutingV1 =>
  !!value &&
  typeof value === 'object' &&
  (value as Partial<MatchDefenseScoutingV1>).schemaVersion === 'defense-v1' &&
  typeof (value as Partial<MatchDefenseScoutingV1>).matchKey === 'string' &&
  typeof (value as Partial<MatchDefenseScoutingV1>).teamNumber === 'string';

export const normalizeMatchDefenseScoutingV1 = (
  raw: Partial<MatchDefenseScoutingV1>
): MatchDefenseScoutingV1 => {
  const matchType: MatchScoutingV3MatchType =
    raw.matchType || parseMatchTypeV3(raw.matchKey || initialMatchDefenseScoutingV1.matchKey);
  const matchNumber = Math.max(1, raw.matchNumber ?? parseMatchNumberV3(raw.matchKey || 'qm1'));

  return {
    ...initialMatchDefenseScoutingV1,
    ...raw,
    schemaVersion: 'defense-v1',
    eventKey: sanitizeEventKeyV3(raw.eventKey || initialMatchDefenseScoutingV1.eventKey),
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
    defenseMetric: clampDefenseMetric(raw.defenseMetric ?? initialMatchDefenseScoutingV1.defenseMetric),
    defenseComments: raw.defenseComments || '',
    generalComments: raw.generalComments || ''
  };
};

export const getMatchDefenseScoutingV1DocId = (
  record: Pick<MatchDefenseScoutingV1, 'matchKey' | 'teamNumber'>
) => `${record.matchKey}_${record.teamNumber}`;
