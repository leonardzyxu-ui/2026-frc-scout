import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
