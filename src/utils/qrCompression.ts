import { MatchScoutingV2 } from '../types';

export const compressMatchData = (data: MatchScoutingV2): string => {
  const arr = [
    data.eventKey,
    data.matchKey,
    data.teamNumber,
    data.scoutName,
    data.alliance,
    data.deviceId || '',
    data.playedDefense ? 1 : 0,
    data.defenseInstances,
    data.defenseDuration,
    data.defenseEffectiveness,
    data.autoFluidity,
    data.teleopFluidity,
    data.driverPressure,
    data.robotDied ? 1 : 0,
    data.commsLost ? 1 : 0,
    data.mechanismBroke ? 1 : 0,
    data.failureReason,
    data.notes,
    data.climbLevel,
    data.tippedOver ? 1 : 0
  ];
  return "V4|" + JSON.stringify(arr);
};

export const decompressMatchData = (str: string): MatchScoutingV2 | null => {
  if (!str.startsWith("V4|")) return null;
  try {
    const arr = JSON.parse(str.substring(3));
    return {
      eventKey: arr[0],
      matchKey: arr[1],
      teamNumber: arr[2],
      scoutName: arr[3],
      alliance: arr[4],
      deviceId: arr[5],
      playedDefense: !!arr[6],
      defenseInstances: arr[7],
      defenseDuration: arr[8],
      defenseEffectiveness: arr[9],
      autoFluidity: arr[10],
      teleopFluidity: arr[11],
      driverPressure: arr[12],
      robotDied: !!arr[13],
      commsLost: !!arr[14],
      mechanismBroke: !!arr[15],
      failureReason: arr[16],
      notes: arr[17],
      climbLevel: arr[18] || 'None',
      tippedOver: !!arr[19],
      timestamp: Date.now()
    };
  } catch (e) {
    console.error("Failed to parse QR data", e);
    return null;
  }
};
