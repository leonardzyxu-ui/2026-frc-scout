import React from 'react';
import {
  getScoutIdentityUnlockHash,
  loadAdminScoutIdentityPassphrase,
  saveAdminScoutIdentityPassphrase
} from '../../utils/scoutIdentityLock';
import {
  loadScoutIdentityAdminSecret,
  saveScoutIdentityAdminSecret
} from '../../utils/scoutIdentityAdminSecret';

export function useAdminV4ScoutIdentitySettings(settingsOpen: boolean) {
  const [scoutIdentityPassphrase, setScoutIdentityPassphrase] = React.useState(() => loadAdminScoutIdentityPassphrase());
  const [scoutIdentityHash, setScoutIdentityHash] = React.useState(() => getScoutIdentityUnlockHash());
  const [scoutIdentityStatus, setScoutIdentityStatus] = React.useState('');
  const [scoutIdentityBackendLoaded, setScoutIdentityBackendLoaded] = React.useState(false);

  const handleSaveScoutIdentityPassphrase = React.useCallback(async () => {
    try {
      const hash = await saveAdminScoutIdentityPassphrase(scoutIdentityPassphrase);
      setScoutIdentityHash(hash);
      try {
        await saveScoutIdentityAdminSecret({
          passphrase: scoutIdentityPassphrase.trim(),
          hash,
          updatedAt: Date.now()
        });
        setScoutIdentityStatus('Scout identity unlock passphrase saved on this admin browser and admin backend. Scout-facing rename checks use the hash.');
      } catch (backendError) {
        console.warn('Failed to save scout identity passphrase to admin backend', backendError);
        setScoutIdentityStatus('Scout identity unlock passphrase saved on this admin browser. Admin backend save failed or is unavailable; scout-facing rename checks still use the hash.');
      }
    } catch (passphraseError) {
      setScoutIdentityStatus(passphraseError instanceof Error ? passphraseError.message : 'Unable to save scout identity unlock passphrase.');
    }
  }, [scoutIdentityPassphrase]);

  const handleCopyScoutIdentityPassphrase = React.useCallback(async () => {
    const value = scoutIdentityPassphrase.trim();
    if (!value) {
      setScoutIdentityStatus('No plaintext scout identity passphrase is saved on this admin browser.');
      return;
    }
    if (!navigator.clipboard) {
      setScoutIdentityStatus('Unable to copy automatically. Select the passphrase field and copy it manually.');
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setScoutIdentityStatus('Scout identity unlock passphrase copied.');
    } catch (copyError) {
      console.error('Failed to copy scout identity passphrase', copyError);
      setScoutIdentityStatus('Unable to copy automatically. Select the passphrase field and copy it manually.');
    }
  }, [scoutIdentityPassphrase]);

  React.useEffect(() => {
    if (!settingsOpen || scoutIdentityBackendLoaded) return;
    let cancelled = false;
    const loadSecret = async () => {
      try {
        const secret = await loadScoutIdentityAdminSecret();
        if (cancelled || !secret) return;
        setScoutIdentityPassphrase(secret.passphrase);
        setScoutIdentityHash(secret.hash);
        setScoutIdentityStatus('Loaded scout identity passphrase reminder from the admin backend.');
      } catch (secretError) {
        console.warn('Unable to load scout identity admin secret', secretError);
      } finally {
        if (!cancelled) setScoutIdentityBackendLoaded(true);
      }
    };
    void loadSecret();
    return () => {
      cancelled = true;
    };
  }, [scoutIdentityBackendLoaded, settingsOpen]);

  return {
    handleCopyScoutIdentityPassphrase,
    handleSaveScoutIdentityPassphrase,
    scoutIdentityHash,
    scoutIdentityPassphrase,
    scoutIdentityStatus,
    setScoutIdentityPassphrase
  };
}

export default useAdminV4ScoutIdentitySettings;
