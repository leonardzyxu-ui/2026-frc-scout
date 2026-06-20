import { doc } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_EVENT_KEY } from './defaultEvent.ts';
import { normalizeEventKey } from './keys';

export { DEFAULT_EVENT_KEY };

export const getSharedEventDocRef = () => doc(db, 'appState', 'currentEvent');

export const getStoredEventKey = () =>
  normalizeEventKey(localStorage.getItem('globalEventKey') || localStorage.getItem('setting_event'), DEFAULT_EVENT_KEY);

export const storeEventKey = (eventKey: string) => {
  const normalized = normalizeEventKey(eventKey, DEFAULT_EVENT_KEY);
  localStorage.setItem('globalEventKey', normalized);
  localStorage.setItem('setting_event', normalized);
};

export const getPersistentDeviceId = () => {
  let deviceId = localStorage.getItem('scout_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : `device_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem('scout_device_id', deviceId);
  }
  return deviceId;
};
