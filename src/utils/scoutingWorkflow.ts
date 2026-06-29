import { buildAdminV4Route } from './adminV4Routes';

export type ScoutingMissionKey = 'preScout' | 'pitScout' | 'matchScout' | 'defenseScout';
export type ScoutingUseMomentKey = 'now' | 'matches' | 'pickList' | 'visualize' | 'data';

export interface ScoutingMission {
  key: ScoutingMissionKey;
  title: string;
  shortTitle: string;
  route?: string;
  when: string;
  question: string;
  rawInputs: string[];
  processedSignals: string[];
  usedFor: string[];
  modelImpact: string;
  tone: 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
}

export interface ScoutingUseMoment {
  key: ScoutingUseMomentKey;
  title: string;
  when: string;
  needs: string[];
  fedBy: ScoutingMissionKey[];
}

export const SCOUTING_MISSIONS: Record<ScoutingMissionKey, ScoutingMission> = {
  preScout: {
    key: 'preScout',
    title: 'Pre Scout',
    shortTitle: 'Before Event',
    route: '/pre',
    when: 'Before the event or before the first real match block.',
    question: 'What can we learn calmly before match pressure starts?',
    rawInputs: ['TBA team list', 'robot media', 'season results', 'video notes', 'manual research gaps'],
    processedSignals: ['pre-event coverage gaps', 'public context', 'pit priority list', 'match watch questions'],
    usedFor: ['pit scouting priorities', 'early qualification expectations', 'claim verification', 'demo proof context'],
    modelImpact: 'Pushes slow research out of match scout and creates public-only priors before local rows exist.',
    tone: 'violet'
  },
  pitScout: {
    key: 'pitScout',
    title: 'Pit Scout',
    shortTitle: 'At Pits',
    route: '/pit',
    when: 'When the robot is available and the drive team can answer capability questions.',
    question: 'What can we observe, and which claims need proof in real matches?',
    rawInputs: ['robot architecture', 'objective mechanisms', 'photos', 'claimed scoring split', 'claimed defense value', 'endgame capability'],
    processedSignals: ['observed capability prior', 'claim confidence', 'compatibility notes', 'mechanism risk', 'pick-list context'],
    usedFor: ['alliance selection', 'match role planning', 'pre-match questions', 'claim verification'],
    modelImpact: 'Creates a human prior while labeling subjective claims as discounted until match evidence confirms them.',
    tone: 'emerald'
  },
  matchScout: {
    key: 'matchScout',
    title: 'Match Scout',
    shortTitle: 'During Match',
    route: '/scout',
    when: 'During practice and qualification matches, one assigned robot at a time.',
    question: 'What actual live capability did the robot prove, without overloading the scout?',
    rawInputs: ['auto points', 'teleop shift actions', 'endgame', 'role played', 'traffic behavior', 'pressure response', 'failures', 'reliability'],
    processedSignals: ['actual contribution', 'expected range', 'role fit', 'volatility', 'claim contradictions', 'scout confidence'],
    usedFor: ['future qual forecasts', 'manual simulator', 'team profiles', 'pick-list ordering', 'pit-claim verification'],
    modelImpact: 'This is the strongest local signal for actual capability, downside risk, and future match prediction, so the form must stay feasible.',
    tone: 'cyan'
  },
  defenseScout: {
    key: 'defenseScout',
    title: 'Defense Scout',
    shortTitle: 'Defense Check',
    route: '/defense',
    when: 'When a robot spends meaningful time affecting another robot instead of scoring.',
    question: 'Did defense actually deny points, or did it only look active?',
    rawInputs: ['defense target', 'defense duration', 'defense intensity', 'defense comments'],
    processedSignals: ['Defense Impact', 'role recommendation', 'opponent suppression context'],
    usedFor: ['next-match strategy', 'defender assignment', 'pick-list role balance'],
    modelImpact: 'Separates true defensive value from low scoring and protects the expected range from role confusion.',
    tone: 'rose'
  }
};

export const SCOUTING_USE_MOMENTS: Record<ScoutingUseMomentKey, ScoutingUseMoment> = {
  now: {
    key: 'now',
    title: 'Now',
    when: 'Between matches, while decisions have to be immediate.',
    needs: ['next match', 'coverage gaps', 'stale sources', 'role warnings'],
    fedBy: ['matchScout', 'defenseScout']
  },
  matches: {
    key: 'matches',
    title: 'Matches',
    when: 'Preparing our next qual or simulating a custom what-if.',
    needs: ['expected range', 'role fit', 'confidence', 'defense impact'],
    fedBy: ['matchScout', 'defenseScout', 'pitScout']
  },
  pickList: {
    key: 'pickList',
    title: 'Pick List',
    when: 'Alliance selection or pick-list meetings.',
    needs: ['stable scoring', 'floor risk', 'compatibility', 'defense role value'],
    fedBy: ['pitScout', 'matchScout', 'defenseScout', 'preScout']
  },
  visualize: {
    key: 'visualize',
    title: 'Visualize',
    when: 'Explaining the data to strategists, mentors, visitors, or drive team.',
    needs: ['stat comparisons', 'trend curves', 'stat definitions', 'source context'],
    fedBy: ['matchScout', 'defenseScout', 'pitScout']
  },
  data: {
    key: 'data',
    title: 'Data',
    when: 'Maintaining imports, sync, coverage, scout assignments, and backups.',
    needs: ['raw rows', 'source freshness', 'assignment coverage', 'cache health'],
    fedBy: ['preScout', 'pitScout', 'matchScout', 'defenseScout']
  }
};

export const getScoutingMission = (key: ScoutingMissionKey) => SCOUTING_MISSIONS[key];

export const getMissionUseMoments = (key: ScoutingMissionKey) =>
  Object.values(SCOUTING_USE_MOMENTS).filter(moment => moment.fedBy.includes(key));

export const getAdminUseMomentRoute = (key: ScoutingUseMomentKey, currentSearch: string | URLSearchParams = '') => {
  switch (key) {
    case 'now':
      return buildAdminV4Route(currentSearch, { tab: 'now' });
    case 'matches':
      return buildAdminV4Route(currentSearch, { tab: 'matches' });
    case 'pickList':
      return buildAdminV4Route(currentSearch, { tab: 'pick-list' });
    case 'visualize':
      return buildAdminV4Route(currentSearch, { tab: 'visualize' });
    case 'data':
      return buildAdminV4Route(currentSearch, { tab: 'data', panel: 'collection' });
  }
};

export const getMissionToneClasses = (tone: ScoutingMission['tone']) => {
  switch (tone) {
    case 'cyan':
      return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
    case 'emerald':
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
    case 'amber':
      return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
    case 'rose':
      return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
    case 'violet':
      return 'border-violet-400/30 bg-violet-500/10 text-violet-100';
  }
};

export const EXPECTED_RANGE_COLLECTION_FIELDS = [
  'Auto/teleop/endgame points define the expected value only after pre-scout and pit priors are already loaded.',
  'Shift actions explain whether the contribution came from offense, defense, stockpile help, or role changes.',
  'Role, defended team, and defender faced prevent role confusion.',
  'Reliability and failures define the floor and tail risk.',
  'Strategy notes explain whether live match evidence confirmed or contradicted earlier claims.'
];

export const SCOUTING_DAY_SEQUENCE = [
  {
    step: 'Before matches',
    action: 'Pre Scout and Pit Scout set the first priors.',
    result: 'Admin knows what to verify before local match rows exist.'
  },
  {
    step: 'During each match',
    action: 'Match Scout captures scoring, role, reliability, and notes.',
    result: 'Expected value, volatility, scout confidence, and trend start moving.'
  },
  {
    step: 'When defense matters',
    action: 'Defense Scout records whether points were actually denied.',
    result: 'Expected ranges and match plans stop confusing useful defense with weak offense.'
  },
  {
    step: 'After data lands',
    action: 'The admin decision view turns evidence into forecasts, pick lists, charts, reports, and warnings.',
    result: 'The head scout gets the right decision surface for the current moment.'
  }
];

export const EXPECTED_RANGE_OUTPUTS = [
  {
    label: 'Expected',
    detail: 'The central contribution used for future quals and simulator estimates.'
  },
  {
    label: 'Floor',
    detail: 'The bad-match band from failures, zeros, volatility, and thin coverage.'
  },
  {
    label: 'Ceiling',
    detail: 'The upside band when the robot repeats its best stable patterns.'
  },
  {
    label: 'Role + Risk',
    detail: 'The explanation layer: scorer, defender, flex, confidence, and downside-risk caution.'
  }
];
