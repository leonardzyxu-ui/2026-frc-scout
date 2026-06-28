import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ChevronLeft,
  Database,
  Download,
  Edit3,
  Gauge,
  Info,
  ListChecks,
  RefreshCw,
  Swords,
  TrendingUp,
  Trophy,
  Upload,
  Users
} from 'lucide-react';
import { db } from '../firebase';
import {
  AlliancePickRecommendation,
  MatchDefenseScoutingV1,
  MatchScoutingV3,
  MatchScoutingV4,
  ModelFeatureSnapshot,
  ModelLabSnapshot,
  PreMatchTeamProfile,
  ScoutAssignmentPlan,
  ScoutEvidenceAdminTask,
  StrategyMatchPlan
} from '../types';
import { TBA_API_KEY } from '../config';
import { calculateLegacyDprRatings, calculateLegacyOprRatings, MathEngine, TBAMatch } from '../utils/mathEngine';
const LazyAdminV4TeamsWorkflow = React.lazy(() => import('../components/adminv4/AdminV4TeamsWorkflow'));
const LazyAdminV4MatchesWorkflow = React.lazy(() => import('../components/adminv4/AdminV4MatchesWorkflow'));
const LazyAdminV4ManualSimulatorPanel = React.lazy(() => import('../components/adminv4/AdminV4ManualSimulatorPanel'));
const LazyAdminV4PickListWorkflow = React.lazy(() => import('../components/adminv4/AdminV4PickListWorkflow'));
const LazyAdminV4VisualizeWorkflow = React.lazy(() => import('../components/adminv4/AdminV4VisualizeWorkflow'));
const LazyAdminV4ImportsPanel = React.lazy(() => import('../components/adminv4/AdminV4ImportsPanel'));
const LazyAdminV4PreScoutPanel = React.lazy(() => import('../components/adminv4/AdminV4PreScoutPanel'));
const LazyAdminV4ReportsPanel = React.lazy(() => import('../components/adminv4/AdminV4ReportsPanel'));
const LazyAdminV4DataOverviewWorkflow = React.lazy(() => import('../components/adminv4/AdminV4DataOverviewWorkflow'));
const LazyAdminV4BackupSyncPanel = React.lazy(() => import('../components/adminv4/AdminV4BackupSyncPanel'));
const LazyAdminV4ScoutStaffingPanel = React.lazy(() => import('../components/adminv4/AdminV4ScoutStaffingPanel'));
const LazyAdminV4SourceFreshnessPanel = React.lazy(() => import('../components/adminv4/AdminV4SourceFreshnessPanel'));
const LazyAdminV4DataPipelinePanel = React.lazy(() => import('../components/adminv4/AdminV4DataPipelinePanel'));
const LazyAdminV4ModelValidationPanel = React.lazy(() => import('../components/adminv4/AdminV4ModelValidationPanel'));
const LazyAdminV4RawAuditPanel = React.lazy(() => import('../components/adminv4/AdminV4RawAuditPanel'));
const LazyAdminV4StrategyPlanPanel = React.lazy(() => import('../components/adminv4/AdminV4StrategyPlanPanel'));
import {
  buildHistoricalAverageLookup,
  buildPredictedMatchesFromRatings,
  buildPredictedMatchesV3,
  buildTeamDefenseMetrics,
  buildTeamHistoricalAveragesV4Aware,
  PredictedMatchV3,
  summarizeDefenseMetricGuardrails
} from '../utils/adminV4Analytics';
import {
  buildPlayoffProjection,
  buildQualificationProjection,
  TBAEliminationAlliance,
  TBAEventSummary
} from '../utils/matchPredictor';
import { fetchEventStatboticsEpa, StatboticsNormalizedTeamEpa } from '../utils/statbotics';
import { buildTbaHttpError, getTbaUserFacingError, isTbaAuthError, TBA_KEY_MISSING_MESSAGE } from '../utils/tbaErrors';
import {
  getLatestAdminV4CachePayload,
  isCachedDefenseRows,
  isCachedEventTeamRoster,
  isCachedMatchScoutingV3Rows,
  isCachedMatchScoutingV4Rows,
  isCachedPreMatchTeamProfile,
  isCachedStatboticsEpaPayload,
  isCachedTbaAlliances,
  isCachedTbaMatches,
  isCachedTbaRankings,
  loadLatestCachedPayload,
  teamRosterToNameLookup,
  type TbaRankingsResponse
} from '../utils/adminV4Cache';
import {
  getPreferredUploadedSchedule,
  getUploadedTeamNameLookup,
  importUploadedTbaCsvFiles,
  loadUploadedTbaCsvPack,
  saveUploadedTbaCsvPack,
  UploadedTbaCsvImportMessage,
  UploadedTbaCsvPack
} from '../utils/adminV4TbaCsv';
import {
  AdminV4SelectedMetric,
  AdminV4Settings,
  loadAdminV4Settings,
  saveAdminV4Settings
} from '../utils/adminV4Settings';
import {
  BACKUP_IMPORT_CATEGORY_COPY,
  countBackupImportCategory,
  DEFAULT_BACKUP_IMPORT_OPTIONS,
  getAdminV4BackupPayload,
  isAdminV4FullLocalBackup
} from '../utils/adminV4BackupImport';
import type {
  BackupImportCategory,
  BackupImportOptions,
  BackupImportPreview
} from '../utils/adminV4BackupImport';
import {
  buildAdminV4TestModeScope,
  getAdminV4MatchLabel,
  sortAdminV4MatchesForTestMode
} from '../utils/adminV4TestMode';
import { buildLocalAdminV4TestModeFixture } from '../utils/adminV4TestFixture';
import {
  ADMIN_ROUTE_TAB_BY_WORKFLOW,
  activeWorkspaceKeyFromTab,
  adminReturnTabFromRouteParam,
  adminRouteParamFromTab,
  buildAdminV4Route,
  dataPanelFromAdminRouteParam,
  metricSurfaceFromTab,
  teamReturnTabFromRouteParam,
  workflowFromAdminRouteTab,
  type AdminV4DataPanel,
  type AdminV4MetricSurfaceKey,
  type AdminV4Tab,
  type AdminV4WorkflowTab
} from '../utils/adminV4Routes';
import {
  normalizeAdminV4TeamSearchText,
  sanitizeAdminV4TeamNumber
} from '../utils/adminV4TeamSearch';
import {
  getAdminV4SmartSearchSuggestions,
  type AdminV4SmartSearchResult
} from '../utils/adminV4SmartSearch';
import {
  loadAdminV4PickListState,
  saveAdminV4PickListState,
  type AdminV4PickStatusMap
} from '../utils/adminV4PickListState';
import {
  describeAdminV4CachedPayload as describeCachedPayload,
  downloadAdminV4JsonFile as downloadJsonFile,
  formatAdminV4LocalTimestamp as formatLocalTimestamp,
  formatAdminV4MaybeValue as formatMaybeValue,
  formatAdminV4MetricValue as formatMetricValue,
  formatAdminV4PercentMetric as formatPercentMetric,
  formatAdminV4PpaRange as formatPpaRange,
  formatAdminV4SignedMetric as formatSignedMetric,
  formatAdminV4WorksheetDate as formatWorksheetDate,
  getAdminV4FreshnessAge as formatFreshnessAge,
  stringifyAdminV4WorkbookCell as stringifyForWorkbookCell
} from '../utils/adminV4Format';
import {
  addFinalsProjectionSheet,
  addQualPredictionSheet,
  addQualificationProjectionSheet,
  addWorkbookSheet
} from '../utils/adminV4WorkbookSheets';
import {
  formatAdminV4Record as formatRecord,
  getAdminV4CompLevelLabel as getCompLevelLabel,
  getAdminV4PlayedMatchWinner as getPlayedMatchWinner,
  getAdminV4PredictorViewDescription as getPredictorViewDescription,
  getAdminV4ResultsViewDescription as getResultsViewDescription,
  isAdminV4PlayedMatch as isPlayedMatch,
  isLegacyAdminV4MatchScoutingV2 as isLegacyMatchScoutingV2,
  mergeAdminV4V3WithLegacyRows as mergeV3WithLegacyRows,
  normalizeAdminV4TeamKey as normalizeTeamKey,
  sortAdminV4ScoutRowsByMatchThenTeam as sortScoutRowsByMatchThenTeam,
  type AdminV4PredictorDisplayTab,
  type AdminV4ResultsDisplayTab
} from '../utils/adminV4MatchUtils';
import {
  AdminV4AuditLogEntry,
  AdminV4CacheEntry,
  FirstEventsCredentials,
  appendAdminV4AuditLogEntry,
  clearTbaApiKey,
  clearFirstEventsCredentials,
  getPowerCoinBalance,
  listAdminV4AuditLogEntries,
  listAdminV4CacheEntries,
  listModelFeatureSnapshots,
  listPowerCoinBets,
  listPowerCoinLedger,
  listModelLabSnapshots,
  loadFirstEventsCredentials,
  loadLatestModelFeatureSnapshot,
  loadLatestModelLabSnapshot,
  loadLatestScoutAssignmentPlan,
  loadTbaApiKey,
  putAdminV4CacheEntry,
  restoreAdminV4CacheEntries,
  saveFirstEventsCredentials,
  saveModelFeatureSnapshot,
  saveModelLabSnapshot,
  saveScoutAssignmentPlan,
  saveTbaApiKey,
  upsertPowerCoinBet,
  upsertPowerCoinLedgerEntry
} from '../utils/adminV4LocalStore';
import {
  buildScoutArchiveBundle,
  getScoutArchiveUsername,
  importScoutArchiveBundleLocally,
  isScoutArchiveBundle,
  listScoutArchiveRecords,
  ScoutArchiveRecord
} from '../utils/scoutArchive';
import { syncScoutArchiveRecordToFirebase } from '../utils/scoutArchiveSync';
import {
  convertFirstEventsPayloadsToTbaMatches,
  convertFirstRankingsPayloadToTbaRankings,
  convertFirstTeamsPayloadToTeamNames,
  fetchAndCacheFirstEventBundle,
  getYearFromEventKey
} from '../utils/firstEventsApi';
import { fetchEventTeamsSimple, fetchPreMatchTeamProfile } from '../utils/preMatchScouting';
import { isMatchDefenseScoutingV1 } from '../utils/matchDefenseScouting';
import { isMatchScoutingV3, mapLegacyMatchScoutingToV3 } from '../utils/matchScoutingV3';
import { isMatchScoutingV4 } from '../utils/matchScoutingV4';
import { formatStrategyWinConditionForAlliance } from '../utils/adminV4StrategyCopy';
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
  buildTeamPerformanceProfiles
} from '../utils/strategyBrain';
import {
  buildMatchValidationGroups,
  filterMatchValidationGroups,
  getRowAnomalyLabel
} from '../utils/rawDataValidation';
import {
  AdminButton,
  AdminContextMenu,
  AdminInput,
  AdminSurface,
  AdminWorkflowItem
} from '../components/adminv4/AdminV4Primitives';
import {
  ADMIN_V4_STAT_INFO,
  AdminV4StatInfoDefinition,
  AdminV4StatInfoKey,
  getAdminV4StatInfo,
  statInfoKeyFromAdminV4Route
} from '../components/adminv4/AdminV4StatDefinitions';
import {
  ADMIN_V4_MODEL_LABELS as MODEL_LABELS,
  ModelToggleGroup,
  StatInfoButton
} from '../components/adminv4/AdminV4StatControls';
import type {
  AdminV4ChartRowBase,
  AdminV4PpaShapeChartRow,
  AdminV4ScalarChartRow
} from '../components/adminv4/AdminV4ChartTypes';
import { getRiskPillClass } from '../components/adminv4/AdminV4RiskPill';
import AdminV4StatWiki from '../components/adminv4/AdminV4StatWiki';
import {
  AdminEmptyState,
  EmbeddedPanelLoading,
  FocusHeader,
  MetricField,
  SummaryCard,
  TeamBadge,
  TeamList,
  getTeamBadgeClass
} from '../components/adminv4/AdminV4UiAtoms';
import { AdminV4CommandBar, type AdminV4CommandBrief } from '../components/adminv4/AdminV4CommandBar';
import AdminV4CommandPalette from '../components/adminv4/AdminV4CommandPalette';
import type {
  AdminV4VisualChartConfig,
  AdminV4VisualMetricKey
} from '../components/adminv4/AdminV4VisualizeWorkflow';
import type {
  AdminV4DataCard,
  AdminV4DataPriorityItem,
  AdminV4DataQuickNeed,
  AdminV4DataSignalRow
} from '../components/adminv4/AdminV4DataOverviewWorkflow';
import AdminV4BackupRestorePreviewModal, {
  AdminV4BackupRestoreCategory
} from '../components/adminv4/AdminV4BackupRestorePreviewModal';
import {
  AdminV4ActionConfirmationModal,
  AdminV4PowerCoinSettlementModal
} from '../components/adminv4/AdminV4SafetyModals';
import useAdminV4ActionConfirmation from '../components/adminv4/useAdminV4ActionConfirmation';
import useAdminV4ScrollMemory from '../components/adminv4/useAdminV4ScrollMemory';
import useAdminV4ScoutRewards from '../components/adminv4/useAdminV4ScoutRewards';
import useAdminV4ScoutIdentitySettings from '../components/adminv4/useAdminV4ScoutIdentitySettings';
import type { AdminV4SourceStatusRow } from '../components/adminv4/AdminV4SourceFreshnessPanel';
import AdminV4SettingsModal from '../components/adminv4/AdminV4SettingsModal';
import type {
  AdminV4TeamsDecisionCue,
  AdminV4SorterDirection,
  AdminV4SorterField,
  AdminV4TeamsRow
} from '../components/adminv4/AdminV4TeamsWorkflow';
import AdminV4NowWorkflow, {
  type AdminV4CompetitionPhase,
  type AdminV4CompetitionPhaseKey,
  type AdminV4CompetitionNeed,
  type AdminV4NowAction,
  type AdminV4NowAlert,
  type AdminV4NowMatchRow
} from '../components/adminv4/AdminV4NowWorkflow';
import type {
  AdminV4MatchForecastRow,
  AdminV4MatchesNextAction,
  AdminV4PlayedMatchRow
} from '../components/adminv4/AdminV4MatchesWorkflow';
import useAdminV4ManualSimulator from '../components/adminv4/useAdminV4ManualSimulator';
import {
  PpaAllianceBrief,
  PpaAllianceMiniReadout,
  PpaDecisionReadPanel,
  PpaInsightPanel,
  PpaMatchupReadout,
  PpaMiniShape
} from '../components/adminv4/AdminV4PpaPanels';
import type {
  AdminV4CollectionPipelineStage,
  AdminV4PpaReadinessCard
} from '../components/adminv4/AdminV4DataPipelinePanel';
import {
  AdminTaskPpaClosurePanel,
  TeamEvidenceCoveragePanel,
  TeamEvidenceTimelinePanel,
  TeamPerformanceProfilePanel
} from '../components/adminv4/AdminV4TeamEvidencePanels';
import {
  buildPpaInsights,
  summarizePpaAlliance,
  PpaRiskLevel
} from '../utils/ppaInsights';
import { SCOUTING_MISSIONS, SCOUTING_USE_MOMENTS, ScoutingMissionKey, ScoutingUseMomentKey, getMissionToneClasses } from '../utils/scoutingWorkflow';
import {
  buildScoutTaskHandoffPath,
  flattenScoutEvidenceAdminTaskForExport,
  getScoutEvidenceAdminTaskFromPayload,
  saveScoutTaskHandoff,
  ScoutTaskAlliance,
  ScoutTaskHandoff,
  ScoutTaskMatchType,
  ScoutTaskPpaContext
} from '../utils/scoutTaskHandoff';
import { CachedPreMatchSheet, getCachedPreMatchSheet, restoreCachedPreMatchSheet } from '../utils/preMatchCache';

type PredictorDisplayTab = AdminV4PredictorDisplayTab;
type ResultsDisplayTab = AdminV4ResultsDisplayTab;
type SorterField = AdminV4SorterField;
type SorterDirection = AdminV4SorterDirection;
type WorkflowTab = AdminV4WorkflowTab;
type VisualMetricKey = AdminV4VisualMetricKey;
type StatInfoKey = AdminV4StatInfoKey;
type DataPanel = AdminV4DataPanel;
type TeamHighlightKind = 'own' | 'searched' | 'both';
type MetricSurfaceKey = AdminV4MetricSurfaceKey;

type ChartRowBase = AdminV4ChartRowBase;
type ScalarChartRow = AdminV4ScalarChartRow;
type PpaShapeChartRow = AdminV4PpaShapeChartRow;

interface TbaEventSearchResult {
  key: string;
  name: string;
  short_name: string;
}

interface TeamMetricSummary {
  currentMetricLabel: string;
  currentMetricValue: number | null;
  autoComponent: number | null;
  teleopComponent: number | null;
  sourceLabel: string;
  extras: Array<{ label: string; value: string }>;
}

type AdminV4SorterRow = AdminV4TeamsRow;

interface TeamEvidenceStatus {
  teamNumber: string;
  matchRows: number;
  defenseRows: number;
  pitRows: number;
  preScoutRows: number;
  scoutConfidence: number;
  uncertainty: PpaRiskLevel;
  roleLabel: string;
  needsAttention: boolean;
  attentionReasons: string[];
}

interface TeamEvidenceTimelineItem {
  key: string;
  missionKey: ScoutingMissionKey;
  sourceLabel: string;
  title: string;
  subtitle: string;
  timestamp: number;
  signalLabel: string;
  signalValue: string;
  pills: string[];
  notes: string;
  adminTask?: ScoutEvidenceAdminTask;
}

interface ScoutWorkItem {
  id: string;
  teamNumber: string;
  teamName?: string;
  missionKey: ScoutingMissionKey;
  label: string;
  reason: string;
  detail: string;
  priority: number;
  context: string;
  matchKey?: string;
  matchType?: ScoutTaskMatchType;
  matchNumber?: number;
  alliance?: ScoutTaskAlliance;
  ppa?: ScoutTaskPpaContext;
}

type AdminV4RawEditorRecord = MatchScoutingV4 & { id: string };

type StatInfoDefinition = AdminV4StatInfoDefinition;

const STAT_INFO = ADMIN_V4_STAT_INFO;
const getStatInfo = getAdminV4StatInfo;
const statInfoKeyFromRoute = statInfoKeyFromAdminV4Route;
const COMPETITION_PHASE_STORAGE_KEY = 'adminv4_competition_phase';
const getStoredCompetitionPhase = (): AdminV4CompetitionPhaseKey => {
  if (typeof window === 'undefined') return 'practice';
  const stored = window.localStorage.getItem(COMPETITION_PHASE_STORAGE_KEY);
  return stored === 'practice' || stored === 'qualifications' || stored === 'selection' ? stored : 'practice';
};

const sanitizeTeamNumber = sanitizeAdminV4TeamNumber;

const normalizeTeamSearchText = normalizeAdminV4TeamSearchText;

export default function AdminV4View() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialRouteSearch = useMemo(() => new URLSearchParams(location.search), []);
  const initialRouteTab = (initialRouteSearch.get('tab') || '').trim().toLowerCase();
  const initialRouteIsWiki = initialRouteTab === 'wiki';
  const initialRouteWorkflow = initialRouteIsWiki ? null : workflowFromAdminRouteTab(initialRouteSearch.get('tab'));
  const initialRouteDataPanel = dataPanelFromAdminRouteParam(initialRouteSearch.get('panel'));
  const initialRouteMode = initialRouteSearch.get('mode');
  const initialRouteMatchKey = initialRouteSearch.get('match') || '';
  const initialRouteTeamNumber = sanitizeTeamNumber(initialRouteSearch.get('team') || '');
  const initialRouteWikiReturnTab = adminReturnTabFromRouteParam(initialRouteSearch.get('from'));
  const initialRouteTeamReturnTab = teamReturnTabFromRouteParam(initialRouteSearch.get('from'));
  const initialRouteActiveTab: AdminV4Tab =
    initialRouteIsWiki
      ? 'wiki'
      : initialRouteWorkflow === 'sorter' && initialRouteTeamNumber
        ? 'teams'
      : initialRouteWorkflow === 'predictor' && initialRouteMode === 'simulator'
      ? 'simulator'
      : initialRouteWorkflow ?? 'command';
  const initialSettings = useMemo(() => loadAdminV4Settings(), []);
  const [settings, setSettings] = useState<AdminV4Settings>(initialSettings);
  const [teamSearchInput, setTeamSearchInput] = useState('');
  const [teamSearchError, setTeamSearchError] = useState('');
  const [isTeamSearchOpen, setIsTeamSearchOpen] = useState(false);
  const smartSearchInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement>(null);
  const [commandPaletteInput, setCommandPaletteInput] = useState('');
  const [commandPaletteError, setCommandPaletteError] = useState('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [moreWorkflowMenuOpen, setMoreWorkflowMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminV4Tab>(initialRouteActiveTab);
  const [competitionPhase, setCompetitionPhase] = useState<AdminV4CompetitionPhaseKey>(() => getStoredCompetitionPhase());
  const [predictorViewTab, setPredictorViewTab] = useState<PredictorDisplayTab>('ranking');
  const [resultsViewTab, setResultsViewTab] = useState<ResultsDisplayTab>('quals');
  const [rawEditorViewTab, setRawEditorViewTab] = useState<ResultsDisplayTab>('quals');
  const [rawEditorSearch, setRawEditorSearch] = useState('');
  const [sorterField, setSorterField] = useState<SorterField>('ppa');
  const [sorterDirection, setSorterDirection] = useState<SorterDirection>('desc');
  const [teamsAdvancedStats, setTeamsAdvancedStats] = useState(false);
  const [teamsMetric, setTeamsMetric] = useState<AdminV4SelectedMetric>(initialSettings.selectedMetric || 'ppa');
  const [matchesMetric, setMatchesMetric] = useState<AdminV4SelectedMetric>('ppa');
  const [simulatorMetric, setSimulatorMetric] = useState<AdminV4SelectedMetric>('ppa');
  const [reportsMetric, setReportsMetric] = useState<AdminV4SelectedMetric>('ppa');
  const [reportsSpotlightPackKey, setReportsSpotlightPackKey] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localTbaApiKey, setLocalTbaApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [wikiStatKey, setWikiStatKey] = useState<StatInfoKey>(initialRouteIsWiki ? statInfoKeyFromRoute(initialRouteSearch.get('stat')) : 'ppa');
  const [wikiReturnTab, setWikiReturnTab] = useState<AdminV4Tab>(initialRouteIsWiki ? initialRouteWikiReturnTab : 'command');
  const [infoMenu, setInfoMenu] = useState<{ x: number; y: number; statKey: StatInfoKey } | null>(null);
  const [visualMetricKeys, setVisualMetricKeys] = useState<VisualMetricKey[]>(['ppa', 'ppaFloor', 'ppaTailRisk', 'defense']);
  const [visualAdvancedPickerOpen, setVisualAdvancedPickerOpen] = useState(false);
  const [dataPanel, setDataPanel] = useState<DataPanel | null>(initialRouteWorkflow === 'import' ? initialRouteDataPanel : null);
  const [selectedMatchKey, setSelectedMatchKey] = useState(
    initialRouteWorkflow === 'predictor'
      || initialRouteIsWiki
      || (initialRouteWorkflow === 'sorter' && initialRouteTeamReturnTab === 'predictor')
      ? initialRouteMatchKey
      : ''
  );
  const [drilldownTeamNumber, setDrilldownTeamNumber] = useState((initialRouteIsWiki || initialRouteWorkflow === 'sorter') ? initialRouteTeamNumber : '');
  const [drilldownFromTab, setDrilldownFromTab] = useState<AdminV4Tab>(initialRouteTeamReturnTab);
  const [allianceSeed, setAllianceSeed] = useState(1);
  const [alliancePickStatuses, setAlliancePickStatuses] = useState<AdminV4PickStatusMap>({});
  const [pickListMeetingMode, setPickListMeetingMode] = useState(true);
  const [pickStatusUndo, setPickStatusUndo] = useState<{
    teamNumber: string;
    previous?: AdminV4PickStatusMap[string];
    next?: AdminV4PickStatusMap[string];
  } | null>(null);
  const [pickListLoadedFor, setPickListLoadedFor] = useState('');
  const [sourceRecords, setSourceRecords] = useState<MatchScoutingV3[]>([]);
  const [sourceV4Records, setSourceV4Records] = useState<MatchScoutingV4[]>([]);
  const [sourceDefenseRecords, setSourceDefenseRecords] = useState<MatchDefenseScoutingV1[]>([]);
  const [sourceLiveEventMatches, setSourceLiveEventMatches] = useState<TBAMatch[]>([]);
  const [alliances, setAlliances] = useState<TBAEliminationAlliance[] | null>(null);
  const [eventSummary, setEventSummary] = useState<TBAEventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [liveScheduleUnavailable, setLiveScheduleUnavailable] = useState('');
  const [matchSourceLabel, setMatchSourceLabel] = useState('');
  const [currentTbaRanks, setCurrentTbaRanks] = useState<Record<string, number>>({});
  const [currentTbaRankOrder, setCurrentTbaRankOrder] = useState<string[]>([]);
  const [searchYear, setSearchYear] = useState(new Date().getFullYear().toString());
  const [searchResults, setSearchResults] = useState<TbaEventSearchResult[]>([]);
  const [isSearchingEvents, setIsSearchingEvents] = useState(false);
  const [uploadedCsvPack, setUploadedCsvPack] = useState<UploadedTbaCsvPack | null>(() =>
    loadUploadedTbaCsvPack(initialSettings.testModeEnabled ? initialSettings.testModeEventKey : initialSettings.eventKey)
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
  const [backupImportPreview, setBackupImportPreview] = useState<BackupImportPreview | null>(null);
  const [backupImportOptions, setBackupImportOptions] = useState<BackupImportOptions>(() => ({ ...DEFAULT_BACKUP_IMPORT_OPTIONS }));
  const [localArchiveRecords, setLocalArchiveRecords] = useState<ScoutArchiveRecord[]>([]);
  const [localArchiveError, setLocalArchiveError] = useState('');
  const [isLocalArchiveSyncing, setIsLocalArchiveSyncing] = useState(false);
  const [localArchiveSyncStatus, setLocalArchiveSyncStatus] = useState('');
  const [adminAuditLogEntries, setAdminAuditLogEntries] = useState<AdminV4AuditLogEntry[]>([]);
  const [adminAuditLogError, setAdminAuditLogError] = useState('');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [adminV4CacheEntries, setAdminV4CacheEntries] = useState<AdminV4CacheEntry[]>([]);
  const [adminV4CacheError, setAdminV4CacheError] = useState('');
  const [preMatchCache, setPreMatchCache] = useState<CachedPreMatchSheet | null>(null);
  const [latestModelSnapshot, setLatestModelSnapshot] = useState<ModelLabSnapshot | null>(null);
  const [latestFeatureSnapshot, setLatestFeatureSnapshot] = useState<ModelFeatureSnapshot | null>(null);
  const [modelSnapshotStatus, setModelSnapshotStatus] = useState('');
  const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';
  const isLocalTestModeFixture = useMemo(
    () => isLocalMode && new URLSearchParams(location.search).get('fixture') === 'test-mode',
    [isLocalMode, location.search]
  );
  const refreshSequenceRef = useRef(0);
  const tabRefreshCooldownRef = useRef<Record<string, number>>({});
  const pendingBackgroundRefreshTabRef = useRef<WorkflowTab | null>(null);

  const normalEventKey = settings.eventKey;
  const eventKey = settings.testModeEnabled ? settings.testModeEventKey || settings.eventKey : settings.eventKey;
  const activeMetricSurface = metricSurfaceFromTab(activeTab);
  const selectedMetric =
    activeMetricSurface === 'teams'
      ? teamsMetric
      : activeMetricSurface === 'matches'
        ? matchesMetric
        : activeMetricSurface === 'simulator'
          ? simulatorMetric
          : activeMetricSurface === 'reports'
          ? reportsMetric
          : settings.selectedMetric;

  const {
    actionConfirmation,
    requestActionConfirmation: requestAdminActionConfirmation,
    cancelActionConfirmation,
    confirmActionConfirmation
  } = useAdminV4ActionConfirmation();
  const {
    handleCopyScoutIdentityPassphrase,
    handleSaveScoutIdentityPassphrase,
    scoutIdentityHash,
    scoutIdentityPassphrase,
    scoutIdentityStatus,
    setScoutIdentityPassphrase
  } = useAdminV4ScoutIdentitySettings(settingsOpen);
  const ownTeamNumber = settings.ownTeamNumber;
  const searchedTeamNumber = settings.searchedTeamNumber;
  const effectiveTbaApiKey = localTbaApiKey || TBA_API_KEY;
  const hasLocalTbaApiKey = localTbaApiKey.trim().length > 0;

  useEffect(() => {
    if (!isLocalTestModeFixture) return;
    const fixture = buildLocalAdminV4TestModeFixture();
    setSettings(prev => ({
      ...prev,
      eventKey: fixture.eventKey,
      ownTeamNumber: fixture.ownTeamNumber,
      searchedTeamNumber: fixture.searchedTeamNumber,
      selectedMetric: 'ppa',
      testModeEnabled: true,
      testModeEventKey: fixture.eventKey,
      testModeMatchKey: fixture.matchKey
    }));
  }, [isLocalTestModeFixture]);

  const activeViewScrollKey = useMemo(() => {
    if (activeTab === 'teams') return drilldownTeamNumber ? `teams:detail:${drilldownTeamNumber}` : `teams:list:${sorterField}:${sorterDirection}`;
    if (activeTab === 'sorter') return `teams:list:${sorterField}:${sorterDirection}`;
    if (activeTab === 'predictor') return selectedMatchKey ? `matches:detail:${selectedMatchKey}` : `matches:list:${predictorViewTab}`;
    if (activeTab === 'simulator') return 'matches:manual-simulator';
    if (activeTab === 'import') return dataPanel ? `data:${dataPanel}` : 'data:overview';
    if (activeTab === 'rawEditor') return `data:raw-editor:${rawEditorViewTab}`;
    if (activeTab === 'results') return `matches:results:${resultsViewTab}`;
    if (activeTab === 'wiki') return `wiki:${wikiStatKey}:${wikiReturnTab}`;
    return activeTab;
  }, [
    activeTab,
    dataPanel,
    drilldownTeamNumber,
    predictorViewTab,
    rawEditorViewTab,
    resultsViewTab,
    selectedMatchKey,
    sorterDirection,
    sorterField,
    wikiReturnTab,
    wikiStatKey
  ]);
  const { mainScrollRef, rememberMainScroll, createScrollSnapshot } = useAdminV4ScrollMemory(activeViewScrollKey);

  useEffect(() => {
    const routeParams = new URLSearchParams(location.search);
    const routeTab = (routeParams.get('tab') || '').trim().toLowerCase();
    if (routeTab === 'wiki') {
      setActiveTab('wiki');
      setWikiStatKey(statInfoKeyFromRoute(routeParams.get('stat')));
      setWikiReturnTab(adminReturnTabFromRouteParam(routeParams.get('from')));
      setSelectedMatchKey(routeParams.get('match') || '');
      setDrilldownTeamNumber(sanitizeTeamNumber(routeParams.get('team') || ''));
      setInfoMenu(null);
      setDataPanel(null);
      return;
    }

    const routeWorkflow = workflowFromAdminRouteTab(routeParams.get('tab'));
    if (!routeWorkflow) return;
    const routeMode = routeParams.get('mode');
    const routeMatchKey = routeParams.get('match') || '';
    const routeTeamNumber = sanitizeTeamNumber(routeParams.get('team') || '');
    const routeTeamReturnTab = teamReturnTabFromRouteParam(routeParams.get('from'));
    const routeActiveTab: AdminV4Tab =
      routeWorkflow === 'sorter' && routeTeamNumber
        ? 'teams'
        : routeWorkflow === 'predictor' && routeMode === 'simulator'
          ? 'simulator'
          : routeWorkflow;

    setActiveTab(routeActiveTab);
    setDrilldownTeamNumber(routeWorkflow === 'sorter' ? routeTeamNumber : '');
    setDrilldownFromTab(routeWorkflow === 'sorter' ? routeTeamReturnTab : 'sorter');
    setSelectedMatchKey(
      routeWorkflow === 'predictor' && routeMode !== 'simulator'
        ? routeMatchKey
        : routeWorkflow === 'sorter' && routeTeamReturnTab === 'predictor'
          ? routeMatchKey
          : ''
    );
    setInfoMenu(null);
    setDataPanel(routeWorkflow === 'import' ? dataPanelFromAdminRouteParam(routeParams.get('panel')) : null);
  }, [location.search]);

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

  const refreshLocalArchiveRecords = useCallback(async () => {
    if (isLocalTestModeFixture) {
      setLocalArchiveRecords([]);
      setLocalArchiveError('');
      return;
    }
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
        setSourceRecords(sortScoutRowsByMatchThenTeam(archivedMatchRows));
        setSourceV4Records(sortScoutRowsByMatchThenTeam(
          activeArchiveRecords
            .filter(record => record.recordType === 'matchV4' && isMatchScoutingV4(record.payload))
            .map(record => record.payload as MatchScoutingV4)
        ));
        setSourceDefenseRecords(sortScoutRowsByMatchThenTeam(
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
  }, [eventKey, isLocalMode, isLocalTestModeFixture]);

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

  const refreshAdminV4CacheEntries = useCallback(async () => {
    try {
      const entries = await listAdminV4CacheEntries(eventKey);
      setAdminV4CacheEntries(entries);
      setAdminV4CacheError('');
    } catch (cacheError) {
      console.error('Failed to read Admin V4 cache entries', cacheError);
      setAdminV4CacheEntries([]);
      setAdminV4CacheError('Unable to read Admin V4 source cache from this device.');
    }
  }, [eventKey]);

  const refreshAdminAuditLogEntries = useCallback(async () => {
    try {
      const entries = await listAdminV4AuditLogEntries(eventKey);
      setAdminAuditLogEntries(entries.slice(0, 12));
      setAdminAuditLogError('');
    } catch (auditError) {
      console.error('Failed to read Admin V4 audit log', auditError);
      setAdminAuditLogEntries([]);
      setAdminAuditLogError('Unable to read local admin operation log from this device.');
    }
  }, [eventKey]);

  const recordAdminAudit = useCallback(async (
    action: string,
    detail: string,
    severity: AdminV4AuditLogEntry['severity'] = 'info'
  ) => {
    try {
      await appendAdminV4AuditLogEntry({ eventKey, action, detail, severity });
      await refreshAdminAuditLogEntries();
    } catch (auditError) {
      console.error('Failed to append Admin V4 audit log entry', auditError);
      setAdminAuditLogError('Admin action finished, but this device could not write the local operation log.');
    }
  }, [eventKey, refreshAdminAuditLogEntries]);

  const refreshPreMatchCache = useCallback(async () => {
    const sheet = await getCachedPreMatchSheet(eventKey).catch(() => null);
    setPreMatchCache(sheet);
  }, [eventKey]);

  const preScoutAdminTaskEvidence = useMemo(() => preMatchCache?.adminTaskEvidence || [], [preMatchCache?.adminTaskEvidence]);
  const preScoutEvidenceTeamCount = useMemo(
    () => new Set(preScoutAdminTaskEvidence.map(evidence => evidence.teamNumber)).size,
    [preScoutAdminTaskEvidence]
  );
  const latestPreScoutEvidenceTimestamp = useMemo(
    () => preScoutAdminTaskEvidence.reduce((latest, evidence) => Math.max(latest, evidence.capturedAt || evidence.task.capturedAt || 0), 0),
    [preScoutAdminTaskEvidence]
  );

  const sourceStatusRows = useMemo<AdminV4SourceStatusRow[]>(() => {
    const cacheRows = adminV4CacheEntries.map(entry => ({
      id: entry.id,
      source: entry.source,
      key: entry.key,
      detail: describeCachedPayload(entry.payload),
      timestamp: entry.timestamp
    }));
    const preScoutRows: AdminV4SourceStatusRow[] = [];
    if (preMatchCache) {
      preScoutRows.push({
          id: `pre-scout-cache:${preMatchCache.eventKey}`,
          source: 'Pre Scout',
          key: 'public-profile-cache',
          detail: `${preMatchCache.profiles.length} public team profile${preMatchCache.profiles.length === 1 ? '' : 's'} cached for before-event context`,
          timestamp: preMatchCache.cachedAt
      });
    }
    if (preScoutAdminTaskEvidence.length > 0) {
      preScoutRows.push({
        id: `pre-scout-evidence:${eventKey}`,
        source: 'Pre Scout',
        key: 'admin-task-evidence',
        detail: `${preScoutAdminTaskEvidence.length} returned Pre Scout task${preScoutAdminTaskEvidence.length === 1 ? '' : 's'} across ${preScoutEvidenceTeamCount} team${preScoutEvidenceTeamCount === 1 ? '' : 's'}`,
        timestamp: latestPreScoutEvidenceTimestamp
      });
    }

    const uploadedRows: AdminV4SourceStatusRow[] = [];
    if (uploadedCsvPack?.coprs) {
      uploadedRows.push({
        id: `upload:${uploadedCsvPack.coprs.fileName}`,
        source: 'Upload',
        key: 'coprs',
        detail: `${Object.keys(uploadedCsvPack.coprs.ratings).length} official rating${Object.keys(uploadedCsvPack.coprs.ratings).length === 1 ? '' : 's'}`,
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

    return [...preScoutRows, ...cacheRows, ...uploadedRows].sort((left, right) => right.timestamp - left.timestamp);
  }, [adminV4CacheEntries, eventKey, latestPreScoutEvidenceTimestamp, preMatchCache, preScoutAdminTaskEvidence.length, preScoutEvidenceTeamCount, uploadedCsvPack]);

  const sourceStatusSummary = useMemo(() => {
    const latestTimestamp = sourceStatusRows.reduce((latest, row) => Math.max(latest, row.timestamp || 0), 0);
    const uniqueSources = new Set(sourceStatusRows.map(row => row.source)).size;
    return {
      latestTimestamp,
      uniqueSources,
      rowCount: sourceStatusRows.length
    };
  }, [sourceStatusRows]);

  const backupImportCategories = useMemo<AdminV4BackupRestoreCategory[]>(() => {
    if (!backupImportPreview) return [];
    return (Object.keys(BACKUP_IMPORT_CATEGORY_COPY) as BackupImportCategory[]).map(category => ({
      key: category,
      label: BACKUP_IMPORT_CATEGORY_COPY[category].label,
      impact: BACKUP_IMPORT_CATEGORY_COPY[category].impact,
      count: countBackupImportCategory(backupImportPreview.backup, backupImportPreview.payload, category),
      selected: backupImportOptions[category]
    }));
  }, [backupImportOptions, backupImportPreview]);

  const updateSettings = (patch: Partial<AdminV4Settings>) => {
    setSettings(previous => ({
      ...previous,
      ...patch
    }));
  };

  useEffect(() => {
    saveAdminV4Settings(settings);
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(COMPETITION_PHASE_STORAGE_KEY, competitionPhase);
  }, [competitionPhase]);

  useEffect(() => {
    void refreshLocalArchiveRecords();
  }, [refreshLocalArchiveRecords]);

  useEffect(() => {
    void refreshAdminV4CacheEntries();
  }, [refreshAdminV4CacheEntries]);

  useEffect(() => {
    void refreshAdminAuditLogEntries();
  }, [refreshAdminAuditLogEntries]);

  useEffect(() => {
    void refreshPreMatchCache();
  }, [refreshPreMatchCache]);

  useEffect(() => {
    setUploadedCsvPack(loadUploadedTbaCsvPack(eventKey));
    setCsvMessages([]);
    setCsvError('');
  }, [eventKey]);

  useEffect(() => {
    if (teamSearchError) {
      setTeamSearchError('');
    }
  }, [eventKey, teamSearchInput]);

  const openCommandPalette = useCallback(() => {
      setTeamSearchError('');
      setCommandPaletteInput('');
      setCommandPaletteError('');
      setIsTeamSearchOpen(false);
      setCommandPaletteOpen(true);
      window.requestAnimationFrame(() => {
        commandPaletteInputRef.current?.focus();
        commandPaletteInputRef.current?.select();
      });
  }, []);

  useEffect(() => {
    const isEditableShortcutTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    };

    const handleSmartSearchShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openCommandPalette();
        return;
      }

      if (
        event.key === '/'
        && !event.metaKey
        && !event.ctrlKey
        && !event.altKey
        && !event.shiftKey
        && !isEditableShortcutTarget(event.target)
      ) {
        event.preventDefault();
        setTeamSearchError('');
        setIsTeamSearchOpen(true);
        smartSearchInputRef.current?.focus();
        smartSearchInputRef.current?.select();
      }
    };

    window.addEventListener('keydown', handleSmartSearchShortcut);
    return () => window.removeEventListener('keydown', handleSmartSearchShortcut);
  }, [openCommandPalette]);

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
    const isBackgroundRefresh = Boolean(options.background);
    const refreshStartedAt = Date.now();
    const refreshId = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = refreshId;
    const scrollSnapshot = createScrollSnapshot(options.preserveScroll);
    const isLatestRefresh = () => refreshSequenceRef.current === refreshId;

    if (isBackgroundRefresh) {
      setBackgroundRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');
    if (!isBackgroundRefresh) {
      setLiveScheduleUnavailable('');
      setMatchSourceLabel('');
    }
    const cacheYear = getYearFromEventKey(eventKey);

    try {
      if (isLocalTestModeFixture) {
        if (isBackgroundRefresh) {
          await new Promise(resolve => window.setTimeout(resolve, 200));
          if (!isLatestRefresh()) return;
        }
        const fixture = buildLocalAdminV4TestModeFixture();
        setSourceLiveEventMatches(fixture.matches);
        setSourceRecords(sortScoutRowsByMatchThenTeam(fixture.records));
        setSourceV4Records(sortScoutRowsByMatchThenTeam(fixture.v4Records));
        setSourceDefenseRecords(sortScoutRowsByMatchThenTeam(fixture.defenseRecords));
        setCachedFirstTeamNames(fixture.teamNames);
        setCurrentTbaRanks({});
        setCurrentTbaRankOrder([]);
        setAlliances(null);
        setEventSummary(null);
        setAdminV4CacheEntries([]);
        setAdminV4CacheError('');
        setMatchSourceLabel('Local Test Mode verification fixture');
        setLiveScheduleUnavailable('');
        return;
      }

      const cachedEntries = await listAdminV4CacheEntries(eventKey).catch(() => []);
      if (!isLatestRefresh()) return;
      setAdminV4CacheEntries(cachedEntries);
      setAdminV4CacheError('');
      const cachedFirebaseV3Payload = getLatestAdminV4CachePayload<unknown>(cachedEntries, 'Firebase', 'matchScoutingV3');
      const cachedFirebaseV4Payload = getLatestAdminV4CachePayload<unknown>(cachedEntries, 'Firebase', 'matchScoutingV4');
      const cachedFirebaseDefensePayload = getLatestAdminV4CachePayload<unknown>(cachedEntries, 'Firebase', 'matchScoutingDefense');
      const cachedMatchesPayload = getLatestAdminV4CachePayload<unknown>(cachedEntries, 'TBA', 'matches');
      const cachedRankingsPayload = getLatestAdminV4CachePayload<unknown>(cachedEntries, 'TBA', 'rankings');
      const cachedAlliancesPayload = getLatestAdminV4CachePayload<unknown>(cachedEntries, 'TBA', 'alliances');
      const cachedEventSummaryPayload = getLatestAdminV4CachePayload<unknown>(cachedEntries, 'TBA', 'event-summary');
      const cachedTbaTeamsPayload = getLatestAdminV4CachePayload<unknown>(cachedEntries, 'TBA', 'teams-simple');
      const cachedTbaTeamNames = isCachedEventTeamRoster(cachedTbaTeamsPayload) ? teamRosterToNameLookup(cachedTbaTeamsPayload) : {};
      const cachedFirstTeamNamesFromPayload = convertFirstTeamsPayloadToTeamNames(
        getLatestAdminV4CachePayload<unknown>(cachedEntries, 'FIRST', 'teams')
      );
      const cachedFirstRankings = convertFirstRankingsPayloadToTbaRankings(
        getLatestAdminV4CachePayload<unknown>(cachedEntries, 'FIRST', 'rankings')
      );
      setCachedFirstTeamNames({
        ...cachedTbaTeamNames,
        ...cachedFirstTeamNamesFromPayload
      });
      const cachedFirstMatches = convertFirstEventsPayloadsToTbaMatches(eventKey, [
        { payload: getLatestAdminV4CachePayload<unknown>(cachedEntries, 'FIRST', 'practice-schedule'), fallbackCompLevel: 'pm' },
        { payload: getLatestAdminV4CachePayload<unknown>(cachedEntries, 'FIRST', 'qual-schedule'), fallbackCompLevel: 'qm' },
        { payload: getLatestAdminV4CachePayload<unknown>(cachedEntries, 'FIRST', 'qual-matches'), fallbackCompLevel: 'qm' },
        { payload: getLatestAdminV4CachePayload<unknown>(cachedEntries, 'FIRST', 'playoff-matches'), fallbackCompLevel: 'sf' }
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
          setSourceRecords(sortScoutRowsByMatchThenTeam(cachedFirebaseV3Payload));
        }
        if (isCachedMatchScoutingV4Rows(cachedFirebaseV4Payload)) {
          setSourceV4Records(sortScoutRowsByMatchThenTeam(cachedFirebaseV4Payload));
        }
        if (isCachedDefenseRows(cachedFirebaseDefensePayload)) {
          setSourceDefenseRecords(sortScoutRowsByMatchThenTeam(cachedFirebaseDefensePayload));
        }
      }
      if (cachedMatches.length > 0) {
        setSourceLiveEventMatches(cachedMatches);
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
          console.error(`Failed to load Firebase collection ${collectionNames[index]} for Admin V4`, result.reason);
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
        setSourceRecords(nextRecords);
        setSourceV4Records(nextV4Records);
        setSourceDefenseRecords(nextDefenseRecords);
        void Promise.allSettled([
          putAdminV4CacheEntry({
            eventKey,
            year: cacheYear,
            source: 'Firebase',
            key: 'matchScoutingLegacyMapped',
            payload: legacyRecords
          }),
          putAdminV4CacheEntry({
            eventKey,
            year: cacheYear,
            source: 'Firebase',
            key: 'matchScoutingV3',
            payload: nextRecords
          }),
          putAdminV4CacheEntry({
            eventKey,
            year: cacheYear,
            source: 'Firebase',
            key: 'matchScoutingV4',
            payload: nextV4Records
          }),
          putAdminV4CacheEntry({
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
        if (cachedMatches.length > 0 || !isBackgroundRefresh) setSourceLiveEventMatches(cachedMatches);
        if (cachedAlliances || !isBackgroundRefresh) setAlliances(cachedAlliances);
        if (cachedEventSummary || !isBackgroundRefresh) setEventSummary(cachedEventSummary);
        if (cachedRankings || !isBackgroundRefresh) applyRankings(cachedRankings);
        if (cachedMatches.length > 0) {
          setMatchSourceLabel('Cached TBA/FIRST match data');
          setLiveScheduleUnavailable('Live TBA is unavailable, so Admin V4 is using the latest cached TBA/FIRST match data from IndexedDB.');
        }
        return;
      }

      const engine = new MathEngine(effectiveTbaApiKey);
      const normalizedEventKey = eventKey.trim().toLowerCase();

      const [matchesResult, rankingsResult, alliancesResult, summaryResult, teamsResult] = await Promise.allSettled([
        engine.fetchEventMatches(eventKey, { includeUnplayed: true }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/rankings`, {
          headers: { 'X-TBA-Auth-Key': effectiveTbaApiKey }
        }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/alliances`, {
          headers: { 'X-TBA-Auth-Key': effectiveTbaApiKey }
        }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/simple`, {
          headers: { 'X-TBA-Auth-Key': effectiveTbaApiKey }
        }),
        fetchEventTeamsSimple(eventKey, effectiveTbaApiKey)
      ]);
      if (!isLatestRefresh()) return;

      if (matchesResult.status === 'fulfilled') {
        setSourceLiveEventMatches(matchesResult.value);
        setMatchSourceLabel('Live TBA schedule');
        void putAdminV4CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'matches',
          payload: matchesResult.value
        }).catch(() => {});
      } else {
        console.error('Failed to load live TBA schedule for Admin V4', matchesResult.reason);
        if (cachedMatches.length > 0 || !isBackgroundRefresh) {
          setSourceLiveEventMatches(cachedMatches);
        }
        if (cachedMatches.length > 0) {
          setMatchSourceLabel('Cached TBA/FIRST match data');
        }
        if (!isBackgroundRefresh) {
          setLiveScheduleUnavailable(
            cachedMatches.length > 0
              ? `Live TBA schedule is unavailable, using ${cachedMatches.length} cached TBA/FIRST match rows from IndexedDB.`
              : matchesResult.reason instanceof Error
                ? matchesResult.reason.message
                : 'Live TBA schedule is unavailable right now.'
          );
        }
      }

      if (rankingsResult.status === 'fulfilled' && rankingsResult.value.ok) {
        const rankings = (await rankingsResult.value.json()) as TbaRankingsResponse;
        applyRankings(rankings);
        void putAdminV4CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'rankings',
          payload: rankings
        }).catch(() => {});
      } else if (cachedRankings || !isBackgroundRefresh) {
        applyRankings(cachedRankings);
      }

      if (alliancesResult.status === 'fulfilled' && alliancesResult.value.ok) {
        const nextAlliances = (await alliancesResult.value.json()) as any;
        setAlliances(nextAlliances);
        void putAdminV4CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'alliances',
          payload: nextAlliances
        }).catch(() => {});
      } else if (cachedAlliances || !isBackgroundRefresh) {
        setAlliances(cachedAlliances);
      }

      if (summaryResult.status === 'fulfilled' && summaryResult.value.ok) {
        const nextEventSummary = await summaryResult.value.json();
        setEventSummary(nextEventSummary);
        void putAdminV4CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'event-summary',
          payload: nextEventSummary
        }).catch(() => {});
      } else if (cachedEventSummary || !isBackgroundRefresh) {
        setEventSummary(cachedEventSummary);
      }

      if (teamsResult.status === 'fulfilled') {
        const nextTbaTeamNames = teamRosterToNameLookup(teamsResult.value);
        setCachedFirstTeamNames(prev => ({
          ...prev,
          ...nextTbaTeamNames
        }));
        void putAdminV4CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'teams-simple',
          payload: teamsResult.value
        }).catch(() => {});
      } else if (Object.keys(cachedTbaTeamNames).length === 0 && !isBackgroundRefresh) {
        console.warn('Failed to load live TBA team names for Admin V4 search', teamsResult.reason);
      }
    } catch (loadError) {
      console.error('Failed to load Admin V4 data', loadError);
      if (isLatestRefresh() && !isBackgroundRefresh) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load Admin V4 data.');
      }
    } finally {
      if (isBackgroundRefresh) {
        const minimumRefreshSignalMs = 800;
        const remainingRefreshSignalMs = Math.max(0, minimumRefreshSignalMs - (Date.now() - refreshStartedAt));
        if (remainingRefreshSignalMs > 0) {
          await new Promise(resolve => window.setTimeout(resolve, remainingRefreshSignalMs));
        }
        setBackgroundRefreshing(false);
      }
      if (isLatestRefresh()) {
        if (!isBackgroundRefresh) {
          setLoading(false);
        }
        scrollSnapshot.restore();
      }
    }
  };

  useEffect(() => {
    void loadV3Data();
  }, [eventKey, effectiveTbaApiKey, isLocalTestModeFixture]);

  const searchEvents = async () => {
    if (!effectiveTbaApiKey) {
      setError(TBA_KEY_MISSING_MESSAGE);
      return;
    }

    setIsSearchingEvents(true);
    setError('');

    try {
      const response = await fetch(`https://www.thebluealliance.com/api/v3/events/${searchYear}`, {
        headers: { 'X-TBA-Auth-Key': effectiveTbaApiKey }
      });
      if (!response.ok) {
        throw buildTbaHttpError('TBA events', response.status, response.statusText, await response.text());
      }
      setSearchResults((await response.json()) as TbaEventSearchResult[]);
    } catch (searchError) {
      console.error(searchError);
      setError(isTbaAuthError(searchError)
        ? getTbaUserFacingError(searchError)
        : searchError instanceof Error
          ? `Error searching events: ${searchError.message}`
          : 'Error searching events.');
    } finally {
      setIsSearchingEvents(false);
    }
  };

  const uploadedScheduleFallback = useMemo(() => getPreferredUploadedSchedule(uploadedCsvPack), [uploadedCsvPack]);
  const sourcePredictorMatches = useMemo(
    () => (sourceLiveEventMatches.length > 0 ? sourceLiveEventMatches : uploadedScheduleFallback?.matches || []),
    [sourceLiveEventMatches, uploadedScheduleFallback]
  );
  const testModeMatchOptions = useMemo(
    () => sortAdminV4MatchesForTestMode(sourcePredictorMatches),
    [sourcePredictorMatches]
  );
  const testModeScope = useMemo(
    () =>
      buildAdminV4TestModeScope({
        enabled: settings.testModeEnabled,
        matchKey: settings.testModeMatchKey,
        matches: sourcePredictorMatches,
        records: sourceRecords,
        v4Records: sourceV4Records,
        defenseRecords: sourceDefenseRecords
      }),
    [
      settings.testModeEnabled,
      settings.testModeMatchKey,
      sourceDefenseRecords,
      sourcePredictorMatches,
      sourceRecords,
      sourceV4Records
    ]
  );
  const testModeActive = testModeScope.active;
  const testModeSelectedMatch = testModeScope.selectedMatch;
  const testModeSelectedMatchLabel = testModeScope.selectedMatchLabel;
  const records = testModeScope.records;
  const v4Records = testModeScope.v4Records;
  const defenseRecords = testModeScope.defenseRecords;
  const liveEventMatches = testModeScope.matches;

  const teamAverages = useMemo(() => buildTeamHistoricalAveragesV4Aware(records, v4Records), [records, v4Records]);
  const defenseMetrics = useMemo(() => buildTeamDefenseMetrics(defenseRecords), [defenseRecords]);
  const defenseMetricGuardrailSummary = useMemo(() => summarizeDefenseMetricGuardrails(defenseRecords), [defenseRecords]);
  const teamAverageLookupByTeam = useMemo(
    () => Object.fromEntries(teamAverages.map(row => [row.teamNumber, row])),
    [teamAverages]
  );
  const defenseMetricLookupByTeam = useMemo(
    () => Object.fromEntries(defenseMetrics.map(row => [row.teamNumber, row])),
    [defenseMetrics]
  );
  const averageLookup = useMemo(() => buildHistoricalAverageLookup(teamAverages), [teamAverages]);
  const effectiveCurrentTbaRanks = useMemo(
    () => (testModeActive ? {} : Object.keys(currentTbaRanks).length > 0 ? currentTbaRanks : uploadedCsvPack?.rankings?.rankings || {}),
    [currentTbaRanks, testModeActive, uploadedCsvPack]
  );
  const effectiveCurrentTbaRankOrder = useMemo(
    () => (testModeActive ? [] : currentTbaRankOrder.length > 0 ? currentTbaRankOrder : uploadedCsvPack?.rankings?.rankOrder || []),
    [currentTbaRankOrder, testModeActive, uploadedCsvPack]
  );
  const effectiveAlliances = useMemo(
    () => (testModeActive ? null : alliances && alliances.length > 0 ? alliances : uploadedCsvPack?.alliances?.alliances || null),
    [alliances, testModeActive, uploadedCsvPack]
  );
  const effectiveEventSummary = useMemo(
    () => eventSummary || uploadedCsvPack?.eventSummary?.eventSummary || null,
    [eventSummary, uploadedCsvPack]
  );
  const activePredictorMatches = liveEventMatches;
  const {
    confirmPowerCoinSettlement,
    handleExportScoutAssignmentsCsv,
    handleExportScoutCoverageGapsCsv,
    handleOptimizeScouts,
    handlePowerCoinAdjustment,
    handleSettleAllPlayedPowerCoins,
    handleSettlePowerCoins,
    powerCoinAdjustmentAmount,
    powerCoinAdjustmentReason,
    powerCoinAdjustmentScout,
    powerCoinBets,
    powerCoinLedger,
    powerCoinRows,
    powerCoinSettlementRequest,
    powerCoinStatus,
    refreshScoutOpsState,
    scoutAssignmentPlan,
    scoutControlStatus,
    scoutRosterText,
    setPowerCoinAdjustmentAmount,
    setPowerCoinAdjustmentReason,
    setPowerCoinAdjustmentScout,
    setPowerCoinSettlementRequest,
    setPowerCoinStatus,
    setScoutAssignmentPlan,
    setScoutRosterText
  } = useAdminV4ScoutRewards({
    activePredictorMatches,
    eventKey,
    ownTeamNumber,
    recordAdminAudit,
    requestAdminActionConfirmation
  });

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
          ...(preMatchCache?.profiles.map(profile => profile.teamNumber) || []),
          ...Object.keys(cachedFirstTeamNames),
          ...Object.keys(uploadedTeamNames),
          ...(searchedTeamNumber ? [searchedTeamNumber] : [])
        ])
      ).sort((left, right) => Number(left) - Number(right)),
    [cachedFirstTeamNames, defenseRecords, preMatchCache, predictorTeams, records, searchedTeamNumber, uploadedTeamNames, v4Records]
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

      if (settings.testModeEnabled) {
        if (!cancelled) {
          setEpaByTeam({});
          setMissingEpaTeams(predictorTeams);
          setEpaUnavailable('Live Statbotics EPA is disabled in Test Mode so future public updates cannot leak into the prediction rehearsal.');
          setIsEpaLoading(false);
        }
        return;
      }

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
        void putAdminV4CacheEntry({
          eventKey,
          year: getYearFromEventKey(eventKey),
          source: 'Statbotics',
          key: 'event-epa',
          payload: result
        })
          .then(() => refreshAdminV4CacheEntries())
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
  }, [eventKey, predictorTeams, refreshAdminV4CacheEntries, settings.testModeEnabled]);

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
        void putAdminV4CacheEntry({
          eventKey,
          year: getYearFromEventKey(eventKey),
          source: 'TBA',
          key: teamProfileCacheKey,
          payload: profile
        })
          .then(() => refreshAdminV4CacheEntries())
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
  }, [effectiveTbaApiKey, eventKey, refreshAdminV4CacheEntries, searchedTeamNumber]);

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

  const csvOprRatings = testModeActive ? {} : uploadedCsvPack?.coprs?.ratings || {};
  const csvOprBonusMetrics = testModeActive ? undefined : uploadedCsvPack?.coprs?.hasBonusMetrics ? uploadedCsvPack.coprs.bonusMetrics : undefined;
  const csvOprComponents = testModeActive ? {} : uploadedCsvPack?.coprs?.componentPoints || {};
  const calculatedOprRatings = useMemo(() => calculateLegacyOprRatings(activePredictorMatches), [activePredictorMatches]);
  const calculatedDprRatings = useMemo(() => calculateLegacyDprRatings(activePredictorMatches), [activePredictorMatches]);
  const activeOprRatings = Object.keys(csvOprRatings).length > 0 ? csvOprRatings : calculatedOprRatings;
  const missingOprTeams = useMemo(
    () => predictorTeams.filter(teamNumber => !(teamNumber in activeOprRatings)),
    [activeOprRatings, predictorTeams]
  );
  const isVisibleForecastPrediction = useCallback(
    (match: PredictedMatchV3) =>
      match.compLevel === 'qm' ||
      (competitionPhase === 'practice' && match.compLevel === 'pm') ||
      (testModeActive && match.key === settings.testModeMatchKey),
    [competitionPhase, settings.testModeMatchKey, testModeActive]
  );

  const ppcPredictions = useMemo(
    () => buildPredictedMatchesV3(activePredictorMatches, averageLookup).filter(isVisibleForecastPrediction),
    [activePredictorMatches, averageLookup, isVisibleForecastPrediction]
  );
  const epaPredictions = useMemo(
    () =>
      buildPredictedMatchesFromRatings(activePredictorMatches, {
        ratings: epaRatings,
        missingTeams: missingEpaTeams
      }).filter(isVisibleForecastPrediction),
    [activePredictorMatches, epaRatings, isVisibleForecastPrediction, missingEpaTeams]
  );
  const oprPredictions = useMemo(
    () =>
      buildPredictedMatchesFromRatings(activePredictorMatches, {
        ratings: activeOprRatings,
        missingTeams: missingOprTeams
      }).filter(isVisibleForecastPrediction),
    [activeOprRatings, activePredictorMatches, isVisibleForecastPrediction, missingOprTeams]
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
      ...Object.fromEntries((preMatchCache?.profiles || []).map(profile => [profile.teamNumber, profile.nickname])),
      ...cachedFirstTeamNames,
      ...uploadedTeamNames,
      ...(teamProfile ? { [teamProfile.teamNumber]: teamProfile.nickname } : {})
    }),
    [cachedFirstTeamNames, preMatchCache, teamProfile, uploadedTeamNames]
  );
  const getSmartSearchResults = (rawInput: string, limit = 8) =>
    getAdminV4SmartSearchSuggestions({
      rawInput,
      teamNumbers: allKnownTeams,
      teamNameLookup: resolvedTeamNameLookup,
      statInfo: STAT_INFO,
      limit
    });
  const teamSearchSuggestions = useMemo<AdminV4SmartSearchResult[]>(() => {
    return getSmartSearchResults(teamSearchInput);
  }, [allKnownTeams, resolvedTeamNameLookup, teamSearchInput]);
  const commandPaletteSuggestions = useMemo<AdminV4SmartSearchResult[]>(() => {
    return getSmartSearchResults(commandPaletteInput);
  }, [allKnownTeams, commandPaletteInput, resolvedTeamNameLookup]);

  const adminV4ModelBacktests = useMemo(() => backtestTimeAwareModels({
    matches: activePredictorMatches,
    v3Records: records,
    v4Records,
    epaRatings
  }), [activePredictorMatches, epaRatings, records, v4Records]);
  const adminV4NoFutureBlendLookup = useMemo(
    () => buildAverageBlendLookup([averageLookup, activeOprRatings]),
    [activeOprRatings, averageLookup]
  );
  const adminV4BestForecastLayer = useMemo(() => buildBestModelFutureForecasts({
    matches: activePredictorMatches,
    v3Records: records,
    v4Records,
    epaRatings,
    modelResults: adminV4ModelBacktests,
    ratingLookups: {
      PPC: averageLookup,
      'Rolling PPC': averageLookup,
      OPR: activeOprRatings,
      'Rolling OPR': activeOprRatings,
      'Pre-Match Blend': adminV4NoFutureBlendLookup,
      EPA: epaRatings,
      'Recency EPA': epaRatings
    }
  }), [activeOprRatings, activePredictorMatches, adminV4ModelBacktests, adminV4NoFutureBlendLookup, averageLookup, epaRatings, records, v4Records]);
  const adminV4PpaRatings = useMemo(() => buildPpaRatings(adminV4ModelBacktests, {
    PPC: averageLookup,
    'Rolling PPC': averageLookup,
    OPR: activeOprRatings,
    'Rolling OPR': activeOprRatings,
    'Pre-Match Blend': adminV4NoFutureBlendLookup,
    EPA: epaRatings,
    'Recency EPA': epaRatings
  }), [activeOprRatings, adminV4ModelBacktests, adminV4NoFutureBlendLookup, averageLookup, epaRatings]);
  const missingPpaTeams = useMemo(
    () => predictorTeams.filter(teamNumber => !(teamNumber in adminV4PpaRatings)),
    [adminV4PpaRatings, predictorTeams]
  );
  const ppaPredictions = useMemo(
    () =>
      buildPredictedMatchesFromRatings(activePredictorMatches, {
        ratings: adminV4PpaRatings,
        missingTeams: missingPpaTeams
      }).filter(isVisibleForecastPrediction),
    [activePredictorMatches, adminV4PpaRatings, isVisibleForecastPrediction, missingPpaTeams]
  );
  const ppaQualificationProjection = useMemo(
    () =>
      buildQualificationProjection({
        matches: activePredictorMatches,
        currentTbaRanks: effectiveCurrentTbaRanks,
        currentTbaRankOrder: effectiveCurrentTbaRankOrder,
        modelLabel: 'Expected Range',
        overallRatings: adminV4PpaRatings
      }),
    [activePredictorMatches, adminV4PpaRatings, effectiveCurrentTbaRankOrder, effectiveCurrentTbaRanks]
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
        ? adminV4PpaRatings
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
  const adminV4FeatureMatchSnapshots = useMemo(
    () => buildNoFutureFeatureMatchSnapshots({
      matches: activePredictorMatches,
      v3Records: records,
      v4Records
    }),
    [activePredictorMatches, records, v4Records]
  );
  const adminV4ForecastSnapshots = useMemo<NonNullable<ModelFeatureSnapshot['forecastSnapshots']>>(
    () =>
      sortAdminV4MatchesForTestMode(
        activePredictorMatches.filter(match => (match.comp_level === 'pm' || match.comp_level === 'qm') && !isPlayedMatch(match))
      )
        .map(match => {
          const forecast = adminV4BestForecastLayer.forecasts[match.key];
          const redPredictedScore = forecast?.redScore ?? null;
          const bluePredictedScore = forecast?.blueScore ?? null;
          const predictedWinner =
            redPredictedScore == null || bluePredictedScore == null
              ? undefined
              : redPredictedScore === bluePredictedScore
                ? 'Tie'
                : redPredictedScore > bluePredictedScore
                  ? 'Red'
                  : 'Blue';
          return {
            matchKey: match.key,
            compLevel: match.comp_level,
            matchTitle: getAdminV4MatchLabel(match),
            matchNumber: match.match_number,
            scheduledTime: match.predicted_time ?? match.time ?? null,
            redTeams: match.alliances.red.team_keys.map(normalizeTeamKey),
            blueTeams: match.alliances.blue.team_keys.map(normalizeTeamKey),
            redPredictedScore,
            bluePredictedScore,
            predictedWinner,
            lowConfidence: forecast?.lowConfidence ?? true,
            modelName: adminV4BestForecastLayer.modelName,
            modelSource: adminV4BestForecastLayer.modelSource
          };
        }),
    [activePredictorMatches, adminV4BestForecastLayer]
  );
  const adminV4DefenseImpactLookup = useMemo(
    () =>
      buildDefenseImpactLookup(
        buildDefenseAttributions(
          v4Records,
          Object.keys(adminV4PpaRatings).length > 0 ? adminV4PpaRatings : activeMetricRatings
        )
      ),
    [activeMetricRatings, adminV4PpaRatings, v4Records]
  );
  const adminV4BonusMetricLookup = useMemo(
    () => buildScoutedBonusMetricLookup(records, v4Records),
    [records, v4Records]
  );
  const adminV4StrategyMatchPlans = useMemo(
    () =>
      buildStrategyMatchPlans(
        activePredictorMatches,
        activeMetricRatings,
        adminV4DefenseImpactLookup,
        adminV4BonusMetricLookup,
        adminV4BestForecastLayer
      ),
    [
      activeMetricRatings,
      activePredictorMatches,
      adminV4BestForecastLayer,
      adminV4BonusMetricLookup,
      adminV4DefenseImpactLookup
    ]
  );
  const selectedStrategyMatchPlan = useMemo(
    () => adminV4StrategyMatchPlans.find(plan => plan.matchKey === selectedMatchKey) || null,
    [adminV4StrategyMatchPlans, selectedMatchKey]
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
        ppaRatings: adminV4PpaRatings,
        defenseImpactLookup: adminV4DefenseImpactLookup,
        featureMatchSnapshots: adminV4FeatureMatchSnapshots
      }),
    [
      activeOprRatings,
      adminV4DefenseImpactLookup,
      adminV4FeatureMatchSnapshots,
      adminV4PpaRatings,
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
      adminV4ModelBacktests.find(result => result.matchesTested > 0 && result.eligibleForPromotion) ||
      adminV4ModelBacktests.find(result => result.matchesTested > 0) ||
      null,
    [adminV4ModelBacktests]
  );
  const usableModelCount = useMemo(
    () => adminV4ModelBacktests.filter(result => result.matchesTested > 0).length,
    [adminV4ModelBacktests]
  );
  const promotionCandidateCount = useMemo(
    () => adminV4ModelBacktests.filter(result => result.matchesTested > 0 && result.eligibleForPromotion).length,
    [adminV4ModelBacktests]
  );
  const scoutCalibrationRows = useMemo(
    () => buildScoutCalibrationRows(v4Records, activePredictorMatches),
    [activePredictorMatches, v4Records]
  );
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
        ppaRatings: adminV4PpaRatings,
        profiles: teamPerformanceProfiles,
        modelName: adminV4BestForecastLayer.modelName,
        modelSource: adminV4BestForecastLayer.modelSource
      }),
    [
      adminV4BestForecastLayer.modelName,
      adminV4BestForecastLayer.modelSource,
      adminV4PpaRatings,
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

  const buildCurrentModelSnapshotPair = useCallback((createdAt: number) => {
    const snapshot: ModelLabSnapshot = {
      id: `${eventKey}_${createdAt}`,
      eventKey,
      createdAt,
      selectedPromotedModel: bestModelBacktest?.modelName || '',
      selectedForecastModel: adminV4BestForecastLayer.modelName,
      ppaTeamCount: Object.keys(adminV4PpaRatings).length,
      modelResults: adminV4ModelBacktests
    };
    const featureSnapshot: ModelFeatureSnapshot = {
      id: `${eventKey}_features_${createdAt}`,
      eventKey,
      modelName: adminV4BestForecastLayer.modelName,
      modelSource: adminV4BestForecastLayer.modelSource,
      beforeMatchKey: 'latest',
      createdAt,
      featuresByTeam: modelFeaturesByTeam,
      matchSnapshots: adminV4FeatureMatchSnapshots,
      forecastSnapshots: adminV4ForecastSnapshots
    };

    return { featureSnapshot, snapshot };
  }, [
    adminV4BestForecastLayer.modelName,
    adminV4BestForecastLayer.modelSource,
    adminV4FeatureMatchSnapshots,
    adminV4ForecastSnapshots,
    adminV4ModelBacktests,
    adminV4PpaRatings,
    bestModelBacktest?.modelName,
    eventKey,
    modelFeaturesByTeam
  ]);

  useEffect(() => {
    if (adminV4ModelBacktests.length === 0 && adminV4ForecastSnapshots.length === 0) return;
    const createdAt = Date.now();
    const { featureSnapshot, snapshot } = buildCurrentModelSnapshotPair(createdAt);
    let cancelled = false;
    void Promise.all([
      saveModelLabSnapshot(snapshot),
      saveModelFeatureSnapshot(featureSnapshot)
    ])
      .then(() => {
        if (cancelled) return;
        setLatestModelSnapshot(snapshot);
        setLatestFeatureSnapshot(featureSnapshot);
        setModelSnapshotStatus(
          adminV4ModelBacktests.length > 0
            ? `Saved model snapshot at ${formatLocalTimestamp(createdAt)}`
            : `Saved early forecast snapshot at ${formatLocalTimestamp(createdAt)}`
        );
      })
      .catch(error => {
        console.warn('Failed to save Admin V4 model snapshot', error);
        if (!cancelled) setModelSnapshotStatus('Model snapshot save failed on this device.');
      });
    return () => {
      cancelled = true;
    };
  }, [
    adminV4ForecastSnapshots.length,
    adminV4ModelBacktests.length,
    buildCurrentModelSnapshotPair
  ]);

  const saveForecastSnapshotNow = useCallback(async () => {
    if (adminV4ModelBacktests.length === 0 && adminV4ForecastSnapshots.length === 0) {
      setModelSnapshotStatus('Forecast snapshot needs future forecasts or model backtests first.');
      return;
    }
    const createdAt = Date.now();
    const { featureSnapshot, snapshot } = buildCurrentModelSnapshotPair(createdAt);
    try {
      await Promise.all([
        saveModelLabSnapshot(snapshot),
        saveModelFeatureSnapshot(featureSnapshot)
      ]);
      setLatestModelSnapshot(snapshot);
      setLatestFeatureSnapshot(featureSnapshot);
      setModelSnapshotStatus(`Saved manual forecast snapshot at ${formatLocalTimestamp(createdAt)} with ${featureSnapshot.forecastSnapshots?.length ?? 0} future forecasts.`);
    } catch (error) {
      console.warn('Failed to save manual Admin V4 forecast snapshot', error);
      setModelSnapshotStatus('Manual forecast snapshot save failed on this device.');
    }
  }, [adminV4ForecastSnapshots.length, adminV4ModelBacktests.length, buildCurrentModelSnapshotPair]);

  const selectedTeamPerformanceProfile = useMemo(
    () => (searchedTeamNumber ? teamPerformanceProfiles.find(profile => profile.teamNumber === searchedTeamNumber) || null : null),
    [searchedTeamNumber, teamPerformanceProfiles]
  );
  const selectedTeamPpaInsight = searchedTeamNumber ? ppaInsightsByTeam[searchedTeamNumber] || null : null;
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
    testModeActive
      ? `Test Mode rewind before ${testModeSelectedMatchLabel}`
      : liveEventMatches.length > 0
      ? matchSourceLabel || 'Live TBA schedule'
      : uploadedScheduleFallback
        ? `${uploadedScheduleFallback.fileName} (${uploadedScheduleFallback.source === 'schedule' ? 'uploaded schedule' : 'uploaded match table'})`
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
        currentMetricLabel: 'Expected Range',
        currentMetricValue: insight?.rating ?? adminV4PpaRatings[searchedTeamNumber] ?? null,
        autoComponent: null,
        teleopComponent: null,
        sourceLabel: insight ? `${insight.source.label} · ${insight.coverage.label}` : 'Best validated model estimate',
        extras: [
          { label: 'Role Fit', value: insight?.role.label || 'Needs role evidence' },
          { label: 'Uncertainty', value: insight ? insight.uncertainty.level : 'Needs local rows' },
          { label: 'Tail Risk', value: insight ? insight.tailRisk.level : 'Needs risk read' },
          { label: 'Scout Trust', value: insight ? formatPercentMetric(insight.coverage.scoutConfidence, 0) : '—' },
          { label: 'Local Avg', value: formatMetricValue(activeTeamAverage?.avgTotalMatchPoints ?? null) },
          { label: 'Official Avg', value: formatMetricValue(activeOprRatings[searchedTeamNumber] ?? null) },
          { label: 'Public EPA', value: formatMetricValue(activeEpaMetrics?.overallEPA ?? null) },
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
    adminV4PpaRatings,
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

  const rawEditorRecords = useMemo<AdminV4RawEditorRecord[]>(
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
  const teamEvidenceByTeam = useMemo<Record<string, TeamEvidenceStatus>>(() => {
    const evidenceMap: Record<string, TeamEvidenceStatus> = {};
    const ensureTeamEvidence = (teamNumber: string) => {
      if (!teamNumber) {
        return null;
      }
      if (!evidenceMap[teamNumber]) {
        const insight = ppaInsightsByTeam[teamNumber] || null;
        evidenceMap[teamNumber] = {
          teamNumber,
          matchRows: 0,
          defenseRows: 0,
          pitRows: 0,
          preScoutRows: 0,
          scoutConfidence: insight?.coverage.scoutConfidence ?? 0,
          uncertainty: insight?.uncertainty.level ?? 'High',
          roleLabel: insight?.role.label ?? 'Needs role evidence',
          needsAttention: true,
          attentionReasons: []
        };
      }
      return evidenceMap[teamNumber];
    };

    allKnownTeams.forEach(ensureTeamEvidence);
    [...records, ...v4Records].forEach(record => {
      const status = ensureTeamEvidence(record.teamNumber);
      if (status) status.matchRows += 1;
    });
    defenseRecords.forEach(record => {
      const status = ensureTeamEvidence(record.teamNumber);
      if (status) status.defenseRows += 1;
    });
    activePitArchiveRecords.forEach(record => {
      const teamNumber = record.payload.teamNumber;
      const status = ensureTeamEvidence(teamNumber);
      if (status) status.pitRows += 1;
    });
    preScoutAdminTaskEvidence.forEach(evidence => {
      const status = ensureTeamEvidence(evidence.teamNumber);
      if (status) status.preScoutRows += 1;
    });

    Object.values(evidenceMap).forEach(status => {
      const insight = ppaInsightsByTeam[status.teamNumber] || null;
      const reasons = [
        status.matchRows === 0 ? 'no match rows' : '',
        status.matchRows === 1 ? 'only 1 match row' : '',
        status.pitRows === 0 && status.preScoutRows === 0 ? 'no pre-event prior' : '',
        status.pitRows === 0 && status.preScoutRows > 0 ? 'pit interview missing' : '',
        (status.roleLabel === 'Defender' || status.roleLabel === 'Flex' || (insight?.components.defenseImpact ?? 0) > 4) && status.defenseRows === 0
          ? 'no defense read'
          : '',
        status.scoutConfidence < 0.5 ? 'low scout trust' : '',
        status.uncertainty === 'High' ? 'high uncertainty' : ''
      ].filter(Boolean);
      status.attentionReasons = reasons;
      status.needsAttention = reasons.length > 0;
    });

    return evidenceMap;
  }, [activePitArchiveRecords, allKnownTeams, defenseRecords, ppaInsightsByTeam, preScoutAdminTaskEvidence, records, v4Records]);

  const buildScoutTaskPpaContext = useCallback((
    teamNumber: string,
    missionKey: ScoutingMissionKey,
    reason: string,
    attentionReasons: string[] = []
  ): ScoutTaskPpaContext | undefined => {
    const insight = ppaInsightsByTeam[teamNumber] || null;
    if (!insight) return undefined;
    const expectedLabel = formatMetricValue(insight.projected.expected ?? null, 1);
    const floorLabel = formatMetricValue(insight.projected.floor ?? null, 1);
    const ceilingLabel = formatMetricValue(insight.projected.ceiling ?? null, 1);
    const normalLowLabel = formatMetricValue(insight.projected.normalLow ?? null, 1);
    const normalHighLabel = formatMetricValue(insight.projected.normalHigh ?? null, 1);
    const rangeWidth =
      insight.projected.floor != null && insight.projected.ceiling != null
        ? insight.projected.ceiling - insight.projected.floor
        : null;
    const missionAsk =
      missionKey === 'matchScout'
        ? `Verify whether this match looks like the ${expectedLabel} expected range, and record the role, reliability, and failure reasons behind the difference.`
        : missionKey === 'pitScout'
          ? `Ask which mechanism, driver choice, or strategy supports the ${insight.role.label.toLowerCase()} read, then name what match scouts should verify.`
          : missionKey === 'defenseScout'
            ? 'Name the defended robot, denied action, duration, foul risk, and whether defense changed output.'
            : 'Refresh public context and record what is still unknown before local rows arrive.';
    const shapeAsks = [
      rangeWidth != null && rangeWidth >= 8
        ? `Floor/ceiling spread is ${floorLabel} to ${ceilingLabel}; capture what pushes this team toward the floor or ceiling.`
        : '',
      insight.projected.normalLow != null && insight.projected.normalHigh != null
        ? `Normal band is ${normalLowLabel} to ${normalHighLabel}; flag if the evidence lands outside that band and why.`
        : '',
      insight.role.label === 'Defender' || insight.role.label === 'Flex'
        ? `Role read is ${insight.role.label}; collect defense/support context so the expected range does not treat role sacrifice as weak scoring.`
        : '',
      insight.coverage.scoutConfidence < 0.5
        ? `Scout trust is ${formatPercentMetric(insight.coverage.scoutConfidence, 0)}; prioritize concrete observations over vibes.`
        : '',
      insight.tailRisk.level === 'High'
        ? 'Tail risk is high; record failures, dead time, fouls, and anything that explains the floor.'
        : '',
      insight.uncertainty.level === 'High'
        ? 'Uncertainty is high; do not submit a row without notes that explain whether the model should move up, down, or stay cautious.'
        : ''
    ];
    const asks = [
      missionAsk,
      ...shapeAsks,
      attentionReasons.length ? `Close evidence gap: ${attentionReasons.join(', ')}.` : '',
      reason ? `Admin priority reason: ${reason}.` : ''
    ].filter(Boolean).slice(0, 5);

    return {
      expected: insight.projected.expected,
      floor: insight.projected.floor,
      ceiling: insight.projected.ceiling,
      normalLow: insight.projected.normalLow,
      normalHigh: insight.projected.normalHigh,
      role: insight.role.label,
      uncertainty: insight.uncertainty.level,
      tailRisk: insight.tailRisk.level,
      scoutConfidence: insight.coverage.scoutConfidence,
      coverage: insight.coverage.label,
      model: insight.source.modelName,
      warnings: [...insight.warnings, ...insight.uncertainty.reasons, ...insight.tailRisk.reasons].filter(Boolean).slice(0, 5),
      asks
    };
  }, [ppaInsightsByTeam]);

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

  const collectionPipelineStages = useMemo<AdminV4CollectionPipelineStage[]>(() => {
    const matchRowCount = records.length + v4Records.length;
    const preScoutProfileCount = preMatchCache?.profiles.length || 0;
    const preScoutReturnedEvidenceCount = preScoutAdminTaskEvidence.length;
    return [
      {
        key: 'preScout',
        count: preScoutEvidenceTeamCount || preScoutProfileCount || allKnownTeams.length,
        countLabel: preScoutReturnedEvidenceCount > 0 ? 'pre returns' : preMatchCache ? 'public profiles' : 'known teams',
        readinessLabel: preScoutReturnedEvidenceCount > 0
          ? 'Public context returned'
          : preScoutProfileCount > 0
            ? 'Public context cached'
            : allKnownTeams.length > 0
              ? 'Event list known'
              : 'Needs event list',
        readinessDetail: preScoutReturnedEvidenceCount > 0
          ? `${preScoutReturnedEvidenceCount} Pre Scout task return${preScoutReturnedEvidenceCount === 1 ? '' : 's'} from ${preScoutEvidenceTeamCount} team${preScoutEvidenceTeamCount === 1 ? '' : 's'} now feed the evidence loop.`
          : preScoutProfileCount > 0
            ? `Pre Scout cache from ${formatFreshnessAge(preMatchCache?.cachedAt || 0)} seeds early expectations and pit-scout priorities.`
            : allKnownTeams.length > 0
              ? 'Known teams exist, but Pre Scout public profiles are not cached yet.'
              : 'Load a live or uploaded schedule/team list so Pre Scout can create priorities.',
        tone: preScoutReturnedEvidenceCount > 0 || preScoutProfileCount > 0 ? 'emerald' : 'amber'
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
        readinessLabel: rawEditorSummary.missingSlotCount > 0 ? 'Coverage gaps' : matchRowCount > 0 ? 'Range signal forming' : 'No scoring rows',
        readinessDetail: rawEditorSummary.missingSlotCount > 0
          ? `${rawEditorSummary.missingSlotCount} scheduled scout slot${rawEditorSummary.missingSlotCount === 1 ? '' : 's'} still missing.`
          : matchRowCount > 0
            ? 'Expected value, repeatability, volatility, and scout trust are feeding the range read.'
            : 'Collect match rows before trusting expected ranges beyond public-only context.',
        tone: rawEditorSummary.missingSlotCount > 0 ? 'rose' : matchRowCount > 0 ? 'emerald' : 'amber'
      },
      {
        key: 'defenseScout',
        count: defenseRecords.length,
        countLabel: 'defense rows',
        readinessLabel: defenseRecords.length > 0 ? 'Role protection live' : 'No defense evidence',
        readinessDetail: defenseRecords.length > 0
          ? 'Defense impact can stop the expected range from mistaking strategic sacrifice for weak offense.'
          : 'Add defense evidence for teams that deny points or play non-scoring roles.',
        tone: defenseRecords.length > 0 ? 'emerald' : 'amber'
      }
    ];
  }, [
    activePitArchiveRecords.length,
    allKnownTeams.length,
    defenseRecords.length,
    preMatchCache,
    preScoutAdminTaskEvidence.length,
    preScoutEvidenceTeamCount,
    rawEditorSummary.missingSlotCount,
    records.length,
    v4Records.length
  ]);

  const ppaReadinessCards = useMemo<AdminV4PpaReadinessCard[]>(() => [
    {
      label: 'Ranges Ready',
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
      label: 'Needs Local Rows',
      value: ppaReadinessSummary.noLocalRows,
      detail: 'Expected range exists without local match rows backing it yet.',
      tone: ppaReadinessSummary.noLocalRows > 0 ? 'amber' : 'emerald'
    },
    {
      label: 'Pre Evidence',
      value: preScoutEvidenceTeamCount,
      detail: 'Teams where public context was returned from a focused Pre Scout task.',
      tone: preScoutEvidenceTeamCount > 0 ? 'emerald' : 'cyan'
    },
    {
      label: 'Low Scout Trust',
      value: ppaReadinessSummary.lowConfidence,
      detail: 'Teams where expected ranges should be read cautiously because scouting coverage is thin.',
      tone: ppaReadinessSummary.lowConfidence > 0 ? 'amber' : 'emerald'
    },
    {
      label: 'Unsynced Local',
      value: localArchiveSummary.unsyncedRecords.length,
      detail: 'Rows saved locally but not yet confirmed in Firebase.',
      tone: localArchiveSummary.unsyncedRecords.length > 0 ? 'rose' : 'emerald'
    }
  ], [localArchiveSummary.unsyncedRecords.length, ppaReadinessSummary, preScoutEvidenceTeamCount]);
  const scoutWorkQueue = useMemo<ScoutWorkItem[]>(() => {
    const nextPrediction = activePredictions[0] || null;
    const nextMatchTeams = nextPrediction ? Array.from(new Set([...nextPrediction.red.teams, ...nextPrediction.blue.teams])) : [];
    const nextMatchNumber =
      nextPrediction?.key.match(/_qm(\d+)$/i)?.[1] ||
      nextPrediction?.title.match(/(\d+)/)?.[1] ||
      '';
    const getNextMatchAlliance = (teamNumber: string): ScoutTaskAlliance | undefined => {
      if (!nextPrediction) return undefined;
      if (nextPrediction.red.teams.includes(teamNumber)) return 'Red';
      if (nextPrediction.blue.teams.includes(teamNumber)) return 'Blue';
      return undefined;
    };
    const candidateTeams = (nextMatchTeams.length > 0 ? nextMatchTeams : allKnownTeams)
      .map(teamNumber => teamEvidenceByTeam[teamNumber])
      .filter((status): status is TeamEvidenceStatus => Boolean(status?.needsAttention));
    const queuedItems: ScoutWorkItem[] = [];
    const pushTask = (
      status: TeamEvidenceStatus,
      missionKey: ScoutingMissionKey,
      reason: string,
      detail: string,
      priority: number
    ) => {
      queuedItems.push({
        id: `${missionKey}:${status.teamNumber}:${reason}`,
        teamNumber: status.teamNumber,
        teamName: resolvedTeamNameLookup[status.teamNumber] || '',
        missionKey,
        label: SCOUTING_MISSIONS[missionKey].title,
        reason,
        detail,
        priority: nextMatchTeams.includes(status.teamNumber) ? priority - 20 : priority,
        context: nextPrediction && nextMatchTeams.includes(status.teamNumber)
          ? `${nextPrediction.title} evidence`
          : 'event evidence',
        matchKey: nextPrediction && nextMatchTeams.includes(status.teamNumber) ? nextPrediction.key : undefined,
        matchType: nextPrediction && nextMatchTeams.includes(status.teamNumber) ? 'Qualification' : undefined,
        matchNumber: nextPrediction && nextMatchTeams.includes(status.teamNumber) && nextMatchNumber
          ? Number(nextMatchNumber)
          : undefined,
        alliance: getNextMatchAlliance(status.teamNumber),
        ppa: buildScoutTaskPpaContext(status.teamNumber, missionKey, reason, status.attentionReasons)
      });
    };

    candidateTeams.forEach(status => {
      const insight = ppaInsightsByTeam[status.teamNumber] || null;
      const needsMatchRow = status.matchRows < 2 || status.scoutConfidence < 0.5 || status.uncertainty === 'High';
      const needsPreScoutRow = status.preScoutRows === 0 && status.matchRows === 0 && status.pitRows === 0;
      const needsPitRow = status.pitRows === 0;
      const needsDefenseRow =
        status.defenseRows === 0 &&
        (status.roleLabel === 'Defender' || status.roleLabel === 'Flex' || (insight?.components.defenseImpact ?? 0) > 4);

      if (needsMatchRow) {
        pushTask(
          status,
          'matchScout',
          status.matchRows === 0 ? 'no match rows' : status.scoutConfidence < 0.5 ? 'low scout trust' : 'wide expected range',
          `Collect scoring, role, reliability, and notes so the expected range has real local evidence behind it.`,
          10 + status.matchRows * 4
        );
      }
      if (needsPreScoutRow) {
        pushTask(
          status,
          'preScout',
          'no pre-scout return',
          'Pull public context first so the scout knows what claims, missing media, and qualification signals must be verified later.',
          16
        );
      }
      if (needsPitRow) {
        pushTask(
          status,
          'pitScout',
          status.preScoutRows > 0 ? 'pit interview missing' : 'no pre-event prior',
          status.preScoutRows > 0
            ? 'Validate the public Pre Scout prior with a real pit interview on mechanism risk, compatibility, and claims.'
            : 'Interview the team for claimed capability, mechanism risk, compatibility, and what match scouts should verify.',
          18
        );
      }
      if (needsDefenseRow) {
        pushTask(
          status,
          'defenseScout',
          'no defense read',
          'Capture whether the robot actually denies output so the expected range does not confuse role sacrifice with weak offense.',
          14
        );
      }
    });

    if (queuedItems.length === 0 && allKnownTeams.length > 0) {
      const fallbackTeams = allKnownTeams.filter(teamNumber => (teamEvidenceByTeam[teamNumber]?.preScoutRows ?? 0) === 0);
      return (fallbackTeams.length > 0 ? fallbackTeams : allKnownTeams).slice(0, 3).map((teamNumber, index) => ({
        id: `preScout:${teamNumber}:refresh-public-context`,
        teamNumber,
        teamName: resolvedTeamNameLookup[teamNumber] || '',
        missionKey: 'preScout',
        label: 'Pre Scout',
        reason: (teamEvidenceByTeam[teamNumber]?.preScoutRows ?? 0) === 0 ? 'no pre-scout return' : 'refresh public context',
        detail: (teamEvidenceByTeam[teamNumber]?.preScoutRows ?? 0) === 0
          ? 'Collect the public context return before sending scouts into pit or match work cold.'
          : 'Refresh public context or verify that this team has no obvious pre-match research gap.',
        priority: 50 + index,
        context: 'event evidence',
        ppa: buildScoutTaskPpaContext(teamNumber, 'preScout', 'refresh public context')
      }));
    }

    return queuedItems
      .sort((left, right) => left.priority - right.priority || Number(left.teamNumber) - Number(right.teamNumber))
      .slice(0, 8);
  }, [activePredictions, allKnownTeams, buildScoutTaskPpaContext, ppaInsightsByTeam, resolvedTeamNameLookup, teamEvidenceByTeam]);

  const completedAdminTaskEvidenceRows = useMemo(() => {
    const rows = [
      ...preScoutAdminTaskEvidence.map(evidence => ({
        key: `preScout:${evidence.id}`,
        recordType: 'Pre Scout',
        teamNumber: evidence.teamNumber,
        matchLabel: evidence.profileAvailable ? 'Public context verified' : 'Public context missing',
        adminTask: evidence.task,
        updatedAt: evidence.capturedAt || evidence.task.capturedAt || 0
      })),
      ...v4Records.map(record => ({
        key: `match:${record.matchKey}:${record.teamNumber}`,
        recordType: 'Match Scout',
        teamNumber: record.teamNumber,
        matchLabel: `${record.matchType} ${record.matchNumber}`,
        adminTask: record.adminTask,
        updatedAt: record.timestamp || 0
      })),
      ...defenseRecords.map(record => ({
        key: `defense:${record.matchKey}:${record.teamNumber}`,
        recordType: 'Defense Scout',
        teamNumber: record.teamNumber,
        matchLabel: `${record.matchType} ${record.matchNumber}`,
        adminTask: record.adminTask,
        updatedAt: record.timestamp || 0
      })),
      ...activePitArchiveRecords.map(record => ({
        key: `pit:${record.payload.teamNumber}:${record.updatedAt}`,
        recordType: 'Pit Scout',
        teamNumber: record.payload.teamNumber,
        matchLabel: 'Pit prior',
        adminTask: record.payload.adminTask,
        updatedAt: record.payload.timestamp || record.updatedAt || 0
      }))
    ].filter(row => row.adminTask?.source === 'adminv4');

    return rows
      .sort((left, right) => (right.adminTask?.capturedAt || right.updatedAt) - (left.adminTask?.capturedAt || left.updatedAt))
      .slice(0, 8);
  }, [activePitArchiveRecords, defenseRecords, preScoutAdminTaskEvidence, v4Records]);

  const sorterRows = useMemo<AdminV4SorterRow[]>(() => {
    return allKnownTeams.map(teamNumber => {
      const teamAverage = teamAverageLookupByTeam[teamNumber];
      const defenseMetric = defenseMetricLookupByTeam[teamNumber];
      const ppaInsight = ppaInsightsByTeam[teamNumber];
      return {
        teamNumber,
        teamName: resolvedTeamNameLookup[teamNumber] || '',
        matches: teamAverage?.matchesPlayed ?? 0,
        ppa: ppaInsight?.rating ?? adminV4PpaRatings[teamNumber] ?? null,
        ppaRole: ppaInsight?.role.label ?? 'Needs role evidence',
        ppaUncertainty: ppaInsight?.uncertainty.level ?? 'High',
        ppaCoverage: ppaInsight?.coverage.label ?? 'No range context',
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
    adminV4PpaRatings,
    calculatedDprRatings,
    defenseMetricLookupByTeam,
    epaRatings,
    effectiveCurrentTbaRanks,
    ppaInsightsByTeam,
    resolvedTeamNameLookup,
    teamAverageLookupByTeam
  ]);

  const sortedSorterRows = useMemo(() => {
    const getValue = (row: AdminV4SorterRow, field: SorterField) => {
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

  const visualPriorityTeamNumbers = useMemo(
    () => Array.from(new Set([ownTeamNumber, searchedTeamNumber].filter(Boolean))),
    [ownTeamNumber, searchedTeamNumber]
  );

  const includeVisualPriorityRows = useCallback(function <T extends ChartRowBase>(sortedRows: T[], limit = 14) {
    const visibleRows = sortedRows.slice(0, limit);
    visualPriorityTeamNumbers.forEach(teamNumber => {
      if (visibleRows.some(row => row.label === teamNumber)) return;
      const priorityRow = sortedRows.find(row => row.label === teamNumber);
      if (priorityRow) visibleRows.push(priorityRow);
    });
    return visibleRows;
  }, [visualPriorityTeamNumbers]);

  const topOffenseRows = useMemo(
    () => {
      const selectedValue = (row: AdminV4SorterRow) => activeMetricRatings[row.teamNumber] ?? null;
      const bestAvailableValue = (row: AdminV4SorterRow) => selectedValue(row) ?? row.opr ?? row.epa ?? row.ppc;
      const rows = sorterRows
        .map(row => ({ row, value: bestAvailableValue(row) }))
        .filter(item => item.value != null && Number.isFinite(item.value))
        .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))
        .map(({ row, value }) => ({
          key: row.teamNumber,
          label: row.teamNumber,
          value: value ?? 0,
          secondary: row.teamName || undefined,
          highlighted: getTeamHighlight(row.teamNumber)
        }));
      return includeVisualPriorityRows(rows, 14);
    },
    [activeMetricRatings, getTeamHighlight, includeVisualPriorityRows, sorterRows]
  );

  const topDefenseRows = useMemo(
    () => {
      const rows = sorterRows
        .filter(row => row.defenseMetric != null && Number.isFinite(row.defenseMetric))
        .sort((left, right) => (right.defenseMetric ?? 0) - (left.defenseMetric ?? 0))
        .map(row => ({
          key: row.teamNumber,
          label: row.teamNumber,
          value: row.defenseMetric ?? 0,
          secondary: row.teamName || undefined,
          highlighted: getTeamHighlight(row.teamNumber)
        }));
      return includeVisualPriorityRows(rows, 12);
    },
    [getTeamHighlight, includeVisualPriorityRows, sorterRows]
  );

  const volatilityRows = useMemo(
    () => {
      const rows = teamPerformanceProfiles
        .filter(profile => Number.isFinite(profile.volatility))
        .sort((left, right) => right.volatility - left.volatility)
        .map(profile => ({
          key: profile.teamNumber,
          label: profile.teamNumber,
          value: profile.volatility,
          secondary: resolvedTeamNameLookup[profile.teamNumber] || undefined,
          highlighted: getTeamHighlight(profile.teamNumber)
        }));
      return includeVisualPriorityRows(rows, 12);
    },
    [getTeamHighlight, includeVisualPriorityRows, resolvedTeamNameLookup, teamPerformanceProfiles]
  );

  const ppaShapeRows = useMemo<PpaShapeChartRow[]>(() =>
    includeVisualPriorityRows(Object.values(ppaInsightsByTeam)
      .map((insight): PpaShapeChartRow | null => {
        const expected = insight.projected.expected ?? insight.rating;
        if (expected == null || !Number.isFinite(expected)) return null;
        const secondary = insight.teamName || resolvedTeamNameLookup[insight.teamNumber];
        const highlighted = getTeamHighlight(insight.teamNumber);
        const row: PpaShapeChartRow = {
          key: insight.teamNumber,
          label: insight.teamNumber,
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
          coverageLabel: insight.coverage.label
        };
        if (secondary) row.secondary = secondary;
        if (highlighted) row.highlighted = highlighted;
        return row;
      })
      .filter((row): row is PpaShapeChartRow => !!row)
      .sort((left, right) => right.expected - left.expected), 14),
    [getTeamHighlight, includeVisualPriorityRows, ppaInsightsByTeam, resolvedTeamNameLookup]
  );

  const visualChartConfigs = useMemo(() => {
    const riskScore = (level: PpaRiskLevel | undefined) =>
      level === 'High' ? 3 : level === 'Medium' ? 2 : level === 'Low' ? 1 : 0;
    const rowsForMetric = (metric: VisualMetricKey) => {
      if (metric === 'power') return topOffenseRows;
      if (metric === 'defense') return topDefenseRows;
      if (metric === 'volatility') return volatilityRows;

      const valueForRow = (row: AdminV4SorterRow) => {
        const ppaInsight = ppaInsightsByTeam[row.teamNumber];
        if (metric === 'ppa') return row.ppa;
        if (metric === 'ppaExpected') return ppaInsight?.projected.expected ?? row.ppa;
        if (metric === 'ppaFloor') return ppaInsight?.projected.floor ?? row.ppa;
        if (metric === 'ppaCeiling') return ppaInsight?.projected.ceiling ?? row.ppa;
        if (metric === 'ppaScoutConfidence') return ppaInsight?.coverage.scoutConfidence ?? null;
        if (metric === 'ppaTailRisk') return ppaInsight ? riskScore(ppaInsight.tailRisk.level) : null;
        if (metric === 'ppc') return row.ppc;
        if (metric === 'autoPpc') return row.autoPpc;
        if (metric === 'teleopPpc') return row.teleopPpc;
        if (metric === 'opr') return row.opr;
        if (metric === 'epa') return row.epa;
        if (metric === 'dpr') return row.dpr;
        if (metric === 'tbaRank') return row.tbaRank;
        return row.matches;
      };

      const lowerIsBetter = metric === 'tbaRank' || metric === 'dpr';

      const rows = sorterRows
        .map(row => ({ row, value: valueForRow(row) }))
        .filter(item => item.value != null && Number.isFinite(item.value))
        .sort((left, right) =>
          lowerIsBetter
            ? (left.value ?? Number.POSITIVE_INFINITY) - (right.value ?? Number.POSITIVE_INFINITY)
            : (right.value ?? 0) - (left.value ?? 0)
        )
        .map(({ row, value }) => ({
          key: `${metric}-${row.teamNumber}`,
          label: row.teamNumber,
          value: value ?? 0,
          secondary: row.teamName || undefined,
          highlighted: getTeamHighlight(row.teamNumber)
        }));
      return includeVisualPriorityRows(rows, 14);
    };

    return {
      power: {
        title: `Overall Power (${MODEL_LABELS[selectedMetric]})`,
        subtitle: 'Best available active-model ranking for quick comparisons.',
        rows: rowsForMetric('power'),
        formatter: (value: number) => value.toFixed(1)
      },
      defense: {
        title: 'Defense Metric',
        subtitle: 'Scout-observed defense signal.',
        rows: rowsForMetric('defense'),
        formatter: (value: number) => `${(value * 100).toFixed(1)}%`
      },
      volatility: {
        title: 'Volatility',
        subtitle: 'Upside and reliability risk from team trend curves.',
        rows: rowsForMetric('volatility'),
        formatter: (value: number) => value.toFixed(1)
      },
      ppa: {
        title: 'Expected Range',
        subtitle: 'Nuanced model insight value: forecast strength plus local scouting context.',
        rows: rowsForMetric('ppa'),
        formatter: (value: number) => value.toFixed(1)
      },
      ppaExpected: {
        title: 'Expected Value',
        subtitle: 'Central contribution estimate used by forecasts, rankings, and simulator totals.',
        rows: rowsForMetric('ppaExpected'),
        formatter: (value: number) => value.toFixed(1)
      },
      ppaFloor: {
        title: 'Range Floor',
        subtitle: 'Bad-match contribution band for tight strategy and safe pick-list decisions.',
        rows: rowsForMetric('ppaFloor'),
        formatter: (value: number) => value.toFixed(1)
      },
      ppaCeiling: {
        title: 'Range Ceiling',
        subtitle: 'Upside contribution band when you need swing potential or upset paths.',
        rows: rowsForMetric('ppaCeiling'),
        formatter: (value: number) => value.toFixed(1)
      },
      ppaScoutConfidence: {
        title: 'Range Scout Trust',
        subtitle: 'How much local evidence supports the current expected range.',
        rows: rowsForMetric('ppaScoutConfidence'),
        formatter: (value: number) => formatPercentMetric(value, 0)
      },
      ppaTailRisk: {
        title: 'Range Tail Risk',
        subtitle: 'Failure-band risk: Low = 1, Medium = 2, High = 3.',
        rows: rowsForMetric('ppaTailRisk'),
        formatter: (value: number) => value >= 2.5 ? 'High' : value >= 1.5 ? 'Medium' : value >= 0.5 ? 'Low' : 'Needs risk data'
      },
      ppc: {
        title: 'Local Avg',
        subtitle: 'Firsthand average scouted points.',
        rows: rowsForMetric('ppc'),
        formatter: (value: number) => value.toFixed(1)
      },
      autoPpc: {
        title: 'Auto Local Avg',
        subtitle: 'Firsthand autonomous scoring average.',
        rows: rowsForMetric('autoPpc'),
        formatter: (value: number) => value.toFixed(1)
      },
      teleopPpc: {
        title: 'Teleop Local Avg',
        subtitle: 'Firsthand teleop scoring average.',
        rows: rowsForMetric('teleopPpc'),
        formatter: (value: number) => value.toFixed(1)
      },
      opr: {
        title: 'Official Avg',
        subtitle: 'Official-score-derived offensive power rating.',
        rows: rowsForMetric('opr'),
        formatter: (value: number) => value.toFixed(1)
      },
      epa: {
        title: 'Public Rating',
        subtitle: 'Statbotics expected points added.',
        rows: rowsForMetric('epa'),
        formatter: (value: number) => value.toFixed(1)
      },
      dpr: {
        title: 'Defense Against',
        subtitle: 'Official-score-derived defensive context; lower is generally better.',
        rows: rowsForMetric('dpr'),
        formatter: (value: number) => value.toFixed(1)
      },
      tbaRank: {
        title: 'TBA Rank',
        subtitle: 'Current official event rank; lower rank number is better.',
        rows: rowsForMetric('tbaRank'),
        formatter: (value: number) => `#${value.toFixed(0)}`
      },
      matches: {
        title: 'Matches Logged',
        subtitle: 'Firsthand scouting coverage volume.',
        rows: rowsForMetric('matches'),
        formatter: (value: number) => value.toFixed(0)
      }
    } satisfies Record<VisualMetricKey, AdminV4VisualChartConfig>;
  }, [
    getTeamHighlight,
    includeVisualPriorityRows,
    ppaInsightsByTeam,
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
    if (defenseMetricGuardrailSummary.adjustedRecords > 0) {
      alerts.push({
        label: 'Defense Metric Guardrail',
        detail: `${defenseMetricGuardrailSummary.adjustedRecords} defense row${defenseMetricGuardrailSummary.adjustedRecords === 1 ? '' : 's'} had impossible metric values clamped to 0-100%. Review raw audit before trusting defense impact.`,
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
        label: 'Official Source Needed',
        detail: 'Scout evidence may still exist, but schedule, rankings, teams, and official results are missing from this device.',
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
    defenseMetricGuardrailSummary.adjustedRecords,
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
        detail: selectedMetric === 'ppa' ? 'scouting-derived adapter' : 'comparison metric',
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

  const workspaceItems: AdminWorkflowItem<WorkflowTab>[] = [
    { id: 'command', key: 'command', label: 'Now', description: 'next match, trust, and required action', mobileNeed: 'Use when you just need the next safe click.', icon: <Gauge className="h-4 w-4" />, tone: 'cyan' },
    { id: 'sorter', key: 'sorter', label: 'Teams', description: 'leaderboard, search, and team profiles', mobileNeed: 'Use when someone asks about one team or ranking.', icon: <Users className="h-4 w-4" />, tone: 'emerald' },
    { id: 'predictor', key: 'predictor', label: 'Matches', description: 'future forecasts, results, and simulation', mobileNeed: 'Use when a qual is coming up or drive team needs a plan.', icon: <Swords className="h-4 w-4" />, tone: 'fuchsia' },
    { id: 'pickList', key: 'pickList', label: 'Pick List', description: 'alliance selection board', mobileNeed: 'Use when building or defending alliance selection choices.', icon: <Trophy className="h-4 w-4" />, tone: 'amber' },
    { id: 'visualize', key: 'visualize', label: 'Visualize', description: 'charts and stat comparisons', mobileNeed: 'Use when you need a chart instead of a table.', icon: <BarChart3 className="h-4 w-4" />, tone: 'cyan' },
    { id: 'data', key: 'import', label: 'Data', description: 'imports, audit, scouts, sync, and model trust', mobileNeed: 'Use when numbers, sources, scouts, sync, or trust feel wrong.', icon: <Database className="h-4 w-4" />, tone: 'slate' },
    { id: 'export', key: 'export', label: 'Reports', description: 'Excel, model proof, and demo-ready outputs', mobileNeed: 'Use when mentors, visitors, or another laptop need proof.', icon: <Download className="h-4 w-4" />, tone: 'emerald' }
  ];
  const primaryWorkflowItemIds = ['command', 'sorter', 'predictor', 'pickList', 'visualize', 'data', 'export'];
  const primaryWorkspaceItems = workspaceItems.filter(item => primaryWorkflowItemIds.includes(item.id || item.key));

  const {
    simulatorQuickEntry,
    redSimulatorInput,
    blueSimulatorInput,
    redSimulatorRows,
    blueSimulatorRows,
    redSimulatorPpaSummary,
    blueSimulatorPpaSummary,
    simulatorSummary,
    setSimulatorQuickEntry,
    setRedSimulatorInput,
    setBlueSimulatorInput,
    applyQuickSimulatorEntry
  } = useAdminV4ManualSimulator({
    activeMetricRatings,
    selectedMetric,
    teamAverageLookupByTeam,
    csvOprComponents,
    epaByTeam,
    teamNameLookup: resolvedTeamNameLookup,
    ppaRatings: adminV4PpaRatings,
    ppaInsightsByTeam,
    defenseImpactLookup: adminV4DefenseImpactLookup
  });

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
      await recordAdminAudit(
        'Uploaded local API credential file',
        `${statusParts.join('; ')} for ${eventKey}. Secret values were stored only in this browser/device and are not written to the log.`,
        'warning'
      );
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
    await recordAdminAudit(
      'Cleared FIRST Events credentials',
      `Removed local FIRST Events credentials for ${eventKey} from this browser/device.`,
      'danger'
    );
  };

  const handleClearTbaApiKey = async () => {
    await clearTbaApiKey();
    setLocalTbaApiKey('');
    setApiKeyStatus('TBA API key cleared from this admin device.');
    setApiKeyError('');
    await recordAdminAudit(
      'Cleared TBA API key',
      `Removed the local TBA API key for ${eventKey} from this browser/device.`,
      'danger'
    );
  };

  const requestClearFirstCredentials = async () => {
    const confirmed = await requestAdminActionConfirmation({
      title: 'Clear FIRST Credentials',
      message: 'Clear FIRST Events credentials from this browser/device?',
      detail: 'This does not revoke the credential at FIRST. It only removes the local copy saved on this admin device.',
      confirmLabel: 'Clear FIRST',
      tone: 'rose'
    });
    if (!confirmed) return;
    await handleClearFirstCredentials();
  };

  const requestClearTbaApiKey = async () => {
    const confirmed = await requestAdminActionConfirmation({
      title: 'Clear TBA API Key',
      message: 'Clear the TBA API key from this browser/device?',
      detail: 'You will need to upload it again before live TBA refresh works on this device.',
      confirmLabel: 'Clear TBA',
      tone: 'rose'
    });
    if (!confirmed) return;
    await handleClearTbaApiKey();
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
      await refreshAdminV4CacheEntries();
      await loadV3Data();
      await recordAdminAudit(
        'Refreshed FIRST Events cache',
        `Saved ${successCount}/${results.length} FIRST endpoint cache result${results.length === 1 ? '' : 's'} locally for ${eventKey}.`,
        failedResults.length > 0 ? 'warning' : 'info'
      );
    } catch (cacheError) {
      setFirstCredentialStatus('');
      setFirstCredentialError(cacheError instanceof Error ? cacheError.message : 'Failed to refresh FIRST Events cache.');
      await recordAdminAudit(
        'FIRST Events cache refresh failed',
        cacheError instanceof Error ? cacheError.message : 'Failed to refresh FIRST Events cache.',
        'warning'
      );
    }
  };

  const handleSyncLocalArchiveToFirebase = async () => {
    if (localArchiveSummary.unsyncedRecords.length === 0 || isLocalArchiveSyncing) {
      return;
    }
    const recordCount = localArchiveSummary.unsyncedRecords.length;
    const recordTypeCounts = localArchiveSummary.unsyncedRecords.reduce<Record<string, number>>((counts, record) => {
      counts[record.recordType] = (counts[record.recordType] || 0) + 1;
      return counts;
    }, {});
    const recordBreakdown = Object.entries(recordTypeCounts)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ');
    const confirmed = await requestAdminActionConfirmation({
      title: 'Preview Firebase Sync',
      message: `Sync ${recordCount} local scout archive record${recordCount === 1 ? '' : 's'} to Firebase for ${eventKey}?`,
      detail: `${recordBreakdown || 'No typed rows'} will be checked for conflicts before upload. Conflicts will be blocked instead of overwriting remote data. This is a remote write, so use it only when the staged rows are trusted.`,
      confirmLabel: 'Sync Trusted Rows',
      tone: 'cyan'
    });
    if (!confirmed) {
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
    await recordAdminAudit(
      'Synced local scout archive to Firebase',
      `${counts.synced} synced, ${counts.conflict} conflict${counts.conflict === 1 ? '' : 's'}, ${counts.failed} failed for ${eventKey}.`,
      counts.conflict > 0 || counts.failed > 0 ? 'warning' : 'danger'
    );
  };

  const handleExportFullLocalBackup = async () => {
    const confirmed = await requestAdminActionConfirmation({
      title: 'Export Full Local Backup',
      message: 'Export a full Admin V4 local backup from this browser/device?',
      detail: 'The file may contain team strategy, scout names, scout performance/game data, local source cache, model snapshots, and scout reward balances. FIRST tokens are not included.',
      confirmLabel: 'Export Full Backup',
      tone: 'amber'
    });
    if (!confirmed) return;
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
        modelFeatureSnapshots,
        preMatchCache
      ] = await Promise.all([
        getScoutArchiveUsername().catch(() => null),
        listAdminV4CacheEntries(eventKey).catch(() => []),
        listPowerCoinBets(eventKey).catch(() => []),
        listPowerCoinLedger(eventKey).catch(() => []),
        loadLatestScoutAssignmentPlan(eventKey).catch(() => null),
        listModelLabSnapshots(eventKey).catch(() => []),
        listModelFeatureSnapshots(eventKey).catch(() => []),
        getCachedPreMatchSheet(eventKey).catch(() => null)
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
        format: 'rebuilt-2026-admin-v4-full-local-backup',
        version: 2,
        eventKey,
        exportedAt: Date.now(),
        settings,
        firstEventsCredentials: safeFirstCredentialSummary,
        uploadedTbaPack: uploadedCsvPack,
        preMatchCache,
        scoutArchive,
        adminV4: {
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
        `Exported local backup with ${scoutArchive.records.length} scout archive records, ${cacheEntries.length} cache entries, ${preMatchCache?.profiles.length || 0} Pre Scout public profiles, ${preMatchCache?.adminTaskEvidence?.length || 0} Pre Scout evidence returns, ${powerCoinBets.length} scout reward predictions, ${modelSnapshots.length} model snapshots, and ${modelFeatureSnapshots.length} feature snapshots. Scout sync states/modes were preserved; FIRST token was not included.`
      );
      await recordAdminAudit(
        'Exported full local backup',
        `Exported ${scoutArchive.records.length} scout archive record${scoutArchive.records.length === 1 ? '' : 's'}, ${cacheEntries.length} cache entr${cacheEntries.length === 1 ? 'y' : 'ies'}, ${powerCoinBets.length} local scout reward prediction${powerCoinBets.length === 1 ? '' : 's'}, and ${modelSnapshots.length} model snapshot${modelSnapshots.length === 1 ? '' : 's'}. FIRST token was not included.`,
        'warning'
      );
    } catch (backupError) {
      console.error('Failed to export full local Admin V4 backup', backupError);
      setLocalBackupError(backupError instanceof Error ? backupError.message : 'Failed to export local backup.');
      setLocalBackupStatus('');
    }
  };

  const handleExportSafeLocalSummary = async () => {
    setLocalBackupStatus('Building safe device summary...');
    setLocalBackupError('');
    try {
      const payload = {
        format: 'rebuilt-2026-admin-v4-safe-device-summary',
        version: 1,
        eventKey,
        exportedAt: Date.now(),
        containsRowContents: false,
        containsScoutNames: false,
        containsCredentials: false,
        currentViewCounts: {
          matchRows: records.length + v4Records.length,
          defenseRows: defenseRecords.length,
          pitRows: activePitArchiveRecords.length,
          preScoutProfiles: preMatchCache?.profiles.length || 0,
          preScoutEvidenceReturns: preScoutAdminTaskEvidence.length,
          sourceRows: sourceStatusSummary.rowCount,
          sourceTypes: sourceStatusSummary.uniqueSources,
          futureMatches: activePredictions.length,
          pickListTeams: allianceRecommendations.length,
          availablePickListTeams: pickListSummary.available,
          scoutAssignments: scoutAssignmentPlan?.assignments.length || 0,
          unsyncedLocalRecords: localArchiveSummary.unsyncedRecords.length,
          localConflicts: localArchiveSummary.conflictRecords.length,
          latestModelSnapshot: latestModelSnapshot ? 1 : 0,
          latestModelFeatureSnapshot: latestFeatureSnapshot ? 1 : 0,
          scoutRewardPredictions: powerCoinBets.length,
          scoutRewardLedgerEntries: powerCoinLedger.length
        },
        status: {
          latestSourceAge: formatFreshnessAge(sourceStatusSummary.latestTimestamp),
          dataMode: isLocalMode ? 'local archive' : 'firebase',
          selectedMetric,
          testModeActive
        },
        warnings: [
          sourceStatusSummary.rowCount === 0 ? 'Official schedule/source is missing on this device.' : '',
          localArchiveSummary.unsyncedRecords.length > 0 ? `${localArchiveSummary.unsyncedRecords.length} local records still need sync.` : '',
          rawEditorSummary.missingSlotCount > 0 ? `${rawEditorSummary.missingSlotCount} expected scout slots are missing.` : '',
          rawEditorSummary.anomalyRowCount > 0 ? `${rawEditorSummary.anomalyRowCount} anomaly rows need review.` : ''
        ].filter(Boolean)
      };

      downloadJsonFile(
        `adminv4_safe_device_summary_${eventKey}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        payload
      );
      setLocalBackupStatus('Exported a safe device summary with counts and status only. It does not include row contents, scout names, credentials, or strategy notes.');
      await recordAdminAudit(
        'Exported safe device summary',
        'Exported count-only Admin V4 device summary without row contents, scout names, credentials, or strategy notes.',
        'info'
      );
    } catch (summaryError) {
      console.error('Failed to export safe Admin V4 summary', summaryError);
      setLocalBackupError(summaryError instanceof Error ? summaryError.message : 'Failed to export safe device summary.');
      setLocalBackupStatus('');
    }
  };

  const handleImportFullLocalBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setLocalBackupStatus('Reading full local backup for preview...');
    setLocalBackupError('');

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isAdminV4FullLocalBackup(parsed)) {
        throw new Error('This is not a REBUILT Admin V4 full local backup JSON file.');
      }

      const backupEventKey = parsed.eventKey.trim().toUpperCase();
      if (backupEventKey !== eventKey.trim().toUpperCase()) {
        throw new Error(`This backup is for ${parsed.eventKey}. Switch Admin V4 to that event before restoring it.`);
      }
      const backupPayload = getAdminV4BackupPayload(parsed);
      setBackupImportOptions({ ...DEFAULT_BACKUP_IMPORT_OPTIONS });
      setBackupImportPreview({ backup: parsed, payload: backupPayload });
      setLocalBackupStatus('Backup preview is ready. Choose the sections to restore, then confirm in the preview panel.');
    } catch (backupError) {
      console.error('Failed to preview full local Admin V4 backup', backupError);
      setLocalBackupError(backupError instanceof Error ? backupError.message : 'Failed to preview local backup.');
      setLocalBackupStatus('');
    }
  };

  const restorePreviewedFullLocalBackup = async () => {
    if (!backupImportPreview) return;
    const parsed = backupImportPreview.backup;
    const backupPayload = backupImportPreview.payload;
    const selectedCategories = (Object.keys(backupImportOptions) as BackupImportCategory[])
      .filter(category => backupImportOptions[category]);
    if (selectedCategories.length === 0) {
      setLocalBackupError('Choose at least one backup section before restoring.');
      return;
    }

    setLocalBackupStatus('Restoring selected local backup sections...');
    setLocalBackupError('');

    try {
      let scoutArchiveImported = 0;
      let scoutArchiveSkipped = 0;
      let scoutArchiveConflictsPreserved = 0;
      let scoutArchivePowerCoinItems = 0;
      if (backupImportOptions.scoutArchive && parsed.scoutArchive) {
        if (!isScoutArchiveBundle(parsed.scoutArchive)) {
          throw new Error('The embedded scout archive bundle is invalid.');
        }
        const scoutArchiveResult = await importScoutArchiveBundleLocally(parsed.scoutArchive);
        scoutArchiveImported = scoutArchiveResult.imported;
        scoutArchiveSkipped = scoutArchiveResult.skipped;
        scoutArchiveConflictsPreserved = scoutArchiveResult.conflictsPreserved;
        scoutArchivePowerCoinItems = scoutArchiveResult.powerCoinBetsImported + scoutArchiveResult.powerCoinLedgerImported;
      }

      const restoredCacheEntries = backupImportOptions.sourceCache
        ? await restoreAdminV4CacheEntries(backupPayload.cacheEntries || [])
        : 0;
      if (backupImportOptions.scoutRewards) {
        for (const bet of backupPayload.powerCoinBets || []) {
          await upsertPowerCoinBet(bet);
        }
        for (const ledgerEntry of backupPayload.powerCoinLedger || []) {
          await upsertPowerCoinLedgerEntry(ledgerEntry);
        }
      }
      if (backupImportOptions.scoutAssignments && backupPayload.scoutAssignmentPlan) {
        await saveScoutAssignmentPlan(backupPayload.scoutAssignmentPlan);
        setScoutAssignmentPlan(backupPayload.scoutAssignmentPlan);
        if (backupPayload.scoutAssignmentPlan.scoutNames?.length) {
          setScoutRosterText(backupPayload.scoutAssignmentPlan.scoutNames.join('\n'));
        }
      }
      if (backupImportOptions.modelSnapshots) {
        for (const snapshot of backupPayload.modelSnapshots || []) {
          await saveModelLabSnapshot(snapshot);
        }
        for (const featureSnapshot of backupPayload.modelFeatureSnapshots || []) {
          await saveModelFeatureSnapshot(featureSnapshot);
        }
      }
      if (backupImportOptions.uploadedTba && parsed.uploadedTbaPack) {
        saveUploadedTbaCsvPack(eventKey, parsed.uploadedTbaPack);
        setUploadedCsvPack(loadUploadedTbaCsvPack(eventKey));
      }
      const restoredPreMatchCache = backupImportOptions.preScoutCache
        ? await restoreCachedPreMatchSheet(parsed.preMatchCache)
        : false;
      if (backupImportOptions.settings && parsed.settings) {
        updateSettings({
          ownTeamNumber: parsed.settings.ownTeamNumber || settings.ownTeamNumber,
          selectedMetric: parsed.settings.selectedMetric || settings.selectedMetric,
          searchedTeamNumber: parsed.settings.searchedTeamNumber || settings.searchedTeamNumber,
          testModeEnabled: parsed.settings.testModeEnabled ?? settings.testModeEnabled,
          testModeEventKey: parsed.settings.testModeEventKey || settings.testModeEventKey,
          testModeMatchKey: parsed.settings.testModeMatchKey || settings.testModeMatchKey
        });
      }

      setLocalBackupStatus(
        `Restored selected backup sections: ${selectedCategories.map(category => BACKUP_IMPORT_CATEGORY_COPY[category].label).join(', ')}. Details: ${scoutArchiveImported} scout archive records (${scoutArchiveSkipped} skipped, ${scoutArchiveConflictsPreserved} conflict version${scoutArchiveConflictsPreserved === 1 ? '' : 's'} preserved separately), ${scoutArchivePowerCoinItems} scout reward items from archive, ${restoredCacheEntries} cache entries, ${restoredPreMatchCache ? parsed.preMatchCache?.profiles.length || 0 : 0} Pre Scout public profiles, and ${restoredPreMatchCache ? parsed.preMatchCache?.adminTaskEvidence?.length || 0 : 0} Pre Scout evidence returns. FIRST token was not imported.`
      );
      await refreshScoutOpsState();
      await refreshLocalArchiveRecords();
      setBackupImportPreview(null);
      await recordAdminAudit(
        'Imported full local backup',
        `Restored selected sections (${selectedCategories.join(', ')}): ${scoutArchiveImported} scout archive record${scoutArchiveImported === 1 ? '' : 's'}, preserved ${scoutArchiveConflictsPreserved} conflict version${scoutArchiveConflictsPreserved === 1 ? '' : 's'}, and restored ${restoredCacheEntries} cache entr${restoredCacheEntries === 1 ? 'y' : 'ies'}.`,
        'danger'
      );
    } catch (backupError) {
      console.error('Failed to import full local Admin V4 backup', backupError);
      setLocalBackupError(backupError instanceof Error ? backupError.message : 'Failed to import local backup.');
      setLocalBackupStatus('');
    }
  };

  const runSmartSearch = (rawInput = teamSearchInput) => {
    const submittedInput = rawInput.trim();
    const bestResult = getSmartSearchResults(submittedInput, 1)[0];
    if (!bestResult) {
      setTeamSearchError(`No team, tool, stat, or workflow matches "${submittedInput}". Try "scouts", "DPR", "simulator", "excel", or a team number.`);
      setIsTeamSearchOpen(true);
      return;
    }

    openSmartSearchResult(bestResult);
  };

  const runCommandPaletteSearch = (rawInput = commandPaletteInput) => {
    const submittedInput = rawInput.trim();
    const bestResult = getSmartSearchResults(submittedInput, 1)[0];
    if (!bestResult) {
      setCommandPaletteError(`No team, tool, stat, or workflow matches "${submittedInput}". Try "scouts", "DPR", "simulator", "excel", or a team number.`);
      return;
    }

    openSmartSearchResult(bestResult);
  };

  const openTeamDrilldown = (teamNumber: string, fromTab: AdminV4Tab = activeTab) => {
    const sanitizedTeamNumber = sanitizeTeamNumber(teamNumber);
    if (!sanitizedTeamNumber) return;
    rememberMainScroll();
    setDrilldownFromTab(fromTab);
    setDrilldownTeamNumber(sanitizedTeamNumber);
    updateSettings({ searchedTeamNumber: sanitizedTeamNumber });
    setActiveTab('teams');
    updateAdminRoute('sorter', null, {
      teamNumber: sanitizedTeamNumber,
      fromTab,
      matchKey: fromTab === 'predictor' ? selectedMatchKey : undefined
    });
  };

  const openSmartSearchResult = (suggestion: AdminV4SmartSearchResult) => {
    setTeamSearchInput('');
    setTeamSearchError('');
    setCommandPaletteError('');
    setIsTeamSearchOpen(false);
    setCommandPaletteOpen(false);
    setMoreWorkflowMenuOpen(false);

    if (suggestion.kind === 'team' && suggestion.teamNumber) {
      openTeamDrilldown(suggestion.teamNumber, activeTab);
      return;
    }

    if (suggestion.kind === 'panel' && suggestion.panel) {
      openDataPanel(suggestion.panel);
      return;
    }

    if (suggestion.kind === 'tool') {
      if (suggestion.tool === 'manualSimulator') openManualSimulator();
      if (suggestion.tool === 'settings') setSettingsOpen(true);
      if (suggestion.tool === 'statsWiki') openWiki('ppa', activeTab);
      return;
    }

    if (suggestion.kind === 'stat' && suggestion.statKey) {
      openWiki(suggestion.statKey as StatInfoKey, activeTab);
      return;
    }

    if (suggestion.workflowKey) {
      openWorkflow(suggestion.workflowKey);
    }
  };

  const closeTeamDrilldown = () => {
    rememberMainScroll();
    setDrilldownTeamNumber('');
    const returnTab = drilldownFromTab === 'teams' ? 'sorter' : drilldownFromTab;
    setActiveTab(returnTab);
    updateAdminRoute(
      activeWorkspaceKeyFromTab(returnTab),
      null,
      returnTab === 'simulator'
        ? { mode: 'simulator' }
        : returnTab === 'predictor' && selectedMatchKey
          ? { matchKey: selectedMatchKey }
          : undefined
    );
  };

  const buildScoutTaskReturn = () => {
    if (activeTab === 'teams' && drilldownTeamNumber) {
      return {
        returnTo: buildAdminV4Route(location.search, { tab: 'teams', team: drilldownTeamNumber }),
        returnLabel: `Team ${drilldownTeamNumber}`
      };
    }

    if (activeTab === 'predictor' && selectedMatchKey) {
      return {
        returnTo: buildAdminV4Route(location.search, { tab: 'matches', match: selectedMatchKey }),
        returnLabel: 'Match Plan'
      };
    }

    if (activeTab === 'import' && dataPanel) {
      return {
        returnTo: buildAdminV4Route(location.search, { tab: 'data', panel: dataPanel }),
        returnLabel: 'Data'
      };
    }

    if (activeTab === 'wiki') {
      const returnTo = buildAdminV4Route(location.search, {
        tab: 'wiki',
        stat: wikiStatKey,
        from: adminRouteParamFromTab(wikiReturnTab)
      });
      return {
        returnTo,
        returnLabel: 'Stats Wiki'
      };
    }

    const workflowKey = activeWorkspaceKeyFromTab(activeTab);
    return {
      returnTo: buildAdminV4Route(location.search, { tab: ADMIN_ROUTE_TAB_BY_WORKFLOW[workflowKey] }),
      returnLabel: workspaceItems.find(item => item.key === workflowKey)?.label || 'Admin V4'
    };
  };

  const openScoutWorkItem = (item: ScoutWorkItem) => {
    updateSettings({ searchedTeamNumber: item.teamNumber });
    const route = SCOUTING_MISSIONS[item.missionKey].route;
    const returnPath = buildScoutTaskReturn();
    const handoff: ScoutTaskHandoff = {
      missionKey: item.missionKey,
      teamNumber: item.teamNumber,
      teamName: item.teamName || resolvedTeamNameLookup[item.teamNumber] || '',
      eventKey,
      matchKey: item.matchKey,
      matchType: item.matchType,
      matchNumber: item.matchNumber,
      alliance: item.alliance,
      reason: item.reason,
      detail: item.detail,
      context: item.context,
      returnTo: returnPath.returnTo,
      returnLabel: returnPath.returnLabel,
      ppa: item.ppa,
      createdAt: Date.now(),
      source: 'adminv4'
    };
    saveScoutTaskHandoff(handoff);

    if (item.missionKey === 'preScout') {
      if (route) {
        navigate(buildScoutTaskHandoffPath(route, handoff));
      } else {
        openDataPanel('preScout');
      }
      return;
    }

    if (item.missionKey === 'defenseScout') {
      localStorage.setItem('match_defense_team', item.teamNumber);
      navigate(route ? buildScoutTaskHandoffPath(route, handoff) : '/defense');
      return;
    }

    navigate(route ? buildScoutTaskHandoffPath(route, handoff) : '/');
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
      const previousStatus = previous[teamNumber];
      if (status === 'available') {
        delete next[teamNumber];
      } else {
        next[teamNumber] = { status, pickedBy };
      }
      setPickStatusUndo({
        teamNumber,
        previous: previousStatus ? { ...previousStatus } : undefined,
        next: next[teamNumber] ? { ...next[teamNumber] } : undefined
      });
      return next;
    });
  };

  const requestPickStatusChange = async (
    teamNumber: string,
    status: AlliancePickRecommendation['status'],
    pickedBy = ''
  ) => {
    const statusLabel =
      status === 'available'
        ? 'clear this status'
        : status === 'picked'
          ? pickedBy === `A${allianceSeed}` ? `mark Team ${teamNumber} as our pick` : `mark Team ${teamNumber} as taken by ${pickedBy || 'another alliance'}`
          : status === 'declined'
            ? `mark Team ${teamNumber} as declined`
            : `mark Team ${teamNumber} as unavailable`;
    const needsConfirmation = status !== 'available';
    if (needsConfirmation && !(await requestAdminActionConfirmation({
      title: 'Update Pick List Status',
      message: `${statusLabel}?`,
      detail: 'This changes the live alliance-selection board on this device.',
      confirmLabel: 'Update Pick Status',
      tone: status === 'unavailable' ? 'rose' : status === 'declined' ? 'amber' : 'emerald'
    }))) {
      return false;
    }
    updatePickStatus(teamNumber, status, pickedBy);
    return true;
  };

  const undoLastPickStatusChange = () => {
    if (!pickStatusUndo) return;
    setAlliancePickStatuses(previous => {
      const next = { ...previous };
      if (pickStatusUndo.previous) {
        next[pickStatusUndo.teamNumber] = { ...pickStatusUndo.previous };
      } else {
        delete next[pickStatusUndo.teamNumber];
      }
      return next;
    });
    setPickStatusUndo(null);
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
    const confirmed = await requestAdminActionConfirmation({
      title: 'Export Full Evidence Workbook',
      message: 'Download the full Admin V4 evidence workbook?',
      detail: 'It may contain team strategy, scout names, scout reward data, raw evidence, source cache summaries, and model diagnostics. Use the audience report packs if you only need a safer handoff.',
      confirmLabel: 'Download Full Workbook',
      tone: 'amber'
    });
    if (!confirmed) return;
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
        exportedFeatureSnapshots,
        exportedPreMatchCache
      ] = await Promise.all([
        listAdminV4CacheEntries(eventKey).catch(() => []),
        listScoutArchiveRecords({ eventKey, includeDeleted: true }).catch(() => []),
        loadLatestScoutAssignmentPlan(eventKey).catch(() => null),
        listPowerCoinBets(eventKey).catch(() => []),
        listPowerCoinLedger(eventKey).catch(() => []),
        loadLatestModelLabSnapshot(eventKey).catch(() => null),
        listModelFeatureSnapshots(eventKey).catch(() => []),
        getCachedPreMatchSheet(eventKey).catch(() => null)
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
        'Pre-Match Blend': noFutureBlendLookup,
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
          'Pre-Match Blend': noFutureBlendLookup,
          EPA: epaRatings,
          'Recency EPA': epaRatings
        }
      });
      const bonusMetricLookup = buildScoutedBonusMetricLookup(records, v4Records);
      const strategyPlans = buildStrategyMatchPlans(activePredictorMatches, activeMetricRatings, defenseImpactLookup, bonusMetricLookup, bestModelForecastLayer);
      const allianceRecommendations = buildAlliancePickRecommendations(teamProfiles, allianceSeed, alliancePickStatuses, ownTeamNumber);
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
      const predictorMatchByKey = new Map(activePredictorMatches.map(match => [match.key, match]));
      const sortForecastLedgerTeams = (left: string, right: string) => {
        const leftNumber = Number(left);
        const rightNumber = Number(right);
        if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
          return leftNumber - rightNumber;
        }
        return left.localeCompare(right, undefined, { numeric: true });
      };
      const formatForecastLedgerMetric = (value: number | null | undefined, digits = 1) =>
        value == null || !Number.isFinite(value) ? 'n/a' : value.toFixed(digits);
      const getForecastLedgerActualResult = (matchKey: string) => {
        const match = predictorMatchByKey.get(matchKey);
        if (!match || !isPlayedMatch(match)) return { actualWinner: '', actualScore: '' };
        return {
          actualWinner: getPlayedMatchWinner(match),
          actualScore: `${match.alliances.red.score}-${match.alliances.blue.score}`
        };
      };
      const selectForecastLedgerFeatures = (
        teams: string[],
        featuresByTeam: Record<string, Record<string, number>>
      ) =>
        Object.fromEntries(
          Array.from(new Set(teams)).sort(sortForecastLedgerTeams).map(teamNumber => [
            teamNumber,
            featuresByTeam[teamNumber] || {}
          ])
        );
      const summarizeForecastLedgerTeams = (
        teams: string[],
        featuresByTeam: Record<string, Record<string, number>>
      ) =>
        teams.map(teamNumber => {
          const features = featuresByTeam[teamNumber] || {};
          const teamName = resolvedTeamNameLookup[teamNumber] || '';
          return [
            `${teamNumber}${teamName ? ` ${teamName}` : ''}`,
            `PPC ${formatForecastLedgerMetric(features.ppcBefore ?? features.ppc)}`,
            `PPA ${formatForecastLedgerMetric(features.ppa)}`,
            `OPR ${formatForecastLedgerMetric(features.oprBefore ?? features.opr)}`,
            `${formatForecastLedgerMetric(features.scoutingRowsBefore ?? features.matchesPlayed, 0)} scout rows`,
            `${formatForecastLedgerMetric(features.officialMatchesBefore ?? features.matchesPlayed, 0)} official matches`
          ].join(' / ');
        }).join(' | ');
      const forecastLedgerRows: Record<string, unknown>[] = exportedFeatureSnapshots.flatMap((snapshot): Record<string, unknown>[] => {
        const snapshotCreatedAt = new Date(snapshot.createdAt).toISOString();
        const forecastRows = (snapshot.forecastSnapshots || []).map(forecast => {
          const teams = [...forecast.redTeams, ...forecast.blueTeams];
          const forecastFeaturesByTeam = selectForecastLedgerFeatures(teams, snapshot.featuresByTeam);
          const actualResult = getForecastLedgerActualResult(forecast.matchKey);
          return {
            rowKind: 'Forecast Snapshot',
            snapshotId: snapshot.id,
            snapshotCreatedAt,
            modelName: forecast.modelName || snapshot.modelName,
            modelSource: forecast.modelSource || snapshot.modelSource || '',
            beforeMatchKey: snapshot.beforeMatchKey,
            forecastScope: 'Practice/Qualification',
            matchKey: forecast.matchKey,
            matchLevel: forecast.compLevel ? getCompLevelLabel(forecast.compLevel) : '',
            matchTitle: forecast.matchTitle || '',
            matchNumber: forecast.matchNumber,
            scheduledAt: formatWorksheetDate(forecast.scheduledTime ?? null),
            redTeams: forecast.redTeams.join(', '),
            blueTeams: forecast.blueTeams.join(', '),
            predictedWinner: forecast.predictedWinner || '',
            redPredictedScore: forecast.redPredictedScore ?? '',
            bluePredictedScore: forecast.bluePredictedScore ?? '',
            predictionLowConfidence: forecast.lowConfidence == null ? '' : forecast.lowConfidence ? 'yes' : 'no',
            actualWinner: actualResult.actualWinner,
            actualScore: actualResult.actualScore,
            knownTeamCount: Object.values(forecastFeaturesByTeam).filter(features => Object.keys(features).length > 0).length,
            redBeforeSummary: summarizeForecastLedgerTeams(forecast.redTeams, forecastFeaturesByTeam),
            blueBeforeSummary: summarizeForecastLedgerTeams(forecast.blueTeams, forecastFeaturesByTeam),
            knownTeams: Object.keys(forecastFeaturesByTeam).sort(sortForecastLedgerTeams).join(', '),
            featureJson: stringifyForWorkbookCell(forecastFeaturesByTeam)
          };
        });
        if (forecastRows.length > 0) return forecastRows;

        const beforeMatchRows = (snapshot.matchSnapshots || []).map(matchSnapshot => {
          const actualResult = getForecastLedgerActualResult(matchSnapshot.matchKey);
          const scheduledMatch = predictorMatchByKey.get(matchSnapshot.matchKey);
          return {
            rowKind: 'Before-Match Input Snapshot',
            snapshotId: snapshot.id,
            snapshotCreatedAt,
            modelName: snapshot.modelName,
            modelSource: snapshot.modelSource || '',
            beforeMatchKey: snapshot.beforeMatchKey,
            forecastScope: 'Before-match inputs',
            matchKey: matchSnapshot.matchKey,
            matchLevel: scheduledMatch ? getCompLevelLabel(scheduledMatch.comp_level) : '',
            matchTitle: scheduledMatch ? getAdminV4MatchLabel(scheduledMatch) : '',
            matchNumber: matchSnapshot.matchNumber,
            scheduledAt: '',
            redTeams: matchSnapshot.redTeams.join(', '),
            blueTeams: matchSnapshot.blueTeams.join(', '),
            predictedWinner: '',
            redPredictedScore: '',
            bluePredictedScore: '',
            predictionLowConfidence: '',
            actualWinner: actualResult.actualWinner,
            actualScore: actualResult.actualScore,
            knownTeamCount: Object.keys(matchSnapshot.featuresByTeam).length,
            redBeforeSummary: summarizeForecastLedgerTeams(matchSnapshot.redTeams, matchSnapshot.featuresByTeam),
            blueBeforeSummary: summarizeForecastLedgerTeams(matchSnapshot.blueTeams, matchSnapshot.featuresByTeam),
            knownTeams: Object.keys(matchSnapshot.featuresByTeam).sort(sortForecastLedgerTeams).join(', '),
            featureJson: stringifyForWorkbookCell(matchSnapshot.featuresByTeam)
          };
        });
        if (beforeMatchRows.length > 0) return beforeMatchRows;

        return [{
          rowKind: 'Team Feature Snapshot',
          snapshotId: snapshot.id,
          snapshotCreatedAt,
          modelName: snapshot.modelName,
          modelSource: snapshot.modelSource || '',
          beforeMatchKey: snapshot.beforeMatchKey,
          forecastScope: 'Team features',
          matchKey: '',
          matchLevel: '',
          matchTitle: '',
          matchNumber: '',
          scheduledAt: '',
          redTeams: '',
          blueTeams: '',
          predictedWinner: '',
          redPredictedScore: '',
          bluePredictedScore: '',
          predictionLowConfidence: '',
          actualWinner: '',
          actualScore: '',
          knownTeamCount: Object.keys(snapshot.featuresByTeam).length,
          redBeforeSummary: '',
          blueBeforeSummary: '',
          knownTeams: Object.keys(snapshot.featuresByTeam).sort(sortForecastLedgerTeams).join(', '),
          featureJson: stringifyForWorkbookCell(snapshot.featuresByTeam)
        }];
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
      const adminTaskWorkbookColumns = [
        { header: 'Admin Task Source', key: 'adminTaskSource', width: 16 },
        { header: 'Admin Task Mission', key: 'adminTaskMission', width: 18 },
        { header: 'Admin Task Team', key: 'adminTaskTeam', width: 22 },
        { header: 'Admin Task Match', key: 'adminTaskMatch', width: 18 },
        { header: 'Admin Task Reason', key: 'adminTaskReason', width: 24 },
        { header: 'Admin Task Context', key: 'adminTaskContext', width: 36 },
        { header: 'Admin Task Detail', key: 'adminTaskDetail', width: 42 },
        { header: 'Admin Task Expected Range', key: 'adminTaskPpaRange', width: 26 },
        { header: 'Task Range Expected', key: 'adminTaskPpaExpected', width: 20 },
        { header: 'Task Range Floor', key: 'adminTaskPpaFloor', width: 18 },
        { header: 'Task Range Ceiling', key: 'adminTaskPpaCeiling', width: 18 },
        { header: 'Task Range Normal Low', key: 'adminTaskPpaNormalLow', width: 22 },
        { header: 'Task Range Normal High', key: 'adminTaskPpaNormalHigh', width: 22 },
        { header: 'Task Range Role', key: 'adminTaskPpaRole', width: 18 },
        { header: 'Task Range Uncertainty', key: 'adminTaskPpaUncertainty', width: 22 },
        { header: 'Task Range Tail Risk', key: 'adminTaskPpaTailRisk', width: 22 },
        { header: 'Task Range Scout Trust', key: 'adminTaskPpaScoutConfidence', width: 24 },
        { header: 'Task Range Coverage', key: 'adminTaskPpaCoverage', width: 22 },
        { header: 'Task Range Model', key: 'adminTaskPpaModel', width: 18 },
        { header: 'Task Range Asks', key: 'adminTaskPpaAsks', width: 46 },
        { header: 'Task Range Warnings', key: 'adminTaskPpaWarnings', width: 46 },
        { header: 'Admin Task Created', key: 'adminTaskCreatedAt', width: 24 },
        { header: 'Admin Task Captured', key: 'adminTaskCapturedAt', width: 24 }
      ];
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
          ...flattenScoutEvidenceAdminTaskForExport(record.adminTask),
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
          ...flattenScoutEvidenceAdminTaskForExport(),
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
          ...flattenScoutEvidenceAdminTaskForExport(record.adminTask),
          rawPayloadJson: stringifyForWorkbookCell(record)
        })),
        ...(exportedPreMatchCache?.adminTaskEvidence || []).map(evidence => ({
          recordType: 'Pre Scout Evidence',
          schemaVersion: 'pre-scout-cache',
          eventKey: evidence.eventKey || eventKey,
          matchType: 'Pre Scout',
          matchNumber: '',
          matchKey: '',
          teamNumber: evidence.teamNumber,
          teamName: evidence.teamName || resolvedTeamNameLookup[evidence.teamNumber] || '',
          scoutName: 'Pre Scout cache',
          assignedScoutName: '',
          assignedSlot: '',
          substituteScoutName: '',
          alliance: '',
          sourceCollection: 'preMatchCache.adminTaskEvidence',
          timestamp: formatWorksheetDate(evidence.capturedAt || evidence.task.capturedAt || evidence.task.createdAt),
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
          defenseMetricPercent: '',
          defenseComments: '',
          generalComments: [
            evidence.profileAvailable ? 'Public context available' : 'Public context missing',
            evidence.qualificationStatus || '',
            evidence.qualificationReason || ''
          ].filter(Boolean).join(' | '),
          notes: [
            ...evidence.missingFromTba.map(item => `Missing: ${item}`),
            ...evidence.manualRequired.map(item => `Manual: ${item}`)
          ].join(' | '),
          strategyNotes: 'Pre Scout returned evidence before local pit/match rows existed.',
          ...getMetricExportFields(evidence.teamNumber),
          ...flattenScoutEvidenceAdminTaskForExport(evidence.task),
          rawPayloadJson: stringifyForWorkbookCell(evidence)
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
        { field: 'Report Metric Context', value: MODEL_LABELS[selectedMetric] },
        { field: 'Test Mode', value: testModeActive ? `Active before ${testModeSelectedMatchLabel}` : settings.testModeEnabled ? 'Enabled, no selected cutoff match' : 'Off' },
        { field: 'Test Mode Scoped Rows', value: testModeActive ? `${testModeScope.scopedRecordCount}/${testModeScope.sourceRecordCount}` : '' },
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
        { field: 'Pre Scout Cached Profiles', value: exportedPreMatchCache?.profiles.length || 0 },
        { field: 'Pre Scout Admin Task Evidence', value: exportedPreMatchCache?.adminTaskEvidence?.length || 0 },
        { field: 'Pre Scout Cache Timestamp', value: exportedPreMatchCache?.cachedAt ? new Date(exportedPreMatchCache.cachedAt).toISOString() : '' },
        { field: 'Source Freshness Rows', value: sourceStatusRows.length },
        { field: 'Latest Source Freshness', value: sourceStatusSummary.latestTimestamp ? new Date(sourceStatusSummary.latestTimestamp).toISOString() : '' },
        { field: 'Latest Scout Assignment Plan', value: exportedScoutPlan ? new Date(exportedScoutPlan.createdAt).toISOString() : '' },
        { field: 'Latest Model Snapshot', value: exportedModelSnapshot ? new Date(exportedModelSnapshot.createdAt).toISOString() : '' },
        { field: 'Model Feature Snapshots', value: exportedFeatureSnapshots.length },
        { field: 'Scout Reward Predictions', value: exportedPowerCoinBets.length },
        { field: 'Rewarded Scouts', value: exportedPowerCoinScouts.length },
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
        { header: 'Expected Range', key: 'ppa', width: 16 },
        { header: 'Range Expected', key: 'ppaExpected', width: 16 },
        { header: 'Range Floor', key: 'ppaFloor', width: 14 },
        { header: 'Range Ceiling', key: 'ppaCeiling', width: 14 },
        { header: 'Range Normal Low', key: 'ppaNormalLow', width: 18 },
        { header: 'Range Normal High', key: 'ppaNormalHigh', width: 18 },
        { header: 'Range Role Fit', key: 'ppaRoleFit', width: 16 },
        { header: 'Range Uncertainty', key: 'ppaUncertainty', width: 18 },
        { header: 'Range Tail Risk', key: 'ppaTailRisk', width: 18 },
        { header: 'Range Scout Trust', key: 'ppaScoutConfidence', width: 22 },
        { header: 'Range Coverage', key: 'ppaCoverage', width: 22 },
        { header: 'Defense Impact', key: 'defenseImpact', width: 16 },
        { header: 'TBA Rank', key: 'tbaRank', width: 12 },
        ...adminTaskWorkbookColumns,
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
        { header: 'Device ID', key: 'deviceId', width: 24 },
        ...adminTaskWorkbookColumns
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
          deviceId: record.deviceId || '',
          ...flattenScoutEvidenceAdminTaskForExport(record.adminTask)
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
        ...adminTaskWorkbookColumns,
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
        ...flattenScoutEvidenceAdminTaskForExport(getScoutEvidenceAdminTaskFromPayload(record.payload)),
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
        { header: 'Device ID', key: 'deviceId', width: 24 },
        ...adminTaskWorkbookColumns
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
          deviceId: record.deviceId || '',
          ...flattenScoutEvidenceAdminTaskForExport(record.adminTask)
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
        { header: 'Range Expected', key: 'ppaExpected', width: 16 },
        { header: 'Range Floor', key: 'ppaFloor', width: 14 },
        { header: 'Range Ceiling', key: 'ppaCeiling', width: 14 },
        { header: 'Range Normal Low', key: 'ppaNormalLow', width: 18 },
        { header: 'Range Normal High', key: 'ppaNormalHigh', width: 18 },
        { header: 'Range Role Fit', key: 'ppaRoleFit', width: 16 },
        { header: 'Range Uncertainty', key: 'ppaUncertainty', width: 18 },
        { header: 'Range Tail Risk', key: 'ppaTailRisk', width: 18 },
        { header: 'Range Scout Trust', key: 'ppaScoutConfidence', width: 22 },
        { header: 'Range Coverage', key: 'ppaCoverage', width: 22 }
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

      addWorkbookSheet(workbook, 'Range Insights', [
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Expected Value', key: 'expectedPpa', width: 14 },
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
      addQualificationProjectionSheet(workbook, 'Range Ranking', ppaQualificationProjection.rows, resolvedTeamNameLookup);
      addQualificationProjectionSheet(workbook, 'EPA Ranking', epaQualificationProjection.rows, resolvedTeamNameLookup);
      addQualificationProjectionSheet(workbook, 'OPR Ranking', oprQualificationProjection.rows, resolvedTeamNameLookup);

      addQualPredictionSheet(workbook, 'PPC Quals', ppcPredictions);
      addQualPredictionSheet(workbook, 'Range Quals', ppaPredictions, exportPpaInsightsByTeam);
      addQualPredictionSheet(workbook, 'EPA Quals', epaPredictions);
      addQualPredictionSheet(workbook, 'OPR Quals', oprPredictions);
      addQualPredictionSheet(workbook, 'Best Validated Quals', bestValidatedQualRows, exportPpaInsightsByTeam);

      addFinalsProjectionSheet(workbook, 'PPC Finals', ppcFinalsProjection);
      addFinalsProjectionSheet(workbook, 'EPA Finals', epaFinalsProjection);
      addFinalsProjectionSheet(workbook, 'OPR Finals', oprFinalsProjection);

      addWorkbookSheet(workbook, 'Model Validation', [
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

      addWorkbookSheet(workbook, 'Trust Calibration', [
        { header: 'Model', key: 'modelName', width: 18 },
        { header: 'Confidence Bin', key: 'binLabel', width: 18 },
        { header: 'Min Confidence', key: 'minConfidence', width: 16 },
        { header: 'Max Confidence', key: 'maxConfidence', width: 16 },
        { header: 'Matches', key: 'matches', width: 12 },
        { header: 'Predicted Win Rate', key: 'predictedWinRate', width: 20 },
        { header: 'Actual Win Rate', key: 'actualWinRate', width: 18 },
        { header: 'Calibration Gap', key: 'calibrationGap', width: 18 }
      ], modelBacktests.flatMap(row => row.calibrationBins.map(bin => ({ ...bin }))));

      addWorkbookSheet(workbook, 'Forecast Ledger', [
        { header: 'Row Kind', key: 'rowKind', width: 24 },
        { header: 'Snapshot ID', key: 'snapshotId', width: 30 },
        { header: 'Snapshot Created At', key: 'snapshotCreatedAt', width: 24 },
        { header: 'Model', key: 'modelName', width: 18 },
        { header: 'Model Source', key: 'modelSource', width: 44 },
        { header: 'Snapshot Before Match', key: 'beforeMatchKey', width: 22 },
        { header: 'Forecast Scope', key: 'forecastScope', width: 24 },
        { header: 'Match', key: 'matchKey', width: 18 },
        { header: 'Match Level', key: 'matchLevel', width: 18 },
        { header: 'Match Title', key: 'matchTitle', width: 16 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'Scheduled At', key: 'scheduledAt', width: 24 },
        { header: 'Red Teams', key: 'redTeams', width: 24 },
        { header: 'Blue Teams', key: 'blueTeams', width: 24 },
        { header: 'Predicted Winner', key: 'predictedWinner', width: 18 },
        { header: 'Red Predicted Score', key: 'redPredictedScore', width: 20 },
        { header: 'Blue Predicted Score', key: 'bluePredictedScore', width: 20 },
        { header: 'Low Confidence', key: 'predictionLowConfidence', width: 16 },
        { header: 'Actual Winner', key: 'actualWinner', width: 16 },
        { header: 'Actual Score', key: 'actualScore', width: 16 },
        { header: 'Known Team Count', key: 'knownTeamCount', width: 18 },
        { header: 'Red Before Summary', key: 'redBeforeSummary', width: 72 },
        { header: 'Blue Before Summary', key: 'blueBeforeSummary', width: 72 },
        { header: 'Known Teams', key: 'knownTeams', width: 42 },
        { header: 'Feature JSON', key: 'featureJson', width: 90 }
      ], forecastLedgerRows);

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
      addWorkbookSheet(workbook, 'Model Inputs', [
        { header: 'Snapshot ID', key: 'snapshotId', width: 28 },
        { header: 'Created At', key: 'createdAt', width: 24 },
        { header: 'Model', key: 'modelName', width: 18 },
        { header: 'Before Match', key: 'beforeMatchKey', width: 16 },
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        ...featureKeys.map(key => ({ header: key, key, width: 16 }))
      ], exportedFeatureRows);

      addWorkbookSheet(workbook, 'Before-Match Inputs', [
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
        { header: 'Expected Range', key: 'ppa', width: 16 },
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
        { header: 'Range Context', key: 'ppa', width: 16 }
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
        { header: 'Alliance Seed', key: 'allianceSeed', width: 14 },
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Score', key: 'score', width: 14 },
        { header: 'Seed Fit', key: 'seedFit', width: 24 },
        { header: 'Role Fit', key: 'roleFit', width: 28 },
        { header: 'Range Expected', key: 'ppaExpected', width: 16 },
        { header: 'Range Floor', key: 'ppaFloor', width: 14 },
        { header: 'Range Ceiling', key: 'ppaCeiling', width: 14 },
        { header: 'Range Normal Low', key: 'ppaNormalLow', width: 18 },
        { header: 'Range Normal High', key: 'ppaNormalHigh', width: 18 },
        { header: 'Range Role', key: 'ppaRole', width: 18 },
        { header: 'Defense Impact', key: 'defenseImpact', width: 16 },
        { header: 'Range Uncertainty', key: 'ppaUncertainty', width: 18 },
        { header: 'Range Tail Risk', key: 'ppaTailRisk', width: 18 },
        { header: 'Scout Confidence', key: 'scoutConfidence', width: 18 },
        { header: 'Range Coverage', key: 'ppaCoverage', width: 22 },
        { header: 'Risk Notes', key: 'riskNotes', width: 60 },
        { header: 'Scout Check', key: 'scoutCheck', width: 22 },
        { header: 'Scout Check Reason', key: 'scoutCheckReason', width: 28 },
        { header: 'Scout Check Detail', key: 'scoutCheckDetail', width: 64 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Picked By', key: 'pickedBy', width: 16 },
        { header: 'Rationale', key: 'rationale', width: 70 }
      ], allianceRecommendations.map(row => {
        const insight = exportPpaInsightsByTeam[row.teamNumber];
        const status = teamEvidenceByTeam[row.teamNumber];
        const roleLabel = insight?.role.label || row.roleFit;
        const needsDefenseRead =
          (status?.defenseRows ?? 0) === 0 &&
          (roleLabel === 'Defender' || roleLabel === 'Flex' || (insight?.components.defenseImpact ?? 0) > 4);
        const scoutCheckMission =
          (status?.pitRows ?? 0) === 0
            ? 'Pit Scout'
            : needsDefenseRead
              ? 'Defense Scout'
              : 'Match Scout';
        const scoutCheckReason =
          (status?.pitRows ?? 0) === 0
            ? ((status?.preScoutRows ?? 0) > 0 ? 'pit interview missing' : 'verify pick prior')
            : needsDefenseRead
              ? 'verify defense value'
              : insight?.tailRisk.level === 'High' || insight?.uncertainty.level === 'High'
                ? 'verify pick risk'
                : 'confirm pick fit';
        return {
          ...row,
          allianceSeed: `A${allianceSeed}`,
          teamName: resolvedTeamNameLookup[row.teamNumber] || insight?.teamName || '',
          ppaExpected: insight?.projected.expected ?? '',
          ppaFloor: insight?.projected.floor ?? '',
          ppaCeiling: insight?.projected.ceiling ?? '',
          ppaNormalLow: insight?.projected.normalLow ?? '',
          ppaNormalHigh: insight?.projected.normalHigh ?? '',
          ppaRole: roleLabel,
          defenseImpact: insight?.components.defenseImpact ?? '',
          ppaUncertainty: insight?.uncertainty.level ?? '',
          ppaTailRisk: insight?.tailRisk.label ?? '',
          scoutConfidence: insight ? Number((insight.coverage.scoutConfidence * 100).toFixed(0)) : '',
          ppaCoverage: insight?.coverage.label ?? '',
          riskNotes: insight
            ? [...insight.warnings, ...insight.uncertainty.reasons, ...insight.tailRisk.reasons].filter(Boolean).join(' | ')
            : '',
          scoutCheck: scoutCheckMission,
          scoutCheckReason,
          scoutCheckDetail: status?.attentionReasons.length
            ? `Close evidence gap: ${status.attentionReasons.join(', ')}.`
            : 'Verify role, reliability, and whether the range-based pick lane is trustworthy.',
          pickedBy: row.pickedBy || ''
        };
      }));

      const describePreScoutMissingContext = (profile: PreMatchTeamProfile) => [
        profile.mediaAssets.length === 0 ? 'robot media' : '',
        profile.robotMetadata.length === 0 ? 'robot registry' : '',
        profile.seasonAwards.length === 0 ? 'season awards' : '',
        profile.seasonEvents.length === 0 ? 'season results' : '',
        !profile.districtStanding ? 'district standing' : '',
        profile.qualificationStatus === 'unknown' ? 'champs qualification flag' : ''
      ].filter(Boolean).join(' | ');
      addWorkbookSheet(workbook, 'Pre Scout Cache', [
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Cached At', key: 'cachedAt', width: 24 },
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Location', key: 'location', width: 28 },
        { header: 'Qualification', key: 'qualificationStatus', width: 18 },
        { header: 'Qualification Reason', key: 'qualificationReason', width: 48 },
        { header: 'Qualification Source', key: 'qualificationSource', width: 20 },
        { header: 'Media Count', key: 'mediaCount', width: 12 },
        { header: 'Robot Registry Count', key: 'robotMetadataCount', width: 20 },
        { header: 'Award Count', key: 'awardCount', width: 12 },
        { header: 'Season Event Count', key: 'seasonEventCount', width: 18 },
        { header: 'District Rank', key: 'districtRank', width: 14 },
        { header: 'District Points', key: 'districtPoints', width: 16 },
        { header: 'Missing Public Context', key: 'missingPublicContext', width: 46 },
        { header: 'Human Follow-Up', key: 'humanFollowUp', width: 56 },
        { header: 'Raw Profile JSON', key: 'rawProfileJson', width: 80 }
      ], (exportedPreMatchCache?.profiles || [])
        .sort((left, right) => Number(left.teamNumber) - Number(right.teamNumber))
        .map(profile => ({
          eventKey: exportedPreMatchCache?.eventKey || eventKey,
          cachedAt: exportedPreMatchCache?.cachedAt ? new Date(exportedPreMatchCache.cachedAt).toISOString() : '',
          teamNumber: profile.teamNumber,
          teamName: profile.nickname,
          location: profile.location,
          qualificationStatus: profile.qualificationStatus,
          qualificationReason: profile.qualificationReason,
          qualificationSource: profile.qualificationSource,
          mediaCount: profile.mediaAssets.length,
          robotMetadataCount: profile.robotMetadata.length,
          awardCount: profile.seasonAwards.length,
          seasonEventCount: profile.seasonEvents.length,
          districtRank: profile.districtStanding?.rank ?? '',
          districtPoints: profile.districtStanding?.totalPoints ?? '',
          missingPublicContext: describePreScoutMissingContext(profile),
          humanFollowUp: [
            profile.mediaAssets.length === 0 ? 'Pit photo/specs' : '',
            profile.robotMetadata.length === 0 ? 'Robot architecture' : '',
            profile.seasonEvents.length === 0 ? 'Early match verification' : '',
            profile.qualificationStatus === 'unknown' ? 'Manual qualification context' : ''
          ].filter(Boolean).join(' | '),
	          rawProfileJson: stringifyForWorkbookCell(profile)
	        })));

      addWorkbookSheet(workbook, 'Pre Scout Evidence', [
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Captured At', key: 'capturedAt', width: 24 },
        { header: 'Profile Available', key: 'profileAvailable', width: 18 },
        { header: 'Qualification', key: 'qualificationStatus', width: 18 },
        { header: 'Qualification Reason', key: 'qualificationReason', width: 46 },
        { header: 'Missing From TBA', key: 'missingFromTba', width: 56 },
        { header: 'Manual Required', key: 'manualRequired', width: 56 },
        ...adminTaskWorkbookColumns
      ], (exportedPreMatchCache?.adminTaskEvidence || [])
        .sort((left, right) => (right.capturedAt || 0) - (left.capturedAt || 0))
        .map(evidence => ({
          eventKey: evidence.eventKey,
          teamNumber: evidence.teamNumber,
          teamName: evidence.teamName || '',
          capturedAt: evidence.capturedAt ? new Date(evidence.capturedAt).toISOString() : '',
          profileAvailable: evidence.profileAvailable ? 'Yes' : 'No',
          qualificationStatus: evidence.qualificationStatus || '',
          qualificationReason: evidence.qualificationReason || '',
          missingFromTba: (evidence.missingFromTba || []).join(' | '),
          manualRequired: (evidence.manualRequired || []).join(' | '),
          ...flattenScoutEvidenceAdminTaskForExport(evidence.task)
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

      addWorkbookSheet(workbook, 'Scout Rewards', [
        { header: 'Scout', key: 'scoutName', width: 18 },
        { header: 'Balance', key: 'balance', width: 12 },
        { header: 'Open Reward Predictions', key: 'openBets', width: 24 },
        { header: 'Settled Reward Predictions', key: 'settledBets', width: 26 },
        { header: 'Total Allocated', key: 'totalStaked', width: 16 },
        { header: 'Total Returned', key: 'totalPayout', width: 16 },
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

      addWorkbookSheet(workbook, 'Reward Ledger', [
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

      addWorkbookSheet(workbook, 'Reward Predictions', [
        { header: 'Event Key', key: 'eventKey', width: 14 },
        { header: 'Match Type', key: 'matchType', width: 16 },
        { header: 'Match Number', key: 'matchNumber', width: 14 },
        { header: 'Match Key', key: 'matchKey', width: 18 },
        { header: 'Scout', key: 'scoutName', width: 18 },
        { header: 'Side', key: 'side', width: 10 },
        { header: 'Allocated Points', key: 'amount', width: 18 },
        { header: 'Placed At', key: 'placedAt', width: 24 },
        { header: 'Settled At', key: 'settledAt', width: 24 },
        { header: 'Outcome', key: 'outcome', width: 12 },
        { header: 'Returned Points', key: 'payout', width: 18 }
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
  const activeWorkspace = workspaceItems.find(item =>
    item.key === activeWorkspaceKey &&
    (activeWorkspaceKey === 'import' ? (item.panel || null) === (dataPanel || null) : !item.panel)
  ) ?? workspaceItems.find(item => item.key === activeWorkspaceKey && !item.panel) ?? workspaceItems[0]!;

  const queueBackgroundRefreshForWorkflow = (tab: WorkflowTab) => {
    if (loading || backgroundRefreshing) {
      pendingBackgroundRefreshTabRef.current = tab;
      return;
    }
    const now = Date.now();
    const refreshKey = `${eventKey}:${effectiveTbaApiKey ? 'api' : 'cached'}:${tab}`;
    const lastRefreshStartedAt = tabRefreshCooldownRef.current[refreshKey] || 0;
    if (now - lastRefreshStartedAt < 15000) return;
    tabRefreshCooldownRef.current[refreshKey] = now;
    window.setTimeout(() => {
      void loadV3Data({ background: true, preserveScroll: true });
    }, 0);
  };

  useEffect(() => {
    if (loading || backgroundRefreshing) return;
    const pendingTab = pendingBackgroundRefreshTabRef.current;
    if (!pendingTab) return;
    pendingBackgroundRefreshTabRef.current = null;
    queueBackgroundRefreshForWorkflow(pendingTab);
  }, [backgroundRefreshing, effectiveTbaApiKey, eventKey, loading]);

  const updateAdminRoute = (
    tab: WorkflowTab,
    panel?: DataPanel | null,
    options?: { mode?: 'simulator'; matchKey?: string; teamNumber?: string; fromTab?: AdminV4Tab }
  ) => {
    const from = options?.fromTab && options.fromTab !== 'sorter' && options.fromTab !== 'teams' && options.fromTab !== 'wiki'
      ? adminRouteParamFromTab(options.fromTab)
      : null;
    const match = tab === 'predictor'
      ? options?.matchKey || null
      : tab === 'sorter' && options?.fromTab === 'predictor'
        ? options.matchKey || null
        : null;
    const route = buildAdminV4Route(location.search, {
      tab: ADMIN_ROUTE_TAB_BY_WORKFLOW[tab],
      panel: tab === 'import' ? panel || null : null,
      mode: tab === 'predictor' ? options?.mode || null : null,
      match,
      team: tab === 'sorter' ? options?.teamNumber || null : null,
      from
    });
    navigate(route, { replace: true });
  };

  const updateWikiRoute = (statKey: StatInfoKey, fromTab: AdminV4Tab) => {
    const route = buildAdminV4Route(location.search, {
      tab: 'wiki',
      stat: statKey,
      from: adminRouteParamFromTab(fromTab),
      match: fromTab === 'predictor' && selectedMatchKey ? selectedMatchKey : null,
      team: fromTab === 'teams' && drilldownTeamNumber ? drilldownTeamNumber : null
    });
    navigate(route, { replace: true });
  };

  const openWorkflow = (tab: WorkflowTab) => {
    rememberMainScroll();
    if (tab !== 'export') {
      setReportsSpotlightPackKey('');
    }
    setActiveTab(tab);
    setDrilldownTeamNumber('');
    setSelectedMatchKey('');
    setDataPanel(null);
    setInfoMenu(null);
    setMoreWorkflowMenuOpen(false);
    updateAdminRoute(tab);
    queueBackgroundRefreshForWorkflow(tab);
  };

  const openDataPanel = (panel: DataPanel) => {
    rememberMainScroll();
    setReportsSpotlightPackKey('');
    setActiveTab('import');
    setDrilldownTeamNumber('');
    setSelectedMatchKey('');
    setInfoMenu(null);
    setDataPanel(panel);
    updateAdminRoute('import', panel);
    queueBackgroundRefreshForWorkflow('import');
  };

  const openWorkflowItem = (item: AdminWorkflowItem<WorkflowTab>) => {
    const panel = item.panel ? dataPanelFromAdminRouteParam(item.panel) : null;
    if (item.key === 'import' && panel) {
      openDataPanel(panel);
      return;
    }
    if (item.key === 'export') {
      setReportsSpotlightPackKey('');
    }
    openWorkflow(item.key);
  };

  const closeDataPanel = () => {
    rememberMainScroll();
    setActiveTab('import');
    setDrilldownTeamNumber('');
    setSelectedMatchKey('');
    setInfoMenu(null);
    setDataPanel(null);
    updateAdminRoute('import');
  };

  const openMatchPlan = (matchKey: string) => {
    rememberMainScroll();
    setActiveTab('predictor');
    setDrilldownTeamNumber('');
    setDataPanel(null);
    setInfoMenu(null);
    setSelectedMatchKey(matchKey);
    updateAdminRoute('predictor', null, { matchKey });
    queueBackgroundRefreshForWorkflow('predictor');
  };

  const openManualSimulator = () => {
    rememberMainScroll();
    setActiveTab('simulator');
    setDrilldownTeamNumber('');
    setDataPanel(null);
    setInfoMenu(null);
    setSelectedMatchKey('');
    updateAdminRoute('predictor', null, { mode: 'simulator' });
    queueBackgroundRefreshForWorkflow('predictor');
  };

  const openWiki = (statKey: StatInfoKey, fromTab: AdminV4Tab = activeTab) => {
    const returnTab = fromTab === 'wiki' ? wikiReturnTab : fromTab;
    rememberMainScroll();
    setWikiStatKey(statKey);
    setWikiReturnTab(returnTab);
    setInfoMenu(null);
    setActiveTab('wiki');
    updateWikiRoute(statKey, returnTab);
  };

  const openInfoMenu = (event: React.MouseEvent, statKey: StatInfoKey) => {
    event.preventDefault();
    setInfoMenu({ x: event.clientX, y: event.clientY, statKey });
  };

  useEffect(() => {
    const isEditableShortcutTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    };

    const handleDemoShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== 'd'
        || !event.shiftKey
        || event.metaKey
        || event.ctrlKey
        || event.altKey
        || isEditableShortcutTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      setReportsSpotlightPackKey('demo-proof');
      openWorkflow('export');
    };

    window.addEventListener('keydown', handleDemoShortcut);
    return () => window.removeEventListener('keydown', handleDemoShortcut);
  }, [openWorkflow]);

  const handleAdminBack = () => {
    rememberMainScroll();
    if (activeTab === 'wiki') {
      const returnTab = wikiReturnTab === 'wiki' ? 'command' : wikiReturnTab;
      setActiveTab(returnTab);
      if (returnTab === 'teams' && drilldownTeamNumber) {
        updateAdminRoute('sorter', null, { teamNumber: drilldownTeamNumber });
        return;
      }
      updateAdminRoute(
        activeWorkspaceKeyFromTab(returnTab),
        null,
        returnTab === 'simulator'
          ? { mode: 'simulator' }
          : returnTab === 'predictor' && selectedMatchKey
            ? { matchKey: selectedMatchKey }
            : undefined
      );
      return;
    }

    if (drilldownTeamNumber && activeTab === 'teams') {
      closeTeamDrilldown();
      return;
    }

    if (selectedMatchKey && activeTab === 'predictor') {
      openWorkflow('predictor');
      return;
    }

    if (dataPanel && activeTab === 'import') {
      closeDataPanel();
      return;
    }

    if (activeTab === 'results' || activeTab === 'simulator') {
      openWorkflow('predictor');
      return;
    }

    if (activeTab === 'rawEditor') {
      openWorkflow('import');
      return;
    }

    if (activeTab !== 'command') {
      openWorkflow('command');
      return;
    }

    navigate('/');
  };

  const adminBackLabel = activeTab === 'command' ? 'Home' : 'Back';

  const getTeamsNeedingEvidence = (teams: string[]) =>
    Array.from(new Set(teams))
      .filter(teamNumber => {
        const status = teamEvidenceByTeam[teamNumber];
        return !status || status.needsAttention;
      });

  const describeEvidenceGaps = (teams: string[], limit = 6) =>
    getTeamsNeedingEvidence(teams)
      .slice(0, limit)
      .map(teamNumber => {
        const reason = teamEvidenceByTeam[teamNumber]?.attentionReasons[0] || 'needs evidence';
        return `${teamNumber} (${reason})`;
      })
      .join(', ');

  const globalCommandBrief: AdminV4CommandBrief = (() => {
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
      ? adminV4StrategyMatchPlans.find(plan => plan.matchKey === primaryPrediction.key) || null
      : null;
    const primaryRedTeams = primaryPrediction?.red.teams || primaryMatch?.alliances.red.team_keys.map(normalizeTeamKey) || [];
    const primaryBlueTeams = primaryPrediction?.blue.teams || primaryMatch?.alliances.blue.team_keys.map(normalizeTeamKey) || [];
    const primaryAlliance = ownTeamNumber && primaryRedTeams.includes(ownTeamNumber)
      ? 'Red'
      : ownTeamNumber && primaryBlueTeams.includes(ownTeamNumber)
        ? 'Blue'
        : '';
    const primaryPlanAlliance: 'Red' | 'Blue' | '' =
      primaryAlliance ||
      (primaryPrediction?.predictedWinner === 'Red' || primaryPrediction?.predictedWinner === 'Blue'
        ? primaryPrediction.predictedWinner
        : 'Red');
    const primaryExpectedTeams = Array.from(new Set([...primaryRedTeams, ...primaryBlueTeams]));
    const primaryEvidenceGapTeams = getTeamsNeedingEvidence(primaryExpectedTeams);
    const primaryHighUncertaintyTeams = primaryExpectedTeams
      .filter(teamNumber => {
        const insight = ppaInsightsByTeam[teamNumber];
        return insight?.uncertainty.level === 'High' || (insight?.coverage.scoutConfidence ?? 0) < 0.5;
      })
      .slice(0, 5);

    if (!primaryPrediction) {
      return {
        label: 'Load schedule/source',
        detail: 'No future known-team match can be briefed yet.',
        tone: 'amber',
        actionLabel: 'Imports',
        onAction: () => openDataPanel('imports')
      };
    }

    if (primaryEvidenceGapTeams.length > 0) {
      return {
        label: `Collect evidence before ${primaryPrediction.title}`,
        detail: `${primaryEvidenceGapTeams.length} team${primaryEvidenceGapTeams.length === 1 ? '' : 's'} still need a stronger read.`,
        tone: 'rose',
        actionLabel: 'Collect',
        onAction: () => openDataPanel('collection')
      };
    }

    if (primaryHighUncertaintyTeams.length > 0) {
      return {
        label: `Verify ranges for ${primaryPrediction.title}`,
        detail: `High-uncertainty teams: ${primaryHighUncertaintyTeams.join(', ')}.`,
        tone: 'amber',
        actionLabel: 'Math',
        onAction: () => openWiki('ppa', activeTab)
      };
    }

    const winCondition =
      formatStrategyWinConditionForAlliance(primaryStrategyPlan, primaryPlanAlliance, { ownPerspective: Boolean(primaryAlliance) }) ||
      `${primaryPrediction.predictedWinner} forecast. Open the plan before drive-team strategy.`;
    return {
      label: `Prepare ${primaryPrediction.title}`,
      detail: winCondition,
      tone: 'fuchsia',
      actionLabel: 'Open Plan',
      onAction: () => openMatchPlan(primaryPrediction.key)
    };
  })();

  const setActiveViewMetric = (metric: AdminV4SelectedMetric) => {
    if (activeMetricSurface === 'teams') {
      setTeamsMetric(metric);
      return;
    }
    if (activeMetricSurface === 'matches') {
      setMatchesMetric(metric);
      return;
    }
    if (activeMetricSurface === 'simulator') {
      setSimulatorMetric(metric);
      return;
    }
    if (activeMetricSurface === 'reports') {
      setReportsMetric(metric);
      return;
    }
    updateSettings({ selectedMetric: metric });
  };

  const activeMetricSurfaceLabel =
    activeMetricSurface === 'teams'
      ? 'Leaderboard Model'
      : activeMetricSurface === 'matches'
        ? 'Forecast Model'
        : activeMetricSurface === 'simulator'
          ? 'Simulator Model'
          : activeMetricSurface === 'reports'
            ? 'Report Model'
            : 'Model';

  const renderModelAwareAction = () => (
    <ModelToggleGroup
      selectedMetric={selectedMetric}
      onChange={setActiveViewMetric}
      label={activeMetricSurfaceLabel}
      onInfo={key => openWiki(key, activeTab)}
      onInfoContext={openInfoMenu}
    />
  );

  const renderHeadScoutMatchBrief = ({
    prediction,
    match,
    plan,
    fallbackAlliance = 'Red'
  }: {
    prediction: PredictedMatchV3 | null;
    match: TBAMatch | null;
    plan: StrategyMatchPlan | null;
    fallbackAlliance?: 'Red' | 'Blue';
  }) => {
    const redTeams = prediction?.red.teams || match?.alliances.red.team_keys.map(normalizeTeamKey) || [];
    const blueTeams = prediction?.blue.teams || match?.alliances.blue.team_keys.map(normalizeTeamKey) || [];
    const matchTeams = Array.from(new Set([...redTeams, ...blueTeams]));
    const ourAlliance: 'Red' | 'Blue' =
      ownTeamNumber && redTeams.includes(ownTeamNumber)
        ? 'Red'
        : ownTeamNumber && blueTeams.includes(ownTeamNumber)
          ? 'Blue'
          : fallbackAlliance;
    const ourTeams = ourAlliance === 'Red' ? redTeams : blueTeams;
    const opponentTeams = ourAlliance === 'Red' ? blueTeams : redTeams;
    const ourSummary = summarizePpaAlliance(ourTeams, ppaInsightsByTeam);
    const opponentSummary = summarizePpaAlliance(opponentTeams, ppaInsightsByTeam);
    const roleOptions = ourAlliance === 'Red' ? plan?.redRoleOptions || [] : plan?.blueRoleOptions || [];
    const bestRoleOption = roleOptions[0] || null;
    const rpPath = ourAlliance === 'Red' ? plan?.redRpPath || null : plan?.blueRpPath || null;
    const evidenceTeams = getTeamsNeedingEvidence(matchTeams).slice(0, 4);
    const riskTeams = matchTeams
      .filter(teamNumber => {
        const insight = ppaInsightsByTeam[teamNumber];
        return insight?.uncertainty.level === 'High' || insight?.tailRisk.level === 'High';
      })
      .slice(0, 4);
    const matchNumber =
      plan?.matchNumber ||
      match?.match_number ||
      Number(prediction?.key.match(/_qm(\d+)$/i)?.[1] || prediction?.title.match(/(\d+)/)?.[1] || '') ||
      undefined;
    const matchType: ScoutTaskMatchType =
      plan?.matchType === 'Practice' || match?.comp_level === 'pm'
        ? 'Practice'
        : 'Qualification';
    const matchKey = prediction?.key || match?.key || plan?.matchKey || '';
    const context = prediction?.title ? `${prediction.title} command brief` : matchKey ? `${matchKey} command brief` : 'match command brief';
    const buildDispatchTask = (teamNumber: string): ScoutWorkItem => {
      const status = teamEvidenceByTeam[teamNumber];
      const insight = ppaInsightsByTeam[teamNumber] || null;
      const missionKey: ScoutingMissionKey =
        !status || status.matchRows < 2 || status.scoutConfidence < 0.5 || status.uncertainty === 'High'
          ? 'matchScout'
          : status.pitRows === 0
            ? 'pitScout'
            : status.defenseRows === 0 && (status.roleLabel === 'Defender' || status.roleLabel === 'Flex' || (insight?.components.defenseImpact ?? 0) > 4)
              ? 'defenseScout'
              : 'matchScout';
      const reason =
        !status || status.matchRows < 2
          ? 'needs match evidence'
          : status.pitRows === 0
            ? (status.preScoutRows > 0 ? 'pit interview missing' : 'needs pre-event prior')
            : status.defenseRows === 0
              ? 'needs defense read'
              : 'verify expected range';
      return {
        id: `${matchKey || context}:${missionKey}:${teamNumber}:${reason}`,
        teamNumber,
        teamName: resolvedTeamNameLookup[teamNumber] || '',
        missionKey,
        label: SCOUTING_MISSIONS[missionKey].title,
        reason,
        detail: status?.attentionReasons.join(', ') || 'Collect enough evidence to trust this team in the match plan.',
        priority: 0,
        context,
        matchKey,
        matchType,
        matchNumber,
        alliance: redTeams.includes(teamNumber) ? 'Red' : blueTeams.includes(teamNumber) ? 'Blue' : undefined,
        ppa: buildScoutTaskPpaContext(teamNumber, missionKey, reason, status?.attentionReasons || [])
      };
    };
    const dispatchTasks = evidenceTeams.map(buildDispatchTask);
    const opponentThreats = [...opponentTeams]
      .sort((left, right) => (ppaInsightsByTeam[right]?.rating ?? activeMetricRatings[right] ?? 0) - (ppaInsightsByTeam[left]?.rating ?? activeMetricRatings[left] ?? 0))
      .slice(0, 2);
    const ourProjectedMargin = plan
      ? ourAlliance === 'Red'
        ? plan.optimizedRedScore - plan.optimizedBlueScore
        : plan.optimizedBlueScore - plan.optimizedRedScore
      : prediction
        ? ourAlliance === 'Red'
          ? prediction.red.predictedScore - prediction.blue.predictedScore
          : prediction.blue.predictedScore - prediction.red.predictedScore
        : null;
    const ppaAllianceEdge = ourSummary.expected - opponentSummary.expected;
    const ppaWinRp = ppaAllianceEdge > 0.5 ? 2 : ppaAllianceEdge < -0.5 ? 0 : 1;
    const roleOptimizerMargin = bestRoleOption?.netMargin ?? ourProjectedMargin;
    const showRoleOptimizerNote =
      roleOptimizerMargin != null &&
      Number.isFinite(roleOptimizerMargin) &&
      Math.abs(roleOptimizerMargin - ppaAllianceEdge) > 0.5;
    const matchTrustLabel = evidenceTeams.length > 0
      ? 'Use carefully'
      : plan?.modelLowConfidence
        ? 'Use carefully'
        : 'Trust for match plan';
    const matchTrustDetail = evidenceTeams.length > 0
      ? `${evidenceTeams.length} evidence gap${evidenceTeams.length === 1 ? '' : 's'} still affect this read.`
      : plan?.modelLowConfidence
        ? 'The selected forecast model says this read has low model trust.'
        : 'No major local evidence gap is visible for this match.';
    const perspectiveWinCondition = plan
      ? ownTeamNumber
        ? `Our ${ourAlliance.toLowerCase()} alliance win condition: ${bestRoleOption?.rationale || 'protect scoring floor, avoid foul leakage, and only send defense when it helps our net margin.'}`
        : `${plan.predictedWinner} alliance is favored. Set own team to turn this into a true "our alliance" plan.`
      : prediction
        ? `${prediction.predictedWinner} is favored by the selected model.`
        : 'Forecast pending. Use this as a collection checklist until the model has enough source data.';

    if (!prediction && !match && !plan) {
      return (
        <AdminEmptyState
          title="Head-scout match command is waiting for a future match"
          why="This surface should only make drive-team recommendations when a known upcoming match and its teams are loaded."
          action="Refresh official sources, upload a schedule, or use Manual Simulator for a custom planning check."
        />
      );
    }

    return (
      <div className="admin-g2-sm border border-fuchsia-400/25 bg-fuchsia-500/10 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Head Scout Match Command</div>
            <h3 className="mt-1 text-2xl font-black text-white">{prediction?.title || match?.key.split('_')[1]?.toUpperCase() || plan?.matchKey || 'Match'}</h3>
            <p className="mt-2 max-w-4xl text-sm font-semibold leading-relaxed text-fuchsia-50/80">
              {perspectiveWinCondition}
            </p>
          </div>
          <AdminButton tone="fuchsia" onClick={() => matchKey && openMatchPlan(matchKey)} disabled={!matchKey}>
            <Swords className="h-4 w-4" />Open Match Plan
          </AdminButton>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{ownTeamNumber ? `Our Alliance (${ourAlliance})` : `${ourAlliance} Lens`}</div>
            <div className="mt-2"><TeamList teams={ourTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={resolvedTeamNameLookup} /></div>
            <PpaAllianceMiniReadout summary={ourSummary} accentClass={ourAlliance === 'Red' ? 'text-red-100' : 'text-blue-100'} />
          </div>
          <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Opponent Threat</div>
            <div className="mt-2"><TeamList teams={opponentTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} teamNameLookup={resolvedTeamNameLookup} /></div>
            <PpaAllianceMiniReadout summary={opponentSummary} accentClass={ourAlliance === 'Red' ? 'text-blue-100' : 'text-red-100'} />
            {opponentThreats.length > 0 && (
              <div className="mt-2 text-xs font-semibold text-slate-400">
                Watch first: <span className="font-black text-white">{opponentThreats.join(', ')}</span>
              </div>
            )}
          </div>
          <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-3">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Role + RP Call</div>
            <div className="mt-2 text-lg font-black text-white">{bestRoleOption?.label || 'Role pending'}</div>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">{bestRoleOption?.rationale || 'Need ratings and defense evidence before role optimization is meaningful.'}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MetricField label={`${ourAlliance} Range Edge`} value={formatSignedMetric(ppaAllianceEdge, 1)} />
              <MetricField label={`${ourAlliance} Win RP`} value={matchType === 'Qualification' ? formatMetricValue(ppaWinRp, 0) : 'Practice'} />
              <div className="col-span-2">
                <MetricField label="Match-Day Trust" value={matchTrustLabel} />
                <p className="mt-1 text-xs font-semibold text-slate-500">{matchTrustDetail}</p>
                {showRoleOptimizerNote && (
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                    Role optimizer net: {formatSignedMetric(roleOptimizerMargin, 1)}. Range edge is the displayed alliance comparison; role net is used only for role tradeoffs.
                  </p>
                )}
                {matchType === 'Qualification' && rpPath && showRoleOptimizerNote && (
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                    Bonus RP is withheld from the Now brief because role optimizer and range edge disagree; open the full plan before using component RP.
                  </p>
                )}
                {matchType === 'Qualification' && rpPath && !showRoleOptimizerNote && (
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                    Bonus RP model: {formatMetricValue(rpPath.projectedRp, 1)} total RP when component data is trusted.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr]">
          <div className="admin-g2-sm border border-cyan-400/20 bg-cyan-500/10 p-3">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Drive-Team Instructions</div>
            <div className="mt-3 space-y-2 text-sm font-semibold text-cyan-50/85">
              <div>{ownTeamNumber ? `Start from the ${ourAlliance} role plan.` : `Use ${ourAlliance} as the planning lens until own team is set.`}</div>
              <div>{plan?.opponentCounterStrategy || 'Counter-strategy appears after future-match model data is loaded.'}</div>
              {riskTeams.length > 0 && <div>Risk read: treat {riskTeams.join(', ')} as ranges before lock-in.</div>}
            </div>
          </div>
          <div className={`admin-g2-sm border p-3 ${dispatchTasks.length > 0 ? 'border-rose-400/25 bg-rose-500/10' : 'border-emerald-400/25 bg-emerald-500/10'}`}>
            <div className={`text-xs font-black uppercase tracking-[0.18em] ${dispatchTasks.length > 0 ? 'text-rose-100' : 'text-emerald-100'}`}>Scout Tasks</div>
            {dispatchTasks.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {dispatchTasks.map(task => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openScoutWorkItem(task)}
                    className="admin-g2-sm border border-white/10 bg-slate-950/45 px-3 py-2 text-left text-xs font-black text-white transition-colors hover:bg-slate-900"
                  >
                    <div>{task.label} Team {task.teamNumber}</div>
                    <div className="mt-1 font-semibold text-slate-400">{task.reason}</div>
                    {task.ppa && (
                      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
                        <span className="admin-g2-sm border border-white/10 bg-slate-950/50 px-2 py-1">
                          Range {formatMetricValue(task.ppa.floor ?? null, 1)} / {formatMetricValue(task.ppa.expected ?? null, 1)} / {formatMetricValue(task.ppa.ceiling ?? null, 1)}
                        </span>
                        <span className="admin-g2-sm border border-white/10 bg-slate-950/50 px-2 py-1">
                          {task.ppa.role || 'Needs role evidence'} · {task.ppa.uncertainty || 'Needs risk read'}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm font-semibold text-emerald-50/80">No urgent collection gaps for this match. Keep scouts on normal assignment coverage.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

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
      ? adminV4StrategyMatchPlans.find(plan => plan.matchKey === primaryPrediction.key) || null
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
    const primaryExpectedTeams = Array.from(new Set([...primaryRedTeams, ...primaryBlueTeams]));
    const primaryEvidenceGapTeams = getTeamsNeedingEvidence(primaryExpectedTeams);
    const primaryHighUncertaintyTeams = primaryExpectedTeams
      .filter(teamNumber => {
        const insight = ppaInsightsByTeam[teamNumber];
        return insight?.uncertainty.level === 'High' || (insight?.coverage.scoutConfidence ?? 0) < 0.5;
      })
      .slice(0, 5);
    const matchDayTrust = primaryEvidenceGapTeams.length > 0 || primaryHighUncertaintyTeams.length > 0
      ? 'Use carefully'
      : primaryPrediction
        ? 'Trust for match plan'
        : 'Not ready';
    const primaryPlanAlliance: 'Red' | 'Blue' | '' =
      primaryAlliance ||
      (primaryPrediction?.predictedWinner === 'Red' || primaryPrediction?.predictedWinner === 'Blue'
        ? primaryPrediction.predictedWinner
        : 'Red');
    const primaryWinCondition =
      formatStrategyWinConditionForAlliance(primaryStrategyPlan, primaryPlanAlliance, { ownPerspective: Boolean(primaryAlliance) }) ||
      `${primaryPrediction?.predictedWinner || 'Forecast'} forecast. Open the match plan before drive-team strategy.`;
    const requiredNowAction = primaryEvidenceGapTeams.length > 0
      ? 'Collect missing evidence'
      : primaryPrediction
        ? 'Prepare match plan'
        : 'Load schedule/source';
    const prepareNowAction: AdminV4NowAction = primaryPrediction
      ? {
        label: `Prepare ${primaryPrediction.title}`,
        detail: primaryWinCondition,
        tone: 'fuchsia',
        onAction: () => openMatchPlan(primaryPrediction.key),
        actionLabel: 'Open Plan'
      }
      : {
        label: 'Load Schedule',
        detail: 'No future known-team matches are available. Refresh or upload a schedule before match strategy.',
        tone: 'amber',
        onAction: () => openDataPanel('imports'),
        actionLabel: 'Open Imports'
      };
    const evidenceNowAction: AdminV4NowAction = primaryEvidenceGapTeams.length > 0
      ? {
        label: 'Assign Evidence Tasks',
        detail: `${primaryEvidenceGapTeams.length} team${primaryEvidenceGapTeams.length === 1 ? '' : 's'} need stronger prior evidence before ${primaryPrediction?.title || 'the next known match'}. Open Collect Evidence to assign the missing rows.`,
        tone: 'rose',
        onAction: () => openDataPanel('collection'),
        actionLabel: 'Collect'
      }
      : primaryPrediction
        ? {
          label: 'Next Match Evidence Ready',
          detail: 'Every known team in the highlighted match has enough prior evidence for a first strategy read.',
          tone: 'emerald',
          onAction: () => openWorkflow('predictor'),
          actionLabel: 'Matches'
        }
        : {
          label: 'Load Schedule First',
          detail: 'Load a schedule before coverage can be judged. Until then, nothing is actually covered or missing.',
          tone: 'amber',
          onAction: () => openDataPanel('imports'),
          actionLabel: 'Imports'
        };
    const rangeNowAction: AdminV4NowAction = primaryHighUncertaintyTeams.length > 0
      ? {
        label: 'Verify Expected Ranges',
        detail: `Read as ranges, not points: ${primaryHighUncertaintyTeams.join(', ')}.`,
        tone: 'amber',
        onAction: () => openWiki('ppa', 'command'),
        actionLabel: 'Math'
      }
      : primaryPrediction
        ? {
          label: 'Ranges Ready',
          detail: 'No high-uncertainty team is visible in the highlighted next match.',
          tone: 'emerald',
          onAction: () => openWorkflow('visualize'),
          actionLabel: 'Visualize'
        }
        : {
          label: 'Load Team Data First',
          detail: 'Range warnings become meaningful after team/source data exists for the event.',
          tone: 'amber',
          onAction: () => openDataPanel('sources'),
          actionLabel: 'Sources'
        };
    const sourceNowAction: AdminV4NowAction = localArchiveSummary.unsyncedRecords.length > 0
      ? {
        label: 'Sync Local Rows',
        detail: `${localArchiveSummary.unsyncedRecords.length} locally saved row${localArchiveSummary.unsyncedRecords.length === 1 ? '' : 's'} still need Firebase sync.`,
        tone: 'amber',
        onAction: () => openDataPanel('collection'),
        actionLabel: 'Sync'
      }
      : sourceStatusSummary.rowCount > 0
        ? {
          label: 'Sources Stable',
          detail: `Latest cached/uploaded source: ${formatFreshnessAge(sourceStatusSummary.latestTimestamp)}.`,
          tone: 'cyan',
          onAction: () => openDataPanel('sources'),
          actionLabel: 'Sources'
        }
        : {
          label: 'Official Source Needed',
          detail: `${records.length + v4Records.length + defenseRecords.length} scout evidence row${records.length + v4Records.length + defenseRecords.length === 1 ? '' : 's'} loaded, but official schedule/source data is missing on this device.`,
          tone: 'amber',
          onAction: () => openDataPanel('imports'),
          actionLabel: 'Imports'
        };
    const nowPriorities: AdminV4NowAction[] = primaryEvidenceGapTeams.length > 0
      ? [evidenceNowAction, prepareNowAction, rangeNowAction, sourceNowAction]
      : [prepareNowAction, evidenceNowAction, rangeNowAction, sourceNowAction];
    const primaryNowAction = nowPriorities[0]!;
    const secondaryNowActions = nowPriorities.slice(1);
    const selectCompetitionPhase = (phase: AdminV4CompetitionPhaseKey, action: () => void) => {
      setCompetitionPhase(phase);
      action();
    };
    const competitionPhases: AdminV4CompetitionPhase[] = [
      {
        key: 'practice',
        label: 'Practice Matches',
        detail: 'Perfect collection, scout assignments, source refresh, and first-pass predictions while the stakes are still low.',
        actionLabel: 'Scouts + Data',
        tone: 'cyan',
        onAction: () => selectCompetitionPhase('practice', () => openDataPanel('scouts'))
      },
      {
        key: 'qualifications',
        label: 'Qualifications',
        detail: 'Operate from upcoming match plans, prediction audit, source freshness, and fast corrections after every result.',
        actionLabel: 'Matches + Trust',
        tone: 'fuchsia',
        onAction: () => selectCompetitionPhase('qualifications', () => openWorkflow('predictor'))
      },
      {
        key: 'selection',
        label: 'Alliance Selection Prep',
        detail: 'Work the live pick board, mark teams as taken, and keep the shortlist ready before selection starts.',
        actionLabel: 'Pick Board',
        tone: 'amber',
        onAction: () => selectCompetitionPhase('selection', () => openWorkflow('pickList'))
      }
    ];
    const competitionNeeds: AdminV4CompetitionNeed[] = [
      {
        label: 'Match soon',
        detail: primaryPrediction ? `Open ${primaryPrediction.title} plan.` : 'Load or refresh the schedule first.',
        actionLabel: primaryPrediction ? 'Match plan' : 'Imports',
        tone: primaryPrediction ? 'fuchsia' : 'amber',
        onAction: () => {
          if (primaryPrediction) {
            openMatchPlan(primaryPrediction.key);
            return;
          }
          openDataPanel('imports');
        }
      },
      {
        label: 'Data looks wrong',
        detail: rawEditorSummary.missingSlotCount > 0 || rawEditorSummary.anomalyRowCount > 0
          ? `${rawEditorSummary.missingSlotCount} missing, ${rawEditorSummary.anomalyRowCount} suspicious.`
          : 'Open the audit when a number feels off.',
        actionLabel: 'Audit rows',
        tone: rawEditorSummary.missingSlotCount > 0 ? 'rose' : rawEditorSummary.anomalyRowCount > 0 ? 'amber' : 'cyan',
        onAction: () => openDataPanel('audit')
      },
      {
        label: 'Prediction checkpoint',
        detail: latestFeatureSnapshot
          ? `${latestFeatureSnapshot.forecastSnapshots?.length ?? adminV4ForecastSnapshots.length} future forecasts in the latest saved snapshot.`
          : adminV4ForecastSnapshots.length > 0
            ? `${adminV4ForecastSnapshots.length} future forecasts are ready to timestamp.`
            : 'Open Model Trust and save a forecast snapshot before the next block.',
        actionLabel: 'Save snapshot',
        tone: adminV4ForecastSnapshots.length > 0 || latestFeatureSnapshot ? 'fuchsia' : 'amber',
        onAction: () => openDataPanel('models')
      },
      {
        label: 'Assign scouts',
        detail: scoutAssignmentPlan
          ? 'Recheck coverage and same-team continuity.'
          : 'Build the next block schedule split.',
        actionLabel: 'Scouts',
        tone: scoutAssignmentPlan ? 'cyan' : 'amber',
        onAction: () => openDataPanel('scouts')
      },
      {
        label: 'Alliance selection',
        detail: pickListSummary.available > 0
          ? `${pickListSummary.selected}/${pickListSummary.available} teams marked.`
          : 'Open the pick board and start ranking.',
        actionLabel: 'Pick list',
        tone: pickListSummary.available > 0 ? 'emerald' : 'fuchsia',
        onAction: () => openWorkflow('pickList')
      },
      {
        label: 'Demo proof',
        detail: rawEditorSummary.anomalyRowCount > 0
          ? 'Check evidence before exporting claims.'
          : 'Open model proof, calibration, and report packets.',
        actionLabel: 'Reports',
        tone: rawEditorSummary.anomalyRowCount > 0 ? 'amber' : 'emerald',
        onAction: () => openWorkflow('export')
      }
    ];
    const playedMatches = activePredictorMatches.filter(isPlayedMatch).slice(-4).reverse();
    const nowMatchRows: AdminV4NowMatchRow[] = nextMatches.map(match => {
      const redSummary = summarizePpaAlliance(match.red.teams, ppaInsightsByTeam);
      const blueSummary = summarizePpaAlliance(match.blue.teams, ppaInsightsByTeam);
      const includesOwn = Boolean(ownTeamNumber && [...match.red.teams, ...match.blue.teams].includes(ownTeamNumber));
      const ownAlliance = includesOwn && match.red.teams.includes(ownTeamNumber)
        ? 'Red'
        : includesOwn && match.blue.teams.includes(ownTeamNumber)
          ? 'Blue'
          : '';
      const ourSummary = ownAlliance === 'Blue' ? blueSummary : redSummary;
      const opponentSummary = ownAlliance === 'Blue' ? redSummary : blueSummary;
      const matchRiskNotes = redSummary.riskNotes.length + blueSummary.riskNotes.length;
      return {
        key: match.key,
        title: match.title,
        redTeams: match.red.teams,
        blueTeams: match.blue.teams,
        forecast: match.predictedWinner,
        ourLabel: ownAlliance ? 'Our' : 'Red',
        ourRange: formatPpaRange(ourSummary),
        opponentLabel: ownAlliance ? 'Opp' : 'Blue',
        opponentRange: formatPpaRange(opponentSummary),
        matchRiskNotes,
        trust: match.predictionLowConfidence ? 'Low' : matchRiskNotes > 0 ? 'Range check' : 'Standard'
      };
    });

    return (
      <AdminV4NowWorkflow
        matchLabel={primaryPrediction?.title || 'None'}
        matchDayTrust={matchDayTrust}
        requiredAction={requiredNowAction}
        headScoutBrief={renderHeadScoutMatchBrief({
          prediction: primaryPrediction,
          match: primaryMatch,
          plan: primaryStrategyPlan,
          fallbackAlliance: primaryAlliance || 'Red'
        })}
        primaryAction={primaryNowAction}
        secondaryActions={secondaryNowActions}
        activeCompetitionPhase={competitionPhase}
        competitionPhases={competitionPhases}
        competitionNeeds={competitionNeeds}
        predictorMatchSourceLabel={predictorMatchSourceLabel}
        modelAction={renderModelAwareAction()}
        nextMatches={nowMatchRows}
        ownTeamNumber={ownTeamNumber}
        searchedTeamNumber={searchedTeamNumber}
        teamNameLookup={resolvedTeamNameLookup}
        isLocalMode={isLocalMode}
        loadedScoutingRows={summary.rows}
        playedMatchCount={playedMatches.length}
        firstCredentialsSaved={Boolean(firstCredentials)}
        commandAlerts={commandAlerts as AdminV4NowAlert[]}
        onOpenMatch={openMatchPlan}
        onOpenPpaWiki={() => openWiki('ppa', 'command')}
        onOpenPpaInfoMenu={event => openInfoMenu(event, 'ppa')}
      />
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
    const detailPitRows = activePitArchiveRecords.filter(record => record.payload.teamNumber === detailTeamNumber);
    const detailPreScoutRows = preScoutAdminTaskEvidence.filter(evidence => evidence.teamNumber === detailTeamNumber);
    const detailPreScoutProfile = preMatchCache?.profiles.find(profile => profile.teamNumber === detailTeamNumber) || null;
    const detailHistoryRows = sortScoutRowsByMatchThenTeam([
      ...detailV4Rows.map(record => ({
        key: `v4-${record.matchKey}-${record.teamNumber}-${record.timestamp || 0}`,
        version: 'V4',
        matchNumber: record.matchNumber,
        matchKey: record.matchKey,
        teamNumber: record.teamNumber,
        totalMatchPoints: record.totalMatchPoints,
        autoPoints: record.autoPoints,
        teleopPoints: record.teleopPoints,
        context: [
          record.rolePlayed || 'Role pending',
          `${formatPercentMetric(record.reliabilityScore, 0)} reliability`
        ].join(' / '),
        notes: record.notes || record.strategyNotes || 'None',
        timestamp: record.timestamp
      })),
      ...detailV3Rows.map(record => ({
        key: `v3-${record.matchKey}-${record.teamNumber}-${record.timestamp || 0}`,
        version: record.legacyDerived ? 'V2->V3' : 'V3',
        matchNumber: record.matchNumber,
        matchKey: record.matchKey,
        teamNumber: record.teamNumber,
        totalMatchPoints: record.totalMatchPoints,
        autoPoints: record.autoPoints,
        teleopPoints: record.teleopPoints,
        context: [
          record.alliance || 'Alliance unknown',
          `driver ${formatMetricValue(record.driverSkill, 1)}`,
          `teamwork ${formatMetricValue(record.teamwork, 1)}`
        ].join(' / '),
        notes: record.generalEvaluation || record.defenseDescription || 'None',
        timestamp: record.timestamp
      }))
    ]).reverse();
    const detailEvidenceStatus: TeamEvidenceStatus = teamEvidenceByTeam[detailTeamNumber] || {
      teamNumber: detailTeamNumber,
      matchRows: detailHistoryRows.length,
      defenseRows: detailDefense?.recordsLogged ?? 0,
      pitRows: detailPitRows.length,
      preScoutRows: detailPreScoutRows.length,
      scoutConfidence: detailPpaInsight?.coverage.scoutConfidence ?? 0,
      uncertainty: detailPpaInsight?.uncertainty.level ?? 'High',
      roleLabel: detailPpaInsight?.role.label ?? 'Needs role evidence',
      needsAttention: true,
      attentionReasons: ['needs evidence']
    };
    const buildTeamDetailTask = (
      missionKey: ScoutingMissionKey,
      reason: string,
      detail: string,
      priority = 20
    ): ScoutWorkItem => ({
      id: `teamDetail:${missionKey}:${detailTeamNumber}:${reason}`,
      teamNumber: detailTeamNumber,
      teamName: resolvedTeamNameLookup[detailTeamNumber] || '',
      missionKey,
      label: SCOUTING_MISSIONS[missionKey].title,
      reason,
      detail,
      priority,
      context: 'team detail evidence',
      ppa: buildScoutTaskPpaContext(detailTeamNumber, missionKey, reason, detailEvidenceStatus.attentionReasons)
    });
    const detailScoutTasks: ScoutWorkItem[] = [
      buildTeamDetailTask(
        'matchScout',
        detailEvidenceStatus.matchRows < 2 ? 'needs match evidence' : detailEvidenceStatus.scoutConfidence < 0.5 ? 'low scout trust' : 'verify current trend',
        detailEvidenceStatus.matchRows < 2
          ? 'Collect a clean V4 row so expected value, floor risk, role, and reliability are backed by local evidence.'
          : 'Add a fresh row only if the team changed role, mechanism, or reliability since the current expected range was formed.',
        10
      ),
      buildTeamDetailTask(
        'pitScout',
        detailEvidenceStatus.pitRows === 0 ? (detailEvidenceStatus.preScoutRows > 0 ? 'pit interview missing' : 'no pre-event prior') : 'refresh pit prior',
        detailEvidenceStatus.pitRows === 0
          ? 'Interview the team so the public-only prior is grounded in mechanism, compatibility, and claimed capability.'
          : 'Refresh pit context if the mechanism or role changed since the last interview.',
        18
      ),
      buildTeamDetailTask(
        'defenseScout',
        detailEvidenceStatus.defenseRows === 0 ? 'no defense read' : 'refresh defense role',
        detailEvidenceStatus.defenseRows === 0
          ? 'Capture whether this robot denies output or plays support so the expected range does not confuse role sacrifice with weak scoring.'
          : 'Refresh defense context only if the team is now playing a different role or drawing different opponents.',
        14
      ),
      buildTeamDetailTask(
        'preScout',
        detailEvidenceStatus.preScoutRows === 0 ? 'no pre-scout return' : 'refresh public context',
        detailEvidenceStatus.preScoutRows === 0
          ? 'Return public context and missing-data notes before relying on this team as a public-only starting point.'
          : 'Refresh public context if event qualification, robot media, or public evidence has changed.',
        24
      )
    ];
    const compactTimelineText = (values: Array<string | number | null | undefined>) =>
      values.map(value => String(value || '').trim()).filter(Boolean);
    const detailEvidenceTimeline: TeamEvidenceTimelineItem[] = [
      ...(detailPreScoutProfile ? [{
        key: `pre-profile:${detailPreScoutProfile.teamNumber}:${preMatchCache?.cachedAt || 0}`,
        missionKey: 'preScout' as const,
        sourceLabel: 'Pre Scout Cache',
        title: 'Cached public profile',
        subtitle: detailPreScoutProfile.qualificationReason || 'Public context for early expected ranges and pit priorities.',
        timestamp: preMatchCache?.cachedAt || 0,
        signalLabel: 'Public profile',
        signalValue: `${detailPreScoutProfile.mediaAssets.length} media / ${detailPreScoutProfile.robotMetadata.length} robot`,
        pills: compactTimelineText([
          detailPreScoutProfile.qualificationStatus.replace(/_/g, ' '),
          detailPreScoutProfile.location,
          detailPreScoutProfile.districtStanding?.districtName
        ]).slice(0, 4),
        notes: compactTimelineText([
          detailPreScoutProfile.seasonEvents[0]?.overallStatus,
          detailPreScoutProfile.seasonAwards[0]?.name,
          detailPreScoutProfile.robotMetadata[0]?.name
        ]).join(' / ') || 'Public profile is available, but no focused Pre Scout return has been recorded yet.'
      }] : []),
      ...detailPreScoutRows.map(evidence => ({
        key: `pre-evidence:${evidence.id}`,
        missionKey: 'preScout' as const,
        sourceLabel: 'Pre Scout',
        title: evidence.profileAvailable ? 'Public context verified' : 'Public context missing',
        subtitle: evidence.qualificationReason || evidence.task.reason || 'Returned public-context evidence.',
        timestamp: evidence.capturedAt || evidence.task.capturedAt || 0,
        signalLabel: 'Manual checks',
        signalValue: `${evidence.missingFromTba.length + evidence.manualRequired.length}`,
        pills: compactTimelineText([
          evidence.qualificationStatus?.replace(/_/g, ' '),
          evidence.profileAvailable ? 'profile available' : 'profile missing',
          evidence.task.ppa?.coverage
        ]).slice(0, 4),
        notes: compactTimelineText([
          evidence.manualRequired[0],
          evidence.missingFromTba[0],
          evidence.task.detail,
          evidence.task.ppa?.asks?.[0]
        ]).join(' / ') || 'Pre Scout returned evidence for this admin task.',
        adminTask: evidence.task
      })),
      ...detailPitRows.map(record => {
        const pit = record.payload;
        const climbLevel = pit.noClimbCapability
          ? 'no climb'
          : compactTimelineText([
            pit.canClimbL1 ? 'L1' : '',
            pit.canClimbL2 ? 'L2' : '',
            pit.canClimbL3 ? 'L3' : ''
          ]).join('/') || 'climb unknown';
        return {
          key: `pit:${record.recordId}`,
          missionKey: 'pitScout' as const,
          sourceLabel: 'Pit Scout',
          title: 'Capability prior',
          subtitle: pit.teamName || 'Robot interview and claimed capability context.',
          timestamp: pit.timestamp || record.updatedAt || 0,
          signalLabel: 'Claimed scoring',
          signalValue: formatMetricValue(pit.expectedHubBallsPerMatch || null, 0),
          pills: compactTimelineText([
            pit.robotBaseType,
            climbLevel,
            pit.canCrossTrench ? 'crosses trench' : pit.isBumpOnly ? 'bump only' : ''
          ]).slice(0, 4),
          notes: compactTimelineText([
            `${pit.expectedAutoBalls || 0} auto / ${pit.expectedTeleopBalls || 0} teleop`,
            pit.ballsPerSecond ? `${formatMetricValue(pit.ballsPerSecond, 1)} balls/sec` : '',
            pit.notes,
            pit.adminTask?.ppa?.asks?.[0]
          ]).join(' / ') || 'Pit prior exists for this team.',
          adminTask: pit.adminTask
        };
      }),
      ...detailV4Rows.map(record => {
        const failureCount = [record.robotDied, record.commsLost, record.mechanismBroke, record.tippedOver].filter(Boolean).length;
        return {
          key: `match-v4:${record.matchKey}:${record.teamNumber}:${record.timestamp || 0}`,
          missionKey: 'matchScout' as const,
          sourceLabel: 'Match Scout V4',
          title: `${record.matchType} ${record.matchNumber}`,
          subtitle: `${record.totalMatchPoints} pts with ${record.rolePlayed || 'role pending'}.`,
          timestamp: record.timestamp || 0,
          signalLabel: 'Range row',
          signalValue: formatMetricValue(record.totalMatchPoints, 0),
          pills: compactTimelineText([
            `${record.autoPoints} auto`,
            `${record.teleopPoints} teleop`,
            `${formatPercentMetric(record.reliabilityScore, 0)} reliability`,
            failureCount > 0 ? `${failureCount} failure flags` : 'clean risk row'
          ]).slice(0, 4),
          notes: compactTimelineText([
            record.strategyNotes,
            record.notes,
            record.failureReason,
            record.adminTask?.ppa?.asks?.[0]
          ]).join(' / ') || 'V4 match row contributes expected value, role, reliability, floor, and ceiling context.',
          adminTask: record.adminTask
        };
      }),
      ...detailV3Rows.map(record => ({
        key: `match-v3:${record.matchKey}:${record.teamNumber}:${record.timestamp || 0}`,
        missionKey: 'matchScout' as const,
        sourceLabel: record.legacyDerived ? 'Legacy Match Row' : 'Match Scout V3',
        title: `${record.matchType} ${record.matchNumber}`,
        subtitle: `${record.totalMatchPoints} pts with driver ${formatMetricValue(record.driverSkill, 1)}.`,
        timestamp: record.timestamp || 0,
        signalLabel: 'Scoring row',
        signalValue: formatMetricValue(record.totalMatchPoints, 0),
        pills: compactTimelineText([
          `${record.autoPoints} auto`,
          `${record.teleopPoints} teleop`,
          record.climbLevel !== 'None' ? `climb ${record.climbLevel}` : '',
          record.shootingStyle
        ]).slice(0, 4),
        notes: compactTimelineText([
          record.generalEvaluation,
          record.defenseDescription
        ]).join(' / ') || 'Earlier match row contributes scoring history and trend context.'
      })),
      ...defenseRecords
        .filter(record => record.teamNumber === detailTeamNumber)
        .map(record => ({
          key: `defense:${record.matchKey}:${record.teamNumber}:${record.timestamp || 0}`,
          missionKey: 'defenseScout' as const,
          sourceLabel: 'Defense Scout',
          title: `${record.matchType} ${record.matchNumber}`,
          subtitle: 'Defense role evidence and opponent suppression context.',
          timestamp: record.timestamp || 0,
          signalLabel: 'Defense metric',
          signalValue: formatPercentMetric(record.defenseMetric, 0),
          pills: compactTimelineText([
            record.alliance,
            `${formatPercentMetric(record.defenseMetric, 0)} impact`,
            record.assignedSlot,
            record.adminTask?.ppa?.coverage
          ]).slice(0, 4),
          notes: compactTimelineText([
            record.defenseComments,
            record.generalComments,
            record.adminTask?.ppa?.asks?.[0]
          ]).join(' / ') || 'Defense row protects the expected range from mistaking role sacrifice for weak scoring.',
          adminTask: record.adminTask
        }))
    ].sort((left, right) => right.timestamp - left.timestamp || left.sourceLabel.localeCompare(right.sourceLabel));

    return (
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Team Detail"
          title={`Team ${detailTeamNumber}`}
          description={resolvedTeamNameLookup[detailTeamNumber] || teamProfile?.nickname || 'Profile, stats, trend, notes, and match history.'}
          action={<AdminButton onClick={closeTeamDrilldown}><ChevronLeft className="h-4 w-4" />Back to Teams</AdminButton>}
        />
        <div className="mt-5">
          <PpaDecisionReadPanel
            insight={detailPpaInsight}
            matchesLogged={detailHistoryRows.length}
            onInfo={key => openWiki(key, 'teams')}
            onInfoContext={openInfoMenu}
          />
        </div>
        <div className="mt-5">
          <TeamEvidenceCoveragePanel
            status={detailEvidenceStatus}
            tasks={detailScoutTasks}
            onOpenTask={openScoutWorkItem}
          />
        </div>
        <div className="mt-5">
          <TeamEvidenceTimelinePanel
            rows={detailEvidenceTimeline}
            teamNumber={detailTeamNumber}
            onInfo={key => openWiki(key, 'teams')}
            onInfoContext={openInfoMenu}
          />
        </div>
        <div className="mt-5">
          {detailPpaInsight ? (
            <PpaInsightPanel
              insight={detailPpaInsight}
              onInfo={key => openWiki(key, 'teams')}
              onInfoContext={openInfoMenu}
            />
          ) : (
            <AdminEmptyState
              title="No expected range yet"
              why="Prediction, role planning, and pick-list ranking need either local match rows or loaded model ratings for this team."
              action="Collect match scout rows, import source data, or check the team again after ratings load."
            />
          )}
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Local Avg" value={formatMetricValue(detailAverage?.avgTotalMatchPoints ?? null)} />
          <SummaryCard label="Defense Metric" value={formatPercentMetric(detailDefense?.avgDefenseMetric ?? null)} />
          <SummaryCard label="Matches Logged" value={detailAverage?.matchesPlayed ?? 0} />
          <SummaryCard label="TBA Rank" value={effectiveCurrentTbaRanks[detailTeamNumber] ? `#${effectiveCurrentTbaRanks[detailTeamNumber]}` : 'Needs official rankings'} />
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            {detailProfile && <TeamPerformanceProfilePanel profile={detailProfile} ppaInsight={detailPpaInsight} />}
            <AdminSurface className="p-4">
              <div className="text-sm font-black text-white">Profile</div>
              <div className="mt-3 space-y-2 text-sm text-slate-400">
                <div>Selected rating: <span className="font-black text-slate-100">{MODEL_LABELS[selectedMetric]}</span></div>
                <div>Rank: <span className="font-black text-slate-100">{effectiveCurrentTbaRanks[detailTeamNumber] ? `#${effectiveCurrentTbaRanks[detailTeamNumber]}` : 'Needs official rankings'}</span></div>
                <details className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-3">
                  <summary className="cursor-pointer list-none text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                    Advanced public ratings
                  </summary>
                  <div className="admin-details-body mt-3 space-y-2">
                    <div>EPA: <span className="font-black text-slate-100">{formatMetricValue(epaRatings[detailTeamNumber] ?? null)}</span></div>
                    <div>OPR: <span className="font-black text-slate-100">{formatMetricValue(activeOprRatings[detailTeamNumber] ?? null)}</span></div>
                  </div>
                </details>
                {teamProfileError && <div className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 p-3 text-amber-100">{teamProfileError}</div>}
              </div>
            </AdminSurface>
          </div>
          <AdminSurface className="p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-white">Match History</h3>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">V4 {detailV4Rows.length} / V3 {detailV3Rows.length}</div>
            </div>
            <div className="mt-4 max-h-[520px] overflow-y-auto admin-g2-sm border border-slate-800">
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
                  {detailHistoryRows.map(record => (
                    <tr key={record.key}>
                      <td className="px-4 py-3 font-mono font-black text-white">{record.matchKey.toUpperCase()}</td>
                      <td className="px-4 py-3 text-slate-300">
                        <div className="font-black">{record.version}</div>
                        <div className="mt-1 text-xs text-slate-500">{record.context}</div>
                      </td>
                      <td className="px-4 py-3 font-black text-cyan-100">{record.totalMatchPoints}</td>
                      <td className="px-4 py-3">{record.autoPoints}</td>
                      <td className="px-4 py-3">{record.teleopPoints}</td>
                      <td className="px-4 py-3 text-slate-400">{record.notes}</td>
                    </tr>
                  ))}
                  {detailHistoryRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-4" colSpan={6}>
                        <AdminEmptyState
                          title="No match rows for this team"
                          why="The profile can still show official/context data, but trend, reliability, and expected range are weak without scouted matches."
                          action="Send a match scout for this team or import local evidence rows."
                        />
                      </td>
                    </tr>
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
    const searchedTeamRow = searchedTeamNumber
      ? sortedSorterRows.find(row => row.teamNumber === searchedTeamNumber)
      : null;
    const lowTrustRows = sortedSorterRows.filter(row => row.ppaUncertainty === 'High' || row.matches < 2);
    const firstTeamRow = sortedSorterRows[0] || null;
    const teamsDecisionCue: AdminV4TeamsDecisionCue = (() => {
      if (sortedSorterRows.length === 0) {
        return {
          label: 'Load teams and evidence',
          detail: 'The board cannot rank or explain teams until schedule, team, or scouting rows exist.',
          tone: 'amber',
          actionLabel: 'Open Imports',
          onAction: () => openDataPanel('imports')
        };
      }
      if (searchedTeamRow) {
        return {
          label: `Open Team ${searchedTeamRow.teamNumber}`,
          detail: `${searchedTeamRow.teamName || 'Selected team'} is already highlighted. Open the profile for notes, match history, range, and gaps.`,
          tone: 'fuchsia',
          actionLabel: 'Open Profile',
          onAction: () => openTeamDrilldown(searchedTeamRow.teamNumber, 'sorter')
        };
      }
      if (lowTrustRows.length > 0) {
        return {
          label: 'Fix low-trust teams before ranking too hard',
          detail: `${lowTrustRows.length} team${lowTrustRows.length === 1 ? '' : 's'} need more rows or clearer evidence. Start with ${lowTrustRows.slice(0, 4).map(row => row.teamNumber).join(', ')}.`,
          tone: 'rose',
          actionLabel: 'Assign Evidence',
          onAction: () => openDataPanel('collection')
        };
      }
      const topTeamRow = firstTeamRow;
      if (!topTeamRow) {
        return {
          label: 'Load teams and evidence',
          detail: 'The board cannot rank or explain teams until schedule, team, or scouting rows exist.',
          tone: 'amber',
          actionLabel: 'Open Imports',
          onAction: () => openDataPanel('imports')
        };
      }
      return {
        label: `Open top ranked team ${topTeamRow.teamNumber}`,
        detail: 'The board has enough first-pass trust. Open the top profile before making pick-list or match-plan decisions.',
        tone: 'cyan',
        actionLabel: 'Open Profile',
        onAction: () => openTeamDrilldown(topTeamRow.teamNumber, 'sorter')
      };
    })();
    return (
      <LazyAdminV4TeamsWorkflow
        rows={sortedSorterRows}
        sorterField={sorterField}
        sorterDirection={sorterDirection}
        teamsAdvancedStats={teamsAdvancedStats}
        ownTeamNumber={ownTeamNumber}
        searchedTeamNumber={searchedTeamNumber}
        ppaInsightsByTeam={ppaInsightsByTeam}
        decisionCue={teamsDecisionCue}
        modelAction={renderModelAwareAction()}
        summary={{
          teamsLoaded: sortedSorterRows.length,
          ppaShapes: ppaReadinessSummary.shapedInsights,
          lowConfidence: ppaReadinessSummary.lowConfidence,
          matchRows: records.length + v4Records.length
        }}
        onOpenTeam={teamNumber => openTeamDrilldown(teamNumber, 'sorter')}
        onSort={handleSorterSort}
        onToggleSortDirection={() => setSorterDirection(previous => (previous === 'asc' ? 'desc' : 'asc'))}
        onToggleAdvancedStats={() => {
          const next = !teamsAdvancedStats;
          setTeamsAdvancedStats(next);
          if (!next && !['ppa', 'matches', 'team'].includes(sorterField)) {
            setSorterField('ppa');
            setSorterDirection('desc');
          }
        }}
        onOpenWiki={key => openWiki(key, 'sorter')}
        onOpenInfoMenu={openInfoMenu}
      />
    );
  };

  const renderMatchDetail = () => {
    const redTeams = selectedPrediction?.red.teams || selectedMatch?.alliances.red.team_keys.map(normalizeTeamKey) || [];
    const blueTeams = selectedPrediction?.blue.teams || selectedMatch?.alliances.blue.team_keys.map(normalizeTeamKey) || [];
    const redPpaSummary = summarizePpaAlliance(redTeams, ppaInsightsByTeam);
    const bluePpaSummary = summarizePpaAlliance(blueTeams, ppaInsightsByTeam);
    const matchTeams = Array.from(new Set([...redTeams, ...blueTeams]));
    const evidenceGapTeams = getTeamsNeedingEvidence(matchTeams);
    const highRiskMatchTeams = matchTeams.filter(teamNumber => {
      const insight = ppaInsightsByTeam[teamNumber];
      return insight?.uncertainty.level === 'High' || insight?.tailRisk.level === 'High';
    });
    const ownMatchAlliance: 'Red' | 'Blue' | '' = ownTeamNumber && redTeams.includes(ownTeamNumber)
      ? 'Red'
      : ownTeamNumber && blueTeams.includes(ownTeamNumber)
        ? 'Blue'
        : '';
    const ownBestPlan = ownMatchAlliance === 'Red'
      ? selectedStrategyMatchPlan?.bestRedPlan
      : ownMatchAlliance === 'Blue'
        ? selectedStrategyMatchPlan?.bestBluePlan
        : '';
    const selectedPlanAlliance: 'Red' | 'Blue' | '' =
      selectedStrategyMatchPlan?.predictedWinner === 'Red' || selectedStrategyMatchPlan?.predictedWinner === 'Blue'
        ? selectedStrategyMatchPlan.predictedWinner
        : '';
    const ownMatchWinCondition = formatStrategyWinConditionForAlliance(
      selectedStrategyMatchPlan,
      ownMatchAlliance || selectedPlanAlliance,
      { ownPerspective: Boolean(ownMatchAlliance) }
    );
    const matchNextAction = (() => {
      if (evidenceGapTeams.length > 0) return `Fill evidence gaps before treating the forecast as settled: ${describeEvidenceGaps(matchTeams)}.`;
      if (highRiskMatchTeams.length > 0) return `Read ${highRiskMatchTeams.slice(0, 5).join(', ')} as ranges and check recent notes before drive-team lock-in.`;
      if (selectedStrategyMatchPlan?.riskFlags.length) return selectedStrategyMatchPlan.riskFlags[0];
      return 'Use the automatic plan, then open Manual Simulator only for role changes or replacement-team scenarios.';
    })();
    const loadSimulator = () => {
      setRedSimulatorInput(redTeams.join(', '));
      setBlueSimulatorInput(blueTeams.join(', '));
      setSimulatorQuickEntry(`${redTeams.join(' ')} vs ${blueTeams.join(' ')}`);
      openManualSimulator();
    };

    return (
      <div className="space-y-5">
        <AdminSurface className="p-5">
          <FocusHeader
            eyebrow="Match Detail"
            title={selectedPrediction?.title || selectedMatch?.key.split('_')[1]?.toUpperCase() || 'Match'}
            description="This known match is already simulated here. Use manual mode only when you want to try a different alliance or what-if role plan."
            action={<AdminButton onClick={() => openWorkflow('predictor')}><ChevronLeft className="h-4 w-4" />Back to Matches</AdminButton>}
          />
          <div className="mt-5 admin-g2-sm border border-cyan-400/25 bg-cyan-500/10 p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Drive Team Brief</div>
                <h3 className="mt-1 text-xl font-black text-white">
                  {ownMatchAlliance ? `${ownMatchAlliance} plan: ${ownBestPlan || ownMatchWinCondition || 'pending'}` : ownMatchWinCondition || 'Automatic forecast pending'}
                </h3>
                <p className="mt-2 max-w-4xl text-sm font-semibold leading-relaxed text-cyan-50/80">{matchNextAction}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {evidenceGapTeams.length > 0 && (
                  <AdminButton
                    tone="amber"
                    onClick={() => openDataPanel('collection')}
                  >
                    <ListChecks className="h-4 w-4" />Collect Evidence
                  </AdminButton>
                )}
                <AdminButton tone="fuchsia" onClick={loadSimulator}><Swords className="h-4 w-4" />Manual Simulator</AdminButton>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <MetricField
                label="Forecast Trust"
                value={
                  selectedStrategyMatchPlan?.modelLowConfidence || evidenceGapTeams.length > 0 || highRiskMatchTeams.length > 0
                    ? 'Use carefully'
                    : 'Trust for plan'
                }
              />
              <MetricField label="Evidence Gaps" value={`${evidenceGapTeams.length}`} />
              <MetricField label="Risk Teams" value={`${highRiskMatchTeams.length}`} />
              <MetricField label="Model" value={selectedStrategyMatchPlan?.modelName || 'Selected rating'} />
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <SummaryCard label="Winner" value={selectedPrediction?.predictedWinner || selectedStrategyMatchPlan?.predictedWinner || 'Awaiting forecast'} />
            <SummaryCard label="Red Forecast" value={formatMetricValue(selectedPrediction?.red.predictedScore ?? selectedStrategyMatchPlan?.baselineRedScore ?? null)} />
            <SummaryCard label="Blue Forecast" value={formatMetricValue(selectedPrediction?.blue.predictedScore ?? selectedStrategyMatchPlan?.baselineBlueScore ?? null)} />
          </div>
          <div className="mt-4">
            <PpaMatchupReadout
              redSummary={redPpaSummary}
              blueSummary={bluePpaSummary}
              onInfo={() => openWiki('ppa', 'predictor')}
              onInfoContext={event => openInfoMenu(event, 'ppa')}
            />
          </div>
        </AdminSurface>

        {renderHeadScoutMatchBrief({
          prediction: selectedPrediction,
          match: selectedMatch,
          plan: selectedStrategyMatchPlan,
          fallbackAlliance: ownMatchAlliance || 'Red'
        })}

        <div className="grid gap-4 lg:grid-cols-2">
          <PpaAllianceBrief title="Red Expected Range" summary={redPpaSummary} accentClass="text-red-100" />
          <PpaAllianceBrief title="Blue Expected Range" summary={bluePpaSummary} accentClass="text-blue-100" />
        </div>

        <LazyAdminV4StrategyPlanPanel
          plan={selectedStrategyMatchPlan}
          winCondition={ownMatchWinCondition}
        />

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
                    const defense = adminV4DefenseImpactLookup[teamNumber] ?? 0;
                    const insight = ppaInsightsByTeam[teamNumber];
                    return (
                      <div key={teamNumber} className="admin-g2-sm flex flex-wrap items-center justify-between gap-3 border border-slate-800 bg-slate-950/70 px-3 py-2">
                        <span className="font-mono font-black text-white">{teamNumber}</span>
                        <span className="text-slate-400">{insight?.role.label || (defense > rating ? 'Defender' : 'Primary Scorer')}</span>
                        <PpaMiniShape insight={insight || null} fallbackRating={Math.max(rating, defense)} />
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
          <AdminButton onClick={() => openWiki('rankings', 'predictor')}><BookOpen className="h-4 w-4" />Forecast Math</AdminButton>
        </div>
      </div>
    );
  };

  const renderMatchesView = () => {
    if (selectedMatchKey) return renderMatchDetail();

    const playedRows: AdminV4PlayedMatchRow[] = activePredictorMatches.filter(isPlayedMatch).slice(-10).reverse().map(match => ({
      key: match.key,
      label: match.key.split('_')[1]?.toUpperCase() || match.key,
      redScore: match.alliances.red.score,
      blueScore: match.alliances.blue.score
    }));
    const forecastRows: Array<AdminV4MatchForecastRow & { index: number; needsAttention: number }> = activePredictions.map((match, index) => {
      const redPpaSummary = summarizePpaAlliance(match.red.teams, ppaInsightsByTeam);
      const bluePpaSummary = summarizePpaAlliance(match.blue.teams, ppaInsightsByTeam);
      const matchTeams = Array.from(new Set([...match.red.teams, ...match.blue.teams]));
      const evidenceGapTeams = getTeamsNeedingEvidence(matchTeams);
      const riskTeams = matchTeams.filter(teamNumber => {
        const insight = ppaInsightsByTeam[teamNumber];
        return insight?.uncertainty.level === 'High' || insight?.tailRisk.level === 'High';
      });
      const includesOwnTeam = Boolean(ownTeamNumber && matchTeams.includes(ownTeamNumber));
      const ownAlliance = includesOwnTeam && match.red.teams.includes(ownTeamNumber)
        ? 'Red'
        : includesOwnTeam && match.blue.teams.includes(ownTeamNumber)
          ? 'Blue'
          : '';
      const ourSummary = ownAlliance === 'Blue' ? bluePpaSummary : redPpaSummary;
      const opponentSummary = ownAlliance === 'Blue' ? redPpaSummary : bluePpaSummary;
      const attentionText = evidenceGapTeams.length > 0
        ? `Need evidence: ${describeEvidenceGaps(matchTeams, 4)}`
        : riskTeams.length > 0
          ? `Read as range: ${riskTeams.slice(0, 4).join(', ')}`
          : 'Open for role plan, RP path, and manual what-if entry.';
      const trustLabel = match.predictionLowConfidence
        ? 'Low'
        : evidenceGapTeams.length > 0
          ? 'Gaps'
          : riskTeams.length > 0
            ? 'Range'
            : 'Standard';
      return {
        key: match.key,
        title: match.title,
        index,
        redTeams: match.red.teams,
        blueTeams: match.blue.teams,
        redScore: formatMetricValue(match.red.predictedScore),
        blueScore: formatMetricValue(match.blue.predictedScore),
        predictedWinner: match.predictedWinner,
        predictionLowConfidence: match.predictionLowConfidence,
        includesOwnTeam,
        ownAlliance,
        ourPpaLabel: ownAlliance ? 'Our Range' : 'Red Range',
        ourPpaRange: formatPpaRange(ourSummary),
        opponentPpaLabel: ownAlliance ? 'Opp Range' : 'Blue Range',
        opponentPpaRange: formatPpaRange(opponentSummary),
        evidenceGapCount: evidenceGapTeams.length,
        riskTeamCount: riskTeams.length,
        attentionText,
        trustLabel,
        trustTone: (match.predictionLowConfidence || evidenceGapTeams.length > 0 || riskTeams.length > 0 ? 'amber' : 'emerald') as 'amber' | 'emerald',
        trustDetail: evidenceGapTeams.length > 0 ? `${evidenceGapTeams.length} evidence` : riskTeams.length > 0 ? `${riskTeams.length} risk` : 'ready',
        needsAttention: evidenceGapTeams.length + riskTeams.length
      };
    });
    const priorityForecastRows = [...forecastRows]
      .sort((left, right) => {
        if (left.includesOwnTeam !== right.includesOwnTeam) return left.includesOwnTeam ? -1 : 1;
        if (left.needsAttention !== right.needsAttention) return right.needsAttention - left.needsAttention;
        return left.index - right.index;
      })
      .slice(0, 4);
    const firstOwnMatchRow = forecastRows.find(row => row.includesOwnTeam) || null;
    const firstEvidenceGapRow = forecastRows.find(row => row.evidenceGapCount > 0) || null;
    const firstForecastRow = forecastRows[0] || null;
    const matchesNextAction: AdminV4MatchesNextAction = (() => {
      if (forecastRows.length === 0) {
        return {
          label: 'Load or upload a future schedule',
          detail: 'Matches cannot auto-simulate until future match rows with known teams exist.',
          tone: 'amber',
          actionLabel: 'Open Imports',
          onAction: () => openDataPanel('imports')
        };
      }
      if (firstEvidenceGapRow) {
        return {
          label: `Collect evidence before ${firstEvidenceGapRow.title}`,
          detail: firstEvidenceGapRow.attentionText,
          tone: 'rose',
          actionLabel: 'Assign Evidence',
          onAction: () => openDataPanel('collection')
        };
      }
      if (firstOwnMatchRow) {
        return {
          label: `Open our next plan: ${firstOwnMatchRow.title}`,
          detail: 'This match includes our team. Open the plan before talking to drive team or alliance partners.',
          tone: 'fuchsia',
          actionLabel: 'Open Plan',
          onAction: () => openMatchPlan(firstOwnMatchRow.key)
        };
      }
      const nextForecastRow = firstForecastRow;
      if (!nextForecastRow) {
        return {
          label: 'Load or upload a future schedule',
          detail: 'Matches cannot auto-simulate until future match rows with known teams exist.',
          tone: 'amber',
          actionLabel: 'Open Imports',
          onAction: () => openDataPanel('imports')
        };
      }
      return {
        label: `Open next automatic simulation: ${nextForecastRow.title}`,
        detail: 'No own-team match is first in queue, so start with the next forecast and watch for risk or evidence warnings.',
        tone: 'cyan',
        actionLabel: 'Open Simulation',
        onAction: () => openMatchPlan(nextForecastRow.key)
      };
    })();

    return (
      <LazyAdminV4MatchesWorkflow
        predictorUnavailableMessage={predictorUnavailableMessage}
        predictorIsLoading={predictorIsLoading}
        predictorMatchSourceLabel={predictorMatchSourceLabel}
        modelAction={renderModelAwareAction()}
        nextAction={matchesNextAction}
        priorityRows={priorityForecastRows}
        forecastRows={forecastRows}
        playedRows={playedRows}
        ownTeamNumber={ownTeamNumber}
        searchedTeamNumber={searchedTeamNumber}
        teamNameLookup={resolvedTeamNameLookup}
        onManualSimulator={openManualSimulator}
        onOpenMatch={openMatchPlan}
        onOpenPpaWiki={() => openWiki('ppa', 'predictor')}
        onOpenPpaInfoMenu={event => openInfoMenu(event, 'ppa')}
      />
    );
  };

  const renderSimulatorView = () => (
    <LazyAdminV4ManualSimulatorPanel
      modelAction={renderModelAwareAction()}
      modelLabel={MODEL_LABELS[selectedMetric]}
      quickEntry={simulatorQuickEntry}
      redInput={redSimulatorInput}
      blueInput={blueSimulatorInput}
      redRows={redSimulatorRows}
      blueRows={blueSimulatorRows}
      summary={simulatorSummary}
      redPpaSummary={redSimulatorPpaSummary}
      bluePpaSummary={blueSimulatorPpaSummary}
      onSetQuickEntry={setSimulatorQuickEntry}
      onSetRedInput={setRedSimulatorInput}
      onSetBlueInput={setBlueSimulatorInput}
      onApplyQuickEntry={applyQuickSimulatorEntry}
      onBack={() => openWorkflow('predictor')}
      onOpenPpaWiki={() => openWiki('ppa', 'simulator')}
      onOpenPpaInfoMenu={event => openInfoMenu(event, 'ppa')}
    />
  );

  const renderVisualizeView = () => (
    <React.Suspense fallback={<EmbeddedPanelLoading label="Loading Visualize..." />}>
      <LazyAdminV4VisualizeWorkflow
        visualMetricKeys={visualMetricKeys}
        visualAdvancedPickerOpen={visualAdvancedPickerOpen}
        visualChartConfigs={visualChartConfigs}
        ppaShapeRows={ppaShapeRows}
        onSetVisualMetricKeys={setVisualMetricKeys}
        onSetVisualAdvancedPickerOpen={setVisualAdvancedPickerOpen}
        onToggleVisualMetric={toggleVisualMetric}
        onOpenWiki={key => openWiki(key, 'visualize')}
        onOpenInfoMenu={openInfoMenu}
      />
    </React.Suspense>
  );

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
    const ownAllianceLabel = `A${allianceSeed}`;
    const ourPickedRows = pickedRows.filter(row => row.pickedBy === ownAllianceLabel);
    const otherPickedRows = pickedRows.filter(row => row.pickedBy !== ownAllianceLabel);
    const topAvailableRows = availableRows.slice(0, 24);
    const selectedAllianceTeams = Array.from(new Set([
      ownTeamNumber,
      ...ourPickedRows.map(row => row.teamNumber)
    ].filter(Boolean)));
    const pickListDecisionCue = topAvailableRows[0]
      ? {
        label: `Review ${topAvailableRows[0].teamNumber} before changing the board`,
        detail: `${resolvedTeamNameLookup[topAvailableRows[0].teamNumber] || 'Top available team'} is the current highest available candidate. Open the team first, then mark status only after the evidence makes sense.`,
        actionLabel: 'Open Team',
        onAction: () => openTeamDrilldown(topAvailableRows[0]!.teamNumber, 'pickList')
      }
      : {
        label: 'Load or refresh pick-list evidence',
        detail: 'There is no available team to rank yet. Fix data freshness before alliance selection becomes a real decision surface.',
        actionLabel: 'Open Data',
        onAction: () => openDataPanel('sources')
      };
    const selectedAllianceSummary = summarizePpaAlliance(selectedAllianceTeams, ppaInsightsByTeam);
    const assignedLaneTeams = new Set<string>();
    const takeUniqueLaneRows = (rows: AlliancePickRecommendation[], limit = 4) => {
      const uniqueRows = rows.filter(row => !assignedLaneTeams.has(row.teamNumber)).slice(0, limit);
      uniqueRows.forEach(row => assignedLaneTeams.add(row.teamNumber));
      return uniqueRows;
    };
    const floorLaneRows = takeUniqueLaneRows(
      [...availableRows].sort((left, right) => (ppaFloorForPick(right) - riskPenaltyForPick(right)) - (ppaFloorForPick(left) - riskPenaltyForPick(left)))
    );
    const ceilingLaneRows = takeUniqueLaneRows(
      [...availableRows].sort((left, right) => (ppaCeilingForPick(right) - riskPenaltyForPick(right) * 0.4) - (ppaCeilingForPick(left) - riskPenaltyForPick(left) * 0.4))
    );
    const roleLaneCandidates = [...availableRows]
      .filter(row => ppaDefenseForPick(row) > 0.05 || ['Defender', 'Flex'].includes(ppaInsightsByTeam[row.teamNumber]?.role.label || row.roleFit))
      .sort((left, right) => ppaDefenseForPick(right) - ppaDefenseForPick(left) || ppaExpectedForPick(right) - ppaExpectedForPick(left));
    const roleLaneRows = takeUniqueLaneRows(roleLaneCandidates);
    const pickLanes = [
      {
        key: 'floor',
        title: 'Safe Floor',
        detail: 'Best when you are high seed and need the pick to work every match.',
        metricLabel: 'Floor',
        rows: floorLaneRows
      },
      {
        key: 'ceiling',
        title: 'Upside Ceiling',
        detail: 'Best when you need upset potential or a second-round swing.',
        metricLabel: 'Ceiling',
        rows: ceilingLaneRows
      },
      roleLaneRows.length > 0 ? {
        key: 'role',
        title: 'Role Balance',
        detail: 'Defender/flex value so the alliance is not three identical scorers.',
        metricLabel: 'Defense',
        rows: roleLaneRows
      } : null
    ].filter((lane): lane is { key: 'floor' | 'ceiling' | 'role'; title: string; detail: string; metricLabel: string; rows: AlliancePickRecommendation[] } => !!lane);
    const getPickLaneReason = (laneKey: 'floor' | 'ceiling' | 'role', row: AlliancePickRecommendation) => {
      if (laneKey === 'floor') {
        return `Reliable floor ${formatMetricValue(ppaFloorForPick(row), 1)} after risk penalty.`;
      }
      if (laneKey === 'ceiling') {
        return `Upside ceiling ${formatMetricValue(ppaCeilingForPick(row), 1)} for swing matches.`;
      }
      return `Adds defense/flex value ${formatMetricValue(ppaDefenseForPick(row), 1)} instead of another pure scorer.`;
    };
    const statusClass = (status: AlliancePickRecommendation['status']) => {
      if (status === 'picked') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
      if (status === 'declined') return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
      if (status === 'unavailable') return 'border-rose-400/30 bg-rose-500/15 text-rose-100';
      return 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100';
    };
    const renderPickStatusActions = (row: AlliancePickRecommendation, size: 'compact' | 'table' = 'compact') => (
      <details className="relative">
        <summary className={`admin-g2-sm flex min-h-10 cursor-pointer list-none items-center justify-center bg-slate-800 px-3 py-2 text-center text-xs font-black text-slate-100 hover:bg-slate-700 ${size === 'table' ? 'min-w-24' : 'min-w-20'}`}>
          Status
        </summary>
        <div className="admin-g2-sm absolute right-0 z-20 mt-2 min-w-40 border border-slate-700 bg-slate-950 p-1 shadow-md shadow-slate-950/30">
          <button type="button" onClick={() => openScoutWorkItem(buildPickListScoutTask(row))} className="block min-h-10 w-full admin-g2-sm px-3 py-2 text-left text-xs font-black text-cyan-100 hover:bg-cyan-500/15">Scout Check</button>
          <div className="my-1 border-t border-slate-800" />
          <button type="button" onClick={() => void requestPickStatusChange(row.teamNumber, 'picked', ownAllianceLabel)} className="block min-h-10 w-full admin-g2-sm px-3 py-2 text-left text-xs font-black text-emerald-100 hover:bg-emerald-500/15">Our Pick</button>
          <button type="button" onClick={() => void requestPickStatusChange(row.teamNumber, 'picked', 'Other')} className="block min-h-10 w-full admin-g2-sm px-3 py-2 text-left text-xs font-black text-slate-100 hover:bg-slate-800">Taken</button>
          <button type="button" onClick={() => void requestPickStatusChange(row.teamNumber, 'declined')} className="block min-h-10 w-full admin-g2-sm px-3 py-2 text-left text-xs font-black text-amber-100 hover:bg-amber-500/15">Declined</button>
          <button type="button" onClick={() => void requestPickStatusChange(row.teamNumber, 'unavailable')} className="block min-h-10 w-full admin-g2-sm px-3 py-2 text-left text-xs font-black text-rose-100 hover:bg-rose-500/15">Unavailable</button>
          {row.status !== 'available' && (
            <button type="button" onClick={() => void requestPickStatusChange(row.teamNumber, 'available')} className="block min-h-10 w-full admin-g2-sm px-3 py-2 text-left text-xs font-black text-cyan-100 hover:bg-cyan-500/15">Clear Status</button>
          )}
        </div>
      </details>
    );
    const handleQuickPickStatusChange = async (
      teamNumber: string,
      status: AlliancePickRecommendation['status'],
      pickedBy = ''
    ) => {
      const sanitizedTeamNumber = sanitizeTeamNumber(teamNumber);
      if (!sanitizedTeamNumber) return false;
      return requestPickStatusChange(sanitizedTeamNumber, status, pickedBy);
    };
    const buildPickListScoutTask = (row: AlliancePickRecommendation): ScoutWorkItem => {
      const status = teamEvidenceByTeam[row.teamNumber];
      const insight = ppaInsightsByTeam[row.teamNumber] || null;
      const roleLabel = insight?.role.label || row.roleFit;
      const highRisk = insight?.tailRisk.level === 'High' || insight?.uncertainty.level === 'High';
      const needsDefenseRead =
        (status?.defenseRows ?? 0) === 0 &&
        (roleLabel === 'Defender' || roleLabel === 'Flex' || (insight?.components.defenseImpact ?? 0) > 4);
      const missionKey: ScoutingMissionKey =
        (status?.pitRows ?? 0) === 0
          ? 'pitScout'
          : needsDefenseRead
            ? 'defenseScout'
            : 'matchScout';
      const reason =
        (status?.pitRows ?? 0) === 0
          ? ((status?.preScoutRows ?? 0) > 0 ? 'pit interview missing' : 'verify pick prior')
          : needsDefenseRead
            ? 'verify defense value'
            : highRisk
              ? 'verify pick risk'
              : 'confirm pick fit';
      const detail =
        missionKey === 'pitScout'
          ? ((status?.preScoutRows ?? 0) > 0
            ? 'Alliance selection has a public Pre Scout prior, but still needs a pit interview before trusting this pick-list lane.'
            : 'Alliance selection needs a pit or pre-event prior before trusting this pick-list lane.')
          : missionKey === 'defenseScout'
            ? 'Alliance selection needs proof that this defense/flex value is real and foul-safe.'
            : 'Alliance selection needs a fresh match read on role, reliability, and whether the expected range is trustworthy.';

      return {
        id: `pickList:${ownAllianceLabel}:${missionKey}:${row.teamNumber}:${reason}`,
        teamNumber: row.teamNumber,
        teamName: resolvedTeamNameLookup[row.teamNumber] || '',
        missionKey,
        label: SCOUTING_MISSIONS[missionKey].title,
        reason,
        detail,
        priority: 5,
        context: `Pick List ${ownAllianceLabel}`,
        ppa: buildScoutTaskPpaContext(row.teamNumber, missionKey, reason, status?.attentionReasons || [])
      };
    };

    return (
      <LazyAdminV4PickListWorkflow
        pickStatusUndoActive={Boolean(pickStatusUndo)}
        pickListMeetingMode={pickListMeetingMode}
        allianceSeed={allianceSeed}
        ownAllianceLabel={ownAllianceLabel}
        summary={{
          ourPicks: ourPickedRows.length,
          taken: otherPickedRows.length,
          available: pickListSummary.available,
          topAvailableTeam: topAvailableRows[0]?.teamNumber || 'None'
        }}
        decisionCue={pickListDecisionCue}
        selectedAllianceShape={<PpaAllianceBrief title="Current Alliance Shape" summary={selectedAllianceSummary} accentClass="text-amber-100" />}
        selectedAllianceTeams={selectedAllianceTeams}
        otherPickedRows={otherPickedRows}
        pickLanes={pickLanes}
        pickBoardRows={pickBoardRows}
        topAvailableRows={topAvailableRows}
        ownTeamNumber={ownTeamNumber}
        searchedTeamNumber={searchedTeamNumber}
        teamNameLookup={resolvedTeamNameLookup}
        ppaInsightsByTeam={ppaInsightsByTeam}
        getLaneValue={(laneKey, row) => {
          const laneValue = laneKey === 'floor'
            ? ppaFloorForPick(row)
            : laneKey === 'ceiling'
              ? ppaCeilingForPick(row)
              : ppaDefenseForPick(row);
          return formatMetricValue(laneValue, 1);
        }}
        getLaneReason={getPickLaneReason}
        getDecisionScore={row => formatMetricValue(ppaDecisionScoreForPick(row), 1)}
        getStatusClass={statusClass}
        renderPickStatusActions={renderPickStatusActions}
        renderPpaMiniShape={row => (
          <PpaMiniShape insight={ppaInsightsByTeam[row.teamNumber] || null} fallbackRating={row.score} />
        )}
        onQuickStatusChange={handleQuickPickStatusChange}
        onUndoStatus={undoLastPickStatusChange}
        onToggleMeetingMode={() => setPickListMeetingMode(previous => !previous)}
        onSetAllianceSeed={setAllianceSeed}
        onOpenTeam={teamNumber => openTeamDrilldown(teamNumber, 'pickList')}
        onOpenWiki={() => openWiki('ppa', 'pickList')}
        onOpenInfoMenu={event => openInfoMenu(event, 'ppa')}
      />
    );
  };

  const renderCollectionControlPanel = () => {
    const futureMatchCount = activePredictorMatches.filter(match => (match.comp_level === 'pm' || match.comp_level === 'qm') && !isPlayedMatch(match)).length;
    const playableForecastCount = activePredictions.length;
    const missionRows: Array<{
      key: ScoutingMissionKey;
      count: number;
      countLabel: string;
      status: string;
      actionLabel: string;
    }> = [
      {
        key: 'preScout',
        count: preScoutEvidenceTeamCount || preMatchCache?.profiles.length || allKnownTeams.length,
        countLabel: preScoutAdminTaskEvidence.length > 0 ? 'pre returns' : preMatchCache ? 'public profiles' : 'known teams',
        status: preScoutAdminTaskEvidence.length > 0
          ? 'Returned public-context evidence is now part of the admin feedback loop.'
          : preMatchCache?.profiles.length
            ? 'Cached public team context and missing-data questions before scouts arrive.'
            : 'Public team context and missing-data questions before scouts arrive.',
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
        status: 'The strongest local input for expected range, volatility, and scout trust.',
        actionLabel: 'Open Match Scout'
      },
      {
        key: 'defenseScout',
        count: defenseRecords.length,
        countLabel: 'defense rows',
        status: 'Defense impact and role protection so the expected range does not confuse defense with weak offense.',
        actionLabel: 'Open Defense Scout'
      }
    ];
    const useMomentRows = Object.values(SCOUTING_USE_MOMENTS);
    const useMomentDestinations: Record<ScoutingUseMomentKey, { tab: WorkflowTab; panel?: DataPanel; label: string }> = {
      now: { tab: 'command', label: 'Open Now' },
      matches: { tab: 'predictor', label: 'Open Matches' },
      pickList: { tab: 'pickList', label: 'Open Pick List' },
      visualize: { tab: 'visualize', label: 'Open Visualize' },
      data: { tab: 'import', panel: 'collection', label: 'Stay in Data' }
    };
    const openMission = (key: ScoutingMissionKey) => {
      if (key === 'preScout') {
        openDataPanel('preScout');
        return;
      }
      const route = SCOUTING_MISSIONS[key].route;
      if (route) navigate(route);
    };
    const openUseMoment = (key: ScoutingUseMomentKey) => {
      const destination = useMomentDestinations[key];
      if (destination.panel) {
        openDataPanel(destination.panel);
        return;
      }
      openWorkflow(destination.tab);
    };

    return (
      <AdminSurface className="p-5">
        <FocusHeader
          eyebrow="Data"
          title="Collection Workflow"
          description="A map of what scouts collect, what the app derives, and which head-scout moment uses each signal."
          action={<AdminButton onClick={closeDataPanel}><ChevronLeft className="h-4 w-4" />Back to Data</AdminButton>}
        />

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <SummaryCard label="Known Teams" value={allKnownTeams.length} />
          <SummaryCard label="Future Matches" value={futureMatchCount} />
          <SummaryCard label="Forecasts" value={playableForecastCount} />
          <SummaryCard label="Pre Evidence" value={preScoutEvidenceTeamCount} />
          <SummaryCard label="Ranges Ready" value={ppaReadinessSummary.shapedInsights} />
          <SummaryCard label="Audit Gaps" value={rawEditorSummary.missingSlotCount} />
          <SummaryCard label="Unsynced" value={localArchiveSummary.unsyncedRecords.length} />
        </div>

        <div className="mt-5">
          <LazyAdminV4DataPipelinePanel stages={collectionPipelineStages} ppaReadinessCards={ppaReadinessCards} compact />
        </div>

        <div className="mt-5 admin-g2 border border-cyan-400/25 bg-cyan-500/10 p-5">
          <FocusHeader
            eyebrow="Scout Work Queue"
            title="What to send scouts to collect next"
            description="Prioritized from the next known match, expected-range uncertainty, pit priors, and defense-role evidence gaps."
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {scoutWorkQueue.map(item => {
              const mission = SCOUTING_MISSIONS[item.missionKey];
              const teamName = resolvedTeamNameLookup[item.teamNumber] || '';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openScoutWorkItem(item)}
                  className={`admin-g2-sm border p-4 text-left transition-transform hover:-translate-y-0.5 ${getMissionToneClasses(mission.tone)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.18em] opacity-75">{item.context}</div>
                      <div className="mt-1 text-lg font-black text-white">{item.label} Team {item.teamNumber}</div>
                      {teamName && <div className="mt-1 text-xs font-semibold opacity-75">{teamName}</div>}
                    </div>
                    <span className="admin-g2-sm shrink-0 border border-white/10 bg-slate-950/30 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white/80">
                      {item.reason}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold opacity-85">{item.detail}</p>
                  {item.ppa && (
                    <div className="mt-3 grid gap-2 text-xs font-semibold sm:grid-cols-3">
                      <div className="admin-g2-sm border border-white/10 bg-slate-950/30 px-3 py-2">
                        <div className="font-black uppercase tracking-[0.14em] opacity-70">Expected Range</div>
                        <div className="mt-1 text-white">
                          {formatMetricValue(item.ppa.floor ?? null, 1)} / {formatMetricValue(item.ppa.expected ?? null, 1)} / {formatMetricValue(item.ppa.ceiling ?? null, 1)}
                        </div>
                      </div>
                      <div className="admin-g2-sm border border-white/10 bg-slate-950/30 px-3 py-2">
                        <div className="font-black uppercase tracking-[0.14em] opacity-70">Role</div>
                        <div className="mt-1 text-white">{item.ppa.role || 'Needs role evidence'}</div>
                      </div>
                      <div className="admin-g2-sm border border-white/10 bg-slate-950/30 px-3 py-2">
                        <div className="font-black uppercase tracking-[0.14em] opacity-70">Risk</div>
                        <div className="mt-1 text-white">{item.ppa.uncertainty || 'Needs risk read'} / {item.ppa.tailRisk || 'Needs tail read'}</div>
                      </div>
                    </div>
                  )}
                  {item.ppa?.asks && item.ppa.asks.length > 0 && (
                    <div className="admin-g2-sm mt-3 border border-white/10 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-white/85">
                      <div className="font-black uppercase tracking-[0.14em] opacity-70">What To Prove</div>
                      <div className="mt-1 leading-relaxed">{item.ppa.asks[0]}</div>
                    </div>
                  )}
                  <div className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-white/80">Open {mission.title}</div>
                </button>
              );
            })}
            {scoutWorkQueue.length === 0 && (
              <AdminEmptyState
                title="No scout collection tasks yet"
                why="Prioritized tasks need teams, a schedule, or evidence gaps before Admin V4 can tell scouts where to go next."
                action="Load a team list, upload a schedule, or collect enough initial rows to reveal coverage gaps."
                className="lg:col-span-2"
              />
            )}
          </div>
        </div>

        <div className="mt-5 admin-g2 border border-emerald-400/25 bg-emerald-500/10 p-5">
          <FocusHeader
            eyebrow="Evidence Returned"
            title="Admin tasks that came back as rows"
            description="When a scout opens an Admin task and submits, the row keeps the expected-range context it was meant to verify."
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {completedAdminTaskEvidenceRows.map(row => {
              const task = row.adminTask!;
              return (
                <div key={row.key} className="admin-g2-sm border border-emerald-400/25 bg-slate-950/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">{row.recordType}</div>
                      <div className="mt-1 text-lg font-black text-white">Team {row.teamNumber}</div>
                      <div className="mt-1 text-xs font-semibold text-slate-400">{row.matchLabel}</div>
                    </div>
                    <span className="admin-g2-sm border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-100">
                      {task.reason || task.context || 'admin task'}
                    </span>
                  </div>
                  {task.ppa && (
                    <AdminTaskPpaClosurePanel task={task} />
                  )}
                  <div className="mt-3 text-xs font-semibold leading-relaxed text-slate-400">
                    {task.detail || task.context || 'This row is linked to an Admin V4 collection task.'}
                  </div>
                </div>
              );
            })}
            {completedAdminTaskEvidenceRows.length === 0 && (
              <AdminEmptyState
                title="No returned Admin-task rows yet"
                why="This panel proves that a task sent from Admin came back as actual evidence. Empty means the loop has not closed yet."
                action="Open a queued scout task, submit the row, then refresh Data."
                className="lg:col-span-2"
              />
            )}
          </div>
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
                <div className="mt-4 admin-g2-sm border border-white/10 bg-slate-950/35 p-3 text-xs font-semibold text-white/80">
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
            <button
              key={moment.key}
              type="button"
              onClick={() => openUseMoment(moment.key)}
              className="admin-g2-sm border border-slate-800 bg-slate-950 p-4 text-left transition-colors hover:border-cyan-400/35 hover:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-black text-white">{moment.title}</div>
                <span className="admin-g2-sm border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase text-slate-300">
                  {useMomentDestinations[moment.key].label}
                </span>
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-500">{moment.when}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {moment.fedBy.map(key => (
                  <span key={key} className={`admin-g2-sm border px-2 py-1 text-[10px] font-black uppercase ${getMissionToneClasses(SCOUTING_MISSIONS[key].tone)}`}>
                    {SCOUTING_MISSIONS[key].title}
                  </span>
                ))}
              </div>
              <div className="mt-3 text-xs font-semibold text-slate-400">{moment.needs.slice(0, 4).join(' / ')}</div>
            </button>
          ))}
        </div>
      </AdminSurface>
    );
  };

  const renderModelLabView = () => (
    <LazyAdminV4ModelValidationPanel
      backtests={adminV4ModelBacktests}
      bestForecastLayerName={adminV4BestForecastLayer.modelName}
      bestModelBacktest={bestModelBacktest}
      featureMatchSnapshots={adminV4FeatureMatchSnapshots}
      judgeSummary={bestModelJudgeSummary}
      latestFeatureSnapshot={latestFeatureSnapshot}
      latestModelSnapshot={latestModelSnapshot}
      modelSnapshotStatus={modelSnapshotStatus}
      forecastSnapshotCount={adminV4ForecastSnapshots.length}
      ppaTeamCount={Object.keys(adminV4PpaRatings).length}
      promotionCandidateCount={promotionCandidateCount}
      scoutCalibrationRows={scoutCalibrationRows}
      usableModelCount={usableModelCount}
      onSaveForecastSnapshot={saveForecastSnapshotNow}
      onBack={closeDataPanel}
    />
  );

  const renderScoutsControlPanel = () => (
    <LazyAdminV4ScoutStaffingPanel
      adjustmentAmount={powerCoinAdjustmentAmount}
      adjustmentReason={powerCoinAdjustmentReason}
      adjustmentScout={powerCoinAdjustmentScout}
      bets={powerCoinBets}
      ownTeamNumber={ownTeamNumber}
      powerCoinRows={powerCoinRows}
      powerCoinStatus={powerCoinStatus}
      scoutAssignmentPlan={scoutAssignmentPlan}
      scoutControlStatus={scoutControlStatus}
      scoutExposureRows={scoutExposureRows}
      scoutRosterText={scoutRosterText}
      searchedTeamNumber={searchedTeamNumber}
      teamNameLookup={resolvedTeamNameLookup}
      onApplyAdjustment={handlePowerCoinAdjustment}
      onBack={closeDataPanel}
      onExportCoverageGaps={handleExportScoutCoverageGapsCsv}
      onExportScoutAssignments={handleExportScoutAssignmentsCsv}
      onOptimizeScouts={handleOptimizeScouts}
      onSetAdjustmentAmount={setPowerCoinAdjustmentAmount}
      onSetAdjustmentReason={setPowerCoinAdjustmentReason}
      onSetAdjustmentScout={setPowerCoinAdjustmentScout}
      onSetScoutRosterText={setScoutRosterText}
      onSettleAllPlayed={handleSettleAllPlayedPowerCoins}
      onSettleMatch={handleSettlePowerCoins}
    />
  );

  const renderDataView = () => {
    if (dataPanel === 'collection') return renderCollectionControlPanel();
    if (dataPanel === 'preScout') return (
      <LazyAdminV4PreScoutPanel
        cachedProfileCount={preMatchCache?.profiles.length || 0}
        eventKey={eventKey}
        evidenceTeamCount={preScoutEvidenceTeamCount}
        returnedEvidenceCount={preScoutAdminTaskEvidence.length}
        onBack={() => openDataPanel('collection')}
        onCacheChanged={() => void refreshPreMatchCache()}
      />
    );
    if (dataPanel === 'audit') {
      return (
        <LazyAdminV4RawAuditPanel
          groups={rawEditorGroups}
          search={rawEditorSearch}
          summary={rawEditorSummary}
          viewTab={rawEditorViewTab}
          onBack={closeDataPanel}
          onSetSearch={setRawEditorSearch}
          onSetViewTab={setRawEditorViewTab}
        />
      );
    }
    if (dataPanel === 'models') return renderModelLabView();
    if (dataPanel === 'scouts') return renderScoutsControlPanel();
    if (dataPanel === 'imports') {
      return (
        <LazyAdminV4ImportsPanel
          csvError={csvError}
          csvMessages={csvMessages}
          isScannerActive={activeTab === 'import' && dataPanel === 'imports'}
          onArchiveChanged={() => void refreshLocalArchiveRecords()}
          onBack={closeDataPanel}
          onTbaFilesSelected={handleOprCsvUpload}
        />
      );
    }
    if (dataPanel === 'sources') {
      return (
        <LazyAdminV4SourceFreshnessPanel
          formatFreshnessAge={formatFreshnessAge}
          formatLocalTimestamp={formatLocalTimestamp}
          preMatchProfileCount={preMatchCache?.profiles.length || 0}
          preScoutEvidenceTeamCount={preScoutEvidenceTeamCount}
          preScoutTaskCount={preScoutAdminTaskEvidence.length}
          sourceStatusRows={sourceStatusRows}
          sourceStatusSummary={sourceStatusSummary}
          onBack={closeDataPanel}
        />
      );
    }
    if (dataPanel === 'backup') {
      return (
        <LazyAdminV4BackupSyncPanel
          adminAuditLogEntries={adminAuditLogEntries}
          adminAuditLogError={adminAuditLogError}
          isLocalArchiveSyncing={isLocalArchiveSyncing}
          localArchiveError={localArchiveError}
          localArchiveSummary={localArchiveSummary}
          localArchiveSyncStatus={localArchiveSyncStatus}
          localBackupError={localBackupError}
          localBackupStatus={localBackupStatus}
          formatLocalTimestamp={formatLocalTimestamp}
          onBack={closeDataPanel}
          onExportFullLocalBackup={handleExportFullLocalBackup}
          onExportSafeLocalSummary={handleExportSafeLocalSummary}
          onImportFullLocalBackup={handleImportFullLocalBackup}
          onRefreshAdminAuditLogEntries={refreshAdminAuditLogEntries}
          onSyncLocalArchiveToFirebase={handleSyncLocalArchiveToFirebase}
        />
      );
    }

    const dataCards: Array<AdminV4DataCard<DataPanel>> = [
      {
        panel: 'imports',
        step: '1',
        title: 'Load Schedule / Rankings',
        when: 'Before the event, between matches, or when offline cache is missing.',
        output: 'TBA/FIRST schedule, rankings, teams, official rating files, QR scans, JSON scout archives.',
        health: sourceStatusSummary.rowCount > 0 ? `${sourceStatusSummary.rowCount} sources loaded` : 'Official source missing',
        icon: <Upload className="h-5 w-5" />,
        tone: sourceStatusSummary.rowCount > 0 ? 'cyan' : 'amber'
      },
      {
        panel: 'collection',
        step: '2',
        title: 'Collect Scout Evidence',
        when: 'Before pit closes and before each match cycle starts.',
        output: 'Pre-scout context, pit priors, match rows, defense evidence.',
        health: `${preScoutEvidenceTeamCount} pre teams / ${records.length + v4Records.length} match rows / ${activePitArchiveRecords.length} pit priors`,
        icon: <ListChecks className="h-5 w-5" />,
        tone: records.length + v4Records.length > 0 ? 'emerald' : 'amber'
      },
      {
        panel: 'audit',
        step: '3',
        title: 'Fix Missing / Bad Rows',
        when: 'After every scout wave and before trusting expected-range changes.',
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
        title: 'Check Source Freshness',
        when: 'Any time schedule/ranking/model results feel stale.',
        output: 'Cache age, uploaded file status, FIRST credentials, source rows.',
        health: `Latest ${formatFreshnessAge(sourceStatusSummary.latestTimestamp)}`,
        icon: <RefreshCw className="h-5 w-5" />,
        tone: sourceStatusSummary.rowCount > 0 ? 'emerald' : 'amber'
      },
      {
        panel: 'models',
        step: '5',
        title: 'Check Model Trust',
        when: 'Before relying on future quals, pick lists, or demo-facing claims.',
        output: 'Backtests, calibration, expected-range counts, feature snapshots.',
        health: bestModelBacktest ? `${bestModelBacktest.modelName} leading` : 'Waiting for played matches',
        icon: <TrendingUp className="h-5 w-5" />,
        tone: bestModelBacktest ? 'fuchsia' : 'amber'
      },
      {
        panel: 'scouts',
        step: '6',
        title: 'Assign Scouts',
        when: 'Before practice/quals blocks and whenever staffing changes.',
        output: 'Scout assignments, coverage gaps, exposure balance, scout rewards.',
        health: scoutAssignmentPlan ? `${scoutAssignmentPlan.assignments.length} assignments` : 'No assignment plan',
        icon: <Users className="h-5 w-5" />,
        tone: scoutAssignmentPlan ? 'cyan' : 'amber'
      },
      {
        panel: 'backup',
        step: '7',
        title: 'Sync / Backup Device',
        when: 'Before leaving the venue, switching machines, or deploying updates.',
        output: 'Firebase sync, local archive health, full Admin V4 backup.',
        health: localArchiveSummary.unsyncedRecords.length > 0 ? `${localArchiveSummary.unsyncedRecords.length} unsynced` : 'Synced enough',
        icon: <Database className="h-5 w-5" />,
        tone: localArchiveSummary.unsyncedRecords.length > 0 ? 'amber' : 'slate'
      }
    ];
    type DataPriorityItem = AdminV4DataPriorityItem<DataPanel>;
    const rawDataPriorityQueue: Array<DataPriorityItem | null> = [
      sourceStatusSummary.rowCount === 0
        ? {
          label: 'Official Source Needed',
          detail: `${records.length + v4Records.length + defenseRecords.length} scout evidence row${records.length + v4Records.length + defenseRecords.length === 1 ? '' : 's'} loaded, but official schedule/source data is missing.`,
          actionLabel: 'Open Imports',
          panel: 'imports',
          tone: 'amber'
        }
        : null,
      (preMatchCache?.profiles.length || 0) > 0 && preScoutAdminTaskEvidence.length === 0
        ? {
          label: 'Return Pre Scout Evidence',
          detail: `${preMatchCache?.profiles.length || 0} public profile${(preMatchCache?.profiles.length || 0) === 1 ? '' : 's'} are cached, but no focused Pre Scout task has returned yet.`,
          actionLabel: 'Pre Scout',
          panel: 'preScout',
          tone: 'cyan'
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
      defenseMetricGuardrailSummary.adjustedRecords > 0
        ? {
          label: 'Review Defense Metrics',
          detail: `${defenseMetricGuardrailSummary.adjustedRecords} defense metric${defenseMetricGuardrailSummary.adjustedRecords === 1 ? '' : 's'} were clamped to the valid 0-100% range before display.`,
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
          label: 'Improve Range Trust',
          detail: `${ppaReadinessSummary.lowConfidence} team${ppaReadinessSummary.lowConfidence === 1 ? '' : 's'} have low scout trust for expected ranges.`,
          actionLabel: 'Collection',
          panel: 'collection',
          tone: 'fuchsia'
        }
        : null
    ];
    const dataPriorityQueue = rawDataPriorityQueue
      .filter((item): item is DataPriorityItem => !!item)
      .slice(0, 4);
    const visiblePriorityQueue: DataPriorityItem[] = dataPriorityQueue.length > 0
      ? dataPriorityQueue
      : [{
        label: 'Control Room Clear',
        detail: 'No immediate data, sync, source, or scout-plan warnings are active.',
        actionLabel: 'Sources',
        panel: 'sources' as DataPanel,
        tone: 'emerald' as const
      }];
    const dataQuickNeeds: Array<AdminV4DataQuickNeed<DataPanel>> = [
      {
        label: 'load schedule or rankings',
        detail: sourceStatusSummary.rowCount > 0
          ? `Official sources are loaded. Latest: ${formatFreshnessAge(sourceStatusSummary.latestTimestamp)}.`
          : 'Open imports to load TBA/FIRST schedule, rankings, teams, and source files.',
        actionLabel: sourceStatusSummary.rowCount > 0 ? 'Check sources' : 'Open imports',
        panel: sourceStatusSummary.rowCount > 0 ? 'sources' : 'imports',
        tone: sourceStatusSummary.rowCount > 0 ? 'emerald' : 'amber'
      },
      {
        label: 'assign scouts for the next block',
        detail: scoutAssignmentPlan
          ? `${scoutAssignmentPlan.assignments.length} assignments exist. Recheck station coverage and same-team continuity.`
          : 'Build a scout assignment plan before practice or qualification blocks start.',
        actionLabel: 'Open scouts',
        panel: 'scouts',
        tone: scoutAssignmentPlan ? 'cyan' : 'amber'
      },
      {
        label: 'fix missing or suspicious rows',
        detail: rawEditorSummary.missingSlotCount > 0 || rawEditorSummary.anomalyRowCount > 0
          ? `${rawEditorSummary.missingSlotCount} missing slot${rawEditorSummary.missingSlotCount === 1 ? '' : 's'} and ${rawEditorSummary.anomalyRowCount} anomal${rawEditorSummary.anomalyRowCount === 1 ? 'y' : 'ies'} need review.`
          : 'No visible row gaps right now. Open audit when a score, scout row, or match count looks wrong.',
        actionLabel: 'Open audit',
        panel: 'audit',
        tone: rawEditorSummary.missingSlotCount > 0 ? 'rose' : rawEditorSummary.anomalyRowCount > 0 ? 'amber' : 'slate'
      },
      {
        label: 'prove the model is safe to trust',
        detail: bestModelBacktest
          ? `${bestModelBacktest.modelName} is leading the current backtest. Check calibration before using it in demo or drive-team claims.`
          : 'Open model trust after played matches exist so forecasts have evidence, not guesswork.',
        actionLabel: 'Open model trust',
        panel: 'models',
        tone: bestModelBacktest ? 'fuchsia' : 'amber'
      },
      {
        label: 'return scout evidence into the model',
        detail: completedAdminTaskEvidenceRows.length > 0
          ? `${completedAdminTaskEvidenceRows.length} returned task${completedAdminTaskEvidenceRows.length === 1 ? '' : 's'} can be checked against expected ranges.`
          : 'Use collection when dispatched scout tasks need to become usable evidence.',
        actionLabel: 'Open collection',
        panel: 'collection',
        tone: completedAdminTaskEvidenceRows.length > 0 ? 'emerald' : 'cyan'
      },
      {
        label: 'sync or back up this device',
        detail: localArchiveSummary.unsyncedRecords.length > 0
          ? `${localArchiveSummary.unsyncedRecords.length} local record${localArchiveSummary.unsyncedRecords.length === 1 ? '' : 's'} still need sync.`
          : 'Export a full local backup before switching machines, leaving the venue, or deploying updates.',
        actionLabel: 'Open sync / backup',
        panel: 'backup',
        tone: localArchiveSummary.unsyncedRecords.length > 0 ? 'amber' : 'slate'
      }
    ];
    const signalSpineRows: Array<AdminV4DataSignalRow<DataPanel>> = [
      {
        label: 'Raw Evidence',
        value: `${preScoutAdminTaskEvidence.length + records.length + v4Records.length + defenseRecords.length + activePitArchiveRecords.length}`,
        detail: 'Pre Scout returned evidence, pit priors, match rows, defense rows, QR imports, and uploaded source files.',
        actionLabel: 'Audit',
        panel: rawEditorSummary.missingSlotCount > 0 || rawEditorSummary.anomalyRowCount > 0 ? 'audit' : 'collection',
        tone: rawEditorSummary.missingSlotCount > 0 ? 'rose' : rawEditorSummary.anomalyRowCount > 0 ? 'amber' : 'cyan'
      },
      {
        label: 'Processed Signals',
        value: `${ppaReadinessSummary.shapedInsights}`,
        detail: 'Expected range, role fit, scout trust, volatility, defense impact, and model-trust checks.',
        actionLabel: 'Trust',
        panel: 'models',
        tone: ppaReadinessSummary.shapedInsights > 0 ? 'fuchsia' : 'amber'
      },
      {
        label: 'Decision Surfaces',
        value: `${activePredictions.length}`,
        detail: 'Now briefing, future match plans, manual simulator, pick list, visual charts, and report packets.',
        actionLabel: 'Sources',
        panel: sourceStatusSummary.rowCount > 0 ? 'sources' : 'imports',
        tone: activePredictions.length > 0 ? 'emerald' : 'amber'
      },
      {
        label: 'Feedback Loop',
        value: `${completedAdminTaskEvidenceRows.length}`,
        detail: 'Admin-created scout tasks return with expected-range context so the model can prove or revise the read.',
        actionLabel: 'Collection',
        panel: completedAdminTaskEvidenceRows.length > 0 ? 'collection' : 'scouts',
        tone: completedAdminTaskEvidenceRows.length > 0 ? 'emerald' : 'slate'
      }
    ];
    const primaryDataPriority = visiblePriorityQueue[0]!;
    const dataPulseRows = [
      { label: 'Official Sources', value: sourceStatusSummary.rowCount, detail: sourceStatusSummary.rowCount > 0 ? formatFreshnessAge(sourceStatusSummary.latestTimestamp) : 'schedule/source missing', panel: 'sources' as DataPanel },
      { label: 'Scout Evidence', value: preScoutAdminTaskEvidence.length + records.length + v4Records.length + defenseRecords.length + activePitArchiveRecords.length, detail: `${records.length + v4Records.length} match rows`, panel: 'collection' as DataPanel },
      { label: 'Ranges Ready', value: ppaReadinessSummary.shapedInsights, detail: `${ppaReadinessSummary.lowConfidence} low trust`, panel: 'models' as DataPanel },
      { label: 'Unsynced', value: localArchiveSummary.unsyncedRecords.length, detail: `${localArchiveSummary.conflictRecords.length} conflicts`, panel: 'backup' as DataPanel }
    ];

    return (
      <LazyAdminV4DataOverviewWorkflow
        dataCards={dataCards}
        dataPulseRows={dataPulseRows}
        primaryDataPriority={primaryDataPriority}
        quickNeeds={dataQuickNeeds}
        signalSpineRows={signalSpineRows}
        visiblePriorityQueue={visiblePriorityQueue}
        onOpenPanel={panel => openDataPanel(panel as DataPanel)}
      />
    );
  };

  const renderReportsView = () => {
    const ppaTeamCount = ppaReadinessSummary.shapedInsights || Object.keys(adminV4PpaRatings).length;
    const rawEvidenceRows = preScoutAdminTaskEvidence.length + records.length + v4Records.length + defenseRecords.length + activePitArchiveRecords.length;

    return (
      <LazyAdminV4ReportsPanel
        bestModelName={bestModelBacktest?.modelName || ''}
        exportStatus={exportStatus}
        futureSimulationCount={activePredictions.length}
        latestSourceLabel={sourceStatusSummary.latestTimestamp ? formatFreshnessAge(sourceStatusSummary.latestTimestamp) : 'No official source loaded'}
        modelAction={renderModelAwareAction()}
        nextMatchTitle={activePredictions[0]?.title || ''}
        pickListAvailable={pickListSummary.available}
        pickListSelected={pickListSummary.selected}
        ppaTeamCount={ppaTeamCount}
        preScoutEvidenceTeamCount={preScoutEvidenceTeamCount}
        rawAnomalyRowCount={rawEditorSummary.anomalyRowCount}
        rawEvidenceRows={rawEvidenceRows}
        rawMissingSlotCount={rawEditorSummary.missingSlotCount}
        sourceRowCount={sourceStatusSummary.rowCount}
        spotlightPackKey={reportsSpotlightPackKey}
        unsyncedCount={localArchiveSummary.unsyncedRecords.length}
        onExportWorkbook={() => void exportInsightsWorkbook()}
        onOpenModelProof={() => openDataPanel('models')}
        onOpenNextMatchPlan={() => {
          setPredictorViewTab('quals');
          if (activePredictions[0]) {
            openMatchPlan(activePredictions[0].key);
            return;
          }
          openWorkflow('predictor');
        }}
        onOpenNow={() => openWorkflow('command')}
        onOpenPickList={() => openWorkflow('pickList')}
        onOpenRawEvidence={() => openDataPanel(rawEditorSummary.missingSlotCount > 0 || rawEditorSummary.anomalyRowCount > 0 ? 'audit' : 'backup')}
        onOpenStatsWiki={() => openWiki('ppa', 'export')}
      />
    );
  };

  const renderContent = () => {
    if (activeTab === 'wiki') return <StatWikiView activeKey={wikiStatKey} onSelect={key => openWiki(key, wikiReturnTab)} onBack={handleAdminBack} />;
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
      <AdminV4CommandBar
        activeTab={activeTab}
        activePanel={activeTab === 'import' ? dataPanel : null}
        activeWorkspaceKey={activeWorkspaceKey}
        activeWorkspaceLabel={activeWorkspace.label}
        adminBackLabel={adminBackLabel}
        allKnownTeams={allKnownTeams}
        backgroundRefreshing={backgroundRefreshing}
        eventKey={eventKey}
        isTeamSearchOpen={isTeamSearchOpen}
        loading={loading}
        moreWorkflowMenuOpen={moreWorkflowMenuOpen}
        primaryWorkspaceItems={primaryWorkspaceItems}
        teamNameLookup={resolvedTeamNameLookup}
        teamSearchError={teamSearchError}
        teamSearchInput={teamSearchInput}
        teamSearchSuggestions={teamSearchSuggestions}
        testModeActive={testModeActive}
        testModeEnabled={settings.testModeEnabled}
        testModeSelectedMatchLabel={testModeSelectedMatchLabel}
        workspaceItems={workspaceItems}
        commandBrief={globalCommandBrief}
        searchInputRef={smartSearchInputRef}
        onBack={handleAdminBack}
        onManualSimulator={openManualSimulator}
        onOpenCommandPalette={openCommandPalette}
        onOpenSearchedTeam={runSmartSearch}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenSearchSuggestion={openSmartSearchResult}
        onOpenStatsWiki={() => openWiki('ppa', activeTab)}
        onOpenWorkflow={openWorkflow}
        onOpenWorkflowItem={openWorkflowItem}
        onRefresh={() => void loadV3Data({ preserveScroll: true })}
        onSetMoreWorkflowMenuOpen={setMoreWorkflowMenuOpen}
        onSetTeamSearchError={setTeamSearchError}
        onSetTeamSearchInput={setTeamSearchInput}
        onSetTeamSearchOpen={setIsTeamSearchOpen}
      />

      <AdminV4CommandPalette
        open={commandPaletteOpen}
        inputRef={commandPaletteInputRef}
        searchInput={commandPaletteInput}
        searchError={commandPaletteError}
        suggestions={commandPaletteSuggestions}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenSearchInput={runCommandPaletteSearch}
        onOpenSuggestion={openSmartSearchResult}
        onSetSearchError={setCommandPaletteError}
        onSetSearchInput={setCommandPaletteInput}
      />

      <main ref={mainScrollRef} className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
        <div className="mx-auto max-w-7xl pb-10">
          <React.Suspense fallback={<EmbeddedPanelLoading label={`Loading ${activeWorkspace.label}...`} />}>
            {settings.testModeEnabled && (
              <AdminSurface className={`mb-5 hidden p-4 md:block ${
                testModeActive
                  ? 'border-fuchsia-400/30 bg-fuchsia-500/10'
                  : 'border-amber-400/30 bg-amber-500/10'
              }`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className={`text-xs font-black uppercase tracking-[0.2em] ${testModeActive ? 'text-fuchsia-100' : 'text-amber-100'}`}>
                      Test Mode {testModeActive ? 'Active' : 'Needs Match'}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-200">
                      {testModeActive
                        ? `Rehearsing ${eventKey} before ${testModeSelectedMatchLabel}. Admin V4 is using ${testModeScope.scopedRecordCount}/${testModeScope.sourceRecordCount} scouting rows and treating ${testModeSelectedMatchLabel} as the next match.`
                        : `Choose a match in Settings. Until then, ${eventKey} is loaded but the cutoff is not active.`}
                    </p>
                  </div>
                  <AdminButton tone={testModeActive ? 'fuchsia' : 'amber'} onClick={() => setSettingsOpen(true)}>
                    Configure Test Mode
                  </AdminButton>
                </div>
              </AdminSurface>
            )}
            {renderContent()}
          </React.Suspense>
        </div>
      </main>

      <AdminV4SettingsModal
        apiKeyError={apiKeyError}
        apiKeyStatus={apiKeyStatus}
        eventKey={eventKey}
        firstCredentialError={firstCredentialError}
        firstCredentialStatus={firstCredentialStatus}
        firstCredentials={firstCredentials}
        hasLocalTbaApiKey={hasLocalTbaApiKey}
        isSearchingEvents={isSearchingEvents}
        normalEventKey={normalEventKey}
        open={settingsOpen}
        ownTeamNumber={ownTeamNumber}
        searchResults={searchResults}
        searchYear={searchYear}
        settings={settings}
        scoutIdentityPassphrase={scoutIdentityPassphrase}
        scoutIdentityHash={scoutIdentityHash}
        scoutIdentityStatus={scoutIdentityStatus}
        sourceRowCount={sourceStatusSummary.rowCount}
        testModeMatchOptions={testModeMatchOptions}
        testModeScope={testModeScope}
        onClose={() => setSettingsOpen(false)}
        onCredentialUpload={handleFirstCredentialUpload}
        onRefreshFirstEventCache={handleRefreshFirstEventCache}
        onRequestClearFirstCredentials={requestClearFirstCredentials}
        onRequestClearTbaApiKey={requestClearTbaApiKey}
        onRequestExitTestMode={async () => {
          const confirmed = await requestAdminActionConfirmation({
            title: 'Exit Test Mode',
            message: 'Exit Test Mode and return Admin V4 to live/current event data on this browser?',
            detail: 'Fixture context is session-only. The app will stop pretending the selected match is next.',
            confirmLabel: 'Exit Test Mode',
            tone: 'rose'
          });
          if (!confirmed) return;
          updateSettings({ testModeEnabled: false, testModeMatchKey: '' });
        }}
        onSearchEvents={searchEvents}
        onSetSearchYear={setSearchYear}
        onSetScoutIdentityPassphrase={setScoutIdentityPassphrase}
        onSaveScoutIdentityPassphrase={handleSaveScoutIdentityPassphrase}
        onCopyScoutIdentityPassphrase={handleCopyScoutIdentityPassphrase}
        onUpdateSettings={updateSettings}
        sanitizeTeamNumber={sanitizeTeamNumber}
      />

      <AdminV4ActionConfirmationModal
        request={actionConfirmation}
        onCancel={cancelActionConfirmation}
        onConfirm={confirmActionConfirmation}
      />

      <AdminV4BackupRestorePreviewModal
        open={Boolean(backupImportPreview)}
        eventKey={backupImportPreview?.backup.eventKey || eventKey}
        exportedAtLabel={formatLocalTimestamp(backupImportPreview?.backup.exportedAt)}
        categories={backupImportCategories}
        onToggleCategory={(key, selected) => {
          if (!(key in backupImportOptions)) return;
          setBackupImportOptions(prev => ({ ...prev, [key as BackupImportCategory]: selected }));
        }}
        onClose={() => {
          setBackupImportPreview(null);
          setLocalBackupStatus('Backup restore cancelled from preview.');
        }}
        onRestore={() => void restorePreviewedFullLocalBackup()}
      />

      <AdminV4PowerCoinSettlementModal
        request={powerCoinSettlementRequest}
        formatMetricValue={formatMetricValue}
        onCancel={() => {
          setPowerCoinSettlementRequest(null);
          setPowerCoinStatus('Scout reward settlement cancelled.');
        }}
        onConfirm={() => void confirmPowerCoinSettlement()}
      />

      {infoMenu && (
        <AdminContextMenu x={infoMenu.x} y={infoMenu.y} onClose={() => setInfoMenu(null)}>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const { statKey } = infoMenu;
              setInfoMenu(null);
              openWiki(statKey);
            }}
            className="flex min-h-10 w-full items-center gap-2 admin-g2-sm px-3 py-2 text-left text-sm font-black text-slate-200 hover:bg-slate-800"
          >
            <BookOpen className="h-4 w-4" />Get Info
          </button>
        </AdminContextMenu>
      )}
    </div>
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
    <AdminV4StatWiki
      activeKey={activeKey}
      activeInfo={activeInfo}
      entries={entries.map(([key, info]) => ({ key, info }))}
      onSelect={onSelect}
      onBack={onBack}
    />
  );
}
