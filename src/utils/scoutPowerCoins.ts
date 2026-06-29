import type {
  MatchScoutingV3MatchType,
  PowerCoinBet,
  PowerCoinBetLockReason,
  PowerCoinBetSendStatus,
  PowerCoinBetSide,
  PowerCoinLedgerEntry,
  PowerCoinMatchBetSnapshot
} from '../types';

export const STARTING_POWERCOIN_BALANCE = 1000;

export interface PowerCoinIdentity {
  scoutName: string;
  scoutNumber?: number | null;
}

export interface PowerCoinWallet {
  identityKey: string;
  scoutName: string;
  scoutNumber: number | null;
  startingBalance: number;
  balance: number;
  bankrupt: boolean;
  ledgerDelta: number;
  openBets: number;
  openStake: number;
  settledBets: number;
  settledProfit: number;
  totalStaked: number;
  totalPayout: number;
  disqualifiedBets: number;
  lastSettledBet?: PowerCoinBet;
  lastSettledDelta: number;
}

const normalizePowerCoinScoutNumber = (value?: number | null) => {
  const scoutNumber = Math.trunc(Number(value));
  return Number.isFinite(scoutNumber) && scoutNumber >= 1 && scoutNumber <= 99 ? scoutNumber : null;
};

const normalizePowerCoinScoutName = (scoutName: string) => scoutName.trim();

const normalizeScoutKey = (scoutName: string, scoutNumber?: number | null) => {
  const normalizedNumber = normalizePowerCoinScoutNumber(scoutNumber);
  return normalizedNumber ? `scout${normalizedNumber}` : scoutName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'unknown';
};

export const getPowerCoinIdentityKey = ({ scoutName, scoutNumber }: PowerCoinIdentity) => {
  const normalizedNumber = normalizePowerCoinScoutNumber(scoutNumber);
  if (normalizedNumber) return `number:${normalizedNumber}`;
  return `name:${normalizePowerCoinScoutName(scoutName).toLowerCase()}`;
};

export const powerCoinIdentityMatches = (
  row: PowerCoinIdentity,
  identity: PowerCoinIdentity
) => getPowerCoinIdentityKey(row) === getPowerCoinIdentityKey(identity);

export const formatPowerCoinScoutChoice = ({ scoutName, scoutNumber }: PowerCoinIdentity) => {
  const normalizedName = normalizePowerCoinScoutName(scoutName);
  const normalizedNumber = normalizePowerCoinScoutNumber(scoutNumber);
  return normalizedNumber ? `#${normalizedNumber} ${normalizedName || `Scout ${normalizedNumber}`}` : normalizedName;
};

export const resolvePowerCoinScoutChoice = (
  value: string,
  identities: PowerCoinIdentity[]
): PowerCoinIdentity => {
  const trimmed = normalizePowerCoinScoutName(value);
  const normalizedLower = trimmed.toLowerCase();
  const numberMatch = trimmed.match(/^#?\s*(\d{1,2})(?:\D|$)/);
  const parsedNumber = normalizePowerCoinScoutNumber(numberMatch?.[1] ? Number(numberMatch[1]) : null);
  const numberMatchIdentity = parsedNumber
    ? identities.find(identity => normalizePowerCoinScoutNumber(identity.scoutNumber) === parsedNumber)
    : null;
  if (numberMatchIdentity) {
    return {
      scoutName: normalizePowerCoinScoutName(numberMatchIdentity.scoutName),
      scoutNumber: normalizePowerCoinScoutNumber(numberMatchIdentity.scoutNumber)
    };
  }

  const exactChoiceMatch = identities.find(identity => formatPowerCoinScoutChoice(identity).toLowerCase() === normalizedLower);
  const exactNameMatches = identities.filter(identity => normalizePowerCoinScoutName(identity.scoutName).toLowerCase() === normalizedLower);
  const exactNameMatch = exactNameMatches.length === 1 ? exactNameMatches[0] : null;
  const matched = exactChoiceMatch || exactNameMatch;
  if (matched) {
    return {
      scoutName: normalizePowerCoinScoutName(matched.scoutName),
      scoutNumber: normalizePowerCoinScoutNumber(matched.scoutNumber)
    };
  }

  return {
    scoutName: trimmed,
    scoutNumber: parsedNumber
  };
};

export const getPowerCoinBetBalanceDelta = (bet: PowerCoinBet) => {
  if (bet.disqualified) return 0;
  if (!bet.settledAt) return -bet.amount;
  return (bet.payout ?? 0) - bet.amount;
};

export const computePowerCoinWallet = ({
  bets,
  ledger,
  scoutName,
  scoutNumber
}: {
  bets: PowerCoinBet[];
  ledger: PowerCoinLedgerEntry[];
  scoutName: string;
  scoutNumber?: number | null;
}): PowerCoinWallet => {
  const identity: PowerCoinIdentity = {
    scoutName: normalizePowerCoinScoutName(scoutName),
    scoutNumber: normalizePowerCoinScoutNumber(scoutNumber)
  };
  const scoutBets = bets.filter(bet => powerCoinIdentityMatches(bet, identity));
  const scoutLedger = ledger.filter(entry => powerCoinIdentityMatches(entry, identity));
  const financialBets = scoutBets.filter(bet => !bet.disqualified);
  const openBets = financialBets.filter(bet => !bet.settledAt);
  const settledBets = financialBets.filter(bet => bet.settledAt);
  const ledgerDelta = scoutLedger.reduce((sum, entry) => sum + entry.delta, 0);
  const openStake = openBets.reduce((sum, bet) => sum + bet.amount, 0);
  const settledProfit = settledBets.reduce((sum, bet) => sum + getPowerCoinBetBalanceDelta(bet), 0);
  const betDelta = financialBets.reduce((sum, bet) => sum + getPowerCoinBetBalanceDelta(bet), 0);
  const balance = STARTING_POWERCOIN_BALANCE + ledgerDelta + betDelta;
  const lastSettledBet = [...settledBets].sort((left, right) =>
    (right.settledAt || right.lockedAt || right.placedAt) - (left.settledAt || left.lockedAt || left.placedAt)
  )[0];

  return {
    identityKey: getPowerCoinIdentityKey(identity),
    scoutName: identity.scoutName,
    scoutNumber: identity.scoutNumber ?? null,
    startingBalance: STARTING_POWERCOIN_BALANCE,
    balance,
    bankrupt: balance <= 0,
    ledgerDelta,
    openBets: openBets.length,
    openStake,
    settledBets: settledBets.length,
    settledProfit,
    totalStaked: financialBets.reduce((sum, bet) => sum + bet.amount, 0),
    totalPayout: settledBets.reduce((sum, bet) => sum + (bet.payout ?? 0), 0),
    disqualifiedBets: scoutBets.length - financialBets.length,
    lastSettledBet,
    lastSettledDelta: lastSettledBet ? getPowerCoinBetBalanceDelta(lastSettledBet) : 0
  };
};

export const buildPowerCoinLeaderboard = ({
  bets,
  ledger,
  identities = []
}: {
  bets: PowerCoinBet[];
  ledger: PowerCoinLedgerEntry[];
  identities?: PowerCoinIdentity[];
}) => {
  const identityByKey = new Map<string, PowerCoinIdentity>();
  const addIdentity = (identity: PowerCoinIdentity) => {
    const scoutName = normalizePowerCoinScoutName(identity.scoutName);
    const scoutNumber = normalizePowerCoinScoutNumber(identity.scoutNumber);
    if (!scoutName && !scoutNumber) return;
    const normalized: PowerCoinIdentity = {
      scoutName: scoutName || (scoutNumber ? `Scout #${scoutNumber}` : 'Unknown Scout'),
      scoutNumber
    };
    const key = getPowerCoinIdentityKey(normalized);
    const existing = identityByKey.get(key);
    identityByKey.set(key, {
      scoutName: existing?.scoutName && existing.scoutName !== `Scout #${existing.scoutNumber}` ? existing.scoutName : normalized.scoutName,
      scoutNumber: existing?.scoutNumber ?? normalized.scoutNumber
    });
  };

  identities.forEach(addIdentity);
  bets.forEach(addIdentity);
  ledger.forEach(addIdentity);

  return Array.from(identityByKey.values())
    .map(identity => computePowerCoinWallet({ bets, ledger, ...identity }))
    .sort((left, right) =>
      right.balance - left.balance ||
      (left.scoutNumber ?? Number.MAX_SAFE_INTEGER) - (right.scoutNumber ?? Number.MAX_SAFE_INTEGER) ||
      left.scoutName.localeCompare(right.scoutName)
    );
};

export const isPowerCoinBetSide = (value: unknown): value is PowerCoinBetSide =>
  value === 'Red' || value === 'Blue';

export const normalizePowerCoinAmount = (value: unknown) => {
  const amount = Math.trunc(Number(value));
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

export const buildPowerCoinBetId = ({
  eventKey,
  matchKey,
  scoutName,
  scoutNumber
}: Pick<PowerCoinMatchBetSnapshot, 'eventKey' | 'matchKey' | 'scoutName' | 'scoutNumber'>) =>
  `${eventKey.trim().toUpperCase()}_${matchKey.toLowerCase()}_${normalizeScoutKey(scoutName, scoutNumber)}_powercoin`;

export const buildPowerCoinBetSnapshot = ({
  base,
  eventKey,
  matchKey,
  matchNumber,
  matchType,
  scoutName,
  scoutNumber,
  side,
  amount,
  secureMode,
  lockedAt,
  lockReason,
  directSendStatus,
  directSendError
}: {
  base?: PowerCoinMatchBetSnapshot;
  eventKey: string;
  matchKey: string;
  matchNumber: number;
  matchType: MatchScoutingV3MatchType;
  scoutName: string;
  scoutNumber?: number | null;
  side?: PowerCoinBetSide | '';
  amount?: number;
  secureMode?: boolean;
  lockedAt?: number | null;
  lockReason?: PowerCoinBetLockReason;
  directSendStatus?: PowerCoinBetSendStatus;
  directSendError?: string;
}): PowerCoinMatchBetSnapshot => {
  const normalizedEventKey = eventKey.trim().toUpperCase();
  const normalizedMatchKey = matchKey.toLowerCase();
  const normalizedScoutName = scoutName.trim();
  const normalizedScoutNumber = scoutNumber ?? null;
  const baseIdentityMatches = normalizedScoutNumber
    ? (base?.scoutNumber ?? null) === normalizedScoutNumber
    : base?.scoutName.trim() === normalizedScoutName;
  const baseStillMatchesCurrentContext =
    base?.eventKey === normalizedEventKey &&
    base.matchKey === normalizedMatchKey &&
    baseIdentityMatches;
  const snapshot: PowerCoinMatchBetSnapshot = {
    id: baseStillMatchesCurrentContext ? base.id : buildPowerCoinBetId({ eventKey, matchKey, scoutName, scoutNumber }),
    eventKey: normalizedEventKey,
    matchKey: normalizedMatchKey,
    matchNumber: Math.max(1, Math.trunc(Number(matchNumber)) || 1),
    matchType,
    scoutName: normalizedScoutName,
    scoutNumber: normalizedScoutNumber,
    side: side ?? base?.side ?? '',
    amount: normalizePowerCoinAmount(amount ?? base?.amount ?? 0),
    placedAt: base?.placedAt || Date.now(),
    lockedAt: lockedAt === undefined ? base?.lockedAt ?? null : lockedAt,
    lockReason: lockReason ?? base?.lockReason,
    secureMode: secureMode ?? base?.secureMode ?? false,
    directSendStatus: directSendStatus ?? base?.directSendStatus ?? 'not_attempted',
    directSendError: directSendError ?? base?.directSendError ?? '',
    disqualified: base?.disqualified ?? false
  };
  return snapshot;
};

export const isSubmittablePowerCoinBet = (bet?: PowerCoinMatchBetSnapshot | null) =>
  Boolean(bet && bet.lockedAt && isPowerCoinBetSide(bet.side) && bet.amount > 0 && !bet.disqualified);

export const toStoredPowerCoinBet = (
  bet: PowerCoinMatchBetSnapshot,
  directSendStatus: PowerCoinBetSendStatus = bet.directSendStatus || 'pending',
  directSendError = bet.directSendError || ''
): PowerCoinBet | null => {
  if (!isSubmittablePowerCoinBet(bet) || !isPowerCoinBetSide(bet.side)) return null;
  return {
    id: bet.id,
    eventKey: bet.eventKey,
    matchKey: bet.matchKey,
    matchNumber: bet.matchNumber,
    matchType: bet.matchType,
    scoutName: bet.scoutName,
    scoutNumber: bet.scoutNumber ?? null,
    side: bet.side,
    amount: bet.amount,
    placedAt: bet.placedAt,
    lockedAt: bet.lockedAt,
    lockReason: bet.lockReason,
    secureMode: bet.secureMode,
    directSendStatus,
    directSendError,
    disqualified: bet.disqualified
  };
};
