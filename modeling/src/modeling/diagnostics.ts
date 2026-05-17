import { Matrix, solve } from 'ml-matrix';
import type { CorrelationDiagnostic, FeatureImportance, FeatureRow, VifDiagnostic } from '../types.ts';
import { mean, safeDivide, standardDeviation } from '../util.ts';

const column = (rows: FeatureRow[], feature: string) => rows.map(row => row.features[feature] ?? 0);

export const buildCorrelationDiagnostics = (
  rows: FeatureRow[],
  featureNames: string[],
  threshold = 0.96
): CorrelationDiagnostic[] => {
  const columns = new Map<string, number[]>();
  featureNames.forEach(feature => columns.set(feature, column(rows, feature)));
  const diagnostics: CorrelationDiagnostic[] = [];

  for (let leftIndex = 0; leftIndex < featureNames.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < featureNames.length; rightIndex += 1) {
      const left = featureNames[leftIndex] ?? '';
      const right = featureNames[rightIndex] ?? '';
      const correlation = pearson(columns.get(left) ?? [], columns.get(right) ?? []);
      if (Math.abs(correlation) >= threshold) {
        diagnostics.push({ left, right, correlation });
      }
    }
  }

  return diagnostics.sort((left, right) => Math.abs(right.correlation) - Math.abs(left.correlation));
};

export const pearson = (left: number[], right: number[]) => {
  if (left.length !== right.length || left.length < 2) return 0;
  const leftMean = mean(left);
  const rightMean = mean(right);
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = (left[index] ?? 0) - leftMean;
    const rightDelta = (right[index] ?? 0) - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }

  return safeDivide(numerator, Math.sqrt(leftVariance * rightVariance));
};

const fitRidge = (x: number[][], y: number[], lambda: number) => {
  if (x.length === 0 || x[0]?.length === 0) return [];
  const matrix = new Matrix(x);
  const target = Matrix.columnVector(y);
  const xt = matrix.transpose();
  const xtx = xt.mmul(matrix);
  const penalty = Matrix.eye(xtx.rows, xtx.columns).mul(lambda);
  penalty.set(0, 0, 0);
  const coefficients = solve(xtx.add(penalty), xt.mmul(target));
  return coefficients.to1DArray();
};

export const buildVifDiagnostics = (
  rows: FeatureRow[],
  featureNames: string[],
  maxFeatures = 32
): VifDiagnostic[] => {
  const candidates = featureNames
    .map(feature => ({
      feature,
      sd: standardDeviation(column(rows, feature))
    }))
    .filter(item => item.sd > 1e-9)
    .sort((left, right) => right.sd - left.sd)
    .slice(0, maxFeatures)
    .map(item => item.feature);

  return candidates
    .map(feature => {
      const others = candidates.filter(candidate => candidate !== feature);
      if (others.length === 0 || rows.length < others.length + 8) {
        return { feature, vif: 1 };
      }
      const target = column(rows, feature);
      const targetMean = mean(target);
      const x = rows.map(row => [1, ...others.map(other => row.features[other] ?? 0)]);
      const coefficients = fitRidge(x, target, 1e-6);
      const fitted = x.map(values => values.reduce((sum, value, index) => sum + value * (coefficients[index] ?? 0), 0));
      const ssResidual = target.reduce((sum, value, index) => sum + (value - (fitted[index] ?? 0)) ** 2, 0);
      const ssTotal = target.reduce((sum, value) => sum + (value - targetMean) ** 2, 0);
      const rSquared = Math.max(0, Math.min(0.999999, 1 - safeDivide(ssResidual, ssTotal, 1)));
      return { feature, vif: 1 / (1 - rSquared) };
    })
    .sort((left, right) => right.vif - left.vif);
};

export const buildFeatureImportance = (
  featureNames: string[],
  coefficients: number[],
  rows: FeatureRow[]
): FeatureImportance[] => {
  return featureNames
    .map((feature, index) => {
      const coefficient = coefficients[index + 1] ?? 0;
      const standardizedMagnitude = Math.abs(coefficient) * standardDeviation(column(rows, feature));
      return { feature, coefficient, standardizedMagnitude };
    })
    .sort((left, right) => right.standardizedMagnitude - left.standardizedMagnitude);
};
