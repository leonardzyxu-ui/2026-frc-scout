import { getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, hasFirebaseServices } from '../firebase';

export interface AdminAccessState {
  isAdmin: boolean;
  reason: 'claim' | 'role-doc' | 'local-mode' | 'signed-out' | 'missing-role' | 'error';
  message: string;
}

const isLocalMode = () => import.meta.env.VITE_LOCAL_MODE === 'true';

const hasAdminClaim = (claims: Record<string, unknown>) =>
  claims.admin === true || claims.scoutAdmin === true || claims.role === 'admin';

export async function getAdminAccessState(): Promise<AdminAccessState> {
  if (isLocalMode()) {
    return {
      isAdmin: true,
      reason: 'local-mode',
      message: 'Local mode grants admin access on this device.'
    };
  }

  if (!hasFirebaseServices) {
    return {
      isAdmin: false,
      reason: 'error',
      message: 'Firebase is not configured for this deployment, so admin access cannot be verified.'
    };
  }

  const user = auth.currentUser;
  if (!user) {
    return {
      isAdmin: false,
      reason: 'signed-out',
      message: 'Firebase auth is not ready yet. Try again after the app connects.'
    };
  }

  try {
    const token = await getIdTokenResult(user, true);
    if (hasAdminClaim(token.claims)) {
      return {
        isAdmin: true,
        reason: 'claim',
        message: 'Admin access granted by Firebase custom claim.'
      };
    }

    const roleSnapshot = await getDoc(doc(db, 'adminRoles', user.uid));
    if (roleSnapshot.exists() && roleSnapshot.data().enabled === true) {
      return {
        isAdmin: true,
        reason: 'role-doc',
        message: 'Admin access granted by admin role document.'
      };
    }

    return {
      isAdmin: false,
      reason: 'missing-role',
      message: `This device is signed in as ${user.uid}, but it does not have an admin role.`
    };
  } catch (error) {
    return {
      isAdmin: false,
      reason: 'error',
      message: error instanceof Error ? error.message : 'Unable to verify admin access.'
    };
  }
}

export async function isCurrentUserAdmin() {
  return (await getAdminAccessState()).isAdmin;
}

export async function verifyAdminPassword(_password: string) {
  return isCurrentUserAdmin();
}
