import { ModelFeatureSnapshot, ModelLabSnapshot, PowerCoinBet, PowerCoinLedgerEntry, ScoutAssignmentPlan } from '../types';

export interface FirstEventsCredentials {
  username: string;
  token: string;
  savedAt: number;
}

export interface AdminV2CacheEntry<T = unknown> {
  id: string;
  eventKey: string;
  year: number;
  source: 'FIRST' | 'TBA' | 'Statbotics' | 'Firebase' | 'Derived' | 'Upload';
  key: string;
  timestamp: number;
  payload: T;
}

const DB_NAME = 'rebuilt-2026-admin-v2-local';
const DB_VERSION = 3;
const SETTINGS_STORE = 'settings';
const CACHE_STORE = 'cache';
const POWERCOIN_BETS_STORE = 'powerCoinBets';
const POWERCOIN_LEDGER_STORE = 'powerCoinLedger';
const SCOUT_PLANS_STORE = 'scoutAssignmentPlans';
const MODEL_SNAPSHOTS_STORE = 'modelSnapshots';
const MODEL_FEATURE_SNAPSHOTS_STORE = 'modelFeatureSnapshots';
const FIRST_CREDENTIALS_KEY = 'first_events_credentials';
const STARTING_POWERCOINS = 1000;

const openDb = async (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return null;

  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open Admin V2 IndexedDB.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        const store = db.createObjectStore(CACHE_STORE, { keyPath: 'id' });
        store.createIndex('eventKey', 'eventKey', { unique: false });
        store.createIndex('source', 'source', { unique: false });
      }
      if (!db.objectStoreNames.contains(POWERCOIN_BETS_STORE)) {
        const store = db.createObjectStore(POWERCOIN_BETS_STORE, { keyPath: 'id' });
        store.createIndex('eventKey', 'eventKey', { unique: false });
        store.createIndex('scoutName', 'scoutName', { unique: false });
      }
      if (!db.objectStoreNames.contains(POWERCOIN_LEDGER_STORE)) {
        const store = db.createObjectStore(POWERCOIN_LEDGER_STORE, { keyPath: 'id' });
        store.createIndex('eventKey', 'eventKey', { unique: false });
        store.createIndex('scoutName', 'scoutName', { unique: false });
      }
      if (!db.objectStoreNames.contains(SCOUT_PLANS_STORE)) {
        const store = db.createObjectStore(SCOUT_PLANS_STORE, { keyPath: 'id' });
        store.createIndex('eventKey', 'eventKey', { unique: false });
      }
      if (!db.objectStoreNames.contains(MODEL_SNAPSHOTS_STORE)) {
        const store = db.createObjectStore(MODEL_SNAPSHOTS_STORE, { keyPath: 'id' });
        store.createIndex('eventKey', 'eventKey', { unique: false });
      }
      if (!db.objectStoreNames.contains(MODEL_FEATURE_SNAPSHOTS_STORE)) {
        const store = db.createObjectStore(MODEL_FEATURE_SNAPSHOTS_STORE, { keyPath: 'id' });
        store.createIndex('eventKey', 'eventKey', { unique: false });
        store.createIndex('modelName', 'modelName', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
};

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
): Promise<T> => {
  const db = await openDb();
  if (!db) throw new Error('IndexedDB is unavailable on this device.');

  return await new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    callback(store, resolve, reject);
  }).finally(() => db.close());
};

const eventKeyOf = (eventKey: string) => eventKey.trim().toUpperCase();

export const saveFirstEventsCredentials = async (credentials: { username: string; token: string }) => {
  const value: FirstEventsCredentials = {
    username: credentials.username.trim(),
    token: credentials.token.trim(),
    savedAt: Date.now()
  };
  await withStore<void>(SETTINGS_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.put({ key: FIRST_CREDENTIALS_KEY, value });
    request.onerror = () => reject(request.error ?? new Error('Failed to save FIRST Events credentials.'));
    request.onsuccess = () => resolve();
  });
  return value;
};

export const loadFirstEventsCredentials = async () =>
  await withStore<FirstEventsCredentials | null>(SETTINGS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.get(FIRST_CREDENTIALS_KEY);
    request.onerror = () => reject(request.error ?? new Error('Failed to load FIRST Events credentials.'));
    request.onsuccess = () => resolve((request.result?.value as FirstEventsCredentials | undefined) ?? null);
  });

export const clearFirstEventsCredentials = async () =>
  await withStore<void>(SETTINGS_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.delete(FIRST_CREDENTIALS_KEY);
    request.onerror = () => reject(request.error ?? new Error('Failed to clear FIRST Events credentials.'));
    request.onsuccess = () => resolve();
  });

export const buildFirstEventsAuthHeader = (credentials: Pick<FirstEventsCredentials, 'username' | 'token'>) =>
  `Basic ${btoa(`${credentials.username}:${credentials.token}`)}`;

export const putAdminV2CacheEntry = async <T>(entry: Omit<AdminV2CacheEntry<T>, 'id' | 'timestamp'>) => {
  const cacheEntry: AdminV2CacheEntry<T> = {
    ...entry,
    id: `${eventKeyOf(entry.eventKey)}:${entry.year}:${entry.source}:${entry.key}`,
    eventKey: eventKeyOf(entry.eventKey),
    timestamp: Date.now()
  };
  await withStore<void>(CACHE_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.put(cacheEntry);
    request.onerror = () => reject(request.error ?? new Error('Failed to save Admin V2 cache entry.'));
    request.onsuccess = () => resolve();
  });
  return cacheEntry;
};

export const restoreAdminV2CacheEntries = async (entries: AdminV2CacheEntry[]) => {
  let restored = 0;
  for (const entry of entries) {
    if (!entry?.eventKey || !entry?.source || !entry?.key) continue;
    const normalizedEntry: AdminV2CacheEntry = {
      ...entry,
      id: entry.id || `${eventKeyOf(entry.eventKey)}:${entry.year}:${entry.source}:${entry.key}`,
      eventKey: eventKeyOf(entry.eventKey),
      timestamp: entry.timestamp || Date.now()
    };
    await withStore<void>(CACHE_STORE, 'readwrite', (store, resolve, reject) => {
      const request = store.put(normalizedEntry);
      request.onerror = () => reject(request.error ?? new Error('Failed to restore Admin V2 cache entry.'));
      request.onsuccess = () => resolve();
    });
    restored += 1;
  }
  return restored;
};

export const listAdminV2CacheEntries = async (eventKey?: string) => {
  const entries = await withStore<AdminV2CacheEntry[]>(CACHE_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to list Admin V2 cache entries.'));
    request.onsuccess = () => resolve((request.result as AdminV2CacheEntry[] | undefined) ?? []);
  });
  return entries.filter(entry => (eventKey ? entry.eventKey === eventKeyOf(eventKey) : true));
};

export const upsertPowerCoinBet = async (bet: PowerCoinBet) => {
  await withStore<void>(POWERCOIN_BETS_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.put({ ...bet, eventKey: eventKeyOf(bet.eventKey) });
    request.onerror = () => reject(request.error ?? new Error('Failed to save PowerCoin bet.'));
    request.onsuccess = () => resolve();
  });
};

export const listPowerCoinBets = async (eventKey: string) => {
  const bets = await withStore<PowerCoinBet[]>(POWERCOIN_BETS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to list PowerCoin bets.'));
    request.onsuccess = () => resolve((request.result as PowerCoinBet[] | undefined) ?? []);
  });
  return bets.filter(bet => bet.eventKey === eventKeyOf(eventKey));
};

export const listPowerCoinLedger = async (eventKey: string) => {
  const entries = await withStore<PowerCoinLedgerEntry[]>(POWERCOIN_LEDGER_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to list PowerCoin ledger.'));
    request.onsuccess = () => resolve((request.result as PowerCoinLedgerEntry[] | undefined) ?? []);
  });
  return entries.filter(entry => entry.eventKey === eventKeyOf(eventKey));
};

export const upsertPowerCoinLedgerEntry = async (entry: PowerCoinLedgerEntry) => {
  await withStore<void>(POWERCOIN_LEDGER_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.put({ ...entry, eventKey: eventKeyOf(entry.eventKey) });
    request.onerror = () => reject(request.error ?? new Error('Failed to save PowerCoin ledger entry.'));
    request.onsuccess = () => resolve();
  });
};

export const getPowerCoinBalance = async (eventKey: string, scoutName: string) => {
  const normalizedScoutName = scoutName.trim().toLowerCase();
  const ledger = await listPowerCoinLedger(eventKey);
  const deltas = ledger
    .filter(entry => entry.scoutName.trim().toLowerCase() === normalizedScoutName)
    .reduce((sum, entry) => sum + entry.delta, 0);
  const bets = await listPowerCoinBets(eventKey);
  const betDelta = bets
    .filter(bet => bet.scoutName.trim().toLowerCase() === normalizedScoutName)
    .reduce((sum, bet) => {
      if (!bet.settledAt) return sum - bet.amount;
      return sum + ((bet.payout ?? 0) - bet.amount);
    }, 0);
  return STARTING_POWERCOINS + deltas + betDelta;
};

export const settlePowerCoinBetsForMatch = async (
  eventKey: string,
  matchKey: string,
  winner: 'Red' | 'Blue' | 'Tie' | 'Unknown'
) => {
  const allBets = await listPowerCoinBets(eventKey);
  const matchBets = allBets.filter(bet => bet.matchKey === matchKey && !bet.settledAt);
  const now = Date.now();

  if (winner === 'Tie' || winner === 'Unknown') {
    for (const bet of matchBets) {
      await upsertPowerCoinBet({ ...bet, settledAt: now, outcome: 'refunded', payout: bet.amount });
    }
    return matchBets.length;
  }

  const winningPool = matchBets.filter(bet => bet.side === winner).reduce((sum, bet) => sum + bet.amount, 0);
  const losingPool = matchBets.filter(bet => bet.side !== winner).reduce((sum, bet) => sum + bet.amount, 0);

  for (const bet of matchBets) {
    const won = bet.side === winner;
    const payout = won && winningPool > 0 ? bet.amount + (bet.amount / winningPool) * losingPool : 0;
    await upsertPowerCoinBet({
      ...bet,
      settledAt: now,
      outcome: won ? 'won' : 'lost',
      payout
    });
  }
  return matchBets.length;
};

export const saveScoutAssignmentPlan = async (plan: ScoutAssignmentPlan) => {
  await withStore<void>(SCOUT_PLANS_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.put({ ...plan, eventKey: eventKeyOf(plan.eventKey) });
    request.onerror = () => reject(request.error ?? new Error('Failed to save scout assignment plan.'));
    request.onsuccess = () => resolve();
  });
};

export const loadLatestScoutAssignmentPlan = async (eventKey: string) => {
  const plans = await withStore<ScoutAssignmentPlan[]>(SCOUT_PLANS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to load scout assignment plans.'));
    request.onsuccess = () => resolve((request.result as ScoutAssignmentPlan[] | undefined) ?? []);
  });
  return plans
    .filter(plan => plan.eventKey === eventKeyOf(eventKey))
    .sort((left, right) => right.createdAt - left.createdAt)[0] || null;
};

export const saveModelLabSnapshot = async (snapshot: ModelLabSnapshot) => {
  await withStore<void>(MODEL_SNAPSHOTS_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.put({ ...snapshot, eventKey: eventKeyOf(snapshot.eventKey) });
    request.onerror = () => reject(request.error ?? new Error('Failed to save model lab snapshot.'));
    request.onsuccess = () => resolve();
  });
};

export const listModelLabSnapshots = async (eventKey: string) => {
  const snapshots = await withStore<ModelLabSnapshot[]>(MODEL_SNAPSHOTS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to list model lab snapshots.'));
    request.onsuccess = () => resolve((request.result as ModelLabSnapshot[] | undefined) ?? []);
  });
  return snapshots
    .filter(snapshot => snapshot.eventKey === eventKeyOf(eventKey))
    .sort((left, right) => right.createdAt - left.createdAt);
};

export const loadLatestModelLabSnapshot = async (eventKey: string) =>
  (await listModelLabSnapshots(eventKey))[0] || null;

export const saveModelFeatureSnapshot = async (snapshot: ModelFeatureSnapshot) => {
  await withStore<void>(MODEL_FEATURE_SNAPSHOTS_STORE, 'readwrite', (store, resolve, reject) => {
    const request = store.put({ ...snapshot, eventKey: eventKeyOf(snapshot.eventKey) });
    request.onerror = () => reject(request.error ?? new Error('Failed to save model feature snapshot.'));
    request.onsuccess = () => resolve();
  });
};

export const listModelFeatureSnapshots = async (eventKey: string) => {
  const snapshots = await withStore<ModelFeatureSnapshot[]>(MODEL_FEATURE_SNAPSHOTS_STORE, 'readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error ?? new Error('Failed to list model feature snapshots.'));
    request.onsuccess = () => resolve((request.result as ModelFeatureSnapshot[] | undefined) ?? []);
  });
  return snapshots
    .filter(snapshot => snapshot.eventKey === eventKeyOf(eventKey))
    .sort((left, right) => right.createdAt - left.createdAt);
};

export const loadLatestModelFeatureSnapshot = async (eventKey: string) =>
  (await listModelFeatureSnapshots(eventKey))[0] || null;
