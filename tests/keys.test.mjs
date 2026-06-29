import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMatchKey,
  getScoutAssignment,
  normalizeEventKey,
  normalizeTeamKey,
  normalizeTeamNumber,
  parseMatchKey,
  stableStringify
} from '../src/utils/keys.ts';

test('normalizes event and team keys consistently', () => {
  assert.equal(normalizeEventKey(' 2026 mnum '), '2026MNUM');
  assert.equal(normalizeEventKey('', 'TEST'), 'TEST');
  assert.equal(normalizeTeamNumber('frc 6907'), '6907');
  assert.equal(normalizeTeamKey('6907'), 'frc6907');
});

test('builds and parses match keys with stable practice/qualification labels', () => {
  assert.equal(buildMatchKey('Practice', 0), 'pm1');
  assert.equal(buildMatchKey('Qualification', 12), 'qm12');
  assert.deepEqual(parseMatchKey('PM7'), {
    matchKey: 'pm7',
    matchType: 'Practice',
    matchNumber: 7
  });
  assert.deepEqual(parseMatchKey('qm42'), {
    matchKey: 'qm42',
    matchType: 'Qualification',
    matchNumber: 42
  });
});

test('finds scout assignments without caring about input casing', () => {
  const assignments = [
    { name: 'Scout One', alliance: 'Red', positionIndex: 0, slotLabel: 'Red 1' },
    { name: 'Scout Two', alliance: 'Blue', positionIndex: 0, slotLabel: 'Blue 1' }
  ];

  assert.equal(getScoutAssignment(assignments, { name: 'scout one' })?.slotLabel, 'Red 1');
  assert.equal(getScoutAssignment(assignments, { slotLabel: 'blue 1' })?.name, 'Scout Two');
  assert.equal(getScoutAssignment(assignments, { alliance: 'Red', positionIndex: 2 }), null);
});

test('stableStringify ignores volatile archive fields and sorts object keys', () => {
  const left = { b: 2, a: 1, timestamp: 123, editHistory: [{ a: true }], nested: { z: 3, y: 2 } };
  const right = { nested: { y: 2, z: 3 }, a: 1, b: 2, timestamp: 999, deviceId: 'abc' };

  assert.equal(stableStringify(left), stableStringify(right));
});
