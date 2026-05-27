import { ScoutingMissionKey } from './scoutingWorkflow';
import { ScoutEvidenceAdminTask } from '../types';

export const SCOUT_TASK_HANDOFF_STORAGE_KEY = 'rebuilt_scout_task_handoff';

export type ScoutTaskMatchType = 'Practice' | 'Qualification';
export type ScoutTaskAlliance = 'Red' | 'Blue';

export interface ScoutTaskPpaContext {
  expected?: number | null;
  floor?: number | null;
  ceiling?: number | null;
  normalLow?: number | null;
  normalHigh?: number | null;
  role?: string;
  uncertainty?: string;
  tailRisk?: string;
  scoutConfidence?: number | null;
  coverage?: string;
  model?: string;
  warnings?: string[];
  asks?: string[];
}

export interface ScoutTaskHandoff {
  missionKey: ScoutingMissionKey;
  teamNumber: string;
  teamName?: string;
  eventKey?: string;
  matchKey?: string;
  matchType?: ScoutTaskMatchType;
  matchNumber?: number;
  alliance?: ScoutTaskAlliance;
  reason?: string;
  detail?: string;
  context?: string;
  returnTo?: string;
  returnLabel?: string;
  ppa?: ScoutTaskPpaContext;
  createdAt: number;
  source: 'adminv4';
}

export interface ScoutEvidenceAdminTaskExportFields {
  adminTaskSource: string;
  adminTaskMission: string;
  adminTaskTeam: string;
  adminTaskMatch: string;
  adminTaskReason: string;
  adminTaskContext: string;
  adminTaskDetail: string;
  adminTaskPpaRange: string;
  adminTaskPpaExpected: number | string;
  adminTaskPpaFloor: number | string;
  adminTaskPpaCeiling: number | string;
  adminTaskPpaNormalLow: number | string;
  adminTaskPpaNormalHigh: number | string;
  adminTaskPpaRole: string;
  adminTaskPpaUncertainty: string;
  adminTaskPpaTailRisk: string;
  adminTaskPpaScoutConfidence: number | string;
  adminTaskPpaCoverage: string;
  adminTaskPpaModel: string;
  adminTaskPpaAsks: string;
  adminTaskPpaWarnings: string;
  adminTaskCreatedAt: string;
  adminTaskCapturedAt: string;
}

export interface ScoutEvidenceDecisionUse {
  title: string;
  summary: string;
  modelEffect: string;
  feeds: string[];
}

const HANDOFF_MAX_AGE_MS = 30 * 60 * 1000;

const sanitizeTeamNumber = (value: string | null | undefined) => (value || '').replace(/\D/g, '');
const sanitizeEventKey = (value: string | null | undefined) => (value || '').trim().toUpperCase();
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const ppaNumberOrBlank = (value: number | null | undefined) => isFiniteNumber(value) ? value : '';
const formatPpaNumber = (value: number | null | undefined) => isFiniteNumber(value) ? value.toFixed(1) : '';
const formatTimestamp = (value: number | null | undefined) => isFiniteNumber(value) ? new Date(value).toISOString() : '';

const SCOUT_TASK_MISSION_LABELS: Record<string, string> = {
  preScout: 'Pre Scout',
  pitScout: 'Pit Scout',
  matchScout: 'Match Scout',
  defenseScout: 'Defense Scout'
};

const normalizeMatchType = (value: string | null | undefined): ScoutTaskMatchType | undefined => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'practice' || normalized === 'pr') return 'Practice';
  if (normalized === 'qualification' || normalized === 'qual' || normalized === 'qm') return 'Qualification';
  return undefined;
};

const normalizeAlliance = (value: string | null | undefined): ScoutTaskAlliance | undefined => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'red') return 'Red';
  if (normalized === 'blue') return 'Blue';
  return undefined;
};

const parseMatchNumber = (value: string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
};

const parseFiniteNumber = (value: string | null | undefined): number | null => {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeScoutTaskReturnPath = (value: string | null | undefined) => {
  const rawValue = (value || '').trim();
  if (!rawValue || !rawValue.startsWith('/') || rawValue.startsWith('//')) return '';

  try {
    const parsedUrl = new URL(rawValue, 'https://rebuilt.local');
    if (parsedUrl.origin !== 'https://rebuilt.local') return '';
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    return '';
  }
};

export const getScoutTaskReturnPath = (
  handoff: ScoutTaskHandoff | null | undefined,
  fallback = '/'
) => normalizeScoutTaskReturnPath(handoff?.returnTo) || fallback;

const cleanStringList = (values: Array<string | null | undefined> | undefined) =>
  (values || [])
    .map(value => (value || '').trim())
    .filter(Boolean)
    .slice(0, 5);

const normalizePpaContext = (value: unknown): ScoutTaskPpaContext | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<ScoutTaskPpaContext>;
  const context: ScoutTaskPpaContext = {
    expected: typeof raw.expected === 'number' && Number.isFinite(raw.expected) ? raw.expected : null,
    floor: typeof raw.floor === 'number' && Number.isFinite(raw.floor) ? raw.floor : null,
    ceiling: typeof raw.ceiling === 'number' && Number.isFinite(raw.ceiling) ? raw.ceiling : null,
    normalLow: typeof raw.normalLow === 'number' && Number.isFinite(raw.normalLow) ? raw.normalLow : null,
    normalHigh: typeof raw.normalHigh === 'number' && Number.isFinite(raw.normalHigh) ? raw.normalHigh : null,
    scoutConfidence: typeof raw.scoutConfidence === 'number' && Number.isFinite(raw.scoutConfidence) ? raw.scoutConfidence : null,
    role: raw.role || '',
    uncertainty: raw.uncertainty || '',
    tailRisk: raw.tailRisk || '',
    coverage: raw.coverage || '',
    model: raw.model || '',
    warnings: cleanStringList(raw.warnings),
    asks: cleanStringList(raw.asks)
  };
  const hasContext =
    context.expected != null ||
    context.floor != null ||
    context.ceiling != null ||
    Boolean(context.role || context.uncertainty || context.tailRisk || context.coverage || context.model || context.warnings?.length || context.asks?.length);
  return hasContext ? context : undefined;
};

export const saveScoutTaskHandoff = (handoff: ScoutTaskHandoff) => {
  try {
    window.localStorage.setItem(SCOUT_TASK_HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
  } catch (error) {
    console.warn('Unable to save scout task handoff', error);
  }
};

export const clearScoutTaskHandoff = (missionKey?: ScoutingMissionKey) => {
  try {
    if (!missionKey) {
      window.localStorage.removeItem(SCOUT_TASK_HANDOFF_STORAGE_KEY);
      return;
    }
    const raw = window.localStorage.getItem(SCOUT_TASK_HANDOFF_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<ScoutTaskHandoff>;
    if (parsed?.missionKey === missionKey) {
      window.localStorage.removeItem(SCOUT_TASK_HANDOFF_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Unable to clear scout task handoff', error);
  }
};

export const loadScoutTaskHandoff = (missionKey?: ScoutingMissionKey): ScoutTaskHandoff | null => {
  try {
    const raw = window.localStorage.getItem(SCOUT_TASK_HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScoutTaskHandoff>;
    if (!parsed || !parsed.teamNumber || !parsed.missionKey || parsed.source !== 'adminv4') return null;
    if (missionKey && parsed.missionKey !== missionKey) return null;
    if (typeof parsed.createdAt !== 'number' || Date.now() - parsed.createdAt > HANDOFF_MAX_AGE_MS) return null;
    return {
      missionKey: parsed.missionKey,
      teamNumber: sanitizeTeamNumber(parsed.teamNumber),
      teamName: parsed.teamName || '',
      eventKey: sanitizeEventKey(parsed.eventKey),
      matchKey: parsed.matchKey || '',
      matchType: normalizeMatchType(parsed.matchType),
      matchNumber: parsed.matchNumber,
      alliance: normalizeAlliance(parsed.alliance),
      reason: parsed.reason || '',
      detail: parsed.detail || '',
      context: parsed.context || '',
      returnTo: normalizeScoutTaskReturnPath(parsed.returnTo),
      returnLabel: parsed.returnLabel || '',
      ppa: normalizePpaContext(parsed.ppa),
      createdAt: parsed.createdAt,
      source: 'adminv4'
    };
  } catch (error) {
    console.warn('Unable to load scout task handoff', error);
    return null;
  }
};

export const scoutTaskHandoffFromSearch = (
  search: string,
  missionKey: ScoutingMissionKey
): ScoutTaskHandoff | null => {
  const params = new URLSearchParams(search);
  const teamNumber = sanitizeTeamNumber(params.get('team'));
  if (!teamNumber) return null;
  const ppa = normalizePpaContext({
    expected: parseFiniteNumber(params.get('ppaExpected')),
    floor: parseFiniteNumber(params.get('ppaFloor')),
    ceiling: parseFiniteNumber(params.get('ppaCeiling')),
    normalLow: parseFiniteNumber(params.get('ppaNormalLow')),
    normalHigh: parseFiniteNumber(params.get('ppaNormalHigh')),
    role: params.get('ppaRole') || '',
    uncertainty: params.get('ppaUncertainty') || '',
    tailRisk: params.get('ppaTailRisk') || '',
    scoutConfidence: parseFiniteNumber(params.get('ppaScoutConfidence')),
    coverage: params.get('ppaCoverage') || '',
    model: params.get('ppaModel') || '',
    warnings: params.getAll('ppaWarning'),
    asks: params.getAll('ask')
  });
  return {
    missionKey,
    teamNumber,
    teamName: params.get('name') || '',
    eventKey: sanitizeEventKey(params.get('event')),
    matchKey: params.get('match') || '',
    matchType: normalizeMatchType(params.get('matchType')),
    matchNumber: parseMatchNumber(params.get('matchNumber')),
    alliance: normalizeAlliance(params.get('alliance')),
    reason: params.get('reason') || '',
    detail: params.get('detail') || '',
    context: params.get('context') || '',
    returnTo: normalizeScoutTaskReturnPath(params.get('returnTo')),
    returnLabel: params.get('returnLabel') || '',
    ppa,
    createdAt: Date.now(),
    source: 'adminv4'
  };
};

export const getScoutTaskHandoff = (
  missionKey: ScoutingMissionKey,
  search: string
): ScoutTaskHandoff | null => {
  const searchHandoff = scoutTaskHandoffFromSearch(search, missionKey);
  if (searchHandoff) {
    saveScoutTaskHandoff(searchHandoff);
    return searchHandoff;
  }
  return loadScoutTaskHandoff(missionKey);
};

export const buildScoutTaskHandoffPath = (route: string, handoff: ScoutTaskHandoff) => {
  const params = new URLSearchParams();
  params.set('team', handoff.teamNumber);
  if (handoff.teamName) params.set('name', handoff.teamName);
  if (handoff.eventKey) params.set('event', handoff.eventKey);
  if (handoff.matchKey) params.set('match', handoff.matchKey);
  if (handoff.matchType) params.set('matchType', handoff.matchType);
  if (handoff.matchNumber) params.set('matchNumber', String(handoff.matchNumber));
  if (handoff.alliance) params.set('alliance', handoff.alliance);
  if (handoff.reason) params.set('reason', handoff.reason);
  if (handoff.detail) params.set('detail', handoff.detail);
  if (handoff.context) params.set('context', handoff.context);
  const returnTo = normalizeScoutTaskReturnPath(handoff.returnTo);
  if (returnTo) params.set('returnTo', returnTo);
  if (handoff.returnLabel) params.set('returnLabel', handoff.returnLabel);
  if (handoff.ppa) {
    if (handoff.ppa.expected != null) params.set('ppaExpected', String(handoff.ppa.expected));
    if (handoff.ppa.floor != null) params.set('ppaFloor', String(handoff.ppa.floor));
    if (handoff.ppa.ceiling != null) params.set('ppaCeiling', String(handoff.ppa.ceiling));
    if (handoff.ppa.normalLow != null) params.set('ppaNormalLow', String(handoff.ppa.normalLow));
    if (handoff.ppa.normalHigh != null) params.set('ppaNormalHigh', String(handoff.ppa.normalHigh));
    if (handoff.ppa.role) params.set('ppaRole', handoff.ppa.role);
    if (handoff.ppa.uncertainty) params.set('ppaUncertainty', handoff.ppa.uncertainty);
    if (handoff.ppa.tailRisk) params.set('ppaTailRisk', handoff.ppa.tailRisk);
    if (handoff.ppa.scoutConfidence != null) params.set('ppaScoutConfidence', String(handoff.ppa.scoutConfidence));
    if (handoff.ppa.coverage) params.set('ppaCoverage', handoff.ppa.coverage);
    if (handoff.ppa.model) params.set('ppaModel', handoff.ppa.model);
    cleanStringList(handoff.ppa.warnings).forEach(warning => params.append('ppaWarning', warning));
    cleanStringList(handoff.ppa.asks).forEach(ask => params.append('ask', ask));
  }
  return `${route}?${params.toString()}`;
};

export const buildScoutEvidenceAdminTask = (
  handoff: ScoutTaskHandoff | null | undefined
): ScoutEvidenceAdminTask | undefined => {
  if (!handoff?.teamNumber) return undefined;
  return {
    source: 'adminv4',
    missionKey: handoff.missionKey,
    teamNumber: handoff.teamNumber,
    teamName: handoff.teamName || '',
    eventKey: handoff.eventKey || '',
    matchKey: handoff.matchKey || '',
    matchType: handoff.matchType || '',
    matchNumber: handoff.matchNumber,
    alliance: handoff.alliance || '',
    reason: handoff.reason || '',
    detail: handoff.detail || '',
    context: handoff.context || '',
    createdAt: handoff.createdAt,
    capturedAt: Date.now(),
    ppa: handoff.ppa
      ? {
          expected: handoff.ppa.expected ?? null,
          floor: handoff.ppa.floor ?? null,
          ceiling: handoff.ppa.ceiling ?? null,
          normalLow: handoff.ppa.normalLow ?? null,
          normalHigh: handoff.ppa.normalHigh ?? null,
          role: handoff.ppa.role || '',
          uncertainty: handoff.ppa.uncertainty || '',
          tailRisk: handoff.ppa.tailRisk || '',
          scoutConfidence: handoff.ppa.scoutConfidence ?? null,
          coverage: handoff.ppa.coverage || '',
          model: handoff.ppa.model || '',
          warnings: cleanStringList(handoff.ppa.warnings),
          asks: cleanStringList(handoff.ppa.asks)
        }
      : undefined
  };
};

export const getScoutEvidenceAdminTaskFromPayload = (payload: unknown): ScoutEvidenceAdminTask | undefined => {
  if (!payload || typeof payload !== 'object') return undefined;
  const task = (payload as { adminTask?: ScoutEvidenceAdminTask }).adminTask;
  return task?.source === 'adminv4' ? task : undefined;
};

export const formatScoutEvidenceAdminTaskMission = (taskOrMissionKey?: ScoutEvidenceAdminTask | string | null) => {
  const missionKey = typeof taskOrMissionKey === 'string' ? taskOrMissionKey : taskOrMissionKey?.missionKey;
  if (!missionKey) return '';
  return SCOUT_TASK_MISSION_LABELS[missionKey] || missionKey;
};

export const formatScoutEvidenceAdminTaskPpaRange = (task?: ScoutEvidenceAdminTask | null) => {
  const ppa = task?.ppa;
  if (!ppa) return '';
  const range = [formatPpaNumber(ppa.floor), formatPpaNumber(ppa.expected), formatPpaNumber(ppa.ceiling)].filter(Boolean);
  return range.length > 0 ? range.join(' / ') : '';
};

export const describeScoutEvidenceAdminTaskDecisionUse = (
  task?: ScoutEvidenceAdminTask | null
): ScoutEvidenceDecisionUse | null => {
  if (!task?.source) return null;
  const roleText = task.ppa?.role ? ` The assignment expected a ${task.ppa.role.toLowerCase()} read.` : '';

  switch (task.missionKey) {
    case 'preScout':
      return {
        title: 'Public Context Returned',
        summary: `Feeds early team context and tells pit or match scouts what still needs human verification.${roleText}`,
        modelEffect: 'Improves coverage labels and prevents PPA from leaning on public/model fallback without a visible evidence trail.',
        feeds: ['Data', 'Teams', 'Pick List', 'Reports']
      };
    case 'pitScout':
      return {
        title: 'Capability Prior Returned',
        summary: `Feeds claimed mechanisms, role fit, compatibility, and questions future match scouts should verify.${roleText}`,
        modelEffect: 'Adds a human prior beside the PPA range so alliance selection can separate likely role fit from thin match data.',
        feeds: ['Teams', 'Matches', 'Pick List', 'Reports']
      };
    case 'matchScout':
      return {
        title: 'Match Evidence Returned',
        summary: `Feeds actual scoring, repeatability, role, reliability, and notes for this robot.${roleText}`,
        modelEffect: 'Updates PPA expected value, floor, ceiling, volatility, scout confidence, and future-match forecasts.',
        feeds: ['Now', 'Teams', 'Matches', 'Pick List', 'Visualize']
      };
    case 'defenseScout':
      return {
        title: 'Defense Evidence Returned',
        summary: `Feeds whether this robot denied output, forced errors, or sacrificed scoring for strategy.${roleText}`,
        modelEffect: 'Protects PPA from mistaking useful defense or support work for weak offense and improves role suggestions.',
        feeds: ['Now', 'Teams', 'Matches', 'Pick List', 'Reports']
      };
    default:
      return {
        title: 'Admin Evidence Returned',
        summary: 'Feeds the Admin V4 evidence chain for this team.',
        modelEffect: 'Keeps the raw row connected to the scouting task that produced it.',
        feeds: ['Data', 'Teams', 'Reports']
      };
  }
};

export const flattenScoutEvidenceAdminTaskForExport = (
  task?: ScoutEvidenceAdminTask | null
): ScoutEvidenceAdminTaskExportFields => {
  const ppa = task?.ppa;
  return {
    adminTaskSource: task?.source || '',
    adminTaskMission: formatScoutEvidenceAdminTaskMission(task),
    adminTaskTeam: task?.teamNumber ? `Team ${task.teamNumber}${task.teamName ? ` ${task.teamName}` : ''}` : '',
    adminTaskMatch: task?.matchKey || (task?.matchNumber ? `${task.matchType || 'Match'} ${task.matchNumber}` : ''),
    adminTaskReason: task?.reason || '',
    adminTaskContext: task?.context || '',
    adminTaskDetail: task?.detail || '',
    adminTaskPpaRange: formatScoutEvidenceAdminTaskPpaRange(task),
    adminTaskPpaExpected: ppaNumberOrBlank(ppa?.expected),
    adminTaskPpaFloor: ppaNumberOrBlank(ppa?.floor),
    adminTaskPpaCeiling: ppaNumberOrBlank(ppa?.ceiling),
    adminTaskPpaNormalLow: ppaNumberOrBlank(ppa?.normalLow),
    adminTaskPpaNormalHigh: ppaNumberOrBlank(ppa?.normalHigh),
    adminTaskPpaRole: ppa?.role || '',
    adminTaskPpaUncertainty: ppa?.uncertainty || '',
    adminTaskPpaTailRisk: ppa?.tailRisk || '',
    adminTaskPpaScoutConfidence: ppaNumberOrBlank(ppa?.scoutConfidence),
    adminTaskPpaCoverage: ppa?.coverage || '',
    adminTaskPpaModel: ppa?.model || '',
    adminTaskPpaAsks: cleanStringList(ppa?.asks).join(' | '),
    adminTaskPpaWarnings: cleanStringList(ppa?.warnings).join(' | '),
    adminTaskCreatedAt: formatTimestamp(task?.createdAt),
    adminTaskCapturedAt: formatTimestamp(task?.capturedAt)
  };
};
