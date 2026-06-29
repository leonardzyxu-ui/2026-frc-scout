import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideLocalFirstSync,
  mergeLocalFirstVersionLedger
} from '../src/utils/localFirstSyncContract.ts';

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
