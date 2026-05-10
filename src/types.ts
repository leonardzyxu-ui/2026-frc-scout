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
  scoutName: string;
  robotBaseType: 'WCP' | 'KitBot' | 'Custom' | '';
  isWcpBot: boolean;
  isKitBot: boolean;
  turretCount: '1' | '2' | '3' | 'More' | '';
  customTurretCount: string;
  canUseHopper: boolean;
  hopperCapacity: number;
  canClimbL1: boolean;
  canClimbL2: boolean;
  canClimbL3: boolean;
  noClimbCapability: boolean;
  expectedHubBallsPerMatch: number;
  expectedAutoBalls: number;
  expectedTeleopBalls: number;
  ballsPerSecond: number;
  shootingStyle: 'On the Fly' | 'Fixed Point' | '';
  canCrossTrench: boolean;
  isBumpOnly: boolean;
  chassisSpeed: number;
  chassisSpeedDistanceUnit: 'meters' | 'feet' | 'miles' | 'kilometers' | 'yards' | '';
  chassisSpeedTimeUnit: 'seconds' | 'minutes' | 'hours' | '';
  shootingFlywheelCount: number;
  hoodAdjustable: boolean;
  notes: string;
  deviceId?: string;
  timestamp?: number;
}

export interface PitAssignment {
  teamNumber: string;
  assignedScoutName: string;
  updatedAt: number;
  updatedByDeviceId: string;
}

export interface MatchScoutingV2 {
  // Meta
  eventKey: string;
  matchType: 'Practice' | 'Qualification';
  matchKey: string;
  teamNumber: string;
  scoutName: string;
  assignedScoutName: string;
  assignedSlot: string;
  substituteScoutName?: '' | 'Charlotte' | 'Matilda' | 'Scarlett';
  alliance: 'Red' | 'Blue' | '';
  deviceId?: string;
  timestamp?: number;
  editHistory?: { timestamp: number; editor: string; changes: string }[]; // For versioning

  // Defense Branching
  playedDefense: boolean;
  defenseInstances: number;
  defenseDuration: string; // '<1', '<2', etc.
  defenseEffectiveness: number; // 0-10

  // Subjective (0-10)
  autoFluidity: number;
  teleopFluidity: number;
  driverPressure: number;
  totalCycles: number;
  mainPointContributor: boolean;
  yellowCard: boolean;
  yellowCardReason: string;
  redCard: boolean;
  redCardReason: string;

  // Toggles & Critical Failures
  climbLevel: 'None' | 'L1' | 'L2' | 'L3';
  robotDied: boolean;
  commsLost: boolean;
  mechanismBroke: boolean;
  tippedOver: boolean;
  failureReason: string;

  // Notes
  notes: string;
  comments?: string;
}

export type MatchScoutingV3MatchType = 'Practice' | 'Qualification';
export type MatchScoutingV3Alliance = 'Red' | 'Blue' | '';
export type MatchScoutingV3StartingPosition = 'Left' | 'Center' | 'Right' | '';
export type MatchScoutingV3ShootingStyle = 'On the Fly' | 'Stationary' | '';
export type MatchScoutingV3CapabilityRating = 'Cannot' | 'Limited' | 'Strong' | '';
export type MatchScoutingV3SubstituteScoutName = '' | 'Charlotte' | 'Scarlett';
export type MatchDefenseScoutingV1SubstituteScoutName = '' | 'Charlotte' | 'Scarlett';

export interface MatchDefenseScoutingV1 {
  schemaVersion: 'defense-v1';
  eventKey: string;
  matchType: MatchScoutingV3MatchType;
  matchNumber: number;
  matchKey: string;
  teamNumber: string;
  scoutName: string;
  assignedScoutName: string;
  assignedSlot: string;
  substituteScoutName?: MatchDefenseScoutingV1SubstituteScoutName;
  alliance: MatchScoutingV3Alliance;
  deviceId?: string;
  timestamp?: number;
  defenseMetric: number;
  defenseComments: string;
  generalComments: string;
}

export interface MatchScoutingV3 {
  schemaVersion: 'v3';
  eventKey: string;
  matchType: MatchScoutingV3MatchType;
  matchNumber: number;
  matchKey: string;
  teamNumber: string;
  scoutName: string;
  assignedScoutName: string;
  assignedSlot: string;
  substituteScoutName?: MatchScoutingV3SubstituteScoutName;
  alliance: MatchScoutingV3Alliance;
  deviceId?: string;
  timestamp?: number;
  legacyDerived?: boolean;
  editHistory?: { timestamp: number; editor: string; changes: string }[];

  closeAccuracy: number;
  middleAccuracy: number;
  farAccuracy: number;
  contributionScore: number;

  startingPosition: MatchScoutingV3StartingPosition;
  autoPoints: number;
  autoClimbed: boolean;

  teleopCycles: number;
  teleopPoints: number;
  teleopClimbed: boolean;

  shootingStyle: MatchScoutingV3ShootingStyle;
  climbLevel: 'None' | 'L1' | 'L2' | 'L3';
  trenchPushing: MatchScoutingV3CapabilityRating;
  passing: MatchScoutingV3CapabilityRating;
  driverSkill: number;
  teamwork: number;

  defenseDescription: string;
  generalEvaluation: string;

  totalMatchPoints: number;
}

export type QualificationStatus = 'likely_qualified' | 'likely_not_qualified' | 'unknown';
export type QualificationSource = 'direct_tba' | 'derived' | 'unavailable';

export interface PreMatchMediaAsset {
  id: string;
  label: string;
  kind: 'image' | 'video' | 'link';
  sourceType: string;
  preferred: boolean;
  viewUrl: string;
  directUrl?: string;
}

export interface PreMatchRobotMetadata {
  key: string;
  year: number;
  name: string;
}

export interface TeamAwardSummary {
  eventKey: string;
  eventName: string;
  name: string;
  awardType?: number;
}

export interface TeamSeasonEventSummary {
  eventKey: string;
  name: string;
  eventType: string;
  startDate?: string;
  location: string;
  overallStatus: string;
  qualRank: number | null;
  allianceStatus: string | null;
  playoffStatus: string | null;
  districtPoints: number | null;
}

export interface DistrictStanding {
  districtKey: string;
  districtName: string;
  rank: number | null;
  totalPoints: number | null;
  eventPoints: { eventKey: string; eventName: string; points: number | null }[];
}

export interface PreMatchTeamProfile {
  teamNumber: string;
  teamKey: string;
  year: number;
  nickname: string;
  location: string;
  mediaAssets: PreMatchMediaAsset[];
  robotMetadata: PreMatchRobotMetadata[];
  seasonAwards: TeamAwardSummary[];
  seasonEvents: TeamSeasonEventSummary[];
  districtStanding: DistrictStanding | null;
  qualificationStatus: QualificationStatus;
  qualificationReason: string;
  qualificationSource: QualificationSource;
}

export interface TeamAnalyticsV2 {
  teamNumber: string;
  eventKey: string;
  epa: number;
  epac: number;
  avgAutoFluidity: number;
  avgTeleopFluidity: number;
  avgDriverPressure: number;
  avgDefenseEffectiveness: number;
  matchesPlayed: number;
}

export const initialMatchScoutingV2: MatchScoutingV2 = {
  eventKey: '2026MNUM',
  matchType: 'Qualification',
  matchKey: 'qm1',
  teamNumber: '',
  scoutName: '',
  assignedScoutName: '',
  assignedSlot: '',
  substituteScoutName: '',
  alliance: '',
  deviceId: '',

  playedDefense: false,
  defenseInstances: 0,
  defenseDuration: '<1',
  defenseEffectiveness: 5,

  autoFluidity: 5,
  teleopFluidity: 5,
  driverPressure: 5,
  totalCycles: 0,
  mainPointContributor: false,
  yellowCard: false,
  yellowCardReason: '',
  redCard: false,
  redCardReason: '',

  climbLevel: 'None',
  robotDied: false,
  commsLost: false,
  mechanismBroke: false,
  tippedOver: false,
  failureReason: '',

  notes: ''
};

export const initialMatchScoutingV3: MatchScoutingV3 = {
  schemaVersion: 'v3',
  eventKey: '2026MNUM',
  matchType: 'Qualification',
  matchNumber: 1,
  matchKey: 'qm1',
  teamNumber: '',
  scoutName: '',
  assignedScoutName: '',
  assignedSlot: '',
  substituteScoutName: '',
  alliance: '',
  deviceId: '',
  legacyDerived: false,
  editHistory: [],

  closeAccuracy: 0,
  middleAccuracy: 0,
  farAccuracy: 0,
  contributionScore: 0,

  startingPosition: '',
  autoPoints: 0,
  autoClimbed: false,

  teleopCycles: 0,
  teleopPoints: 0,
  teleopClimbed: false,

  shootingStyle: '',
  climbLevel: 'None',
  trenchPushing: '',
  passing: '',
  driverSkill: 0,
  teamwork: 0,

  defenseDescription: '',
  generalEvaluation: '',

  totalMatchPoints: 0
};

export const initialMatchDefenseScoutingV1: MatchDefenseScoutingV1 = {
  schemaVersion: 'defense-v1',
  eventKey: '2026MNUM',
  matchType: 'Qualification',
  matchNumber: 1,
  matchKey: 'qm1',
  teamNumber: '',
  scoutName: '',
  assignedScoutName: '',
  assignedSlot: '',
  substituteScoutName: '',
  alliance: '',
  deviceId: '',
  defenseMetric: 0.5,
  defenseComments: '',
  generalComments: ''
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
  timestamp?: number;
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
