export type ScoutPagerRecipient =
  | { kind: 'all' }
  | { kind: 'scout'; scoutNumber: number; scoutName?: string };

export interface ScoutPagerMessage {
  id: string;
  eventKey: string;
  sender: 'admin';
  recipient: ScoutPagerRecipient;
  title: string;
  body: string;
  priority: 'normal' | 'urgent';
  createdAt: number;
  expiresAt?: number;
  noReply: true;
}

export interface ScoutPagerIdentity {
  scoutNumber: number | null;
  scoutName?: string;
}

const SCOUT_PAGER_INBOX_KEY = 'scout_relay_pager_inbox_v1';

const normalizeScoutNumber = (value: unknown) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 99 ? number : null;
};

export const buildScoutPagerMessage = ({
  eventKey,
  recipient,
  title,
  body,
  priority = 'normal',
  createdAt = Date.now(),
  ttlMs
}: {
  eventKey: string;
  recipient: ScoutPagerRecipient;
  title: string;
  body: string;
  priority?: ScoutPagerMessage['priority'];
  createdAt?: number;
  ttlMs?: number;
}): ScoutPagerMessage => {
  const normalizedRecipient: ScoutPagerRecipient = recipient.kind === 'all'
    ? { kind: 'all' }
    : {
        kind: 'scout',
        scoutNumber: normalizeScoutNumber(recipient.scoutNumber) || 0,
        scoutName: recipient.scoutName?.trim() || undefined
      };
  if (normalizedRecipient.kind === 'scout' && !normalizedRecipient.scoutNumber) {
    throw new Error('Scout pager recipient must include a scout number from 1 to 99.');
  }

  return {
    id: `pager:${eventKey}:${createdAt}:${Math.random().toString(36).slice(2, 8)}`,
    eventKey: eventKey.trim().toUpperCase(),
    sender: 'admin',
    recipient: normalizedRecipient,
    title: title.trim(),
    body: body.trim(),
    priority,
    createdAt,
    expiresAt: ttlMs && ttlMs > 0 ? createdAt + ttlMs : undefined,
    noReply: true
  };
};

export const shouldDeliverScoutPagerMessage = (
  message: ScoutPagerMessage,
  identity: ScoutPagerIdentity,
  now = Date.now()
) => {
  if (message.expiresAt && message.expiresAt < now) return false;
  if (message.recipient.kind === 'all') return true;
  return normalizeScoutNumber(identity.scoutNumber) === message.recipient.scoutNumber;
};

export const readScoutPagerInbox = (): ScoutPagerMessage[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(SCOUT_PAGER_INBOX_KEY) || '[]') as ScoutPagerMessage[];
    return Array.isArray(parsed) ? parsed.filter(message => message?.noReply === true) : [];
  } catch {
    return [];
  }
};

export const appendScoutPagerInboxMessage = (message: ScoutPagerMessage) => {
  if (typeof localStorage === 'undefined') return [];
  const nextMessages = [message, ...readScoutPagerInbox().filter(existing => existing.id !== message.id)].slice(0, 100);
  localStorage.setItem(SCOUT_PAGER_INBOX_KEY, JSON.stringify(nextMessages));
  return nextMessages;
};

export const removeScoutPagerInboxMessage = (messageId: string) => {
  if (typeof localStorage === 'undefined') return [];
  const nextMessages = readScoutPagerInbox().filter(message => message.id !== messageId);
  localStorage.setItem(SCOUT_PAGER_INBOX_KEY, JSON.stringify(nextMessages));
  return nextMessages;
};
