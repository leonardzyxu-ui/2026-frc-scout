import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPowerCoinLeaderboard,
  buildPowerCoinBetSnapshot,
  computePowerCoinWallet,
  formatPowerCoinScoutChoice,
  getPowerCoinBetBalanceDelta,
  isSubmittablePowerCoinBet,
  resolvePowerCoinScoutChoice,
  toStoredPowerCoinBet
} from '../src/utils/scoutPowerCoins.ts';

test('PowerCoin bet snapshots use scout number as the stable participant key', () => {
  const first = buildPowerCoinBetSnapshot({
    eventKey: '2026mnum',
    matchKey: 'qm4',
    matchNumber: 4,
    matchType: 'Qualification',
    scoutName: 'Leo',
    scoutNumber: 7,
    side: 'Red',
    amount: 120,
    secureMode: true,
    lockedAt: 1000,
    lockReason: 'start_game',
    directSendStatus: 'pending'
  });
  const renamed = buildPowerCoinBetSnapshot({
    base: first,
    eventKey: '2026mnum',
    matchKey: 'qm4',
    matchNumber: 4,
    matchType: 'Qualification',
    scoutName: 'Leo Renamed',
    scoutNumber: 7,
    side: 'Red',
    amount: 120
  });

  assert.equal(first.id, '2026MNUM_qm4_scout7_powercoin');
  assert.equal(renamed.id, first.id);
  assert.equal(renamed.scoutName, 'Leo Renamed');
  assert.equal(renamed.scoutNumber, 7);
  assert.equal(isSubmittablePowerCoinBet(renamed), true);
});

test('PowerCoin bet rows are only stored after side, amount, and lock exist', () => {
  const draft = buildPowerCoinBetSnapshot({
    eventKey: '2026mnum',
    matchKey: 'qm4',
    matchNumber: 4,
    matchType: 'Qualification',
    scoutName: 'Leo',
    scoutNumber: 7,
    side: 'Blue',
    amount: 50
  });
  assert.equal(toStoredPowerCoinBet(draft), null);

  const locked = buildPowerCoinBetSnapshot({
    base: draft,
    eventKey: '2026mnum',
    matchKey: 'qm4',
    matchNumber: 4,
    matchType: 'Qualification',
    scoutName: 'Leo',
    scoutNumber: 7,
    lockedAt: 2000,
    lockReason: 'gameplay_action',
    directSendStatus: 'sent'
  });
  const stored = toStoredPowerCoinBet(locked, 'sent');
  assert.equal(stored?.id, '2026MNUM_qm4_scout7_powercoin');
  assert.equal(stored?.side, 'Blue');
  assert.equal(stored?.amount, 50);
  assert.equal(stored?.lockedAt, 2000);
  assert.equal(stored?.directSendStatus, 'sent');
});

test('PowerCoin wallet uses scout number before name and reserves open stake', () => {
  const bets = [
    {
      id: 'bet-open',
      eventKey: '2026MNUM',
      matchKey: 'qm5',
      matchNumber: 5,
      matchType: 'Qualification',
      scoutName: 'Old Name',
      scoutNumber: 7,
      side: 'Red',
      amount: 150,
      placedAt: 1,
      lockedAt: 2
    },
    {
      id: 'other-scout',
      eventKey: '2026MNUM',
      matchKey: 'qm5',
      matchNumber: 5,
      matchType: 'Qualification',
      scoutName: 'Leo',
      scoutNumber: 8,
      side: 'Blue',
      amount: 999,
      placedAt: 1,
      lockedAt: 2
    }
  ];
  const wallet = computePowerCoinWallet({
    bets,
    ledger: [{ id: 'bonus', eventKey: '2026MNUM', scoutName: 'New Name', scoutNumber: 7, reason: 'bonus', delta: 25, balanceAfter: 875, createdAt: 3 }],
    scoutName: 'New Name',
    scoutNumber: 7
  });

  assert.equal(wallet.identityKey, 'number:7');
  assert.equal(wallet.openBets, 1);
  assert.equal(wallet.openStake, 150);
  assert.equal(wallet.ledgerDelta, 25);
  assert.equal(wallet.balance, 875);
});

test('PowerCoin settled winners display profit only and losses display stake lost', () => {
  const wonBet = {
    id: 'won',
    eventKey: '2026MNUM',
    matchKey: 'qm6',
    matchNumber: 6,
    matchType: 'Qualification',
    scoutName: 'Leo',
    scoutNumber: 7,
    side: 'Red',
    amount: 100,
    placedAt: 1,
    lockedAt: 2,
    settledAt: 10,
    outcome: 'won',
    payout: 250
  };
  const lostBet = {
    id: 'lost',
    eventKey: '2026MNUM',
    matchKey: 'qm7',
    matchNumber: 7,
    matchType: 'Qualification',
    scoutName: 'Leo',
    scoutNumber: 7,
    side: 'Blue',
    amount: 80,
    placedAt: 1,
    lockedAt: 2,
    settledAt: 12,
    outcome: 'lost',
    payout: 0
  };

  assert.equal(getPowerCoinBetBalanceDelta(wonBet), 150);
  assert.equal(getPowerCoinBetBalanceDelta(lostBet), -80);

  const wallet = computePowerCoinWallet({
    bets: [wonBet, lostBet],
    ledger: [],
    scoutName: 'Leo',
    scoutNumber: 7
  });
  assert.equal(wallet.settledProfit, 70);
  assert.equal(wallet.balance, 1070);
  assert.equal(wallet.lastSettledBet?.id, 'lost');
  assert.equal(wallet.lastSettledDelta, -80);
});

test('PowerCoin leaderboard sorts by wealth and flags bankruptcy', () => {
  const rows = buildPowerCoinLeaderboard({
    identities: [
      { scoutName: 'Leo', scoutNumber: 7 },
      { scoutName: 'Maya', scoutNumber: 8 }
    ],
    ledger: [],
    bets: [
      {
        id: 'leo-all-in',
        eventKey: '2026MNUM',
        matchKey: 'qm8',
        matchNumber: 8,
        matchType: 'Qualification',
        scoutName: 'Leo',
        scoutNumber: 7,
        side: 'Red',
        amount: 1000,
        placedAt: 1,
        lockedAt: 2,
        settledAt: 3,
        outcome: 'lost',
        payout: 0
      },
      {
        id: 'maya-win',
        eventKey: '2026MNUM',
        matchKey: 'qm8',
        matchNumber: 8,
        matchType: 'Qualification',
        scoutName: 'Maya',
        scoutNumber: 8,
        side: 'Blue',
        amount: 100,
        placedAt: 1,
        lockedAt: 2,
        settledAt: 3,
        outcome: 'won',
        payout: 200
      }
    ]
  });

  assert.equal(rows[0].scoutName, 'Maya');
  assert.equal(rows[0].balance, 1100);
  assert.equal(rows[1].scoutName, 'Leo');
  assert.equal(rows[1].balance, 0);
  assert.equal(rows[1].bankrupt, true);
});

test('PowerCoin scout choices resolve duplicate names by scout number first', () => {
  const identities = [
    { scoutName: 'Alex', scoutNumber: 7 },
    { scoutName: 'Alex', scoutNumber: 12 }
  ];

  assert.equal(formatPowerCoinScoutChoice(identities[0]), '#7 Alex');
  assert.deepEqual(resolvePowerCoinScoutChoice('#12 Alex', identities), { scoutName: 'Alex', scoutNumber: 12 });
  assert.deepEqual(resolvePowerCoinScoutChoice('7 Alex', identities), { scoutName: 'Alex', scoutNumber: 7 });
  assert.deepEqual(resolvePowerCoinScoutChoice('Alex', identities), { scoutName: 'Alex', scoutNumber: null });
});

test('PowerCoin wallets ignore disqualified bets until restore clears stale settlement state', () => {
  const settledDisqualified = {
    id: 'dq-stale',
    eventKey: '2026MNUM',
    matchKey: 'qm9',
    matchNumber: 9,
    matchType: 'Qualification',
    scoutName: 'Leo',
    scoutNumber: 7,
    side: 'Red',
    amount: 200,
    placedAt: 1,
    lockedAt: 2,
    settledAt: 3,
    outcome: 'won',
    payout: 500,
    disqualified: true
  };
  const ignored = computePowerCoinWallet({
    bets: [settledDisqualified],
    ledger: [],
    scoutName: 'Leo',
    scoutNumber: 7
  });
  assert.equal(ignored.balance, 1000);
  assert.equal(ignored.disqualifiedBets, 1);
  assert.equal(getPowerCoinBetBalanceDelta(settledDisqualified), 0);

  const restoredForFutureSettlement = {
    ...settledDisqualified,
    disqualified: false,
    settledAt: undefined,
    outcome: undefined,
    payout: undefined
  };
  const restored = computePowerCoinWallet({
    bets: [restoredForFutureSettlement],
    ledger: [],
    scoutName: 'Leo',
    scoutNumber: 7
  });
  assert.equal(restored.balance, 800);
  assert.equal(restored.openStake, 200);
  assert.equal(restored.settledBets, 0);
});
