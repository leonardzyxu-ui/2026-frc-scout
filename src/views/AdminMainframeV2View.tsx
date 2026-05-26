import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronLeft,
  Database,
  Download,
  Edit3,
  Gauge,
  Home,
  Info,
  ListChecks,
  RefreshCw,
  Search,
  Settings,
  Swords,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  X
} from 'lucide-react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { db } from '../firebase';
import {
  AlliancePickRecommendation,
  MatchDefenseScoutingV1,
  MatchScoutingV2,
  MatchScoutingV3,
  MatchScoutingV4,
  ModelFeatureSnapshot,
  ModelLabSnapshot,
  PowerCoinBet,
  PowerCoinLedgerEntry,
  PreMatchTeamProfile,
  ScoutAssignmentPlan,
  StrategyAllianceRpPath,
  StrategyMatchPlan,
  TeamPerformanceProfile
} from '../types';
import { TBA_API_KEY } from '../config';
import { calculateLegacyDprRatings, calculateLegacyOprRatings, calculateLegacyOprcRatings, MathEngine, TBAMatch } from '../utils/mathEngine';
import QRScannerView from './QRScannerView';
import PreMatchView from './PreMatchView';
import {
  buildHistoricalAverageLookup,
  buildPredictedMatchesFromRatings,
  buildPredictedMatchesV3,
  buildTeamDefenseMetrics,
  buildTeamHistoricalAveragesV4Aware
} from '../utils/adminV2Analytics';
import {
  buildCompletedMatchComparisons,
  buildPlayoffProjection,
  buildQualificationProjection,
  PredictedMatchRow,
  ProjectedQualificationTeamRow,
  TBAEliminationAlliance,
  TBAEventSummary
} from '../utils/matchPredictor';
import { fetchEventStatboticsEpa, StatboticsNormalizedTeamEpa } from '../utils/statbotics';
import {
  getPreferredUploadedSchedule,
  getUploadedTeamNameLookup,
  importUploadedTbaCsvFiles,
  loadUploadedTbaCsvPack,
  saveUploadedTbaCsvPack,
  UploadedTbaCsvImportMessage,
  UploadedTbaCsvPack
} from '../utils/adminV2TbaCsv';
import {
  AdminV2SelectedMetric,
  AdminV2Settings,
  loadAdminV2Settings,
  saveAdminV2Settings
} from '../utils/adminV2Settings';
import {
  AdminV2CacheEntry,
  FirstEventsCredentials,
  clearTbaApiKey,
  clearFirstEventsCredentials,
  getPowerCoinBalance,
  listAdminV2CacheEntries,
  listModelFeatureSnapshots,
  listPowerCoinBets,
  listPowerCoinLedger,
  listModelLabSnapshots,
  loadFirstEventsCredentials,
  loadLatestModelFeatureSnapshot,
  loadLatestModelLabSnapshot,
  loadLatestScoutAssignmentPlan,
  loadTbaApiKey,
  putAdminV2CacheEntry,
  restoreAdminV2CacheEntries,
  saveFirstEventsCredentials,
  saveModelFeatureSnapshot,
  saveModelLabSnapshot,
  saveScoutAssignmentPlan,
  saveTbaApiKey,
  settlePowerCoinBetsForMatch,
  upsertPowerCoinBet,
  upsertPowerCoinLedgerEntry
} from '../utils/adminV2LocalStore';
import {
  buildScoutArchiveBundle,
  getScoutArchiveUsername,
  importScoutArchiveBundleLocally,
  isScoutArchiveBundle,
  listScoutArchiveRecords,
  ScoutArchiveRecord,
  ScoutArchiveBundle
} from '../utils/scoutArchive';
import { syncScoutArchiveRecordToFirebase } from '../utils/scoutArchiveSync';
import {
  convertFirstEventsPayloadsToTbaMatches,
  convertFirstRankingsPayloadToTbaRankings,
  convertFirstTeamsPayloadToTeamNames,
  fetchAndCacheFirstEventBundle,
  getYearFromEventKey
} from '../utils/firstEventsApi';
import { fetchPreMatchTeamProfile } from '../utils/preMatchScouting';
import { isMatchDefenseScoutingV1 } from '../utils/matchDefenseScouting';
import { mapLegacyMatchScoutingToV3 } from '../utils/matchScoutingV3';
import { isMatchScoutingV4 } from '../utils/matchScoutingV4';
import PredictionActualTrendPanel from '../components/admin/PredictionActualTrendPanel';
import {
  backtestTimeAwareModels,
  buildAverageBlendLookup,
  buildAlliancePickRecommendations,
  buildBestModelFutureForecasts,
  buildDefenseAttributions,
  buildDefenseImpactLookup,
  buildNoFutureFeatureMatchSnapshots,
  buildPpaRatings,
  buildScoutCalibrationRows,
  buildScoutedBonusMetricLookup,
  buildStrategyMatchPlans,
  buildTeamPerformanceProfiles,
  optimizeScoutAssignments
} from '../utils/strategyBrain';
import { downloadCsvFile } from '../utils/csv';
import {
  buildMatchValidationGroups,
  filterMatchValidationGroups,
  getRowAnomalyLabel
} from '../utils/rawDataValidation';
import {
  AdminButton,
  AdminContextMenu,
  AdminIconButton,
  AdminInput,
  AdminModal,
  AdminSurface,
  WorkspaceNavItem
} from '../components/adminv4/AdminV4Primitives';
import {
  buildPpaInsights,
  summarizePpaAlliance,
  PpaAllianceSummary,
  PpaInsight,
  PpaRoleRecommendation,
  PpaRiskLevel
} from '../utils/ppaInsights';
import { SCOUTING_MISSIONS, SCOUTING_USE_MOMENTS, ScoutingMissionKey, getMissionToneClasses } from '../utils/scoutingWorkflow';

type PredictorDisplayTab = 'ranking' | 'quals' | 'finals';
type ResultsDisplayTab = 'quals' | 'practice';
type SorterField = 'team' | 'tbaRank' | 'matches' | 'ppa' | 'ppc' | 'autoPpc' | 'teleopPpc' | 'defenseMetric' | 'epa' | 'opr' | 'dpr';
type SorterDirection = 'asc' | 'desc';
type WorkflowTab = 'command' | 'sorter' | 'predictor' | 'pickList' | 'visualize' | 'import' | 'export';
type AdminV2Tab = WorkflowTab | 'results' | 'rawEditor' | 'teams' | 'simulator' | 'wiki';
type VisualMetricKey = 'power' | 'defense' | 'volatility' | 'ppa' | 'ppc' | 'autoPpc' | 'teleopPpc' | 'opr' | 'epa' | 'dpr' | 'tbaRank' | 'matches';
type StatInfoKey = SorterField | AdminV2SelectedMetric | 'defenseImpact' | 'volatility' | 'rankings' | 'projectedRank' | 'rpForecast';
type DataPanel = 'collection' | 'imports' | 'audit' | 'sources' | 'models' | 'scouts' | 'backup' | 'preScout';
type TeamHighlightKind = 'own' | 'searched' | 'both';

interface ChartRowBase {
  key: string;
  label: string;
  secondary?: string;
  highlighted?: TeamHighlightKind;
}

interface ScalarChartRow extends ChartRowBase {
  value: number;
}

interface PpaShapeChartRow extends ChartRowBase {
  expected: number;
  floor: number;
  ceiling: number;
  normalLow: number | null;
  normalHigh: number | null;
  role: PpaRoleRecommendation;
  uncertainty: PpaRiskLevel;
  tailRisk: PpaRiskLevel;
  tailRiskLabel: string;
  scoutConfidence: number;
  coverageLabel: string;
}

interface CollectionPipelineStage {
  key: ScoutingMissionKey;
  count: number;
  countLabel: string;
  readinessLabel: string;
  readinessDetail: string;
  tone: 'emerald' | 'amber' | 'rose' | 'cyan';
}

interface PpaReadinessCard {
  label: string;
  value: number | string;
  detail: string;
  tone?: 'emerald' | 'amber' | 'rose' | 'cyan';
}

interface TbaRankingsResponse {
  rankings?: Array<{
    team_key: string;
    rank: number;
  }>;
}

interface TbaEventSearchResult {
  key: string;
  name: string;
  short_name: string;
}

const getLatestAdminV2CachePayload = <T,>(
  entries: AdminV2CacheEntry[],
  source: AdminV2CacheEntry['source'],
  key: string
): T | null => {
  const entry = entries
    .filter(candidate => candidate.source === source && candidate.key === key)
    .sort((left, right) => right.timestamp - left.timestamp)[0];
  return entry ? entry.payload as T : null;
};

const isCachedTbaMatches = (value: unknown): value is TBAMatch[] =>
  Array.isArray(value) && value.every(match => !!match && typeof match === 'object' && 'alliances' in match && 'key' in match);

const isCachedTbaRankings = (value: unknown): value is TbaRankingsResponse =>
  !!value && typeof value === 'object' && Array.isArray((value as TbaRankingsResponse).rankings);

const isCachedTbaAlliances = (value: unknown): value is TBAEliminationAlliance[] =>
  Array.isArray(value);

const isCachedStatboticsEpaPayload = (
  value: unknown
): value is { epaByTeam: Record<string, StatboticsNormalizedTeamEpa>; missingTeams?: string[] } =>
  !!value &&
  typeof value === 'object' &&
  !!(value as { epaByTeam?: unknown }).epaByTeam &&
  typeof (value as { epaByTeam?: unknown }).epaByTeam === 'object';

const isCachedPreMatchTeamProfile = (value: unknown): value is PreMatchTeamProfile =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as Partial<PreMatchTeamProfile>).teamNumber === 'string' &&
  typeof (value as Partial<PreMatchTeamProfile>).teamKey === 'string' &&
  typeof (value as Partial<PreMatchTeamProfile>).nickname === 'string';

const isCachedMatchScoutingV3Rows = (value: unknown): value is MatchScoutingV3[] =>
  Array.isArray(value) && value.every(isMatchScoutingV3);

const isCachedMatchScoutingV4Rows = (value: unknown): value is MatchScoutingV4[] =>
  Array.isArray(value) && value.every(isMatchScoutingV4);

const isCachedDefenseRows = (value: unknown): value is MatchDefenseScoutingV1[] =>
  Array.isArray(value) && value.every(isMatchDefenseScoutingV1);

const loadLatestCachedPayload = async <T,>(
  eventKey: string,
  source: AdminV2CacheEntry['source'],
  key: string,
  guard: (value: unknown) => value is T
): Promise<{ payload: T; timestamp: number } | null> => {
  const entries = await listAdminV2CacheEntries(eventKey);
  const entry = entries
    .filter(item => item.source === source && item.key === key)
    .sort((left, right) => right.timestamp - left.timestamp)
    .find(item => guard(item.payload));
  if (!entry || !guard(entry.payload)) return null;
  return { payload: entry.payload, timestamp: entry.timestamp };
};

interface TeamMetricSummary {
  currentMetricLabel: string;
  currentMetricValue: number | null;
  autoComponent: number | null;
  teleopComponent: number | null;
  sourceLabel: string;
  extras: Array<{ label: string; value: string }>;
}

interface AdminV2SorterRow {
  teamNumber: string;
  teamName: string;
  matches: number;
  ppa: number | null;
  ppaRole: string;
  ppaUncertainty: PpaRiskLevel;
  ppaCoverage: string;
  ppc: number | null;
  autoPpc: number | null;
  teleopPpc: number | null;
  defenseMetric: number | null;
  defenseRecords: number;
  epa: number | null;
  opr: number | null;
  dpr: number | null;
  tbaRank: number | null;
}

type AdminV2RawEditorRecord = MatchScoutingV4 & { id: string };

interface AdminV2FullLocalBackup {
  format: 'rebuilt-2026-admin-v2-full-local-backup';
  version: number;
  eventKey: string;
  exportedAt: number;
  settings?: AdminV2Settings;
  firstEventsCredentials?: {
    username: string;
    savedAt: number;
    tokenIncluded: false;
  } | null;
  uploadedTbaPack?: UploadedTbaCsvPack | null;
  scoutArchive?: ScoutArchiveBundle;
  adminV2?: {
    cacheEntries?: AdminV2CacheEntry[];
    powerCoinBets?: PowerCoinBet[];
    powerCoinLedger?: PowerCoinLedgerEntry[];
    scoutAssignmentPlan?: ScoutAssignmentPlan | null;
    modelSnapshots?: ModelLabSnapshot[];
    modelFeatureSnapshots?: ModelFeatureSnapshot[];
  };
}

interface AdminV2SourceStatusRow {
  id: string;
  source: string;
  key: string;
  detail: string;
  timestamp: number;
}

const QUICK_EVENTS: Array<[string, string]> = [
  ['2026MNUM', '2026MNUM (MN North Star)'],
  ['2026cnsh', '2026cnsh (Shanghai)'],
  ['TEST', 'TEST EVENT']
];

const PREDICTION_COMPARISON_EVENT_KEY = '2026cnsh';
const PREDICTION_COMPARISON_EVENT_LABEL = 'Shanghai Regional (2026cnsh)';

const MODEL_LABELS: Record<AdminV2SelectedMetric, string> = {
  ppc: 'PPC',
  opr: 'OPR',
  epa: 'EPA',
  ppa: 'PPA'
};

const MODEL_OPTIONS: AdminV2SelectedMetric[] = ['ppa', 'ppc', 'opr', 'epa'];
const DEFAULT_SCOUTS = ['Olivia', 'Eason', 'Matilda', 'Sophia', 'Lucas', 'Justin'];
const STARTING_POWERCOINS = 1000;

interface StatInfoDefinition {
  title: string;
  category: 'Firsthand' | 'Secondhand' | 'Derived' | 'Operational';
  formula: string;
  source: string;
  interpretation: string;
  limitations: string;
  whereAppears?: string[];
}

const STAT_INFO: Record<StatInfoKey, StatInfoDefinition> = {
  team: {
    title: 'Team Number',
    category: 'Operational',
    formula: 'The FRC team number used as the row identity.',
    source: 'TBA, uploaded team list, Firebase scouting rows, or local cache.',
    interpretation: 'Use this to find the robot, then compare metrics around it.',
    limitations: 'Team number alone says nothing about current robot quality.'
  },
  tbaRank: {
    title: 'TBA Rank',
    category: 'Secondhand',
    formula: 'Current official ranking from The Blue Alliance rankings payload.',
    source: 'Live TBA ranking data or an uploaded/cached rankings file.',
    interpretation: 'Useful for event context and alliance-selection timing.',
    limitations: 'It blends schedule strength, rank points, penalties, and partners; it is not a pure robot-strength metric.'
  },
  rankings: {
    title: 'Projected Rankings',
    category: 'Derived',
    formula: 'Played results plus future match forecasts, converted into projected record and rank points.',
    source: 'TBA schedule/results plus the active local model layer.',
    interpretation: 'Use it during quals to anticipate who may move into captain or first-round-pick range.',
    limitations: 'Forecast quality depends on schedule completeness and the selected model.',
    whereAppears: ['Now', 'Matches', 'Reports']
  },
  projectedRank: {
    title: 'Projected Rank',
    category: 'Derived',
    formula: 'Sort projected qualification totals after adding played results and forecasted future RP.',
    source: 'TBA schedule/results, current official rankings, and the active forecast model.',
    interpretation: 'Use it to estimate which teams may become captains or high-value first picks.',
    limitations: 'One wrong future match forecast can move several close teams. Treat tight rank gaps as ranges.',
    whereAppears: ['Matches', 'Reports']
  },
  rpForecast: {
    title: 'RP Forecast',
    category: 'Derived',
    formula: 'Projected win RP plus game-specific bonus RP from played and forecasted qualification matches.',
    source: 'Official results, future schedules, and model-specific bonus metrics when available.',
    interpretation: 'Use it to see whether a team is rising because of wins, bonus objectives, or both.',
    limitations: 'Bonus RP rules and uploaded score component quality determine how trustworthy the split is.',
    whereAppears: ['Matches', 'Reports']
  },
  matches: {
    title: 'Matches Logged',
    category: 'Firsthand',
    formula: 'Count of scouted match rows for this team in the active event.',
    source: 'Firebase scouting rows and local scout archive rows.',
    interpretation: 'Higher counts make scouting-derived stats more trustworthy.',
    limitations: 'A large count can still be biased if the rows are incorrect or from unusual match roles.'
  },
  ppc: {
    title: 'PPC',
    category: 'Firsthand',
    formula: 'Average scouted total match points per team across logged matches.',
    source: 'V3/V4 scouting data collected by your scouts.',
    interpretation: 'Best for what your scouts directly observed at this event.',
    limitations: 'Sensitive to scout consistency, missed rows, and strategic role changes.'
  },
  autoPpc: {
    title: 'Auto PPC',
    category: 'Firsthand',
    formula: 'Average scouted autonomous points per team.',
    source: 'V3/V4 scouting data.',
    interpretation: 'Use it when selecting autonomous compatibility and early scoring reliability.',
    limitations: 'Does not include partner interaction, defense, or auto path conflicts by itself.'
  },
  teleopPpc: {
    title: 'Teleop PPC',
    category: 'Firsthand',
    formula: 'Average scouted teleop points per team.',
    source: 'V3/V4 scouting data.',
    interpretation: 'Use it for sustained scoring comparisons.',
    limitations: 'Can hide role-specific value such as defense, feeding, or endgame setup.'
  },
  defenseMetric: {
    title: 'Defense Metric',
    category: 'Firsthand',
    formula: 'Average defense score from submitted defense scouting forms.',
    source: 'Defense scouting rows collected by scouts.',
    interpretation: 'Higher means scouts observed more useful defensive value.',
    limitations: 'Subjective and role-dependent; compare with DPR/Defense Impact before over-trusting it.'
  },
  defenseImpact: {
    title: 'Defense Impact',
    category: 'Derived',
    formula: 'Estimated opponent scoring suppression attributed from match outcomes and model ratings.',
    source: 'Strategy model attribution layer using V4 records and team ratings.',
    interpretation: 'Use it to decide whether a robot is more valuable denying points than scoring them.',
    limitations: 'Requires enough played matches and can misattribute shared alliance effects.'
  },
  epa: {
    title: 'EPA',
    category: 'Secondhand',
    formula: 'Expected Points Added from Statbotics normalized team/event data.',
    source: 'Statbotics API/cache.',
    interpretation: 'Good public baseline when local scouting is sparse.',
    limitations: 'External model, may lag event changes, and may not reflect your exact scouting priorities.'
  },
  opr: {
    title: 'OPR',
    category: 'Secondhand',
    formula: 'Linear estimate of team point contribution from official alliance scores.',
    source: 'Uploaded TBA COPR/OPR files or locally calculated OPR from TBA match scores.',
    interpretation: 'Good for broad official-score signal and cross-checking scouting averages.',
    limitations: 'Confounded by partners, defense, fouls, and schedule strength.'
  },
  dpr: {
    title: 'DPR',
    category: 'Secondhand',
    formula: 'Linear estimate of points allowed while a team is present.',
    source: 'Official match scores through TBA/uploaded schedule data.',
    interpretation: 'Lower can indicate stronger defense or lower-scoring matches involving the team.',
    limitations: 'Very schedule- and partner-dependent; treat it as a context clue, not proof.'
  },
  ppa: {
    title: 'PPA',
    category: 'Derived',
    formula: 'A PPA insight object: expected points plus floor/ceiling band, role fit, local scout confidence, uncertainty, tail risk, defense impact, and source-model context.',
    source: 'Admin V4 validated forecast layer, local scouting profiles, public fallback ratings, defense attribution, and the promoted TailGuard/RoleV3 model research path.',
    interpretation: 'Use the expected value for forecasts, the role label for match strategy, the confidence and tail-risk fields for how aggressively to trust the number, and the component values to explain why it moved.',
    limitations: 'It is not one magic score. Thin local scouting, high volatility, low reliability, or missing public fallback data should make you treat PPA as a range and read the warnings.',
    whereAppears: ['Teams', 'Matches', 'Manual Simulator', 'Visualize', 'Reports']
  },
  volatility: {
    title: 'Volatility',
    category: 'Derived',
    formula: 'Spread of recent team performance around its fitted trend.',
    source: 'Admin V4 team performance profile layer.',
    interpretation: 'Higher volatility means higher upset potential and lower reliability.',
    limitations: 'A volatile team may be improving quickly, breaking down, or simply changing roles.',
    whereAppears: ['Teams', 'Visualize', 'Reports']
  }
};

const getStatInfo = (key: StatInfoKey) => STAT_INFO[key];

const getVisualMetricInfoKey = (metric: VisualMetricKey): StatInfoKey => {
  if (metric === 'power') return 'ppa';
  if (metric === 'defense') return 'defenseMetric';
  return metric;
};

const activeWorkspaceKeyFromTab = (tab: AdminV2Tab): WorkflowTab => {
  if (tab === 'results' || tab === 'simulator') return 'predictor';
  if (tab === 'rawEditor') return 'import';
  if (tab === 'teams' || tab === 'sorter') return 'sorter';
  if (tab === 'pickList') return 'pickList';
  if (tab === 'wiki') return 'command';
  return tab;
};

const isMatchScoutingV3 = (value: unknown): value is MatchScoutingV3 =>
  !!value &&
  typeof value === 'object' &&
  (value as Partial<MatchScoutingV3>).schemaVersion === 'v3';

const normalizeTeamKey = (teamKey: string) => teamKey.replace(/^frc/i, '');

const sanitizeTeamNumber = (value: string) => value.replace(/[^\d]/g, '');

const isPlayedMatch = (match: TBAMatch) =>
  match.alliances.red.score !== -1 && match.alliances.blue.score !== -1;

const getPlayedMatchWinner = (match: TBAMatch): 'Red' | 'Blue' | 'Tie' | 'Unknown' => {
  if (!isPlayedMatch(match)) return 'Unknown';
  if (match.alliances.red.score === match.alliances.blue.score) return 'Tie';
  return match.alliances.red.score > match.alliances.blue.score ? 'Red' : 'Blue';
};

const sortScoutRowsByMatchThenTeam = <
  T extends { matchNumber: number; teamNumber: string; timestamp?: number }
>(rows: T[]) =>
  [...rows].sort((left, right) => {
    const matchDelta = left.matchNumber - right.matchNumber;
    if (matchDelta !== 0) return matchDelta;
    const teamDelta = Number(left.teamNumber) - Number(right.teamNumber);
    if (teamDelta !== 0) return teamDelta;
    return (left.timestamp || 0) - (right.timestamp || 0);
  });

const getV3LogicalId = (record: Pick<MatchScoutingV3, 'matchKey' | 'teamNumber'>) =>
  `${record.matchKey}_${record.teamNumber}`;

const mergeV3WithLegacyRows = (legacyRows: MatchScoutingV3[], v3Rows: MatchScoutingV3[]) => {
  const merged = new Map<string, MatchScoutingV3>();
  legacyRows.forEach(row => merged.set(getV3LogicalId(row), row));
  v3Rows.forEach(row => merged.set(getV3LogicalId(row), row));
  return sortScoutRowsByMatchThenTeam([...merged.values()]);
};

const isLegacyMatchScoutingV2 = (value: unknown): value is MatchScoutingV2 =>
  !!value &&
  typeof value === 'object' &&
  (value as { schemaVersion?: unknown }).schemaVersion !== 'v3' &&
  typeof (value as Partial<MatchScoutingV2>).matchKey === 'string' &&
  typeof (value as Partial<MatchScoutingV2>).teamNumber === 'string' &&
  typeof (value as Partial<MatchScoutingV2>).eventKey === 'string';

const getCompLevelLabel = (compLevel: string) => {
  switch (compLevel) {
    case 'qm':
      return 'Qual';
    case 'sf':
      return 'Semi';
    case 'qf':
      return 'Quarter';
    case 'f':
      return 'Final';
    case 'pm':
      return 'Practice';
    default:
      return compLevel.toUpperCase();
  }
};

const getTimestampLabel = (timestamp: number | null) =>
  timestamp
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(timestamp * 1000))
    : 'Time pending';

const formatRecord = (row: Pick<ProjectedQualificationTeamRow, 'wins' | 'losses' | 'ties'>) =>
  `${row.wins}-${row.losses}-${row.ties}`;

const formatMetricValue = (value: number | null, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatPercentMetric = (value: number | null, digits: number = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;

const formatSignedMetric = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;

const formatFeatureTeamList = (teams: string[], featuresByTeam: Record<string, Record<string, number>>) =>
  teams.map(team => {
    const features = featuresByTeam[team] || {};
    return `${team}: PPC ${formatMetricValue(features.ppcBefore ?? null, 1)} (${formatMetricValue(features.scoutingRowsBefore ?? null, 0)} rows), OPR ${formatMetricValue(features.oprBefore ?? null, 1)} (${formatMetricValue(features.officialMatchesBefore ?? null, 0)} official)`;
  }).join(' / ');

const JUDGE_MODEL_BENCHMARK = {
  modelName: 'Conservative TailGuard Strong RoleV3',
  decidedMatches: 14685,
  winnerAccuracy: 0.753,
  confidence65Accuracy: 0.83,
  confidence75Accuracy: 0.877
};

const stringifyForWorkbookCell = (value: unknown) => {
  const text = JSON.stringify(value ?? null);
  return text.length > 30000 ? `${text.slice(0, 30000)}... [truncated]` : text;
};

const formatMaybeValue = (value: string | number | null | undefined) =>
  value == null || value === '' ? '—' : String(value);

const formatWorksheetDate = (timestampSeconds: number | null | undefined) => {
  if (!timestampSeconds) return '';
  return new Date(timestampSeconds * 1000).toISOString();
};

const formatLocalTimestamp = (timestamp: number | null | undefined) =>
  timestamp
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(timestamp))
    : '—';

const formatFreshnessAge = (timestamp: number | null | undefined) => {
  if (!timestamp) return 'Unknown';
  const ageMs = Math.max(0, Date.now() - timestamp);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ageMs < minute) return 'Just now';
  if (ageMs < hour) return `${Math.floor(ageMs / minute)} min ago`;
  if (ageMs < day) return `${Math.floor(ageMs / hour)} hr ago`;
  return `${Math.floor(ageMs / day)} day${Math.floor(ageMs / day) === 1 ? '' : 's'} ago`;
};

const describeCachedPayload = (payload: unknown) => {
  if (Array.isArray(payload)) return `${payload.length} rows`;
  if (payload && typeof payload === 'object') return `${Object.keys(payload as Record<string, unknown>).length} keys`;
  if (payload == null) return 'Empty payload';
  return typeof payload;
};

const downloadJsonFile = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const isAdminV2FullLocalBackup = (value: unknown): value is AdminV2FullLocalBackup => {
  if (!value || typeof value !== 'object') return false;
  const backup = value as Partial<AdminV2FullLocalBackup>;
  return backup.format === 'rebuilt-2026-admin-v2-full-local-backup' && typeof backup.eventKey === 'string';
};

const parseManualTeamNumbers = (value: string) =>
  value
    .split(/[\s,]+/)
    .map(team => sanitizeTeamNumber(team))
    .filter(Boolean);

const parseQuickTeamEntry = (value: string) => {
  const teams = value
    .split(/[\s,]+/)
    .map(team => sanitizeTeamNumber(team))
    .filter(Boolean);
  const redCount = teams.length <= 6 ? Math.min(3, teams.length) : Math.ceil(teams.length / 2);

  return {
    redTeams: teams.slice(0, redCount),
    blueTeams: teams.slice(redCount)
  };
};

const getPredictorViewDescription = (view: PredictorDisplayTab) => {
  switch (view) {
    case 'ranking':
      return 'Projected end-of-quals ranking using the selected model.';
    case 'quals':
      return 'Future qualification match forecasts using the selected model.';
    case 'finals':
      return 'Full playoff bracket forecast using the selected model with published alliance and playoff structure.';
  }
};

const getResultsViewDescription = (view: ResultsDisplayTab) => {
  switch (view) {
    case 'quals':
      return 'Qualification match results ordered from Qual 1 upward.';
    case 'practice':
      return 'Practice match results ordered from Practice 1 upward.';
  }
};

const getPlayoffStatusLabel = (status: PredictedMatchRow['status']) => {
  switch (status) {
    case 'played':
      return 'Played';
    case 'predicted':
      return 'Predicted';
    case 'bye':
      return 'Bye';
    case 'if-necessary':
      return 'If Necessary';
    default:
      return 'Pending';
  }
};

const getTeamBadgeClass = (teamNumber: string, ownTeamNumber: string, searchedTeamNumber: string) => {
  const isOwnTeam = ownTeamNumber !== '' && ownTeamNumber === teamNumber;
  const isSearchedTeam = searchedTeamNumber !== '' && searchedTeamNumber === teamNumber;

  if (isOwnTeam && isSearchedTeam) {
    return 'bg-orange-500 text-slate-950 ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950';
  }

  if (isOwnTeam) {
    return 'bg-orange-500 text-slate-950';
  }

  if (isSearchedTeam) {
    return 'bg-sky-500 text-slate-950';
  }

  return 'border border-slate-700 bg-slate-950 text-slate-200';
};

type AlliancePickStatusMap = Record<string, { status: AlliancePickRecommendation['status']; pickedBy?: string }>;

const getAdminV4PickListStorageKey = (eventKey: string) =>
  `adminv4_pick_list_state_${eventKey.trim().toUpperCase() || 'UNKNOWN'}`;

const loadAdminV4PickListState = (eventKey: string): { allianceSeed: number; statuses: AlliancePickStatusMap } => {
  if (typeof window === 'undefined') return { allianceSeed: 1, statuses: {} };
  try {
    const raw = window.localStorage.getItem(getAdminV4PickListStorageKey(eventKey));
    if (!raw) return { allianceSeed: 1, statuses: {} };
    const parsed = JSON.parse(raw) as {
      allianceSeed?: unknown;
      statuses?: Record<string, { status?: unknown; pickedBy?: unknown }>;
    };
    const statuses: AlliancePickStatusMap = {};
    Object.entries(parsed.statuses || {}).forEach(([teamNumber, value]) => {
      if (value.status === 'available' || value.status === 'picked' || value.status === 'declined' || value.status === 'unavailable') {
        statuses[teamNumber] = {
          status: value.status,
          pickedBy: typeof value.pickedBy === 'string' ? value.pickedBy : ''
        };
      }
    });
    return {
      allianceSeed: Math.max(1, Math.min(8, Number(parsed.allianceSeed) || 1)),
      statuses
    };
  } catch (error) {
    console.warn('Failed to load Admin V4 pick-list state', error);
    return { allianceSeed: 1, statuses: {} };
  }
};

const saveAdminV4PickListState = (eventKey: string, allianceSeed: number, statuses: AlliancePickStatusMap) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getAdminV4PickListStorageKey(eventKey),
      JSON.stringify({ allianceSeed, statuses, updatedAt: Date.now() })
    );
  } catch (error) {
    console.warn('Failed to save Admin V4 pick-list state', error);
  }
};

export default function AdminMainframeV2View() {
  const navigate = useNavigate();
  const initialSettings = useMemo(() => loadAdminV2Settings(), []);
  const [settings, setSettings] = useState<AdminV2Settings>(initialSettings);
  const [teamSearchInput, setTeamSearchInput] = useState(initialSettings.searchedTeamNumber);
  const [teamSearchError, setTeamSearchError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminV2Tab>('command');
  const [predictorViewTab, setPredictorViewTab] = useState<PredictorDisplayTab>('ranking');
  const [resultsViewTab, setResultsViewTab] = useState<ResultsDisplayTab>('quals');
  const [rawEditorViewTab, setRawEditorViewTab] = useState<ResultsDisplayTab>('quals');
  const [rawEditorSearch, setRawEditorSearch] = useState('');
  const [sorterField, setSorterField] = useState<SorterField>('ppa');
  const [sorterDirection, setSorterDirection] = useState<SorterDirection>('desc');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localTbaApiKey, setLocalTbaApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [wikiStatKey, setWikiStatKey] = useState<StatInfoKey>('ppa');
  const [wikiReturnTab, setWikiReturnTab] = useState<AdminV2Tab>('command');
  const [infoMenu, setInfoMenu] = useState<{ x: number; y: number; statKey: StatInfoKey } | null>(null);
  const [visualMetricKeys, setVisualMetricKeys] = useState<VisualMetricKey[]>(['ppa', 'ppc', 'defense']);
  const [dataPanel, setDataPanel] = useState<DataPanel | null>(null);
  const [selectedMatchKey, setSelectedMatchKey] = useState('');
  const [drilldownTeamNumber, setDrilldownTeamNumber] = useState('');
  const [drilldownFromTab, setDrilldownFromTab] = useState<AdminV2Tab>('sorter');
  const [allianceSeed, setAllianceSeed] = useState(1);
  const [alliancePickStatuses, setAlliancePickStatuses] = useState<AlliancePickStatusMap>({});
  const [pickListLoadedFor, setPickListLoadedFor] = useState('');
  const [records, setRecords] = useState<MatchScoutingV3[]>([]);
  const [v4Records, setV4Records] = useState<MatchScoutingV4[]>([]);
  const [defenseRecords, setDefenseRecords] = useState<MatchDefenseScoutingV1[]>([]);
  const [liveEventMatches, setLiveEventMatches] = useState<TBAMatch[]>([]);
  const [alliances, setAlliances] = useState<TBAEliminationAlliance[] | null>(null);
  const [eventSummary, setEventSummary] = useState<TBAEventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveScheduleUnavailable, setLiveScheduleUnavailable] = useState('');
  const [matchSourceLabel, setMatchSourceLabel] = useState('');
  const [currentTbaRanks, setCurrentTbaRanks] = useState<Record<string, number>>({});
  const [currentTbaRankOrder, setCurrentTbaRankOrder] = useState<string[]>([]);
  const [searchYear, setSearchYear] = useState(new Date().getFullYear().toString());
  const [searchResults, setSearchResults] = useState<TbaEventSearchResult[]>([]);
  const [isSearchingEvents, setIsSearchingEvents] = useState(false);
  const [simulatorQuickEntry, setSimulatorQuickEntry] = useState('');
  const [redSimulatorInput, setRedSimulatorInput] = useState('');
  const [blueSimulatorInput, setBlueSimulatorInput] = useState('');
  const [uploadedCsvPack, setUploadedCsvPack] = useState<UploadedTbaCsvPack | null>(() =>
    loadUploadedTbaCsvPack(initialSettings.eventKey)
  );
  const [csvMessages, setCsvMessages] = useState<UploadedTbaCsvImportMessage[]>([]);
  const [csvError, setCsvError] = useState('');
  const [epaByTeam, setEpaByTeam] = useState<Record<string, StatboticsNormalizedTeamEpa>>({});
  const [missingEpaTeams, setMissingEpaTeams] = useState<string[]>([]);
  const [epaUnavailable, setEpaUnavailable] = useState('');
  const [isEpaLoading, setIsEpaLoading] = useState(false);
  const [rankingSearch, setRankingSearch] = useState('');
  const [teamProfile, setTeamProfile] = useState<PreMatchTeamProfile | null>(null);
  const [teamProfileError, setTeamProfileError] = useState('');
  const [isTeamProfileLoading, setIsTeamProfileLoading] = useState(false);
  const [firstCredentials, setFirstCredentials] = useState<FirstEventsCredentials | null>(null);
  const [firstCredentialStatus, setFirstCredentialStatus] = useState('');
  const [firstCredentialError, setFirstCredentialError] = useState('');
  const [cachedFirstTeamNames, setCachedFirstTeamNames] = useState<Record<string, string>>({});
  const [localBackupStatus, setLocalBackupStatus] = useState('');
  const [localBackupError, setLocalBackupError] = useState('');
  const [localArchiveRecords, setLocalArchiveRecords] = useState<ScoutArchiveRecord[]>([]);
  const [localArchiveError, setLocalArchiveError] = useState('');
  const [isLocalArchiveSyncing, setIsLocalArchiveSyncing] = useState(false);
  const [localArchiveSyncStatus, setLocalArchiveSyncStatus] = useState('');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [adminV2CacheEntries, setAdminV2CacheEntries] = useState<AdminV2CacheEntry[]>([]);
  const [adminV2CacheError, setAdminV2CacheError] = useState('');
  const [latestModelSnapshot, setLatestModelSnapshot] = useState<ModelLabSnapshot | null>(null);
  const [latestFeatureSnapshot, setLatestFeatureSnapshot] = useState<ModelFeatureSnapshot | null>(null);
  const [modelSnapshotStatus, setModelSnapshotStatus] = useState('');
  const [scoutRosterText, setScoutRosterText] = useState(DEFAULT_SCOUTS.join('\n'));
  const [scoutAssignmentPlan, setScoutAssignmentPlan] = useState<ScoutAssignmentPlan | null>(null);
  const [scoutControlStatus, setScoutControlStatus] = useState('');
  const [powerCoinBets, setPowerCoinBets] = useState<PowerCoinBet[]>([]);
  const [powerCoinLedger, setPowerCoinLedger] = useState<PowerCoinLedgerEntry[]>([]);
  const [powerCoinStatus, setPowerCoinStatus] = useState('');
  const [powerCoinAdjustmentScout, setPowerCoinAdjustmentScout] = useState('');
  const [powerCoinAdjustmentAmount, setPowerCoinAdjustmentAmount] = useState(100);
  const [powerCoinAdjustmentReason, setPowerCoinAdjustmentReason] = useState('Quality scouting bonus');
  const [comparisonEventMatches, setComparisonEventMatches] = useState<TBAMatch[]>([]);
  const [comparisonSourceLabel, setComparisonSourceLabel] = useState('');
  const [comparisonError, setComparisonError] = useState('');
  const [isComparisonLoading, setIsComparisonLoading] = useState(false);
  const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';
  const refreshSequenceRef = useRef(0);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const tabRefreshCooldownRef = useRef<Record<string, number>>({});

  const eventKey = settings.eventKey;
  const selectedMetric = settings.selectedMetric;
  const ownTeamNumber = settings.ownTeamNumber;
  const searchedTeamNumber = settings.searchedTeamNumber;
  const effectiveTbaApiKey = localTbaApiKey || TBA_API_KEY;
  const hasLocalTbaApiKey = localTbaApiKey.trim().length > 0;

  useEffect(() => {
    const saved = loadAdminV4PickListState(eventKey);
    setAllianceSeed(saved.allianceSeed);
    setAlliancePickStatuses(saved.statuses);
    setPickListLoadedFor(eventKey);
  }, [eventKey]);

  useEffect(() => {
    if (pickListLoadedFor !== eventKey) return;
    saveAdminV4PickListState(eventKey, allianceSeed, alliancePickStatuses);
  }, [alliancePickStatuses, allianceSeed, eventKey, pickListLoadedFor]);

  useEffect(() => {
    let cancelled = false;
    const loadModelSnapshots = async () => {
      const [modelSnapshot, featureSnapshot] = await Promise.all([
        loadLatestModelLabSnapshot(eventKey).catch(() => null),
        loadLatestModelFeatureSnapshot(eventKey).catch(() => null)
      ]);
      if (cancelled) return;
      setLatestModelSnapshot(modelSnapshot);
      setLatestFeatureSnapshot(featureSnapshot);
    };
    void loadModelSnapshots();
    return () => {
      cancelled = true;
    };
  }, [eventKey]);

  const refreshScoutOpsState = useCallback(async () => {
    const [plan, bets, ledger] = await Promise.all([
      loadLatestScoutAssignmentPlan(eventKey).catch(() => null),
      listPowerCoinBets(eventKey).catch(() => []),
      listPowerCoinLedger(eventKey).catch(() => [])
    ]);
    setScoutAssignmentPlan(plan);
    if (plan?.scoutNames?.length) {
      setScoutRosterText(plan.scoutNames.join('\n'));
    }
    setPowerCoinBets(bets);
    setPowerCoinLedger(ledger);
  }, [eventKey]);

  useEffect(() => {
    void refreshScoutOpsState();
  }, [refreshScoutOpsState]);

  const refreshLocalArchiveRecords = useCallback(async () => {
    try {
      const archiveRecords = await listScoutArchiveRecords({ eventKey, includeDeleted: true });
      setLocalArchiveRecords(archiveRecords);
      setLocalArchiveError('');
      if (isLocalMode) {
        const activeArchiveRecords = archiveRecords.filter(record => !record.deleted);
        const archivedMatchRows = activeArchiveRecords
          .filter(record => record.recordType === 'match')
          .map(record => record.payload)
          .flatMap(payload => {
            if (isMatchScoutingV3(payload)) return [payload];
            if (isLegacyMatchScoutingV2(payload)) return [mapLegacyMatchScoutingToV3(payload)];
            return [];
          });
        setRecords(sortScoutRowsByMatchThenTeam(archivedMatchRows));
        setV4Records(sortScoutRowsByMatchThenTeam(
          activeArchiveRecords
            .filter(record => record.recordType === 'matchV4' && isMatchScoutingV4(record.payload))
            .map(record => record.payload as MatchScoutingV4)
        ));
        setDefenseRecords(sortScoutRowsByMatchThenTeam(
          activeArchiveRecords
            .filter(record => record.recordType === 'matchDefense' && isMatchDefenseScoutingV1(record.payload))
            .map(record => record.payload as MatchDefenseScoutingV1)
        ));
      }
    } catch (archiveError) {
        console.error('Failed to load local scout archive records in Admin V4', archiveError);
      setLocalArchiveRecords([]);
      setLocalArchiveError('Unable to read the local scout archive on this admin device.');
    }
  }, [eventKey, isLocalMode]);

  const localArchiveSummary = useMemo(() => {
    const activeRecords = localArchiveRecords.filter(record => !record.deleted);
    const deletedRecords = localArchiveRecords.filter(record => record.deleted);
    const unsyncedRecords = activeRecords.filter(record => record.syncStatus === 'pending_sync' || record.syncStatus === 'unsynced');
    const conflictRecords = unsyncedRecords.filter(record => (record.lastFirebaseError || '').toLowerCase().includes('conflict'));
    return {
      activeRecords,
      deletedRecords,
      unsyncedRecords,
      conflictRecords
    };
  }, [localArchiveRecords]);

  const refreshAdminV2CacheEntries = useCallback(async () => {
    try {
      const entries = await listAdminV2CacheEntries(eventKey);
      setAdminV2CacheEntries(entries);
      setAdminV2CacheError('');
    } catch (cacheError) {
      console.error('Failed to read Admin V4 cache entries', cacheError);
      setAdminV2CacheEntries([]);
      setAdminV2CacheError('Unable to read Admin V4 source cache from this device.');
    }
  }, [eventKey]);

  const sourceStatusRows = useMemo<AdminV2SourceStatusRow[]>(() => {
    const cacheRows = adminV2CacheEntries.map(entry => ({
      id: entry.id,
      source: entry.source,
      key: entry.key,
      detail: describeCachedPayload(entry.payload),
      timestamp: entry.timestamp
    }));

    const uploadedRows: AdminV2SourceStatusRow[] = [];
    if (uploadedCsvPack?.coprs) {
      uploadedRows.push({
        id: `upload:${uploadedCsvPack.coprs.fileName}`,
        source: 'Upload',
        key: 'coprs',
        detail: `${Object.keys(uploadedCsvPack.coprs.ratings).length} OPR ratings`,
        timestamp: uploadedCsvPack.coprs.loadedAt
      });
    }
    const uploadedSchedule = uploadedCsvPack?.schedule || uploadedCsvPack?.flatSchedule;
    if (uploadedSchedule) {
      uploadedRows.push({
        id: `upload:${uploadedSchedule.fileName}`,
        source: 'Upload',
        key: uploadedCsvPack?.schedule ? 'schedule' : 'flat-schedule',
        detail: `${uploadedSchedule.matches.length} matches`,
        timestamp: uploadedSchedule.loadedAt
      });
    }
    if (uploadedCsvPack?.teamList) {
      uploadedRows.push({
        id: `upload:${uploadedCsvPack.teamList.fileName}`,
        source: 'Upload',
        key: 'team-list',
        detail: `${Object.keys(uploadedCsvPack.teamList.teamNames).length} teams`,
        timestamp: uploadedCsvPack.teamList.loadedAt
      });
    }
    if (uploadedCsvPack?.rankings) {
      uploadedRows.push({
        id: `upload:${uploadedCsvPack.rankings.fileName}`,
        source: 'Upload',
        key: 'rankings',
        detail: `${uploadedCsvPack.rankings.rankOrder.length} teams`,
        timestamp: uploadedCsvPack.rankings.loadedAt
      });
    }
    if (uploadedCsvPack?.alliances) {
      uploadedRows.push({
        id: `upload:${uploadedCsvPack.alliances.fileName}`,
        source: 'Upload',
        key: 'alliances',
        detail: `${uploadedCsvPack.alliances.alliances.length} alliances`,
        timestamp: uploadedCsvPack.alliances.loadedAt
      });
    }
    if (uploadedCsvPack?.eventSummary) {
      uploadedRows.push({
        id: `upload:${uploadedCsvPack.eventSummary.fileName}`,
        source: 'Upload',
        key: 'event-summary',
        detail: uploadedCsvPack.eventSummary.eventSummary.name || 'Event metadata',
        timestamp: uploadedCsvPack.eventSummary.loadedAt
      });
    }

    return [...cacheRows, ...uploadedRows].sort((left, right) => right.timestamp - left.timestamp);
  }, [adminV2CacheEntries, uploadedCsvPack]);

  const sourceStatusSummary = useMemo(() => {
    const latestTimestamp = sourceStatusRows.reduce((latest, row) => Math.max(latest, row.timestamp || 0), 0);
    const uniqueSources = new Set(sourceStatusRows.map(row => row.source)).size;
    return {
      latestTimestamp,
      uniqueSources,
      rowCount: sourceStatusRows.length
    };
  }, [sourceStatusRows]);

  const updateSettings = (patch: Partial<AdminV2Settings>) => {
    setSettings(previous => ({
      ...previous,
      ...patch
    }));
  };

  useEffect(() => {
    saveAdminV2Settings(settings);
  }, [settings]);

  useEffect(() => {
    void refreshLocalArchiveRecords();
  }, [refreshLocalArchiveRecords]);

  useEffect(() => {
    void refreshAdminV2CacheEntries();
  }, [refreshAdminV2CacheEntries]);

  useEffect(() => {
    setUploadedCsvPack(loadUploadedTbaCsvPack(eventKey));
    setCsvMessages([]);
    setCsvError('');
  }, [eventKey]);

  useEffect(() => {
    setTeamSearchInput(searchedTeamNumber);
  }, [searchedTeamNumber]);

  useEffect(() => {
    if (teamSearchError) {
      setTeamSearchError('');
    }
  }, [eventKey, teamSearchInput]);

  useEffect(() => {
    let cancelled = false;
    const hydrateFirstCredentials = async () => {
      try {
        const [credentials, savedTbaKey] = await Promise.all([
          loadFirstEventsCredentials().catch(() => null),
          loadTbaApiKey().catch(() => null)
        ]);
        if (!cancelled) {
          setFirstCredentials(credentials);
          setLocalTbaApiKey(savedTbaKey || '');
        }
      } catch (credentialError) {
        console.warn('Failed to load local API credentials', credentialError);
      }
    };
    void hydrateFirstCredentials();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadV3Data = async (options: { background?: boolean; preserveScroll?: boolean } = {}) => {
    const refreshId = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = refreshId;
    const scrollContainer = mainScrollRef.current;
    const scrollTopBeforeRefresh = options.preserveScroll ? scrollContainer?.scrollTop ?? null : null;
    const restoreScrollPosition = () => {
      if (scrollTopBeforeRefresh == null || !scrollContainer) return;
      window.requestAnimationFrame(() => {
        scrollContainer.scrollTop = scrollTopBeforeRefresh;
        window.requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollTopBeforeRefresh;
        });
      });
    };
    const isLatestRefresh = () => refreshSequenceRef.current === refreshId;

    setLoading(true);
    setError('');
    if (!options.background) {
      setLiveScheduleUnavailable('');
      setMatchSourceLabel('');
    }
    const cacheYear = getYearFromEventKey(eventKey);

    try {
      const cachedEntries = await listAdminV2CacheEntries(eventKey).catch(() => []);
      if (!isLatestRefresh()) return;
      setAdminV2CacheEntries(cachedEntries);
      setAdminV2CacheError('');
      const cachedFirebaseV3Payload = getLatestAdminV2CachePayload<unknown>(cachedEntries, 'Firebase', 'matchScoutingV3');
      const cachedFirebaseV4Payload = getLatestAdminV2CachePayload<unknown>(cachedEntries, 'Firebase', 'matchScoutingV4');
      const cachedFirebaseDefensePayload = getLatestAdminV2CachePayload<unknown>(cachedEntries, 'Firebase', 'matchScoutingDefense');
      const cachedMatchesPayload = getLatestAdminV2CachePayload<unknown>(cachedEntries, 'TBA', 'matches');
      const cachedRankingsPayload = getLatestAdminV2CachePayload<unknown>(cachedEntries, 'TBA', 'rankings');
      const cachedAlliancesPayload = getLatestAdminV2CachePayload<unknown>(cachedEntries, 'TBA', 'alliances');
      const cachedEventSummaryPayload = getLatestAdminV2CachePayload<unknown>(cachedEntries, 'TBA', 'event-summary');
      const cachedFirstTeamNamesFromPayload = convertFirstTeamsPayloadToTeamNames(
        getLatestAdminV2CachePayload<unknown>(cachedEntries, 'FIRST', 'teams')
      );
      const cachedFirstRankings = convertFirstRankingsPayloadToTbaRankings(
        getLatestAdminV2CachePayload<unknown>(cachedEntries, 'FIRST', 'rankings')
      );
      setCachedFirstTeamNames(cachedFirstTeamNamesFromPayload);
      const cachedFirstMatches = convertFirstEventsPayloadsToTbaMatches(eventKey, [
        { payload: getLatestAdminV2CachePayload<unknown>(cachedEntries, 'FIRST', 'practice-schedule'), fallbackCompLevel: 'pm' },
        { payload: getLatestAdminV2CachePayload<unknown>(cachedEntries, 'FIRST', 'qual-schedule'), fallbackCompLevel: 'qm' },
        { payload: getLatestAdminV2CachePayload<unknown>(cachedEntries, 'FIRST', 'qual-matches'), fallbackCompLevel: 'qm' },
        { payload: getLatestAdminV2CachePayload<unknown>(cachedEntries, 'FIRST', 'playoff-matches'), fallbackCompLevel: 'sf' }
      ]);
      const cachedMatches = isCachedTbaMatches(cachedMatchesPayload) && cachedMatchesPayload.length > 0 ? cachedMatchesPayload : cachedFirstMatches;
      const cachedRankings = isCachedTbaRankings(cachedRankingsPayload) ? cachedRankingsPayload : cachedFirstRankings;
      const cachedAlliances = isCachedTbaAlliances(cachedAlliancesPayload) ? cachedAlliancesPayload : null;
      const cachedEventSummary =
        cachedEventSummaryPayload && typeof cachedEventSummaryPayload === 'object'
          ? cachedEventSummaryPayload as TBAEventSummary
          : null;
      const applyRankings = (rankings: TbaRankingsResponse | null) => {
        if (!isLatestRefresh()) return;
        if (!rankings?.rankings) {
          setCurrentTbaRanks({});
          setCurrentTbaRankOrder([]);
          return;
        }

        const nextRanks: Record<string, number> = {};
        const nextOrder: string[] = [];
        rankings.rankings.forEach(ranking => {
          const teamNumber = normalizeTeamKey(ranking.team_key);
          nextRanks[teamNumber] = ranking.rank;
          nextOrder.push(teamNumber);
        });
        setCurrentTbaRanks(nextRanks);
        setCurrentTbaRankOrder(nextOrder);
      };

      if (!isLocalMode) {
        if (isCachedMatchScoutingV3Rows(cachedFirebaseV3Payload)) {
          setRecords(sortScoutRowsByMatchThenTeam(cachedFirebaseV3Payload));
        }
        if (isCachedMatchScoutingV4Rows(cachedFirebaseV4Payload)) {
          setV4Records(sortScoutRowsByMatchThenTeam(cachedFirebaseV4Payload));
        }
        if (isCachedDefenseRows(cachedFirebaseDefensePayload)) {
          setDefenseRecords(sortScoutRowsByMatchThenTeam(cachedFirebaseDefensePayload));
        }
      }
      if (cachedMatches.length > 0) {
        setLiveEventMatches(cachedMatches);
        if (!options.background) {
          setMatchSourceLabel('Cached TBA/FIRST match data');
        }
      }
      if (cachedAlliances) setAlliances(cachedAlliances);
      if (cachedEventSummary) setEventSummary(cachedEventSummary);
      if (cachedRankings) applyRankings(cachedRankings);

      if (isLocalMode) {
        await refreshLocalArchiveRecords();
      } else {
        const collectionNames = ['matchScouting', 'matchScoutingV3', 'matchScoutingV4', 'matchScoutingDefense'] as const;
        const collectionResults = await Promise.allSettled(
          collectionNames.map(collectionName => getDocs(collection(db, 'events', eventKey, collectionName)))
        );
        if (!isLatestRefresh()) return;
        const [legacySnapshot, v3Snapshot, v4Snapshot, defenseSnapshot] = collectionResults.map((result, index) => {
          if (result.status === 'fulfilled') return result.value;
          console.error(`Failed to load Firebase collection ${collectionNames[index]} for Admin V2`, result.reason);
          return null;
        });
        const failedCollectionNames = collectionNames.filter((_, index) => collectionResults[index]?.status === 'rejected');
        if (failedCollectionNames.length > 0) {
          setError(`Some Firebase collections could not load: ${failedCollectionNames.join(', ')}. Showing all accessible cached/live data.`);
        }

        const legacyRecords = (legacySnapshot?.docs || [])
          .map(docSnap => docSnap.data())
          .filter(isLegacyMatchScoutingV2)
          .map(mapLegacyMatchScoutingToV3);
        const v3Records = (v3Snapshot?.docs || [])
          .map(docSnap => docSnap.data())
          .filter(isMatchScoutingV3);
        const nextRecords = mergeV3WithLegacyRows(legacyRecords, v3Records);
        const nextDefenseRecords = (defenseSnapshot?.docs || [])
          .map(docSnap => docSnap.data())
          .filter(isMatchDefenseScoutingV1)
          .sort((left, right) => {
            const matchDelta = left.matchNumber - right.matchNumber;
            if (matchDelta !== 0) return matchDelta;
            return Number(left.teamNumber) - Number(right.teamNumber);
          });
        const nextV4Records = (v4Snapshot?.docs || [])
          .map(docSnap => docSnap.data())
          .filter(isMatchScoutingV4)
          .sort((left, right) => {
            const matchDelta = left.matchNumber - right.matchNumber;
            if (matchDelta !== 0) return matchDelta;
            return Number(left.teamNumber) - Number(right.teamNumber);
          });
        setRecords(nextRecords);
        setV4Records(nextV4Records);
        setDefenseRecords(nextDefenseRecords);
        void Promise.allSettled([
          putAdminV2CacheEntry({
            eventKey,
            year: cacheYear,
            source: 'Firebase',
            key: 'matchScoutingLegacyMapped',
            payload: legacyRecords
          }),
          putAdminV2CacheEntry({
            eventKey,
            year: cacheYear,
            source: 'Firebase',
            key: 'matchScoutingV3',
            payload: nextRecords
          }),
          putAdminV2CacheEntry({
            eventKey,
            year: cacheYear,
            source: 'Firebase',
            key: 'matchScoutingV4',
            payload: nextV4Records
          }),
          putAdminV2CacheEntry({
            eventKey,
            year: cacheYear,
            source: 'Firebase',
            key: 'matchScoutingDefense',
            payload: nextDefenseRecords
          })
        ]);
      }

      if (!effectiveTbaApiKey || eventKey === 'TEST') {
        if (!isLatestRefresh()) return;
        setLiveEventMatches(cachedMatches);
        setAlliances(cachedAlliances);
        setEventSummary(cachedEventSummary);
        applyRankings(cachedRankings);
        if (cachedMatches.length > 0) {
          setMatchSourceLabel('Cached TBA/FIRST match data');
          setLiveScheduleUnavailable('Live TBA is unavailable, so Admin V4 is using the latest cached TBA/FIRST match data from IndexedDB.');
        }
        return;
      }

      const engine = new MathEngine(effectiveTbaApiKey);
      const normalizedEventKey = eventKey.trim().toLowerCase();

      const [matchesResult, rankingsResult, alliancesResult, summaryResult] = await Promise.allSettled([
        engine.fetchEventMatches(eventKey, { includeUnplayed: true }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/rankings`, {
          headers: { 'X-TBA-Auth-Key': effectiveTbaApiKey }
        }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/alliances`, {
          headers: { 'X-TBA-Auth-Key': effectiveTbaApiKey }
        }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/simple`, {
          headers: { 'X-TBA-Auth-Key': effectiveTbaApiKey }
        })
      ]);
      if (!isLatestRefresh()) return;

      if (matchesResult.status === 'fulfilled') {
        setLiveEventMatches(matchesResult.value);
        setMatchSourceLabel('Live TBA schedule');
        void putAdminV2CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'matches',
          payload: matchesResult.value
        }).catch(() => {});
      } else {
        console.error('Failed to load live TBA schedule for Admin V2', matchesResult.reason);
        setLiveEventMatches(cachedMatches);
        if (cachedMatches.length > 0) {
          setMatchSourceLabel('Cached TBA/FIRST match data');
        }
        setLiveScheduleUnavailable(
          cachedMatches.length > 0
            ? `Live TBA schedule is unavailable, using ${cachedMatches.length} cached TBA/FIRST match rows from IndexedDB.`
            : matchesResult.reason instanceof Error
              ? matchesResult.reason.message
              : 'Live TBA schedule is unavailable right now.'
        );
      }

      if (rankingsResult.status === 'fulfilled' && rankingsResult.value.ok) {
        const rankings = (await rankingsResult.value.json()) as TbaRankingsResponse;
        applyRankings(rankings);
        void putAdminV2CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'rankings',
          payload: rankings
        }).catch(() => {});
      } else {
        applyRankings(cachedRankings);
      }

      if (alliancesResult.status === 'fulfilled' && alliancesResult.value.ok) {
        const nextAlliances = (await alliancesResult.value.json()) as any;
        setAlliances(nextAlliances);
        void putAdminV2CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'alliances',
          payload: nextAlliances
        }).catch(() => {});
      } else {
        setAlliances(cachedAlliances);
      }

      if (summaryResult.status === 'fulfilled' && summaryResult.value.ok) {
        const nextEventSummary = await summaryResult.value.json();
        setEventSummary(nextEventSummary);
        void putAdminV2CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'event-summary',
          payload: nextEventSummary
        }).catch(() => {});
      } else {
        setEventSummary(cachedEventSummary);
      }
    } catch (loadError) {
      console.error('Failed to load Admin V4 data', loadError);
      if (isLatestRefresh()) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load Admin V4 data.');
      }
    } finally {
      if (isLatestRefresh()) {
        setLoading(false);
        restoreScrollPosition();
      }
    }
  };

  useEffect(() => {
    void loadV3Data();
  }, [eventKey, effectiveTbaApiKey]);

  useEffect(() => {
    let cancelled = false;

    const loadComparisonMatches = async () => {
      setIsComparisonLoading(true);
      setComparisonError('');

      const cachedComparisonMatches = await loadLatestCachedPayload(
        PREDICTION_COMPARISON_EVENT_KEY,
        'TBA',
        'matches',
        isCachedTbaMatches
      ).catch(() => null);

      const applyCachedMatches = (message?: string) => {
        if (!cachedComparisonMatches || cancelled) return false;
        setComparisonEventMatches(cachedComparisonMatches.payload);
        setComparisonSourceLabel(
          message || `Cached Shanghai Regional TBA data from ${formatLocalTimestamp(cachedComparisonMatches.timestamp)}`
        );
        return true;
      };

      try {
        applyCachedMatches();

        if (!effectiveTbaApiKey) {
          if (!applyCachedMatches('Live TBA is unavailable. Showing cached Shanghai Regional data.')) {
            setComparisonEventMatches([]);
            setComparisonError('No TBA key or cached Shanghai Regional comparison data is available.');
          }
          return;
        }

        const engine = new MathEngine(effectiveTbaApiKey);
        const matches = await engine.fetchEventMatches(PREDICTION_COMPARISON_EVENT_KEY, { includeUnplayed: true });
        if (cancelled) return;
        setComparisonEventMatches(matches);
        setComparisonSourceLabel('Live Shanghai Regional TBA data');
        void putAdminV2CacheEntry({
          eventKey: PREDICTION_COMPARISON_EVENT_KEY,
          year: getYearFromEventKey(PREDICTION_COMPARISON_EVENT_KEY),
          source: 'TBA',
          key: 'matches',
          payload: matches
        }).catch(() => {});
      } catch (loadError) {
        console.error('Failed to load Shanghai Regional comparison data', loadError);
        if (cancelled) return;
        const usedCache = applyCachedMatches(
          cachedComparisonMatches
            ? `Live TBA failed. Showing cached Shanghai Regional data from ${formatLocalTimestamp(cachedComparisonMatches.timestamp)}.`
            : undefined
        );
        if (!usedCache) {
          setComparisonEventMatches([]);
          setComparisonError(loadError instanceof Error ? loadError.message : 'Failed to load Shanghai Regional comparison data.');
          setComparisonSourceLabel('');
        }
      } finally {
        if (!cancelled) {
          setIsComparisonLoading(false);
        }
      }
    };

    void loadComparisonMatches();

    return () => {
      cancelled = true;
    };
  }, [effectiveTbaApiKey]);

  const searchEvents = async () => {
    if (!effectiveTbaApiKey) {
      setError('TBA API Key is missing.');
      return;
    }

    setIsSearchingEvents(true);
    setError('');

    try {
      const response = await fetch(`https://www.thebluealliance.com/api/v3/events/${searchYear}`, {
        headers: { 'X-TBA-Auth-Key': effectiveTbaApiKey }
      });
      if (!response.ok) throw new Error('Failed to fetch events');
      setSearchResults((await response.json()) as TbaEventSearchResult[]);
    } catch (searchError) {
      console.error(searchError);
      setError('Error searching events.');
    } finally {
      setIsSearchingEvents(false);
    }
  };

  const teamAverages = useMemo(() => buildTeamHistoricalAveragesV4Aware(records, v4Records), [records, v4Records]);
  const defenseMetrics = useMemo(() => buildTeamDefenseMetrics(defenseRecords), [defenseRecords]);
  const teamAverageLookupByTeam = useMemo(
    () => Object.fromEntries(teamAverages.map(row => [row.teamNumber, row])),
    [teamAverages]
  );
  const defenseMetricLookupByTeam = useMemo(
    () => Object.fromEntries(defenseMetrics.map(row => [row.teamNumber, row])),
    [defenseMetrics]
  );
  const averageLookup = useMemo(() => buildHistoricalAverageLookup(teamAverages), [teamAverages]);
  const uploadedScheduleFallback = useMemo(() => getPreferredUploadedSchedule(uploadedCsvPack), [uploadedCsvPack]);
  const effectiveCurrentTbaRanks = useMemo(
    () => (Object.keys(currentTbaRanks).length > 0 ? currentTbaRanks : uploadedCsvPack?.rankings?.rankings || {}),
    [currentTbaRanks, uploadedCsvPack]
  );
  const effectiveCurrentTbaRankOrder = useMemo(
    () => (currentTbaRankOrder.length > 0 ? currentTbaRankOrder : uploadedCsvPack?.rankings?.rankOrder || []),
    [currentTbaRankOrder, uploadedCsvPack]
  );
  const effectiveAlliances = useMemo(
    () => (alliances && alliances.length > 0 ? alliances : uploadedCsvPack?.alliances?.alliances || null),
    [alliances, uploadedCsvPack]
  );
  const effectiveEventSummary = useMemo(
    () => eventSummary || uploadedCsvPack?.eventSummary?.eventSummary || null,
    [eventSummary, uploadedCsvPack]
  );
  const activePredictorMatches = useMemo(
    () => (liveEventMatches.length > 0 ? liveEventMatches : uploadedScheduleFallback?.matches || []),
    [liveEventMatches, uploadedScheduleFallback]
  );
  const uploadedTeamNames = useMemo(() => getUploadedTeamNameLookup(uploadedCsvPack), [uploadedCsvPack]);
  const predictorTeams = useMemo(
    () =>
      Array.from(
        new Set(
          activePredictorMatches
            .flatMap(match => [...match.alliances.red.team_keys, ...match.alliances.blue.team_keys])
            .map(normalizeTeamKey)
            .filter(Boolean)
        )
      ).sort((left, right) => Number(left) - Number(right)),
    [activePredictorMatches]
  );
  const allKnownTeams = useMemo(
    () =>
      Array.from(
        new Set([
          ...records.map(record => record.teamNumber),
          ...v4Records.map(record => record.teamNumber),
          ...defenseRecords.map(record => record.teamNumber),
          ...predictorTeams,
          ...Object.keys(cachedFirstTeamNames),
          ...Object.keys(uploadedTeamNames),
          ...(searchedTeamNumber ? [searchedTeamNumber] : [])
        ])
      ).sort((left, right) => Number(left) - Number(right)),
    [cachedFirstTeamNames, defenseRecords, predictorTeams, records, searchedTeamNumber, uploadedTeamNames, v4Records]
  );

  useEffect(() => {
    let cancelled = false;

    const loadPredictorEpa = async () => {
      if (predictorTeams.length === 0) {
        if (!cancelled) {
          setEpaByTeam({});
          setMissingEpaTeams([]);
          setEpaUnavailable('');
          setIsEpaLoading(false);
        }
        return;
      }

      const cachedEpa = await loadLatestCachedPayload(
        eventKey,
        'Statbotics',
        'event-epa',
        isCachedStatboticsEpaPayload
      ).catch(() => null);
      const applyCachedEpa = (message?: string) => {
        if (!cachedEpa || cancelled) return false;
        const cachedByTeam = cachedEpa.payload.epaByTeam || {};
        setEpaByTeam(cachedByTeam);
        setMissingEpaTeams(
          predictorTeams.filter(teamNumber => !(teamNumber in cachedByTeam))
        );
        setEpaUnavailable(message || '');
        return true;
      };

      if (eventKey === 'TEST') {
        if (!cancelled) {
          setEpaByTeam({});
          setMissingEpaTeams([]);
          setEpaUnavailable('Statbotics EPA is unavailable in TEST mode.');
          setIsEpaLoading(false);
        }
        return;
      }

      setIsEpaLoading(true);
      setEpaUnavailable('');

      try {
        applyCachedEpa();
        const result = await fetchEventStatboticsEpa(eventKey, predictorTeams);
        if (cancelled) return;
        setEpaByTeam(result.epaByTeam);
        setMissingEpaTeams(result.missingTeams);
        void putAdminV2CacheEntry({
          eventKey,
          year: getYearFromEventKey(eventKey),
          source: 'Statbotics',
          key: 'event-epa',
          payload: result
        })
          .then(() => refreshAdminV2CacheEntries())
          .catch(() => {});
      } catch (fetchError) {
        console.error('Failed to load Admin V4 Statbotics EPA predictor data', fetchError);
        if (cancelled) return;
        const usedCache = applyCachedEpa(
          cachedEpa
            ? `Live Statbotics EPA failed. Using cached EPA from ${formatLocalTimestamp(cachedEpa.timestamp)}.`
            : undefined
        );
        if (!usedCache) {
          setEpaByTeam({});
          setMissingEpaTeams([]);
          setEpaUnavailable('Statbotics EPA is unavailable for this event right now. EPA predictions cannot be shown.');
        }
      } finally {
        if (!cancelled) {
          setIsEpaLoading(false);
        }
      }
    };

    void loadPredictorEpa();

    return () => {
      cancelled = true;
    };
  }, [eventKey, predictorTeams, refreshAdminV2CacheEntries]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!searchedTeamNumber) {
        if (!cancelled) {
          setTeamProfile(null);
          setTeamProfileError('');
          setIsTeamProfileLoading(false);
        }
        return;
      }

      const teamProfileCacheKey = `team-profile:${searchedTeamNumber}`;
      const cachedProfile = await loadLatestCachedPayload(
        eventKey,
        'TBA',
        teamProfileCacheKey,
        isCachedPreMatchTeamProfile
      ).catch(() => null);

      if (!effectiveTbaApiKey || eventKey === 'TEST') {
        if (!cancelled) {
          if (cachedProfile) {
            setTeamProfile(cachedProfile.payload);
            setTeamProfileError(`Live TBA profile is unavailable. Showing cached profile from ${formatLocalTimestamp(cachedProfile.timestamp)}.`);
          } else {
            setTeamProfile(null);
            setTeamProfileError('TBA team profile is unavailable for this event on this device.');
          }
          setIsTeamProfileLoading(false);
        }
        return;
      }

      setIsTeamProfileLoading(true);
      setTeamProfileError('');

      try {
        if (cachedProfile && !cancelled) {
          setTeamProfile(cachedProfile.payload);
        }
        const profile = await fetchPreMatchTeamProfile(searchedTeamNumber, eventKey, effectiveTbaApiKey);
        if (cancelled) return;
        setTeamProfile(profile);
        void putAdminV2CacheEntry({
          eventKey,
          year: getYearFromEventKey(eventKey),
          source: 'TBA',
          key: teamProfileCacheKey,
          payload: profile
        })
          .then(() => refreshAdminV2CacheEntries())
          .catch(() => {});
      } catch (profileError) {
        console.error('Failed to load Admin V4 team profile', profileError);
        if (cancelled) return;
        if (cachedProfile) {
          setTeamProfile(cachedProfile.payload);
          setTeamProfileError(`Live TBA profile failed. Showing cached profile from ${formatLocalTimestamp(cachedProfile.timestamp)}.`);
        } else {
          setTeamProfile(null);
          setTeamProfileError(profileError instanceof Error ? profileError.message : 'Failed to load team profile.');
        }
      } finally {
        if (!cancelled) {
          setIsTeamProfileLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [effectiveTbaApiKey, eventKey, refreshAdminV2CacheEntries, searchedTeamNumber]);

  const epaRatings = useMemo(
    () => Object.fromEntries(Object.entries(epaByTeam).map(([teamNumber, metrics]) => [teamNumber, metrics.overallEPA])),
    [epaByTeam]
  );
  const epaQualificationBonusMetrics = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(epaByTeam).map(([teamNumber, metrics]) => [
          teamNumber,
          {
            fuelEPA: metrics.fuelEPA,
            towerEPA: metrics.towerEPA
          }
        ])
      ),
    [epaByTeam]
  );

  const csvOprRatings = uploadedCsvPack?.coprs?.ratings || {};
  const csvOprBonusMetrics = uploadedCsvPack?.coprs?.hasBonusMetrics ? uploadedCsvPack.coprs.bonusMetrics : undefined;
  const csvOprComponents = uploadedCsvPack?.coprs?.componentPoints || {};
  const calculatedOprRatings = useMemo(() => calculateLegacyOprRatings(activePredictorMatches), [activePredictorMatches]);
  const comparisonOprcRatings = useMemo(
    () => calculateLegacyOprcRatings(comparisonEventMatches),
    [comparisonEventMatches]
  );
  const comparisonRows = useMemo(
    () => buildCompletedMatchComparisons(comparisonEventMatches, comparisonOprcRatings, null, null),
    [comparisonEventMatches, comparisonOprcRatings]
  );
  const calculatedDprRatings = useMemo(() => calculateLegacyDprRatings(activePredictorMatches), [activePredictorMatches]);
  const activeOprRatings = Object.keys(csvOprRatings).length > 0 ? csvOprRatings : calculatedOprRatings;
  const missingOprTeams = useMemo(
    () => predictorTeams.filter(teamNumber => !(teamNumber in activeOprRatings)),
    [activeOprRatings, predictorTeams]
  );

  const ppcPredictions = useMemo(
    () => buildPredictedMatchesV3(activePredictorMatches, averageLookup).filter(match => match.compLevel === 'qm'),
    [activePredictorMatches, averageLookup]
  );
  const epaPredictions = useMemo(
    () =>
      buildPredictedMatchesFromRatings(activePredictorMatches, {
        ratings: epaRatings,
        missingTeams: missingEpaTeams
      }).filter(match => match.compLevel === 'qm'),
    [activePredictorMatches, epaRatings, missingEpaTeams]
  );
  const oprPredictions = useMemo(
    () =>
      buildPredictedMatchesFromRatings(activePredictorMatches, {
        ratings: activeOprRatings,
        missingTeams: missingOprTeams
      }).filter(match => match.compLevel === 'qm'),
    [activeOprRatings, activePredictorMatches, missingOprTeams]
  );

  const ppcQualificationProjection = useMemo(
    () =>
      buildQualificationProjection({
        matches: activePredictorMatches,
        currentTbaRanks: effectiveCurrentTbaRanks,
        currentTbaRankOrder: effectiveCurrentTbaRankOrder,
        modelLabel: 'PPC',
        overallRatings: averageLookup
      }),
    [activePredictorMatches, averageLookup, effectiveCurrentTbaRankOrder, effectiveCurrentTbaRanks]
  );
  const epaQualificationProjection = useMemo(
    () =>
      buildQualificationProjection({
        matches: activePredictorMatches,
        currentTbaRanks: effectiveCurrentTbaRanks,
        currentTbaRankOrder: effectiveCurrentTbaRankOrder,
        modelLabel: 'EPA',
        overallRatings: epaRatings,
        qualificationBonusMetrics: epaQualificationBonusMetrics
      }),
    [activePredictorMatches, effectiveCurrentTbaRankOrder, effectiveCurrentTbaRanks, epaQualificationBonusMetrics, epaRatings]
  );
  const oprQualificationProjection = useMemo(
    () =>
      buildQualificationProjection({
        matches: activePredictorMatches,
        currentTbaRanks: effectiveCurrentTbaRanks,
        currentTbaRankOrder: effectiveCurrentTbaRankOrder,
        modelLabel: 'OPR',
        overallRatings: activeOprRatings,
        qualificationBonusMetrics: csvOprBonusMetrics
      }),
    [activeOprRatings, activePredictorMatches, csvOprBonusMetrics, effectiveCurrentTbaRankOrder, effectiveCurrentTbaRanks]
  );
  const resolvedTeamNameLookup = useMemo(
    () => ({
      ...cachedFirstTeamNames,
      ...uploadedTeamNames,
      ...(teamProfile ? { [teamProfile.teamNumber]: teamProfile.nickname } : {})
    }),
    [cachedFirstTeamNames, teamProfile, uploadedTeamNames]
  );

  const adminV2ModelBacktests = useMemo(() => backtestTimeAwareModels({
    matches: activePredictorMatches,
    v3Records: records,
    v4Records,
    epaRatings
  }), [activePredictorMatches, epaRatings, records, v4Records]);
  const adminV2NoFutureBlendLookup = useMemo(
    () => buildAverageBlendLookup([averageLookup, activeOprRatings]),
    [activeOprRatings, averageLookup]
  );
  const adminV2BestForecastLayer = useMemo(() => buildBestModelFutureForecasts({
    matches: activePredictorMatches,
    v3Records: records,
    v4Records,
    epaRatings,
    modelResults: adminV2ModelBacktests,
    ratingLookups: {
      PPC: averageLookup,
      'Rolling PPC': averageLookup,
      OPR: activeOprRatings,
      'Rolling OPR': activeOprRatings,
      'No-Future Blend': adminV2NoFutureBlendLookup,
      EPA: epaRatings,
      'Recency EPA': epaRatings
    }
  }), [activeOprRatings, activePredictorMatches, adminV2ModelBacktests, adminV2NoFutureBlendLookup, averageLookup, epaRatings, records, v4Records]);
  const adminV2PpaRatings = useMemo(() => buildPpaRatings(adminV2ModelBacktests, {
    PPC: averageLookup,
    'Rolling PPC': averageLookup,
    OPR: activeOprRatings,
    'Rolling OPR': activeOprRatings,
    'No-Future Blend': adminV2NoFutureBlendLookup,
    EPA: epaRatings,
    'Recency EPA': epaRatings
  }), [activeOprRatings, adminV2ModelBacktests, adminV2NoFutureBlendLookup, averageLookup, epaRatings]);
  const missingPpaTeams = useMemo(
    () => predictorTeams.filter(teamNumber => !(teamNumber in adminV2PpaRatings)),
    [adminV2PpaRatings, predictorTeams]
  );
  const ppaPredictions = useMemo(
    () =>
      buildPredictedMatchesFromRatings(activePredictorMatches, {
        ratings: adminV2PpaRatings,
        missingTeams: missingPpaTeams
      }).filter(match => match.compLevel === 'qm'),
    [activePredictorMatches, adminV2PpaRatings, missingPpaTeams]
  );
  const ppaQualificationProjection = useMemo(
    () =>
      buildQualificationProjection({
        matches: activePredictorMatches,
        currentTbaRanks: effectiveCurrentTbaRanks,
        currentTbaRankOrder: effectiveCurrentTbaRankOrder,
        modelLabel: 'PPA',
        overallRatings: adminV2PpaRatings
      }),
    [activePredictorMatches, adminV2PpaRatings, effectiveCurrentTbaRankOrder, effectiveCurrentTbaRanks]
  );
  const activePredictions =
    selectedMetric === 'ppc'
      ? ppcPredictions
      : selectedMetric === 'epa'
        ? epaPredictions
        : selectedMetric === 'ppa'
          ? ppaPredictions
          : oprPredictions;
  const activeQualificationProjection =
    selectedMetric === 'ppc'
      ? ppcQualificationProjection
      : selectedMetric === 'epa'
        ? epaQualificationProjection
        : selectedMetric === 'ppa'
          ? ppaQualificationProjection
          : oprQualificationProjection;
  const activeMetricRatings =
    selectedMetric === 'ppc'
      ? averageLookup
      : selectedMetric === 'epa'
        ? epaRatings
        : selectedMetric === 'ppa'
        ? adminV2PpaRatings
        : activeOprRatings;
  const selectedMatch = useMemo(
    () => activePredictorMatches.find(match => match.key === selectedMatchKey) || null,
    [activePredictorMatches, selectedMatchKey]
  );
  const selectedPrediction = useMemo(
    () => activePredictions.find(match => match.key === selectedMatchKey) || null,
    [activePredictions, selectedMatchKey]
  );
  const filteredQualificationRows = useMemo(() => {
    const normalizedSearch = rankingSearch.trim().toLowerCase();
    if (!normalizedSearch) return activeQualificationProjection.rows;
    return activeQualificationProjection.rows.filter(row => {
      const teamName = resolvedTeamNameLookup[row.teamNumber] || '';
      return row.teamNumber.toLowerCase().includes(normalizedSearch) || teamName.toLowerCase().includes(normalizedSearch);
    });
  }, [activeQualificationProjection.rows, rankingSearch, resolvedTeamNameLookup]);
  const adminV2FeatureMatchSnapshots = useMemo(
    () => buildNoFutureFeatureMatchSnapshots({
      matches: activePredictorMatches,
      v3Records: records,
      v4Records
    }),
    [activePredictorMatches, records, v4Records]
  );
  const adminV2DefenseImpactLookup = useMemo(
    () =>
      buildDefenseImpactLookup(
        buildDefenseAttributions(
          v4Records,
          Object.keys(adminV2PpaRatings).length > 0 ? adminV2PpaRatings : activeMetricRatings
        )
      ),
    [activeMetricRatings, adminV2PpaRatings, v4Records]
  );
  const adminV2BonusMetricLookup = useMemo(
    () => buildScoutedBonusMetricLookup(records, v4Records),
    [records, v4Records]
  );
  const adminV2StrategyMatchPlans = useMemo(
    () =>
      buildStrategyMatchPlans(
        activePredictorMatches,
        activeMetricRatings,
        adminV2DefenseImpactLookup,
        adminV2BonusMetricLookup,
        adminV2BestForecastLayer
      ),
    [
      activeMetricRatings,
      activePredictorMatches,
      adminV2BestForecastLayer,
      adminV2BonusMetricLookup,
      adminV2DefenseImpactLookup
    ]
  );
  const selectedStrategyMatchPlan = useMemo(
    () => adminV2StrategyMatchPlans.find(plan => plan.matchKey === selectedMatchKey) || null,
    [adminV2StrategyMatchPlans, selectedMatchKey]
  );
  const teamPerformanceProfiles = useMemo(
    () =>
      buildTeamPerformanceProfiles({
        v4Records,
        v3Records: records,
        defenseRecords,
        ppcRows: teamAverages,
        oprRatings: activeOprRatings,
        dprRatings: calculatedDprRatings,
        epaRatings,
        ppaRatings: adminV2PpaRatings,
        defenseImpactLookup: adminV2DefenseImpactLookup,
        featureMatchSnapshots: adminV2FeatureMatchSnapshots
      }),
    [
      activeOprRatings,
      adminV2DefenseImpactLookup,
      adminV2FeatureMatchSnapshots,
      adminV2PpaRatings,
      calculatedDprRatings,
      defenseRecords,
      epaRatings,
      records,
      teamAverages,
      v4Records
    ]
  );
  const modelFeaturesByTeam = useMemo(() => {
    const ppcByTeam = Object.fromEntries(teamAverages.map(row => [row.teamNumber, row]));
    const defenseMetricBuckets = new Map<string, MatchDefenseScoutingV1[]>();
    defenseRecords.forEach(record => {
      const bucket = defenseMetricBuckets.get(record.teamNumber) || [];
      bucket.push(record);
      defenseMetricBuckets.set(record.teamNumber, bucket);
    });

    return Object.fromEntries(teamPerformanceProfiles.map(profile => {
      const ppcRow = ppcByTeam[profile.teamNumber];
      const defenseMetricRows = defenseMetricBuckets.get(profile.teamNumber) || [];
      const avgDefenseMetric =
        defenseMetricRows.length === 0
          ? 0
          : defenseMetricRows.reduce((sum, record) => sum + record.defenseMetric, 0) / defenseMetricRows.length;
      return [
        profile.teamNumber,
        {
          ppc: profile.ppc ?? 0,
          cppcAuto: ppcRow?.avgAutoPoints ?? 0,
          cppcTeleop: ppcRow?.avgTeleopPoints ?? 0,
          opr: profile.opr ?? 0,
          dpr: profile.dpr ?? 0,
          epa: profile.epa ?? 0,
          ppa: profile.ppa ?? 0,
          defenseImpact: profile.defenseImpact ?? 0,
          defenseMetric: avgDefenseMetric,
          matchesPlayed: profile.matchesPlayed,
          peakScore: profile.peakScore,
          floorScore: profile.floorScore,
          ceilingScore: profile.ceilingScore,
          averageScore: profile.averageScore,
          standardDeviation: profile.standardDeviation,
          projectedNextScore: profile.projectedNextScore,
          volatility: profile.volatility,
          consistencyIndex: profile.consistencyIndex,
          upsetPotential: profile.upsetPotential,
          zeroRate: profile.zeroRate,
          reliability: profile.reliability,
          recentTrend: profile.recentTrend
        }
      ];
    }));
  }, [defenseRecords, teamAverages, teamPerformanceProfiles]);
  const bestModelBacktest = useMemo(
    () =>
      adminV2ModelBacktests.find(result => result.matchesTested > 0 && result.eligibleForPromotion) ||
      adminV2ModelBacktests.find(result => result.matchesTested > 0) ||
      null,
    [adminV2ModelBacktests]
  );
  const usableModelCount = useMemo(
    () => adminV2ModelBacktests.filter(result => result.matchesTested > 0).length,
    [adminV2ModelBacktests]
  );
  const promotionCandidateCount = useMemo(
    () => adminV2ModelBacktests.filter(result => result.matchesTested > 0 && result.eligibleForPromotion).length,
    [adminV2ModelBacktests]
  );
  const scoutCalibrationRows = useMemo(
    () => buildScoutCalibrationRows(v4Records, activePredictorMatches),
    [activePredictorMatches, v4Records]
  );
  const powerCoinRows = useMemo(() => {
    const scouts = Array.from(new Set([
      ...DEFAULT_SCOUTS,
      ...(scoutAssignmentPlan?.scoutNames || []),
      ...powerCoinBets.map(bet => bet.scoutName),
      ...powerCoinLedger.map(entry => entry.scoutName)
    ])).filter(Boolean);

    return scouts.map(scoutName => {
      const normalizedScoutName = scoutName.trim().toLowerCase();
      const scoutBets = powerCoinBets.filter(bet => bet.scoutName.trim().toLowerCase() === normalizedScoutName);
      const scoutLedger = powerCoinLedger.filter(entry => entry.scoutName.trim().toLowerCase() === normalizedScoutName);
      const ledgerDelta = scoutLedger.reduce((sum, entry) => sum + entry.delta, 0);
      const openStake = scoutBets.filter(bet => !bet.settledAt).reduce((sum, bet) => sum + bet.amount, 0);
      const settledDelta = scoutBets
        .filter(bet => bet.settledAt)
        .reduce((sum, bet) => sum + ((bet.payout ?? 0) - bet.amount), 0);
      return {
        scoutName,
        balance: STARTING_POWERCOINS + ledgerDelta - openStake + settledDelta,
        openBets: scoutBets.filter(bet => !bet.settledAt).length,
        openStake,
        settledBets: scoutBets.filter(bet => bet.settledAt).length,
        totalStaked: scoutBets.reduce((sum, bet) => sum + bet.amount, 0),
        totalPayout: scoutBets.reduce((sum, bet) => sum + (bet.payout ?? 0), 0),
        ledgerDelta
      };
    }).sort((left, right) => right.balance - left.balance || left.scoutName.localeCompare(right.scoutName));
  }, [powerCoinBets, powerCoinLedger, scoutAssignmentPlan]);
  const scoutExposureRows = useMemo(() => {
    if (!scoutAssignmentPlan) return [];
    return scoutAssignmentPlan.scoutNames.map(scoutName => {
      const scoutAssignments = scoutAssignmentPlan.assignments.filter(assignment => assignment.scoutName === scoutName);
      const exposureCounts = scoutAssignmentPlan.exposureCounts[scoutName] || {};
      const topTeamExposures = Object.entries(exposureCounts)
        .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]))
        .slice(0, 4)
        .map(([teamNumber, count]) => ({ teamNumber, count }));
      return {
        scoutName,
        assignments: scoutAssignments.length,
        distinctTeams: Object.keys(exposureCounts).length,
        repeatFocus: Object.values(exposureCounts).filter(count => count > 1).length,
        ourMatchAssignments: scoutAssignments.filter(assignment => assignment.priorityReason === 'Our match priority').length,
        topTeamExposures
      };
    }).sort((left, right) => right.assignments - left.assignments || left.scoutName.localeCompare(right.scoutName));
  }, [scoutAssignmentPlan]);
  const bestModelJudgeSummary = useMemo(() => {
    const decidedRows = (bestModelBacktest?.comparisonRows || []).filter(row => row.actualWinner !== 'Tie' && row.predictedWinner !== 'Tie');
    const correctRows = decidedRows.filter(row => row.winnerPickCorrect);
    const highConfidenceRows = decidedRows.filter(row => row.confidence >= 0.65);
    const highConfidenceCorrectRows = highConfidenceRows.filter(row => row.winnerPickCorrect);

    return {
      decidedMatches: decidedRows.length,
      correctWinnerPicks: correctRows.length,
      winnerAccuracy: decidedRows.length > 0 ? correctRows.length / decidedRows.length : null,
      highConfidenceMatches: highConfidenceRows.length,
      highConfidenceAccuracy: highConfidenceRows.length > 0 ? highConfidenceCorrectRows.length / highConfidenceRows.length : null
    };
  }, [bestModelBacktest]);
  const ppaInsightsByTeam = useMemo(
    () =>
      buildPpaInsights({
        teamNumbers: allKnownTeams,
        teamNameLookup: resolvedTeamNameLookup,
        ppaRatings: adminV2PpaRatings,
        profiles: teamPerformanceProfiles,
        modelName: adminV2BestForecastLayer.modelName,
        modelSource: adminV2BestForecastLayer.modelSource
      }),
    [
      adminV2BestForecastLayer.modelName,
      adminV2BestForecastLayer.modelSource,
      adminV2PpaRatings,
      allKnownTeams,
      resolvedTeamNameLookup,
      teamPerformanceProfiles
    ]
  );
  const allianceRecommendations = useMemo(
    () =>
      buildAlliancePickRecommendations(
        teamPerformanceProfiles,
        allianceSeed,
        alliancePickStatuses,
        ownTeamNumber
      ),
    [alliancePickStatuses, allianceSeed, ownTeamNumber, teamPerformanceProfiles]
  );
  const pickListSummary = useMemo(() => {
    const availableRows = allianceRecommendations.filter(row => row.status === 'available');
    const selectedRows = allianceRecommendations.filter(row => row.status === 'picked');
    return {
      selected: selectedRows.length,
      available: availableRows.length,
      unavailable: allianceRecommendations.length - availableRows.length,
      topPick: availableRows[0] || null,
      highRiskAvailable: availableRows.filter(row => ppaInsightsByTeam[row.teamNumber]?.tailRisk.level === 'High').length,
      defenderFlexAvailable: availableRows.filter(row => {
        const role = ppaInsightsByTeam[row.teamNumber]?.role.label;
        const defenseValue = ppaInsightsByTeam[row.teamNumber]?.components.defenseImpact ?? 0;
        return role === 'Defender' || role === 'Flex' || defenseValue > 0 || row.roleFit.toLowerCase().includes('defense');
      }).length
    };
  }, [allianceRecommendations, ppaInsightsByTeam]);

  useEffect(() => {
    if (adminV2ModelBacktests.length === 0) return;
    const createdAt = Date.now();
    const snapshot: ModelLabSnapshot = {
      id: `${eventKey}_${createdAt}`,
      eventKey,
      createdAt,
      selectedPromotedModel: bestModelBacktest?.modelName || '',
      selectedForecastModel: adminV2BestForecastLayer.modelName,
      ppaTeamCount: Object.keys(adminV2PpaRatings).length,
      modelResults: adminV2ModelBacktests
    };
    const featureSnapshot: ModelFeatureSnapshot = {
      id: `${eventKey}_features_${createdAt}`,
      eventKey,
      modelName: adminV2BestForecastLayer.modelName,
      beforeMatchKey: 'latest',
      createdAt,
      featuresByTeam: modelFeaturesByTeam,
      matchSnapshots: adminV2FeatureMatchSnapshots
    };

    let cancelled = false;
    void Promise.all([
      saveModelLabSnapshot(snapshot),
      saveModelFeatureSnapshot(featureSnapshot)
    ])
      .then(() => {
        if (cancelled) return;
        setLatestModelSnapshot(snapshot);
        setLatestFeatureSnapshot(featureSnapshot);
        setModelSnapshotStatus(`Saved model snapshot at ${formatLocalTimestamp(createdAt)}`);
      })
      .catch(error => {
        console.warn('Failed to save Admin V4 model snapshot', error);
        if (!cancelled) setModelSnapshotStatus('Model snapshot save failed on this device.');
      });
    return () => {
      cancelled = true;
    };
  }, [
    adminV2BestForecastLayer.modelName,
    adminV2FeatureMatchSnapshots,
    adminV2ModelBacktests,
    adminV2PpaRatings,
    bestModelBacktest?.modelName,
    eventKey,
    modelFeaturesByTeam
  ]);

  const selectedTeamPerformanceProfile = useMemo(
    () => (searchedTeamNumber ? teamPerformanceProfiles.find(profile => profile.teamNumber === searchedTeamNumber) || null : null),
    [searchedTeamNumber, teamPerformanceProfiles]
  );
  const selectedTeamPpaInsight = searchedTeamNumber ? ppaInsightsByTeam[searchedTeamNumber] || null : null;
  const validatedQualForecastRows = useMemo(() =>
    activePredictorMatches
      .filter(match => match.comp_level === 'qm' && !isPlayedMatch(match))
      .map(match => {
        const forecast = adminV2BestForecastLayer.forecasts[match.key];
        const redScore = forecast?.redScore ?? 0;
        const blueScore = forecast?.blueScore ?? 0;
        return {
          key: match.key,
          title: match.key.split('_')[1]?.toUpperCase() || match.key.toUpperCase(),
          redTeams: match.alliances.red.team_keys.map(normalizeTeamKey),
          blueTeams: match.alliances.blue.team_keys.map(normalizeTeamKey),
          redScore,
          blueScore,
          winner: redScore === blueScore ? 'Tie' : redScore > blueScore ? 'Red' : 'Blue',
          lowConfidence: forecast?.lowConfidence ?? true
        };
      })
      .sort((left, right) => left.title.localeCompare(right.title, undefined, { numeric: true })),
    [activePredictorMatches, adminV2BestForecastLayer]
  );
  const finalsProjection = useMemo(
    () =>
      buildPlayoffProjection(
        effectiveAlliances,
        activePredictorMatches.filter(match => match.comp_level !== 'qm' && match.comp_level !== 'pm'),
        activePredictorMatches.filter(isPlayedMatch),
        activeMetricRatings,
        effectiveEventSummary
      ),
    [activeMetricRatings, activePredictorMatches, effectiveAlliances, effectiveEventSummary]
  );

  const predictorUnavailableMessage =
    selectedMetric === 'epa'
      ? epaUnavailable
      : selectedMetric === 'opr' && activePredictorMatches.length === 0 && liveScheduleUnavailable && !uploadedScheduleFallback
        ? 'No live or uploaded schedule is available for OPR forecasting.'
        : '';
  const predictorIsLoading = selectedMetric === 'epa' && isEpaLoading;
  const predictorMatchSourceLabel =
    liveEventMatches.length > 0
      ? matchSourceLabel || 'Live TBA schedule'
      : uploadedScheduleFallback
        ? `${uploadedScheduleFallback.fileName} (${uploadedScheduleFallback.source === 'schedule' ? 'schedule fallback' : 'flat schedule fallback'})`
        : 'No live or uploaded schedule';
  const hasUsableCsvOpr = !!uploadedCsvPack?.coprs && Object.keys(csvOprRatings).length > 0;
  const hasOprBonusMetrics = !!csvOprBonusMetrics && Object.keys(csvOprBonusMetrics).length > 0;

  const activeTeamAverage = searchedTeamNumber ? teamAverageLookupByTeam[searchedTeamNumber] : undefined;
  const activeDefenseMetric = searchedTeamNumber ? defenseMetricLookupByTeam[searchedTeamNumber] : undefined;
  const activeEpaMetrics = searchedTeamNumber ? epaByTeam[searchedTeamNumber] : undefined;
  const activeOprComponents = searchedTeamNumber ? csvOprComponents[searchedTeamNumber] : undefined;

  const teamMetricSummary = useMemo<TeamMetricSummary | null>(() => {
    if (!searchedTeamNumber) return null;

    if (selectedMetric === 'ppc') {
      if (!activeTeamAverage) {
        return {
          currentMetricLabel: 'PPC',
          currentMetricValue: null,
          autoComponent: null,
          teleopComponent: null,
          sourceLabel: 'No scouting history yet',
          extras: []
        };
      }

      return {
        currentMetricLabel: 'PPC',
        currentMetricValue: activeTeamAverage.avgTotalMatchPoints,
        autoComponent: activeTeamAverage.avgAutoPoints,
        teleopComponent: activeTeamAverage.avgTeleopPoints,
        sourceLabel: 'Scouting averages',
        extras: [
          { label: 'Matches Logged', value: String(activeTeamAverage.matchesPlayed) },
          { label: 'Avg Endgame', value: activeTeamAverage.avgEndgamePoints.toFixed(2) },
          { label: 'Avg Cycles', value: activeTeamAverage.avgTeleopCycles.toFixed(2) },
          { label: 'Avg Reliability', value: formatPercentMetric(activeTeamAverage.avgReliabilityScore) },
          { label: 'Avg Contribution', value: activeTeamAverage.avgContributionScore.toFixed(2) }
        ]
      };
    }

    if (selectedMetric === 'opr') {
      return {
        currentMetricLabel: 'OPR',
        currentMetricValue: activeOprRatings[searchedTeamNumber] ?? null,
        autoComponent: activeOprComponents?.autoPoints ?? null,
        teleopComponent: activeOprComponents?.teleopPoints ?? null,
        sourceLabel: hasUsableCsvOpr ? 'Uploaded TBA OPR' : 'Calculated OPR',
        extras: [
          { label: 'Tower', value: formatMetricValue(activeOprComponents?.towerPoints ?? null) },
          { label: 'Fuel', value: formatMetricValue(activeOprComponents?.fuelPoints ?? null) },
          { label: 'Total Points', value: formatMetricValue(activeOprComponents?.totalPoints ?? null) }
        ]
      };
    }

    if (selectedMetric === 'ppa') {
      const insight = selectedTeamPpaInsight;
      return {
        currentMetricLabel: 'PPA',
        currentMetricValue: insight?.rating ?? adminV2PpaRatings[searchedTeamNumber] ?? null,
        autoComponent: null,
        teleopComponent: null,
        sourceLabel: insight ? `${insight.source.label} · ${insight.coverage.label}` : 'Best validated model estimate',
        extras: [
          { label: 'Role Fit', value: insight?.role.label || 'Unknown' },
          { label: 'Uncertainty', value: insight ? insight.uncertainty.level : 'Unknown' },
          { label: 'Tail Risk', value: insight ? insight.tailRisk.level : 'Unknown' },
          { label: 'Scout Confidence', value: insight ? formatPercentMetric(insight.coverage.scoutConfidence, 0) : '—' },
          { label: 'PPC', value: formatMetricValue(activeTeamAverage?.avgTotalMatchPoints ?? null) },
          { label: 'OPR', value: formatMetricValue(activeOprRatings[searchedTeamNumber] ?? null) },
          { label: 'EPA', value: formatMetricValue(activeEpaMetrics?.overallEPA ?? null) },
          { label: 'Defense Impact', value: formatMetricValue(selectedTeamPerformanceProfile?.defenseImpact ?? null) }
        ]
      };
    }

    return {
      currentMetricLabel: 'EPA',
      currentMetricValue: activeEpaMetrics?.overallEPA ?? null,
      autoComponent: activeEpaMetrics?.autoEPA ?? null,
      teleopComponent: activeEpaMetrics?.teleopEPA ?? null,
      sourceLabel: activeEpaMetrics ? `Statbotics ${activeEpaMetrics.source === 'team_event' ? 'Event EPA' : 'Team-Year EPA'}` : 'EPA unavailable',
      extras: [
        { label: 'Tower', value: formatMetricValue(activeEpaMetrics?.towerEPA ?? null) },
        { label: 'Fuel', value: formatMetricValue(activeEpaMetrics?.fuelEPA ?? null) }
      ]
    };
  }, [
    activeEpaMetrics,
    activeDefenseMetric,
    activeOprComponents,
    activeOprRatings,
    activeTeamAverage,
    adminV2PpaRatings,
    hasUsableCsvOpr,
    searchedTeamNumber,
    selectedMetric,
    selectedTeamPerformanceProfile,
    selectedTeamPpaInsight
  ]);

  const summary = useMemo(() => {
    const distinctTeams = new Set([...v4Records.map(record => record.teamNumber), ...defenseRecords.map(record => record.teamNumber)]).size;
    const averageDefenseMetric =
      defenseRecords.length === 0
        ? 0
        : defenseRecords.reduce((sum, record) => sum + record.defenseMetric, 0) / defenseRecords.length;
    return {
      rows: v4Records.length + defenseRecords.length,
      teams: distinctTeams,
      averageDefenseMetric
    };
  }, [defenseRecords, v4Records]);

  const filteredResultsRecords = useMemo(() => {
    const targetMatchType = resultsViewTab === 'quals' ? 'Qualification' : 'Practice';
    return [
      ...v4Records.filter(record => record.matchType === targetMatchType).map(record => ({ kind: 'v4' as const, record })),
      ...defenseRecords.filter(record => record.matchType === targetMatchType).map(record => ({ kind: 'defense' as const, record }))
    ]
      .sort((left, right) => {
        const matchDelta = left.record.matchNumber - right.record.matchNumber;
        if (matchDelta !== 0) return matchDelta;
        return Number(left.record.teamNumber) - Number(right.record.teamNumber);
      });
  }, [defenseRecords, resultsViewTab, v4Records]);

  const rawEditorRecords = useMemo<AdminV2RawEditorRecord[]>(
    () =>
      v4Records.map(record => ({
        ...record,
        id: `v4_${record.matchKey}_${record.teamNumber}`
      })),
    [v4Records]
  );
  const rawEditorGroups = useMemo(() => {
    const targetMatchType = rawEditorViewTab === 'quals' ? 'Qualification' : 'Practice';
    const targetCompLevel = rawEditorViewTab === 'quals' ? 'qm' : 'pm';
    const groups = buildMatchValidationGroups(
      rawEditorRecords.filter(record => record.matchType === targetMatchType),
      activePredictorMatches.filter(match => match.comp_level === targetCompLevel)
    );
    return filterMatchValidationGroups(groups, rawEditorSearch);
  }, [activePredictorMatches, rawEditorRecords, rawEditorSearch, rawEditorViewTab]);
  const rawEditorSummary = useMemo(() => {
    const scheduledGroups = rawEditorGroups.filter(group => group.scheduleKnown);
    const completeScheduledGroups = scheduledGroups.filter(
      group =>
        group.expectedSlots.length > 0 &&
        group.missingSlots.length === 0 &&
        group.rows.length >= group.expectedSlots.length &&
        group.rows.every(row => row.anomalies.length === 0)
    );
    const missingSlotCount = rawEditorGroups.reduce((sum, group) => sum + group.missingSlots.length, 0);
    const anomalyRowCount = rawEditorGroups.reduce(
      (sum, group) => sum + group.rows.filter(row => row.anomalies.length > 0).length,
      0
    );
    const submittedRowCount = rawEditorGroups.reduce((sum, group) => sum + group.rows.length, 0);
    return {
      visibleMatches: rawEditorGroups.length,
      scheduledMatches: scheduledGroups.length,
      completeScheduledMatches: completeScheduledGroups.length,
      missingSlotCount,
      anomalyRowCount,
      submittedRowCount,
      scheduleUnknownMatches: rawEditorGroups.length - scheduledGroups.length
    };
  }, [rawEditorGroups]);

  const activePitArchiveRecords = useMemo(
    () => localArchiveSummary.activeRecords.filter(record => record.recordType === 'pit'),
    [localArchiveSummary.activeRecords]
  );

  const ppaReadinessSummary = useMemo(() => {
    const insights = Object.values(ppaInsightsByTeam);
    const shapedInsights = insights.filter(insight => insight.rating != null || insight.projected.expected != null);
    const highUncertainty = shapedInsights.filter(insight => insight.uncertainty.level === 'High').length;
    const noLocalRows = shapedInsights.filter(insight => insight.components.matchesLogged === 0).length;
    const lowConfidence = shapedInsights.filter(insight => insight.coverage.scoutConfidence < 0.5).length;
    return {
      shapedInsights: shapedInsights.length,
      highUncertainty,
      noLocalRows,
      lowConfidence
    };
  }, [ppaInsightsByTeam]);

  const collectionPipelineStages = useMemo<CollectionPipelineStage[]>(() => {
    const matchRowCount = records.length + v4Records.length;
    return [
      {
        key: 'preScout',
        count: allKnownTeams.length,
        countLabel: 'known teams',
        readinessLabel: allKnownTeams.length > 0 ? 'Public context ready' : 'Needs event list',
        readinessDetail: allKnownTeams.length > 0
          ? 'Seeds early expectations and pit-scout priorities before local rows exist.'
          : 'Load a live or uploaded schedule/team list so Pre Scout can create priorities.',
        tone: allKnownTeams.length > 0 ? 'emerald' : 'amber'
      },
      {
        key: 'pitScout',
        count: activePitArchiveRecords.length,
        countLabel: 'pit priors',
        readinessLabel: activePitArchiveRecords.length > 0 ? 'Capability priors live' : 'No pit priors',
        readinessDetail: activePitArchiveRecords.length > 0
          ? 'Robot capabilities can inform role fit, compatibility, and pick-list context.'
          : 'Interview pits for capability, compatibility, and questions match scouts should verify.',
        tone: activePitArchiveRecords.length > 0 ? 'emerald' : 'amber'
      },
      {
        key: 'matchScout',
        count: matchRowCount,
        countLabel: 'match rows',
        readinessLabel: rawEditorSummary.missingSlotCount > 0 ? 'Coverage gaps' : matchRowCount > 0 ? 'PPA signal forming' : 'No scoring rows',
        readinessDetail: rawEditorSummary.missingSlotCount > 0
          ? `${rawEditorSummary.missingSlotCount} scheduled scout slot${rawEditorSummary.missingSlotCount === 1 ? '' : 's'} still missing.`
          : matchRowCount > 0
            ? 'Expected value, repeatability, volatility, and scout confidence are feeding PPA.'
            : 'Collect match rows before trusting PPA beyond public/model fallback.',
        tone: rawEditorSummary.missingSlotCount > 0 ? 'rose' : matchRowCount > 0 ? 'emerald' : 'amber'
      },
      {
        key: 'defenseScout',
        count: defenseRecords.length,
        countLabel: 'defense rows',
        readinessLabel: defenseRecords.length > 0 ? 'Role protection live' : 'No defense evidence',
        readinessDetail: defenseRecords.length > 0
          ? 'Defense impact can stop PPA from mistaking strategic sacrifice for weak offense.'
          : 'Add defense evidence for teams that deny points or play non-scoring roles.',
        tone: defenseRecords.length > 0 ? 'emerald' : 'amber'
      }
    ];
  }, [
    activePitArchiveRecords.length,
    allKnownTeams.length,
    defenseRecords.length,
    rawEditorSummary.missingSlotCount,
    records.length,
    v4Records.length
  ]);

  const ppaReadinessCards = useMemo<PpaReadinessCard[]>(() => [
    {
      label: 'PPA Shapes',
      value: ppaReadinessSummary.shapedInsights,
      detail: 'Teams with expected/floor/ceiling model context.',
      tone: ppaReadinessSummary.shapedInsights > 0 ? 'emerald' : 'amber'
    },
    {
      label: 'High Uncertainty',
      value: ppaReadinessSummary.highUncertainty,
      detail: 'Treat these teams as ranges until scouting coverage improves.',
      tone: ppaReadinessSummary.highUncertainty > 0 ? 'amber' : 'emerald'
    },
    {
      label: 'Fallback Only',
      value: ppaReadinessSummary.noLocalRows,
      detail: 'PPA exists without local match rows backing it yet.',
      tone: ppaReadinessSummary.noLocalRows > 0 ? 'amber' : 'emerald'
    },
    {
      label: 'Low Confidence',
      value: ppaReadinessSummary.lowConfidence,
      detail: 'Teams where PPA should be read cautiously because scouting coverage is thin.',
      tone: ppaReadinessSummary.lowConfidence > 0 ? 'amber' : 'emerald'
    },
    {
      label: 'Unsynced Local',
      value: localArchiveSummary.unsyncedRecords.length,
      detail: 'Rows saved locally but not yet confirmed in Firebase.',
      tone: localArchiveSummary.unsyncedRecords.length > 0 ? 'rose' : 'emerald'
    }
  ], [localArchiveSummary.unsyncedRecords.length, ppaReadinessSummary]);

  const sorterRows = useMemo<AdminV2SorterRow[]>(() => {
    return allKnownTeams.map(teamNumber => {
      const teamAverage = teamAverageLookupByTeam[teamNumber];
      const defenseMetric = defenseMetricLookupByTeam[teamNumber];
      const ppaInsight = ppaInsightsByTeam[teamNumber];
      return {
        teamNumber,
        teamName: resolvedTeamNameLookup[teamNumber] || '',
        matches: teamAverage?.matchesPlayed ?? 0,
        ppa: ppaInsight?.rating ?? adminV2PpaRatings[teamNumber] ?? null,
        ppaRole: ppaInsight?.role.label ?? 'Unknown',
        ppaUncertainty: ppaInsight?.uncertainty.level ?? 'High',
        ppaCoverage: ppaInsight?.coverage.label ?? 'No PPA context',
        ppc: teamAverage?.avgTotalMatchPoints ?? null,
        autoPpc: teamAverage?.avgAutoPoints ?? null,
        teleopPpc: teamAverage?.avgTeleopPoints ?? null,
        defenseMetric: defenseMetric?.avgDefenseMetric ?? null,
        defenseRecords: defenseMetric?.recordsLogged ?? 0,
        epa: epaRatings[teamNumber] ?? null,
        opr: activeOprRatings[teamNumber] ?? null,
        dpr: calculatedDprRatings[teamNumber] ?? null,
        tbaRank: effectiveCurrentTbaRanks[teamNumber] ?? null
      };
    });
  }, [
    activeOprRatings,
    allKnownTeams,
    adminV2PpaRatings,
    calculatedDprRatings,
    defenseMetricLookupByTeam,
    epaRatings,
    effectiveCurrentTbaRanks,
    ppaInsightsByTeam,
    resolvedTeamNameLookup,
    teamAverageLookupByTeam
  ]);

  const sortedSorterRows = useMemo(() => {
    const getValue = (row: AdminV2SorterRow, field: SorterField) => {
      switch (field) {
        case 'team':
          return Number(row.teamNumber);
        case 'tbaRank':
          return row.tbaRank ?? Number.POSITIVE_INFINITY;
        case 'matches':
          return row.matches;
        case 'ppa':
          return row.ppa ?? Number.NEGATIVE_INFINITY;
        case 'ppc':
          return row.ppc ?? Number.NEGATIVE_INFINITY;
        case 'autoPpc':
          return row.autoPpc ?? Number.NEGATIVE_INFINITY;
        case 'teleopPpc':
          return row.teleopPpc ?? Number.NEGATIVE_INFINITY;
        case 'defenseMetric':
          return row.defenseMetric ?? Number.NEGATIVE_INFINITY;
        case 'epa':
          return row.epa ?? Number.NEGATIVE_INFINITY;
        case 'opr':
          return row.opr ?? Number.NEGATIVE_INFINITY;
        case 'dpr':
          return row.dpr ?? Number.POSITIVE_INFINITY;
      }
    };

    return [...sorterRows].sort((left, right) => {
      const leftValue = getValue(left, sorterField);
      const rightValue = getValue(right, sorterField);

      if (leftValue < rightValue) return sorterDirection === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sorterDirection === 'asc' ? 1 : -1;
      return Number(left.teamNumber) - Number(right.teamNumber);
    });
  }, [sorterDirection, sorterField, sorterRows]);

  const getTeamHighlight = useCallback(
    (teamNumber: string): 'own' | 'searched' | 'both' | undefined => {
      const isOwn = ownTeamNumber !== '' && ownTeamNumber === teamNumber;
      const isSearched = searchedTeamNumber !== '' && searchedTeamNumber === teamNumber;
      if (isOwn && isSearched) return 'both';
      if (isOwn) return 'own';
      if (isSearched) return 'searched';
      return undefined;
    },
    [ownTeamNumber, searchedTeamNumber]
  );

  const topOffenseRows = useMemo(
    () => {
      const selectedValue = (row: AdminV2SorterRow) => activeMetricRatings[row.teamNumber] ?? null;
      const bestAvailableValue = (row: AdminV2SorterRow) => selectedValue(row) ?? row.opr ?? row.epa ?? row.ppc;
      return sorterRows
        .map(row => ({ row, value: bestAvailableValue(row) }))
        .filter(item => item.value != null && Number.isFinite(item.value))
        .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))
        .slice(0, 14)
        .map(({ row, value }) => ({
          key: row.teamNumber,
          label: row.teamNumber,
          value: value ?? 0,
          secondary: row.teamName || undefined,
          highlighted: getTeamHighlight(row.teamNumber)
        }));
    },
    [activeMetricRatings, getTeamHighlight, sorterRows]
  );

  const topDefenseRows = useMemo(
    () =>
      sorterRows
        .filter(row => row.defenseMetric != null && Number.isFinite(row.defenseMetric))
        .sort((left, right) => (right.defenseMetric ?? 0) - (left.defenseMetric ?? 0))
        .slice(0, 12)
        .map(row => ({
          key: row.teamNumber,
          label: row.teamNumber,
          value: row.defenseMetric ?? 0,
          secondary: row.teamName || undefined,
          highlighted: getTeamHighlight(row.teamNumber)
        })),
    [getTeamHighlight, sorterRows]
  );

  const volatilityRows = useMemo(
    () =>
      teamPerformanceProfiles
        .filter(profile => Number.isFinite(profile.volatility))
        .sort((left, right) => right.volatility - left.volatility)
        .slice(0, 12)
        .map(profile => ({
          key: profile.teamNumber,
          label: profile.teamNumber,
          value: profile.volatility,
          secondary: resolvedTeamNameLookup[profile.teamNumber] || undefined,
          highlighted: getTeamHighlight(profile.teamNumber)
        })),
    [getTeamHighlight, resolvedTeamNameLookup, teamPerformanceProfiles]
  );

  const ppaShapeRows = useMemo<PpaShapeChartRow[]>(() =>
    Object.values(ppaInsightsByTeam)
      .map(insight => {
        const expected = insight.projected.expected ?? insight.rating;
        if (expected == null || !Number.isFinite(expected)) return null;
        return {
          key: insight.teamNumber,
          label: insight.teamNumber,
          secondary: insight.teamName || resolvedTeamNameLookup[insight.teamNumber] || undefined,
          expected,
          floor: insight.projected.floor ?? expected,
          ceiling: insight.projected.ceiling ?? expected,
          normalLow: insight.projected.normalLow,
          normalHigh: insight.projected.normalHigh,
          role: insight.role.label,
          uncertainty: insight.uncertainty.level,
          tailRisk: insight.tailRisk.level,
          tailRiskLabel: insight.tailRisk.label,
          scoutConfidence: insight.coverage.scoutConfidence,
          coverageLabel: insight.coverage.label,
          highlighted: getTeamHighlight(insight.teamNumber)
        };
      })
      .filter((row): row is PpaShapeChartRow => !!row)
      .sort((left, right) => right.expected - left.expected)
      .slice(0, 14),
    [getTeamHighlight, ppaInsightsByTeam, resolvedTeamNameLookup]
  );

  const visualChartConfigs = useMemo(() => {
    const rowsForMetric = (metric: VisualMetricKey) => {
      if (metric === 'power') return topOffenseRows;
      if (metric === 'defense') return topDefenseRows;
      if (metric === 'volatility') return volatilityRows;

      const valueForRow = (row: AdminV2SorterRow) =>
        metric === 'ppa'
          ? row.ppa
          : metric === 'ppc'
            ? row.ppc
            : metric === 'autoPpc'
              ? row.autoPpc
              : metric === 'teleopPpc'
                ? row.teleopPpc
                : metric === 'opr'
                  ? row.opr
                  : metric === 'epa'
                    ? row.epa
                    : metric === 'dpr'
                      ? row.dpr
                      : metric === 'tbaRank'
                        ? row.tbaRank
                        : row.matches;

      return sorterRows
        .map(row => ({ row, value: valueForRow(row) }))
        .filter(item => item.value != null && Number.isFinite(item.value))
        .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))
        .slice(0, 14)
        .map(({ row, value }) => ({
          key: `${metric}-${row.teamNumber}`,
          label: row.teamNumber,
          value: value ?? 0,
          secondary: row.teamName || undefined,
          highlighted: getTeamHighlight(row.teamNumber)
        }));
    };

    return {
      power: {
        title: `Overall Power (${MODEL_LABELS[selectedMetric]})`,
        subtitle: 'Best available active-model ranking for quick comparisons.',
        rows: rowsForMetric('power'),
        formatter: (value: number) => value.toFixed(1),
        accentClass: 'from-cyan-300 via-sky-400 to-blue-500'
      },
      defense: {
        title: 'Defense Metric',
        subtitle: 'Scout-observed defense signal.',
        rows: rowsForMetric('defense'),
        formatter: (value: number) => `${(value * 100).toFixed(1)}%`,
        accentClass: 'from-emerald-300 via-teal-400 to-cyan-500'
      },
      volatility: {
        title: 'Volatility',
        subtitle: 'Upside and reliability risk from team trend curves.',
        rows: rowsForMetric('volatility'),
        formatter: (value: number) => value.toFixed(1),
        accentClass: 'from-amber-300 via-orange-400 to-rose-500'
      },
      ppa: {
        title: 'PPA',
        subtitle: 'Nuanced model insight value: forecast strength plus local scouting context.',
        rows: rowsForMetric('ppa'),
        formatter: (value: number) => value.toFixed(1),
        accentClass: 'from-violet-300 via-fuchsia-400 to-pink-500'
      },
      ppc: {
        title: 'PPC',
        subtitle: 'Firsthand average scouted points.',
        rows: rowsForMetric('ppc'),
        formatter: (value: number) => value.toFixed(1),
        accentClass: 'from-sky-300 via-cyan-400 to-teal-500'
      },
      autoPpc: {
        title: 'Auto PPC',
        subtitle: 'Firsthand autonomous scoring average.',
        rows: rowsForMetric('autoPpc'),
        formatter: (value: number) => value.toFixed(1),
        accentClass: 'from-teal-300 via-cyan-400 to-sky-500'
      },
      teleopPpc: {
        title: 'Teleop PPC',
        subtitle: 'Firsthand teleop scoring average.',
        rows: rowsForMetric('teleopPpc'),
        formatter: (value: number) => value.toFixed(1),
        accentClass: 'from-blue-300 via-sky-400 to-cyan-500'
      },
      opr: {
        title: 'OPR',
        subtitle: 'Official-score-derived offensive power rating.',
        rows: rowsForMetric('opr'),
        formatter: (value: number) => value.toFixed(1),
        accentClass: 'from-fuchsia-300 via-purple-400 to-indigo-500'
      },
      epa: {
        title: 'EPA',
        subtitle: 'Statbotics expected points added.',
        rows: rowsForMetric('epa'),
        formatter: (value: number) => value.toFixed(1),
        accentClass: 'from-blue-300 via-indigo-400 to-violet-500'
      },
      dpr: {
        title: 'DPR',
        subtitle: 'Official-score-derived defensive context.',
        rows: rowsForMetric('dpr'),
        formatter: (value: number) => value.toFixed(1),
        accentClass: 'from-rose-300 via-red-400 to-orange-500'
      },
      tbaRank: {
        title: 'TBA Rank',
        subtitle: 'Current official event rank.',
        rows: rowsForMetric('tbaRank'),
        formatter: (value: number) => `#${value.toFixed(0)}`,
        accentClass: 'from-amber-300 via-yellow-400 to-orange-500'
      },
      matches: {
        title: 'Matches Logged',
        subtitle: 'Firsthand scouting coverage volume.',
        rows: rowsForMetric('matches'),
        formatter: (value: number) => value.toFixed(0),
        accentClass: 'from-slate-300 via-cyan-300 to-emerald-300'
      }
    } satisfies Record<VisualMetricKey, {
      title: string;
      subtitle: string;
      rows: ScalarChartRow[];
      formatter: (value: number) => string;
      accentClass: string;
    }>;
  }, [
    getTeamHighlight,
    selectedMetric,
    sorterRows,
    topDefenseRows,
    topOffenseRows,
    volatilityRows
  ]);

  const commandAlerts = useMemo(() => {
    const alerts: Array<{ label: string; detail: string; tone: 'rose' | 'amber' | 'emerald' | 'cyan' }> = [];
    if (rawEditorSummary.missingSlotCount > 0) {
      alerts.push({
        label: 'Coverage Gap',
        detail: `${rawEditorSummary.missingSlotCount} expected scout slot${rawEditorSummary.missingSlotCount === 1 ? '' : 's'} missing.`,
        tone: 'rose'
      });
    }
    if (rawEditorSummary.anomalyRowCount > 0) {
      alerts.push({
        label: 'Data Review',
        detail: `${rawEditorSummary.anomalyRowCount} submitted row${rawEditorSummary.anomalyRowCount === 1 ? '' : 's'} have scout/team anomalies.`,
        tone: 'amber'
      });
    }
    if (localArchiveSummary.unsyncedRecords.length > 0) {
      alerts.push({
        label: 'Unsynced Local Data',
        detail: `${localArchiveSummary.unsyncedRecords.length} local record${localArchiveSummary.unsyncedRecords.length === 1 ? '' : 's'} still need Firebase sync.`,
        tone: 'amber'
      });
    }
    if (sourceStatusSummary.rowCount === 0) {
      alerts.push({
        label: 'No Cache Yet',
        detail: 'Upload or refresh TBA/FIRST data before relying on offline fallbacks.',
        tone: 'cyan'
      });
    }
    if (alerts.length === 0) {
      alerts.push({
        label: 'System Clear',
        detail: 'No immediate coverage, sync, or source warnings are active.',
        tone: 'emerald'
      });
    }
    return alerts;
  }, [
    localArchiveSummary.unsyncedRecords.length,
    rawEditorSummary.anomalyRowCount,
    rawEditorSummary.missingSlotCount,
    sourceStatusSummary.rowCount
  ]);

  const dataHealthRows = useMemo(() => {
    const conflictCount = localArchiveSummary.conflictRecords.length;
    return [
      {
        label: 'Coverage Gaps',
        value: rawEditorSummary.missingSlotCount,
        detail: 'missing six-slot assignments',
        tone: rawEditorSummary.missingSlotCount > 0 ? 'rose' : 'emerald'
      },
      {
        label: 'Unsynced Local',
        value: localArchiveSummary.unsyncedRecords.length,
        detail: 'records waiting for Firebase',
        tone: localArchiveSummary.unsyncedRecords.length > 0 ? 'amber' : 'emerald'
      },
      {
        label: 'Conflicts',
        value: conflictCount,
        detail: 'local archive conflict records',
        tone: conflictCount > 0 ? 'rose' : 'emerald'
      },
      {
        label: 'Source Freshness',
        value: formatFreshnessAge(sourceStatusSummary.latestTimestamp),
        detail: `${sourceStatusSummary.rowCount} cached or uploaded sources`,
        tone: sourceStatusSummary.rowCount > 0 ? 'cyan' : 'amber'
      },
      {
        label: 'Model Source',
        value: MODEL_LABELS[selectedMetric],
        detail: selectedMetric === 'ppa' ? 'scouting-derived adapter' : 'fallback-compatible metric',
        tone: 'cyan'
      },
      {
        label: 'Mode',
        value: isLocalMode ? 'Local' : 'Firebase',
        detail: loading ? 'refreshing data' : 'ready',
        tone: loading ? 'amber' : 'emerald'
      }
    ] as Array<{ label: string; value: number | string; detail: string; tone: 'rose' | 'amber' | 'emerald' | 'cyan' }>;
  }, [
    isLocalMode,
    loading,
    localArchiveSummary.conflictRecords.length,
    localArchiveSummary.unsyncedRecords.length,
    rawEditorSummary.missingSlotCount,
    selectedMetric,
    sourceStatusSummary.latestTimestamp,
    sourceStatusSummary.rowCount
  ]);

  const workspaceItems: WorkspaceNavItem<WorkflowTab>[] = [
    { key: 'command', label: 'Now', description: 'event brief and next actions', icon: <Gauge className="h-4 w-4" />, tone: 'cyan' },
    { key: 'sorter', label: 'Teams', description: 'leaderboard, search, and team profiles', icon: <Users className="h-4 w-4" />, tone: 'emerald' },
    { key: 'predictor', label: 'Matches', description: 'future forecasts, results, and simulation', icon: <Swords className="h-4 w-4" />, tone: 'fuchsia' },
    { key: 'pickList', label: 'Pick List', description: 'alliance selection board', icon: <Trophy className="h-4 w-4" />, tone: 'amber' },
    { key: 'visualize', label: 'Visualize', description: 'charts and stat comparisons', icon: <BarChart3 className="h-4 w-4" />, tone: 'cyan' },
    { key: 'import', label: 'Data', description: 'imports, freshness, sync, backup', icon: <Database className="h-4 w-4" />, tone: 'slate' },
    { key: 'export', label: 'Reports', description: 'Excel and judge-friendly outputs', icon: <Download className="h-4 w-4" />, tone: 'emerald' }
  ];

  const redSimulatorTeams = useMemo(() => parseManualTeamNumbers(redSimulatorInput), [redSimulatorInput]);
  const blueSimulatorTeams = useMemo(() => parseManualTeamNumbers(blueSimulatorInput), [blueSimulatorInput]);
  const simulatorDefenseImpactLookup = useMemo(() => {
    const attributionRatings = Object.keys(adminV2PpaRatings).length > 0 ? adminV2PpaRatings : activeMetricRatings;
    return buildDefenseImpactLookup(buildDefenseAttributions(v4Records, attributionRatings));
  }, [activeMetricRatings, adminV2PpaRatings, v4Records]);

  const buildSimulatorRow = (teamNumber: string) => {
    const teamAverage = teamAverageLookupByTeam[teamNumber];
    const epaMetrics = epaByTeam[teamNumber];
    const oprComponents = csvOprComponents[teamNumber];
    const rating = activeMetricRatings[teamNumber] ?? 0;
    const defenseImpact = simulatorDefenseImpactLookup[teamNumber] ?? null;
    const ppaInsight = ppaInsightsByTeam[teamNumber] || null;
    const recommendedRole = ppaInsight?.role.label || ((defenseImpact ?? 0) > rating ? 'Defender' : 'Primary Scorer');
    return {
      teamNumber,
      teamName: resolvedTeamNameLookup[teamNumber] || '',
      rating,
      ppaRating: ppaInsight?.rating ?? adminV2PpaRatings[teamNumber] ?? null,
      ppaInsight,
      defenseImpact: ppaInsight?.components.defenseImpact ?? defenseImpact,
      recommendedRole,
      auto:
        selectedMetric === 'ppc'
          ? teamAverage?.avgAutoPoints ?? null
          : selectedMetric === 'opr'
            ? oprComponents?.autoPoints ?? null
            : selectedMetric === 'epa'
              ? epaMetrics?.autoEPA ?? null
              : null,
      teleop:
        selectedMetric === 'ppc'
          ? teamAverage?.avgTeleopPoints ?? null
          : selectedMetric === 'opr'
            ? oprComponents?.teleopPoints ?? null
            : selectedMetric === 'epa'
              ? epaMetrics?.teleopEPA ?? null
              : null
    };
  };

  const redSimulatorRows = useMemo(
    () => redSimulatorTeams.map(teamNumber => buildSimulatorRow(teamNumber)),
    [redSimulatorTeams, activeMetricRatings, selectedMetric, teamAverageLookupByTeam, csvOprComponents, epaByTeam, resolvedTeamNameLookup, adminV2PpaRatings, ppaInsightsByTeam, simulatorDefenseImpactLookup]
  );
  const blueSimulatorRows = useMemo(
    () => blueSimulatorTeams.map(teamNumber => buildSimulatorRow(teamNumber)),
    [blueSimulatorTeams, activeMetricRatings, selectedMetric, teamAverageLookupByTeam, csvOprComponents, epaByTeam, resolvedTeamNameLookup, adminV2PpaRatings, ppaInsightsByTeam, simulatorDefenseImpactLookup]
  );

  const redSimulatorPpaSummary = useMemo(
    () => summarizePpaAlliance(redSimulatorTeams, ppaInsightsByTeam),
    [ppaInsightsByTeam, redSimulatorTeams]
  );
  const blueSimulatorPpaSummary = useMemo(
    () => summarizePpaAlliance(blueSimulatorTeams, ppaInsightsByTeam),
    [blueSimulatorTeams, ppaInsightsByTeam]
  );

  const simulatorSummary = useMemo(() => {
    const redScore = redSimulatorRows.reduce((sum, row) => sum + row.rating, 0);
    const blueScore = blueSimulatorRows.reduce((sum, row) => sum + row.rating, 0);
    const redPpaScore = redSimulatorPpaSummary.expected;
    const bluePpaScore = blueSimulatorPpaSummary.expected;
    const redDefenseSwing = redSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole === 'Defender' ? row.defenseImpact ?? 0 : 0), 0);
    const blueDefenseSwing = blueSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole === 'Defender' ? row.defenseImpact ?? 0 : 0), 0);
    const redRoleOffense = redSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole !== 'Defender' ? row.rating : 0), 0);
    const blueRoleOffense = blueSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole !== 'Defender' ? row.rating : 0), 0);
    const redRoleAdjustedScore = Math.max(0, redRoleOffense - blueDefenseSwing);
    const blueRoleAdjustedScore = Math.max(0, blueRoleOffense - redDefenseSwing);
    const redMissing = redSimulatorRows.filter(row => !(row.teamNumber in activeMetricRatings));
    const blueMissing = blueSimulatorRows.filter(row => !(row.teamNumber in activeMetricRatings));
    const totalTeams = redSimulatorRows.length + blueSimulatorRows.length;
    return {
      redScore,
      blueScore,
      redPpaScore,
      bluePpaScore,
      redDefenseSwing,
      blueDefenseSwing,
      redRoleAdjustedScore,
      blueRoleAdjustedScore,
      redMissing,
      blueMissing,
      totalTeams,
      margin: Math.abs(redScore - blueScore),
      ppaMargin: Math.abs(redPpaScore - bluePpaScore),
      roleAdjustedMargin: Math.abs(redRoleAdjustedScore - blueRoleAdjustedScore),
      winner:
        redSimulatorRows.length > 0 && blueSimulatorRows.length > 0
          ? redScore === blueScore
            ? 'Tie'
            : redScore > blueScore
              ? 'Red'
              : 'Blue'
          : null,
      ppaWinner:
        redSimulatorRows.length > 0 && blueSimulatorRows.length > 0
          ? redPpaScore === bluePpaScore
            ? 'Tie'
            : redPpaScore > bluePpaScore
              ? 'Red'
              : 'Blue'
          : null,
      roleAdjustedWinner:
        redSimulatorRows.length > 0 && blueSimulatorRows.length > 0
          ? redRoleAdjustedScore === blueRoleAdjustedScore
            ? 'Tie'
            : redRoleAdjustedScore > blueRoleAdjustedScore
              ? 'Red'
              : 'Blue'
          : null
    };
  }, [redSimulatorRows, blueSimulatorRows, activeMetricRatings, blueSimulatorPpaSummary.expected, redSimulatorPpaSummary.expected]);

  const handleOprCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    setCsvError('');
    setCsvMessages([]);

    try {
      const result = await importUploadedTbaCsvFiles(eventKey, files, uploadedCsvPack);
      setUploadedCsvPack(result.pack);
      setCsvMessages(result.messages);
    } catch (uploadError) {
      console.error('Failed to import TBA CSV files for Admin V4 OPR', uploadError);
      setCsvError(uploadError instanceof Error ? uploadError.message : 'Failed to import CSV files.');
    }
  };

  const handleEditV4Record = (record: MatchScoutingV4) => {
    localStorage.setItem('match_scout_v4_draft', JSON.stringify(record));
    localStorage.setItem('match_scout_v4_edit_mode', 'true');
    navigate('/scout');
  };

  const handleFirstCredentialUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFirstCredentialError('');
    setApiKeyError('');
    setFirstCredentialStatus('Reading local admin credential JSON...');
    try {
      const parsed = JSON.parse(await file.text()) as Partial<FirstEventsCredentials> & {
        tbaApiKey?: string;
        firstEvents?: Partial<FirstEventsCredentials>;
      };
      const firstUsername = parsed.firstEvents?.username || parsed.username;
      const firstToken = parsed.firstEvents?.token || parsed.token;
      const tbaApiKey = parsed.tbaApiKey?.trim() || '';
      const statusParts: string[] = [];

      if (firstUsername && firstToken) {
        const saved = await saveFirstEventsCredentials({ username: firstUsername, token: firstToken });
        setFirstCredentials(saved);
        statusParts.push('FIRST Events credentials saved locally');
      }

      if (tbaApiKey) {
        const savedTbaKey = await saveTbaApiKey(tbaApiKey);
        setLocalTbaApiKey(savedTbaKey);
        setApiKeyStatus('TBA API key saved locally in IndexedDB.');
        statusParts.push('TBA API key saved locally');
      }

      if (statusParts.length === 0) {
        throw new Error('Credential JSON must include tbaApiKey and/or FIRST Events username/token.');
      }

      setFirstCredentialStatus(`${statusParts.join('; ')}. These secrets stay on this browser/device.`);
    } catch (credentialError) {
      setFirstCredentialError(credentialError instanceof Error ? credentialError.message : 'Failed to import FIRST credentials.');
      setApiKeyError(credentialError instanceof Error ? credentialError.message : 'Failed to import API credentials.');
      setFirstCredentialStatus('');
      setApiKeyStatus('');
    }
  };

  const handleClearFirstCredentials = async () => {
    await clearFirstEventsCredentials();
    setFirstCredentials(null);
    setFirstCredentialStatus('FIRST Events credentials cleared from this admin device.');
    setFirstCredentialError('');
  };

  const handleClearTbaApiKey = async () => {
    await clearTbaApiKey();
    setLocalTbaApiKey('');
    setApiKeyStatus('TBA API key cleared from this admin device.');
    setApiKeyError('');
  };

  const handleRefreshFirstEventCache = async () => {
    if (!firstCredentials) {
      setFirstCredentialError('Upload FIRST Events credentials before refreshing the FIRST cache.');
      setFirstCredentialStatus('');
      return;
    }

    setFirstCredentialError('');
    setFirstCredentialStatus('Fetching FIRST Events data and caching it locally...');
    try {
      const results = await fetchAndCacheFirstEventBundle(firstCredentials, eventKey);
      const successCount = results.filter(result => result.ok).length;
      const failedResults = results.filter(result => !result.ok);
      setFirstCredentialStatus(`FIRST cache refreshed: ${successCount}/${results.length} endpoints saved locally.`);
      setFirstCredentialError(
        failedResults.length > 0
          ? `Some FIRST endpoints failed: ${failedResults.map(result => result.key).join(', ')}. Cached successes are still usable.`
          : ''
      );
      await refreshAdminV2CacheEntries();
      await loadV3Data();
    } catch (cacheError) {
      setFirstCredentialStatus('');
      setFirstCredentialError(cacheError instanceof Error ? cacheError.message : 'Failed to refresh FIRST Events cache.');
    }
  };

  const handleSyncLocalArchiveToFirebase = async () => {
    if (localArchiveSummary.unsyncedRecords.length === 0 || isLocalArchiveSyncing) {
      return;
    }

    setIsLocalArchiveSyncing(true);
    setLocalArchiveSyncStatus(`Uploading ${localArchiveSummary.unsyncedRecords.length} local scout archive record${localArchiveSummary.unsyncedRecords.length === 1 ? '' : 's'} to Firebase...`);
    setLocalArchiveError('');

    const counts = {
      synced: 0,
      conflict: 0,
      failed: 0
    };

    for (const record of localArchiveSummary.unsyncedRecords) {
      const result = await syncScoutArchiveRecordToFirebase(record);
      counts[result.outcome] += 1;
    }

    await refreshLocalArchiveRecords();
    setIsLocalArchiveSyncing(false);
    setLocalArchiveSyncStatus(
      `Archive sync complete: ${counts.synced} synced, ${counts.conflict} conflict${counts.conflict === 1 ? '' : 's'}, ${counts.failed} failed.`
    );
    if (counts.conflict > 0 || counts.failed > 0) {
      setLocalArchiveError('Some archive records remain local-only. Conflicts were blocked instead of overwriting Firebase.');
    }
  };

  const handleOptimizeScouts = async () => {
    const scoutNames = scoutRosterText.split('\n').map(name => name.trim()).filter(Boolean);
    const plan = optimizeScoutAssignments(eventKey, activePredictorMatches, scoutNames, ownTeamNumber);
    setScoutAssignmentPlan(plan);
    await saveScoutAssignmentPlan(plan);
    setScoutControlStatus(`Built ${plan.assignments.length} scout assignments across ${plan.scoutNames.length} scouts.`);
  };

  const handleExportScoutAssignmentsCsv = () => {
    if (!scoutAssignmentPlan || scoutAssignmentPlan.assignments.length === 0) {
      setScoutControlStatus('Build a scout assignment plan before exporting.');
      return;
    }

    downloadCsvFile(
      `scout_assignments_${eventKey}_${new Date().toISOString().split('T')[0]}.csv`,
      ['eventKey', 'matchType', 'matchNumber', 'matchKey', 'station', 'teamNumber', 'scoutName', 'priorityReason'],
      scoutAssignmentPlan.assignments.map(assignment => [
        scoutAssignmentPlan.eventKey,
        assignment.matchType,
        assignment.matchNumber,
        assignment.matchKey,
        assignment.station,
        assignment.teamNumber,
        assignment.scoutName,
        assignment.priorityReason
      ])
    );
    setScoutControlStatus(`Exported ${scoutAssignmentPlan.assignments.length} scout assignments as CSV.`);
  };

  const handleExportScoutCoverageGapsCsv = () => {
    const gaps = scoutAssignmentPlan?.coverageGaps || [];
    if (!scoutAssignmentPlan || gaps.length === 0) {
      setScoutControlStatus('No scout coverage gaps exist in the current plan.');
      return;
    }

    downloadCsvFile(
      `scout_coverage_gaps_${eventKey}_${new Date().toISOString().split('T')[0]}.csv`,
      ['eventKey', 'matchType', 'matchNumber', 'matchKey', 'station', 'teamNumber', 'reason'],
      gaps.map(gap => [
        scoutAssignmentPlan.eventKey,
        gap.matchType,
        gap.matchNumber,
        gap.matchKey,
        gap.station,
        gap.teamNumber,
        gap.reason
      ])
    );
    setScoutControlStatus(`Exported ${gaps.length} scout coverage gap${gaps.length === 1 ? '' : 's'} as CSV.`);
  };

  const handleSettlePowerCoins = async (matchKey: string, winner: 'Red' | 'Blue' | 'Tie' | 'Unknown') => {
    await settlePowerCoinBetsForMatch(eventKey, matchKey, winner);
    await refreshScoutOpsState();
    setPowerCoinStatus(`Settled open bets for ${matchKey.toUpperCase()} as ${winner}.`);
  };

  const handleSettleAllPlayedPowerCoins = async () => {
    const openMatchKeys = new Set(powerCoinBets.filter(bet => !bet.settledAt).map(bet => bet.matchKey));
    const playedMatchesWithOpenBets = activePredictorMatches
      .filter(match => openMatchKeys.has(match.key) && isPlayedMatch(match))
      .sort((left, right) => left.match_number - right.match_number || left.key.localeCompare(right.key));

    if (playedMatchesWithOpenBets.length === 0) {
      setPowerCoinStatus('No open PowerCoin bets have played official match results yet.');
      return;
    }

    let settledBets = 0;
    for (const match of playedMatchesWithOpenBets) {
      settledBets += await settlePowerCoinBetsForMatch(eventKey, match.key, getPlayedMatchWinner(match));
    }

    await refreshScoutOpsState();
    setPowerCoinStatus(`Auto-settled ${settledBets} PowerCoin bet${settledBets === 1 ? '' : 's'} across ${playedMatchesWithOpenBets.length} played match${playedMatchesWithOpenBets.length === 1 ? '' : 'es'}.`);
  };

  const handlePowerCoinAdjustment = async () => {
    const scoutName = powerCoinAdjustmentScout.trim();
    const delta = Math.trunc(Number(powerCoinAdjustmentAmount));
    if (!scoutName) {
      setPowerCoinStatus('Choose a scout before adding a PowerCoin adjustment.');
      return;
    }
    if (!Number.isFinite(delta) || delta === 0) {
      setPowerCoinStatus('PowerCoin adjustment must be a non-zero integer.');
      return;
    }

    const currentBalance = await getPowerCoinBalance(eventKey, scoutName);
    const createdAt = Date.now();
    await upsertPowerCoinLedgerEntry({
      id: `${eventKey}_${scoutName.replace(/\s+/g, '_').toLowerCase()}_${createdAt}`,
      eventKey,
      scoutName,
      delta,
      reason: powerCoinAdjustmentReason.trim() || 'Admin adjustment',
      balanceAfter: currentBalance + delta,
      createdAt
    });
    await refreshScoutOpsState();
    setPowerCoinStatus(`${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} PowerCoin${Math.abs(delta) === 1 ? '' : 's'} ${delta > 0 ? 'to' : 'from'} ${scoutName}.`);
  };

  const handleExportFullLocalBackup = async () => {
    setLocalBackupStatus('Building full local backup...');
    setLocalBackupError('');

    try {
      const [
        archiveUsername,
        cacheEntries,
        powerCoinBets,
        powerCoinLedger,
        scoutAssignmentPlan,
        modelSnapshots,
        modelFeatureSnapshots
      ] = await Promise.all([
        getScoutArchiveUsername().catch(() => null),
        listAdminV2CacheEntries(eventKey).catch(() => []),
        listPowerCoinBets(eventKey).catch(() => []),
        listPowerCoinLedger(eventKey).catch(() => []),
        loadLatestScoutAssignmentPlan(eventKey).catch(() => null),
        listModelLabSnapshots(eventKey).catch(() => []),
        listModelFeatureSnapshots(eventKey).catch(() => [])
      ]);

      const scoutArchive = await buildScoutArchiveBundle(archiveUsername || 'admin-v2-backup');
      const safeFirstCredentialSummary = firstCredentials
        ? {
            username: firstCredentials.username,
            savedAt: firstCredentials.savedAt,
            tokenIncluded: false
          }
        : null;
      const payload = {
        format: 'rebuilt-2026-admin-v2-full-local-backup',
        version: 2,
        eventKey,
        exportedAt: Date.now(),
        settings,
        firstEventsCredentials: safeFirstCredentialSummary,
        uploadedTbaPack: uploadedCsvPack,
        scoutArchive,
        adminV2: {
          cacheEntries,
          powerCoinBets,
          powerCoinLedger,
          scoutAssignmentPlan,
          modelSnapshots,
          modelFeatureSnapshots
        }
      };

      downloadJsonFile(
        `adminv4_full_local_backup_${eventKey}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        payload
      );
      setLocalBackupStatus(
        `Exported local backup with ${scoutArchive.records.length} scout archive records, ${cacheEntries.length} cache entries, ${powerCoinBets.length} PowerCoin bets, ${modelSnapshots.length} model snapshots, and ${modelFeatureSnapshots.length} feature snapshots. Scout sync states/modes were preserved; FIRST token was not included.`
      );
    } catch (backupError) {
      console.error('Failed to export full local Admin V4 backup', backupError);
      setLocalBackupError(backupError instanceof Error ? backupError.message : 'Failed to export local backup.');
      setLocalBackupStatus('');
    }
  };

  const handleImportFullLocalBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setLocalBackupStatus('Restoring full local backup...');
    setLocalBackupError('');

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isAdminV2FullLocalBackup(parsed)) {
        throw new Error('This is not a REBUILT Admin V4 full local backup JSON file.');
      }

      const backupEventKey = parsed.eventKey.trim().toUpperCase();
      if (backupEventKey !== eventKey.trim().toUpperCase()) {
        throw new Error(`This backup is for ${parsed.eventKey}. Switch Admin V4 to that event before restoring it.`);
      }

      let scoutArchiveImported = 0;
      let scoutArchiveSkipped = 0;
      let scoutArchiveConflictsPreserved = 0;
      let scoutArchivePowerCoinItems = 0;
      if (parsed.scoutArchive) {
        if (!isScoutArchiveBundle(parsed.scoutArchive)) {
          throw new Error('The embedded scout archive bundle is invalid.');
        }
        const scoutArchiveResult = await importScoutArchiveBundleLocally(parsed.scoutArchive);
        scoutArchiveImported = scoutArchiveResult.imported;
        scoutArchiveSkipped = scoutArchiveResult.skipped;
        scoutArchiveConflictsPreserved = scoutArchiveResult.conflictsPreserved;
        scoutArchivePowerCoinItems = scoutArchiveResult.powerCoinBetsImported + scoutArchiveResult.powerCoinLedgerImported;
      }

      const restoredCacheEntries = await restoreAdminV2CacheEntries(parsed.adminV2?.cacheEntries || []);
      for (const bet of parsed.adminV2?.powerCoinBets || []) {
        await upsertPowerCoinBet(bet);
      }
      for (const ledgerEntry of parsed.adminV2?.powerCoinLedger || []) {
        await upsertPowerCoinLedgerEntry(ledgerEntry);
      }
      if (parsed.adminV2?.scoutAssignmentPlan) {
        await saveScoutAssignmentPlan(parsed.adminV2.scoutAssignmentPlan);
        setScoutAssignmentPlan(parsed.adminV2.scoutAssignmentPlan);
        if (parsed.adminV2.scoutAssignmentPlan.scoutNames?.length) {
          setScoutRosterText(parsed.adminV2.scoutAssignmentPlan.scoutNames.join('\n'));
        }
      }
      for (const snapshot of parsed.adminV2?.modelSnapshots || []) {
        await saveModelLabSnapshot(snapshot);
      }
      for (const featureSnapshot of parsed.adminV2?.modelFeatureSnapshots || []) {
        await saveModelFeatureSnapshot(featureSnapshot);
      }
      if (parsed.uploadedTbaPack) {
        saveUploadedTbaCsvPack(eventKey, parsed.uploadedTbaPack);
        setUploadedCsvPack(loadUploadedTbaCsvPack(eventKey));
      }
      if (parsed.settings) {
        updateSettings({
          ownTeamNumber: parsed.settings.ownTeamNumber || settings.ownTeamNumber,
          selectedMetric: parsed.settings.selectedMetric || settings.selectedMetric,
          searchedTeamNumber: parsed.settings.searchedTeamNumber || settings.searchedTeamNumber
        });
      }

      setLocalBackupStatus(
        `Restored backup: ${scoutArchiveImported} scout archive records (${scoutArchiveSkipped} skipped, ${scoutArchiveConflictsPreserved} conflict version${scoutArchiveConflictsPreserved === 1 ? '' : 's'} preserved separately), ${scoutArchivePowerCoinItems} scout-archive PowerCoin items, ${restoredCacheEntries} cache entries, ${(parsed.adminV2?.powerCoinBets || []).length} PowerCoin bets, ${(parsed.adminV2?.powerCoinLedger || []).length} ledger entries, ${(parsed.adminV2?.modelSnapshots || []).length} model snapshots, and ${(parsed.adminV2?.modelFeatureSnapshots || []).length} feature snapshots. Scout sync states/modes were restored; FIRST token was not imported.`
      );
      await refreshScoutOpsState();
      await refreshLocalArchiveRecords();
    } catch (backupError) {
      console.error('Failed to import full local Admin V4 backup', backupError);
      setLocalBackupError(backupError instanceof Error ? backupError.message : 'Failed to import local backup.');
      setLocalBackupStatus('');
    }
  };

  const resolveTeamSearchInput = (rawInput: string) => {
    const normalizedInput = rawInput.trim().toLowerCase();
    if (!normalizedInput) return '';

    const numericInput = sanitizeTeamNumber(rawInput);
    if (numericInput && allKnownTeams.includes(numericInput)) {
      return numericInput;
    }

    const normalizeName = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const normalizedNameInput = normalizeName(rawInput);

    const candidates = allKnownTeams.map(teamNumber => {
      const teamName = resolvedTeamNameLookup[teamNumber] || '';
      return {
        teamNumber,
        teamName,
        normalizedTeamName: normalizeName(teamName),
        normalizedDisplay: normalizeName(`${teamNumber} ${teamName}`),
        normalizedDisplayReversed: normalizeName(`${teamName} ${teamNumber}`)
      };
    });

    const exactMatch = candidates.find(candidate =>
      candidate.teamNumber === numericInput ||
      candidate.normalizedTeamName === normalizedNameInput ||
      candidate.normalizedDisplay === normalizedNameInput ||
      candidate.normalizedDisplayReversed === normalizedNameInput ||
      normalizeName(`Team ${candidate.teamNumber}`) === normalizedNameInput
    );
    if (exactMatch) return exactMatch.teamNumber;

    const startsWithMatch = candidates.find(candidate =>
      (numericInput && candidate.teamNumber.startsWith(numericInput)) ||
      (candidate.normalizedTeamName && candidate.normalizedTeamName.startsWith(normalizedNameInput))
    );
    if (startsWithMatch) return startsWithMatch.teamNumber;

    const containsMatch = candidates.find(candidate =>
      candidate.normalizedTeamName.includes(normalizedNameInput) ||
      candidate.normalizedDisplay.includes(normalizedNameInput)
    );
    return containsMatch?.teamNumber || '';
  };

  const submitTeamSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const resolvedTeamNumber = resolveTeamSearchInput(teamSearchInput);
    if (!resolvedTeamNumber) {
      setTeamSearchError(`No loaded team matches "${teamSearchInput.trim()}". Try a team number, or load a team list/source cache first.`);
      return;
    }

    setTeamSearchError('');
    openTeamDrilldown(resolvedTeamNumber, activeTab);
  };

  const openTeamDrilldown = (teamNumber: string, fromTab: AdminV2Tab = activeTab) => {
    const sanitizedTeamNumber = sanitizeTeamNumber(teamNumber);
    if (!sanitizedTeamNumber) return;
    setDrilldownFromTab(fromTab);
    setDrilldownTeamNumber(sanitizedTeamNumber);
    setTeamSearchInput(sanitizedTeamNumber);
    updateSettings({ searchedTeamNumber: sanitizedTeamNumber });
    setActiveTab('teams');
  };

  const closeTeamDrilldown = () => {
    setDrilldownTeamNumber('');
    setActiveTab(drilldownFromTab === 'teams' ? 'sorter' : drilldownFromTab);
  };

  const handleSorterSort = (field: SorterField) => {
    if (sorterField === field) {
      setSorterDirection(previous => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSorterField(field);
    setSorterDirection(field === 'dpr' || field === 'team' || field === 'tbaRank' ? 'asc' : 'desc');
  };

  const updatePickStatus = (
    teamNumber: string,
    status: AlliancePickRecommendation['status'],
    pickedBy = ''
  ) => {
    setAlliancePickStatuses(previous => {
      const next = { ...previous };
      if (status === 'available') {
        delete next[teamNumber];
      } else {
        next[teamNumber] = { status, pickedBy };
      }
      return next;
    });
  };

  const applyQuickSimulatorEntry = () => {
    const { redTeams, blueTeams } = parseQuickTeamEntry(simulatorQuickEntry);
    setRedSimulatorInput(redTeams.join(', '));
    setBlueSimulatorInput(blueTeams.join(', '));
  };

  const toggleVisualMetric = (metric: VisualMetricKey) => {
    setVisualMetricKeys(previous =>
      previous.includes(metric)
        ? previous.length === 1
          ? previous
          : previous.filter(item => item !== metric)
        : [...previous, metric]
    );
  };

  const exportInsightsWorkbook = async () => {
    setExportStatus('loading');

    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'REBUILT 2026';
      workbook.created = new Date();
      workbook.modified = new Date();
      const [
        exportedCacheEntries,
        exportedLocalArchiveRecords,
        exportedScoutPlan,
        exportedPowerCoinBets,
        exportedPowerCoinLedger,
        exportedModelSnapshot,
        exportedFeatureSnapshots
      ] = await Promise.all([
        listAdminV2CacheEntries(eventKey).catch(() => []),
        listScoutArchiveRecords({ eventKey, includeDeleted: true }).catch(() => []),
        loadLatestScoutAssignmentPlan(eventKey).catch(() => null),
        listPowerCoinBets(eventKey).catch(() => []),
        listPowerCoinLedger(eventKey).catch(() => []),
        loadLatestModelLabSnapshot(eventKey).catch(() => null),
        listModelFeatureSnapshots(eventKey).catch(() => [])
      ]);
      const exportedPowerCoinScouts = Array.from(new Set([
        ...exportedPowerCoinBets.map(bet => bet.scoutName),
        ...exportedPowerCoinLedger.map(entry => entry.scoutName),
        ...(exportedScoutPlan?.scoutNames ?? [])
      ].map(name => name.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
      const exportedPowerCoinBalances = await Promise.all(
        exportedPowerCoinScouts.map(async scoutName => ({
          scoutName,
          balance: await getPowerCoinBalance(eventKey, scoutName).catch(() => 1000)
        }))
      );

      const ppcFinalsProjection = buildPlayoffProjection(
        effectiveAlliances,
        activePredictorMatches.filter(match => match.comp_level !== 'qm' && match.comp_level !== 'pm'),
        activePredictorMatches.filter(isPlayedMatch),
        averageLookup,
        effectiveEventSummary
      );
      const epaFinalsProjection = buildPlayoffProjection(
        effectiveAlliances,
        activePredictorMatches.filter(match => match.comp_level !== 'qm' && match.comp_level !== 'pm'),
        activePredictorMatches.filter(isPlayedMatch),
        epaRatings,
        effectiveEventSummary
      );
      const oprFinalsProjection = buildPlayoffProjection(
        effectiveAlliances,
        activePredictorMatches.filter(match => match.comp_level !== 'qm' && match.comp_level !== 'pm'),
        activePredictorMatches.filter(isPlayedMatch),
        activeOprRatings,
        effectiveEventSummary
      );
      const modelBacktests = backtestTimeAwareModels({
        matches: activePredictorMatches,
        v3Records: records,
        v4Records,
        epaRatings
      });
      const noFutureFeatureMatchSnapshots = buildNoFutureFeatureMatchSnapshots({
        matches: activePredictorMatches,
        v3Records: records,
        v4Records
      });
      const noFutureBlendLookup = buildAverageBlendLookup([averageLookup, activeOprRatings]);
      const exportPpaRatings = buildPpaRatings(modelBacktests, {
        PPC: averageLookup,
        'Rolling PPC': averageLookup,
        OPR: activeOprRatings,
        'Rolling OPR': activeOprRatings,
        'No-Future Blend': noFutureBlendLookup,
        EPA: epaRatings,
        'Recency EPA': epaRatings,
        'Context Blend': activeMetricRatings
      });
      const defenseAttributions = buildDefenseAttributions(v4Records, Object.keys(exportPpaRatings).length ? exportPpaRatings : activeMetricRatings);
      const defenseImpactLookup = buildDefenseImpactLookup(defenseAttributions);
      const scoutCalibrationRows = buildScoutCalibrationRows(v4Records, activePredictorMatches);
      const teamProfiles = buildTeamPerformanceProfiles({
        v4Records,
        v3Records: records,
        defenseRecords,
        ppcRows: teamAverages,
        oprRatings: activeOprRatings,
        dprRatings: calculatedDprRatings,
        epaRatings,
        ppaRatings: exportPpaRatings,
        defenseImpactLookup,
        featureMatchSnapshots: noFutureFeatureMatchSnapshots
      });
      const bestModelForecastLayer = buildBestModelFutureForecasts({
        matches: activePredictorMatches,
        v3Records: records,
        v4Records,
        epaRatings,
        modelResults: modelBacktests,
        ratingLookups: {
          PPC: averageLookup,
          'Rolling PPC': averageLookup,
          OPR: activeOprRatings,
          'Rolling OPR': activeOprRatings,
          'No-Future Blend': noFutureBlendLookup,
          EPA: epaRatings,
          'Recency EPA': epaRatings
        }
      });
      const bonusMetricLookup = buildScoutedBonusMetricLookup(records, v4Records);
      const strategyPlans = buildStrategyMatchPlans(activePredictorMatches, activeMetricRatings, defenseImpactLookup, bonusMetricLookup, bestModelForecastLayer);
      const allianceRecommendations = buildAlliancePickRecommendations(teamProfiles, 1, {}, ownTeamNumber);
      const exportPpaInsightsByTeam = buildPpaInsights({
        teamNumbers: allKnownTeams,
        teamNameLookup: resolvedTeamNameLookup,
        ppaRatings: exportPpaRatings,
        profiles: teamProfiles,
        modelName: bestModelForecastLayer.modelName,
        modelSource: bestModelForecastLayer.modelSource
      });
      const bestValidatedQualRows = activePredictorMatches
        .filter(match => match.comp_level === 'qm' && !isPlayedMatch(match))
        .map(match => {
          const forecast = bestModelForecastLayer.forecasts[match.key];
          const redScore = forecast?.redScore ?? 0;
          const blueScore = forecast?.blueScore ?? 0;
          return {
            key: match.key,
            title: match.key.split('_')[1]?.toUpperCase() || match.key.toUpperCase(),
            scheduledTime: match.predicted_time ?? match.time ?? null,
            red: {
              teams: match.alliances.red.team_keys.map(normalizeTeamKey),
              predictedScore: redScore
            },
            blue: {
              teams: match.alliances.blue.team_keys.map(normalizeTeamKey),
              predictedScore: blueScore
            },
            predictedWinner: redScore === blueScore ? 'Tie' as const : redScore > blueScore ? 'Red' as const : 'Blue' as const,
            predictionLowConfidence: forecast?.lowConfidence ?? true
          };
        });
      const buildCoverageAuditRows = (matchType: 'Qualification' | 'Practice', compLevel: 'qm' | 'pm') =>
        buildMatchValidationGroups(
          rawEditorRecords.filter(record => record.matchType === matchType),
          activePredictorMatches.filter(match => match.comp_level === compLevel)
        ).flatMap(group => {
          const base = {
            eventKey,
            matchType,
            matchKey: group.displayMatchKey,
            scheduleKnown: group.scheduleKnown ? 'yes' : 'no',
            matchStatus: group.warnings.length > 0 ? group.warnings.join(' | ') : 'Complete'
          };
          const missingRows = group.missingSlots.map(slot => ({
            ...base,
            rowKind: 'Missing Slot',
            slot: slot.slotLabel,
            expectedTeam: slot.teamNumber,
            expectedTeamName: resolvedTeamNameLookup[slot.teamNumber] || '',
            assignedScout: slot.assignedScoutName,
            submittedTeam: '',
            submittedTeamName: '',
            submittedBy: '',
            substituteScout: '',
            actualSlot: '',
            actualAlliance: slot.alliance,
            anomalies: 'Missing Coverage',
            totalPoints: '',
            rolePlayed: '',
            notes: ''
          }));
          const submittedRows = group.rows.map(row => {
            const record = row.record;
            const notes = [record.notes, record.strategyNotes].filter(Boolean).join(' | ');
            return {
              ...base,
              rowKind: 'Submitted Row',
              slot: row.expectedSlotLabel || record.assignedSlot,
              expectedTeam: row.expectedTeamNumber,
              expectedTeamName: resolvedTeamNameLookup[row.expectedTeamNumber] || '',
              assignedScout: record.assignedScoutName,
              submittedTeam: record.teamNumber,
              submittedTeamName: resolvedTeamNameLookup[record.teamNumber] || '',
              submittedBy: record.scoutName,
              substituteScout: record.substituteScoutName || '',
              actualSlot: record.assignedSlot,
              actualAlliance: record.alliance,
              anomalies: row.anomalies.map(getRowAnomalyLabel).join(' | '),
              totalPoints: record.totalMatchPoints,
              rolePlayed: record.rolePlayed,
              notes
            };
          });
          return [...missingRows, ...submittedRows];
        });
      const coverageAuditRows = [
        ...buildCoverageAuditRows('Qualification', 'qm'),
        ...buildCoverageAuditRows('Practice', 'pm')
      ];
      const getMetricExportFields = (teamNumber: string) => {
        const ppcRow = teamAverageLookupByTeam[teamNumber];
        const defenseMetric = defenseMetricLookupByTeam[teamNumber];
        const oprComponents = csvOprComponents[teamNumber];
        const epaMetrics = epaByTeam[teamNumber];
        const ppaInsight = exportPpaInsightsByTeam[teamNumber];

        return {
          ppc: ppcRow?.avgTotalMatchPoints ?? '',
          cPpcAuto: ppcRow?.avgAutoPoints ?? '',
          cPpcTeleop: ppcRow?.avgTeleopPoints ?? '',
          cPpcEndgame: ppcRow?.avgEndgamePoints ?? '',
          defenseMetricAverage: defenseMetric ? Number((defenseMetric.avgDefenseMetric * 100).toFixed(2)) : '',
          defenseMetricRecords: defenseMetric?.recordsLogged ?? '',
          opr: activeOprRatings[teamNumber] ?? '',
          cOprAuto: oprComponents?.autoPoints ?? '',
          cOprTeleop: oprComponents?.teleopPoints ?? '',
          cOprTower: oprComponents?.towerPoints ?? '',
          cOprFuel: oprComponents?.fuelPoints ?? '',
          cOprTotal: oprComponents?.totalPoints ?? '',
          dpr: calculatedDprRatings[teamNumber] ?? '',
          epa: epaMetrics?.overallEPA ?? '',
          cEpaAuto: epaMetrics?.autoEPA ?? '',
          cEpaTeleop: epaMetrics?.teleopEPA ?? '',
          cEpaTower: epaMetrics?.towerEPA ?? '',
          cEpaFuel: epaMetrics?.fuelEPA ?? '',
          ppa: exportPpaRatings[teamNumber] ?? '',
          ppaExpected: ppaInsight?.projected.expected ?? '',
          ppaFloor: ppaInsight?.projected.floor ?? '',
          ppaCeiling: ppaInsight?.projected.ceiling ?? '',
          ppaNormalLow: ppaInsight?.projected.normalLow ?? '',
          ppaNormalHigh: ppaInsight?.projected.normalHigh ?? '',
          ppaRoleFit: ppaInsight?.role.label ?? '',
          ppaUncertainty: ppaInsight?.uncertainty.level ?? '',
          ppaTailRisk: ppaInsight?.tailRisk.label ?? '',
          ppaScoutConfidence: ppaInsight ? Number((ppaInsight.coverage.scoutConfidence * 100).toFixed(0)) : '',
          ppaCoverage: ppaInsight?.coverage.label ?? '',
          defenseImpact: defenseImpactLookup[teamNumber] ?? '',
          tbaRank: effectiveCurrentTbaRanks[teamNumber] ?? ''
        };
      };
      const allRawDataRows = [
        ...v4Records.map(record => ({
          recordType: 'V4 Match',
          schemaVersion: record.schemaVersion,
          eventKey: record.eventKey,
          matchType: record.matchType,
          matchNumber: record.matchNumber,
          matchKey: record.matchKey,
          teamNumber: record.teamNumber,
          teamName: resolvedTeamNameLookup[record.teamNumber] || '',
          scoutName: record.scoutName,
          assignedScoutName: record.assignedScoutName,
          assignedSlot: record.assignedSlot,
          substituteScoutName: record.substituteScoutName || '',
          alliance: record.alliance,
          sourceCollection: 'matchScoutingV4',
          timestamp: formatWorksheetDate(record.timestamp),
          autoPoints: record.autoPoints,
          autoCycles: record.autoCycles,
          teleopPoints: record.teleopPoints,
          teleopCycles: record.teleopCycles,
          endgamePoints: record.endgamePoints,
          totalMatchPoints: record.totalMatchPoints,
          rolePlayed: record.rolePlayed,
          defendedTeamNumber: record.defendedTeamNumber,
          defenderFacedTeamNumber: record.defenderFacedTeamNumber,
          defenseIntensity: record.defenseIntensity,
          defenseDurationSeconds: record.defenseDurationSeconds,
          reliabilityScore: record.reliabilityScore,
          defenseMetricPercent: '',
          defenseComments: '',
          generalComments: '',
          notes: record.notes,
          strategyNotes: record.strategyNotes,
          ...getMetricExportFields(record.teamNumber),
          rawPayloadJson: stringifyForWorkbookCell(record)
        })),
        ...records.map(record => ({
          recordType: 'Legacy V3 Match',
          schemaVersion: record.schemaVersion,
          eventKey: record.eventKey,
          matchType: record.matchType,
          matchNumber: record.matchNumber,
          matchKey: record.matchKey,
          teamNumber: record.teamNumber,
          teamName: resolvedTeamNameLookup[record.teamNumber] || '',
          scoutName: record.scoutName,
          assignedScoutName: record.assignedScoutName,
          assignedSlot: record.assignedSlot,
          substituteScoutName: record.substituteScoutName || '',
          alliance: record.alliance,
          sourceCollection: 'matchScoutingV3',
          timestamp: formatWorksheetDate(record.timestamp),
          autoPoints: record.autoPoints,
          autoCycles: '',
          teleopPoints: record.teleopPoints,
          teleopCycles: record.teleopCycles,
          endgamePoints: '',
          totalMatchPoints: record.totalMatchPoints,
          rolePlayed: '',
          defendedTeamNumber: '',
          defenderFacedTeamNumber: '',
          defenseIntensity: '',
          defenseDurationSeconds: '',
          reliabilityScore: '',
          defenseMetricPercent: '',
          defenseComments: record.defenseDescription,
          generalComments: record.generalEvaluation,
          notes: [record.defenseDescription, record.generalEvaluation].filter(Boolean).join(' | '),
          strategyNotes: '',
          ...getMetricExportFields(record.teamNumber),
          rawPayloadJson: stringifyForWorkbookCell(record)
        })),
        ...defenseRecords.map(record => ({
          recordType: 'Defense V1',
          schemaVersion: record.schemaVersion,
          eventKey: record.eventKey,
          matchType: record.matchType,
          matchNumber: record.matchNumber,
          matchKey: record.matchKey,
          teamNumber: record.teamNumber,
          teamName: resolvedTeamNameLookup[record.teamNumber] || '',
          scoutName: record.scoutName,
          assignedScoutName: record.assignedScoutName,
          assignedSlot: record.assignedSlot,
          substituteScoutName: record.substituteScoutName || '',
          alliance: record.alliance,
          sourceCollection: 'matchScoutingDefense',
          timestamp: formatWorksheetDate(record.timestamp),
          autoPoints: '',
          autoCycles: '',
          teleopPoints: '',
          teleopCycles: '',
          endgamePoints: '',
          totalMatchPoints: '',
          rolePlayed: '',
          defendedTeamNumber: '',
          defenderFacedTeamNumber: '',
          defenseIntensity: '',
          defenseDurationSeconds: '',
          reliabilityScore: '',
          defenseMetricPercent: Number((record.defenseMetric * 100).toFixed(2)),
          defenseComments: record.defenseComments,
          generalComments: record.generalComments,
          notes: record.defenseComments,
          strategyNotes: record.generalComments,
          ...getMetricExportFields(record.teamNumber),
          rawPayloadJson: stringifyForWorkbookCell(record)
        }))
      ].sort((left, right) => {
        const typeDelta =
          (left.matchType === 'Qualification' ? 0 : 1) - (right.matchType === 'Qualification' ? 0 : 1);
        if (typeDelta !== 0) return typeDelta;
        const matchDelta = Number(left.matchNumber) - Number(right.matchNumber);
        if (matchDelta !== 0) return matchDelta;
        return Number(left.teamNumber) - Number(right.teamNumber);
      });

      addWorkbookSheet(workbook, 'Overview', [
        { header: 'Field', key: 'field', width: 28 },
        { header: 'Value', key: 'value', width: 50 }
      ], [
        { field: 'Event Key', value: eventKey },
        { field: 'Exported At', value: new Date().toISOString() },
        { field: 'Selected Metric', value: MODEL_LABELS[selectedMetric] },
        { field: 'Own Team', value: ownTeamNumber || '' },
        { field: 'Searched Team', value: searchedTeamNumber || '' },
        { field: 'Saved V4 Rows', value: v4Records.length },
        { field: 'Saved V3 Rows', value: records.length },
        { field: 'Defense Scout Rows', value: defenseRecords.length },
        { field: 'Local Archive Records', value: exportedLocalArchiveRecords.length },
        {
          field: 'Local Archive Unsynced',
          value: exportedLocalArchiveRecords.filter(record => !record.deleted && record.syncStatus !== 'synced').length
        },
        { field: 'Cached Source Entries', value: exportedCacheEntries.length },
        { field: 'Source Freshness Rows', value: sourceStatusRows.length },
        { field: 'Latest Source Freshness', value: sourceStatusSummary.latestTimestamp ? new Date(sourceStatusSummary.latestTimestamp).toISOString() : '' },
        { field: 'Latest Scout Assignment Plan', value: exportedScoutPlan ? new Date(exportedScoutPlan.createdAt).toISOString() : '' },
        { field: 'Latest Model Snapshot', value: exportedModelSnapshot ? new Date(exportedModelSnapshot.createdAt).toISOString() : '' },
        { field: 'Model Feature Snapshots', value: exportedFeatureSnapshots.length },
        { field: 'PowerCoin Bets', value: exportedPowerCoinBets.length },
        { field: 'PowerCoin Scouts', value: exportedPowerCoinScouts.length },
        { field: 'Defense Teams', value: summary.teams },
        { field: 'Average Defense Metric', value: formatPercentMetric(summary.averageDefenseMetric) },
        { field: 'Distinct V4 Teams', value: new Set(v4Records.map(record => record.teamNumber)).size },
        { field: 'Distinct Rich V3 Teams', value: new Set(records.map(record => record.teamNumber)).size },
        { field: 'Schedule Source', value: predictorMatchSourceLabel },
        { field: 'OPR Source', value: hasUsableCsvOpr ? 'Uploaded TBA OPR' : 'Calculated OPR' },
        { field: 'EPA Availability', value: epaUnavailable || `Loaded for ${Object.keys(epaRatings).length} teams` },
        {
          field: 'Loaded TBA Files',
          value: [
            uploadedCsvPack?.coprs?.fileName,
            uploadedCsvPack?.schedule?.fileName,
            uploadedCsvPack?.flatSchedule?.fileName,
            uploadedCsvPack?.teamList?.fileName,
            uploadedCsvPack?.rankings?.fileName,
            uploadedCsvPack?.alliances?.fileName,
            uploadedCsvPack?.eventSummary?.fileName
          ].filter(Boolean).join(' | ')
        }
      ]);

      addWorkbookSheet(workbook, 'All Raw Data', [
        { header: 'Record Type', key: 'recordType', width: 18 },
        { header: 'Schema Version', key: 'schemaVersion', width: 14 },
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Match Type', key: 'matchType', width: 14 },
        { header: 'Match Number', key: 'matchNumber', width: 12 },
        { header: 'Match Key', key: 'matchKey', width: 18 },
        { header: 'Team Number', key: 'teamNumber', width: 12 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Scout Name', key: 'scoutName', width: 18 },
        { header: 'Assigned Scout', key: 'assignedScoutName', width: 18 },
        { header: 'Assigned Slot', key: 'assignedSlot', width: 12 },
        { header: 'Substitute', key: 'substituteScoutName', width: 14 },
        { header: 'Alliance', key: 'alliance', width: 10 },
        { header: 'Source Collection', key: 'sourceCollection', width: 20 },
        { header: 'Timestamp', key: 'timestamp', width: 24 },
        { header: 'Auto Points', key: 'autoPoints', width: 12 },
        { header: 'Auto Cycles', key: 'autoCycles', width: 12 },
        { header: 'Teleop Points', key: 'teleopPoints', width: 14 },
        { header: 'Teleop Cycles', key: 'teleopCycles', width: 14 },
        { header: 'Endgame Points', key: 'endgamePoints', width: 14 },
        { header: 'Total Match Points', key: 'totalMatchPoints', width: 18 },
        { header: 'Role Played', key: 'rolePlayed', width: 14 },
        { header: 'Defended Team', key: 'defendedTeamNumber', width: 14 },
        { header: 'Defender Faced', key: 'defenderFacedTeamNumber', width: 14 },
        { header: 'Defense Intensity', key: 'defenseIntensity', width: 16 },
        { header: 'Defense Duration Sec', key: 'defenseDurationSeconds', width: 20 },
        { header: 'Reliability', key: 'reliabilityScore', width: 12 },
        { header: 'Defense Metric %', key: 'defenseMetricPercent', width: 16 },
        { header: 'Defense Comments', key: 'defenseComments', width: 36 },
        { header: 'General Comments', key: 'generalComments', width: 36 },
        { header: 'Notes', key: 'notes', width: 36 },
        { header: 'Strategy Notes', key: 'strategyNotes', width: 36 },
        { header: 'PPC', key: 'ppc', width: 12 },
        { header: 'cPPC Auto', key: 'cPpcAuto', width: 12 },
        { header: 'cPPC Teleop', key: 'cPpcTeleop', width: 14 },
        { header: 'cPPC Endgame', key: 'cPpcEndgame', width: 14 },
        { header: 'Defense Metric Avg %', key: 'defenseMetricAverage', width: 20 },
        { header: 'Defense Metric Records', key: 'defenseMetricRecords', width: 22 },
        { header: 'OPR', key: 'opr', width: 12 },
        { header: 'cOPR Auto', key: 'cOprAuto', width: 12 },
        { header: 'cOPR Teleop', key: 'cOprTeleop', width: 14 },
        { header: 'cOPR Tower', key: 'cOprTower', width: 14 },
        { header: 'cOPR Fuel', key: 'cOprFuel', width: 14 },
        { header: 'cOPR Total', key: 'cOprTotal', width: 14 },
        { header: 'DPR', key: 'dpr', width: 12 },
        { header: 'EPA', key: 'epa', width: 12 },
        { header: 'cEPA Auto', key: 'cEpaAuto', width: 12 },
        { header: 'cEPA Teleop', key: 'cEpaTeleop', width: 14 },
        { header: 'cEPA Tower', key: 'cEpaTower', width: 14 },
        { header: 'cEPA Fuel', key: 'cEpaFuel', width: 14 },
        { header: 'PPA', key: 'ppa', width: 12 },
        { header: 'PPA Expected', key: 'ppaExpected', width: 14 },
        { header: 'PPA Floor', key: 'ppaFloor', width: 12 },
        { header: 'PPA Ceiling', key: 'ppaCeiling', width: 12 },
        { header: 'PPA Normal Low', key: 'ppaNormalLow', width: 16 },
        { header: 'PPA Normal High', key: 'ppaNormalHigh', width: 16 },
        { header: 'PPA Role Fit', key: 'ppaRoleFit', width: 16 },
        { header: 'PPA Uncertainty', key: 'ppaUncertainty', width: 18 },
        { header: 'PPA Tail Risk', key: 'ppaTailRisk', width: 18 },
        { header: 'PPA Scout Confidence', key: 'ppaScoutConfidence', width: 22 },
        { header: 'PPA Coverage', key: 'ppaCoverage', width: 22 },
        { header: 'Defense Impact', key: 'defenseImpact', width: 16 },
        { header: 'TBA Rank', key: 'tbaRank', width: 12 },
        { header: 'Raw Payload JSON', key: 'rawPayloadJson', width: 80 }
      ], allRawDataRows);

      addWorkbookSheet(workbook, 'Raw V4 Data', [
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Match Type', key: 'matchType', width: 14 },
        { header: 'Match Number', key: 'matchNumber', width: 12 },
        { header: 'Match Key', key: 'matchKey', width: 18 },
        { header: 'Team Number', key: 'teamNumber', width: 12 },
        { header: 'Scout Name', key: 'scoutName', width: 18 },
        { header: 'Assigned Scout', key: 'assignedScoutName', width: 18 },
        { header: 'Assigned Slot', key: 'assignedSlot', width: 12 },
        { header: 'Substitute', key: 'substituteScoutName', width: 14 },
        { header: 'Alliance', key: 'alliance', width: 10 },
        { header: 'Auto Points', key: 'autoPoints', width: 12 },
        { header: 'Auto Cycles', key: 'autoCycles', width: 12 },
        { header: 'Teleop Points', key: 'teleopPoints', width: 14 },
        { header: 'Teleop Cycles', key: 'teleopCycles', width: 14 },
        { header: 'Endgame Points', key: 'endgamePoints', width: 14 },
        { header: 'Total Match Points', key: 'totalMatchPoints', width: 18 },
        { header: 'Role Played', key: 'rolePlayed', width: 14 },
        { header: 'Defended Team', key: 'defendedTeamNumber', width: 14 },
        { header: 'Defender Faced', key: 'defenderFacedTeamNumber', width: 14 },
        { header: 'Defense Intensity', key: 'defenseIntensity', width: 16 },
        { header: 'Defense Duration Sec', key: 'defenseDurationSeconds', width: 18 },
        { header: 'Fouls', key: 'fouls', width: 10 },
        { header: 'Tech Fouls', key: 'techFouls', width: 12 },
        { header: 'Robot Died', key: 'robotDied', width: 12 },
        { header: 'Comms Lost', key: 'commsLost', width: 12 },
        { header: 'Mechanism Broke', key: 'mechanismBroke', width: 16 },
        { header: 'Tipped Over', key: 'tippedOver', width: 12 },
        { header: 'Failure Reason', key: 'failureReason', width: 28 },
        { header: 'Reliability', key: 'reliabilityScore', width: 12 },
        { header: 'Notes', key: 'notes', width: 36 },
        { header: 'Strategy Notes', key: 'strategyNotes', width: 36 },
        { header: 'Timestamp', key: 'timestamp', width: 24 },
        { header: 'Device ID', key: 'deviceId', width: 24 }
      ], [...v4Records]
        .sort((left, right) => {
          const typeDelta =
            (left.matchType === 'Qualification' ? 0 : 1) - (right.matchType === 'Qualification' ? 0 : 1);
          if (typeDelta !== 0) return typeDelta;
          const matchDelta = left.matchNumber - right.matchNumber;
          if (matchDelta !== 0) return matchDelta;
          return Number(left.teamNumber) - Number(right.teamNumber);
        })
        .map(record => ({
          ...record,
          robotDied: record.robotDied ? 'yes' : 'no',
          commsLost: record.commsLost ? 'yes' : 'no',
          mechanismBroke: record.mechanismBroke ? 'yes' : 'no',
          tippedOver: record.tippedOver ? 'yes' : 'no',
          substituteScoutName: record.substituteScoutName || '',
          timestamp: formatWorksheetDate(record.timestamp),
          deviceId: record.deviceId || ''
        })));

      addWorkbookSheet(workbook, 'Coverage Audit', [
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Match Type', key: 'matchType', width: 16 },
        { header: 'Match', key: 'matchKey', width: 14 },
        { header: 'Schedule Known', key: 'scheduleKnown', width: 16 },
        { header: 'Match Status', key: 'matchStatus', width: 28 },
        { header: 'Row Kind', key: 'rowKind', width: 16 },
        { header: 'Slot', key: 'slot', width: 12 },
        { header: 'Expected Team', key: 'expectedTeam', width: 14 },
        { header: 'Expected Team Name', key: 'expectedTeamName', width: 24 },
        { header: 'Assigned Scout', key: 'assignedScout', width: 18 },
        { header: 'Submitted Team', key: 'submittedTeam', width: 14 },
        { header: 'Submitted Team Name', key: 'submittedTeamName', width: 24 },
        { header: 'Submitted By', key: 'submittedBy', width: 18 },
        { header: 'Substitute', key: 'substituteScout', width: 14 },
        { header: 'Actual Slot', key: 'actualSlot', width: 12 },
        { header: 'Actual Alliance', key: 'actualAlliance', width: 14 },
        { header: 'Anomalies', key: 'anomalies', width: 32 },
        { header: 'Total Points', key: 'totalPoints', width: 14 },
        { header: 'Role', key: 'rolePlayed', width: 14 },
        { header: 'Notes', key: 'notes', width: 42 }
      ], coverageAuditRows);

      addWorkbookSheet(workbook, 'Local Archive', [
        { header: 'Record ID', key: 'recordId', width: 42 },
        { header: 'Logical ID', key: 'logicalId', width: 28 },
        { header: 'Type', key: 'recordType', width: 14 },
        { header: 'Source', key: 'source', width: 14 },
        { header: 'Sync Status', key: 'syncStatus', width: 16 },
        { header: 'Sync Mode', key: 'syncMode', width: 14 },
        { header: 'Deleted', key: 'deleted', width: 10 },
        { header: 'Deleted At', key: 'deletedAt', width: 24 },
        { header: 'Last Firebase Attempt', key: 'lastFirebaseAttemptAt', width: 24 },
        { header: 'Last Firebase Error', key: 'lastFirebaseError', width: 42 },
        { header: 'Username', key: 'username', width: 18 },
        { header: 'Device ID', key: 'deviceId', width: 24 },
        { header: 'Updated At', key: 'updatedAt', width: 24 },
        { header: 'Payload JSON', key: 'payloadJson', width: 80 }
      ], exportedLocalArchiveRecords.map(record => ({
        recordId: record.recordId,
        logicalId: record.logicalId,
        recordType: record.recordType,
        source: record.source,
        syncStatus: record.syncStatus,
        syncMode: record.syncMode || 'strict',
        deleted: record.deleted ? 'yes' : 'no',
        deletedAt: record.deletedAt ? new Date(record.deletedAt).toISOString() : '',
        lastFirebaseAttemptAt: record.lastFirebaseAttemptAt ? new Date(record.lastFirebaseAttemptAt).toISOString() : '',
        lastFirebaseError: record.lastFirebaseError || '',
        username: record.username,
        deviceId: record.deviceId,
        updatedAt: record.updatedAt ? new Date(record.updatedAt).toISOString() : '',
        payloadJson: stringifyForWorkbookCell(record.payload)
      })));

      addWorkbookSheet(workbook, 'Raw Data', [
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Match Type', key: 'matchType', width: 14 },
        { header: 'Match Number', key: 'matchNumber', width: 12 },
        { header: 'Match Key', key: 'matchKey', width: 18 },
        { header: 'Team Number', key: 'teamNumber', width: 12 },
        { header: 'Scout Name', key: 'scoutName', width: 18 },
        { header: 'Assigned Scout', key: 'assignedScoutName', width: 18 },
        { header: 'Assigned Slot', key: 'assignedSlot', width: 12 },
        { header: 'Substitute', key: 'substituteScoutName', width: 14 },
        { header: 'Alliance', key: 'alliance', width: 10 },
        { header: 'Legacy Derived', key: 'legacyDerived', width: 14 },
        { header: 'Close Accuracy', key: 'closeAccuracy', width: 14 },
        { header: 'Middle Accuracy', key: 'middleAccuracy', width: 14 },
        { header: 'Far Accuracy', key: 'farAccuracy', width: 14 },
        { header: 'Contribution Score', key: 'contributionScore', width: 16 },
        { header: 'Starting Position', key: 'startingPosition', width: 16 },
        { header: 'Auto Points', key: 'autoPoints', width: 12 },
        { header: 'Auto Climbed', key: 'autoClimbed', width: 12 },
        { header: 'Teleop Cycles', key: 'teleopCycles', width: 13 },
        { header: 'Teleop Points', key: 'teleopPoints', width: 13 },
        { header: 'Teleop Climbed', key: 'teleopClimbed', width: 14 },
        { header: 'Shooting Style', key: 'shootingStyle', width: 16 },
        { header: 'Climb Level', key: 'climbLevel', width: 12 },
        { header: 'Trench Pushing', key: 'trenchPushing', width: 14 },
        { header: 'Passing', key: 'passing', width: 12 },
        { header: 'Driver Skill', key: 'driverSkill', width: 12 },
        { header: 'Teamwork', key: 'teamwork', width: 12 },
        { header: 'Defense Description', key: 'defenseDescription', width: 30 },
        { header: 'General Evaluation', key: 'generalEvaluation', width: 30 },
        { header: 'Total Match Points', key: 'totalMatchPoints', width: 16 },
        { header: 'Timestamp', key: 'timestamp', width: 24 },
        { header: 'Device ID', key: 'deviceId', width: 24 }
      ], [...records]
        .sort((left, right) => {
          const typeDelta =
            (left.matchType === 'Qualification' ? 0 : 1) - (right.matchType === 'Qualification' ? 0 : 1);
          if (typeDelta !== 0) return typeDelta;
          const matchDelta = left.matchNumber - right.matchNumber;
          if (matchDelta !== 0) return matchDelta;
          return Number(left.teamNumber) - Number(right.teamNumber);
        })
        .map(record => ({
          ...record,
          legacyDerived: record.legacyDerived ? 'yes' : 'no',
          autoClimbed: record.autoClimbed ? 'yes' : 'no',
          teleopClimbed: record.teleopClimbed ? 'yes' : 'no',
          substituteScoutName: record.substituteScoutName || '',
          timestamp: formatWorksheetDate(record.timestamp),
          deviceId: record.deviceId || ''
        })));

      addWorkbookSheet(workbook, 'Defense Raw Data', [
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Match Type', key: 'matchType', width: 14 },
        { header: 'Match Number', key: 'matchNumber', width: 12 },
        { header: 'Match Key', key: 'matchKey', width: 18 },
        { header: 'Team Number', key: 'teamNumber', width: 12 },
        { header: 'Scout Name', key: 'scoutName', width: 18 },
        { header: 'Assigned Scout', key: 'assignedScoutName', width: 18 },
        { header: 'Assigned Slot', key: 'assignedSlot', width: 12 },
        { header: 'Substitute', key: 'substituteScoutName', width: 14 },
        { header: 'Alliance', key: 'alliance', width: 10 },
        { header: 'Defense Metric', key: 'defenseMetric', width: 16 },
        { header: 'Defense Comments', key: 'defenseComments', width: 36 },
        { header: 'General Comments', key: 'generalComments', width: 36 },
        { header: 'Timestamp', key: 'timestamp', width: 24 },
        { header: 'Device ID', key: 'deviceId', width: 24 }
      ], [...defenseRecords]
        .sort((left, right) => {
          const typeDelta =
            (left.matchType === 'Qualification' ? 0 : 1) - (right.matchType === 'Qualification' ? 0 : 1);
          if (typeDelta !== 0) return typeDelta;
          const matchDelta = left.matchNumber - right.matchNumber;
          if (matchDelta !== 0) return matchDelta;
          return Number(left.teamNumber) - Number(right.teamNumber);
        })
        .map(record => ({
          ...record,
          defenseMetric: Number((record.defenseMetric * 100).toFixed(2)),
          substituteScoutName: record.substituteScoutName || '',
          timestamp: formatWorksheetDate(record.timestamp),
          deviceId: record.deviceId || ''
        })));

      addWorkbookSheet(workbook, 'Team Metrics', [
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Current TBA Rank', key: 'currentTbaRank', width: 14 },
        { header: 'PPC', key: 'ppc', width: 12 },
        { header: 'cPPC Auto', key: 'cppcAuto', width: 12 },
        { header: 'cPPC Teleop', key: 'cppcTeleop', width: 14 },
        { header: 'PPC Endgame', key: 'ppcEndgame', width: 14 },
        { header: 'PPC Reliability', key: 'ppcReliability', width: 16 },
        { header: 'PPC Matches', key: 'ppcMatches', width: 12 },
        { header: 'Defense Metric', key: 'defenseMetric', width: 14 },
        { header: 'Defense Records', key: 'defenseRecords', width: 14 },
        { header: 'OPR', key: 'opr', width: 12 },
        { header: 'DPR', key: 'dpr', width: 12 },
        { header: 'cOPR Auto', key: 'coprAuto', width: 12 },
        { header: 'cOPR Teleop', key: 'coprTeleop', width: 14 },
        { header: 'cOPR Fuel', key: 'coprFuel', width: 12 },
        { header: 'cOPR Tower', key: 'coprTower', width: 12 },
        { header: 'cOPR Total', key: 'coprTotal', width: 12 },
        { header: 'EPA', key: 'epa', width: 12 },
        { header: 'cEPA Auto', key: 'cepaAuto', width: 12 },
        { header: 'cEPA Teleop', key: 'cepaTeleop', width: 14 },
        { header: 'cEPA Fuel', key: 'cepaFuel', width: 12 },
        { header: 'cEPA Tower', key: 'cepaTower', width: 12 },
        { header: 'EPA Source', key: 'epaSource', width: 16 },
        { header: 'PPA Expected', key: 'ppaExpected', width: 14 },
        { header: 'PPA Floor', key: 'ppaFloor', width: 12 },
        { header: 'PPA Ceiling', key: 'ppaCeiling', width: 12 },
        { header: 'PPA Normal Low', key: 'ppaNormalLow', width: 16 },
        { header: 'PPA Normal High', key: 'ppaNormalHigh', width: 16 },
        { header: 'PPA Role Fit', key: 'ppaRoleFit', width: 16 },
        { header: 'PPA Uncertainty', key: 'ppaUncertainty', width: 18 },
        { header: 'PPA Tail Risk', key: 'ppaTailRisk', width: 18 },
        { header: 'PPA Scout Confidence', key: 'ppaScoutConfidence', width: 22 },
        { header: 'PPA Coverage', key: 'ppaCoverage', width: 22 }
      ], allKnownTeams.map(teamNumber => {
        const teamAverage = teamAverageLookupByTeam[teamNumber];
        const defenseMetric = defenseMetricLookupByTeam[teamNumber];
        const epaMetrics = epaByTeam[teamNumber];
        const oprComponents = csvOprComponents[teamNumber];
        const ppaInsight = exportPpaInsightsByTeam[teamNumber];
        return {
          teamNumber,
          teamName: resolvedTeamNameLookup[teamNumber] || '',
          currentTbaRank: effectiveCurrentTbaRanks[teamNumber] ?? '',
          ppc: teamAverage?.avgTotalMatchPoints ?? '',
          cppcAuto: teamAverage?.avgAutoPoints ?? '',
          cppcTeleop: teamAverage?.avgTeleopPoints ?? '',
          ppcEndgame: teamAverage?.avgEndgamePoints ?? '',
          ppcReliability: teamAverage ? Number((teamAverage.avgReliabilityScore * 100).toFixed(2)) : '',
          ppcMatches: teamAverage?.matchesPlayed ?? 0,
          defenseMetric: defenseMetric ? Number((defenseMetric.avgDefenseMetric * 100).toFixed(2)) : '',
          defenseRecords: defenseMetric?.recordsLogged ?? 0,
          opr: activeOprRatings[teamNumber] ?? '',
          dpr: calculatedDprRatings[teamNumber] ?? '',
          coprAuto: oprComponents?.autoPoints ?? '',
          coprTeleop: oprComponents?.teleopPoints ?? '',
          coprFuel: oprComponents?.fuelPoints ?? '',
          coprTower: oprComponents?.towerPoints ?? '',
          coprTotal: oprComponents?.totalPoints ?? '',
          epa: epaMetrics?.overallEPA ?? '',
          cepaAuto: epaMetrics?.autoEPA ?? '',
          cepaTeleop: epaMetrics?.teleopEPA ?? '',
          cepaFuel: epaMetrics?.fuelEPA ?? '',
          cepaTower: epaMetrics?.towerEPA ?? '',
          epaSource: epaMetrics?.source || '',
          ppaExpected: ppaInsight?.projected.expected ?? '',
          ppaFloor: ppaInsight?.projected.floor ?? '',
          ppaCeiling: ppaInsight?.projected.ceiling ?? '',
          ppaNormalLow: ppaInsight?.projected.normalLow ?? '',
          ppaNormalHigh: ppaInsight?.projected.normalHigh ?? '',
          ppaRoleFit: ppaInsight?.role.label ?? '',
          ppaUncertainty: ppaInsight?.uncertainty.level ?? '',
          ppaTailRisk: ppaInsight?.tailRisk.label ?? '',
          ppaScoutConfidence: ppaInsight ? Number((ppaInsight.coverage.scoutConfidence * 100).toFixed(0)) : '',
          ppaCoverage: ppaInsight?.coverage.label ?? ''
        };
      }));

      addWorkbookSheet(workbook, 'PPA Insights', [
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Expected PPA', key: 'expectedPpa', width: 14 },
        { header: 'Floor', key: 'floor', width: 12 },
        { header: 'Ceiling', key: 'ceiling', width: 12 },
        { header: 'Normal Low', key: 'normalLow', width: 14 },
        { header: 'Normal High', key: 'normalHigh', width: 14 },
        { header: 'Role Fit', key: 'roleFit', width: 18 },
        { header: 'Role Reason', key: 'roleReason', width: 54 },
        { header: 'Uncertainty', key: 'uncertainty', width: 14 },
        { header: 'Uncertainty Reasons', key: 'uncertaintyReasons', width: 60 },
        { header: 'Tail Risk', key: 'tailRisk', width: 16 },
        { header: 'Tail Risk Reasons', key: 'tailRiskReasons', width: 60 },
        { header: 'Coverage', key: 'coverage', width: 22 },
        { header: 'Scout Confidence', key: 'scoutConfidence', width: 18 },
        { header: 'Matches Logged', key: 'matchesLogged', width: 16 },
        { header: 'PPC Component', key: 'ppc', width: 14 },
        { header: 'OPR Component', key: 'opr', width: 14 },
        { header: 'EPA Component', key: 'epa', width: 14 },
        { header: 'Defense Impact', key: 'defenseImpact', width: 16 },
        { header: 'Model Source', key: 'modelSource', width: 42 },
        { header: 'Validation', key: 'validation', width: 70 }
      ], allKnownTeams.map(teamNumber => {
        const insight = exportPpaInsightsByTeam[teamNumber];
        return {
          teamNumber,
          teamName: insight?.teamName || resolvedTeamNameLookup[teamNumber] || '',
          expectedPpa: insight?.projected.expected ?? '',
          floor: insight?.projected.floor ?? '',
          ceiling: insight?.projected.ceiling ?? '',
          normalLow: insight?.projected.normalLow ?? '',
          normalHigh: insight?.projected.normalHigh ?? '',
          roleFit: insight?.role.label ?? '',
          roleReason: insight?.role.reason ?? '',
          uncertainty: insight?.uncertainty.level ?? '',
          uncertaintyReasons: insight?.uncertainty.reasons.join(' | ') ?? '',
          tailRisk: insight?.tailRisk.label ?? '',
          tailRiskReasons: insight?.tailRisk.reasons.join(' | ') ?? '',
          coverage: insight?.coverage.label ?? '',
          scoutConfidence: insight ? Number((insight.coverage.scoutConfidence * 100).toFixed(0)) : '',
          matchesLogged: insight?.coverage.matchesLogged ?? '',
          ppc: insight?.components.ppc ?? '',
          opr: insight?.components.opr ?? '',
          epa: insight?.components.epa ?? '',
          defenseImpact: insight?.components.defenseImpact ?? '',
          modelSource: insight?.source.modelSource ?? '',
          validation: insight?.source.validationLine ?? ''
        };
      }));

      addQualificationProjectionSheet(workbook, 'PPC Ranking', ppcQualificationProjection.rows, resolvedTeamNameLookup);
      addQualificationProjectionSheet(workbook, 'PPA Ranking', ppaQualificationProjection.rows, resolvedTeamNameLookup);
      addQualificationProjectionSheet(workbook, 'EPA Ranking', epaQualificationProjection.rows, resolvedTeamNameLookup);
      addQualificationProjectionSheet(workbook, 'OPR Ranking', oprQualificationProjection.rows, resolvedTeamNameLookup);

      addQualPredictionSheet(workbook, 'PPC Quals', ppcPredictions);
      addQualPredictionSheet(workbook, 'PPA Quals', ppaPredictions);
      addQualPredictionSheet(workbook, 'EPA Quals', epaPredictions);
      addQualPredictionSheet(workbook, 'OPR Quals', oprPredictions);
      addQualPredictionSheet(workbook, 'Best Validated Quals', bestValidatedQualRows);

      addFinalsProjectionSheet(workbook, 'PPC Finals', ppcFinalsProjection);
      addFinalsProjectionSheet(workbook, 'EPA Finals', epaFinalsProjection);
      addFinalsProjectionSheet(workbook, 'OPR Finals', oprFinalsProjection);

      addWorkbookSheet(workbook, 'Model Lab', [
        { header: 'Model', key: 'modelName', width: 18 },
        { header: 'Promote', key: 'eligibleForPromotion', width: 12 },
        { header: 'Team Ratings', key: 'supportsTeamRatings', width: 14 },
        { header: 'Leakage Risk', key: 'leakageRisk', width: 14 },
        { header: 'Source', key: 'sourceLabel', width: 44 },
        { header: 'Matches Tested', key: 'matchesTested', width: 16 },
        { header: 'Winner Accuracy', key: 'winnerAccuracy', width: 18 },
        { header: 'Average Confidence', key: 'averageConfidence', width: 20 },
        { header: 'Brier Score', key: 'brierScore', width: 14 },
        { header: 'Avg Score Miss', key: 'scoreMae', width: 16 },
        { header: 'Avg Margin Miss', key: 'marginMae', width: 17 },
        { header: 'Calibration Error', key: 'calibrationError', width: 18 },
        { header: 'Low Confidence Rate', key: 'lowConfidenceRate', width: 20 },
        { header: 'Uncertainty Note', key: 'uncertaintyNote', width: 64 }
      ], modelBacktests.map(row => ({ ...row })));

      addWorkbookSheet(workbook, 'Model Calibration', [
        { header: 'Model', key: 'modelName', width: 18 },
        { header: 'Confidence Bin', key: 'binLabel', width: 18 },
        { header: 'Min Confidence', key: 'minConfidence', width: 16 },
        { header: 'Max Confidence', key: 'maxConfidence', width: 16 },
        { header: 'Matches', key: 'matches', width: 12 },
        { header: 'Predicted Win Rate', key: 'predictedWinRate', width: 20 },
        { header: 'Actual Win Rate', key: 'actualWinRate', width: 18 },
        { header: 'Calibration Gap', key: 'calibrationGap', width: 18 }
      ], modelBacktests.flatMap(row => row.calibrationBins.map(bin => ({ ...bin }))));

      const exportedFeatureRows = exportedFeatureSnapshots.flatMap(snapshot =>
        Object.entries(snapshot.featuresByTeam).map(([teamNumber, features]) => {
          const featureValues = (features || {}) as Record<string, number>;
          return {
            snapshotId: snapshot.id,
            createdAt: new Date(snapshot.createdAt).toISOString(),
            modelName: snapshot.modelName,
            beforeMatchKey: snapshot.beforeMatchKey,
            teamNumber,
            teamName: resolvedTeamNameLookup[teamNumber] || '',
            ...featureValues
          };
        })
      );
      const featureKeys = Array.from(new Set(exportedFeatureRows.flatMap(row =>
        Object.keys(row).filter(key => !['snapshotId', 'createdAt', 'modelName', 'beforeMatchKey', 'teamNumber', 'teamName'].includes(key))
      ))).sort((left, right) => left.localeCompare(right));
      addWorkbookSheet(workbook, 'Model Features', [
        { header: 'Snapshot ID', key: 'snapshotId', width: 28 },
        { header: 'Created At', key: 'createdAt', width: 24 },
        { header: 'Model', key: 'modelName', width: 18 },
        { header: 'Before Match', key: 'beforeMatchKey', width: 16 },
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        ...featureKeys.map(key => ({ header: key, key, width: 16 }))
      ], exportedFeatureRows);

      addWorkbookSheet(workbook, 'No-Future Features', [
        { header: 'Match', key: 'matchKey', width: 18 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'Alliance', key: 'alliance', width: 10 },
        { header: 'Station', key: 'station', width: 10 },
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'PPC Before', key: 'ppcBefore', width: 14 },
        { header: 'Rolling PPC Before', key: 'rollingPpcBefore', width: 20 },
        { header: 'Scouting Rows Before', key: 'scoutingRowsBefore', width: 22 },
        { header: 'OPR Before', key: 'oprBefore', width: 14 },
        { header: 'Rolling OPR Before', key: 'rollingOprBefore', width: 20 },
        { header: 'Official Matches Before', key: 'officialMatchesBefore', width: 24 }
      ], noFutureFeatureMatchSnapshots.flatMap(snapshot => {
        const redRows = snapshot.redTeams.map((teamNumber, index) => ({
          matchKey: snapshot.matchKey,
          matchNumber: snapshot.matchNumber,
          alliance: 'Red',
          station: `R${index + 1}`,
          teamNumber,
          teamName: resolvedTeamNameLookup[teamNumber] || '',
          ...(snapshot.featuresByTeam[teamNumber] || {})
        }));
        const blueRows = snapshot.blueTeams.map((teamNumber, index) => ({
          matchKey: snapshot.matchKey,
          matchNumber: snapshot.matchNumber,
          alliance: 'Blue',
          station: `B${index + 1}`,
          teamNumber,
          teamName: resolvedTeamNameLookup[teamNumber] || '',
          ...(snapshot.featuresByTeam[teamNumber] || {})
        }));
        return [...redRows, ...blueRows];
      }));

      addWorkbookSheet(workbook, 'Scout Calibration', [
        { header: 'Scout', key: 'scoutName', width: 18 },
        { header: 'Assigned Scout', key: 'assignedScoutName', width: 18 },
        { header: 'Rows', key: 'rows', width: 10 },
        { header: 'Matches', key: 'matches', width: 10 },
        { header: 'Bias Label', key: 'biasLabel', width: 16 },
        { header: 'Average Official Minus Scout', key: 'averageOfficialMinusScout', width: 28 },
        { header: 'Average Absolute Error', key: 'averageAbsoluteError', width: 22 },
        { header: 'Total Scouted Points', key: 'totalScoutedPoints', width: 22 },
        { header: 'Official Share Points', key: 'officialSharePoints', width: 22 }
      ], scoutCalibrationRows.map(row => ({ ...row })));

      addWorkbookSheet(workbook, 'Team Profiles', [
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Matches Played', key: 'matchesPlayed', width: 16 },
        { header: 'Peak Score', key: 'peakScore', width: 14 },
        { header: 'Worst Score', key: 'worstScore', width: 14 },
        { header: 'Lowest Nonzero', key: 'lowestNonZeroScore', width: 16 },
        { header: 'Average', key: 'averageScore', width: 14 },
        { header: 'Std Dev', key: 'standardDeviation', width: 14 },
        { header: 'Floor', key: 'floorScore', width: 12 },
        { header: 'Ceiling', key: 'ceilingScore', width: 12 },
        { header: 'Projected Next', key: 'projectedNextScore', width: 16 },
        { header: 'Consistency Index', key: 'consistencyIndex', width: 18 },
        { header: 'Upset Potential', key: 'upsetPotential', width: 16 },
        { header: 'Zero Rate', key: 'zeroRate', width: 12 },
        { header: 'Normal Low', key: 'normalLowScore', width: 14 },
        { header: 'Normal High', key: 'normalHighScore', width: 14 },
        { header: 'Volatility', key: 'volatility', width: 14 },
        { header: 'Reliability', key: 'reliability', width: 14 },
        { header: 'Recent Trend', key: 'recentTrend', width: 14 },
        { header: 'PPC', key: 'ppc', width: 12 },
        { header: 'OPR', key: 'opr', width: 12 },
        { header: 'DPR', key: 'dpr', width: 12 },
        { header: 'EPA', key: 'epa', width: 12 },
        { header: 'PPA', key: 'ppa', width: 12 },
        { header: 'Defense Impact', key: 'defenseImpact', width: 16 }
      ], teamProfiles.map(profile => ({
        ...profile,
        teamName: resolvedTeamNameLookup[profile.teamNumber] || ''
      })));

      addWorkbookSheet(workbook, 'Team Curves', [
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Match', key: 'matchKey', width: 18 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'Raw Score', key: 'score', width: 12 },
        { header: 'Rolling Average', key: 'rollingAverage', width: 16 },
        { header: 'Fitted Score', key: 'fittedScore', width: 14 },
        { header: 'Lower Band', key: 'lowerBand', width: 14 },
        { header: 'Upper Band', key: 'upperBand', width: 14 },
        { header: 'Team Average', key: 'averageScore', width: 14 },
        { header: 'Std Dev', key: 'standardDeviation', width: 12 },
        { header: 'Projected Next', key: 'projectedNextScore', width: 16 }
      ], teamProfiles.flatMap(profile => profile.curve.map(point => ({
        ...point,
        teamNumber: profile.teamNumber,
        teamName: resolvedTeamNameLookup[profile.teamNumber] || '',
        averageScore: profile.averageScore,
        standardDeviation: profile.standardDeviation,
        projectedNextScore: profile.projectedNextScore
      }))));

      addWorkbookSheet(workbook, 'Team Model Curves', [
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Match', key: 'matchKey', width: 18 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'PPC Before', key: 'ppcBefore', width: 14 },
        { header: 'Rolling PPC Before', key: 'rollingPpcBefore', width: 20 },
        { header: 'OPR Before', key: 'oprBefore', width: 14 },
        { header: 'Rolling OPR Before', key: 'rollingOprBefore', width: 20 },
        { header: 'EPA Context', key: 'epa', width: 14 },
        { header: 'PPA Context', key: 'ppa', width: 14 }
      ], teamProfiles.flatMap(profile => profile.modelCurve.map(point => ({
        ...point,
        teamNumber: profile.teamNumber,
        teamName: resolvedTeamNameLookup[profile.teamNumber] || ''
      }))));

      const defenseSummaryRows = Array.from(
        defenseAttributions.reduce((buckets, record) => {
          const bucket = buckets.get(record.defenderTeamNumber) || [];
          bucket.push(record);
          buckets.set(record.defenderTeamNumber, bucket);
          return buckets;
        }, new Map<string, typeof defenseAttributions>())
      ).map(([teamNumber, defenderRecords]) => {
        const targetCounts = new Map<string, number>();
        defenderRecords.forEach(record => targetCounts.set(record.targetTeamNumber, (targetCounts.get(record.targetTeamNumber) || 0) + 1));
        const topTarget = Array.from(targetCounts.entries())
          .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]))[0]?.[0] || '';
        return {
          teamNumber,
          teamName: resolvedTeamNameLookup[teamNumber] || '',
          weightedDenied: defenderRecords.reduce((sum, record) => sum + record.pointsDenied * record.confidence, 0),
          rawDenied: defenderRecords.reduce((sum, record) => sum + record.pointsDenied, 0),
          records: defenderRecords.length,
          avgConfidence: defenderRecords.length ? defenderRecords.reduce((sum, record) => sum + record.confidence, 0) / defenderRecords.length : 0,
          targetsAffected: targetCounts.size,
          topTarget,
          topTargetName: resolvedTeamNameLookup[topTarget] || '',
          dpr: calculatedDprRatings[teamNumber] ?? ''
        };
      }).sort((left, right) => right.weightedDenied - left.weightedDenied || Number(left.teamNumber) - Number(right.teamNumber));

      addWorkbookSheet(workbook, 'Defense Summary', [
        { header: 'Defender', key: 'teamNumber', width: 10 },
        { header: 'Defender Name', key: 'teamName', width: 24 },
        { header: 'Weighted Points Denied', key: 'weightedDenied', width: 24 },
        { header: 'Raw Points Denied', key: 'rawDenied', width: 18 },
        { header: 'Records', key: 'records', width: 10 },
        { header: 'Average Confidence', key: 'avgConfidence', width: 20 },
        { header: 'Targets Affected', key: 'targetsAffected', width: 18 },
        { header: 'Top Target', key: 'topTarget', width: 12 },
        { header: 'Top Target Name', key: 'topTargetName', width: 24 },
        { header: 'DPR', key: 'dpr', width: 12 }
      ], defenseSummaryRows);

      addWorkbookSheet(workbook, 'Defense Attribution', [
        { header: 'Event', key: 'eventKey', width: 14 },
        { header: 'Match', key: 'matchKey', width: 18 },
        { header: 'Defender', key: 'defenderTeamNumber', width: 12 },
        { header: 'Target', key: 'targetTeamNumber', width: 12 },
        { header: 'Expected Target Points', key: 'expectedTargetPoints', width: 22 },
        { header: 'Actual Target Points', key: 'actualTargetPoints', width: 20 },
        { header: 'Points Denied', key: 'pointsDenied', width: 16 },
        { header: 'Confidence', key: 'confidence', width: 14 },
        { header: 'Source', key: 'source', width: 14 }
      ], defenseAttributions.map(row => ({ ...row })));

      addWorkbookSheet(workbook, 'Strategy Plans', [
        { header: 'Match', key: 'matchKey', width: 18 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'Comp Level', key: 'compLevel', width: 12 },
        { header: 'Match Type', key: 'matchType', width: 16 },
        { header: 'Model', key: 'modelName', width: 18 },
        { header: 'Model Source', key: 'modelSource', width: 42 },
        { header: 'Model Low Confidence', key: 'modelLowConfidence', width: 22 },
        { header: 'Red Teams', key: 'redTeams', width: 28 },
        { header: 'Blue Teams', key: 'blueTeams', width: 28 },
        { header: 'Baseline Red', key: 'baselineRedScore', width: 14 },
        { header: 'Baseline Blue', key: 'baselineBlueScore', width: 14 },
        { header: 'Optimized Red', key: 'optimizedRedScore', width: 14 },
        { header: 'Optimized Blue', key: 'optimizedBlueScore', width: 14 },
        { header: 'Red Defense Swing', key: 'redDefenseSwing', width: 18 },
        { header: 'Blue Defense Swing', key: 'blueDefenseSwing', width: 18 },
        { header: 'Best Red Plan', key: 'bestRedPlan', width: 34 },
        { header: 'Best Blue Plan', key: 'bestBluePlan', width: 34 },
        { header: 'Winner', key: 'predictedWinner', width: 12 },
        { header: 'Predicted Margin', key: 'predictedMargin', width: 16 },
        { header: 'Confidence', key: 'confidence', width: 14 },
        { header: 'Red Projected RP', key: 'redProjectedRp', width: 18 },
        { header: 'Red Tower Metric', key: 'redTowerMetric', width: 18 },
        { header: 'Red Fuel Metric', key: 'redFuelMetric', width: 18 },
        { header: 'Red RP Note', key: 'redRpNote', width: 52 },
        { header: 'Blue Projected RP', key: 'blueProjectedRp', width: 18 },
        { header: 'Blue Tower Metric', key: 'blueTowerMetric', width: 18 },
        { header: 'Blue Fuel Metric', key: 'blueFuelMetric', width: 18 },
        { header: 'Blue RP Note', key: 'blueRpNote', width: 52 },
        { header: 'Opponent Counter-Strategy', key: 'opponentCounterStrategy', width: 68 },
        { header: 'Risk Flags', key: 'riskFlags', width: 36 },
        { header: 'Win Condition', key: 'winCondition', width: 56 }
      ], strategyPlans.map(plan => ({
        ...plan,
        redTeams: plan.redTeams.join(', '),
        blueTeams: plan.blueTeams.join(', '),
        redProjectedRp: plan.redRpPath.projectedRp,
        redTowerMetric: plan.redRpPath.towerMetric,
        redFuelMetric: plan.redRpPath.fuelMetric,
        redRpNote: plan.redRpPath.note,
        blueProjectedRp: plan.blueRpPath.projectedRp,
        blueTowerMetric: plan.blueRpPath.towerMetric,
        blueFuelMetric: plan.blueRpPath.fuelMetric,
        blueRpNote: plan.blueRpPath.note,
        riskFlags: plan.riskFlags.join(' | ')
      })));

      addWorkbookSheet(workbook, 'Strategy Role Options', [
        { header: 'Match', key: 'matchKey', width: 18 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'Alliance', key: 'alliance', width: 10 },
        { header: 'Option', key: 'label', width: 24 },
        { header: 'Recommended', key: 'recommended', width: 14 },
        { header: 'Own Score', key: 'ownScore', width: 12 },
        { header: 'Opponent Score', key: 'opponentScore', width: 16 },
        { header: 'Net Margin', key: 'netMargin', width: 14 },
        { header: 'Offense Lost', key: 'offenseCost', width: 14 },
        { header: 'Points Denied', key: 'defenseValue', width: 14 },
        { header: 'Rationale', key: 'rationale', width: 56 }
      ], strategyPlans.flatMap(plan =>
        [...plan.redRoleOptions, ...plan.blueRoleOptions].map(option => ({
          matchKey: plan.matchKey,
          matchNumber: plan.matchNumber,
          alliance: option.alliance,
          label: option.label,
          recommended: option.recommended ? 'yes' : 'no',
          ownScore: option.ownScore,
          opponentScore: option.opponentScore,
          netMargin: option.netMargin,
          offenseCost: option.offenseCost,
          defenseValue: option.defenseValue,
          rationale: option.rationale
        }))
      ));

      addWorkbookSheet(workbook, 'Alliance Picklist', [
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Score', key: 'score', width: 14 },
        { header: 'Seed Fit', key: 'seedFit', width: 24 },
        { header: 'Role Fit', key: 'roleFit', width: 28 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Picked By', key: 'pickedBy', width: 16 },
        { header: 'Rationale', key: 'rationale', width: 70 }
      ], allianceRecommendations.map(row => ({
        ...row,
        teamName: resolvedTeamNameLookup[row.teamNumber] || '',
        pickedBy: row.pickedBy || ''
      })));

      addWorkbookSheet(workbook, 'Source Cache', [
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Year', key: 'year', width: 10 },
        { header: 'Source', key: 'source', width: 14 },
        { header: 'Key', key: 'key', width: 24 },
        { header: 'Cached At', key: 'timestamp', width: 24 },
        { header: 'Payload Bytes', key: 'payloadBytes', width: 14 },
        { header: 'Payload Preview', key: 'payloadPreview', width: 80 }
      ], exportedCacheEntries
        .sort((left, right) => left.source.localeCompare(right.source) || left.key.localeCompare(right.key))
        .map(entry => {
          const payloadText = JSON.stringify(entry.payload);
          return {
            eventKey: entry.eventKey,
            year: entry.year,
            source: entry.source,
            key: entry.key,
            timestamp: new Date(entry.timestamp).toISOString(),
            payloadBytes: payloadText.length,
            payloadPreview: payloadText.slice(0, 500)
          };
        }));

      addWorkbookSheet(workbook, 'Source Freshness', [
        { header: 'Source', key: 'source', width: 14 },
        { header: 'Dataset', key: 'key', width: 24 },
        { header: 'Detail', key: 'detail', width: 44 },
        { header: 'Freshness', key: 'freshness', width: 18 },
        { header: 'Loaded At', key: 'loadedAt', width: 24 }
      ], sourceStatusRows.map(row => ({
        source: row.source,
        key: row.key,
        detail: row.detail,
        freshness: formatFreshnessAge(row.timestamp),
        loadedAt: row.timestamp ? new Date(row.timestamp).toISOString() : ''
      })));

      addWorkbookSheet(workbook, 'Scout Assignments', [
        { header: 'Plan ID', key: 'planId', width: 32 },
        { header: 'Created At', key: 'createdAt', width: 24 },
        { header: 'Match Type', key: 'matchType', width: 16 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'Match Key', key: 'matchKey', width: 18 },
        { header: 'Station', key: 'station', width: 12 },
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Scout', key: 'scoutName', width: 18 },
        { header: 'Reason', key: 'priorityReason', width: 44 }
      ], exportedScoutPlan
        ? exportedScoutPlan.assignments.map(assignment => ({
          planId: exportedScoutPlan.id,
          createdAt: new Date(exportedScoutPlan.createdAt).toISOString(),
          ...assignment,
          teamName: resolvedTeamNameLookup[assignment.teamNumber] || ''
        }))
        : []);

      addWorkbookSheet(workbook, 'Scout Coverage Gaps', [
        { header: 'Plan ID', key: 'planId', width: 32 },
        { header: 'Created At', key: 'createdAt', width: 24 },
        { header: 'Match Type', key: 'matchType', width: 16 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'Match Key', key: 'matchKey', width: 18 },
        { header: 'Station', key: 'station', width: 12 },
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Reason', key: 'reason', width: 52 }
      ], exportedScoutPlan
        ? (exportedScoutPlan.coverageGaps || []).map(gap => ({
          planId: exportedScoutPlan.id,
          createdAt: new Date(exportedScoutPlan.createdAt).toISOString(),
          ...gap,
          teamName: resolvedTeamNameLookup[gap.teamNumber] || ''
        }))
        : []);

      addWorkbookSheet(workbook, 'Scout Exposure', [
        { header: 'Scout', key: 'scoutName', width: 18 },
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Assigned Matches', key: 'assignedMatches', width: 18 }
      ], exportedScoutPlan
        ? Object.entries(exportedScoutPlan.exposureCounts).flatMap(([scoutName, teamCounts]) =>
          Object.entries(teamCounts).map(([teamNumber, assignedMatches]) => ({
            scoutName,
            teamNumber,
            teamName: resolvedTeamNameLookup[teamNumber] || '',
            assignedMatches
          }))
        )
        : []);

      addWorkbookSheet(workbook, 'PowerCoins', [
        { header: 'Scout', key: 'scoutName', width: 18 },
        { header: 'Balance', key: 'balance', width: 12 },
        { header: 'Open Bets', key: 'openBets', width: 12 },
        { header: 'Settled Bets', key: 'settledBets', width: 12 },
        { header: 'Total Staked', key: 'totalStaked', width: 14 },
        { header: 'Total Payout', key: 'totalPayout', width: 14 },
        { header: 'Ledger Delta', key: 'ledgerDelta', width: 14 }
      ], exportedPowerCoinBalances.map(row => {
        const scoutBets = exportedPowerCoinBets.filter(bet => bet.scoutName.trim().toLowerCase() === row.scoutName.trim().toLowerCase());
        const scoutLedger = exportedPowerCoinLedger.filter(entry => entry.scoutName.trim().toLowerCase() === row.scoutName.trim().toLowerCase());
        return {
          scoutName: row.scoutName,
          balance: row.balance,
          openBets: scoutBets.filter(bet => !bet.settledAt).length,
          settledBets: scoutBets.filter(bet => bet.settledAt).length,
          totalStaked: scoutBets.reduce((sum, bet) => sum + bet.amount, 0),
          totalPayout: scoutBets.reduce((sum, bet) => sum + (bet.payout ?? 0), 0),
          ledgerDelta: scoutLedger.reduce((sum, entry) => sum + entry.delta, 0)
        };
      }));

      addWorkbookSheet(workbook, 'PowerCoin Ledger', [
        { header: 'ID', key: 'id', width: 34 },
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Scout', key: 'scoutName', width: 18 },
        { header: 'Delta', key: 'delta', width: 12 },
        { header: 'Balance After', key: 'balanceAfter', width: 16 },
        { header: 'Reason', key: 'reason', width: 44 },
        { header: 'Match Key', key: 'matchKey', width: 18 },
        { header: 'Created At', key: 'createdAt', width: 24 }
      ], exportedPowerCoinLedger
        .sort((left, right) => right.createdAt - left.createdAt)
        .map(entry => ({
          ...entry,
          createdAt: new Date(entry.createdAt).toISOString()
        })));

      addWorkbookSheet(workbook, 'PowerCoin Bets', [
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Match Type', key: 'matchType', width: 16 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'Match Key', key: 'matchKey', width: 18 },
        { header: 'Scout', key: 'scoutName', width: 18 },
        { header: 'Side', key: 'side', width: 10 },
        { header: 'Stake', key: 'amount', width: 12 },
        { header: 'Placed At', key: 'placedAt', width: 24 },
        { header: 'Settled At', key: 'settledAt', width: 24 },
        { header: 'Outcome', key: 'outcome', width: 12 },
        { header: 'Payout', key: 'payout', width: 12 }
      ], exportedPowerCoinBets
        .sort((left, right) => left.matchNumber - right.matchNumber || left.scoutName.localeCompare(right.scoutName))
        .map(bet => ({
          ...bet,
          placedAt: new Date(bet.placedAt).toISOString(),
          settledAt: bet.settledAt ? new Date(bet.settledAt).toISOString() : '',
          outcome: bet.outcome || 'open',
          payout: bet.payout ?? ''
        })));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `adminv4_insights_${eventKey}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus('success');
      window.setTimeout(() => setExportStatus('idle'), 2500);
    } catch (err) {
      console.error('Failed to export Admin V4 workbook:', err);
      setError(err instanceof Error ? err.message : 'Failed to export the Admin V4 workbook.');
      setExportStatus('idle');
    }
  };

  const tabClass = (tab: AdminV2Tab) =>
    `admin-g2-sm inline-flex items-center gap-2 px-4 py-3 text-sm font-black transition-colors ${
      activeTab === tab
        ? 'bg-cyan-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  const metricButtonClass = (metric: AdminV2SelectedMetric) => {
    const isSelected = selectedMetric === metric;
    if (metric === 'ppa') {
      return `admin-g2-sm inline-flex items-center justify-center px-4 py-3 text-sm font-black transition-all ${
        isSelected
          ? 'bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 text-slate-950 shadow-lg shadow-orange-950/30'
          : 'border border-amber-400/50 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20'
      }`;
    }

    return `admin-g2-sm inline-flex items-center justify-center px-4 py-3 text-sm font-black transition-colors ${
      isSelected
        ? 'bg-fuchsia-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;
  };

  const predictorViewButtonClass = (view: PredictorDisplayTab) =>
    `admin-g2-sm inline-flex items-center gap-2 px-4 py-2.5 text-sm font-black transition-colors ${
      predictorViewTab === view
        ? 'bg-cyan-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  const resultsViewButtonClass = (view: ResultsDisplayTab) =>
    `admin-g2-sm inline-flex items-center gap-2 px-4 py-2.5 text-sm font-black transition-colors ${
      resultsViewTab === view
        ? 'bg-cyan-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  const rawEditorViewButtonClass = (view: ResultsDisplayTab) =>
    `admin-g2-sm inline-flex items-center gap-2 px-4 py-2.5 text-sm font-black transition-colors ${
      rawEditorViewTab === view
        ? 'bg-cyan-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  const activeWorkspaceKey: WorkflowTab =
    activeTab === 'wiki'
      ? (wikiReturnTab === 'wiki' ? 'command' : activeWorkspaceKeyFromTab(wikiReturnTab))
      : activeTab === 'results' || activeTab === 'simulator'
      ? 'predictor'
      : activeTab === 'rawEditor'
        ? 'import'
        : activeTab === 'teams'
          ? 'sorter'
        : activeTab;
  const activeWorkspace = workspaceItems.find(item => item.key === activeWorkspaceKey) ?? workspaceItems[0]!;

  const queueBackgroundRefreshForWorkflow = (tab: WorkflowTab) => {
    if (loading) return;
    const now = Date.now();
    const refreshKey = `${eventKey}:${effectiveTbaApiKey ? 'api' : 'cached'}:${tab}`;
    const lastRefreshStartedAt = tabRefreshCooldownRef.current[refreshKey] || 0;
    if (now - lastRefreshStartedAt < 15000) return;
    tabRefreshCooldownRef.current[refreshKey] = now;
    window.setTimeout(() => {
      void loadV3Data({ background: true, preserveScroll: true });
    }, 0);
  };

  const openWorkflow = (tab: WorkflowTab) => {
    setActiveTab(tab);
    setDrilldownTeamNumber('');
    setSelectedMatchKey('');
    setDataPanel(null);
    setInfoMenu(null);
    queueBackgroundRefreshForWorkflow(tab);
  };

  const openWiki = (statKey: StatInfoKey, fromTab: AdminV2Tab = activeTab) => {
    setWikiStatKey(statKey);
    setWikiReturnTab(fromTab === 'wiki' ? wikiReturnTab : fromTab);
    setInfoMenu(null);
    setActiveTab('wiki');
  };

  const openInfoMenu = (event: React.MouseEvent, statKey: StatInfoKey) => {
    event.preventDefault();
    setInfoMenu({ x: event.clientX, y: event.clientY, statKey });
  };

  const handleAdminBack = () => {
    if (activeTab === 'wiki') {
      setActiveTab(wikiReturnTab === 'wiki' ? 'command' : wikiReturnTab);
      return;
    }

    if (drilldownTeamNumber && activeTab === 'teams') {
      closeTeamDrilldown();
      return;
    }

    if (selectedMatchKey && activeTab === 'predictor') {
      setSelectedMatchKey('');
      return;
    }

    if (dataPanel && activeTab === 'import') {
      setDataPanel(null);
      return;
    }

    if (activeTab === 'results' || activeTab === 'simulator') {
      setActiveTab('predictor');
      return;
    }

    if (activeTab === 'rawEditor') {
      setActiveTab('import');
      return;
    }

    if (activeTab !== 'command') {
      setActiveTab('command');
      return;
    }

    navigate('/');
  };

  const adminBackLabel = activeTab === 'command' ? 'Home' : 'Back';

  const renderModelAwareAction = () => (
    <ModelToggleGroup selectedMetric={selectedMetric} onChange={metric => updateSettings({ selectedMetric: metric })} />
  );

  const renderNowView = () => {
    const nextMatches = activePredictions.slice(0, 5);
    const primaryPrediction = (
      ownTeamNumber
        ? nextMatches.find(match => [...match.red.teams, ...match.blue.teams].includes(ownTeamNumber))
        : null
    ) || nextMatches[0] || null;
    const primaryMatch = primaryPrediction
      ? activePredictorMatches.find(match => match.key === primaryPrediction.key) || null
      : null;
    const primaryStrategyPlan = primaryPrediction
      ? adminV2StrategyMatchPlans.find(plan => plan.matchKey === primaryPrediction.key) || null
      : null;
    const primaryRedTeams = primaryPrediction?.red.teams || primaryMatch?.alliances.red.team_keys.map(normalizeTeamKey) || [];
    const primaryBlueTeams = primaryPrediction?.blue.teams || primaryMatch?.alliances.blue.team_keys.map(normalizeTeamKey) || [];
    const primaryAlliance = ownTeamNumber && primaryRedTeams.includes(ownTeamNumber)
      ? 'Red'
      : ownTeamNumber && primaryBlueTeams.includes(ownTeamNumber)
        ? 'Blue'
        : '';
    const ourPrimaryTeams = primaryAlliance === 'Red' ? primaryRedTeams : primaryAlliance === 'Blue' ? primaryBlueTeams : primaryRedTeams;
    const opponentPrimaryTeams = primaryAlliance === 'Red' ? primaryBlueTeams : primaryAlliance === 'Blue' ? primaryRedTeams : primaryBlueTeams;
    const ourPrimaryPpa = summarizePpaAlliance(ourPrimaryTeams, ppaInsightsByTeam);
    const opponentPrimaryPpa = summarizePpaAlliance(opponentPrimaryTeams, ppaInsightsByTeam);
    const primaryLoggedTeams = new Set(
      primaryPrediction
        ? v4Records
          .filter(record => record.matchKey.toLowerCase() === primaryPrediction.key.toLowerCase())
          .map(record => record.teamNumber)
        : []
    );
    const primaryExpectedTeams = Array.from(new Set([...primaryRedTeams, ...primaryBlueTeams]));
    const primaryMissingScoutTeams = primaryExpectedTeams.filter(teamNumber => !primaryLoggedTeams.has(teamNumber));
    const primaryHighUncertaintyTeams = primaryExpectedTeams
      .filter(teamNumber => {
        const insight = ppaInsightsByTeam[teamNumber];
        return insight?.uncertainty.level === 'High' || (insight?.coverage.scoutConfidence ?? 0) < 0.5;
      })
      .slice(0, 5);
    const nowPriorities = [
      primaryPrediction
        ? {
          label: `Prepare ${primaryPrediction.title}`,
          detail: primaryStrategyPlan?.winCondition || `${primaryPrediction.predictedWinner} forecast. Open the match plan before drive-team strategy.`,
          tone: 'fuchsia' as const,
          action: () => {
            setSelectedMatchKey(primaryPrediction.key);
            setActiveTab('predictor');
          },
          actionLabel: 'Open Plan'
        }
        : {
          label: 'Load Schedule',
          detail: 'No future known-team matches are available. Refresh or upload a schedule before match strategy.',
          tone: 'amber' as const,
          action: () => {
            setDataPanel('imports');
            setActiveTab('import');
          },
          actionLabel: 'Open Imports'
        },
      primaryMissingScoutTeams.length > 0
        ? {
          label: 'Fill Next-Match Coverage',
          detail: `${primaryMissingScoutTeams.length} expected row${primaryMissingScoutTeams.length === 1 ? '' : 's'} missing for ${primaryPrediction?.title || 'the next known match'}: ${primaryMissingScoutTeams.slice(0, 6).join(', ')}.`,
          tone: 'rose' as const,
          action: () => {
            setDataPanel('audit');
            setActiveTab('import');
          },
          actionLabel: 'Audit'
        }
        : {
          label: 'Next Match Covered',
          detail: primaryPrediction ? 'Every known team in the next highlighted match has a local V4 row on this device.' : 'Coverage will appear after a schedule is loaded.',
          tone: 'emerald' as const,
          action: () => openWorkflow('predictor'),
          actionLabel: 'Matches'
        },
      primaryHighUncertaintyTeams.length > 0
        ? {
          label: 'Verify PPA Ranges',
          detail: `Read as ranges, not points: ${primaryHighUncertaintyTeams.join(', ')}.`,
          tone: 'amber' as const,
          action: () => openWiki('ppa', 'command'),
          actionLabel: 'PPA Wiki'
        }
        : {
          label: 'PPA Ready',
          detail: 'No high-uncertainty team is visible in the highlighted next match.',
          tone: 'emerald' as const,
          action: () => openWorkflow('visualize'),
          actionLabel: 'Visualize'
        },
      localArchiveSummary.unsyncedRecords.length > 0
        ? {
          label: 'Sync Local Rows',
          detail: `${localArchiveSummary.unsyncedRecords.length} locally saved row${localArchiveSummary.unsyncedRecords.length === 1 ? '' : 's'} still need Firebase sync.`,
          tone: 'amber' as const,
          action: () => {
            setDataPanel('collection');
            setActiveTab('import');
          },
          actionLabel: 'Sync'
        }
        : {
          label: 'Sources Stable',
          detail: `Latest cached/uploaded source: ${formatFreshnessAge(sourceStatusSummary.latestTimestamp)}.`,
          tone: sourceStatusSummary.rowCount > 0 ? 'cyan' as const : 'amber' as const,
          action: () => {
            setDataPanel('sources');
            setActiveTab('import');
          },
          actionLabel: 'Sources'
        }
    ];
    const playedMatches = activePredictorMatches.filter(isPlayedMatch).slice(-4).reverse();

    return (
      <div className="space-y-5">
        <AdminSurface className="p-5">
          <FocusHeader
            eyebrow="Now"
            title="Event Briefing"
            description="The head-scouting brief: our next match, what to trust, what to collect, and where to act."
          />
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            <SummaryCard label={ownTeamNumber ? 'Our Next Match' : 'Next Match'} value={primaryPrediction?.title || 'None'} />
            <SummaryCard label="Forecast" value={primaryPrediction?.predictedWinner || 'Pending'} />
            <SummaryCard label="Missing Rows" value={primaryMissingScoutTeams.length} />
            <SummaryCard label="PPA Confidence" value={ourPrimaryPpa.confidenceLabel} />
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="admin-g2-sm border border-fuchsia-400/25 bg-fuchsia-500/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Next Strategy Moment</div>
                  <div className="mt-2 text-2xl font-black text-white">{primaryPrediction?.title || 'No future match'}</div>
                  <div className="mt-1 text-sm font-semibold text-fuchsia-100/70">
                    {primaryAlliance ? `We are ${primaryAlliance}.` : 'Showing the next known match because own team is not set or not scheduled here.'}
                  </div>
                </div>
                <AdminButton
                  tone="fuchsia"
                  onClick={() => {
                    if (!primaryPrediction) return;
                    setSelectedMatchKey(primaryPrediction.key);
                    setActiveTab('predictor');
                  }}
                  disabled={!primaryPrediction}
                >
                  <Swords className="h-4 w-4" />Match Plan
                </AdminButton>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-3">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{primaryAlliance ? 'Our Alliance' : 'Red Alliance'}</div>
                  <div className="mt-2"><TeamList teams={ourPrimaryTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={resolvedTeamNameLookup} /></div>
                  <div className="mt-3 text-sm font-black text-fuchsia-100">PPA {formatMetricValue(ourPrimaryPpa.expected, 1)} · floor {formatMetricValue(ourPrimaryPpa.floor, 1)}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{ourPrimaryPpa.rolePlan}</div>
                </div>
                <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-3">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{primaryAlliance ? 'Opponent' : 'Blue Alliance'}</div>
                  <div className="mt-2"><TeamList teams={opponentPrimaryTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={resolvedTeamNameLookup} /></div>
                  <div className="mt-3 text-sm font-black text-blue-100">PPA {formatMetricValue(opponentPrimaryPpa.expected, 1)} · floor {formatMetricValue(opponentPrimaryPpa.floor, 1)}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{opponentPrimaryPpa.rolePlan}</div>
                </div>
              </div>
              <div className="mt-4 admin-g2-sm border border-slate-800 bg-slate-950/70 p-3">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Strategy Read</div>
                <div className="mt-2 text-sm font-semibold text-slate-300">
                  {primaryStrategyPlan?.winCondition || primaryStrategyPlan?.opponentCounterStrategy || 'Open Matches after a future schedule loads to see the automatic strategy plan.'}
                </div>
                {primaryStrategyPlan?.riskFlags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {primaryStrategyPlan.riskFlags.slice(0, 4).map(flag => (
                      <span key={flag} className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-black text-amber-100">{flag}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              {nowPriorities.map(priority => (
                <button
                  key={priority.label}
                  type="button"
                  onClick={priority.action}
                  className={`admin-g2-sm w-full border p-4 text-left transition-colors ${
                    priority.tone === 'rose'
                      ? 'border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15'
                      : priority.tone === 'amber'
                        ? 'border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15'
                        : priority.tone === 'emerald'
                          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'
                          : priority.tone === 'fuchsia'
                            ? 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/15'
                            : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{priority.label}</div>
                      <div className="mt-2 text-sm font-semibold leading-relaxed">{priority.detail}</div>
                    </div>
                    <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/80">{priority.actionLabel}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </AdminSurface>

        <CollectionPipelinePanel stages={collectionPipelineStages} ppaReadinessCards={ppaReadinessCards} compact />

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <AdminSurface className="min-w-0 p-5">
            <FocusHeader
              title="Next Matches"
              description={`Forecast source: ${predictorMatchSourceLabel}`}
              action={renderModelAwareAction()}
            />
            <div className="admin-g2-sm mt-4 min-w-0 overflow-x-auto border border-slate-800">
              <table className="admin-sticky-table min-w-[420px] text-left text-sm sm:min-w-full">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Match</th>
                    <th className="px-4 py-3">Red</th>
                    <th className="px-4 py-3">Blue</th>
                    <th className="px-4 py-3">Forecast</th>
                    <th className="px-4 py-3">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {nextMatches.map(match => (
                    <tr key={match.key} className="cursor-pointer hover:bg-slate-900" onClick={() => { setSelectedMatchKey(match.key); setActiveTab('predictor'); }}>
                      <td className="px-4 py-3 font-mono font-black text-white">{match.title}</td>
                      <td className="px-4 py-3"><TeamList teams={match.red.teams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={resolvedTeamNameLookup} /></td>
                      <td className="px-4 py-3"><TeamList teams={match.blue.teams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={resolvedTeamNameLookup} /></td>
                      <td className="px-4 py-3 font-black text-cyan-100">{match.predictedWinner}</td>
                      <td className="px-4 py-3">{match.predictionLowConfidence ? 'Low' : 'Standard'}</td>
                    </tr>
                  ))}
                  {nextMatches.length === 0 && (
                    <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No future matches with known teams are available yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminSurface>

          <AdminSurface className="min-w-0 p-5">
            <FocusHeader title="Newest Updates" description="Quiet status only. Work actions are chosen above from the current situation." />
            <div className="mt-4 rounded-[18px] border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm font-black text-white">Newest Updates</div>
              <div className="mt-3 space-y-2 text-sm text-slate-400">
                <div>Data mode: <span className="font-black text-slate-100">{isLocalMode ? 'Local archive' : 'Firebase'}</span></div>
                <div>Loaded scouting rows: <span className="font-black text-slate-100">{summary.rows}</span></div>
                <div>Played matches seen: <span className="font-black text-slate-100">{playedMatches.length}</span></div>
                <div>FIRST credentials: <span className="font-black text-slate-100">{firstCredentials ? 'Saved locally' : 'Not saved'}</span></div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {commandAlerts.map(alert => (
                <div key={alert.label} className={`admin-g2-sm border p-3 ${alert.tone === 'rose' ? 'border-rose-400/30 bg-rose-500/10 text-rose-100' : alert.tone === 'amber' ? 'border-amber-400/30 bg-amber-500/10 text-amber-100' : alert.tone === 'emerald' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'}`}>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{alert.label}</div>
                  <div className="mt-1 text-xs font-semibold">{alert.detail}</div>
                </div>
              ))}
            </div>
          </AdminSurface>
        </div>
      </div>
    );
  };

  const renderTeamDetail = () => {
    const detailTeamNumber = drilldownTeamNumber || searchedTeamNumber;
    const detailAverage = teamAverageLookupByTeam[detailTeamNumber];
    const detailDefense = defenseMetricLookupByTeam[detailTeamNumber];
    const detailProfile = teamPerformanceProfiles.find(profile => profile.teamNumber === detailTeamNumber) || null;
    const detailPpaInsight = ppaInsightsByTeam[detailTeamNumber] || null;
    const detailV4Rows = v4Records.filter(record => record.teamNumber === detailTeamNumber);
    const detailV3Rows = records.filter(record => record.teamNumber === detailTeamNumber);

    return (
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Team Detail"
          title={`Team ${detailTeamNumber}`}
          description={resolvedTeamNameLookup[detailTeamNumber] || teamProfile?.nickname || 'Profile, stats, trend, notes, and match history.'}
          action={<AdminButton onClick={closeTeamDrilldown}><ChevronLeft className="h-4 w-4" />Back to Teams</AdminButton>}
        />
        <div className="mt-5">
          {detailPpaInsight ? (
            <PpaInsightPanel
              insight={detailPpaInsight}
              onInfo={key => openWiki(key, 'teams')}
              onInfoContext={openInfoMenu}
            />
          ) : (
            <AdminSurface className="border-amber-400/30 bg-amber-500/10 p-4">
              <div className="text-sm font-black text-amber-100">No PPA shape yet</div>
              <p className="mt-1 text-sm font-semibold text-amber-100/75">
                Collect match scout rows or load model ratings before using this team for prediction, role planning, or pick-list ranking.
              </p>
            </AdminSurface>
          )}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="PPC" value={formatMetricValue(detailAverage?.avgTotalMatchPoints ?? null)} />
          <SummaryCard label="Defense Metric" value={formatPercentMetric(detailDefense?.avgDefenseMetric ?? null)} />
          <SummaryCard label="Matches Logged" value={detailAverage?.matchesPlayed ?? 0} />
          <SummaryCard label="TBA Rank" value={effectiveCurrentTbaRanks[detailTeamNumber] ? `#${effectiveCurrentTbaRanks[detailTeamNumber]}` : 'Unknown'} />
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            {detailProfile && <SidebarPerformanceProfile profile={detailProfile} />}
            <AdminSurface className="p-4">
              <div className="text-sm font-black text-white">Profile</div>
              <div className="mt-3 space-y-2 text-sm text-slate-400">
                <div>Current model: <span className="font-black text-slate-100">{MODEL_LABELS[selectedMetric]}</span></div>
                <div>Rank: <span className="font-black text-slate-100">{effectiveCurrentTbaRanks[detailTeamNumber] ? `#${effectiveCurrentTbaRanks[detailTeamNumber]}` : 'Unknown'}</span></div>
                <div>EPA: <span className="font-black text-slate-100">{formatMetricValue(epaRatings[detailTeamNumber] ?? null)}</span></div>
                <div>OPR: <span className="font-black text-slate-100">{formatMetricValue(activeOprRatings[detailTeamNumber] ?? null)}</span></div>
                {teamProfileError && <div className="rounded-[14px] border border-amber-400/30 bg-amber-500/10 p-3 text-amber-100">{teamProfileError}</div>}
              </div>
            </AdminSurface>
          </div>
          <AdminSurface className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-white">Match History</h3>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">V4 {detailV4Rows.length} / V3 {detailV3Rows.length}</div>
            </div>
            <div className="mt-4 max-h-[520px] overflow-y-auto rounded-[18px] border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Match</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Points</th>
                    <th className="px-4 py-3">Auto</th>
                    <th className="px-4 py-3">Teleop</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {detailV4Rows.map(record => (
                    <tr key={`v4-${record.matchKey}-${record.teamNumber}`}>
                      <td className="px-4 py-3 font-mono font-black text-white">{record.matchKey}</td>
                      <td className="px-4 py-3 text-slate-300">V4</td>
                      <td className="px-4 py-3 font-black text-cyan-100">{record.totalMatchPoints}</td>
                      <td className="px-4 py-3">{record.autoPoints}</td>
                      <td className="px-4 py-3">{record.teleopPoints}</td>
                      <td className="px-4 py-3 text-slate-400">{record.notes || record.strategyNotes || 'None'}</td>
                    </tr>
                  ))}
                  {detailV4Rows.length === 0 && detailV3Rows.length === 0 && (
                    <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>No match rows for this team yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </AdminSurface>
        </div>
      </AdminSurface>
    );
  };

  const renderTeamsView = () => {
    if (activeTab === 'teams' && drilldownTeamNumber) {
      return renderTeamDetail();
    }
    const teamSortOptions: Array<{ field: SorterField; label: string }> = [
      { field: 'ppa', label: 'PPA' },
      { field: 'matches', label: 'Matches logged' },
      { field: 'tbaRank', label: 'TBA rank' },
      { field: 'ppc', label: 'PPC' },
      { field: 'autoPpc', label: 'Auto PPC' },
      { field: 'teleopPpc', label: 'Teleop PPC' },
      { field: 'defenseMetric', label: 'Defense' },
      { field: 'epa', label: 'EPA' },
      { field: 'opr', label: 'OPR' },
      { field: 'dpr', label: 'DPR' },
      { field: 'team', label: 'Team number' }
    ];
    const activeSortLabel = teamSortOptions.find(option => option.field === sorterField)?.label || 'PPA';

    return (
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Teams"
          title="Sortable Leaderboard"
          description="Rows open team detail. Headers sort. The model toggle lives here because it only matters for team ranking and comparison."
          action={renderModelAwareAction()}
        />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryCard label="Teams Loaded" value={sortedSorterRows.length} />
          <SummaryCard label="PPA Shapes" value={ppaReadinessSummary.shapedInsights} />
          <SummaryCard label="Low Confidence" value={ppaReadinessSummary.lowConfidence} />
          <SummaryCard label="Match Rows" value={records.length + v4Records.length} />
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:hidden">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <label className="admin-g2-sm border border-slate-800 bg-slate-950 px-3 py-2">
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Sort Teams By</span>
              <select
                value={sorterField}
                onChange={event => handleSorterSort(event.target.value as SorterField)}
                className="mt-1 w-full bg-transparent text-sm font-black text-white outline-none"
              >
                {teamSortOptions.map(option => <option key={option.field} value={option.field}>{option.label}</option>)}
              </select>
            </label>
            <AdminButton
              tone="slate"
              onClick={() => setSorterDirection(previous => (previous === 'asc' ? 'desc' : 'asc'))}
              className="justify-center"
            >
              <ArrowUpDown className="h-4 w-4" />{sorterDirection === 'asc' ? 'Ascending' : 'Descending'}
            </AdminButton>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Sorted by {activeSortLabel}. Tap a team to open the full profile and match history.
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:hidden">
          {sortedSorterRows.map(row => {
            const insight = ppaInsightsByTeam[row.teamNumber];
            const expected = insight?.projected.expected ?? row.ppa;
            const floor = insight?.projected.floor ?? expected;
            const ceiling = insight?.projected.ceiling ?? expected;
            return (
              <div
                key={row.teamNumber}
                role="button"
                tabIndex={0}
                onClick={() => openTeamDrilldown(row.teamNumber, 'sorter')}
                onKeyDown={event => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  openTeamDrilldown(row.teamNumber, 'sorter');
                }}
                className="admin-g2-sm cursor-pointer border border-slate-800 bg-slate-950 p-4 text-left hover:border-cyan-400/40 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <TeamBadge teamNumber={row.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={row.teamName} />
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">PPA</div>
                    <div className="text-xl font-black text-violet-100">{formatMetricValue(expected, 1)}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="text-[10px] font-black uppercase text-slate-500">Floor</div>
                    <div className="mt-1 font-black text-white">{formatMetricValue(floor, 1)}</div>
                  </div>
                  <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="text-[10px] font-black uppercase text-slate-500">Ceiling</div>
                    <div className="mt-1 font-black text-white">{formatMetricValue(ceiling, 1)}</div>
                  </div>
                  <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="text-[10px] font-black uppercase text-slate-500">Matches</div>
                    <div className="mt-1 font-black text-white">{row.matches}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="admin-g2-sm border border-slate-700 px-2 py-1 text-[11px] font-black uppercase text-slate-300">{row.ppaRole}</span>
                  <span className={`admin-g2-sm px-2 py-1 text-[11px] font-black uppercase ${getRiskPillClass(row.ppaUncertainty)}`}>{row.ppaUncertainty}</span>
                  <span className="admin-g2-sm border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-black text-cyan-100">{row.ppaCoverage}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-semibold text-slate-400">
                  <div>PPC <span className="font-black text-cyan-100">{formatMetricValue(row.ppc, 1)}</span></div>
                  <div>Defense <span className="font-black text-emerald-100">{formatPercentMetric(row.defenseMetric)}</span></div>
                  <div>OPR <span className="font-black text-fuchsia-100">{formatMetricValue(row.opr, 1)}</span></div>
                  <div>EPA <span className="font-black text-blue-100">{formatMetricValue(row.epa, 1)}</span></div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{row.tbaRank ? `TBA #${row.tbaRank}` : 'No TBA rank'}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={event => {
                      event.stopPropagation();
                      openWiki('ppa', 'sorter');
                    }}
                    onKeyDown={event => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      event.stopPropagation();
                      openWiki('ppa', 'sorter');
                    }}
                    onContextMenu={event => {
                      event.stopPropagation();
                      openInfoMenu(event, 'ppa');
                    }}
                    className="admin-g2-sm inline-flex items-center gap-1 border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-xs font-black text-violet-100"
                  >
                    <Info className="h-3.5 w-3.5" />PPA
                  </span>
                </div>
              </div>
            );
          })}
          {sortedSorterRows.length === 0 && <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-6 text-center text-sm font-semibold text-slate-500">No teams are loaded yet.</div>}
        </div>

        <div className="admin-g2-sm mt-4 hidden min-w-0 overflow-x-auto border border-slate-800 lg:block">
          <table className="admin-sticky-table min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <SortableHeader label="Team" field="team" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="team" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} />
                <SortableHeader label="TBA Rank" field="tbaRank" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="tbaRank" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} />
                <SortableHeader label="Matches" field="matches" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="matches" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} align="text-right" />
                <SortableHeader label="PPA" field="ppa" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="ppa" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} align="text-right" />
                <SortableHeader label="PPC" field="ppc" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="ppc" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} align="text-right" />
                <SortableHeader label="Auto" field="autoPpc" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="autoPpc" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} align="text-right" />
                <SortableHeader label="Teleop" field="teleopPpc" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="teleopPpc" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} align="text-right" />
                <SortableHeader label="Defense" field="defenseMetric" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="defenseMetric" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} align="text-right" />
                <SortableHeader label="EPA" field="epa" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="epa" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} align="text-right" />
                <SortableHeader label="OPR" field="opr" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="opr" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} align="text-right" />
                <SortableHeader label="DPR" field="dpr" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} infoKey="dpr" onInfo={key => openWiki(key, 'sorter')} onInfoContext={openInfoMenu} align="text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedSorterRows.map(row => (
                <tr key={row.teamNumber} className="cursor-pointer hover:bg-slate-900" onClick={() => openTeamDrilldown(row.teamNumber, 'sorter')}>
                  <td className="px-4 py-3"><TeamBadge teamNumber={row.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={row.teamName} /></td>
                  <td className="px-4 py-3 text-slate-300">{row.tbaRank ? `#${row.tbaRank}` : 'Unknown'}</td>
                  <td className="px-4 py-3 text-right">{row.matches}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-black text-violet-100">{formatMetricValue(row.ppa)}</div>
                    <div className="mt-1 flex justify-end gap-1">
                      <span className="admin-g2-sm border border-slate-700 px-2 py-0.5 text-[10px] font-black uppercase text-slate-300">{row.ppaRole}</span>
                      <span className={`admin-g2-sm px-2 py-0.5 text-[10px] font-black uppercase ${getRiskPillClass(row.ppaUncertainty)}`}>{row.ppaUncertainty}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-cyan-100">{formatMetricValue(row.ppc)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{formatMetricValue(row.autoPpc)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">{formatMetricValue(row.teleopPpc)}</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-200">{formatPercentMetric(row.defenseMetric)}</td>
                  <td className="px-4 py-3 text-right text-blue-200">{formatMetricValue(row.epa)}</td>
                  <td className="px-4 py-3 text-right text-fuchsia-200">{formatMetricValue(row.opr)}</td>
                  <td className="px-4 py-3 text-right text-rose-200">{formatMetricValue(row.dpr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSurface>
    );
  };

  const renderMatchDetail = () => {
    const redTeams = selectedPrediction?.red.teams || selectedMatch?.alliances.red.team_keys.map(normalizeTeamKey) || [];
    const blueTeams = selectedPrediction?.blue.teams || selectedMatch?.alliances.blue.team_keys.map(normalizeTeamKey) || [];
    const redPpaSummary = summarizePpaAlliance(redTeams, ppaInsightsByTeam);
    const bluePpaSummary = summarizePpaAlliance(blueTeams, ppaInsightsByTeam);
    const loadSimulator = () => {
      setRedSimulatorInput(redTeams.join(', '));
      setBlueSimulatorInput(blueTeams.join(', '));
      setSimulatorQuickEntry(`${redTeams.join(' ')} vs ${blueTeams.join(' ')}`);
      setActiveTab('simulator');
    };

    return (
      <div className="space-y-5">
        <AdminSurface className="p-5">
          <FocusHeader
            eyebrow="Match Detail"
            title={selectedPrediction?.title || selectedMatch?.key.split('_')[1]?.toUpperCase() || 'Match'}
            description="This known match is already simulated here. Use manual mode only when you want to try a different alliance or what-if role plan."
            action={<AdminButton onClick={() => setSelectedMatchKey('')}><ChevronLeft className="h-4 w-4" />Back to Matches</AdminButton>}
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <SummaryCard label="Winner" value={selectedPrediction?.predictedWinner || selectedStrategyMatchPlan?.predictedWinner || 'Pending'} />
            <SummaryCard label="Red Forecast" value={formatMetricValue(selectedPrediction?.red.predictedScore ?? selectedStrategyMatchPlan?.baselineRedScore ?? null)} />
            <SummaryCard label="Blue Forecast" value={formatMetricValue(selectedPrediction?.blue.predictedScore ?? selectedStrategyMatchPlan?.baselineBlueScore ?? null)} />
          </div>
        </AdminSurface>

        <div className="grid gap-4 lg:grid-cols-2">
          <PpaAllianceBrief title="Red PPA Shape" summary={redPpaSummary} accentClass="text-red-100" />
          <PpaAllianceBrief title="Blue PPA Shape" summary={bluePpaSummary} accentClass="text-blue-100" />
        </div>

        <StrategyMatchPlanPanel plan={selectedStrategyMatchPlan} />

        <div className="grid gap-5 lg:grid-cols-2">
          {(['Red', 'Blue'] as const).map(alliance => {
            const teams = alliance === 'Red' ? redTeams : blueTeams;
            return (
              <AdminSurface key={alliance} className={`p-4 ${alliance === 'Red' ? 'border-red-500/30 bg-red-500/10' : 'border-blue-500/30 bg-blue-500/10'}`}>
                <h3 className={`text-lg font-black ${alliance === 'Red' ? 'text-red-100' : 'text-blue-100'}`}>{alliance} Alliance</h3>
                <div className="mt-3"><TeamList teams={teams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={resolvedTeamNameLookup} /></div>
                <div className="mt-4 space-y-2 text-sm">
                  {teams.map(teamNumber => {
                    const rating = activeMetricRatings[teamNumber] ?? 0;
                    const defense = simulatorDefenseImpactLookup[teamNumber] ?? 0;
                    const insight = ppaInsightsByTeam[teamNumber];
                    return (
                      <div key={teamNumber} className="admin-g2-sm flex flex-wrap items-center justify-between gap-3 border border-slate-800 bg-slate-950/70 px-3 py-2">
                        <span className="font-mono font-black text-white">{teamNumber}</span>
                        <span className="text-slate-400">{insight?.role.label || (defense > rating ? 'Defender' : 'Primary Scorer')}</span>
                        <span className="font-black text-cyan-100">{formatMetricValue(insight?.projected.expected ?? Math.max(rating, defense))}</span>
                        <span className={`admin-g2-sm px-2 py-1 text-xs font-black ${getRiskPillClass(insight?.uncertainty.level || 'High')}`}>
                          {insight?.uncertainty.level || 'High'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </AdminSurface>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <AdminButton tone="fuchsia" onClick={loadSimulator}><Swords className="h-4 w-4" />Load Into Manual What-If</AdminButton>
          <AdminButton onClick={() => openWiki('rankings', 'predictor')}><BookOpen className="h-4 w-4" />Forecast Math</AdminButton>
        </div>
      </div>
    );
  };

  const renderMatchesView = () => {
    if (selectedMatchKey) return renderMatchDetail();

    const playedRows = activePredictorMatches.filter(isPlayedMatch).slice(-10).reverse();

    return (
      <div className="space-y-5">
        <AdminSurface className="p-5">
          <FocusHeader
            eyebrow="Matches"
            title="Automatic Future Match Simulations"
            description={`Every known future match is simulated here first. Manual simulator is reserved for custom what-if alliances. Source: ${predictorMatchSourceLabel}`}
            action={<div className="flex flex-wrap items-center gap-3">{renderModelAwareAction()}<AdminButton tone="fuchsia" onClick={() => setActiveTab('simulator')}><Swords className="h-4 w-4" />Manual What-If</AdminButton></div>}
          />
          {predictorUnavailableMessage && <div className="mt-4 rounded-[18px] border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-semibold text-amber-100">{predictorUnavailableMessage}</div>}
          {predictorIsLoading && <div className="mt-4 text-sm font-black text-cyan-100">Loading predictor data...</div>}
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <SummaryCard label="Auto Simulations" value={activePredictions.length} />
            <SummaryCard label="Next Known Match" value={activePredictions[0]?.title || 'None'} />
            <SummaryCard label="Manual Mode" value="What-if only" />
          </div>
          <div className="mt-4 overflow-x-auto rounded-[18px] border border-slate-800">
            <table className="admin-sticky-table min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Simulation</th>
                  <th className="px-4 py-3">Red</th>
                  <th className="px-4 py-3">Blue</th>
                  <th className="px-4 py-3">Red Score</th>
                  <th className="px-4 py-3">Blue Score</th>
                  <th className="px-4 py-3">Winner</th>
                  <th className="px-4 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {activePredictions.map(match => (
                  <tr key={match.key} className="cursor-pointer hover:bg-slate-900" onClick={() => setSelectedMatchKey(match.key)}>
                    <td className="px-4 py-3 font-mono font-black text-white">{match.title}</td>
                    <td className="px-4 py-3"><TeamList teams={match.red.teams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={resolvedTeamNameLookup} /></td>
                    <td className="px-4 py-3"><TeamList teams={match.blue.teams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={resolvedTeamNameLookup} /></td>
                    <td className="px-4 py-3 font-black text-red-100">{formatMetricValue(match.red.predictedScore)}</td>
                    <td className="px-4 py-3 font-black text-blue-100">{formatMetricValue(match.blue.predictedScore)}</td>
                    <td className="px-4 py-3 font-black text-cyan-100">{match.predictedWinner}</td>
                    <td className="px-4 py-3">{match.predictionLowConfidence ? 'Low' : 'Standard'}</td>
                  </tr>
                ))}
                {activePredictions.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No future matches with known teams are available yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </AdminSurface>

        <AdminSurface className="p-5">
          <FocusHeader title="Played Results" description="Kept here for context without turning Matches into a giant results dump." />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {playedRows.map(match => (
              <button key={match.key} type="button" onClick={() => setSelectedMatchKey(match.key)} className="admin-g2-sm border border-slate-800 bg-slate-950 p-3 text-left hover:bg-slate-900">
                <div className="font-mono text-sm font-black text-white">{match.key.split('_')[1]?.toUpperCase() || match.key}</div>
                <div className="mt-2 text-xs text-slate-400">Red {match.alliances.red.score} / Blue {match.alliances.blue.score}</div>
              </button>
            ))}
            {playedRows.length === 0 && <div className="text-sm font-semibold text-slate-500">No played matches loaded yet.</div>}
          </div>
        </AdminSurface>
      </div>
    );
  };

  const renderSimulatorView = () => (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Simulator"
        title="Manual Match Simulator"
        description="A focused what-if interface for entering custom alliances. Known future matches are simulated automatically in Matches."
        action={renderModelAwareAction()}
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto]">
        <AdminInput value={simulatorQuickEntry} onChange={event => setSimulatorQuickEntry(event.target.value)} placeholder="Manual entry: 254 1678 971 vs 1323 4414 5940" />
        <AdminButton tone="cyan" onClick={applyQuickSimulatorEntry}>Build Manual Match</AdminButton>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <AdminSurface className="border-red-500/30 bg-red-500/10 p-4">
          <h3 className="text-lg font-black text-red-100">Red Alliance</h3>
          <textarea value={redSimulatorInput} onChange={event => setRedSimulatorInput(event.target.value)} rows={4} className="mt-3 w-full rounded-[18px] border border-red-500/30 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-red-300" placeholder="One team per line or comma separated" />
          <SimulatorTeamTable rows={redSimulatorRows} />
        </AdminSurface>
        <AdminSurface className="border-blue-500/30 bg-blue-500/10 p-4">
          <h3 className="text-lg font-black text-blue-100">Blue Alliance</h3>
          <textarea value={blueSimulatorInput} onChange={event => setBlueSimulatorInput(event.target.value)} rows={4} className="mt-3 w-full rounded-[18px] border border-blue-500/30 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-300" placeholder="One team per line or comma separated" />
          <SimulatorTeamTable rows={blueSimulatorRows} />
        </AdminSurface>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <SummaryCard label={`${MODEL_LABELS[selectedMetric]} Winner`} value={simulatorSummary.winner || 'Need both alliances'} />
        <SummaryCard label="PPA Insight Winner" value={simulatorSummary.ppaWinner || 'Need both alliances'} />
        <SummaryCard label="Role Adjusted" value={simulatorSummary.roleAdjustedWinner || 'Need both alliances'} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PpaAllianceBrief title="Red PPA Shape" summary={redSimulatorPpaSummary} accentClass="text-red-100" />
        <PpaAllianceBrief title="Blue PPA Shape" summary={blueSimulatorPpaSummary} accentClass="text-blue-100" />
      </div>
    </AdminSurface>
  );

  const renderVisualizeView = () => {
    const metricOptions: Array<{ key: VisualMetricKey; label: string }> = [
      { key: 'ppa', label: 'PPA' },
      { key: 'ppc', label: 'PPC' },
      { key: 'autoPpc', label: 'Auto PPC' },
      { key: 'teleopPpc', label: 'Teleop PPC' },
      { key: 'defense', label: 'Defense' },
      { key: 'opr', label: 'OPR' },
      { key: 'epa', label: 'EPA' },
      { key: 'dpr', label: 'DPR' },
      { key: 'volatility', label: 'Volatility' },
      { key: 'matches', label: 'Matches Logged' },
      { key: 'tbaRank', label: 'TBA Rank' }
    ];

    return (
      <div className="space-y-5">
        <AdminSurface className="p-5">
          <FocusHeader
            eyebrow="Visualize"
            title="Stat Comparison Charts"
            description="Choose one or more stats. PPA renders as a decision shape with floor, expected, ceiling, role, and risk; scalar stats render as vertical bar charts."
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {metricOptions.map(option => (
              <StatChip
                key={option.key}
                statKey={getVisualMetricInfoKey(option.key)}
                label={option.label}
                selected={visualMetricKeys.includes(option.key)}
                onToggle={() => toggleVisualMetric(option.key)}
                onInfo={key => openWiki(key, 'visualize')}
                onInfoContext={openInfoMenu}
              />
            ))}
          </div>
        </AdminSurface>
        <div className="grid gap-5 xl:grid-cols-2">
          {visualMetricKeys.map(metric => {
            const config = visualChartConfigs[metric];
            if (metric === 'ppa') {
              return (
                <PpaShapeBarChart
                  key={metric}
                  rows={ppaShapeRows}
                  onInfo={key => openWiki(key, 'visualize')}
                  onInfoContext={openInfoMenu}
                />
              );
            }
            return (
              <VerticalStatBarChart
                key={metric}
                title={config.title}
                subtitle={config.subtitle}
                rows={config.rows}
                valueFormatter={config.formatter}
                infoKey={getVisualMetricInfoKey(metric)}
                onInfo={key => openWiki(key, 'visualize')}
                onInfoContext={openInfoMenu}
              />
            );
          })}
        </div>
      </div>
    );
  };

  const renderPickListView = () => {
    const ppaExpectedForPick = (row: AlliancePickRecommendation) =>
      ppaInsightsByTeam[row.teamNumber]?.projected.expected ?? row.score;
    const ppaFloorForPick = (row: AlliancePickRecommendation) =>
      ppaInsightsByTeam[row.teamNumber]?.projected.floor ?? ppaExpectedForPick(row);
    const ppaCeilingForPick = (row: AlliancePickRecommendation) =>
      ppaInsightsByTeam[row.teamNumber]?.projected.ceiling ?? ppaExpectedForPick(row);
    const ppaDefenseForPick = (row: AlliancePickRecommendation) =>
      ppaInsightsByTeam[row.teamNumber]?.components.defenseImpact ?? 0;
    const riskPenaltyForPick = (row: AlliancePickRecommendation) => {
      const uncertainty = ppaInsightsByTeam[row.teamNumber]?.uncertainty.level;
      const tailRisk = ppaInsightsByTeam[row.teamNumber]?.tailRisk.level;
      return (uncertainty === 'High' ? 14 : uncertainty === 'Medium' ? 6 : 0) +
        (tailRisk === 'High' ? 10 : tailRisk === 'Medium' ? 4 : 0);
    };
    const ppaDecisionScoreForPick = (row: AlliancePickRecommendation) => {
      const seedRisk = Math.min(1, Math.max(0, (allianceSeed - 1) / 7));
      const expected = ppaExpectedForPick(row);
      const floor = ppaFloorForPick(row);
      const ceiling = ppaCeilingForPick(row);
      const defense = ppaDefenseForPick(row);
      const protectFloor = floor * 0.48 + expected * 0.32 + defense * 0.14 + row.score * 0.06;
      const huntCeiling = ceiling * 0.42 + expected * 0.22 + defense * 0.22 + row.score * 0.14;
      const balanced = expected * 0.38 + floor * 0.22 + ceiling * 0.2 + defense * 0.16 + row.score * 0.04;
      const seedBiased = allianceSeed <= 2
        ? protectFloor
        : allianceSeed >= 7
          ? huntCeiling
          : balanced * (1 - Math.abs(seedRisk - 0.5)) + ((protectFloor + huntCeiling) / 2) * Math.abs(seedRisk - 0.5);
      return seedBiased - riskPenaltyForPick(row);
    };
    const pickBoardRows = [...allianceRecommendations].sort((left, right) => {
      if (left.status === 'available' && right.status !== 'available') return -1;
      if (left.status !== 'available' && right.status === 'available') return 1;
      const scoreDelta = ppaDecisionScoreForPick(right) - ppaDecisionScoreForPick(left);
      if (scoreDelta !== 0) return scoreDelta;
      return Number(left.teamNumber) - Number(right.teamNumber);
    });
    const availableRows = pickBoardRows.filter(row => row.status === 'available');
    const pickedRows = pickBoardRows.filter(row => row.status === 'picked');
    const topAvailableRows = availableRows.slice(0, 24);
    const selectedAllianceTeams = Array.from(new Set([
      ownTeamNumber,
      ...pickedRows.map(row => row.teamNumber)
    ].filter(Boolean)));
    const selectedAllianceSummary = summarizePpaAlliance(selectedAllianceTeams, ppaInsightsByTeam);
    const pickLanes = [
      {
        key: 'floor',
        title: 'Safe Floor',
        detail: 'Best when you are high seed and need the pick to work every match.',
        metricLabel: 'Floor',
        rows: [...availableRows]
          .sort((left, right) => (ppaFloorForPick(right) - riskPenaltyForPick(right)) - (ppaFloorForPick(left) - riskPenaltyForPick(left)))
          .slice(0, 4)
      },
      {
        key: 'ceiling',
        title: 'Upside Ceiling',
        detail: 'Best when you need upset potential or a second-round swing.',
        metricLabel: 'Ceiling',
        rows: [...availableRows]
          .sort((left, right) => (ppaCeilingForPick(right) - riskPenaltyForPick(right) * 0.4) - (ppaCeilingForPick(left) - riskPenaltyForPick(left) * 0.4))
          .slice(0, 4)
      },
      {
        key: 'role',
        title: 'Role Balance',
        detail: 'Defender/flex value so the alliance is not three identical scorers.',
        metricLabel: 'Defense',
        rows: [...availableRows]
          .sort((left, right) => ppaDefenseForPick(right) - ppaDefenseForPick(left) || ppaExpectedForPick(right) - ppaExpectedForPick(left))
          .slice(0, 4)
      }
    ];
    const statusClass = (status: AlliancePickRecommendation['status']) => {
      if (status === 'picked') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
      if (status === 'declined') return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
      if (status === 'unavailable') return 'border-rose-400/30 bg-rose-500/15 text-rose-100';
      return 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100';
    };

    return (
      <div className="space-y-5">
        <AdminSurface className="p-5">
          <FocusHeader
            eyebrow="Pick List"
            title="Alliance Selection Board"
            description="Alliance selection should answer one question fast: who helps this exact alliance win playoff matches?"
          />
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Alliance Seed" value={`A${allianceSeed}`} />
            <SummaryCard label="Selected" value={pickListSummary.selected} />
            <SummaryCard label="Available" value={pickListSummary.available} />
            <SummaryCard label="Top Available" value={topAvailableRows[0]?.teamNumber || 'None'} />
            <SummaryCard label="Defense Options" value={pickListSummary.defenderFlexAvailable} />
          </div>
        </AdminSurface>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <PpaAllianceBrief title="Current Alliance Shape" summary={selectedAllianceSummary} accentClass="text-amber-100" />
          <AdminSurface className="border-amber-400/25 bg-amber-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-amber-100">Selection Need</div>
                <div className="mt-1 text-xs font-semibold text-amber-50/60">This changes with seed and live pick status.</div>
              </div>
              <button
                type="button"
                onClick={() => openWiki('ppa', 'pickList')}
                onContextMenu={event => openInfoMenu(event, 'ppa')}
                className="admin-g2-sm border border-amber-300/30 bg-amber-300/10 p-2 text-amber-100 hover:bg-amber-300/20"
                aria-label="Get info about PPA"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm font-semibold text-amber-50/75">
              <div>Seed mode: <span className="font-black text-white">{allianceSeed <= 2 ? 'protect floor' : allianceSeed >= 7 ? 'hunt upside' : 'balance value'}</span></div>
              <div>Next lens: <span className="font-black text-white">{allianceSeed <= 2 ? 'Safe Floor' : allianceSeed >= 7 ? 'Upside Ceiling' : 'Role Balance'}</span></div>
              <div>
                <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-amber-100/70">Alliance So Far</div>
                <div className="flex flex-wrap gap-2">
                  {selectedAllianceTeams.map(teamNumber => (
                    <span key={teamNumber} className="admin-g2-sm border border-amber-300/30 bg-slate-950/70 px-2 py-1 font-mono text-xs font-black text-white">
                      {teamNumber}
                    </span>
                  ))}
                  {selectedAllianceTeams.length === 0 && <span className="text-slate-500">No picks marked yet.</span>}
                </div>
              </div>
            </div>
          </AdminSurface>
        </div>

        <AdminSurface className="p-5">
          <FocusHeader
            title="Decision Lanes"
            description="Use the lane that matches the moment instead of trying to read one giant ranking as absolute truth."
          />
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {pickLanes.map(lane => (
              <div key={lane.title} className="admin-g2-sm border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-white">{lane.title}</div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{lane.detail}</p>
                  </div>
                  <div className="admin-g2-sm border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-black uppercase text-slate-400">
                    {lane.metricLabel}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {lane.rows.map(row => {
                    const insight = ppaInsightsByTeam[row.teamNumber];
                    const laneValue = lane.key === 'floor'
                      ? ppaFloorForPick(row)
                      : lane.key === 'ceiling'
                        ? ppaCeilingForPick(row)
                        : ppaDefenseForPick(row);
                    return (
                      <div
                        key={`${lane.title}-${row.teamNumber}`}
                        className="admin-g2-sm grid grid-cols-[minmax(0,1fr)_auto] gap-3 border border-slate-800 bg-slate-950/70 p-3"
                      >
                        <button
                          type="button"
                          onClick={() => openTeamDrilldown(row.teamNumber, 'pickList')}
                          className="min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-white">{row.teamNumber}</span>
                            <span className={`admin-g2-sm px-2 py-0.5 text-[10px] font-black ${getRiskPillClass(insight?.tailRisk.level || 'High')}`}>
                              {insight?.tailRisk.level || 'High'} risk
                            </span>
                          </div>
                          <div className="mt-1 truncate text-xs font-semibold text-slate-500">{resolvedTeamNameLookup[row.teamNumber] || insight?.role.label || row.roleFit}</div>
                          <div className="mt-2 text-xs font-semibold text-slate-400">
                            {insight?.role.label || row.roleFit} · score {formatMetricValue(ppaDecisionScoreForPick(row), 1)}
                          </div>
                        </button>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="text-right text-xs font-black text-amber-100">{formatMetricValue(laneValue, 1)}</div>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => updatePickStatus(row.teamNumber, 'picked', `A${allianceSeed}`)} className="admin-g2-sm bg-emerald-600 px-2 py-1 text-[10px] font-black text-white hover:bg-emerald-500">Pick</button>
                            <button type="button" onClick={() => updatePickStatus(row.teamNumber, 'unavailable')} className="admin-g2-sm bg-rose-700 px-2 py-1 text-[10px] font-black text-white hover:bg-rose-600">Out</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {lane.rows.length === 0 && <div className="text-sm font-semibold text-slate-500">No available teams in this lane.</div>}
                </div>
              </div>
            ))}
          </div>
        </AdminSurface>

        <AdminSurface className="p-5">
          <FocusHeader
            title="Live Board"
            description="Set seed, mark real availability, and open any team for the evidence behind the recommendation."
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-4">
                <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Our Alliance Seed</label>
                <AdminInput
                  type="number"
                  min={1}
                  max={8}
                  value={allianceSeed}
                  onChange={event => setAllianceSeed(Math.max(1, Math.min(8, Number(event.target.value) || 1)))}
                  className="mt-2 w-full font-mono text-lg"
                />
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  Early seeds favor floor and reliability. Lower seeds look harder at peak and upset value.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }, (_, index) => index + 1).map(seed => (
                  <AdminButton
                    key={seed}
                    tone={allianceSeed === seed ? 'amber' : 'slate'}
                    className="px-0"
                    onClick={() => setAllianceSeed(seed)}
                  >
                  A{seed}
                  </AdminButton>
                ))}
              </div>
              <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                <div className="font-black text-white">Decision Rules</div>
                <div className="mt-3 space-y-2">
                  <div>Use PPA expected for strength.</div>
                  <div>Use floor/ceiling and tail risk for trust.</div>
                  <div>Use role fit to avoid three robots doing the same job.</div>
                  <div>Mark picks live so the board stays useful during selection.</div>
                </div>
              </div>
            </div>

            <div className="admin-g2-sm overflow-x-auto border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">PPA Pick Score</th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openWiki('ppa', 'pickList')}
                        onContextMenu={event => openInfoMenu(event, 'ppa')}
                        className="inline-flex items-center gap-1 text-left hover:text-white"
                      >
                        PPA Shape <Info className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                    <th className="px-4 py-3">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pickBoardRows.map(row => {
                    const insight = ppaInsightsByTeam[row.teamNumber];
                    return (
                      <tr key={row.teamNumber} className={row.status === 'available' ? 'hover:bg-slate-900' : 'opacity-55'}>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => openTeamDrilldown(row.teamNumber, 'pickList')} className="text-left">
                            <TeamBadge teamNumber={row.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={resolvedTeamNameLookup[row.teamNumber] || ''} />
                          </button>
                        </td>
                        <td className="px-4 py-3 font-black text-amber-100">{formatMetricValue(ppaDecisionScoreForPick(row))}</td>
                        <td className="px-4 py-3">
                          <div className="font-black text-violet-100">{formatMetricValue(insight?.projected.expected ?? null)}</div>
                          <div className="text-xs text-slate-500">
                            {formatMetricValue(insight?.projected.floor ?? null)} to {formatMetricValue(insight?.projected.ceiling ?? null)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-black text-slate-100">{insight?.role.label || row.roleFit}</div>
                          <div className="text-xs text-slate-500">{row.seedFit}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={`admin-g2-sm inline-flex px-2 py-1 text-xs font-black ${getRiskPillClass(insight?.uncertainty.level || 'High')}`}>
                            {insight?.uncertainty.level || 'High'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{insight?.tailRisk.label || 'No PPA risk context'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`admin-g2-sm inline-flex border px-2 py-1 text-xs font-black uppercase ${statusClass(row.status)}`}>
                            {row.status}{row.pickedBy ? ` ${row.pickedBy}` : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <button type="button" onClick={() => updatePickStatus(row.teamNumber, 'picked', `A${allianceSeed}`)} className="admin-g2-sm bg-emerald-600 px-2 py-1 text-xs font-black text-white hover:bg-emerald-500">Picked</button>
                            <button type="button" onClick={() => updatePickStatus(row.teamNumber, 'declined')} className="admin-g2-sm bg-amber-600 px-2 py-1 text-xs font-black text-white hover:bg-amber-500">Declined</button>
                            <button type="button" onClick={() => updatePickStatus(row.teamNumber, 'unavailable')} className="admin-g2-sm bg-rose-700 px-2 py-1 text-xs font-black text-white hover:bg-rose-600">Out</button>
                            {row.status !== 'available' && (
                              <button type="button" onClick={() => updatePickStatus(row.teamNumber, 'available')} className="admin-g2-sm bg-slate-800 px-2 py-1 text-xs font-black text-slate-200 hover:bg-slate-700">Clear</button>
                            )}
                          </div>
                        </td>
                        <td className="max-w-sm px-4 py-3 text-slate-400">{row.rationale}</td>
                      </tr>
                    );
                  })}
                  {pickBoardRows.length === 0 && (
                    <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={8}>No team profiles are available yet. Import schedule/source data or collect match rows first.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </AdminSurface>

        <AdminSurface className="p-5">
          <FocusHeader title="Available Shortlist" description="A meeting-friendly shortlist of available teams after live pick status is applied." />
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {topAvailableRows.map(row => {
              const insight = ppaInsightsByTeam[row.teamNumber];
              return (
                <button
                  key={row.teamNumber}
                  type="button"
                  onClick={() => openTeamDrilldown(row.teamNumber, 'pickList')}
                  className="admin-g2-sm border border-slate-800 bg-slate-950 p-4 text-left hover:border-amber-400/40 hover:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-black text-white">{row.teamNumber}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">{resolvedTeamNameLookup[row.teamNumber] || row.roleFit}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-amber-100">{formatMetricValue(ppaDecisionScoreForPick(row))}</div>
                      <div className="text-[10px] font-black uppercase text-slate-500">Pick Score</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="admin-g2-sm border border-violet-400/30 bg-violet-500/15 px-2 py-1 text-[11px] font-black text-violet-100">
                      PPA {formatMetricValue(insight?.projected.expected ?? null)}
                    </span>
                    <span className={`admin-g2-sm px-2 py-1 text-[11px] font-black ${getRiskPillClass(insight?.tailRisk.level || 'High')}`}>
                      {insight?.tailRisk.level || 'High'} risk
                    </span>
                  </div>
                </button>
              );
            })}
            {topAvailableRows.length === 0 && <div className="text-sm font-semibold text-slate-500">No available teams remain after status filters.</div>}
          </div>
        </AdminSurface>
      </div>
    );
  };

  const renderRawAuditPanel = () => (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Data"
        title="Raw Data Audit"
        description="One focused coverage and anomaly audit. This is not appended below every workflow anymore."
        action={<AdminButton onClick={() => setDataPanel(null)}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
      />
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Visible Matches" value={rawEditorSummary.visibleMatches} />
        <SummaryCard label="Missing Slots" value={rawEditorSummary.missingSlotCount} />
        <SummaryCard label="Anomalies" value={rawEditorSummary.anomalyRowCount} />
        <SummaryCard label="Submitted Rows" value={rawEditorSummary.submittedRowCount} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['quals', 'practice'] as ResultsDisplayTab[]).map(view => (
          <AdminButton key={view} tone={rawEditorViewTab === view ? 'cyan' : 'slate'} onClick={() => setRawEditorViewTab(view)}>{view === 'quals' ? 'Qualifications' : 'Practice'}</AdminButton>
        ))}
        <AdminInput value={rawEditorSearch} onChange={event => setRawEditorSearch(event.target.value)} placeholder="Filter match, team, scout, anomaly" className="min-w-72" />
      </div>
      <div className="mt-4 max-h-[560px] overflow-y-auto rounded-[18px] border border-slate-800">
        <table className="admin-sticky-table min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Match</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Missing</th>
              <th className="px-4 py-3">Warnings</th>
              <th className="px-4 py-3">Rows</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rawEditorGroups.map(group => (
              <tr key={group.displayMatchKey}>
                <td className="px-4 py-3 font-mono font-black text-white">{group.displayMatchKey}</td>
                <td className="px-4 py-3">{group.scheduleKnown ? 'Scheduled' : 'Schedule missing'}</td>
                <td className="px-4 py-3 text-amber-100">{group.missingSlots.length}</td>
                <td className="px-4 py-3 text-slate-400">{group.warnings.join(', ') || 'None'}</td>
                <td className="px-4 py-3">{group.rows.length}</td>
              </tr>
            ))}
            {rawEditorGroups.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No raw audit rows match this filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminSurface>
  );

  const renderCollectionControlPanel = () => {
    const futureMatchCount = activePredictorMatches.filter(match => match.comp_level === 'qm' && !isPlayedMatch(match)).length;
    const playableForecastCount = validatedQualForecastRows.length;
    const missionRows: Array<{
      key: ScoutingMissionKey;
      count: number;
      countLabel: string;
      status: string;
      actionLabel: string;
    }> = [
      {
        key: 'preScout',
        count: allKnownTeams.length,
        countLabel: 'known teams',
        status: 'Public team context and missing-data questions before scouts arrive.',
        actionLabel: 'Open Pre Scout'
      },
      {
        key: 'pitScout',
        count: activePitArchiveRecords.length,
        countLabel: 'pit rows',
        status: 'Capability priors and mechanism notes for role fit and pick-list context.',
        actionLabel: 'Open Pit Scout'
      },
      {
        key: 'matchScout',
        count: records.length + v4Records.length,
        countLabel: 'match rows',
        status: 'The strongest local input for PPC, PPA range, volatility, and scout confidence.',
        actionLabel: 'Open Match Scout'
      },
      {
        key: 'defenseScout',
        count: defenseRecords.length,
        countLabel: 'defense rows',
        status: 'Defense impact and role protection so PPA does not confuse defense with weak offense.',
        actionLabel: 'Open Defense Scout'
      }
    ];
    const useMomentRows = Object.values(SCOUTING_USE_MOMENTS);
    const openMission = (key: ScoutingMissionKey) => {
      if (key === 'preScout') {
        setDataPanel('preScout');
        return;
      }
      const route = SCOUTING_MISSIONS[key].route;
      if (route) navigate(route);
    };

    return (
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Data"
          title="Collection Control"
          description="This is the control room for what scouts collect, what the app derives, and where the prediction model uses it."
          action={<AdminButton onClick={() => setDataPanel(null)}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
        />

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Known Teams" value={allKnownTeams.length} />
          <SummaryCard label="Future Quals" value={futureMatchCount} />
          <SummaryCard label="Forecasts" value={playableForecastCount} />
          <SummaryCard label="PPA Insights" value={ppaReadinessSummary.shapedInsights} />
          <SummaryCard label="Audit Gaps" value={rawEditorSummary.missingSlotCount} />
          <SummaryCard label="Unsynced" value={localArchiveSummary.unsyncedRecords.length} />
        </div>

        <div className="mt-5">
          <CollectionPipelinePanel stages={collectionPipelineStages} ppaReadinessCards={ppaReadinessCards} compact />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          {missionRows.map(row => {
            const mission = SCOUTING_MISSIONS[row.key];
            return (
              <div key={row.key} className={`admin-g2-sm border p-4 ${getMissionToneClasses(mission.tone)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] opacity-75">{mission.shortTitle}</div>
                    <h3 className="mt-2 text-xl font-black text-white">{mission.title}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white">{row.count}</div>
                    <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{row.countLabel}</div>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold opacity-85">{row.status}</p>
                <div className="mt-4 space-y-3 text-xs font-semibold opacity-85">
                  <div>
                    <div className="font-black uppercase tracking-wider text-white/80">Raw Inputs</div>
                    <div className="mt-1">{mission.rawInputs.slice(0, 4).join(' / ')}</div>
                  </div>
                  <div>
                    <div className="font-black uppercase tracking-wider text-white/80">Model Signals</div>
                    <div className="mt-1">{mission.processedSignals.slice(0, 4).join(' / ')}</div>
                  </div>
                </div>
                <div className="mt-4 rounded-[18px] border border-white/10 bg-slate-950/35 p-3 text-xs font-semibold text-white/80">
                  {mission.modelImpact}
                </div>
                <AdminButton className="mt-4 w-full" tone="slate" onClick={() => openMission(row.key)}>
                  {row.actionLabel}
                </AdminButton>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          {useMomentRows.map(moment => (
            <div key={moment.key} className="rounded-[18px] border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm font-black text-white">{moment.title}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{moment.when}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {moment.fedBy.map(key => (
                  <span key={key} className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${getMissionToneClasses(SCOUTING_MISSIONS[key].tone)}`}>
                    {SCOUTING_MISSIONS[key].title}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-xs font-semibold text-slate-400">{moment.needs.slice(0, 4).join(' / ')}</div>
            </div>
          ))}
        </div>
      </AdminSurface>
    );
  };

  const renderModelLabView = () => {
    const calibrationBins = bestModelBacktest?.calibrationBins || [];
    const recentFeatureSnapshots = adminV2FeatureMatchSnapshots.slice(-10);

    return (
      <div className="space-y-5">
        <AdminSurface className="p-5">
          <FocusHeader
            eyebrow="Data"
            title="Model Lab"
            description="Native Admin V4 model validation: what model is promoted, how it performed, what features it knew before matches, and how PPA is formed."
            action={<AdminButton onClick={() => setDataPanel(null)}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
          />

        <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[18px] border border-emerald-400/30 bg-emerald-500/10 p-5">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Reference Model</div>
            <div className="mt-2 text-3xl font-black text-white">{JUDGE_MODEL_BENCHMARK.modelName}</div>
            <p className="mt-2 text-sm font-semibold text-emerald-50/85">
              Winner-pick accuracy benchmark from the model research path: {formatPercentMetric(JUDGE_MODEL_BENCHMARK.winnerAccuracy, 1)} across {JUDGE_MODEL_BENCHMARK.decidedMatches.toLocaleString()} decided matches.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SummaryCard label="At 65% Conf." value={formatPercentMetric(JUDGE_MODEL_BENCHMARK.confidence65Accuracy, 1)} />
              <SummaryCard label="At 75% Conf." value={formatPercentMetric(JUDGE_MODEL_BENCHMARK.confidence75Accuracy, 1)} />
              <SummaryCard label="PPA Teams" value={Object.keys(adminV2PpaRatings).length} />
            </div>
          </div>

          <div className="rounded-[18px] border border-cyan-400/30 bg-cyan-500/10 p-5">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Current Event Backtest</div>
            <div className="mt-2 text-3xl font-black text-white">{bestModelBacktest?.modelName || 'Pending data'}</div>
            <p className="mt-2 text-sm font-semibold text-cyan-50/80">
              {bestModelBacktest
                ? bestModelBacktest.uncertaintyNote
                : 'Collect played qualification matches and scout rows before judging the event-local model.'}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SummaryCard label="Winner Accuracy" value={formatPercentMetric(bestModelJudgeSummary.winnerAccuracy, 1)} />
              <SummaryCard label="Correct Picks" value={`${bestModelJudgeSummary.correctWinnerPicks}/${bestModelJudgeSummary.decidedMatches}`} />
              <SummaryCard label="High Conf." value={bestModelJudgeSummary.highConfidenceMatches} />
              <SummaryCard label="High Conf. Acc." value={formatPercentMetric(bestModelJudgeSummary.highConfidenceAccuracy, 1)} />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryCard label="Usable Models" value={usableModelCount} />
          <SummaryCard label="Promotion Candidates" value={`${promotionCandidateCount}/${adminV2ModelBacktests.length}`} />
          <SummaryCard label="Forecast Layer" value={adminV2BestForecastLayer.modelName} />
          <SummaryCard label="Latest Snapshot" value={latestModelSnapshot ? formatLocalTimestamp(latestModelSnapshot.createdAt) : 'None'} />
        </div>
        {modelSnapshotStatus && (
          <div className="mt-4 rounded-[18px] border border-slate-800 bg-slate-950 p-4 text-sm font-semibold text-slate-300">
            {modelSnapshotStatus}
            {latestFeatureSnapshot && (
              <span className="ml-2 text-slate-500">
                Feature teams: {Object.keys(latestFeatureSnapshot.featuresByTeam).length}; match snapshots: {latestFeatureSnapshot.matchSnapshots?.length ?? 0}.
              </span>
            )}
          </div>
        )}

        <div className="mt-5 overflow-x-auto rounded-[18px] border border-slate-800">
          <table className="admin-sticky-table min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                {['Model', 'Promote', 'Ratings', 'Leakage', 'Matches', 'Winner Acc.', 'Avg Conf.', 'Brier', 'Score Miss', 'Margin Miss', 'Low Conf.', 'Source'].map(header => (
                  <th key={header} className="px-4 py-3">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {adminV2ModelBacktests.map(result => (
                <tr key={result.modelName} className={result.modelName === bestModelBacktest?.modelName ? 'bg-cyan-500/5' : ''}>
                  <td className="px-4 py-3 font-black text-white">{result.modelName}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${result.eligibleForPromotion ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>
                      {result.eligibleForPromotion ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{result.supportsTeamRatings ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{result.leakageRisk}</td>
                  <td className="px-4 py-3">{result.matchesTested}</td>
                  <td className="px-4 py-3">{formatPercentMetric(result.winnerAccuracy, 1)}</td>
                  <td className="px-4 py-3">{formatPercentMetric(result.averageConfidence, 1)}</td>
                  <td className="px-4 py-3">{formatMetricValue(result.brierScore, 3)}</td>
                  <td className="px-4 py-3">{formatMetricValue(result.scoreMae)}</td>
                  <td className="px-4 py-3">{formatMetricValue(result.marginMae)}</td>
                  <td className="px-4 py-3">{formatPercentMetric(result.lowConfidenceRate, 1)}</td>
                  <td className="max-w-sm px-4 py-3 text-slate-400">{result.sourceLabel}</td>
                </tr>
              ))}
              {adminV2ModelBacktests.length === 0 && (
                <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={12}>No model backtests are available yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        </AdminSurface>

        <div className="grid gap-5 xl:grid-cols-2">
          <AdminSurface className="p-4">
            <FocusHeader title="Calibration Bins" description="Predicted win rate should be close to actual win rate in each confidence band." />
            <div className="mt-4 overflow-x-auto rounded-[18px] border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Bin', 'Matches', 'Predicted', 'Actual', 'Gap'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {calibrationBins.map(bin => (
                    <tr key={`${bin.modelName}-${bin.binLabel}`}>
                      <td className="px-4 py-3 font-black text-white">{bin.binLabel}</td>
                      <td className="px-4 py-3">{bin.matches}</td>
                      <td className="px-4 py-3">{formatPercentMetric(bin.predictedWinRate, 1)}</td>
                      <td className="px-4 py-3">{formatPercentMetric(bin.actualWinRate, 1)}</td>
                      <td className="px-4 py-3">{formatPercentMetric(bin.calibrationGap, 1)}</td>
                    </tr>
                  ))}
                  {calibrationBins.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No calibration bins yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </AdminSurface>

          <AdminSurface className="p-4">
            <FocusHeader title="Scout Calibration" description="Compares V4 scout-side alliance totals with official alliance scores." />
            <div className="mt-4 overflow-x-auto rounded-[18px] border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Scout', 'Assigned', 'Rows', 'Matches', 'Bias', 'Avg Error', 'Abs Error'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {scoutCalibrationRows.map(row => (
                    <tr key={`${row.scoutName}-${row.assignedScoutName}`}>
                      <td className="px-4 py-3 font-black text-white">{row.scoutName}</td>
                      <td className="px-4 py-3 text-slate-300">{row.assignedScoutName || '—'}</td>
                      <td className="px-4 py-3">{row.rows}</td>
                      <td className="px-4 py-3">{row.matches}</td>
                      <td className={`px-4 py-3 font-black ${row.biasLabel === 'balanced' ? 'text-emerald-300' : row.biasLabel === 'under-counting' ? 'text-amber-300' : 'text-rose-300'}`}>{row.biasLabel}</td>
                      <td className="px-4 py-3">{formatSignedMetric(row.averageOfficialMinusScout)}</td>
                      <td className="px-4 py-3">{formatMetricValue(row.averageAbsoluteError)}</td>
                    </tr>
                  ))}
                  {scoutCalibrationRows.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No V4 scout calibration rows yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </AdminSurface>
        </div>

        <AdminSurface className="p-4">
          <FocusHeader title="No-Future Feature Matrix" description="What the model knew before each played qualification match. This protects the backtest from future leakage." />
          <div className="mt-4 overflow-x-auto rounded-[18px] border border-slate-800">
            <table className="admin-sticky-table min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Red Before-Match Features</th>
                  <th className="px-4 py-3">Blue Before-Match Features</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentFeatureSnapshots.map(snapshot => (
                  <tr key={snapshot.matchKey}>
                    <td className="px-4 py-3 font-mono font-black text-white">{snapshot.matchKey.toUpperCase()}</td>
                    <td className="px-4 py-3 text-xs text-red-100/80">{formatFeatureTeamList(snapshot.redTeams, snapshot.featuresByTeam)}</td>
                    <td className="px-4 py-3 text-xs text-blue-100/80">{formatFeatureTeamList(snapshot.blueTeams, snapshot.featuresByTeam)}</td>
                  </tr>
                ))}
                {recentFeatureSnapshots.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={3}>No played qualification match feature snapshots yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminSurface>
      </div>
    );
  };

  const renderScoutsControlPanel = () => (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Data"
        title="Scouts And PowerCoins"
        description="Scout operations live here because this is staffing, coverage, incentives, and cleanup work, not a match-day decision surface."
        action={<AdminButton onClick={() => setDataPanel(null)}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
      />

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-[22px] border border-cyan-400/25 bg-cyan-500/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-white">Scout Assignment Optimizer</h3>
                <p className="mt-1 text-sm font-semibold text-cyan-50/75">Paste one scout per line. The optimizer prioritizes our matches, repeated team exposure, and balanced load.</p>
              </div>
              <div className="rounded-full bg-cyan-400/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-cyan-100">
                {scoutAssignmentPlan ? formatLocalTimestamp(scoutAssignmentPlan.createdAt) : 'No plan'}
              </div>
            </div>
            <textarea
              value={scoutRosterText}
              onChange={event => setScoutRosterText(event.target.value)}
              rows={6}
              className="admin-g2-sm mt-4 w-full border border-cyan-300/25 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-300"
              placeholder="One scout name per line"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminButton tone="cyan" onClick={() => void handleOptimizeScouts()}>
                <Users className="h-4 w-4" />Optimize Assignments
              </AdminButton>
              <AdminButton tone="slate" onClick={handleExportScoutAssignmentsCsv}>
                <Download className="h-4 w-4" />Export Assignments
              </AdminButton>
              <AdminButton tone="amber" onClick={handleExportScoutCoverageGapsCsv}>
                <Download className="h-4 w-4" />Export Gaps
              </AdminButton>
            </div>
            {scoutControlStatus && (
              <div className="mt-3 rounded-[16px] border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100">
                {scoutControlStatus}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            <SummaryCard label="Assignments" value={scoutAssignmentPlan?.assignments.length ?? 0} />
            <SummaryCard label="Scouts" value={scoutAssignmentPlan?.scoutCount ?? 0} />
            <SummaryCard label="Avg Load" value={scoutAssignmentPlan ? formatMetricValue(scoutAssignmentPlan.assignments.length / Math.max(1, scoutAssignmentPlan.scoutCount), 1) : '—'} />
            <SummaryCard label="Our Slots" value={scoutAssignmentPlan?.assignments.filter(assignment => assignment.priorityReason === 'Our match priority').length ?? 0} />
            <SummaryCard label="Gaps" value={scoutAssignmentPlan?.coverageGaps?.length ?? 0} />
          </div>

          {(scoutAssignmentPlan?.coverageGaps?.length || 0) > 0 && (
            <div className="rounded-[22px] border border-amber-400/25 bg-amber-500/10 p-4">
              <div className="text-sm font-black text-amber-100">Coverage Gaps</div>
              <p className="mt-1 text-xs font-semibold text-amber-100/70">Fix these before the match starts so nobody assumes a full six-slot scout crew exists.</p>
              <div className="mt-3 max-h-52 overflow-y-auto rounded-[18px] border border-amber-300/20">
                <table className="admin-sticky-table min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-amber-950 text-xs uppercase tracking-wider text-amber-100">
                    <tr>
                      {['Match', 'Station', 'Team', 'Reason'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-300/10">
                    {scoutAssignmentPlan?.coverageGaps?.map((gap, index) => (
                      <tr key={`${gap.matchKey}_${gap.station}_${index}`}>
                        <td className="px-4 py-3 font-mono font-black text-amber-50">{gap.matchKey.toUpperCase()}</td>
                        <td className="px-4 py-3 text-amber-100">{gap.station}</td>
                        <td className="px-4 py-3 text-amber-100">
                          <TeamBadge teamNumber={gap.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={resolvedTeamNameLookup[gap.teamNumber] || ''} />
                        </td>
                        <td className="px-4 py-3 text-amber-100/80">{gap.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-[22px] border border-slate-800 bg-slate-950/70 p-4">
            <FocusHeader title="Scout Load" description="Who is assigned, what they repeatedly see, and whether our own matches are covered." />
            <div className="mt-4 max-h-72 overflow-y-auto rounded-[18px] border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Scout', 'Assignments', 'Teams', 'Repeat Focus', 'Our Slots', 'Top Exposures'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {scoutExposureRows.map(row => (
                    <tr key={row.scoutName}>
                      <td className="px-4 py-3 font-black text-cyan-100">{row.scoutName}</td>
                      <td className="px-4 py-3">{row.assignments}</td>
                      <td className="px-4 py-3">{row.distinctTeams}</td>
                      <td className="px-4 py-3">{row.repeatFocus}</td>
                      <td className="px-4 py-3">{row.ourMatchAssignments}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {row.topTeamExposures.length === 0 ? '—' : (
                          <div className="flex flex-wrap gap-1.5">
                            {row.topTeamExposures.map(exposure => (
                              <span key={`${row.scoutName}_${exposure.teamNumber}`} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-1.5 py-1">
                                <TeamBadge teamNumber={exposure.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={resolvedTeamNameLookup[exposure.teamNumber] || ''} />
                                <span className="pr-1 text-xs font-black text-slate-400">x{exposure.count}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {scoutExposureRows.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={6}>No scout assignment plan yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-800 bg-slate-950/70 p-4">
            <FocusHeader title="Assignment Sheet" description="The station-by-station plan scouts actually need before quals or practice matches." />
            <div className="mt-4 max-h-96 overflow-y-auto rounded-[18px] border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Match', 'Station', 'Team', 'Scout', 'Reason'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {scoutAssignmentPlan?.assignments.map((assignment, index) => (
                    <tr key={`${assignment.matchKey}_${assignment.station}_${index}`}>
                      <td className="px-4 py-3 font-mono text-white">{assignment.matchKey.toUpperCase()}</td>
                      <td className="px-4 py-3">{assignment.station}</td>
                      <td className="px-4 py-3">
                        <TeamBadge teamNumber={assignment.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamName={resolvedTeamNameLookup[assignment.teamNumber] || ''} />
                      </td>
                      <td className="px-4 py-3 font-black text-cyan-200">{assignment.scoutName}</td>
                      <td className="px-4 py-3 text-slate-400">{assignment.priorityReason}</td>
                    </tr>
                  ))}
                  {(!scoutAssignmentPlan || scoutAssignmentPlan.assignments.length === 0) && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No assignments yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div className="rounded-[22px] border border-yellow-400/25 bg-yellow-500/10 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-white">PowerCoins</h3>
                <p className="mt-1 text-sm font-semibold text-yellow-50/75">Bets start from 1000 coins per scout per event. Settlement is pari-mutuel.</p>
              </div>
              <AdminButton tone="amber" onClick={() => void handleSettleAllPlayedPowerCoins()}>
                <RefreshCw className="h-4 w-4" />Settle Played
              </AdminButton>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Tracked Scouts" value={powerCoinRows.length} />
              <SummaryCard label="Open Bets" value={powerCoinBets.filter(bet => !bet.settledAt).length} />
              <SummaryCard label="Open Stake" value={powerCoinBets.filter(bet => !bet.settledAt).reduce((sum, bet) => sum + bet.amount, 0)} />
            </div>
            {powerCoinStatus && (
              <div className="mt-3 rounded-[16px] border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-100">
                {powerCoinStatus}
              </div>
            )}
          </div>

          <div className="rounded-[22px] border border-yellow-400/25 bg-slate-950/70 p-4">
            <div className="text-sm font-black text-yellow-100">Admin Adjustment</div>
            <p className="mt-1 text-xs font-semibold text-yellow-100/65">Use ledger adjustments for quality bonuses, cleanup penalties, or judge-demo rewards.</p>
            <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_120px]">
              <AdminInput
                list="adminv4-powercoin-scouts"
                value={powerCoinAdjustmentScout}
                onChange={event => setPowerCoinAdjustmentScout(event.target.value)}
                placeholder="Scout name"
              />
              <AdminInput
                type="number"
                value={powerCoinAdjustmentAmount}
                onChange={event => setPowerCoinAdjustmentAmount(Number(event.target.value))}
              />
            </div>
            <datalist id="adminv4-powercoin-scouts">
              {powerCoinRows.map(row => <option key={row.scoutName} value={row.scoutName} />)}
            </datalist>
            <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_auto]">
              <AdminInput
                value={powerCoinAdjustmentReason}
                onChange={event => setPowerCoinAdjustmentReason(event.target.value)}
                placeholder="Quality scouting bonus"
              />
              <AdminButton tone="amber" onClick={() => void handlePowerCoinAdjustment()}>Apply</AdminButton>
            </div>
          </div>

          {powerCoinRows.length > 0 && (
            <div className="rounded-[22px] border border-yellow-400/20 bg-slate-950/70 p-4">
              <div className="text-sm font-black text-white">Prize Podium</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {powerCoinRows.slice(0, 3).map((row, index) => (
                  <div key={row.scoutName} className="rounded-[16px] border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
                    <div className="text-xs font-black uppercase tracking-widest text-yellow-100/70">#{index + 1}</div>
                    <div className="mt-1 font-black text-yellow-100">{row.scoutName}</div>
                    <div className="text-sm font-semibold text-yellow-100/70">{formatMetricValue(row.balance, 0)} coins</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[22px] border border-slate-800 bg-slate-950/70 p-4">
            <FocusHeader title="PowerCoin Standings" description="Balances include ledger adjustments, open stakes, and settled payouts." />
            <div className="mt-4 max-h-72 overflow-y-auto rounded-[18px] border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Rank', 'Scout', 'Balance', 'Open Bets', 'Open Stake', 'Settled', 'Staked', 'Payout'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {powerCoinRows.map((row, index) => (
                    <tr key={row.scoutName}>
                      <td className="px-4 py-3 font-mono font-black text-yellow-200">#{index + 1}</td>
                      <td className="px-4 py-3 font-black text-white">{row.scoutName}</td>
                      <td className="px-4 py-3 font-black text-yellow-200">{formatMetricValue(row.balance, 0)}</td>
                      <td className="px-4 py-3">{row.openBets}</td>
                      <td className="px-4 py-3">{formatMetricValue(row.openStake, 0)}</td>
                      <td className="px-4 py-3">{row.settledBets}</td>
                      <td className="px-4 py-3">{formatMetricValue(row.totalStaked, 0)}</td>
                      <td className="px-4 py-3">{formatMetricValue(row.totalPayout, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-800 bg-slate-950/70 p-4">
            <FocusHeader title="Open And Settled Bets" description="Unsettled bets can be settled manually when the official result is known." />
            <div className="mt-4 max-h-96 overflow-y-auto rounded-[18px] border border-slate-800">
              <table className="admin-sticky-table min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Scout', 'Match', 'Side', 'Stake', 'Outcome', 'Payout', 'Actions'].map(header => <th key={header} className="px-4 py-3">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {powerCoinBets.map(bet => (
                    <tr key={bet.id}>
                      <td className="px-4 py-3 font-black text-white">{bet.scoutName}</td>
                      <td className="px-4 py-3 font-mono">{bet.matchKey.toUpperCase()}</td>
                      <td className={`px-4 py-3 font-black ${bet.side === 'Red' ? 'text-red-300' : 'text-blue-300'}`}>{bet.side}</td>
                      <td className="px-4 py-3">{bet.amount}</td>
                      <td className="px-4 py-3">{bet.outcome || 'open'}</td>
                      <td className="px-4 py-3">{formatMetricValue(bet.payout ?? null, 0)}</td>
                      <td className="px-4 py-3">
                        {!bet.settledAt && (
                          <div className="flex gap-1">
                            {(['Red', 'Blue', 'Tie'] as const).map(winner => (
                              <button key={winner} onClick={() => void handleSettlePowerCoins(bet.matchKey, winner)} className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-black hover:bg-slate-700">{winner}</button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {powerCoinBets.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No PowerCoin bets yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminSurface>
  );

  const renderDataView = () => {
    if (dataPanel === 'collection') return renderCollectionControlPanel();
    if (dataPanel === 'preScout') return (
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Data / Collection Control"
          title="Pre Scout"
          description="Public team research lives here because it seeds early model context and tells pit scouts what they must verify manually."
          action={<AdminButton onClick={() => setDataPanel('collection')}><ChevronLeft className="h-4 w-4" />Back to Collection</AdminButton>}
        />
        <div className="mt-5">
          <PreMatchView isEmbedded={true} eventKey={eventKey} />
        </div>
      </AdminSurface>
    );
    if (dataPanel === 'audit') return renderRawAuditPanel();
    if (dataPanel === 'models') return renderModelLabView();
    if (dataPanel === 'scouts') return renderScoutsControlPanel();
    if (dataPanel === 'imports') {
      return (
        <AdminSurface className="p-5">
          <FocusHeader eyebrow="Data" title="Imports" description="TBA uploads, QR scans, and JSON scout archives." action={<AdminButton onClick={() => setDataPanel(null)}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>} />
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <AdminSurface className="p-4">
              <h3 className="text-lg font-black text-white">TBA Data Import</h3>
              <p className="mt-2 text-sm text-slate-400">Upload schedule, rankings, alliances, team list, event metadata, and OPR/COPR files.</p>
              <label className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-[18px] bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-500">
                <Upload className="h-4 w-4" />Upload TBA Files
                <input type="file" accept=".csv,.json,text/csv,application/json" multiple className="hidden" onChange={handleOprCsvUpload} />
              </label>
              {csvError && <div className="mt-4 rounded-[16px] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{csvError}</div>}
              {csvMessages.length > 0 && <div className="mt-4 space-y-2 text-sm text-cyan-100">{csvMessages.map((message, index) => <div key={`${message.text}-${index}`}>{message.text}</div>)}</div>}
            </AdminSurface>
            <AdminSurface className="p-4">
              <h3 className="text-lg font-black text-white">Scouting Data Import</h3>
              <p className="mt-2 text-sm text-slate-400">Scan QR payloads or import JSON scout archives.</p>
              <div className="mt-4"><QRScannerView isEmbedded={true} isActive={activeTab === 'import' && dataPanel === 'imports'} onArchiveChanged={() => void refreshLocalArchiveRecords()} /></div>
            </AdminSurface>
          </div>
        </AdminSurface>
      );
    }
    if (dataPanel === 'sources') {
      return (
        <AdminSurface className="p-5">
          <FocusHeader eyebrow="Data" title="Source Freshness" description="Cached and uploaded data status for this admin device." action={<AdminButton onClick={() => setDataPanel(null)}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>} />
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <SummaryCard label="Source Rows" value={sourceStatusSummary.rowCount} />
            <SummaryCard label="Source Types" value={sourceStatusSummary.uniqueSources} />
            <SummaryCard label="Latest Update" value={formatFreshnessAge(sourceStatusSummary.latestTimestamp)} />
            <SummaryCard label="FIRST Credentials" value={firstCredentials ? 'Saved locally' : 'Not saved'} />
          </div>
          <div className="mt-4 overflow-x-auto rounded-[18px] border border-slate-800">
            <table className="admin-sticky-table min-w-full text-left text-sm">
              <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Dataset</th><th className="px-4 py-3">Detail</th><th className="px-4 py-3">Freshness</th><th className="px-4 py-3">Loaded</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sourceStatusRows.map(row => <tr key={row.id}><td className="px-4 py-3 font-black text-cyan-100">{row.source}</td><td className="px-4 py-3 font-mono text-xs text-white">{row.key}</td><td className="px-4 py-3 text-slate-300">{row.detail}</td><td className="px-4 py-3 font-black text-cyan-100">{formatFreshnessAge(row.timestamp)}</td><td className="px-4 py-3 text-slate-400">{formatLocalTimestamp(row.timestamp)}</td></tr>)}
                {sourceStatusRows.length === 0 && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No cached source data yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </AdminSurface>
      );
    }
    if (dataPanel === 'backup') {
      return (
        <AdminSurface className="p-5">
          <FocusHeader eyebrow="Data" title="Sync And Backup" description="Local archive sync and full Admin V4 device backup." action={<AdminButton onClick={() => setDataPanel(null)}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>} />
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <AdminSurface className="p-4">
              <h3 className="text-lg font-black text-white">Local Archive Sync</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2"><SummaryCard label="Active Records" value={localArchiveSummary.activeRecords.length} /><SummaryCard label="Unsynced" value={localArchiveSummary.unsyncedRecords.length} /><SummaryCard label="Conflicts" value={localArchiveSummary.conflictRecords.length} /><SummaryCard label="Tombstones" value={localArchiveSummary.deletedRecords.length} /></div>
              <AdminButton tone="amber" className="mt-4" onClick={() => void handleSyncLocalArchiveToFirebase()} disabled={isLocalArchiveSyncing || localArchiveSummary.unsyncedRecords.length === 0}><Upload className="h-4 w-4" />Sync Unsynced To Firebase</AdminButton>
              {localArchiveSyncStatus && <div className="mt-3 text-sm font-semibold text-amber-100">{localArchiveSyncStatus}</div>}
              {localArchiveError && <div className="mt-3 text-sm font-semibold text-red-100">{localArchiveError}</div>}
            </AdminSurface>
            <AdminSurface className="p-4">
              <h3 className="text-lg font-black text-white">Full Local Backup</h3>
              <p className="mt-2 text-sm text-slate-400">Exports scout archive, source cache, uploaded files, model snapshots, scout plans, and PowerCoins. FIRST tokens are not included.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-[18px] border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-sm font-black text-emerald-50 hover:bg-emerald-500/25"><Upload className="h-4 w-4" />Import Backup<input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFullLocalBackup} /></label>
                <AdminButton tone="emerald" onClick={() => void handleExportFullLocalBackup()}><Download className="h-4 w-4" />Export Backup</AdminButton>
              </div>
              {localBackupStatus && <div className="mt-3 text-sm font-semibold text-emerald-100">{localBackupStatus}</div>}
              {localBackupError && <div className="mt-3 text-sm font-semibold text-red-100">{localBackupError}</div>}
            </AdminSurface>
          </div>
        </AdminSurface>
      );
    }

    const dataToneClass: Record<'cyan' | 'emerald' | 'amber' | 'fuchsia' | 'slate' | 'rose', string> = {
      cyan: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
      emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
      amber: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
      fuchsia: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100',
      slate: 'border-slate-700 bg-slate-950 text-slate-200',
      rose: 'border-rose-400/30 bg-rose-500/10 text-rose-100'
    };
    const dataCards: Array<{
      panel: DataPanel;
      step: string;
      title: string;
      when: string;
      output: string;
      health: string;
      icon: React.ReactNode;
      tone: 'cyan' | 'emerald' | 'amber' | 'fuchsia' | 'slate' | 'rose';
    }> = [
      {
        panel: 'imports',
        step: '1',
        title: 'Intake Sources',
        when: 'Before the event, between matches, or when offline cache is missing.',
        output: 'TBA/FIRST schedule, rankings, teams, OPR files, QR scans, JSON scout archives.',
        health: sourceStatusSummary.rowCount > 0 ? `${sourceStatusSummary.rowCount} sources loaded` : 'No cached sources',
        icon: <Upload className="h-5 w-5" />,
        tone: sourceStatusSummary.rowCount > 0 ? 'cyan' : 'amber'
      },
      {
        panel: 'collection',
        step: '2',
        title: 'Collect Evidence',
        when: 'Before pit closes and before each match cycle starts.',
        output: 'Pre-scout context, pit priors, match rows, defense evidence.',
        health: `${records.length + v4Records.length} match rows / ${activePitArchiveRecords.length} pit priors`,
        icon: <ListChecks className="h-5 w-5" />,
        tone: records.length + v4Records.length > 0 ? 'emerald' : 'amber'
      },
      {
        panel: 'audit',
        step: '3',
        title: 'Validate Raw Data',
        when: 'After every scout wave and before trusting PPA changes.',
        output: 'Missing slots, anomaly rows, editable raw match records.',
        health: rawEditorSummary.missingSlotCount > 0 || rawEditorSummary.anomalyRowCount > 0
          ? `${rawEditorSummary.missingSlotCount} gaps / ${rawEditorSummary.anomalyRowCount} anomalies`
          : 'No visible gaps',
        icon: <ListChecks className="h-5 w-5" />,
        tone: rawEditorSummary.missingSlotCount > 0 ? 'rose' : rawEditorSummary.anomalyRowCount > 0 ? 'amber' : 'emerald'
      },
      {
        panel: 'sources',
        step: '4',
        title: 'Check Freshness',
        when: 'Any time schedule/ranking/model results feel stale.',
        output: 'Cache age, uploaded file status, FIRST credentials, source rows.',
        health: `Latest ${formatFreshnessAge(sourceStatusSummary.latestTimestamp)}`,
        icon: <RefreshCw className="h-5 w-5" />,
        tone: sourceStatusSummary.rowCount > 0 ? 'emerald' : 'amber'
      },
      {
        panel: 'models',
        step: '5',
        title: 'Validate Models',
        when: 'Before relying on future quals, pick lists, or judge-facing claims.',
        output: 'Backtests, calibration, PPA shape counts, feature snapshots.',
        health: bestModelBacktest ? `${bestModelBacktest.modelName} leading` : 'Waiting for played matches',
        icon: <TrendingUp className="h-5 w-5" />,
        tone: bestModelBacktest ? 'fuchsia' : 'amber'
      },
      {
        panel: 'scouts',
        step: '6',
        title: 'Run Scout Ops',
        when: 'Before practice/quals blocks and whenever staffing changes.',
        output: 'Scout assignments, coverage gaps, exposure balance, PowerCoins.',
        health: scoutAssignmentPlan ? `${scoutAssignmentPlan.assignments.length} assignments` : 'No assignment plan',
        icon: <Users className="h-5 w-5" />,
        tone: scoutAssignmentPlan ? 'cyan' : 'amber'
      },
      {
        panel: 'backup',
        step: '7',
        title: 'Protect Device State',
        when: 'Before leaving the venue, switching machines, or deploying updates.',
        output: 'Firebase sync, local archive health, full Admin V4 backup.',
        health: localArchiveSummary.unsyncedRecords.length > 0 ? `${localArchiveSummary.unsyncedRecords.length} unsynced` : 'Synced enough',
        icon: <Database className="h-5 w-5" />,
        tone: localArchiveSummary.unsyncedRecords.length > 0 ? 'amber' : 'slate'
      }
    ];
    const dataPriorityQueue: Array<{
      label: string;
      detail: string;
      actionLabel: string;
      panel: DataPanel;
      tone: 'cyan' | 'emerald' | 'amber' | 'fuchsia' | 'slate' | 'rose';
    }> = [
      sourceStatusSummary.rowCount === 0
        ? {
          label: 'Start With Sources',
          detail: 'No cached or uploaded event source is available on this device.',
          actionLabel: 'Open Imports',
          panel: 'imports',
          tone: 'amber'
        }
        : null,
      rawEditorSummary.missingSlotCount > 0
        ? {
          label: 'Fix Coverage Gaps',
          detail: `${rawEditorSummary.missingSlotCount} expected scout slot${rawEditorSummary.missingSlotCount === 1 ? '' : 's'} missing.`,
          actionLabel: 'Audit Rows',
          panel: 'audit',
          tone: 'rose'
        }
        : null,
      rawEditorSummary.anomalyRowCount > 0
        ? {
          label: 'Review Anomalies',
          detail: `${rawEditorSummary.anomalyRowCount} submitted row${rawEditorSummary.anomalyRowCount === 1 ? '' : 's'} need review before model trust.`,
          actionLabel: 'Audit Rows',
          panel: 'audit',
          tone: 'amber'
        }
        : null,
      localArchiveSummary.unsyncedRecords.length > 0
        ? {
          label: 'Sync Local Data',
          detail: `${localArchiveSummary.unsyncedRecords.length} local record${localArchiveSummary.unsyncedRecords.length === 1 ? '' : 's'} have not reached Firebase.`,
          actionLabel: 'Sync / Backup',
          panel: 'backup',
          tone: 'amber'
        }
        : null,
      !scoutAssignmentPlan
        ? {
          label: 'Build Scout Plan',
          detail: 'No scout assignment plan is saved for this event.',
          actionLabel: 'Open Scouts',
          panel: 'scouts',
          tone: 'cyan'
        }
        : null,
      ppaReadinessSummary.lowConfidence > 0
        ? {
          label: 'Improve PPA Coverage',
          detail: `${ppaReadinessSummary.lowConfidence} team${ppaReadinessSummary.lowConfidence === 1 ? '' : 's'} have low PPA scouting confidence.`,
          actionLabel: 'Collection',
          panel: 'collection',
          tone: 'fuchsia'
        }
        : null
    ].filter((item): item is NonNullable<typeof item> => !!item).slice(0, 4);
    const visiblePriorityQueue = dataPriorityQueue.length > 0
      ? dataPriorityQueue
      : [{
        label: 'Control Room Clear',
        detail: 'No immediate data, sync, source, or scout-plan warnings are active.',
        actionLabel: 'Sources',
        panel: 'sources' as DataPanel,
        tone: 'emerald' as const
      }];

    return (
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Data"
          title="Maintenance Control Room"
          description="Run the data system in order: intake, collect, validate, refresh, model, staff, protect."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Source Rows" value={sourceStatusSummary.rowCount} />
          <SummaryCard label="Latest Source" value={formatFreshnessAge(sourceStatusSummary.latestTimestamp)} />
          <SummaryCard label="Match Rows" value={records.length + v4Records.length} />
          <SummaryCard label="Missing Slots" value={rawEditorSummary.missingSlotCount} />
          <SummaryCard label="PPA Shapes" value={ppaReadinessSummary.shapedInsights} />
          <SummaryCard label="Unsynced" value={localArchiveSummary.unsyncedRecords.length} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-3 md:grid-cols-2">
            {visiblePriorityQueue.map(priority => (
              <button
                key={priority.label}
                type="button"
                onClick={() => setDataPanel(priority.panel)}
                className={`admin-g2-sm border p-4 text-left transition-colors hover:bg-slate-900 ${dataToneClass[priority.tone]}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{priority.label}</div>
                    <div className="mt-2 text-sm font-semibold leading-relaxed">{priority.detail}</div>
                  </div>
                  <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/80">{priority.actionLabel}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="admin-g2-sm border border-slate-800 bg-slate-950 p-4">
            <div className="text-sm font-black text-white">Data Health</div>
            <div className="mt-3 space-y-2">
              {dataHealthRows.map(row => (
                <button
                  key={row.label}
                  type="button"
                  onClick={() => {
                    if (row.label === 'Coverage Gaps') setDataPanel('audit');
                    else if (row.label === 'Unsynced Local' || row.label === 'Conflicts') setDataPanel('backup');
                    else if (row.label === 'Source Freshness') setDataPanel('sources');
                    else if (row.label === 'Model Source') setDataPanel('models');
                    else setDataPanel('collection');
                  }}
                  className={`admin-g2-sm grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 border px-3 py-2 text-left ${dataToneClass[row.tone]}`}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-white">{row.label}</span>
                    <span className="block truncate text-[11px] font-semibold opacity-75">{row.detail}</span>
                  </span>
                  <span className="font-black text-white">{row.value}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dataCards.map(card => (
            <button
              key={card.panel}
              type="button"
              onClick={() => setDataPanel(card.panel)}
              className={`admin-g2 border p-5 text-left transition-colors hover:bg-slate-900 ${dataToneClass[card.tone]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="admin-g2-sm border border-white/15 bg-white/10 p-2 text-white">{card.icon}</span>
                  <span>
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Step {card.step}</span>
                    <span className="block text-lg font-black text-white">{card.title}</span>
                  </span>
                </div>
                <span className="admin-g2-sm border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/80">{card.health}</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm font-semibold sm:grid-cols-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">When</div>
                  <div className="mt-1 opacity-85">{card.when}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">Output</div>
                  <div className="mt-1 opacity-85">{card.output}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </AdminSurface>
    );
  };

  const renderReportsView = () => {
    const ppaTeamCount = ppaReadinessSummary.shapedInsights || Object.keys(adminV2PpaRatings).length;
    const rawEvidenceRows = records.length + v4Records.length + defenseRecords.length + activePitArchiveRecords.length;
    const reportToneClass: Record<'cyan' | 'emerald' | 'amber' | 'fuchsia' | 'slate' | 'rose', string> = {
      cyan: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100',
      emerald: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
      amber: 'border-amber-400/30 bg-amber-500/10 text-amber-100',
      fuchsia: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-100',
      slate: 'border-slate-700 bg-slate-950 text-slate-200',
      rose: 'border-rose-400/30 bg-rose-500/10 text-rose-100'
    };

    const openNextMatchPlan = () => {
      openWorkflow('predictor');
      setPredictorViewTab('quals');
      if (activePredictions[0]) setSelectedMatchKey(activePredictions[0].key);
    };
    const openModelProof = () => {
      openWorkflow('import');
      setDataPanel('models');
    };
    const openRawEvidence = () => {
      openWorkflow('import');
      setDataPanel(rawEditorSummary.missingSlotCount > 0 || rawEditorSummary.anomalyRowCount > 0 ? 'audit' : 'backup');
    };

    const reportPacks: Array<{
      key: string;
      title: string;
      audience: string;
      when: string;
      contains: string;
      status: string;
      tone: 'cyan' | 'emerald' | 'amber' | 'fuchsia' | 'slate' | 'rose';
      icon: React.ReactNode;
      actions: Array<{
        label: string;
        tone: 'cyan' | 'emerald' | 'amber' | 'fuchsia' | 'slate' | 'rose';
        icon: React.ReactNode;
        onClick: () => void;
        disabled?: boolean;
      }>;
    }> = [
      {
        key: 'head-scout',
        title: 'Head Scout Workbook',
        audience: 'Head scout',
        when: 'Between matches, after refresh, and before strategic calls.',
        contains: 'Complete XLSX: PPA shape, rankings, forecasts, strategy plans, coverage, source freshness, scouts, PowerCoins, and raw evidence.',
        status: exportStatus === 'loading' ? 'Building workbook' : exportStatus === 'success' ? 'Workbook exported' : `${ppaTeamCount} PPA teams / ${activePredictions.length} future quals`,
        tone: exportStatus === 'success' ? 'emerald' : 'cyan',
        icon: <Download className="h-5 w-5" />,
        actions: [{
          label: exportStatus === 'loading' ? 'Building XLSX' : exportStatus === 'success' ? 'Export Again' : 'Download XLSX',
          tone: exportStatus === 'success' ? 'emerald' : 'cyan',
          icon: <Download className="h-4 w-4" />,
          onClick: () => void exportInsightsWorkbook(),
          disabled: exportStatus === 'loading'
        }]
      },
      {
        key: 'drive-team',
        title: 'Drive Team Packet',
        audience: 'Drive coach / strategy huddle',
        when: 'Immediately before our next known match.',
        contains: 'Next match forecast, alliance PPA shape, opponent risk, role suggestions, RP path, and simulator entry.',
        status: activePredictions[0] ? `${activePredictions[0].title} ready` : 'No future known match',
        tone: activePredictions[0] ? 'fuchsia' : 'amber',
        icon: <Swords className="h-5 w-5" />,
        actions: [{
          label: activePredictions[0] ? 'Open Next Plan' : 'Open Matches',
          tone: activePredictions[0] ? 'fuchsia' : 'amber',
          icon: <Swords className="h-4 w-4" />,
          onClick: openNextMatchPlan
        }]
      },
      {
        key: 'alliance',
        title: 'Alliance Selection Board',
        audience: 'Pick-list lead',
        when: 'Before lunch, before alliance selection, and after every surprising result.',
        contains: 'Availability lanes, pick scores, PPA expected/floor/ceiling, role fit, defense value, tail risk, and shortlist status.',
        status: `${pickListSummary.available} available / ${pickListSummary.selected} selected`,
        tone: pickListSummary.available > 0 ? 'emerald' : 'amber',
        icon: <Trophy className="h-5 w-5" />,
        actions: [{
          label: 'Open Pick List',
          tone: pickListSummary.available > 0 ? 'emerald' : 'amber',
          icon: <Trophy className="h-4 w-4" />,
          onClick: () => openWorkflow('pickList')
        }]
      },
      {
        key: 'judges',
        title: 'Judges And Demo Proof',
        audience: 'Judges, mentors, and demo viewers',
        when: 'When someone asks what the model means or whether it is trustworthy.',
        contains: 'PPA definition, model validation, calibration, limitations, source map, and why PPA is a decision shape instead of one score.',
        status: bestModelBacktest ? `${bestModelBacktest.modelName} leading` : 'Model proof pending data',
        tone: bestModelBacktest ? 'cyan' : 'amber',
        icon: <BookOpen className="h-5 w-5" />,
        actions: [
          {
            label: 'PPA Wiki',
            tone: 'cyan',
            icon: <BookOpen className="h-4 w-4" />,
            onClick: () => openWiki('ppa', 'export')
          },
          {
            label: 'Model Proof',
            tone: bestModelBacktest ? 'fuchsia' : 'amber',
            icon: <TrendingUp className="h-4 w-4" />,
            onClick: openModelProof
          }
        ]
      },
      {
        key: 'evidence',
        title: 'Raw Evidence And Backup',
        audience: 'Data lead / device owner',
        when: 'When a number looks wrong, a row is missing, or the machine needs handoff protection.',
        contains: 'Raw rows, local archive, source cache, scout coverage gaps, Firebase sync state, and full device backup route.',
        status: localArchiveSummary.unsyncedRecords.length > 0 ? `${localArchiveSummary.unsyncedRecords.length} unsynced` : `${rawEvidenceRows} evidence rows`,
        tone: localArchiveSummary.unsyncedRecords.length > 0 || rawEditorSummary.missingSlotCount > 0 ? 'amber' : 'slate',
        icon: <Database className="h-5 w-5" />,
        actions: [{
          label: rawEditorSummary.missingSlotCount > 0 || rawEditorSummary.anomalyRowCount > 0 ? 'Audit Rows' : 'Sync / Backup',
          tone: localArchiveSummary.unsyncedRecords.length > 0 || rawEditorSummary.missingSlotCount > 0 ? 'amber' : 'slate',
          icon: <Database className="h-4 w-4" />,
          onClick: openRawEvidence
        }]
      }
    ];

    const workbookSections = [
      {
        group: 'Decision Layer',
        sheets: 'PPA Insights, PPA Ranking, PPA Quals, Best Validated Quals',
        use: 'Head scout sees future strength as expected value plus uncertainty, not a naked number.'
      },
      {
        group: 'Match Strategy',
        sheets: 'Strategy Plans, Strategy Role Options, finals projections',
        use: 'Drive team gets alliance shape, role suggestions, RP path, and risk before a match.'
      },
      {
        group: 'Pick List',
        sheets: 'Alliance Picklist, Team Profiles, Team Curves, Defense Summary',
        use: 'Alliance lead can defend why a team belongs in a lane and what could go wrong.'
      },
      {
        group: 'Model Proof',
        sheets: 'Model Lab, Model Calibration, Model Features, No-Future Features',
        use: 'Judges and mentors can audit validation, calibration, feature source, and limitations.'
      },
      {
        group: 'Raw Evidence',
        sheets: 'All Raw Data, Raw V4 Data, Coverage Audit, Local Archive, Source Freshness, Scout Assignments, PowerCoins',
        use: 'Data lead can trace every conclusion back to submitted rows and local device state.'
      }
    ];

    return (
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Reports"
          title="Audience Report Packs"
          description="Reports is the handoff room: export the full evidence, or jump to the exact packet needed by head scout, drive team, pick-list lead, judges, or data owner."
        />

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="PPA Teams" value={ppaTeamCount} />
          <SummaryCard label="Future Simulations" value={activePredictions.length} />
          <SummaryCard label="Raw Evidence Rows" value={rawEvidenceRows} />
          <SummaryCard label="Source Rows" value={sourceStatusSummary.rowCount} />
          <SummaryCard label="Latest Source" value={formatFreshnessAge(sourceStatusSummary.latestTimestamp)} />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4 md:grid-cols-2">
            {reportPacks.map(pack => (
              <div key={pack.key} className={`admin-g2 border p-5 ${reportToneClass[pack.tone]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="admin-g2-sm border border-white/15 bg-white/10 p-2 text-white">{pack.icon}</span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{pack.audience}</div>
                      <h3 className="mt-1 text-lg font-black text-white">{pack.title}</h3>
                    </div>
                  </div>
                  <span className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-black uppercase text-white/80">{pack.status}</span>
                </div>

                <div className="mt-4 grid gap-3 text-sm font-semibold sm:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">When</div>
                    <div className="mt-1 opacity-85">{pack.when}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">Contains</div>
                    <div className="mt-1 opacity-85">{pack.contains}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {pack.actions.map(action => (
                    <AdminButton
                      key={action.label}
                      tone={action.tone}
                      onClick={action.onClick}
                      disabled={action.disabled}
                    >
                      {action.icon}
                      {action.label}
                    </AdminButton>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="admin-g2 border border-slate-800 bg-slate-950 p-5">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Export Contract</div>
            <h3 className="mt-2 text-xl font-black text-white">One Workbook, Many Audiences</h3>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-400">
              The XLSX keeps the whole scouting chain together: collection, validation, PPA model shape, match strategy, pick list, operations, and raw evidence. It is intentionally comprehensive; the cards choose the right door before someone gets lost in the file.
            </p>
            <AdminButton
              tone={exportStatus === 'success' ? 'emerald' : 'cyan'}
              className="mt-5 w-full"
              onClick={() => void exportInsightsWorkbook()}
              disabled={exportStatus === 'loading'}
            >
              <Download className="h-4 w-4" />
              {exportStatus === 'loading' ? 'Building XLSX' : exportStatus === 'success' ? 'Download Again' : 'Download Full XLSX'}
            </AdminButton>
          </div>
        </div>

        <div className="mt-5 admin-g2 border border-slate-800 bg-slate-950">
          <div className="border-b border-slate-800 px-5 py-4">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Workbook Contents</div>
            <h3 className="mt-1 text-lg font-black text-white">What The Export Proves</h3>
          </div>
          <div className="divide-y divide-slate-800">
            {workbookSections.map(section => (
              <div key={section.group} className="grid gap-3 px-5 py-4 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="font-black text-cyan-100">{section.group}</div>
                <div className="text-sm font-semibold text-slate-300">{section.sheets}</div>
                <div className="text-sm font-semibold leading-relaxed text-slate-500">{section.use}</div>
              </div>
            ))}
          </div>
        </div>
      </AdminSurface>
    );
  };

  const renderContent = () => {
    if (activeTab === 'wiki') return <StatWikiView activeKey={wikiStatKey} onSelect={setWikiStatKey} onBack={handleAdminBack} />;
    if (activeTab === 'command') return renderNowView();
    if (activeTab === 'sorter' || activeTab === 'teams') return renderTeamsView();
    if (activeTab === 'predictor') return renderMatchesView();
    if (activeTab === 'simulator') return renderSimulatorView();
    if (activeTab === 'pickList') return renderPickListView();
    if (activeTab === 'visualize') return renderVisualizeView();
    if (activeTab === 'import' || activeTab === 'rawEditor') return renderDataView();
    if (activeTab === 'export') return renderReportsView();
    if (activeTab === 'results') return renderMatchesView();
    return renderNowView();
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 shadow-2xl shadow-slate-950/30 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <AdminIconButton onClick={handleAdminBack} aria-label={adminBackLabel} title={adminBackLabel}>
                {activeTab === 'command' ? <Home className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </AdminIconButton>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                  <span>Admin V4</span>
                  <span className="font-mono text-slate-500">{eventKey}</span>
                </div>
                <div className="mt-1 truncate text-xl font-black text-white">{activeTab === 'wiki' ? 'Stats Wiki' : activeWorkspace.label}</div>
              </div>
            </div>

            <form onSubmit={submitTeamSearch} className="min-w-0 flex-1 xl:max-w-xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <AdminInput
                  type="text"
                  list="adminv2-top-team-search"
                  value={teamSearchInput}
                  onChange={event => setTeamSearchInput(event.target.value)}
                  className="w-full py-3 pl-10 pr-20"
                  placeholder="Search team number or name"
                />
                <button type="submit" aria-label="Open searched team" className="admin-g2-sm absolute right-1.5 top-1/2 -translate-y-1/2 bg-cyan-600 px-3 py-1.5 text-xs font-black text-white hover:bg-cyan-500">OPEN</button>
                <datalist id="adminv2-top-team-search">
                  {allKnownTeams.flatMap(teamNumber => {
                    const teamName = resolvedTeamNameLookup[teamNumber] || '';
                    return [
                      <option key={`${teamNumber}:number`} value={teamNumber}>{teamName || `Team ${teamNumber}`}</option>,
                      teamName ? <option key={`${teamNumber}:name`} value={teamName}>{teamNumber}</option> : null,
                      teamName ? <option key={`${teamNumber}:display`} value={`${teamNumber} ${teamName}`}>{teamName}</option> : null
                    ].filter(Boolean);
                  })}
                </datalist>
                {teamSearchError && (
                  <div className="admin-g2-sm mt-2 w-full border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100">
                    {teamSearchError}
                  </div>
                )}
              </div>
            </form>

            <div className="flex items-center gap-2">
              <AdminButton tone="fuchsia" onClick={() => { setSelectedMatchKey(''); setActiveTab('simulator'); }}><Swords className="h-4 w-4" /><span className="hidden sm:inline">Manual</span></AdminButton>
              <AdminIconButton tone="emerald" onClick={() => void loadV3Data({ preserveScroll: true })} disabled={loading} aria-label="Refresh data" title="Refresh data"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></AdminIconButton>
              <AdminIconButton onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings"><Settings className="h-4 w-4" /></AdminIconButton>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Admin workflows">
            {workspaceItems.map(item => {
              const isActive = activeWorkspaceKey === item.key && activeTab !== 'wiki';
              return (
                <button key={item.key} type="button" onClick={() => openWorkflow(item.key)} className={`admin-g2-sm inline-flex shrink-0 items-center gap-2 border px-3 py-2 text-sm font-black transition-colors ${isActive ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100' : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800'}`}>
                  {item.icon}{item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main ref={mainScrollRef} className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto max-w-7xl pb-10">{renderContent()}</div>
      </main>

      <AdminModal open={settingsOpen} title="Settings" onClose={() => setSettingsOpen(false)}>
        <div className="grid gap-5 lg:grid-cols-2">
          <AdminSurface className="p-4">
            <h3 className="text-lg font-black text-white">Event</h3>
            <div className="mt-3 grid gap-2">
              {QUICK_EVENTS.map(([key, label]) => <AdminButton key={key} tone={eventKey === key ? 'cyan' : 'slate'} onClick={() => updateSettings({ eventKey: key })}>{label}</AdminButton>)}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[120px_1fr]">
              <AdminInput type="number" value={searchYear} onChange={event => setSearchYear(event.target.value)} placeholder="Year" />
              <AdminButton onClick={searchEvents} disabled={isSearchingEvents}>Search TBA Events</AdminButton>
            </div>
            {searchResults.length > 0 && <div className="mt-3 max-h-52 overflow-y-auto rounded-[16px] border border-slate-800 bg-slate-950 p-2">{searchResults.slice(0, 20).map(result => <button key={result.key} type="button" onClick={() => updateSettings({ eventKey: result.key })} className="block w-full rounded-[12px] px-3 py-2 text-left text-sm font-semibold text-slate-300 hover:bg-slate-900">{result.short_name || result.name} <span className="font-mono text-slate-500">{result.key}</span></button>)}</div>}
          </AdminSurface>

          <AdminSurface className="p-4">
            <h3 className="text-lg font-black text-white">Team And Local Credentials</h3>
            <label className="mt-3 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Own Team</label>
            <AdminInput value={ownTeamNumber} onChange={event => updateSettings({ ownTeamNumber: sanitizeTeamNumber(event.target.value) })} placeholder="254" className="mt-2 w-full" />
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-[18px] border border-cyan-400/40 bg-cyan-500/15 px-4 py-3 text-sm font-black text-cyan-50 hover:bg-cyan-500/25">
              <Upload className="h-4 w-4" />Upload Local API Key JSON
              <input type="file" accept=".json,application/json" className="hidden" onChange={handleFirstCredentialUpload} />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton onClick={() => void handleRefreshFirstEventCache()}>Refresh FIRST Cache</AdminButton>
              <AdminButton onClick={() => void handleClearFirstCredentials()}>Clear FIRST</AdminButton>
              <AdminButton onClick={() => void handleClearTbaApiKey()}>Clear TBA</AdminButton>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-400">
              <div>TBA key: <span className="font-black text-slate-100">{hasLocalTbaApiKey ? 'Saved locally' : TBA_API_KEY ? 'Bundled config' : 'Missing'}</span></div>
              <div>FIRST: <span className="font-black text-slate-100">{firstCredentials ? `Saved for ${firstCredentials.username}` : 'Not saved'}</span></div>
              <div>Source rows: <span className="font-black text-slate-100">{sourceStatusSummary.rowCount}</span></div>
            </div>
            {(firstCredentialStatus || apiKeyStatus) && <div className="mt-3 rounded-[16px] border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{firstCredentialStatus || apiKeyStatus}</div>}
            {(firstCredentialError || apiKeyError) && <div className="mt-3 rounded-[16px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{firstCredentialError || apiKeyError}</div>}
          </AdminSurface>
        </div>
      </AdminModal>

      {infoMenu && (
        <AdminContextMenu x={infoMenu.x} y={infoMenu.y} onClose={() => setInfoMenu(null)}>
          <button type="button" onClick={() => openWiki(infoMenu.statKey)} className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm font-black text-slate-200 hover:bg-slate-800">
            <BookOpen className="h-4 w-4" />Get Info
          </button>
        </AdminContextMenu>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 px-5 py-4">
      <div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function CollectionPipelinePanel({
  stages,
  ppaReadinessCards,
  compact = false
}: {
  stages?: CollectionPipelineStage[];
  ppaReadinessCards?: PpaReadinessCard[];
  compact?: boolean;
}) {
  const missionKeys: ScoutingMissionKey[] = ['preScout', 'pitScout', 'matchScout', 'defenseScout'];
  const useMoments = [SCOUTING_USE_MOMENTS.matches, SCOUTING_USE_MOMENTS.pickList, SCOUTING_USE_MOMENTS.visualize];
  const displayedStages: CollectionPipelineStage[] = stages || missionKeys.map(key => {
    const mission = SCOUTING_MISSIONS[key];
    return {
      key,
      count: 0,
      countLabel: 'signals',
      readinessLabel: mission.title,
      readinessDetail: mission.modelImpact,
      tone: 'cyan'
    };
  });
  const readinessToneClass: Record<CollectionPipelineStage['tone'], string> = {
    emerald: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100',
    amber: 'border-amber-400/30 bg-amber-500/15 text-amber-100',
    rose: 'border-rose-400/30 bg-rose-500/15 text-rose-100',
    cyan: 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
  };

  return (
    <AdminSurface className="p-5">
      <FocusHeader
        title={compact ? 'Pipeline Health' : 'Collection Pipeline'}
        description="Raw scouting is organized by when it is collected, then turned into the processed signals each decision moment needs."
      />
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {displayedStages.map(stage => {
          const mission = SCOUTING_MISSIONS[stage.key];
          return (
            <div key={mission.key} className={`admin-g2-sm border p-4 ${getMissionToneClasses(mission.tone)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] opacity-75">{mission.shortTitle}</div>
                  <div className="mt-2 text-lg font-black text-white">{mission.title}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-white">{stage.count}</div>
                  <div className="text-[10px] font-black uppercase tracking-wider opacity-70">{stage.countLabel}</div>
                </div>
              </div>
              <div className={`admin-g2-sm mt-3 inline-flex border px-2 py-1 text-[10px] font-black uppercase ${readinessToneClass[stage.tone]}`}>
                {stage.readinessLabel}
              </div>
              <div className="mt-3 text-xs font-semibold opacity-85">{stage.readinessDetail}</div>
              <div className="mt-3 text-xs font-semibold opacity-80">{mission.processedSignals.slice(0, 3).join(' / ')}</div>
            </div>
          );
        })}
      </div>
      {ppaReadinessCards && ppaReadinessCards.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ppaReadinessCards.map(card => (
            <div key={card.label} className={`admin-g2-sm border p-4 ${readinessToneClass[card.tone || 'cyan']}`}>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-75">{card.label}</div>
              <div className="mt-2 text-2xl font-black text-white">{card.value}</div>
              <div className="mt-2 text-xs font-semibold opacity-85">{card.detail}</div>
            </div>
          ))}
        </div>
      )}
      {!compact && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {useMoments.map(moment => (
            <div key={moment.key} className="admin-g2-sm border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm font-black text-white">{moment.title}</div>
              <div className="mt-2 text-xs font-semibold text-slate-500">{moment.when}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {moment.needs.slice(0, 4).map(need => (
                  <span key={need} className="admin-g2-sm border border-slate-700 px-2 py-1 text-[11px] font-black text-slate-300">
                    {need}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}

const getRiskPillClass = (level: PpaRiskLevel) => {
  if (level === 'Low') return 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
  if (level === 'Medium') return 'border border-amber-400/30 bg-amber-500/15 text-amber-100';
  return 'border border-rose-400/30 bg-rose-500/15 text-rose-100';
};

function PpaAllianceBrief({
  title,
  summary,
  accentClass
}: {
  title: string;
  summary: PpaAllianceSummary;
  accentClass: string;
}) {
  return (
    <AdminSurface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-sm font-black ${accentClass}`}>{title}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{summary.confidenceLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black uppercase tracking-wider text-slate-500">Expected</div>
          <div className="text-xl font-black text-white">{formatMetricValue(summary.expected)}</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MetricField label="Floor" value={formatMetricValue(summary.floor)} />
        <MetricField label="Ceiling" value={formatMetricValue(summary.ceiling)} />
        <MetricField label="Defense" value={formatMetricValue(summary.defenseValue)} />
      </div>
      <div className="admin-g2-sm mt-3 border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300">
        {summary.rolePlan}
      </div>
      {summary.riskNotes.length > 0 && (
        <div className="mt-3 space-y-1">
          {summary.riskNotes.map(note => (
            <div key={note} className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100">
              {note}
            </div>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}

function StrategyRpPathCard({ path }: { path: StrategyAllianceRpPath }) {
  return (
    <div className={`admin-g2-sm border p-4 ${path.alliance === 'Red' ? 'border-red-500/25 bg-red-500/10' : 'border-blue-500/25 bg-blue-500/10'}`}>
      <div className={`text-sm font-black ${path.alliance === 'Red' ? 'text-red-100' : 'text-blue-100'}`}>
        {path.alliance} RP Path
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricField label="Projected RP" value={formatMetricValue(path.projectedRp, 1)} />
        <MetricField label="Win RP" value={formatMetricValue(path.winRp, 1)} />
        <MetricField label="Tower RP" value={formatMetricValue(path.towerRp, 1)} />
        <MetricField label="Bonus RP" value={formatMetricValue(path.energizedRp + path.superchargedRp, 1)} />
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-400">{path.note}</p>
    </div>
  );
}

function StrategyRoleOptionList({
  title,
  options,
  accentClass
}: {
  title: string;
  options: StrategyMatchPlan['redRoleOptions'];
  accentClass: string;
}) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-4">
      <div className={`text-sm font-black ${accentClass}`}>{title}</div>
      <div className="mt-3 space-y-2">
        {options.slice(0, 3).map(option => (
          <div key={`${title}-${option.label}`} className={`admin-g2-sm border px-3 py-2 text-sm ${option.recommended ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-black text-white">{option.label}</div>
              {option.recommended && <span className="admin-g2-sm border border-emerald-400/30 bg-emerald-500/15 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">Recommended</span>}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <MetricField label="Net" value={formatSignedMetric(option.netMargin, 1)} />
              <MetricField label="Cost" value={formatMetricValue(option.offenseCost, 1)} />
              <MetricField label="Defense" value={formatMetricValue(option.defenseValue, 1)} />
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">{option.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StrategyMatchPlanPanel({ plan }: { plan: StrategyMatchPlan | null }) {
  if (!plan) {
    return (
      <AdminSurface className="border-amber-400/30 bg-amber-500/10 p-5">
        <FocusHeader
          title="Strategy Plan"
          description="No future-match strategy plan exists for this row yet. Future matches with known teams will show role options, RP paths, risk flags, and counter-strategy here."
        />
      </AdminSurface>
    );
  }

  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Match Help"
        title="Strategy Plan"
        description={`${plan.modelName} · ${plan.modelLowConfidence ? 'low confidence forecast' : 'standard confidence forecast'}`}
      />
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Role Winner" value={plan.predictedWinner} />
        <SummaryCard label="Optimized Red" value={formatMetricValue(plan.optimizedRedScore, 1)} />
        <SummaryCard label="Optimized Blue" value={formatMetricValue(plan.optimizedBlueScore, 1)} />
        <SummaryCard label="Confidence" value={formatPercentMetric(plan.confidence, 0)} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <StrategyRoleOptionList title="Red Role Options" options={plan.redRoleOptions} accentClass="text-red-100" />
        <StrategyRoleOptionList title="Blue Role Options" options={plan.blueRoleOptions} accentClass="text-blue-100" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <StrategyRpPathCard path={plan.redRpPath} />
        <StrategyRpPathCard path={plan.blueRpPath} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="admin-g2-sm border border-cyan-400/25 bg-cyan-500/10 p-4">
          <div className="text-sm font-black text-cyan-100">Win Condition</div>
          <p className="mt-2 text-sm font-semibold text-cyan-50/80">{plan.winCondition}</p>
        </div>
        <div className="admin-g2-sm border border-fuchsia-400/25 bg-fuchsia-500/10 p-4">
          <div className="text-sm font-black text-fuchsia-100">Counter-Strategy</div>
          <p className="mt-2 text-sm font-semibold text-fuchsia-50/80">{plan.opponentCounterStrategy}</p>
        </div>
      </div>
      {plan.riskFlags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {plan.riskFlags.map(flag => (
            <span key={flag} className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100">
              {flag}
            </span>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}

function PpaInsightPanel({
  insight,
  onInfo,
  onInfoContext
}: {
  insight: PpaInsight;
  onInfo: (key: StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: StatInfoKey) => void;
}) {
  return (
    <AdminSurface className="p-4" onContextMenu={(event: React.MouseEvent) => onInfoContext(event, 'ppa')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">PPA Decision Shape</div>
          <div className="mt-1 text-2xl font-black text-white">
            {formatMetricValue(insight.projected.expected ?? insight.rating)}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-500">
            {insight.source.label} · {insight.coverage.label}
          </div>
        </div>
        <StatInfoButton statKey="ppa" label="PPA" onInfo={onInfo} onInfoContext={onInfoContext} />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid grid-cols-2 gap-2">
          <MetricField label="Expected" value={formatMetricValue(insight.projected.expected ?? insight.rating)} />
          <MetricField label="Role" value={insight.role.label} />
          <MetricField label="Floor" value={formatMetricValue(insight.projected.floor)} />
          <MetricField label="Ceiling" value={formatMetricValue(insight.projected.ceiling)} />
          <MetricField label="Normal Low" value={formatMetricValue(insight.projected.normalLow)} />
          <MetricField label="Normal High" value={formatMetricValue(insight.projected.normalHigh)} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MetricField label="Uncertainty" value={insight.uncertainty.level} />
          <MetricField label="Tail Risk" value={insight.tailRisk.label} />
          <MetricField label="Scout Confidence" value={formatPercentMetric(insight.coverage.scoutConfidence, 0)} />
          <MetricField label="Matches Logged" value={`${insight.components.matchesLogged}`} />
          <MetricField label="Defense Impact" value={formatMetricValue(insight.components.defenseImpact)} />
          <MetricField label="Volatility" value={formatMetricValue(insight.components.volatility)} />
        </div>
      </div>

      <div className="mt-3 rounded-[14px] border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-300">
        {insight.role.reason}
      </div>
      <div className="mt-2 rounded-[14px] border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-400">
        {insight.explanation}
      </div>
      <div className="mt-3 rounded-[14px] border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100">
        {insight.source.validationLine}
      </div>
      {(insight.uncertainty.reasons.length > 0 || insight.tailRisk.reasons.length > 0) && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-[14px] border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Why uncertainty is {insight.uncertainty.level}</div>
            <div className="mt-2 space-y-1 text-xs font-semibold text-slate-300">
              {insight.uncertainty.reasons.slice(0, 3).map(reason => <div key={reason}>{reason}</div>)}
            </div>
          </div>
          <div className="rounded-[14px] border border-slate-800 bg-slate-950/70 px-3 py-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Tail risk</div>
            <div className="mt-2 space-y-1 text-xs font-semibold text-slate-300">
              {insight.tailRisk.reasons.slice(0, 3).map(reason => <div key={reason}>{reason}</div>)}
            </div>
          </div>
        </div>
      )}
      {insight.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {insight.warnings.map(warning => (
            <div key={warning} className="rounded-[12px] border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100">
              {warning}
            </div>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}

function ModelToggleGroup({
  selectedMetric,
  onChange,
  label = 'Model'
}: {
  selectedMetric: AdminV2SelectedMetric;
  onChange: (metric: AdminV2SelectedMetric) => void;
  label?: string;
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <div className="admin-g2-sm inline-flex border border-slate-800 bg-slate-950 p-1">
        {MODEL_OPTIONS.map(metric => (
          <button
            key={metric}
            type="button"
            onClick={() => onChange(metric)}
            className={`admin-g2-sm px-3 py-1.5 text-xs font-black transition-colors ${
              selectedMetric === metric
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            title={`${MODEL_LABELS[metric]} model`}
          >
            {MODEL_LABELS[metric]}
          </button>
        ))}
      </div>
    </div>
  );
}

function FocusHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</div>}
        <h2 className="mt-1 break-words text-2xl font-black text-white">{title}</h2>
        {description && <p className="mt-2 max-w-3xl break-words text-sm font-semibold text-slate-400">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function StatInfoButton({
  statKey,
  label,
  onInfo,
  onInfoContext
}: {
  statKey: StatInfoKey;
  label: string;
  onInfo: (key: StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: StatInfoKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onInfo(statKey)}
      onContextMenu={event => onInfoContext(event, statKey)}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-400 transition-colors hover:border-cyan-400/50 hover:text-cyan-200"
      aria-label={`Get info for ${label}`}
      title={`Get info for ${label}`}
    >
      <Info className="h-3.5 w-3.5" />
    </button>
  );
}

function StatChip({
  statKey,
  label,
  selected,
  onToggle,
  onInfo,
  onInfoContext
}: {
  statKey: StatInfoKey;
  label: string;
  selected: boolean;
  onToggle: () => void;
  onInfo: (key: StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: StatInfoKey) => void;
}) {
  return (
    <div
      className={`admin-g2-sm inline-flex items-center gap-1 border p-1 ${
        selected ? 'border-cyan-400/40 bg-cyan-500/15' : 'border-slate-800 bg-slate-950'
      }`}
      onContextMenu={event => onInfoContext(event, statKey)}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`rounded-[10px] px-3 py-1.5 text-xs font-black ${
          selected ? 'text-cyan-50' : 'text-slate-400 hover:text-white'
        }`}
      >
        {label}
      </button>
      <StatInfoButton statKey={statKey} label={label} onInfo={onInfo} onInfoContext={onInfoContext} />
    </div>
  );
}

function PpaShapeBarChart({
  rows,
  onInfo,
  onInfoContext
}: {
  rows: PpaShapeChartRow[];
  onInfo: (key: StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: StatInfoKey) => void;
}) {
  const chartRows = rows.map(row => ({
    ...row,
    displayLabel: row.label,
    expectedFill:
      row.highlighted === 'both'
        ? '#f59e0b'
        : row.highlighted === 'own'
          ? '#fb923c'
          : row.highlighted === 'searched'
            ? '#38bdf8'
            : '#c084fc'
  }));

  return (
    <AdminSurface className="min-h-[460px] p-5" onContextMenu={(event: React.MouseEvent) => onInfoContext(event, 'ppa')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">PPA Decision Shape</h3>
          <p className="mt-1 text-sm text-slate-400">
            Floor, expected value, and ceiling per team. Use the labels below for role fit and risk before trusting the tallest bar.
          </p>
        </div>
        <StatInfoButton statKey="ppa" label="PPA" onInfo={onInfo} onInfoContext={onInfoContext} />
      </div>

      <div className="mt-5 h-80">
        {chartRows.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[18px] border border-slate-800 bg-slate-950 text-sm font-semibold text-slate-500">
            No PPA shape data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartRows} margin={{ top: 8, right: 12, left: 0, bottom: 38 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="displayLabel"
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                tickFormatter={value => formatMetricValue(Number(value), 0)}
                width={52}
              />
              <Tooltip
                cursor={{ fill: 'rgba(168, 85, 247, 0.08)' }}
                contentStyle={{
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: 16,
                  color: '#e2e8f0'
                }}
                formatter={(value, name) => [formatMetricValue(Number(value), 2), name]}
                labelFormatter={label => `Team ${label}`}
              />
              <Legend
                wrapperStyle={{ color: '#cbd5e1', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}
                iconType="circle"
              />
              <Bar dataKey="floor" name="Floor" fill="#475569" radius={[8, 8, 0, 0]} maxBarSize={20} />
              <Bar dataKey="expected" name="Expected" radius={[10, 10, 0, 0]} maxBarSize={24}>
                {chartRows.map(row => (
                  <Cell key={`${row.key}-expected`} fill={row.expectedFill} />
                ))}
              </Bar>
              <Bar dataKey="ceiling" name="Ceiling" fill="#22d3ee" radius={[8, 8, 0, 0]} maxBarSize={20} />
            </RechartsBarChart>
          </ResponsiveContainer>
        )}
      </div>

      {chartRows.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {chartRows.slice(0, 6).map(row => (
            <div key={`${row.key}-shape-note`} className="rounded-[16px] border border-slate-800 bg-slate-950/70 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm font-black text-white">{row.label}</div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${getRiskPillClass(row.uncertainty)}`}>
                  {row.uncertainty}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                <span className="rounded-full border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-violet-100">{row.role}</span>
                <span className={`rounded-full px-2 py-1 ${getRiskPillClass(row.tailRisk)}`}>{row.tailRiskLabel}</span>
                <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{formatPercentMetric(row.scoutConfidence, 0)} confidence</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminSurface>
  );
}

function VerticalStatBarChart({
  title,
  subtitle,
  rows,
  valueFormatter,
  infoKey,
  onInfo,
  onInfoContext
}: {
  title: string;
  subtitle?: string;
  rows: Array<{ key: string; label: string; value: number; secondary?: string; highlighted?: 'own' | 'searched' | 'both' }>;
  valueFormatter: (value: number) => string;
  infoKey: StatInfoKey;
  onInfo: (key: StatInfoKey) => void;
  onInfoContext: (event: React.MouseEvent, key: StatInfoKey) => void;
}) {
  const chartRows = rows.map(row => ({
    ...row,
    displayLabel: row.label,
    fill:
      row.highlighted === 'both'
        ? '#f59e0b'
        : row.highlighted === 'own'
          ? '#fb923c'
          : row.highlighted === 'searched'
            ? '#38bdf8'
            : '#22d3ee'
  }));

  return (
    <AdminSurface className="min-h-[360px] p-5" onContextMenu={(event: React.MouseEvent) => onInfoContext(event, infoKey)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-white">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
        </div>
        <StatInfoButton statKey={infoKey} label={title} onInfo={onInfo} onInfoContext={onInfoContext} />
      </div>

      <div className="mt-5 h-72">
        {chartRows.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-[18px] border border-slate-800 bg-slate-950 text-sm font-semibold text-slate-500">
            No chartable team data yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={chartRows} margin={{ top: 10, right: 12, left: 0, bottom: 32 }}>
              <CartesianGrid stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="displayLabel"
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={45}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 800 }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                tickFormatter={value => valueFormatter(Number(value))}
                width={52}
              />
              <Tooltip
                cursor={{ fill: 'rgba(14, 165, 233, 0.08)' }}
                contentStyle={{
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: 16,
                  color: '#e2e8f0'
                }}
                formatter={value => [valueFormatter(Number(value)), title]}
                labelFormatter={label => `Team ${label}`}
              />
              <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={36}>
                {chartRows.map(row => (
                  <Cell key={row.key} fill={row.fill} />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        )}
      </div>
    </AdminSurface>
  );
}

function StatWikiView({
  activeKey,
  onSelect,
  onBack
}: {
  activeKey: StatInfoKey;
  onSelect: (key: StatInfoKey) => void;
  onBack: () => void;
}) {
  const activeInfo = getStatInfo(activeKey);
  const entries = Object.entries(STAT_INFO) as Array<[StatInfoKey, StatInfoDefinition]>;

  return (
    <AdminSurface className="p-5">
      <FocusHeader
        eyebrow="Stats Wiki"
        title={activeInfo.title}
        description="Plain-language definitions, formulas, data sources, limitations, and where the stat appears in Admin V4."
        action={
          <AdminButton onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </AdminButton>
        }
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="max-h-[70vh] overflow-y-auto rounded-[18px] border border-slate-800 bg-slate-950 p-2">
          {entries.map(([key, info]) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`admin-g2-sm mb-1 w-full px-3 py-2 text-left text-sm font-black transition-colors ${
                key === activeKey
                  ? 'bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {info.title}
            </button>
          ))}
        </aside>
        <article className="space-y-4">
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
            {activeInfo.category}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <MetricField label="Formula" value={activeInfo.formula} />
            <MetricField label="Source Data" value={activeInfo.source} />
            <MetricField label="How To Read It" value={activeInfo.interpretation} />
            <MetricField label="Limitations" value={activeInfo.limitations} />
          </div>
          <AdminSurface className="p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Where It Appears</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(activeInfo.whereAppears || ['Admin V4']).map(place => (
                <span key={place} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-black text-slate-200">
                  {place}
                </span>
              ))}
            </div>
          </AdminSurface>
        </article>
      </div>
    </AdminSurface>
  );
}

function StatInfoDialog({
  info,
  onClose
}: {
  info: StatInfoDefinition;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
      <div className="admin-g2-lg w-full max-w-2xl border border-slate-700 bg-slate-950 p-5 shadow-2xl shadow-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">{info.category}</div>
            <h3 className="mt-1 text-2xl font-black text-white">{info.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="admin-button border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            aria-label="Close stat explanation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <MetricField label="Formula" value={info.formula} />
          <MetricField label="Source Data" value={info.source} />
          <MetricField label="How To Read It" value={info.interpretation} />
          <MetricField label="Limitations" value={info.limitations} />
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  activeField,
  direction,
  onClick,
  infoKey,
  onInfo,
  onInfoContext,
  align = 'text-left'
}: {
  label: string;
  field: SorterField;
  activeField: SorterField;
  direction: SorterDirection;
  onClick: (field: SorterField) => void;
  infoKey?: StatInfoKey;
  onInfo?: (key: StatInfoKey) => void;
  onInfoContext?: (event: React.MouseEvent, key: StatInfoKey) => void;
  align?: string;
}) {
  const isActive = activeField === field;

  return (
    <th
      className={`cursor-pointer px-4 py-3 transition-colors hover:text-white ${align}`}
      onClick={() => onClick(field)}
      onContextMenu={event => {
        if (!infoKey) return;
        event.preventDefault();
        if (onInfoContext) {
          onInfoContext(event, infoKey);
          return;
        }
        onInfo?.(infoKey);
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        {isActive && <ArrowUpDown className={`h-3.5 w-3.5 ${direction === 'asc' ? 'rotate-180' : ''}`} />}
        {infoKey && onInfo && (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              onInfo(infoKey);
            }}
            className="rounded-full p-0.5 text-slate-500 hover:bg-slate-800 hover:text-cyan-200"
            aria-label={`Explain ${label}`}
            title={`Explain ${label}`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    </th>
  );
}

type WorkbookColumn = {
  header: string;
  key: string;
  width?: number;
};

const styleWorkbookHeader = (worksheet: any, columnCount: number) => {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: 'A1',
    to: worksheet.getRow(1).getCell(columnCount).address
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFF8FAFC' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };
  worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
};

const styleWorkbookGrid = (worksheet: any) => {
  worksheet.eachRow((row: any, rowNumber: number) => {
    row.eachCell((cell: any) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };

      if (rowNumber > 1) {
        cell.alignment = { vertical: 'top', wrapText: true };
      }
    });
  });
};

const addWorkbookSheet = (
  workbook: any,
  title: string,
  columns: WorkbookColumn[],
  rows: Array<Record<string, unknown>>
) => {
  const worksheet = workbook.addWorksheet(title);
  worksheet.columns = columns.map(column => ({
    ...column,
    width: column.width ?? Math.min(Math.max(column.header.length + 2, 12), 36)
  }));

  rows.forEach(row => worksheet.addRow(row));
  styleWorkbookHeader(worksheet, columns.length);
  styleWorkbookGrid(worksheet);
  return worksheet;
};

const addQualificationProjectionSheet = (
  workbook: any,
  title: string,
  rows: ProjectedQualificationTeamRow[],
  teamNameLookup: Record<string, string>
) =>
  addWorkbookSheet(
    workbook,
    title,
    [
      { header: 'Projected Rank', key: 'projectedRank', width: 14 },
      { header: 'Team', key: 'teamNumber', width: 10 },
      { header: 'Team Name', key: 'teamName', width: 24 },
      { header: 'Current TBA Rank', key: 'currentTbaRank', width: 14 },
      { header: 'Projected Total RP', key: 'projectedTotalRp', width: 16 },
      { header: 'Wins', key: 'wins', width: 10 },
      { header: 'Losses', key: 'losses', width: 10 },
      { header: 'Ties', key: 'ties', width: 10 },
      { header: 'Win RP', key: 'projectedWinRp', width: 12 },
      { header: 'Tower RP', key: 'projectedTowerRp', width: 12 },
      { header: 'Energized RP', key: 'projectedEnergizedRp', width: 14 },
      { header: 'Supercharged RP', key: 'projectedSuperchargedRp', width: 16 }
    ],
    rows.map(row => ({
      ...row,
      teamName: teamNameLookup[row.teamNumber] || '',
      currentTbaRank: row.currentTbaRank ?? ''
    }))
  );

const addQualPredictionSheet = (workbook: any, title: string, rows: Array<{
  key: string;
  title: string;
  scheduledTime: number | null;
  red: { teams: string[]; predictedScore: number };
  blue: { teams: string[]; predictedScore: number };
  predictedWinner: 'Red' | 'Blue' | 'Tie';
  predictionLowConfidence: boolean;
}>) =>
  addWorkbookSheet(
    workbook,
    title,
    [
      { header: 'Match', key: 'title', width: 14 },
      { header: 'Match Key', key: 'key', width: 18 },
      { header: 'Scheduled', key: 'scheduledTime', width: 24 },
      { header: 'Red Teams', key: 'redTeams', width: 22 },
      { header: 'Red Score', key: 'redScore', width: 12 },
      { header: 'Blue Teams', key: 'blueTeams', width: 22 },
      { header: 'Blue Score', key: 'blueScore', width: 12 },
      { header: 'Predicted Winner', key: 'predictedWinner', width: 16 },
      { header: 'Confidence', key: 'confidence', width: 12 }
    ],
    rows.map(row => ({
      title: row.title,
      key: row.key,
      scheduledTime: formatWorksheetDate(row.scheduledTime),
      redTeams: row.red.teams.join(', '),
      redScore: row.red.predictedScore,
      blueTeams: row.blue.teams.join(', '),
      blueScore: row.blue.predictedScore,
      predictedWinner: row.predictedWinner,
      confidence: row.predictionLowConfidence ? 'Low' : 'Standard'
    }))
  );

const addFinalsProjectionSheet = (workbook: any, title: string, projection: ReturnType<typeof buildPlayoffProjection>) => {
  if (!projection.supported || projection.rounds.length === 0) {
    return addWorkbookSheet(
      workbook,
      title,
      [
        { header: 'Status', key: 'status', width: 18 },
        { header: 'Message', key: 'message', width: 60 }
      ],
      [
        {
          status: 'Unavailable',
          message: projection.reason || 'Finals projection is not available for this event yet.'
        }
      ]
    );
  }

  return addWorkbookSheet(
    workbook,
    title,
    [
      { header: 'Round', key: 'roundTitle', width: 28 },
      { header: 'Match', key: 'title', width: 16 },
      { header: 'Match Key', key: 'matchKey', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Scheduled', key: 'scheduledTime', width: 24 },
      { header: 'Red Label', key: 'redLabel', width: 18 },
      { header: 'Red Teams', key: 'redTeams', width: 26 },
      { header: 'Red Score', key: 'redScore', width: 12 },
      { header: 'Blue Label', key: 'blueLabel', width: 18 },
      { header: 'Blue Teams', key: 'blueTeams', width: 26 },
      { header: 'Blue Score', key: 'blueScore', width: 12 },
      { header: 'Predicted Winner', key: 'predictedWinnerLabel', width: 18 },
      { header: 'Confidence', key: 'confidence', width: 12 }
    ],
    projection.rounds.flatMap(round =>
      round.matches.map(match => ({
        roundTitle: round.title,
        title: match.title,
        matchKey: match.matchKey,
        status: getPlayoffStatusLabel(match.status),
        scheduledTime: formatWorksheetDate(match.scheduledTime),
        redLabel: match.red.label,
        redTeams: match.red.teamKeys.join(', '),
        redScore: match.red.score ?? '',
        blueLabel: match.blue.label,
        blueTeams: match.blue.teamKeys.join(', '),
        blueScore: match.blue.score ?? '',
        predictedWinnerLabel: match.predictedWinnerLabel,
        confidence: match.confidence ?? ''
      }))
    )
  );
};

function SidebarPerformanceProfile({ profile }: { profile: TeamPerformanceProfile }) {
  const width = 240;
  const height = 76;
  const padding = 8;
  const curve = profile.curve;
  const values = curve.flatMap(point => [point.score, point.fittedScore, point.upperBand]);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(1, ...values);
  const xFor = (index: number) =>
    curve.length <= 1 ? width / 2 : padding + (index / (curve.length - 1)) * (width - padding * 2);
  const yFor = (value: number) =>
    height - padding - ((value - minValue) / Math.max(1, maxValue - minValue)) * (height - padding * 2);
  const pathFor = (accessor: (point: TeamPerformanceProfile['curve'][number]) => number) =>
    curve
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(1)} ${yFor(accessor(point)).toFixed(1)}`)
      .join(' ');

  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-slate-500">Performance Profile</div>
          <div className="mt-1 text-sm font-semibold text-slate-300">
            {profile.matchesPlayed} match{profile.matchesPlayed === 1 ? '' : 'es'} · trend {formatMetricValue(profile.recentTrend, 3)}
          </div>
        </div>
        <span className={`admin-g2-sm px-2 py-1 text-xs font-black ${profile.recentTrend >= 0 ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}>
          {profile.recentTrend >= 0 ? 'RISING' : 'FALLING'}
        </span>
      </div>

      {curve.length > 0 ? (
        <svg className="mt-3 h-20 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Team ${profile.teamNumber} performance curve`}>
          <path d={pathFor(point => point.lowerBand)} fill="none" stroke="rgb(51 65 85)" strokeWidth="1" strokeDasharray="3 3" />
          <path d={pathFor(point => point.upperBand)} fill="none" stroke="rgb(51 65 85)" strokeWidth="1" strokeDasharray="3 3" />
          <path d={pathFor(point => point.fittedScore)} fill="none" stroke="rgb(34 211 238)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={pathFor(point => point.score)} fill="none" stroke="rgb(244 114 182)" strokeWidth="2" strokeLinecap="round" />
          {curve.map((point, index) => (
            <circle key={`${point.matchKey}-${index}`} cx={xFor(index)} cy={yFor(point.score)} r="2.3" fill="rgb(244 114 182)" />
          ))}
        </svg>
      ) : (
        <div className="admin-g2-sm mt-3 border border-slate-800 bg-slate-950/70 px-3 py-4 text-sm font-semibold text-slate-500">
          No scouted point curve yet.
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <MetricField label="Avg" value={formatMetricValue(profile.averageScore)} />
        <MetricField label="Peak" value={formatMetricValue(profile.peakScore)} />
        <MetricField label="Floor" value={formatMetricValue(profile.floorScore)} />
        <MetricField label="Ceiling" value={formatMetricValue(profile.ceilingScore)} />
        <MetricField label="Std Dev" value={formatMetricValue(profile.standardDeviation)} />
        <MetricField label="Projected" value={formatMetricValue(profile.projectedNextScore)} />
        <MetricField label="PPA" value={formatMetricValue(profile.ppa)} />
        <MetricField label="Defense Impact" value={formatMetricValue(profile.defenseImpact)} />
      </div>
    </div>
  );
}

function MetricField({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2">
      <div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function SidebarListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs font-black uppercase tracking-wider text-slate-500">{title}</div>
      <div className="mt-3 space-y-2 text-sm text-slate-300">
        {items.map(item => (
          <div key={`${title}-${item}`}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function TeamBadge({
  teamNumber,
  ownTeamNumber,
  searchedTeamNumber,
  teamName
}: {
  teamNumber: string;
  ownTeamNumber: string;
  searchedTeamNumber: string;
  teamName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-xl px-3 py-1 text-sm font-black ${getTeamBadgeClass(
          teamNumber,
          ownTeamNumber,
          searchedTeamNumber
        )}`}
      >
        {teamNumber}
      </span>
      {teamName && <span className="text-xs text-slate-500">{teamName}</span>}
    </div>
  );
}

function TeamList({
  teams,
  ownTeamNumber,
  searchedTeamNumber,
  teamNameLookup
}: {
  teams: string[];
  ownTeamNumber: string;
  searchedTeamNumber: string;
  teamNameLookup: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {teams.length === 0 ? (
        <span className="text-slate-500">TBD</span>
      ) : (
        teams.map(team => (
          <span
            key={team}
            title={teamNameLookup[team] || ''}
            className={`inline-flex items-center rounded-xl px-3 py-1 text-xs font-black ${getTeamBadgeClass(
              team,
              ownTeamNumber,
              searchedTeamNumber
            )}`}
          >
            {team}
          </span>
        ))
      )}
    </div>
  );
}

function SimulatorTeamTable({
  rows
}: {
  rows: Array<{
    teamNumber: string;
    teamName: string;
    rating: number;
    ppaRating: number | null;
    ppaInsight: PpaInsight | null;
    defenseImpact: number | null;
    recommendedRole: string;
    auto: number | null;
    teleop: number | null;
  }>;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-[18px] border border-slate-800">
      <table className="admin-sticky-table min-w-full text-left text-sm">
        <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-3 py-2">Team</th>
            <th className="px-3 py-2 text-right">Rating</th>
            <th className="px-3 py-2 text-right">PPA</th>
            <th className="px-3 py-2 text-right">Defense</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Trust</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map(row => (
            <tr key={row.teamNumber}>
              <td className="px-3 py-2">
                <div className="font-mono font-black text-white">{row.teamNumber}</div>
                {row.teamName && <div className="text-xs text-slate-500">{row.teamName}</div>}
              </td>
              <td className="px-3 py-2 text-right font-black text-cyan-100">{formatMetricValue(row.rating)}</td>
              <td className="px-3 py-2 text-right text-slate-300">{formatMetricValue(row.ppaRating)}</td>
              <td className="px-3 py-2 text-right text-emerald-200">{formatMetricValue(row.defenseImpact)}</td>
              <td className="px-3 py-2 text-slate-300">{row.recommendedRole}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full px-2 py-1 text-xs font-black ${getRiskPillClass(row.ppaInsight?.uncertainty.level || 'High')}`}>
                  {row.ppaInsight?.uncertainty.level || 'High'}
                </span>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-6 text-center text-slate-500" colSpan={6}>
                Enter teams to simulate this alliance.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PlayoffMatchCard({
  match,
  ownTeamNumber,
  searchedTeamNumber,
  teamNameLookup
}: {
  match: PredictedMatchRow;
  ownTeamNumber: string;
  searchedTeamNumber: string;
  teamNameLookup: Record<string, string>;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-black text-white">{match.title}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{match.matchKey}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{getTimestampLabel(match.scheduledTime)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black uppercase tracking-widest text-slate-500">{getPlayoffStatusLabel(match.status)}</div>
          {match.confidence != null && (
            <div className="mt-1 text-xs font-semibold text-slate-400">{match.confidence}% confidence</div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4">
          <div className="text-xs font-black uppercase tracking-widest text-red-300">{match.red.label}</div>
          <div className="mt-3">
            <TeamList
              teams={match.red.teamKeys.map(normalizeTeamKey)}
              ownTeamNumber={ownTeamNumber}
              searchedTeamNumber={searchedTeamNumber}
              teamNameLookup={teamNameLookup}
            />
          </div>
          <div className="mt-3 text-2xl font-black text-red-300">
            {match.red.score == null ? '—' : match.red.score.toFixed(1)}
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4">
          <div className="text-xs font-black uppercase tracking-widest text-blue-300">{match.blue.label}</div>
          <div className="mt-3">
            <TeamList
              teams={match.blue.teamKeys.map(normalizeTeamKey)}
              ownTeamNumber={ownTeamNumber}
              searchedTeamNumber={searchedTeamNumber}
              teamNameLookup={teamNameLookup}
            />
          </div>
          <div className="mt-3 text-2xl font-black text-blue-300">
            {match.blue.score == null ? '—' : match.blue.score.toFixed(1)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
        <div className="text-sm font-semibold text-slate-400">Winner</div>
        <div className="inline-flex items-center gap-2 text-sm font-black text-white">
          <Trophy className="h-4 w-4 text-amber-300" />
          {match.predictedWinnerLabel}
        </div>
      </div>
    </div>
  );
}

function SimulatorAllianceCard({
  title,
  accentClass,
  borderClass,
  backgroundClass,
  rows,
  ownTeamNumber,
  searchedTeamNumber,
  metricLabel
}: {
  title: string;
  accentClass: string;
  borderClass: string;
  backgroundClass: string;
  rows: Array<{
    teamNumber: string;
    teamName: string;
    rating: number;
    ppaRating: number | null;
    ppaInsight: PpaInsight | null;
    defenseImpact: number | null;
    recommendedRole: string;
    auto: number | null;
    teleop: number | null;
  }>;
  ownTeamNumber: string;
  searchedTeamNumber: string;
  metricLabel: string;
}) {
  return (
    <div className={`rounded-2xl border ${borderClass} ${backgroundClass} overflow-hidden`}>
      <div className="border-b border-slate-800 px-5 py-4">
        <h4 className={`text-lg font-black ${accentClass}`}>{title}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="admin-sticky-table min-w-[820px] w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">{metricLabel}</th>
              <th className="px-4 py-3">PPA</th>
              <th className="px-4 py-3">Defense Impact</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Trust</th>
              <th className="px-4 py-3">Auto</th>
              <th className="px-4 py-3">Teleop</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center font-semibold text-slate-500">
                  No teams entered yet.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.teamNumber} className="hover:bg-slate-800/20">
                  <td className="px-4 py-3">
                    <TeamBadge
                      teamNumber={row.teamNumber}
                      ownTeamNumber={ownTeamNumber}
                      searchedTeamNumber={searchedTeamNumber}
                      teamName={undefined}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-300">{row.teamName || '—'}</td>
                  <td className="px-4 py-3 font-black text-white">{row.rating.toFixed(2)}</td>
                  <td className="px-4 py-3 font-black text-cyan-300">{formatMetricValue(row.ppaRating)}</td>
                  <td className="px-4 py-3 font-black text-emerald-300">{formatMetricValue(row.defenseImpact)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${
                      row.recommendedRole === 'Defender' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-fuchsia-500/15 text-fuchsia-200'
                    }`}>
                      {row.recommendedRole}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${getRiskPillClass(row.ppaInsight?.uncertainty.level || 'High')}`}>
                      {row.ppaInsight?.uncertainty.level || 'High'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{formatMetricValue(row.auto)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatMetricValue(row.teleop)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
