import type { TBAScoreBreakdownAlliance } from './mathEngine.ts';

export interface GameBonusMetrics {
  towerMetric: number;
  fuelMetric: number;
}

export interface GameRankingPointBreakdown {
  totalRp: number;
  winRp: number;
  towerRp: number;
  traversalRp: number;
  energizedRp: number;
  superchargedRp: number;
}

export type Rebuilt2026EventTier = 'regional-district' | 'district-championship' | 'first-championship';

export interface SeasonGameAdapter {
  season: number;
  label: string;
  eventTier: Rebuilt2026EventTier;
  towerRpThreshold: number;
  traversalRpThreshold: number;
  energizedRpThreshold: number;
  superchargedRpThreshold: number;
  winRp: number;
  getBonusMetricsFromBreakdown: (breakdown: TBAScoreBreakdownAlliance | undefined) => GameBonusMetrics | null;
  calculateRankingPoints: (isWinner: boolean, bonusMetrics: GameBonusMetrics | null) => GameRankingPointBreakdown;
}

export const REBUILT_2026_RP_THRESHOLDS: Record<Rebuilt2026EventTier, {
  traversalRpThreshold: number;
  energizedRpThreshold: number;
  superchargedRpThreshold: number;
}> = {
  'regional-district': {
    traversalRpThreshold: 50,
    energizedRpThreshold: 100,
    superchargedRpThreshold: 360
  },
  'district-championship': {
    traversalRpThreshold: 50,
    energizedRpThreshold: 240,
    superchargedRpThreshold: 360
  },
  'first-championship': {
    traversalRpThreshold: 50,
    energizedRpThreshold: 360,
    superchargedRpThreshold: 500
  }
};

const REBUILT_2026_WIN_RP = 3;

export const getRebuilt2026RpThresholdsForEventTier = (eventTier: Rebuilt2026EventTier = 'regional-district') =>
  REBUILT_2026_RP_THRESHOLDS[eventTier] || REBUILT_2026_RP_THRESHOLDS['regional-district'];

export const inferRebuilt2026EventTier = (value: string): Rebuilt2026EventTier => {
  const normalized = value.toLowerCase();
  if (/first championship|championship division|einstein|cmp|cmptx|cmpmi/.test(normalized)) return 'first-championship';
  if (/district championship|dcmp|state championship|district cmp/.test(normalized)) return 'district-championship';
  return 'regional-district';
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

export const createRebuilt2026GameAdapter = (eventTier: Rebuilt2026EventTier = 'regional-district'): SeasonGameAdapter => {
  const thresholds = getRebuilt2026RpThresholdsForEventTier(eventTier);
  return {
  season: 2026,
  label: `REBUILT 2026 ${eventTier} RP model`,
  eventTier,
  towerRpThreshold: thresholds.traversalRpThreshold,
  traversalRpThreshold: thresholds.traversalRpThreshold,
  energizedRpThreshold: thresholds.energizedRpThreshold,
  superchargedRpThreshold: thresholds.superchargedRpThreshold,
  winRp: REBUILT_2026_WIN_RP,
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
    const winRp = isWinner ? REBUILT_2026_WIN_RP : 0;
    const traversalMetric = bonusMetrics?.towerMetric ?? 0;
    const traversalRp = bonusMetrics && traversalMetric >= thresholds.traversalRpThreshold ? 1 : 0;
    const energizedRp = bonusMetrics && bonusMetrics.fuelMetric >= thresholds.energizedRpThreshold ? 1 : 0;
    const superchargedRp = bonusMetrics && bonusMetrics.fuelMetric >= thresholds.superchargedRpThreshold ? 1 : 0;
    return {
      totalRp: winRp + traversalRp + energizedRp + superchargedRp,
      winRp,
      towerRp: traversalRp,
      traversalRp,
      energizedRp,
      superchargedRp
    };
  }
};
};

export const rebuilt2026GameAdapter: SeasonGameAdapter = createRebuilt2026GameAdapter();
