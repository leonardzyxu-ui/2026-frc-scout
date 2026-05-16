import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock3, Download, Edit3, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, MatchScoutingV4, PitScoutingV2 } from '../types';
import { DEFAULT_EVENT_KEY } from '../utils/sharedEventState';
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

type HistoryRow = ScoutArchiveRecord;

const toMatchPayloadV3 = (payload: MatchScoutingV2 | MatchScoutingV3) =>
  isMatchScoutingV3(payload) ? payload : mapLegacyMatchScoutingToV3(payload);

const toDefensePayloadV1 = (payload: MatchDefenseScoutingV1) =>
  isMatchDefenseScoutingV1(payload) ? payload : null;

function getMatchNumber(matchKey: string) {
  const match = matchKey.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

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

  const eventKey = DEFAULT_EVENT_KEY;

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
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-500">
            MY HISTORY
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
            Local IndexedDB archive for {eventKey}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleRetryAllUnsynced()}
            disabled={isBulkSyncing || unsyncedRecords.length === 0}
            className="bg-amber-600 px-4 py-2 rounded-lg font-bold text-sm text-white hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <UploadCloud className={`w-4 h-4 ${isBulkSyncing ? 'animate-bounce' : ''}`} />
            Sync Unsynced ({unsyncedRecords.length})
          </button>
          <button
            onClick={() => void handleDownloadArchive()}
            className="bg-cyan-600 px-4 py-2 rounded-lg font-bold text-sm text-white hover:bg-cyan-500 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download JSON
          </button>
          <button
            onClick={() => void handleRefresh()}
            disabled={isLoading}
            className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/')}
            className="bg-slate-800 px-4 py-2 rounded-lg font-bold text-sm text-slate-300 hover:bg-slate-700 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
          {syncMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <HistorySummaryCard label="Active Records" value={recentRecords.length} />
        <HistorySummaryCard label="Unsynced" value={unsyncedRecords.length} tone="amber" />
        <HistorySummaryCard label="Deleted Tombstones" value={deletedRecords.length} tone="rose" />
        <HistorySummaryCard label="JSON Export" value="All details preserved" tone="cyan" />
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock3 className="w-4 h-4" />
            <span className="font-black uppercase tracking-wider text-sm">Active Local Records</span>
          </div>
          <div className="text-xs font-mono text-slate-400">
            {recentRecords.length} active item{recentRecords.length === 1 ? '' : 's'}
          </div>
        </div>

        {isLoading ? (
          <div className="px-5 py-10 text-center text-slate-400 font-semibold">Loading local history...</div>
        ) : recentRecords.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 font-semibold">
            No local scouting datasets found for this event yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {recentRecords.map((record) => (
              <div key={record.recordId} className="px-5 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  {record.recordType === 'matchV4' ? (
                    (() => {
                      const matchPayload = record.payload as MatchScoutingV4;
                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-black tracking-wider text-fuchsia-200">
                              MATCH V4
                            </span>
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              {matchPayload.matchKey.toUpperCase()}
                            </span>
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              Team {matchPayload.teamNumber}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black tracking-wider ${
                                matchPayload.alliance === 'Red'
                                  ? 'bg-red-500/15 text-red-200'
                                  : matchPayload.alliance === 'Blue'
                                    ? 'bg-blue-500/15 text-blue-200'
                                    : 'bg-slate-800 text-slate-200'
                              }`}
                            >
                              {matchPayload.alliance || 'No Alliance'}
                            </span>
                            <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-black tracking-wider text-cyan-200">
                              {matchPayload.totalMatchPoints} pts
                            </span>
                            {record.syncStatus !== 'synced' && (
                              <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-black tracking-wider text-rose-200">
                                {record.syncStatus === 'pending_sync' ? 'Pending Sync' : 'Unsynced'}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-slate-300">
                            <span className="font-bold text-white">{matchPayload.scoutName || 'Unknown Scout'}</span>
                            {' • '}
                            {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : 'No timestamp'}
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
                            <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-black tracking-wider text-purple-200">
                              MATCH V3
                            </span>
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              {matchPayload.matchKey.toUpperCase()}
                            </span>
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              Team {matchPayload.teamNumber}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black tracking-wider ${
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
                              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black tracking-wider text-amber-200">
                                Legacy Import
                              </span>
                            )}
                            {record.syncStatus !== 'synced' && (
                              <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-black tracking-wider text-rose-200">
                                {record.syncStatus === 'pending_sync' ? 'Pending Sync' : 'Unsynced'}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-slate-300">
                            <span className="font-bold text-white">{matchPayload.scoutName || 'Unknown Scout'}</span>
                            {' • '}
                            {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : 'No timestamp'}
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
                            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black tracking-wider text-emerald-200">
                              DEFENSE V1
                            </span>
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              {defensePayload.matchKey.toUpperCase()}
                            </span>
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                              Team {defensePayload.teamNumber}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-black tracking-wider ${
                                defensePayload.alliance === 'Red'
                                  ? 'bg-red-500/15 text-red-200'
                                  : defensePayload.alliance === 'Blue'
                                    ? 'bg-blue-500/15 text-blue-200'
                                    : 'bg-slate-800 text-slate-200'
                              }`}
                            >
                              {defensePayload.alliance || 'No Alliance'}
                            </span>
                            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-black tracking-wider text-emerald-200">
                              {((defensePayload.defenseMetric || 0) * 100).toFixed(2)}%
                            </span>
                            {record.syncStatus !== 'synced' && (
                              <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-black tracking-wider text-rose-200">
                                {record.syncStatus === 'pending_sync' ? 'Pending Sync' : 'Unsynced'}
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-slate-300">
                            <span className="font-bold text-white">{defensePayload.scoutName || 'Unknown Scout'}</span>
                            {' • '}
                            {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : 'No timestamp'}
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
                        <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-black tracking-wider text-cyan-200">
                          PIT
                        </span>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                          Team {(record.payload as PitScoutingV2).teamNumber}
                        </span>
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black tracking-wider text-slate-200">
                          {(record.payload as PitScoutingV2).teamName}
                        </span>
                        {record.syncStatus !== 'synced' && (
                          <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-black tracking-wider text-rose-200">
                            {record.syncStatus === 'pending_sync' ? 'Pending Sync' : 'Unsynced'}
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-slate-300">
                        <span className="font-bold text-white">
                          {(record.payload as PitScoutingV2).scoutName || 'Pit Scout'}
                        </span>
                        {' • '}
                        {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : 'No timestamp'}
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
                      className={`max-w-3xl rounded-xl px-3 py-2 text-xs font-bold ${
                        record.lastFirebaseError.toLowerCase().includes('conflict')
                          ? 'border border-rose-500/40 bg-rose-500/10 text-rose-100'
                          : 'border border-amber-500/40 bg-amber-500/10 text-amber-100'
                      }`}
                    >
                      {record.lastFirebaseError}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start md:self-center">
                  {record.syncStatus !== 'synced' && (
                    <button
                      onClick={() => void handleRetrySync(record)}
                      className="bg-amber-600 hover:bg-amber-500 text-white font-black tracking-wide px-4 py-2 rounded-xl flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry Sync
                    </button>
                  )}
                  {(record.recordType === 'matchV4' || record.recordType === 'pit') && (
                    <button
                      onClick={() => handleEdit(record)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black tracking-wide px-4 py-2 rounded-xl flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => void handleDelete(record)}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-black tracking-wide px-4 py-2 rounded-xl flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 overflow-hidden">
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
                    <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-black uppercase text-rose-100">
                      Deleted
                    </span>
                    <span className="rounded-full bg-slate-950/70 px-3 py-1 text-xs font-mono font-black text-rose-50">
                      {record.recordType}
                    </span>
                    <span className="rounded-full bg-slate-950/70 px-3 py-1 text-xs font-mono font-black text-rose-50">
                      {record.logicalId}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-rose-100/70">
                    Details are preserved inside the local archive and JSON export for accountability.
                  </div>
                </div>
                <div className="text-xs font-mono text-rose-100/70">
                  {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : 'No timestamp'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
  tone?: 'slate' | 'amber' | 'rose' | 'cyan';
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
      : tone === 'rose'
        ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
        : tone === 'cyan'
          ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100'
          : 'border-slate-800 bg-slate-900/80 text-white';
  return (
    <div className={`rounded-3xl border px-5 py-4 ${toneClass}`}>
      <div className="text-xs font-black uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
