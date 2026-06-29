import type { MatchScoutingV4 } from '../types';
import type { ScoutArchiveRecord } from './scoutArchive';
import {
  decideLocalFirstSync,
  mergeLocalFirstVersionLedger,
  normalizeLocalFirstSyncRecord,
  stableLocalFirstContentHash,
  type LocalFirstSyncDecision,
  type LocalFirstSyncRecord,
  type LocalFirstSyncSurface
} from './localFirstSyncContract.ts';

export interface RemoteSyncPayload {
  payload: MatchScoutingV4 | Record<string, unknown>;
  recordId: string;
  logicalId?: string;
  eventKey?: string;
  updatedAt?: number;
  deleted?: boolean;
  surface?: Extract<LocalFirstSyncSurface, 'head-scout-firebase' | 'powerscout-mac'>;
}

export interface LocalFirstSyncPlanItem {
  key: string;
  action: LocalFirstSyncDecision['action'];
  winner: LocalFirstSyncDecision['winner'];
  reason: string;
  preserveBoth: boolean;
  localCurrent: LocalFirstSyncRecord | null;
  remoteCurrent: LocalFirstSyncRecord | null;
  localVersions: LocalFirstSyncRecord[];
  remoteVersions: LocalFirstSyncRecord[];
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const toVersion = (value: unknown) => {
  const version = Math.trunc(Number(value));
  return Number.isFinite(version) && version >= 1 ? version : 1;
};

const toTimestamp = (value: unknown) => {
  const timestamp = Math.trunc(Number(value));
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : 0;
};

const syncKey = (record: Pick<LocalFirstSyncRecord, 'eventKey' | 'logicalId'>) =>
  `${record.eventKey.trim().toUpperCase()}:${record.logicalId.trim()}`;

export const buildSyncRecordFromScoutArchiveRecord = (
  record: ScoutArchiveRecord,
  surface: LocalFirstSyncSurface = 'scout-browser'
): LocalFirstSyncRecord => {
  const versionMetadata = record.recordType === 'matchV4' ? record.payload.versionMetadata : null;
  const version = toVersion(versionMetadata?.version);
  const currentVersionSubmitted =
    record.recordType === 'matchV4'
      ? !!versionMetadata?.currentVersionSubmitted || record.syncStatus === 'synced'
      : record.syncStatus === 'synced';

  return normalizeLocalFirstSyncRecord({
    eventKey: record.eventKey,
    logicalId: versionMetadata?.logicalId || record.logicalId,
    version,
    currentVersionSubmitted,
    updatedAt: record.updatedAt,
    surface,
    recordId: record.recordId,
    deleted: record.deleted,
    contentHash: stableLocalFirstContentHash(record.payload)
  });
};

export const buildSyncRecordFromRemotePayload = ({
  payload,
  recordId,
  logicalId,
  eventKey,
  updatedAt,
  deleted,
  surface = 'head-scout-firebase'
}: RemoteSyncPayload): LocalFirstSyncRecord => {
  const payloadRecord = asRecord(payload);
  const versionMetadata = asRecord(payloadRecord.versionMetadata);
  const resolvedLogicalId =
    logicalId ||
    String(versionMetadata.logicalId || '') ||
    recordId;
  const resolvedEventKey =
    eventKey ||
    String(payloadRecord.eventKey || '') ||
    String(versionMetadata.eventKey || '');

  return normalizeLocalFirstSyncRecord({
    eventKey: resolvedEventKey,
    logicalId: resolvedLogicalId,
    version: toVersion(versionMetadata.version),
    currentVersionSubmitted:
      !!versionMetadata.currentVersionSubmitted || versionMetadata.submissionNumber === 1 || surface === 'head-scout-firebase',
    updatedAt: updatedAt ?? (
      toTimestamp(versionMetadata.editedAt) ||
      toTimestamp(payloadRecord.timestamp) ||
      toTimestamp(versionMetadata.submittedAt)
    ),
    surface,
    recordId,
    deleted: !!deleted,
    contentHash: stableLocalFirstContentHash(payload)
  });
};

const groupBySyncKey = (records: LocalFirstSyncRecord[]) => {
  const groups = new Map<string, LocalFirstSyncRecord[]>();
  records.map(normalizeLocalFirstSyncRecord).forEach(record => {
    const key = syncKey(record);
    groups.set(key, [...(groups.get(key) || []), record]);
  });
  return groups;
};

const missingSideDecision = (
  key: string,
  localVersions: LocalFirstSyncRecord[],
  remoteVersions: LocalFirstSyncRecord[]
): LocalFirstSyncPlanItem => {
  const localLedger = mergeLocalFirstVersionLedger(localVersions);
  const remoteLedger = mergeLocalFirstVersionLedger(remoteVersions);
  const localCurrent = localLedger.current;
  const remoteCurrent = remoteLedger.current;

  if (localCurrent && !remoteCurrent) {
    return {
      key,
      action: 'push-local',
      winner: 'local',
      reason: 'Local archive has a record that the remote side does not have yet.',
      preserveBoth: true,
      localCurrent,
      remoteCurrent: null,
      localVersions: localLedger.versions,
      remoteVersions: []
    };
  }

  return {
    key,
    action: 'pull-remote',
    winner: 'remote',
    reason: 'Remote side has a record that the local archive does not have yet.',
    preserveBoth: true,
    localCurrent: null,
    remoteCurrent,
    localVersions: [],
    remoteVersions: remoteLedger.versions
  };
};

export const buildLocalFirstSyncPlan = (input: {
  localRecords: LocalFirstSyncRecord[];
  remoteRecords: LocalFirstSyncRecord[];
}): LocalFirstSyncPlanItem[] => {
  const localGroups = groupBySyncKey(input.localRecords);
  const remoteGroups = groupBySyncKey(input.remoteRecords);
  const keys = Array.from(new Set([...localGroups.keys(), ...remoteGroups.keys()])).sort();

  return keys.map(key => {
    const localVersions = localGroups.get(key) || [];
    const remoteVersions = remoteGroups.get(key) || [];
    const localLedger = mergeLocalFirstVersionLedger(localVersions);
    const remoteLedger = mergeLocalFirstVersionLedger(remoteVersions);
    const localCurrent = localLedger.current;
    const remoteCurrent = remoteLedger.current;

    if (!localCurrent || !remoteCurrent) {
      return missingSideDecision(key, localVersions, remoteVersions);
    }

    const decision = decideLocalFirstSync(localCurrent, remoteCurrent);
    return {
      key,
      action: decision.action,
      winner: decision.winner,
      reason: decision.reason,
      preserveBoth: decision.preserveBoth,
      localCurrent,
      remoteCurrent,
      localVersions: localLedger.versions,
      remoteVersions: remoteLedger.versions
    };
  });
};
