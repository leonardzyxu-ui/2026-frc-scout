import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { firebaseReady } from './firebase';

const LEGACY_ADMIN_REFRESH_KEY = 'rebuiltLegacyAdminCacheRefresh';
const LEGACY_ADMIN_REFRESH_MARKER = 'legacyAdminFresh';

const isLegacyAdminRoute = () =>
  window.location.pathname === '/adminv1' ||
  window.location.pathname === '/adminv2' ||
  window.location.pathname.startsWith('/adminv1/') ||
  window.location.pathname.startsWith('/adminv2/');

const rescueLegacyAdminRouteFromStaleShell = async () => {
  if (!isLegacyAdminRoute() || !('serviceWorker' in navigator)) return;

  const params = new URLSearchParams(window.location.search);
  const alreadyRefreshed = params.get(LEGACY_ADMIN_REFRESH_MARKER) === '1';
  const refreshedPath = sessionStorage.getItem(LEGACY_ADMIN_REFRESH_KEY);
  const currentPath = `${window.location.pathname}${window.location.search}`;

  if (alreadyRefreshed || refreshedPath === currentPath) return;

  sessionStorage.setItem(LEGACY_ADMIN_REFRESH_KEY, currentPath);

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(registration => registration.unregister()));

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
  }

  params.set(LEGACY_ADMIN_REFRESH_MARKER, '1');
  window.location.replace(`${window.location.pathname}?${params.toString()}${window.location.hash}`);
  return new Promise<void>(() => undefined);
};

const registerPwaServiceWorker = () => {
  if (isLegacyAdminRoute()) return;

  const updateSW = registerSW({
    onNeedRefresh() {
      // Auto-reload for PWA updates since confirm() doesn't work in iframes
      updateSW(true);
    },
    onOfflineReady() {
      console.log('App is ready to work offline');
    },
  });
};

const renderApp = () => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

void rescueLegacyAdminRouteFromStaleShell()
  .catch(error => {
    console.warn('Legacy admin cache rescue did not finish. Continuing with normal startup.', error);
  })
  .then(() => firebaseReady)
  .catch(error => {
    console.warn('Firebase startup did not finish before render. Continuing in local-first mode.', error);
  })
  .finally(() => {
    registerPwaServiceWorker();
    renderApp();
  });
