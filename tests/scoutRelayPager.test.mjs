import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScoutPagerMessage,
  shouldDeliverScoutPagerMessage
} from '../src/utils/scoutRelayPager.ts';

test('scout relay pager sends individual messages by scout number only', () => {
  const message = buildScoutPagerMessage({
    eventKey: '2026casj',
    recipient: { kind: 'scout', scoutNumber: 7, scoutName: 'Scout Seven' },
    title: 'Check shift',
    body: 'Please confirm first shift.',
    createdAt: 1770000000000
  });

  assert.equal(message.noReply, true);
  assert.equal(message.recipient.kind, 'scout');
  assert.equal(message.recipient.scoutNumber, 7);
  assert.equal(shouldDeliverScoutPagerMessage(message, { scoutNumber: 7, scoutName: 'Other name' }, 1770000000001), true);
  assert.equal(shouldDeliverScoutPagerMessage(message, { scoutNumber: 8, scoutName: 'Scout Seven' }, 1770000000001), false);
});

test('scout relay pager broadcasts to all without becoming group chat', () => {
  const message = buildScoutPagerMessage({
    eventKey: '2026casj',
    recipient: { kind: 'all' },
    title: 'Sync now',
    body: 'Submit your current match.',
    priority: 'urgent',
    createdAt: 1770000000000
  });

  assert.equal(message.noReply, true);
  assert.equal(message.priority, 'urgent');
  assert.equal(shouldDeliverScoutPagerMessage(message, { scoutNumber: 1 }, 1770000000001), true);
  assert.equal(shouldDeliverScoutPagerMessage(message, { scoutNumber: 99 }, 1770000000001), true);
});

test('scout relay pager ignores expired messages', () => {
  const message = buildScoutPagerMessage({
    eventKey: '2026casj',
    recipient: { kind: 'all' },
    title: 'Old ping',
    body: 'This should disappear.',
    createdAt: 1770000000000,
    ttlMs: 1000
  });

  assert.equal(shouldDeliverScoutPagerMessage(message, { scoutNumber: 1 }, 1770000000500), true);
  assert.equal(shouldDeliverScoutPagerMessage(message, { scoutNumber: 1 }, 1770000002000), false);
});
