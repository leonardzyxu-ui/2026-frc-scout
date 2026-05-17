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
import { clamp, mae, mean, normalCdf, rmse, standardDeviation } from '../util.ts';
import { buildCorrelationDiagnostics, buildFeatureImportance, buildVifDiagnostics } from './diagnostics.ts';

const MAX_REASONABLE_FRC_SCORE = 700;
const MODEL_REFIT_ROW_CADENCE = 160;
const OPR_REFIT_ROW_CADENCE = 240;

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
  'own_scout_offense_sum',
  'opp_scout_offense_sum',
  'own_scout_defense_sum',
  'opp_scout_defense_sum',
  'own_role_offense_cost',
  'opp_role_offense_cost',
  'own_role_defense_value',
  'opp_role_defense_value',
  'own_reliability_penalty_sum',
  'opp_reliability_penalty_sum'
]);

const selectFeatureNames = (dataset: WalkForwardDataset, config: ModelConfig) =>
  config.family === 'opr' ||
  config.family === 'onlineEpa' ||
  config.family === 'onlineDualEpa' ||
  config.family === 'monteCarloEpa' ||
  config.family === 'sourcePrediction'
    ? []
    : dataset.featureNames.filter(feature => {
        if (!config.useRoleFeatures && feature.includes('_role_')) return false;
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

const isOnlineRatingFamily = (family: ModelConfig['family']) =>
  family === 'onlineEpa' || family === 'onlineDualEpa' || family === 'monteCarloEpa';

interface FittedModel {
  family: 'linear' | 'memory';
  coefficients: number[];
  featureMeans: number[];
  featureSds: number[];
  trainingVectors: number[][];
  trainingTargets: number[];
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
  counts: new Map(),
  allianceScores: [],
  residuals: [],
  previousDefaultContribution: null,
  season: null
});

const getOnlineEpaDefaultContribution = (state: OnlineEpaState) =>
  state.allianceScores.length > 0 ? mean(state.allianceScores) / 3 : state.previousDefaultContribution ?? 0;

const eventTeamKey = (eventKey: string, teamKey: string) => `${eventKey}|${teamKey}`;

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
  return clamp(base + roleDelta + randomNormal(random) * residualSd * scoreNoiseScale, 0, MAX_REASONABLE_FRC_SCORE);
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
  const random = createPrng(hashString(`${config.name}:${group[0]?.matchKey ?? 'match'}`));

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

const updateOnlineEpa = (
  row: FeatureRow,
  state: OnlineEpaState,
  kFactor: number,
  eventAdjustmentScale = 0,
  eventLearningRate = 0.8
) => {
  const predicted = predictOnlineEpa(row, state, eventAdjustmentScale);
  const error = row.targetScore - predicted;
  const perTeamError = error / Math.max(1, row.allianceTeams.length);
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
  state.residuals.push(error);
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

export const evaluateModel = (dataset: WalkForwardDataset, config: ModelConfig): ModelResult => {
  const groups = groupByMatch(dataset.rows);
  const trainingRows: FeatureRow[] = [];
  const scorePredictions: ScorePrediction[] = [];
  const featureNames = selectFeatureNames(dataset, config);
  const onlineEpaState = isOnlineRatingFamily(config.family) ? createOnlineEpaState() : null;
  let cachedOprFit: ReturnType<typeof fitOprRatings> = null;
  let cachedOprRowCount = -OPR_REFIT_ROW_CADENCE;
  let cachedFitted: FittedModel | null = null;
  let cachedFittedRowCount = -MODEL_REFIT_ROW_CADENCE;

  groups.forEach(group => {
    let fitted: FittedModel | null = null;
    if (isOnlineRatingFamily(config.family) && onlineEpaState && group[0]) {
      applySeasonDecay(onlineEpaState, group[0].season, config.seasonDecay);
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
      config.family === 'monteCarloEpa' && onlineEpaState
        ? buildMonteCarloGroupPredictions(group, onlineEpaState, config)
        : new Map<string, MonteCarloRowPrediction>();

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
      const residualSd =
        config.family === 'sourcePrediction'
          ? sourcePredictionResidualSd
          : config.family === 'opr' && oprFit
          ? oprFit.residualSd
          : isOnlineRatingFamily(config.family) && onlineEpaState
            ? getOnlineResidualSd(onlineEpaState)
            : fitted?.residualSd ?? fallbackResidualSd;
      scorePredictions.push(
        buildScorePrediction(row, expectedScore, residualSd, config.intervalScale ?? 1, predictionOverrides)
      );
    });

    if ((config.family === 'onlineEpa' || config.family === 'monteCarloEpa') && onlineEpaState) {
      group.forEach(row =>
        updateOnlineEpa(
          row,
          onlineEpaState,
          config.lambda ?? 0.35,
          config.eventAdjustmentScale ?? 0,
          config.eventLearningRate ?? 0.8
        )
      );
    } else if (config.family === 'onlineDualEpa' && onlineEpaState) {
      group.forEach(row =>
        updateOnlineDualEpa(row, onlineEpaState, config.lambda ?? 0.8, config.defenseLearningRate ?? 0.35)
      );
    }
    trainingRows.push(...group);
  });

  const matchPredictions = buildMatchPredictions(scorePredictions, dataset.rows);
  const scoreResiduals = scorePredictions.map(prediction => prediction.residual);
  const seasonScoreScales = buildSeasonScoreScales(scorePredictions);
  const marginResiduals = matchPredictions.map(
    prediction =>
      prediction.redActualScore -
      prediction.blueActualScore -
      (prediction.redExpectedScore - prediction.blueExpectedScore)
  );
  const normalizedScoreResiduals = scorePredictions.map(
    prediction => prediction.residual / (seasonScoreScales.get(prediction.season) ?? 1)
  );
  const normalizedMarginResiduals = matchPredictions.map(prediction => {
    const scale = seasonScoreScales.get(prediction.season) ?? 1;
    return (
      prediction.redActualScore -
      prediction.blueActualScore -
      (prediction.redExpectedScore - prediction.blueExpectedScore)
    ) / scale;
  });
  const scoreIntervalCoverage = intervalCoverage(scorePredictions);
  const scoreIntervalWidth = intervalWidth(scorePredictions);
  const sliceMetrics = buildSliceMetrics(scorePredictions, matchPredictions);
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
    scorePredictions,
    matchPredictions,
    scoreMae: mae(scoreResiduals),
    scoreRmse: rmse(scoreResiduals),
    marginMae: mae(marginResiduals),
    normalizedScoreMae: mae(normalizedScoreResiduals),
    normalizedMarginMae: mae(normalizedMarginResiduals),
    winBrier: brierScore(matchPredictions),
    calibrationError: calibrationError(matchPredictions),
    scoreIntervalCoverage,
    scoreIntervalWidth,
    coverageError: Math.abs(scoreIntervalCoverage - 0.8),
    eventScoreMaeStd: eventScoreMaeStats.scoreMaeStd,
    worstEventScoreMae: eventScoreMaeStats.worstScoreMae,
    seasonScoreMaeStd: seasonScoreMaeStats.scoreMaeStd,
    worstSeasonScoreMae: seasonScoreMaeStats.worstScoreMae,
    benchmarkScore: Number.POSITIVE_INFINITY,
    benchmarkRank: Number.POSITIVE_INFINITY,
    benchmarkPenalty: 0,
    overfitRiskScore: 0,
    benchmarkBreakdown: {},
    predictionCount: scorePredictions.length,
    promoted: false,
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
  });

  [...modelResults]
    .sort((left, right) => left.benchmarkScore - right.benchmarkScore)
    .forEach((result, index) => {
      result.benchmarkRank = index + 1;
    });
};

export const runModelSearch = (dataset: WalkForwardDataset, configs = candidateModelConfigs): ResearchRun => {
  const skippedFamilies = new Set(dataset.rows.length > 5000 ? ['knn', 'kernel', 'opr'] : []);
  const activeConfigs = configs.filter(config => !skippedFamilies.has(config.family));
  const modelResults = activeConfigs.map(config => evaluateModel(dataset, config));
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
  const best = eligible[0] ?? null;
  if (best) best.promoted = true;

  return {
    runId: `run-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    createdAt: new Date().toISOString(),
    matches: new Set(dataset.rows.map(row => row.matchKey)).size,
    rows: dataset.rows.length,
    modelResults: modelResults.sort(
      (left, right) =>
        Number(right.promoted) - Number(left.promoted) ||
        left.benchmarkScore - right.benchmarkScore ||
        left.scoreMae - right.scoreMae
    ),
    bestModelName: best?.config.name ?? null,
    notes: [
      ...dataset.leakageNotes,
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
