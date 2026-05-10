import { DEFAULT_EVENT_KEY } from './sharedEventState';

export type AdminV2SelectedMetric = 'ppc' | 'opr' | 'epa';

export interface AdminV2Settings {
  eventKey: string;
  ownTeamNumber: string;
  selectedMetric: AdminV2SelectedMetric;
  searchedTeamNumber: string;
}

const STORAGE_KEY = 'admin_v2_settings';

const sanitizeEventKey = (value: string) => {
  const trimmed = value.trim();
  return trimmed || DEFAULT_EVENT_KEY;
};

const sanitizeTeamNumber = (value: string) => value.replace(/[^\d]/g, '');

export const getDefaultAdminV2Settings = (): AdminV2Settings => ({
  eventKey: DEFAULT_EVENT_KEY,
  ownTeamNumber: '',
  selectedMetric: 'ppc',
  searchedTeamNumber: ''
});

export const loadAdminV2Settings = (): AdminV2Settings => {
  if (typeof window === 'undefined') {
    return getDefaultAdminV2Settings();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultAdminV2Settings();

    const parsed = JSON.parse(raw) as Partial<AdminV2Settings>;
    return {
      eventKey: sanitizeEventKey(parsed.eventKey || DEFAULT_EVENT_KEY),
      ownTeamNumber: sanitizeTeamNumber(parsed.ownTeamNumber || ''),
      selectedMetric:
        parsed.selectedMetric === 'epa' || parsed.selectedMetric === 'opr' || parsed.selectedMetric === 'ppc'
          ? parsed.selectedMetric
          : 'ppc',
      searchedTeamNumber: sanitizeTeamNumber(parsed.searchedTeamNumber || '')
    };
  } catch (error) {
    console.error('Failed to load Admin V2 settings', error);
    return getDefaultAdminV2Settings();
  }
};

export const saveAdminV2Settings = (settings: AdminV2Settings) => {
  if (typeof window === 'undefined') return;

  const normalized: AdminV2Settings = {
    eventKey: sanitizeEventKey(settings.eventKey),
    ownTeamNumber: sanitizeTeamNumber(settings.ownTeamNumber),
    selectedMetric: settings.selectedMetric,
    searchedTeamNumber: sanitizeTeamNumber(settings.searchedTeamNumber)
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
};
