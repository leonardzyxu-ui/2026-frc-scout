import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, MatchScoutingV4, PitScoutingV2, PowerCoinBet, PowerCoinLedgerEntry } from '../types';
import { listPowerCoinBets, listPowerCoinLedger, upsertPowerCoinBet, upsertPowerCoinLedgerEntry } from './adminV2LocalStore';
import { getMatchDefenseDocId, getMatchDocId, getMatchV3DocId, getMatchV4DocId, getPitDocId } from './scoutingWrites';
import { isMatchScoutingV3, mapLegacyMatchScoutingToV3 } from './matchScoutingV3';
import { isMatchScoutingV4 } from './matchScoutingV4';

const DB_NAME = 'rebuilt-2026-scout-archive';
const SETTINGS_STORE = 'settings';
const RECORDS_STORE = 'records';
const DB_VERSION = 1;
const USERNAME_KEY = 'scout_username';

export type ScoutArchiveRecordType = 'match' | 'matchV4' | 'matchDefense' | 'pit';
export type ScoutArchiveSource = 'local_submit' | 'json_import' | 'qr_import';
export type ArchivedMatchPayload = MatchScoutingV2 | MatchScoutingV3;
export type ArchivedMatchV4Payload = MatchScoutingV4;
export type ScoutArchiveSyncStatus = 'pending_sync' | 'synced' | 'unsynced';
export type ScoutArchiveSyncMode = 'strict' | 'replace';
type ScoutArchiveUpsertSyncState = Partial<Pick<ScoutArchiveRecord, 'syncStatus' | 'syncMode' | 'lastFirebaseAttemptAt' | 'lastFirebaseError'>> & {
  preserveExistingOnConflict?: boolean;
};

interface ScoutArchiveRecordBase<T> {
  recordId: string;
  logicalId: string;
  recordType: ScoutArchiveRecordType;
  eventKey: string;
  username: string;
  deviceId: string;
  updatedAt: number;
  deleted: boolean;
  deletedAt?: number;
  source: ScoutArchiveSource;
  syncStatus: ScoutArchiveSyncStatus;
  syncMode?: ScoutArchiveSyncMode;
  lastFirebaseAttemptAt?: number;
  lastFirebaseError?: string;
  payload: T;
}

export interface MatchArchiveRecord extends ScoutArchiveRecordBase<ArchivedMatchPayload> {
  recordType: 'match';
}

export interface MatchV4ArchiveRecord extends ScoutArchiveRecordBase<ArchivedMatchV4Payload> {
  recordType: 'matchV4';
}

export interface MatchDefenseArchiveRecord extends ScoutArchiveRecordBase<MatchDefenseScoutingV1> {
  recordType: 'matchDefense';
}

export interface PitArchiveRecord extends ScoutArchiveRecordBase<PitScoutingV2> {
  recordType: 'pit';
}

export type ScoutArchiveRecord = MatchArchiveRecord | MatchV4ArchiveRecord | MatchDefenseArchiveRecord | PitArchiveRecord;

export interface ScoutArchiveBundle {
  format: 'rebuilt-2026-scout-archive';
  version: 1 | 2 | 3 | 4 | 5;
  username: string;
  exportedAt: number;
  deviceId: string;
  records: ScoutArchiveRecord[];
  powerCoinBets?: PowerCoinBet[];
  powerCoinLedger?: PowerCoinLedgerEntry[];
}

const normalizeArchiveRecord = (record: ScoutArchiveRecord): ScoutArchiveRecord => ({
  ...record,
  deleted: !!record.deleted,
  syncStatus: record.syncStatus || 'synced',
  syncMode: record.syncMode || 'strict',
  lastFirebaseError: record.lastFirebaseError || ''
});

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'timestamp' && key !== 'deviceId' && key !== 'editHistory')
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value) ?? 'undefined';
};

const isSubstantiveDuplicate = (left: ScoutArchiveRecord, right: ScoutArchiveRecord) =>
  left.recordType === right.recordType &&
  left.logicalId === right.logicalId &&
  stableStringify(left.payload) === stableStringify(right.payload);

const openScoutArchiveDb = async (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }

  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB for scout archive.'));
    };

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        const recordStore = db.createObjectStore(RECORDS_STORE, { keyPath: 'recordId' });
        recordStore.createIndex('eventKey', 'eventKey', { unique: false });
        recordStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        recordStore.createIndex('deleted', 'deleted', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => {
  const db = await openScoutArchiveDb();
  if (!db) {
    throw new Error('IndexedDB is unavailable on this device.');
  }

  return await new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    callback(store, resolve, reject);
  }).finally(() => {
    db.close();
  });
};

const buildMatchRecordId = (record: ArchivedMatchPayload) =>
  `match:${record.eventKey}:${isMatchScoutingV3(record) ? getMatchV3DocId(record) : getMatchDocId(record)}`;

const buildMatchV4RecordId = (record: MatchScoutingV4) =>
  `matchV4:${record.eventKey}:${getMatchV4DocId(record)}`;

const buildPitRecordId = (eventKey: string, record: PitScoutingV2) =>
  `pit:${eventKey}:${getPitDocId(record)}`;

const buildMatchDefenseRecordId = (record: MatchDefenseScoutingV1) =>
  `matchDefense:${record.eventKey}:${getMatchDefenseDocId(record)}`;

const normalizeUsername = (value: string) => value.trim();

export const getScoutArchiveUsername = async () =>
  await withStore<string | null>(SETTINGS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.get(USERNAME_KEY);
    request.onerror = () => reject(request.error ?? new Error('Failed to read scout username.'));
    request.onsuccess = () => resolve((request.result?.value as string | undefined) ?? null);
  });

export const setScoutArchiveUsername = async (username: string) => {
  const normalized = normalizeUsername(username);
  await withStore<void>(SETTINGS_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.put({ key: USERNAME_KEY, value: normalized, updatedAt: Date.now() });
    request.onerror = () => reject(request.error ?? new Error('Failed to save scout username.'));
    request.onsuccess = () => resolve();
  });
};

export const listScoutArchiveRecords = async (options?: {
  eventKey?: string;
  includeDeleted?: boolean;
}) => {
  const eventKey = options?.eventKey;
  const includeDeleted = options?.includeDeleted ?? false;

  const records = await withStore<ScoutArchiveRecord[]>(RECORDS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to read scout archive.'));
    request.onsuccess = () => resolve((request.result as ScoutArchiveRecord[] | undefined) ?? []);
  });

  return records
    .map(normalizeArchiveRecord)
    .filter(record => (eventKey ? record.eventKey === eventKey : true))
    .filter(record => (includeDeleted ? true : !record.deleted))
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

const putArchiveRecord = async (record: ScoutArchiveRecord) => {
  await withStore<void>(RECORDS_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.put(record);
    request.onerror = () => reject(request.error ?? new Error('Failed to save scout archive record.'));
    request.onsuccess = () => resolve();
  });
};

const getArchiveRecordById = async (recordId: string) =>
  await withStore<ScoutArchiveRecord | null>(RECORDS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.get(recordId);
    request.onerror = () => reject(request.error ?? new Error('Failed to load scout archive record.'));
    request.onsuccess = () => {
      const result = (request.result as ScoutArchiveRecord | undefined) ?? null;
      resolve(result ? normalizeArchiveRecord(result) : null);
    };
  });

const findSubstantiveArchiveDuplicate = async (record: ScoutArchiveRecord) =>
  await withStore<ScoutArchiveRecord | null>(RECORDS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to scan scout archive records.'));
    request.onsuccess = () => {
      const records = ((request.result as ScoutArchiveRecord[] | undefined) ?? []).map(normalizeArchiveRecord);
      resolve(records.find(existing => isSubstantiveDuplicate(existing, record)) || null);
    };
  });

const putArchiveRecordWithImportGuard = async (
  record: ScoutArchiveRecord,
  preserveExistingOnConflict?: boolean
) => {
  if (!preserveExistingOnConflict) {
    await putArchiveRecord(record);
    return record;
  }

  const existingRecord = await getArchiveRecordById(record.recordId);
  if (!existingRecord) {
    await putArchiveRecord(record);
    return record;
  }

  if (isSubstantiveDuplicate(existingRecord, record)) {
    return existingRecord;
  }

  const existingSubstantiveDuplicate = await findSubstantiveArchiveDuplicate(record);
  if (existingSubstantiveDuplicate) {
    return existingSubstantiveDuplicate;
  }

  const conflictTimestamp = record.updatedAt || Date.now();
  const conflictRecord: ScoutArchiveRecord = normalizeArchiveRecord({
    ...record,
    recordId: `${record.recordId}:conflict:${conflictTimestamp}`,
    syncStatus: 'unsynced',
    lastFirebaseAttemptAt: record.lastFirebaseAttemptAt || Date.now(),
    lastFirebaseError: `Imported local conflict preserved separately. Existing local record kept at ${record.recordId}.`
  });
  await putArchiveRecord(conflictRecord);
  return conflictRecord;
};

export const upsertMatchArchiveRecord = async (
  record: MatchScoutingV2,
  username: string,
  source: ScoutArchiveSource = 'local_submit',
  syncState?: ScoutArchiveUpsertSyncState
) => {
  const recordId = buildMatchRecordId(record);
  const logicalId = getMatchDocId(record);
  const archiveRecord: MatchArchiveRecord = {
    recordId,
    logicalId,
    recordType: 'match',
    eventKey: record.eventKey,
    username: normalizeUsername(username),
    deviceId: record.deviceId || '',
    updatedAt: record.timestamp || Date.now(),
    deleted: false,
    source,
    syncStatus: syncState?.syncStatus || 'synced',
    syncMode: syncState?.syncMode || 'strict',
    lastFirebaseAttemptAt: syncState?.lastFirebaseAttemptAt,
    lastFirebaseError: syncState?.lastFirebaseError,
    payload: record
  };

  return await putArchiveRecordWithImportGuard(archiveRecord, syncState?.preserveExistingOnConflict);
};

export const upsertMatchArchiveRecordV3 = async (
  record: MatchScoutingV3,
  username: string,
  source: ScoutArchiveSource = 'local_submit',
  syncState?: ScoutArchiveUpsertSyncState
) => {
  const recordId = buildMatchRecordId(record);
  const logicalId = getMatchV3DocId(record);
  const archiveRecord: MatchArchiveRecord = {
    recordId,
    logicalId,
    recordType: 'match',
    eventKey: record.eventKey,
    username: normalizeUsername(username),
    deviceId: record.deviceId || '',
    updatedAt: record.timestamp || Date.now(),
    deleted: false,
    source,
    syncStatus: syncState?.syncStatus || 'synced',
    syncMode: syncState?.syncMode || 'strict',
    lastFirebaseAttemptAt: syncState?.lastFirebaseAttemptAt,
    lastFirebaseError: syncState?.lastFirebaseError,
    payload: record
  };

  return await putArchiveRecordWithImportGuard(archiveRecord, syncState?.preserveExistingOnConflict);
};

export const upsertMatchArchiveRecordV4 = async (
  record: MatchScoutingV4,
  username: string,
  source: ScoutArchiveSource = 'local_submit',
  syncState?: ScoutArchiveUpsertSyncState
) => {
  const recordId = buildMatchV4RecordId(record);
  const logicalId = getMatchV4DocId(record);
  const archiveRecord: MatchV4ArchiveRecord = {
    recordId,
    logicalId,
    recordType: 'matchV4',
    eventKey: record.eventKey,
    username: normalizeUsername(username),
    deviceId: record.deviceId || '',
    updatedAt: record.timestamp || Date.now(),
    deleted: false,
    source,
    syncStatus: syncState?.syncStatus || 'synced',
    syncMode: syncState?.syncMode || 'strict',
    lastFirebaseAttemptAt: syncState?.lastFirebaseAttemptAt,
    lastFirebaseError: syncState?.lastFirebaseError,
    payload: record
  };

  return await putArchiveRecordWithImportGuard(archiveRecord, syncState?.preserveExistingOnConflict);
};

export const upsertMatchDefenseArchiveRecord = async (
  record: MatchDefenseScoutingV1,
  username: string,
  source: ScoutArchiveSource = 'local_submit',
  syncState?: ScoutArchiveUpsertSyncState
) => {
  const recordId = buildMatchDefenseRecordId(record);
  const logicalId = getMatchDefenseDocId(record);
  const archiveRecord: MatchDefenseArchiveRecord = {
    recordId,
    logicalId,
    recordType: 'matchDefense',
    eventKey: record.eventKey,
    username: normalizeUsername(username),
    deviceId: record.deviceId || '',
    updatedAt: record.timestamp || Date.now(),
    deleted: false,
    source,
    syncStatus: syncState?.syncStatus || 'synced',
    syncMode: syncState?.syncMode || 'strict',
    lastFirebaseAttemptAt: syncState?.lastFirebaseAttemptAt,
    lastFirebaseError: syncState?.lastFirebaseError,
    payload: record
  };

  return await putArchiveRecordWithImportGuard(archiveRecord, syncState?.preserveExistingOnConflict);
};

export const upsertPitArchiveRecord = async (
  eventKey: string,
  record: PitScoutingV2,
  username: string,
  source: ScoutArchiveSource = 'local_submit',
  syncState?: ScoutArchiveUpsertSyncState
) => {
  const recordId = buildPitRecordId(eventKey, record);
  const logicalId = getPitDocId(record);
  const archiveRecord: PitArchiveRecord = {
    recordId,
    logicalId,
    recordType: 'pit',
    eventKey,
    username: normalizeUsername(username),
    deviceId: record.deviceId || '',
    updatedAt: record.timestamp || Date.now(),
    deleted: false,
    source,
    syncStatus: syncState?.syncStatus || 'synced',
    syncMode: syncState?.syncMode || 'strict',
    lastFirebaseAttemptAt: syncState?.lastFirebaseAttemptAt,
    lastFirebaseError: syncState?.lastFirebaseError,
    payload: record
  };

  return await putArchiveRecordWithImportGuard(archiveRecord, syncState?.preserveExistingOnConflict);
};

export const tombstoneScoutArchiveRecord = async (recordId: string) => {
  const existing = await withStore<ScoutArchiveRecord | null>(RECORDS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.get(recordId);
    request.onerror = () => reject(request.error ?? new Error('Failed to load archive record.'));
    request.onsuccess = () => {
      const result = (request.result as ScoutArchiveRecord | undefined) ?? null;
      resolve(result ? normalizeArchiveRecord(result) : null);
    };
  });

  if (!existing) {
    return null;
  }

  const updatedRecord: ScoutArchiveRecord = {
    ...existing,
    deleted: true,
    deletedAt: Date.now(),
    updatedAt: Date.now()
  };

  await putArchiveRecord(updatedRecord);
  return updatedRecord;
};

export const updateScoutArchiveRecordSyncState = async (
  recordId: string,
  updates: {
    syncStatus: ScoutArchiveSyncStatus;
    lastFirebaseAttemptAt?: number;
    lastFirebaseError?: string;
  }
) => {
  const existing = await withStore<ScoutArchiveRecord | null>(RECORDS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.get(recordId);
    request.onerror = () => reject(request.error ?? new Error('Failed to load archive record.'));
    request.onsuccess = () => {
      const result = (request.result as ScoutArchiveRecord | undefined) ?? null;
      resolve(result ? normalizeArchiveRecord(result) : null);
    };
  });

  if (!existing) {
    return null;
  }

  const updatedRecord: ScoutArchiveRecord = {
    ...existing,
    syncStatus: updates.syncStatus,
    lastFirebaseAttemptAt: updates.lastFirebaseAttemptAt ?? Date.now(),
    lastFirebaseError: updates.lastFirebaseError || '',
    updatedAt: Math.max(existing.updatedAt, updates.lastFirebaseAttemptAt ?? Date.now())
  };

  await putArchiveRecord(updatedRecord);
  return updatedRecord;
};

export const buildScoutArchiveBundle = async (username: string): Promise<ScoutArchiveBundle> => {
  const records = await listScoutArchiveRecords({ includeDeleted: true });
  const normalizedUsername = normalizeUsername(username);
  const normalizedRecords = records.map(record => {
    if (record.recordType !== 'match') {
      return record;
    }

    const nextPayload = isMatchScoutingV3(record.payload)
      ? record.payload
      : mapLegacyMatchScoutingToV3(record.payload);

    return {
      ...record,
      recordId: buildMatchRecordId(nextPayload),
      logicalId: getMatchV3DocId(nextPayload),
      payload: nextPayload
    } satisfies MatchArchiveRecord;
  });
  const eventKeys = Array.from(new Set(normalizedRecords.map(record => record.eventKey))).filter(Boolean);
  const normalizedScoutName = normalizedUsername.trim().toLowerCase();
  const powerCoinBets = (await Promise.all(eventKeys.map(eventKey => listPowerCoinBets(eventKey).catch(() => []))))
    .flat()
    .filter(bet => bet.scoutName.trim().toLowerCase() === normalizedScoutName);
  const powerCoinLedger = (await Promise.all(eventKeys.map(eventKey => listPowerCoinLedger(eventKey).catch(() => []))))
    .flat()
    .filter(entry => entry.scoutName.trim().toLowerCase() === normalizedScoutName);

  return {
    format: 'rebuilt-2026-scout-archive',
    version: 5,
    username: normalizedUsername,
    exportedAt: Date.now(),
    deviceId: normalizedRecords[0]?.deviceId || '',
    records: normalizedRecords,
    powerCoinBets,
    powerCoinLedger
  };
};

export const isScoutArchiveBundle = (value: unknown): value is ScoutArchiveBundle => {
  if (!value || typeof value !== 'object') return false;
  const maybeBundle = value as Partial<ScoutArchiveBundle>;
  return (
    maybeBundle.format === 'rebuilt-2026-scout-archive' &&
    (maybeBundle.version === 1 || maybeBundle.version === 2 || maybeBundle.version === 3 || maybeBundle.version === 4 || maybeBundle.version === 5) &&
    Array.isArray(maybeBundle.records)
  );
};

export const importScoutArchiveBundleLocally = async (bundle: ScoutArchiveBundle) => {
  if (!isScoutArchiveBundle(bundle)) {
    throw new Error('Invalid scout archive bundle.');
  }

  let imported = 0;
  let skipped = 0;
  let conflictsPreserved = 0;
  for (const record of bundle.records) {
    if (!record?.recordId || !record?.payload) {
      skipped += 1;
      continue;
    }
    const incomingRecord = normalizeArchiveRecord(record);
    const existingRecord = await getArchiveRecordById(incomingRecord.recordId);
    if (existingRecord) {
      if (isSubstantiveDuplicate(existingRecord, incomingRecord)) {
        skipped += 1;
        continue;
      }

      const existingSubstantiveDuplicate = await findSubstantiveArchiveDuplicate(incomingRecord);
      if (existingSubstantiveDuplicate) {
        skipped += 1;
        continue;
      }

      const conflictRecord: ScoutArchiveRecord = normalizeArchiveRecord({
        ...incomingRecord,
        recordId: `${incomingRecord.recordId}:conflict:${incomingRecord.updatedAt || Date.now()}`,
        syncStatus: 'unsynced',
        lastFirebaseAttemptAt: incomingRecord.lastFirebaseAttemptAt || Date.now(),
        lastFirebaseError: `Imported JSON conflict preserved separately. Existing local record kept at ${incomingRecord.recordId}.`
      });
      await putArchiveRecord(conflictRecord);
      imported += 1;
      conflictsPreserved += 1;
      continue;
    }

    await putArchiveRecord(incomingRecord);
    imported += 1;
  }
  let powerCoinBetsImported = 0;
  let powerCoinLedgerImported = 0;
  for (const bet of bundle.powerCoinBets || []) {
    if (!bet?.id || !bet.eventKey || !bet.scoutName) continue;
    await upsertPowerCoinBet(bet);
    powerCoinBetsImported += 1;
  }
  for (const ledgerEntry of bundle.powerCoinLedger || []) {
    if (!ledgerEntry?.id || !ledgerEntry.eventKey || !ledgerEntry.scoutName) continue;
    await upsertPowerCoinLedgerEntry(ledgerEntry);
    powerCoinLedgerImported += 1;
  }

  return { imported, skipped, conflictsPreserved, powerCoinBetsImported, powerCoinLedgerImported };
};

export const isArchivedMatchV4Record = (record: ScoutArchiveRecord): record is MatchV4ArchiveRecord =>
  record.recordType === 'matchV4' && isMatchScoutingV4(record.payload);
