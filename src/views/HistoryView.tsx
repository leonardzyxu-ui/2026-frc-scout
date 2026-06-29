import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BarChart3, Clock3, Coins, Database, Download, Edit3, RefreshCw, Trash2, Trophy, UploadCloud, Wrench, X } from 'lucide-react';
import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, MatchScoutingV4, PitScoutingV2, PowerCoinBet, PowerCoinLedgerEntry, ScoutEvidenceAdminTask } from '../types';
import { DEFAULT_EVENT_KEY, getStoredEventKey, storeEventKey } from '../utils/sharedEventState';
import {
  buildScoutArchiveBundle,
  getScoutArchiveIdentity,
  listScoutArchiveRecords,
  ScoutArchiveRecord,
  setScoutArchiveUsername,
  tombstoneScoutArchiveRecord
} from '../utils/scoutArchive';
import { isMatchScoutingV3, mapLegacyMatchScoutingToV3 } from '../utils/matchScoutingV3';
import { isMatchDefenseScoutingV1 } from '../utils/matchDefenseScouting';
import { syncScoutArchiveRecordToFirebase } from '../utils/scoutArchiveSync';
import ScoutUsernameGate from '../components/ScoutUsernameGate';
import { normalizeEventKey } from '../utils/keys';
import { SCOUTING_MISSIONS, SCOUTING_USE_MOMENTS, ScoutingMissionKey, getMissionToneClasses } from '../utils/scoutingWorkflow';
import {
  describeScoutEvidenceAdminTaskDecisionUse,
  formatScoutEvidenceAdminTaskMission,
  formatScoutEvidenceAdminTaskPpaRange,
  getScoutEvidenceAdminTaskFromPayload
} from '../utils/scoutTaskHandoff';
import { getCachedPreMatchSheet, PreScoutAdminTaskEvidence } from '../utils/preMatchCache';
import { listPowerCoinBets, listPowerCoinLedger } from '../utils/adminV4LocalStore';
import {
  buildPowerCoinLeaderboard,
  computePowerCoinWallet,
  getPowerCoinBetBalanceDelta,
  powerCoinIdentityMatches,
  STARTING_POWERCOIN_BALANCE
} from '../utils/scoutPowerCoins';

interface PreScoutHistoryRow {
  recordId: string;
  logicalId: string;
  recordType: 'preScout';
  eventKey: string;
  username: string;
  deviceId: string;
  updatedAt: number;
  deleted: false;
  source: 'pre_scout_cache';
  syncStatus: 'synced';
  payload: PreScoutAdminTaskEvidence;
}

type HistoryRow = ScoutArchiveRecord | PreScoutHistoryRow;
type HistoryFilter = 'all' | 'preScout' | 'match' | 'defense' | 'pit' | 'unsynced';

const toMatchPayloadV3 = (payload: MatchScoutingV2 | MatchScoutingV3) =>
  isMatchScoutingV3(payload) ? payload : mapLegacyMatchScoutingToV3(payload);

const toDefensePayloadV1 = (payload: MatchDefenseScoutingV1) =>
  isMatchDefenseScoutingV1(payload) ? payload : null;

function getMatchNumber(matchKey: string) {
  const match = matchKey.match(/(\d+)/);
  return match ? parseInt(match[1] ?? `${Number.MAX_SAFE_INTEGER}`, 10) : Number.MAX_SAFE_INTEGER;
}

const formatRecordTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleString() : 'No timestamp';

const formatPowerCoinDelta = (value: number) => value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`;

const getRecordTeamNumber = (record: HistoryRow) => {
  if (record.recordType === 'preScout') return record.payload.teamNumber;
  if (record.recordType === 'matchV4') return (record.payload as MatchScoutingV4).teamNumber;
  if (record.recordType === 'match') return toMatchPayloadV3(record.payload as MatchScoutingV2 | MatchScoutingV3).teamNumber;
  if (record.recordType === 'matchDefense') return (record.payload as MatchDefenseScoutingV1).teamNumber;
  return (record.payload as PitScoutingV2).teamNumber;
};

const getRecordMatchKey = (record: HistoryRow) => {
  if (record.recordType === 'preScout') return '';
  if (record.recordType === 'matchV4') return (record.payload as MatchScoutingV4).matchKey;
  if (record.recordType === 'match') return toMatchPayloadV3(record.payload as MatchScoutingV2 | MatchScoutingV3).matchKey;
  if (record.recordType === 'matchDefense') return (record.payload as MatchDefenseScoutingV1).matchKey;
  return '';
};

const getRecordAdminTask = (record: HistoryRow) =>
  record.recordType === 'preScout'
    ? record.payload.task
    : getScoutEvidenceAdminTaskFromPayload(record.payload);

const isArchiveHistoryRow = (record: HistoryRow): record is ScoutArchiveRecord => record.recordType !== 'preScout';

const getMatchV4Version = (record: Pick<ScoutArchiveRecord, 'recordType' | 'payload'>) =>
  record.recordType === 'matchV4'
    ? Math.max(1, Number((record.payload as MatchScoutingV4).versionMetadata?.version || 1))
    : 1;

const isMatchV4CurrentVersionSubmitted = (record: Pick<ScoutArchiveRecord, 'recordType' | 'payload' | 'syncStatus'>) =>
  record.recordType === 'matchV4'
    ? !!(record.payload as MatchScoutingV4).versionMetadata?.currentVersionSubmitted || record.syncStatus === 'synced'
    : record.syncStatus === 'synced';

const getNonNewestMatchV4Records = (records: ScoutArchiveRecord[]) => {
  const latestByLogicalId = new Map<string, number>();
  records
    .filter((record): record is Extract<ScoutArchiveRecord, { recordType: 'matchV4' }> => record.recordType === 'matchV4')
    .forEach(record => {
      const version = getMatchV4Version(record);
      latestByLogicalId.set(record.logicalId, Math.max(latestByLogicalId.get(record.logicalId) || 1, version));
    });

  return records
    .filter((record): record is Extract<ScoutArchiveRecord, { recordType: 'matchV4' }> => record.recordType === 'matchV4')
    .filter(record => getMatchV4Version(record) < (latestByLogicalId.get(record.logicalId) || 1))
    .sort((left, right) => left.logicalId.localeCompare(right.logicalId) || getMatchV4Version(left) - getMatchV4Version(right));
};

const getEvidenceMeta = (record: HistoryRow): {
  missionKey: ScoutingMissionKey;
  title: string;
  decisionUse: string;
  ppaSignal: string;
  value: string;
  tags: string[];
  toneClass: string;
} => {
  if (record.recordType === 'preScout') {
    const payload = record.payload;
    const gapCount = payload.missingFromTba.length + payload.manualRequired.length;
    return {
      missionKey: 'preScout',
      title: payload.profileAvailable ? 'Pre Scout public context' : 'Pre Scout missing-context evidence',
      decisionUse: 'Feeds pit priority, early model guardrails, and the Data source freshness/coverage loop.',
      ppaSignal: 'Public-only context and missing-data warnings before local scouting rows exist.',
      value: gapCount > 0 ? `${gapCount} gap${gapCount === 1 ? '' : 's'}` : 'Verified',
      tags: [
        payload.profileAvailable ? 'profile found' : 'profile missing',
        payload.qualificationStatus || 'status unknown',
        ...payload.missingFromTba.slice(0, 2),
        ...payload.manualRequired.slice(0, 2)
      ].filter(Boolean),
      toneClass: getMissionToneClasses('violet')
    };
  }

  if (record.recordType === 'matchV4') {
    const payload = record.payload as MatchScoutingV4;
    const currentVersionSubmitted = isMatchV4CurrentVersionSubmitted(record);
    return {
      missionKey: 'matchScout',
      title: 'Match evidence',
      decisionUse: 'Feeds Now, Matches, Pick List, Visualize, and Reports.',
      ppaSignal: 'Expected value, floor risk, role fit, volatility, and scout confidence.',
      value: `${payload.totalMatchPoints} pts`,
      tags: [
        `v${payload.versionMetadata?.version || 1}`,
        currentVersionSubmitted ? 'submitted to head scout' : 'local only',
        payload.rolePlayed || 'role unknown',
        `${payload.autoPoints} auto`,
        `${payload.teleopPoints} teleop`,
        `${payload.endgamePoints} endgame`,
        `reliability ${payload.reliabilityScore}/10`
      ],
      toneClass: getMissionToneClasses('cyan')
    };
  }

  if (record.recordType === 'match') {
    const payload = toMatchPayloadV3(record.payload as MatchScoutingV2 | MatchScoutingV3);
    return {
      missionKey: 'matchScout',
      title: payload.legacyDerived ? 'Legacy match evidence' : 'Match evidence',
      decisionUse: 'Readable evidence for team profiles, raw audit, and historical context.',
      ppaSignal: 'Older scoring context; useful, but weaker than V4 role/reliability rows.',
      value: `${payload.totalMatchPoints} pts`,
      tags: [
        `${payload.autoPoints} auto`,
        `${payload.teleopPoints} teleop`,
        payload.climbLevel ? `${payload.climbLevel} climb` : 'no climb label',
        payload.legacyDerived ? 'legacy import' : 'v3'
      ],
      toneClass: getMissionToneClasses('cyan')
    };
  }

  if (record.recordType === 'matchDefense') {
    const payload = toDefensePayloadV1(record.payload as MatchDefenseScoutingV1);
    return {
      missionKey: 'defenseScout',
      title: 'Defense impact evidence',
      decisionUse: 'Feeds next-match role plans, defender assignment, and pick-list role balance.',
      ppaSignal: 'Prevents the model from treating strategic sacrifice as weak scoring.',
      value: `${(((payload?.defenseMetric || 0) * 100)).toFixed(1)}%`,
      tags: [
        'defense impact',
        payload?.alliance || 'no alliance',
        payload?.assignedSlot || 'no slot'
      ],
      toneClass: getMissionToneClasses('rose')
    };
  }

  const payload = record.payload as PitScoutingV2;
  const climbTags = [
    payload.canClimbL1 ? 'L1 climb' : '',
    payload.canClimbL2 ? 'L2 climb' : '',
    payload.canClimbL3 ? 'L3 climb' : ''
  ].filter(Boolean);
  return {
    missionKey: 'pitScout',
    title: 'Pit capability prior',
    decisionUse: 'Feeds pre-match questions, compatibility, and early pick-list context.',
    ppaSignal: 'Human prior for role fit before enough match rows exist.',
    value: `${payload.expectedHubBallsPerMatch || 0} expected balls`,
    tags: [
      payload.robotBaseType || 'base unknown',
      payload.shootingStyle || 'shooting unknown',
      ...climbTags.slice(0, 2)
    ].filter(Boolean),
    toneClass: getMissionToneClasses('emerald')
  };
};

const downloadJson = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export default function HistoryView() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<ScoutArchiveRecord[]>([]);
  const [preScoutEvidence, setPreScoutEvidence] = useState<PreScoutAdminTaskEvidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [archiveUsername, setArchiveUsernameState] = useState('');
  const [pendingArchiveUsername, setPendingArchiveUsername] = useState('');
  const [archiveScoutNumber, setArchiveScoutNumber] = useState<number | null>(null);
  const [isArchiveUsernameResolved, setIsArchiveUsernameResolved] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [eventKey, setEventKey] = useState(() => normalizeEventKey(getStoredEventKey(), DEFAULT_EVENT_KEY));
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');
  const [isEvidenceExportPreviewOpen, setIsEvidenceExportPreviewOpen] = useState(false);
  const [recordPendingDelete, setRecordPendingDelete] = useState<ScoutArchiveRecord | null>(null);
  const [powerCoinBets, setPowerCoinBets] = useState<PowerCoinBet[]>([]);
  const [powerCoinLedger, setPowerCoinLedger] = useState<PowerCoinLedgerEntry[]>([]);

  const handleEventKeyChange = (value: string) => {
    const nextEventKey = normalizeEventKey(value, DEFAULT_EVENT_KEY);
    setEventKey(nextEventKey);
    storeEventKey(nextEventKey);
  };

  const preScoutHistoryRows = useMemo<PreScoutHistoryRow[]>(() =>
    preScoutEvidence.map(evidence => ({
      recordId: `preScout:${evidence.id}`,
      logicalId: `preScout:${evidence.eventKey}:${evidence.teamNumber}:${evidence.id}`,
      recordType: 'preScout',
      eventKey: evidence.eventKey,
      username: 'pre-scout-cache',
      deviceId: 'local-pre-scout-cache',
      updatedAt: evidence.capturedAt || evidence.task.capturedAt || evidence.task.createdAt || 0,
      deleted: false,
      source: 'pre_scout_cache',
      syncStatus: 'synced',
      payload: evidence
    })),
    [preScoutEvidence]
  );

  const recentRecords = useMemo(() => {
    return [...records, ...preScoutHistoryRows]
      .filter(record => !record.deleted)
      .sort((a, b) => {
        if ((a.recordType === 'match' || a.recordType === 'matchV4' || a.recordType === 'matchDefense') && (b.recordType === 'match' || b.recordType === 'matchV4' || b.recordType === 'matchDefense')) {
          const getKey = (record: HistoryRow) =>
            record.recordType === 'matchV4'
              ? (record.payload as MatchScoutingV4).matchKey
              : record.recordType === 'match'
              ? toMatchPayloadV3(record.payload as MatchScoutingV2 | MatchScoutingV3).matchKey
              : (record.payload as MatchDefenseScoutingV1).matchKey;
          const matchDiff = getMatchNumber(getKey(b)) - getMatchNumber(getKey(a));
          if (matchDiff !== 0) {
            return matchDiff;
          }
        }

        return b.updatedAt - a.updatedAt;
      });
  }, [preScoutHistoryRows, records]);

  const unsyncedRecords = useMemo(
    () => recentRecords.filter((record): record is ScoutArchiveRecord =>
      isArchiveHistoryRow(record) && (record.syncStatus === 'pending_sync' || record.syncStatus === 'unsynced')
    ),
    [recentRecords]
  );
  const nonNewestMatchV4Records = useMemo(() => getNonNewestMatchV4Records(records.filter(record => !record.deleted)), [records]);
  const unsubmittedCurrentMatchV4Records = useMemo(
    () => records
      .filter(record => !record.deleted && record.recordType === 'matchV4')
      .filter(record => !isMatchV4CurrentVersionSubmitted(record)),
    [records]
  );
  const conflictRecords = useMemo(
    () => unsyncedRecords.filter(record => (record.lastFirebaseError || '').toLowerCase().includes('conflict')),
    [unsyncedRecords]
  );
  const deletedRecords = useMemo(
    () => records.filter(record => record.deleted).sort((a, b) => b.updatedAt - a.updatedAt),
    [records]
  );
  const evidenceSummary = useMemo(() => {
    const active = recentRecords;
    const matchRows = active.filter(record => record.recordType === 'match' || record.recordType === 'matchV4');
    const matchV4Rows = active.filter(record => record.recordType === 'matchV4');
    const defenseRows = active.filter(record => record.recordType === 'matchDefense');
    const pitRows = active.filter(record => record.recordType === 'pit');
    const preScoutRows = active.filter(record => record.recordType === 'preScout');
    const teamsCovered = new Set(active.map(getRecordTeamNumber).filter(Boolean)).size;
    const ppaStrengthRows = preScoutRows.length + matchV4Rows.length + defenseRows.length;
    return {
      teamsCovered,
      preScoutRows: preScoutRows.length,
      matchRows: matchRows.length,
      matchV4Rows: matchV4Rows.length,
      defenseRows: defenseRows.length,
      pitRows: pitRows.length,
      ppaStrengthRows,
      latestUpdate: active[0]?.updatedAt || 0
    };
  }, [recentRecords]);
  const localPowerCoinIdentity = useMemo(() => ({
    scoutName: archiveUsername || 'This Scout',
    scoutNumber: archiveScoutNumber
  }), [archiveScoutNumber, archiveUsername]);
  const localPowerCoinWallet = useMemo(() =>
    computePowerCoinWallet({
      bets: powerCoinBets,
      ledger: powerCoinLedger,
      ...localPowerCoinIdentity
    }),
    [localPowerCoinIdentity, powerCoinBets, powerCoinLedger]
  );
  const localPowerCoinBets = useMemo(() =>
    powerCoinBets
      .filter(bet => powerCoinIdentityMatches(bet, localPowerCoinIdentity))
      .sort((left, right) => (right.settledAt || right.lockedAt || right.placedAt) - (left.settledAt || left.lockedAt || left.placedAt))
      .slice(0, 6),
    [localPowerCoinIdentity, powerCoinBets]
  );
  const localPowerCoinLeaderboard = useMemo(() =>
    buildPowerCoinLeaderboard({
      bets: powerCoinBets,
      ledger: powerCoinLedger,
      identities: archiveUsername ? [localPowerCoinIdentity] : []
    }).slice(0, 6),
    [archiveUsername, localPowerCoinIdentity, powerCoinBets, powerCoinLedger]
  );
  const filteredRecentRecords = useMemo(() => {
    if (activeFilter === 'all') return recentRecords;
    if (activeFilter === 'preScout') return recentRecords.filter(record => record.recordType === 'preScout');
    if (activeFilter === 'match') return recentRecords.filter(record => record.recordType === 'match' || record.recordType === 'matchV4');
    if (activeFilter === 'defense') return recentRecords.filter(record => record.recordType === 'matchDefense');
    if (activeFilter === 'pit') return recentRecords.filter(record => record.recordType === 'pit');
    return recentRecords.filter(record => record.syncStatus === 'pending_sync' || record.syncStatus === 'unsynced');
  }, [activeFilter, recentRecords]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [localRecords, preScoutSheet, localPowerCoinBetRows, localPowerCoinLedgerRows] = await Promise.all([
        listScoutArchiveRecords({ eventKey, includeDeleted: true }),
        getCachedPreMatchSheet(eventKey).catch(() => null),
        listPowerCoinBets(eventKey).catch(() => []),
        listPowerCoinLedger(eventKey).catch(() => [])
      ]);
      setRecords(localRecords);
      setPreScoutEvidence(preScoutSheet?.adminTaskEvidence || []);
      setPowerCoinBets(localPowerCoinBetRows);
      setPowerCoinLedger(localPowerCoinLedgerRows);
    } catch (loadError) {
      console.error('Failed to load local history', loadError);
      setError('Unable to load the local IndexedDB history right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateUsername = async () => {
      try {
        const storedIdentity = await getScoutArchiveIdentity();
        if (cancelled) return;
        setArchiveUsernameState(storedIdentity.username || '');
        setPendingArchiveUsername(storedIdentity.username || '');
        setArchiveScoutNumber(storedIdentity.scoutNumber);
      } catch (loadError) {
        console.error('Failed to read scout archive username', loadError);
      } finally {
        if (!cancelled) {
          setIsArchiveUsernameResolved(true);
        }
      }
    };

    void hydrateUsername();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [eventKey]);

  const handleRefresh = async () => {
    await loadHistory();
  };

  const handleArchiveUsernameSave = async () => {
    const normalized = pendingArchiveUsername.trim();
    if (!normalized) {
      setError('Please enter a scout username for this device.');
      return;
    }

    try {
      await setScoutArchiveUsername(normalized);
      setArchiveUsernameState(normalized);
      setPendingArchiveUsername(normalized);
      setError('');
    } catch (saveError) {
      console.error('Failed to save scout archive username', saveError);
      setError('Unable to save the scout username on this device.');
    }
  };

  const handleEdit = (record: ScoutArchiveRecord) => {
    if (record.recordType === 'matchV4') {
      localStorage.setItem('match_scout_v4_draft', JSON.stringify(record.payload));
      localStorage.setItem('match_scout_v4_edit_mode', 'true');
      navigate('/scout');
      return;
    }

    if (record.recordType === 'match') {
      setError('Legacy V3 match records remain readable here. New edits should use the V4 scout form.');
      return;
    }

    if (record.recordType === 'matchDefense') {
      setError('Defense V1 records remain readable and exportable here. New defense edits should be submitted with the V4 scout form.');
      return;
    }

    localStorage.setItem(
      'edit_pit_data',
      JSON.stringify({
        eventKey: record.eventKey,
        data: record.payload
      })
    );
    navigate('/pit');
  };

  const handleDelete = (record: ScoutArchiveRecord) => {
    setRecordPendingDelete(record);
  };

  const confirmDeleteRecord = async () => {
    if (!recordPendingDelete) return;
    const record = recordPendingDelete;
    setRecordPendingDelete(null);
    try {
      await tombstoneScoutArchiveRecord(record.recordId);
      await loadHistory();
    } catch (deleteError) {
      console.error('Failed to tombstone local archive record', deleteError);
      setError('Unable to mark this dataset as deleted in the local JSON archive.');
    }
  };

  const handleDownloadArchive = async () => {
    if (!archiveUsername) {
      setError('Please set a scout username for this device before exporting JSON.');
      return;
    }
    setIsEvidenceExportPreviewOpen(true);
  };

  const confirmDownloadArchive = async () => {
    if (!archiveUsername) {
      setError('Please set a scout username for this device before exporting JSON.');
      setIsEvidenceExportPreviewOpen(false);
      return;
    }
    setIsEvidenceExportPreviewOpen(false);
    try {
      const bundle = await buildScoutArchiveBundle(archiveUsername);
      const evidenceBundle = {
        ...bundle,
        preScoutEvidence,
        evidenceLedger: {
          eventKey,
          exportedAt: Date.now(),
          preScoutEvidenceRows: preScoutEvidence.length,
          teamsCovered: evidenceSummary.teamsCovered,
          matchRows: evidenceSummary.matchRows,
          defenseRows: evidenceSummary.defenseRows,
          pitRows: evidenceSummary.pitRows
        }
      };
      const filename = `${archiveUsername || 'scout'}_${eventKey}_${new Date(bundle.exportedAt).toISOString().replace(/[:.]/g, '-')}.json`;
      downloadJson(filename, JSON.stringify(evidenceBundle, null, 2));
    } catch (exportError) {
      console.error('Failed to build scout archive export', exportError);
      setError('Unable to export the local JSON archive right now.');
    }
  };

  const confirmDownloadCompactArchive = () => {
    setIsEvidenceExportPreviewOpen(false);
    const compactSummary = {
      format: 'rebuilt-2026-scout-evidence-compact-summary',
      version: 1,
      eventKey,
      exportedAt: Date.now(),
      containsScoutNames: false,
      containsRawMatchNotes: false,
      summary: {
        teamsCovered: evidenceSummary.teamsCovered,
        matchRows: evidenceSummary.matchRows,
        defenseRows: evidenceSummary.defenseRows,
        pitRows: evidenceSummary.pitRows,
        preScoutEvidenceRows: preScoutEvidence.length,
        deletedTombstones: deletedRecords.length,
        unsyncedRows: unsyncedRecords.length,
        conflictRows: conflictRecords.length
      }
    };
    const filename = `compact_${eventKey}_${new Date(compactSummary.exportedAt).toISOString().replace(/[:.]/g, '-')}.json`;
    downloadJson(filename, JSON.stringify(compactSummary, null, 2));
  };

  const handleExportNonNewestMatches = () => {
    const exportedAt = Date.now();
    const payload = {
      format: 'rebuilt-2026-scout-non-newest-match-v4-versions',
      version: 1,
      eventKey,
      exportedAt,
      exportedAtIso: new Date(exportedAt).toISOString(),
      exportedByScoutName: archiveUsername,
      recordCount: nonNewestMatchV4Records.length,
      records: nonNewestMatchV4Records.map(record => ({
        ...record,
        currentVersionSubmitted: isMatchV4CurrentVersionSubmitted(record),
        submissionNumber: isMatchV4CurrentVersionSubmitted(record) ? 1 : 0,
        version: getMatchV4Version(record)
      }))
    };
    const filename = `non_newest_match_versions_${eventKey}_${new Date(exportedAt).toISOString().replace(/[:.]/g, '-')}.json`;
    downloadJson(filename, JSON.stringify(payload, null, 2));
  };

  const handleRetrySync = async (record: ScoutArchiveRecord) => {
    const result = await syncScoutArchiveRecordToFirebase(record);
    if (result.outcome === 'conflict') {
      setError('This local record conflicts with Firebase and remains unsynced for manual resolution.');
      setSyncMessage('');
    } else if (result.outcome === 'failed') {
      setError('Unable to sync this local record to Firebase right now.');
      setSyncMessage('');
    } else {
      setError('');
      setSyncMessage('Record synced to Firebase.');
    }
    await loadHistory();
  };

  const handleRetryAllUnsynced = async () => {
    if (unsyncedRecords.length === 0 || isBulkSyncing) {
      return;
    }

    setIsBulkSyncing(true);
    setError('');
    setSyncMessage(`Syncing ${unsyncedRecords.length} local record${unsyncedRecords.length === 1 ? '' : 's'} to Firebase...`);

    const counts = {
      synced: 0,
      conflict: 0,
      failed: 0
    };

    for (const record of unsyncedRecords) {
      const result = await syncScoutArchiveRecordToFirebase(record);
      counts[result.outcome] += 1;
    }

    await loadHistory();
    setIsBulkSyncing(false);
    setSyncMessage(
      `Sync complete: ${counts.synced} synced, ${counts.conflict} conflict${counts.conflict === 1 ? '' : 's'}, ${counts.failed} failed.`
    );
    if (counts.conflict > 0 || counts.failed > 0) {
      setError('Some local records could not be uploaded. Conflicts and failures stay in My History and remain exportable in JSON.');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-6 space-y-6 pb-24 bg-slate-950 text-white">
      {isArchiveUsernameResolved && !archiveUsername && (
        <ScoutUsernameGate
          pendingUsername={pendingArchiveUsername}
          setPendingUsername={setPendingArchiveUsername}
          onSave={() => void handleArchiveUsernameSave()}
        />
      )}

      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Device Evidence</div>
          <h1 className="mt-1 text-3xl font-black text-white md:text-4xl">
            Local Scouting Ledger
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-400">
            This device's evidence chain for {eventKey}: Pre Scout context, pit priors, match rows, defense impact, sync health, and the local rows used for expected ranges, forecasts, pick lists, charts, and reports.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="admin-g2-sm flex items-center gap-2 border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
            Event
            <input
              type="text"
              value={eventKey}
              onChange={event => handleEventKeyChange(event.target.value)}
              className="w-28 bg-transparent font-mono text-sm text-cyan-300 outline-none"
              aria-label="History event key"
            />
          </label>
          <button
            onClick={() => void handleRetryAllUnsynced()}
            disabled={isBulkSyncing || unsyncedRecords.length === 0}
            className="admin-g2-sm flex items-center gap-2 border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-sm font-black text-amber-50 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud className={`w-4 h-4 ${isBulkSyncing ? 'animate-bounce' : ''}`} />
            Sync Unsynced ({unsyncedRecords.length})
          </button>
          <button
            onClick={() => void handleDownloadArchive()}
            className="admin-g2-sm flex items-center gap-2 border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-sm font-black text-cyan-50 hover:bg-cyan-500/25"
          >
            <Download className="w-4 h-4" />
            Download Evidence JSON
          </button>
          <button
            onClick={handleExportNonNewestMatches}
            disabled={nonNewestMatchV4Records.length === 0}
            className="admin-g2-sm flex items-center gap-2 border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-sm font-black text-violet-50 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export All Non-Newest Matches ({nonNewestMatchV4Records.length})
          </button>
          <button
            onClick={() => void handleRefresh()}
            disabled={isLoading}
            className="admin-g2-sm flex items-center gap-2 border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-black text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/')}
            className="admin-g2-sm flex items-center gap-2 border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-black text-slate-200 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      {error && (
        <div className="admin-g2-sm border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="admin-g2-sm border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
          {syncMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-8">
        <HistorySummaryCard label="Teams Covered" value={evidenceSummary.teamsCovered} tone="cyan" />
        <HistorySummaryCard label="Pre Scout" value={evidenceSummary.preScoutRows} tone="violet" />
        <HistorySummaryCard label="Match Evidence" value={evidenceSummary.matchRows} />
        <HistorySummaryCard label="Expected Rows" value={evidenceSummary.matchV4Rows} tone="cyan" />
        <HistorySummaryCard label="Defense Impact" value={evidenceSummary.defenseRows} tone="rose" />
        <HistorySummaryCard label="Pit Priors" value={evidenceSummary.pitRows} tone="emerald" />
        <HistorySummaryCard label="Unsynced" value={unsyncedRecords.length} tone={unsyncedRecords.length > 0 ? 'amber' : 'slate'} />
        <HistorySummaryCard label="Local Only V4" value={unsubmittedCurrentMatchV4Records.length} tone={unsubmittedCurrentMatchV4Records.length > 0 ? 'amber' : 'slate'} />
      </div>

      <section className={`admin-g2 border p-5 ${
        localPowerCoinWallet.bankrupt
          ? 'border-rose-400/35 bg-rose-500/10'
          : 'border-yellow-400/25 bg-yellow-500/10'
      }`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-yellow-100/70">
              <Coins className="h-4 w-4" />
              PowerCoin Wallet
            </div>
            <h2 className="mt-1 text-2xl font-black text-white">
              {localPowerCoinWallet.scoutName}
              {localPowerCoinWallet.scoutNumber ? <span className="text-yellow-100/65"> #{localPowerCoinWallet.scoutNumber}</span> : null}
            </h2>
          </div>
          <div className="grid min-w-full gap-3 sm:grid-cols-3 xl:min-w-[520px]">
            <div className="admin-g2-sm border border-yellow-400/25 bg-slate-950/65 px-4 py-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-yellow-100/60">Balance</div>
              <div className={`mt-1 text-3xl font-black ${localPowerCoinWallet.bankrupt ? 'text-rose-100' : 'text-yellow-50'}`}>
                {Math.round(localPowerCoinWallet.balance)}
              </div>
              <div className="mt-1 text-xs font-semibold text-yellow-100/55">Starts at {STARTING_POWERCOIN_BALANCE}</div>
            </div>
            <div className="admin-g2-sm border border-yellow-400/25 bg-slate-950/65 px-4 py-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-yellow-100/60">Open Stake</div>
              <div className="mt-1 text-3xl font-black text-yellow-50">{Math.round(localPowerCoinWallet.openStake)}</div>
              <div className="mt-1 text-xs font-semibold text-yellow-100/55">{localPowerCoinWallet.openBets} open bet{localPowerCoinWallet.openBets === 1 ? '' : 's'}</div>
            </div>
            <div className="admin-g2-sm border border-yellow-400/25 bg-slate-950/65 px-4 py-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-yellow-100/60">Last Result</div>
              <div className={`mt-1 text-3xl font-black ${
                localPowerCoinWallet.lastSettledDelta < 0 ? 'text-rose-100' : localPowerCoinWallet.lastSettledDelta > 0 ? 'text-emerald-100' : 'text-slate-100'
              }`}>
                {localPowerCoinWallet.lastSettledBet ? formatPowerCoinDelta(localPowerCoinWallet.lastSettledDelta) : '-'}
              </div>
              <div className="mt-1 text-xs font-semibold text-yellow-100/55">
                {localPowerCoinWallet.lastSettledBet ? localPowerCoinWallet.lastSettledBet.matchKey.toUpperCase() : 'No settled bets'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="admin-g2-sm border border-yellow-400/20 bg-slate-950/65 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-black text-yellow-50">Betting History</div>
              {localPowerCoinWallet.bankrupt && (
                <div className="admin-g2-sm border border-rose-400/30 bg-rose-500/15 px-2 py-1 text-xs font-black text-rose-100">Bankrupt</div>
              )}
            </div>
            <div className="mt-3 divide-y divide-slate-800">
              {localPowerCoinBets.length === 0 ? (
                <div className="py-3 text-sm font-semibold text-yellow-100/55">No PowerCoin bets are stored on this device for {eventKey} yet.</div>
              ) : localPowerCoinBets.map(bet => {
                const delta = getPowerCoinBetBalanceDelta(bet);
                return (
                  <div key={bet.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <div className="font-black text-white">{bet.matchKey.toUpperCase()} • {bet.side}</div>
                      <div className="text-xs font-semibold text-yellow-100/55">
                        {bet.settledAt ? `${bet.outcome || 'settled'} • stake ${Math.round(bet.amount)}` : `open • stake ${Math.round(bet.amount)}`}
                        {bet.directSendStatus === 'failed' ? ' • not sent' : ''}
                        {bet.disqualified ? ' • disqualified' : ''}
                      </div>
                    </div>
                    <div className={`font-black ${
                      delta < 0 ? 'text-rose-100' : delta > 0 ? 'text-emerald-100' : 'text-slate-200'
                    }`}>
                      {bet.settledAt ? formatPowerCoinDelta(delta) : `-${Math.round(bet.amount)} locked`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="admin-g2-sm border border-yellow-400/20 bg-slate-950/65 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-yellow-50">
              <Trophy className="h-4 w-4" />
              Local Leaderboard
            </div>
            <div className="mt-3 space-y-2">
              {localPowerCoinLeaderboard.length === 0 ? (
                <div className="text-sm font-semibold text-yellow-100/55">No synced/imported PowerCoin rows yet.</div>
              ) : localPowerCoinLeaderboard.map((wallet, index) => (
                <div key={wallet.identityKey} className="admin-g2-sm flex items-center justify-between gap-3 border border-slate-800 bg-slate-900/75 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">
                      {index + 1}. {wallet.scoutName}{wallet.scoutNumber ? ` #${wallet.scoutNumber}` : ''}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      last {wallet.lastSettledBet ? formatPowerCoinDelta(wallet.lastSettledDelta) : '-'} • open {wallet.openStake}
                    </div>
                  </div>
                  <div className={`shrink-0 text-lg font-black ${wallet.bankrupt ? 'text-rose-100' : 'text-yellow-50'}`}>
                    {Math.round(wallet.balance)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="admin-g2 border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Evidence Pipeline</div>
              <h2 className="mt-1 text-xl font-black text-white">What this device can prove</h2>
            </div>
            <div className="text-sm font-semibold text-slate-400">Latest: {formatRecordTime(evidenceSummary.latestUpdate)}</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <EvidencePipelineCard
              icon={<Database className="h-4 w-4" />}
              title="Public Context"
              value={`${evidenceSummary.preScoutRows} pre row${evidenceSummary.preScoutRows === 1 ? '' : 's'}`}
              detail="Pre Scout returns public-context gaps and early guardrails before pit and match rows exist."
              toneClass={getMissionToneClasses('violet')}
            />
            <EvidencePipelineCard
              icon={<Wrench className="h-4 w-4" />}
              title="Capability Priors"
              value={`${evidenceSummary.pitRows} pit row${evidenceSummary.pitRows === 1 ? '' : 's'}`}
              detail="Before enough matches exist, these rows seed compatibility, mechanism risk, and questions to verify."
              toneClass={getMissionToneClasses('emerald')}
            />
            <EvidencePipelineCard
              icon={<BarChart3 className="h-4 w-4" />}
              title="Expected Range Evidence"
              value={`${evidenceSummary.ppaStrengthRows} strong row${evidenceSummary.ppaStrengthRows === 1 ? '' : 's'}`}
              detail="V4 match and defense evidence strengthen expected value, floor, ceiling, role, and downside-risk checks."
              toneClass={getMissionToneClasses('cyan')}
            />
            <EvidencePipelineCard
              icon={<Database className="h-4 w-4" />}
              title="Data Workflow"
              value={unsyncedRecords.length > 0 ? `${unsyncedRecords.length} unsynced` : 'Sync clear'}
              detail="Synced or exported rows are the evidence the team can audit, sync, visualize, and report."
              toneClass={unsyncedRecords.length > 0 ? getMissionToneClasses('amber') : 'border-slate-700 bg-slate-950 text-slate-200'}
            />
          </div>
        </section>

        <section className="admin-g2 border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Used Next</div>
          <h2 className="mt-1 text-xl font-black text-white">Where these rows matter</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.values(SCOUTING_USE_MOMENTS).map(moment => (
              <div key={moment.key} className="admin-g2-sm border border-slate-800 bg-slate-950/65 px-3 py-2">
                <div className="font-black text-white">{moment.title}</div>
                <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-400">{moment.needs.slice(0, 3).join(' / ')}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-g2 border border-slate-800 bg-slate-900/80 overflow-hidden">
        <div className="flex flex-col gap-4 px-5 py-4 border-b border-slate-800 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock3 className="w-4 h-4" />
            <span className="font-black uppercase tracking-wider text-sm">Active Evidence Rows</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all' as const, label: `All ${recentRecords.length}` },
              { key: 'preScout' as const, label: `Pre ${evidenceSummary.preScoutRows}` },
              { key: 'match' as const, label: `Match ${evidenceSummary.matchRows}` },
              { key: 'defense' as const, label: `Defense ${evidenceSummary.defenseRows}` },
              { key: 'pit' as const, label: `Pit ${evidenceSummary.pitRows}` },
              { key: 'unsynced' as const, label: `Unsynced ${unsyncedRecords.length}` }
            ].map(filter => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`admin-g2-sm border px-3 py-2 text-xs font-black transition-colors ${
                  activeFilter === filter.key
                    ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-50'
                    : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="px-5 py-10 text-center text-slate-400 font-semibold">Loading local history...</div>
        ) : filteredRecentRecords.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 font-semibold">
            No local scouting datasets match this evidence filter yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredRecentRecords.map((record) => {
              const meta = getEvidenceMeta(record);
              const mission = SCOUTING_MISSIONS[meta.missionKey];
              const adminTask = getRecordAdminTask(record);
              return (
              <div key={record.recordId} className="px-5 py-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className={`admin-g2-sm border px-3 py-3 ${meta.toneClass}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{mission.shortTitle}</div>
                        <div className="mt-1 text-sm font-black text-white">{meta.title}</div>
                        <div className="mt-1 text-xs font-semibold leading-relaxed opacity-80">{meta.ppaSignal}</div>
                      </div>
                      <div className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white">
                        {meta.value}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {meta.tags.slice(0, 5).map(tag => (
                        <span key={tag} className="admin-g2-sm border border-white/10 bg-slate-950/45 px-2 py-1 text-[11px] font-semibold text-slate-100">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 text-xs font-semibold leading-relaxed opacity-80">{meta.decisionUse}</div>
                  </div>
                  {record.recordType === 'preScout' ? (
                    (() => {
                      const preScoutPayload = record.payload as PreScoutAdminTaskEvidence;
                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="admin-g2-sm bg-violet-500/15 px-3 py-1 text-xs font-black tracking-wider text-violet-200">
                              PRE SCOUT
                            </span>
                            <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              Team {preScoutPayload.teamNumber}
                            </span>
                            {preScoutPayload.teamName && (
                              <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                                {preScoutPayload.teamName}
                              </span>
                            )}
                            <span className={`admin-g2-sm px-3 py-1 text-xs font-black tracking-wider ${preScoutPayload.profileAvailable ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>
                              {preScoutPayload.profileAvailable ? 'Public context found' : 'Public context missing'}
                            </span>
                            {preScoutPayload.qualificationStatus && (
                              <span className="admin-g2-sm bg-violet-500/15 px-3 py-1 text-xs font-black tracking-wider text-violet-200">
                                {preScoutPayload.qualificationStatus}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-slate-300">
                            <span className="font-bold text-white">Pre Scout cache</span>
                            {' • '}
                            {formatRecordTime(record.updatedAt)}
                          </div>

                          {(preScoutPayload.missingFromTba.length > 0 || preScoutPayload.manualRequired.length > 0) && (
                            <div className="flex max-w-3xl flex-wrap gap-2">
                              {[...preScoutPayload.missingFromTba, ...preScoutPayload.manualRequired].slice(0, 5).map(item => (
                                <span key={item} className="admin-g2-sm border border-violet-300/20 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-100">
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()
                  ) : record.recordType === 'matchV4' ? (
                    (() => {
                      const matchPayload = record.payload as MatchScoutingV4;
                      const currentVersionSubmitted = isMatchV4CurrentVersionSubmitted(record);
                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="admin-g2-sm bg-fuchsia-500/15 px-3 py-1 text-xs font-black tracking-wider text-fuchsia-200">
                              MATCH V4
                            </span>
                            <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              {matchPayload.matchKey.toUpperCase()}
                            </span>
                            <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              Team {matchPayload.teamNumber}
                            </span>
                            <span
                              className={`admin-g2-sm px-3 py-1 text-xs font-black tracking-wider ${
                                matchPayload.alliance === 'Red'
                                  ? 'bg-red-500/15 text-red-200'
                                  : matchPayload.alliance === 'Blue'
                                    ? 'bg-blue-500/15 text-blue-200'
                                    : 'bg-slate-800 text-slate-200'
                              }`}
                            >
                              {matchPayload.alliance || 'No Alliance'}
                            </span>
                            <span className="admin-g2-sm bg-cyan-500/15 px-3 py-1 text-xs font-black tracking-wider text-cyan-200">
                              {matchPayload.totalMatchPoints} pts
                            </span>
                            <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              Version {matchPayload.versionMetadata?.version || 1}
                            </span>
                            <span
                              className={`admin-g2-sm px-3 py-1 text-xs font-black tracking-wider ${
                                currentVersionSubmitted
                                  ? 'bg-emerald-500/15 text-emerald-200'
                                  : 'bg-amber-500/15 text-amber-200'
                              }`}
                            >
                              {currentVersionSubmitted ? 'Submitted to Head Scout' : 'Local Only'}
                            </span>
                            <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              Submission {currentVersionSubmitted ? 1 : 0}
                            </span>
                            {record.syncStatus !== 'synced' && (
                              <span className="admin-g2-sm bg-rose-500/15 px-3 py-1 text-xs font-black tracking-wider text-rose-200">
                                {record.syncStatus === 'pending_sync' ? 'Pending Sync' : 'Unsynced'}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-slate-300">
                            <span className="font-bold text-white">{matchPayload.scoutName || 'Scout name missing'}</span>
                            {' • '}
                            {formatRecordTime(record.updatedAt)}
                          </div>

                          {matchPayload.notes && (
                            <p className="max-w-3xl line-clamp-2 text-sm text-slate-400">
                              {matchPayload.notes}
                            </p>
                          )}
                        </>
                      );
                    })()
                  ) : record.recordType === 'match' ? (
                    (() => {
                      const matchPayload = toMatchPayloadV3(record.payload as MatchScoutingV2 | MatchScoutingV3);
                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="admin-g2-sm bg-purple-500/15 px-3 py-1 text-xs font-black tracking-wider text-purple-200">
                              MATCH V3
                            </span>
                            <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              {matchPayload.matchKey.toUpperCase()}
                            </span>
                            <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              Team {matchPayload.teamNumber}
                            </span>
                            <span
                              className={`admin-g2-sm px-3 py-1 text-xs font-black tracking-wider ${
                                matchPayload.alliance === 'Red'
                                  ? 'bg-red-500/15 text-red-200'
                                  : matchPayload.alliance === 'Blue'
                                    ? 'bg-blue-500/15 text-blue-200'
                                    : 'bg-slate-800 text-slate-200'
                              }`}
                            >
                              {matchPayload.alliance || 'No Alliance'}
                            </span>
                            {matchPayload.legacyDerived && (
                              <span className="admin-g2-sm bg-amber-500/15 px-3 py-1 text-xs font-black tracking-wider text-amber-200">
                                Legacy Import
                              </span>
                            )}
                            {record.syncStatus !== 'synced' && (
                              <span className="admin-g2-sm bg-rose-500/15 px-3 py-1 text-xs font-black tracking-wider text-rose-200">
                                {record.syncStatus === 'pending_sync' ? 'Pending Sync' : 'Unsynced'}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-slate-300">
                            <span className="font-bold text-white">{matchPayload.scoutName || 'Scout name missing'}</span>
                            {' • '}
                            {formatRecordTime(record.updatedAt)}
                          </div>

                          {matchPayload.generalEvaluation && (
                            <p className="max-w-3xl line-clamp-2 text-sm text-slate-400">
                              {matchPayload.generalEvaluation}
                            </p>
                          )}
                        </>
                      );
                    })()
                  ) : record.recordType === 'matchDefense' ? (
                    (() => {
                      const defensePayload = toDefensePayloadV1(record.payload as MatchDefenseScoutingV1);
                      if (!defensePayload) return null;
                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="admin-g2-sm bg-emerald-500/15 px-3 py-1 text-xs font-black tracking-wider text-emerald-200">
                              DEFENSE V1
                            </span>
                            <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              {defensePayload.matchKey.toUpperCase()}
                            </span>
                            <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              Team {defensePayload.teamNumber}
                            </span>
                            <span
                              className={`admin-g2-sm px-3 py-1 text-xs font-black tracking-wider ${
                                defensePayload.alliance === 'Red'
                                  ? 'bg-red-500/15 text-red-200'
                                  : defensePayload.alliance === 'Blue'
                                    ? 'bg-blue-500/15 text-blue-200'
                                    : 'bg-slate-800 text-slate-200'
                              }`}
                            >
                              {defensePayload.alliance || 'No Alliance'}
                            </span>
                            <span className="admin-g2-sm bg-emerald-500/15 px-3 py-1 text-xs font-black tracking-wider text-emerald-200">
                              {((defensePayload.defenseMetric || 0) * 100).toFixed(2)}%
                            </span>
                            {record.syncStatus !== 'synced' && (
                              <span className="admin-g2-sm bg-rose-500/15 px-3 py-1 text-xs font-black tracking-wider text-rose-200">
                                {record.syncStatus === 'pending_sync' ? 'Pending Sync' : 'Unsynced'}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-slate-300">
                            <span className="font-bold text-white">{defensePayload.scoutName || 'Scout name missing'}</span>
                            {' • '}
                            {formatRecordTime(record.updatedAt)}
                          </div>

                          {defensePayload.defenseComments && (
                            <p className="max-w-3xl line-clamp-2 text-sm text-slate-400">
                              {defensePayload.defenseComments}
                            </p>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="admin-g2-sm bg-cyan-500/15 px-3 py-1 text-xs font-black tracking-wider text-cyan-200">
                          PIT
                        </span>
                        <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                          Team {(record.payload as PitScoutingV2).teamNumber}
                        </span>
                        <span className="admin-g2-sm bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                          {(record.payload as PitScoutingV2).teamName}
                        </span>
                        {record.syncStatus !== 'synced' && (
                          <span className="admin-g2-sm bg-rose-500/15 px-3 py-1 text-xs font-black tracking-wider text-rose-200">
                            {record.syncStatus === 'pending_sync' ? 'Pending Sync' : 'Unsynced'}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-slate-300">
                        <span className="font-bold text-white">
                          {(record.payload as PitScoutingV2).scoutName || 'Pit Scout'}
                        </span>
                        {' • '}
                        {formatRecordTime(record.updatedAt)}
                      </div>

                      {(record.payload as PitScoutingV2).notes && (
                        <p className="max-w-3xl line-clamp-2 text-sm text-slate-400">
                          {(record.payload as PitScoutingV2).notes}
                        </p>
                      )}
                    </>
                  )}

                  {record.recordType !== 'preScout' && record.syncStatus !== 'synced' && record.lastFirebaseError && (
                    <div
                      className={`admin-g2-sm max-w-3xl px-3 py-2 text-xs font-bold ${
                        record.lastFirebaseError.toLowerCase().includes('conflict')
                          ? 'border border-rose-500/40 bg-rose-500/10 text-rose-100'
                          : 'border border-amber-500/40 bg-amber-500/10 text-amber-100'
                      }`}
                    >
                      {record.lastFirebaseError}
                    </div>
                  )}

                  <AdminTaskEvidencePanel task={adminTask} />
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start xl:self-center">
                  {record.recordType !== 'preScout' && record.syncStatus !== 'synced' && (
                    <button
                      onClick={() => void handleRetrySync(record)}
                      className="admin-g2-sm flex items-center gap-2 border border-amber-400/30 bg-amber-500/15 px-4 py-2 font-black tracking-wide text-amber-50 hover:bg-amber-500/25"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry Sync
                    </button>
                  )}
                  {(record.recordType === 'matchV4' || record.recordType === 'pit') && (
                    <button
                      onClick={() => handleEdit(record)}
                      className="admin-g2-sm flex items-center gap-2 border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 font-black tracking-wide text-emerald-50 hover:bg-emerald-500/25"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  {record.recordType !== 'preScout' && (
                    <button
                      onClick={() => handleDelete(record)}
                      className="admin-g2-sm flex items-center gap-2 border border-rose-400/30 bg-rose-500/15 px-4 py-2 font-black tracking-wide text-rose-50 hover:bg-rose-500/25"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      <div className="admin-g2 border border-rose-500/20 bg-rose-500/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rose-500/20">
          <div className="font-black uppercase tracking-wider text-sm text-rose-100">Deleted Tombstones</div>
          <div className="text-xs font-mono text-rose-100/70">{deletedRecords.length} preserved item{deletedRecords.length === 1 ? '' : 's'}</div>
        </div>
        {deletedRecords.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm font-semibold text-rose-100/60">
            No deleted local datasets. When scouts delete a dataset, it disappears from active history but remains here and in JSON export.
          </div>
        ) : (
          <div className="divide-y divide-rose-500/10">
            {deletedRecords.map(record => (
              <div key={record.recordId} className="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="admin-g2-sm bg-rose-500/15 px-3 py-1 text-xs font-black uppercase text-rose-100">
                      Deleted
                    </span>
                    <span className="admin-g2-sm bg-slate-950/70 px-3 py-1 text-xs font-mono font-black text-rose-50">
                      {record.recordType}
                    </span>
                    <span className="admin-g2-sm bg-slate-950/70 px-3 py-1 text-xs font-mono font-black text-rose-50">
                      {record.logicalId}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-rose-100/70">
                    Details are preserved inside the local archive and JSON export for accountability.
                  </div>
                </div>
                <div className="text-xs font-mono text-rose-100/70">
                  {formatRecordTime(record.updatedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {recordPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-delete-preview-title"
            className="admin-g2-lg w-full max-w-xl overflow-hidden border border-rose-400/30 bg-slate-950 shadow-md shadow-slate-950/30"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-rose-200">Delete Review</div>
                <h2 id="history-delete-preview-title" className="mt-1 text-xl font-black text-white">Move Evidence Row To Tombstones</h2>
              </div>
              <button
                type="button"
                onClick={() => setRecordPendingDelete(null)}
                aria-label="Close evidence delete review"
                className="admin-g2-sm inline-flex h-10 w-10 items-center justify-center border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="admin-g2 border border-rose-400/30 bg-rose-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" aria-hidden="true" />
                  <p className="text-sm font-semibold leading-relaxed text-rose-50">
                    This hides the row from active scouting history but preserves a tombstone in the local archive and JSON export for accountability.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <HistorySummaryCard label="Type" value={recordPendingDelete.recordType} tone="rose" />
                <HistorySummaryCard label="Team" value={getRecordTeamNumber(recordPendingDelete) || 'N/A'} tone="cyan" />
                <HistorySummaryCard label="Match" value={getRecordMatchKey(recordPendingDelete) || 'N/A'} tone="slate" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 px-5 py-4">
              <button
                type="button"
                onClick={() => setRecordPendingDelete(null)}
                className="admin-g2-sm border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-black text-slate-100 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteRecord()}
                className="admin-g2-sm inline-flex items-center gap-2 border border-rose-400/40 bg-rose-500/15 px-4 py-2.5 text-sm font-black text-rose-50 hover:bg-rose-500/25"
              >
                <Trash2 className="h-4 w-4" />Move To Tombstones
              </button>
            </div>
          </div>
        </div>
      )}

      {isEvidenceExportPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-export-preview-title"
            className="admin-g2-lg w-full max-w-2xl overflow-hidden border border-amber-400/30 bg-slate-950 shadow-md shadow-slate-950/30"
          >
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Privacy Review</div>
                <h2 id="history-export-preview-title" className="mt-1 text-xl font-black text-white">Export Device Evidence JSON</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEvidenceExportPreviewOpen(false)}
                aria-label="Close evidence export preview"
                className="admin-g2-sm inline-flex h-10 w-10 items-center justify-center border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div className="admin-g2 border border-amber-400/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                  <p className="text-sm font-semibold leading-relaxed text-amber-50">
                    This JSON may include scout names, team strategy notes, match evidence, local sync state, and deleted tombstones. Share it only with team admins who should see device evidence for {eventKey}.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <HistorySummaryCard label="Match Rows" value={evidenceSummary.matchRows} tone="cyan" />
                <HistorySummaryCard label="Defense Rows" value={evidenceSummary.defenseRows} tone="rose" />
                <HistorySummaryCard label="Pit Rows" value={evidenceSummary.pitRows} tone="emerald" />
                <HistorySummaryCard label="Deleted" value={deletedRecords.length} tone="amber" />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 px-5 py-4">
              <button
                type="button"
                onClick={() => setIsEvidenceExportPreviewOpen(false)}
                className="admin-g2-sm border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-black text-slate-100 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDownloadCompactArchive()}
                className="admin-g2-sm inline-flex items-center gap-2 border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-black text-cyan-50 hover:bg-cyan-500/25"
              >
                <Download className="h-4 w-4" />Export Compact Summary
              </button>
              <button
                type="button"
                onClick={() => void confirmDownloadArchive()}
                className="admin-g2-sm inline-flex items-center gap-2 border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-sm font-black text-amber-50 hover:bg-amber-500/25"
              >
                <Download className="h-4 w-4" />Export Evidence JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidencePipelineCard({
  icon,
  title,
  value,
  detail,
  toneClass
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
  toneClass: string;
}) {
  return (
    <div className={`admin-g2-sm border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] opacity-75">
            {icon}
            {title}
          </div>
          <div className="mt-2 text-lg font-black text-white">{value}</div>
        </div>
      </div>
      <div className="mt-2 text-xs font-semibold leading-relaxed opacity-80">{detail}</div>
    </div>
  );
}

const formatTaskMetric = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value) ? 'N/A' : value.toFixed(digits);

const formatTaskPercent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? 'N/A' : `${Math.round(value * 100)}%`;

function AdminTaskEvidencePanel({ task }: { task?: ScoutEvidenceAdminTask }) {
  if (!task) return null;
  const ppaRange = formatScoutEvidenceAdminTaskPpaRange(task);
  const asks = task.ppa?.asks || [];
  const warnings = task.ppa?.warnings || [];
  const decisionUse = describeScoutEvidenceAdminTaskDecisionUse(task);
  return (
    <div className="admin-g2-sm max-w-4xl border border-sky-400/30 bg-sky-500/10 p-3 text-xs font-semibold text-sky-50">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="font-black uppercase tracking-[0.18em] text-sky-200/80">Admin Task Closed</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="admin-g2-sm border border-sky-300/20 bg-slate-950/45 px-2 py-1 font-black">
              {formatScoutEvidenceAdminTaskMission(task)}
            </span>
            <span className="admin-g2-sm border border-sky-300/20 bg-slate-950/45 px-2 py-1">
              Team {task.teamNumber}{task.teamName ? ` ${task.teamName}` : ''}
            </span>
            {(task.matchKey || task.matchNumber) && (
              <span className="admin-g2-sm border border-sky-300/20 bg-slate-950/45 px-2 py-1">
                {task.matchKey || `${task.matchType || 'Match'} ${task.matchNumber}`}
              </span>
            )}
            {task.reason && (
              <span className="admin-g2-sm border border-sky-300/20 bg-slate-950/45 px-2 py-1">
                {task.reason}
              </span>
            )}
          </div>
          {(task.context || task.detail) && (
            <div className="mt-2 max-w-3xl leading-relaxed text-sky-100/80">
              {[task.context, task.detail].filter(Boolean).join(' | ')}
            </div>
          )}
        </div>
        {task.capturedAt && (
          <div className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-sky-100/60">
            Captured {formatRecordTime(task.capturedAt)}
          </div>
        )}
      </div>

      {task.ppa && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <TaskPill label="Expected Floor / Exp / Ceiling" value={ppaRange || 'N/A'} />
          <TaskPill label="Role" value={task.ppa.role || 'Needs role evidence'} />
          <TaskPill label="Risk" value={`${task.ppa.uncertainty || 'Needs risk read'} / ${task.ppa.tailRisk || 'Needs tail read'}`} />
          <TaskPill label="Scout Trust" value={formatTaskPercent(task.ppa.scoutConfidence)} />
          <TaskPill label="Normal Band" value={`${formatTaskMetric(task.ppa.normalLow)} - ${formatTaskMetric(task.ppa.normalHigh)}`} />
          <TaskPill label="Coverage" value={task.ppa.coverage || 'Needs coverage read'} />
          <TaskPill label="Model" value={task.ppa.model || 'Needs model context'} />
          <TaskPill label="Expected" value={formatTaskMetric(task.ppa.expected)} />
        </div>
      )}

      {decisionUse && (
        <div className="admin-g2-sm mt-3 border border-emerald-300/20 bg-emerald-500/10 p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="font-black uppercase tracking-[0.16em] text-emerald-100/70">{decisionUse.title}</div>
              <div className="mt-1 leading-relaxed text-emerald-50/90">{decisionUse.summary}</div>
              <div className="mt-1 leading-relaxed text-emerald-50/75">{decisionUse.modelEffect}</div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5 lg:max-w-xs lg:justify-end">
              {decisionUse.feeds.map(feed => (
                <span key={feed} className="admin-g2-sm border border-emerald-200/15 bg-slate-950/45 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-50">
                  {feed}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {(asks.length > 0 || warnings.length > 0) && (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {asks.length > 0 && (
            <div>
              <div className="font-black uppercase tracking-[0.16em] text-sky-200/70">What Admin Asked To Prove</div>
              <div className="mt-1 space-y-1">
                {asks.slice(0, 4).map(ask => (
                  <div key={ask} className="admin-g2-sm border border-sky-300/20 bg-slate-950/45 px-2 py-1.5 text-sky-50">
                    {ask}
                  </div>
                ))}
              </div>
            </div>
          )}
          {warnings.length > 0 && (
            <div>
              <div className="font-black uppercase tracking-[0.16em] text-sky-200/70">Model Warnings At Assignment</div>
              <div className="mt-1 space-y-1">
                {warnings.slice(0, 4).map(warning => (
                  <div key={warning} className="admin-g2-sm border border-amber-300/20 bg-amber-500/10 px-2 py-1.5 text-amber-50">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TaskPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-g2-sm border border-sky-300/20 bg-slate-950/45 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-200/60">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}

function HistorySummaryCard({
  label,
  value,
  tone = 'slate'
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'amber' | 'rose' | 'cyan' | 'emerald' | 'violet';
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : tone === 'rose'
        ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
        : tone === 'cyan'
          ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
          : tone === 'emerald'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
            : tone === 'violet'
              ? 'border-violet-500/30 bg-violet-500/10 text-violet-100'
          : 'border-slate-800 bg-slate-900/80 text-white';
  return (
    <div className={`admin-g2 border px-5 py-4 ${toneClass}`}>
      <div className="text-xs font-black uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
