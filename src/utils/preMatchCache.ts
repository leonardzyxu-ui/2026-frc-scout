import { PreMatchTeamProfile, QualificationStatus, ScoutEvidenceAdminTask } from '../types';

const DB_NAME = 'rebuilt-2026-prematch-cache';
const STORE_NAME = 'eventSheets';
const DB_VERSION = 1;

export interface CachedPreMatchSheet {
  eventKey: string;
  cachedAt: number;
  profiles: PreMatchTeamProfile[];
  adminTaskEvidence?: PreScoutAdminTaskEvidence[];
}

export interface PreScoutAdminTaskEvidence {
  id: string;
  eventKey: string;
  teamNumber: string;
  teamName?: string;
  capturedAt: number;
  task: ScoutEvidenceAdminTask;
  profileAvailable: boolean;
  qualificationStatus?: QualificationStatus;
  qualificationReason?: string;
  missingFromTba: string[];
  manualRequired: string[];
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
  const existingSheet = await getCachedPreMatchSheet(eventKey).catch(() => null);
  const db = await openPreMatchCacheDb();
  if (!db) {
    return null;
  }

  const cachedAt = Date.now();
  const payload: CachedPreMatchSheet = {
    eventKey,
    cachedAt,
    profiles,
    adminTaskEvidence: existingSheet?.adminTaskEvidence || []
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

export const recordPreScoutAdminTaskEvidence = async (
  eventKey: string,
  evidence: Omit<PreScoutAdminTaskEvidence, 'id' | 'eventKey' | 'capturedAt'> & {
    id?: string;
    eventKey?: string;
    capturedAt?: number;
  }
): Promise<CachedPreMatchSheet | null> => {
  const db = await openPreMatchCacheDb();
  if (!db) {
    return null;
  }

  const normalizedEventKey = (evidence.eventKey || eventKey).trim().toUpperCase();
  const capturedAt = evidence.capturedAt || Date.now();
  const normalizedEvidence: PreScoutAdminTaskEvidence = {
    id: evidence.id || `preScout:${normalizedEventKey}:${evidence.teamNumber}:${evidence.task.createdAt || capturedAt}`,
    eventKey: normalizedEventKey,
    teamNumber: evidence.teamNumber,
    teamName: evidence.teamName || '',
    capturedAt,
    task: {
      ...evidence.task,
      eventKey: evidence.task.eventKey || normalizedEventKey,
      capturedAt
    },
    profileAvailable: evidence.profileAvailable,
    qualificationStatus: evidence.qualificationStatus,
    qualificationReason: evidence.qualificationReason || '',
    missingFromTba: evidence.missingFromTba.filter(Boolean),
    manualRequired: evidence.manualRequired.filter(Boolean)
  };

  return await new Promise<CachedPreMatchSheet>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(normalizedEventKey);

    getRequest.onerror = () => {
      reject(getRequest.error ?? new Error('Failed to read pre-match cache before recording admin evidence.'));
    };

    getRequest.onsuccess = () => {
      const existing = (getRequest.result as CachedPreMatchSheet | undefined) ?? {
        eventKey: normalizedEventKey,
        cachedAt: capturedAt,
        profiles: [],
        adminTaskEvidence: []
      };
      const nextEvidence = [
        normalizedEvidence,
        ...(existing.adminTaskEvidence || []).filter(item => item.id !== normalizedEvidence.id)
      ].slice(0, 80);
      const nextSheet: CachedPreMatchSheet = {
        ...existing,
        eventKey: normalizedEventKey,
        cachedAt: existing.cachedAt || capturedAt,
        adminTaskEvidence: nextEvidence
      };
      const putRequest = store.put(nextSheet);

      putRequest.onerror = () => {
        reject(putRequest.error ?? new Error('Failed to save pre-match admin evidence.'));
      };
      putRequest.onsuccess = () => {
        resolve(nextSheet);
      };
    };
  }).finally(() => {
    db.close();
  });
};

export const restoreCachedPreMatchSheet = async (sheet: CachedPreMatchSheet | null | undefined): Promise<boolean> => {
  if (!sheet?.eventKey || !Array.isArray(sheet.profiles)) {
    return false;
  }

  const db = await openPreMatchCacheDb();
  if (!db) {
    return false;
  }

  const payload: CachedPreMatchSheet = {
    eventKey: sheet.eventKey.trim().toUpperCase(),
    cachedAt: sheet.cachedAt || Date.now(),
    profiles: sheet.profiles,
    adminTaskEvidence: Array.isArray(sheet.adminTaskEvidence) ? sheet.adminTaskEvidence : []
  };

  return await new Promise<boolean>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(payload);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to restore pre-match cache.'));
    };

    request.onsuccess = () => {
      resolve(true);
    };
  }).finally(() => {
    db.close();
  });
};
