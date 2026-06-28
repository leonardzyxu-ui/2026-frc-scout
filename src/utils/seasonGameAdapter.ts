import type { TBAScoreBreakdownAlliance } from './mathEngine.ts';

export interface GameBonusMetrics {
  towerMetric: number;
  fuelMetric: number;
}

export interface GameRankingPointBreakdown {
  totalRp: number;
  winRp: number;
  towerRp: number;
  energizedRp: number;
  superchargedRp: number;
}

export interface SeasonGameAdapter {
  season: number;
  label: string;
  towerRpThreshold: number;
  energizedRpThreshold: number;
  superchargedRpThreshold: number;
  winRp: number;
  getBonusMetricsFromBreakdown: (breakdown: TBAScoreBreakdownAlliance | undefined) => GameBonusMetrics | null;
  calculateRankingPoints: (isWinner: boolean, bonusMetrics: GameBonusMetrics | null) => GameRankingPointBreakdown;
}

const REBUILT_2026_RP_RULES = {
  winRp: 3,
  towerRpThreshold: 50,
  energizedRpThreshold: 100,
  superchargedRpThreshold: 360
};

const firstNumeric = (
  breakdown: TBAScoreBreakdownAlliance | undefined,
  keys: string[]
) => {
  if (!breakdown) return null;
  for (const key of keys) {
    const value = breakdown[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
};

export const rebuilt2026GameAdapter: SeasonGameAdapter = {
  season: 2026,
  label: 'REBUILT 2026 simplified RP model',
  towerRpThreshold: REBUILT_2026_RP_RULES.towerRpThreshold,
  energizedRpThreshold: REBUILT_2026_RP_RULES.energizedRpThreshold,
  superchargedRpThreshold: REBUILT_2026_RP_RULES.superchargedRpThreshold,
  winRp: REBUILT_2026_RP_RULES.winRp,
  getBonusMetricsFromBreakdown: breakdown => {
    const towerMetric =
      firstNumeric(breakdown, [
        'tower_epa',
        'tower_points',
        'towerPoints',
        'tower_progress',
        'towerProgress'
      ]) ??
      firstNumeric(breakdown, ['endgame_points', 'endGamePoints']) ??
      firstNumeric(breakdown, ['total_tower', 'tower']);

    const fuelMetric =
      firstNumeric(breakdown, [
        'fuel_epa',
        'fuel_points',
        'fuelPoints',
        'fuel_progress',
        'fuelProgress',
        'total_fuel',
        'fuel'
      ]);

    if (towerMetric == null && fuelMetric == null) return null;
    return {
      towerMetric: towerMetric ?? 0,
      fuelMetric: fuelMetric ?? 0
    };
  },
  calculateRankingPoints: (isWinner, bonusMetrics) => {
    const winRp = isWinner ? REBUILT_2026_RP_RULES.winRp : 0;
    const towerRp = bonusMetrics && bonusMetrics.towerMetric >= REBUILT_2026_RP_RULES.towerRpThreshold ? 1 : 0;
    const energizedRp = bonusMetrics && bonusMetrics.fuelMetric >= REBUILT_2026_RP_RULES.energizedRpThreshold ? 1 : 0;
    const superchargedRp = bonusMetrics && bonusMetrics.fuelMetric >= REBUILT_2026_RP_RULES.superchargedRpThreshold ? 1 : 0;
    return {
      totalRp: winRp + towerRp + energizedRp + superchargedRp,
      winRp,
      towerRp,
      energizedRp,
      superchargedRp
    };
  }
};
