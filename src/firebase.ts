import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
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
const hasRequiredFirebaseConfig = Object.values(firebaseConfig).every(isConfiguredValue);

let initializedApp: FirebaseApp | null = null;
let initializedDb: Firestore | null = null;
let initializedAuth: Auth | null = null;
let initializedStorage: FirebaseStorage | null = null;
let initializationError: unknown = null;

export const isFirebaseConfigured = !isLocalMode && hasRequiredFirebaseConfig;

if (isFirebaseConfigured) {
  try {
    initializedApp = initializeApp(firebaseConfig);
    initializedDb = initializeFirestore(initializedApp, {
      localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
    });
    initializedAuth = getAuth(initializedApp);
    initializedStorage = getStorage(initializedApp);

    // Sign in anonymously for scouts. Connectivity problems should not break
    // local-first scouting; the guarded admin route will explain access state.
    signInAnonymously(initializedAuth).catch(() => {
      console.warn('Anonymous Firebase sign-in is unavailable. Local scouting, QR fallback, and IndexedDB history can still run.');
    });
  } catch (error) {
    initializationError = error;
    initializedApp = null;
    initializedDb = null;
    initializedAuth = null;
    initializedStorage = null;
    console.error('Firebase initialization failed. The app will continue in local-only mode.', error);
  }
} else if (!isLocalMode) {
  console.warn('Firebase env vars are missing or still use placeholders. The app will continue in local-only mode.');
}

export const firebaseInitializationError = initializationError;
export const hasFirebaseServices = Boolean(initializedApp && initializedDb && initializedAuth && initializedStorage);

const unavailableFirebaseMessage =
  'Firebase is unavailable because the deployed app is missing valid VITE_FIREBASE_* configuration.';

const createUnavailableFirebaseService = <T>(serviceName: string) =>
  new Proxy(
    {},
    {
      get() {
        throw new Error(`${serviceName} is unavailable. ${unavailableFirebaseMessage}`);
      }
    }
  ) as T;

export const app = initializedApp;
export const db = initializedDb ?? createUnavailableFirebaseService<Firestore>('Firestore');
export const auth = initializedAuth ?? createUnavailableFirebaseService<Auth>('Firebase Auth');
export const storage = initializedStorage ?? createUnavailableFirebaseService<FirebaseStorage>('Firebase Storage');
