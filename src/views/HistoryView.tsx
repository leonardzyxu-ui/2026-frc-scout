import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Clock3, Database, Download, Edit3, RefreshCw, Trash2, UploadCloud, Wrench } from 'lucide-react';
import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, MatchScoutingV4, PitScoutingV2 } from '../types';
import { DEFAULT_EVENT_KEY, getStoredEventKey, storeEventKey } from '../utils/sharedEventState';
import {
  buildScoutArchiveBundle,
  getScoutArchiveUsername,
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

type HistoryRow = ScoutArchiveRecord;
type HistoryFilter = 'all' | 'match' | 'defense' | 'pit' | 'unsynced';

const toMatchPayloadV3 = (payload: MatchScoutingV2 | MatchScoutingV3) =>
  isMatchScoutingV3(payload) ? payload : mapLegacyMatchScoutingToV3(payload);

const toDefensePayloadV1 = (payload: MatchDefenseScoutingV1) =>
  isMatchDefenseScoutingV1(payload) ? payload : null;

function getMatchNumber(matchKey: string) {
  const match = matchKey.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

const formatRecordTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleString() : 'No timestamp';

const getRecordTeamNumber = (record: HistoryRow) => {
  if (record.recordType === 'matchV4') return (record.payload as MatchScoutingV4).teamNumber;
  if (record.recordType === 'match') return toMatchPayloadV3(record.payload as MatchScoutingV2 | MatchScoutingV3).teamNumber;
  if (record.recordType === 'matchDefense') return (record.payload as MatchDefenseScoutingV1).teamNumber;
  return (record.payload as PitScoutingV2).teamNumber;
};

const getRecordMatchKey = (record: HistoryRow) => {
  if (record.recordType === 'matchV4') return (record.payload as MatchScoutingV4).matchKey;
  if (record.recordType === 'match') return toMatchPayloadV3(record.payload as MatchScoutingV2 | MatchScoutingV3).matchKey;
  if (record.recordType === 'matchDefense') return (record.payload as MatchDefenseScoutingV1).matchKey;
  return '';
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
  if (record.recordType === 'matchV4') {
    const payload = record.payload as MatchScoutingV4;
    return {
      missionKey: 'matchScout',
      title: 'Match evidence',
      decisionUse: 'Feeds Now, Matches, Pick List, Visualize, and Reports.',
      ppaSignal: 'Expected value, floor risk, role fit, volatility, and scout confidence.',
      value: `${payload.totalMatchPoints} pts`,
      tags: [
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
      ppaSignal: 'Prevents PPA from treating strategic sacrifice as weak scoring.',
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
  const [records, setRecords] = useState<HistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [archiveUsername, setArchiveUsernameState] = useState('');
  const [pendingArchiveUsername, setPendingArchiveUsername] = useState('');
  const [isArchiveUsernameResolved, setIsArchiveUsernameResolved] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [eventKey, setEventKey] = useState(() => normalizeEventKey(getStoredEventKey(), DEFAULT_EVENT_KEY));
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');

  const handleEventKeyChange = (value: string) => {
    const nextEventKey = normalizeEventKey(value, DEFAULT_EVENT_KEY);
    setEventKey(nextEventKey);
    storeEventKey(nextEventKey);
  };

  const recentRecords = useMemo(() => {
    return records
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
  }, [records]);

  const unsyncedRecords = useMemo(
    () => recentRecords.filter(record => record.syncStatus === 'pending_sync' || record.syncStatus === 'unsynced'),
    [recentRecords]
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
    const teamsCovered = new Set(active.map(getRecordTeamNumber).filter(Boolean)).size;
    const ppaStrengthRows = matchV4Rows.length + defenseRows.length;
    return {
      teamsCovered,
      matchRows: matchRows.length,
      matchV4Rows: matchV4Rows.length,
      defenseRows: defenseRows.length,
      pitRows: pitRows.length,
      ppaStrengthRows,
      latestUpdate: active[0]?.updatedAt || 0
    };
  }, [recentRecords]);
  const filteredRecentRecords = useMemo(() => {
    if (activeFilter === 'all') return recentRecords;
    if (activeFilter === 'match') return recentRecords.filter(record => record.recordType === 'match' || record.recordType === 'matchV4');
    if (activeFilter === 'defense') return recentRecords.filter(record => record.recordType === 'matchDefense');
    if (activeFilter === 'pit') return recentRecords.filter(record => record.recordType === 'pit');
    return recentRecords.filter(record => record.syncStatus === 'pending_sync' || record.syncStatus === 'unsynced');
  }, [activeFilter, recentRecords]);

  const loadHistory = async () => {
    setIsLoading(true);
    setError('');

    try {
      const localRecords = await listScoutArchiveRecords({ eventKey, includeDeleted: true });
      setRecords(localRecords);
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
        const storedUsername = await getScoutArchiveUsername();
        if (cancelled) return;
        setArchiveUsernameState(storedUsername || '');
        setPendingArchiveUsername(storedUsername || '');
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

  const handleEdit = (record: HistoryRow) => {
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

  const handleDelete = async (record: HistoryRow) => {
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

    try {
      const bundle = await buildScoutArchiveBundle(archiveUsername);
      const filename = `${archiveUsername || 'scout'}_${eventKey}_${new Date(bundle.exportedAt).toISOString().replace(/[:.]/g, '-')}.json`;
      downloadJson(filename, JSON.stringify(bundle, null, 2));
    } catch (exportError) {
      console.error('Failed to build scout archive export', exportError);
      setError('Unable to export the local JSON archive right now.');
    }
  };

  const handleRetrySync = async (record: HistoryRow) => {
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
            This device's evidence chain for {eventKey}: pit priors, match rows, defense impact, sync health, and the raw rows Admin V4 uses for PPA, forecasts, pick lists, charts, and reports.
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
            Download JSON
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <HistorySummaryCard label="Teams Covered" value={evidenceSummary.teamsCovered} tone="cyan" />
        <HistorySummaryCard label="Match Evidence" value={evidenceSummary.matchRows} />
        <HistorySummaryCard label="V4 PPA Rows" value={evidenceSummary.matchV4Rows} tone="cyan" />
        <HistorySummaryCard label="Defense Impact" value={evidenceSummary.defenseRows} tone="rose" />
        <HistorySummaryCard label="Pit Priors" value={evidenceSummary.pitRows} tone="emerald" />
        <HistorySummaryCard label="Unsynced" value={unsyncedRecords.length} tone={unsyncedRecords.length > 0 ? 'amber' : 'slate'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="admin-g2 border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Evidence Pipeline</div>
              <h2 className="mt-1 text-xl font-black text-white">What this device can prove</h2>
            </div>
            <div className="text-sm font-semibold text-slate-400">Latest: {formatRecordTime(evidenceSummary.latestUpdate)}</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <EvidencePipelineCard
              icon={<Wrench className="h-4 w-4" />}
              title="Capability Priors"
              value={`${evidenceSummary.pitRows} pit row${evidenceSummary.pitRows === 1 ? '' : 's'}`}
              detail="Before enough matches exist, these rows seed compatibility, mechanism risk, and questions to verify."
              toneClass={getMissionToneClasses('emerald')}
            />
            <EvidencePipelineCard
              icon={<BarChart3 className="h-4 w-4" />}
              title="PPA Strength"
              value={`${evidenceSummary.ppaStrengthRows} strong row${evidenceSummary.ppaStrengthRows === 1 ? '' : 's'}`}
              detail="V4 match and defense evidence strengthen expected value, floor, ceiling, role, and TailGuard risk."
              toneClass={getMissionToneClasses('cyan')}
            />
            <EvidencePipelineCard
              icon={<Database className="h-4 w-4" />}
              title="Admin Handoff"
              value={unsyncedRecords.length > 0 ? `${unsyncedRecords.length} unsynced` : 'Sync clear'}
              detail="Synced or exported rows are the evidence Admin V4 can audit, model, visualize, and report."
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
                  {record.recordType === 'matchV4' ? (
                    (() => {
                      const matchPayload = record.payload as MatchScoutingV4;
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
                            {record.syncStatus !== 'synced' && (
                              <span className="admin-g2-sm bg-rose-500/15 px-3 py-1 text-xs font-black tracking-wider text-rose-200">
                                {record.syncStatus === 'pending_sync' ? 'Pending Sync' : 'Unsynced'}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-slate-300">
                            <span className="font-bold text-white">{matchPayload.scoutName || 'Unknown Scout'}</span>
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
                            <span className="font-bold text-white">{matchPayload.scoutName || 'Unknown Scout'}</span>
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
                            <span className="font-bold text-white">{defensePayload.scoutName || 'Unknown Scout'}</span>
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

                  {record.syncStatus !== 'synced' && record.lastFirebaseError && (
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
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start xl:self-center">
                  {record.syncStatus !== 'synced' && (
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
                  <button
                    onClick={() => void handleDelete(record)}
                    className="admin-g2-sm flex items-center gap-2 border border-rose-400/30 bg-rose-500/15 px-4 py-2 font-black tracking-wide text-rose-50 hover:bg-rose-500/25"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
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

function HistorySummaryCard({
  label,
  value,
  tone = 'slate'
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'amber' | 'rose' | 'cyan' | 'emerald';
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
          : 'border-slate-800 bg-slate-900/80 text-white';
  return (
    <div className={`admin-g2 border px-5 py-4 ${toneClass}`}>
      <div className="text-xs font-black uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
