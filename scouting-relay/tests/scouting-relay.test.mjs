import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp, createMemoryStore } from '../src/server.js';

const withServer = async testFn => {
  process.env.POWERSCOUT_RELAY_ADMIN_TOKEN = 'admin-test-token';
  process.env.POWERSCOUT_RELAY_SCOUT_TOKEN = 'scout-test-token';
  const app = createApp({
    store: createMemoryStore()
  });
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await testFn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
    delete process.env.POWERSCOUT_RELAY_ADMIN_TOKEN;
    delete process.env.POWERSCOUT_RELAY_SCOUT_TOKEN;
  }
};

const jsonFetch = (url, options = {}) =>
  fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });

test('scouting relay health exposes the expected service identity', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.service, 'powerscout-relay');
    assert.equal(payload.ok, true);
  });
});

test('scouting relay root exposes a friendly unauthenticated service summary', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.service, 'powerscout-relay');
    assert.equal(payload.health, '/health');
    assert.equal(payload.help, '/api/pager/messages');
    assert.equal(payload.routes.health, 'GET /health');
    assert.equal(payload.routes.pagerStats, 'GET /api/pager/stats');
  });
});

test('scouting relay stores admin pager messages and filters scout reads by event and scout number', async () => {
  await withServer(async baseUrl => {
    const createResponse = await jsonFetch(`${baseUrl}/api/pager/messages`, {
      method: 'POST',
      headers: { authorization: 'Bearer admin-test-token' },
      body: JSON.stringify({
        eventKey: '2026casnv',
        recipient: { kind: 'scout', scoutNumber: 7, scoutName: 'Scout Seven' },
        title: 'Confirm first shift',
        body: 'Please confirm who started the first teleop shift.',
        ttlMs: 60_000
      })
    });
    assert.equal(createResponse.status, 201);

    const visibleResponse = await fetch(`${baseUrl}/api/pager/messages?eventKey=2026casnv&scoutNumber=7`, {
      headers: { authorization: 'Bearer scout-test-token' }
    });
    const visiblePayload = await visibleResponse.json();
    assert.equal(visibleResponse.status, 200);
    assert.equal(visiblePayload.messages.length, 1);
    assert.equal(visiblePayload.messages[0].recipient.scoutNumber, 7);

    const hiddenResponse = await fetch(`${baseUrl}/api/pager/messages?eventKey=2026casnv&scoutNumber=8`, {
      headers: { authorization: 'Bearer scout-test-token' }
    });
    const hiddenPayload = await hiddenResponse.json();
    assert.equal(hiddenResponse.status, 200);
    assert.equal(hiddenPayload.messages.length, 0);

    const otherEventResponse = await fetch(`${baseUrl}/api/pager/messages?eventKey=2026casj&scoutNumber=7`, {
      headers: { authorization: 'Bearer scout-test-token' }
    });
    const otherEventPayload = await otherEventResponse.json();
    assert.equal(otherEventResponse.status, 200);
    assert.equal(otherEventPayload.messages.length, 0);
  });
});

test('scouting relay stats endpoint requires admin and reports event counts', async () => {
  await withServer(async baseUrl => {
    await jsonFetch(`${baseUrl}/api/pager/messages`, {
      method: 'POST',
      headers: { authorization: 'Bearer admin-test-token' },
      body: JSON.stringify({
        eventKey: '2026casnv',
        recipient: { kind: 'all' },
        title: 'All scouts',
        body: 'Stats should count this message.',
        ttlMs: 60_000
      })
    });

    const unauthorizedResponse = await fetch(`${baseUrl}/api/pager/stats?eventKey=2026casnv`, {
      headers: { authorization: 'Bearer scout-test-token' }
    });
    assert.equal(unauthorizedResponse.status, 401);

    const response = await fetch(`${baseUrl}/api/pager/stats?eventKey=2026casnv`, {
      headers: { authorization: 'Bearer admin-test-token' }
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.stats.eventKey, '2026CASNV');
    assert.equal(payload.stats.messageCount, 1);
  });
});

test('scouting relay rejects protected routes without a relay token', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/pager/messages?eventKey=2026casnv&scoutNumber=7`);
    assert.equal(response.status, 401);
  });
});
