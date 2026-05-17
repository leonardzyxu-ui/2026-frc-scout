import fs from 'node:fs';
import path from 'node:path';
import type { ResearchRun } from './types.ts';

export const ensureDir = (dir: string) => {
  fs.mkdirSync(dir, { recursive: true });
};

export const readJsonFile = <T>(filePath: string): T => {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
};

export const writeJsonFile = (filePath: string, value: unknown) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

export const writeTextFile = (filePath: string, value: string) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value.endsWith('\n') ? value : `${value}\n`);
};

export const compactResearchRun = (run: ResearchRun): ResearchRun => ({
  ...run,
  modelResults: run.modelResults.map(result => ({
    ...result,
    scorePredictions: result.promoted ? result.scorePredictions : [],
    matchPredictions: result.promoted ? result.matchPredictions : [],
    vifDiagnostics: result.vifDiagnostics.slice(0, 50),
    correlationDiagnostics: result.correlationDiagnostics.slice(0, 50),
    featureImportance: result.featureImportance.slice(0, 50)
  }))
});

export const normalizeTeamKey = (value: unknown) => {
  const digits = String(value ?? '').replace(/^frc/i, '').match(/\d+/g)?.join('') ?? '';
  return digits ? `frc${digits}` : '';
};

export const normalizeEventKey = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, '').toLowerCase();

export const seasonFromEventKey = (eventKey: string) => {
  const parsed = Number.parseInt(eventKey.slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const mean = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const variance = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
};

export const standardDeviation = (values: number[]) => Math.sqrt(variance(values));

export const quantile = (values: number[], probability: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = clamp((sorted.length - 1) * probability, 0, sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
};

export const mae = (values: number[]) => mean(values.map(value => Math.abs(value)));

export const rmse = (values: number[]) => Math.sqrt(mean(values.map(value => value ** 2)));

export const dot = (left: number[], right: number[]) =>
  left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);

export const safeDivide = (numerator: number, denominator: number, fallback = 0) =>
  Math.abs(denominator) < 1e-9 ? fallback : numerator / denominator;

export const matchSortRank = (compLevel: string, matchNumber: number, startTime: number | null) => {
  const compOrder: Record<string, number> = { pm: 0, qm: 1, ef: 2, qf: 3, sf: 4, f: 5 };
  const normalizedLevel = compLevel.trim().toLowerCase();
  const timePart = startTime == null ? 0 : startTime;
  return timePart * 100000 + (compOrder[normalizedLevel] ?? 9) * 10000 + matchNumber;
};

export const erf = (value: number) => {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x));
  return sign * y;
};

export const normalCdf = (value: number, meanValue = 0, sdValue = 1) => {
  const sd = Math.max(1e-6, sdValue);
  return 0.5 * (1 + erf((value - meanValue) / (sd * Math.sqrt(2))));
};

export const parseArgs = (rawArgs: string[]) => {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg?.startsWith('--')) {
      if (arg) positionals.push(arg);
      continue;
    }

    const equalsIndex = arg.indexOf('=');
    if (equalsIndex >= 0) {
      flags[arg.slice(2, equalsIndex)] = arg.slice(equalsIndex + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = rawArgs[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }

  return { flags, positionals };
};

export const getStringFlag = (flags: Record<string, string | boolean>, key: string, fallback = '') => {
  const value = flags[key];
  return typeof value === 'string' ? value : fallback;
};

export const getNumberFlag = (flags: Record<string, string | boolean>, key: string, fallback: number) => {
  const value = flags[key];
  if (typeof value !== 'string') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getBooleanFlag = (flags: Record<string, string | boolean>, key: string) => flags[key] === true;
