import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, MatchScoutingV4, PitScoutingV2 } from '../types';
import { isMatchScoutingV3, mapLegacyMatchScoutingToV3 } from './matchScoutingV3';
import {
  ScoutArchiveRecord,
  upsertMatchArchiveRecordV4,
  updateScoutArchiveRecordSyncState
} from './scoutArchive';
import {
  readMatchScoutingV4Record,
  writeMatchDefenseScoutingRecord,
  writeMatchScoutingV3Record,
  writeMatchScoutingV4Record,
  writePitScoutingRecord
} from './scoutingWrites';
import {
  buildLocalFirstSyncPlan,
  buildSyncRecordFromRemotePayload,
  buildSyncRecordFromScoutArchiveRecord,
  type LocalFirstSyncPlanItem
} from './localFirstSyncPlanner';

export interface ScoutArchiveSyncResult {
  recordId: string;
  outcome: 'synced' | 'conflict' | 'failed';
  message: string;
}

const toMatchPayloadV3 = (payload: MatchScoutingV2 | MatchScoutingV3) =>
  isMatchScoutingV3(payload) ? payload : mapLegacyMatchScoutingToV3(payload);

const markMatchV4PayloadSubmitted = (payload: MatchScoutingV4): MatchScoutingV4 => ({
  ...payload,
  versionMetadata: payload.versionMetadata
    ? {
        ...payload.versionMetadata,
        currentVersionSubmitted: true,
        submissionNumber: 1,
        submittedAt: payload.versionMetadata.submittedAt || Date.now()
      }
    : payload.versionMetadata
});

const chooseMatchV4SyncPlan = async (
  record: ScoutArchiveRecord,
  payload: MatchScoutingV4
): Promise<{ mode: 'strict' | 'replace'; plan: LocalFirstSyncPlanItem | null; remoteRecord: MatchScoutingV4 | null }> => {
  const remote = await readMatchScoutingV4Record(payload);
  if (!remote.exists || !remote.record) {
    return { mode: 'strict', plan: null, remoteRecord: null };
  }

  const [plan] = buildLocalFirstSyncPlan({
    localRecords: [buildSyncRecordFromScoutArchiveRecord(record, 'scout-browser')],
    remoteRecords: [buildSyncRecordFromRemotePayload({
      payload: remote.record,
      recordId: `matchV4:${remote.record.eventKey}:${remote.docId}`,
      logicalId: remote.record.versionMetadata?.logicalId,
      eventKey: remote.record.eventKey,
      surface: 'head-scout-firebase'
    })]
  });

  return {
    mode: plan?.action === 'push-local' ? 'replace' : 'strict',
    plan: plan || null,
    remoteRecord: remote.record
  };
};

export const syncScoutArchiveRecordToFirebase = async (
  record: ScoutArchiveRecord
): Promise<ScoutArchiveSyncResult> => {
  await updateScoutArchiveRecordSyncState(record.recordId, {
    syncStatus: 'pending_sync',
    lastFirebaseAttemptAt: Date.now(),
    lastFirebaseError: ''
  });

  try {
    const mode = record.syncMode || 'strict';
    let writeResult;

    if (record.recordType === 'matchV4') {
      const payload = markMatchV4PayloadSubmitted(record.payload as MatchScoutingV4);
      const v4Plan = await chooseMatchV4SyncPlan(record, payload);

      if (v4Plan.plan?.action === 'pull-remote' && v4Plan.remoteRecord) {
        await upsertMatchArchiveRecordV4(v4Plan.remoteRecord, v4Plan.remoteRecord.scoutName || record.username, 'json_import', {
          syncStatus: 'synced',
          preserveExistingOnConflict: true
        });
        const message = `Firebase has newer ${v4Plan.remoteRecord.versionMetadata?.version ? `version ${v4Plan.remoteRecord.versionMetadata.version}` : 'Match V4 data'}; pulled it into local history and kept ${record.recordId} for review.`;
        await updateScoutArchiveRecordSyncState(record.recordId, {
          syncStatus: 'unsynced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: message
        });
        return {
          recordId: record.recordId,
          outcome: 'conflict',
          message
        };
      }

      if (v4Plan.plan?.action === 'preserve-conflict') {
        const message = `Firebase sync conflict preserved: ${v4Plan.plan.reason}`;
        await updateScoutArchiveRecordSyncState(record.recordId, {
          syncStatus: 'unsynced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: message
        });
        return {
          recordId: record.recordId,
          outcome: 'conflict',
          message
        };
      }

      writeResult = await writeMatchScoutingV4Record(payload, { mode: mode === 'replace' ? 'replace' : v4Plan.mode });
    } else {
      writeResult =
        record.recordType === 'match'
          ? await writeMatchScoutingV3Record(toMatchPayloadV3(record.payload as MatchScoutingV2 | MatchScoutingV3), { mode })
          : record.recordType === 'matchDefense'
            ? await writeMatchDefenseScoutingRecord(record.payload as MatchDefenseScoutingV1, { mode })
            : await writePitScoutingRecord(record.eventKey, record.payload as PitScoutingV2, { mode });
    }

    if (writeResult.outcome === 'conflict') {
      await updateScoutArchiveRecordSyncState(record.recordId, {
        syncStatus: 'unsynced',
        lastFirebaseAttemptAt: Date.now(),
        lastFirebaseError: writeResult.message
      });
      return {
        recordId: record.recordId,
        outcome: 'conflict',
        message: writeResult.message
      };
    }

    await updateScoutArchiveRecordSyncState(record.recordId, {
      syncStatus: 'synced',
      lastFirebaseAttemptAt: Date.now(),
      lastFirebaseError: ''
    });
    return {
      recordId: record.recordId,
      outcome: 'synced',
      message: writeResult.message
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Firebase sync failed.';
    await updateScoutArchiveRecordSyncState(record.recordId, {
      syncStatus: 'unsynced',
      lastFirebaseAttemptAt: Date.now(),
      lastFirebaseError: message
    });
    return {
      recordId: record.recordId,
      outcome: 'failed',
      message
    };
  }
};
