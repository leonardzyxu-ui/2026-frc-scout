export interface AllianceContributionInput {
  teamNumber: string;
  rawContribution: number;
}

export interface AllianceContributionReconciliationRow extends AllianceContributionInput {
  adjustedContribution: number;
}

export interface AllianceContributionReconciliation {
  officialTotal: number;
  rawTotal: number;
  scaleFactor: number;
  rows: AllianceContributionReconciliationRow[];
  unallocatedPoints: number;
  warnings: string[];
}

export interface DefenseShareInput {
  defenderTeamNumber: string;
  targetTeamNumber: string;
  claimedSharePercent: number;
}

export interface DefenseShareOutput extends DefenseShareInput {
  normalizedSharePercent: number;
}

export interface DefenseShareNormalization {
  targetTeamNumber: string;
  rawTotalPercent: number;
  rows: DefenseShareOutput[];
  warnings: string[];
}

export const reconcileAllianceContributions = (
  rows: AllianceContributionInput[],
  officialTotal: number
): AllianceContributionReconciliation => {
  const cleanOfficialTotal = Math.max(0, Number.isFinite(officialTotal) ? officialTotal : 0);
  const cleanRows = rows.map(row => ({
    teamNumber: row.teamNumber,
    rawContribution: Math.max(0, Number.isFinite(row.rawContribution) ? row.rawContribution : 0)
  }));
  const rawTotal = cleanRows.reduce((sum, row) => sum + row.rawContribution, 0);
  const warnings: string[] = [];

  if (rawTotal <= 0) {
    if (cleanOfficialTotal > 0) {
      warnings.push('Official total is positive but scouts recorded no allocatable contribution.');
    }
    return {
      officialTotal: cleanOfficialTotal,
      rawTotal,
      scaleFactor: 0,
      rows: cleanRows.map(row => ({ ...row, adjustedContribution: 0 })),
      unallocatedPoints: cleanOfficialTotal,
      warnings
    };
  }

  const scaleFactor = cleanOfficialTotal / rawTotal;
  if (Math.abs(scaleFactor - 1) > 0.08) {
    warnings.push(`Scout total was scaled by ${scaleFactor.toFixed(3)} to match the official alliance total.`);
  }

  return {
    officialTotal: cleanOfficialTotal,
    rawTotal,
    scaleFactor,
    rows: cleanRows.map(row => ({
      ...row,
      adjustedContribution: row.rawContribution * scaleFactor
    })),
    unallocatedPoints: 0,
    warnings
  };
};

export const normalizeDefenseShares = (
  targetTeamNumber: string,
  rows: DefenseShareInput[]
): DefenseShareNormalization => {
  const relevantRows = rows
    .filter(row => row.targetTeamNumber === targetTeamNumber)
    .map(row => ({
      ...row,
      claimedSharePercent: Math.max(0, Number.isFinite(row.claimedSharePercent) ? row.claimedSharePercent : 0)
    }));
  const rawTotalPercent = relevantRows.reduce((sum, row) => sum + row.claimedSharePercent, 0);
  const warnings: string[] = [];

  if (relevantRows.length === 0) {
    return { targetTeamNumber, rawTotalPercent: 0, rows: [], warnings: ['No defender shares were reported.'] };
  }

  if (rawTotalPercent <= 0) {
    warnings.push('Defender shares summed to zero, so credit was split evenly.');
    const equalShare = 100 / relevantRows.length;
    return {
      targetTeamNumber,
      rawTotalPercent,
      rows: relevantRows.map(row => ({ ...row, normalizedSharePercent: equalShare })),
      warnings
    };
  }

  if (Math.abs(rawTotalPercent - 100) > 1) {
    warnings.push(`Defender shares summed to ${rawTotalPercent.toFixed(1)}%, then were normalized to 100%.`);
  }

  return {
    targetTeamNumber,
    rawTotalPercent,
    rows: relevantRows.map(row => ({
      ...row,
      normalizedSharePercent: row.claimedSharePercent / rawTotalPercent * 100
    })),
    warnings
  };
};

export const detectFirstShiftConsensus = (reports: Array<{ scoutName: string; firstShiftAlliance: 'Red' | 'Blue' | '' }>) => {
  const counts = reports.reduce<Record<'Red' | 'Blue', number>>((acc, report) => {
    if (report.firstShiftAlliance === 'Red' || report.firstShiftAlliance === 'Blue') {
      acc[report.firstShiftAlliance] += 1;
    }
    return acc;
  }, { Red: 0, Blue: 0 });
  const consensus =
    counts.Red === counts.Blue
      ? null
      : counts.Red > counts.Blue
        ? 'Red'
        : 'Blue';
  return {
    consensus,
    counts,
    needsScoutCorrection: !consensus || (counts.Red > 0 && counts.Blue > 0),
    affectedScouts: reports.map(report => report.scoutName)
  };
};
