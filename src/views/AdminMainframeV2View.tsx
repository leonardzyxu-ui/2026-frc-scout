import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpDown,
  ArrowLeft,
  Download,
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
import { MatchDefenseScoutingV1, MatchScoutingV3, MatchScoutingV4, PreMatchTeamProfile } from '../types';
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
  UploadedTbaCsvImportMessage,
  UploadedTbaCsvPack
} from '../utils/adminV2TbaCsv';
import {
  AdminV2SelectedMetric,
  AdminV2Settings,
  loadAdminV2Settings,
  saveAdminV2Settings
} from '../utils/adminV2Settings';
import { fetchPreMatchTeamProfile } from '../utils/preMatchScouting';
import { isMatchDefenseScoutingV1 } from '../utils/matchDefenseScouting';
import { isMatchScoutingV4 } from '../utils/matchScoutingV4';
import AdminV2StrategyBrainView from './AdminV2StrategyBrainView';
import {
  backtestTimeAwareModels,
  buildAlliancePickRecommendations,
  buildDefenseAttributions,
  buildDefenseImpactLookup,
  buildPpaRatings,
  buildStrategyMatchPlans,
  buildTeamPerformanceProfiles
} from '../utils/strategyBrain';

type AdminV2Tab = 'results' | 'teams' | 'sorter' | 'predictor' | 'simulator' | 'strategyBrain' | 'import' | 'export';
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

const formatMaybeValue = (value: string | number | null | undefined) =>
  value == null || value === '' ? '—' : String(value);

const formatWorksheetDate = (timestampSeconds: number | null | undefined) => {
  if (!timestampSeconds) return '';
  return new Date(timestampSeconds * 1000).toISOString();
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
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';

  const eventKey = settings.eventKey;
  const selectedMetric = settings.selectedMetric;
  const ownTeamNumber = settings.ownTeamNumber;
  const searchedTeamNumber = settings.searchedTeamNumber;

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
    setUploadedCsvPack(loadUploadedTbaCsvPack(eventKey));
    setCsvMessages([]);
    setCsvError('');
  }, [eventKey]);

  useEffect(() => {
    setTeamSearchInput(searchedTeamNumber);
  }, [searchedTeamNumber]);

  const loadV3Data = async () => {
    setLoading(true);
    setError('');
    setLiveScheduleUnavailable('');

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
      } else {
        setCurrentTbaRanks({});
        setCurrentTbaRankOrder([]);
      }

      if (alliancesResult.status === 'fulfilled' && alliancesResult.value.ok) {
        setAlliances((await alliancesResult.value.json()) as any);
      } else {
        setAlliances(null);
      }

      if (summaryResult.status === 'fulfilled' && summaryResult.value.ok) {
        setEventSummary(await summaryResult.value.json());
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

  const buildSimulatorRow = (teamNumber: string) => {
    const teamAverage = teamAverageLookupByTeam[teamNumber];
    const epaMetrics = epaByTeam[teamNumber];
    const oprComponents = csvOprComponents[teamNumber];
    return {
      teamNumber,
      teamName: resolvedTeamNameLookup[teamNumber] || '',
      rating: activeMetricRatings[teamNumber] ?? 0,
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
    [redSimulatorTeams, activeMetricRatings, selectedMetric, teamAverageLookupByTeam, csvOprComponents, epaByTeam, resolvedTeamNameLookup]
  );
  const blueSimulatorRows = useMemo(
    () => blueSimulatorTeams.map(teamNumber => buildSimulatorRow(teamNumber)),
    [blueSimulatorTeams, activeMetricRatings, selectedMetric, teamAverageLookupByTeam, csvOprComponents, epaByTeam, resolvedTeamNameLookup]
  );

  const simulatorSummary = useMemo(() => {
    const redScore = redSimulatorRows.reduce((sum, row) => sum + row.rating, 0);
    const blueScore = blueSimulatorRows.reduce((sum, row) => sum + row.rating, 0);
    const redMissing = redSimulatorRows.filter(row => !(row.teamNumber in activeMetricRatings));
    const blueMissing = blueSimulatorRows.filter(row => !(row.teamNumber in activeMetricRatings));
    const totalTeams = redSimulatorRows.length + blueSimulatorRows.length;
    return {
      redScore,
      blueScore,
      redMissing,
      blueMissing,
      totalTeams,
      margin: Math.abs(redScore - blueScore),
      winner:
        redSimulatorRows.length > 0 && blueSimulatorRows.length > 0
          ? redScore === blueScore
            ? 'Tie'
            : redScore > blueScore
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
      const exportPpaRatings = buildPpaRatings(modelBacktests, {
        PPC: averageLookup,
        'Rolling PPC': averageLookup,
        OPR: activeOprRatings,
        'Rolling OPR': activeOprRatings,
        EPA: epaRatings,
        'Recency EPA': epaRatings,
        Ensemble: activeMetricRatings
      });
      const defenseAttributions = buildDefenseAttributions(v4Records, Object.keys(exportPpaRatings).length ? exportPpaRatings : activeMetricRatings);
      const defenseImpactLookup = buildDefenseImpactLookup(defenseAttributions);
      const teamProfiles = buildTeamPerformanceProfiles({
        v4Records,
        v3Records: records,
        defenseRecords,
        ppcRows: teamAverages,
        oprRatings: activeOprRatings,
        dprRatings: calculatedDprRatings,
        epaRatings,
        ppaRatings: exportPpaRatings,
        defenseImpactLookup
      });
      const strategyPlans = buildStrategyMatchPlans(activePredictorMatches, activeMetricRatings, defenseImpactLookup);
      const allianceRecommendations = buildAlliancePickRecommendations(teamProfiles, 1, {}, ownTeamNumber);

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

      addFinalsProjectionSheet(workbook, 'PPC Finals', ppcFinalsProjection);
      addFinalsProjectionSheet(workbook, 'EPA Finals', epaFinalsProjection);
      addFinalsProjectionSheet(workbook, 'OPR Finals', oprFinalsProjection);

      addWorkbookSheet(workbook, 'Model Lab', [
        { header: 'Model', key: 'modelName', width: 18 },
        { header: 'Source', key: 'sourceLabel', width: 44 },
        { header: 'Matches Tested', key: 'matchesTested', width: 16 },
        { header: 'Winner Accuracy', key: 'winnerAccuracy', width: 18 },
        { header: 'Score MAE', key: 'scoreMae', width: 14 },
        { header: 'Margin MAE', key: 'marginMae', width: 14 },
        { header: 'Calibration Error', key: 'calibrationError', width: 18 },
        { header: 'Low Confidence Rate', key: 'lowConfidenceRate', width: 20 }
      ], modelBacktests.map(row => ({ ...row })));

      addWorkbookSheet(workbook, 'Team Profiles', [
        { header: 'Team', key: 'teamNumber', width: 10 },
        { header: 'Team Name', key: 'teamName', width: 24 },
        { header: 'Matches Played', key: 'matchesPlayed', width: 16 },
        { header: 'Peak Score', key: 'peakScore', width: 14 },
        { header: 'Worst Score', key: 'worstScore', width: 14 },
        { header: 'Lowest Nonzero', key: 'lowestNonZeroScore', width: 16 },
        { header: 'Average', key: 'averageScore', width: 14 },
        { header: 'Std Dev', key: 'standardDeviation', width: 14 },
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
        { header: 'Red Teams', key: 'redTeams', width: 28 },
        { header: 'Blue Teams', key: 'blueTeams', width: 28 },
        { header: 'Baseline Red', key: 'baselineRedScore', width: 14 },
        { header: 'Baseline Blue', key: 'baselineBlueScore', width: 14 },
        { header: 'Best Red Plan', key: 'bestRedPlan', width: 34 },
        { header: 'Best Blue Plan', key: 'bestBluePlan', width: 34 },
        { header: 'Winner', key: 'predictedWinner', width: 12 },
        { header: 'Confidence', key: 'confidence', width: 14 },
        { header: 'Risk Flags', key: 'riskFlags', width: 36 },
        { header: 'Win Condition', key: 'winCondition', width: 56 }
      ], strategyPlans.map(plan => ({
        ...plan,
        redTeams: plan.redTeams.join(', '),
        blueTeams: plan.blueTeams.join(', '),
        riskFlags: plan.riskFlags.join(' | ')
      })));

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
                        <td colSpan={7} className="px-4 py-10 text-center font-semibold text-slate-500">
                          Loading match scout results...
                        </td>
                      </tr>
                    ) : filteredResultsRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center font-semibold text-slate-500">
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
                  to get a projected alliance score, or both alliances to get the winner and margin.
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
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
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
                </div>

                {(simulatorSummary.redMissing.length > 0 || simulatorSummary.blueMissing.length > 0) && (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
                    Missing {MODEL_LABELS[selectedMetric]} data is treated as 0 for:
                    {' '}
                    {[...simulatorSummary.redMissing, ...simulatorSummary.blueMissing].map(row => row.teamNumber).join(', ')}
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
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="mb-6">
                <h3 className="flex items-center gap-2 text-lg font-black text-white">
                  <Upload className="h-5 w-5 text-cyan-400" />
                  Data Import (QR + JSON)
                </h3>
                <p className="mt-2 max-w-3xl text-sm text-slate-400">
                  Import scouting data through live QR scans, QR images, or `.json` archive files. This reuses the
                  shared importer, so QR and JSON imports stay compatible with V4 match records, defense scout records,
                  current V3 match records, pit records, and the existing staging protocol.
                </p>
              </div>
              <QRScannerView isEmbedded={true} isActive={activeTab === 'import'} />
            </div>
          )}

          {activeTab === 'export' && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h3 className="text-lg font-black text-white">Excel Export</h3>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Export one workbook with multiple sheets for the active event: raw V3 data, team metrics, PPC/EPA/OPR
                values and components, projected rankings, qualification forecasts, and finals forecasts.
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
        <table className="admin-sticky-table min-w-[640px] w-full text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">{metricLabel}</th>
              <th className="px-4 py-3">Auto</th>
              <th className="px-4 py-3">Teleop</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-semibold text-slate-500">
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
