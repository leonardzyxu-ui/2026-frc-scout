export interface AllianceContributionInput {
  teamNumber: string;
  rawContribution: number;
}

export interface AllianceContributionReconciliationRow extends AllianceContributionInput {
  adjustedContribution: number;
}

export interface AllianceContributionReconciliation {
  officialTotal: number;
  robotOfficialTotal: number;
  nonRobotPoints: number;
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

export interface FirstShiftScoutReport {
  scoutName: string;
  firstShiftAlliance: 'Red' | 'Blue' | '';
}

export interface MatchScoutingV4FirstShiftReportSource {
  scoutName?: string;
  assignedScoutName?: string;
  teleopFirstShiftAlliance?: 'Red' | 'Blue' | '';
}

export interface FirstShiftConsensus {
  consensus: 'Red' | 'Blue' | null;
  counts: Record<'Red' | 'Blue', number>;
  needsScoutCorrection: boolean;
  affectedScouts: string[];
}

export interface FirstShiftCorrectionNotice {
  matchKey: string;
  targetScoutNames: string[];
  question: string;
  message: string;
  options: Array<'Red' | 'Blue'>;
  consensus: 'Red' | 'Blue' | null;
  counts: Record<'Red' | 'Blue', number>;
  severity: 'action_required';
}

export interface FirstShiftAuthorityResolution {
  matchKey: string;
  authoritativeAlliance: 'Red' | 'Blue' | null;
  source: 'admin-override' | 'unanimous-scouts' | 'majority-provisional' | 'pending-correction';
  counts: Record<'Red' | 'Blue', number>;
  needsScoutCorrection: boolean;
  versionBumpRequired: boolean;
  reason: string;
}

const uniqueCleanNames = (names: string[]) =>
  Array.from(new Set(names.map(name => name.trim()).filter(Boolean)));

const normalizeFirstShiftAlliance = (value: unknown): 'Red' | 'Blue' | '' =>
  value === 'Red' || value === 'Blue' ? value : '';

export const reconcileAllianceContributions = (
  rows: AllianceContributionInput[],
  officialTotal: number,
  options: { nonRobotPoints?: number } = {}
): AllianceContributionReconciliation => {
  const cleanOfficialTotal = Math.max(0, Number.isFinite(officialTotal) ? officialTotal : 0);
  const nonRobotPoints = Math.max(0, Math.min(cleanOfficialTotal, Number.isFinite(options.nonRobotPoints) ? options.nonRobotPoints ?? 0 : 0));
  const robotOfficialTotal = Math.max(0, cleanOfficialTotal - nonRobotPoints);
  const cleanRows = rows.map(row => ({
    teamNumber: row.teamNumber,
    rawContribution: Math.max(0, Number.isFinite(row.rawContribution) ? row.rawContribution : 0)
  }));
  const rawTotal = cleanRows.reduce((sum, row) => sum + row.rawContribution, 0);
  const warnings: string[] = [];

  if (rawTotal <= 0) {
    if (robotOfficialTotal > 0) {
      warnings.push('Official total is positive but scouts recorded no allocatable contribution.');
    }
    return {
      officialTotal: cleanOfficialTotal,
      robotOfficialTotal,
      nonRobotPoints,
      rawTotal,
      scaleFactor: 0,
      rows: cleanRows.map(row => ({ ...row, adjustedContribution: 0 })),
      unallocatedPoints: robotOfficialTotal + nonRobotPoints,
      warnings
    };
  }

  if (nonRobotPoints > 0) {
    warnings.push(`${nonRobotPoints.toFixed(1)} official points were held outside robot contribution scaling.`);
  }

  const scaleFactor = robotOfficialTotal / rawTotal;
  if (Math.abs(scaleFactor - 1) > 0.08) {
    warnings.push(`Scout total was scaled by ${scaleFactor.toFixed(3)} to match the official alliance total.`);
  }

  return {
    officialTotal: cleanOfficialTotal,
    robotOfficialTotal,
    nonRobotPoints,
    rawTotal,
    scaleFactor,
    rows: cleanRows.map(row => ({
      ...row,
      adjustedContribution: row.rawContribution * scaleFactor
    })),
    unallocatedPoints: nonRobotPoints,
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

export const buildFirstShiftReportsFromMatchScoutingV4 = (
  records: MatchScoutingV4FirstShiftReportSource[]
): FirstShiftScoutReport[] =>
  records.map(record => ({
    scoutName: (record.assignedScoutName || record.scoutName || '').trim(),
    firstShiftAlliance: normalizeFirstShiftAlliance(record.teleopFirstShiftAlliance)
  }));

export const detectFirstShiftConsensus = (reports: FirstShiftScoutReport[]): FirstShiftConsensus => {
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
    affectedScouts: uniqueCleanNames(reports.map(report => report.scoutName))
  };
};

export const buildFirstShiftCorrectionNotice = ({
  matchKey,
  reports,
  assignedScoutNames = []
}: {
  matchKey: string;
  reports: FirstShiftScoutReport[];
  assignedScoutNames?: string[];
}): FirstShiftCorrectionNotice | null => {
  const consensus = detectFirstShiftConsensus(reports);
  if (!consensus.needsScoutCorrection) return null;

  const targetScoutNames = uniqueCleanNames(assignedScoutNames).length
    ? uniqueCleanNames(assignedScoutNames)
    : consensus.affectedScouts;
  const cleanMatchKey = matchKey.trim().toUpperCase() || 'THIS MATCH';
  const countText = `Red ${consensus.counts.Red} / Blue ${consensus.counts.Blue}`;

  return {
    matchKey: cleanMatchKey,
    targetScoutNames,
    question: 'Which alliance started the first teleop shift?',
    message: `First-shift reports disagree for ${cleanMatchKey} (${countText}). Confirm the starting alliance so the shift timeline can be repaired.`,
    options: ['Red', 'Blue'],
    consensus: consensus.consensus,
    counts: consensus.counts,
    severity: 'action_required'
  };
};

export const resolveFirstShiftAuthority = ({
  matchKey,
  reports,
  adminOverride = ''
}: {
  matchKey: string;
  reports: FirstShiftScoutReport[];
  adminOverride?: 'Red' | 'Blue' | '';
}): FirstShiftAuthorityResolution => {
  const cleanMatchKey = matchKey.trim().toUpperCase() || 'THIS MATCH';
  const override = normalizeFirstShiftAlliance(adminOverride);
  const consensus = detectFirstShiftConsensus(reports);

  if (override) {
    return {
      matchKey: cleanMatchKey,
      authoritativeAlliance: override,
      source: 'admin-override',
      counts: consensus.counts,
      needsScoutCorrection: false,
      versionBumpRequired: true,
      reason: `Head scout override set ${override} as the authoritative first teleop shift.`
    };
  }

  if (consensus.consensus && !consensus.needsScoutCorrection) {
    return {
      matchKey: cleanMatchKey,
      authoritativeAlliance: consensus.consensus,
      source: 'unanimous-scouts',
      counts: consensus.counts,
      needsScoutCorrection: false,
      versionBumpRequired: false,
      reason: `All reporting scouts agree ${consensus.consensus} started the first teleop shift.`
    };
  }

  if (consensus.consensus) {
    return {
      matchKey: cleanMatchKey,
      authoritativeAlliance: consensus.consensus,
      source: 'majority-provisional',
      counts: consensus.counts,
      needsScoutCorrection: true,
      versionBumpRequired: true,
      reason: `Using provisional ${consensus.consensus} majority while match scouts re-confirm the first teleop shift.`
    };
  }

  return {
    matchKey: cleanMatchKey,
    authoritativeAlliance: null,
    source: 'pending-correction',
    counts: consensus.counts,
    needsScoutCorrection: true,
    versionBumpRequired: false,
    reason: 'No authoritative first teleop shift can be selected until scouts or the head scout resolve the conflict.'
  };
};
