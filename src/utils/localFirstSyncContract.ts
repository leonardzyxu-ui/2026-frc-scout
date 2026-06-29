export type LocalFirstSyncSurface = 'scout-browser' | 'head-scout-firebase' | 'powerscout-mac';

export interface LocalFirstSyncRecord {
  eventKey: string;
  logicalId: string;
  version: number;
  currentVersionSubmitted: boolean;
  updatedAt: number;
  surface: LocalFirstSyncSurface;
  recordId: string;
  deleted?: boolean;
  contentHash?: string;
}

export interface LocalFirstSyncDecision {
  action: 'push-local' | 'pull-remote' | 'noop' | 'preserve-conflict';
  winner: 'local' | 'remote' | 'equal' | 'conflict';
  reason: string;
  preserveBoth: boolean;
}

const CONTENT_HASH_IGNORED_KEYS = new Set([
  'timestamp',
  'deviceId',
  'editHistory',
  'currentVersionSubmitted',
  'submissionNumber',
  'submittedAt',
  'lastFirebaseAttemptAt',
  'lastFirebaseError',
  'syncStatus'
]);

export const stableLocalFirstStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableLocalFirstStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !CONTENT_HASH_IGNORED_KEYS.has(key))
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableLocalFirstStringify(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value) ?? 'undefined';
};

export const stableLocalFirstContentHash = (value: unknown) => {
  const text = stableLocalFirstStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const normalizeVersion = (value: unknown) => {
  const version = Math.trunc(Number(value));
  return Number.isFinite(version) && version >= 1 ? version : 1;
};

const normalizeTimestamp = (value: unknown) => {
  const timestamp = Math.trunc(Number(value));
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : 0;
};

export const normalizeLocalFirstSyncRecord = (record: LocalFirstSyncRecord): LocalFirstSyncRecord => ({
  ...record,
  eventKey: record.eventKey.trim().toUpperCase(),
  logicalId: record.logicalId.trim(),
  version: normalizeVersion(record.version),
  updatedAt: normalizeTimestamp(record.updatedAt),
  currentVersionSubmitted: !!record.currentVersionSubmitted,
  deleted: !!record.deleted,
  contentHash: record.contentHash || ''
});

export const compareLocalFirstSyncRecords = (
  left: LocalFirstSyncRecord,
  right: LocalFirstSyncRecord
) => {
  const normalizedLeft = normalizeLocalFirstSyncRecord(left);
  const normalizedRight = normalizeLocalFirstSyncRecord(right);
  if (normalizedLeft.version !== normalizedRight.version) {
    return normalizedLeft.version > normalizedRight.version ? 1 : -1;
  }
  if (normalizedLeft.updatedAt !== normalizedRight.updatedAt) {
    return normalizedLeft.updatedAt > normalizedRight.updatedAt ? 1 : -1;
  }
  if (normalizedLeft.currentVersionSubmitted !== normalizedRight.currentVersionSubmitted) {
    return normalizedLeft.currentVersionSubmitted ? 1 : -1;
  }
  return normalizedLeft.recordId.localeCompare(normalizedRight.recordId);
};

export const decideLocalFirstSync = (
  local: LocalFirstSyncRecord,
  remote: LocalFirstSyncRecord
): LocalFirstSyncDecision => {
  const normalizedLocal = normalizeLocalFirstSyncRecord(local);
  const normalizedRemote = normalizeLocalFirstSyncRecord(remote);

  if (
    normalizedLocal.eventKey !== normalizedRemote.eventKey ||
    normalizedLocal.logicalId !== normalizedRemote.logicalId
  ) {
    return {
      action: 'preserve-conflict',
      winner: 'conflict',
      reason: 'Records do not describe the same event/logical row.',
      preserveBoth: true
    };
  }

  const contentMatches =
    normalizedLocal.contentHash &&
    normalizedRemote.contentHash &&
    normalizedLocal.contentHash === normalizedRemote.contentHash;
  if (
    normalizedLocal.version === normalizedRemote.version &&
    normalizedLocal.contentHash &&
    normalizedRemote.contentHash &&
    normalizedLocal.contentHash !== normalizedRemote.contentHash
  ) {
    return {
      action: 'preserve-conflict',
      winner: 'conflict',
      reason: `Both sides claim version ${normalizedLocal.version} with different content.`,
      preserveBoth: true
    };
  }

  if (contentMatches || (
    normalizedLocal.version === normalizedRemote.version &&
    normalizedLocal.currentVersionSubmitted === normalizedRemote.currentVersionSubmitted &&
    normalizedLocal.deleted === normalizedRemote.deleted &&
    normalizedLocal.updatedAt === normalizedRemote.updatedAt
  )) {
    return {
      action: 'noop',
      winner: 'equal',
      reason: 'Both sides already agree on the current record.',
      preserveBoth: true
    };
  }

  if (normalizedLocal.version > normalizedRemote.version) {
    return {
      action: 'push-local',
      winner: 'local',
      reason: `Local version ${normalizedLocal.version} is newer than remote version ${normalizedRemote.version}.`,
      preserveBoth: true
    };
  }

  if (normalizedRemote.version > normalizedLocal.version) {
    return {
      action: 'pull-remote',
      winner: 'remote',
      reason: `Remote version ${normalizedRemote.version} is newer than local version ${normalizedLocal.version}.`,
      preserveBoth: true
    };
  }

  const comparison = compareLocalFirstSyncRecords(normalizedLocal, normalizedRemote);
  if (comparison > 0) {
    return {
      action: 'push-local',
      winner: 'local',
      reason: `Both sides are version ${normalizedLocal.version}; local timestamp/submission state is newer.`,
      preserveBoth: true
    };
  }
  if (comparison < 0) {
    return {
      action: 'pull-remote',
      winner: 'remote',
      reason: `Both sides are version ${normalizedRemote.version}; remote timestamp/submission state is newer.`,
      preserveBoth: true
    };
  }

  return {
    action: 'preserve-conflict',
    winner: 'conflict',
    reason: 'Records are indistinguishable by sync metadata but not proven equal.',
    preserveBoth: true
  };
};

export const mergeLocalFirstVersionLedger = (records: LocalFirstSyncRecord[]) => {
  const byVersionAndSurface = new Map<string, LocalFirstSyncRecord>();
  for (const record of records.map(normalizeLocalFirstSyncRecord)) {
    const key = `${record.eventKey}:${record.logicalId}:v${record.version}:${record.surface}:${record.recordId}`;
    byVersionAndSurface.set(key, record);
  }
  const versions = Array.from(byVersionAndSurface.values()).sort((left, right) =>
    compareLocalFirstSyncRecords(right, left)
  );
  return {
    current: versions[0] || null,
    versions,
    preservedVersionCount: versions.length
  };
};
