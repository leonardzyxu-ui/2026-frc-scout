import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { decompressScoutingData, ScoutingImportRecord } from '../utils/qrCompression';
import { ArrowLeft, AlertTriangle, Database, ScanLine, Trash2, Upload, X } from 'lucide-react';
import { writeMatchDefenseScoutingRecord, writeMatchScoutingV3Record, writeMatchScoutingV4Record, writePitScoutingRecord } from '../utils/scoutingWrites';
import {
  importScoutArchiveBundleLocally,
  isScoutArchiveBundle,
  ScoutArchiveRecord,
  ScoutArchiveSource,
  updateScoutArchiveRecordSyncState,
  upsertMatchArchiveRecordV3,
  upsertMatchArchiveRecordV4,
  upsertMatchDefenseArchiveRecord,
  upsertPitArchiveRecord
} from '../utils/scoutArchive';
import { isMatchScoutingV3, mapLegacyMatchScoutingToV3 } from '../utils/matchScoutingV3';
import { isMatchScoutingV4 } from '../utils/matchScoutingV4';
import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, MatchScoutingV4, PitScoutingV2 } from '../types';
import { stableStringify } from '../utils/keys';
import { SCOUTING_MISSIONS, ScoutingMissionKey, getMissionToneClasses } from '../utils/scoutingWorkflow';

type ImportStatus = 'pending' | 'uploaded' | 'duplicate' | 'conflict' | 'failed';
type StageOutcome = 'added' | 'duplicate' | 'conflict' | false;

interface StagedImportItem {
  id: string;
  hash: string;
  logicalKey: string;
  versionTimestamp: number;
  record: ScoutingImportRecord;
  source: ScoutArchiveSource;
  status: ImportStatus;
  message: string;
}

const STATUS_CLASSES: Record<ImportStatus, string> = {
  pending: 'bg-slate-800 text-slate-200',
  uploaded: 'bg-emerald-500/15 text-emerald-200',
  duplicate: 'bg-amber-500/15 text-amber-200',
  conflict: 'bg-rose-500/15 text-rose-200',
  failed: 'bg-red-500/15 text-red-200'
};

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

const isJsonImportFile = (file: File) => {
  const name = file.name.toLowerCase();
  return name.endsWith('.json') || file.type === 'application/json' || file.type === 'text/json';
};

const isImageImportFile = (file: File) => file.type.startsWith('image/');

const getTargetCollection = (record: ScoutingImportRecord) =>
  record.recordType === 'match'
    ? 'matchScoutingV3'
    : record.recordType === 'matchV4'
      ? 'matchScoutingV4'
      : record.recordType === 'matchDefense'
        ? 'matchScoutingDefense'
        : 'pitScouting';

const getImportEvidenceMeta = (record: ScoutingImportRecord): {
  missionKey: ScoutingMissionKey;
  title: string;
  decisionUse: string;
  ppaSignal: string;
  value: string;
  toneClass: string;
} => {
  if (record.recordType === 'matchV4') {
    return {
      missionKey: 'matchScout',
      title: 'Match evidence',
      decisionUse: 'Feeds Now, Matches, Pick List, Visualize, and Reports.',
      ppaSignal: 'Expected value, floor risk, role fit, volatility, and scout confidence.',
      value: `${record.data.totalMatchPoints} pts`,
      toneClass: getMissionToneClasses('cyan')
    };
  }

  if (record.recordType === 'match') {
    return {
      missionKey: 'matchScout',
      title: 'Legacy match evidence',
      decisionUse: 'Feeds raw audit and historical team context; V4 rows are stronger for PPA.',
      ppaSignal: 'Scoring context without the full V4 role/reliability shape.',
      value: `${record.data.totalMatchPoints} pts`,
      toneClass: getMissionToneClasses('cyan')
    };
  }

  if (record.recordType === 'matchDefense') {
    return {
      missionKey: 'defenseScout',
      title: 'Defense impact evidence',
      decisionUse: 'Feeds next-match role plans, defender assignment, and pick-list role balance.',
      ppaSignal: 'Protects PPA from mistaking strategic defense for weak offense.',
      value: `${((record.data.defenseMetric || 0) * 100).toFixed(1)}%`,
      toneClass: getMissionToneClasses('rose')
    };
  }

  return {
    missionKey: 'pitScout',
    title: 'Pit capability prior',
    decisionUse: 'Feeds compatibility, pre-match questions, and early pick-list context.',
    ppaSignal: 'Human role-fit prior before enough match rows exist.',
    value: `${record.data.expectedHubBallsPerMatch || 0} expected balls`,
    toneClass: getMissionToneClasses('emerald')
  };
};

const toMatchImportRecord = (payload: MatchScoutingV2 | MatchScoutingV3): ScoutingImportRecord => ({
  recordType: 'match',
  data: isMatchScoutingV3(payload) ? payload : mapLegacyMatchScoutingToV3(payload)
});

const toMatchDefenseImportRecord = (payload: MatchDefenseScoutingV1): ScoutingImportRecord => ({
  recordType: 'matchDefense',
  data: payload
});

const toMatchV4ImportRecord = (payload: MatchScoutingV4): ScoutingImportRecord => ({
  recordType: 'matchV4',
  data: payload
});

const getLogicalKey = (record: ScoutingImportRecord) => {
  if (record.recordType === 'match') {
    return `match|${record.data.eventKey}|${record.data.matchKey}|${record.data.teamNumber}`;
  }

  if (record.recordType === 'matchV4') {
    return `matchV4|${record.data.eventKey}|${record.data.matchKey}|${record.data.teamNumber}`;
  }

  if (record.recordType === 'matchDefense') {
    return `matchDefense|${record.data.eventKey}|${record.data.matchKey}|${record.data.teamNumber}`;
  }

  return `pit|${record.eventKey}|${record.data.teamNumber}`;
};

const getRecordTimestamp = (record: ScoutingImportRecord) =>
  record.recordType === 'match' || record.recordType === 'matchV4' || record.recordType === 'matchDefense'
    ? record.data.timestamp || 0
    : record.data.timestamp || 0;

const getRecordScoutName = (record: ScoutingImportRecord) =>
  record.recordType === 'pit'
    ? record.data.scoutName || 'Imported Scout'
    : record.data.scoutName || record.data.substituteScoutName || record.data.assignedScoutName || 'Imported Scout';

const hashRecord = (record: ScoutingImportRecord) =>
  `${getLogicalKey(record)}|${stableStringify(record.data)}`;

const makeStageId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const isStagedVersionConflict = (item: StagedImportItem) =>
  item.status === 'conflict' && item.message.startsWith('Conflicts with another staged version');

const reconcileStagedVersionConflicts = (items: StagedImportItem[]) =>
  items.map(item => {
    const sameLogicalCount = items.filter(candidate => candidate.logicalKey === item.logicalKey).length;
    if (sameLogicalCount === 1 && isStagedVersionConflict(item)) {
      return {
        ...item,
        status: 'pending' as const,
        message: `Ready for ${getTargetCollection(item.record)}`
      };
    }
    return item;
  });

const upsertImportArchiveRecord = async (
  record: ScoutingImportRecord,
  source: ScoutArchiveSource,
  syncState: Parameters<typeof upsertMatchArchiveRecordV3>[3]
) => {
  const username = getRecordScoutName(record);

  if (record.recordType === 'match') {
    return await upsertMatchArchiveRecordV3(record.data, username, source, syncState);
  }

  if (record.recordType === 'matchV4') {
    return await upsertMatchArchiveRecordV4(record.data, username, source, syncState);
  }

  if (record.recordType === 'matchDefense') {
    return await upsertMatchDefenseArchiveRecord(record.data, username, source, syncState);
  }

  return await upsertPitArchiveRecord(record.eventKey, record.data, username, source, syncState);
};

export default function QRScannerView({
  isEmbedded = false,
  isActive = true,
  onArchiveChanged
}: {
  isEmbedded?: boolean;
  isActive?: boolean;
  onArchiveChanged?: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const [stagedData, setStagedData] = useState<StagedImportItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [html5QrCode, setHtml5QrCode] = useState<Html5Qrcode | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logMsg, setLogMsg] = useState<string | null>(null);
  const [failedFiles, setFailedFiles] = useState<{ file: File; url: string }[]>([]);

  const sessionHashes = useRef<Set<string>>(new Set());
  const stagedDataRef = useRef<StagedImportItem[]>([]);

  useEffect(() => {
    stagedDataRef.current = stagedData;
  }, [stagedData]);

  useEffect(() => {
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
      failedFiles.forEach(file => URL.revokeObjectURL(file.url));
    };
  }, [failedFiles, html5QrCode]);

  useEffect(() => {
    if (!isActive && html5QrCode?.isScanning) {
      html5QrCode.stop()
        .then(() => setIsScanning(false))
        .catch(console.error);
    }
  }, [html5QrCode, isActive]);

  const initScanner = () => {
    if (!html5QrCode) {
      setHtml5QrCode(new Html5Qrcode('qr-reader'));
    }
  };

  const addStagedRecord = (record: ScoutingImportRecord, source: ScoutArchiveSource = 'qr_import'): StageOutcome => {
    const currentStagedData = stagedDataRef.current;
    const nextHash = hashRecord(record);
    const nextLogicalKey = getLogicalKey(record);
    const nextTimestamp = getRecordTimestamp(record);
    if (sessionHashes.current.has(nextHash) || currentStagedData.some(entry => entry.hash === nextHash)) {
      return 'duplicate';
    }

    const existingLogicalRecord = currentStagedData.find(entry => entry.logicalKey === nextLogicalKey);
    if (existingLogicalRecord) {
      const nextItem = {
        id: makeStageId(),
        hash: nextHash,
        logicalKey: nextLogicalKey,
        versionTimestamp: nextTimestamp,
        record,
        source,
        status: 'conflict' as const,
        message: `Conflicts with another staged version for ${getTargetCollection(record)}`
      };
      const nextStagedData = [
        ...currentStagedData.map(entry =>
          entry.logicalKey === nextLogicalKey
            ? {
                ...entry,
                status: 'conflict' as const,
                message: `Conflicts with another staged version for ${getTargetCollection(entry.record)}`
              }
            : entry
        ),
        nextItem
      ];
      stagedDataRef.current = nextStagedData;
      setStagedData(nextStagedData);
      sessionHashes.current.add(nextHash);
      return 'conflict';
    }

    const nextItem = {
      id: makeStageId(),
      hash: nextHash,
      logicalKey: nextLogicalKey,
      versionTimestamp: nextTimestamp,
      record,
      source,
      status: 'pending' as const,
      message: `Ready for ${getTargetCollection(record)}`
    };
    const nextStagedData = [
      ...currentStagedData,
      nextItem
    ];
    stagedDataRef.current = nextStagedData;
    setStagedData(nextStagedData);
    sessionHashes.current.add(nextHash);
    return 'added';
  };

  const processDecodedText = (decodedText: string, source: ScoutArchiveSource = 'qr_import'): StageOutcome => {
    const parsed = decompressScoutingData(decodedText);
    if (!parsed) return false;
    return addStagedRecord(parsed, source);
  };

  const handleScanSuccess = async (decodedText: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const added = processDecodedText(decodedText);
      setLogMsg(
        added === 'added'
          ? '✅ Successfully staged scouting data from camera.'
          : added === 'conflict'
            ? '🚨 Staged a conflict. Review the conflicting item before pushing.'
          : '⚠️ Skipped duplicate scouting data.'
      );
      setTimeout(() => {
        setLogMsg(null);
        setIsProcessing(false);
      }, 3000);
    } catch (error) {
      setLogMsg(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setIsProcessing(false);
      setTimeout(() => setLogMsg(null), 3000);
    }
  };

  const startCam = () => {
    initScanner();
    const scanner = html5QrCode || new Html5Qrcode('qr-reader');
    if (!html5QrCode) {
      setHtml5QrCode(scanner);
    }

    setIsScanning(true);
    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      handleScanSuccess,
      () => {}
    ).catch(error => {
      setLogMsg(`Camera start failed: ${String(error)}`);
      setIsScanning(false);
      setTimeout(() => setLogMsg(null), 3000);
    });
  };

  const stopCam = () => {
    if (html5QrCode && html5QrCode.isScanning) {
      html5QrCode.stop().then(() => setIsScanning(false)).catch(console.error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const files = Array.from(event.target.files);
    let successCount = 0;
    let duplicateCount = 0;
    let conflictCount = 0;
    let failCount = 0;
    const nextFailedFiles: { file: File; url: string }[] = [];

    setIsProcessing(true);
    setLogMsg(`Processing ${files.length} file(s)...`);

    const scanner = html5QrCode || new Html5Qrcode('qr-reader');
    if (!html5QrCode) {
      setHtml5QrCode(scanner);
    }

    for (const file of files) {
      try {
        if (file.size > MAX_IMPORT_FILE_BYTES) {
          failCount += 1;
          continue;
        }

        if (!isJsonImportFile(file) && !isImageImportFile(file)) {
          failCount += 1;
          continue;
        }

        if (isJsonImportFile(file)) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === 'string' && decompressScoutingData(item)) {
                const added = processDecodedText(item, 'json_import');
                if (added === 'added') successCount += 1;
                else if (added === 'conflict') conflictCount += 1;
                else duplicateCount += 1;
              } else if (isMatchScoutingV4(item)) {
                const outcome = addStagedRecord(toMatchV4ImportRecord(item), 'json_import');
                if (outcome === 'added') successCount += 1;
                else if (outcome === 'conflict') conflictCount += 1;
                else duplicateCount += 1;
              } else if (isMatchScoutingV3(item)) {
                const outcome = addStagedRecord(toMatchImportRecord(item), 'json_import');
                if (outcome === 'added') successCount += 1;
                else if (outcome === 'conflict') conflictCount += 1;
                else duplicateCount += 1;
              } else if (item && typeof item === 'object' && (item as MatchDefenseScoutingV1).schemaVersion === 'defense-v1') {
                const outcome = addStagedRecord(toMatchDefenseImportRecord(item as MatchDefenseScoutingV1), 'json_import');
                if (outcome === 'added') successCount += 1;
                else if (outcome === 'conflict') conflictCount += 1;
                else duplicateCount += 1;
              }
            }
          } else if (isScoutArchiveBundle(parsed)) {
            let deletedCount = 0;
            const restoreResult = await importScoutArchiveBundleLocally(parsed);
            parsed.records.forEach((archiveRecord: ScoutArchiveRecord) => {
              if (archiveRecord.deleted) {
                deletedCount += 1;
                return;
              }

              let importRecord: ScoutingImportRecord | null = null;
              if (archiveRecord.recordType === 'match') {
                importRecord = toMatchImportRecord(archiveRecord.payload as MatchScoutingV2 | MatchScoutingV3);
              } else if (archiveRecord.recordType === 'matchV4' && isMatchScoutingV4(archiveRecord.payload)) {
                importRecord = toMatchV4ImportRecord(archiveRecord.payload);
              } else if (archiveRecord.recordType === 'matchDefense') {
                importRecord = toMatchDefenseImportRecord(archiveRecord.payload as MatchDefenseScoutingV1);
              } else if (archiveRecord.recordType === 'pit') {
                importRecord = { recordType: 'pit', eventKey: archiveRecord.eventKey, data: archiveRecord.payload as PitScoutingV2 };
              }
              if (!importRecord) {
                duplicateCount += 1;
                return;
              }
              const outcome = addStagedRecord(importRecord, 'json_import');
              if (outcome === 'added') successCount += 1;
              else if (outcome === 'conflict') conflictCount += 1;
              else duplicateCount += 1;
            });
            const restoredPowerCoinItems = restoreResult.powerCoinBetsImported + restoreResult.powerCoinLedgerImported;
            if (deletedCount > 0 || restoredPowerCoinItems > 0 || restoreResult.conflictsPreserved > 0) {
              setLogMsg(
                `Restored ${restoreResult.imported} local archive record${restoreResult.imported === 1 ? '' : 's'} and ${restoredPowerCoinItems} PowerCoin item${restoredPowerCoinItems === 1 ? '' : 's'}. Preserved ${restoreResult.conflictsPreserved} local conflict version${restoreResult.conflictsPreserved === 1 ? '' : 's'} separately. Skipped ${deletedCount} deleted record${deletedCount === 1 ? '' : 's'} from staging.`
              );
            }
          } else if (isMatchScoutingV4(parsed)) {
            const outcome = addStagedRecord(toMatchV4ImportRecord(parsed), 'json_import');
            if (outcome === 'added') successCount += 1;
            else if (outcome === 'conflict') conflictCount += 1;
            else duplicateCount += 1;
          } else if (isMatchScoutingV3(parsed)) {
            const outcome = addStagedRecord(toMatchImportRecord(parsed), 'json_import');
            if (outcome === 'added') successCount += 1;
            else if (outcome === 'conflict') conflictCount += 1;
            else duplicateCount += 1;
          } else if (parsed && typeof parsed === 'object' && (parsed as MatchDefenseScoutingV1).schemaVersion === 'defense-v1') {
            const outcome = addStagedRecord(toMatchDefenseImportRecord(parsed as MatchDefenseScoutingV1), 'json_import');
            if (outcome === 'added') successCount += 1;
            else if (outcome === 'conflict') conflictCount += 1;
            else duplicateCount += 1;
          }
        } else {
          const decodedText = await scanner.scanFile(file, true);
          const added = processDecodedText(decodedText);
          if (added === 'added') successCount += 1;
          else if (added === 'conflict') conflictCount += 1;
          else duplicateCount += 1;
        }
      } catch (error) {
        console.warn(`Failed to process ${file.name}`, error);
        failCount += 1;
        if (isImageImportFile(file)) {
          nextFailedFiles.push({ file, url: URL.createObjectURL(file) });
        }
      }
    }

    setFailedFiles(prev => [...prev, ...nextFailedFiles]);
    setLogMsg(`✅ Bulk import complete! Staged: ${successCount} | Conflicts: ${conflictCount} | Skipped: ${duplicateCount} | Failed: ${failCount}`);
    setIsProcessing(false);
    event.target.value = '';
    void onArchiveChanged?.();
  };

  const handlePushToDatabase = async () => {
    if (stagedData.length === 0) return;
    setIsProcessing(true);
    setLogMsg('Pushing to database...');

    let uploadedCount = 0;
    let duplicateCount = 0;
    let conflictCount = 0;
    let failCount = 0;

    const updatedItems: StagedImportItem[] = [];

    for (const item of stagedData) {
      if (item.status === 'conflict') {
        conflictCount += 1;
        updatedItems.push(item);
        continue;
      }

      try {
        const attemptAt = Date.now();
        const archiveRecord = await upsertImportArchiveRecord(item.record, item.source, {
          syncStatus: 'pending_sync',
          lastFirebaseAttemptAt: attemptAt,
          lastFirebaseError: '',
          preserveExistingOnConflict: true
        });

        const writeResult =
          item.record.recordType === 'match'
            ? await writeMatchScoutingV3Record(item.record.data, { mode: 'strict' })
            : item.record.recordType === 'matchV4'
              ? await writeMatchScoutingV4Record(item.record.data, { mode: 'strict' })
              : item.record.recordType === 'matchDefense'
                ? await writeMatchDefenseScoutingRecord(item.record.data, { mode: 'strict' })
                : await writePitScoutingRecord(item.record.eventKey, item.record.data, { mode: 'strict' });

        if (writeResult.outcome === 'duplicate') {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'synced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: ''
          });
          duplicateCount += 1;
          updatedItems.push({ ...item, status: 'duplicate', message: writeResult.message });
          continue;
        }

        if (writeResult.outcome === 'conflict') {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: writeResult.message
          });
          conflictCount += 1;
          updatedItems.push({ ...item, status: 'conflict', message: writeResult.message });
          continue;
        }

        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'synced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: ''
        });
        uploadedCount += 1;
        updatedItems.push({ ...item, status: 'uploaded', message: writeResult.message });
      } catch (error) {
        console.error('Error uploading staged scouting data', error);
        try {
          const archiveRecord = await upsertImportArchiveRecord(item.record, item.source, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: error instanceof Error ? error.message : 'Upload failed.',
            preserveExistingOnConflict: true
          });
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: error instanceof Error ? error.message : 'Upload failed.'
          });
        } catch (archiveError) {
          console.error('Error preserving staged import in local archive', archiveError);
        }
        failCount += 1;
        updatedItems.push({
          ...item,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Upload failed.'
        });
      }
    }

    const remainingItems = updatedItems.filter(item => item.status === 'pending' || item.status === 'conflict' || item.status === 'failed');
    sessionHashes.current = new Set(remainingItems.map(item => item.hash));
    setStagedData(remainingItems);
    setLogMsg(
      `✅ Push complete! Uploaded: ${uploadedCount} | Skipped as duplicate: ${duplicateCount} | Blocked as conflict: ${conflictCount} | Failed: ${failCount}`
    );
    setIsProcessing(false);
    void onArchiveChanged?.();
  };

  const removeStagedItem = (id: string) => {
    setStagedData(prev => {
      const target = prev.find(item => item.id === id);
      if (target) {
        sessionHashes.current.delete(target.hash);
      }
      const nextItems = reconcileStagedVersionConflicts(prev.filter(item => item.id !== id));
      stagedDataRef.current = nextItems;
      return nextItems;
    });
  };
  const stagedSummary = {
    match: stagedData.filter(item => item.record.recordType === 'match' || item.record.recordType === 'matchV4').length,
    defense: stagedData.filter(item => item.record.recordType === 'matchDefense').length,
    pit: stagedData.filter(item => item.record.recordType === 'pit').length,
    conflicts: stagedData.filter(item => item.status === 'conflict').length,
    ready: stagedData.filter(item => item.status === 'pending').length
  };

  return (
    <div className={isEmbedded ? '' : 'min-h-screen bg-slate-950 p-4 font-sans text-slate-200 md:p-8'}>
      <div className={isEmbedded ? 'space-y-8' : 'mx-auto max-w-5xl space-y-8'}>
        {!isEmbedded && (
          <div className="admin-g2 flex items-center gap-4 border border-slate-800 bg-slate-900/50 p-6">
            <button
              onClick={() => navigate('/')}
              className="admin-g2-sm bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-slate-700"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Evidence Intake</div>
              <h1 className="mt-1 flex items-center gap-3 text-3xl font-black tracking-tight text-white">
                <ScanLine className="h-8 w-8 text-emerald-500" />
                QR And Archive Staging
              </h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-400">
                Intake scout evidence from QR images, live camera scans, or JSON archives. Stage it first, inspect what decision surface it feeds, then push only the rows you trust.
              </p>
            </div>
          </div>
        )}

        <section className="admin-g2 border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Admin Data Intake</div>
              <h2 className="mt-1 text-2xl font-black text-white">From field devices to usable PPA evidence</h2>
            </div>
            <div className="text-sm font-semibold text-slate-400">Scan or upload, resolve conflicts, then sync.</div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <IntakeSummaryCard label="Ready" value={stagedSummary.ready} tone="cyan" />
            <IntakeSummaryCard label="Match Rows" value={stagedSummary.match} />
            <IntakeSummaryCard label="Defense Rows" value={stagedSummary.defense} tone="rose" />
            <IntakeSummaryCard label="Pit Priors" value={stagedSummary.pit} tone="emerald" />
            <IntakeSummaryCard label="Conflicts" value={stagedSummary.conflicts} tone={stagedSummary.conflicts > 0 ? 'amber' : 'slate'} />
          </div>
        </section>

        <div className={isEmbedded ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'}>
          <div className="space-y-6">
            <div className="admin-g2 flex flex-col items-center border border-slate-800 bg-slate-900/50 p-6">
              <div className="mb-6 flex w-full gap-4">
                {!isScanning ? (
                  <button onClick={startCam} className="admin-g2-sm flex-1 border border-cyan-400/30 bg-cyan-500/15 py-3 font-black text-cyan-50 shadow-lg transition-all active:scale-95 hover:bg-cyan-500/25">
                    Start Camera
                  </button>
                ) : (
                  <button onClick={stopCam} className="admin-g2-sm flex-1 border border-rose-400/30 bg-rose-500/15 py-3 font-black text-rose-50 shadow-lg transition-all active:scale-95 hover:bg-rose-500/25">
                    Stop Camera
                  </button>
                )}

                <label className={`admin-g2-sm flex flex-1 cursor-pointer items-center justify-center gap-2 border border-fuchsia-400/30 bg-fuchsia-500/15 py-3 font-black text-fuchsia-50 shadow-lg transition-all active:scale-95 hover:bg-fuchsia-500/25 ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}>
                  <Upload className="h-5 w-5" />
                  Upload QR / JSON
                  <input type="file" className="hidden" accept="image/*,.json" multiple onChange={handleFileUpload} />
                </label>
              </div>

              <div className="admin-g2 relative flex aspect-square w-full items-center justify-center overflow-hidden border-2 border-slate-700 bg-black font-mono text-slate-600 shadow-2xl">
                {!isScanning && <span className="absolute z-10">Camera Offline</span>}
                <div id="qr-reader" className="absolute inset-0 h-full w-full" />
              </div>

              {logMsg && (
                <div className="admin-g2-sm mt-6 w-full border border-emerald-900 bg-emerald-950/50 p-4 text-center font-mono text-sm text-emerald-400 whitespace-pre-wrap">
                  {logMsg}
                </div>
              )}
            </div>

            {failedFiles.length > 0 && (
              <div className="admin-g2 border border-red-900/50 bg-slate-900/50 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-lg font-black text-red-500">
                    <AlertTriangle className="h-5 w-5" />
                    Failed Images ({failedFiles.length})
                  </h3>
                  <button
                    onClick={() => {
                      failedFiles.forEach(file => URL.revokeObjectURL(file.url));
                      setFailedFiles([]);
                    }}
                    className="admin-g2-sm border border-red-800 bg-red-950 px-3 py-1 text-sm text-red-400 transition-colors hover:bg-red-900"
                  >
                    Clear All
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {failedFiles.map((fileObj, index) => (
                    <div key={index} className="admin-g2-sm group relative aspect-[3/4] overflow-hidden border border-red-900 bg-black">
                      <img src={fileObj.url} alt={fileObj.file.name} className="h-full w-full object-contain" />
                      <button
                        onClick={() => {
                          URL.revokeObjectURL(fileObj.url);
                          setFailedFiles(prev => prev.filter((_, fileIndex) => fileIndex !== index));
                        }}
                        className="admin-g2-sm absolute right-1 top-1 flex h-6 w-6 items-center justify-center bg-red-600 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={`admin-g2 flex flex-col border border-slate-800 bg-slate-900/50 p-6 ${isEmbedded ? 'max-h-[640px] min-h-[420px]' : 'h-[800px]'}`}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-white">
                  <Database className="h-6 w-6 text-blue-400" />
                  Evidence Staging Area
                </h2>
                <p className="text-sm text-slate-400">{stagedData.length} records waiting for review and sync</p>
              </div>
              <button
                onClick={handlePushToDatabase}
                disabled={stagedData.length === 0 || isProcessing}
                className="admin-g2-sm flex items-center gap-2 border border-emerald-400/30 bg-emerald-500/15 px-6 py-2 font-black text-emerald-50 shadow-lg transition-all active:scale-95 hover:bg-emerald-500/25 disabled:pointer-events-none disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Push All
              </button>
            </div>

            <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
              {stagedData.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-4 text-slate-500">
                  <Database className="h-12 w-12 opacity-20" />
                  <p>No evidence staged. Scan QR codes or upload QR images / JSON files.</p>
                </div>
              ) : (
                stagedData.map((item) => {
                  const meta = getImportEvidenceMeta(item.record);
                  const mission = SCOUTING_MISSIONS[meta.missionKey];
                  return (
                  <div key={item.id} className="admin-g2-sm group border border-slate-800 bg-slate-950 p-4">
                    <div className={`admin-g2-sm mb-3 border px-3 py-3 ${meta.toneClass}`}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{mission.shortTitle}</div>
                          <div className="mt-1 text-sm font-black text-white">{meta.title}</div>
                          <div className="mt-1 text-xs font-semibold leading-relaxed opacity-80">{meta.ppaSignal}</div>
                        </div>
                        <div className="admin-g2-sm shrink-0 border border-white/15 bg-white/10 px-3 py-2 text-sm font-black text-white">{meta.value}</div>
                      </div>
                      <div className="mt-2 text-xs font-semibold leading-relaxed opacity-80">{meta.decisionUse}</div>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 w-2 self-stretch admin-g2-sm ${item.record.recordType === 'match' || item.record.recordType === 'matchV4' ? (item.record.data.alliance === 'Red' ? 'bg-red-500' : 'bg-blue-500') : 'bg-cyan-400'}`} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`admin-g2-sm px-3 py-1 text-xs font-black tracking-wider ${item.record.recordType === 'match' || item.record.recordType === 'matchV4' ? 'bg-purple-500/15 text-purple-200' : 'bg-cyan-500/15 text-cyan-200'}`}>
                              {item.record.recordType.toUpperCase()}
                            </span>
                            <span className={`admin-g2-sm px-3 py-1 text-xs font-black tracking-wider ${STATUS_CLASSES[item.status]}`}>
                              {item.status.toUpperCase()}
                            </span>
                            <span className="admin-g2-sm bg-slate-900 px-3 py-1 text-xs font-black tracking-wider text-slate-300">
                              {getTargetCollection(item.record)}
                            </span>
                            {item.record.recordType === 'match' || item.record.recordType === 'matchV4' ? (
                              <>
                                <span className="text-lg font-black text-white">{item.record.data.teamNumber}</span>
                                <span className="admin-g2-sm bg-slate-900 px-2 py-0.5 font-mono text-sm text-slate-400">{item.record.data.matchKey}</span>
                              </>
                            ) : item.record.recordType === 'matchDefense' ? (
                              <>
                                <span className="text-lg font-black text-white">{item.record.data.teamNumber}</span>
                                <span className="admin-g2-sm bg-slate-900 px-2 py-0.5 font-mono text-sm text-slate-400">{item.record.data.matchKey}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-lg font-black text-white">{item.record.data.teamNumber}</span>
                                <span className="admin-g2-sm bg-slate-900 px-2 py-0.5 font-mono text-sm text-slate-400">{item.record.eventKey}</span>
                              </>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.record.recordType === 'match' || item.record.recordType === 'matchV4'
                              ? `Scout: ${item.record.data.scoutName} | Event: ${item.record.data.eventKey}`
                              : item.record.recordType === 'matchDefense'
                                ? `Scout: ${item.record.data.scoutName || 'Unknown'} | Event: ${item.record.data.eventKey}`
                                : `Scout: ${item.record.data.scoutName || 'Unknown'} | Team: ${item.record.data.teamName || 'Unknown'}`}
                          </div>
                          <div className="mt-2 text-xs font-medium text-slate-400">{item.message}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeStagedItem(item.id)}
                        className="admin-g2-sm p-2 text-slate-500 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-950/30 hover:text-red-400"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntakeSummaryCard({
  label,
  value,
  tone = 'slate'
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'cyan' | 'emerald' | 'rose' | 'amber';
}) {
  const toneClass =
    tone === 'cyan'
      ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100'
      : tone === 'emerald'
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
        : tone === 'rose'
          ? 'border-rose-400/30 bg-rose-500/10 text-rose-100'
          : tone === 'amber'
            ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
            : 'border-slate-800 bg-slate-950/70 text-slate-200';

  return (
    <div className={`admin-g2-sm border px-4 py-3 ${toneClass}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-black text-white">{value}</div>
    </div>
  );
}
