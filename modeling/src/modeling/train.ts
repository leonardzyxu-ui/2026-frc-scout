import { Matrix, solve } from 'ml-matrix';
import type {
  AllianceColor,
  FeatureRow,
  MatchPrediction,
  ModelConfig,
  ModelResult,
  ModelSliceMetric,
  ResearchRun,
  ScorePrediction,
  WalkForwardDataset
} from '../types.ts';
import { clamp, mae, mean, normalCdf, quantile, rmse, standardDeviation } from '../util.ts';
import { buildCorrelationDiagnostics, buildFeatureImportance, buildVifDiagnostics } from './diagnostics.ts';

const MAX_REASONABLE_FRC_SCORE = 700;
const MODEL_REFIT_ROW_CADENCE = 160;
const OPR_REFIT_ROW_CADENCE = 240;
const WIN_PROBABILITY_CALIBRATION_REFIT_MATCH_CADENCE = 160;

export const candidateModelConfigs: ModelConfig[] = [
  {
    name: 'Prior Average',
    family: 'baseline',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'Role-Aware Prior',
    family: 'baseline',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'Published Statbotics Match Prediction',
    family: 'sourcePrediction',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: false,
    leakageRisk: 'medium'
  },
  {
    name: 'No-Future Monte Carlo EPA K=1.10 S=0.80',
    family: 'monteCarloEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.8,
    scoreNoiseScale: 0.85,
    roleSimulationScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Monte Carlo EPA K=1.20 S=0.80',
    family: 'monteCarloEpa',
    lambda: 1.2,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.8,
    scoreNoiseScale: 0.85,
    roleSimulationScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Monte Carlo EPA K=1.20 S=1.05',
    family: 'monteCarloEpa',
    lambda: 1.2,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    roleSimulationScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Monte Carlo EPA K=1.20 S=1.20',
    family: 'monteCarloEpa',
    lambda: 1.2,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 1,
    scoreNoiseScale: 1.2,
    roleSimulationScale: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Role Monte Carlo EPA K=1.10 S=0.80 R=0.15',
    family: 'monteCarloEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.8,
    scoreNoiseScale: 0.85,
    roleSimulationScale: 0.15,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future EPA-MC Ensemble K=1.10 W=0.20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 1,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future EPA-MC Ensemble K=1.10 W=0.05',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.05,
    ensembleMonteCarloWinWeight: 1,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future EPA-MC Ensemble K=1.10 W=0.10',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.1,
    ensembleMonteCarloWinWeight: 1,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future EPA-MC Ensemble K=1.10 W=0.35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.35,
    ensembleMonteCarloWinWeight: 1,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future EPA-MC Ensemble K=1.20 W=0.20',
    family: 'ensembleEpa',
    lambda: 1.2,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 1,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.00',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future EPA-MC Ensemble K=1.10 W=0.20 P=0.20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0.2,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift EPA K=1.10 S=0.25',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    eventResidualShiftWeight: 0.25,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift EPA K=1.10 S=0.50',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    eventResidualShiftWeight: 0.5,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift EPA K=1.10 S=0.75',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    eventResidualShiftWeight: 0.75,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.25,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.10 M=8',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.1,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 I=1.05',
    family: 'ensembleEpa',
    lambda: 1.1,
    intervalScale: 1.05,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 I=1.10',
    family: 'ensembleEpa',
    lambda: 1.1,
    intervalScale: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 C=8 D=4',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShift: 8,
    championshipEventScoreShift: 4,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 C=12 D=6',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShift: 12,
    championshipEventScoreShift: 6,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 C=16 D=8',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShift: 16,
    championshipEventScoreShift: 8,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 C=20 D=10',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShift: 20,
    championshipEventScoreShift: 10,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.055 DR=0.0275',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.055,
    championshipEventScoreShiftRatio: 0.0275,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.075 DR=0.0375',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.075,
    championshipEventScoreShiftRatio: 0.0375,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Robust-Update Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 U=80 R=120',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    ratingUpdateErrorClip: 80,
    residualMemoryErrorClip: 120,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Robust-Update Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 U=100 R=140',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    ratingUpdateErrorClip: 100,
    residualMemoryErrorClip: 140,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Robust-Update Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 U=120 R=160',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    ratingUpdateErrorClip: 120,
    residualMemoryErrorClip: 160,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Component-Prior Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 CP=0.05 CM=2',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    componentPriorWeight: 0.05,
    componentPriorMinMatches: 2,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Component-Prior Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 CP=0.10 CM=2',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    componentPriorWeight: 0.1,
    componentPriorMinMatches: 2,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Component-Prior Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 CP=0.10 CM=4',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    componentPriorWeight: 0.1,
    componentPriorMinMatches: 4,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Champs-Phase Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 E=4 M=8 LATE=0 R=72/180',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyScoreShift: 4,
    championshipPhaseMiddleScoreShift: 8,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseScope: 'championship',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Champs-Phase Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 E=6 M=10 LATE=0 R=72/180',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyScoreShift: 6,
    championshipPhaseMiddleScoreShift: 10,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseScope: 'championship',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Champs-Phase Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 E=8 M=12 LATE=0 R=72/180',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyScoreShift: 8,
    championshipPhaseMiddleScoreShift: 12,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseScope: 'championship',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Champs-ResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 RB=0.15/0.25/0 N=8 W=18 POS',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseResidualShiftEarlyWeight: 0.15,
    championshipPhaseResidualShiftMiddleWeight: 0.25,
    championshipPhaseResidualShiftLateWeight: 0,
    championshipPhaseResidualShiftMinSamples: 8,
    championshipPhaseResidualShiftWindow: 18,
    championshipPhaseResidualShiftPositiveOnly: true,
    championshipPhaseResidualShiftScope: 'championship',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Champs-ResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 RB=0.25/0.35/0 N=8 W=18 POS',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseResidualShiftEarlyWeight: 0.25,
    championshipPhaseResidualShiftMiddleWeight: 0.35,
    championshipPhaseResidualShiftLateWeight: 0,
    championshipPhaseResidualShiftMinSamples: 8,
    championshipPhaseResidualShiftWindow: 18,
    championshipPhaseResidualShiftPositiveOnly: true,
    championshipPhaseResidualShiftScope: 'championship',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Champs-PhaseResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 E=4 M=6 RB=0.15/0.25/0 N=8 W=18 POS',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyScoreShift: 4,
    championshipPhaseMiddleScoreShift: 6,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseScope: 'championship',
    championshipPhaseResidualShiftEarlyWeight: 0.15,
    championshipPhaseResidualShiftMiddleWeight: 0.25,
    championshipPhaseResidualShiftLateWeight: 0,
    championshipPhaseResidualShiftMinSamples: 8,
    championshipPhaseResidualShiftWindow: 18,
    championshipPhaseResidualShiftPositiveOnly: true,
    championshipPhaseResidualShiftScope: 'championship',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future WinCal-NoTail Champs-PhaseResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 E=4 M=6 RB=0.15/0.25/0 N=8 W=18 POS',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Champs-PhaseResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 E=4 M=6 RB=0.15/0.25/0 N=8 W=18 POS',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyScoreShift: 4,
    championshipPhaseMiddleScoreShift: 6,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseScope: 'championship',
    championshipPhaseResidualShiftEarlyWeight: 0.15,
    championshipPhaseResidualShiftMiddleWeight: 0.25,
    championshipPhaseResidualShiftLateWeight: 0,
    championshipPhaseResidualShiftMinSamples: 8,
    championshipPhaseResidualShiftWindow: 18,
    championshipPhaseResidualShiftPositiveOnly: true,
    championshipPhaseResidualShiftScope: 'championship',
    winProbabilityScoreSource: 'noChampionshipTailOnlineEpa',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedTail Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TW=0.35 TL=25 TN=24 TC=30 F=PRS POS',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 25,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 30,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidualScale',
    learnedTailCorrectionPositiveOnly: true,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedTail Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TW=0.50 TL=15 TN=16 TC=35 F=PRS POS',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.5,
    learnedTailCorrectionLambda: 15,
    learnedTailCorrectionMinRows: 16,
    learnedTailCorrectionClip: 35,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidualScale',
    learnedTailCorrectionPositiveOnly: true,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedTail Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TW=0.35 TL=40 TN=24 TC=25 F=PR',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ConditionalLearnedTail Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TW=0.50 TL=15 TN=16 TC=35 F=PRS POS G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.5,
    learnedTailCorrectionLambda: 15,
    learnedTailCorrectionMinRows: 16,
    learnedTailCorrectionClip: 35,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidualScale',
    learnedTailCorrectionPositiveOnly: true,
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ConditionalLearnedTail Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TW=0.35 TL=40 TN=24 TC=25 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailRiskInterval Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TU=0.75 TL=40 TN=24 TC=25 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailUncertaintyWeight: 0.75,
    learnedTailUncertaintyClip: 35,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailRiskInterval Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TU=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailUncertaintyWeight: 1.25,
    learnedTailUncertaintyClip: 45,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=0.75 TL=40 TN=24 TC=25 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 0.75,
    learnedTailWinProbabilityClip: 35,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future MarginConfidenceTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=0.75 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 MG=25 CG=0.25',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 0.75,
    learnedTailWinProbabilityClip: 35,
    learnedTailWinProbabilityMinExpectedMargin: 25,
    learnedTailWinProbabilityMinConfidence: 0.25,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future MarginConfidenceTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 MG=25 CG=0.25',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    learnedTailWinProbabilityMinExpectedMargin: 25,
    learnedTailWinProbabilityMinConfidence: 0.25,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future SmoothTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=0.75 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 MR=35 PR=0.25 SF=0.50',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 0.75,
    learnedTailWinProbabilityClip: 35,
    learnedTailWinProbabilityMarginRamp: 35,
    learnedTailWinProbabilityConfidenceRamp: 0.25,
    learnedTailWinProbabilityShrinkFloor: 0.5,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future SmoothTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 MR=35 PR=0.25 SF=0.50',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    learnedTailWinProbabilityMarginRamp: 35,
    learnedTailWinProbabilityConfidenceRamp: 0.25,
    learnedTailWinProbabilityShrinkFloor: 0.5,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future SmoothTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 MR=35 PR=0.25 SF=0.35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    learnedTailWinProbabilityMarginRamp: 35,
    learnedTailWinProbabilityConfidenceRamp: 0.25,
    learnedTailWinProbabilityShrinkFloor: 0.35,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedWinCal Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 WC=0.35 WL=20 WN=320 WW=2400 C=0.080 F=MC',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    winProbabilityCalibrationWeight: 0.35,
    winProbabilityCalibrationLambda: 20,
    winProbabilityCalibrationMinMatches: 320,
    winProbabilityCalibrationWindow: 2400,
    winProbabilityCalibrationClip: 0.08,
    winProbabilityCalibrationFeatureSet: 'marginConfidence',
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedWinCal TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=0.75 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 WC=0.35 WL=20 WN=320 WW=2400 C=0.080 F=MC',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 0.75,
    learnedTailWinProbabilityClip: 35,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    winProbabilityCalibrationWeight: 0.35,
    winProbabilityCalibrationLambda: 20,
    winProbabilityCalibrationMinMatches: 320,
    winProbabilityCalibrationWindow: 2400,
    winProbabilityCalibrationClip: 0.08,
    winProbabilityCalibrationFeatureSet: 'marginConfidence',
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedWinCal TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 WC=0.35 WL=20 WN=320 WW=2400 C=0.080 F=MC',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    winProbabilityCalibrationWeight: 0.35,
    winProbabilityCalibrationLambda: 20,
    winProbabilityCalibrationMinMatches: 320,
    winProbabilityCalibrationWindow: 2400,
    winProbabilityCalibrationClip: 0.08,
    winProbabilityCalibrationFeatureSet: 'marginConfidence',
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedWinCal TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 WC=0.65 WL=20 WN=320 WW=2400 C=0.080 F=MC',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    winProbabilityCalibrationWeight: 0.65,
    winProbabilityCalibrationLambda: 20,
    winProbabilityCalibrationMinMatches: 320,
    winProbabilityCalibrationWindow: 2400,
    winProbabilityCalibrationClip: 0.08,
    winProbabilityCalibrationFeatureSet: 'marginConfidence',
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedWinCal TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=0.75 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 WC=0.10 WL=50 WN=320 WW=2400 C=0.040 F=MC',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 0.75,
    learnedTailWinProbabilityClip: 35,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    winProbabilityCalibrationWeight: 0.1,
    winProbabilityCalibrationLambda: 50,
    winProbabilityCalibrationMinMatches: 320,
    winProbabilityCalibrationWindow: 2400,
    winProbabilityCalibrationClip: 0.04,
    winProbabilityCalibrationFeatureSet: 'marginConfidence',
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedWinCal TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 WC=0.10 WL=50 WN=320 WW=2400 C=0.040 F=MC',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    winProbabilityCalibrationWeight: 0.1,
    winProbabilityCalibrationLambda: 50,
    winProbabilityCalibrationMinMatches: 320,
    winProbabilityCalibrationWindow: 2400,
    winProbabilityCalibrationClip: 0.04,
    winProbabilityCalibrationFeatureSet: 'marginConfidence',
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future LearnedWinCal TailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20 WC=0.15 WL=30 WN=320 WW=2400 C=0.040 F=B',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    winProbabilityCalibrationWeight: 0.15,
    winProbabilityCalibrationLambda: 30,
    winProbabilityCalibrationMinMatches: 320,
    winProbabilityCalibrationWindow: 2400,
    winProbabilityCalibrationClip: 0.04,
    winProbabilityCalibrationFeatureSet: 'bias',
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ConditionalTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=0.75 TL=40 TN=24 TC=25 F=PR G=8/R4/S8/F20/MIN',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateScoreDeltaThreshold: 8,
    learnedTailCorrectionGateMode: 'min',
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 0.75,
    learnedTailWinProbabilityClip: 35,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ConditionalTailRiskWinProb Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 TP=1.00 TL=40 TN=24 TC=25 F=PR G=8/R4/S12/F20/MIN',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateScoreDeltaThreshold: 12,
    learnedTailCorrectionGateMode: 'min',
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1,
    learnedTailWinProbabilityClip: 40,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Gated Champs-PhaseResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 E=4 M=6 RB=0.15/0.25/0 N=8 W=18 POS G=0/18/24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyScoreShift: 4,
    championshipPhaseMiddleScoreShift: 6,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseScope: 'championship',
    championshipPhaseResidualShiftEarlyWeight: 0.15,
    championshipPhaseResidualShiftMiddleWeight: 0.25,
    championshipPhaseResidualShiftLateWeight: 0,
    championshipPhaseResidualShiftMinSamples: 8,
    championshipPhaseResidualShiftWindow: 18,
    championshipPhaseResidualShiftPositiveOnly: true,
    championshipPhaseResidualShiftScope: 'championship',
    championshipTailResidualGateMinSamples: 8,
    championshipTailResidualGateWindow: 18,
    championshipTailResidualGateThreshold: 0,
    championshipTailResidualGateFullAt: 24,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Gated Champs-PhaseResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 E=4 M=6 RB=0.15/0.25/0 N=8 W=18 POS G=4/18/24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyScoreShift: 4,
    championshipPhaseMiddleScoreShift: 6,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseScope: 'championship',
    championshipPhaseResidualShiftEarlyWeight: 0.15,
    championshipPhaseResidualShiftMiddleWeight: 0.25,
    championshipPhaseResidualShiftLateWeight: 0,
    championshipPhaseResidualShiftMinSamples: 8,
    championshipPhaseResidualShiftWindow: 18,
    championshipPhaseResidualShiftPositiveOnly: true,
    championshipPhaseResidualShiftScope: 'championship',
    championshipTailResidualGateMinSamples: 8,
    championshipTailResidualGateWindow: 18,
    championshipTailResidualGateThreshold: 4,
    championshipTailResidualGateFullAt: 24,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Gated Champs-PhaseResidualBoost Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 E=4 M=6 RB=0.15/0.25/0 N=8 W=18 POS G=8/18/18',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    championshipPhaseEarlyScoreShift: 4,
    championshipPhaseMiddleScoreShift: 6,
    championshipPhaseLateScoreShift: 0,
    championshipPhaseEarlyRows: 72,
    championshipPhaseMiddleRows: 180,
    championshipPhaseScope: 'championship',
    championshipPhaseResidualShiftEarlyWeight: 0.15,
    championshipPhaseResidualShiftMiddleWeight: 0.25,
    championshipPhaseResidualShiftLateWeight: 0,
    championshipPhaseResidualShiftMinSamples: 8,
    championshipPhaseResidualShiftWindow: 18,
    championshipPhaseResidualShiftPositiveOnly: true,
    championshipPhaseResidualShiftScope: 'championship',
    championshipTailResidualGateMinSamples: 8,
    championshipTailResidualGateWindow: 18,
    championshipTailResidualGateThreshold: 8,
    championshipTailResidualGateFullAt: 18,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=60 C=35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 60,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Champs-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 A=0.10 T=8 N=12',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    eventScoreScaleWeight: 0.1,
    eventScoreScaleMinSamples: 12,
    eventScoreScaleWindow: 24,
    eventScoreScaleThreshold: 8,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championship',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Champs-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 A=0.05 T=8 N=12',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    eventScoreScaleWeight: 0.05,
    eventScoreScaleMinSamples: 12,
    eventScoreScaleWindow: 24,
    eventScoreScaleThreshold: 8,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championship',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Champs-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 A=0.20 T=8 N=12',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    eventScoreScaleWeight: 0.2,
    eventScoreScaleMinSamples: 12,
    eventScoreScaleWindow: 24,
    eventScoreScaleThreshold: 8,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championship',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ChampsDiv-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 A=0.05 T=8 N=12',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    eventScoreScaleWeight: 0.05,
    eventScoreScaleMinSamples: 12,
    eventScoreScaleWindow: 24,
    eventScoreScaleThreshold: 8,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championshipDivision',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ChampsDiv-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 A=0.15 T=8 N=12',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    eventScoreScaleWeight: 0.15,
    eventScoreScaleMinSamples: 12,
    eventScoreScaleWindow: 24,
    eventScoreScaleThreshold: 8,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championshipDivision',
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Gated Champs-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 A=0.10 T=8 N=12 G=0 F=24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    eventScoreScaleWeight: 0.1,
    eventScoreScaleMinSamples: 12,
    eventScoreScaleWindow: 24,
    eventScoreScaleThreshold: 8,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championship',
    eventScoreScaleResidualGateMinSamples: 8,
    eventScoreScaleResidualGateWindow: 18,
    eventScoreScaleResidualGateThreshold: 0,
    eventScoreScaleResidualGateFullAt: 24,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Gated Champs-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 A=0.20 T=8 N=12 G=0 F=24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    eventScoreScaleWeight: 0.2,
    eventScoreScaleMinSamples: 12,
    eventScoreScaleWindow: 24,
    eventScoreScaleThreshold: 8,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championship',
    eventScoreScaleResidualGateMinSamples: 8,
    eventScoreScaleResidualGateWindow: 18,
    eventScoreScaleResidualGateThreshold: 0,
    eventScoreScaleResidualGateFullAt: 24,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Gated Champs-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 A=0.20 T=8 N=12 G=8 F=24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    eventScoreScaleWeight: 0.2,
    eventScoreScaleMinSamples: 12,
    eventScoreScaleWindow: 24,
    eventScoreScaleThreshold: 8,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championship',
    eventScoreScaleResidualGateMinSamples: 8,
    eventScoreScaleResidualGateWindow: 18,
    eventScoreScaleResidualGateThreshold: 8,
    eventScoreScaleResidualGateFullAt: 24,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Gated ChampsDiv-Scale Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 C=40 A=0.15 T=8 N=12 G=0 F=24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    eventScoreScaleWeight: 0.15,
    eventScoreScaleMinSamples: 12,
    eventScoreScaleWindow: 24,
    eventScoreScaleThreshold: 8,
    eventScoreScalePositiveOnly: true,
    eventScoreScaleScope: 'championshipDivision',
    eventScoreScaleResidualGateMinSamples: 8,
    eventScoreScaleResidualGateWindow: 18,
    eventScoreScaleResidualGateThreshold: 0,
    eventScoreScaleResidualGateFullAt: 24,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future RoleV2 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=50 C=35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 50,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV2Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Strong RoleV2 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=70 C=35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 70,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV2Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=55 C=35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 55,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailGuarded Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.20 TL=50 TN=32 TC=20 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.2,
    learnedTailCorrectionLambda: 50,
    learnedTailCorrectionMinRows: 32,
    learnedTailCorrectionClip: 20,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  ...([0.18, 0.21, 0.22, 0.23, 0.25] as const).map((tailWeight): ModelConfig => ({
    name: `No-Future TailGuarded Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=${tailWeight.toFixed(2)} TL=50 TN=32 TC=20 F=PR G=8/R4/F20`,
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: tailWeight,
    learnedTailCorrectionLambda: 50,
    learnedTailCorrectionMinRows: 32,
    learnedTailCorrectionClip: 20,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  })),
  {
    name: 'No-Future TailGuarded Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.10 TL=50 TN=32 TC=20 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.1,
    learnedTailCorrectionLambda: 50,
    learnedTailCorrectionMinRows: 32,
    learnedTailCorrectionClip: 20,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailGuarded Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.15 TL=50 TN=32 TC=20 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.15,
    learnedTailCorrectionLambda: 50,
    learnedTailCorrectionMinRows: 32,
    learnedTailCorrectionClip: 20,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailGuard+TailRiskWinProb Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.20 TP=0.75 TL=50 TN=32 TC=20 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.2,
    learnedTailCorrectionLambda: 50,
    learnedTailCorrectionMinRows: 32,
    learnedTailCorrectionClip: 20,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailWinProbabilityWeight: 0.75,
    learnedTailWinProbabilityClip: 35,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ScoutGate Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 SG=E2/S6',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    scoutFeatureMode: 'gated',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ScoutGate TailGuarded Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.20 TL=50 TN=32 TC=20 F=PR G=8/R4/F20 SG=E2/S6',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.2,
    learnedTailCorrectionLambda: 50,
    learnedTailCorrectionMinRows: 32,
    learnedTailCorrectionClip: 20,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    scoutFeatureMode: 'gated',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ScoutGate RoleGate Strong RoleV3Gated Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 SG=E2/S6 RG=C0.35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    scoutFeatureMode: 'gated',
    useRoleFeatures: false,
    useRoleV3Features: false,
    useRoleV3GatedFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ScoutGate RoleGate TailGuarded Strong RoleV3Gated Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.20 TL=50 TN=32 TC=20 F=PR G=8/R4/F20 SG=E2/S6 RG=C0.35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.2,
    learnedTailCorrectionLambda: 50,
    learnedTailCorrectionMinRows: 32,
    learnedTailCorrectionClip: 20,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    scoutFeatureMode: 'gated',
    useRoleFeatures: false,
    useRoleV3Features: false,
    useRoleV3GatedFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailGuard+SmoothTailRiskWinProb Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.20 TP=0.75 TL=50 TN=32 TC=20 F=PR G=8/R4/F20 MR=35 PR=0.25 SF=0.50',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.2,
    learnedTailCorrectionLambda: 50,
    learnedTailCorrectionMinRows: 32,
    learnedTailCorrectionClip: 20,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailWinProbabilityWeight: 0.75,
    learnedTailWinProbabilityClip: 35,
    learnedTailWinProbabilityMarginRamp: 35,
    learnedTailWinProbabilityConfidenceRamp: 0.25,
    learnedTailWinProbabilityShrinkFloor: 0.5,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailGuard+SmoothTailRiskWinProb Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.20 TP=1.25 TL=50 TN=32 TC=20 F=PR G=8/R4/F20 MR=35 PR=0.25 SF=0.50',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.2,
    learnedTailCorrectionLambda: 50,
    learnedTailCorrectionMinRows: 32,
    learnedTailCorrectionClip: 20,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    learnedTailWinProbabilityMarginRamp: 35,
    learnedTailWinProbabilityConfidenceRamp: 0.25,
    learnedTailWinProbabilityShrinkFloor: 0.5,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailGuarded Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.35 TL=40 TN=24 TC=25 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future SelectiveTailGuarded Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TW=0.35 TL=40 TN=24 TC=25 F=PR G=12/R8/S10/MIN/F28',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 12,
    learnedTailCorrectionGateWindow: 24,
    learnedTailCorrectionGateResidualThreshold: 8,
    learnedTailCorrectionGateScoreDeltaThreshold: 10,
    learnedTailCorrectionGateMode: 'min',
    learnedTailCorrectionGateFullAt: 28,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailRiskWinProb Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TP=0.75 TL=40 TN=24 TC=25 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 0.75,
    learnedTailWinProbabilityClip: 35,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future TailRiskWinProb Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35 TP=1.25 TL=40 TN=24 TC=25 F=PR G=8/R4/F20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    simulationSeedName:
      'No-Future Strong RoleV3 Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=75 C=35',
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    learnedTailCorrectionWeight: 0.35,
    learnedTailCorrectionLambda: 40,
    learnedTailCorrectionMinRows: 24,
    learnedTailCorrectionClip: 25,
    learnedTailCorrectionScope: 'championship',
    learnedTailCorrectionFeatureSet: 'phaseResidual',
    learnedTailCorrectionGateMinSamples: 8,
    learnedTailCorrectionGateWindow: 18,
    learnedTailCorrectionGateResidualThreshold: 4,
    learnedTailCorrectionGateFullAt: 20,
    learnedTailCorrectionApplyToMean: false,
    learnedTailWinProbabilityWeight: 1.25,
    learnedTailWinProbabilityClip: 45,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 75,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useRoleV3Features: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Role-Feature Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=40 C=35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 40,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Strong Role-Feature Residual-Ridge Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.40 L=60 C=35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.4,
    residualCorrectionLambda: 60,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Tree Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 TW=0.20 N=720 T=16 C=45',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualTreeCorrectionWeight: 0.2,
    residualTreeCorrectionMinRows: 720,
    residualTreeCorrectionRefitRows: 480,
    residualTreeCorrectionSampleRows: 5000,
    residualTreeCorrectionTrees: 16,
    residualTreeCorrectionLearningRate: 0.12,
    residualTreeCorrectionClip: 45,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Tree Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 TW=0.35 N=720 T=24 C=45',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualTreeCorrectionWeight: 0.35,
    residualTreeCorrectionMinRows: 720,
    residualTreeCorrectionRefitRows: 480,
    residualTreeCorrectionSampleRows: 5000,
    residualTreeCorrectionTrees: 24,
    residualTreeCorrectionLearningRate: 0.1,
    residualTreeCorrectionClip: 45,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Role-Feature Residual-Tree Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 TW=0.25 N=720 T=24 C=45',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualTreeCorrectionWeight: 0.25,
    residualTreeCorrectionMinRows: 720,
    residualTreeCorrectionRefitRows: 480,
    residualTreeCorrectionSampleRows: 5000,
    residualTreeCorrectionTrees: 24,
    residualTreeCorrectionLearningRate: 0.1,
    residualTreeCorrectionClip: 45,
    featureSet: 'compact',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Ridge+Tree Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=30 TW=0.15 N=720 T=16 C=35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 30,
    residualCorrectionMinRows: 360,
    residualCorrectionClip: 40,
    residualTreeCorrectionWeight: 0.15,
    residualTreeCorrectionMinRows: 720,
    residualTreeCorrectionRefitRows: 480,
    residualTreeCorrectionSampleRows: 5000,
    residualTreeCorrectionTrees: 16,
    residualTreeCorrectionLearningRate: 0.1,
    residualTreeCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Residual-Ridge Component Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 RW=0.25 L=40 C=35 CP=0.10 CM=4',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    componentPriorWeight: 0.1,
    componentPriorMinMatches: 4,
    residualCorrectionWeight: 0.25,
    residualCorrectionLambda: 40,
    residualCorrectionMinRows: 480,
    residualCorrectionClip: 35,
    featureSet: 'compact',
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Type-Residual Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 T=0.05 M=40',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventTypeResidualShiftWeight: 0.05,
    eventTypeResidualShiftMinSamples: 40,
    eventTypeResidualShiftWindow: 120,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Type-Residual Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 T=0.10 M=40',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventTypeResidualShiftWeight: 0.1,
    eventTypeResidualShiftMinSamples: 40,
    eventTypeResidualShiftWindow: 120,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Type-Residual Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 T=0.15 M=60',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventTypeResidualShiftWeight: 0.15,
    eventTypeResidualShiftMinSamples: 60,
    eventTypeResidualShiftWindow: 160,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Role-Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 R=0.05',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    roleSimulationScale: 0.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Role-Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 R=0.10',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    roleSimulationScale: 0.1,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Role-Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 R=0.15',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    roleSimulationScale: 0.15,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Light-Role-Scaled-Archetype Ensemble K=1.10 W=0.10 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 R=0.15',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    roleSimulationScale: 0.15,
    ensembleMonteCarloWeight: 0.1,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.80',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalTargetCoverage: 0.8,
    conformalMinSamples: 160,
    conformalWindow: 1000,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.84',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalTargetCoverage: 0.84,
    conformalMinSamples: 160,
    conformalWindow: 1000,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.88',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalTargetCoverage: 0.88,
    conformalMinSamples: 160,
    conformalWindow: 1000,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.80',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalIntervalMode: 'widen',
    conformalTargetCoverage: 0.8,
    conformalMinSamples: 160,
    conformalWindow: 1000,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.84',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalIntervalMode: 'widen',
    conformalTargetCoverage: 0.84,
    conformalMinSamples: 160,
    conformalWindow: 1000,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.88',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalIntervalMode: 'widen',
    conformalTargetCoverage: 0.88,
    conformalMinSamples: 160,
    conformalWindow: 1000,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.80',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalIntervalMode: 'widen',
    conformalScope: 'season',
    conformalTargetCoverage: 0.8,
    conformalMinSamples: 120,
    conformalWindow: 700,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Phase-Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.80',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalIntervalMode: 'widen',
    conformalScope: 'eventProgress',
    conformalTargetCoverage: 0.8,
    conformalMinSamples: 120,
    conformalWindow: 700,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Event-Phase-Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.80',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalIntervalMode: 'widen',
    conformalScope: 'seasonEventProgress',
    conformalTargetCoverage: 0.8,
    conformalMinSamples: 80,
    conformalWindow: 500,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Event-Phase-Widening-Conformal Scaled-Archetype Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 CR=0.100 DR=0.050 Q=0.84',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    championshipDivisionScoreShiftRatio: 0.1,
    championshipEventScoreShiftRatio: 0.05,
    conformalInterval: true,
    conformalIntervalMode: 'widen',
    conformalScope: 'seasonEventProgress',
    conformalTargetCoverage: 0.84,
    conformalMinSamples: 80,
    conformalWindow: 500,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Scale Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 A=0.20',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventScoreScaleWeight: 0.2,
    eventScoreScaleMinSamples: 10,
    eventScoreScaleWindow: 30,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Scale Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 A=0.05 N=24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventScoreScaleWeight: 0.05,
    eventScoreScaleMinSamples: 24,
    eventScoreScaleWindow: 36,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Scale Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 A=0.10 N=24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventScoreScaleWeight: 0.1,
    eventScoreScaleMinSamples: 24,
    eventScoreScaleWindow: 36,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future High-Event-Scale Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 A=0.10 T=10 N=24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventScoreScaleWeight: 0.1,
    eventScoreScaleMinSamples: 24,
    eventScoreScaleWindow: 36,
    eventScoreScaleThreshold: 10,
    eventScoreScalePositiveOnly: true,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future High-Event-Scale Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 A=0.15 T=10 N=24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventScoreScaleWeight: 0.15,
    eventScoreScaleMinSamples: 24,
    eventScoreScaleWindow: 36,
    eventScoreScaleThreshold: 10,
    eventScoreScalePositiveOnly: true,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future High-Event-Scale Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 A=0.20 T=15 N=24',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventScoreScaleWeight: 0.2,
    eventScoreScaleMinSamples: 24,
    eventScoreScaleWindow: 36,
    eventScoreScaleThreshold: 15,
    eventScoreScalePositiveOnly: true,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future High-Event-Scale Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 A=0.10 T=15 N=36',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventScoreScaleWeight: 0.1,
    eventScoreScaleMinSamples: 36,
    eventScoreScaleWindow: 48,
    eventScoreScaleThreshold: 15,
    eventScoreScalePositiveOnly: true,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Scale Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 A=0.35',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventScoreScaleWeight: 0.35,
    eventScoreScaleMinSamples: 10,
    eventScoreScaleWindow: 30,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Scale Ensemble K=1.10 W=0.20 P=0.00 S=0.15 M=8 A=0.50',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.15,
    eventResidualShiftMinSamples: 8,
    eventResidualShiftWindow: 18,
    eventScoreScaleWeight: 0.5,
    eventScoreScaleMinSamples: 10,
    eventScoreScaleWindow: 30,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.20 M=12',
    family: 'ensembleEpa',
    lambda: 1.1,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.2,
    eventResidualShiftMinSamples: 12,
    eventResidualShiftWindow: 24,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Shift Ensemble K=1.10 W=0.20 P=0.00 S=0.25 I=1.05',
    family: 'ensembleEpa',
    lambda: 1.1,
    intervalScale: 1.05,
    seasonDecay: 0,
    simulationCount: 120,
    teamUncertaintyScale: 0.9,
    scoreNoiseScale: 1.05,
    ensembleMonteCarloWeight: 0.2,
    ensembleMonteCarloWinWeight: 0,
    eventResidualShiftWeight: 0.25,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Batch OPR L2=1',
    family: 'opr',
    lambda: 1,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Batch OPR L2=10',
    family: 'opr',
    lambda: 10,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Online EPA K=0.35',
    family: 'onlineEpa',
    lambda: 0.35,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Online EPA K=0.45',
    family: 'onlineEpa',
    lambda: 0.45,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Online EPA K=0.60',
    family: 'onlineEpa',
    lambda: 0.6,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Online EPA K=0.80',
    family: 'onlineEpa',
    lambda: 0.8,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Role EPA K=0.60',
    family: 'onlineEpa',
    lambda: 0.6,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Online EPA K=1.00',
    family: 'onlineEpa',
    lambda: 1,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Online EPA K=1.00 I=1.10',
    family: 'onlineEpa',
    lambda: 1,
    intervalScale: 1.1,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Online EPA K=1.20',
    family: 'onlineEpa',
    lambda: 1.2,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Online EPA K=1.20 I=1.10',
    family: 'onlineEpa',
    lambda: 1.2,
    intervalScale: 1.1,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=1.00',
    family: 'onlineEpa',
    lambda: 1,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=0.90',
    family: 'onlineEpa',
    lambda: 0.9,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=1.05',
    family: 'onlineEpa',
    lambda: 1.05,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=1.03',
    family: 'onlineEpa',
    lambda: 1.03,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=1.03 I=1.05',
    family: 'onlineEpa',
    lambda: 1.03,
    intervalScale: 1.05,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=1.07',
    family: 'onlineEpa',
    lambda: 1.07,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Blend EPA K=1.03 E=0.25',
    family: 'onlineEpa',
    lambda: 1.03,
    seasonDecay: 0,
    eventAdjustmentScale: 0.25,
    eventLearningRate: 0.8,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Blend EPA K=1.03 E=0.50',
    family: 'onlineEpa',
    lambda: 1.03,
    seasonDecay: 0,
    eventAdjustmentScale: 0.5,
    eventLearningRate: 0.8,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Event-Blend EPA K=1.03 E=0.75',
    family: 'onlineEpa',
    lambda: 1.03,
    seasonDecay: 0,
    eventAdjustmentScale: 0.75,
    eventLearningRate: 0.8,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=1.10',
    family: 'onlineEpa',
    lambda: 1.1,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=1.10 I=1.05',
    family: 'onlineEpa',
    lambda: 1.1,
    intervalScale: 1.05,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=1.10 I=1.10',
    family: 'onlineEpa',
    lambda: 1.1,
    intervalScale: 1.1,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Relative Season EPA K=1.00',
    family: 'relativeEpa',
    lambda: 1,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Relative Season EPA K=1.10',
    family: 'relativeEpa',
    lambda: 1.1,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Relative Season EPA K=1.20',
    family: 'relativeEpa',
    lambda: 1.2,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Relative Season EPA K=1.10 I=1.05',
    family: 'relativeEpa',
    lambda: 1.1,
    intervalScale: 1.05,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=1.20',
    family: 'onlineEpa',
    lambda: 1.2,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Calibrated EPA K=0.80 I=1.25',
    family: 'onlineEpa',
    lambda: 0.8,
    intervalScale: 1.25,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Online EPA K=1.00 I=1.25',
    family: 'onlineEpa',
    lambda: 1,
    intervalScale: 1.25,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Decay EPA K=0.80 D=0.35 I=1.25',
    family: 'onlineEpa',
    lambda: 0.8,
    intervalScale: 1.25,
    seasonDecay: 0.35,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Season-Reset EPA K=0.80 I=1.25',
    family: 'onlineEpa',
    lambda: 0.8,
    intervalScale: 1.25,
    seasonDecay: 0,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Role EPA K=0.80',
    family: 'onlineEpa',
    lambda: 0.8,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Soft-Role EPA K=0.80 R=0.25',
    family: 'onlineEpa',
    lambda: 0.8,
    roleAdjustmentScale: 0.25,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Soft-Role EPA K=0.80 R=0.50',
    family: 'onlineEpa',
    lambda: 0.8,
    roleAdjustmentScale: 0.5,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Dual EPA K=0.80 D=0.35',
    family: 'onlineDualEpa',
    lambda: 0.8,
    defenseLearningRate: 0.35,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Dual EPA K=1.00 D=0.50',
    family: 'onlineDualEpa',
    lambda: 1,
    defenseLearningRate: 0.5,
    useRoleFeatures: false,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Ridge L2=0.3',
    family: 'ridge',
    lambda: 0.3,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Ridge L2=1',
    family: 'ridge',
    lambda: 1,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Compact Ridge L2=10',
    family: 'ridge',
    lambda: 10,
    featureSet: 'compact',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Compact Elastic Net a=0.5 L=0.04',
    family: 'elasticNet',
    lambda: 0.04,
    alpha: 0.5,
    featureSet: 'compact',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Compact Robust Ridge L2=10',
    family: 'huberRidge',
    lambda: 10,
    featureSet: 'compact',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ScoutGate Compact Ridge L2=10 SG=E2/S6',
    family: 'ridge',
    lambda: 10,
    featureSet: 'compact',
    scoutFeatureMode: 'gated',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future ScoutGate Compact Robust Ridge L2=10 SG=E2/S6',
    family: 'huberRidge',
    lambda: 10,
    featureSet: 'compact',
    scoutFeatureMode: 'gated',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Minimal Ridge L2=10',
    family: 'ridge',
    lambda: 10,
    featureSet: 'minimal',
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Ridge L2=3',
    family: 'ridge',
    lambda: 3,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Ridge L2=15',
    family: 'ridge',
    lambda: 15,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Ridge L2=50',
    family: 'ridge',
    lambda: 50,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Elastic Net a=0.25 L=0.02',
    family: 'elasticNet',
    lambda: 0.02,
    alpha: 0.25,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Elastic Net a=0.60 L=0.04',
    family: 'elasticNet',
    lambda: 0.04,
    alpha: 0.6,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Robust Ridge L2=10',
    family: 'huberRidge',
    lambda: 10,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future KNN k=25',
    family: 'knn',
    k: 25,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'No-Future Kernel bw=4',
    family: 'kernel',
    bandwidth: 4,
    useRoleFeatures: true,
    useContextEpa: false,
    eligibleForPromotion: true,
    leakageRisk: 'low'
  },
  {
    name: 'Context EPA Ridge L2=15',
    family: 'ridge',
    lambda: 15,
    useRoleFeatures: true,
    useContextEpa: true,
    eligibleForPromotion: false,
    leakageRisk: 'medium'
  }
];

const RIDGE_PRUNED_FEATURES = new Set([
  'season_offset',
  'offense_gap',
  'event_offense_gap',
  'recent_offense_gap',
  'defense_gap',
  'foul_risk_gap',
  'epa_gap',
  'experience_gap',
  'role_adjusted_expected_score',
  'own_event_offense_sum',
  'opp_event_offense_sum',
  'own_experience_min',
  'opp_experience_min',
  'own_season_matches_sum',
  'opp_season_matches_sum',
  'own_role_net_swing',
  'opp_role_net_swing'
]);

const COMPACT_PRUNED_FEATURES = new Set([
  'is_playoff',
  'match_number_log',
  'own_event_matches_sum',
  'opp_event_matches_sum',
  'own_recent_offense_sum',
  'opp_recent_offense_sum',
  'own_volatility_mean',
  'opp_volatility_mean'
]);

const MINIMAL_FEATURES = new Set([
  'season_average_alliance_score',
  'own_season_offense_sum',
  'opp_season_offense_sum',
  'own_defense_denial_sum',
  'opp_defense_denial_sum',
  'own_foul_risk_sum',
  'opp_foul_risk_sum',
  'own_scout_offense_sum',
  'opp_scout_offense_sum',
  'own_scout_defense_sum',
  'opp_scout_defense_sum',
  'own_role_offense_cost',
  'opp_role_offense_cost',
  'own_role_defense_value',
  'opp_role_defense_value',
  'own_role_foul_risk',
  'opp_role_foul_risk',
  'own_reliability_penalty_sum',
  'opp_reliability_penalty_sum'
]);

const isRoleFeature = (feature: string) => feature.includes('_role_') || feature.startsWith('role_');
const isRoleV2Feature = (feature: string) => feature.includes('_role_v2_') || feature.startsWith('role_v2_');
const isRoleV3GatedFeature = (feature: string) =>
  feature.includes('_role_v3_gated_') || feature.startsWith('role_v3_gated_');
const isRoleV3Feature = (feature: string) =>
  !isRoleV3GatedFeature(feature) && (feature.includes('_role_v3_') || feature.startsWith('role_v3_'));
const isRawScoutFeature = (feature: string) =>
  feature === 'own_scout_offense_sum' ||
  feature === 'opp_scout_offense_sum' ||
  feature === 'own_scout_defense_sum' ||
  feature === 'opp_scout_defense_sum';
const isGatedScoutFeature = (feature: string) =>
  feature.includes('_scout_gated_') ||
  feature.includes('_scout_offense_samples_') ||
  feature.includes('_scout_defense_samples_') ||
  feature.includes('_scout_offense_confidence_') ||
  feature.includes('_scout_defense_confidence_') ||
  feature === 'scout_gated_offense_gap' ||
  feature === 'scout_gated_defense_gap' ||
  feature === 'scout_coverage_gap';

const shouldKeepScoutFeature = (feature: string, config: ModelConfig) => {
  const scoutFeatureMode = config.scoutFeatureMode ?? 'raw';
  if (isRawScoutFeature(feature)) return scoutFeatureMode === 'raw' || scoutFeatureMode === 'rawAndGated';
  if (isGatedScoutFeature(feature)) return scoutFeatureMode === 'gated' || scoutFeatureMode === 'rawAndGated';
  return true;
};

const selectFeatureNames = (dataset: WalkForwardDataset, config: ModelConfig) =>
  config.family === 'opr' ||
  config.family === 'onlineEpa' ||
  config.family === 'relativeEpa' ||
  config.family === 'onlineDualEpa' ||
  config.family === 'monteCarloEpa' ||
  config.family === 'ensembleEpa' ||
  config.family === 'sourcePrediction'
    ? []
    : dataset.featureNames.filter(feature => {
        if (!shouldKeepScoutFeature(feature, config)) return false;
        if (isRoleV3GatedFeature(feature)) return config.useRoleV3GatedFeatures === true;
        if (isRoleV3Feature(feature)) return config.useRoleV3Features === true;
        if (isRoleV2Feature(feature)) return config.useRoleV2Features === true;
        if (!config.useRoleFeatures && isRoleFeature(feature)) return false;
        if (!config.useContextEpa && feature.includes('statbotics')) return false;
        if (
          (config.family === 'ridge' || config.family === 'elasticNet' || config.family === 'huberRidge') &&
          RIDGE_PRUNED_FEATURES.has(feature)
        ) {
          return false;
        }
        if (config.featureSet === 'compact' && COMPACT_PRUNED_FEATURES.has(feature)) return false;
        if (config.featureSet === 'minimal' && !MINIMAL_FEATURES.has(feature)) return false;
        return true;
      });

const selectResidualFeatureNames = (dataset: WalkForwardDataset, config: ModelConfig) =>
  dataset.featureNames.filter(feature => {
    if (!shouldKeepScoutFeature(feature, config)) return false;
    if (isRoleV3GatedFeature(feature)) return config.useRoleV3GatedFeatures === true;
    if (isRoleV3Feature(feature)) return config.useRoleV3Features === true;
    if (isRoleV2Feature(feature)) return config.useRoleV2Features === true;
    if (!config.useRoleFeatures && isRoleFeature(feature)) return false;
    if (!config.useContextEpa && feature.includes('statbotics')) return false;
    if (RIDGE_PRUNED_FEATURES.has(feature)) return false;
    if (config.featureSet === 'compact' && COMPACT_PRUNED_FEATURES.has(feature)) return false;
    if (config.featureSet === 'minimal' && !MINIMAL_FEATURES.has(feature)) return false;
    return true;
  });

const isOnlineRatingFamily = (family: ModelConfig['family']) =>
  family === 'onlineEpa' ||
  family === 'relativeEpa' ||
  family === 'onlineDualEpa' ||
  family === 'monteCarloEpa' ||
  family === 'ensembleEpa';

interface FittedModel {
  family: 'linear' | 'memory';
  coefficients: number[];
  featureMeans: number[];
  featureSds: number[];
  trainingVectors: number[][];
  trainingTargets: number[];
  residualSd: number;
}

interface ResidualRidgeAccumulator {
  featureNames: string[];
  count: number;
  targetSum: number;
  targetSquaredSum: number;
  featureSums: number[];
  featureSquaredSums: number[];
  featureTargetSums: number[];
  featureCrossSums: number[][];
}

interface ResidualTreeExample {
  values: number[];
  target: number;
}

interface ResidualStump {
  featureIndex: number;
  threshold: number;
  leftValue: number;
  rightValue: number;
}

interface ResidualTreeEnsemble {
  featureNames: string[];
  intercept: number;
  stumps: ResidualStump[];
  residualSd: number;
}

const vectorize = (row: FeatureRow, featureNames: string[], means: number[] = [], sds: number[] = []) => {
  const values = featureNames.map((feature, index) => {
    const raw = row.features[feature] ?? 0;
    const sd = sds[index] ?? 1;
    if (sd <= 1e-9) return 0;
    return (raw - (means[index] ?? 0)) / sd;
  });
  return [1, ...values];
};

const predictLinear = (
  row: FeatureRow,
  featureNames: string[],
  coefficients: number[],
  means: number[],
  sds: number[]
) => {
  const vector = vectorize(row, featureNames, means, sds);
  return clamp(
    vector.reduce((sum, value, index) => sum + value * (coefficients[index] ?? 0), 0),
    0,
    MAX_REASONABLE_FRC_SCORE
  );
};

const predictLinearRaw = (
  row: FeatureRow,
  featureNames: string[],
  coefficients: number[],
  means: number[],
  sds: number[]
) => {
  const vector = vectorize(row, featureNames, means, sds);
  return vector.reduce((sum, value, index) => sum + value * (coefficients[index] ?? 0), 0);
};

const fitWeightedRidge = (
  rows: FeatureRow[],
  featureNames: string[],
  lambda: number,
  weights?: number[]
): FittedModel | null => {
  if (rows.length < Math.max(20, featureNames.length + 5)) return null;
  const featureMeans = featureNames.map(feature => mean(rows.map(row => row.features[feature] ?? 0)));
  const featureSds = featureNames.map(feature => Math.max(standardDeviation(rows.map(row => row.features[feature] ?? 0)), 1e-6));
  const x = rows.map((row, index) => {
    const scale = Math.sqrt(Math.max(0.0001, weights?.[index] ?? 1));
    return vectorize(row, featureNames, featureMeans, featureSds).map(value => value * scale);
  });
  const y = rows.map((row, index) => row.targetScore * Math.sqrt(Math.max(0.0001, weights?.[index] ?? 1)));
  const matrix = new Matrix(x);
  const target = Matrix.columnVector(y);
  const xt = matrix.transpose();
  const xtx = xt.mmul(matrix);
  const penalty = Matrix.eye(xtx.rows, xtx.columns).mul(lambda);
  penalty.set(0, 0, 0);
  const coefficients = solve(xtx.add(penalty), xt.mmul(target)).to1DArray();
  const residuals = rows.map(row => row.targetScore - predictLinear(row, featureNames, coefficients, featureMeans, featureSds));
  return {
    family: 'linear',
    coefficients,
    featureMeans,
    featureSds,
    trainingVectors: [],
    trainingTargets: [],
    residualSd: Math.max(6, standardDeviation(residuals))
  };
};

const fitRidge = (rows: FeatureRow[], featureNames: string[], lambda: number): FittedModel | null =>
  fitWeightedRidge(rows, featureNames, lambda);

const createResidualRidgeAccumulator = (featureNames: string[]): ResidualRidgeAccumulator => ({
  featureNames,
  count: 0,
  targetSum: 0,
  targetSquaredSum: 0,
  featureSums: featureNames.map(() => 0),
  featureSquaredSums: featureNames.map(() => 0),
  featureTargetSums: featureNames.map(() => 0),
  featureCrossSums: featureNames.map((_, index) => Array.from({ length: index + 1 }, () => 0))
});

const recordResidualRidgeExample = (accumulator: ResidualRidgeAccumulator, row: FeatureRow, residual: number) => {
  const values = accumulator.featureNames.map(feature => row.features[feature] ?? 0);
  accumulator.count += 1;
  accumulator.targetSum += residual;
  accumulator.targetSquaredSum += residual ** 2;
  values.forEach((value, index) => {
    accumulator.featureSums[index] = (accumulator.featureSums[index] ?? 0) + value;
    accumulator.featureSquaredSums[index] = (accumulator.featureSquaredSums[index] ?? 0) + value ** 2;
    accumulator.featureTargetSums[index] = (accumulator.featureTargetSums[index] ?? 0) + value * residual;
    const crossSums = accumulator.featureCrossSums[index]!;
    for (let crossIndex = 0; crossIndex <= index; crossIndex += 1) {
      crossSums[crossIndex] = (crossSums[crossIndex] ?? 0) + value * (values[crossIndex] ?? 0);
    }
  });
};

const getResidualRawCrossSum = (accumulator: ResidualRidgeAccumulator, left: number, right: number) =>
  left >= right
    ? accumulator.featureCrossSums[left]?.[right] ?? 0
    : accumulator.featureCrossSums[right]?.[left] ?? 0;

const fitResidualRidgeFromAccumulator = (
  accumulator: ResidualRidgeAccumulator,
  lambda: number,
  minRows: number
): FittedModel | null => {
  const featureNames = accumulator.featureNames;
  const count = accumulator.count;
  if (count < Math.max(minRows, featureNames.length + 12)) return null;
  const featureMeans = accumulator.featureSums.map(sum => sum / count);
  const featureSds = accumulator.featureSums.map((sum, index) => {
    const meanValue = featureMeans[index] ?? 0;
    const centeredSquares = Math.max(0, (accumulator.featureSquaredSums[index] ?? 0) - count * meanValue ** 2);
    return Math.max(Math.sqrt(centeredSquares / Math.max(1, count - 1)), 1e-6);
  });
  const dimension = featureNames.length + 1;
  const xtx = Array.from({ length: dimension }, () => Array.from({ length: dimension }, () => 0));
  const xty = Array.from({ length: dimension }, () => 0);
  const columnSums = Array.from({ length: dimension }, () => 0);
  xtx[0]![0] = count;
  xty[0] = accumulator.targetSum;
  columnSums[0] = count;
  featureNames.forEach((_, featureIndex) => {
    const matrixIndex = featureIndex + 1;
    const meanValue = featureMeans[featureIndex] ?? 0;
    const sd = featureSds[featureIndex] ?? 1;
    const zSum = ((accumulator.featureSums[featureIndex] ?? 0) - count * meanValue) / sd;
    const zTargetSum = ((accumulator.featureTargetSums[featureIndex] ?? 0) - meanValue * accumulator.targetSum) / sd;
    xtx[0]![matrixIndex] = zSum;
    xtx[matrixIndex]![0] = zSum;
    xty[matrixIndex] = zTargetSum;
    columnSums[matrixIndex] = zSum;
  });
  featureNames.forEach((_, leftIndex) => {
    const leftMean = featureMeans[leftIndex] ?? 0;
    const leftSd = featureSds[leftIndex] ?? 1;
    for (let rightIndex = 0; rightIndex < featureNames.length; rightIndex += 1) {
      const rightMean = featureMeans[rightIndex] ?? 0;
      const rightSd = featureSds[rightIndex] ?? 1;
      const rawCrossSum = getResidualRawCrossSum(accumulator, leftIndex, rightIndex);
      const centeredCrossSum =
        rawCrossSum -
        rightMean * (accumulator.featureSums[leftIndex] ?? 0) -
        leftMean * (accumulator.featureSums[rightIndex] ?? 0) +
        count * leftMean * rightMean;
      xtx[leftIndex + 1]![rightIndex + 1] = centeredCrossSum / (leftSd * rightSd);
    }
  });
  const matrix = new Matrix(xtx);
  const penalty = Matrix.eye(dimension, dimension).mul(lambda);
  penalty.set(0, 0, 0);
  const coefficients = solve(matrix.add(penalty), Matrix.columnVector(xty)).to1DArray();
  const betaXtY = coefficients.reduce((sum, coefficient, index) => sum + coefficient * (xty[index] ?? 0), 0);
  const betaXtXBeta = coefficients.reduce(
    (sum, leftCoefficient, leftIndex) =>
      sum +
      coefficients.reduce(
        (innerSum, rightCoefficient, rightIndex) =>
          innerSum + leftCoefficient * (xtx[leftIndex]?.[rightIndex] ?? 0) * rightCoefficient,
        0
      ),
    0
  );
  const residualSum =
    accumulator.targetSum -
    coefficients.reduce((sum, coefficient, index) => sum + coefficient * (columnSums[index] ?? 0), 0);
  const residualSquaredSum = Math.max(0, accumulator.targetSquaredSum - 2 * betaXtY + betaXtXBeta);
  const residualVariance = Math.max(
    0,
    (residualSquaredSum - residualSum ** 2 / Math.max(1, count)) / Math.max(1, count - 1)
  );
  return {
    family: 'linear',
    coefficients,
    featureMeans,
    featureSds,
    trainingVectors: [],
    trainingTargets: [],
    residualSd: Math.max(6, Math.sqrt(residualVariance))
  };
};

const selectResidualTreeFeatureIndexes = (examples: ResidualTreeExample[], maxFeatures: number) => {
  const featureCount = examples[0]?.values.length ?? 0;
  const targetMean = mean(examples.map(example => example.target));
  const targetVariance = Math.max(
    1e-9,
    mean(examples.map(example => (example.target - targetMean) ** 2))
  );
  return Array.from({ length: featureCount }, (_, featureIndex) => {
    const values = examples.map(example => example.values[featureIndex] ?? 0);
    const valueMean = mean(values);
    const variance = mean(values.map(value => (value - valueMean) ** 2));
    const covariance = mean(
      values.map((value, index) => (value - valueMean) * ((examples[index]?.target ?? 0) - targetMean))
    );
    return {
      featureIndex,
      score: variance <= 1e-9 ? 0 : Math.abs(covariance) / Math.sqrt(variance * targetVariance)
    };
  })
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, maxFeatures)
    .map(item => item.featureIndex);
};

const residualTreeThresholds = (examples: ResidualTreeExample[], featureIndex: number) => {
  const values = examples
    .map(example => example.values[featureIndex] ?? 0)
    .filter(value => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (values.length < 2 || values[0] === values[values.length - 1]) return [];
  return Array.from(
    new Set(
      [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map(probability => quantile(values, probability))
    )
  ).filter(threshold => threshold > (values[0] ?? 0) && threshold < (values[values.length - 1] ?? 0));
};

const fitResidualTreeEnsemble = (
  examples: ResidualTreeExample[],
  featureNames: string[],
  config: ModelConfig
): ResidualTreeEnsemble | null => {
  const minRows = Math.max(40, Math.floor(config.residualTreeCorrectionMinRows ?? 720));
  if (examples.length < Math.max(minRows, 12) || featureNames.length === 0) return null;
  const treeCount = Math.max(1, Math.floor(config.residualTreeCorrectionTrees ?? 18));
  const learningRate = clamp(config.residualTreeCorrectionLearningRate ?? 0.12, 0.01, 0.5);
  const maxFeatures = Math.min(featureNames.length, 24);
  const candidateFeatureIndexes = selectResidualTreeFeatureIndexes(examples, maxFeatures);
  if (candidateFeatureIndexes.length === 0) return null;
  const thresholdsByFeature = new Map(
    candidateFeatureIndexes.map(featureIndex => [featureIndex, residualTreeThresholds(examples, featureIndex)])
  );
  const targets = examples.map(example => example.target);
  const intercept = mean(targets);
  const residuals = targets.map(target => target - intercept);
  const stumps: ResidualStump[] = [];

  for (let treeIndex = 0; treeIndex < treeCount; treeIndex += 1) {
    let best:
      | {
          featureIndex: number;
          threshold: number;
          leftValue: number;
          rightValue: number;
          sse: number;
        }
      | null = null;
    const totalSquaredResidual = residuals.reduce((total, residual) => total + residual ** 2, 0);
    const minSideCount = Math.max(12, Math.floor(examples.length * 0.04));

    candidateFeatureIndexes.forEach(featureIndex => {
      const thresholds = thresholdsByFeature.get(featureIndex) ?? [];
      thresholds.forEach(threshold => {
        let leftCount = 0;
        let rightCount = 0;
        let leftSum = 0;
        let rightSum = 0;
        residuals.forEach((residual, index) => {
          if ((examples[index]?.values[featureIndex] ?? 0) <= threshold) {
            leftCount += 1;
            leftSum += residual;
          } else {
            rightCount += 1;
            rightSum += residual;
          }
        });
        if (leftCount < minSideCount || rightCount < minSideCount) return;
        const leftMean = leftSum / leftCount;
        const rightMean = rightSum / rightCount;
        const sse =
          totalSquaredResidual -
          leftSum ** 2 / Math.max(1, leftCount) -
          rightSum ** 2 / Math.max(1, rightCount);
        if (best == null || sse < best.sse) {
          best = {
            featureIndex,
            threshold,
            leftValue: leftMean * learningRate,
            rightValue: rightMean * learningRate,
            sse
          };
        }
      });
    });

    const selected = best as
      | {
          featureIndex: number;
          threshold: number;
          leftValue: number;
          rightValue: number;
          sse: number;
        }
      | null;
    if (selected == null || selected.sse >= totalSquaredResidual - 1e-6) break;
    residuals.forEach((_, index) => {
      const value = examples[index]?.values[selected.featureIndex] ?? 0;
      residuals[index] = (residuals[index] ?? 0) - (value <= selected.threshold ? selected.leftValue : selected.rightValue);
    });
    stumps.push(selected);
  }

  if (stumps.length === 0) return null;
  return {
    featureNames,
    intercept,
    stumps,
    residualSd: Math.max(6, standardDeviation(residuals))
  };
};

const predictResidualTree = (row: FeatureRow, ensemble: ResidualTreeEnsemble) =>
  ensemble.stumps.reduce((prediction, stump) => {
    const featureName = ensemble.featureNames[stump.featureIndex] ?? '';
    const value = row.features[featureName] ?? 0;
    return prediction + (value <= stump.threshold ? stump.leftValue : stump.rightValue);
  }, ensemble.intercept);

const recordResidualTreeExample = (
  examples: ResidualTreeExample[],
  row: FeatureRow,
  featureNames: string[],
  residual: number,
  maxRows: number
) => {
  examples.push({
    values: featureNames.map(feature => row.features[feature] ?? 0),
    target: residual
  });
  const overflow = examples.length - maxRows;
  if (overflow > 0) examples.splice(0, overflow);
};

const softThreshold = (value: number, penalty: number) => {
  if (value > penalty) return value - penalty;
  if (value < -penalty) return value + penalty;
  return 0;
};

const fitElasticNet = (
  rows: FeatureRow[],
  featureNames: string[],
  lambda: number,
  alpha: number
): FittedModel | null => {
  if (rows.length < Math.max(30, featureNames.length + 8)) return null;
  const featureMeans = featureNames.map(feature => mean(rows.map(row => row.features[feature] ?? 0)));
  const featureSds = featureNames.map(feature => Math.max(standardDeviation(rows.map(row => row.features[feature] ?? 0)), 1e-6));
  const x = rows.map(row => vectorize(row, featureNames, featureMeans, featureSds).slice(1));
  const yMean = mean(rows.map(row => row.targetScore));
  const y = rows.map(row => row.targetScore - yMean);
  const beta = Array(featureNames.length).fill(0) as number[];
  const residual = [...y];
  const l1 = lambda * alpha;
  const l2 = lambda * (1 - alpha);

  for (let iteration = 0; iteration < 120; iteration += 1) {
    let delta = 0;
    for (let featureIndex = 0; featureIndex < featureNames.length; featureIndex += 1) {
      const oldBeta = beta[featureIndex] ?? 0;
      let rho = 0;
      let norm = 0;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const xij = x[rowIndex]?.[featureIndex] ?? 0;
        residual[rowIndex] = (residual[rowIndex] ?? 0) + xij * oldBeta;
        rho += xij * (residual[rowIndex] ?? 0);
        norm += xij * xij;
      }
      const newBeta = softThreshold(rho / rows.length, l1) / (norm / rows.length + l2 + 1e-9);
      beta[featureIndex] = newBeta;
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        residual[rowIndex] = (residual[rowIndex] ?? 0) - (x[rowIndex]?.[featureIndex] ?? 0) * newBeta;
      }
      delta = Math.max(delta, Math.abs(newBeta - oldBeta));
    }
    if (delta < 1e-4) break;
  }

  const coefficients = [yMean, ...beta];
  const residuals = rows.map(row => row.targetScore - predictLinear(row, featureNames, coefficients, featureMeans, featureSds));
  return {
    family: 'linear',
    coefficients,
    featureMeans,
    featureSds,
    trainingVectors: [],
    trainingTargets: [],
    residualSd: Math.max(6, standardDeviation(residuals))
  };
};

const fitHuberRidge = (rows: FeatureRow[], featureNames: string[], lambda: number): FittedModel | null => {
  let weights = rows.map(() => 1);
  let fitted = fitWeightedRidge(rows, featureNames, lambda, weights);
  if (!fitted) return null;

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const residuals = rows.map(
      row => row.targetScore - predictLinear(row, featureNames, fitted!.coefficients, fitted!.featureMeans, fitted!.featureSds)
    );
    const threshold = Math.max(6, 1.345 * standardDeviation(residuals));
    weights = residuals.map(residual => Math.min(1, threshold / Math.max(Math.abs(residual), 1e-6)));
    fitted = fitWeightedRidge(rows, featureNames, lambda, weights) ?? fitted;
  }

  return fitted;
};

const fitMemoryModel = (rows: FeatureRow[], featureNames: string[]): FittedModel | null => {
  if (rows.length < 40) return null;
  const featureMeans = featureNames.map(feature => mean(rows.map(row => row.features[feature] ?? 0)));
  const featureSds = featureNames.map(feature => Math.max(standardDeviation(rows.map(row => row.features[feature] ?? 0)), 1e-6));
  const trainingVectors = rows.map(row => vectorize(row, featureNames, featureMeans, featureSds).slice(1));
  const trainingTargets = rows.map(row => row.targetScore);
  return {
    family: 'memory',
    coefficients: [],
    featureMeans,
    featureSds,
    trainingVectors,
    trainingTargets,
    residualSd: Math.max(8, standardDeviation(trainingTargets))
  };
};

const fitOprRatings = (rows: FeatureRow[], lambda: number) => {
  const teamKeys = Array.from(new Set(rows.flatMap(row => row.allianceTeams))).sort();
  if (teamKeys.length === 0 || rows.length < Math.max(8, teamKeys.length / 2)) {
    return null;
  }

  const indexByTeam = new Map(teamKeys.map((teamKey, index) => [teamKey, index]));
  const matrixRows = rows.map(row => {
    const values = Array(teamKeys.length).fill(0) as number[];
    row.allianceTeams.forEach(teamKey => {
      const index = indexByTeam.get(teamKey);
      if (index != null) values[index] = 1;
    });
    return values;
  });
  const matrix = new Matrix(matrixRows);
  const target = Matrix.columnVector(rows.map(row => row.targetScore));
  const xt = matrix.transpose();
  const xtx = xt.mmul(matrix);
  const penalty = Matrix.eye(xtx.rows, xtx.columns).mul(lambda);
  const coefficients = solve(xtx.add(penalty), xt.mmul(target)).to1DArray();
  const ratings = new Map<string, number>();
  teamKeys.forEach((teamKey, index) => ratings.set(teamKey, coefficients[index] ?? 0));
  const residuals = rows.map(row => row.targetScore - row.allianceTeams.reduce((sum, teamKey) => sum + (ratings.get(teamKey) ?? 0), 0));
  return {
    ratings,
    residualSd: Math.max(8, standardDeviation(residuals))
  };
};

interface OnlineEpaState {
  ratings: Map<string, number>;
  defenseRatings: Map<string, number>;
  eventOffsets: Map<string, number>;
  eventCounts: Map<string, number>;
  eventResiduals: Map<string, number[]>;
  eventTypeResiduals: Map<string, number[]>;
  eventScores: Map<string, number[]>;
  eventAllianceRows: Map<string, number>;
  counts: Map<string, number>;
  allianceScores: number[];
  residuals: number[];
  previousDefaultContribution: number | null;
  season: number | null;
}

const createOnlineEpaState = (): OnlineEpaState => ({
  ratings: new Map(),
  defenseRatings: new Map(),
  eventOffsets: new Map(),
  eventCounts: new Map(),
  eventResiduals: new Map(),
  eventTypeResiduals: new Map(),
  eventScores: new Map(),
  eventAllianceRows: new Map(),
  counts: new Map(),
  allianceScores: [],
  residuals: [],
  previousDefaultContribution: null,
  season: null
});

const getOnlineEpaDefaultContribution = (state: OnlineEpaState) =>
  state.allianceScores.length > 0 ? mean(state.allianceScores) / 3 : state.previousDefaultContribution ?? 0;

const getOnlineAllianceScoreScale = (state: OnlineEpaState) =>
  state.allianceScores.length > 0 ? mean(state.allianceScores) : (state.previousDefaultContribution ?? 0) * 3;

const eventTeamKey = (eventKey: string, teamKey: string) => `${eventKey}|${teamKey}`;

const getEventSlug = (eventKey: string) => eventKey.replace(/^\d+/, '').toLowerCase();

const getEventMetadataType = (row: FeatureRow) => row.eventMetadata?.eventType?.toLowerCase() ?? '';

const getEventTypeResidualKey = (row: FeatureRow) => `${row.season}|${getEventMetadataType(row) || 'unknown'}`;

const CHAMPIONSHIP_DIVISION_SLUGS = new Set([
  'arc',
  'cur',
  'dal',
  'gal',
  'hop',
  'mil',
  'new',
  'joh',
  'car',
  'tes',
  'roe',
  'dav',
  'ein'
]);

const CHAMPIONSHIP_EVENT_TYPES = new Set(['champs', 'cmp', 'einstein', 'district_cmp', 'dcmp']);

const isChampionshipDivisionContext = (row: FeatureRow) => {
  const slug = getEventSlug(row.eventKey);
  return getEventMetadataType(row) === 'champs_div' || CHAMPIONSHIP_DIVISION_SLUGS.has(slug);
};

const isFirstChampionshipContext = (row: FeatureRow) => {
  const slug = getEventSlug(row.eventKey);
  const eventType = getEventMetadataType(row);
  return isChampionshipDivisionContext(row) || eventType === 'champs' || eventType === 'cmp' || eventType === 'einstein' || slug.includes('cmp');
};

const isDistrictChampionshipContext = (row: FeatureRow) => {
  const eventType = getEventMetadataType(row);
  return eventType === 'district_cmp' || eventType === 'dcmp';
};

const isEventScoreScaleScopeAllowed = (row: FeatureRow, config: ModelConfig) => {
  const scope = config.eventScoreScaleScope ?? 'all';
  if (scope === 'all') return true;
  if (scope === 'championshipDivision') return isChampionshipDivisionContext(row);
  if (scope === 'championship') return isFirstChampionshipContext(row);
  if (scope === 'championshipOrDistrictCmp') return isFirstChampionshipContext(row) || isDistrictChampionshipContext(row);
  return true;
};

const getEventArchetypeScoreShift = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) => {
  const scoreScale = Math.max(1, row.features.season_average_alliance_score ?? getOnlineAllianceScoreScale(state));
  if (isChampionshipDivisionContext(row)) {
    return (config.championshipDivisionScoreShift ?? 0) + scoreScale * (config.championshipDivisionScoreShiftRatio ?? 0);
  }
  if (CHAMPIONSHIP_EVENT_TYPES.has(getEventMetadataType(row)) || getEventSlug(row.eventKey).includes('cmp')) {
    return (config.championshipEventScoreShift ?? 0) + scoreScale * (config.championshipEventScoreShiftRatio ?? 0);
  }
  return 0;
};

const isChampionshipPhaseScopeAllowed = (row: FeatureRow, config: ModelConfig) => {
  const scope = config.championshipPhaseScope ?? 'championship';
  if (scope === 'championshipDivision') return isChampionshipDivisionContext(row);
  if (scope === 'championshipOrDistrictCmp') return isFirstChampionshipContext(row) || isDistrictChampionshipContext(row);
  return isFirstChampionshipContext(row);
};

const getChampionshipPhase = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) => {
  const priorEventRows = state.eventAllianceRows.get(row.eventKey) ?? 0;
  const earlyRows = Math.max(2, Math.floor(config.championshipPhaseEarlyRows ?? 72));
  const middleRows = Math.max(earlyRows + 2, Math.floor(config.championshipPhaseMiddleRows ?? 180));
  if (priorEventRows < earlyRows) return 'early';
  if (priorEventRows < middleRows) return 'middle';
  return 'late';
};

const getChampionshipPhaseScoreShift = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) => {
  const earlyShift = config.championshipPhaseEarlyScoreShift ?? 0;
  const middleShift = config.championshipPhaseMiddleScoreShift ?? 0;
  const lateShift = config.championshipPhaseLateScoreShift ?? 0;
  if (earlyShift === 0 && middleShift === 0 && lateShift === 0) return 0;
  if (!isChampionshipPhaseScopeAllowed(row, config)) return 0;

  const phase = getChampionshipPhase(row, state, config);
  const gate = getChampionshipTailResidualGate(row, state, config);
  if (gate <= 0) return 0;
  if (phase === 'early') return clamp(earlyShift * gate, -80, 80);
  if (phase === 'middle') return clamp(middleShift * gate, -80, 80);
  return clamp(lateShift * gate, -80, 80);
};

const isChampionshipPhaseResidualScopeAllowed = (row: FeatureRow, config: ModelConfig) => {
  const scope = config.championshipPhaseResidualShiftScope ?? 'championship';
  if (scope === 'championshipDivision') return isChampionshipDivisionContext(row);
  if (scope === 'championshipOrDistrictCmp') return isFirstChampionshipContext(row) || isDistrictChampionshipContext(row);
  return isFirstChampionshipContext(row);
};

const getChampionshipTailResidualGate = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) => {
  const minSamples = Math.max(0, Math.floor(config.championshipTailResidualGateMinSamples ?? 0));
  if (minSamples <= 0) return 1;
  const residuals = state.eventResiduals.get(row.eventKey) ?? [];
  if (residuals.length < minSamples) return 0;
  const window = Math.max(1, Math.floor(config.championshipTailResidualGateWindow ?? 18));
  const residualMean = mean(residuals.slice(Math.max(0, residuals.length - window)));
  const threshold = config.championshipTailResidualGateThreshold ?? 0;
  const fullAt = Math.max(1, config.championshipTailResidualGateFullAt ?? 24);
  return clamp((residualMean - threshold) / fullAt, 0, 1);
};

const getChampionshipPhaseResidualShift = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) => {
  const earlyWeight = config.championshipPhaseResidualShiftEarlyWeight ?? 0;
  const middleWeight = config.championshipPhaseResidualShiftMiddleWeight ?? 0;
  const lateWeight = config.championshipPhaseResidualShiftLateWeight ?? 0;
  if (earlyWeight === 0 && middleWeight === 0 && lateWeight === 0) return 0;
  if (!isChampionshipPhaseResidualScopeAllowed(row, config)) return 0;
  const residuals = state.eventResiduals.get(row.eventKey) ?? [];
  const minSamples = Math.max(1, Math.floor(config.championshipPhaseResidualShiftMinSamples ?? 8));
  if (residuals.length < minSamples) return 0;

  const phase = getChampionshipPhase(row, state, config);
  const weight = phase === 'early' ? earlyWeight : phase === 'middle' ? middleWeight : lateWeight;
  if (weight === 0) return 0;
  const gate = getChampionshipTailResidualGate(row, state, config);
  if (gate <= 0) return 0;
  const window = Math.max(1, Math.floor(config.championshipPhaseResidualShiftWindow ?? 18));
  const residualMean = mean(residuals.slice(Math.max(0, residuals.length - window)));
  const adjustedResidual = config.championshipPhaseResidualShiftPositiveOnly === true ? Math.max(0, residualMean) : residualMean;
  return clamp(adjustedResidual * weight * gate, -80, 80);
};

const predictOnlineEpa = (row: FeatureRow, state: OnlineEpaState, eventAdjustmentScale = 0) => {
  const defaultContribution = getOnlineEpaDefaultContribution(state);
  return clamp(
    row.allianceTeams.reduce((sum, teamKey) => {
      const globalContribution = state.ratings.get(teamKey) ?? defaultContribution;
      const eventOffset = state.eventOffsets.get(eventTeamKey(row.eventKey, teamKey)) ?? 0;
      return sum + globalContribution + eventOffset * eventAdjustmentScale;
    }, 0),
    0,
    MAX_REASONABLE_FRC_SCORE
  );
};

const getEventResidualShift = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) => {
  const weight = config.eventResidualShiftWeight ?? 0;
  if (weight <= 0) return 0;
  const minSamples = Math.max(1, Math.floor(config.eventResidualShiftMinSamples ?? 4));
  const window = Math.max(1, Math.floor(config.eventResidualShiftWindow ?? 24));
  const residuals = state.eventResiduals.get(row.eventKey) ?? [];
  if (residuals.length < minSamples) return 0;
  return mean(residuals.slice(Math.max(0, residuals.length - window))) * weight;
};

const getEventTypeResidualShift = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) => {
  const weight = config.eventTypeResidualShiftWeight ?? 0;
  if (weight <= 0) return 0;
  const minSamples = Math.max(1, Math.floor(config.eventTypeResidualShiftMinSamples ?? 40));
  const window = Math.max(1, Math.floor(config.eventTypeResidualShiftWindow ?? 120));
  const residuals = state.eventTypeResiduals.get(getEventTypeResidualKey(row)) ?? [];
  if (residuals.length < minSamples) return 0;
  return clamp(mean(residuals.slice(Math.max(0, residuals.length - window))) * weight, -80, 80);
};

const getEventScoreScaleShift = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) => {
  const weight = config.eventScoreScaleWeight ?? 0;
  if (weight <= 0 || state.allianceScores.length === 0 || !isEventScoreScaleScopeAllowed(row, config)) return 0;
  const minSamples = Math.max(1, Math.floor(config.eventScoreScaleMinSamples ?? 8));
  const window = Math.max(1, Math.floor(config.eventScoreScaleWindow ?? 24));
  const eventScores = state.eventScores.get(row.eventKey) ?? [];
  if (eventScores.length < minSamples) return 0;
  const eventMean = mean(eventScores.slice(Math.max(0, eventScores.length - window)));
  const seasonMean = getOnlineAllianceScoreScale(state);
  const delta = eventMean - seasonMean;
  const threshold = Math.max(0, config.eventScoreScaleThreshold ?? 0);
  const adjustedDelta =
    config.eventScoreScalePositiveOnly === true
      ? Math.max(0, delta - threshold)
      : Math.abs(delta) <= threshold
        ? 0
        : Math.sign(delta) * (Math.abs(delta) - threshold);
  const residualGateMinSamples = Math.max(0, Math.floor(config.eventScoreScaleResidualGateMinSamples ?? 0));
  if (residualGateMinSamples > 0) {
    const residuals = state.eventResiduals.get(row.eventKey) ?? [];
    if (residuals.length < residualGateMinSamples) return 0;
    const residualGateWindow = Math.max(1, Math.floor(config.eventScoreScaleResidualGateWindow ?? window));
    const residualMean = mean(residuals.slice(Math.max(0, residuals.length - residualGateWindow)));
    const residualGateThreshold = config.eventScoreScaleResidualGateThreshold ?? 0;
    const residualGateFullAt = Math.max(1, config.eventScoreScaleResidualGateFullAt ?? 24);
    const residualGate = clamp((residualMean - residualGateThreshold) / residualGateFullAt, 0, 1);
    if (residualGate <= 0) return 0;
    return clamp(adjustedDelta * weight * residualGate, -80, 80);
  }
  return clamp(adjustedDelta * weight, -80, 80);
};

const getEventContextShiftWithoutChampionshipTail = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) =>
  getEventResidualShift(row, state, config) +
  getEventTypeResidualShift(row, state, config) +
  getEventScoreScaleShift(row, state, config) +
  getEventArchetypeScoreShift(row, state, config);

const getChampionshipTailScoreShift = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) =>
  getChampionshipPhaseScoreShift(row, state, config) +
  getChampionshipPhaseResidualShift(row, state, config);

const getEventContextShift = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) =>
  getEventContextShiftWithoutChampionshipTail(row, state, config) + getChampionshipTailScoreShift(row, state, config);

const isLearnedTailCorrectionScopeAllowed = (row: FeatureRow, config: ModelConfig) => {
  const scope = config.learnedTailCorrectionScope ?? 'championship';
  if (scope === 'championshipDivision') return isChampionshipDivisionContext(row);
  if (scope === 'championshipOrDistrictCmp') return isFirstChampionshipContext(row) || isDistrictChampionshipContext(row);
  return isFirstChampionshipContext(row);
};

const getLearnedTailFeatureNames = (config: ModelConfig) => {
  if ((config.learnedTailCorrectionWeight ?? 0) <= 0) return [];
  const phaseFeatures = [
    'tail_is_championship_division',
    'tail_is_championship_event',
    'tail_is_district_cmp',
    'tail_phase_early',
    'tail_phase_middle',
    'tail_phase_late',
    'tail_prior_event_rows_log',
    'tail_is_playoff'
  ];
  const residualFeatures = [
    'tail_event_residual_mean',
    'tail_event_residual_positive',
    'tail_event_residual_abs',
    'tail_middle_residual_positive',
    'tail_late_residual_positive'
  ];
  const scaleFeatures = [
    'tail_event_score_delta',
    'tail_event_score_delta_positive',
    'tail_event_score_delta_abs',
    'tail_score_scale_log',
    'tail_event_week',
    'tail_event_team_count_log'
  ];

  const featureSet = config.learnedTailCorrectionFeatureSet ?? 'phaseResidualScale';
  if (featureSet === 'phase') return phaseFeatures;
  if (featureSet === 'phaseResidual') return [...phaseFeatures, ...residualFeatures];
  return [...phaseFeatures, ...residualFeatures, ...scaleFeatures];
};

const buildLearnedTailFeatureValues = (
  row: FeatureRow,
  state: OnlineEpaState,
  config: ModelConfig
): Record<string, number> => {
  const priorEventRows = state.eventAllianceRows.get(row.eventKey) ?? 0;
  const phase = getChampionshipPhase(row, state, config);
  const residualWindow = Math.max(1, Math.floor(config.eventResidualShiftWindow ?? 18));
  const eventResiduals = state.eventResiduals.get(row.eventKey) ?? [];
  const eventResidualMean = mean(eventResiduals.slice(Math.max(0, eventResiduals.length - residualWindow)));
  const scoreWindow = Math.max(1, Math.floor(config.eventScoreScaleWindow ?? 24));
  const eventScores = state.eventScores.get(row.eventKey) ?? [];
  const eventScoreMean = mean(eventScores.slice(Math.max(0, eventScores.length - scoreWindow)));
  const seasonScoreScale = getOnlineAllianceScoreScale(state);
  const eventScoreDelta = eventScores.length > 0 ? eventScoreMean - seasonScoreScale : 0;

  return {
    tail_is_championship_division: isChampionshipDivisionContext(row) ? 1 : 0,
    tail_is_championship_event: isFirstChampionshipContext(row) ? 1 : 0,
    tail_is_district_cmp: isDistrictChampionshipContext(row) ? 1 : 0,
    tail_phase_early: phase === 'early' ? 1 : 0,
    tail_phase_middle: phase === 'middle' ? 1 : 0,
    tail_phase_late: phase === 'late' ? 1 : 0,
    tail_prior_event_rows_log: Math.log1p(priorEventRows),
    tail_is_playoff: row.features.is_playoff ?? 0,
    tail_event_residual_mean: eventResidualMean,
    tail_event_residual_positive: Math.max(0, eventResidualMean),
    tail_event_residual_abs: Math.abs(eventResidualMean),
    tail_middle_residual_positive: phase === 'middle' ? Math.max(0, eventResidualMean) : 0,
    tail_late_residual_positive: phase === 'late' ? Math.max(0, eventResidualMean) : 0,
    tail_event_score_delta: eventScoreDelta,
    tail_event_score_delta_positive: Math.max(0, eventScoreDelta),
    tail_event_score_delta_abs: Math.abs(eventScoreDelta),
    tail_score_scale_log: Math.log1p(Math.max(0, seasonScoreScale)),
    tail_event_week: row.features.event_week ?? 0,
    tail_event_team_count_log: Math.log1p(Math.max(0, row.features.event_team_count ?? 0))
  };
};

const buildLearnedTailFeatureRow = (
  row: FeatureRow,
  state: OnlineEpaState,
  config: ModelConfig
): FeatureRow => ({
  ...row,
  features: buildLearnedTailFeatureValues(row, state, config)
});

const getLearnedTailCorrectionGate = (row: FeatureRow, state: OnlineEpaState, config: ModelConfig) => {
  const minSamples = Math.max(0, Math.floor(config.learnedTailCorrectionGateMinSamples ?? 0));
  const residualThreshold = config.learnedTailCorrectionGateResidualThreshold;
  const scoreDeltaThreshold = config.learnedTailCorrectionGateScoreDeltaThreshold;
  if (minSamples <= 0 && residualThreshold == null && scoreDeltaThreshold == null) return 1;

  const window = Math.max(1, Math.floor(config.learnedTailCorrectionGateWindow ?? config.eventResidualShiftWindow ?? 18));
  const fullAt = Math.max(1, config.learnedTailCorrectionGateFullAt ?? 20);
  const gates: number[] = [];

  if (residualThreshold != null || minSamples > 0) {
    const eventResiduals = state.eventResiduals.get(row.eventKey) ?? [];
    if (eventResiduals.length < minSamples) return 0;
    if (residualThreshold != null) {
      const residualMean = mean(eventResiduals.slice(Math.max(0, eventResiduals.length - window)));
      gates.push(clamp((residualMean - residualThreshold) / fullAt, 0, 1));
    }
  }

  if (scoreDeltaThreshold != null) {
    const eventScores = state.eventScores.get(row.eventKey) ?? [];
    if (eventScores.length < minSamples) return 0;
    const eventScoreMean = mean(eventScores.slice(Math.max(0, eventScores.length - window)));
    const eventScoreDelta = eventScores.length > 0 ? eventScoreMean - getOnlineAllianceScoreScale(state) : 0;
    gates.push(clamp((eventScoreDelta - scoreDeltaThreshold) / fullAt, 0, 1));
  }

  if (gates.length === 0) return 1;
  const gateMode = config.learnedTailCorrectionGateMode ?? 'max';
  if (gateMode === 'min') return clamp(Math.min(...gates), 0, 1);
  if (gateMode === 'mean') return clamp(mean(gates), 0, 1);
  return clamp(Math.max(...gates), 0, 1);
};

const getLearnedTailWeightedCorrection = (
  row: FeatureRow,
  fitted: FittedModel | null,
  featureNames: string[],
  state: OnlineEpaState | null,
  config: ModelConfig
) => {
  const weight = clamp(config.learnedTailCorrectionWeight ?? 0, 0, 1);
  if (weight <= 0 || !state || !fitted || featureNames.length === 0 || !isLearnedTailCorrectionScopeAllowed(row, config)) {
    return 0;
  }
  const clip = Math.max(1, config.learnedTailCorrectionClip ?? 30);
  const rawCorrection = predictLinearRaw(
    buildLearnedTailFeatureRow(row, state, config),
    featureNames,
    fitted.coefficients,
    fitted.featureMeans,
    fitted.featureSds
  );
  const signedCorrection = config.learnedTailCorrectionPositiveOnly === true ? Math.max(0, rawCorrection) : rawCorrection;
  const correction = clamp(signedCorrection, -clip, clip);
  const gate = getLearnedTailCorrectionGate(row, state, config);
  if (gate <= 0) return 0;
  return correction * weight * gate;
};

const applyLearnedTailCorrection = (
  row: FeatureRow,
  expectedScore: number,
  fitted: FittedModel | null,
  featureNames: string[],
  state: OnlineEpaState | null,
  config: ModelConfig
) => {
  if (config.learnedTailCorrectionApplyToMean === false) return expectedScore;
  const weightedCorrection = getLearnedTailWeightedCorrection(row, fitted, featureNames, state, config);
  if (Math.abs(weightedCorrection) <= 1e-9) return expectedScore;
  return clamp(expectedScore + weightedCorrection, 0, MAX_REASONABLE_FRC_SCORE);
};

const applyLearnedTailUncertainty = (
  prediction: ScorePrediction,
  row: FeatureRow,
  fitted: FittedModel | null,
  featureNames: string[],
  state: OnlineEpaState | null,
  config: ModelConfig
): ScorePrediction => {
  const uncertaintyWeight = Math.max(0, config.learnedTailUncertaintyWeight ?? 0);
  if (uncertaintyWeight <= 0) return prediction;
  const weightedCorrection = getLearnedTailWeightedCorrection(row, fitted, featureNames, state, config);
  const extra = Math.min(config.learnedTailUncertaintyClip ?? 45, Math.abs(weightedCorrection) * uncertaintyWeight);
  if (extra <= 1e-9) return prediction;
  if (weightedCorrection < 0) {
    return {
      ...prediction,
      p10Score: clamp(prediction.p10Score - extra, 0, MAX_REASONABLE_FRC_SCORE)
    };
  }
  return {
    ...prediction,
    p90Score: clamp(prediction.p90Score + extra, 0, MAX_REASONABLE_FRC_SCORE)
  };
};

const getLearnedTailWinProbabilitySd = (
  prediction: ScorePrediction,
  row: FeatureRow,
  fitted: FittedModel | null,
  featureNames: string[],
  state: OnlineEpaState | null,
  config: ModelConfig,
  probabilityScale = 1
) => {
  const baseSd = Math.max(1, (prediction.p90Score - prediction.p10Score) / 2.5632);
  const probabilityWeight = Math.max(0, config.learnedTailWinProbabilityWeight ?? 0);
  if (probabilityWeight <= 0) return baseSd;
  const weightedCorrection = getLearnedTailWeightedCorrection(row, fitted, featureNames, state, config);
  const extraWidth =
    Math.min(config.learnedTailWinProbabilityClip ?? 45, Math.abs(weightedCorrection) * probabilityWeight) *
    clamp(probabilityScale, 0, 1);
  if (extraWidth <= 1e-9) return baseSd;
  return baseSd + extraWidth / 2.5632;
};

const getIntervalBasedRedWinProbability = (
  red: ScorePrediction,
  blue: ScorePrediction,
  redMean: number,
  blueMean: number
) => {
  const redSd = Math.max(1, (red.p90Score - red.p10Score) / 2.5632);
  const blueSd = Math.max(1, (blue.p90Score - blue.p10Score) / 2.5632);
  return clamp(normalCdf(redMean - blueMean, 0, Math.sqrt(redSd ** 2 + blueSd ** 2)), 0, 1);
};

const shouldApplyLearnedTailWinProbability = (
  red: ScorePrediction,
  blue: ScorePrediction,
  redMean: number,
  blueMean: number,
  config: ModelConfig
) => {
  const minExpectedMargin = Math.max(0, config.learnedTailWinProbabilityMinExpectedMargin ?? 0);
  if (minExpectedMargin > 0 && Math.abs(redMean - blueMean) < minExpectedMargin) return false;
  const minConfidence = Math.max(0, config.learnedTailWinProbabilityMinConfidence ?? 0);
  if (minConfidence > 0) {
    const baseRedWinProbability = getIntervalBasedRedWinProbability(red, blue, redMean, blueMean);
    if (Math.abs(baseRedWinProbability - 0.5) < minConfidence) return false;
  }
  return true;
};

const getLearnedTailWinProbabilityScale = (
  red: ScorePrediction,
  blue: ScorePrediction,
  redMean: number,
  blueMean: number,
  config: ModelConfig
) => {
  const marginRamp = Math.max(0, config.learnedTailWinProbabilityMarginRamp ?? 0);
  const confidenceRamp = Math.max(0, config.learnedTailWinProbabilityConfidenceRamp ?? 0);
  const factors: number[] = [];
  if (marginRamp > 0) {
    factors.push(clamp(Math.abs(redMean - blueMean) / marginRamp, 0, 1));
  }
  if (confidenceRamp > 0) {
    const baseRedWinProbability = getIntervalBasedRedWinProbability(red, blue, redMean, blueMean);
    factors.push(clamp(Math.abs(baseRedWinProbability - 0.5) / confidenceRamp, 0, 1));
  }
  if (factors.length === 0) return 1;
  const shrinkFloor = clamp(config.learnedTailWinProbabilityShrinkFloor ?? 0, 0, 1);
  const smoothFactor = Math.max(...factors);
  return clamp(shrinkFloor + (1 - shrinkFloor) * smoothFactor, 0, 1);
};

interface WinProbabilityCalibrationExample {
  features: number[];
  targetResidual: number;
}

interface FittedWinProbabilityCalibration {
  coefficients: number[];
  featureSet: NonNullable<ModelConfig['winProbabilityCalibrationFeatureSet']>;
}

const getWinProbabilityCalibrationFeatureValues = (
  red: ScorePrediction,
  blue: ScorePrediction,
  redWinProbability: number,
  config: ModelConfig
) => {
  const featureSet = config.winProbabilityCalibrationFeatureSet ?? 'bias';
  if (featureSet === 'bias') return [];
  const expectedMargin = (red.expectedScore - blue.expectedScore) / 100;
  const intervalWidth = ((red.p90Score - red.p10Score) + (blue.p90Score - blue.p10Score)) / 200;
  return [
    redWinProbability - 0.5,
    Math.abs(redWinProbability - 0.5),
    expectedMargin,
    Math.abs(expectedMargin),
    intervalWidth
  ];
};

const fitWinProbabilityCalibration = (
  examples: WinProbabilityCalibrationExample[],
  config: ModelConfig
): FittedWinProbabilityCalibration | null => {
  const window = Math.max(0, Math.floor(config.winProbabilityCalibrationWindow ?? 0));
  const fittingExamples = window > 0 ? examples.slice(-window) : examples;
  const minMatches = Math.max(20, Math.floor(config.winProbabilityCalibrationMinMatches ?? 400));
  if (fittingExamples.length < minMatches) return null;
  const featureCount = (fittingExamples[0]?.features.length ?? 0) + 1;
  const rows = fittingExamples.map(example => [1, ...example.features]);
  const design = new Matrix(rows);
  const target = Matrix.columnVector(fittingExamples.map(example => example.targetResidual));
  const xtx = design.transpose().mmul(design);
  const lambda = Math.max(0, config.winProbabilityCalibrationLambda ?? 20);
  const penalty = Matrix.eye(featureCount, featureCount).mul(lambda);
  penalty.set(0, 0, lambda * 0.05);
  try {
    return {
      coefficients: solve(xtx.add(penalty), design.transpose().mmul(target)).to1DArray(),
      featureSet: config.winProbabilityCalibrationFeatureSet ?? 'bias'
    };
  } catch {
    return null;
  }
};

const predictWinProbabilityCalibrationResidual = (
  fitted: FittedWinProbabilityCalibration | null,
  features: number[],
  config: ModelConfig
) => {
  if (!fitted || fitted.featureSet !== (config.winProbabilityCalibrationFeatureSet ?? 'bias')) return 0;
  const vector = [1, ...features];
  return vector.reduce((sum, value, index) => sum + value * (fitted.coefficients[index] ?? 0), 0);
};

const getPendingWinProbabilityCalibrationExample = (
  groupScorePredictions: ScorePrediction[],
  config: ModelConfig
): WinProbabilityCalibrationExample | null => {
  const red = groupScorePredictions.find(prediction => prediction.perspective === 'red');
  const blue = groupScorePredictions.find(prediction => prediction.perspective === 'blue');
  if (!red || !blue) return null;
  const redWinProbability = red.winProbability ?? getIntervalBasedRedWinProbability(red, blue, red.expectedScore, blue.expectedScore);
  const actual = red.actualScore === blue.actualScore ? 0.5 : red.actualScore > blue.actualScore ? 1 : 0;
  return {
    features: getWinProbabilityCalibrationFeatureValues(red, blue, redWinProbability, config),
    targetResidual: actual - redWinProbability
  };
};

const applyWinProbabilityCalibration = (
  groupScorePredictions: ScorePrediction[],
  fitted: FittedWinProbabilityCalibration | null,
  config: ModelConfig
) => {
  const weight = clamp(config.winProbabilityCalibrationWeight ?? 0, 0, 1);
  if (weight <= 0 || !fitted) return;
  const red = groupScorePredictions.find(prediction => prediction.perspective === 'red');
  const blue = groupScorePredictions.find(prediction => prediction.perspective === 'blue');
  if (!red || !blue) return;
  const redWinProbability = red.winProbability ?? getIntervalBasedRedWinProbability(red, blue, red.expectedScore, blue.expectedScore);
  const features = getWinProbabilityCalibrationFeatureValues(red, blue, redWinProbability, config);
  const clip = Math.max(0.005, config.winProbabilityCalibrationClip ?? 0.08);
  const residual = clamp(predictWinProbabilityCalibrationResidual(fitted, features, config), -clip, clip);
  const calibrated = clamp(redWinProbability + residual * weight, 0.005, 0.995);
  red.winProbability = calibrated;
  blue.winProbability = 1 - calibrated;
};

const applyComponentPriorBlend = (row: FeatureRow, expectedScore: number, config: ModelConfig) => {
  const weight = clamp(config.componentPriorWeight ?? 0, 0, 1);
  if (weight <= 0) return expectedScore;
  const minMatches = Math.max(0, Math.floor(config.componentPriorMinMatches ?? 2));
  if ((row.features.own_experience_min ?? 0) < minMatches) return expectedScore;
  const componentPrior = row.features.own_component_modeled_score_sum ?? 0;
  if (!Number.isFinite(componentPrior) || componentPrior <= 0) return expectedScore;
  return clamp(expectedScore * (1 - weight) + componentPrior * weight, 0, MAX_REASONABLE_FRC_SCORE);
};

const applyResidualCorrection = (
  row: FeatureRow,
  expectedScore: number,
  fitted: FittedModel | null,
  featureNames: string[],
  config: ModelConfig
) => {
  const weight = clamp(config.residualCorrectionWeight ?? 0, 0, 1);
  if (weight <= 0 || !fitted || featureNames.length === 0) return expectedScore;
  const clip = Math.max(1, config.residualCorrectionClip ?? 40);
  const correction = clamp(
    predictLinearRaw(row, featureNames, fitted.coefficients, fitted.featureMeans, fitted.featureSds),
    -clip,
    clip
  );
  return clamp(expectedScore + correction * weight, 0, MAX_REASONABLE_FRC_SCORE);
};

const applyResidualTreeCorrection = (
  row: FeatureRow,
  expectedScore: number,
  ensemble: ResidualTreeEnsemble | null,
  config: ModelConfig
) => {
  const weight = clamp(config.residualTreeCorrectionWeight ?? 0, 0, 1);
  if (weight <= 0 || !ensemble) return expectedScore;
  const clip = Math.max(1, config.residualTreeCorrectionClip ?? 45);
  const correction = clamp(predictResidualTree(row, ensemble), -clip, clip);
  return clamp(expectedScore + correction * weight, 0, MAX_REASONABLE_FRC_SCORE);
};

const predictRelativeEpa = (row: FeatureRow, state: OnlineEpaState) => {
  const scoreScale = getOnlineAllianceScoreScale(state);
  return clamp(
    row.allianceTeams.reduce((sum, teamKey) => sum + (state.ratings.get(teamKey) ?? 1 / 3), 0) * scoreScale,
    0,
    MAX_REASONABLE_FRC_SCORE
  );
};

const predictOnlineDualEpa = (row: FeatureRow, state: OnlineEpaState) => {
  const defaultContribution = getOnlineEpaDefaultContribution(state);
  return clamp(
    row.allianceTeams.reduce((sum, teamKey) => sum + (state.ratings.get(teamKey) ?? defaultContribution), 0) -
      row.opponentTeams.reduce((sum, teamKey) => sum + (state.defenseRatings.get(teamKey) ?? 0), 0),
    0,
    MAX_REASONABLE_FRC_SCORE
  );
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createPrng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const randomNormal = (random: () => number) => {
  const left = Math.max(1e-12, random());
  const right = Math.max(1e-12, random());
  return Math.sqrt(-2 * Math.log(left)) * Math.cos(2 * Math.PI * right);
};

const getOnlineResidualSd = (state: OnlineEpaState) => Math.max(8, standardDeviation(state.residuals));

const quantileFromSorted = (values: number[], probability: number) => {
  if (values.length === 0) return 0;
  const index = clamp((values.length - 1) * probability, 0, values.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower] ?? 0;
  const weight = index - lower;
  return (values[lower] ?? 0) * (1 - weight) + (values[upper] ?? 0) * weight;
};

interface MonteCarloRowPrediction {
  expectedScore: number;
  p10Score: number;
  p90Score: number;
  winProbability: number;
}

const simulateAllianceScore = (
  row: FeatureRow,
  state: OnlineEpaState,
  random: () => number,
  residualSd: number,
  config: ModelConfig
) => {
  const defaultContribution = getOnlineEpaDefaultContribution(state);
  const teamUncertaintyScale = config.teamUncertaintyScale ?? 0.8;
  const scoreNoiseScale = config.scoreNoiseScale ?? 0.85;
  const roleSimulationScale = config.useRoleFeatures ? config.roleSimulationScale ?? 0 : 0;
  const base = row.allianceTeams.reduce((sum, teamKey) => {
    const globalContribution = state.ratings.get(teamKey) ?? defaultContribution;
    const eventOffset = state.eventOffsets.get(eventTeamKey(row.eventKey, teamKey)) ?? 0;
    const count = state.counts.get(teamKey) ?? 0;
    const teamUncertainty = (residualSd / Math.sqrt(count + 1)) * teamUncertaintyScale * 0.42;
    return sum + globalContribution + eventOffset * (config.eventAdjustmentScale ?? 0) + randomNormal(random) * teamUncertainty;
  }, 0);
  const roleDelta =
    roleSimulationScale > 0
      ? -((row.features.own_role_offense_cost ?? 0) + (row.features.opp_role_defense_value ?? 0)) *
        roleSimulationScale *
        clamp((row.roleOption.netSwing + 12) / 36, 0, 1) *
        random()
      : 0;
  return clamp(
    base +
      getEventContextShift(row, state, config) +
      roleDelta +
      randomNormal(random) * residualSd * scoreNoiseScale,
    0,
    MAX_REASONABLE_FRC_SCORE
  );
};

const buildMonteCarloGroupPredictions = (
  group: FeatureRow[],
  state: OnlineEpaState,
  config: ModelConfig
) => {
  const simulationCount = Math.max(100, Math.floor(config.simulationCount ?? 800));
  const residualSd = getOnlineResidualSd(state);
  const byRow = new Map<string, number[]>();
  group.forEach(row => byRow.set(row.rowId, []));
  const winCounts = new Map<string, number>();
  group.forEach(row => winCounts.set(row.rowId, 0));
  const random = createPrng(hashString(`${config.simulationSeedName ?? config.name}:${group[0]?.matchKey ?? 'match'}`));

  for (let simulation = 0; simulation < simulationCount; simulation += 1) {
    const scores = group.map(row => ({
      row,
      score: simulateAllianceScore(row, state, random, residualSd, config)
    }));
    scores.forEach(item => byRow.get(item.row.rowId)?.push(item.score));
    if (scores.length === 2) {
      const [left, right] = scores;
      if (left && right) {
        if (left.score === right.score) {
          winCounts.set(left.row.rowId, (winCounts.get(left.row.rowId) ?? 0) + 0.5);
          winCounts.set(right.row.rowId, (winCounts.get(right.row.rowId) ?? 0) + 0.5);
        } else if (left.score > right.score) {
          winCounts.set(left.row.rowId, (winCounts.get(left.row.rowId) ?? 0) + 1);
        } else {
          winCounts.set(right.row.rowId, (winCounts.get(right.row.rowId) ?? 0) + 1);
        }
      }
    }
  }

  const predictions = new Map<string, MonteCarloRowPrediction>();
  group.forEach(row => {
    const values = (byRow.get(row.rowId) ?? []).sort((left, right) => left - right);
    predictions.set(row.rowId, {
      expectedScore: clamp(mean(values), 0, MAX_REASONABLE_FRC_SCORE),
      p10Score: clamp(quantileFromSorted(values, 0.1), 0, MAX_REASONABLE_FRC_SCORE),
      p90Score: clamp(quantileFromSorted(values, 0.9), 0, MAX_REASONABLE_FRC_SCORE),
      winProbability: (winCounts.get(row.rowId) ?? 0) / simulationCount
    });
  });
  return predictions;
};

const clipOnlineError = (error: number, clip: number | undefined) => {
  if (clip == null || !Number.isFinite(clip) || clip <= 0) return error;
  return clamp(error, -clip, clip);
};

const updateOnlineEpa = (
  row: FeatureRow,
  state: OnlineEpaState,
  kFactor: number,
  eventAdjustmentScale = 0,
  eventLearningRate = 0.8,
  expectedScoreOverride?: number,
  ratingUpdateErrorClip?: number,
  residualMemoryErrorClip?: number
) => {
  const predicted = expectedScoreOverride ?? predictOnlineEpa(row, state, eventAdjustmentScale);
  const rawError = row.targetScore - predicted;
  const updateError = clipOnlineError(rawError, ratingUpdateErrorClip);
  const memoryError = clipOnlineError(rawError, residualMemoryErrorClip);
  const perTeamError = updateError / Math.max(1, row.allianceTeams.length);
  row.allianceTeams.forEach(teamKey => {
    const count = state.counts.get(teamKey) ?? 0;
    const adaptiveK = kFactor / Math.sqrt(count + 1);
    const current = state.ratings.get(teamKey) ?? getOnlineEpaDefaultContribution(state);
    state.ratings.set(teamKey, current + adaptiveK * perTeamError);
    state.counts.set(teamKey, count + 1);

    if (eventAdjustmentScale > 0) {
      const key = eventTeamKey(row.eventKey, teamKey);
      const eventCount = state.eventCounts.get(key) ?? 0;
      const adaptiveEventK = (kFactor * eventLearningRate) / Math.sqrt(eventCount + 1);
      const currentOffset = state.eventOffsets.get(key) ?? 0;
      state.eventOffsets.set(key, currentOffset + adaptiveEventK * perTeamError);
      state.eventCounts.set(key, eventCount + 1);
    }
  });
  state.allianceScores.push(row.targetScore);
  state.residuals.push(memoryError);
  const eventResiduals = state.eventResiduals.get(row.eventKey) ?? [];
  eventResiduals.push(memoryError);
  state.eventResiduals.set(row.eventKey, eventResiduals.slice(-100));
  const eventTypeResiduals = state.eventTypeResiduals.get(getEventTypeResidualKey(row)) ?? [];
  eventTypeResiduals.push(memoryError);
  state.eventTypeResiduals.set(getEventTypeResidualKey(row), eventTypeResiduals.slice(-300));
  const eventScores = state.eventScores.get(row.eventKey) ?? [];
  eventScores.push(row.targetScore);
  state.eventScores.set(row.eventKey, eventScores.slice(-100));
  state.eventAllianceRows.set(row.eventKey, (state.eventAllianceRows.get(row.eventKey) ?? 0) + 1);
};

const updateRelativeEpa = (row: FeatureRow, state: OnlineEpaState, kFactor: number) => {
  const scoreScale = Math.max(1, getOnlineAllianceScoreScale(state));
  const predicted = predictRelativeEpa(row, state);
  const predictedRelativeScore = predicted / scoreScale;
  const actualRelativeScore = row.targetScore / scoreScale;
  const relativeError = actualRelativeScore - predictedRelativeScore;
  const perTeamRelativeError = relativeError / Math.max(1, row.allianceTeams.length);

  row.allianceTeams.forEach(teamKey => {
    const count = state.counts.get(teamKey) ?? 0;
    const adaptiveK = kFactor / Math.sqrt(count + 1);
    const current = state.ratings.get(teamKey) ?? 1 / 3;
    state.ratings.set(teamKey, current + adaptiveK * perTeamRelativeError);
    state.counts.set(teamKey, count + 1);
  });
  state.allianceScores.push(row.targetScore);
  state.residuals.push(row.targetScore - predicted);
};

const updateOnlineDualEpa = (
  row: FeatureRow,
  state: OnlineEpaState,
  kFactor: number,
  defenseLearningRate: number
) => {
  const predicted = predictOnlineDualEpa(row, state);
  const error = row.targetScore - predicted;
  const perOffenseTeamError = error / Math.max(1, row.allianceTeams.length);
  const perDefenseTeamError = -error / Math.max(1, row.opponentTeams.length);
  row.allianceTeams.forEach(teamKey => {
    const count = state.counts.get(teamKey) ?? 0;
    const adaptiveK = kFactor / Math.sqrt(count + 1);
    const current = state.ratings.get(teamKey) ?? getOnlineEpaDefaultContribution(state);
    state.ratings.set(teamKey, current + adaptiveK * perOffenseTeamError);
    state.counts.set(teamKey, count + 1);
  });
  row.opponentTeams.forEach(teamKey => {
    const count = state.counts.get(teamKey) ?? 0;
    const adaptiveK = (kFactor * defenseLearningRate) / Math.sqrt(count + 1);
    const current = state.defenseRatings.get(teamKey) ?? 0;
    state.defenseRatings.set(teamKey, current + adaptiveK * perDefenseTeamError);
  });
  state.allianceScores.push(row.targetScore);
  state.residuals.push(error);
};

const applySeasonDecay = (state: OnlineEpaState, season: number, decay: number | undefined) => {
  if (state.season == null) {
    state.season = season;
    return;
  }
  if (state.season === season) return;

  const normalizedDecay = decay == null ? 1 : clamp(decay, 0, 1);
  const defaultContribution = getOnlineEpaDefaultContribution(state);
  state.previousDefaultContribution = defaultContribution;
  if (normalizedDecay <= 1e-9) {
    state.ratings.clear();
    state.defenseRatings.clear();
    state.counts.clear();
    state.eventOffsets.clear();
    state.eventCounts.clear();
    state.eventResiduals.clear();
    state.eventTypeResiduals.clear();
    state.eventScores.clear();
    state.eventAllianceRows.clear();
    state.allianceScores = [];
    state.residuals = state.residuals.slice(-500);
    state.season = season;
    return;
  }
  state.ratings.forEach((rating, teamKey) => {
    state.ratings.set(teamKey, defaultContribution + (rating - defaultContribution) * normalizedDecay);
  });
  state.defenseRatings.forEach((rating, teamKey) => {
    state.defenseRatings.set(teamKey, rating * normalizedDecay);
  });
  state.counts.forEach((count, teamKey) => {
    state.counts.set(teamKey, count * normalizedDecay);
  });
  state.eventOffsets.clear();
  state.eventCounts.clear();
  state.eventResiduals.clear();
  state.eventTypeResiduals.clear();
  state.eventScores.clear();
  state.eventAllianceRows.clear();
  state.residuals = state.residuals.slice(-500);
  state.season = season;
};

const squaredDistance = (left: number[], right: number[]) =>
  left.reduce((sum, value, index) => sum + (value - (right[index] ?? 0)) ** 2, 0);

const predictKnn = (
  row: FeatureRow,
  featureNames: string[],
  fitted: FittedModel,
  k: number
) => {
  const vector = vectorize(row, featureNames, fitted.featureMeans, fitted.featureSds).slice(1);
  const nearest = fitted.trainingVectors
    .map((trainingVector, index) => ({
      distance: squaredDistance(vector, trainingVector),
      target: fitted.trainingTargets[index] ?? 0
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, Math.max(3, k));
  const weighted = nearest.map(item => ({
    target: item.target,
    weight: 1 / (0.25 + Math.sqrt(item.distance))
  }));
  const denominator = weighted.reduce((sum, item) => sum + item.weight, 0);
  return clamp(
    weighted.reduce((sum, item) => sum + item.target * item.weight, 0) / Math.max(denominator, 1e-9),
    0,
    MAX_REASONABLE_FRC_SCORE
  );
};

const predictKernel = (
  row: FeatureRow,
  featureNames: string[],
  fitted: FittedModel,
  bandwidth: number
) => {
  const vector = vectorize(row, featureNames, fitted.featureMeans, fitted.featureSds).slice(1);
  const bw2 = Math.max(0.25, bandwidth ** 2);
  const weighted = fitted.trainingVectors.map((trainingVector, index) => ({
    target: fitted.trainingTargets[index] ?? 0,
    weight: Math.exp(-squaredDistance(vector, trainingVector) / (2 * bw2))
  }));
  const denominator = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (denominator < 1e-9) return mean(fitted.trainingTargets);
  return clamp(
    weighted.reduce((sum, item) => sum + item.target * item.weight, 0) / denominator,
    0,
    MAX_REASONABLE_FRC_SCORE
  );
};

const predictBaseline = (row: FeatureRow, trainingRows: FeatureRow[], useRoleFeatures: boolean) => {
  const trainingAverage = trainingRows.length > 0 ? mean(trainingRows.map(item => item.targetScore)) : 0;
  const ownRecent = row.features.own_recent_offense_sum || row.features.own_season_offense_sum || trainingAverage;
  const ownEvent = row.features.own_event_offense_sum || ownRecent;
  const base = ownRecent * 0.65 + ownEvent * 0.2 + trainingAverage * 0.15;
  const roleAdjustment = useRoleFeatures
    ? -(row.features.own_role_offense_cost ?? 0) - (row.features.opp_role_defense_value ?? 0)
    : 0;
  return clamp(base + roleAdjustment, 0, MAX_REASONABLE_FRC_SCORE);
};

const groupByMatch = (rows: FeatureRow[]) => {
  const groups: FeatureRow[][] = [];
  const byMatch = new Map<string, FeatureRow[]>();
  rows.forEach(row => {
    const bucket = byMatch.get(row.matchKey) ?? [];
    bucket.push(row);
    byMatch.set(row.matchKey, bucket);
  });
  Array.from(byMatch.values())
    .sort((left, right) => (left[0]?.sortKey ?? 0) - (right[0]?.sortKey ?? 0))
    .forEach(group => groups.push(group.sort((left, right) => left.perspective.localeCompare(right.perspective))));
  return groups;
};

const buildScorePrediction = (
  row: FeatureRow,
  expectedScore: number,
  residualSd: number,
  intervalScale = 1,
  overrides: Partial<Pick<ScorePrediction, 'p10Score' | 'p90Score' | 'winProbability'>> = {}
): ScorePrediction => ({
  rowId: row.rowId,
  matchKey: row.matchKey,
  eventKey: row.eventKey,
  season: row.season,
  perspective: row.perspective,
  expectedScore,
  p10Score:
    overrides.p10Score ?? clamp(expectedScore - 1.2816 * residualSd * intervalScale, 0, MAX_REASONABLE_FRC_SCORE),
  p90Score:
    overrides.p90Score ?? clamp(expectedScore + 1.2816 * residualSd * intervalScale, 0, MAX_REASONABLE_FRC_SCORE),
  actualScore: row.targetScore,
  residual: row.targetScore - expectedScore,
  winProbability: overrides.winProbability
});

const getConformalHalfWidth = (residuals: number[], config: ModelConfig) => {
  if (config.conformalInterval !== true) return null;
  const minSamples = Math.max(10, Math.floor(config.conformalMinSamples ?? 120));
  if (residuals.length < minSamples) return null;
  const window = Math.max(minSamples, Math.floor(config.conformalWindow ?? 800));
  const targetCoverage = clamp(config.conformalTargetCoverage ?? 0.8, 0.5, 0.98);
  const recent = residuals.slice(Math.max(0, residuals.length - window));
  return quantile(recent, targetCoverage);
};

interface ConformalResidualState {
  global: number[];
  bySeason: Map<number, number[]>;
  byEventProgress: Map<string, number[]>;
  bySeasonEventProgress: Map<string, number[]>;
  eventPredictionCounts: Map<string, number>;
}

const createConformalResidualState = (): ConformalResidualState => ({
  global: [],
  bySeason: new Map(),
  byEventProgress: new Map(),
  bySeasonEventProgress: new Map(),
  eventPredictionCounts: new Map()
});

const appendMapValue = <K>(map: Map<K, number[]>, key: K, value: number) => {
  const bucket = map.get(key) ?? [];
  bucket.push(value);
  map.set(key, bucket);
};

const getEventProgressBucket = (priorEventRows: number, config: ModelConfig) => {
  const earlyRows = Math.max(2, Math.floor(config.conformalEventEarlyRows ?? 24));
  const lateRows = Math.max(earlyRows + 2, Math.floor(config.conformalEventLateRows ?? 96));
  if (priorEventRows < earlyRows) return 'early';
  if (priorEventRows < lateRows) return 'middle';
  return 'late';
};

const getConformalHalfWidthFromState = (
  row: FeatureRow | undefined,
  eventProgressBucket: string,
  state: ConformalResidualState,
  config: ModelConfig
) => {
  if (!row || config.conformalInterval !== true) return null;
  const seasonProgressKey = `${row.season}:${eventProgressBucket}`;
  const scope = config.conformalScope ?? 'global';
  const candidates =
    scope === 'seasonEventProgress'
      ? [
          state.bySeasonEventProgress.get(seasonProgressKey) ?? [],
          state.bySeason.get(row.season) ?? [],
          state.byEventProgress.get(eventProgressBucket) ?? [],
          state.global
        ]
      : scope === 'season'
        ? [state.bySeason.get(row.season) ?? [], state.global]
        : scope === 'eventProgress'
          ? [state.byEventProgress.get(eventProgressBucket) ?? [], state.global]
          : [state.global];

  for (const residuals of candidates) {
    const halfWidth = getConformalHalfWidth(residuals, config);
    if (halfWidth != null) return halfWidth;
  }
  return null;
};

const recordConformalResiduals = (
  predictions: ScorePrediction[],
  eventProgressBucket: string,
  state: ConformalResidualState
) => {
  predictions.forEach(prediction => {
    const absoluteResidual = Math.abs(prediction.residual);
    const seasonProgressKey = `${prediction.season}:${eventProgressBucket}`;
    state.global.push(absoluteResidual);
    appendMapValue(state.bySeason, prediction.season, absoluteResidual);
    appendMapValue(state.byEventProgress, eventProgressBucket, absoluteResidual);
    appendMapValue(state.bySeasonEventProgress, seasonProgressKey, absoluteResidual);
  });
  const eventKey = predictions[0]?.eventKey;
  if (eventKey) {
    state.eventPredictionCounts.set(eventKey, (state.eventPredictionCounts.get(eventKey) ?? 0) + predictions.length);
  }
};

const applyConformalIntervals = (predictions: ScorePrediction[], halfWidth: number | null, config: ModelConfig) => {
  if (halfWidth == null || !Number.isFinite(halfWidth) || halfWidth <= 0) return;
  predictions.forEach(prediction => {
    const baseHalfWidth = Math.max(
      prediction.expectedScore - prediction.p10Score,
      prediction.p90Score - prediction.expectedScore,
      0
    );
    const appliedHalfWidth =
      config.conformalIntervalMode === 'widen' ? Math.max(baseHalfWidth, halfWidth) : halfWidth;
    prediction.p10Score = clamp(prediction.expectedScore - appliedHalfWidth, 0, MAX_REASONABLE_FRC_SCORE);
    prediction.p90Score = clamp(prediction.expectedScore + appliedHalfWidth, 0, MAX_REASONABLE_FRC_SCORE);
  });
};

const buildMatchPredictions = (scorePredictions: ScorePrediction[], rows: FeatureRow[]) => {
  const rowLookup = new Map(rows.map(row => [row.rowId, row]));
  const buckets = new Map<string, ScorePrediction[]>();
  scorePredictions.forEach(prediction => {
    const bucket = buckets.get(prediction.matchKey) ?? [];
    bucket.push(prediction);
    buckets.set(prediction.matchKey, bucket);
  });

  const matchPredictions: MatchPrediction[] = [];
  buckets.forEach(bucket => {
    const red = bucket.find(prediction => prediction.perspective === 'red');
    const blue = bucket.find(prediction => prediction.perspective === 'blue');
    if (!red || !blue) return;
    const redRow = rowLookup.get(red.rowId);
    const blueRow = rowLookup.get(blue.rowId);
    if (!redRow || !blueRow) return;
    const redSd = Math.max(1, (red.p90Score - red.p10Score) / 2.5632);
    const blueSd = Math.max(1, (blue.p90Score - blue.p10Score) / 2.5632);
    const marginMean = red.expectedScore - blue.expectedScore;
    const marginSd = Math.sqrt(redSd ** 2 + blueSd ** 2);
    const redWinProbability = clamp(red.winProbability ?? normalCdf(marginMean, 0, marginSd), 0, 1);
    const predictedWinner = Math.abs(marginMean) < 0.5 ? 'tie' : marginMean > 0 ? 'red' : 'blue';
    const actualMargin = red.actualScore - blue.actualScore;
    const actualWinner = actualMargin === 0 ? 'tie' : actualMargin > 0 ? 'red' : 'blue';

    matchPredictions.push({
      matchKey: red.matchKey,
      eventKey: red.eventKey,
      season: redRow.season,
      redExpectedScore: red.expectedScore,
      blueExpectedScore: blue.expectedScore,
      redP10Score: red.p10Score,
      redP90Score: red.p90Score,
      blueP10Score: blue.p10Score,
      blueP90Score: blue.p90Score,
      redActualScore: red.actualScore,
      blueActualScore: blue.actualScore,
      redWinProbability,
      blueWinProbability: 1 - redWinProbability,
      predictedWinner,
      actualWinner,
      redRole: redRow.roleOption,
      blueRole: blueRow.roleOption
    });
  });

  return matchPredictions.sort((left, right) => left.matchKey.localeCompare(right.matchKey));
};

const brierScore = (predictions: MatchPrediction[]) =>
  mean(
    predictions.map(prediction => {
      const actual = prediction.actualWinner === 'red' ? 1 : prediction.actualWinner === 'blue' ? 0 : 0.5;
      return (prediction.redWinProbability - actual) ** 2;
    })
  );

const calibrationError = (predictions: MatchPrediction[]) => {
  const bins = new Map<number, { predicted: number[]; actual: number[] }>();
  predictions.forEach(prediction => {
    const bin = Math.min(9, Math.max(0, Math.floor(prediction.redWinProbability * 10)));
    const bucket = bins.get(bin) ?? { predicted: [], actual: [] };
    bucket.predicted.push(prediction.redWinProbability);
    bucket.actual.push(prediction.actualWinner === 'red' ? 1 : prediction.actualWinner === 'blue' ? 0 : 0.5);
    bins.set(bin, bucket);
  });

  const weighted = Array.from(bins.values()).map(bucket => ({
    error: Math.abs(mean(bucket.predicted) - mean(bucket.actual)),
    count: bucket.predicted.length
  }));
  const total = weighted.reduce((sum, bucket) => sum + bucket.count, 0);
  return total === 0 ? 0 : weighted.reduce((sum, bucket) => sum + bucket.error * bucket.count, 0) / total;
};

const intervalCoverage = (predictions: ScorePrediction[]) =>
  mean(predictions.map(prediction => (prediction.actualScore >= prediction.p10Score && prediction.actualScore <= prediction.p90Score ? 1 : 0)));

const intervalWidth = (predictions: ScorePrediction[]) =>
  mean(predictions.map(prediction => prediction.p90Score - prediction.p10Score));

interface MutableSliceMetric {
  sliceType: 'season' | 'event';
  sliceKey: string;
  scoreResiduals: number[];
  covered: number[];
  intervalWidths: number[];
  marginResiduals: number[];
  winBriers: number[];
}

const getMutableSlice = (
  slices: Map<string, MutableSliceMetric>,
  sliceType: 'season' | 'event',
  sliceKey: string
) => {
  const key = `${sliceType}:${sliceKey}`;
  const existing = slices.get(key);
  if (existing) return existing;
  const created: MutableSliceMetric = {
    sliceType,
    sliceKey,
    scoreResiduals: [],
    covered: [],
    intervalWidths: [],
    marginResiduals: [],
    winBriers: []
  };
  slices.set(key, created);
  return created;
};

const addScoreToSlice = (slice: MutableSliceMetric, prediction: ScorePrediction) => {
  slice.scoreResiduals.push(prediction.residual);
  slice.covered.push(prediction.actualScore >= prediction.p10Score && prediction.actualScore <= prediction.p90Score ? 1 : 0);
  slice.intervalWidths.push(prediction.p90Score - prediction.p10Score);
};

const addMatchToSlice = (slice: MutableSliceMetric, prediction: MatchPrediction) => {
  const actual = prediction.actualWinner === 'red' ? 1 : prediction.actualWinner === 'blue' ? 0 : 0.5;
  slice.winBriers.push((prediction.redWinProbability - actual) ** 2);
  slice.marginResiduals.push(
    prediction.redActualScore -
      prediction.blueActualScore -
      (prediction.redExpectedScore - prediction.blueExpectedScore)
  );
};

const buildSliceMetrics = (
  scorePredictions: ScorePrediction[],
  matchPredictions: MatchPrediction[]
): ModelSliceMetric[] => {
  const slices = new Map<string, MutableSliceMetric>();

  scorePredictions.forEach(prediction => {
    addScoreToSlice(getMutableSlice(slices, 'season', String(prediction.season)), prediction);
    addScoreToSlice(getMutableSlice(slices, 'event', prediction.eventKey), prediction);
  });

  matchPredictions.forEach(prediction => {
    addMatchToSlice(getMutableSlice(slices, 'season', String(prediction.season)), prediction);
    addMatchToSlice(getMutableSlice(slices, 'event', prediction.eventKey), prediction);
  });

  return Array.from(slices.values())
    .map(slice => ({
      sliceType: slice.sliceType,
      sliceKey: slice.sliceKey,
      scoreMae: mae(slice.scoreResiduals),
      scoreRmse: rmse(slice.scoreResiduals),
      marginMae: mae(slice.marginResiduals),
      winBrier: mean(slice.winBriers),
      scoreIntervalCoverage: mean(slice.covered),
      scoreIntervalWidth: mean(slice.intervalWidths),
      predictionCount: slice.scoreResiduals.length,
      matchCount: slice.marginResiduals.length
    }))
    .sort(
      (left, right) =>
        left.sliceType.localeCompare(right.sliceType) ||
        right.scoreMae - left.scoreMae ||
        left.sliceKey.localeCompare(right.sliceKey)
    );
};

const buildScoreMaeStats = (sliceMetrics: ModelSliceMetric[], sliceType: 'season' | 'event') => {
  const sliceMaes = sliceMetrics
    .filter(slice => slice.sliceType === sliceType && slice.predictionCount >= 2)
    .map(slice => slice.scoreMae);
  return {
    scoreMaeStd: standardDeviation(sliceMaes),
    worstScoreMae: sliceMaes.length > 0 ? Math.max(...sliceMaes) : 0
  };
};

const buildSeasonScoreScales = (scorePredictions: ScorePrediction[]) => {
  const bySeason = new Map<number, number[]>();
  scorePredictions.forEach(prediction => {
    const bucket = bySeason.get(prediction.season) ?? [];
    bucket.push(prediction.actualScore);
    bySeason.set(prediction.season, bucket);
  });
  return new Map(Array.from(bySeason.entries()).map(([season, values]) => [season, Math.max(1, mean(values))]));
};

export const evaluateModel = (
  dataset: WalkForwardDataset,
  config: ModelConfig,
  options: { evaluationRowIds?: Set<string> } = {}
): ModelResult => {
  const groups = groupByMatch(dataset.rows);
  const trainingRows: FeatureRow[] = [];
  const scorePredictions: ScorePrediction[] = [];
  const featureNames = selectFeatureNames(dataset, config);
  const residualFeatureNames = (config.residualCorrectionWeight ?? 0) > 0 ? selectResidualFeatureNames(dataset, config) : [];
  const residualAccumulator =
    residualFeatureNames.length > 0 ? createResidualRidgeAccumulator(residualFeatureNames) : null;
  const residualTreeFeatureNames =
    (config.residualTreeCorrectionWeight ?? 0) > 0 ? selectResidualFeatureNames(dataset, config) : [];
  const residualTreeExamples: ResidualTreeExample[] = [];
  const learnedTailFeatureNames = getLearnedTailFeatureNames(config);
  const learnedTailAccumulator =
    learnedTailFeatureNames.length > 0 ? createResidualRidgeAccumulator(learnedTailFeatureNames) : null;
  const onlineEpaState = isOnlineRatingFamily(config.family) ? createOnlineEpaState() : null;
  const conformalResidualState = createConformalResidualState();
  let cachedOprFit: ReturnType<typeof fitOprRatings> = null;
  let cachedOprRowCount = -OPR_REFIT_ROW_CADENCE;
  let cachedFitted: FittedModel | null = null;
  let cachedFittedRowCount = -MODEL_REFIT_ROW_CADENCE;
  let cachedResidualFitted: FittedModel | null = null;
  let cachedResidualFitRowCount = -MODEL_REFIT_ROW_CADENCE;
  let cachedResidualTreeFitted: ResidualTreeEnsemble | null = null;
  let cachedResidualTreeFitRowCount = -MODEL_REFIT_ROW_CADENCE;
  let residualTreeExampleCount = 0;
  let cachedLearnedTailFitted: FittedModel | null = null;
  let cachedLearnedTailFitRowCount = -MODEL_REFIT_ROW_CADENCE;
  const winProbabilityCalibrationExamples: WinProbabilityCalibrationExample[] = [];
  let cachedWinProbabilityCalibrationFitted: FittedWinProbabilityCalibration | null = null;
  let cachedWinProbabilityCalibrationExampleCount = -WIN_PROBABILITY_CALIBRATION_REFIT_MATCH_CADENCE;
  const winProbabilityEpaState =
    config.winProbabilityScoreSource === 'noChampionshipTailOnlineEpa' && isOnlineRatingFamily(config.family)
      ? createOnlineEpaState()
      : null;

  groups.forEach(group => {
    const groupHead = group[0];
    const priorEventRows = groupHead ? conformalResidualState.eventPredictionCounts.get(groupHead.eventKey) ?? 0 : 0;
    const eventProgressBucket = getEventProgressBucket(priorEventRows, config);
    let fitted: FittedModel | null = null;
    if (isOnlineRatingFamily(config.family) && onlineEpaState && group[0]) {
      applySeasonDecay(onlineEpaState, group[0].season, config.seasonDecay);
    }
    if (winProbabilityEpaState && group[0]) {
      applySeasonDecay(winProbabilityEpaState, group[0].season, config.seasonDecay);
    }
    if (
      config.family === 'opr' &&
      (cachedOprFit === null || trainingRows.length - cachedOprRowCount >= OPR_REFIT_ROW_CADENCE)
    ) {
      cachedOprFit = fitOprRatings(trainingRows, config.lambda ?? 1);
      cachedOprRowCount = trainingRows.length;
    }
    const oprFit = config.family === 'opr' ? cachedOprFit : null;
    const isCadencedLearner =
      config.family === 'ridge' ||
      config.family === 'elasticNet' ||
      config.family === 'huberRidge' ||
      config.family === 'knn' ||
      config.family === 'kernel';
    if (isCadencedLearner && (cachedFitted === null || trainingRows.length - cachedFittedRowCount >= MODEL_REFIT_ROW_CADENCE)) {
      if (config.family === 'ridge') {
        cachedFitted = fitRidge(trainingRows, featureNames, config.lambda ?? 10);
      } else if (config.family === 'elasticNet') {
        cachedFitted = fitElasticNet(trainingRows, featureNames, config.lambda ?? 0.02, config.alpha ?? 0.5);
      } else if (config.family === 'huberRidge') {
        cachedFitted = fitHuberRidge(trainingRows, featureNames, config.lambda ?? 10);
      } else if (config.family === 'knn' || config.family === 'kernel') {
        cachedFitted = fitMemoryModel(trainingRows, featureNames);
      }
      cachedFittedRowCount = trainingRows.length;
    }
    fitted = isCadencedLearner ? cachedFitted : null;
    if (residualFeatureNames.length > 0) {
      const residualMinRows = Math.max(40, Math.floor(config.residualCorrectionMinRows ?? 360));
      const shouldFitResidual =
        cachedResidualFitted == null
          ? (residualAccumulator?.count ?? 0) >= residualMinRows
          : (residualAccumulator?.count ?? 0) - cachedResidualFitRowCount >= MODEL_REFIT_ROW_CADENCE;
      if (shouldFitResidual && residualAccumulator) {
        const fittedResidual = fitResidualRidgeFromAccumulator(
          residualAccumulator,
          config.residualCorrectionLambda ?? 40,
          residualMinRows
        );
        if (fittedResidual) {
          cachedResidualFitted = fittedResidual;
          cachedResidualFitRowCount = residualAccumulator.count;
        }
      }
    }
    if (residualTreeFeatureNames.length > 0) {
      const residualTreeMinRows = Math.max(40, Math.floor(config.residualTreeCorrectionMinRows ?? 720));
      const residualTreeRefitRows = Math.max(80, Math.floor(config.residualTreeCorrectionRefitRows ?? 480));
      const shouldFitResidualTree =
        cachedResidualTreeFitted == null
          ? residualTreeExamples.length >= residualTreeMinRows
          : residualTreeExampleCount - cachedResidualTreeFitRowCount >= residualTreeRefitRows;
      if (shouldFitResidualTree) {
        const fittedResidualTree = fitResidualTreeEnsemble(residualTreeExamples, residualTreeFeatureNames, config);
        if (fittedResidualTree) {
          cachedResidualTreeFitted = fittedResidualTree;
          cachedResidualTreeFitRowCount = residualTreeExampleCount;
        }
      }
    }
    if (learnedTailFeatureNames.length > 0) {
      const learnedTailMinRows = Math.max(12, Math.floor(config.learnedTailCorrectionMinRows ?? 40));
      const shouldFitLearnedTail =
        cachedLearnedTailFitted == null
          ? (learnedTailAccumulator?.count ?? 0) >= learnedTailMinRows
          : (learnedTailAccumulator?.count ?? 0) - cachedLearnedTailFitRowCount >= MODEL_REFIT_ROW_CADENCE;
      if (shouldFitLearnedTail && learnedTailAccumulator) {
        const fittedTail = fitResidualRidgeFromAccumulator(
          learnedTailAccumulator,
          config.learnedTailCorrectionLambda ?? 30,
          learnedTailMinRows
        );
        if (fittedTail) {
          cachedLearnedTailFitted = fittedTail;
          cachedLearnedTailFitRowCount = learnedTailAccumulator.count;
        }
      }
    }
    const fallbackResidualSd = Math.max(8, standardDeviation(trainingRows.map(row => row.targetScore)));
    const sourcePredictionResidualSd = Math.max(
      8,
      standardDeviation(
        trainingRows
          .filter(row => row.sourceExpectedScore != null)
          .map(row => row.targetScore - (row.sourceExpectedScore ?? 0))
      )
    );
    const monteCarloPredictions =
      (config.family === 'monteCarloEpa' || config.family === 'ensembleEpa') && onlineEpaState
        ? buildMonteCarloGroupPredictions(group, onlineEpaState, config)
        : new Map<string, MonteCarloRowPrediction>();
    const groupScorePredictions: ScorePrediction[] = [];
    const expectedScoresByRow = new Map<string, number>();
    const winProbabilityScoresByRow = new Map<string, number>();
    const learnedTailFeatureRowsByRow = new Map<string, FeatureRow>();

    group.forEach(row => {
      let expectedScore = predictBaseline(row, trainingRows, config.useRoleFeatures);
      const predictionOverrides: Partial<Pick<ScorePrediction, 'p10Score' | 'p90Score' | 'winProbability'>> = {};
      if (config.family === 'sourcePrediction' && row.sourceExpectedScore != null) {
        expectedScore = clamp(row.sourceExpectedScore, 0, MAX_REASONABLE_FRC_SCORE);
        predictionOverrides.winProbability = row.sourceWinProbability;
      } else if (config.family === 'opr' && oprFit) {
        expectedScore = clamp(
          row.allianceTeams.reduce((sum, teamKey) => sum + (oprFit.ratings.get(teamKey) ?? 0), 0),
          0,
          MAX_REASONABLE_FRC_SCORE
        );
      } else if (config.family === 'onlineEpa' && onlineEpaState) {
        expectedScore = predictOnlineEpa(row, onlineEpaState, config.eventAdjustmentScale ?? 0);
        if (config.useRoleFeatures) {
          const roleScale = config.roleAdjustmentScale ?? 1;
          expectedScore = clamp(
            expectedScore -
              ((row.features.own_role_offense_cost ?? 0) + (row.features.opp_role_defense_value ?? 0)) * roleScale,
            0,
            MAX_REASONABLE_FRC_SCORE
          );
        }
        expectedScore = clamp(
          expectedScore + getEventContextShift(row, onlineEpaState, config),
          0,
          MAX_REASONABLE_FRC_SCORE
        );
      } else if (config.family === 'relativeEpa' && onlineEpaState) {
        expectedScore = predictRelativeEpa(row, onlineEpaState);
      } else if (config.family === 'ensembleEpa' && onlineEpaState) {
        const onlineScore = clamp(
          predictOnlineEpa(row, onlineEpaState, config.eventAdjustmentScale ?? 0) +
            getEventContextShift(row, onlineEpaState, config),
          0,
          MAX_REASONABLE_FRC_SCORE
        );
        const monteCarlo = monteCarloPredictions.get(row.rowId);
        const monteCarloWeight = clamp(config.ensembleMonteCarloWeight ?? 0.2, 0, 1);
        expectedScore = clamp(
          onlineScore * (1 - monteCarloWeight) + (monteCarlo?.expectedScore ?? onlineScore) * monteCarloWeight,
          0,
          MAX_REASONABLE_FRC_SCORE
        );
        if (monteCarlo) {
          const monteCarloWinWeight = config.ensembleMonteCarloWinWeight ?? 1;
          if (monteCarloWinWeight > 0) {
            predictionOverrides.winProbability = monteCarlo.winProbability;
          }
        }
      } else if (config.family === 'monteCarloEpa' && onlineEpaState) {
        const monteCarlo = monteCarloPredictions.get(row.rowId);
        if (monteCarlo) {
          expectedScore = monteCarlo.expectedScore;
          predictionOverrides.p10Score = monteCarlo.p10Score;
          predictionOverrides.p90Score = monteCarlo.p90Score;
          predictionOverrides.winProbability = monteCarlo.winProbability;
        } else {
          expectedScore = predictOnlineEpa(row, onlineEpaState, config.eventAdjustmentScale ?? 0);
        }
      } else if (config.family === 'onlineDualEpa' && onlineEpaState) {
        expectedScore = predictOnlineDualEpa(row, onlineEpaState);
      } else if (fitted?.family === 'linear') {
        expectedScore = predictLinear(row, featureNames, fitted.coefficients, fitted.featureMeans, fitted.featureSds);
      } else if (fitted?.family === 'memory' && config.family === 'knn') {
        expectedScore = predictKnn(row, featureNames, fitted, config.k ?? 25);
      } else if (fitted?.family === 'memory' && config.family === 'kernel') {
        expectedScore = predictKernel(row, featureNames, fitted, config.bandwidth ?? 4);
      }
      expectedScore = applyComponentPriorBlend(row, expectedScore, config);
      expectedScore = applyResidualCorrection(row, expectedScore, cachedResidualFitted, residualFeatureNames, config);
      expectedScore = applyResidualTreeCorrection(row, expectedScore, cachedResidualTreeFitted, config);
      if (onlineEpaState && learnedTailFeatureNames.length > 0 && isLearnedTailCorrectionScopeAllowed(row, config)) {
        learnedTailFeatureRowsByRow.set(row.rowId, buildLearnedTailFeatureRow(row, onlineEpaState, config));
      }
      expectedScore = applyLearnedTailCorrection(
        row,
        expectedScore,
        cachedLearnedTailFitted,
        learnedTailFeatureNames,
        onlineEpaState,
        config
      );
      if (winProbabilityEpaState) {
        let winProbabilityScore = predictOnlineEpa(row, winProbabilityEpaState, config.eventAdjustmentScale ?? 0);
        if (config.useRoleFeatures) {
          const roleScale = config.roleAdjustmentScale ?? 1;
          winProbabilityScore = clamp(
            winProbabilityScore -
              ((row.features.own_role_offense_cost ?? 0) + (row.features.opp_role_defense_value ?? 0)) * roleScale,
            0,
            MAX_REASONABLE_FRC_SCORE
          );
        }
        winProbabilityScore = clamp(
          winProbabilityScore + getEventContextShiftWithoutChampionshipTail(row, winProbabilityEpaState, config),
          0,
          MAX_REASONABLE_FRC_SCORE
        );
        winProbabilityScore = applyComponentPriorBlend(row, winProbabilityScore, config);
        winProbabilityScore = applyResidualCorrection(row, winProbabilityScore, cachedResidualFitted, residualFeatureNames, config);
        winProbabilityScore = applyResidualTreeCorrection(row, winProbabilityScore, cachedResidualTreeFitted, config);
        winProbabilityScore = applyLearnedTailCorrection(
          row,
          winProbabilityScore,
          cachedLearnedTailFitted,
          learnedTailFeatureNames,
          winProbabilityEpaState,
          config
        );
        winProbabilityScoresByRow.set(row.rowId, winProbabilityScore);
      }
      const residualSd =
        config.family === 'sourcePrediction'
          ? sourcePredictionResidualSd
          : config.family === 'opr' && oprFit
          ? oprFit.residualSd
          : isOnlineRatingFamily(config.family) && onlineEpaState
            ? getOnlineResidualSd(onlineEpaState)
            : fitted?.residualSd ?? fallbackResidualSd;
      const prediction = buildScorePrediction(row, expectedScore, residualSd, config.intervalScale ?? 1, predictionOverrides);
      groupScorePredictions.push(
        applyLearnedTailUncertainty(
          prediction,
          row,
          cachedLearnedTailFitted,
          learnedTailFeatureNames,
          onlineEpaState,
          config
        )
      );
      expectedScoresByRow.set(row.rowId, expectedScore);
    });
    applyConformalIntervals(
      groupScorePredictions,
      getConformalHalfWidthFromState(groupHead, eventProgressBucket, conformalResidualState, config),
      config
    );
    if (config.family === 'ensembleEpa') {
      const monteCarloWinWeight = clamp(config.ensembleMonteCarloWinWeight ?? 1, 0, 1);
      if (monteCarloWinWeight > 0 && monteCarloWinWeight < 1) {
        const red = groupScorePredictions.find(prediction => prediction.perspective === 'red');
        const blue = groupScorePredictions.find(prediction => prediction.perspective === 'blue');
        if (red && blue && red.winProbability != null) {
          const redSd = Math.max(1, (red.p90Score - red.p10Score) / 2.5632);
          const blueSd = Math.max(1, (blue.p90Score - blue.p10Score) / 2.5632);
          const analyticWinProbability = normalCdf(
            red.expectedScore - blue.expectedScore,
            0,
            Math.sqrt(redSd ** 2 + blueSd ** 2)
          );
          const blendedWinProbability = clamp(
            analyticWinProbability * (1 - monteCarloWinWeight) + red.winProbability * monteCarloWinWeight,
            0,
            1
          );
          red.winProbability = blendedWinProbability;
          blue.winProbability = 1 - blendedWinProbability;
        }
      }
    }
    if (winProbabilityEpaState) {
      const red = groupScorePredictions.find(prediction => prediction.perspective === 'red');
      const blue = groupScorePredictions.find(prediction => prediction.perspective === 'blue');
      if (red && blue) {
        const redWinScore = winProbabilityScoresByRow.get(red.rowId);
        const blueWinScore = winProbabilityScoresByRow.get(blue.rowId);
        if (redWinScore != null && blueWinScore != null) {
          const redSd = Math.max(1, (red.p90Score - red.p10Score) / 2.5632);
          const blueSd = Math.max(1, (blue.p90Score - blue.p10Score) / 2.5632);
          const redWinProbability = clamp(
            normalCdf(redWinScore - blueWinScore, 0, Math.sqrt(redSd ** 2 + blueSd ** 2)),
            0,
            1
          );
          red.winProbability = redWinProbability;
          blue.winProbability = 1 - redWinProbability;
        }
      }
    }
    if ((config.learnedTailWinProbabilityWeight ?? 0) > 0 && onlineEpaState) {
      const red = groupScorePredictions.find(prediction => prediction.perspective === 'red');
      const blue = groupScorePredictions.find(prediction => prediction.perspective === 'blue');
      if (red && blue) {
        const redRow = group.find(row => row.rowId === red.rowId);
        const blueRow = group.find(row => row.rowId === blue.rowId);
        if (redRow && blueRow) {
          const redMean = winProbabilityScoresByRow.get(red.rowId) ?? red.expectedScore;
          const blueMean = winProbabilityScoresByRow.get(blue.rowId) ?? blue.expectedScore;
          if (shouldApplyLearnedTailWinProbability(red, blue, redMean, blueMean, config)) {
            const probabilityScale = getLearnedTailWinProbabilityScale(red, blue, redMean, blueMean, config);
            const redSd = getLearnedTailWinProbabilitySd(
              red,
              redRow,
              cachedLearnedTailFitted,
              learnedTailFeatureNames,
              onlineEpaState,
              config,
              probabilityScale
            );
            const blueSd = getLearnedTailWinProbabilitySd(
              blue,
              blueRow,
              cachedLearnedTailFitted,
              learnedTailFeatureNames,
              onlineEpaState,
              config,
              probabilityScale
            );
            const redWinProbability = clamp(normalCdf(redMean - blueMean, 0, Math.sqrt(redSd ** 2 + blueSd ** 2)), 0, 1);
            red.winProbability = redWinProbability;
            blue.winProbability = 1 - redWinProbability;
          }
        }
      }
    }
    const pendingWinProbabilityCalibrationExample =
      (config.winProbabilityCalibrationWeight ?? 0) > 0
        ? getPendingWinProbabilityCalibrationExample(groupScorePredictions, config)
        : null;
    if ((config.winProbabilityCalibrationWeight ?? 0) > 0) {
      if (
        cachedWinProbabilityCalibrationFitted === null ||
        winProbabilityCalibrationExamples.length - cachedWinProbabilityCalibrationExampleCount >=
          WIN_PROBABILITY_CALIBRATION_REFIT_MATCH_CADENCE
      ) {
        const fittedWinCalibration = fitWinProbabilityCalibration(winProbabilityCalibrationExamples, config);
        if (fittedWinCalibration) {
          cachedWinProbabilityCalibrationFitted = fittedWinCalibration;
          cachedWinProbabilityCalibrationExampleCount = winProbabilityCalibrationExamples.length;
        }
      }
      applyWinProbabilityCalibration(groupScorePredictions, cachedWinProbabilityCalibrationFitted, config);
    }
    scorePredictions.push(...groupScorePredictions);
    if (config.conformalInterval === true) {
      recordConformalResiduals(groupScorePredictions, eventProgressBucket, conformalResidualState);
    }

    if ((config.family === 'onlineEpa' || config.family === 'monteCarloEpa' || config.family === 'ensembleEpa') && onlineEpaState) {
      group.forEach(row =>
        updateOnlineEpa(
          row,
          onlineEpaState,
          config.lambda ?? 0.35,
          config.eventAdjustmentScale ?? 0,
          config.eventLearningRate ?? 0.8,
          expectedScoresByRow.get(row.rowId),
          config.ratingUpdateErrorClip,
          config.residualMemoryErrorClip
        )
      );
      if (winProbabilityEpaState) {
        group.forEach(row =>
          updateOnlineEpa(
            row,
            winProbabilityEpaState,
            config.lambda ?? 0.35,
            config.eventAdjustmentScale ?? 0,
            config.eventLearningRate ?? 0.8,
            winProbabilityScoresByRow.get(row.rowId),
            config.ratingUpdateErrorClip,
            config.residualMemoryErrorClip
          )
        );
      }
    } else if (config.family === 'relativeEpa' && onlineEpaState) {
      group.forEach(row => updateRelativeEpa(row, onlineEpaState, config.lambda ?? 1));
    } else if (config.family === 'onlineDualEpa' && onlineEpaState) {
      group.forEach(row =>
        updateOnlineDualEpa(row, onlineEpaState, config.lambda ?? 0.8, config.defenseLearningRate ?? 0.35)
      );
    }
    trainingRows.push(...group);
    if (pendingWinProbabilityCalibrationExample) {
      winProbabilityCalibrationExamples.push(pendingWinProbabilityCalibrationExample);
    }
    if ((config.residualCorrectionWeight ?? 0) > 0 && residualAccumulator) {
      group.forEach(row => {
        const expectedScore = expectedScoresByRow.get(row.rowId);
        if (expectedScore != null) {
          recordResidualRidgeExample(
            residualAccumulator,
            row,
            clamp(row.targetScore - expectedScore, -(config.residualCorrectionClip ?? 80), config.residualCorrectionClip ?? 80)
          );
        }
      });
    }
    if (learnedTailAccumulator && onlineEpaState) {
      const tailClip = Math.max(1, config.learnedTailCorrectionClip ?? 30);
      group.forEach(row => {
        const expectedScore = expectedScoresByRow.get(row.rowId);
        const learnedTailFeatureRow = learnedTailFeatureRowsByRow.get(row.rowId);
        if (expectedScore != null && learnedTailFeatureRow) {
          recordResidualRidgeExample(
            learnedTailAccumulator,
            learnedTailFeatureRow,
            clamp(row.targetScore - expectedScore, -tailClip, tailClip)
          );
        }
      });
    }
    if ((config.residualTreeCorrectionWeight ?? 0) > 0 && residualTreeFeatureNames.length > 0) {
      const maxRows = Math.max(200, Math.floor(config.residualTreeCorrectionSampleRows ?? 6000));
      const clip = Math.max(1, config.residualTreeCorrectionClip ?? 45);
      group.forEach(row => {
        const expectedScore = expectedScoresByRow.get(row.rowId);
        if (expectedScore != null) {
          recordResidualTreeExample(
            residualTreeExamples,
            row,
            residualTreeFeatureNames,
            clamp(row.targetScore - expectedScore, -clip, clip),
            maxRows
          );
          residualTreeExampleCount += 1;
        }
      });
    }
  });

  const matchPredictions = buildMatchPredictions(scorePredictions, dataset.rows);
  const evaluationRowIds = options.evaluationRowIds;
  const evaluationScorePredictions =
    evaluationRowIds == null ? scorePredictions : scorePredictions.filter(prediction => evaluationRowIds.has(prediction.rowId));
  const evaluationMatchKeys = new Set(evaluationScorePredictions.map(prediction => prediction.matchKey));
  const evaluationMatchPredictions =
    evaluationRowIds == null ? matchPredictions : matchPredictions.filter(prediction => evaluationMatchKeys.has(prediction.matchKey));
  const scoreResiduals = evaluationScorePredictions.map(prediction => prediction.residual);
  const seasonScoreScales = buildSeasonScoreScales(evaluationScorePredictions);
  const evaluationMarginResiduals = evaluationMatchPredictions.map(
    prediction =>
      prediction.redActualScore -
      prediction.blueActualScore -
      (prediction.redExpectedScore - prediction.blueExpectedScore)
  );
  const normalizedScoreResiduals = evaluationScorePredictions.map(
    prediction => prediction.residual / (seasonScoreScales.get(prediction.season) ?? 1)
  );
  const normalizedMarginResiduals = evaluationMatchPredictions.map(prediction => {
    const scale = seasonScoreScales.get(prediction.season) ?? 1;
    return (
      prediction.redActualScore -
      prediction.blueActualScore -
      (prediction.redExpectedScore - prediction.blueExpectedScore)
    ) / scale;
  });
  const scoreIntervalCoverage = intervalCoverage(evaluationScorePredictions);
  const scoreIntervalWidth = intervalWidth(evaluationScorePredictions);
  const sliceMetrics = buildSliceMetrics(evaluationScorePredictions, evaluationMatchPredictions);
  const eventScoreMaeStats = buildScoreMaeStats(sliceMetrics, 'event');
  const seasonScoreMaeStats = buildScoreMaeStats(sliceMetrics, 'season');
  const diagnosticsRows = dataset.rows.slice(0, Math.min(dataset.rows.length, 2500));
  const finalFit =
    config.family === 'ridge'
      ? fitRidge(dataset.rows, featureNames, config.lambda ?? 10)
      : config.family === 'elasticNet'
        ? fitElasticNet(dataset.rows, featureNames, config.lambda ?? 0.02, config.alpha ?? 0.5)
        : config.family === 'huberRidge'
          ? fitHuberRidge(dataset.rows, featureNames, config.lambda ?? 10)
          : null;
  const vifDiagnostics = buildVifDiagnostics(diagnosticsRows, featureNames);
  const correlationDiagnostics = buildCorrelationDiagnostics(diagnosticsRows, featureNames);
  const featureImportance = finalFit?.family === 'linear' ? buildFeatureImportance(featureNames, finalFit.coefficients, diagnosticsRows) : [];
  const rejectionReasons: string[] = [];

  if (!config.eligibleForPromotion) {
    rejectionReasons.push('Not eligible for promotion until leakage status is resolved.');
  }
  if (
    (config.family === 'ridge' || config.family === 'elasticNet' || config.family === 'huberRidge') &&
    vifDiagnostics.some(item => item.vif > 20)
  ) {
    rejectionReasons.push('High VIF features require pruning or stronger regularization before promotion.');
  }
  if (correlationDiagnostics.length > Math.max(3, featureNames.length / 5)) {
    rejectionReasons.push('Many highly correlated feature pairs; needs pruning review.');
  }
  if (scorePredictions.length < 100) {
    rejectionReasons.push('Too few predictions for a reliable promoted model.');
  }

  const result: ModelResult = {
    config,
    scorePredictions: evaluationScorePredictions,
    matchPredictions: evaluationMatchPredictions,
    averageActualScore: mean(evaluationScorePredictions.map(prediction => prediction.actualScore)),
    scoreMae: mae(scoreResiduals),
    scoreRmse: rmse(scoreResiduals),
    marginMae: mae(evaluationMarginResiduals),
    normalizedScoreMae: mae(normalizedScoreResiduals),
    normalizedMarginMae: mae(normalizedMarginResiduals),
    winBrier: brierScore(evaluationMatchPredictions),
    calibrationError: calibrationError(evaluationMatchPredictions),
    scoreIntervalCoverage,
    scoreIntervalWidth,
    coverageError: Math.abs(scoreIntervalCoverage - 0.8),
    eventScoreMaeStd: eventScoreMaeStats.scoreMaeStd,
    worstEventScoreMae: eventScoreMaeStats.worstScoreMae,
    seasonScoreMaeStd: seasonScoreMaeStats.scoreMaeStd,
    worstSeasonScoreMae: seasonScoreMaeStats.worstScoreMae,
    benchmarkScore: Number.POSITIVE_INFINITY,
    fixedBenchmarkScore: Number.POSITIVE_INFINITY,
    benchmarkRank: Number.POSITIVE_INFINITY,
    benchmarkPenalty: 0,
    overfitRiskScore: 0,
    benchmarkBreakdown: {},
    fixedBenchmarkBreakdown: {},
    predictionCount: evaluationScorePredictions.length,
    promoted: false,
    promotionConfidence: 'not_promoted',
    promotionNotes: [],
    rejectionReasons,
    sliceMetrics,
    vifDiagnostics,
    correlationDiagnostics,
    featureImportance
  };

  return result;
};

const rankScores = (modelResults: ModelResult[], getter: (result: ModelResult) => number) => {
  const sorted = [...modelResults].sort((left, right) => getter(left) - getter(right));
  const denominator = Math.max(1, sorted.length - 1);
  const scores = new Map<ModelResult, number>();
  sorted.forEach((result, index) => scores.set(result, index / denominator));
  return scores;
};

const robustMagnitudeScores = (modelResults: ModelResult[], getter: (result: ModelResult) => number) => {
  const values = modelResults.map(getter).filter(value => Number.isFinite(value)).sort((left, right) => left - right);
  const best = values[0] ?? 0;
  const median = values[Math.floor(values.length / 2)] ?? best;
  const upperQuartile = values[Math.floor(values.length * 0.75)] ?? median;
  const scale = Math.max(1e-9, Math.min(Math.max(median - best, 1e-9) * 1.5, Math.max(upperQuartile - best, 1e-9)));
  const scores = new Map<ModelResult, number>();

  modelResults.forEach(result => {
    const value = getter(result);
    const relativeLoss = Math.max(0, (value - best) / scale);
    scores.set(result, Math.min(5, relativeLoss ** 1.15));
  });

  return scores;
};

const squaredExcess = (value: number, threshold: number, scale: number) => {
  const excess = Math.max(0, value - threshold) / Math.max(scale, 1e-9);
  return excess ** 2;
};

const buildOverfitRiskScore = (result: ModelResult) => {
  const maxVif = result.vifDiagnostics[0]?.vif ?? 1;
  const vifRisk = Math.min(4, squaredExcess(maxVif, 12, 18) * 1.4);
  const correlationRisk = Math.min(
    3,
    result.correlationDiagnostics.reduce(
      (sum, item) => sum + squaredExcess(Math.abs(item.correlation), 0.96, 0.04) * 0.35,
      0
    )
  );
  const rejectionRisk = result.rejectionReasons.length > 0 ? result.rejectionReasons.length ** 2 * 0.35 : 0;
  const sliceInstabilityRatio = result.eventScoreMaeStd / Math.max(result.scoreMae, 1e-9);
  const sliceRisk = Math.min(2, squaredExcess(sliceInstabilityRatio, 0.25, 0.2) * 0.6);
  const seasonInstabilityRatio = result.seasonScoreMaeStd / Math.max(result.scoreMae, 1e-9);
  const seasonRisk = Math.min(1.5, squaredExcess(seasonInstabilityRatio, 0.18, 0.16) * 0.55);
  const coverageRisk = Math.min(1.5, (result.coverageError / 0.12) ** 2 * 0.25);
  return vifRisk + correlationRisk + rejectionRisk + sliceRisk + seasonRisk + coverageRisk;
};

const fixedBenchmarkComponent = (value: number, target: number, cap = 6) => {
  if (!Number.isFinite(value)) return cap;
  const ratio = Math.max(0, value) / Math.max(target, 1e-9);
  const magnified = ratio <= 1 ? ratio : ratio + (ratio - 1) ** 2;
  return Math.min(cap, magnified);
};

const buildFixedBenchmarkScore = (result: ModelResult) => {
  const scoreScale = Math.max(1, result.averageActualScore);
  const components = [
    ['scoreMaeToAvg', 0.16, result.scoreMae / scoreScale, 0.28],
    ['scoreRmseToAvg', 0.08, result.scoreRmse / scoreScale, 0.36],
    ['marginMaeToAvg', 0.13, result.marginMae / scoreScale, 0.4],
    ['normalizedScoreMae', 0.07, result.normalizedScoreMae, 0.28],
    ['normalizedMarginMae', 0.07, result.normalizedMarginMae, 0.4],
    ['winBrier', 0.12, result.winBrier, 0.17],
    ['calibration', 0.07, result.calibrationError, 0.025],
    ['coverageError', 0.08, result.coverageError, 0.06],
    ['worstEventToAvg', 0.06, result.worstEventScoreMae / scoreScale, 0.5],
    ['eventInstabilityRatio', 0.05, result.eventScoreMaeStd / Math.max(result.scoreMae, 1e-9), 0.45],
    ['worstSeasonToAvg', 0.04, result.worstSeasonScoreMae / scoreScale, 0.36],
    ['seasonInstabilityRatio', 0.03, result.seasonScoreMaeStd / Math.max(result.scoreMae, 1e-9), 0.25],
    ['intervalWidthToAvg', 0.04, result.scoreIntervalWidth / scoreScale, 0.75]
  ] as const;
  const breakdown: Record<string, number> = {
    averageActualScore: result.averageActualScore
  };
  const metricBlend = components.reduce((sum, [name, weight, value, target]) => {
    const component = fixedBenchmarkComponent(value, target);
    breakdown[`${name}Value`] = value;
    breakdown[`${name}Target`] = target;
    breakdown[`${name}Component`] = component;
    return sum + weight * component;
  }, 0);

  breakdown.metricBlend = metricBlend;
  breakdown.overfitRisk = result.overfitRiskScore;
  breakdown.leakageEligibilityPenalty = result.benchmarkPenalty - result.overfitRiskScore;

  return {
    score: metricBlend + result.benchmarkPenalty,
    breakdown
  };
};

const applyBenchmarkScores = (modelResults: ModelResult[]) => {
  const weights = [
    ['scoreMae', 0.16, (result: ModelResult) => result.scoreMae],
    ['scoreRmse', 0.08, (result: ModelResult) => result.scoreRmse],
    ['marginMae', 0.13, (result: ModelResult) => result.marginMae],
    ['normalizedScoreMae', 0.07, (result: ModelResult) => result.normalizedScoreMae],
    ['normalizedMarginMae', 0.07, (result: ModelResult) => result.normalizedMarginMae],
    ['winBrier', 0.12, (result: ModelResult) => result.winBrier],
    ['calibration', 0.07, (result: ModelResult) => result.calibrationError],
    ['coverageError', 0.08, (result: ModelResult) => result.coverageError],
    ['worstEvent', 0.06, (result: ModelResult) => result.worstEventScoreMae],
    ['eventInstability', 0.05, (result: ModelResult) => result.eventScoreMaeStd],
    ['worstSeason', 0.04, (result: ModelResult) => result.worstSeasonScoreMae],
    ['seasonInstability', 0.03, (result: ModelResult) => result.seasonScoreMaeStd],
    ['intervalWidth', 0.04, (result: ModelResult) => result.scoreIntervalWidth]
  ] as const;
  const rankMaps = weights.map(([name, weight, getter]) => ({
    name,
    weight,
    ranks: rankScores(modelResults, getter),
    magnitudes: robustMagnitudeScores(modelResults, getter)
  }));

  modelResults.forEach(result => {
    const leakagePenalty = result.config.leakageRisk === 'high' ? 4 : result.config.leakageRisk === 'medium' ? 1.25 : 0;
    const eligibilityPenalty = result.config.eligibleForPromotion ? 0 : 2.25;
    const overfitRiskScore = buildOverfitRiskScore(result);
    const benchmarkPenalty = leakagePenalty + eligibilityPenalty + overfitRiskScore;
    const benchmarkBreakdown: Record<string, number> = {};
    const rankBlend = rankMaps.reduce((sum, item) => {
      const rank = item.ranks.get(result) ?? 1;
      benchmarkBreakdown[`${item.name}Rank`] = rank;
      return sum + item.weight * rank;
    }, 0);
    const magnitudeBlend = rankMaps.reduce((sum, item) => {
      const magnitude = item.magnitudes.get(result) ?? 1;
      benchmarkBreakdown[`${item.name}Magnitude`] = magnitude;
      return sum + item.weight * magnitude;
    }, 0);

    benchmarkBreakdown.rankBlend = rankBlend;
    benchmarkBreakdown.magnitudeBlend = magnitudeBlend;
    benchmarkBreakdown.overfitRisk = overfitRiskScore;
    benchmarkBreakdown.leakagePenalty = leakagePenalty;
    benchmarkBreakdown.eligibilityPenalty = eligibilityPenalty;
    result.overfitRiskScore = overfitRiskScore;
    result.benchmarkPenalty = benchmarkPenalty;
    result.benchmarkBreakdown = benchmarkBreakdown;
    result.benchmarkScore = rankBlend * 0.45 + magnitudeBlend * 0.55 + benchmarkPenalty;
    const fixedBenchmark = buildFixedBenchmarkScore(result);
    result.fixedBenchmarkScore = fixedBenchmark.score;
    result.fixedBenchmarkBreakdown = fixedBenchmark.breakdown;
  });

  [...modelResults]
    .sort((left, right) => left.benchmarkScore - right.benchmarkScore)
    .forEach((result, index) => {
      result.benchmarkRank = index + 1;
    });
};

const RELATIVE_NEAR_TIE_THRESHOLD = 0.05;
const FIXED_NEAR_TIE_THRESHOLD = 0.01;

const applyPromotionDecision = (eligible: ModelResult[]) => {
  if (eligible.length === 0) return null;

  const relativeBest = [...eligible].sort(
    (left, right) =>
      left.benchmarkScore - right.benchmarkScore ||
      left.scoreMae - right.scoreMae ||
      left.marginMae - right.marginMae ||
      left.winBrier - right.winBrier
  )[0] ?? null;
  if (!relativeBest) return null;

  const fixedBest = [...eligible].sort(
    (left, right) =>
      left.fixedBenchmarkScore - right.fixedBenchmarkScore ||
      left.scoreMae - right.scoreMae ||
      left.marginMae - right.marginMae ||
      left.winBrier - right.winBrier
  )[0] ?? null;
  const nearTieGroup = eligible
    .filter(result => {
      const relativeDelta = result.benchmarkScore - relativeBest.benchmarkScore;
      const fixedDelta = fixedBest ? result.fixedBenchmarkScore - fixedBest.fixedBenchmarkScore : 0;
      return relativeDelta <= RELATIVE_NEAR_TIE_THRESHOLD || fixedDelta <= FIXED_NEAR_TIE_THRESHOLD;
    })
    .sort((left, right) => left.benchmarkScore - right.benchmarkScore || left.fixedBenchmarkScore - right.fixedBenchmarkScore);
  const fixedDisagreement = fixedBest != null && fixedBest.config.name !== relativeBest.config.name;
  const isNearTie = nearTieGroup.length > 1 || fixedDisagreement;

  relativeBest.promoted = true;
  relativeBest.promotionConfidence = isNearTie ? 'near_tie' : 'clear';
  relativeBest.promotionNotes = [
    isNearTie
      ? `Promoted by relative benchmark, but ${nearTieGroup.length} eligible model(s) are within near-tie thresholds.`
      : 'Promoted by relative benchmark with no eligible near-tie rival.',
    fixedBest
      ? `Best fixed-benchmark model: ${fixedBest.config.name} (${fixedBest.fixedBenchmarkScore.toFixed(3)}).`
      : 'No fixed-benchmark rival was eligible.'
  ];

  nearTieGroup.forEach((result, index) => {
    if (result === relativeBest) return;
    result.promotionConfidence = 'near_tie';
    result.promotionNotes = [
      `Near-tie candidate #${index + 1}: relative delta ${(result.benchmarkScore - relativeBest.benchmarkScore).toFixed(
        3
      )}, fixed delta ${(fixedBest ? result.fixedBenchmarkScore - fixedBest.fixedBenchmarkScore : 0).toFixed(3)}.`
    ];
  });

  return relativeBest;
};

export const runModelSearch = (
  dataset: WalkForwardDataset,
  configs = candidateModelConfigs,
  options: {
    evaluationRowFilter?: (row: FeatureRow) => boolean;
    extraNotes?: string[];
    onModelResult?: (result: ModelResult, index: number, total: number) => void;
  } = {}
): ResearchRun => {
  const skippedFamilies = new Set(dataset.rows.length > 5000 ? ['knn', 'kernel', 'opr'] : []);
  const activeConfigs = configs.filter(config => !skippedFamilies.has(config.family));
  const evaluationRows = options.evaluationRowFilter ? dataset.rows.filter(options.evaluationRowFilter) : dataset.rows;
  const evaluationRowIds = new Set(evaluationRows.map(row => row.rowId));
  const modelResults = activeConfigs.map((config, index) => {
    const result = evaluateModel(dataset, config, { evaluationRowIds });
    options.onModelResult?.(result, index + 1, activeConfigs.length);
    return result;
  });
  applyBenchmarkScores(modelResults);
  const eligible = modelResults
    .filter(result => result.config.eligibleForPromotion && result.rejectionReasons.length === 0)
    .sort(
      (left, right) =>
        left.benchmarkScore - right.benchmarkScore ||
        left.scoreMae - right.scoreMae ||
        left.marginMae - right.marginMae ||
        left.winBrier - right.winBrier
    );
  const best = applyPromotionDecision(eligible);

  return {
    runId: `run-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    createdAt: new Date().toISOString(),
    matches: new Set(dataset.rows.map(row => row.matchKey)).size,
    rows: dataset.rows.length,
    evaluationMatches: new Set(evaluationRows.map(row => row.matchKey)).size,
    evaluationRows: evaluationRows.length,
    modelResults: modelResults.sort(
      (left, right) =>
        Number(right.promoted) - Number(left.promoted) ||
        left.benchmarkScore - right.benchmarkScore ||
        left.scoreMae - right.scoreMae
    ),
    bestModelName: best?.config.name ?? null,
    notes: [
      ...dataset.leakageNotes,
      ...(options.extraNotes ?? []),
      ...(skippedFamilies.size > 0
        ? [`Skipped ${Array.from(skippedFamilies).join('/')} on ${dataset.rows.length} rows because those memory models are quadratic at this scale.`]
        : [])
    ]
  };
};

export const getPredictionForMatch = (
  run: ResearchRun,
  modelName: string | null,
  matchKey: string
): MatchPrediction | null => {
  const model = run.modelResults.find(result => result.config.name === (modelName ?? run.bestModelName));
  return model?.matchPredictions.find(prediction => prediction.matchKey === matchKey) ?? null;
};
