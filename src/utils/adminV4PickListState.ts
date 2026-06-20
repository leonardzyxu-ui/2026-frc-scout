import type { AlliancePickRecommendation } from '../types';
import { sanitizeAdminV4TeamNumber } from './adminV4TeamSearch.ts';

export type AdminV4PickStatusMap = Record<string, { status: AlliancePickRecommendation['status']; pickedBy?: string }>;

export interface AdminV4PickListState {
  allianceSeed: number;
  statuses: AdminV4PickStatusMap;
}

const DEFAULT_PICK_LIST_STATE: AdminV4PickListState = {
  allianceSeed: 1,
  statuses: {}
};

const isAlliancePickStatus = (value: unknown): value is AlliancePickRecommendation['status'] =>
  value === 'available' || value === 'picked' || value === 'declined' || value === 'unavailable';

export const getAdminV4PickListStorageKey = (eventKey: string) =>
  `adminv4_pick_list_state_${eventKey.trim().toUpperCase() || 'UNKNOWN'}`;

export const normalizeAdminV4AllianceSeed = (value: unknown) =>
  Math.max(1, Math.min(8, Number(value) || 1));

export const normalizeAdminV4PickStatusMap = (
  rawStatuses: unknown
): AdminV4PickStatusMap => {
  if (!rawStatuses || typeof rawStatuses !== 'object') return {};
  const statuses: AdminV4PickStatusMap = {};
  Object.entries(rawStatuses as Record<string, { status?: unknown; pickedBy?: unknown }>).forEach(([teamNumber, value]) => {
    const sanitizedTeamNumber = sanitizeAdminV4TeamNumber(teamNumber);
    if (!sanitizedTeamNumber || !isAlliancePickStatus(value?.status)) return;
    if (value.status === 'available') return;
    statuses[sanitizedTeamNumber] = {
      status: value.status,
      pickedBy: typeof value.pickedBy === 'string' ? value.pickedBy : ''
    };
  });
  return statuses;
};

export const loadAdminV4PickListState = (eventKey: string): AdminV4PickListState => {
  if (typeof window === 'undefined') return DEFAULT_PICK_LIST_STATE;
  try {
    const raw = window.localStorage.getItem(getAdminV4PickListStorageKey(eventKey));
    if (!raw) return DEFAULT_PICK_LIST_STATE;
    const parsed = JSON.parse(raw) as { allianceSeed?: unknown; statuses?: unknown };
    return {
      allianceSeed: normalizeAdminV4AllianceSeed(parsed.allianceSeed),
      statuses: normalizeAdminV4PickStatusMap(parsed.statuses)
    };
  } catch (error) {
    console.warn('Failed to load Admin V4 pick-list state', error);
    return DEFAULT_PICK_LIST_STATE;
  }
};

export const saveAdminV4PickListState = (
  eventKey: string,
  allianceSeed: number,
  statuses: AdminV4PickStatusMap
) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getAdminV4PickListStorageKey(eventKey),
      JSON.stringify({
        allianceSeed: normalizeAdminV4AllianceSeed(allianceSeed),
        statuses: normalizeAdminV4PickStatusMap(statuses),
        updatedAt: Date.now()
      })
    );
  } catch (error) {
    console.warn('Failed to save Admin V4 pick-list state', error);
  }
};
