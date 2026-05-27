import { TeamPerformanceProfile } from '../types';

export type PpaRoleRecommendation = 'Primary Scorer' | 'Defender' | 'Flex' | 'Unknown';
export type PpaRiskLevel = 'Low' | 'Medium' | 'High';

export interface PpaInsight {
  teamNumber: string;
  teamName: string;
  rating: number | null;
  projected: {
    expected: number | null;
    floor: number | null;
    ceiling: number | null;
    normalLow: number | null;
    normalHigh: number | null;
  };
  components: {
    ppc: number | null;
    opr: number | null;
    epa: number | null;
    defenseImpact: number | null;
    volatility: number | null;
    reliability: number | null;
    trend: number | null;
    matchesLogged: number;
  };
  coverage: {
    matchesLogged: number;
    scoutConfidence: number;
    label: string;
  };
  role: {
    label: PpaRoleRecommendation;
    offenseValue: number | null;
    defenseValue: number | null;
    reason: string;
  };
  uncertainty: {
    level: PpaRiskLevel;
    score: number;
    reasons: string[];
  };
  tailRisk: {
    level: PpaRiskLevel;
    label: string;
    reasons: string[];
  };
  source: {
    label: string;
    modelName: string;
    modelSource: string;
    validationLine: string;
  };
  explanation: string;
  warnings: string[];
}

export interface PpaAllianceSummary {
  expected: number;
  floor: number;
  ceiling: number;
  defenseValue: number;
  confidenceLabel: string;
  rolePlan: string;
  riskNotes: string[];
  highUncertaintyTeams: string[];
}

export interface BuildPpaInsightsInput {
  teamNumbers: string[];
  teamNameLookup: Record<string, string>;
  ppaRatings: Record<string, number>;
  profiles: TeamPerformanceProfile[];
  modelName?: string;
  modelSource?: string;
}

export const PROMOTED_PPA_MODEL = {
  displayName: 'Conservative TailGuard Strong RoleV3',
  validationLine: 'Weighted MAE 36.32 score / 49.73 margin, weighted Brier 0.1648, deployment score 0.126'
};

const finiteOrNull = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const levelFromScore = (score: number): PpaRiskLevel => {
  if (score >= 70) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
};

const describeCoverage = (matchesLogged: number, scoutConfidence: number) => {
  if (matchesLogged >= 5 && scoutConfidence >= 0.72) return 'Strong local scouting';
  if (matchesLogged >= 3 && scoutConfidence >= 0.5) return 'Usable local scouting';
  if (matchesLogged > 0) return 'Thin local scouting';
  return 'Public/model fallback only';
};

const buildRole = (
  rating: number | null,
  projectedNextScore: number | null,
  defenseImpact: number | null
): PpaInsight['role'] => {
  const offenseValue = rating ?? projectedNextScore;
  const defenseValue = defenseImpact;
  if (offenseValue == null && defenseValue == null) {
    return {
      label: 'Unknown',
      offenseValue,
      defenseValue,
      reason: 'No trusted scoring or defense signal has reached this device yet.'
    };
  }

  if (defenseValue != null && offenseValue != null) {
    const defenderThreshold = Math.max(8, offenseValue * 0.33);
    const flexThreshold = Math.max(4, offenseValue * 0.18);
    if (defenseValue >= defenderThreshold) {
      return {
        label: 'Defender',
        offenseValue,
        defenseValue,
        reason: 'Defense impact is large enough to beat the offensive opportunity cost.'
      };
    }
    if (defenseValue >= flexThreshold) {
      return {
        label: 'Flex',
        offenseValue,
        defenseValue,
        reason: 'Defense has real value, but the team still carries useful scoring value.'
      };
    }
  }

  if (defenseValue != null && offenseValue == null) {
    return {
      label: 'Defender',
      offenseValue,
      defenseValue,
      reason: 'Defense is the only usable role signal available.'
    };
  }

  return {
    label: 'Primary Scorer',
    offenseValue,
    defenseValue,
    reason: 'The strongest signal is expected point contribution.'
  };
};

const buildUncertainty = (
  rating: number | null,
  profile: TeamPerformanceProfile | undefined,
  scoutConfidence: number
): PpaInsight['uncertainty'] => {
  const reasons: string[] = [];
  let score = 0;
  if (rating == null) {
    score += 35;
    reasons.push('No PPA rating is available.');
  }
  if (!profile || profile.matchesPlayed === 0) {
    score += 30;
    reasons.push('No local match rows are logged.');
  } else if (profile.matchesPlayed < 3) {
    score += 20;
    reasons.push('Fewer than three local match rows are logged.');
  }
  if (profile && profile.volatility > 0.35) {
    score += 25;
    reasons.push('Recent scoring is highly volatile.');
  } else if (profile && profile.volatility > 0.18) {
    score += 12;
    reasons.push('Recent scoring has moderate volatility.');
  }
  if (profile && profile.reliability < 0.45) {
    score += 25;
    reasons.push('Scout reliability is low.');
  } else if (profile && profile.reliability < 0.7) {
    score += 12;
    reasons.push('Scout reliability is still settling.');
  }
  if (scoutConfidence < 0.35) {
    score += 15;
    reasons.push('Local scouting coverage is thin.');
  }

  return {
    level: levelFromScore(score),
    score: clamp(score, 0, 100),
    reasons: reasons.length ? reasons : ['Enough local data is present for normal match-day use.']
  };
};

const buildTailRisk = (profile: TeamPerformanceProfile | undefined): PpaInsight['tailRisk'] => {
  const reasons: string[] = [];
  let score = 0;
  if (!profile) {
    return {
      level: 'High',
      label: 'Unknown floor',
      reasons: ['No performance curve is available yet.']
    };
  }
  if (profile.zeroRate > 0.2) {
    score += 30;
    reasons.push('There are repeated zero or near-zero rows.');
  }
  if (profile.floorScore < profile.averageScore * 0.45 && profile.matchesPlayed >= 3) {
    score += 25;
    reasons.push('The lower band is far below the average.');
  }
  if (profile.volatility > 0.35) {
    score += 25;
    reasons.push('The performance curve is wide.');
  }
  if (profile.reliability < 0.55) {
    score += 15;
    reasons.push('Reliability is not stable enough to trust the ceiling alone.');
  }

  const level = levelFromScore(score);
  return {
    level,
    label: level === 'High' ? 'Wide floor-ceiling band' : level === 'Medium' ? 'Watch the floor' : 'Stable enough',
    reasons: reasons.length ? reasons : ['No major floor risk is visible in the current profile.']
  };
};

export const buildPpaInsightForTeam = ({
  teamNumber,
  teamName,
  rating,
  profile,
  modelName,
  modelSource
}: {
  teamNumber: string;
  teamName: string;
  rating: number | null;
  profile?: TeamPerformanceProfile;
  modelName?: string;
  modelSource?: string;
}): PpaInsight => {
  const matchesLogged = profile?.matchesPlayed ?? 0;
  const reliability = finiteOrNull(profile?.reliability);
  const scoutConfidence = clamp((matchesLogged / 5) * 0.65 + (reliability ?? 0) * 0.35, 0, 1);
  const projectedNextScore = finiteOrNull(profile?.projectedNextScore);
  const defenseImpact = finiteOrNull(profile?.defenseImpact);
  const role = buildRole(rating, projectedNextScore, defenseImpact);
  const uncertainty = buildUncertainty(rating, profile, scoutConfidence);
  const tailRisk = buildTailRisk(profile);
  const sourceModelName = modelName || PROMOTED_PPA_MODEL.displayName;
  const sourceModel = modelSource || 'Local Admin V4 scouting/model adapter';
  const expected = rating ?? projectedNextScore;
  const profileFloor = finiteOrNull(profile?.floorScore);
  const profileCeiling = finiteOrNull(profile?.ceilingScore);
  const normalLow = finiteOrNull(profile?.normalLowScore);
  const normalHigh = finiteOrNull(profile?.normalHighScore);
  const projectedFloor = expected == null
    ? profileFloor
    : profileFloor == null
      ? expected
      : Math.min(profileFloor, expected);
  const projectedCeiling = expected == null
    ? profileCeiling
    : profileCeiling == null
      ? expected
      : Math.max(profileCeiling, expected);
  const projectedNormalLow = expected == null
    ? normalLow
    : normalLow == null
      ? projectedFloor
      : Math.min(normalLow, expected);
  const projectedNormalHigh = expected == null
    ? normalHigh
    : normalHigh == null
      ? projectedCeiling
      : Math.max(normalHigh, expected);

  const warnings = [
    uncertainty.level === 'High' ? 'Treat this team as a range, not a point estimate.' : '',
    tailRisk.level === 'High' ? 'Check match history before assigning a must-score role.' : '',
    matchesLogged === 0 ? 'No local scout row backs this PPA yet.' : ''
  ].filter(Boolean);

  return {
    teamNumber,
    teamName,
    rating,
    projected: {
      expected,
      floor: projectedFloor,
      ceiling: projectedCeiling,
      normalLow: projectedNormalLow,
      normalHigh: projectedNormalHigh
    },
    components: {
      ppc: finiteOrNull(profile?.ppc),
      opr: finiteOrNull(profile?.opr),
      epa: finiteOrNull(profile?.epa),
      defenseImpact,
      volatility: finiteOrNull(profile?.volatility),
      reliability,
      trend: finiteOrNull(profile?.recentTrend),
      matchesLogged
    },
    coverage: {
      matchesLogged,
      scoutConfidence,
      label: describeCoverage(matchesLogged, scoutConfidence)
    },
    role,
    uncertainty,
    tailRisk,
    source: {
      label: sourceModelName,
      modelName: sourceModelName,
      modelSource: sourceModel,
      validationLine: PROMOTED_PPA_MODEL.validationLine
    },
    explanation: `${sourceModelName} says Team ${teamNumber} is best treated as ${role.label.toLowerCase()} with ${uncertainty.level.toLowerCase()} uncertainty.`,
    warnings
  };
};

export const buildPpaInsights = ({
  teamNumbers,
  teamNameLookup,
  ppaRatings,
  profiles,
  modelName,
  modelSource
}: BuildPpaInsightsInput): Record<string, PpaInsight> => {
  const profileByTeam = Object.fromEntries(profiles.map(profile => [profile.teamNumber, profile]));
  const allTeams = new Set<string>([
    ...teamNumbers,
    ...Object.keys(ppaRatings),
    ...profiles.map(profile => profile.teamNumber)
  ]);

  return Object.fromEntries(
    Array.from(allTeams)
      .filter(teamNumber => teamNumber !== '')
      .map(teamNumber => [
        teamNumber,
        buildPpaInsightForTeam({
          teamNumber,
          teamName: teamNameLookup[teamNumber] || '',
          rating: finiteOrNull(ppaRatings[teamNumber]),
          profile: profileByTeam[teamNumber],
          modelName,
          modelSource
        })
      ])
  );
};

export const summarizePpaAlliance = (
  teamNumbers: string[],
  insightsByTeam: Record<string, PpaInsight>
): PpaAllianceSummary => {
  const insights = teamNumbers.map(teamNumber => insightsByTeam[teamNumber]).filter((insight): insight is PpaInsight => !!insight);
  const expected = insights.reduce((sum, insight) => sum + (insight.projected.expected ?? 0), 0);
  const floor = insights.reduce((sum, insight) => sum + (insight.projected.floor ?? insight.projected.expected ?? 0), 0);
  const ceiling = insights.reduce((sum, insight) => sum + (insight.projected.ceiling ?? insight.projected.expected ?? 0), 0);
  const defenseValue = insights.reduce((sum, insight) => sum + (insight.components.defenseImpact ?? 0), 0);
  const highUncertaintyTeams = insights
    .filter(insight => insight.uncertainty.level === 'High')
    .map(insight => insight.teamNumber);
  const highRiskTeams = insights
    .filter(insight => insight.tailRisk.level === 'High')
    .map(insight => insight.teamNumber);
  const averageUncertainty = insights.length
    ? insights.reduce((sum, insight) => sum + insight.uncertainty.score, 0) / insights.length
    : 100;
  const rolePlan = insights.length
    ? insights.map(insight => `${insight.teamNumber}: ${insight.role.label}`).join(' / ')
    : 'No teams entered';

  return {
    expected,
    floor,
    ceiling,
    defenseValue,
    confidenceLabel: levelFromScore(averageUncertainty) === 'High'
      ? 'Low confidence'
      : levelFromScore(averageUncertainty) === 'Medium'
        ? 'Medium confidence'
        : 'High confidence',
    rolePlan,
    riskNotes: [
      highUncertaintyTeams.length ? `High uncertainty: ${highUncertaintyTeams.join(', ')}` : '',
      highRiskTeams.length ? `Tail risk: ${highRiskTeams.join(', ')}` : ''
    ].filter(Boolean),
    highUncertaintyTeams
  };
};
