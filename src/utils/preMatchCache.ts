import { PreMatchTeamProfile } from '../types';

const DB_NAME = 'rebuilt-2026-prematch-cache';
const STORE_NAME = 'eventSheets';
const DB_VERSION = 1;

export interface CachedPreMatchSheet {
  eventKey: string;
  cachedAt: number;
  profiles: PreMatchTeamProfile[];
}

const openPreMatchCacheDb = async (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }

  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB for pre-match cache.'));
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'eventKey' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

export const getCachedPreMatchSheet = async (eventKey: string): Promise<CachedPreMatchSheet | null> => {
  const db = await openPreMatchCacheDb();
  if (!db) {
    return null;
  }

  return await new Promise<CachedPreMatchSheet | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(eventKey);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to read pre-match cache.'));
    };

    request.onsuccess = () => {
      resolve((request.result as CachedPreMatchSheet | undefined) ?? null);
    };
  }).finally(() => {
    db.close();
  });
};

export const setCachedPreMatchSheet = async (eventKey: string, profiles: PreMatchTeamProfile[]): Promise<number | null> => {
  const db = await openPreMatchCacheDb();
  if (!db) {
    return null;
  }

  const cachedAt = Date.now();
  const payload: CachedPreMatchSheet = {
    eventKey,
    cachedAt,
    profiles
  };

  return await new Promise<number>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(payload);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to write pre-match cache.'));
    };

    request.onsuccess = () => {
      resolve(cachedAt);
    };
  }).finally(() => {
    db.close();
  });
};
