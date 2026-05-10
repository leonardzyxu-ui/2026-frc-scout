import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowLeft,
  Download,
  Edit3,
  ListChecks,
  RefreshCw,
  Search,
  Settings,
  Swords,
  Table2,
  TrendingUp,
  Trophy,
  Upload,
  X
} from 'lucide-react';
import { db } from '../firebase';
import {
  MatchDefenseScoutingV1,
  MatchScoutingV3,
  MatchScoutingV4,
  ModelFeatureSnapshot,
  ModelLabSnapshot,
  PowerCoinBet,
  PowerCoinLedgerEntry,
  PreMatchTeamProfile,
  ScoutAssignmentPlan
} from '../types';
import { TBA_API_KEY } from '../config';
import { calculateLegacyDprRatings, calculateLegacyOprRatings, MathEngine, TBAMatch } from '../utils/mathEngine';
import QRScannerView from './QRScannerView';
import {
  buildHistoricalAverageLookup,
  buildPredictedMatchesFromRatings,
  buildPredictedMatchesV3,
  buildTeamDefenseMetrics,
  buildTeamHistoricalAveragesV4Aware
} from '../utils/adminV2Analytics';
import {
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
  clearFirstEventsCredentials,
  getPowerCoinBalance,
  listAdminV2CacheEntries,
  listModelFeatureSnapshots,
  listPowerCoinBets,
  listPowerCoinLedger,
  listModelLabSnapshots,
  loadFirstEventsCredentials,
  loadLatestModelLabSnapshot,
  loadLatestScoutAssignmentPlan,
  putAdminV2CacheEntry,
  restoreAdminV2CacheEntries,
  saveFirstEventsCredentials,
  saveModelFeatureSnapshot,
  saveModelLabSnapshot,
  saveScoutAssignmentPlan,
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
import { getYearFromEventKey } from '../utils/firstEventsApi';
import { fetchPreMatchTeamProfile } from '../utils/preMatchScouting';
import { isMatchDefenseScoutingV1 } from '../utils/matchDefenseScouting';
import { isMatchScoutingV4 } from '../utils/matchScoutingV4';
import AdminV2StrategyBrainView from './AdminV2StrategyBrainView';
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

type AdminV2Tab = 'results' | 'rawEditor' | 'teams' | 'sorter' | 'predictor' | 'simulator' | 'strategyBrain' | 'import' | 'export';
type PredictorDisplayTab = 'ranking' | 'quals' | 'finals';
type ResultsDisplayTab = 'quals' | 'practice';
type SorterField = 'team' | 'tbaRank' | 'matches' | 'ppc' | 'autoPpc' | 'teleopPpc' | 'defenseMetric' | 'epa' | 'opr' | 'dpr';
type SorterDirection = 'asc' | 'desc';

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

const QUICK_EVENTS: Array<[string, string]> = [
  ['2026MNUM', '2026MNUM (MN North Star)'],
  ['2026cnsh', '2026cnsh (Shanghai)'],
  ['TEST', 'TEST EVENT']
];

const MODEL_LABELS: Record<AdminV2SelectedMetric, string> = {
  ppc: 'PPC',
  opr: 'OPR',
  epa: 'EPA'
};

const isMatchScoutingV3 = (value: unknown): value is MatchScoutingV3 =>
  !!value &&
  typeof value === 'object' &&
  (value as Partial<MatchScoutingV3>).schemaVersion === 'v3';

const normalizeTeamKey = (teamKey: string) => teamKey.replace(/^frc/i, '');

const sanitizeTeamNumber = (value: string) => value.replace(/[^\d]/g, '');

const isPlayedMatch = (match: TBAMatch) =>
  match.alliances.red.score !== -1 && match.alliances.blue.score !== -1;

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
    .filter(Boolean)
    .slice(0, 3);

const parseQuickTeamEntry = (value: string) => {
  const teams = value
    .split(/[\s,]+/)
    .map(team => sanitizeTeamNumber(team))
    .filter(Boolean)
    .slice(0, 6);

  return {
    redTeams: teams.slice(0, 3),
    blueTeams: teams.slice(3, 6)
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

export default function AdminMainframeV2View() {
  const navigate = useNavigate();
  const initialSettings = useMemo(() => loadAdminV2Settings(), []);
  const [settings, setSettings] = useState<AdminV2Settings>(initialSettings);
  const [teamSearchInput, setTeamSearchInput] = useState(initialSettings.searchedTeamNumber);
  const [activeTab, setActiveTab] = useState<AdminV2Tab>('results');
  const [predictorViewTab, setPredictorViewTab] = useState<PredictorDisplayTab>('ranking');
  const [resultsViewTab, setResultsViewTab] = useState<ResultsDisplayTab>('quals');
  const [rawEditorViewTab, setRawEditorViewTab] = useState<ResultsDisplayTab>('quals');
  const [rawEditorSearch, setRawEditorSearch] = useState('');
  const [sorterField, setSorterField] = useState<SorterField>('ppc');
  const [sorterDirection, setSorterDirection] = useState<SorterDirection>('desc');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [records, setRecords] = useState<MatchScoutingV3[]>([]);
  const [v4Records, setV4Records] = useState<MatchScoutingV4[]>([]);
  const [defenseRecords, setDefenseRecords] = useState<MatchDefenseScoutingV1[]>([]);
  const [liveEventMatches, setLiveEventMatches] = useState<TBAMatch[]>([]);
  const [alliances, setAlliances] = useState<TBAEliminationAlliance[] | null>(null);
  const [eventSummary, setEventSummary] = useState<TBAEventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveScheduleUnavailable, setLiveScheduleUnavailable] = useState('');
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
  const [localBackupStatus, setLocalBackupStatus] = useState('');
  const [localBackupError, setLocalBackupError] = useState('');
  const [localArchiveRecords, setLocalArchiveRecords] = useState<ScoutArchiveRecord[]>([]);
  const [localArchiveError, setLocalArchiveError] = useState('');
  const [isLocalArchiveSyncing, setIsLocalArchiveSyncing] = useState(false);
  const [localArchiveSyncStatus, setLocalArchiveSyncStatus] = useState('');
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';

  const eventKey = settings.eventKey;
  const selectedMetric = settings.selectedMetric;
  const ownTeamNumber = settings.ownTeamNumber;
  const searchedTeamNumber = settings.searchedTeamNumber;

  const refreshLocalArchiveRecords = useCallback(async () => {
    try {
      const archiveRecords = await listScoutArchiveRecords({ eventKey, includeDeleted: true });
      setLocalArchiveRecords(archiveRecords);
      setLocalArchiveError('');
    } catch (archiveError) {
      console.error('Failed to load local scout archive records in Admin V2', archiveError);
      setLocalArchiveRecords([]);
      setLocalArchiveError('Unable to read the local scout archive on this admin device.');
    }
  }, [eventKey]);

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
    setUploadedCsvPack(loadUploadedTbaCsvPack(eventKey));
    setCsvMessages([]);
    setCsvError('');
  }, [eventKey]);

  useEffect(() => {
    setTeamSearchInput(searchedTeamNumber);
  }, [searchedTeamNumber]);

  useEffect(() => {
    let cancelled = false;
    const hydrateFirstCredentials = async () => {
      try {
        const credentials = await loadFirstEventsCredentials().catch(() => null);
        if (!cancelled) setFirstCredentials(credentials);
      } catch (credentialError) {
        console.warn('Failed to load FIRST Events credentials', credentialError);
      }
    };
    void hydrateFirstCredentials();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadV3Data = async () => {
    setLoading(true);
    setError('');
    setLiveScheduleUnavailable('');
    const cacheYear = getYearFromEventKey(eventKey);

    try {
      if (isLocalMode) {
        setRecords([]);
        setV4Records([]);
        setDefenseRecords([]);
      } else {
        const [v3Snapshot, v4Snapshot, defenseSnapshot] = await Promise.all([
          getDocs(collection(db, 'events', eventKey, 'matchScoutingV3')),
          getDocs(collection(db, 'events', eventKey, 'matchScoutingV4')),
          getDocs(collection(db, 'events', eventKey, 'matchScoutingDefense'))
        ]);

        const nextRecords = v3Snapshot.docs
          .map(docSnap => docSnap.data())
          .filter(isMatchScoutingV3)
          .sort((left, right) => {
            const matchDelta = left.matchNumber - right.matchNumber;
            if (matchDelta !== 0) return matchDelta;
            return Number(left.teamNumber) - Number(right.teamNumber);
          });
        const nextDefenseRecords = defenseSnapshot.docs
          .map(docSnap => docSnap.data())
          .filter(isMatchDefenseScoutingV1)
          .sort((left, right) => {
            const matchDelta = left.matchNumber - right.matchNumber;
            if (matchDelta !== 0) return matchDelta;
            return Number(left.teamNumber) - Number(right.teamNumber);
          });
        const nextV4Records = v4Snapshot.docs
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

      if (!TBA_API_KEY || eventKey === 'TEST') {
        setLiveEventMatches([]);
        setAlliances(null);
        setEventSummary(null);
        setCurrentTbaRanks({});
        setCurrentTbaRankOrder([]);
        return;
      }

      const engine = new MathEngine(TBA_API_KEY);
      const normalizedEventKey = eventKey.trim().toLowerCase();

      const [matchesResult, rankingsResult, alliancesResult, summaryResult] = await Promise.allSettled([
        engine.fetchEventMatches(eventKey, { includeUnplayed: true }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/rankings`, {
          headers: { 'X-TBA-Auth-Key': TBA_API_KEY }
        }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/alliances`, {
          headers: { 'X-TBA-Auth-Key': TBA_API_KEY }
        }),
        fetch(`https://www.thebluealliance.com/api/v3/event/${normalizedEventKey}/simple`, {
          headers: { 'X-TBA-Auth-Key': TBA_API_KEY }
        })
      ]);

      if (matchesResult.status === 'fulfilled') {
        setLiveEventMatches(matchesResult.value);
        void putAdminV2CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'matches',
          payload: matchesResult.value
        }).catch(() => {});
      } else {
        console.error('Failed to load live TBA schedule for Admin V2', matchesResult.reason);
        setLiveEventMatches([]);
        setLiveScheduleUnavailable(
          matchesResult.reason instanceof Error
            ? matchesResult.reason.message
            : 'Live TBA schedule is unavailable right now.'
        );
      }

      if (rankingsResult.status === 'fulfilled' && rankingsResult.value.ok) {
        const rankings = (await rankingsResult.value.json()) as TbaRankingsResponse;
        const nextRanks: Record<string, number> = {};
        const nextOrder: string[] = [];

        rankings.rankings?.forEach(ranking => {
          const teamNumber = normalizeTeamKey(ranking.team_key);
          nextRanks[teamNumber] = ranking.rank;
          nextOrder.push(teamNumber);
        });

        setCurrentTbaRanks(nextRanks);
        setCurrentTbaRankOrder(nextOrder);
        void putAdminV2CacheEntry({
          eventKey,
          year: cacheYear,
          source: 'TBA',
          key: 'rankings',
          payload: rankings
        }).catch(() => {});
      } else {
        setCurrentTbaRanks({});
        setCurrentTbaRankOrder([]);
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
        setAlliances(null);
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
        setEventSummary(null);
      }
    } catch (loadError) {
      console.error('Failed to load adminv2 data', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load adminv2 data.');
      setRecords([]);
      setV4Records([]);
      setDefenseRecords([]);
      setLiveEventMatches([]);
      setAlliances(null);
      setEventSummary(null);
      setCurrentTbaRanks({});
      setCurrentTbaRankOrder([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadV3Data();
  }, [eventKey]);

  const searchEvents = async () => {
    if (!TBA_API_KEY) {
      setError('TBA API Key is missing.');
      return;
    }

    setIsSearchingEvents(true);
    setError('');

    try {
      const response = await fetch(`https://www.thebluealliance.com/api/v3/events/${searchYear}`, {
        headers: { 'X-TBA-Auth-Key': TBA_API_KEY }
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
          ...Object.keys(uploadedTeamNames),
          ...(searchedTeamNumber ? [searchedTeamNumber] : [])
        ])
      ).sort((left, right) => Number(left) - Number(right)),
    [defenseRecords, predictorTeams, records, searchedTeamNumber, uploadedTeamNames, v4Records]
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
        }).catch(() => {});
      } catch (fetchError) {
        console.error('Failed to load Admin V2 Statbotics EPA predictor data', fetchError);
        if (cancelled) return;
        setEpaByTeam({});
        setMissingEpaTeams([]);
        setEpaUnavailable('Statbotics EPA is unavailable for this event right now. EPA predictions cannot be shown.');
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
  }, [eventKey, predictorTeams]);

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

      if (!TBA_API_KEY || eventKey === 'TEST') {
        if (!cancelled) {
          setTeamProfile(null);
          setTeamProfileError('TBA team profile is unavailable for this event on this device.');
          setIsTeamProfileLoading(false);
        }
        return;
      }

      setIsTeamProfileLoading(true);
      setTeamProfileError('');

      try {
        const profile = await fetchPreMatchTeamProfile(searchedTeamNumber, eventKey, TBA_API_KEY);
        if (cancelled) return;
        setTeamProfile(profile);
      } catch (profileError) {
        console.error('Failed to load Admin V2 team profile', profileError);
        if (cancelled) return;
        setTeamProfile(null);
        setTeamProfileError(profileError instanceof Error ? profileError.message : 'Failed to load team profile.');
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
  }, [eventKey, searchedTeamNumber]);

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

  const activePredictions =
    selectedMetric === 'ppc' ? ppcPredictions : selectedMetric === 'epa' ? epaPredictions : oprPredictions;

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
  const activeQualificationProjection =
    selectedMetric === 'ppc'
      ? ppcQualificationProjection
      : selectedMetric === 'epa'
        ? epaQualificationProjection
        : oprQualificationProjection;
  const filteredQualificationRows = useMemo(() => {
    const normalizedSearch = rankingSearch.trim().toLowerCase();
    if (!normalizedSearch) return activeQualificationProjection.rows;
    return activeQualificationProjection.rows.filter(row => row.teamNumber.toLowerCase().includes(normalizedSearch));
  }, [activeQualificationProjection.rows, rankingSearch]);

  const activeMetricRatings =
    selectedMetric === 'ppc' ? averageLookup : selectedMetric === 'epa' ? epaRatings : activeOprRatings;
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
      ? 'Live TBA schedule'
      : uploadedScheduleFallback
        ? `${uploadedScheduleFallback.fileName} (${uploadedScheduleFallback.source === 'schedule' ? 'schedule fallback' : 'flat schedule fallback'})`
        : 'No live or uploaded schedule';
  const hasUsableCsvOpr = !!uploadedCsvPack?.coprs && Object.keys(csvOprRatings).length > 0;
  const hasOprBonusMetrics = !!csvOprBonusMetrics && Object.keys(csvOprBonusMetrics).length > 0;

  const resolvedTeamNameLookup = useMemo(
    () => ({
      ...uploadedTeamNames,
      ...(teamProfile ? { [teamProfile.teamNumber]: teamProfile.nickname } : {})
    }),
    [teamProfile, uploadedTeamNames]
  );

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
          { label: 'Avg Cycles', value: activeTeamAverage.avgTeleopCycles.toFixed(2) },
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
    hasUsableCsvOpr,
    searchedTeamNumber,
    selectedMetric
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

  const sorterRows = useMemo<AdminV2SorterRow[]>(() => {
    return allKnownTeams.map(teamNumber => {
      const teamAverage = teamAverageLookupByTeam[teamNumber];
      const defenseMetric = defenseMetricLookupByTeam[teamNumber];
      return {
        teamNumber,
        teamName: resolvedTeamNameLookup[teamNumber] || '',
        matches: teamAverage?.matchesPlayed ?? 0,
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
    calculatedDprRatings,
    defenseMetricLookupByTeam,
    epaRatings,
    effectiveCurrentTbaRanks,
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
    const recommendedRole = (defenseImpact ?? 0) > rating ? 'Defense' : 'Offense';
    return {
      teamNumber,
      teamName: resolvedTeamNameLookup[teamNumber] || '',
      rating,
      ppaRating: adminV2PpaRatings[teamNumber] ?? null,
      defenseImpact,
      recommendedRole,
      auto:
        selectedMetric === 'ppc'
          ? teamAverage?.avgAutoPoints ?? null
          : selectedMetric === 'opr'
            ? oprComponents?.autoPoints ?? null
            : epaMetrics?.autoEPA ?? null,
      teleop:
        selectedMetric === 'ppc'
          ? teamAverage?.avgTeleopPoints ?? null
          : selectedMetric === 'opr'
            ? oprComponents?.teleopPoints ?? null
            : epaMetrics?.teleopEPA ?? null
    };
  };

  const redSimulatorRows = useMemo(
    () => redSimulatorTeams.map(teamNumber => buildSimulatorRow(teamNumber)),
    [redSimulatorTeams, activeMetricRatings, selectedMetric, teamAverageLookupByTeam, csvOprComponents, epaByTeam, resolvedTeamNameLookup, adminV2PpaRatings, simulatorDefenseImpactLookup]
  );
  const blueSimulatorRows = useMemo(
    () => blueSimulatorTeams.map(teamNumber => buildSimulatorRow(teamNumber)),
    [blueSimulatorTeams, activeMetricRatings, selectedMetric, teamAverageLookupByTeam, csvOprComponents, epaByTeam, resolvedTeamNameLookup, adminV2PpaRatings, simulatorDefenseImpactLookup]
  );

  const simulatorSummary = useMemo(() => {
    const redScore = redSimulatorRows.reduce((sum, row) => sum + row.rating, 0);
    const blueScore = blueSimulatorRows.reduce((sum, row) => sum + row.rating, 0);
    const redPpaScore = redSimulatorRows.reduce((sum, row) => sum + (row.ppaRating ?? 0), 0);
    const bluePpaScore = blueSimulatorRows.reduce((sum, row) => sum + (row.ppaRating ?? 0), 0);
    const redDefenseSwing = redSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole === 'Defense' ? row.defenseImpact ?? 0 : 0), 0);
    const blueDefenseSwing = blueSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole === 'Defense' ? row.defenseImpact ?? 0 : 0), 0);
    const redRoleOffense = redSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole === 'Offense' ? row.rating : 0), 0);
    const blueRoleOffense = blueSimulatorRows.reduce((sum, row) => sum + (row.recommendedRole === 'Offense' ? row.rating : 0), 0);
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
  }, [redSimulatorRows, blueSimulatorRows, activeMetricRatings]);

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
      console.error('Failed to import TBA CSV files for Admin V2 OPR', uploadError);
      setCsvError(uploadError instanceof Error ? uploadError.message : 'Failed to import CSV files.');
    }
  };

  const handleEditV4Record = (record: MatchScoutingV4) => {
    localStorage.setItem('match_scout_v4_draft', JSON.stringify(record));
    navigate('/scout');
  };

  const handleFirstCredentialUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFirstCredentialError('');
    setFirstCredentialStatus('Reading FIRST Events credential JSON...');
    try {
      const parsed = JSON.parse(await file.text()) as Partial<FirstEventsCredentials>;
      if (!parsed.username || !parsed.token) {
        throw new Error('Credential JSON must contain username and token.');
      }
      const saved = await saveFirstEventsCredentials({ username: parsed.username, token: parsed.token });
      setFirstCredentials(saved);
      setFirstCredentialStatus('FIRST Events credentials saved locally in IndexedDB.');
    } catch (credentialError) {
      setFirstCredentialError(credentialError instanceof Error ? credentialError.message : 'Failed to import FIRST credentials.');
      setFirstCredentialStatus('');
    }
  };

  const handleClearFirstCredentials = async () => {
    await clearFirstEventsCredentials();
    setFirstCredentials(null);
    setFirstCredentialStatus('FIRST Events credentials cleared from this admin device.');
    setFirstCredentialError('');
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
        version: 1,
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
        `adminv2_full_local_backup_${eventKey}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
        payload
      );
      setLocalBackupStatus(
        `Exported local backup with ${scoutArchive.records.length} scout archive records, ${cacheEntries.length} cache entries, ${powerCoinBets.length} PowerCoin bets, ${modelSnapshots.length} model snapshots, and ${modelFeatureSnapshots.length} feature snapshots. FIRST token was not included.`
      );
    } catch (backupError) {
      console.error('Failed to export full local Admin V2 backup', backupError);
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
        throw new Error('This is not a REBUILT Admin V2 full local backup JSON file.');
      }

      const backupEventKey = parsed.eventKey.trim().toUpperCase();
      if (backupEventKey !== eventKey.trim().toUpperCase()) {
        throw new Error(`This backup is for ${parsed.eventKey}. Switch Admin V2 to that event before restoring it.`);
      }

      let scoutArchiveImported = 0;
      let scoutArchiveSkipped = 0;
      let scoutArchivePowerCoinItems = 0;
      if (parsed.scoutArchive) {
        if (!isScoutArchiveBundle(parsed.scoutArchive)) {
          throw new Error('The embedded scout archive bundle is invalid.');
        }
        const scoutArchiveResult = await importScoutArchiveBundleLocally(parsed.scoutArchive);
        scoutArchiveImported = scoutArchiveResult.imported;
        scoutArchiveSkipped = scoutArchiveResult.skipped;
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
        `Restored backup: ${scoutArchiveImported} scout archive records (${scoutArchiveSkipped} skipped), ${scoutArchivePowerCoinItems} scout-archive PowerCoin items, ${restoredCacheEntries} cache entries, ${(parsed.adminV2?.powerCoinBets || []).length} PowerCoin bets, ${(parsed.adminV2?.powerCoinLedger || []).length} ledger entries, ${(parsed.adminV2?.modelSnapshots || []).length} model snapshots, and ${(parsed.adminV2?.modelFeatureSnapshots || []).length} feature snapshots. FIRST token was not imported.`
      );
      await refreshLocalArchiveRecords();
    } catch (backupError) {
      console.error('Failed to import full local Admin V2 backup', backupError);
      setLocalBackupError(backupError instanceof Error ? backupError.message : 'Failed to import local backup.');
      setLocalBackupStatus('');
    }
  };

  const submitTeamSearch = (event: React.FormEvent) => {
    event.preventDefault();
    updateSettings({ searchedTeamNumber: sanitizeTeamNumber(teamSearchInput) });
  };

  const handleSorterSort = (field: SorterField) => {
    if (sorterField === field) {
      setSorterDirection(previous => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSorterField(field);
    setSorterDirection(field === 'dpr' || field === 'team' || field === 'tbaRank' ? 'asc' : 'desc');
  };

  const applyQuickSimulatorEntry = () => {
    const { redTeams, blueTeams } = parseQuickTeamEntry(simulatorQuickEntry);
    setRedSimulatorInput(redTeams.join(', '));
    setBlueSimulatorInput(blueTeams.join(', '));
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
        { header: 'EPA Source', key: 'epaSource', width: 16 }
      ], allKnownTeams.map(teamNumber => {
        const teamAverage = teamAverageLookupByTeam[teamNumber];
        const defenseMetric = defenseMetricLookupByTeam[teamNumber];
        const epaMetrics = epaByTeam[teamNumber];
        const oprComponents = csvOprComponents[teamNumber];
        return {
          teamNumber,
          teamName: resolvedTeamNameLookup[teamNumber] || '',
          currentTbaRank: effectiveCurrentTbaRanks[teamNumber] ?? '',
          ppc: teamAverage?.avgTotalMatchPoints ?? '',
          cppcAuto: teamAverage?.avgAutoPoints ?? '',
          cppcTeleop: teamAverage?.avgTeleopPoints ?? '',
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
          epaSource: epaMetrics?.source || ''
        };
      }));

      addQualificationProjectionSheet(workbook, 'PPC Ranking', ppcQualificationProjection.rows, resolvedTeamNameLookup);
      addQualificationProjectionSheet(workbook, 'EPA Ranking', epaQualificationProjection.rows, resolvedTeamNameLookup);
      addQualificationProjectionSheet(workbook, 'OPR Ranking', oprQualificationProjection.rows, resolvedTeamNameLookup);

      addQualPredictionSheet(workbook, 'PPC Quals', ppcPredictions);
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
        { header: 'Score MAE', key: 'scoreMae', width: 14 },
        { header: 'Margin MAE', key: 'marginMae', width: 14 },
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
      link.download = `adminv2_insights_${eventKey}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus('success');
      window.setTimeout(() => setExportStatus('idle'), 2500);
    } catch (err) {
      console.error('Failed to export Admin V2 workbook:', err);
      setError(err instanceof Error ? err.message : 'Failed to export the Admin V2 workbook.');
      setExportStatus('idle');
    }
  };

  const tabClass = (tab: AdminV2Tab) =>
    `inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-colors ${
      activeTab === tab
        ? 'bg-cyan-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  const metricButtonClass = (metric: AdminV2SelectedMetric) =>
    `inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-black transition-colors ${
      selectedMetric === metric
        ? 'bg-fuchsia-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  const predictorViewButtonClass = (view: PredictorDisplayTab) =>
    `inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${
      predictorViewTab === view
        ? 'bg-cyan-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  const resultsViewButtonClass = (view: ResultsDisplayTab) =>
    `inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${
      resultsViewTab === view
        ? 'bg-cyan-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  const rawEditorViewButtonClass = (view: ResultsDisplayTab) =>
    `inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-colors ${
      rawEditorViewTab === view
        ? 'bg-cyan-600 text-white'
        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      <aside className="flex w-80 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-4">
          <h1 className="flex items-center gap-3 text-xl font-black tracking-tight text-white">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg bg-slate-800 p-1.5 text-slate-300 transition-colors hover:bg-slate-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            MAINFRAME V2
          </h1>
          <p className="mt-3 text-sm text-slate-400">
            Event <span className="font-mono text-cyan-400">{eventKey}</span> · Model{' '}
            <span className="font-black text-fuchsia-400">{MODEL_LABELS[selectedMetric]}</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 p-4">
            <section className="space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-slate-500">Prediction Metric</div>
              <div className="grid grid-cols-3 gap-2">
                {(['ppc', 'opr', 'epa'] as AdminV2SelectedMetric[]).map(metric => (
                  <button
                    key={metric}
                    onClick={() => updateSettings({ selectedMetric: metric })}
                    className={metricButtonClass(metric)}
                  >
                    {MODEL_LABELS[metric]}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-800 pt-4">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Global Team Search</div>
                <p className="mt-2 text-sm text-slate-400">
                  Search one team and keep it highlighted across Admin V2.
                </p>
              </div>

              <form onSubmit={submitTeamSearch} className="space-y-3">
                <input
                  type="text"
                  list="adminv2-team-search"
                  value={teamSearchInput}
                  onChange={event => setTeamSearchInput(sanitizeTeamNumber(event.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
                  placeholder="Search team number"
                />
                <datalist id="adminv2-team-search">
                  {allKnownTeams.map(teamNumber => (
                    <option key={teamNumber} value={teamNumber}>
                      {resolvedTeamNameLookup[teamNumber] || `Team ${teamNumber}`}
                    </option>
                  ))}
                </datalist>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white hover:bg-cyan-500"
                  >
                    <Search className="mr-2 inline h-4 w-4" />
                    SEARCH
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTeamSearchInput('');
                      updateSettings({ searchedTeamNumber: '' });
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-slate-300 hover:bg-slate-800"
                  >
                    CLEAR
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                {!searchedTeamNumber ? (
                  <div className="text-sm font-semibold text-slate-500">Search a team number to inspect it here.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <TeamBadge
                          teamNumber={searchedTeamNumber}
                          ownTeamNumber={ownTeamNumber}
                          searchedTeamNumber={searchedTeamNumber}
                          teamName={resolvedTeamNameLookup[searchedTeamNumber]}
                        />
                        <div className="mt-2 text-sm font-semibold text-white">
                          {teamProfile?.nickname || resolvedTeamNameLookup[searchedTeamNumber] || `Team ${searchedTeamNumber}`}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{teamProfile?.location || 'Location pending'}</div>
                      </div>
                      {isTeamProfileLoading && (
                        <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-black text-cyan-200">
                          Loading
                        </span>
                      )}
                    </div>

                    {teamMetricSummary && (
                      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Current Model: {teamMetricSummary.currentMetricLabel}
                        </div>
                        <div className="mt-3 text-2xl font-black text-white">
                          {formatMetricValue(teamMetricSummary.currentMetricValue)}
                        </div>
                        <div className="mt-2 text-xs font-semibold text-slate-500">{teamMetricSummary.sourceLabel}</div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <MetricField label="Auto" value={formatMetricValue(teamMetricSummary.autoComponent)} />
                          <MetricField label="Teleop" value={formatMetricValue(teamMetricSummary.teleopComponent)} />
                        </div>
                        {teamMetricSummary.extras.length > 0 && (
                          <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
                            {teamMetricSummary.extras.map(item => (
                              <MetricField key={item.label} label={item.label} value={item.value} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="text-xs font-black uppercase tracking-wider text-slate-500">Defense Metric</div>
                      <div className="mt-3 text-2xl font-black text-white">
                        {formatPercentMetric(activeDefenseMetric?.avgDefenseMetric ?? null)}
                      </div>
                      <div className="mt-2 text-xs font-semibold text-slate-500">
                        {activeDefenseMetric
                          ? `${activeDefenseMetric.recordsLogged} defense record${activeDefenseMetric.recordsLogged === 1 ? '' : 's'}`
                          : 'No defense scouting history yet'}
                      </div>
                      {activeDefenseMetric && (
                        <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
                          <MetricField label="Defense Records" value={String(activeDefenseMetric.recordsLogged)} />
                          <MetricField label="DPR" value={formatMetricValue(calculatedDprRatings[searchedTeamNumber] ?? null)} />
                        </div>
                      )}
                    </div>

                    {teamProfileError && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm font-semibold text-amber-100">
                        {teamProfileError}
                      </div>
                    )}

                    {teamProfile && (
                      <>
                        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-500">Qualification Context</div>
                          <div className="mt-3 space-y-2 text-sm text-slate-300">
                            <div>Status: {teamProfile.qualificationStatus.replace(/_/g, ' ')}</div>
                            <div>{teamProfile.qualificationReason}</div>
                            <div>
                              District Rank:{' '}
                              {teamProfile.districtStanding?.rank != null ? `#${teamProfile.districtStanding.rank}` : '—'}
                            </div>
                            <div>
                              District Points:{' '}
                              {teamProfile.districtStanding?.totalPoints != null ? teamProfile.districtStanding.totalPoints : '—'}
                            </div>
                          </div>
                        </div>

                        <SidebarListSection
                          title="Robot Registry"
                          items={
                            teamProfile.robotMetadata.length > 0
                              ? teamProfile.robotMetadata.map(robot => `${robot.year}: ${robot.name}`)
                              : ['No robot registry data available.']
                          }
                        />
                        <SidebarListSection
                          title="Awards"
                          items={
                            teamProfile.seasonAwards.length > 0
                              ? teamProfile.seasonAwards.map(award => `${award.eventName}: ${award.name}`)
                              : ['No awards listed in TBA for this season.']
                          }
                        />
                        <SidebarListSection
                          title="Season Events"
                          items={
                            teamProfile.seasonEvents.length > 0
                              ? teamProfile.seasonEvents.map(
                                  event => `${event.name} · ${event.overallStatus} · ${event.qualRank != null ? `Rank #${event.qualRank}` : 'Rank —'}`
                                )
                              : ['No season event summaries available.']
                          }
                        />
                        <SidebarListSection
                          title="Media"
                          items={
                            teamProfile.mediaAssets.length > 0
                              ? teamProfile.mediaAssets.map(asset => asset.label)
                              : ['No media assets listed.']
                          }
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            </section>

            <nav className="space-y-2 border-t border-slate-800 pt-4">
              <button onClick={() => setActiveTab('results')} className={tabClass('results')}>
                <Table2 className="h-4 w-4" />
                Match Results
              </button>
              <button onClick={() => setActiveTab('rawEditor')} className={tabClass('rawEditor')}>
                <Edit3 className="h-4 w-4" />
                Raw Data Editor
              </button>
              <button onClick={() => setActiveTab('teams')} className={tabClass('teams')}>
                <TrendingUp className="h-4 w-4" />
                Team Averages
              </button>
              <button onClick={() => setActiveTab('sorter')} className={tabClass('sorter')}>
                <ArrowUpDown className="h-4 w-4" />
                Team Sorter
              </button>
              <button onClick={() => setActiveTab('predictor')} className={tabClass('predictor')}>
                <Swords className="h-4 w-4" />
                Future Predictor
              </button>
              <button onClick={() => setActiveTab('simulator')} className={tabClass('simulator')}>
                <Swords className="h-4 w-4" />
                Match Simulator
              </button>
              <button onClick={() => setActiveTab('strategyBrain')} className={tabClass('strategyBrain')}>
                <Trophy className="h-4 w-4" />
                Strategy Brain
              </button>
              <button onClick={() => setActiveTab('import')} className={tabClass('import')}>
                <Upload className="h-4 w-4" />
                Data Import
              </button>
              <button onClick={() => setActiveTab('export')} className={tabClass('export')}>
                <Download className="h-4 w-4" />
                Excel Export
              </button>
            </nav>
          </div>
        </div>

        <div className="border-t border-slate-800 p-4">
          {settingsOpen && (
            <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/90 p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-black uppercase tracking-wider text-slate-400">Settings</div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Active Event
                  </label>
                  <div className="space-y-2">
                    {QUICK_EVENTS.map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => updateSettings({ eventKey: key })}
                        className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-mono transition-colors ${
                          eventKey === key
                            ? 'bg-cyan-600 text-white'
                            : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-800/70 pt-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    TBA Event Search
                  </label>
                  <div className="mb-3 flex gap-2">
                    <input
                      type="number"
                      value={searchYear}
                      onChange={event => setSearchYear(event.target.value)}
                      className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                      placeholder="Year"
                    />
                    <button
                      onClick={searchEvents}
                      disabled={isSearchingEvents}
                      className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                    >
                      {isSearchingEvents ? '...' : 'FETCH'}
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="relative">
                      <input
                        type="text"
                        list="tba-events-v2-settings"
                        placeholder="Type to search events..."
                        onChange={event => {
                          const value = event.target.value;
                          if (searchResults.some(result => result.key === value)) {
                            updateSettings({ eventKey: value });
                          }
                        }}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                      />
                      <datalist id="tba-events-v2-settings">
                        {searchResults.map(result => (
                          <option key={result.key} value={result.key}>
                            {result.name}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800/70 pt-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    Own Team Number
                  </label>
                  <input
                    type="text"
                    value={ownTeamNumber}
                    onChange={event => updateSettings({ ownTeamNumber: sanitizeTeamNumber(event.target.value) })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                    placeholder="Enter own team number"
                  />
                </div>

                <div className="border-t border-slate-800/70 pt-4">
                  <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                    FIRST Events API Credentials
                  </label>
                  <p className="mb-3 text-xs font-semibold text-slate-500">
                    Upload a local JSON file like <span className="font-mono text-slate-300">{'{"username":"...","token":"..." }'}</span>.
                    The token stays in this browser&apos;s IndexedDB only.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white hover:bg-slate-700">
                      <Upload className="h-4 w-4" />
                      Upload Credentials
                      <input type="file" accept=".json,application/json" className="hidden" onChange={handleFirstCredentialUpload} />
                    </label>
                    {firstCredentials && (
                      <button
                        onClick={() => void handleClearFirstCredentials()}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-black text-rose-100 hover:bg-rose-500/20"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-slate-400">
                    {firstCredentials
                      ? `Saved for ${firstCredentials.username} on ${new Date(firstCredentials.savedAt).toLocaleString()}`
                      : 'No FIRST Events credentials saved on this admin device.'}
                  </div>
                  {firstCredentialStatus && <div className="mt-2 text-xs font-bold text-emerald-300">{firstCredentialStatus}</div>}
                  {firstCredentialError && <div className="mt-2 text-xs font-bold text-rose-300">{firstCredentialError}</div>}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setSettingsOpen(open => !open)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-slate-200 hover:bg-slate-800"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-black text-white">Admin V2</h2>
              <p className="mt-2 text-sm text-slate-400">
                Event <span className="font-mono text-cyan-400">{eventKey}</span> · Active model{' '}
                <span className="font-black text-fuchsia-400">{MODEL_LABELS[selectedMetric]}</span>
              </p>
            </div>
            <button
              onClick={() => void loadV3Data()}
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-3 font-black text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <RefreshCw className={`mr-2 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard label="Scout Rows" value={summary.rows} />
            <SummaryCard label="Scout Teams" value={summary.teams} />
            <SummaryCard label="Avg Defense Metric" value={formatPercentMetric(summary.averageDefenseMetric)} />
          </div>

          {activeTab === 'results' && (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-5 py-4">
                <h3 className="flex items-center gap-2 text-lg font-black text-white">
                  <ListChecks className="h-5 w-5 text-cyan-400" />
                  Match Scout Results
                </h3>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setResultsViewTab('quals')}
                    className={resultsViewButtonClass('quals')}
                  >
                    Quals
                  </button>
                  <button
                    onClick={() => setResultsViewTab('practice')}
                    className={resultsViewButtonClass('practice')}
                  >
                    Practice Matches
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-400">{getResultsViewDescription(resultsViewTab)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="admin-sticky-table min-w-[1200px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Match</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">Scout</th>
                      <th className="px-4 py-3">Alliance</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Points / Defense</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center font-semibold text-slate-500">
                          Loading match scout results...
                        </td>
                      </tr>
                    ) : filteredResultsRecords.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center font-semibold text-slate-500">
                          No {resultsViewTab === 'quals' ? 'qualification' : 'practice'} scout records found for this event.
                        </td>
                      </tr>
                    ) : (
                      filteredResultsRecords.map(row => {
                        const record = row.record;
                        return (
                        <tr key={`${row.kind}_${record.matchKey}_${record.teamNumber}`} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-mono font-black text-white">{record.matchKey.toUpperCase()}</td>
                          <td className="px-4 py-3">
                            <TeamBadge
                              teamNumber={record.teamNumber}
                              ownTeamNumber={ownTeamNumber}
                              searchedTeamNumber={searchedTeamNumber}
                              teamName={resolvedTeamNameLookup[record.teamNumber]}
                            />
                          </td>
                          <td className="px-4 py-3 text-slate-300">{record.scoutName}</td>
                          <td className="px-4 py-3 text-slate-300">{record.alliance || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-black ${row.kind === 'v4' ? 'bg-fuchsia-500/15 text-fuchsia-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
                              {row.kind === 'v4' ? 'V4' : 'DEFENSE V1'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-black text-emerald-300">
                            {row.kind === 'v4'
                              ? `${(record as MatchScoutingV4).totalMatchPoints} pts`
                              : formatPercentMetric((record as MatchDefenseScoutingV1).defenseMetric)}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {row.kind === 'v4' ? (record as MatchScoutingV4).rolePlayed || '—' : 'Defense'}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {row.kind === 'v4'
                              ? (record as MatchScoutingV4).notes || (record as MatchScoutingV4).strategyNotes || '—'
                              : (record as MatchDefenseScoutingV1).defenseComments || (record as MatchDefenseScoutingV1).generalComments || '—'}
                          </td>
                        </tr>
                      );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'rawEditor' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-black text-white">
                      <Edit3 className="h-5 w-5 text-cyan-400" />
                      Raw Data Editor
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">
                      V4 match data grouped by scheduled match. Missing Red/Blue slots and scout/team mismatches are shown before they turn into bad strategy calls.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
                      <button onClick={() => setRawEditorViewTab('quals')} className={rawEditorViewButtonClass('quals')}>
                        Quals
                      </button>
                      <button onClick={() => setRawEditorViewTab('practice')} className={rawEditorViewButtonClass('practice')}>
                        Practice Matches
                      </button>
                    </div>
                    <div className="relative min-w-[260px]">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={rawEditorSearch}
                        onChange={event => setRawEditorSearch(event.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-cyan-500"
                        placeholder="Search match, team, scout, status"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {rawEditorGroups.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-10 text-center font-semibold text-slate-500">
                  No {rawEditorViewTab === 'quals' ? 'qualification' : 'practice'} V4 raw-data groups match the current filter.
                </div>
              ) : (
                rawEditorGroups.map(group => (
                  <div key={group.matchKey} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
                    <div className="border-b border-slate-800 px-5 py-4">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <h4 className="font-mono text-lg font-black text-white">{group.displayMatchKey}</h4>
                          <p className="mt-1 text-sm text-slate-400">
                            {group.scheduleKnown
                              ? `${group.rows.length}/${group.expectedSlots.length || 6} slots present`
                              : 'Schedule unknown; showing local V4 records only'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.warnings.length === 0 ? (
                            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200">Complete</span>
                          ) : (
                            group.warnings.map(warning => (
                              <span key={warning} className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-100">
                                {warning}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {group.missingSlots.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {group.missingSlots.map(slot => (
                            <span key={slot.key} className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-black text-rose-100">
                              Missing {slot.slotLabel} · {slot.teamNumber} · {slot.assignedScoutName || 'Unassigned'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="admin-sticky-table min-w-[1280px] w-full text-left text-sm">
                        <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Edit</th>
                            <th className="px-4 py-3">Team</th>
                            <th className="px-4 py-3">Slot</th>
                            <th className="px-4 py-3">Assigned Scout</th>
                            <th className="px-4 py-3">Submitted By</th>
                            <th className="px-4 py-3">Expected Team</th>
                            <th className="px-4 py-3">Anomalies</th>
                            <th className="px-4 py-3">Points</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {group.rows.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="px-4 py-8 text-center font-semibold text-slate-500">
                                No V4 submissions yet for this scheduled match.
                              </td>
                            </tr>
                          ) : (
                            group.rows.map(row => {
                              const record = row.record as MatchScoutingV4;
                              return (
                                <tr key={row.record.id} className="hover:bg-slate-800/30">
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => handleEditV4Record(record)}
                                      className="rounded-lg bg-slate-800 p-2 text-cyan-200 hover:bg-cyan-600 hover:text-white"
                                      title="Edit this V4 dataset in Match Scout"
                                    >
                                      <Edit3 className="h-4 w-4" />
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <TeamBadge
                                      teamNumber={record.teamNumber}
                                      ownTeamNumber={ownTeamNumber}
                                      searchedTeamNumber={searchedTeamNumber}
                                      teamName={resolvedTeamNameLookup[record.teamNumber]}
                                    />
                                  </td>
                                  <td className="px-4 py-3 font-mono text-slate-300">{record.assignedSlot || '—'}</td>
                                  <td className="px-4 py-3 text-slate-300">{record.assignedScoutName || '—'}</td>
                                  <td className="px-4 py-3 text-slate-300">{record.scoutName || record.substituteScoutName || '—'}</td>
                                  <td className="px-4 py-3 text-slate-300">
                                    {row.expectedTeamNumber ? `${row.expectedSlotLabel} · ${row.expectedTeamNumber}` : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    {row.anomalies.length === 0 ? (
                                      <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200">OK</span>
                                    ) : (
                                      <div className="flex flex-wrap gap-1">
                                        {row.anomalies.map(anomaly => (
                                          <span key={anomaly} className="rounded-full bg-rose-500/15 px-2 py-1 text-xs font-black text-rose-100">
                                            {getRowAnomalyLabel(anomaly)}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 font-black text-emerald-300">{record.totalMatchPoints}</td>
                                  <td className="px-4 py-3 text-slate-300">{record.rolePlayed || '—'}</td>
                                  <td className="px-4 py-3 text-slate-300">{record.notes || record.strategyNotes || '—'}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-5 py-4">
                <h3 className="flex items-center gap-2 text-lg font-black text-white">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                  Team Historical Average Total Points
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="admin-sticky-table min-w-[1200px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3">Matches</th>
                      <th className="px-4 py-3">Avg Total</th>
                      <th className="px-4 py-3">Avg Auto</th>
                      <th className="px-4 py-3">Avg Teleop</th>
                      <th className="px-4 py-3">Avg Cycles</th>
                      <th className="px-4 py-3">Avg Contribution</th>
                      <th className="px-4 py-3">Avg Close</th>
                      <th className="px-4 py-3">Avg Middle</th>
                      <th className="px-4 py-3">Avg Far</th>
                      <th className="px-4 py-3">Avg Driver</th>
                      <th className="px-4 py-3">Avg Teamwork</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {teamAverages.map(row => (
                      <tr key={row.teamNumber} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3">
                          <TeamBadge
                            teamNumber={row.teamNumber}
                            ownTeamNumber={ownTeamNumber}
                            searchedTeamNumber={searchedTeamNumber}
                            teamName={resolvedTeamNameLookup[row.teamNumber]}
                          />
                        </td>
                        <td className="px-4 py-3 text-slate-300">{row.matchesPlayed}</td>
                        <td className="px-4 py-3 font-black text-cyan-300">{row.avgTotalMatchPoints.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.avgAutoPoints.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.avgTeleopPoints.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.avgTeleopCycles.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.avgContributionScore.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.avgCloseAccuracy.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.avgMiddleAccuracy.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.avgFarAccuracy.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.avgDriverSkill.toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-300">{row.avgTeamwork.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'predictor' && (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-5 py-4">
                <h3 className="flex items-center gap-2 text-lg font-black text-white">
                  <Swords className="h-5 w-5 text-fuchsia-400" />
                  Future Predictor
                </h3>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button onClick={() => setPredictorViewTab('ranking')} className={predictorViewButtonClass('ranking')}>
                    Ranking Prediction
                  </button>
                  <button onClick={() => setPredictorViewTab('quals')} className={predictorViewButtonClass('quals')}>
                    Quals Prediction
                  </button>
                  <button onClick={() => setPredictorViewTab('finals')} className={predictorViewButtonClass('finals')}>
                    Finals Prediction
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  {getPredictorViewDescription(predictorViewTab)} Using{' '}
                  <span className="font-black text-fuchsia-400">{MODEL_LABELS[selectedMetric]}</span>.
                </p>
              </div>

              {selectedMetric === 'opr' && (
                <div className="border-b border-slate-800 px-5 py-4 space-y-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-slate-500">TBA File Upload</div>
                      <p className="mt-2 max-w-3xl text-sm text-slate-400">
                        Upload TBA CSV or JSON files here. `coprs.csv`, `oprs.json`, or `coprs.json` can power uploaded
                        OPR, while schedule, rankings, alliances, event, and team list files are used as local
                        fallbacks and metadata.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white hover:bg-cyan-500">
                      <Upload className="h-4 w-4" />
                      UPLOAD TBA FILES
                      <input type="file" accept=".csv,.json,text/csv,application/json" multiple className="hidden" onChange={handleOprCsvUpload} />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <SummaryCard label="OPR Source" value={hasUsableCsvOpr ? 'Uploaded TBA OPR' : 'Calculated OPR'} />
                    <SummaryCard label="Schedule Source" value={predictorMatchSourceLabel} />
                    <SummaryCard
                      label="Loaded Files"
                      value={
                        [
                          uploadedCsvPack?.coprs?.fileName,
                          uploadedCsvPack?.schedule?.fileName,
                          uploadedCsvPack?.flatSchedule?.fileName,
                          uploadedCsvPack?.teamList?.fileName,
                          uploadedCsvPack?.rankings?.fileName,
                          uploadedCsvPack?.alliances?.fileName,
                          uploadedCsvPack?.eventSummary?.fileName
                        ].filter(Boolean).length || '0'
                      }
                    />
                  </div>
                </div>
              )}

              {predictorUnavailableMessage && (
                <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {predictorUnavailableMessage}
                  </div>
                </div>
              )}
              {selectedMetric === 'epa' && !epaUnavailable && missingEpaTeams.length > 0 && (
                <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {missingEpaTeams.length} team{missingEpaTeams.length === 1 ? '' : 's'} are missing EPA and will be treated as 0.
                  </div>
                </div>
              )}
              {selectedMetric === 'opr' && csvError && (
                <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {csvError}
                  </div>
                </div>
              )}
              {selectedMetric === 'opr' && csvMessages.length > 0 && (
                <div className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-4 text-sm font-semibold text-cyan-100">
                  <div className="space-y-2">
                    {csvMessages.map((message, index) => (
                      <div key={`${message.text}-${index}`} className="flex items-start gap-2">
                        <Upload className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{message.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedMetric === 'opr' && missingOprTeams.length > 0 && (
                <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {missingOprTeams.length} team{missingOprTeams.length === 1 ? '' : 's'} are missing OPR and will be treated as 0.
                  </div>
                </div>
              )}
              {selectedMetric === 'opr' && !hasOprBonusMetrics && (
                <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-4 text-sm font-semibold text-amber-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    OPR component metrics are unavailable, so future bonus RP projection is limited.
                  </div>
                </div>
              )}

              {predictorViewTab === 'ranking' && (
                <>
                  <div className="border-b border-slate-800 px-5 py-4 space-y-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <h4 className="text-base font-black text-white">Projected Final Quals Ranking</h4>
                        <p className="mt-1 text-sm text-slate-400">
                          End-of-quals projection for the active event using {MODEL_LABELS[selectedMetric]}.
                        </p>
                      </div>
                      <div className="w-full max-w-sm">
                        <label className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">
                          Search Teams in Ranking
                        </label>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            value={rankingSearch}
                            onChange={event => setRankingSearch(event.target.value)}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-cyan-500"
                            placeholder="Search by team number"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <SummaryCard
                        label="Projected Leader"
                        value={
                          activeQualificationProjection.summary.leader
                            ? `#${activeQualificationProjection.summary.leader.projectedRank} • ${activeQualificationProjection.summary.leader.teamNumber}`
                            : '—'
                        }
                      />
                      <SummaryCard
                        label="Projected RP Lead"
                        value={activeQualificationProjection.summary.leader?.projectedTotalRp ?? '—'}
                      />
                      <SummaryCard label="Qual Teams" value={activeQualificationProjection.summary.totalTeams} />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="admin-sticky-table min-w-[1200px] w-full text-left text-sm">
                      <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Projected Rank</th>
                          <th className="px-4 py-3">Team</th>
                          <th className="px-4 py-3">Current TBA Rank</th>
                          <th className="px-4 py-3">Projected Total RP</th>
                          <th className="px-4 py-3">Record</th>
                          <th className="px-4 py-3">Win RP</th>
                          <th className="px-4 py-3">Tower RP</th>
                          <th className="px-4 py-3">Energized RP</th>
                          <th className="px-4 py-3">Supercharged RP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {predictorIsLoading ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-10 text-center font-semibold text-slate-500">
                              Loading {MODEL_LABELS[selectedMetric]}-backed ranking...
                            </td>
                          </tr>
                        ) : predictorUnavailableMessage ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-10 text-center font-semibold text-amber-100">
                              {predictorUnavailableMessage}
                            </td>
                          </tr>
                        ) : filteredQualificationRows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="px-4 py-10 text-center font-semibold text-slate-500">
                              {rankingSearch.trim()
                                ? 'No teams match the current ranking search.'
                                : 'No qualification ranking projection is available for this event.'}
                            </td>
                          </tr>
                        ) : (
                          filteredQualificationRows.map(row => (
                            <tr key={`${selectedMetric}-${row.teamNumber}`} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3 font-black text-white">#{row.projectedRank}</td>
                              <td className="px-4 py-3">
                                <TeamBadge
                                  teamNumber={row.teamNumber}
                                  ownTeamNumber={ownTeamNumber}
                                  searchedTeamNumber={searchedTeamNumber}
                                  teamName={resolvedTeamNameLookup[row.teamNumber]}
                                />
                              </td>
                              <td className="px-4 py-3 text-slate-300">
                                {row.currentTbaRank ? `#${row.currentTbaRank}` : '—'}
                              </td>
                              <td className="px-4 py-3 font-black text-white">{row.projectedTotalRp}</td>
                              <td className="px-4 py-3 text-slate-300">{formatRecord(row)}</td>
                              <td className="px-4 py-3 text-slate-300">{row.projectedWinRp}</td>
                              <td className="px-4 py-3 text-slate-300">{row.projectedTowerRp}</td>
                              <td className="px-4 py-3 text-slate-300">{row.projectedEnergizedRp}</td>
                              <td className="px-4 py-3 text-slate-300">{row.projectedSuperchargedRp}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {predictorViewTab === 'quals' && (
                <>
                  <div className="border-b border-slate-800 px-5 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h4 className="text-base font-black text-white">Best Validated Forecast Layer</h4>
                        <p className="mt-1 text-sm text-slate-400">
                          {adminV2BestForecastLayer.modelName} · {adminV2BestForecastLayer.modelSource}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-slate-400">
                        This is the model-lab champion view. The table below still shows the selected sidebar model.
                      </div>
                    </div>
                    {validatedQualForecastRows.length > 0 && (
                      <div className="mt-4 grid gap-3 xl:grid-cols-3">
                        {validatedQualForecastRows.slice(0, 6).map(row => (
                          <div key={row.key} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-mono font-black text-white">{row.title}</div>
                              <div className={`rounded-full px-2 py-1 text-xs font-black ${row.lowConfidence ? 'bg-amber-500/15 text-amber-100' : 'bg-emerald-500/15 text-emerald-100'}`}>
                                {row.lowConfidence ? 'Low' : 'Standard'}
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                              <div className="rounded-xl bg-red-500/10 p-2 text-red-100">
                                <div className="font-black">Red {row.redScore.toFixed(1)}</div>
                                <div className="text-xs opacity-75">{row.redTeams.join(', ')}</div>
                              </div>
                              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-100">
                                <div className="font-black">Blue {row.blueScore.toFixed(1)}</div>
                                <div className="text-xs opacity-75">{row.blueTeams.join(', ')}</div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs font-black uppercase tracking-wider text-slate-500">Winner: {row.winner}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="admin-sticky-table min-w-[1280px] w-full text-left text-sm">
                      <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Match</th>
                          <th className="px-4 py-3">Scheduled</th>
                          <th className="px-4 py-3">Red Alliance</th>
                          <th className="px-4 py-3">Red Score</th>
                          <th className="px-4 py-3">Blue Alliance</th>
                          <th className="px-4 py-3">Blue Score</th>
                          <th className="px-4 py-3">Winner</th>
                          <th className="px-4 py-3">Confidence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {predictorIsLoading ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center font-semibold text-slate-500">
                              Loading {MODEL_LABELS[selectedMetric]} qualification forecasts...
                            </td>
                          </tr>
                        ) : predictorUnavailableMessage ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center font-semibold text-amber-100">
                              {predictorUnavailableMessage}
                            </td>
                          </tr>
                        ) : activePredictions.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center font-semibold text-slate-500">
                              No future qualification matches available for prediction.
                            </td>
                          </tr>
                        ) : (
                          activePredictions.map(match => (
                            <tr key={match.key} className="hover:bg-slate-800/30">
                              <td className="px-4 py-3 font-mono font-black text-white">{match.title}</td>
                              <td className="px-4 py-3 text-slate-300">{getTimestampLabel(match.scheduledTime)}</td>
                              <td className="px-4 py-3">
                                <TeamList
                                  teams={match.red.teams}
                                  ownTeamNumber={ownTeamNumber}
                                  searchedTeamNumber={searchedTeamNumber}
                                  teamNameLookup={resolvedTeamNameLookup}
                                />
                              </td>
                              <td className="px-4 py-3 font-black text-red-300">{match.red.predictedScore.toFixed(2)}</td>
                              <td className="px-4 py-3">
                                <TeamList
                                  teams={match.blue.teams}
                                  ownTeamNumber={ownTeamNumber}
                                  searchedTeamNumber={searchedTeamNumber}
                                  teamNameLookup={resolvedTeamNameLookup}
                                />
                              </td>
                              <td className="px-4 py-3 font-black text-blue-300">{match.blue.predictedScore.toFixed(2)}</td>
                              <td className="px-4 py-3 text-slate-200">{match.predictedWinner}</td>
                              <td className="px-4 py-3">
                                {match.predictionLowConfidence ? (
                                  <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-200">
                                    Low
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black text-emerald-200">
                                    Standard
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {predictorViewTab === 'finals' && (
                <div className="space-y-6 p-5">
                  {predictorIsLoading ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-8 text-center font-semibold text-slate-400">
                      Loading {MODEL_LABELS[selectedMetric]} playoff forecast...
                    </div>
                  ) : selectedMetric === 'epa' && epaUnavailable ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-8 text-center font-semibold text-amber-100">
                      {epaUnavailable}
                    </div>
                  ) : activePredictorMatches.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-8 text-center font-semibold text-slate-400">
                      {liveScheduleUnavailable || 'Live TBA or uploaded schedule data is required for Finals Prediction.'}
                    </div>
                  ) : !effectiveAlliances || effectiveAlliances.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-8 text-center font-semibold text-slate-400">
                      Alliance selection is unavailable from live TBA and uploaded files, so the playoff bracket cannot be built.
                    </div>
                  ) : !finalsProjection.supported ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-8 text-center font-semibold text-amber-100">
                      {finalsProjection.reason || 'This playoff structure is not supported by the current predictor.'}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <SummaryCard label="Projected Champion" value={finalsProjection.champion?.label || 'Pending'} />
                        <SummaryCard label="Projected Finalist" value={finalsProjection.finalist?.label || 'Pending'} />
                      </div>

                      {finalsProjection.rounds.map(round => (
                        <div key={round.title} className="space-y-4">
                          <div>
                            <h4 className="text-lg font-black text-white">{round.title}</h4>
                          </div>
                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {round.matches.map(match => (
                              <PlayoffMatchCard
                                key={match.id}
                                match={match}
                                ownTeamNumber={ownTeamNumber}
                                searchedTeamNumber={searchedTeamNumber}
                                teamNameLookup={resolvedTeamNameLookup}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sorter' && (
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-5 py-4">
                <h3 className="flex items-center gap-2 text-lg font-black text-white">
                  <ArrowUpDown className="h-5 w-5 text-cyan-400" />
                  Team Sorter
                </h3>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">
                  Sort teams by PPC, Defense Metric, OPR, EPA, or DPR. Lower DPR means better defense, so DPR defaults to lowest first.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="admin-sticky-table min-w-[1200px] w-full text-left text-sm">
                  <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <SortableHeader label="Team" field="team" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} />
                      <SortableHeader label="TBA Rank" field="tbaRank" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} align="text-center" />
                      <SortableHeader label="Matches" field="matches" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} align="text-right" />
                      <SortableHeader label="PPC" field="ppc" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} align="text-right" />
                      <SortableHeader label="Auto PPC" field="autoPpc" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} align="text-right" />
                      <SortableHeader label="Teleop PPC" field="teleopPpc" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} align="text-right" />
                      <SortableHeader label="Defense Metric" field="defenseMetric" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} align="text-right" />
                      <SortableHeader label="EPA" field="epa" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} align="text-right" />
                      <SortableHeader label="OPR" field="opr" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} align="text-right" />
                      <SortableHeader label="DPR" field="dpr" activeField={sorterField} direction={sorterDirection} onClick={handleSorterSort} align="text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {sortedSorterRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center font-semibold text-slate-500">
                          No team sorter data is available for this event yet.
                        </td>
                      </tr>
                    ) : (
                      sortedSorterRows.map(row => (
                        <tr key={row.teamNumber} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3">
                            <TeamBadge
                              teamNumber={row.teamNumber}
                              ownTeamNumber={ownTeamNumber}
                              searchedTeamNumber={searchedTeamNumber}
                              teamName={row.teamName}
                            />
                          </td>
                          <td className="px-4 py-3 text-center text-slate-300">{row.tbaRank != null ? `#${row.tbaRank}` : '—'}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{row.matches}</td>
                          <td className="px-4 py-3 text-right font-black text-cyan-300">{formatMetricValue(row.ppc)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatMetricValue(row.autoPpc)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{formatMetricValue(row.teleopPpc)}</td>
                          <td className="px-4 py-3 text-right font-black text-emerald-300">{formatPercentMetric(row.defenseMetric)}</td>
                          <td className="px-4 py-3 text-right text-blue-300">{formatMetricValue(row.epa)}</td>
                          <td className="px-4 py-3 text-right text-fuchsia-300">{formatMetricValue(row.opr)}</td>
                          <td className="px-4 py-3 text-right text-rose-300">{formatMetricValue(row.dpr)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'simulator' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <h3 className="flex items-center gap-2 text-lg font-black text-white">
                  <Swords className="h-5 w-5 text-fuchsia-400" />
                  Match Simulator
                </h3>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">
                  Enter any teams and simulate alliance strength with the currently selected model,
                  <span className="font-black text-fuchsia-400"> {MODEL_LABELS[selectedMetric]}</span>. Enter one alliance
                  to get a projected alliance score, or both alliances to get the winner and margin. The role-adjusted layer
                  also tests whether each robot is more valuable as offense or as defense using measured Defense Impact.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 xl:col-span-3">
                    <div className="text-xs font-black uppercase tracking-wider text-slate-500">Quick Entry</div>
                    <p className="mt-2 text-sm text-slate-400">
                      Paste 1-6 team numbers separated by spaces or commas. The first three go to Red, the next three go to Blue.
                    </p>
                    <div className="mt-3 flex flex-col gap-3 xl:flex-row">
                      <input
                        type="text"
                        value={simulatorQuickEntry}
                        onChange={event => setSimulatorQuickEntry(event.target.value)}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-500"
                        placeholder="254 1678 4414 1114 2056 118"
                      />
                      <button
                        onClick={applyQuickSimulatorEntry}
                        className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-500"
                      >
                        APPLY
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-4">
                    <div className="text-xs font-black uppercase tracking-wider text-red-300">Red Alliance</div>
                    <textarea
                      value={redSimulatorInput}
                      onChange={event => setRedSimulatorInput(event.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-xl border border-red-800/50 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-red-400"
                      placeholder="Enter up to 3 teams"
                    />
                    <div className="mt-3 text-xs text-slate-500">Use spaces or commas. Extra teams beyond 3 are ignored.</div>
                  </div>

                  <div className="rounded-2xl border border-blue-500/20 bg-blue-950/10 p-4">
                    <div className="text-xs font-black uppercase tracking-wider text-blue-300">Blue Alliance</div>
                    <textarea
                      value={blueSimulatorInput}
                      onChange={event => setBlueSimulatorInput(event.target.value)}
                      rows={4}
                      className="mt-3 w-full rounded-xl border border-blue-800/50 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-blue-400"
                      placeholder="Enter up to 3 teams"
                    />
                    <div className="mt-3 text-xs text-slate-500">Use spaces or commas. Extra teams beyond 3 are ignored.</div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                    <div className="text-xs font-black uppercase tracking-wider text-slate-500">Simulation Result</div>
                    <div className="mt-3 text-2xl font-black text-white">
                      {simulatorSummary.winner
                        ? `${simulatorSummary.winner} by ${simulatorSummary.margin.toFixed(2)}`
                        : simulatorSummary.redScore > 0 || simulatorSummary.blueScore > 0
                          ? 'Alliance score only'
                          : 'Waiting for teams'}
                    </div>
                    <div className="mt-2 text-sm text-slate-400">
                      {simulatorSummary.winner
                        ? `${MODEL_LABELS[selectedMetric]} projects both alliances.`
                        : 'Enter both alliances to get a winner.'}
                      {simulatorSummary.ppaWinner && (
                        <span className="block pt-1 text-cyan-200">
                          PPA cross-check: {simulatorSummary.ppaWinner} by {simulatorSummary.ppaMargin.toFixed(2)}.
                        </span>
                      )}
                      {simulatorSummary.roleAdjustedWinner && (
                        <span className="block pt-1 text-emerald-200">
                          Best-role simulation: {simulatorSummary.roleAdjustedWinner} by {simulatorSummary.roleAdjustedMargin.toFixed(2)}.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-5 xl:grid-cols-7">
                  <SummaryCard label="Red Score" value={simulatorSummary.redScore.toFixed(2)} />
                  <SummaryCard label="Blue Score" value={simulatorSummary.blueScore.toFixed(2)} />
                  <SummaryCard
                    label="Winner / Margin"
                    value={
                      simulatorSummary.winner
                        ? `${simulatorSummary.winner} • ${simulatorSummary.margin.toFixed(2)}`
                        : simulatorSummary.totalTeams > 0
                          ? 'Score only'
                          : '—'
                    }
                  />
                  <SummaryCard label="PPA Red" value={simulatorSummary.redPpaScore.toFixed(2)} />
                  <SummaryCard label="PPA Blue" value={simulatorSummary.bluePpaScore.toFixed(2)} />
                  <SummaryCard label="Best-Role Red" value={simulatorSummary.redRoleAdjustedScore.toFixed(2)} />
                  <SummaryCard label="Best-Role Blue" value={simulatorSummary.blueRoleAdjustedScore.toFixed(2)} />
                </div>

                {(simulatorSummary.redMissing.length > 0 || simulatorSummary.blueMissing.length > 0) && (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
                    Missing {MODEL_LABELS[selectedMetric]} data is treated as 0 for:
                    {' '}
                    {[...simulatorSummary.redMissing, ...simulatorSummary.blueMissing].map(row => row.teamNumber).join(', ')}
                  </div>
                )}

                {(simulatorSummary.redDefenseSwing > 0 || simulatorSummary.blueDefenseSwing > 0) && (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                    Defense-adjusted layer: Red can deny {simulatorSummary.redDefenseSwing.toFixed(2)} modeled points;
                    Blue can deny {simulatorSummary.blueDefenseSwing.toFixed(2)} modeled points. Robots only count as offense
                    or defense in this layer, not both.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <SimulatorAllianceCard
                  title="Red Alliance Breakdown"
                  accentClass="text-red-300"
                  borderClass="border-red-500/20"
                  backgroundClass="bg-red-950/10"
                  rows={redSimulatorRows}
                  ownTeamNumber={ownTeamNumber}
                  searchedTeamNumber={searchedTeamNumber}
                  metricLabel={MODEL_LABELS[selectedMetric]}
                />
                <SimulatorAllianceCard
                  title="Blue Alliance Breakdown"
                  accentClass="text-blue-300"
                  borderClass="border-blue-500/20"
                  backgroundClass="bg-blue-950/10"
                  rows={blueSimulatorRows}
                  ownTeamNumber={ownTeamNumber}
                  searchedTeamNumber={searchedTeamNumber}
                  metricLabel={MODEL_LABELS[selectedMetric]}
                />
              </div>
            </div>
          )}

          {activeTab === 'strategyBrain' && (
            <AdminV2StrategyBrainView
              eventKey={eventKey}
              selectedMetric={selectedMetric}
              ownTeamNumber={ownTeamNumber}
              v4Records={v4Records}
              v3Records={records}
              defenseRecords={defenseRecords}
              matches={activePredictorMatches}
              teamAverages={teamAverages}
              averageLookup={averageLookup}
              oprRatings={activeOprRatings}
              dprRatings={calculatedDprRatings}
              epaRatings={epaRatings}
              teamNameLookup={resolvedTeamNameLookup}
            />
          )}

          {activeTab === 'import' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-black text-white">
                      <Upload className="h-5 w-5 text-cyan-400" />
                      TBA Data Import (CSV + JSON)
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm text-slate-400">
                      Upload TBA exports here: matches/schedule JSON, rankings JSON, alliances JSON, event JSON,
                      teams JSON/CSV, and OPR/COPR CSV or JSON. These files are saved locally for Admin V2 predictions,
                      rankings, team labels, and playoff structure fallback.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-500">
                    <Upload className="h-4 w-4" />
                    UPLOAD TBA FILES
                    <input type="file" accept=".csv,.json,text/csv,application/json" multiple className="hidden" onChange={handleOprCsvUpload} />
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <SummaryCard label="OPR/COPR" value={uploadedCsvPack?.coprs?.fileName || 'Not loaded'} />
                  <SummaryCard label="Schedule" value={uploadedCsvPack?.schedule?.fileName || uploadedCsvPack?.flatSchedule?.fileName || 'Not loaded'} />
                  <SummaryCard
                    label="TBA Metadata"
                    value={
                      [
                        uploadedCsvPack?.teamList?.fileName,
                        uploadedCsvPack?.rankings?.fileName,
                        uploadedCsvPack?.alliances?.fileName,
                        uploadedCsvPack?.eventSummary?.fileName
                      ].filter(Boolean).length
                    }
                  />
                </div>

                {csvError && (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                    <AlertTriangle className="mr-2 inline h-4 w-4" />
                    {csvError}
                  </div>
                )}

                {csvMessages.length > 0 && (
                  <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
                    <div className="space-y-2">
                      {csvMessages.map((message, index) => (
                        <div key={`${message.text}-${index}`} className="flex items-start gap-2">
                          <Upload className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{message.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="mb-6">
                  <h3 className="flex items-center gap-2 text-lg font-black text-white">
                    <Upload className="h-5 w-5 text-cyan-400" />
                    Scouting Data Import (QR + JSON)
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm text-slate-400">
                    Import scouting data through live QR scans, QR images, or `.json` archive files. This reuses the
                    shared importer, so QR and JSON imports stay compatible with V4 match records, defense scout records,
                    current V3 match records, pit records, and the existing staging protocol.
                  </p>
                </div>
                <QRScannerView isEmbedded={true} isActive={activeTab === 'import'} />
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-black text-white">
                      <RefreshCw className="h-5 w-5 text-amber-300" />
                      Local Archive Sync Status
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm text-amber-50/80">
                      This reads the scout archive stored in IndexedDB on this admin device, including records restored
                      from scout JSON backups. Unsynced records can be pushed to Firebase here without overwriting
                      conflicting remote data.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSyncLocalArchiveToFirebase()}
                    disabled={isLocalArchiveSyncing || localArchiveSummary.unsyncedRecords.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-black text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className={`h-4 w-4 ${isLocalArchiveSyncing ? 'animate-bounce' : ''}`} />
                    SYNC UNSYNCED TO FIREBASE
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
                  <SummaryCard label="Active Local Records" value={localArchiveSummary.activeRecords.length} />
                  <SummaryCard label="Tombstoned Records" value={localArchiveSummary.deletedRecords.length} />
                  <SummaryCard label="Unsynced" value={localArchiveSummary.unsyncedRecords.length} />
                  <SummaryCard label="Conflicts" value={localArchiveSummary.conflictRecords.length} />
                </div>

                {localArchiveSyncStatus && (
                  <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-50">
                    {localArchiveSyncStatus}
                  </div>
                )}
                {localArchiveError && (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                    <AlertTriangle className="mr-2 inline h-4 w-4" />
                    {localArchiveError}
                  </div>
                )}
                {localArchiveSummary.unsyncedRecords.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-amber-300/20">
                    <table className="admin-sticky-table min-w-full divide-y divide-amber-300/20 text-sm">
                      <thead className="bg-amber-950/30 text-xs uppercase tracking-wider text-amber-100">
                        <tr>
                          <th className="px-4 py-3 text-left">Type</th>
                          <th className="px-4 py-3 text-left">Logical ID</th>
                          <th className="px-4 py-3 text-left">Sync State</th>
                          <th className="px-4 py-3 text-left">Last Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-300/10 text-amber-50/90">
                        {localArchiveSummary.unsyncedRecords.slice(0, 8).map(record => (
                          <tr key={record.recordId}>
                            <td className="px-4 py-3 font-black uppercase">{record.recordType}</td>
                            <td className="px-4 py-3 font-mono text-xs">{record.logicalId}</td>
                            <td className="px-4 py-3">{record.syncStatus}</td>
                            <td className="px-4 py-3 text-xs text-amber-100/80">{record.lastFirebaseError || 'Waiting for retry'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {localArchiveSummary.unsyncedRecords.length > 8 && (
                      <div className="border-t border-amber-300/10 px-4 py-3 text-xs font-semibold text-amber-100/70">
                        Showing 8 of {localArchiveSummary.unsyncedRecords.length} unsynced records.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-black text-white">
                      <Download className="h-5 w-5 text-emerald-300" />
                      Full Local Backup
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm text-emerald-50/80">
                      Export the Admin V2 device state as JSON: scout archive records including tombstones, cached
                      source data, uploaded TBA files, model snapshots, scout assignment plans, and PowerCoins. FIRST
                      credentials are summarized, but the token is never included.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-50 hover:bg-emerald-400/20">
                      <Upload className="h-4 w-4" />
                      IMPORT FULL BACKUP JSON
                      <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportFullLocalBackup} />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleExportFullLocalBackup()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500"
                    >
                      <Download className="h-4 w-4" />
                      EXPORT FULL BACKUP JSON
                    </button>
                  </div>
                </div>
                {localBackupStatus && (
                  <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-50">
                    {localBackupStatus}
                  </div>
                )}
                {localBackupError && (
                  <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                    <AlertTriangle className="mr-2 inline h-4 w-4" />
                    {localBackupError}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h3 className="text-lg font-black text-white">Excel Export</h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Export one workbook with multiple sheets for the active event: raw V3/V4/defense data, team metrics,
                PPC/EPA/OPR values and components, projected rankings, forecasts, coverage audits, cached source status,
                scout ops, and PowerCoins.
              </p>
              <button
                onClick={() => void exportInsightsWorkbook()}
                disabled={exportStatus === 'loading'}
                className={`mt-6 rounded-xl px-5 py-3 font-black text-white disabled:opacity-50 ${
                  exportStatus === 'success' ? 'bg-emerald-600' : 'bg-cyan-600 hover:bg-cyan-500'
                }`}
              >
                <Download className="mr-2 inline h-4 w-4" />
                {exportStatus === 'loading'
                  ? 'BUILDING XLSX'
                  : exportStatus === 'success'
                    ? 'XLSX EXPORTED'
                    : 'DOWNLOAD INSIGHTS XLSX'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
      <div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  activeField,
  direction,
  onClick,
  align = 'text-left'
}: {
  label: string;
  field: SorterField;
  activeField: SorterField;
  direction: SorterDirection;
  onClick: (field: SorterField) => void;
  align?: string;
}) {
  const isActive = activeField === field;

  return (
    <th
      className={`cursor-pointer px-4 py-3 transition-colors hover:text-white ${align}`}
      onClick={() => onClick(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && <ArrowUpDown className={`h-3.5 w-3.5 ${direction === 'asc' ? 'rotate-180' : ''}`} />}
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

function MetricField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
      <div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function SidebarListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
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
              <th className="px-4 py-3">Auto</th>
              <th className="px-4 py-3">Teleop</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center font-semibold text-slate-500">
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
                      row.recommendedRole === 'Defense' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-fuchsia-500/15 text-fuchsia-200'
                    }`}>
                      {row.recommendedRole}
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
