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
export type MatchScoutingV4SubstituteScoutName = '' | 'Charlotte' | 'Scarlett';
export type MatchScoutingV4Role = '' | 'Offense' | 'Defense' | 'Mixed' | 'Support' | 'Disabled';

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

export interface MatchScoutingV4 {
  schemaVersion: 'v4';
  eventKey: string;
  matchType: MatchScoutingV3MatchType;
  matchNumber: number;
  matchKey: string;
  teamNumber: string;
  scoutName: string;
  assignedScoutName: string;
  assignedSlot: string;
  substituteScoutName?: MatchScoutingV4SubstituteScoutName;
  alliance: MatchScoutingV3Alliance;
  deviceId?: string;
  timestamp?: number;
  editHistory?: { timestamp: number; editor: string; changes: string }[];

  autoPoints: number;
  autoCycles: number;
  teleopPoints: number;
  teleopCycles: number;
  endgamePoints: number;
  totalMatchPoints: number;

  rolePlayed: MatchScoutingV4Role;
  defendedTeamNumber: string;
  defenderFacedTeamNumber: string;
  defenseIntensity: number;
  defenseDurationSeconds: number;

  fouls: number;
  techFouls: number;
  robotDied: boolean;
  commsLost: boolean;
  mechanismBroke: boolean;
  tippedOver: boolean;
  failureReason: string;
  reliabilityScore: number;

  notes: string;
  strategyNotes: string;
}

export interface PowerCoinBet {
  id: string;
  eventKey: string;
  matchKey: string;
  matchNumber: number;
  matchType: MatchScoutingV3MatchType;
  scoutName: string;
  side: 'Red' | 'Blue';
  amount: number;
  placedAt: number;
  settledAt?: number;
  outcome?: 'won' | 'lost' | 'refunded';
  payout?: number;
}

export interface PowerCoinLedgerEntry {
  id: string;
  eventKey: string;
  scoutName: string;
  reason: string;
  delta: number;
  balanceAfter: number;
  createdAt: number;
  matchKey?: string;
}

export interface ScoutAssignmentPlan {
  id: string;
  eventKey: string;
  createdAt: number;
  scoutNames: string[];
  scoutCount: number;
  ownTeamNumber: string;
  assignments: Array<{
    matchKey: string;
    matchNumber: number;
    matchType: MatchScoutingV3MatchType;
    station: string;
    teamNumber: string;
    scoutName: string;
    priorityReason: string;
  }>;
  coverageGaps?: Array<{
    matchKey: string;
    matchNumber: number;
    matchType: MatchScoutingV3MatchType;
    station: string;
    teamNumber: string;
    reason: string;
  }>;
  exposureCounts: Record<string, Record<string, number>>;
}

export interface ModelFeatureSnapshot {
  id: string;
  eventKey: string;
  modelName: string;
  beforeMatchKey: string;
  createdAt: number;
  featuresByTeam: Record<string, Record<string, number>>;
  matchSnapshots?: Array<{
    matchKey: string;
    matchNumber: number;
    redTeams: string[];
    blueTeams: string[];
    featuresByTeam: Record<string, Record<string, number>>;
  }>;
}

export interface ModelBacktestResult {
  modelName: string;
  sourceLabel: string;
  eligibleForPromotion: boolean;
  supportsTeamRatings: boolean;
  leakageRisk: 'none' | 'medium' | 'high';
  matchesTested: number;
  winnerAccuracy: number;
  averageConfidence: number;
  brierScore: number;
  scoreMae: number;
  marginMae: number;
  calibrationError: number;
  lowConfidenceRate: number;
  uncertaintyNote: string;
  calibrationBins: ModelCalibrationBin[];
  comparisonRows: ModelBacktestComparisonRow[];
}

export interface ModelBacktestComparisonRow {
  matchKey: string;
  matchNumber: number;
  title: string;
  predictedRedScore: number;
  predictedBlueScore: number;
  actualRedScore: number;
  actualBlueScore: number;
  predictedWinner: 'Red' | 'Blue' | 'Tie';
  actualWinner: 'Red' | 'Blue' | 'Tie';
  winnerPickCorrect: boolean;
  confidence: number;
  lowConfidence: boolean;
}

export interface ModelCalibrationBin {
  modelName: string;
  binLabel: string;
  minConfidence: number;
  maxConfidence: number;
  matches: number;
  predictedWinRate: number;
  actualWinRate: number;
  calibrationGap: number;
}

export interface ModelLabSnapshot {
  id: string;
  eventKey: string;
  createdAt: number;
  selectedPromotedModel: string;
  selectedForecastModel: string;
  ppaTeamCount: number;
  modelResults: ModelBacktestResult[];
}

export interface TeamPerformanceProfile {
  teamNumber: string;
  matchesPlayed: number;
  peakScore: number;
  worstScore: number;
  lowestNonZeroScore: number | null;
  averageScore: number;
  standardDeviation: number;
  floorScore: number;
  ceilingScore: number;
  projectedNextScore: number;
  volatility: number;
  consistencyIndex: number;
  upsetPotential: number;
  zeroRate: number;
  reliability: number;
  recentTrend: number;
  ppc: number | null;
  opr: number | null;
  dpr: number | null;
  epa: number | null;
  ppa: number | null;
  defenseImpact: number | null;
  normalLowScore: number;
  normalHighScore: number;
  curve: Array<{
    matchKey: string;
    matchNumber: number;
    score: number;
    rollingAverage: number;
    fittedScore: number;
    lowerBand: number;
    upperBand: number;
  }>;
  modelCurve: Array<{
    matchKey: string;
    matchNumber: number;
    ppcBefore: number;
    rollingPpcBefore: number;
    oprBefore: number;
    rollingOprBefore: number;
    epa: number | null;
    ppa: number | null;
  }>;
}

export interface ScoutCalibrationRow {
  scoutName: string;
  assignedScoutName: string;
  rows: number;
  matches: number;
  totalScoutedPoints: number;
  officialSharePoints: number;
  averageOfficialMinusScout: number;
  averageAbsoluteError: number;
  biasLabel: 'over-counting' | 'under-counting' | 'balanced';
}

export interface DefenseAttributionRecord {
  id: string;
  eventKey: string;
  matchKey: string;
  targetTeamNumber: string;
  defenderTeamNumber: string;
  expectedTargetPoints: number;
  actualTargetPoints: number;
  pointsDenied: number;
  confidence: number;
  source: 'scouted' | 'calibrated';
}

export interface StrategyRoleOption {
  alliance: 'Red' | 'Blue';
  label: string;
  defenderTeamNumber: string;
  ownScore: number;
  opponentScore: number;
  netMargin: number;
  offenseCost: number;
  defenseValue: number;
  recommended: boolean;
  rationale: string;
}

export interface StrategyAllianceRpPath {
  alliance: 'Red' | 'Blue';
  projectedRp: number;
  winRp: number;
  towerRp: number;
  energizedRp: number;
  superchargedRp: number;
  towerMetric: number;
  fuelMetric: number;
  missingComponentTeams: string[];
  note: string;
}

export interface StrategyMatchPlan {
  matchKey: string;
  matchNumber: number;
  matchType: MatchScoutingV3MatchType;
  compLevel: string;
  modelName: string;
  modelSource: string;
  modelLowConfidence: boolean;
  redTeams: string[];
  blueTeams: string[];
  baselineRedScore: number;
  baselineBlueScore: number;
  optimizedRedScore: number;
  optimizedBlueScore: number;
  redDefenseSwing: number;
  blueDefenseSwing: number;
  bestRedPlan: string;
  bestBluePlan: string;
  redRoleOptions: StrategyRoleOption[];
  blueRoleOptions: StrategyRoleOption[];
  predictedWinner: 'Red' | 'Blue' | 'Tie';
  predictedMargin: number;
  confidence: number;
  redRpPath: StrategyAllianceRpPath;
  blueRpPath: StrategyAllianceRpPath;
  opponentCounterStrategy: string;
  riskFlags: string[];
  winCondition: string;
}

export interface AlliancePickRecommendation {
  teamNumber: string;
  score: number;
  seedFit: string;
  roleFit: string;
  rationale: string;
  status: 'available' | 'picked' | 'declined' | 'unavailable';
  pickedBy?: string;
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

export const initialMatchScoutingV4: MatchScoutingV4 = {
  schemaVersion: 'v4',
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
  editHistory: [],

  autoPoints: 0,
  autoCycles: 0,
  teleopPoints: 0,
  teleopCycles: 0,
  endgamePoints: 0,
  totalMatchPoints: 0,

  rolePlayed: '',
  defendedTeamNumber: '',
  defenderFacedTeamNumber: '',
  defenseIntensity: 0,
  defenseDurationSeconds: 0,

  fouls: 0,
  techFouls: 0,
  robotDied: false,
  commsLost: false,
  mechanismBroke: false,
  tippedOver: false,
  failureReason: '',
  reliabilityScore: 1,

  notes: '',
  strategyNotes: ''
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
