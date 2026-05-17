import type {
  AllianceColor,
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
  defenseDenials: number[];
  scoutOffense: number[];
  scoutDefense: number[];
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
  defenseDenials: [],
  scoutOffense: [],
  scoutDefense: [],
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
    scoutOffense: state.scoutOffense.length > 0 ? mean(state.scoutOffense) : null,
    scoutDefense: state.scoutDefense.length > 0 ? mean(state.scoutDefense) : null,
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
    netSwing: 0
  };

  const candidates = snapshots.map(snapshot => {
    const offense = snapshot.eventOffense || snapshot.recentOffense || snapshot.seasonOffense;
    const scoutBoost = snapshot.scoutDefense ?? 0;
    const defenseValue = Math.max(0, snapshot.defenseDenial + scoutBoost);
    const offenseCost = Math.max(0, offense * 0.78);
    return {
      label: `defense:${snapshot.teamKey}`,
      defenderTeamKey: snapshot.teamKey,
      offenseCost,
      defenseValue,
      netSwing: defenseValue - offenseCost
    };
  });

  return [allOffense, ...candidates].sort(
    (left, right) => right.netSwing - left.netSwing || right.defenseValue - left.defenseValue
  )[0] ?? allOffense;
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
  const scoutOffense = allianceValue(snapshots, snapshot => snapshot.scoutOffense);
  const scoutDefense = allianceValue(snapshots, snapshot => snapshot.scoutDefense);
  const matches = allianceValue(snapshots, snapshot => snapshot.seasonMatches);
  const eventMatches = allianceValue(snapshots, snapshot => snapshot.eventMatches);

  features[`${prefix}_season_offense_sum`] = seasonOffense;
  features[`${prefix}_event_offense_sum`] = eventOffense;
  features[`${prefix}_recent_offense_sum`] = recentOffense;
  features[`${prefix}_statbotics_epa_sum`] = epa;
  features[`${prefix}_defense_denial_sum`] = defense;
  features[`${prefix}_scout_offense_sum`] = scoutOffense;
  features[`${prefix}_scout_defense_sum`] = scoutDefense;
  features[`${prefix}_season_matches_sum`] = matches;
  features[`${prefix}_event_matches_sum`] = eventMatches;
  features[`${prefix}_experience_min`] =
    snapshots.length > 0 ? Math.min(...snapshots.map(snapshot => snapshot.seasonMatches)) : 0;
  features[`${prefix}_volatility_mean`] = mean(snapshots.map(snapshot => snapshot.volatility));
  features[`${prefix}_reliability_penalty_sum`] = allianceValue(snapshots, snapshot => snapshot.reliabilityPenalty);
  features[`${prefix}_role_offense_cost`] = role.offenseCost;
  features[`${prefix}_role_defense_value`] = role.defenseValue;
  features[`${prefix}_role_net_swing`] = role.netSwing;
};

const buildRow = ({
  match,
  perspective,
  ownSnapshots,
  opponentSnapshots,
  ownRole,
  opponentRole,
  seasonAverageAllianceScore,
  options
}: {
  match: HistoricalMatch;
  perspective: AllianceColor;
  ownSnapshots: TeamSnapshot[];
  opponentSnapshots: TeamSnapshot[];
  ownRole: RoleOption;
  opponentRole: RoleOption;
  seasonAverageAllianceScore: number;
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

  const feature = (key: string) => features[key] ?? 0;

  features.offense_gap = feature('own_season_offense_sum') - feature('opp_season_offense_sum');
  features.event_offense_gap = feature('own_event_offense_sum') - feature('opp_event_offense_sum');
  features.recent_offense_gap = feature('own_recent_offense_sum') - feature('opp_recent_offense_sum');
  features.defense_gap = feature('own_defense_denial_sum') - feature('opp_defense_denial_sum');
  features.epa_gap = feature('own_statbotics_epa_sum') - feature('opp_statbotics_epa_sum');
  features.experience_gap = feature('own_season_matches_sum') - feature('opp_season_matches_sum');
  features.role_adjusted_expected_score =
    feature('own_recent_offense_sum') - feature('own_role_offense_cost') - feature('opp_role_defense_value');

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
    roleOption: ownRole,
    opponentRoleOption: opponentRole,
    features
  };
};

const updateTeamAfterMatch = (
  state: MutableTeamState,
  eventKey: string,
  allianceScore: number,
  defenseDenial: number,
  observations: ScoutingObservation[]
) => {
  const contribution = allianceScore / 3;
  state.seasonScores.push(contribution);
  const eventScores = state.eventScores.get(eventKey) ?? [];
  eventScores.push(contribution);
  state.eventScores.set(eventKey, eventScores);

  if (Number.isFinite(defenseDenial) && defenseDenial > 0) {
    state.defenseDenials.push(defenseDenial);
  }

  observations.forEach(observation => {
    if (observation.offensePoints != null) state.scoutOffense.push(observation.offensePoints);
    if (observation.defenseValue != null || observation.playedDefense) {
      state.scoutDefense.push(Math.max(0, observation.defenseValue ?? 3));
    }
    if (observation.reliabilityPenalty != null) state.reliabilityPenalties.push(observation.reliabilityPenalty);
  });
};

export const buildWalkForwardDataset = (
  matches: HistoricalMatch[],
  observations: ScoutingObservation[] = [],
  statboticsSignals: StatboticsTeamSignal[] = [],
  options: FeatureOptions = { useRoleFeatures: true, useContextEpa: false }
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
  const teamStates = new Map<string, MutableTeamState>();
  const seasonStates = new Map<number, SeasonState>();
  const rows: FeatureRow[] = [];
  const featureNames = new Set<string>();

  playedMatches.forEach(match => {
    const seasonState = getSeasonState(seasonStates, match.season);
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
        redDefenseDenial,
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
        blueDefenseDenial,
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
  noFutureCheck: 'Rows are emitted before the current match updates team state.'
});
