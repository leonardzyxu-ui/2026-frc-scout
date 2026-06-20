import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, hasFirebaseServices } from '../firebase';

const ADMIN_SECRET_COLLECTION = 'adminSecrets';
const SCOUT_IDENTITY_LOCK_DOC = 'scoutIdentityLock';

export interface ScoutIdentityAdminSecret {
  passphrase: string;
  hash: string;
  updatedAt: number;
}

const getScoutIdentitySecretRef = () => doc(db, ADMIN_SECRET_COLLECTION, SCOUT_IDENTITY_LOCK_DOC);

export const loadScoutIdentityAdminSecret = async (): Promise<ScoutIdentityAdminSecret | null> => {
  if (!hasFirebaseServices) return null;

  const snapshot = await getDoc(getScoutIdentitySecretRef());
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Partial<ScoutIdentityAdminSecret>;
  if (!data.passphrase || !data.hash) return null;

  return {
    passphrase: String(data.passphrase),
    hash: String(data.hash),
    updatedAt: Number(data.updatedAt) || 0
  };
};

export const saveScoutIdentityAdminSecret = async (secret: ScoutIdentityAdminSecret) => {
  if (!hasFirebaseServices) {
    throw new Error('Firebase is not configured, so the admin backend reminder could not be saved.');
  }

  await setDoc(getScoutIdentitySecretRef(), secret, { merge: true });
};
