const DB_NAME = 'rebuilt-2026-scout-drafts';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;

export type ScoutDraftFormType = 'match' | 'matchDefense' | 'pit';
export type ScoutDraftMode = 'new' | 'edit';

export interface ScoutDraftRecord<T> {
  key: string;
  formType: ScoutDraftFormType;
  mode: ScoutDraftMode;
  contextId: string;
  updatedAt: number;
  data: T;
}

const openScoutDraftDb = async (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }

  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open IndexedDB for scout drafts.'));
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

export const buildScoutDraftKey = (
  formType: ScoutDraftFormType,
  mode: ScoutDraftMode,
  contextId: string
) => `${formType}:${mode}:${contextId}`;

export const getScoutDraft = async <T>(key: string): Promise<ScoutDraftRecord<T> | null> => {
  const db = await openScoutDraftDb();
  if (!db) {
    return null;
  }

  return await new Promise<ScoutDraftRecord<T> | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to read scout draft.'));
    };

    request.onsuccess = () => {
      resolve((request.result as ScoutDraftRecord<T> | undefined) ?? null);
    };
  }).finally(() => {
    db.close();
  });
};

export const setScoutDraft = async <T>(
  key: string,
  formType: ScoutDraftFormType,
  mode: ScoutDraftMode,
  contextId: string,
  data: T
): Promise<void> => {
  const db = await openScoutDraftDb();
  if (!db) {
    return;
  }

  const payload: ScoutDraftRecord<T> = {
    key,
    formType,
    mode,
    contextId,
    updatedAt: Date.now(),
    data
  };

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(payload);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to write scout draft.'));
    };

    request.onsuccess = () => {
      resolve();
    };
  }).finally(() => {
    db.close();
  });
};

export const deleteScoutDraft = async (key: string): Promise<void> => {
  const db = await openScoutDraftDb();
  if (!db) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to delete scout draft.'));
    };

    request.onsuccess = () => {
      resolve();
    };
  }).finally(() => {
    db.close();
  });
};
