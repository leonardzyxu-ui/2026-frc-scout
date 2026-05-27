import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, MatchScoutingV4, PitScoutingV2 } from '../types';
import { calculateTotalMatchPoints, mapLegacyMatchScoutingToV3, normalizeMatchScoutingV3 } from './matchScoutingV3';
import { normalizeMatchDefenseScoutingV1 } from './matchDefenseScouting';
import { normalizeMatchScoutingV4 } from './matchScoutingV4';

export interface PitQrExportPayload {
  eventKey: string;
  data: PitScoutingV2;
}

export type ScoutingImportRecord =
  | { recordType: 'match'; data: MatchScoutingV3 }
  | { recordType: 'matchV4'; data: MatchScoutingV4 }
  | { recordType: 'matchDefense'; data: MatchDefenseScoutingV1 }
  | { recordType: 'pit'; eventKey: string; data: PitScoutingV2 };

export const compressMatchData = (data: MatchScoutingV2): string => {
  const arr = [
    data.eventKey,
    data.matchType,
    data.matchKey,
    data.teamNumber,
    data.scoutName,
    data.assignedScoutName,
    data.assignedSlot,
    data.substituteScoutName || '',
    data.alliance,
    data.deviceId || '',
    data.playedDefense ? 1 : 0,
    data.defenseInstances,
    data.defenseDuration,
    data.defenseEffectiveness,
    data.autoFluidity,
    data.teleopFluidity,
    data.driverPressure,
    data.totalCycles,
    data.mainPointContributor ? 1 : 0,
    data.yellowCard ? 1 : 0,
    data.yellowCardReason,
    data.redCard ? 1 : 0,
    data.redCardReason,
    data.robotDied ? 1 : 0,
    data.commsLost ? 1 : 0,
    data.mechanismBroke ? 1 : 0,
    data.failureReason,
    data.notes,
    data.climbLevel,
    data.tippedOver ? 1 : 0,
    data.comments || ''
  ];
  return 'V6|' + JSON.stringify(arr);
};

export const compressMatchDataV3 = (data: MatchScoutingV3): string => {
  const payload = {
    schemaVersion: 'v3',
    eventKey: data.eventKey,
    matchType: data.matchType,
    matchNumber: data.matchNumber,
    matchKey: data.matchKey,
    teamNumber: data.teamNumber,
    scoutName: data.scoutName,
    assignedScoutName: data.assignedScoutName,
    assignedSlot: data.assignedSlot,
    substituteScoutName: data.substituteScoutName || '',
    alliance: data.alliance,
    deviceId: data.deviceId || '',
    timestamp: data.timestamp || Date.now(),
    legacyDerived: !!data.legacyDerived,
    closeAccuracy: data.closeAccuracy,
    middleAccuracy: data.middleAccuracy,
    farAccuracy: data.farAccuracy,
    contributionScore: data.contributionScore,
    startingPosition: data.startingPosition,
    autoPoints: data.autoPoints,
    autoClimbed: data.autoClimbed ? 1 : 0,
    teleopCycles: data.teleopCycles,
    teleopPoints: data.teleopPoints,
    teleopClimbed: data.teleopClimbed ? 1 : 0,
    shootingStyle: data.shootingStyle,
    climbLevel: data.climbLevel,
    trenchPushing: data.trenchPushing,
    passing: data.passing,
    driverSkill: data.driverSkill,
    teamwork: data.teamwork,
    defenseDescription: data.defenseDescription,
    generalEvaluation: data.generalEvaluation,
    totalMatchPoints: data.totalMatchPoints
  };

  return `V7|${JSON.stringify(payload)}`;
};

export const compressMatchDataV4 = (data: MatchScoutingV4): string => {
  const payload = normalizeMatchScoutingV4({
    ...data,
    timestamp: data.timestamp || Date.now()
  });

  return `V8|${JSON.stringify(payload)}`;
};

export const compressPitData = (payload: PitQrExportPayload): string => {
  const { eventKey, data } = payload;
  const arr = [
    eventKey,
    data.teamNumber,
    data.teamName,
    data.scoutName,
    data.robotBaseType,
    data.isWcpBot ? 1 : 0,
    data.isKitBot ? 1 : 0,
    data.turretCount,
    data.customTurretCount,
    data.canUseHopper ? 1 : 0,
    data.hopperCapacity,
    data.canClimbL1 ? 1 : 0,
    data.canClimbL2 ? 1 : 0,
    data.canClimbL3 ? 1 : 0,
    data.noClimbCapability ? 1 : 0,
    data.expectedHubBallsPerMatch,
    data.expectedAutoBalls,
    data.expectedTeleopBalls,
    data.ballsPerSecond,
    data.shootingStyle,
    data.canCrossTrench ? 1 : 0,
    data.isBumpOnly ? 1 : 0,
    data.chassisSpeed,
    data.chassisSpeedDistanceUnit,
    data.chassisSpeedTimeUnit,
    data.shootingFlywheelCount,
    data.hoodAdjustable ? 1 : 0,
    data.notes,
    data.deviceId || '',
    data.timestamp || 0,
    data.adminTask || null
  ];

  return 'P1|' + JSON.stringify(arr);
};

export const compressMatchDefenseData = (data: MatchDefenseScoutingV1): string => {
  const payload = {
    schemaVersion: 'defense-v1',
    eventKey: data.eventKey,
    matchType: data.matchType,
    matchNumber: data.matchNumber,
    matchKey: data.matchKey,
    teamNumber: data.teamNumber,
    scoutName: data.scoutName,
    assignedScoutName: data.assignedScoutName,
    assignedSlot: data.assignedSlot,
    substituteScoutName: data.substituteScoutName || '',
    alliance: data.alliance,
    deviceId: data.deviceId || '',
    timestamp: data.timestamp || Date.now(),
    defenseMetric: data.defenseMetric,
    defenseComments: data.defenseComments,
    generalComments: data.generalComments,
    adminTask: data.adminTask
  };

  return `D1|${JSON.stringify(payload)}`;
};

export const decompressMatchData = (str: string): MatchScoutingV3 | null => {
  const parsed = decompressScoutingData(str);
  return parsed?.recordType === 'match' ? parsed.data : null;
};

function parseModernMatchPayloadV3(str: string): MatchScoutingV3 {
  const payload = JSON.parse(str.substring(3)) as Partial<MatchScoutingV3> & {
    autoClimbed?: number | boolean;
    teleopClimbed?: number | boolean;
  };

  return normalizeMatchScoutingV3({
    ...payload,
    autoClimbed: !!payload.autoClimbed,
    teleopClimbed: !!payload.teleopClimbed,
    totalMatchPoints: calculateTotalMatchPoints(payload.autoPoints || 0, payload.teleopPoints || 0)
  });
}

function parseModernMatchPayloadV4(str: string): MatchScoutingV4 {
  const payload = JSON.parse(str.substring(3)) as Partial<MatchScoutingV4>;
  return normalizeMatchScoutingV4(payload);
}

function parseMatchDefensePayloadV1(str: string): MatchDefenseScoutingV1 {
  const payload = JSON.parse(str.substring(3)) as Partial<MatchDefenseScoutingV1>;
  return normalizeMatchDefenseScoutingV1(payload);
}

function parseModernMatchPayload(str: string): MatchScoutingV2 {
  const arr = JSON.parse(str.substring(3));
  return {
    eventKey: arr[0],
    matchType: arr[1] || 'Qualification',
    matchKey: arr[2],
    teamNumber: arr[3],
    scoutName: arr[4],
    assignedScoutName: arr[5] || arr[4] || '',
    assignedSlot: arr[6] || '',
    substituteScoutName: arr[7] || '',
    alliance: arr[8],
    deviceId: arr[9],
    playedDefense: !!arr[10],
    defenseInstances: arr[11],
    defenseDuration: arr[12],
    defenseEffectiveness: arr[13],
    autoFluidity: arr[14],
    teleopFluidity: arr[15],
    driverPressure: arr[16],
    totalCycles: arr[17] || 0,
    mainPointContributor: !!arr[18],
    yellowCard: !!arr[19],
    yellowCardReason: arr[20] || '',
    redCard: !!arr[21],
    redCardReason: arr[22] || '',
    robotDied: !!arr[23],
    commsLost: !!arr[24],
    mechanismBroke: !!arr[25],
    failureReason: arr[26],
    notes: arr[27],
    climbLevel: arr[28] || 'None',
    tippedOver: !!arr[29],
    comments: arr[30] || '',
    timestamp: Date.now()
  };
}

function parseLegacyV5MatchPayload(str: string): MatchScoutingV2 {
  const arr = JSON.parse(str.substring(3));
  const legacyCardStatus = arr[19] || 'None';
  return {
    eventKey: arr[0],
    matchType: arr[1] || 'Qualification',
    matchKey: arr[2],
    teamNumber: arr[3],
    scoutName: arr[4],
    assignedScoutName: arr[5] || arr[4] || '',
    assignedSlot: arr[6] || '',
    substituteScoutName: arr[7] || '',
    alliance: arr[8],
    deviceId: arr[9],
    playedDefense: !!arr[10],
    defenseInstances: arr[11],
    defenseDuration: arr[12],
    defenseEffectiveness: arr[13],
    autoFluidity: arr[14],
    teleopFluidity: arr[15],
    driverPressure: arr[16],
    totalCycles: arr[17] || 0,
    mainPointContributor: !!arr[18],
    yellowCard: legacyCardStatus === 'Yellow' || legacyCardStatus === 'Both',
    yellowCardReason: '',
    redCard: legacyCardStatus === 'Red' || legacyCardStatus === 'Both',
    redCardReason: '',
    robotDied: !!arr[20],
    commsLost: !!arr[21],
    mechanismBroke: !!arr[22],
    failureReason: arr[23],
    notes: arr[24],
    climbLevel: arr[25] || 'None',
    tippedOver: !!arr[26],
    comments: arr[27] || '',
    timestamp: Date.now()
  };
}

function parseLegacyV4MatchPayload(str: string): MatchScoutingV2 {
  const arr = JSON.parse(str.substring(3));
  return {
    eventKey: arr[0],
    matchType: 'Qualification',
    matchKey: arr[1],
    teamNumber: arr[2],
    scoutName: arr[3],
    assignedScoutName: arr[3] || '',
    assignedSlot: '',
    substituteScoutName: '',
    alliance: arr[4],
    deviceId: arr[5],
    playedDefense: !!arr[6],
    defenseInstances: arr[7],
    defenseDuration: arr[8],
    defenseEffectiveness: arr[9],
    autoFluidity: arr[10],
    teleopFluidity: arr[11],
    driverPressure: arr[12],
    totalCycles: 0,
    mainPointContributor: false,
    yellowCard: false,
    yellowCardReason: '',
    redCard: false,
    redCardReason: '',
    robotDied: !!arr[13],
    commsLost: !!arr[14],
    mechanismBroke: !!arr[15],
    failureReason: arr[16],
    notes: arr[17],
    climbLevel: arr[18] || 'None',
    tippedOver: !!arr[19],
    comments: '',
    timestamp: Date.now()
  };
}

function parsePitPayload(str: string): ScoutingImportRecord {
  const arr = JSON.parse(str.substring(3));
  return {
    recordType: 'pit',
    eventKey: arr[0],
    data: {
      teamNumber: arr[1],
      teamName: arr[2],
      scoutName: arr[3] || '',
      robotBaseType: arr[4] || '',
      isWcpBot: !!arr[5],
      isKitBot: !!arr[6],
      turretCount: arr[7] || '',
      customTurretCount: arr[8] || '',
      canUseHopper: !!arr[9],
      hopperCapacity: arr[10] || 0,
      canClimbL1: !!arr[11],
      canClimbL2: !!arr[12],
      canClimbL3: !!arr[13],
      noClimbCapability: !!arr[14],
      expectedHubBallsPerMatch: arr[15] || 0,
      expectedAutoBalls: arr[16] || 0,
      expectedTeleopBalls: arr[17] || 0,
      ballsPerSecond: arr[18] || 0,
      shootingStyle: arr[19] || '',
      canCrossTrench: !!arr[20],
      isBumpOnly: !!arr[21],
      chassisSpeed: arr[22] || 0,
      chassisSpeedDistanceUnit: arr[23] || '',
      chassisSpeedTimeUnit: arr[24] || '',
      shootingFlywheelCount: arr[25] || 0,
      hoodAdjustable: !!arr[26],
      notes: arr[27] || '',
      deviceId: arr[28] || '',
      timestamp: arr[29] || Date.now(),
      adminTask: arr[30] || undefined
    }
  };
}

export const decompressScoutingData = (str: string): ScoutingImportRecord | null => {
  if (!str.startsWith('P1|') && !str.startsWith('D1|') && !str.startsWith('V8|') && !str.startsWith('V7|') && !str.startsWith('V6|') && !str.startsWith('V5|') && !str.startsWith('V4|')) {
    return null;
  }

  try {
    if (str.startsWith('P1|')) {
      return parsePitPayload(str);
    }

    if (str.startsWith('D1|')) {
      return { recordType: 'matchDefense', data: parseMatchDefensePayloadV1(str) };
    }

    if (str.startsWith('V8|')) {
      return { recordType: 'matchV4', data: parseModernMatchPayloadV4(str) };
    }

    if (str.startsWith('V7|')) {
      return { recordType: 'match', data: parseModernMatchPayloadV3(str) };
    }

    if (str.startsWith('V6|')) {
      return { recordType: 'match', data: mapLegacyMatchScoutingToV3(parseModernMatchPayload(str)) };
    }

    if (str.startsWith('V5|')) {
      return { recordType: 'match', data: mapLegacyMatchScoutingToV3(parseLegacyV5MatchPayload(str)) };
    }

    return { recordType: 'match', data: mapLegacyMatchScoutingToV3(parseLegacyV4MatchPayload(str)) };
  } catch (error) {
    console.error('Failed to parse QR data', error);
    return null;
  }
};
