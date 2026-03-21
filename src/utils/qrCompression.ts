import { MatchScoutingV2 } from '../types';

export const compressMatchData = (data: MatchScoutingV2): string => {
  const arr = [
    data.eventKey,
    data.matchKey,
    data.teamNumber,
    data.scoutName,
    data.alliance,
    data.deviceId || '',
    data.autoMobility ? 1 : 0,
    data.autoScore,
    data.autoTower ? 1 : 0,
    data.teleopScore,
    data.hoardScore,
    data.playedDefense ? 1 : 0,
    data.defenseInstances,
    data.defenseDuration,
    data.defenseEffectiveness,
    data.climbStatus,
    data.autoFluidity,
    data.teleopFluidity,
    data.underPressure,
    data.robotDied ? 1 : 0,
    data.commsLost ? 1 : 0,
    data.mechanismBroke ? 1 : 0,
    data.failureReason,
    data.notes
  ];
  return "V2|" + JSON.stringify(arr);
};

export const decompressMatchData = (str: string): MatchScoutingV2 | null => {
  if (!str.startsWith("V2|")) return null;
  try {
    const arr = JSON.parse(str.substring(3));
    return {
      eventKey: arr[0],
      matchKey: arr[1],
      teamNumber: arr[2],
      scoutName: arr[3],
      alliance: arr[4],
      deviceId: arr[5],
      autoMobility: !!arr[6],
      autoScore: arr[7],
      autoTower: !!arr[8],
      teleopScore: arr[9],
      hoardScore: arr[10],
      playedDefense: !!arr[11],
      defenseInstances: arr[12],
      defenseDuration: arr[13],
      defenseEffectiveness: arr[14],
      climbStatus: arr[15],
      autoFluidity: arr[16],
      teleopFluidity: arr[17],
      underPressure: arr[18],
      robotDied: !!arr[19],
      commsLost: !!arr[20],
      mechanismBroke: !!arr[21],
      failureReason: arr[22],
      notes: arr[23],
      timestamp: Date.now()
    };
  } catch (e) {
    console.error("Failed to parse QR data", e);
    return null;
  }
};
