import type {
  AdminV4DataPanel,
  AdminV4WorkflowTab
} from './adminV4Routes.ts';
import {
  getAdminV4TeamSearchSuggestions,
  normalizeAdminV4TeamSearchText
} from './adminV4TeamSearch.ts';

export type AdminV4SmartSearchKind = 'team' | 'workflow' | 'panel' | 'tool' | 'stat';

export interface AdminV4SmartSearchStatInfo {
  title: string;
  category: string;
  definition?: string;
  whereAppears?: string[];
}

export interface AdminV4SmartSearchResult {
  id: string;
  kind: AdminV4SmartSearchKind;
  badge: string;
  title: string;
  description: string;
  matchLabel: string;
  score: number;
  teamNumber?: string;
  teamName?: string;
  workflowKey?: AdminV4WorkflowTab;
  panel?: AdminV4DataPanel;
  tool?: 'manualSimulator' | 'settings' | 'statsWiki';
  statKey?: string;
}

interface StaticSmartSearchTarget {
  id: string;
  kind: Exclude<AdminV4SmartSearchKind, 'team' | 'stat'>;
  badge: string;
  title: string;
  description: string;
  quickTitle?: string;
  quickDescription?: string;
  keywords: string[];
  workflowKey?: AdminV4WorkflowTab;
  panel?: AdminV4DataPanel;
  tool?: 'manualSimulator' | 'settings' | 'statsWiki';
}

const SMART_SEARCH_INTENT_WORDS = new Set([
  'a',
  'an',
  'are',
  'can',
  'change',
  'calculate',
  'calculated',
  'calculation',
  'calculations',
  'definition',
  'definitions',
  'do',
  'does',
  'explain',
  'find',
  'for',
  'formula',
  'get',
  'go',
  'help',
  'how',
  'i',
  'is',
  'im',
  'm',
  'make',
  'meaning',
  'me',
  'mean',
  'metric',
  'my',
  'need',
  'needs',
  'open',
  'our',
  'per',
  'please',
  'show',
  'stat',
  'stats',
  'the',
  'to',
  'want',
  'what',
  'where',
  'which',
  'with',
  'who',
  'why',
  'you'
]);

const STATIC_TARGETS: StaticSmartSearchTarget[] = [
  {
    id: 'workflow-now',
    kind: 'workflow',
    badge: 'Workflow',
    title: 'Now',
    description: 'Next match, trust level, required action, and newest operational warnings.',
    quickTitle: 'What do I do now?',
    quickDescription: 'Open the operational briefing with the next match, warnings, and best next action.',
    keywords: ['now', 'home', 'next', 'next match', 'match now', 'brief', 'briefing', 'newest news', 'latest update', 'latest updates', 'what do i do', 'what should i click', 'what should i do', 'what matters now', 'command', 'next safe click', 'current situation'],
    workflowKey: 'command'
  },
  {
    id: 'workflow-teams',
    kind: 'workflow',
    badge: 'Workflow',
    title: 'Teams',
    description: 'Leaderboard, sortable team stats, profiles, notes, and match history.',
    quickTitle: 'Find a team',
    quickDescription: 'Search or sort teams, then open a focused team profile.',
    keywords: ['teams', 'leaderboard', 'rank teams', 'rankings', 'sort', 'sort teams', 'team profile', 'team notes', 'who is good', 'who is best', 'best teams', 'find team', 'look up team', 'team lookup'],
    workflowKey: 'sorter'
  },
  {
    id: 'workflow-matches',
    kind: 'workflow',
    badge: 'Workflow',
    title: 'Matches',
    description: 'Future match forecasts, automatic simulations, played results, and match plans.',
    quickTitle: 'See future matches',
    quickDescription: 'Open upcoming quals, forecasts, and match plans.',
    keywords: ['matches', 'match', 'future', 'future matches', 'forecast', 'forecasts', 'quals', 'qualification', 'schedule', 'match schedule', 'next match', 'our next match', 'next qual', 'next quals', 'match plan', 'strategy', 'drive team', 'prepare drive team', 'drive team plan', 'drive coach', 'results', 'auto simulate', 'automatic simulation', 'upcoming matches', 'match soon', 'our match is soon', 'qual soon', 'drive team needs a plan'],
    workflowKey: 'predictor'
  },
  {
    id: 'tool-manual-simulator',
    kind: 'tool',
    badge: 'Tool',
    title: 'Manual Match Simulator',
    description: 'Custom what-if alliance simulation when you are not starting from a known future match.',
    keywords: ['simulator', 'simulate', 'manual simulator', 'match sim', 'what if', 'what-if', 'custom alliance', 'custom match', 'manual match', 'fake match', 'test alliance', 'try alliance'],
    tool: 'manualSimulator'
  },
  {
    id: 'workflow-pick-list',
    kind: 'workflow',
    badge: 'Workflow',
    title: 'Pick List',
    description: 'Alliance selection board, pick statuses, and meeting mode.',
    keywords: ['pick list', 'picklist', 'make pick list', 'build pick list', 'pick board', 'shortlist', 'short list', 'alliance', 'alliance selection', 'selection', 'draft', 'captain', 'first pick', 'second pick', 'playoffs', 'elims', 'defend alliance choices', 'build pick list'],
    workflowKey: 'pickList'
  },
  {
    id: 'workflow-visualize',
    kind: 'workflow',
    badge: 'Workflow',
    title: 'Visualize',
    description: 'Vertical bar charts, stat comparisons, trends, and multi-stat chart panels.',
    quickTitle: 'Compare stats',
    quickDescription: 'Open vertical chart panels for side-by-side team comparison.',
    keywords: ['visualize', 'visualization', 'chart', 'charts', 'vertical chart', 'vertical charts', 'bar chart', 'bar charts', 'graph', 'graphs', 'compare', 'compare stats', 'compare ppa', 'compare epa', 'compare ppa epa', 'compare teams', 'comparison', 'side by side', 'trend', 'trends', 'stats graph', 'plot'],
    workflowKey: 'visualize'
  },
  {
    id: 'tool-stats-wiki',
    kind: 'tool',
    badge: 'Stat Help',
    title: 'Stats Wiki',
    description: 'Plain-English stat definitions, formulas, source data, interpretation, and limitations.',
    quickTitle: 'Explain a stat',
    quickDescription: 'Open the wiki for formulas, source data, interpretation, and limitations.',
    keywords: ['stat', 'stats', 'stat help', 'stats help', 'stats wiki', 'metric guide', 'definition', 'formula', 'math', 'calculation', 'why prediction', 'why number', 'why this number', 'what does this mean', 'what does this stat mean', 'explain stats', 'explain metric', 'ppa dpr opr epa'],
    tool: 'statsWiki'
  },
  {
    id: 'workflow-data',
    kind: 'workflow',
    badge: 'Workflow',
    title: 'Data',
    description: 'Imports, evidence queue, raw audit, source freshness, scouts, sync, backup, and model trust.',
    keywords: ['data', 'data health', 'control room', 'maintenance', 'fix data', 'data problem', 'imports', 'raw audit', 'source freshness', 'sync status', 'model trust', 'scouts'],
    workflowKey: 'import'
  },
  {
    id: 'panel-collection',
    kind: 'panel',
    badge: 'Data Panel',
    title: 'Scout Evidence Queue',
    description: 'Scout work queue, evidence tasks, missing rows, and returned scout evidence.',
    keywords: ['collect', 'collect missing data', 'missed data', 'we missed data', 'missing data', 'missing team data', 'missing rows', 'missing scouting', 'missing evidence', 'evidence', 'scout task', 'scout tasks', 'scout work', 'what should scouts do', 'send scouts', 'return evidence', 'coverage', 'coverage warning', 'coverage warnings', 'coverage gap', 'coverage gaps'],
    workflowKey: 'import',
    panel: 'collection'
  },
  {
    id: 'panel-imports',
    kind: 'panel',
    badge: 'Data Panel',
    title: 'Imports',
    description: 'Upload TBA CSVs, local scout archives, QR rows, and other source files.',
    keywords: ['import', 'imports', 'upload', 'csv', 'tba csv', 'qr', 'scan', 'archive', 'load data', 'load schedule', 'upload schedule', 'upload results', 'upload file'],
    workflowKey: 'import',
    panel: 'imports'
  },
  {
    id: 'panel-audit',
    kind: 'panel',
    badge: 'Data Panel',
    title: 'Raw Data Audit',
    description: 'Review anomalies, duplicate rows, conflicts, and raw scouting data quality.',
    keywords: ['audit', 'raw audit', 'raw data', 'anomaly', 'anomalies', 'duplicate', 'duplicates', 'conflict', 'conflicts', 'review data', 'bad rows', 'bad data', 'bad scouting rows', 'bad numbers', 'suspicious numbers', 'numbers suspicious', 'what numbers are suspicious', 'number looks wrong', 'numbers look wrong', 'data looks wrong', 'wrong number', 'weird data', 'fix rows'],
    workflowKey: 'import',
    panel: 'audit'
  },
  {
    id: 'panel-sources',
    kind: 'panel',
    badge: 'Data Panel',
    title: 'Source Freshness',
    description: 'Official source status, freshness, TBA/FIRST source cache, and refresh health.',
    quickTitle: 'Check sources',
    quickDescription: 'Verify TBA/FIRST freshness, API source status, and refresh health.',
    keywords: ['source', 'sources', 'freshness', 'fresh', 'stale', 'tba stale', 'first fresh', 'refresh', 'refresh official data', 'refresh schedule', 'refresh matches', 'refresh rankings', 'tba', 'first', 'api', 'official data', 'official source', 'schedule source', 'latest schedule', 'latest results'],
    workflowKey: 'import',
    panel: 'sources'
  },
  {
    id: 'panel-models',
    kind: 'panel',
    badge: 'Data Panel',
    title: 'Model Trust',
    description: 'Proof that forecasts are safe to use: backtests, calibration, source/model health, and before-match inputs.',
    keywords: ['model trust', 'model', 'models', 'model health', 'model lab', 'validation', 'calibration', 'trust', 'prediction', 'prediction accuracy', 'prediction quality', 'why trust', 'can i trust', 'can i trust this prediction', 'forecast trust', 'before match inputs'],
    workflowKey: 'import',
    panel: 'models'
  },
  {
    id: 'panel-scouts',
    kind: 'panel',
    badge: 'Data Panel',
    title: 'Scouts',
    description: 'Numbered scout roster, team-focus plan, coverage gaps, PowerCoins, and scout rewards.',
    quickTitle: 'Assign scouts',
    quickDescription: 'Open team-focus planning, coverage gaps, scout rewards, and staffing checks.',
    keywords: ['scout', 'scouts', 'scout number', 'scout roster', 'who scouts next', 'which scout watches', 'which scout watches team', 'scout schedule', 'make scout schedule', 'scout assignment', 'scout assignments', 'team focus', 'focus team', 'focus plan', 'schedule split', 'schedule splitting', 'coverage gaps', 'assign scouts', 'assign team members', 'team member assignments', 'same teams', 'same teams per scout', 'repeat teams', 'scout continuity', 'continuity', 'maximize same teams', 'split matches', 'split schedule', 'powercoins', 'power coins', 'rewards'],
    workflowKey: 'import',
    panel: 'scouts'
  },
  {
    id: 'panel-backup',
    kind: 'panel',
    badge: 'Data Panel',
    title: 'Sync And Backup',
    description: 'Local cache, full backup, restore, sync status, and unsynced row review.',
    keywords: ['sync backup', 'sync', 'backup', 'restore', 'cache', 'local cache', 'browser cache', 'unsynced', 'offline', 'offline rows', 'offline data', 'local data', 'save data', 'handoff computer', 'computer handoff', 'move computer', 'new laptop'],
    workflowKey: 'import',
    panel: 'backup'
  },
  {
    id: 'workflow-reports',
    kind: 'workflow',
    badge: 'Workflow',
    title: 'Reports',
    description: 'Excel export, model proof, and demo-ready outputs.',
    quickTitle: 'Open demo proof',
    quickDescription: 'Open Excel export and model/demo report packs.',
    keywords: ['reports', 'report', 'excel', 'export', 'download', 'judge', 'judges', 'judges are here', 'mentor is here', 'mentors are here', 'judge packet', 'judge report', 'demo', 'presentation', 'spreadsheet', 'make spreadsheet', 'workbook', 'print', 'packet', 'need proof'],
    workflowKey: 'export'
  },
  {
    id: 'tool-settings',
    kind: 'tool',
    badge: 'Tool',
    title: 'Settings',
    description: 'Event key, own team, API keys, test mode, local credentials, and deployment status.',
    keywords: ['settings', 'gear', 'event key', 'change event key', 'own team', 'api key', 'api keys', 'api credentials', 'credential json', 'credentials', 'credentials upload', 'first credentials', 'first credentials upload', 'first events credentials', 'first events credential upload', 'tba key', 'tba api key', 'password', 'passphrase', 'name lock', 'scout lock', 'unlock scout name', 'test mode', 'firebase'],
    tool: 'settings'
  }
];

const DEFAULT_SMART_SEARCH_TARGET_IDS = [
  'workflow-now',
  'workflow-teams',
  'workflow-matches',
  'panel-scouts',
  'workflow-visualize',
  'tool-stats-wiki',
  'panel-sources',
  'workflow-reports'
];

const getSmartSearchQueryVariants = (query: string) => {
  const tokens = query.split(' ').filter(Boolean);
  const intentQuery = tokens.filter(token => !SMART_SEARCH_INTENT_WORDS.has(token)).join(' ');
  return Array.from(new Set([query, intentQuery].filter(Boolean)));
};

const scoreNormalizedTextMatch = (query: string, normalizedTexts: string[]) => {
  const tokens = query.split(' ').filter(Boolean);
  const combinedText = normalizedTexts.join(' ');

  if (normalizedTexts.some(text => text === query)) return { score: 100, label: 'Exact command' };
  if (normalizedTexts.some(text => text.startsWith(query))) return { score: 86, label: 'Starts with' };
  if (normalizedTexts.some(text => text.includes(query))) return { score: 76, label: 'Contains' };
  if (tokens.length > 0 && normalizedTexts.some(text => tokens.every(token => text.includes(token)))) {
    return { score: 68 - Math.max(0, tokens.length - 1), label: 'Keyword match' };
  }
  if (tokens.length > 1 && tokens.every(token => combinedText.includes(token))) {
    return { score: 62 - Math.max(0, tokens.length - 2), label: 'Keyword match' };
  }
  return { score: 0, label: 'Keyword' };
};

const scoreTextMatch = (query: string, targetTexts: string[]) => {
  const normalizedTexts = targetTexts
    .map(text => normalizeAdminV4TeamSearchText(text))
    .filter(Boolean);
  if (!query || normalizedTexts.length === 0) return { score: 0, label: 'Keyword' };
  return getSmartSearchQueryVariants(query)
    .map((variant, index) => {
      const match = scoreNormalizedTextMatch(variant, normalizedTexts);
      if (index === 0 || match.score <= 0) return match;
      return {
        score: Math.max(1, match.score - 1),
        label: 'Need match'
      };
    })
    .sort((left, right) => right.score - left.score)[0] || { score: 0, label: 'Keyword' };
};

const buildStaticResults = (query: string): AdminV4SmartSearchResult[] =>
  STATIC_TARGETS
    .map(target => {
      const match = scoreTextMatch(query, [target.title, target.description, ...target.keywords]);
      const scoutAssignmentWithTeamNumber =
        target.id === 'panel-scouts' && /\d/.test(query) && /\bscouts?\b/.test(query);
      const score = scoutAssignmentWithTeamNumber
        ? Math.max(match.score, 108)
        : match.score + (match.label === 'Exact command' ? 6 : 0);
      return {
        id: target.id,
        kind: target.kind,
        badge: target.badge,
        title: target.title,
        description: target.description,
        matchLabel: match.label,
        score,
        workflowKey: target.workflowKey,
        panel: target.panel,
        tool: target.tool
      };
    })
    .filter(result => result.score > 0);

const buildDefaultResults = (): AdminV4SmartSearchResult[] =>
  DEFAULT_SMART_SEARCH_TARGET_IDS
    .flatMap((targetId, index): AdminV4SmartSearchResult[] => {
      const target = STATIC_TARGETS.find(candidate => candidate.id === targetId);
      if (!target) return [];
      const result: AdminV4SmartSearchResult = {
        id: target.id,
        kind: target.kind,
        badge: target.badge,
        title: target.quickTitle || target.title,
        description: target.quickDescription || target.description,
        matchLabel: 'Quick need',
        score: 20 - index,
        workflowKey: target.workflowKey,
        panel: target.panel,
        tool: target.tool
      };
      return [result];
    });

const describeStatSearchResult = (info: AdminV4SmartSearchStatInfo) => {
  const definition = info.definition || 'Open the stat wiki entry for formula, source, interpretation, and limitations.';
  const whereAppears = (info.whereAppears || []).filter(Boolean);
  const whereText = whereAppears.length > 0 ? ` Appears in ${whereAppears.slice(0, 4).join(', ')}.` : '';
  return `${info.category}: ${definition}${whereText}`;
};

const buildStatResults = (
  query: string,
  statInfo: Record<string, AdminV4SmartSearchStatInfo>
): AdminV4SmartSearchResult[] =>
  Object.entries(statInfo)
    .map(([statKey, info]) => {
      const primaryMatch = scoreTextMatch(query, [
        statKey,
        info.title,
        info.category,
        info.definition || ''
      ]);
      const whereMatch = scoreTextMatch(query, info.whereAppears || []);
      const whereAppearsScore = whereMatch.score > 0 ? Math.min(whereMatch.score, 46) : 0;
      const match = primaryMatch.score >= whereAppearsScore
        ? primaryMatch
        : { score: whereAppearsScore, label: 'Appears in' };
      return {
        id: `stat-${statKey}`,
        kind: 'stat' as const,
        badge: 'Stat Help',
        title: info.title,
        description: describeStatSearchResult(info),
        matchLabel: match.label,
        score: match.score + (match.score > 0 ? 4 : 0),
        statKey
      };
    })
    .filter(result => result.score > 0);

export const getAdminV4SmartSearchSuggestions = ({
  rawInput,
  teamNumbers,
  teamNameLookup,
  statInfo,
  limit = 8
}: {
  rawInput: string;
  teamNumbers: string[];
  teamNameLookup: Record<string, string>;
  statInfo: Record<string, AdminV4SmartSearchStatInfo>;
  limit?: number;
}): AdminV4SmartSearchResult[] => {
  const submittedInput = rawInput.trim();
  if (!submittedInput) return buildDefaultResults().slice(0, limit);
  const query = normalizeAdminV4TeamSearchText(submittedInput);
  const teamResultsByNumber = new Map<string, AdminV4SmartSearchResult>();
  [submittedInput, ...getSmartSearchQueryVariants(query)]
    .filter((candidate, index, inputs) => candidate && inputs.indexOf(candidate) === index)
    .forEach((candidate, index) => {
      getAdminV4TeamSearchSuggestions({
        rawInput: candidate,
        teamNumbers,
        teamNameLookup,
        limit
      }).forEach(team => {
        const score = team.score + 2 - Math.min(index, 2);
        const result = {
          id: `team-${team.teamNumber}`,
          kind: 'team' as const,
          badge: 'Team',
          title: `Team ${team.teamNumber}${team.teamName ? ` - ${team.teamName}` : ''}`,
          description: 'Open the team profile, stats, notes, trend, and match history.',
          matchLabel: index === 0 ? team.matchLabel : 'Need match',
          score,
          teamNumber: team.teamNumber,
          teamName: team.teamName
        };
        const existing = teamResultsByNumber.get(team.teamNumber);
        if (!existing || existing.score < result.score) {
          teamResultsByNumber.set(team.teamNumber, result);
        }
      });
    });
  const teamResults = Array.from(teamResultsByNumber.values());

  return [
    ...teamResults,
    ...buildStaticResults(query),
    ...buildStatResults(query, statInfo)
  ]
    .sort((left, right) =>
      right.score - left.score ||
      left.kind.localeCompare(right.kind) ||
      left.title.localeCompare(right.title)
    )
    .slice(0, limit);
};
