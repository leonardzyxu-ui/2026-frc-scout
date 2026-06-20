export const DEFAULT_SCOUT_IDENTITY_UNLOCK_HASH = '2b508c80a0325a99c0744e4f31b033c37ba9bb99781361d5a8f0499d6f8318f4';

const HASH_STORAGE_KEY = 'scout_identity_unlock_hash';
const ADMIN_PASSPHRASE_STORAGE_KEY = 'admin_v4_scout_identity_unlock_passphrase';

const isSha256Hex = (value: string) => /^[a-f0-9]{64}$/i.test(value.trim());

const normalizePassphrase = (value: string) => value.trim();

const bytesToHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

export const hashScoutIdentityPassphrase = async (passphrase: string) => {
  const normalized = normalizePassphrase(passphrase);
  if (!normalized) return '';

  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return bytesToHex(digest);
};

export const getScoutIdentityUnlockHash = () => {
  if (typeof window === 'undefined') return DEFAULT_SCOUT_IDENTITY_UNLOCK_HASH;
  const storedHash = window.localStorage.getItem(HASH_STORAGE_KEY) || '';
  return isSha256Hex(storedHash) ? storedHash.trim().toLowerCase() : DEFAULT_SCOUT_IDENTITY_UNLOCK_HASH;
};

export const loadAdminScoutIdentityPassphrase = () => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ADMIN_PASSPHRASE_STORAGE_KEY) || '';
};

export const saveAdminScoutIdentityPassphrase = async (passphrase: string) => {
  const normalized = normalizePassphrase(passphrase);
  if (!normalized) {
    throw new Error('Scout identity unlock passphrase cannot be empty.');
  }

  const hash = await hashScoutIdentityPassphrase(normalized);
  if (!isSha256Hex(hash)) {
    throw new Error('Unable to hash scout identity unlock passphrase.');
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ADMIN_PASSPHRASE_STORAGE_KEY, normalized);
    window.localStorage.setItem(HASH_STORAGE_KEY, hash);
  }

  return hash;
};

export const verifyScoutIdentityUnlockPassphrase = async (passphrase: string, expectedHash = getScoutIdentityUnlockHash()) => {
  const hash = await hashScoutIdentityPassphrase(passphrase);
  return Boolean(hash && isSha256Hex(expectedHash) && hash === expectedHash.trim().toLowerCase());
};
