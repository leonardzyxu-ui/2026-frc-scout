import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, PitScoutingV2 } from '../types';
import { getMatchDefenseDocId, getMatchDocId, getMatchV3DocId, getPitDocId } from './scoutingWrites';
import { isMatchScoutingV3, mapLegacyMatchScoutingToV3 } from './matchScoutingV3';

const DB_NAME = 'rebuilt-2026-scout-archive';
const SETTINGS_STORE = 'settings';
const RECORDS_STORE = 'records';
const DB_VERSION = 1;
const USERNAME_KEY = 'scout_username';

export type ScoutArchiveRecordType = 'match' | 'matchDefense' | 'pit';
export type ScoutArchiveSource = 'local_submit' | 'json_import' | 'qr_import';
export type ArchivedMatchPayload = MatchScoutingV2 | MatchScoutingV3;
export type ScoutArchiveSyncStatus = 'pending_sync' | 'synced' | 'unsynced';

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
  lastFirebaseAttemptAt?: number;
  lastFirebaseError?: string;
  payload: T;
}

export interface MatchArchiveRecord extends ScoutArchiveRecordBase<ArchivedMatchPayload> {
  recordType: 'match';
}

export interface MatchDefenseArchiveRecord extends ScoutArchiveRecordBase<MatchDefenseScoutingV1> {
  recordType: 'matchDefense';
}

export interface PitArchiveRecord extends ScoutArchiveRecordBase<PitScoutingV2> {
  recordType: 'pit';
}

export type ScoutArchiveRecord = MatchArchiveRecord | MatchDefenseArchiveRecord | PitArchiveRecord;

export interface ScoutArchiveBundle {
  format: 'rebuilt-2026-scout-archive';
  version: 1 | 2 | 3;
  username: string;
  exportedAt: number;
  deviceId: string;
  records: ScoutArchiveRecord[];
}

const normalizeArchiveRecord = (record: ScoutArchiveRecord): ScoutArchiveRecord => ({
  ...record,
  deleted: !!record.deleted,
  syncStatus: record.syncStatus || 'synced',
  lastFirebaseError: record.lastFirebaseError || ''
});

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

export const upsertMatchArchiveRecord = async (
  record: MatchScoutingV2,
  username: string,
  source: ScoutArchiveSource = 'local_submit',
  syncState?: Partial<Pick<ScoutArchiveRecord, 'syncStatus' | 'lastFirebaseAttemptAt' | 'lastFirebaseError'>>
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
    lastFirebaseAttemptAt: syncState?.lastFirebaseAttemptAt,
    lastFirebaseError: syncState?.lastFirebaseError,
    payload: record
  };

  await putArchiveRecord(archiveRecord);
  return archiveRecord;
};

export const upsertMatchArchiveRecordV3 = async (
  record: MatchScoutingV3,
  username: string,
  source: ScoutArchiveSource = 'local_submit',
  syncState?: Partial<Pick<ScoutArchiveRecord, 'syncStatus' | 'lastFirebaseAttemptAt' | 'lastFirebaseError'>>
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
    lastFirebaseAttemptAt: syncState?.lastFirebaseAttemptAt,
    lastFirebaseError: syncState?.lastFirebaseError,
    payload: record
  };

  await putArchiveRecord(archiveRecord);
  return archiveRecord;
};

export const upsertMatchDefenseArchiveRecord = async (
  record: MatchDefenseScoutingV1,
  username: string,
  source: ScoutArchiveSource = 'local_submit',
  syncState?: Partial<Pick<ScoutArchiveRecord, 'syncStatus' | 'lastFirebaseAttemptAt' | 'lastFirebaseError'>>
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
    lastFirebaseAttemptAt: syncState?.lastFirebaseAttemptAt,
    lastFirebaseError: syncState?.lastFirebaseError,
    payload: record
  };

  await putArchiveRecord(archiveRecord);
  return archiveRecord;
};

export const upsertPitArchiveRecord = async (
  eventKey: string,
  record: PitScoutingV2,
  username: string,
  source: ScoutArchiveSource = 'local_submit',
  syncState?: Partial<Pick<ScoutArchiveRecord, 'syncStatus' | 'lastFirebaseAttemptAt' | 'lastFirebaseError'>>
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
    lastFirebaseAttemptAt: syncState?.lastFirebaseAttemptAt,
    lastFirebaseError: syncState?.lastFirebaseError,
    payload: record
  };

  await putArchiveRecord(archiveRecord);
  return archiveRecord;
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
  return {
    format: 'rebuilt-2026-scout-archive',
    version: 3,
    username: normalizeUsername(username),
    exportedAt: Date.now(),
    deviceId: normalizedRecords[0]?.deviceId || '',
    records: normalizedRecords
  };
};

export const isScoutArchiveBundle = (value: unknown): value is ScoutArchiveBundle => {
  if (!value || typeof value !== 'object') return false;
  const maybeBundle = value as Partial<ScoutArchiveBundle>;
  return (
    maybeBundle.format === 'rebuilt-2026-scout-archive' &&
    (maybeBundle.version === 1 || maybeBundle.version === 2 || maybeBundle.version === 3) &&
    Array.isArray(maybeBundle.records)
  );
};
