import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decideLocalFirstSync,
  mergeLocalFirstVersionLedger,
  stableLocalFirstContentHash
} from '../src/utils/localFirstSyncContract.ts';
import {
  buildLocalFirstSyncPlan,
  buildSyncRecordFromRemotePayload,
  buildSyncRecordFromScoutArchiveRecord
} from '../src/utils/localFirstSyncPlanner.ts';

const base = {
  eventKey: '2026mnum',
  logicalId: '2026mnum:qm1:254',
  version: 1,
  currentVersionSubmitted: true,
  updatedAt: 1000,
  surface: 'scout-browser',
  recordId: 'local-v1',
  contentHash: 'hash-v1'
};

test('local-first sync pushes scout cache when scout version is newer', () => {
  const decision = decideLocalFirstSync(
    { ...base, version: 2, currentVersionSubmitted: false, recordId: 'local-v2', contentHash: 'hash-v2' },
    { ...base, surface: 'head-scout-firebase', recordId: 'firebase-v1' }
  );

  assert.equal(decision.action, 'push-local');
  assert.equal(decision.winner, 'local');
  assert.equal(decision.preserveBoth, true);
});

test('local-first sync pulls remote when head scout version is newer', () => {
  const decision = decideLocalFirstSync(
    { ...base, recordId: 'local-v1' },
    { ...base, surface: 'head-scout-firebase', version: 3, recordId: 'firebase-v3', contentHash: 'hash-v3' }
  );

  assert.equal(decision.action, 'pull-remote');
  assert.equal(decision.winner, 'remote');
  assert.equal(decision.preserveBoth, true);
});

test('local-first sync preserves same-version content conflicts', () => {
  const decision = decideLocalFirstSync(
    { ...base, version: 2, recordId: 'local-v2', contentHash: 'local-content' },
    { ...base, surface: 'head-scout-firebase', version: 2, recordId: 'firebase-v2', contentHash: 'remote-content' }
  );

  assert.equal(decision.action, 'preserve-conflict');
  assert.equal(decision.winner, 'conflict');
  assert.match(decision.reason, /same version|version 2/i);
});

test('local-first sync ledger preserves every version and exposes current', () => {
  const ledger = mergeLocalFirstVersionLedger([
    { ...base, version: 1, recordId: 'local-v1' },
    { ...base, version: 2, recordId: 'local-v2', currentVersionSubmitted: false },
    { ...base, surface: 'head-scout-firebase', version: 3, recordId: 'firebase-v3' },
    { ...base, surface: 'powerscout-mac', version: 2, recordId: 'mac-v2' }
  ]);

  assert.equal(ledger.current?.recordId, 'firebase-v3');
  assert.equal(ledger.preservedVersionCount, 4);
  assert.deepEqual(ledger.versions.map(record => record.version), [3, 2, 2, 1]);
});

test('local-first sync content hash ignores volatile device metadata', () => {
  assert.equal(
    stableLocalFirstContentHash({
      teamNumber: '254',
      timestamp: 100,
      deviceId: 'a',
      versionMetadata: { version: 2, currentVersionSubmitted: false, submissionNumber: 0, submittedAt: null }
    }),
    stableLocalFirstContentHash({
      deviceId: 'b',
      timestamp: 200,
      teamNumber: '254',
      versionMetadata: { version: 2, currentVersionSubmitted: true, submissionNumber: 1, submittedAt: 999 }
    })
  );
});

test('local-first sync planner adapts scout archive Match V4 records', () => {
  const archiveRecord = {
    recordId: 'matchV4:2026mnum:qm1:254:v2',
    logicalId: '2026mnum:qm1:254',
    recordType: 'matchV4',
    eventKey: '2026mnum',
    username: 'Leo',
    deviceId: 'device-a',
    updatedAt: 2000,
    deleted: false,
    source: 'local_submit',
    syncStatus: 'unsynced',
    payload: {
      eventKey: '2026mnum',
      matchKey: 'qm1',
      teamNumber: '254',
      scoutName: 'Leo',
      scoutNumber: 7,
      timestamp: 2000,
      versionMetadata: {
        logicalId: '2026mnum:qm1:254',
        version: 2,
        currentVersionSubmitted: false,
        submissionNumber: 0,
        editedAt: 2000,
        editedByName: 'Leo',
        editedByScoutNumber: 7,
        editedBySurface: 'scout'
      }
    }
  };

  const syncRecord = buildSyncRecordFromScoutArchiveRecord(archiveRecord);
  assert.equal(syncRecord.eventKey, '2026MNUM');
  assert.equal(syncRecord.logicalId, '2026mnum:qm1:254');
  assert.equal(syncRecord.version, 2);
  assert.equal(syncRecord.currentVersionSubmitted, false);
  assert.match(syncRecord.contentHash, /^fnv1a:/);
});

test('local-first sync planner pushes newer scout archive over Firebase', () => {
  const localRecord = {
    ...base,
    version: 2,
    recordId: 'local-v2',
    currentVersionSubmitted: false,
    contentHash: 'hash-v2'
  };
  const remoteRecord = buildSyncRecordFromRemotePayload({
    recordId: 'firebase-v1',
    payload: {
      eventKey: '2026mnum',
      versionMetadata: {
        logicalId: base.logicalId,
        version: 1,
        currentVersionSubmitted: true,
        editedAt: 1500
      },
      observedContribution: 12
    }
  });

  const [item] = buildLocalFirstSyncPlan({ localRecords: [localRecord], remoteRecords: [remoteRecord] });
  assert.equal(item.action, 'push-local');
  assert.equal(item.winner, 'local');
  assert.equal(item.localVersions.length, 1);
  assert.equal(item.remoteVersions.length, 1);
});

test('local-first sync planner preserves same-version content conflicts', () => {
  const localRecord = {
    ...base,
    version: 3,
    recordId: 'local-v3',
    contentHash: 'local-version-three'
  };
  const remoteRecord = {
    ...base,
    surface: 'head-scout-firebase',
    version: 3,
    recordId: 'firebase-v3',
    contentHash: 'remote-version-three'
  };

  const [item] = buildLocalFirstSyncPlan({ localRecords: [localRecord], remoteRecords: [remoteRecord] });
  assert.equal(item.action, 'preserve-conflict');
  assert.equal(item.winner, 'conflict');
  assert.equal(item.preserveBoth, true);
});

test('local-first sync planner pulls remote-only records into local archive', () => {
  const remoteRecord = {
    ...base,
    surface: 'head-scout-firebase',
    version: 4,
    recordId: 'firebase-v4',
    contentHash: 'hash-v4'
  };

  const [item] = buildLocalFirstSyncPlan({ localRecords: [], remoteRecords: [remoteRecord] });
  assert.equal(item.action, 'pull-remote');
  assert.equal(item.winner, 'remote');
  assert.equal(item.localCurrent, null);
  assert.equal(item.remoteCurrent.recordId, 'firebase-v4');
});

test('Match V4 archive sync consumes the planner before replacing Firebase', () => {
  const source = readFileSync('src/utils/scoutArchiveSync.ts', 'utf8');

  assert.match(source, /chooseMatchV4SyncPlan/);
  assert.match(source, /readMatchScoutingV4Record/);
  assert.match(source, /buildLocalFirstSyncPlan/);
  assert.match(source, /action === 'push-local'/);
  assert.match(source, /action === 'pull-remote'/);
  assert.match(source, /action === 'preserve-conflict'/);
  assert.match(source, /upsertMatchArchiveRecordV4/);
  assert.match(source, /mode: mode === 'replace' \? 'replace' : v4Plan\.mode/);
});
