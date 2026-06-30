import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Redis } from '@upstash/redis';

const SERVICE_NAME = 'powerscout-relay';
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_MESSAGE_BODY_LENGTH = 1000;
const MAX_TITLE_LENGTH = 120;

const normalizeEventKey = value => String(value || '').trim().toUpperCase();

const normalizeScoutNumber = value => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 99 ? number : null;
};

const readToken = request => {
  const authorization = String(request.headers.authorization || '');
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim();
  return String(request.headers['x-powerscout-relay-token'] || '').trim();
};

const tokenMatches = (given, expected) => {
  if (!given || !expected) return false;
  const givenBuffer = Buffer.from(given);
  const expectedBuffer = Buffer.from(expected);
  return givenBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(givenBuffer, expectedBuffer);
};

const createAuth = ({
  adminToken = process.env.POWERSCOUT_RELAY_ADMIN_TOKEN || '',
  scoutToken = process.env.POWERSCOUT_RELAY_SCOUT_TOKEN || ''
} = {}) => {
  const identify = request => {
    const token = readToken(request);
    if (tokenMatches(token, adminToken)) return 'admin';
    if (tokenMatches(token, scoutToken)) return 'scout';
    return null;
  };

  const requireAdmin = (request, response, next) => {
    if (!adminToken) {
      response.status(503).json({ ok: false, error: 'Admin token is not configured.' });
      return;
    }
    if (identify(request) !== 'admin') {
      response.status(401).json({ ok: false, error: 'Admin token required.' });
      return;
    }
    request.powerScoutRelayRole = 'admin';
    next();
  };

  const requireScoutOrAdmin = (request, response, next) => {
    if (!adminToken && !scoutToken) {
      response.status(503).json({ ok: false, error: 'Relay tokens are not configured.' });
      return;
    }
    const role = identify(request);
    if (!role) {
      response.status(401).json({ ok: false, error: 'Relay token required.' });
      return;
    }
    request.powerScoutRelayRole = role;
    next();
  };

  return { requireAdmin, requireScoutOrAdmin };
};

export const createMemoryStore = () => {
  const messagesByEvent = new Map();

  const prune = (eventKey, now) => {
    const rows = messagesByEvent.get(eventKey) || [];
    const freshRows = rows.filter(message => !message.expiresAt || message.expiresAt >= now);
    messagesByEvent.set(eventKey, freshRows);
    return freshRows;
  };

  return {
    kind: 'memory',
    async saveMessage(message) {
      const rows = prune(message.eventKey, message.createdAt);
      rows.push(message);
      messagesByEvent.set(message.eventKey, rows);
      return message;
    },
    async listMessages(eventKey, now = Date.now()) {
      return prune(eventKey, now).sort((left, right) => right.createdAt - left.createdAt);
    },
    async stats(eventKey) {
      if (eventKey) return { eventKey, messageCount: (messagesByEvent.get(eventKey) || []).length };
      return {
        events: Array.from(messagesByEvent.entries()).map(([key, rows]) => ({ eventKey: key, messageCount: rows.length }))
      };
    }
  };
};

const createUpstashStore = () => {
  const redis = Redis.fromEnv();
  const keyForEvent = eventKey => `powerscout:relay:pager:${eventKey}:messages`;

  return {
    kind: 'upstash',
    async saveMessage(message) {
      const key = keyForEvent(message.eventKey);
      await redis.zadd(key, { score: message.createdAt, member: JSON.stringify(message) });
      await redis.expire(key, 60 * 60 * 24 * 14);
      return message;
    },
    async listMessages(eventKey, now = Date.now()) {
      const key = keyForEvent(eventKey);
      await redis.zremrangebyscore(key, 0, now - 60 * 60 * 1000);
      const rows = await redis.zrange(key, 0, -1);
      return rows
        .map(row => {
          if (typeof row === 'string') return JSON.parse(row);
          return row;
        })
        .filter(message => !message.expiresAt || message.expiresAt >= now)
        .sort((left, right) => right.createdAt - left.createdAt);
    },
    async stats(eventKey) {
      if (!eventKey) return { note: 'Provide eventKey for per-event message count.' };
      return { eventKey, messageCount: await redis.zcard(keyForEvent(eventKey)) };
    }
  };
};

const createStore = () => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return createUpstashStore();
  }
  return createMemoryStore();
};

const parseAllowedOrigins = value =>
  String(value || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

const installCors = (app, allowedOrigins = parseAllowedOrigins(process.env.POWERSCOUT_RELAY_ALLOWED_ORIGINS || '')) => {
  app.use((request, response, next) => {
    const origin = request.headers.origin;
    const allowAny = allowedOrigins.includes('*');
    const allowed = !origin || allowAny || allowedOrigins.includes(origin);
    if (allowed) {
      response.setHeader('Access-Control-Allow-Origin', origin || '*');
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-powerscout-relay-token');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') {
      response.status(allowed ? 204 : 403).end();
      return;
    }
    next();
  });
};

const cleanString = (value, maxLength) => String(value || '').trim().slice(0, maxLength);

const buildMessage = body => {
  const eventKey = normalizeEventKey(body.eventKey);
  if (!eventKey) throw new Error('eventKey is required.');

  const recipientKind = body.recipient?.kind === 'all' ? 'all' : 'scout';
  const recipient = recipientKind === 'all'
    ? { kind: 'all' }
    : {
        kind: 'scout',
        scoutNumber: normalizeScoutNumber(body.recipient?.scoutNumber),
        scoutName: cleanString(body.recipient?.scoutName, 80) || undefined
      };
  if (recipient.kind === 'scout' && !recipient.scoutNumber) {
    throw new Error('recipient.scoutNumber must be 1-99 for scout messages.');
  }

  const createdAt = Number.isFinite(Number(body.createdAt)) ? Number(body.createdAt) : Date.now();
  const ttlMs = Number.isFinite(Number(body.ttlMs)) ? Math.max(1000, Number(body.ttlMs)) : DEFAULT_TTL_MS;
  const title = cleanString(body.title, MAX_TITLE_LENGTH);
  const messageBody = cleanString(body.body, MAX_MESSAGE_BODY_LENGTH);
  if (!title || !messageBody) throw new Error('title and body are required.');

  return {
    id: cleanString(body.id, 160) || `powerscout:${eventKey}:${createdAt}:${crypto.randomUUID()}`,
    eventKey,
    sender: 'admin',
    recipient,
    title,
    body: messageBody,
    priority: body.priority === 'urgent' ? 'urgent' : 'normal',
    createdAt,
    expiresAt: createdAt + ttlMs,
    noReply: true
  };
};

const messageMatchesIdentity = (message, scoutNumber) => {
  if (message.recipient?.kind === 'all') return true;
  return normalizeScoutNumber(scoutNumber) === normalizeScoutNumber(message.recipient?.scoutNumber);
};

export const createApp = ({ store = createStore(), auth = createAuth(), now = () => Date.now() } = {}) => {
  const app = express();
  installCors(app);
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (_request, response) => {
    response.json({
      ok: true,
      service: SERVICE_NAME,
      runtime: 'render-upstash',
      storage: store.kind,
      now: new Date(now()).toISOString()
    });
  });

  app.post('/api/pager/messages', auth.requireAdmin, async (request, response) => {
    try {
      const message = buildMessage(request.body || {});
      await store.saveMessage(message);
      response.status(201).json({ ok: true, message });
    } catch (error) {
      response.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Invalid message.' });
    }
  });

  app.get('/api/pager/messages', auth.requireScoutOrAdmin, async (request, response) => {
    const eventKey = normalizeEventKey(request.query.eventKey);
    if (!eventKey) {
      response.status(400).json({ ok: false, error: 'eventKey query parameter is required.' });
      return;
    }
    const scoutNumber = normalizeScoutNumber(request.query.scoutNumber);
    const role = request.powerScoutRelayRole;
    if (role === 'scout' && !scoutNumber) {
      response.status(400).json({ ok: false, error: 'scoutNumber query parameter is required for scout reads.' });
      return;
    }
    const messages = await store.listMessages(eventKey, now());
    const deliverable = role === 'admin'
      ? messages
      : messages.filter(message => messageMatchesIdentity(message, scoutNumber));
    response.json({ ok: true, eventKey, messages: deliverable });
  });

  app.get('/api/pager/stats', auth.requireAdmin, async (request, response) => {
    const eventKey = normalizeEventKey(request.query.eventKey);
    response.json({ ok: true, service: SERVICE_NAME, storage: store.kind, stats: await store.stats(eventKey || undefined) });
  });

  app.use((_request, response) => {
    response.status(404).json({ ok: false, service: SERVICE_NAME, error: 'Not found.' });
  });

  return app;
};

export const startServer = () => {
  const port = Number(process.env.PORT || 8789);
  const app = createApp();
  app.listen(port, () => {
    console.log(`${SERVICE_NAME} listening on ${port}`);
  });
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
