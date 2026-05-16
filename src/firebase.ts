import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDBcELIhSrLnBBQeO8pmP1fwx4lB2h7VRU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "scout-rebuilt-2026.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "scout-rebuilt-2026",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "scout-rebuilt-2026.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "471366348699",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:471366348699:web:7c537b84da9621053cfb3e"
};

export const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})
});
export const auth = getAuth(app);
export const storage = getStorage(app);

// Sign in anonymously for scouts
signInAnonymously(auth).catch((error) => {
  console.error("Error signing in anonymously:", error);
});
