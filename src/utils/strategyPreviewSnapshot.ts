import type {
  MatchScoutingV3Alliance,
  MatchScoutingV3MatchType,
  StrategyMatchPlan
} from '../types';
import type { ShiftStrategyTeamInput } from './shiftStrategyEngine';

export const STRATEGY_PREVIEW_STORAGE_KEY = 'powerscout.strategyPreview.snapshot.v1';

export type StrategyPreviewSnapshotSource = 'admin-v4-local-plan' | 'fallback-demo';

export interface StrategyPreviewSnapshot {
  schemaVersion: 1;
  source: StrategyPreviewSnapshotSource;
  savedAt: number;
  eventKey: string;
  matchKey: string;
  matchNumber: number;
  matchType: MatchScoutingV3MatchType;
  compLevel: string;
  modelName: string;
  modelSource: string;
  ourAlliance: MatchScoutingV3Alliance;
  firstShiftAlliance: MatchScoutingV3Alliance;
  redTeams: ShiftStrategyTeamInput[];
  blueTeams: ShiftStrategyTeamInput[];
}

export interface StrategyPreviewSnapshotResolution {
  snapshot: StrategyPreviewSnapshot;
  loadedFromStorage: boolean;
  fallbackReason: string | null;
}

export interface StrategyPreviewSnapshotLoadOptions {
  expectedEventKey?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isAlliance = (value: unknown): value is MatchScoutingV3Alliance =>
  value === 'Red' || value === 'Blue';

const normalizeMatchType = (value: unknown): MatchScoutingV3MatchType =>
  value === 'Practice' || value === 'Qualification'
    ? value
    : 'Qualification';

const finiteNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeEventKey = (value: unknown) => String(value || '').trim().toLowerCase();

const normalizeTeamInput = (value: unknown): ShiftStrategyTeamInput | null => {
  if (!isRecord(value)) return null;
  const teamNumber = String(value.teamNumber || '').trim();
  if (!teamNumber) return null;
  return {
    teamNumber,
    contribution: Math.max(0, finiteNumber(value.contribution)),
    contributionDeviation: Math.max(0, finiteNumber(value.contributionDeviation)),
    defense: Math.max(0, finiteNumber(value.defense)),
    defenseDeviation: Math.max(0, finiteNumber(value.defenseDeviation)),
    traversal: Math.max(0, finiteNumber(value.traversal)),
    traversalDeviation: Math.max(0, finiteNumber(value.traversalDeviation))
  };
};

export const buildFallbackStrategyPreviewSnapshot = (savedAt = Date.now()): StrategyPreviewSnapshot => ({
  schemaVersion: 1,
  source: 'fallback-demo',
  savedAt,
  eventKey: 'demo',
  matchKey: 'demo_next_match',
  matchNumber: 1,
  matchType: 'Qualification',
  compLevel: 'qm',
  modelName: 'Fallback demo fixture',
  modelSource: 'No Admin V4 local strategy snapshot was available on this browser.',
  ourAlliance: 'Blue',
  firstShiftAlliance: 'Red',
  redTeams: [
    { teamNumber: '254', contribution: 82, contributionDeviation: 11, defense: 24, defenseDeviation: 7, traversal: 8, traversalDeviation: 3 },
    { teamNumber: '1678', contribution: 64, contributionDeviation: 14, defense: 19, defenseDeviation: 8, traversal: 6, traversalDeviation: 4 },
    { teamNumber: '971', contribution: 48, contributionDeviation: 18, defense: 58, defenseDeviation: 12, traversal: 5, traversalDeviation: 4 }
  ],
  blueTeams: [
    { teamNumber: '1323', contribution: 78, contributionDeviation: 13, defense: 21, defenseDeviation: 8, traversal: 7, traversalDeviation: 3 },
    { teamNumber: '4414', contribution: 58, contributionDeviation: 15, defense: 27, defenseDeviation: 9, traversal: 5, traversalDeviation: 4 },
    { teamNumber: '5940', contribution: 43, contributionDeviation: 16, defense: 52, defenseDeviation: 12, traversal: 4, traversalDeviation: 4 }
  ]
});

export const parseStrategyPreviewSnapshot = (raw: unknown): StrategyPreviewSnapshot | null => {
  if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
  const redTeams = Array.isArray(raw.redTeams)
    ? raw.redTeams.map(normalizeTeamInput).filter((team): team is ShiftStrategyTeamInput => Boolean(team))
    : [];
  const blueTeams = Array.isArray(raw.blueTeams)
    ? raw.blueTeams.map(normalizeTeamInput).filter((team): team is ShiftStrategyTeamInput => Boolean(team))
    : [];
  if (redTeams.length === 0 || blueTeams.length === 0) return null;
  if (!isAlliance(raw.ourAlliance) || !isAlliance(raw.firstShiftAlliance)) return null;

  return {
    schemaVersion: 1,
    source: raw.source === 'admin-v4-local-plan' ? 'admin-v4-local-plan' : 'fallback-demo',
    savedAt: finiteNumber(raw.savedAt, Date.now()),
    eventKey: String(raw.eventKey || ''),
    matchKey: String(raw.matchKey || 'unknown_match'),
    matchNumber: Math.max(0, finiteNumber(raw.matchNumber)),
    matchType: normalizeMatchType(raw.matchType),
    compLevel: String(raw.compLevel || ''),
    modelName: String(raw.modelName || 'Unknown model'),
    modelSource: String(raw.modelSource || ''),
    ourAlliance: raw.ourAlliance,
    firstShiftAlliance: raw.firstShiftAlliance,
    redTeams,
    blueTeams
  };
};

export const loadStrategyPreviewSnapshot = (
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof window === 'undefined' ? null : window.localStorage,
  options: StrategyPreviewSnapshotLoadOptions = {}
): StrategyPreviewSnapshotResolution => {
  if (!storage) {
    return {
      snapshot: buildFallbackStrategyPreviewSnapshot(),
      loadedFromStorage: false,
      fallbackReason: 'Browser storage is unavailable.'
    };
  }

  try {
    const raw = storage.getItem(STRATEGY_PREVIEW_STORAGE_KEY);
    if (!raw) {
      return {
        snapshot: buildFallbackStrategyPreviewSnapshot(),
        loadedFromStorage: false,
        fallbackReason: 'No Admin V4 strategy snapshot has been published on this browser yet.'
      };
    }
    const parsed = parseStrategyPreviewSnapshot(JSON.parse(raw));
    if (!parsed) {
      return {
        snapshot: buildFallbackStrategyPreviewSnapshot(),
        loadedFromStorage: false,
        fallbackReason: 'The saved Admin V4 strategy snapshot was unreadable.'
      };
    }
    const expectedEventKey = normalizeEventKey(options.expectedEventKey);
    const parsedEventKey = normalizeEventKey(parsed.eventKey);
    if (parsed.source === 'admin-v4-local-plan' && expectedEventKey && parsedEventKey !== expectedEventKey) {
      return {
        snapshot: buildFallbackStrategyPreviewSnapshot(),
        loadedFromStorage: false,
        fallbackReason: `The saved Admin V4 strategy snapshot was for ${parsed.eventKey || 'another event'}, not ${options.expectedEventKey}. Open Admin V4 Matches for the current event to publish a fresh plan.`
      };
    }
    return { snapshot: parsed, loadedFromStorage: true, fallbackReason: null };
  } catch {
    return {
      snapshot: buildFallbackStrategyPreviewSnapshot(),
      loadedFromStorage: false,
      fallbackReason: 'The saved Admin V4 strategy snapshot could not be parsed.'
    };
  }
};

export const saveStrategyPreviewSnapshot = (
  snapshot: StrategyPreviewSnapshot,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof window === 'undefined' ? null : window.localStorage
) => {
  if (!storage) return false;
  storage.setItem(STRATEGY_PREVIEW_STORAGE_KEY, JSON.stringify(snapshot));
  return true;
};

export const clearStrategyPreviewSnapshot = (
  storage: Pick<Storage, 'removeItem'> | null | undefined = typeof window === 'undefined' ? null : window.localStorage
) => {
  if (!storage) return false;
  storage.removeItem(STRATEGY_PREVIEW_STORAGE_KEY);
  return true;
};

export const buildStrategyPreviewSnapshotFromPlan = (
  plan: StrategyMatchPlan,
  options: {
    eventKey: string;
    ownTeamNumber?: string;
    ratings: Record<string, number>;
    defenseImpactLookup: Record<string, number>;
    deviationLookup: Record<string, { contributionDeviation?: number; defenseDeviation?: number }>;
    savedAt?: number;
  }
): StrategyPreviewSnapshot => {
  const buildTeamInputs = (teams: string[], baselineScore: number) =>
    teams.map(teamNumber => {
      const fallbackContribution = baselineScore / Math.max(1, teams.length);
      const deviation = options.deviationLookup[teamNumber] || {};
      return {
        teamNumber,
        contribution: Math.max(0, finiteNumber(options.ratings[teamNumber], fallbackContribution)),
        contributionDeviation: Math.max(0, finiteNumber(deviation.contributionDeviation)),
        defense: Math.max(0, finiteNumber(options.defenseImpactLookup[teamNumber])),
        defenseDeviation: Math.max(0, finiteNumber(deviation.defenseDeviation))
      };
    });

  const ownTeamNumber = (options.ownTeamNumber || '').trim();
  const ourAlliance: MatchScoutingV3Alliance = ownTeamNumber && plan.redTeams.includes(ownTeamNumber)
    ? 'Red'
    : ownTeamNumber && plan.blueTeams.includes(ownTeamNumber)
      ? 'Blue'
      : plan.predictedWinner === 'Red' || plan.predictedWinner === 'Blue'
        ? plan.predictedWinner
        : 'Red';

  return {
    schemaVersion: 1,
    source: 'admin-v4-local-plan',
    savedAt: options.savedAt ?? Date.now(),
    eventKey: options.eventKey,
    matchKey: plan.matchKey,
    matchNumber: plan.matchNumber,
    matchType: plan.matchType,
    compLevel: plan.compLevel,
    modelName: plan.modelName,
    modelSource: plan.modelSource,
    ourAlliance,
    firstShiftAlliance: plan.baselineRedScore >= plan.baselineBlueScore ? 'Red' : 'Blue',
    redTeams: buildTeamInputs(plan.redTeams, plan.baselineRedScore),
    blueTeams: buildTeamInputs(plan.blueTeams, plan.baselineBlueScore)
  };
};
