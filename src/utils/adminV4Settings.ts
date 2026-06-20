import { DEFAULT_EVENT_KEY } from './defaultEvent.ts';

export type AdminV4SelectedMetric = 'ppc' | 'opr' | 'epa' | 'ppa';

export interface AdminV4Settings {
  eventKey: string;
  ownTeamNumber: string;
  selectedMetric: AdminV4SelectedMetric;
  searchedTeamNumber: string;
  testModeEnabled: boolean;
  testModeEventKey: string;
  testModeMatchKey: string;
}

const STORAGE_KEY = 'admin_v4_settings';
const LEGACY_STORAGE_KEY = 'admin_v2_settings';

const sanitizeEventKey = (value: string) => {
  const trimmed = value.trim();
  return trimmed || DEFAULT_EVENT_KEY;
};

const sanitizeTeamNumber = (value: string) => value.replace(/[^\d]/g, '');

export const getDefaultAdminV4Settings = (): AdminV4Settings => ({
  eventKey: DEFAULT_EVENT_KEY,
  ownTeamNumber: '',
  selectedMetric: 'ppa',
  searchedTeamNumber: '',
  testModeEnabled: false,
  testModeEventKey: DEFAULT_EVENT_KEY,
  testModeMatchKey: ''
});

export const loadAdminV4Settings = (): AdminV4Settings => {
  if (typeof window === 'undefined') {
    return getDefaultAdminV4Settings();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return getDefaultAdminV4Settings();

    const parsed = JSON.parse(raw) as Partial<AdminV4Settings>;
    return {
      eventKey: sanitizeEventKey(parsed.eventKey || DEFAULT_EVENT_KEY),
      ownTeamNumber: sanitizeTeamNumber(parsed.ownTeamNumber || ''),
      selectedMetric:
        parsed.selectedMetric === 'epa' ||
        parsed.selectedMetric === 'opr' ||
        parsed.selectedMetric === 'ppc' ||
        parsed.selectedMetric === 'ppa'
          ? parsed.selectedMetric
          : 'ppa',
      searchedTeamNumber: sanitizeTeamNumber(parsed.searchedTeamNumber || ''),
      // Rehearsal/test mode is intentionally session-scoped so an admin device
      // cannot reopen a real event in a simulated state by surprise.
      testModeEnabled: false,
      testModeEventKey: sanitizeEventKey(parsed.testModeEventKey || parsed.eventKey || DEFAULT_EVENT_KEY),
      testModeMatchKey: ''
    };
  } catch (error) {
    console.error('Failed to load Admin V4 settings', error);
    return getDefaultAdminV4Settings();
  }
};

export const saveAdminV4Settings = (settings: AdminV4Settings) => {
  if (typeof window === 'undefined') return;

  const normalized: AdminV4Settings = {
    eventKey: sanitizeEventKey(settings.eventKey),
    ownTeamNumber: sanitizeTeamNumber(settings.ownTeamNumber),
    selectedMetric: settings.selectedMetric,
    searchedTeamNumber: sanitizeTeamNumber(settings.searchedTeamNumber),
    testModeEnabled: false,
    testModeEventKey: sanitizeEventKey(settings.testModeEventKey || settings.eventKey),
    testModeMatchKey: ''
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(normalized));
};
