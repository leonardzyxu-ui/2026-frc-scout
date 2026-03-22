export interface PitScoutData {
  id: string;
  teamNumber: string;
  teamName: string;
  drivetrainType: string;
  wheelSpeedRatio: string;
  maxSpeed: string;
  length: string;
  width: string;
  weight: string;
  canCrossTrench: string;
  capacity: string;
  climbLevel: string;
  autoL1: string;
  shootingMethod: string;
  flywheelsPerTurret: string;
  turretDoF: string;
  shootingSpeed: string;
  shootingLocation: string;
  canProgramPass: string;
  estPoints: string;
  driveTeamExp: string;
  fuelIntakeMethod: string;
}

export interface PitScoutingV2 {
  teamNumber: string;
  teamName: string;
  drivetrainType: string;
  weight: number;
  length: number;
  width: number;
  notes: string;
}

export interface MatchScoutingV2 {
  // Meta
  eventKey: string;
  matchKey: string;
  teamNumber: string;
  scoutName: string;
  alliance: 'Red' | 'Blue' | '';
  deviceId?: string;
  timestamp?: number;
  editHistory?: any[]; // For versioning

  // Defense Branching
  playedDefense: boolean;
  defenseInstances: number;
  defenseDuration: string; // '<1', '<2', etc.
  defenseEffectiveness: number; // 0-10

  // Subjective (0-10)
  autoFluidity: number;
  teleopFluidity: number;
  driverPressure: number;

  // Toggles & Critical Failures
  climbLevel: 'None' | 'Parked' | 'Shallow' | 'Deep';
  robotDied: boolean;
  commsLost: boolean;
  mechanismBroke: boolean;
  tippedOver: boolean;
  failureReason: string;

  // Notes
  notes: string;
  comments?: string;
}

export interface TeamAnalyticsV2 {
  teamNumber: string;
  eventKey: string;
  opr: number;
  dpr: number;
  oprc: number;
  avgAutoFluidity: number;
  avgTeleopFluidity: number;
  avgDriverPressure: number;
  avgDefenseEffectiveness: number;
  matchesPlayed: number;
}

export const initialMatchScoutingV2: MatchScoutingV2 = {
  eventKey: '2026cnsh', // Default to Shanghai Regional
  matchKey: 'qm1',
  teamNumber: '',
  scoutName: '',
  alliance: '',
  deviceId: '',

  playedDefense: false,
  defenseInstances: 0,
  defenseDuration: '<1',
  defenseEffectiveness: 5,

  autoFluidity: 5,
  teleopFluidity: 5,
  driverPressure: 5,

  climbLevel: 'None',
  robotDied: false,
  commsLost: false,
  mechanismBroke: false,
  tippedOver: false,
  failureReason: '',

  notes: ''
};

export interface MatchData {
  scout: string;
  match: number;
  team: string;
  alliance: 'Red' | 'Blue' | '';
  startTime: number;
  actions: { t: string; id: string; val: number }[];
  counters: {
    auto_score: number;
    teleop_fuel: number;
    hoard_fuel: number;
  };
  toggles: {
    auto_mobility: boolean;
    auto_tower: boolean;
    robot_died: boolean;
    defense: boolean;
  };
  endgame: 'None' | 'L1' | 'L2' | 'L3';
  notes: string;
  diedReason: string;
  allianceScore: number;
  rp: {
    win: boolean;
    tie: boolean;
    climb: boolean;
    fuel100: boolean;
    fuel360: boolean;
  };
  startPos: { x: number | null; y: number | null };
  eventKey: string;
  docId?: string;
  importedViaQR?: boolean;
  deviceId?: string;
  userAgent?: string;
  timestamp?: any;
}

export interface TeamStats {
  team: string;
  matches: MatchData[];
  totPoints: number;
  totAuto: number;
  totTeleop: number;
  totEndgame: number;
  totClimb: number;
  totRPs: number;
  deaths: number;
  scouts: Set<string>;
  avgPoints: number;
  avgAuto: number;
  avgTeleop: number;
  avgEndgame: number;
  avgClimb: number;
  avgRPs: number;
}

export const initialMatchData: MatchData = {
  scout: '',
  match: 1,
  team: '',
  alliance: '',
  startTime: 0,
  actions: [],
  counters: { auto_score: 0, teleop_fuel: 0, hoard_fuel: 0 },
  toggles: { auto_mobility: false, auto_tower: false, robot_died: false, defense: false },
  endgame: 'None',
  notes: '',
  diedReason: '',
  allianceScore: 0,
  rp: { win: false, tie: false, climb: false, fuel100: false, fuel360: false },
  startPos: { x: null, y: null },
  eventKey: '2026sh', // Default to Shanghai Regional
  deviceId: '',
  userAgent: '',
};
