import {
  SCOUTING_RELAY_PROVIDERS,
  type ScoutingRelayHealthResult,
  type ScoutingRelayProvider,
  type ScoutingRelayProviderKey
} from './scoutingRelayReadiness.ts';

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
  eventKey?: string;
}

export interface ScoutPagerDirectoryEntry {
  scoutName: string;
  scoutNumber: number | null;
}

export type ScoutRelayDispatchRegion = 'mainland-china' | 'global-vpn';

export interface ScoutRelayDispatchCandidate {
  key: ScoutingRelayProviderKey;
  label: string;
  role: string;
  priority: number;
  baseUrl: string;
  dispatchPathHint: string;
  status: 'ready' | 'not-checked' | 'unavailable';
  latencyMs: number | null;
  caveat: string;
  selected: boolean;
}

export interface ScoutRelayDispatchPlan {
  region: ScoutRelayDispatchRegion;
  selectedProviderKey: ScoutingRelayProviderKey | null;
  candidates: ScoutRelayDispatchCandidate[];
  summary: string;
  localAuthenticatedSenderRequired: true;
}

const SCOUT_PAGER_INBOX_KEY = 'scout_relay_pager_inbox_v1';

const MAINLAND_RELAY_ORDER: ScoutingRelayProviderKey[] = ['the-button', 'directchat', 'cloudflare-directchat'];
const GLOBAL_VPN_RELAY_ORDER: ScoutingRelayProviderKey[] = ['the-button', 'cloudflare-directchat', 'directchat'];
const DISPATCH_PATH_HINT: Record<ScoutingRelayProviderKey, string> = {
  'the-button': '/pager',
  directchat: '/mailbox/envelope',
  'cloudflare-directchat': '/mailbox/envelope'
};
const RELAY_CAVEATS: Record<ScoutingRelayProviderKey, string> = {
  'the-button': 'Primary fast alert lane when the Render hostname is serving the expected Node relay.',
  directchat: 'Mainland/Sanya backup lane; busier than The Button but the Render DirectChat relay is the preferred non-VPN fallback.',
  'cloudflare-directchat': 'Global/VPN fallback. Do not rely on workers.dev as the only Sanya or no-VPN mainland path.'
};

const normalizeScoutNumber = (value: unknown) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 99 ? number : null;
};
const normalizeEventKey = (value: unknown) => String(value || '').trim().toUpperCase();

const providerByKey = new Map(SCOUTING_RELAY_PROVIDERS.map(provider => [provider.key, provider]));

const getProvider = (key: ScoutingRelayProviderKey): ScoutingRelayProvider => {
  const provider = providerByKey.get(key);
  if (!provider) throw new Error(`Unknown relay provider: ${key}`);
  return provider;
};

export const buildScoutRelayDispatchPlan = ({
  region = 'mainland-china',
  relayHealth = {}
}: {
  region?: ScoutRelayDispatchRegion;
  relayHealth?: Partial<Record<ScoutingRelayProviderKey, Pick<ScoutingRelayHealthResult, 'ok' | 'latencyMs' | 'error'>>>;
} = {}): ScoutRelayDispatchPlan => {
  const order = region === 'global-vpn' ? GLOBAL_VPN_RELAY_ORDER : MAINLAND_RELAY_ORDER;
  const firstReady = order.find(key => relayHealth[key]?.ok) || null;
  const candidates = order.map((key, index): ScoutRelayDispatchCandidate => {
    const provider = getProvider(key);
    const health = relayHealth[key];
    const status: ScoutRelayDispatchCandidate['status'] = !health
      ? 'not-checked'
      : health.ok
        ? 'ready'
        : 'unavailable';
    return {
      key,
      label: provider.label,
      role: provider.role,
      priority: index + 1,
      baseUrl: provider.defaultBaseUrl,
      dispatchPathHint: DISPATCH_PATH_HINT[key],
      status,
      latencyMs: health?.latencyMs ?? null,
      caveat: RELAY_CAVEATS[key],
      selected: firstReady === key
    };
  });

  const selected = candidates.find(candidate => candidate.selected);
  const unchecked = candidates.some(candidate => candidate.status === 'not-checked');
  const regionLabel = region === 'global-vpn' ? 'global/VPN' : 'mainland/Sanya';
  const summary = selected
    ? `${selected.label} is the current ${regionLabel} relay send target.`
    : unchecked
      ? `Relay health has not been checked; default ${regionLabel} order is ${candidates.map(candidate => candidate.label).join(' -> ')}.`
      : `No relay is healthy for ${regionLabel}; stay on Firebase/local backup and retry later.`;

  return {
    region,
    selectedProviderKey: selected?.key ?? null,
    candidates,
    summary,
    localAuthenticatedSenderRequired: true
  };
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
  const activeEventKey = normalizeEventKey(identity.eventKey);
  if (activeEventKey && normalizeEventKey(message.eventKey) !== activeEventKey) return false;
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
  }).filter(message => shouldDeliverScoutPagerMessage(message, { ...identity, eventKey }, createdAt));
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
