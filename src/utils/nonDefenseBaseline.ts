export type NonDefenseBaselineSource =
  | 'undefended-shifts'
  | 'undefended-match-totals'
  | 'observed-total-fallback'
  | 'public-rating-fallback'
  | 'none';

export interface NonDefenseBaselineShiftEntry {
  owner?: string;
  actions?: string[];
  ballsScored?: number;
}

export interface NonDefenseBaselineRecord {
  totalMatchPoints?: number;
  defenderFacedTeamNumber?: string;
  shiftBreakdown?: NonDefenseBaselineShiftEntry[];
}

export interface NonDefenseBaseline {
  samples: number[];
  source: NonDefenseBaselineSource;
}

const cleanPointValue = (value: unknown) =>
  Math.max(0, Number.isFinite(value) ? Number(value) : 0);

const hasIncomingDefenseEvidence = (record: NonDefenseBaselineRecord) =>
  Boolean((record.defenderFacedTeamNumber || '').trim());

export const buildNonDefenseBaseline = ({
  records,
  observedTotals,
  publicRatingFallback = null
}: {
  records: NonDefenseBaselineRecord[];
  observedTotals: number[];
  publicRatingFallback?: number | null;
}): NonDefenseBaseline => {
  const nonDefenseShiftSamples = records.flatMap(record => {
    if (hasIncomingDefenseEvidence(record)) return [];
    return (record.shiftBreakdown || [])
      .filter(entry => entry.owner === 'own' && (entry.actions || []).includes('offense'))
      .map(entry => cleanPointValue(entry.ballsScored));
  });
  if (nonDefenseShiftSamples.length) {
    return { samples: nonDefenseShiftSamples, source: 'undefended-shifts' };
  }

  const nonDefenseMatchTotalSamples = records
    .filter(record => !hasIncomingDefenseEvidence(record) && !(record.shiftBreakdown || []).length)
    .map(record => cleanPointValue(record.totalMatchPoints));
  if (nonDefenseMatchTotalSamples.length) {
    return { samples: nonDefenseMatchTotalSamples, source: 'undefended-match-totals' };
  }

  const cleanObservedTotals = observedTotals
    .filter(value => Number.isFinite(value))
    .map(value => Math.max(0, value));
  if (cleanObservedTotals.length) {
    return { samples: cleanObservedTotals, source: 'observed-total-fallback' };
  }

  if (publicRatingFallback != null && Number.isFinite(publicRatingFallback)) {
    return { samples: [Math.max(0, publicRatingFallback)], source: 'public-rating-fallback' };
  }

  return { samples: [], source: 'none' };
};
