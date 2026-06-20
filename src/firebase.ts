import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const compileTimeFirebaseConfig: FirebaseRuntimeConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? ''
};

const isLocalMode = import.meta.env.VITE_LOCAL_MODE === 'true';
const placeholderPattern = /replace-me|^your-.+|^todo$|^undefined$|^null$/i;
const isConfiguredValue = (value: string) => {
  const trimmedValue = value.trim();
  return Boolean(trimmedValue) && !placeholderPattern.test(trimmedValue);
};
const hasConfiguredFirebaseConfig = (config: FirebaseRuntimeConfig) =>
  Object.values(config).every(isConfiguredValue);

const normalizeRuntimeConfig = (config: Partial<FirebaseRuntimeConfig>): FirebaseRuntimeConfig => ({
  apiKey: String(config.apiKey ?? ''),
  authDomain: String(config.authDomain ?? ''),
  projectId: String(config.projectId ?? ''),
  storageBucket: String(config.storageBucket ?? ''),
  messagingSenderId: String(config.messagingSenderId ?? ''),
  appId: String(config.appId ?? '')
});

const loadFirebaseHostingConfig = async () => {
  if (isLocalMode || typeof window === 'undefined' || typeof fetch === 'undefined') return null;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch('/__/firebase/init.json', {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) return null;
    const runtimeConfig = normalizeRuntimeConfig(await response.json() as Partial<FirebaseRuntimeConfig>);
    return hasConfiguredFirebaseConfig(runtimeConfig) ? runtimeConfig : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

let initializedApp: FirebaseApp | null = null;
let initializedDb: Firestore | null = null;
let initializedAuth: Auth | null = null;
let initializedStorage: FirebaseStorage | null = null;
let initializationError: unknown = null;

const unavailableFirebaseMessage =
  'Firebase is unavailable because the deployed app is missing valid Firebase Hosting runtime config or VITE_FIREBASE_* configuration.';

const createUnavailableFirebaseService = <T>(serviceName: string) =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(`${serviceName} is unavailable. ${unavailableFirebaseMessage}`);
      }
    }
  ) as T;

export let isFirebaseConfigured = false;
export let hasFirebaseServices = false;
export let app: FirebaseApp | null = null;
export let db = createUnavailableFirebaseService<Firestore>('Firestore');
export let auth = createUnavailableFirebaseService<Auth>('Firebase Auth');
export let storage = createUnavailableFirebaseService<FirebaseStorage>('Firebase Storage');
export let firebaseInitializationError: unknown = null;

const initializeFirebaseServices = (firebaseConfig: FirebaseRuntimeConfig) => {
  if (isLocalMode || !hasConfiguredFirebaseConfig(firebaseConfig)) return false;
  try {
    initializedApp = initializeApp(firebaseConfig);
    initializedDb = initializeFirestore(initializedApp, {
      localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
    });
    initializedAuth = getAuth(initializedApp);
    initializedStorage = getStorage(initializedApp);
    app = initializedApp;
    db = initializedDb;
    auth = initializedAuth;
    storage = initializedStorage;
    isFirebaseConfigured = true;
    hasFirebaseServices = true;

    // Sign in anonymously for scouts. Connectivity problems should not break
    // local-first scouting; the guarded admin route will explain access state.
    signInAnonymously(initializedAuth).catch(() => {
      console.warn('Anonymous Firebase sign-in is unavailable. Local scouting, QR fallback, and IndexedDB history can still run.');
    });
    return true;
  } catch (error) {
    initializationError = error;
    firebaseInitializationError = error;
    initializedApp = null;
    initializedDb = null;
    initializedAuth = null;
    initializedStorage = null;
    app = null;
    db = createUnavailableFirebaseService<Firestore>('Firestore');
    auth = createUnavailableFirebaseService<Auth>('Firebase Auth');
    storage = createUnavailableFirebaseService<FirebaseStorage>('Firebase Storage');
    isFirebaseConfigured = false;
    hasFirebaseServices = false;
    console.error('Firebase initialization failed. The app will continue in local-only mode.', error);
    return false;
  }
};

const initializeFirebase = async () => {
  if (initializeFirebaseServices(compileTimeFirebaseConfig)) return;
  const runtimeConfig = await loadFirebaseHostingConfig();
  if (runtimeConfig && initializeFirebaseServices(runtimeConfig)) return;
  if (!isLocalMode) {
    console.warn('Firebase env vars and Firebase Hosting runtime config are missing or still use placeholders. The app will continue in local-only mode.');
  }
};

export const firebaseReady = initializeFirebase();
export const getFirebaseInitializationError = () => initializationError;
