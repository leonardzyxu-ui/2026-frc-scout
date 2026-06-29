import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFirstShiftCorrectionPagerMessages,
  buildScoutRelayDispatchPlan,
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

test('first-shift correction notices become scout-number targeted pager messages', () => {
  const messages = buildFirstShiftCorrectionPagerMessages({
    eventKey: '2026casj',
    createdAt: 1770000000000,
    notice: {
      matchKey: 'QM12',
      targetScoutNames: ['Scout A', 'Scout B', 'Unknown Scout'],
      question: 'Which alliance started the first teleop shift?',
      message: 'First-shift reports disagree for QM12.'
    },
    scoutDirectory: [
      { scoutName: 'Scout A', scoutNumber: 7 },
      { scoutName: 'Scout B', scoutNumber: 8 },
      { scoutName: 'Scout C', scoutNumber: 9 }
    ]
  });

  assert.equal(messages.length, 2);
  assert.deepEqual(messages.map(message => message.recipient.kind === 'scout' ? message.recipient.scoutNumber : null), [7, 8]);
  assert.equal(messages.every(message => message.priority === 'urgent' && message.noReply), true);
  assert.match(messages[0].body, /first teleop shift/i);
});

test('relay dispatch plan keeps mainland relays before Cloudflare', () => {
  const plan = buildScoutRelayDispatchPlan({
    region: 'mainland-china',
    relayHealth: {
      'the-button': { ok: false, latencyMs: 3500, error: 'Timed out' },
      directchat: { ok: true, latencyMs: 172, error: '' },
      'cloudflare-directchat': { ok: true, latencyMs: 91, error: '' }
    }
  });

  assert.deepEqual(plan.candidates.map(candidate => candidate.key), ['the-button', 'directchat', 'cloudflare-directchat']);
  assert.equal(plan.selectedProviderKey, 'directchat');
  assert.equal(plan.localAuthenticatedSenderRequired, true);
  assert.match(plan.candidates[2].caveat, /workers\.dev/);
  assert.match(plan.candidates[2].caveat, /no-VPN mainland/i);
});

test('relay dispatch plan can promote Cloudflare for global or VPN operation', () => {
  const plan = buildScoutRelayDispatchPlan({
    region: 'global-vpn',
    relayHealth: {
      'the-button': { ok: false, latencyMs: 3500, error: 'Wrong service' },
      directchat: { ok: true, latencyMs: 210, error: '' },
      'cloudflare-directchat': { ok: true, latencyMs: 66, error: '' }
    }
  });

  assert.deepEqual(plan.candidates.map(candidate => candidate.key), ['the-button', 'cloudflare-directchat', 'directchat']);
  assert.equal(plan.selectedProviderKey, 'cloudflare-directchat');
  assert.match(plan.summary, /Cloudflare DirectChat/);
});
