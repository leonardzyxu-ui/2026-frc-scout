import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { firebaseReady } from './firebase';

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // Auto-reload for PWA updates since confirm() doesn't work in iframes
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

const renderApp = () => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

void firebaseReady.catch(error => {
  console.warn('Firebase startup did not finish before render. Continuing in local-first mode.', error);
}).finally(renderApp);
