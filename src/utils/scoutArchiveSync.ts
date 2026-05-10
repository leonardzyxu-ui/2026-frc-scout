import { MatchDefenseScoutingV1, MatchScoutingV2, MatchScoutingV3, MatchScoutingV4, PitScoutingV2 } from '../types';
import { isMatchScoutingV3, mapLegacyMatchScoutingToV3 } from './matchScoutingV3';
import {
  ScoutArchiveRecord,
  updateScoutArchiveRecordSyncState
} from './scoutArchive';
import {
  writeMatchDefenseScoutingRecord,
  writeMatchScoutingV3Record,
  writeMatchScoutingV4Record,
  writePitScoutingRecord
} from './scoutingWrites';

export interface ScoutArchiveSyncResult {
  recordId: string;
  outcome: 'synced' | 'conflict' | 'failed';
  message: string;
}

const toMatchPayloadV3 = (payload: MatchScoutingV2 | MatchScoutingV3) =>
  isMatchScoutingV3(payload) ? payload : mapLegacyMatchScoutingToV3(payload);

export const syncScoutArchiveRecordToFirebase = async (
  record: ScoutArchiveRecord
): Promise<ScoutArchiveSyncResult> => {
  await updateScoutArchiveRecordSyncState(record.recordId, {
    syncStatus: 'pending_sync',
    lastFirebaseAttemptAt: Date.now(),
    lastFirebaseError: ''
  });

  try {
    const writeResult =
      record.recordType === 'matchV4'
        ? await writeMatchScoutingV4Record(record.payload as MatchScoutingV4, { mode: 'strict' })
        : record.recordType === 'match'
          ? await writeMatchScoutingV3Record(toMatchPayloadV3(record.payload as MatchScoutingV2 | MatchScoutingV3), { mode: 'strict' })
          : record.recordType === 'matchDefense'
            ? await writeMatchDefenseScoutingRecord(record.payload as MatchDefenseScoutingV1, { mode: 'strict' })
            : await writePitScoutingRecord(record.eventKey, record.payload as PitScoutingV2, { mode: 'strict' });

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
