import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Brain, Coins, Download, RefreshCw, Shield, Target, Trophy, Upload, Users } from 'lucide-react';
import {
  AlliancePickRecommendation,
  MatchDefenseScoutingV1,
  MatchScoutingV3,
  MatchScoutingV4,
  ModelCalibrationBin,
  ModelFeatureSnapshot,
  ModelLabSnapshot,
  PowerCoinBet,
  PowerCoinLedgerEntry,
  ScoutAssignmentPlan,
  StrategyAllianceRpPath,
  StrategyRoleOption,
  TeamPerformanceProfile
} from '../types';
import { AdminV2SelectedMetric } from '../utils/adminV2Settings';
import { TeamHistoricalAverageRow } from '../utils/adminV2Analytics';
import { TBAMatch } from '../utils/mathEngine';
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
import {
  AdminV2CacheEntry,
  FirstEventsCredentials,
  clearFirstEventsCredentials,
  getPowerCoinBalance,
  listAdminV2CacheEntries,
  listPowerCoinBets,
  listPowerCoinLedger,
  loadFirstEventsCredentials,
  loadLatestModelFeatureSnapshot,
  loadLatestScoutAssignmentPlan,
  loadLatestModelLabSnapshot,
  restoreAdminV2CacheEntries,
  saveFirstEventsCredentials,
  saveModelFeatureSnapshot,
  saveModelLabSnapshot,
  saveScoutAssignmentPlan,
  settlePowerCoinBetsForMatch,
  upsertPowerCoinBet,
  upsertPowerCoinLedgerEntry
} from '../utils/adminV2LocalStore';
import { fetchAndCacheFirstEventBundle, getYearFromEventKey } from '../utils/firstEventsApi';

type StrategyBrainTab = 'foundation' | 'models' | 'profiles' | 'strategy' | 'alliance' | 'scoutOps';

const DEFAULT_SCOUTS = ['Olivia', 'Eason', 'Matilda', 'Sophia', 'Lucas', 'Justin'];
const STARTING_POWERCOINS = 1000;
const ALLIANCE_SELECTION_STORAGE_PREFIX = 'adminv2_strategy_alliance_selection';

type LocalAllianceSelectionState = {
  allianceSeed: number;
  pickedTeamsText: string;
  updatedAt: number;
};

interface AdminV2CacheExportPayload {
  format: 'rebuilt-2026-admin-v2-cache';
  version: number;
  eventKey: string;
  exportedAt: number;
  cacheEntries?: Awaited<ReturnType<typeof listAdminV2CacheEntries>>;
  latestModelSnapshot?: ModelLabSnapshot | null;
  latestFeatureSnapshot?: ModelFeatureSnapshot | null;
  scoutAssignmentPlan?: ScoutAssignmentPlan | null;
  powerCoinBets?: PowerCoinBet[];
  powerCoinLedger?: PowerCoinLedgerEntry[];
}

const formatNumber = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const formatPercent = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(digits)}%`;

const metricLabel = (metric: AdminV2SelectedMetric) => metric.toUpperCase();

const formatSigned = (value: number | null | undefined, digits = 2) => {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
};

const parsePickedStatuses = (value: string): Record<string, { status: AlliancePickRecommendation['status']; pickedBy?: string }> => {
  const result: Record<string, { status: AlliancePickRecommendation['status']; pickedBy?: string }> = {};
  value.split('\n').forEach(line => {
    const [teamRaw, statusRaw, pickedByRaw] = line.split(',').map(part => part?.trim());
    const teamNumber = (teamRaw || '').replace(/[^\d]/g, '');
    if (!teamNumber) return;
    const status = statusRaw === 'picked' || statusRaw === 'declined' || statusRaw === 'unavailable' ? statusRaw : 'available';
    result[teamNumber] = { status, pickedBy: pickedByRaw || '' };
  });
  return result;
};

const isPlayedMatch = (match: TBAMatch) =>
  match.alliances.red.score !== -1 && match.alliances.blue.score !== -1;

const getPlayedMatchWinner = (match: TBAMatch): 'Red' | 'Blue' | 'Tie' | 'Unknown' => {
  if (!isPlayedMatch(match)) return 'Unknown';
  if (match.alliances.red.score === match.alliances.blue.score) return 'Tie';
  return match.alliances.red.score > match.alliances.blue.score ? 'Red' : 'Blue';
};

const getAllianceSelectionStorageKey = (eventKey: string) =>
  `${ALLIANCE_SELECTION_STORAGE_PREFIX}_${eventKey.trim().toUpperCase() || 'UNKNOWN'}`;

const loadAllianceSelectionState = (eventKey: string): LocalAllianceSelectionState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getAllianceSelectionStorageKey(eventKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalAllianceSelectionState>;
    return {
      allianceSeed: Math.max(1, Math.min(8, Number(parsed.allianceSeed) || 1)),
      pickedTeamsText: typeof parsed.pickedTeamsText === 'string' ? parsed.pickedTeamsText : '',
      updatedAt: Number(parsed.updatedAt) || Date.now()
    };
  } catch (error) {
    console.warn('Failed to load local alliance selection state', error);
    return null;
  }
};

const saveAllianceSelectionState = (eventKey: string, state: LocalAllianceSelectionState) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getAllianceSelectionStorageKey(eventKey), JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save local alliance selection state', error);
  }
};

const downloadJsonFile = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const isAdminV2CacheExportPayload = (value: unknown): value is AdminV2CacheExportPayload => {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<AdminV2CacheExportPayload>;
  return payload.format === 'rebuilt-2026-admin-v2-cache' && typeof payload.eventKey === 'string';
};

const escapeCsv = (value: string | number | null | undefined) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadCsvFile = (filename: string, rows: Array<Record<string, string | number | null | undefined>>) => {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => headers.map(header => escapeCsv(row[header])).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const formatFeatureTeamList = (teams: string[], featuresByTeam: Record<string, Record<string, number>>) =>
  teams.map(team => {
    const features = featuresByTeam[team] || {};
    return `${team}: PPC ${formatNumber(features.ppcBefore, 1)} (${formatNumber(features.scoutingRowsBefore, 0)} rows), OPR ${formatNumber(features.oprBefore, 1)} (${formatNumber(features.officialMatchesBefore, 0)} official)`;
  }).join(' · ');

const getStrategyTeamBadgeClass = (teamNumber: string, ownTeamNumber: string, searchedTeamNumber: string) => {
  const isOwnTeam = ownTeamNumber !== '' && ownTeamNumber === teamNumber;
  const isSearchedTeam = searchedTeamNumber !== '' && searchedTeamNumber === teamNumber;

  if (isOwnTeam && isSearchedTeam) {
    return 'bg-orange-500 text-slate-950 ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950';
  }

  if (isOwnTeam) return 'bg-orange-500 text-slate-950';
  if (isSearchedTeam) return 'bg-sky-500 text-slate-950';
  return 'border border-slate-700 bg-slate-950 text-slate-200';
};

function StrategyTeamBadge({
  teamNumber,
  ownTeamNumber,
  searchedTeamNumber
}: {
  teamNumber: string;
  ownTeamNumber: string;
  searchedTeamNumber: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-xl px-3 py-1 font-mono text-sm font-black ${getStrategyTeamBadgeClass(teamNumber, ownTeamNumber, searchedTeamNumber)}`}>
      {teamNumber}
    </span>
  );
}

function StrategyTeamBadgeList({
  teams,
  ownTeamNumber,
  searchedTeamNumber
}: {
  teams: string[];
  ownTeamNumber: string;
  searchedTeamNumber: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {teams.map(teamNumber => (
        <StrategyTeamBadge
          key={teamNumber}
          teamNumber={teamNumber}
          ownTeamNumber={ownTeamNumber}
          searchedTeamNumber={searchedTeamNumber}
        />
      ))}
    </div>
  );
}

export default function AdminV2StrategyBrainView({
  defaultTab = 'foundation',
  eventKey,
  selectedMetric,
  ownTeamNumber,
  searchedTeamNumber,
  v4Records,
  v3Records,
  defenseRecords,
  matches,
  teamAverages,
  averageLookup,
  oprRatings,
  dprRatings,
  epaRatings,
  teamNameLookup
}: {
  defaultTab?: StrategyBrainTab;
  eventKey: string;
  selectedMetric: AdminV2SelectedMetric;
  ownTeamNumber: string;
  searchedTeamNumber: string;
  v4Records: MatchScoutingV4[];
  v3Records: MatchScoutingV3[];
  defenseRecords: MatchDefenseScoutingV1[];
  matches: TBAMatch[];
  teamAverages: TeamHistoricalAverageRow[];
  averageLookup: Record<string, number>;
  oprRatings: Record<string, number>;
  dprRatings: Record<string, number>;
  epaRatings: Record<string, number>;
  teamNameLookup: Record<string, string>;
}) {
  const [activeTab, setActiveTab] = useState<StrategyBrainTab>(defaultTab);
  const [firstCredentials, setFirstCredentials] = useState<FirstEventsCredentials | null>(null);
  const [cacheCount, setCacheCount] = useState(0);
  const [cacheEntries, setCacheEntries] = useState<AdminV2CacheEntry[]>([]);
  const [firstStatus, setFirstStatus] = useState('');
  const [firstError, setFirstError] = useState('');
  const [scoutRosterText, setScoutRosterText] = useState(DEFAULT_SCOUTS.join('\n'));
  const [scoutAssignmentPlan, setScoutAssignmentPlan] = useState<ScoutAssignmentPlan | null>(null);
  const [pickedTeamsText, setPickedTeamsText] = useState('');
  const [allianceSeed, setAllianceSeed] = useState(1);
  const [allianceSelectionLoadedFor, setAllianceSelectionLoadedFor] = useState('');
  const [powerCoinBets, setPowerCoinBets] = useState<PowerCoinBet[]>([]);
  const [powerCoinLedger, setPowerCoinLedger] = useState<PowerCoinLedgerEntry[]>([]);
  const [powerCoinStatus, setPowerCoinStatus] = useState('');
  const [powerCoinAdjustmentScout, setPowerCoinAdjustmentScout] = useState('');
  const [powerCoinAdjustmentAmount, setPowerCoinAdjustmentAmount] = useState(100);
  const [powerCoinAdjustmentReason, setPowerCoinAdjustmentReason] = useState('Quality scouting bonus');
  const [scoutOpsStatus, setScoutOpsStatus] = useState('');
  const [latestModelSnapshot, setLatestModelSnapshot] = useState<ModelLabSnapshot | null>(null);
  const [latestFeatureSnapshot, setLatestFeatureSnapshot] = useState<ModelFeatureSnapshot | null>(null);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const [credentials, cacheEntries, plan, bets, ledger, snapshot, featureSnapshot] = await Promise.all([
          loadFirstEventsCredentials().catch(() => null),
          listAdminV2CacheEntries(eventKey).catch(() => []),
          loadLatestScoutAssignmentPlan(eventKey).catch(() => null),
          listPowerCoinBets(eventKey).catch(() => []),
          listPowerCoinLedger(eventKey).catch(() => []),
          loadLatestModelLabSnapshot(eventKey).catch(() => null),
          loadLatestModelFeatureSnapshot(eventKey).catch(() => null)
        ]);
        if (cancelled) return;
        setFirstCredentials(credentials);
        setCacheCount(cacheEntries.length);
        setCacheEntries(cacheEntries);
        setScoutAssignmentPlan(plan);
        if (plan?.scoutNames?.length) {
          setScoutRosterText(plan.scoutNames.join('\n'));
        }
        setPowerCoinBets(bets);
        setPowerCoinLedger(ledger);
        setLatestModelSnapshot(snapshot);
        setLatestFeatureSnapshot(featureSnapshot);
      } catch (error) {
        console.warn('Failed to hydrate Strategy Brain local state', error);
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [eventKey]);

  useEffect(() => {
    if (activeTab !== 'foundation') return;
    let cancelled = false;
    const refreshCacheEntries = async () => {
      const entries = await listAdminV2CacheEntries(eventKey).catch(() => []);
      if (cancelled) return;
      setCacheEntries(entries);
      setCacheCount(entries.length);
    };
    void refreshCacheEntries();
    const timeoutId = window.setTimeout(() => void refreshCacheEntries(), 750);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, defenseRecords.length, eventKey, matches.length, v3Records.length, v4Records.length]);

  useEffect(() => {
    const storedState = loadAllianceSelectionState(eventKey);
    setAllianceSeed(storedState?.allianceSeed ?? 1);
    setPickedTeamsText(storedState?.pickedTeamsText ?? '');
    setAllianceSelectionLoadedFor(eventKey);
  }, [eventKey]);

  useEffect(() => {
    if (allianceSelectionLoadedFor !== eventKey) return;
    saveAllianceSelectionState(eventKey, {
      allianceSeed,
      pickedTeamsText,
      updatedAt: Date.now()
    });
  }, [allianceSeed, allianceSelectionLoadedFor, eventKey, pickedTeamsText]);

  const modelBacktests = useMemo(() => backtestTimeAwareModels({
    matches,
    v3Records,
    v4Records,
    epaRatings
  }), [epaRatings, matches, v3Records, v4Records]);
  const noFutureFeatureMatchSnapshots = useMemo(
    () => buildNoFutureFeatureMatchSnapshots({ matches, v3Records, v4Records }),
    [matches, v3Records, v4Records]
  );
  const noFutureBlendLookup = useMemo(
    () => buildAverageBlendLookup([averageLookup, oprRatings]),
    [averageLookup, oprRatings]
  );

  const ppaRatings = useMemo(() => buildPpaRatings(modelBacktests, {
    PPC: averageLookup,
    'Rolling PPC': averageLookup,
    OPR: oprRatings,
    'Rolling OPR': oprRatings,
    'No-Future Blend': noFutureBlendLookup,
    DPR: dprRatings,
    EPA: epaRatings,
    'Recency EPA': epaRatings
  }), [averageLookup, dprRatings, epaRatings, modelBacktests, noFutureBlendLookup, oprRatings]);
  const activeMetricRatings = useMemo(
    () =>
      selectedMetric === 'ppc'
        ? averageLookup
        : selectedMetric === 'opr'
          ? oprRatings
          : selectedMetric === 'ppa'
            ? ppaRatings
            : epaRatings,
    [averageLookup, epaRatings, oprRatings, ppaRatings, selectedMetric]
  );

  const bestModelForecastLayer = useMemo(() => buildBestModelFutureForecasts({
    matches,
    v3Records,
    v4Records,
    epaRatings,
    modelResults: modelBacktests,
    ratingLookups: {
      PPC: averageLookup,
      'Rolling PPC': averageLookup,
      OPR: oprRatings,
      'Rolling OPR': oprRatings,
      'No-Future Blend': noFutureBlendLookup,
      EPA: epaRatings,
      'Recency EPA': epaRatings
    }
  }), [averageLookup, epaRatings, matches, modelBacktests, noFutureBlendLookup, oprRatings, v3Records, v4Records]);

  const defenseAttributions = useMemo(
    () => buildDefenseAttributions(v4Records, Object.keys(ppaRatings).length ? ppaRatings : activeMetricRatings),
    [activeMetricRatings, ppaRatings, v4Records]
  );
  const defenseImpactLookup = useMemo(() => buildDefenseImpactLookup(defenseAttributions), [defenseAttributions]);
  const defenseImpactRows = useMemo(() => {
    const buckets = new Map<string, typeof defenseAttributions>();
    defenseAttributions.forEach(record => {
      const bucket = buckets.get(record.defenderTeamNumber) || [];
      bucket.push(record);
      buckets.set(record.defenderTeamNumber, bucket);
    });

    return Array.from(buckets.entries()).map(([teamNumber, records]) => {
      const targetCounts = new Map<string, number>();
      records.forEach(record => targetCounts.set(record.targetTeamNumber, (targetCounts.get(record.targetTeamNumber) || 0) + 1));
      const topTarget = Array.from(targetCounts.entries())
        .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]))[0]?.[0] || '';
      const weightedDenied = records.reduce((sum, record) => sum + record.pointsDenied * record.confidence, 0);
      return {
        teamNumber,
        records: records.length,
        weightedDenied,
        rawDenied: records.reduce((sum, record) => sum + record.pointsDenied, 0),
        avgConfidence: records.length ? records.reduce((sum, record) => sum + record.confidence, 0) / records.length : 0,
        targetsAffected: targetCounts.size,
        topTarget,
        dpr: dprRatings[teamNumber] ?? null
      };
    }).sort((left, right) => right.weightedDenied - left.weightedDenied || Number(left.teamNumber) - Number(right.teamNumber));
  }, [defenseAttributions, dprRatings]);
  const targetSuppressionRows = useMemo(() => {
    const buckets = new Map<string, typeof defenseAttributions>();
    defenseAttributions.forEach(record => {
      const bucket = buckets.get(record.targetTeamNumber) || [];
      bucket.push(record);
      buckets.set(record.targetTeamNumber, bucket);
    });

    return Array.from(buckets.entries()).map(([teamNumber, records]) => {
      const defenderCounts = new Map<string, number>();
      records.forEach(record => defenderCounts.set(record.defenderTeamNumber, (defenderCounts.get(record.defenderTeamNumber) || 0) + 1));
      const mainDefender = Array.from(defenderCounts.entries())
        .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]))[0]?.[0] || '';
      return {
        teamNumber,
        records: records.length,
        deniedAgainst: records.reduce((sum, record) => sum + record.pointsDenied * record.confidence, 0),
        avgExpected: records.length ? records.reduce((sum, record) => sum + record.expectedTargetPoints, 0) / records.length : 0,
        avgActual: records.length ? records.reduce((sum, record) => sum + record.actualTargetPoints, 0) / records.length : 0,
        defendersSeen: defenderCounts.size,
        mainDefender
      };
    }).sort((left, right) => right.deniedAgainst - left.deniedAgainst || Number(left.teamNumber) - Number(right.teamNumber));
  }, [defenseAttributions]);
  const bonusMetricLookup = useMemo(
    () => buildScoutedBonusMetricLookup(v3Records, v4Records),
    [v3Records, v4Records]
  );
  const teamProfiles = useMemo(() => buildTeamPerformanceProfiles({
    v4Records,
    v3Records,
    defenseRecords,
    ppcRows: teamAverages,
    oprRatings,
    dprRatings,
    epaRatings,
    ppaRatings,
    defenseImpactLookup,
    featureMatchSnapshots: noFutureFeatureMatchSnapshots
  }), [defenseImpactLookup, defenseRecords, dprRatings, epaRatings, noFutureFeatureMatchSnapshots, oprRatings, ppaRatings, teamAverages, v3Records, v4Records]);
  const strategyPlans = useMemo(
    () => buildStrategyMatchPlans(matches, activeMetricRatings, defenseImpactLookup, bonusMetricLookup, bestModelForecastLayer),
    [activeMetricRatings, bestModelForecastLayer, bonusMetricLookup, defenseImpactLookup, matches]
  );
  const scoutCalibrationRows = useMemo(
    () => buildScoutCalibrationRows(v4Records, matches),
    [matches, v4Records]
  );
  const allianceRecommendations = useMemo(
    () => buildAlliancePickRecommendations(teamProfiles, allianceSeed, parsePickedStatuses(pickedTeamsText), ownTeamNumber),
    [allianceSeed, ownTeamNumber, pickedTeamsText, teamProfiles]
  );

  const modelFeaturesByTeam = useMemo(() => {
    const ppcByTeam = Object.fromEntries(teamAverages.map(row => [row.teamNumber, row]));
    const defenseMetricBuckets = new Map<string, MatchDefenseScoutingV1[]>();
    defenseRecords.forEach(record => {
      const bucket = defenseMetricBuckets.get(record.teamNumber) || [];
      bucket.push(record);
      defenseMetricBuckets.set(record.teamNumber, bucket);
    });

    return Object.fromEntries(teamProfiles.map(profile => {
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
  }, [defenseRecords, teamAverages, teamProfiles]);

  const bestModel = modelBacktests.find(result => result.matchesTested > 0 && result.eligibleForPromotion) || modelBacktests.find(result => result.matchesTested > 0) || null;
  const usableModelCount = modelBacktests.filter(result => result.matchesTested > 0).length;
  const promotionCandidateCount = modelBacktests.filter(result => result.matchesTested > 0 && result.eligibleForPromotion).length;
  const calibrationBins = bestModel?.calibrationBins || [];
  const powerCoinRows = useMemo(() => {
    const scoutNames = Array.from(new Set([
      ...DEFAULT_SCOUTS,
      ...(scoutAssignmentPlan?.scoutNames ?? []),
      ...powerCoinBets.map(bet => bet.scoutName),
      ...powerCoinLedger.map(entry => entry.scoutName)
    ].map(name => name.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));

    return scoutNames.map(scoutName => {
      const normalizedScoutName = scoutName.toLowerCase();
      const scoutBets = powerCoinBets.filter(bet => bet.scoutName.trim().toLowerCase() === normalizedScoutName);
      const scoutLedger = powerCoinLedger.filter(entry => entry.scoutName.trim().toLowerCase() === normalizedScoutName);
      const ledgerDelta = scoutLedger.reduce((sum, entry) => sum + entry.delta, 0);
      const openStake = scoutBets.filter(bet => !bet.settledAt).reduce((sum, bet) => sum + bet.amount, 0);
      const settledDelta = scoutBets
        .filter(bet => bet.settledAt)
        .reduce((sum, bet) => sum + ((bet.payout ?? 0) - bet.amount), 0);
      const balance = STARTING_POWERCOINS + ledgerDelta - openStake + settledDelta;
      return {
        scoutName,
        balance,
        openBets: scoutBets.filter(bet => !bet.settledAt).length,
        openStake,
        settledBets: scoutBets.filter(bet => bet.settledAt).length,
        totalStaked: scoutBets.reduce((sum, bet) => sum + bet.amount, 0),
        totalPayout: scoutBets.reduce((sum, bet) => sum + (bet.payout ?? 0), 0),
        ledgerDelta
      };
    }).sort((left, right) => right.balance - left.balance);
  }, [powerCoinBets, powerCoinLedger, scoutAssignmentPlan]);
  const scoutExposureRows = useMemo(() => {
    if (!scoutAssignmentPlan) return [];
    return scoutAssignmentPlan.scoutNames.map(scoutName => {
      const scoutAssignments = scoutAssignmentPlan.assignments.filter(assignment => assignment.scoutName === scoutName);
      const exposureEntries = Object.entries(scoutAssignmentPlan.exposureCounts[scoutName] || {})
        .sort((left, right) => right[1] - left[1] || Number(left[0]) - Number(right[0]));
      return {
        scoutName,
        assignments: scoutAssignments.length,
        distinctTeams: exposureEntries.length,
        repeatFocus: exposureEntries.filter(([, count]) => count > 1).length,
        ourMatchAssignments: scoutAssignments.filter(assignment => assignment.priorityReason === 'Our match priority').length,
        topTeamExposures: exposureEntries.slice(0, 6).map(([teamNumber, count]) => ({ teamNumber, count }))
      };
    }).sort((left, right) => right.assignments - left.assignments || left.scoutName.localeCompare(right.scoutName));
  }, [scoutAssignmentPlan]);

  useEffect(() => {
    if (modelBacktests.length === 0) return;
    const createdAt = Date.now();
    const snapshot: ModelLabSnapshot = {
      id: `${eventKey}_${createdAt}`,
      eventKey,
      createdAt,
      selectedPromotedModel: bestModel?.modelName || '',
      selectedForecastModel: bestModelForecastLayer.modelName,
      ppaTeamCount: Object.keys(ppaRatings).length,
      modelResults: modelBacktests
    };
    const featureSnapshot: ModelFeatureSnapshot = {
      id: `${eventKey}_features_${createdAt}`,
      eventKey,
      modelName: bestModelForecastLayer.modelName,
      beforeMatchKey: 'latest',
      createdAt,
      featuresByTeam: modelFeaturesByTeam,
      matchSnapshots: noFutureFeatureMatchSnapshots
    };
    void Promise.all([
      saveModelLabSnapshot(snapshot),
      saveModelFeatureSnapshot(featureSnapshot)
    ])
      .then(() => {
        setLatestModelSnapshot(snapshot);
        setLatestFeatureSnapshot(featureSnapshot);
      })
      .catch(error => console.warn('Failed to save model lab snapshot', error));
  }, [bestModel?.modelName, bestModelForecastLayer.modelName, eventKey, modelBacktests, modelFeaturesByTeam, noFutureFeatureMatchSnapshots, ppaRatings]);

  const handleFirstCredentialUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFirstError('');
    setFirstStatus('Reading FIRST Events credentials...');
    try {
      const parsed = JSON.parse(await file.text()) as Partial<FirstEventsCredentials>;
      if (!parsed.username || !parsed.token) {
        throw new Error('Credential JSON must contain username and token.');
      }
      const saved = await saveFirstEventsCredentials({ username: parsed.username, token: parsed.token });
      setFirstCredentials(saved);
      setFirstStatus('FIRST Events credentials saved locally in IndexedDB.');
    } catch (error) {
      setFirstError(error instanceof Error ? error.message : 'Failed to import FIRST credentials.');
      setFirstStatus('');
    }
  };

  const handleFirstCacheRefresh = async () => {
    if (!firstCredentials) {
      setFirstError('Upload FIRST Events credentials first.');
      return;
    }

    setFirstError('');
    setFirstStatus('Fetching FIRST Events data and caching it locally...');
    try {
      const results = await fetchAndCacheFirstEventBundle(firstCredentials, eventKey);
      const failures = results.filter(result => !result.ok);
      const cacheEntries = await listAdminV2CacheEntries(eventKey);
      setCacheCount(cacheEntries.length);
      setCacheEntries(cacheEntries);
      setFirstStatus(`FIRST cache refresh complete: ${results.length - failures.length}/${results.length} endpoints saved for ${getYearFromEventKey(eventKey)}.`);
      if (failures.length > 0) {
        setFirstError(failures.map(result => `${result.key}: ${result.error}`).join('\n'));
      }
    } catch (error) {
      setFirstError(error instanceof Error ? error.message : 'FIRST cache refresh failed.');
      setFirstStatus('');
    }
  };

  const handleExportAdminV2Cache = async () => {
    try {
      const cacheEntries = await listAdminV2CacheEntries(eventKey);
      downloadJsonFile(`adminv4_cache_${eventKey}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`, {
        format: 'rebuilt-2026-admin-v2-cache',
        version: 1,
        eventKey,
        exportedAt: Date.now(),
        cacheEntries,
        latestModelSnapshot,
        latestFeatureSnapshot,
        scoutAssignmentPlan,
        powerCoinBets,
        powerCoinLedger
      });
      setFirstStatus(`Exported ${cacheEntries.length} cached source entr${cacheEntries.length === 1 ? 'y' : 'ies'} plus model, feature, scout, and PowerCoin snapshots.`);
      setFirstError('');
    } catch (error) {
      setFirstError(error instanceof Error ? error.message : 'Failed to export Admin V4 cache.');
    }
  };

  const handleImportAdminV2Cache = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFirstStatus('Restoring Admin V4 cache JSON...');
    setFirstError('');
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isAdminV2CacheExportPayload(parsed)) {
        throw new Error('This is not a REBUILT Admin V4 cache JSON export.');
      }

      if (parsed.eventKey.trim().toUpperCase() !== eventKey.trim().toUpperCase()) {
        throw new Error(`This cache file is for ${parsed.eventKey}. Switch Admin V4 to that event before importing it.`);
      }

      const restoredCacheEntries = await restoreAdminV2CacheEntries(parsed.cacheEntries || []);
      if (parsed.latestModelSnapshot) {
        await saveModelLabSnapshot(parsed.latestModelSnapshot);
        setLatestModelSnapshot(parsed.latestModelSnapshot);
      }
      if (parsed.latestFeatureSnapshot) {
        await saveModelFeatureSnapshot(parsed.latestFeatureSnapshot);
        setLatestFeatureSnapshot(parsed.latestFeatureSnapshot);
      }
      if (parsed.scoutAssignmentPlan) {
        await saveScoutAssignmentPlan(parsed.scoutAssignmentPlan);
        setScoutAssignmentPlan(parsed.scoutAssignmentPlan);
      }
      for (const bet of parsed.powerCoinBets || []) {
        await upsertPowerCoinBet(bet);
      }
      for (const ledgerEntry of parsed.powerCoinLedger || []) {
        await upsertPowerCoinLedgerEntry(ledgerEntry);
      }

      const [cacheEntries, bets, ledger] = await Promise.all([
        listAdminV2CacheEntries(eventKey),
        listPowerCoinBets(eventKey),
        listPowerCoinLedger(eventKey).catch(() => [])
      ]);
      setCacheCount(cacheEntries.length);
      setCacheEntries(cacheEntries);
      setPowerCoinBets(bets);
      setPowerCoinLedger(ledger);
      setFirstStatus(
        `Imported Admin V4 cache: ${restoredCacheEntries} source entries, ${(parsed.powerCoinBets || []).length} PowerCoin bets, ${(parsed.powerCoinLedger || []).length} ledger entries.`
      );
    } catch (error) {
      setFirstError(error instanceof Error ? error.message : 'Failed to import Admin V4 cache JSON.');
      setFirstStatus('');
    }
  };

  const handleOptimizeScouts = async () => {
    const scoutNames = scoutRosterText.split('\n').map(name => name.trim()).filter(Boolean);
    const plan = optimizeScoutAssignments(eventKey, matches, scoutNames, ownTeamNumber);
    setScoutAssignmentPlan(plan);
    await saveScoutAssignmentPlan(plan);
    setScoutOpsStatus(`Built ${plan.assignments.length} scout assignments across ${plan.scoutNames.length} scouts.`);
  };

  const handleExportScoutAssignmentsCsv = () => {
    if (!scoutAssignmentPlan || scoutAssignmentPlan.assignments.length === 0) {
      setScoutOpsStatus('Build a scout assignment plan before exporting.');
      return;
    }

    downloadCsvFile(
      `scout_assignments_${eventKey}_${new Date().toISOString().split('T')[0]}.csv`,
      scoutAssignmentPlan.assignments.map(assignment => ({
        eventKey: scoutAssignmentPlan.eventKey,
        matchType: assignment.matchType,
        matchNumber: assignment.matchNumber,
        matchKey: assignment.matchKey,
        station: assignment.station,
        teamNumber: assignment.teamNumber,
        scoutName: assignment.scoutName,
        priorityReason: assignment.priorityReason
      }))
    );
    setScoutOpsStatus(`Exported ${scoutAssignmentPlan.assignments.length} scout assignments as CSV.`);
  };

  const handleExportScoutCoverageGapsCsv = () => {
    const gaps = scoutAssignmentPlan?.coverageGaps || [];
    if (!scoutAssignmentPlan || gaps.length === 0) {
      setScoutOpsStatus('No scout coverage gaps exist in the current plan.');
      return;
    }

    downloadCsvFile(
      `scout_coverage_gaps_${eventKey}_${new Date().toISOString().split('T')[0]}.csv`,
      gaps.map(gap => ({
        eventKey: scoutAssignmentPlan.eventKey,
        matchType: gap.matchType,
        matchNumber: gap.matchNumber,
        matchKey: gap.matchKey,
        station: gap.station,
        teamNumber: gap.teamNumber,
        reason: gap.reason
      }))
    );
    setScoutOpsStatus(`Exported ${gaps.length} scout coverage gap${gaps.length === 1 ? '' : 's'} as CSV.`);
  };

  const updatePickStatus = (
    teamNumber: string,
    status: AlliancePickRecommendation['status'],
    pickedBy: string = ''
  ) => {
    const nextStatuses = parsePickedStatuses(pickedTeamsText);
    if (status === 'available') {
      delete nextStatuses[teamNumber];
    } else {
      nextStatuses[teamNumber] = { status, pickedBy };
    }
    setPickedTeamsText(
      Object.entries(nextStatuses)
        .map(([team, row]) => [team, row.status, row.pickedBy].filter(Boolean).join(','))
        .join('\n')
    );
  };

  const handleSettlePowerCoins = async (matchKey: string, winner: 'Red' | 'Blue' | 'Tie' | 'Unknown') => {
    await settlePowerCoinBetsForMatch(eventKey, matchKey, winner);
    const [bets, ledger] = await Promise.all([
      listPowerCoinBets(eventKey),
      listPowerCoinLedger(eventKey).catch(() => [])
    ]);
    setPowerCoinBets(bets);
    setPowerCoinLedger(ledger);
    setPowerCoinStatus(`Settled open bets for ${matchKey.toUpperCase()} as ${winner}.`);
  };

  const handleSettleAllPlayedPowerCoins = async () => {
    const openMatchKeys = new Set(powerCoinBets.filter(bet => !bet.settledAt).map(bet => bet.matchKey));
    const playedMatchesWithOpenBets = matches
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

    const [bets, ledger] = await Promise.all([
      listPowerCoinBets(eventKey),
      listPowerCoinLedger(eventKey).catch(() => [])
    ]);
    setPowerCoinBets(bets);
    setPowerCoinLedger(ledger);
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
    const entry: PowerCoinLedgerEntry = {
      id: `${eventKey}_${scoutName.replace(/\s+/g, '_').toLowerCase()}_${createdAt}`,
      eventKey,
      scoutName,
      delta,
      reason: powerCoinAdjustmentReason.trim() || 'Admin adjustment',
      balanceAfter: currentBalance + delta,
      createdAt
    };
    await upsertPowerCoinLedgerEntry(entry);
    const ledger = await listPowerCoinLedger(eventKey).catch(() => []);
    setPowerCoinLedger(ledger);
    setPowerCoinStatus(`${delta > 0 ? 'Added' : 'Removed'} ${Math.abs(delta)} PowerCoin${Math.abs(delta) === 1 ? '' : 's'} ${delta > 0 ? 'to' : 'from'} ${scoutName}.`);
  };

  const tabClass = (tab: StrategyBrainTab) =>
    `rounded-2xl px-4 py-3 text-sm font-black transition ${
      activeTab === tab ? 'bg-cyan-500 text-slate-950' : 'border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800'
    }`;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-3 text-2xl font-black text-white">
              <Brain className="h-7 w-7 text-cyan-300" />
              Strategy Brain
            </h3>
            <p className="mt-2 max-w-4xl text-sm font-semibold text-cyan-100/80">
              V4 evidence, cached APIs, no-future-data model evaluation, defense attribution, match strategy,
              alliance selection, scout assignment optimization, and PowerCoins live in one Admin V4 strategy workspace.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm">
            <div className="font-black text-slate-400">Best Validated Model</div>
            <div className="mt-1 text-xl font-black text-white">{bestModel?.modelName || 'Pending data'}</div>
            <div className="text-xs text-slate-500">PPA uses validated blend when available.</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveTab('foundation')} className={tabClass('foundation')}>Data Foundation</button>
        <button onClick={() => setActiveTab('models')} className={tabClass('models')}>Model Lab</button>
        <button onClick={() => setActiveTab('profiles')} className={tabClass('profiles')}>Team Profiles</button>
        <button onClick={() => setActiveTab('strategy')} className={tabClass('strategy')}>Match Strategy</button>
        <button onClick={() => setActiveTab('alliance')} className={tabClass('alliance')}>Alliance Selection</button>
        <button onClick={() => setActiveTab('scoutOps')} className={tabClass('scoutOps')}>Scout Ops + PowerCoins</button>
      </div>

      {activeTab === 'foundation' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h4 className="flex items-center gap-2 text-xl font-black text-white">
              <Download className="h-5 w-5 text-cyan-300" />
              FIRST Events API Local Credentials
            </h4>
            <p className="mt-2 text-sm text-slate-400">
              Upload a local JSON file with <span className="font-mono text-slate-200">{'{"username":"...","token":"..." }'}</span>.
              It stays in this browser IndexedDB only and is never committed.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black text-white hover:bg-cyan-500">
                <Upload className="h-4 w-4" />
                Upload Credential JSON
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleFirstCredentialUpload} />
              </label>
              <button
                onClick={() => void handleFirstCacheRefresh()}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-500"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh FIRST Cache
              </button>
              <button
                onClick={() => {
                  void clearFirstEventsCredentials().then(() => setFirstCredentials(null));
                }}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-black text-slate-300 hover:bg-slate-800"
              >
                Clear Credentials
              </button>
              <button
                onClick={() => void handleExportAdminV2Cache()}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20"
              >
                <Download className="h-4 w-4" />
                Export Cache JSON
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-500/20">
                <Upload className="h-4 w-4" />
                Import Cache JSON
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportAdminV2Cache} />
              </label>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm">
              <div>Credential status: <span className="font-black text-white">{firstCredentials ? `Saved for ${firstCredentials.username}` : 'Not loaded'}</span></div>
              <div>Cached entries for event: <span className="font-black text-white">{cacheCount}</span></div>
              {firstStatus && <div className="mt-2 font-semibold text-emerald-200">{firstStatus}</div>}
              {firstError && <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-100">{firstError}</pre>}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h4 className="flex items-center gap-2 text-xl font-black text-white">
              <Target className="h-5 w-5 text-fuchsia-300" />
              Source Freshness
            </h4>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <MetricCard label="V4 Rows" value={v4Records.length} />
              <MetricCard label="Legacy V3 Rows" value={v3Records.length} />
              <MetricCard label="Defense V1 Rows" value={defenseRecords.length} />
              <MetricCard label="TBA/FIRST Matches" value={matches.length} />
              <MetricCard
                label="Latest Model Snapshot"
                value={latestModelSnapshot ? new Date(latestModelSnapshot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
              />
              <MetricCard
                label="Feature Snapshot Teams"
                value={latestFeatureSnapshot ? Object.keys(latestFeatureSnapshot.featuresByTeam).length : 0}
              />
              <MetricCard
                label="No-Future Match Snapshots"
                value={latestFeatureSnapshot?.matchSnapshots?.length ?? noFutureFeatureMatchSnapshots.length}
              />
            </div>
            <p className="mt-4 text-sm text-slate-400">
              SSH/LAN transfer is intentionally not the primary path. The reliable backbone is IndexedDB, Firebase,
              QR, JSON archives, local uploaded files, and cached API snapshots.
            </p>
            <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-slate-800">
              <table className="admin-sticky-table min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Source', 'Key', 'Year', 'Saved', 'Payload'].map(header => (
                      <th key={header} className="px-4 py-3 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {[...cacheEntries]
                    .sort((left, right) => right.timestamp - left.timestamp)
                    .map(entry => (
                      <tr key={entry.id}>
                        <td className="px-4 py-3 font-black text-cyan-100">{entry.source}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-300">{entry.key}</td>
                        <td className="px-4 py-3">{entry.year}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{new Date(entry.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {Array.isArray(entry.payload)
                            ? `${entry.payload.length} rows`
                            : entry.payload && typeof entry.payload === 'object'
                              ? `${Object.keys(entry.payload as Record<string, unknown>).length} fields`
                              : typeof entry.payload}
                        </td>
                      </tr>
                    ))}
                  {cacheEntries.length === 0 && (
                    <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={5}>No cached source entries for this event yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'models' && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <h4 className="flex items-center gap-2 text-xl font-black text-white">
            <Trophy className="h-5 w-5 text-yellow-300" />
            Model Lab Backtest Leaderboard
          </h4>
          <p className="mt-2 text-sm text-slate-400">
            PPC and OPR rows are evaluated with only scouting or official-score data available before each played match.
            EPA rows use current Statbotics context until we add historical EPA snapshots.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <MetricCard label="Best No-Future Model" value={bestModel?.modelName || 'Pending'} />
            <MetricCard label="Promotion Candidates" value={`${promotionCandidateCount}/${usableModelCount}`} />
            <MetricCard label="Best Winner Accuracy" value={bestModel ? formatPercent(bestModel.winnerAccuracy) : '—'} />
            <MetricCard label="Brier Score" value={bestModel ? formatNumber(bestModel.brierScore, 3) : '—'} />
          </div>
          <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-50">
            <div className="font-black text-white">PPA rule for now</div>
            <p className="mt-1 text-cyan-100/80">
              PPA is a weighted blend of promotion-eligible no-future models that produce team ratings, with lower score MAE receiving more weight.
              Current EPA can still inform live decisions, but it is not promoted until we cache historical EPA snapshots.
            </p>
            {bestModel && (
              <p className="mt-2 text-cyan-100/80">
                Current promoted model note: {bestModel.uncertaintyNote}
              </p>
            )}
            {latestModelSnapshot && (
              <p className="mt-2 text-cyan-100/80">
                Latest saved snapshot: {new Date(latestModelSnapshot.createdAt).toLocaleString()} · forecast model {latestModelSnapshot.selectedForecastModel}.
              </p>
            )}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-white">No-Future Feature Matrix Preview</div>
                <p className="mt-1 text-xs text-slate-500">
                  Each row shows what the model knew before that played match. No later scouting rows or official scores are included.
                </p>
              </div>
              <div className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-black text-cyan-100">
                {noFutureFeatureMatchSnapshots.length} played quals snapshotted
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="admin-sticky-table min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Match', 'Red Before-Match Features', 'Blue Before-Match Features'].map(header => (
                      <th key={header} className="px-4 py-3 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {noFutureFeatureMatchSnapshots.slice(-12).map(snapshot => (
                    <tr key={snapshot.matchKey}>
                      <td className="px-4 py-3 font-mono font-black text-white">{snapshot.matchKey.toUpperCase()}</td>
                      <td className="px-4 py-3 text-xs text-red-100/80">{formatFeatureTeamList(snapshot.redTeams, snapshot.featuresByTeam)}</td>
                      <td className="px-4 py-3 text-xs text-blue-100/80">{formatFeatureTeamList(snapshot.blueTeams, snapshot.featuresByTeam)}</td>
                    </tr>
                  ))}
                  {noFutureFeatureMatchSnapshots.length === 0 && (
                    <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={3}>No played qualification matches are available for feature snapshots yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="admin-sticky-table min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  {['Model', 'Promote', 'Team Ratings', 'Leakage', 'Source', 'Matches', 'Winner Acc.', 'Avg Conf.', 'Brier', 'Score MAE', 'Margin MAE', 'Margin Cal.', 'Low Conf.'].map(header => (
                    <th key={header} className="px-4 py-3 text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {modelBacktests.map(result => (
                  <tr key={result.modelName}>
                    <td className="px-4 py-3 font-black text-white">{result.modelName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-black ${result.eligibleForPromotion ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>
                        {result.eligibleForPromotion ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{result.supportsTeamRatings ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3">{result.leakageRisk}</td>
                    <td className="px-4 py-3 text-slate-300">{result.sourceLabel}</td>
                    <td className="px-4 py-3">{result.matchesTested}</td>
                    <td className="px-4 py-3">{formatPercent(result.winnerAccuracy)}</td>
                    <td className="px-4 py-3">{formatPercent(result.averageConfidence)}</td>
                    <td className="px-4 py-3">{formatNumber(result.brierScore, 3)}</td>
                    <td className="px-4 py-3">{formatNumber(result.scoreMae)}</td>
                    <td className="px-4 py-3">{formatNumber(result.marginMae)}</td>
                    <td className="px-4 py-3">{formatNumber(result.calibrationError)}</td>
                    <td className="px-4 py-3">{formatPercent(result.lowConfidenceRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-sm font-black text-white">Calibration Bins {bestModel ? `for ${bestModel.modelName}` : ''}</div>
            <p className="mt-1 text-xs text-slate-500">
              A well-calibrated model should have actual win rate close to predicted confidence in each bin.
            </p>
            <div className="mt-3">
              <CalibrationCurveChart bins={calibrationBins} />
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="admin-sticky-table min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Confidence Bin', 'Matches', 'Predicted Win Rate', 'Actual Win Rate', 'Gap'].map(header => (
                      <th key={header} className="px-4 py-3 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {calibrationBins.map(bin => (
                    <tr key={`${bin.modelName}_${bin.binLabel}`}>
                      <td className="px-4 py-3 font-black text-white">{bin.binLabel}</td>
                      <td className="px-4 py-3">{bin.matches}</td>
                      <td className="px-4 py-3">{formatPercent(bin.predictedWinRate)}</td>
                      <td className="px-4 py-3">{formatPercent(bin.actualWinRate)}</td>
                      <td className="px-4 py-3">{formatPercent(bin.calibrationGap)}</td>
                    </tr>
                  ))}
                  {calibrationBins.length === 0 && (
                    <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={5}>No calibration bins yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="text-sm font-black text-white">Scout Calibration</div>
            <p className="mt-1 text-xs text-slate-500">
              Compares V4 alliance scouting totals with official alliance scores. Positive bias means official score was higher than the scout-side share, so the scout may be under-counting.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="admin-sticky-table min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Scout', 'Assigned', 'Rows', 'Matches', 'Bias', 'Avg Error', 'Avg Abs Error', 'Scouted Pts', 'Official Share'].map(header => (
                      <th key={header} className="px-4 py-3 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {scoutCalibrationRows.map(row => (
                    <tr key={`${row.scoutName}_${row.assignedScoutName}`}>
                      <td className="px-4 py-3 font-black text-white">{row.scoutName}</td>
                      <td className="px-4 py-3 text-slate-300">{row.assignedScoutName || '—'}</td>
                      <td className="px-4 py-3">{row.rows}</td>
                      <td className="px-4 py-3">{row.matches}</td>
                      <td className={`px-4 py-3 font-black ${row.biasLabel === 'balanced' ? 'text-emerald-300' : row.biasLabel === 'under-counting' ? 'text-amber-300' : 'text-rose-300'}`}>
                        {row.biasLabel}
                      </td>
                      <td className="px-4 py-3">{formatSigned(row.averageOfficialMinusScout)}</td>
                      <td className="px-4 py-3">{formatNumber(row.averageAbsoluteError)}</td>
                      <td className="px-4 py-3">{formatNumber(row.totalScoutedPoints)}</td>
                      <td className="px-4 py-3">{formatNumber(row.officialSharePoints)}</td>
                    </tr>
                  ))}
                  {scoutCalibrationRows.length === 0 && (
                    <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={9}>No V4 scout calibration rows yet. Needs played matches plus V4 alliance records.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'profiles' && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <h4 className="flex items-center gap-2 text-xl font-black text-white">
            <Users className="h-5 w-5 text-cyan-300" />
            Team Performance Profiles
          </h4>
          <p className="mt-2 text-sm text-slate-400">
            Curves show raw scouted points, rolling form, fitted trend, no-future PPC/OPR movement, and static EPA/PPA context.
            Floor/ceiling use the 20th/80th percentile so one weird match does not dominate the story.
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm font-black text-white">Defense Impact Leaderboard</div>
              <p className="mt-1 text-xs text-slate-500">
                Weighted points denied from scouted defender-target relationships. DPR stays separate because lower DPR is better defense.
              </p>
              <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-800">
                <table className="admin-sticky-table min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      {['Defender', 'Name', 'Weighted Denied', 'Raw Denied', 'Records', 'Confidence', 'Targets', 'Top Target', 'DPR'].map(header => (
                        <th key={header} className="px-4 py-3 text-left">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {defenseImpactRows.map(row => (
                      <tr key={row.teamNumber}>
                        <td className="px-4 py-3">
                          <StrategyTeamBadge teamNumber={row.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} />
                        </td>
                        <td className="px-4 py-3 text-slate-300">{teamNameLookup[row.teamNumber] || ''}</td>
                        <td className="px-4 py-3 font-black text-emerald-300">{formatNumber(row.weightedDenied)}</td>
                        <td className="px-4 py-3">{formatNumber(row.rawDenied)}</td>
                        <td className="px-4 py-3">{row.records}</td>
                        <td className="px-4 py-3">{formatPercent(row.avgConfidence)}</td>
                        <td className="px-4 py-3">{row.targetsAffected}</td>
                        <td className="px-4 py-3 font-mono text-slate-300">{row.topTarget || '—'}</td>
                        <td className="px-4 py-3">{formatNumber(row.dpr)}</td>
                      </tr>
                    ))}
                    {defenseImpactRows.length === 0 && (
                      <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={9}>No defense attribution yet. Needs V4 defender-target records.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <div className="text-sm font-black text-white">Target Suppression Board</div>
              <p className="mt-1 text-xs text-slate-500">
                Shows which offensive teams were held below expected output and which defender most often caused it.
              </p>
              <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-800">
                <table className="admin-sticky-table min-w-full text-sm">
                  <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      {['Target', 'Name', 'Weighted Denied Against', 'Avg Expected', 'Avg Actual', 'Records', 'Defenders', 'Main Defender'].map(header => (
                        <th key={header} className="px-4 py-3 text-left">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {targetSuppressionRows.map(row => (
                      <tr key={row.teamNumber}>
                        <td className="px-4 py-3">
                          <StrategyTeamBadge teamNumber={row.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} />
                        </td>
                        <td className="px-4 py-3 text-slate-300">{teamNameLookup[row.teamNumber] || ''}</td>
                        <td className="px-4 py-3 font-black text-amber-300">{formatNumber(row.deniedAgainst)}</td>
                        <td className="px-4 py-3">{formatNumber(row.avgExpected)}</td>
                        <td className="px-4 py-3">{formatNumber(row.avgActual)}</td>
                        <td className="px-4 py-3">{row.records}</td>
                        <td className="px-4 py-3">{row.defendersSeen}</td>
                        <td className="px-4 py-3 font-mono text-slate-300">{row.mainDefender || '—'}</td>
                      </tr>
                    ))}
                    {targetSuppressionRows.length === 0 && (
                      <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={8}>No suppressed target rows yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="admin-sticky-table min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  {['Team', 'Name', 'Trend Curve', 'Model Curve', 'Normal Curve', 'Matches', 'Peak', 'Floor', 'Ceiling', 'Avg', 'Std Dev', 'Projected', 'Consistency', 'Upset', 'Zero Rate', 'Trend', 'PPA', 'Defense Impact'].map(header => (
                    <th key={header} className="px-4 py-3 text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {teamProfiles.map(profile => (
                  <tr key={profile.teamNumber}>
                    <td className="px-4 py-3">
                      <StrategyTeamBadge teamNumber={profile.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">{teamNameLookup[profile.teamNumber] || ''}</td>
                    <td className="px-4 py-3"><MiniTrendChart profile={profile} /></td>
                    <td className="px-4 py-3"><MiniModelCurveChart profile={profile} /></td>
                    <td className="px-4 py-3"><MiniNormalChart profile={profile} /></td>
                    <td className="px-4 py-3">{profile.matchesPlayed}</td>
                    <td className="px-4 py-3">{formatNumber(profile.peakScore)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.floorScore)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.ceilingScore)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.averageScore)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.standardDeviation)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.projectedNextScore)}</td>
                    <td className="px-4 py-3">{formatPercent(profile.consistencyIndex)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.upsetPotential)}</td>
                    <td className="px-4 py-3">{formatPercent(profile.zeroRate)}</td>
                    <td className={`px-4 py-3 font-black ${profile.recentTrend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatNumber(profile.recentTrend, 3)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.ppa)}</td>
                    <td className="px-4 py-3">{formatNumber(profile.defenseImpact)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'strategy' && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <h4 className="flex items-center gap-2 text-xl font-black text-white">
            <Shield className="h-5 w-5 text-emerald-300" />
            Match Strategy Simulation ({bestModelForecastLayer.modelName})
          </h4>
          <p className="mt-2 text-sm text-slate-400">
            Baseline scores use the best validated forecast layer when available. Upcoming practice, qualification, and playoff matches are included when teams are known. The selected sidebar model still supplies
            fallback team ratings and defense attribution context. Source: {bestModelForecastLayer.modelSource}.
          </p>
          <div className="mt-4 grid gap-3">
            {strategyPlans.map(plan => (
              <div key={plan.matchKey} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-lg font-black text-white">{plan.matchKey.toUpperCase()}</div>
                    <div className="mt-1 text-xs font-black uppercase tracking-wider text-slate-500">{plan.compLevel}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-black text-cyan-100">{plan.modelName}</div>
                    {plan.modelLowConfidence && <div className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-100">Low Confidence</div>}
                    <div className={`rounded-full px-3 py-1 text-xs font-black ${plan.predictedWinner === 'Red' ? 'bg-red-500/15 text-red-200' : plan.predictedWinner === 'Blue' ? 'bg-blue-500/15 text-blue-200' : 'bg-slate-700 text-slate-200'}`}>
                      {plan.predictedWinner}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-red-500/10 p-3">
                    <div className="font-black text-red-100">Red {formatNumber(plan.optimizedRedScore)} <span className="text-xs text-red-100/50">base {formatNumber(plan.baselineRedScore)}</span></div>
                    <StrategyTeamBadgeList teams={plan.redTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} />
                    <div className="mt-2 text-xs text-red-100/70">{plan.bestRedPlan} · swing {formatSigned(plan.redDefenseSwing)}</div>
                    <RoleOptionList options={plan.redRoleOptions} accentClass="text-red-100" />
                  </div>
                  <div className="rounded-xl bg-blue-500/10 p-3">
                    <div className="font-black text-blue-100">Blue {formatNumber(plan.optimizedBlueScore)} <span className="text-xs text-blue-100/50">base {formatNumber(plan.baselineBlueScore)}</span></div>
                    <StrategyTeamBadgeList teams={plan.blueTeams} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} />
                    <div className="mt-2 text-xs text-blue-100/70">{plan.bestBluePlan} · swing {formatSigned(plan.blueDefenseSwing)}</div>
                    <RoleOptionList options={plan.blueRoleOptions} accentClass="text-blue-100" />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <RpPathCard rpPath={plan.redRpPath} accentClass="border-red-500/20 bg-red-500/10 text-red-100" />
                  <RpPathCard rpPath={plan.blueRpPath} accentClass="border-blue-500/20 bg-blue-500/10 text-blue-100" />
                </div>
                <div className="mt-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-3 text-sm font-semibold text-fuchsia-100">
                  <span className="font-black">Opponent counter-strategy:</span> {plan.opponentCounterStrategy}
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-300">{plan.winCondition}</div>
                {plan.riskFlags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {plan.riskFlags.map(flag => (
                      <span key={flag} className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-100">{flag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {strategyPlans.length === 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-100">
                <AlertTriangle className="mr-2 inline h-5 w-5" />
                No upcoming matches with known teams are available yet.
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'alliance' && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <h4 className="flex items-center gap-2 text-xl font-black text-white">
            <Target className="h-5 w-5 text-fuchsia-300" />
            Seed-Aware Alliance Selection
          </h4>
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">Alliance Seed</span>
                <input type="number" min={1} max={8} value={allianceSeed} onChange={event => setAllianceSeed(Math.max(1, Math.min(8, Number(event.target.value))))} className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono font-black text-white outline-none focus:border-fuchsia-400" />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">Picked Teams CSV</span>
                <textarea
                  value={pickedTeamsText}
                  onChange={event => setPickedTeamsText(event.target.value)}
                  rows={10}
                  placeholder="1114,picked,A1&#10;2056,declined&#10;254,unavailable"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-400"
                />
              </label>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="admin-sticky-table min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Team', 'Name', 'Score', 'Seed Fit', 'Role Fit', 'Status', 'Actions', 'Rationale'].map(header => (
                      <th key={header} className="px-4 py-3 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {allianceRecommendations.map(row => (
                    <tr key={row.teamNumber} className={row.status === 'available' ? '' : 'opacity-50'}>
                      <td className="px-4 py-3">
                        <StrategyTeamBadge teamNumber={row.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} />
                      </td>
                      <td className="px-4 py-3 text-slate-300">{teamNameLookup[row.teamNumber] || ''}</td>
                      <td className="px-4 py-3">{formatNumber(row.score)}</td>
                      <td className="px-4 py-3">{row.seedFit}</td>
                      <td className="px-4 py-3">{row.roleFit}</td>
                      <td className="px-4 py-3">{row.status}{row.pickedBy ? ` by ${row.pickedBy}` : ''}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => updatePickStatus(row.teamNumber, 'picked', `A${allianceSeed}`)}
                            className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-black text-white hover:bg-emerald-500"
                          >
                            Picked
                          </button>
                          <button
                            type="button"
                            onClick={() => updatePickStatus(row.teamNumber, 'declined')}
                            className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-black text-white hover:bg-amber-500"
                          >
                            Declined
                          </button>
                          <button
                            type="button"
                            onClick={() => updatePickStatus(row.teamNumber, 'unavailable')}
                            className="rounded-lg bg-rose-700 px-2 py-1 text-xs font-black text-white hover:bg-rose-600"
                          >
                            Out
                          </button>
                          {row.status !== 'available' && (
                            <button
                              type="button"
                              onClick={() => updatePickStatus(row.teamNumber, 'available')}
                              className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-black text-slate-200 hover:bg-slate-700"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{row.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'scoutOps' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h4 className="flex items-center gap-2 text-xl font-black text-white">
              <Users className="h-5 w-5 text-cyan-300" />
              Scout Assignment Optimizer
            </h4>
            <textarea
              value={scoutRosterText}
              onChange={event => setScoutRosterText(event.target.value)}
              rows={8}
              className="mt-4 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void handleOptimizeScouts()} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black text-white hover:bg-cyan-500">
                Optimize Scout Assignments
              </button>
              <button
                type="button"
                onClick={handleExportScoutAssignmentsCsv}
                className="inline-flex items-center gap-2 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20"
              >
                <Download className="h-4 w-4" />
                Export Assignment CSV
              </button>
              <button
                type="button"
                onClick={handleExportScoutCoverageGapsCsv}
                className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100 hover:bg-amber-500/20"
              >
                <Download className="h-4 w-4" />
                Export Gap CSV
              </button>
            </div>
            {scoutOpsStatus && (
              <div className="mt-3 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-100">
                {scoutOpsStatus}
              </div>
            )}
            {scoutAssignmentPlan && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-5">
                  <MetricCard label="Assignments" value={scoutAssignmentPlan.assignments.length} />
                  <MetricCard label="Scouts" value={scoutAssignmentPlan.scoutCount} />
                  <MetricCard label="Avg Load" value={formatNumber(scoutAssignmentPlan.assignments.length / Math.max(1, scoutAssignmentPlan.scoutCount), 1)} />
                  <MetricCard label="Our Match Slots" value={scoutAssignmentPlan.assignments.filter(assignment => assignment.priorityReason === 'Our match priority').length} />
                  <MetricCard label="Coverage Gaps" value={scoutAssignmentPlan.coverageGaps?.length || 0} />
                </div>
                {(scoutAssignmentPlan.coverageGaps?.length || 0) > 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <div className="text-sm font-black text-amber-100">Coverage gaps</div>
                    <p className="mt-1 text-xs text-amber-100/70">
                      These stations are not assigned in the optimizer output. Use this before the match starts so no one assumes a full six-slot crew exists.
                    </p>
                    <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-amber-300/20">
                      <table className="admin-sticky-table min-w-full text-sm">
                        <thead className="sticky top-0 bg-amber-950 text-xs uppercase tracking-wider text-amber-100">
                          <tr>
                            {['Match', 'Station', 'Team', 'Reason'].map(header => <th key={header} className="px-4 py-3 text-left">{header}</th>)}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-300/10">
                          {scoutAssignmentPlan.coverageGaps?.map((gap, index) => (
                            <tr key={`${gap.matchKey}_${gap.station}_${index}`}>
                              <td className="px-4 py-3 font-mono font-black text-amber-50">{gap.matchKey.toUpperCase()}</td>
                              <td className="px-4 py-3 text-amber-100">{gap.station}</td>
                              <td className="px-4 py-3 text-amber-100">
                                <StrategyTeamBadge teamNumber={gap.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} />
                              </td>
                              <td className="px-4 py-3 text-amber-100/80">{gap.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-800">
                  <table className="admin-sticky-table min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                      <tr>
                        {['Scout', 'Assignments', 'Distinct Teams', 'Repeat Focus', 'Our Match Slots', 'Top Team Exposures'].map(header => <th key={header} className="px-4 py-3 text-left">{header}</th>)}
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
                                  <span key={`${row.scoutName}_${exposure.teamNumber}`} className="inline-flex items-center gap-1 rounded-xl bg-slate-950 px-1.5 py-1">
                                    <StrategyTeamBadge teamNumber={exposure.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} />
                                    <span className="pr-1 text-xs font-black text-slate-400">x{exposure.count}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-800">
                  <table className="admin-sticky-table min-w-full text-sm">
                    <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                      <tr>
                        {['Match', 'Station', 'Team', 'Scout', 'Reason'].map(header => <th key={header} className="px-4 py-3 text-left">{header}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {scoutAssignmentPlan.assignments.map((assignment, index) => (
                        <tr key={`${assignment.matchKey}_${assignment.station}_${index}`}>
                          <td className="px-4 py-3 font-mono text-white">{assignment.matchKey.toUpperCase()}</td>
                          <td className="px-4 py-3">{assignment.station}</td>
                          <td className="px-4 py-3">
                            <StrategyTeamBadge teamNumber={assignment.teamNumber} ownTeamNumber={ownTeamNumber} searchedTeamNumber={searchedTeamNumber} />
                          </td>
                          <td className="px-4 py-3 font-black text-cyan-200">{assignment.scoutName}</td>
                          <td className="px-4 py-3 text-slate-400">{assignment.priorityReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h4 className="flex items-center gap-2 text-xl font-black text-white">
              <Coins className="h-5 w-5 text-yellow-300" />
              PowerCoins
            </h4>
            <p className="mt-2 text-sm text-slate-400">Bets start from 1000 coins per scout per event. Settlement is pari-mutuel.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleSettleAllPlayedPowerCoins()}
                className="inline-flex items-center gap-2 rounded-2xl bg-yellow-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-yellow-400"
              >
                <RefreshCw className="h-4 w-4" />
                Settle All Played Matches
              </button>
              <span className="text-xs font-semibold text-slate-500">
                Uses official TBA/FIRST match scores already loaded for this event.
              </span>
            </div>
            <div className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4">
              <div className="text-sm font-black text-yellow-100">Admin PowerCoin Adjustment</div>
              <p className="mt-1 text-xs text-yellow-100/70">
                Use this for quality-scouting bonuses, cleanup penalties, or judge-demo rewards. It writes a ledger entry, not an invisible balance edit.
              </p>
              <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_120px_1.4fr_auto]">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wider text-yellow-100/70">Scout</span>
                  <input
                    type="text"
                    list="powercoin-adjustment-scouts"
                    value={powerCoinAdjustmentScout}
                    onChange={event => setPowerCoinAdjustmentScout(event.target.value)}
                    className="w-full rounded-xl border border-yellow-400/30 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-300"
                    placeholder="Scout name"
                  />
                  <datalist id="powercoin-adjustment-scouts">
                    {powerCoinRows.map(row => <option key={row.scoutName} value={row.scoutName} />)}
                  </datalist>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wider text-yellow-100/70">Delta</span>
                  <input
                    type="number"
                    value={powerCoinAdjustmentAmount}
                    onChange={event => setPowerCoinAdjustmentAmount(Number(event.target.value))}
                    className="w-full rounded-xl border border-yellow-400/30 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-300"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wider text-yellow-100/70">Reason</span>
                  <input
                    type="text"
                    value={powerCoinAdjustmentReason}
                    onChange={event => setPowerCoinAdjustmentReason(event.target.value)}
                    className="w-full rounded-xl border border-yellow-400/30 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-300"
                    placeholder="Quality scouting bonus"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handlePowerCoinAdjustment()}
                  className="self-end rounded-xl bg-yellow-500 px-4 py-2 text-sm font-black text-slate-950 hover:bg-yellow-400"
                >
                  Apply
                </button>
              </div>
            </div>
            {powerCoinStatus && (
              <div className="mt-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-semibold text-yellow-100">
                {powerCoinStatus}
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Tracked Scouts" value={powerCoinRows.length} />
              <MetricCard label="Open Bets" value={powerCoinBets.filter(bet => !bet.settledAt).length} />
              <MetricCard label="Open Stake" value={powerCoinBets.filter(bet => !bet.settledAt).reduce((sum, bet) => sum + bet.amount, 0)} />
            </div>
            {powerCoinRows.length > 0 && (
              <div className="mt-4 rounded-2xl border border-yellow-400/20 bg-slate-950 p-4">
                <div className="text-sm font-black text-white">Prize Podium</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {powerCoinRows.slice(0, 3).map((row, index) => (
                    <div key={row.scoutName} className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2">
                      <div className="text-xs font-black uppercase tracking-widest text-yellow-100/70">#{index + 1}</div>
                      <div className="mt-1 font-black text-yellow-100">{row.scoutName}</div>
                      <div className="text-sm font-semibold text-yellow-100/70">{formatNumber(row.balance, 0)} coins</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-slate-800">
              <table className="admin-sticky-table min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Rank', 'Scout', 'Balance', 'Open Bets', 'Open Stake', 'Settled', 'Total Staked', 'Total Payout'].map(header => <th key={header} className="px-4 py-3 text-left">{header}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {powerCoinRows.map((row, index) => (
                    <tr key={row.scoutName}>
                      <td className="px-4 py-3 font-mono font-black text-yellow-200">#{index + 1}</td>
                      <td className="px-4 py-3 font-black text-white">{row.scoutName}</td>
                      <td className="px-4 py-3 font-black text-yellow-200">{formatNumber(row.balance, 0)}</td>
                      <td className="px-4 py-3">{row.openBets}</td>
                      <td className="px-4 py-3">{formatNumber(row.openStake, 0)}</td>
                      <td className="px-4 py-3">{row.settledBets}</td>
                      <td className="px-4 py-3">{formatNumber(row.totalStaked, 0)}</td>
                      <td className="px-4 py-3">{formatNumber(row.totalPayout, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-slate-800">
              <table className="admin-sticky-table min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    {['Scout', 'Match', 'Side', 'Stake', 'Outcome', 'Payout', 'Actions'].map(header => <th key={header} className="px-4 py-3 text-left">{header}</th>)}
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
                      <td className="px-4 py-3">{formatNumber(bet.payout)}</td>
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
                  {powerCoinBets.length === 0 && (
                    <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No PowerCoin bets yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="text-xs font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function RoleOptionList({ options, accentClass }: { options: StrategyRoleOption[]; accentClass: string }) {
  return (
    <div className="mt-3 space-y-1">
      {options.slice(0, 4).map(option => (
        <div
          key={`${option.alliance}_${option.label}`}
          className={`grid grid-cols-[1fr_auto] gap-2 rounded-lg px-2 py-1 text-[11px] ${
            option.recommended ? 'bg-white/10 font-black' : 'bg-slate-950/50'
          }`}
        >
          <span className={accentClass}>
            {option.recommended ? 'Best: ' : ''}
            {option.label}
          </span>
          <span className="font-mono text-slate-200">
            {formatSigned(option.netMargin, 1)}
          </span>
          <span className="col-span-2 text-slate-400">
            score {formatNumber(option.ownScore, 1)} · opp {formatNumber(option.opponentScore, 1)} · lost {formatNumber(option.offenseCost, 1)} · denied {formatNumber(option.defenseValue, 1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function RpPathCard({ rpPath, accentClass }: { rpPath: StrategyAllianceRpPath; accentClass: string }) {
  return (
    <div className={`rounded-xl border p-3 ${accentClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="font-black">{rpPath.alliance} RP Path</div>
        <div className="rounded-full bg-white/15 px-3 py-1 text-xs font-black">{rpPath.projectedRp} RP</div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[11px]">
        <div className="rounded-lg bg-slate-950/50 px-2 py-2">
          <div className="font-black">{rpPath.winRp}</div>
          <div className="text-slate-400">Win</div>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-2 py-2">
          <div className="font-black">{rpPath.towerRp}</div>
          <div className="text-slate-400">Tower</div>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-2 py-2">
          <div className="font-black">{rpPath.energizedRp}</div>
          <div className="text-slate-400">Energy</div>
        </div>
        <div className="rounded-lg bg-slate-950/50 px-2 py-2">
          <div className="font-black">{rpPath.superchargedRp}</div>
          <div className="text-slate-400">Super</div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-slate-300">
        Tower metric {formatNumber(rpPath.towerMetric, 1)} · fuel metric {formatNumber(rpPath.fuelMetric, 1)}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">{rpPath.note}</div>
      {rpPath.missingComponentTeams.length > 0 && (
        <div className="mt-2 text-[11px] font-black text-amber-200">
          Missing components: {rpPath.missingComponentTeams.join(', ')}
        </div>
      )}
    </div>
  );
}

function CalibrationCurveChart({ bins }: { bins: ModelCalibrationBin[] }) {
  const width = 360;
  const height = 150;
  const padding = 24;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const xFor = (value: number) => padding + (Math.max(0.5, Math.min(0.95, value)) - 0.5) / 0.45 * plotWidth;
  const yFor = (value: number) => height - padding - Math.max(0, Math.min(1, value)) * plotHeight;
  const points = bins.map(bin => ({
    x: xFor(bin.predictedWinRate || (bin.minConfidence + bin.maxConfidence) / 2),
    y: yFor(bin.actualWinRate),
    label: bin.binLabel,
    matches: bin.matches
  }));
  const actualPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const perfectPath = `M${xFor(0.5).toFixed(1)},${yFor(0.5).toFixed(1)} L${xFor(0.95).toFixed(1)},${yFor(0.95).toFixed(1)}`;

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="rgb(51 65 85)" />
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="rgb(51 65 85)" />
        <path d={perfectPath} fill="none" stroke="rgb(148 163 184)" strokeWidth="1.5" strokeDasharray="5 5" />
        {actualPath && <path d={actualPath} fill="none" stroke="rgb(34 211 238)" strokeWidth="3" />}
        {points.map(point => (
          <g key={point.label}>
            <circle cx={point.x} cy={point.y} r="4" fill="rgb(34 211 238)" />
            <text x={point.x + 6} y={point.y - 5} fill="rgb(203 213 225)" fontSize="9">{point.matches}</text>
          </g>
        ))}
        <text x={padding} y="14" fill="rgb(148 163 184)" fontSize="10">Actual win rate</text>
        <text x={width - 94} y={height - 6} fill="rgb(148 163 184)" fontSize="10">Predicted confidence</text>
        <text x={xFor(0.52)} y={yFor(0.52) - 7} fill="rgb(148 163 184)" fontSize="9">perfect</text>
        <text x={padding} y={height - 8} fill="rgb(148 163 184)" fontSize="9">50%</text>
        <text x={width - padding - 20} y={height - 8} fill="rgb(148 163 184)" fontSize="9">95%</text>
      </svg>
      {bins.length === 0 && (
        <div className="text-center text-xs font-semibold text-slate-500">No calibration bins yet.</div>
      )}
    </div>
  );
}

function MiniTrendChart({ profile }: { profile: TeamPerformanceProfile }) {
  const points = profile.curve;
  if (points.length === 0) {
    return <div className="h-12 w-32 rounded-xl border border-slate-800 bg-slate-950" />;
  }

  const width = 128;
  const height = 48;
  const minMatch = Math.min(...points.map(point => point.matchNumber));
  const maxMatch = Math.max(...points.map(point => point.matchNumber));
  const maxValue = Math.max(
    1,
    ...points.flatMap(point => [point.score, point.rollingAverage, point.fittedScore, point.upperBand])
  );
  const xFor = (matchNumber: number) =>
    maxMatch === minMatch ? width / 2 : ((matchNumber - minMatch) / (maxMatch - minMatch)) * (width - 8) + 4;
  const yFor = (value: number) => height - 4 - (Math.max(0, value) / maxValue) * (height - 8);
  const pathFor = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? 'M' : 'L'}${xFor(points[index].matchNumber).toFixed(1)},${yFor(value).toFixed(1)}`).join(' ');
  const bandPath = [
    ...points.map(point => `${xFor(point.matchNumber).toFixed(1)},${yFor(point.upperBand).toFixed(1)}`),
    ...[...points].reverse().map(point => `${xFor(point.matchNumber).toFixed(1)},${yFor(point.lowerBand).toFixed(1)}`)
  ].join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-32 rounded-xl bg-slate-950">
      <polygon points={bandPath} fill="rgba(34, 211, 238, 0.14)" />
      <path d={pathFor(points.map(point => point.fittedScore))} fill="none" stroke="rgb(34 211 238)" strokeWidth="2" />
      <path d={pathFor(points.map(point => point.rollingAverage))} fill="none" stroke="rgb(250 204 21)" strokeWidth="1.5" strokeDasharray="3 3" />
      {points.map(point => (
        <circle key={`${point.matchKey}_${point.matchNumber}`} cx={xFor(point.matchNumber)} cy={yFor(point.score)} r="2.4" fill="rgb(248 250 252)" />
      ))}
    </svg>
  );
}

function MiniNormalChart({ profile }: { profile: TeamPerformanceProfile }) {
  const width = 128;
  const height = 48;
  const sigma = Math.max(0.1, profile.standardDeviation);
  const start = Math.max(0, profile.averageScore - sigma * 3);
  const end = profile.averageScore + sigma * 3;
  const values = Array.from({ length: 33 }, (_, index) => {
    const x = start + ((end - start) * index) / 32;
    const z = (x - profile.averageScore) / sigma;
    const density = Math.exp(-0.5 * z * z);
    return { x, density };
  });
  const yFor = (density: number) => height - 4 - density * (height - 10);
  const path = values
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${(4 + index * ((width - 8) / 32)).toFixed(1)},${yFor(point.density).toFixed(1)}`)
    .join(' ');
  const meanX = 4 + ((profile.averageScore - start) / Math.max(1, end - start)) * (width - 8);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-32 rounded-xl bg-slate-950">
      <path d={`${path} L${width - 4},${height - 4} L4,${height - 4} Z`} fill="rgba(250, 204, 21, 0.14)" />
      <path d={path} fill="none" stroke="rgb(250 204 21)" strokeWidth="2" />
      <line x1={meanX} x2={meanX} y1="6" y2={height - 4} stroke="rgb(248 250 252)" strokeWidth="1" strokeDasharray="3 3" />
      <text x="7" y={height - 7} fill="rgb(148 163 184)" fontSize="8">{formatNumber(profile.normalLowScore, 0)}</text>
      <text x={width - 24} y={height - 7} fill="rgb(148 163 184)" fontSize="8">{formatNumber(profile.normalHighScore, 0)}</text>
    </svg>
  );
}

function MiniModelCurveChart({ profile }: { profile: TeamPerformanceProfile }) {
  const points = profile.modelCurve;
  if (points.length === 0) {
    return <div className="h-12 w-36 rounded-xl border border-slate-800 bg-slate-950" />;
  }

  const width = 144;
  const height = 48;
  const minMatch = Math.min(...points.map(point => point.matchNumber));
  const maxMatch = Math.max(...points.map(point => point.matchNumber));
  const values = points.flatMap(point => [
    point.ppcBefore,
    point.rollingPpcBefore,
    point.oprBefore,
    point.rollingOprBefore,
    point.epa ?? 0,
    point.ppa ?? 0
  ]);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(1, ...values);
  const xFor = (matchNumber: number) =>
    maxMatch === minMatch ? width / 2 : ((matchNumber - minMatch) / (maxMatch - minMatch)) * (width - 8) + 4;
  const yFor = (value: number) => {
    const range = Math.max(1, maxValue - minValue);
    return height - 4 - ((value - minValue) / range) * (height - 8);
  };
  const pathFor = (accessor: (point: TeamPerformanceProfile['modelCurve'][number]) => number | null) => {
    const validPoints = points
      .map(point => ({ point, value: accessor(point) }))
      .filter((item): item is { point: TeamPerformanceProfile['modelCurve'][number]; value: number } => item.value != null && Number.isFinite(item.value));
    return validPoints
      .map((item, index) => `${index === 0 ? 'M' : 'L'}${xFor(item.point.matchNumber).toFixed(1)},${yFor(item.value).toFixed(1)}`)
      .join(' ');
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-36 rounded-xl bg-slate-950">
      <path d={pathFor(point => point.ppcBefore)} fill="none" stroke="rgb(34 211 238)" strokeWidth="1.8" />
      <path d={pathFor(point => point.oprBefore)} fill="none" stroke="rgb(250 204 21)" strokeWidth="1.8" />
      <path d={pathFor(point => point.rollingOprBefore)} fill="none" stroke="rgb(248 113 113)" strokeWidth="1.2" strokeDasharray="3 3" />
      <path d={pathFor(point => point.epa)} fill="none" stroke="rgb(168 85 247)" strokeWidth="1.2" strokeDasharray="2 4" />
      <path d={pathFor(point => point.ppa)} fill="none" stroke="rgb(74 222 128)" strokeWidth="1.2" strokeDasharray="5 3" />
      <text x="6" y="10" fill="rgb(34 211 238)" fontSize="7">PPC</text>
      <text x="32" y="10" fill="rgb(250 204 21)" fontSize="7">OPR</text>
      <text x="58" y="10" fill="rgb(168 85 247)" fontSize="7">EPA</text>
      <text x="84" y="10" fill="rgb(74 222 128)" fontSize="7">PPA</text>
    </svg>
  );
}
