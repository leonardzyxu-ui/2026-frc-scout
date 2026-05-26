import type {
  AllianceColor,
  EventMetadata,
  FeatureRow,
  HistoricalMatch,
  RoleOption,
  ScoutingObservation,
  StatboticsTeamSignal,
  TeamSnapshot,
  WalkForwardDataset
} from '../types.ts';
import { clamp, matchSortRank, mean, safeDivide, standardDeviation } from '../util.ts';

interface MutableTeamState {
  seasonScores: number[];
  eventScores: Map<string, number[]>;
  autoScores: number[];
  teleopScores: number[];
  endgameScores: number[];
  foulScores: number[];
  foulRisks: number[];
  foulRiskAttempts: number[];
  defenseDenials: number[];
  defenseDenialAttempts: number[];
  scoutOffense: number[];
  scoutDefense: number[];
  eventScoutOffense: Map<string, number[]>;
  eventScoutDefense: Map<string, number[]>;
  reliabilityPenalties: number[];
}

interface SeasonState {
  allianceScores: number[];
}

interface FeatureOptions {
  useRoleFeatures: boolean;
  useContextEpa: boolean;
}

const emptyTeamState = (): MutableTeamState => ({
  seasonScores: [],
  eventScores: new Map(),
  autoScores: [],
  teleopScores: [],
  endgameScores: [],
  foulScores: [],
  foulRisks: [],
  foulRiskAttempts: [],
  defenseDenials: [],
  defenseDenialAttempts: [],
  scoutOffense: [],
  scoutDefense: [],
  eventScoutOffense: new Map(),
  eventScoutDefense: new Map(),
  reliabilityPenalties: []
});

const getTeamState = (states: Map<string, MutableTeamState>, teamKey: string) => {
  const existing = states.get(teamKey);
  if (existing) return existing;
  const created = emptyTeamState();
  states.set(teamKey, created);
  return created;
};

const statboticsKey = (season: number, eventKey: string | null, teamKey: string) =>
  `${season}|${eventKey ?? ''}|${teamKey}`;

const buildStatboticsLookup = (signals: StatboticsTeamSignal[]) => {
  const lookup = new Map<string, StatboticsTeamSignal>();
  signals.forEach(signal => {
    lookup.set(statboticsKey(signal.season, signal.eventKey, signal.teamKey), signal);
    if (signal.eventKey == null) {
      lookup.set(statboticsKey(signal.season, null, signal.teamKey), signal);
    }
  });
  return lookup;
};

const observationKey = (eventKey: string, matchKey: string, teamKey: string) => `${eventKey}|${matchKey}|${teamKey}`;

const buildObservationLookup = (observations: ScoutingObservation[]) => {
  const lookup = new Map<string, ScoutingObservation[]>();
  observations.forEach(observation => {
    const key = observationKey(observation.eventKey, observation.matchKey, observation.teamKey);
    const bucket = lookup.get(key) ?? [];
    bucket.push(observation);
    lookup.set(key, bucket);
  });
  return lookup;
};

const buildEventMetadataLookup = (events: EventMetadata[]) => {
  const lookup = new Map<string, EventMetadata>();
  events.forEach(event => lookup.set(event.eventKey, event));
  return lookup;
};

const getSeasonState = (states: Map<number, SeasonState>, season: number) => {
  const existing = states.get(season);
  if (existing) return existing;
  const created = { allianceScores: [] };
  states.set(season, created);
  return created;
};

const getRecentMean = (values: number[], take = 5) => {
  if (values.length === 0) return 0;
  return mean(values.slice(Math.max(0, values.length - take)));
};

const scoutConfidence = (eventSamples: number, seasonSamples: number) =>
  clamp(Math.max(eventSamples / (eventSamples + 2), seasonSamples / (seasonSamples + 6)), 0, 1);

const gatedScoutSignal = (eventValues: number[], seasonValues: number[]) => {
  const eventSamples = eventValues.length;
  const seasonSamples = seasonValues.length;
  if (seasonSamples === 0) {
    return {
      raw: null,
      samples: 0,
      confidence: 0,
      gated: 0
    };
  }
  const eventConfidence = eventSamples > 0 ? eventSamples / (eventSamples + 2) : 0;
  const eventMean = eventSamples > 0 ? mean(eventValues) : null;
  const seasonMean = mean(seasonValues);
  const raw = eventMean == null ? seasonMean : eventMean * eventConfidence + seasonMean * (1 - eventConfidence);
  const confidence = scoutConfidence(eventSamples, seasonSamples);
  return {
    raw,
    samples: seasonSamples,
    confidence,
    gated: raw * confidence
  };
};

const getSnapshot = (
  states: Map<string, MutableTeamState>,
  statbotics: Map<string, StatboticsTeamSignal>,
  teamKey: string,
  eventKey: string,
  season: number,
  useContextEpa: boolean
): TeamSnapshot => {
  const state = getTeamState(states, teamKey);
  const eventScores = state.eventScores.get(eventKey) ?? [];
  const eventScoutOffense = state.eventScoutOffense.get(eventKey) ?? [];
  const eventScoutDefense = state.eventScoutDefense.get(eventKey) ?? [];
  const scoutOffense = gatedScoutSignal(eventScoutOffense, state.scoutOffense);
  const scoutDefense = gatedScoutSignal(eventScoutDefense, state.scoutDefense);
  const eventSignal = statbotics.get(statboticsKey(season, eventKey, teamKey));
  const yearSignal = statbotics.get(statboticsKey(season, null, teamKey));
  const signal = eventSignal ?? yearSignal;

  return {
    teamKey,
    seasonMatches: state.seasonScores.length,
    eventMatches: eventScores.length,
    seasonOffense: mean(state.seasonScores),
    eventOffense: mean(eventScores),
    recentOffense: getRecentMean(state.seasonScores),
    volatility: standardDeviation(state.seasonScores),
    defenseDenial: mean(state.defenseDenials),
    defenseSuppressionAll: mean(state.defenseDenialAttempts),
    defenseSuppressionRate:
      state.defenseDenialAttempts.length > 0
        ? state.defenseDenials.length / state.defenseDenialAttempts.length
        : 0,
    foulRisk: mean(state.foulRisks),
    foulRiskAll: mean(state.foulRiskAttempts),
    componentAuto: mean(state.autoScores),
    componentTeleop: mean(state.teleopScores),
    componentEndgame: mean(state.endgameScores),
    componentFoul: mean(state.foulScores),
    scoutOffense: scoutOffense.raw,
    scoutDefense: scoutDefense.raw,
    scoutOffenseSamples: scoutOffense.samples,
    scoutDefenseSamples: scoutDefense.samples,
    scoutOffenseConfidence: scoutOffense.confidence,
    scoutDefenseConfidence: scoutDefense.confidence,
    scoutGatedOffense: scoutOffense.gated,
    scoutGatedDefense: scoutDefense.gated,
    reliabilityPenalty: mean(state.reliabilityPenalties),
    statboticsEpa: useContextEpa ? signal?.overallEpa ?? null : null
  };
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const allianceValue = (
  snapshots: TeamSnapshot[],
  getter: (snapshot: TeamSnapshot) => number | null,
  fallback = 0
) => sum(snapshots.map(snapshot => getter(snapshot) ?? fallback));

const chooseRoleOption = (snapshots: TeamSnapshot[]): RoleOption => {
  const allOffense: RoleOption = {
    label: 'all-offense',
    defenderTeamKey: null,
    offenseCost: 0,
    defenseValue: 0,
    foulRisk: 0,
    netSwing: 0
  };

  const candidates = snapshots.map(snapshot => {
    const offense = snapshot.eventOffense || snapshot.recentOffense || snapshot.seasonOffense;
    const scoutBoost = snapshot.scoutDefense ?? 0;
    const defenseValue = Math.max(0, snapshot.defenseDenial + scoutBoost);
    const foulRisk = Math.max(0, snapshot.foulRisk + snapshot.reliabilityPenalty);
    const offenseCost = Math.max(0, offense * 0.78);
    return {
      label: `defense:${snapshot.teamKey}`,
      defenderTeamKey: snapshot.teamKey,
      offenseCost,
      defenseValue,
      foulRisk,
      netSwing: defenseValue - offenseCost - foulRisk
    };
  });

  return [allOffense, ...candidates].sort(
    (left, right) => right.netSwing - left.netSwing || right.defenseValue - left.defenseValue
  )[0] ?? allOffense;
};

const chooseRoleV2Option = (snapshots: TeamSnapshot[]): RoleOption => {
  const allOffense: RoleOption = {
    label: 'all-offense-v2',
    defenderTeamKey: null,
    offenseCost: 0,
    defenseValue: 0,
    foulRisk: 0,
    netSwing: 0
  };

  const candidates = snapshots.map(snapshot => {
    const offense = snapshot.eventOffense || snapshot.recentOffense || snapshot.seasonOffense;
    const scoutBoost = snapshot.scoutDefense ?? 0;
    const consistency = clamp(snapshot.defenseSuppressionRate, 0, 1);
    const suppressionSignal =
      snapshot.defenseSuppressionAll * 0.7 + snapshot.defenseDenial * 0.2 + scoutBoost * 0.1;
    const defenseValue = Math.max(0, suppressionSignal * (0.55 + 0.45 * consistency));
    const foulRisk = Math.max(0, snapshot.foulRiskAll + snapshot.reliabilityPenalty);
    const offenseCost = Math.max(0, offense * 0.72);
    return {
      label: `defense-v2:${snapshot.teamKey}`,
      defenderTeamKey: snapshot.teamKey,
      offenseCost,
      defenseValue,
      foulRisk,
      netSwing: defenseValue - offenseCost - foulRisk
    };
  });

  return [allOffense, ...candidates].sort(
    (left, right) => right.netSwing - left.netSwing || right.defenseValue - left.defenseValue
  )[0] ?? allOffense;
};

interface RoleV3Signal {
  teamKey: string;
  offenseCost: number;
  suppressionValue: number;
  suppressionConsistency: number;
  foulExposure: number;
  confidence: number;
  defenseValue: number;
  netSwing: number;
}

interface RoleV3Summary {
  selected: RoleOption;
  bestCandidate: RoleV3Signal | null;
  suppressionSum: number;
  consistencyMean: number;
  foulExposureSum: number;
  offenseCostSum: number;
  confidenceMean: number;
}

type RoleV3ScoutMode = 'raw' | 'gated';

const roleV3SignalForSnapshot = (snapshot: TeamSnapshot, scoutMode: RoleV3ScoutMode = 'raw'): RoleV3Signal => {
  const offense = snapshot.eventOffense || snapshot.recentOffense || snapshot.seasonOffense;
  const suppressionConsistency = clamp(snapshot.defenseSuppressionRate, 0, 1);
  const sampleConfidence = clamp((snapshot.seasonMatches + snapshot.eventMatches) / 24, 0, 1);
  const scoutConfidence =
    scoutMode === 'gated' ? snapshot.scoutDefenseConfidence * 0.1 : snapshot.scoutDefense != null ? 0.1 : 0;
  const confidence = clamp(0.2 + suppressionConsistency * 0.5 + sampleConfidence * 0.3 + scoutConfidence, 0, 1);
  const scoutSuppression = scoutMode === 'gated' ? snapshot.scoutGatedDefense : snapshot.scoutDefense ?? 0;
  const suppressionValue = Math.max(0, snapshot.defenseSuppressionAll + scoutSuppression * 0.25);
  const foulExposure = Math.max(0, snapshot.foulRiskAll + snapshot.reliabilityPenalty);
  const offenseCost = Math.max(0, offense * 0.68);
  const defenseValue = Math.max(0, suppressionValue * confidence);

  return {
    teamKey: snapshot.teamKey,
    offenseCost,
    suppressionValue,
    suppressionConsistency,
    foulExposure,
    confidence,
    defenseValue,
    netSwing: defenseValue - offenseCost - foulExposure
  };
};

const chooseRoleV3Summary = (snapshots: TeamSnapshot[], scoutMode: RoleV3ScoutMode = 'raw'): RoleV3Summary => {
  const candidates = snapshots.map(snapshot => roleV3SignalForSnapshot(snapshot, scoutMode));
  const bestCandidate =
    candidates.sort(
      (left, right) =>
        right.netSwing - left.netSwing ||
        right.defenseValue - left.defenseValue ||
        right.confidence - left.confidence
    )[0] ?? null;
  const allOffense: RoleOption = {
    label: scoutMode === 'gated' ? 'all-offense-v3-gated' : 'all-offense-v3',
    defenderTeamKey: null,
    offenseCost: 0,
    defenseValue: 0,
    foulRisk: 0,
    netSwing: 0
  };
  const minimumSelectedConfidence = scoutMode === 'gated' ? 0.35 : 0;
  const selected =
    bestCandidate && bestCandidate.netSwing > 0 && bestCandidate.confidence >= minimumSelectedConfidence
      ? {
          label: `${scoutMode === 'gated' ? 'defense-v3-gated' : 'defense-v3'}:${bestCandidate.teamKey}`,
          defenderTeamKey: bestCandidate.teamKey,
          offenseCost: bestCandidate.offenseCost,
          defenseValue: bestCandidate.defenseValue,
          foulRisk: bestCandidate.foulExposure,
          netSwing: bestCandidate.netSwing
        }
      : allOffense;

  return {
    selected,
    bestCandidate,
    suppressionSum: sum(candidates.map(candidate => candidate.suppressionValue)),
    consistencyMean: mean(candidates.map(candidate => candidate.suppressionConsistency)),
    foulExposureSum: sum(candidates.map(candidate => candidate.foulExposure)),
    offenseCostSum: sum(candidates.map(candidate => candidate.offenseCost)),
    confidenceMean: mean(candidates.map(candidate => candidate.confidence))
  };
};

const addAllianceFeatures = (
  features: Record<string, number>,
  prefix: string,
  snapshots: TeamSnapshot[],
  role: RoleOption,
  seasonAverageAllianceScore: number
) => {
  const seasonOffense = allianceValue(snapshots, snapshot => snapshot.seasonOffense || seasonAverageAllianceScore / 3);
  const eventOffense = allianceValue(snapshots, snapshot => snapshot.eventOffense || snapshot.seasonOffense);
  const recentOffense = allianceValue(snapshots, snapshot => snapshot.recentOffense || snapshot.seasonOffense);
  const epa = allianceValue(snapshots, snapshot => snapshot.statboticsEpa);
  const defense = allianceValue(snapshots, snapshot => snapshot.defenseDenial + (snapshot.scoutDefense ?? 0));
  const roleV2 = chooseRoleV2Option(snapshots);
  const roleV3 = chooseRoleV3Summary(snapshots);
  const roleV3Gated = chooseRoleV3Summary(snapshots, 'gated');
  const roleV2Suppression = allianceValue(snapshots, snapshot => snapshot.defenseSuppressionAll);
  const roleV2SuppressionRate = mean(snapshots.map(snapshot => snapshot.defenseSuppressionRate));
  const foulRisk = allianceValue(snapshots, snapshot => snapshot.foulRisk + snapshot.reliabilityPenalty);
  const foulRiskAll = allianceValue(snapshots, snapshot => snapshot.foulRiskAll + snapshot.reliabilityPenalty);
  const componentAuto = allianceValue(snapshots, snapshot => snapshot.componentAuto);
  const componentTeleop = allianceValue(snapshots, snapshot => snapshot.componentTeleop);
  const componentEndgame = allianceValue(snapshots, snapshot => snapshot.componentEndgame);
  const componentFoul = allianceValue(snapshots, snapshot => snapshot.componentFoul);
  const scoutOffense = allianceValue(snapshots, snapshot => snapshot.scoutOffense);
  const scoutDefense = allianceValue(snapshots, snapshot => snapshot.scoutDefense);
  const scoutOffenseSamples = allianceValue(snapshots, snapshot => snapshot.scoutOffenseSamples);
  const scoutDefenseSamples = allianceValue(snapshots, snapshot => snapshot.scoutDefenseSamples);
  const scoutOffenseConfidence = mean(snapshots.map(snapshot => snapshot.scoutOffenseConfidence));
  const scoutDefenseConfidence = mean(snapshots.map(snapshot => snapshot.scoutDefenseConfidence));
  const scoutGatedOffense = allianceValue(snapshots, snapshot => snapshot.scoutGatedOffense);
  const scoutGatedDefense = allianceValue(snapshots, snapshot => snapshot.scoutGatedDefense);
  const matches = allianceValue(snapshots, snapshot => snapshot.seasonMatches);
  const eventMatches = allianceValue(snapshots, snapshot => snapshot.eventMatches);

  features[`${prefix}_season_offense_sum`] = seasonOffense;
  features[`${prefix}_event_offense_sum`] = eventOffense;
  features[`${prefix}_recent_offense_sum`] = recentOffense;
  features[`${prefix}_statbotics_epa_sum`] = epa;
  features[`${prefix}_defense_denial_sum`] = defense;
  features[`${prefix}_role_v2_suppression_sum`] = roleV2Suppression;
  features[`${prefix}_role_v2_suppression_rate_mean`] = roleV2SuppressionRate;
  features[`${prefix}_foul_risk_sum`] = foulRisk;
  features[`${prefix}_role_v2_foul_risk_all_sum`] = foulRiskAll;
  features[`${prefix}_component_auto_sum`] = componentAuto;
  features[`${prefix}_component_teleop_sum`] = componentTeleop;
  features[`${prefix}_component_endgame_sum`] = componentEndgame;
  features[`${prefix}_component_foul_sum`] = componentFoul;
  features[`${prefix}_component_modeled_score_sum`] = componentAuto + componentTeleop + componentEndgame;
  features[`${prefix}_scout_offense_sum`] = scoutOffense;
  features[`${prefix}_scout_defense_sum`] = scoutDefense;
  features[`${prefix}_scout_offense_samples_sum`] = scoutOffenseSamples;
  features[`${prefix}_scout_defense_samples_sum`] = scoutDefenseSamples;
  features[`${prefix}_scout_offense_confidence_mean`] = scoutOffenseConfidence;
  features[`${prefix}_scout_defense_confidence_mean`] = scoutDefenseConfidence;
  features[`${prefix}_scout_gated_offense_sum`] = scoutGatedOffense;
  features[`${prefix}_scout_gated_defense_sum`] = scoutGatedDefense;
  features[`${prefix}_season_matches_sum`] = matches;
  features[`${prefix}_event_matches_sum`] = eventMatches;
  features[`${prefix}_experience_min`] =
    snapshots.length > 0 ? Math.min(...snapshots.map(snapshot => snapshot.seasonMatches)) : 0;
  features[`${prefix}_volatility_mean`] = mean(snapshots.map(snapshot => snapshot.volatility));
  features[`${prefix}_reliability_penalty_sum`] = allianceValue(snapshots, snapshot => snapshot.reliabilityPenalty);
  features[`${prefix}_role_offense_cost`] = role.offenseCost;
  features[`${prefix}_role_defense_value`] = role.defenseValue;
  features[`${prefix}_role_foul_risk`] = role.foulRisk;
  features[`${prefix}_role_net_swing`] = role.netSwing;
  features[`${prefix}_role_v2_offense_cost`] = roleV2.offenseCost;
  features[`${prefix}_role_v2_defense_value`] = roleV2.defenseValue;
  features[`${prefix}_role_v2_foul_risk`] = roleV2.foulRisk;
  features[`${prefix}_role_v2_net_swing`] = roleV2.netSwing;
  features[`${prefix}_role_v2_defender_selected`] = roleV2.defenderTeamKey ? 1 : 0;
  features[`${prefix}_role_v3_suppression_sum`] = roleV3.suppressionSum;
  features[`${prefix}_role_v3_consistency_mean`] = roleV3.consistencyMean;
  features[`${prefix}_role_v3_foul_exposure_sum`] = roleV3.foulExposureSum;
  features[`${prefix}_role_v3_offense_cost_sum`] = roleV3.offenseCostSum;
  features[`${prefix}_role_v3_confidence_mean`] = roleV3.confidenceMean;
  features[`${prefix}_role_v3_best_defense_value`] = roleV3.bestCandidate?.defenseValue ?? 0;
  features[`${prefix}_role_v3_best_offense_cost`] = roleV3.bestCandidate?.offenseCost ?? 0;
  features[`${prefix}_role_v3_best_foul_exposure`] = roleV3.bestCandidate?.foulExposure ?? 0;
  features[`${prefix}_role_v3_best_confidence`] = roleV3.bestCandidate?.confidence ?? 0;
  features[`${prefix}_role_v3_best_net_swing`] = roleV3.bestCandidate?.netSwing ?? 0;
  features[`${prefix}_role_v3_selected_net_swing`] = roleV3.selected.netSwing;
  features[`${prefix}_role_v3_defender_selected`] = roleV3.selected.defenderTeamKey ? 1 : 0;
  features[`${prefix}_role_v3_gated_suppression_sum`] = roleV3Gated.suppressionSum;
  features[`${prefix}_role_v3_gated_consistency_mean`] = roleV3Gated.consistencyMean;
  features[`${prefix}_role_v3_gated_foul_exposure_sum`] = roleV3Gated.foulExposureSum;
  features[`${prefix}_role_v3_gated_offense_cost_sum`] = roleV3Gated.offenseCostSum;
  features[`${prefix}_role_v3_gated_confidence_mean`] = roleV3Gated.confidenceMean;
  features[`${prefix}_role_v3_gated_best_defense_value`] = roleV3Gated.bestCandidate?.defenseValue ?? 0;
  features[`${prefix}_role_v3_gated_best_offense_cost`] = roleV3Gated.bestCandidate?.offenseCost ?? 0;
  features[`${prefix}_role_v3_gated_best_foul_exposure`] = roleV3Gated.bestCandidate?.foulExposure ?? 0;
  features[`${prefix}_role_v3_gated_best_confidence`] = roleV3Gated.bestCandidate?.confidence ?? 0;
  features[`${prefix}_role_v3_gated_best_net_swing`] = roleV3Gated.bestCandidate?.netSwing ?? 0;
  features[`${prefix}_role_v3_gated_selected_net_swing`] = roleV3Gated.selected.netSwing;
  features[`${prefix}_role_v3_gated_defender_selected`] = roleV3Gated.selected.defenderTeamKey ? 1 : 0;
};

const addEventMetadataFeatures = (features: Record<string, number>, metadata: EventMetadata | null) => {
  const eventType = metadata?.eventType.toLowerCase() ?? '';
  features.event_week = metadata?.week ?? 0;
  features.event_team_count = metadata?.teamCount ?? 0;
  features.event_is_regional = eventType === 'regional' ? 1 : 0;
  features.event_is_district = eventType === 'district' ? 1 : 0;
  features.event_is_district_cmp = eventType === 'district_cmp' || eventType === 'dcmp' ? 1 : 0;
  features.event_is_champs = eventType === 'champs' || eventType === 'cmp' || eventType === 'einstein' ? 1 : 0;
  features.event_is_champs_division = eventType === 'champs_div' ? 1 : 0;
};

const buildRow = ({
  match,
  perspective,
  ownSnapshots,
  opponentSnapshots,
  ownRole,
  opponentRole,
  seasonAverageAllianceScore,
  eventMetadata,
  options
}: {
  match: HistoricalMatch;
  perspective: AllianceColor;
  ownSnapshots: TeamSnapshot[];
  opponentSnapshots: TeamSnapshot[];
  ownRole: RoleOption;
  opponentRole: RoleOption;
  seasonAverageAllianceScore: number;
  eventMetadata: EventMetadata | null;
  options: FeatureOptions;
}): FeatureRow => {
  const own = match[perspective];
  const opponent = match[perspective === 'red' ? 'blue' : 'red'];
  const features: Record<string, number> = {
    season_offset: match.season - 2020,
    match_number_log: Math.log1p(match.matchNumber),
    is_playoff: match.compLevel === 'qm' || match.compLevel === 'pm' ? 0 : 1,
    season_average_alliance_score: seasonAverageAllianceScore
  };

  addAllianceFeatures(features, 'own', ownSnapshots, options.useRoleFeatures ? ownRole : chooseRoleOption([]), seasonAverageAllianceScore);
  addAllianceFeatures(
    features,
    'opp',
    opponentSnapshots,
    options.useRoleFeatures ? opponentRole : chooseRoleOption([]),
    seasonAverageAllianceScore
  );
  addEventMetadataFeatures(features, eventMetadata);

  const feature = (key: string) => features[key] ?? 0;

  features.offense_gap = feature('own_season_offense_sum') - feature('opp_season_offense_sum');
  features.event_offense_gap = feature('own_event_offense_sum') - feature('opp_event_offense_sum');
  features.recent_offense_gap = feature('own_recent_offense_sum') - feature('opp_recent_offense_sum');
  features.defense_gap = feature('own_defense_denial_sum') - feature('opp_defense_denial_sum');
  features.foul_risk_gap = feature('own_foul_risk_sum') - feature('opp_foul_risk_sum');
  features.role_v2_suppression_gap = feature('own_role_v2_suppression_sum') - feature('opp_role_v2_suppression_sum');
  features.role_v2_foul_risk_gap = feature('own_role_v2_foul_risk_all_sum') - feature('opp_role_v2_foul_risk_all_sum');
  features.role_v2_net_swing_gap = feature('own_role_v2_net_swing') - feature('opp_role_v2_net_swing');
  features.role_v3_suppression_gap = feature('own_role_v3_suppression_sum') - feature('opp_role_v3_suppression_sum');
  features.role_v3_consistency_gap = feature('own_role_v3_consistency_mean') - feature('opp_role_v3_consistency_mean');
  features.role_v3_foul_exposure_gap =
    feature('own_role_v3_foul_exposure_sum') - feature('opp_role_v3_foul_exposure_sum');
  features.role_v3_offense_cost_gap = feature('own_role_v3_offense_cost_sum') - feature('opp_role_v3_offense_cost_sum');
  features.role_v3_confidence_gap = feature('own_role_v3_confidence_mean') - feature('opp_role_v3_confidence_mean');
  features.role_v3_best_net_swing_gap =
    feature('own_role_v3_best_net_swing') - feature('opp_role_v3_best_net_swing');
  features.role_v3_selected_net_swing_gap =
    feature('own_role_v3_selected_net_swing') - feature('opp_role_v3_selected_net_swing');
  features.role_v3_gated_suppression_gap =
    feature('own_role_v3_gated_suppression_sum') - feature('opp_role_v3_gated_suppression_sum');
  features.role_v3_gated_consistency_gap =
    feature('own_role_v3_gated_consistency_mean') - feature('opp_role_v3_gated_consistency_mean');
  features.role_v3_gated_foul_exposure_gap =
    feature('own_role_v3_gated_foul_exposure_sum') - feature('opp_role_v3_gated_foul_exposure_sum');
  features.role_v3_gated_offense_cost_gap =
    feature('own_role_v3_gated_offense_cost_sum') - feature('opp_role_v3_gated_offense_cost_sum');
  features.role_v3_gated_confidence_gap =
    feature('own_role_v3_gated_confidence_mean') - feature('opp_role_v3_gated_confidence_mean');
  features.role_v3_gated_best_net_swing_gap =
    feature('own_role_v3_gated_best_net_swing') - feature('opp_role_v3_gated_best_net_swing');
  features.role_v3_gated_selected_net_swing_gap =
    feature('own_role_v3_gated_selected_net_swing') - feature('opp_role_v3_gated_selected_net_swing');
  features.component_modeled_score_gap = feature('own_component_modeled_score_sum') - feature('opp_component_modeled_score_sum');
  features.component_foul_gap = feature('own_component_foul_sum') - feature('opp_component_foul_sum');
  features.scout_gated_offense_gap = feature('own_scout_gated_offense_sum') - feature('opp_scout_gated_offense_sum');
  features.scout_gated_defense_gap = feature('own_scout_gated_defense_sum') - feature('opp_scout_gated_defense_sum');
  features.scout_coverage_gap =
    feature('own_scout_offense_confidence_mean') +
    feature('own_scout_defense_confidence_mean') -
    feature('opp_scout_offense_confidence_mean') -
    feature('opp_scout_defense_confidence_mean');
  features.epa_gap = feature('own_statbotics_epa_sum') - feature('opp_statbotics_epa_sum');
  features.experience_gap = feature('own_season_matches_sum') - feature('opp_season_matches_sum');
  features.role_adjusted_expected_score =
    feature('own_recent_offense_sum') -
    feature('own_role_offense_cost') -
    feature('opp_role_defense_value') +
    feature('opp_role_foul_risk');

  if (!options.useContextEpa) {
    features.own_statbotics_epa_sum = 0;
    features.opp_statbotics_epa_sum = 0;
    features.epa_gap = 0;
  }

  return {
    rowId: `${match.key}:${perspective}`,
    matchKey: match.key,
    eventKey: match.eventKey,
    season: match.season,
    sortKey: matchSortRank(match.compLevel, match.matchNumber, match.startTime),
    perspective,
    allianceTeams: own.teamKeys,
    opponentTeams: opponent.teamKeys,
    targetScore: own.score,
    opponentScore: opponent.score,
    targetWin: own.score > opponent.score,
    targetFoulPoints: own.foulPoints,
    targetTechFouls: own.techFoulCount,
    sourceExpectedScore: own.preMatchExpectedScore ?? null,
    sourceWinProbability: own.preMatchWinProbability ?? null,
    eventMetadata,
    roleOption: ownRole,
    opponentRoleOption: opponentRole,
    features
  };
};

const updateTeamAfterMatch = (
  state: MutableTeamState,
  eventKey: string,
  allianceScore: number,
  componentBuckets: ComponentBuckets,
  defenseDenial: number,
  concededFoulPoints: number,
  observations: ScoutingObservation[]
) => {
  const contribution = allianceScore / 3;
  const componentShare = 1 / 3;
  state.seasonScores.push(contribution);
  const eventScores = state.eventScores.get(eventKey) ?? [];
  eventScores.push(contribution);
  state.eventScores.set(eventKey, eventScores);
  if (componentBuckets.auto > 0) state.autoScores.push(componentBuckets.auto * componentShare);
  if (componentBuckets.teleop > 0) state.teleopScores.push(componentBuckets.teleop * componentShare);
  if (componentBuckets.endgame > 0) state.endgameScores.push(componentBuckets.endgame * componentShare);
  if (componentBuckets.foul > 0) state.foulScores.push(componentBuckets.foul * componentShare);
  const perTeamFoulRisk = Math.max(0, concededFoulPoints * componentShare);
  state.foulRiskAttempts.push(perTeamFoulRisk);
  if (perTeamFoulRisk > 0) state.foulRisks.push(perTeamFoulRisk);

  if (Number.isFinite(defenseDenial)) {
    const boundedDefenseDenial = Math.max(0, defenseDenial);
    state.defenseDenialAttempts.push(boundedDefenseDenial);
    if (boundedDefenseDenial > 0) {
      state.defenseDenials.push(boundedDefenseDenial);
    }
  }

  observations.forEach(observation => {
    if (observation.offensePoints != null) {
      state.scoutOffense.push(observation.offensePoints);
      const eventScoutOffense = state.eventScoutOffense.get(eventKey) ?? [];
      eventScoutOffense.push(observation.offensePoints);
      state.eventScoutOffense.set(eventKey, eventScoutOffense);
    }
    if (observation.defenseValue != null || observation.playedDefense) {
      const defenseValue = Math.max(0, observation.defenseValue ?? 3);
      state.scoutDefense.push(defenseValue);
      const eventScoutDefense = state.eventScoutDefense.get(eventKey) ?? [];
      eventScoutDefense.push(defenseValue);
      state.eventScoutDefense.set(eventKey, eventScoutDefense);
    }
    if (observation.reliabilityPenalty != null) state.reliabilityPenalties.push(observation.reliabilityPenalty);
  });
};

interface ComponentBuckets {
  auto: number;
  teleop: number;
  endgame: number;
  foul: number;
}

const normalizeComponentKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const firstComponentValue = (components: Record<string, number>, candidates: string[]) => {
  const normalizedCandidates = new Set(candidates.map(normalizeComponentKey));
  for (const [key, value] of Object.entries(components)) {
    if (normalizedCandidates.has(normalizeComponentKey(key)) && Number.isFinite(value)) return value;
  }
  return null;
};

const sumComponentValues = (components: Record<string, number>, predicate: (normalizedKey: string) => boolean) =>
  Object.entries(components).reduce((total, [key, value]) => {
    const normalizedKey = normalizeComponentKey(key);
    if (!Number.isFinite(value) || !predicate(normalizedKey)) return total;
    return total + value;
  }, 0);

const componentBucketsForAlliance = (alliance: HistoricalMatch['red']): ComponentBuckets => {
  const components = alliance.componentPoints ?? {};
  const auto =
    firstComponentValue(components, ['auto_points', 'autoPoints']) ??
    sumComponentValues(components, key => key.includes('auto') && !key.includes('total'));
  const teleop =
    firstComponentValue(components, ['teleop_points', 'teleopPoints']) ??
    sumComponentValues(components, key => key.includes('teleop') && !key.includes('total'));
  const endgame =
    firstComponentValue(components, ['endgame_points', 'endGamePoints']) ??
    sumComponentValues(
      components,
      key =>
        (key.includes('endgame') ||
          key.includes('climb') ||
          key.includes('stage') ||
          key.includes('park') ||
          key.includes('harmony') ||
          key.includes('trap')) &&
        !key.includes('total')
    );
  return {
    auto,
    teleop,
    endgame,
    foul: alliance.foulPoints ?? 0
  };
};

export const buildWalkForwardDataset = (
  matches: HistoricalMatch[],
  observations: ScoutingObservation[] = [],
  statboticsSignals: StatboticsTeamSignal[] = [],
  options: FeatureOptions = { useRoleFeatures: true, useContextEpa: false },
  eventMetadata: EventMetadata[] = []
): WalkForwardDataset => {
  const playedMatches = matches
    .filter(match => match.red.score >= 0 && match.blue.score >= 0 && match.red.teamKeys.length > 0 && match.blue.teamKeys.length > 0)
    .sort((left, right) => {
      const seasonDelta = left.season - right.season;
      if (seasonDelta !== 0) return seasonDelta;
      return (
        matchSortRank(left.compLevel, left.matchNumber, left.startTime) -
        matchSortRank(right.compLevel, right.matchNumber, right.startTime)
      );
    });
  const statbotics = buildStatboticsLookup(statboticsSignals);
  const observationLookup = buildObservationLookup(observations);
  const eventMetadataLookup = buildEventMetadataLookup(eventMetadata);
  const teamStates = new Map<string, MutableTeamState>();
  const seasonStates = new Map<number, SeasonState>();
  const rows: FeatureRow[] = [];
  const featureNames = new Set<string>();

  playedMatches.forEach(match => {
    const seasonState = getSeasonState(seasonStates, match.season);
    const metadata = eventMetadataLookup.get(match.eventKey) ?? null;
    const seasonAverageAllianceScore = seasonState.allianceScores.length > 0 ? mean(seasonState.allianceScores) : 0;
    const redSnapshots = match.red.teamKeys.map(teamKey =>
      getSnapshot(teamStates, statbotics, teamKey, match.eventKey, match.season, options.useContextEpa)
    );
    const blueSnapshots = match.blue.teamKeys.map(teamKey =>
      getSnapshot(teamStates, statbotics, teamKey, match.eventKey, match.season, options.useContextEpa)
    );
    const redRole = chooseRoleOption(redSnapshots);
    const blueRole = chooseRoleOption(blueSnapshots);

    const redRow = buildRow({
      match,
      perspective: 'red',
      ownSnapshots: redSnapshots,
      opponentSnapshots: blueSnapshots,
      ownRole: redRole,
      opponentRole: blueRole,
      seasonAverageAllianceScore,
      eventMetadata: metadata,
      options
    });
    const blueRow = buildRow({
      match,
      perspective: 'blue',
      ownSnapshots: blueSnapshots,
      opponentSnapshots: redSnapshots,
      ownRole: blueRole,
      opponentRole: redRole,
      seasonAverageAllianceScore,
      eventMetadata: metadata,
      options
    });

    rows.push(redRow, blueRow);
    Object.keys(redRow.features).forEach(feature => featureNames.add(feature));
    Object.keys(blueRow.features).forEach(feature => featureNames.add(feature));

    const redExpectedBefore = Math.max(
      seasonAverageAllianceScore,
      sum(redSnapshots.map(snapshot => snapshot.recentOffense || snapshot.seasonOffense))
    );
    const blueExpectedBefore = Math.max(
      seasonAverageAllianceScore,
      sum(blueSnapshots.map(snapshot => snapshot.recentOffense || snapshot.seasonOffense))
    );
    const redDefenseDenial = clamp((blueExpectedBefore - match.blue.score) / Math.max(1, match.red.teamKeys.length), 0, 80);
    const blueDefenseDenial = clamp((redExpectedBefore - match.red.score) / Math.max(1, match.blue.teamKeys.length), 0, 80);

    match.red.teamKeys.forEach(teamKey => {
      updateTeamAfterMatch(
        getTeamState(teamStates, teamKey),
        match.eventKey,
        match.red.score,
        componentBucketsForAlliance(match.red),
        redDefenseDenial,
        match.blue.foulPoints ?? 0,
        observationLookup.get(observationKey(match.eventKey, match.key.split('_').pop() ?? match.key, teamKey)) ??
          observationLookup.get(observationKey(match.eventKey, match.key, teamKey)) ??
          []
      );
    });
    match.blue.teamKeys.forEach(teamKey => {
      updateTeamAfterMatch(
        getTeamState(teamStates, teamKey),
        match.eventKey,
        match.blue.score,
        componentBucketsForAlliance(match.blue),
        blueDefenseDenial,
        match.red.foulPoints ?? 0,
        observationLookup.get(observationKey(match.eventKey, match.key.split('_').pop() ?? match.key, teamKey)) ??
          observationLookup.get(observationKey(match.eventKey, match.key, teamKey)) ??
          []
      );
    });
    seasonState.allianceScores.push(match.red.score, match.blue.score);
  });

  return {
    rows,
    featureNames: Array.from(featureNames).sort(),
    leakageNotes: options.useContextEpa
      ? ['Statbotics team-event/year EPA is contextual. Promote only after historical snapshot leakage is proven safe.']
      : ['No Statbotics context EPA is used; features are built from prior matches and prior scout observations only.']
  };
};

export const summarizeDataset = (dataset: WalkForwardDataset) => ({
  rows: dataset.rows.length,
  matches: new Set(dataset.rows.map(row => row.matchKey)).size,
  seasons: new Set(dataset.rows.map(row => row.season)).size,
  features: dataset.featureNames.length,
  averageScore: mean(dataset.rows.map(row => row.targetScore)),
  averageFoulPoints: mean(dataset.rows.map(row => row.targetFoulPoints ?? 0)),
  techFoulLabeledRows: dataset.rows.filter(row => row.targetTechFouls != null).length,
  roleDefenseRows: dataset.rows.filter(row => row.roleOption.defenderTeamKey !== null).length,
  scoutEnrichedRows: dataset.rows.filter(
    row => (row.features.own_scout_offense_sum ?? 0) > 0 || (row.features.own_scout_defense_sum ?? 0) > 0
  ).length,
  eventMetadataRows: dataset.rows.filter(row => row.eventMetadata != null).length,
  noFutureCheck: 'Rows are emitted before the current match updates team state.'
});
