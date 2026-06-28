export interface ContributionSummary {
  contribution: number;
  floor: number;
  ceiling: number;
  floorNonZero: number | null;
  contributionDeviation: number;
  zeroRate: number;
  sampleCount: number;
}

export interface DefenseSummary {
  defense: number;
  defenseDeviation: number;
  sampleCount: number;
}

export interface ShiftMetricContract {
  teamNumber: string;
  contribution: number;
  floor: number;
  ceiling: number;
  floorNonZero: number | null;
  epa: number | null;
  opr: number | null;
  dpr: number | null;
  defense: number;
  contributionDeviation: number;
  defenseDeviation: number;
  sampleCounts: {
    contribution: number;
    defense: number;
    stockpileShifts: number;
  };
  legacyAliases: {
    ppc: number;
    ppaExpected: number;
    ppaFloor: number;
    ppaCeiling: number;
    lowestNonZeroScore: number | null;
  };
}

export const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const standardDeviation = (values: number[]) => {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

export const percentile = (values: number[], ratio: number) => {
  const finiteValues = values.filter(value => Number.isFinite(value)).sort((left, right) => left - right);
  if (finiteValues.length === 0) return 0;
  if (finiteValues.length === 1) return finiteValues[0] ?? 0;
  const index = Math.max(0, Math.min(finiteValues.length - 1, Math.floor((finiteValues.length - 1) * ratio)));
  return finiteValues[index] ?? 0;
};

export const combineIndependentStdDevs = (stdDevs: number[]) =>
  Math.sqrt(stdDevs.reduce((sum, value) => sum + Math.max(0, value) ** 2, 0));

export const buildContributionSummary = (samples: number[]): ContributionSummary => {
  const cleanSamples = samples.filter(value => Number.isFinite(value)).map(value => Math.max(0, value));
  const nonZero = cleanSamples.filter(value => value > 0).sort((left, right) => left - right);
  return {
    contribution: mean(cleanSamples),
    floor: cleanSamples.length ? Math.min(...cleanSamples) : 0,
    ceiling: cleanSamples.length ? Math.max(...cleanSamples) : 0,
    floorNonZero: nonZero[0] ?? null,
    contributionDeviation: standardDeviation(cleanSamples),
    zeroRate: cleanSamples.length ? cleanSamples.filter(value => value <= 0).length / cleanSamples.length : 0,
    sampleCount: cleanSamples.length
  };
};

export const buildDefenseSummary = (samples: number[]): DefenseSummary => {
  const cleanSamples = samples.filter(value => Number.isFinite(value)).map(value => Math.max(0, value));
  return {
    defense: mean(cleanSamples),
    defenseDeviation: standardDeviation(cleanSamples),
    sampleCount: cleanSamples.length
  };
};

export const buildShiftMetricContract = ({
  teamNumber,
  contributionSamples,
  defenseSamples,
  stockpileShiftCount = 0,
  epa = null,
  opr = null,
  dpr = null
}: {
  teamNumber: string;
  contributionSamples: number[];
  defenseSamples: number[];
  stockpileShiftCount?: number;
  epa?: number | null;
  opr?: number | null;
  dpr?: number | null;
}): ShiftMetricContract => {
  const contribution = buildContributionSummary(contributionSamples);
  const defense = buildDefenseSummary(defenseSamples);
  return {
    teamNumber,
    contribution: contribution.contribution,
    floor: contribution.floor,
    ceiling: contribution.ceiling,
    floorNonZero: contribution.floorNonZero,
    epa,
    opr,
    dpr,
    defense: defense.defense,
    contributionDeviation: contribution.contributionDeviation,
    defenseDeviation: defense.defenseDeviation,
    sampleCounts: {
      contribution: contribution.sampleCount,
      defense: defense.sampleCount,
      stockpileShifts: stockpileShiftCount
    },
    legacyAliases: {
      ppc: contribution.contribution,
      ppaExpected: contribution.contribution,
      ppaFloor: contribution.floor,
      ppaCeiling: contribution.ceiling,
      lowestNonZeroScore: contribution.floorNonZero
    }
  };
};
