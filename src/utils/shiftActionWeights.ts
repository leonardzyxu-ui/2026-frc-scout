import type { MatchScoutingV4ShiftAction } from '../types.ts';

export interface ShiftActionCreditWeights {
  stockpileOnlyCredit: number;
  defenseOnlyCredit: number;
  defenseStockpileDefenseCredit: number;
  defenseStockpileStockpileCredit: number;
  defenseDuringOffenseCredit: number;
}

export interface ShiftActionCredits {
  stockpileShiftCredit: number;
  defenseShiftCredit: number;
}

export const DEFAULT_SHIFT_ACTION_CREDIT_WEIGHTS: ShiftActionCreditWeights = {
  stockpileOnlyCredit: 1,
  defenseOnlyCredit: 1,
  defenseStockpileDefenseCredit: 0.5,
  defenseStockpileStockpileCredit: 0.5,
  defenseDuringOffenseCredit: 0.1
};

const toNonNegativeNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
};

export const normalizeShiftActionCreditWeights = (
  weights: Partial<ShiftActionCreditWeights> = {}
): ShiftActionCreditWeights => ({
  stockpileOnlyCredit: toNonNegativeNumber(weights.stockpileOnlyCredit, DEFAULT_SHIFT_ACTION_CREDIT_WEIGHTS.stockpileOnlyCredit),
  defenseOnlyCredit: toNonNegativeNumber(weights.defenseOnlyCredit, DEFAULT_SHIFT_ACTION_CREDIT_WEIGHTS.defenseOnlyCredit),
  defenseStockpileDefenseCredit: toNonNegativeNumber(
    weights.defenseStockpileDefenseCredit,
    DEFAULT_SHIFT_ACTION_CREDIT_WEIGHTS.defenseStockpileDefenseCredit
  ),
  defenseStockpileStockpileCredit: toNonNegativeNumber(
    weights.defenseStockpileStockpileCredit,
    DEFAULT_SHIFT_ACTION_CREDIT_WEIGHTS.defenseStockpileStockpileCredit
  ),
  defenseDuringOffenseCredit: toNonNegativeNumber(
    weights.defenseDuringOffenseCredit,
    DEFAULT_SHIFT_ACTION_CREDIT_WEIGHTS.defenseDuringOffenseCredit
  )
});

export const deriveShiftActionCredits = (
  actions: MatchScoutingV4ShiftAction[],
  weights: Partial<ShiftActionCreditWeights> = {}
): ShiftActionCredits => {
  const normalizedWeights = normalizeShiftActionCreditWeights(weights);
  const hasOffense = actions.includes('offense');
  const hasDefense = actions.includes('defense');
  const hasStockpile = actions.includes('stockpile');

  return {
    stockpileShiftCredit: !hasStockpile
      ? 0
      : hasDefense
        ? normalizedWeights.defenseStockpileStockpileCredit
        : normalizedWeights.stockpileOnlyCredit,
    defenseShiftCredit: !hasDefense
      ? 0
      : hasStockpile
        ? normalizedWeights.defenseStockpileDefenseCredit
        : hasOffense
          ? normalizedWeights.defenseDuringOffenseCredit
          : normalizedWeights.defenseOnlyCredit
  };
};
