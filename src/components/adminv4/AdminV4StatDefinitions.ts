import { AdminV4SelectedMetric } from '../../utils/adminV4Settings';
import { AdminV4StatWikiDefinition } from './AdminV4StatWiki';

export type AdminV4SorterStatKey =
  | 'team'
  | 'tbaRank'
  | 'matches'
  | 'ppa'
  | 'ppc'
  | 'autoPpc'
  | 'teleopPpc'
  | 'defenseMetric'
  | 'epa'
  | 'opr'
  | 'dpr';

export type AdminV4PpaSubStatInfoKey =
  | 'ppaExpected'
  | 'ppaFloor'
  | 'ppaCeiling'
  | 'ppaNormalBand'
  | 'ppaRole'
  | 'ppaUncertainty'
  | 'ppaTailRisk'
  | 'ppaScoutConfidence'
  | 'ppaCoverage';

export type AdminV4StatInfoKey =
  | AdminV4SorterStatKey
  | AdminV4SelectedMetric
  | AdminV4PpaSubStatInfoKey
  | 'defenseImpact'
  | 'volatility'
  | 'rankings'
  | 'projectedRank'
  | 'rpForecast';

export type AdminV4StatInfoDefinition = AdminV4StatWikiDefinition;

export const ADMIN_V4_STAT_INFO: Record<AdminV4StatInfoKey, AdminV4StatInfoDefinition> = {
  team: {
    title: 'Team Number',
    category: 'Operational',
    definition: 'The team identity used to connect schedule rows, scouting rows, notes, and every model output.',
    formula: 'The FRC team number used as the row identity.',
    source: 'TBA, uploaded team list, Firebase scouting rows, or local cache.',
    interpretation: 'Use this to find the robot, then compare metrics around it.',
    limitations: 'Team number alone says nothing about current robot quality.'
  },
  tbaRank: {
    title: 'TBA Rank',
    category: 'Secondhand',
    definition: 'The official event ranking from TBA, useful for tournament context but not a clean robot-strength score.',
    formula: 'Current official ranking from The Blue Alliance rankings payload.',
    source: 'Live TBA ranking data or an uploaded/cached rankings file.',
    interpretation: 'Useful for event context and alliance-selection timing.',
    limitations: 'It blends schedule strength, rank points, penalties, and partners; it is not a pure robot-strength metric.',
    whereAppears: ['Teams', 'Pick List', 'Data', 'Reports']
  },
  rankings: {
    title: 'Projected Rankings',
    category: 'Derived',
    definition: 'An estimate of where teams may land after the remaining qualification matches are simulated.',
    formula: 'Played results plus future match forecasts, converted into projected record and rank points.',
    source: 'TBA schedule/results plus the active local model layer.',
    interpretation: 'Use it during quals to anticipate who may move into captain or first-round-pick range.',
    limitations: 'Forecast quality depends on schedule completeness and the selected model.',
    whereAppears: ['Now', 'Matches', 'Reports']
  },
  projectedRank: {
    title: 'Projected Rank',
    category: 'Derived',
    definition: 'The likely final rank if the current played results and future forecasts hold.',
    formula: 'Sort projected qualification totals after adding played results and forecasted future RP.',
    source: 'TBA schedule/results, current official rankings, and the active forecast model.',
    interpretation: 'Use it to estimate which teams may become captains or high-value first picks.',
    limitations: 'One wrong future match forecast can move several close teams. Treat tight rank gaps as ranges.',
    whereAppears: ['Matches', 'Reports']
  },
  rpForecast: {
    title: 'RP Forecast',
    category: 'Derived',
    definition: 'A forward-looking estimate of ranking points, split from wins and bonus objectives where the data allows.',
    formula: 'Projected win RP plus game-specific bonus RP from played and forecasted qualification matches.',
    source: 'Official results, future schedules, and model-specific bonus metrics when available.',
    interpretation: 'Use it to see whether a team is rising because of wins, bonus objectives, or both.',
    limitations: 'Bonus RP rules and uploaded score component quality determine how trustworthy the split is.',
    whereAppears: ['Matches', 'Reports']
  },
  matches: {
    title: 'Matches Logged',
    category: 'Firsthand',
    definition: 'How many local scout rows this device has for the team at the active event.',
    formula: 'Count of scouted match rows for this team in the active event.',
    source: 'Firebase scouting rows and local scout archive rows.',
    interpretation: 'Higher counts make scouting-derived stats more trustworthy.',
    limitations: 'A large count can still be biased if the rows are incorrect or from unusual match roles.',
    whereAppears: ['Teams', 'Visualize', 'Data', 'Reports']
  },
  ppc: {
    title: 'PPC',
    category: 'Firsthand',
    definition: 'The average points your scouts directly credited to this team in logged matches.',
    formula: 'Average scouted total match points per team across logged matches.',
    source: 'V3/V4 scouting data collected by your scouts.',
    interpretation: 'Best for what your scouts directly observed at this event.',
    limitations: 'Sensitive to scout consistency, missed rows, and strategic role changes.',
    whereAppears: ['Teams', 'Visualize', 'Reports']
  },
  autoPpc: {
    title: 'Auto PPC',
    category: 'Firsthand',
    definition: 'The average autonomous contribution your scouts recorded for the team.',
    formula: 'Average scouted autonomous points per team.',
    source: 'V3/V4 scouting data.',
    interpretation: 'Use it when selecting autonomous compatibility and early scoring reliability.',
    limitations: 'Does not include partner interaction, defense, or auto path conflicts by itself.',
    whereAppears: ['Teams', 'Visualize', 'Reports']
  },
  teleopPpc: {
    title: 'Teleop PPC',
    category: 'Firsthand',
    definition: 'The average teleoperated contribution your scouts recorded for the team.',
    formula: 'Average scouted teleop points per team.',
    source: 'V3/V4 scouting data.',
    interpretation: 'Use it for sustained scoring comparisons.',
    limitations: 'Can hide role-specific value such as defense, feeding, or endgame setup.',
    whereAppears: ['Teams', 'Visualize', 'Reports']
  },
  defenseMetric: {
    title: 'Defense Metric',
    category: 'Firsthand',
    definition: 'A scout-observed read of how much useful defense the robot played.',
    formula: 'Average defense score from submitted defense scouting forms.',
    source: 'Defense scouting rows collected by scouts.',
    interpretation: 'Higher means scouts observed more useful defensive value.',
    limitations: 'Subjective and role-dependent; compare with DPR/Defense Impact before over-trusting it.',
    whereAppears: ['Teams', 'Visualize', 'Data', 'Reports']
  },
  defenseImpact: {
    title: 'Defense Impact',
    category: 'Derived',
    definition: 'A model-assisted estimate of how much scoring the robot may have denied opponents.',
    formula: 'Estimated opponent scoring suppression attributed from match outcomes and model ratings.',
    source: 'Strategy model attribution layer using V4 records and team ratings.',
    interpretation: 'Use it to decide whether a robot is more valuable denying points than scoring them.',
    limitations: 'Requires enough played matches and can misattribute shared alliance effects.',
    whereAppears: ['Teams', 'Matches', 'Pick List', 'Visualize', 'Reports']
  },
  epa: {
    title: 'EPA',
    category: 'Secondhand',
    definition: 'A public Statbotics estimate of team strength, useful when local scouting is thin.',
    formula: 'Expected Points Added from Statbotics normalized team/event data.',
    source: 'Statbotics API/cache.',
    interpretation: 'Good public baseline when local scouting is sparse.',
    limitations: 'External model, may lag event changes, and may not reflect your exact scouting priorities.',
    whereAppears: ['Teams', 'Matches', 'Visualize', 'Reports']
  },
  opr: {
    title: 'OPR',
    category: 'Secondhand',
    definition: 'An official-score estimate of contribution based on alliance scores and partners faced.',
    formula: 'Linear estimate of team point contribution from official alliance scores.',
    source: 'Uploaded TBA COPR/OPR files or locally calculated OPR from TBA match scores.',
    interpretation: 'Good for broad official-score signal and cross-checking scouting averages.',
    limitations: 'Confounded by partners, defense, fouls, and schedule strength.',
    whereAppears: ['Teams', 'Matches', 'Visualize', 'Reports']
  },
  dpr: {
    title: 'DPR',
    category: 'Secondhand',
    definition: 'An official-score context stat for points allowed while the team was on the field.',
    formula: 'Linear estimate of points allowed while a team is present.',
    source: 'Official match scores through TBA/uploaded schedule data.',
    interpretation: 'Lower can indicate stronger defense or lower-scoring matches involving the team.',
    limitations: 'Very schedule- and partner-dependent; treat it as a context clue, not proof.',
    whereAppears: ['Teams', 'Visualize', 'Reports']
  },
  ppa: {
    title: 'PPA',
    category: 'Derived',
    definition: 'The full Admin V4 decision object for a team: expected value, floor, ceiling, role, risk, confidence, and supporting evidence.',
    formula: 'A PPA insight object: expected points plus floor/ceiling band, role fit, local scout confidence, uncertainty, tail risk, defense impact, and source-model context.',
    source: 'Admin V4 validated forecast layer, local scouting profiles, public rating context, defense attribution, and the promoted role/risk model path.',
    interpretation: 'Use the expected value for forecasts, the role label for match strategy, the confidence and tail-risk fields for how aggressively to trust the number, and the component values to explain why it moved.',
    limitations: 'It is not one magic score. Thin local scouting, high volatility, low reliability, or missing public context should make you treat PPA as a range and read the warnings.',
    whereAppears: ['Teams', 'Matches', 'Manual Simulator', 'Visualize', 'Reports']
  },
  ppaExpected: {
    title: 'PPA Expected',
    category: 'Derived',
    definition: 'The central contribution estimate used when the system needs one headline value.',
    formula: 'The central PPA contribution estimate after blending validated model rating, local scouting profile, public rating context, and role/defense context.',
    source: 'PPA insight builder from Admin V4 model ratings, team performance profiles, and event scouting rows.',
    interpretation: 'Use expected value for headline forecasts, leaderboard ordering, and simulator totals.',
    limitations: 'Expected value should never be read without floor, ceiling, role, confidence, and tail risk.',
    whereAppears: ['Teams', 'Matches', 'Pick List', 'Manual Simulator', 'Visualize', 'Reports']
  },
  ppaFloor: {
    title: 'PPA Floor',
    category: 'Derived',
    definition: 'The conservative lower band to use when a bad match would be costly.',
    formula: 'Lower-band contribution estimate from low-percentile local performance, reliability, zeros, failures, volatility, and thin-coverage penalties.',
    source: 'Team performance profile floor plus tail-risk guardrail context.',
    interpretation: 'Use floor when protecting a high seed, making conservative match strategy, or deciding whether a pick is safe.',
    limitations: 'A low floor can mean mechanical risk, role switching, bad scouting coverage, or one unusual match; read notes before condemning the robot.',
    whereAppears: ['Teams', 'Matches', 'Pick List', 'Manual Simulator', 'Visualize', 'Reports']
  },
  ppaCeiling: {
    title: 'PPA Ceiling',
    category: 'Derived',
    definition: 'The upside band to use when strategy or pick-list planning needs peak potential.',
    formula: 'Upper-band contribution estimate from high-percentile local performance, peak score, trend, role upside, and model rating.',
    source: 'Team performance profile ceiling plus PPA role and trend context.',
    interpretation: 'Use ceiling when hunting upset potential, second-round upside, or a match plan that needs a swing robot.',
    limitations: 'Ceiling is not a guarantee. High ceiling with high tail risk usually means the next scout row matters a lot.',
    whereAppears: ['Teams', 'Matches', 'Pick List', 'Manual Simulator', 'Visualize', 'Reports']
  },
  ppaNormalBand: {
    title: 'PPA Normal Band',
    category: 'Derived',
    definition: 'The ordinary-match range, narrower than the full floor-to-ceiling risk band.',
    formula: 'The expected ordinary range around PPA, usually narrower than full floor-to-ceiling risk.',
    source: 'PPA projection layer using profile spread and model context.',
    interpretation: 'Use normal band to explain what a team probably does most matches, separate from disaster floor or peak ceiling.',
    limitations: 'Normal band is less meaningful when there are few local rows, major role changes, or a fresh mechanical failure.',
    whereAppears: ['Teams', 'Reports', 'Admin-task handoff']
  },
  ppaRole: {
    title: 'PPA Role',
    category: 'Derived',
    definition: 'The job the model thinks the robot should probably play: scorer, defender, flex, or needs more role evidence.',
    formula: 'Role label selected from offensive value, defensive value, role evidence, and the team profile: primary scorer, defender, flex, or needs role evidence.',
    source: 'PPA role recommendation layer using V4 role rows, defense scouting, and performance profile components.',
    interpretation: 'Use role to decide how to deploy the robot, not only whether it is strong.',
    limitations: 'Role can lag reality if a team changes strategy mid-event or if defense rows are missing.',
    whereAppears: ['Teams', 'Matches', 'Pick List', 'Manual Simulator', 'Reports']
  },
  ppaUncertainty: {
    title: 'PPA Uncertainty',
    category: 'Derived',
    definition: 'A trust warning that says how settled or shaky the current PPA read is.',
    formula: 'Risk level from missing PPA rating, sparse local rows, volatility, low scout confidence, and unstable reliability.',
    source: 'PPA uncertainty scorer.',
    interpretation: 'Use uncertainty to decide whether to trust a plan now or send scouts to verify first.',
    limitations: 'Uncertainty is a warning light, not a stat ranking. The reasons matter more than the label alone.',
    whereAppears: ['Now', 'Teams', 'Matches', 'Pick List', 'Manual Simulator', 'Reports']
  },
  ppaTailRisk: {
    title: 'PPA Tail Risk',
    category: 'Derived',
    definition: 'A warning about downside failure modes that the expected value alone would hide.',
    formula: 'Failure-side risk from low floor, wide floor-ceiling band, zeros, weak reliability, and risky profile shape.',
    source: 'Tail-risk guardrail layer inside PPA insights.',
    interpretation: 'Use tail risk before trusting a ceiling, especially for alliance selection and must-win match plans.',
    limitations: 'Tail risk can be high for a useful team if scouts have not yet captured why its role changed.',
    whereAppears: ['Teams', 'Pick List', 'Manual Simulator', 'Visualize', 'Reports']
  },
  ppaScoutConfidence: {
    title: 'PPA Scout Confidence',
    category: 'Derived',
    definition: 'How much local scouting evidence supports the current PPA shape.',
    formula: 'Confidence score from local scouting coverage volume and quality signals.',
    source: 'PPA coverage layer using local match rows and scout archive evidence.',
    interpretation: 'Use scout confidence to judge whether local evidence can override public-only context.',
    limitations: 'Trust-for-plan still depends on row correctness; audit anomalies before using it for final calls.',
    whereAppears: ['Now', 'Teams', 'Data', 'Reports', 'Scout handoff']
  },
  ppaCoverage: {
    title: 'PPA Coverage',
    category: 'Operational',
    definition: 'A readable coverage label that tells the head scout whether the PPA shape is locally supported.',
    formula: 'Human-readable label for how much local evidence supports this PPA shape.',
    source: 'PPA coverage layer from local match row count and scout confidence.',
    interpretation: 'Use coverage labels to know whether to send more scouts or trust the current read.',
    limitations: 'Coverage says how much evidence exists, not whether the evidence is strategically representative.',
    whereAppears: ['Teams', 'Data', 'Reports', 'Scout handoff']
  },
  volatility: {
    title: 'Volatility',
    category: 'Derived',
    definition: 'How much the team swings around its recent performance trend.',
    formula: 'Spread of recent team performance around its fitted trend.',
    source: 'Admin V4 team performance profile layer.',
    interpretation: 'Higher volatility means higher upset potential and lower reliability.',
    limitations: 'A volatile team may be improving quickly, breaking down, or simply changing roles.',
    whereAppears: ['Teams', 'Visualize', 'Reports']
  }
};

export const getAdminV4StatInfo = (key: AdminV4StatInfoKey) => ADMIN_V4_STAT_INFO[key];

export const statInfoKeyFromAdminV4Route = (rawKey: string | null): AdminV4StatInfoKey => {
  const requestedKey = (rawKey || '').trim();
  const statKeys = Object.keys(ADMIN_V4_STAT_INFO) as AdminV4StatInfoKey[];
  return statKeys.find(key => key === requestedKey)
    || statKeys.find(key => key.toLowerCase() === requestedKey.toLowerCase())
    || 'ppa';
};
