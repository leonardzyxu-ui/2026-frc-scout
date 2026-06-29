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

export interface ScoutPagerDirectoryEntry {
  scoutName: string;
  scoutNumber: number | null;
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

const dispatchInboxUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('scout-pager-inbox-updated'));
  }
};

const normalizeScoutNameKey = (value: string) => value.trim().toLowerCase();

export const buildFirstShiftCorrectionPagerMessages = ({
  eventKey,
  notice,
  scoutDirectory,
  createdAt = Date.now(),
  ttlMs = 15 * 60 * 1000
}: {
  eventKey: string;
  notice: {
    matchKey: string;
    targetScoutNames: string[];
    question: string;
    message: string;
  };
  scoutDirectory: ScoutPagerDirectoryEntry[];
  createdAt?: number;
  ttlMs?: number;
}) => {
  const directoryByName = new Map(
    scoutDirectory
      .map(entry => ({
        scoutName: entry.scoutName.trim(),
        scoutNumber: normalizeScoutNumber(entry.scoutNumber)
      }))
      .filter(entry => entry.scoutName && entry.scoutNumber)
      .map(entry => [normalizeScoutNameKey(entry.scoutName), entry])
  );

  return notice.targetScoutNames
    .map(name => directoryByName.get(normalizeScoutNameKey(name)))
    .filter((entry): entry is { scoutName: string; scoutNumber: number } => !!entry)
    .map(entry => buildScoutPagerMessage({
      eventKey,
      recipient: { kind: 'scout', scoutNumber: entry.scoutNumber, scoutName: entry.scoutName },
      title: `Confirm ${notice.matchKey}`,
      body: `${notice.message} ${notice.question}`,
      priority: 'urgent',
      createdAt,
      ttlMs
    }));
};

export const queueFirstShiftCorrectionForLocalScout = ({
  eventKey,
  notice,
  scoutDirectory,
  identity,
  createdAt = Date.now()
}: {
  eventKey: string;
  notice: Parameters<typeof buildFirstShiftCorrectionPagerMessages>[0]['notice'];
  scoutDirectory: ScoutPagerDirectoryEntry[];
  identity: ScoutPagerIdentity;
  createdAt?: number;
}) => {
  const deliverableMessages = buildFirstShiftCorrectionPagerMessages({
    eventKey,
    notice,
    scoutDirectory,
    createdAt
  }).filter(message => shouldDeliverScoutPagerMessage(message, identity, createdAt));
  deliverableMessages.forEach(message => appendScoutPagerInboxMessage(message));
  return deliverableMessages;
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
  dispatchInboxUpdated();
  return nextMessages;
};

export const removeScoutPagerInboxMessage = (messageId: string) => {
  if (typeof localStorage === 'undefined') return [];
  const nextMessages = readScoutPagerInbox().filter(message => message.id !== messageId);
  localStorage.setItem(SCOUT_PAGER_INBOX_KEY, JSON.stringify(nextMessages));
  dispatchInboxUpdated();
  return nextMessages;
};
