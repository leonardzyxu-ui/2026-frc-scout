export type AllianceColor = 'red' | 'blue';
export type DataSource = 'TBA' | 'FIRST' | 'Statbotics' | 'Firebase' | 'LocalBackup' | 'Synthetic';

export interface AllianceMatchRecord {
  score: number;
  teamKeys: string[];
  foulPoints: number | null;
  techFoulCount: number | null;
  foulCount: number | null;
  componentPoints: Record<string, number>;
  preMatchExpectedScore?: number | null;
  preMatchWinProbability?: number | null;
  rawBreakdown?: unknown;
}

export interface HistoricalMatch {
  key: string;
  eventKey: string;
  season: number;
  compLevel: string;
  matchNumber: number;
  setNumber: number;
  startTime: number | null;
  red: AllianceMatchRecord;
  blue: AllianceMatchRecord;
  winningAlliance: AllianceColor | '' | null;
  source: DataSource;
}

export interface ScoutingObservation {
  id: string;
  source: DataSource;
  eventKey: string;
  matchKey: string;
  teamKey: string;
  alliance: AllianceColor | null;
  offensePoints: number | null;
  defenseValue: number | null;
  playedDefense: boolean | null;
  reliabilityPenalty: number | null;
  observedAt: number | null;
  raw: unknown;
}

export interface StatboticsTeamSignal {
  id: string;
  teamKey: string;
  season: number;
  eventKey: string | null;
  overallEpa: number | null;
  autoEpa: number | null;
  teleopEpa: number | null;
  endgameEpa: number | null;
  sourceKind: 'team_event' | 'team_year';
  raw: unknown;
}

export interface TeamSnapshot {
  teamKey: string;
  seasonMatches: number;
  eventMatches: number;
  seasonOffense: number;
  eventOffense: number;
  recentOffense: number;
  volatility: number;
  defenseDenial: number;
  scoutOffense: number | null;
  scoutDefense: number | null;
  reliabilityPenalty: number;
  statboticsEpa: number | null;
}

export interface RoleOption {
  label: string;
  defenderTeamKey: string | null;
  offenseCost: number;
  defenseValue: number;
  netSwing: number;
}

export interface FeatureRow {
  rowId: string;
  matchKey: string;
  eventKey: string;
  season: number;
  sortKey: number;
  perspective: AllianceColor;
  allianceTeams: string[];
  opponentTeams: string[];
  targetScore: number;
  opponentScore: number;
  targetWin: boolean;
  targetFoulPoints: number | null;
  targetTechFouls: number | null;
  sourceExpectedScore: number | null;
  sourceWinProbability: number | null;
  roleOption: RoleOption;
  opponentRoleOption: RoleOption;
  features: Record<string, number>;
}

export interface WalkForwardDataset {
  rows: FeatureRow[];
  featureNames: string[];
  leakageNotes: string[];
}

export interface ModelConfig {
  name: string;
  family:
    | 'baseline'
    | 'ridge'
    | 'elasticNet'
    | 'huberRidge'
    | 'knn'
    | 'kernel'
    | 'monteCarloEpa'
    | 'ensembleEpa'
    | 'sourcePrediction'
    | 'opr'
    | 'onlineEpa'
    | 'relativeEpa'
    | 'onlineDualEpa';
  lambda?: number;
  alpha?: number;
  k?: number;
  bandwidth?: number;
  intervalScale?: number;
  seasonDecay?: number;
  eventAdjustmentScale?: number;
  eventLearningRate?: number;
  eventResidualShiftWeight?: number;
  eventResidualShiftMinSamples?: number;
  eventResidualShiftWindow?: number;
  eventScoreScaleWeight?: number;
  eventScoreScaleMinSamples?: number;
  eventScoreScaleWindow?: number;
  eventScoreScaleThreshold?: number;
  eventScoreScalePositiveOnly?: boolean;
  championshipDivisionScoreShift?: number;
  championshipEventScoreShift?: number;
  defenseLearningRate?: number;
  roleAdjustmentScale?: number;
  simulationCount?: number;
  teamUncertaintyScale?: number;
  scoreNoiseScale?: number;
  roleSimulationScale?: number;
  ensembleMonteCarloWeight?: number;
  ensembleMonteCarloWinWeight?: number;
  featureSet?: 'full' | 'compact' | 'minimal';
  useRoleFeatures: boolean;
  useContextEpa: boolean;
  eligibleForPromotion: boolean;
  leakageRisk: 'low' | 'medium' | 'high';
}

export interface ScorePrediction {
  rowId: string;
  matchKey: string;
  eventKey: string;
  season: number;
  perspective: AllianceColor;
  expectedScore: number;
  p10Score: number;
  p90Score: number;
  actualScore: number;
  residual: number;
  winProbability?: number | null;
}

export interface MatchPrediction {
  matchKey: string;
  eventKey: string;
  season: number;
  redExpectedScore: number;
  blueExpectedScore: number;
  redP10Score: number;
  redP90Score: number;
  blueP10Score: number;
  blueP90Score: number;
  redActualScore: number;
  blueActualScore: number;
  redWinProbability: number;
  blueWinProbability: number;
  predictedWinner: AllianceColor | 'tie';
  actualWinner: AllianceColor | 'tie';
  redRole: RoleOption;
  blueRole: RoleOption;
}

export interface VifDiagnostic {
  feature: string;
  vif: number;
}

export interface CorrelationDiagnostic {
  left: string;
  right: string;
  correlation: number;
}

export interface FeatureImportance {
  feature: string;
  coefficient: number;
  standardizedMagnitude: number;
}

export interface ModelSliceMetric {
  sliceType: 'season' | 'event';
  sliceKey: string;
  scoreMae: number;
  scoreRmse: number;
  marginMae: number;
  winBrier: number;
  scoreIntervalCoverage: number;
  scoreIntervalWidth: number;
  predictionCount: number;
  matchCount: number;
}

export interface ModelResult {
  config: ModelConfig;
  scorePredictions: ScorePrediction[];
  matchPredictions: MatchPrediction[];
  scoreMae: number;
  scoreRmse: number;
  marginMae: number;
  normalizedScoreMae: number;
  normalizedMarginMae: number;
  winBrier: number;
  calibrationError: number;
  scoreIntervalCoverage: number;
  scoreIntervalWidth: number;
  coverageError: number;
  eventScoreMaeStd: number;
  worstEventScoreMae: number;
  seasonScoreMaeStd: number;
  worstSeasonScoreMae: number;
  benchmarkScore: number;
  benchmarkRank: number;
  benchmarkPenalty: number;
  overfitRiskScore: number;
  benchmarkBreakdown: Record<string, number>;
  predictionCount: number;
  promoted: boolean;
  rejectionReasons: string[];
  sliceMetrics: ModelSliceMetric[];
  vifDiagnostics: VifDiagnostic[];
  correlationDiagnostics: CorrelationDiagnostic[];
  featureImportance: FeatureImportance[];
}

export interface ResearchRun {
  runId: string;
  createdAt: string;
  matches: number;
  rows: number;
  modelResults: ModelResult[];
  bestModelName: string | null;
  notes: string[];
}
