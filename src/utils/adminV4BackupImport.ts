import type {
  ModelFeatureSnapshot,
  ModelLabSnapshot,
  PowerCoinBet,
  PowerCoinLedgerEntry,
  ScoutAssignmentPlan
} from '../types';
import type { ScoutArchiveBundle } from './scoutArchive';
import type { AdminV4CacheEntry } from './adminV4LocalStore';
import type { AdminV4Settings } from './adminV4Settings';
import type { UploadedTbaCsvPack } from './adminV4TbaCsv';
import type { CachedPreMatchSheet } from './preMatchCache';

export interface AdminV4BackupPayload {
  cacheEntries?: AdminV4CacheEntry[];
  powerCoinBets?: PowerCoinBet[];
  powerCoinLedger?: PowerCoinLedgerEntry[];
  scoutAssignmentPlan?: ScoutAssignmentPlan | null;
  modelSnapshots?: ModelLabSnapshot[];
  modelFeatureSnapshots?: ModelFeatureSnapshot[];
}

export interface AdminV4FullLocalBackup {
  format: 'rebuilt-2026-admin-v4-full-local-backup' | 'rebuilt-2026-admin-v2-full-local-backup';
  version: number;
  eventKey: string;
  exportedAt: number;
  settings?: AdminV4Settings;
  firstEventsCredentials?: {
    username: string;
    savedAt: number;
    tokenIncluded: false;
  } | null;
  uploadedTbaPack?: UploadedTbaCsvPack | null;
  preMatchCache?: CachedPreMatchSheet | null;
  scoutArchive?: ScoutArchiveBundle;
  adminV4?: AdminV4BackupPayload;
  adminV2?: AdminV4BackupPayload;
}

export type BackupImportCategory =
  | 'scoutArchive'
  | 'sourceCache'
  | 'scoutRewards'
  | 'scoutAssignments'
  | 'modelSnapshots'
  | 'uploadedTba'
  | 'preScoutCache'
  | 'settings';

export type BackupImportOptions = Record<BackupImportCategory, boolean>;

export interface BackupImportPreview {
  backup: AdminV4FullLocalBackup;
  payload: AdminV4BackupPayload;
}

export const DEFAULT_BACKUP_IMPORT_OPTIONS: BackupImportOptions = {
  scoutArchive: true,
  sourceCache: true,
  scoutRewards: true,
  scoutAssignments: true,
  modelSnapshots: true,
  uploadedTba: true,
  preScoutCache: true,
  settings: false
};

export const BACKUP_IMPORT_CATEGORY_COPY: Record<BackupImportCategory, { label: string; impact: string }> = {
  scoutArchive: {
    label: 'Scout archive rows',
    impact: 'Restores local scout evidence and preserves conflict versions instead of overwriting remote data.'
  },
  sourceCache: {
    label: 'Source cache',
    impact: 'Restores cached TBA/FIRST/source payloads used for schedule, teams, rankings, and freshness.'
  },
  scoutRewards: {
    label: 'Scout rewards',
    impact: 'Restores local scout reward predictions and ledger entries.'
  },
  scoutAssignments: {
    label: 'Scout assignments',
    impact: 'Restores the saved assignment plan and scout roster for this event.'
  },
  modelSnapshots: {
    label: 'Model snapshots',
    impact: 'Restores local model validation and feature snapshots used by Data Health and Reports.'
  },
  uploadedTba: {
    label: 'Uploaded TBA pack',
    impact: 'Restores uploaded schedule/ranking/alliance/OPR files for offline source fallback.'
  },
  preScoutCache: {
    label: 'Pre Scout cache',
    impact: 'Restores before-event public profiles and returned Pre Scout evidence.'
  },
  settings: {
    label: 'Admin settings',
    impact: 'Restores own team, selected model, searched team, and test-mode fields from the backup.'
  }
};

export const isAdminV4FullLocalBackup = (value: unknown): value is AdminV4FullLocalBackup => {
  if (!value || typeof value !== 'object') return false;
  const backup = value as Partial<AdminV4FullLocalBackup>;
  return (
    (
      backup.format === 'rebuilt-2026-admin-v4-full-local-backup' ||
      backup.format === 'rebuilt-2026-admin-v2-full-local-backup'
    ) &&
    typeof backup.eventKey === 'string'
  );
};

export const getAdminV4BackupPayload = (backup: AdminV4FullLocalBackup): AdminV4BackupPayload =>
  backup.adminV4 || backup.adminV2 || {};

export const countBackupImportCategory = (
  backup: AdminV4FullLocalBackup,
  payload: AdminV4BackupPayload,
  category: BackupImportCategory
) => {
  switch (category) {
    case 'scoutArchive':
      return backup.scoutArchive?.records?.length || 0;
    case 'sourceCache':
      return payload.cacheEntries?.length || 0;
    case 'scoutRewards':
      return (payload.powerCoinBets?.length || 0) + (payload.powerCoinLedger?.length || 0);
    case 'scoutAssignments':
      return payload.scoutAssignmentPlan?.assignments.length || 0;
    case 'modelSnapshots':
      return (payload.modelSnapshots?.length || 0) + (payload.modelFeatureSnapshots?.length || 0);
    case 'uploadedTba':
      return backup.uploadedTbaPack ? 1 : 0;
    case 'preScoutCache':
      return (backup.preMatchCache?.profiles?.length || 0) + (backup.preMatchCache?.adminTaskEvidence?.length || 0);
    case 'settings':
      return backup.settings ? 1 : 0;
  }
};
