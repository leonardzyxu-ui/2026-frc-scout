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

type ImportStatus = 'pending' | 'uploaded' | 'duplicate' | 'conflict' | 'failed';

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

const getTargetCollection = (record: ScoutingImportRecord) =>
  record.recordType === 'match'
    ? 'matchScoutingV3'
    : record.recordType === 'matchV4'
      ? 'matchScoutingV4'
      : record.recordType === 'matchDefense'
        ? 'matchScoutingDefense'
        : 'pitScouting';

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

const hashRecord = (record: ScoutingImportRecord) => {
  if (record.recordType === 'match') {
    const match = record.data;
    return `match|${match.eventKey}|${match.matchKey}|${match.teamNumber}|${match.scoutName}|${match.timestamp}`;
  }

  if (record.recordType === 'matchV4') {
    const match = record.data;
    return `matchV4|${match.eventKey}|${match.matchKey}|${match.teamNumber}|${match.scoutName}|${match.timestamp}`;
  }

  if (record.recordType === 'matchDefense') {
    const match = record.data;
    return `matchDefense|${match.eventKey}|${match.matchKey}|${match.teamNumber}|${match.scoutName}|${match.timestamp}`;
  }

  const pit = record.data;
  return `pit|${record.eventKey}|${pit.teamNumber}|${pit.scoutName}|${pit.timestamp}`;
};

const makeStageId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

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
  isActive = true
}: {
  isEmbedded?: boolean;
  isActive?: boolean;
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

  const addStagedRecord = (record: ScoutingImportRecord, source: ScoutArchiveSource = 'qr_import') => {
    const currentStagedData = stagedDataRef.current;
    const nextHash = hashRecord(record);
    const nextLogicalKey = getLogicalKey(record);
    const nextTimestamp = getRecordTimestamp(record);
    if (sessionHashes.current.has(nextHash) || currentStagedData.some(entry => entry.hash === nextHash)) {
      return 'duplicate';
    }

    const existingLogicalRecord = currentStagedData.find(entry => entry.logicalKey === nextLogicalKey);
    if (existingLogicalRecord) {
      if (nextTimestamp <= existingLogicalRecord.versionTimestamp) {
        return 'older';
      }

      const nextStagedData = currentStagedData.map(entry =>
          entry.id === existingLogicalRecord.id
            ? {
                ...entry,
                hash: nextHash,
                logicalKey: nextLogicalKey,
                versionTimestamp: nextTimestamp,
                record,
                source,
                status: 'pending' as const,
                message: `Replaced older staged version for ${getTargetCollection(record)}`
              }
            : entry
        );
      stagedDataRef.current = nextStagedData;
      setStagedData(nextStagedData);
      sessionHashes.current.delete(existingLogicalRecord.hash);
      sessionHashes.current.add(nextHash);
      return 'replaced';
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

  const processDecodedText = (decodedText: string, source: ScoutArchiveSource = 'qr_import') => {
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
        added === 'added' || added === 'replaced'
          ? '✅ Successfully staged scouting data from camera.'
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
        if (file.name.endsWith('.json')) {
          const text = await file.text();
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (typeof item === 'string' && decompressScoutingData(item)) {
                const added = processDecodedText(item, 'json_import');
                if (added === 'added' || added === 'replaced') successCount += 1;
                else duplicateCount += 1;
              } else if (isMatchScoutingV4(item)) {
                const outcome = addStagedRecord(toMatchV4ImportRecord(item), 'json_import');
                if (outcome === 'added' || outcome === 'replaced') successCount += 1;
                else duplicateCount += 1;
              } else if (isMatchScoutingV3(item)) {
                const outcome = addStagedRecord(toMatchImportRecord(item), 'json_import');
                if (outcome === 'added' || outcome === 'replaced') successCount += 1;
                else duplicateCount += 1;
              } else if (item && typeof item === 'object' && (item as MatchDefenseScoutingV1).schemaVersion === 'defense-v1') {
                const outcome = addStagedRecord(toMatchDefenseImportRecord(item as MatchDefenseScoutingV1), 'json_import');
                if (outcome === 'added' || outcome === 'replaced') successCount += 1;
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
              if (outcome === 'added' || outcome === 'replaced') successCount += 1;
              else duplicateCount += 1;
            });
            const restoredPowerCoinItems = restoreResult.powerCoinBetsImported + restoreResult.powerCoinLedgerImported;
            if (deletedCount > 0 || restoredPowerCoinItems > 0) {
              setLogMsg(
                `Restored ${restoreResult.imported} local archive record${restoreResult.imported === 1 ? '' : 's'} and ${restoredPowerCoinItems} PowerCoin item${restoredPowerCoinItems === 1 ? '' : 's'}. Skipped ${deletedCount} deleted record${deletedCount === 1 ? '' : 's'} from staging.`
              );
            }
          } else if (isMatchScoutingV4(parsed)) {
            const outcome = addStagedRecord(toMatchV4ImportRecord(parsed), 'json_import');
            if (outcome === 'added' || outcome === 'replaced') successCount += 1;
            else duplicateCount += 1;
          } else if (isMatchScoutingV3(parsed)) {
            const outcome = addStagedRecord(toMatchImportRecord(parsed), 'json_import');
            if (outcome === 'added' || outcome === 'replaced') successCount += 1;
            else duplicateCount += 1;
          } else if (parsed && typeof parsed === 'object' && (parsed as MatchDefenseScoutingV1).schemaVersion === 'defense-v1') {
            const outcome = addStagedRecord(toMatchDefenseImportRecord(parsed as MatchDefenseScoutingV1), 'json_import');
            if (outcome === 'added' || outcome === 'replaced') successCount += 1;
            else duplicateCount += 1;
          }
        } else {
          const decodedText = await scanner.scanFile(file, true);
          const added = processDecodedText(decodedText);
          if (added === 'added' || added === 'replaced') successCount += 1;
          else duplicateCount += 1;
        }
      } catch (error) {
        console.warn(`Failed to process ${file.name}`, error);
        failCount += 1;
        if (!file.name.endsWith('.json')) {
          nextFailedFiles.push({ file, url: URL.createObjectURL(file) });
        }
      }
    }

    setFailedFiles(prev => [...prev, ...nextFailedFiles]);
    setLogMsg(`✅ Bulk import complete! Staged: ${successCount} | Skipped: ${duplicateCount} | Failed: ${failCount}`);
    setIsProcessing(false);
    event.target.value = '';
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
          lastFirebaseError: ''
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
            lastFirebaseError: error instanceof Error ? error.message : 'Upload failed.'
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
  };

  const removeStagedItem = (id: string) => {
    setStagedData(prev => {
      const target = prev.find(item => item.id === id);
      if (target) {
        sessionHashes.current.delete(target.hash);
      }
      return prev.filter(item => item.id !== id);
    });
  };

  return (
    <div className={isEmbedded ? '' : 'min-h-screen bg-slate-950 p-4 font-sans text-slate-200 md:p-8'}>
      <div className={isEmbedded ? 'space-y-8' : 'mx-auto max-w-5xl space-y-8'}>
        {!isEmbedded && (
          <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <button
              onClick={() => navigate('/')}
              className="rounded-lg bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-slate-700"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white">
                <ScanLine className="h-8 w-8 text-emerald-500" />
                DATA IMPORT & STAGING
              </h1>
              <p className="mt-1 text-slate-400">Offline protocol for V4, defense, legacy match, and pit scouting data.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="mb-6 flex w-full gap-4">
                {!isScanning ? (
                  <button onClick={startCam} className="flex-1 rounded-lg bg-blue-600 py-3 font-bold text-white shadow-lg transition-all active:scale-95 hover:bg-blue-500">
                    📷 Start Camera
                  </button>
                ) : (
                  <button onClick={stopCam} className="flex-1 rounded-lg bg-red-600 py-3 font-bold text-white shadow-lg transition-all active:scale-95 hover:bg-red-500">
                    🛑 Stop Camera
                  </button>
                )}

                <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 font-bold text-white shadow-lg transition-all active:scale-95 hover:bg-indigo-500 ${isProcessing ? 'pointer-events-none opacity-50' : ''}`}>
                  <Upload className="h-5 w-5" />
                  Upload QR / JSON
                  <input type="file" className="hidden" accept="image/*,.json" multiple onChange={handleFileUpload} />
                </label>
              </div>

              <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border-2 border-slate-700 bg-black font-mono text-slate-600 shadow-2xl">
                {!isScanning && <span className="absolute z-10">Camera Offline</span>}
                <div id="qr-reader" className="absolute inset-0 h-full w-full" />
              </div>

              {logMsg && (
                <div className="mt-6 w-full rounded-xl border border-emerald-900 bg-emerald-950/50 p-4 text-center font-mono text-sm text-emerald-400 whitespace-pre-wrap">
                  {logMsg}
                </div>
              )}
            </div>

            {failedFiles.length > 0 && (
              <div className="rounded-2xl border border-red-900/50 bg-slate-900/50 p-6">
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
                    className="rounded-lg border border-red-800 bg-red-950 px-3 py-1 text-sm text-red-400 transition-colors hover:bg-red-900"
                  >
                    Clear All
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {failedFiles.map((fileObj, index) => (
                    <div key={index} className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-red-900 bg-black">
                      <img src={fileObj.url} alt={fileObj.file.name} className="h-full w-full object-contain" />
                      <button
                        onClick={() => {
                          URL.revokeObjectURL(fileObj.url);
                          setFailedFiles(prev => prev.filter((_, fileIndex) => fileIndex !== index));
                        }}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex h-[800px] flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-white">
                  <Database className="h-6 w-6 text-blue-400" />
                  Staging Area
                </h2>
                <p className="text-sm text-slate-400">{stagedData.length} records waiting for action</p>
              </div>
              <button
                onClick={handlePushToDatabase}
                disabled={stagedData.length === 0 || isProcessing}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 font-bold text-white shadow-lg transition-all active:scale-95 hover:bg-emerald-500 disabled:pointer-events-none disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                Push All
              </button>
            </div>

            <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2">
              {stagedData.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center space-y-4 text-slate-500">
                  <Database className="h-12 w-12 opacity-20" />
                  <p>No data staged. Scan QR codes or upload QR images / JSON files.</p>
                </div>
              ) : (
                stagedData.map((item) => (
                  <div key={item.id} className="group rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 w-2 self-stretch rounded-full ${item.record.recordType === 'match' || item.record.recordType === 'matchV4' ? (item.record.data.alliance === 'Red' ? 'bg-red-500' : 'bg-blue-500') : 'bg-cyan-400'}`} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-black tracking-wider ${item.record.recordType === 'match' || item.record.recordType === 'matchV4' ? 'bg-purple-500/15 text-purple-200' : 'bg-cyan-500/15 text-cyan-200'}`}>
                              {item.record.recordType.toUpperCase()}
                            </span>
                            <span className={`rounded-full px-3 py-1 text-xs font-black tracking-wider ${STATUS_CLASSES[item.status]}`}>
                              {item.status.toUpperCase()}
                            </span>
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-black tracking-wider text-slate-300">
                              {getTargetCollection(item.record)}
                            </span>
                            {item.record.recordType === 'match' || item.record.recordType === 'matchV4' ? (
                              <>
                                <span className="text-lg font-black text-white">{item.record.data.teamNumber}</span>
                                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-sm text-slate-400">{item.record.data.matchKey}</span>
                              </>
                            ) : item.record.recordType === 'matchDefense' ? (
                              <>
                                <span className="text-lg font-black text-white">{item.record.data.teamNumber}</span>
                                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-sm text-slate-400">{item.record.data.matchKey}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-lg font-black text-white">{item.record.data.teamNumber}</span>
                                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-sm text-slate-400">{item.record.eventKey}</span>
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
                        className="rounded-lg p-2 text-slate-500 opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-950/30 hover:text-red-400"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
