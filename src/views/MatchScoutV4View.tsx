import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Bell, Download, RotateCcw, Save, Trophy, X } from 'lucide-react';
import {
  MatchScoutingV3Alliance,
  MatchScoutingV4,
  MatchScoutingV4DefenseAssignment,
  MatchScoutingV4ShiftAction,
  MatchScoutingV4ShiftEntry,
  PowerCoinBetLockReason,
  PowerCoinBetSendStatus,
  PowerCoinBetSide,
  PowerCoinMatchBetSnapshot,
  initialMatchScoutingV4
} from '../types';
import ScoutUsernameGate from '../components/ScoutUsernameGate';
import { DEFAULT_EVENT_KEY, getPersistentDeviceId } from '../utils/sharedEventState';
import { buildMatchKeyV4, normalizeMatchScoutingV4 } from '../utils/matchScoutingV4';
import { deriveShiftActionCredits } from '../utils/shiftActionWeights';
import {
  getScoutArchiveIdentity,
  renameScoutArchiveIdentity,
  setScoutArchiveIdentity,
  type ScoutArchiveIdentity,
  updateScoutArchiveRecordSyncState,
  upsertMatchArchiveRecordV4
} from '../utils/scoutArchive';
import { writeMatchScoutingV4Record } from '../utils/scoutingWrites';
import { loadTbaApiKey, upsertPowerCoinBet } from '../utils/adminV4LocalStore';
import { MathEngine, TBAMatch } from '../utils/mathEngine';
import { TBA_API_KEY } from '../config';
import { ScoutSignalHandoff } from '../components/scouting/ScoutWorkflowHeader';
import { buildScoutEvidenceAdminTask, clearScoutTaskHandoff, getScoutTaskHandoff } from '../utils/scoutTaskHandoff';
import { verifyScoutIdentityUnlockPassphrase } from '../utils/scoutIdentityLock';
import {
  buildPowerCoinBetSnapshot,
  isPowerCoinBetSide,
  isSubmittablePowerCoinBet,
  normalizePowerCoinAmount,
  toStoredPowerCoinBet
} from '../utils/scoutPowerCoins';
import {
  readScoutPagerInbox,
  removeScoutPagerInboxMessage,
  shouldDeliverScoutPagerMessage,
  type ScoutPagerMessage
} from '../utils/scoutRelayPager';
import {
  buildMatchScoutTimelineEntries,
  deriveMatchScoutShiftRole,
  deriveMatchScoutShiftSummary,
  inferFirstShiftAllianceFromFmsAuto,
  normalizeMatchScoutShiftActions,
  shouldRollSubmitShift
} from '../utils/matchScoutTimeline';

const DRAFT_KEY = 'match_scout_v4_draft';
const EDIT_MODE_KEY = 'match_scout_v4_edit_mode';
const SCORE_ACTION_STEPS = [1, 3, 5, 10] as const;
const HEAD_SCOUT_SUBMIT_TIMEOUT_MS = 8000;
type MatchScoutStepKey = 'setup' | 'score' | 'risk' | 'handoff';
const MATCH_SCOUT_STEPS: Array<{
  key: MatchScoutStepKey;
  label: string;
  question: string;
  output: string;
}> = [
  {
    key: 'setup',
    label: 'Setup',
    question: 'Which robot am I responsible for?',
    output: 'locked scout identity, match, alliance, team'
  },
  {
    key: 'score',
    label: 'Score Signal',
    question: 'How many points did this robot contribute?',
    output: 'observed contribution'
  },
  {
    key: 'risk',
    label: 'Floor Risk',
    question: 'Can strategy trust the ceiling?',
    output: 'function confidence, failures, and tail risk'
  },
  {
    key: 'handoff',
    label: 'Handoff',
    question: 'What should the head scout do with this?',
    output: 'notes, QR backup, local-first submit'
  }
];
const FAILURE_TOGGLES: Array<{ key: 'robotDied' | 'commsLost' | 'mechanismBroke' | 'tippedOver'; label: string }> = [
  { key: 'robotDied', label: 'Robot Died' },
  { key: 'commsLost', label: 'Comms Lost' },
  { key: 'mechanismBroke', label: 'Mechanism Broke' },
  { key: 'tippedOver', label: 'Tipped Over' }
];
const inputClass = 'admin-g2-sm w-full border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400';
const fieldLabelClass = 'text-xs font-black uppercase tracking-widest text-slate-500';
const sanitizeScheduleEventKey = (value: string) => value.toUpperCase().replace(/\s+/g, '');
const getShortMatchKey = (match: TBAMatch) => match.key.split('_')[1]?.toLowerCase() || '';
const normalizeTeamKey = (teamKey: string) => teamKey.replace(/^frc/i, '');
const canUseLocalTbaDevProxy = () =>
  typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

const fetchLocalTbaSchedule = async (eventKey: string): Promise<TBAMatch[] | null> => {
  if (!canUseLocalTbaDevProxy()) return null;
  const response = await fetch(`/api/local-tba/event/${encodeURIComponent(eventKey)}/matches`, {
    headers: { Accept: 'application/json' }
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  const payload = await response.json().catch(() => null) as { matches?: TBAMatch[]; error?: string } | TBAMatch[] | null;
  if (!response.ok) {
    const errorMessage = Array.isArray(payload) ? '' : payload?.error;
    throw new Error(errorMessage || `Local TBA schedule request failed with status ${response.status}.`);
  }
  return Array.isArray(payload) ? payload : payload?.matches ?? null;
};

const normalizeScoutNumberForView = (value: unknown) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) && number >= 1 && number <= 99 ? number : null;
};

const buildScoutNumberSlot = (scoutNumber: number | null) => scoutNumber ? `Scout #${scoutNumber}` : '';

const getOppositeAlliance = (alliance: MatchScoutingV3Alliance): MatchScoutingV3Alliance =>
  alliance === 'Red' ? 'Blue' : alliance === 'Blue' ? 'Red' : '';

const getAllianceTone = (alliance: MatchScoutingV3Alliance) =>
  alliance === 'Red'
    ? 'border-red-400/45 bg-red-950/60 text-red-50'
    : alliance === 'Blue'
      ? 'border-blue-400/45 bg-blue-950/60 text-blue-50'
      : 'border-slate-800 bg-slate-900/70 text-slate-50';

const getShiftPhaseLabel = (phase: MatchScoutingV4ShiftEntry['phase']) => {
  if (phase === 'transition') return 'Transition';
  if (phase === 'endgame') return 'Endgame';
  return 'Teleop';
};

const getShiftActionLabel = (action: MatchScoutingV4ShiftAction) => {
  if (action === 'offense') return 'Offense';
  if (action === 'defense') return 'Defense';
  return 'Stockpile';
};

const deriveActionSummaryLabel = (entry: MatchScoutingV4ShiftEntry) => {
  const actions = normalizeMatchScoutShiftActions(entry);
  return actions.length ? actions.map(getShiftActionLabel).join(' + ') : 'Inactive';
};

const createDefenseAssignment = (targetTeamNumber = ''): MatchScoutingV4DefenseAssignment => ({
  targetTeamNumber,
  claimedSharePercent: targetTeamNumber ? 100 : 0,
  normalizedSharePercent: targetTeamNumber ? 100 : 0,
  notes: ''
});

const getDefaultData = (deviceId: string, scoutName = '', scoutNumber: number | null = null) =>
  normalizeMatchScoutingV4({
    ...initialMatchScoutingV4,
    eventKey: DEFAULT_EVENT_KEY,
    scoutName,
    scoutNumber,
    assignedScoutName: scoutName,
    assignedSlot: buildScoutNumberSlot(scoutNumber),
    deviceId
  });

const NumberCounter = ({
  label,
  description,
  value,
  onChange,
  steps = [1, 3, 5, 10]
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  steps?: number[];
}) => {
  const [lastValue, setLastValue] = useState<number | null>(null);
  const [resetArmed, setResetArmed] = useState(false);
  const resetArmTimeoutRef = useRef<number | null>(null);
  const cancelResetArm = () => {
    if (resetArmTimeoutRef.current != null) {
      window.clearTimeout(resetArmTimeoutRef.current);
      resetArmTimeoutRef.current = null;
    }
    setResetArmed(false);
  };
  const armReset = () => {
    setResetArmed(true);
    if (resetArmTimeoutRef.current != null) {
      window.clearTimeout(resetArmTimeoutRef.current);
    }
    resetArmTimeoutRef.current = window.setTimeout(() => {
      resetArmTimeoutRef.current = null;
      setResetArmed(false);
    }, 3000);
  };
  const commitChange = (nextValue: number) => {
    cancelResetArm();
    setLastValue(value);
    onChange(nextValue);
  };
  useEffect(() => () => {
    if (resetArmTimeoutRef.current != null) {
      window.clearTimeout(resetArmTimeoutRef.current);
    }
  }, []);

  return (
    <div className="admin-g2 border border-slate-800 bg-slate-900/80 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white">{label}</h3>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-500">{description}</p>
        </div>
        <div className="admin-g2-sm border border-cyan-400/20 bg-slate-950 px-5 py-3 text-3xl font-black text-cyan-200">{value}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {steps.map(step => (
          <button
            key={step}
            type="button"
            onClick={() => commitChange(value + step)}
            className="admin-g2-sm border border-cyan-400/40 bg-cyan-500/15 px-3 py-3 text-lg font-black text-cyan-50 transition-colors hover:bg-cyan-500/25 active:scale-95"
          >
            +{step}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => commitChange(Math.max(0, value - 1))}
          className="admin-g2-sm bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
        >
          -1
        </button>
        <button
          type="button"
          onClick={() => {
            if (value === 0) return;
            if (!resetArmed) {
              armReset();
              return;
            }
            commitChange(0);
          }}
          disabled={value === 0}
          aria-label={resetArmed ? `Confirm reset ${label} to zero` : `Arm reset ${label}`}
          className={`admin-g2-sm px-3 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600 ${
            resetArmed ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-rose-950 text-rose-200 hover:bg-rose-900'
          }`}
        >
          {resetArmed ? 'Confirm Reset' : 'Reset...'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (lastValue == null) return;
            onChange(lastValue);
            setLastValue(null);
          }}
          disabled={lastValue == null}
          className="admin-g2-sm bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-200 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"
        >
          Revert Last
        </button>
      </div>
      {resetArmed && (
        <div className="mt-2 text-xs font-bold text-rose-200">
          Tap Confirm Reset within 3 seconds to zero {label}. Revert Last can restore it.
        </div>
      )}
    </div>
  );
};

function StepFrame({
  step,
  dense = false,
  children
}: {
  step: MatchScoutStepKey;
  dense?: boolean;
  children: React.ReactNode;
}) {
  const currentStep = MATCH_SCOUT_STEPS.find(item => item.key === step) || MATCH_SCOUT_STEPS[0]!;
  return (
    <section className={`admin-g2 border border-slate-800 bg-slate-900/70 ${dense ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}>
      <div className={`${dense ? 'mb-3' : 'mb-4'} flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between`}>
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{currentStep.label}</div>
          <h2 className={`mt-1 font-black text-white ${dense ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}`}>{currentStep.question}</h2>
        </div>
        <div className={`admin-g2-sm border border-cyan-400/25 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-50 ${dense ? 'hidden' : 'hidden sm:block'}`}>
          Creates: {currentStep.output}
        </div>
      </div>
      {children}
    </section>
  );
}

function PowerCoinBetPanel({
  bet,
  disabled,
  onLock,
  onUpdate
}: {
  bet?: PowerCoinMatchBetSnapshot;
  disabled: boolean;
  onLock: (reason: PowerCoinBetLockReason) => void;
  onUpdate: (patch: Partial<Pick<PowerCoinMatchBetSnapshot, 'side' | 'amount' | 'secureMode'>>) => void;
}) {
  const [revealSecureSide, setRevealSecureSide] = useState(false);
  const locked = Boolean(bet?.lockedAt);
  const secureMode = !!bet?.secureMode;
  const selectedSide = bet?.side || '';
  const amount = bet?.amount || 0;
  const secureLetter = selectedSide === 'Red' ? 'r' : selectedSide === 'Blue' ? 'b' : '';
  const sideReady = isPowerCoinBetSide(selectedSide);
  const amountReady = amount > 0;

  return (
    <section
      data-testid="powercoin-bet-panel"
      className={`admin-g2 border p-4 ${
        locked
          ? 'border-yellow-300 bg-slate-800/60 shadow-[0_0_0_3px_rgba(250,204,21,0.28)]'
          : 'border-yellow-400/25 bg-yellow-500/10'
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-yellow-100/70">PowerCoin Bet</div>
          <h2 className="mt-1 text-xl font-black text-white">
            {locked ? 'Bet locked.' : 'Place your prediction before the match starts.'}
          </h2>
          <p className="mt-1 text-sm font-semibold text-yellow-50/70">
            Optional. Pick a winner and amount before Start Game or your first scoring/defense action.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onLock('start_game')}
          disabled={locked || disabled}
          className="admin-g2-sm min-h-12 bg-emerald-400 px-6 py-3 text-base font-black text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
        >
          Start Game
        </button>
      </div>

      <div className={`mt-4 grid gap-3 lg:grid-cols-[1.25fr_180px_180px] ${locked ? 'opacity-55' : ''}`}>
        <div className="admin-g2-sm border border-yellow-400/20 bg-slate-950/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className={fieldLabelClass}>Winner Side</span>
            <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-yellow-100/70">
              <input
                type="checkbox"
                checked={secureMode}
                disabled={locked || disabled}
                onChange={event => onUpdate({ secureMode: event.target.checked })}
                className="accent-yellow-300"
              />
              Secure Mode
            </label>
          </div>

          {secureMode ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                aria-label="Secure bet side letter"
                type={revealSecureSide ? 'text' : 'password'}
                value={secureLetter}
                disabled={locked || disabled}
                maxLength={1}
                onChange={event => {
                  const letter = event.target.value.trim().toLowerCase().slice(-1);
                  if (letter === 'r') onUpdate({ side: 'Red' });
                  else if (letter === 'b') onUpdate({ side: 'Blue' });
                  else onUpdate({ side: '' });
                }}
                className={`${inputClass} font-mono font-black tracking-[0.4em] focus:border-yellow-300`}
                placeholder="r or b"
              />
              <button
                type="button"
                disabled={locked || disabled}
                onPointerDown={() => setRevealSecureSide(true)}
                onPointerUp={() => setRevealSecureSide(false)}
                onPointerLeave={() => setRevealSecureSide(false)}
                className="admin-g2-sm min-h-12 border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black text-yellow-100 hover:bg-slate-800 disabled:text-slate-600"
              >
                Hold
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(['Red', 'Blue'] as PowerCoinBetSide[]).map(side => (
                <button
                  key={side}
                  type="button"
                  disabled={locked || disabled}
                  onClick={() => onUpdate({ side })}
                  className={`admin-g2-sm min-h-12 border px-4 py-3 font-black ${
                    selectedSide === side
                      ? 'border-yellow-300 bg-yellow-300/20 text-yellow-50'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  } disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600`}
                >
                  {side}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="admin-g2-sm border border-yellow-400/20 bg-slate-950/60 p-3">
          <span className={fieldLabelClass}>Amount</span>
          <input
            aria-label="PowerCoin bet amount"
            type="number"
            min={0}
            value={amount}
            disabled={locked || disabled}
            onChange={event => onUpdate({ amount: normalizePowerCoinAmount(event.target.value) })}
            className={`${inputClass} mt-2 font-mono text-xl font-black focus:border-yellow-300`}
          />
        </label>

        <div className="admin-g2-sm border border-yellow-400/20 bg-slate-950/60 p-3">
          <div className={fieldLabelClass}>Status</div>
          <div className={`mt-2 text-sm font-black ${locked ? 'text-yellow-100' : sideReady && amountReady ? 'text-emerald-200' : 'text-slate-400'}`}>
            {locked
              ? amountReady && sideReady
                ? `${amount} on ${selectedSide}`
                : 'No bet locked'
              : sideReady && amountReady
                ? 'Ready to lock'
                : 'No active bet'}
          </div>
          <div className="mt-1 text-xs font-semibold text-slate-400">
            {locked ? `Reason: ${bet?.lockReason || 'manual'}` : 'Locks on Start Game or first action.'}
          </div>
        </div>
      </div>
    </section>
  );
}

function ShiftCard({
  entry,
  isActive,
  opponentTeamOptions,
  onActivate,
  onActionToggle,
  onAddScore,
  onUndoScore,
  onDefenseToggle,
  onDefenseShareChange
}: {
  entry: MatchScoutingV4ShiftEntry;
  isActive: boolean;
  opponentTeamOptions: string[];
  onActivate: () => void;
  onActionToggle: (action: MatchScoutingV4ShiftAction) => void;
  onAddScore: (delta: 1 | 3 | 5 | 10) => void;
  onUndoScore: () => void;
  onDefenseToggle: (targetTeamNumber: string) => void;
  onDefenseShareChange: (targetTeamNumber: string, share: number) => void;
}) {
  const selectedActions = normalizeMatchScoutShiftActions(entry);
  const actionOptions: MatchScoutingV4ShiftAction[] =
    entry.owner === 'own' ? ['offense', 'defense', 'stockpile'] : ['defense', 'stockpile'];
  const defenseAssignmentsByTeam = new Map((entry.defendedTeams || []).map(assignment => [assignment.targetTeamNumber, assignment]));
  const selectedDefenseTargets = new Set(defenseAssignmentsByTeam.keys());
  const orderedDefenseAssignments = [
    ...opponentTeamOptions
      .map(teamNumber => defenseAssignmentsByTeam.get(teamNumber))
      .filter((assignment): assignment is MatchScoutingV4DefenseAssignment => Boolean(assignment)),
    ...(entry.defendedTeams || []).filter(assignment => !opponentTeamOptions.includes(assignment.targetTeamNumber))
  ];
  const canShowCounter = isActive && entry.owner === 'own' && selectedActions.includes('offense');
  const canShowDefense = isActive && selectedActions.includes('defense');
  const canShowStockpile = selectedActions.includes('stockpile');

  return (
    <article
      data-testid={`shift-card-${entry.index + 1}`}
      className={`admin-g2 overflow-hidden border ${getAllianceTone(entry.shiftAlliance)} ${isActive ? 'ring-2 ring-white/20' : 'opacity-95'}`}
    >
      <button type="button" onClick={onActivate} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
        <span className="min-w-0">
          <span className="block text-xs font-black uppercase tracking-[0.22em] opacity-70">
            Shift {entry.index + 1} · {getShiftPhaseLabel(entry.phase)} · {entry.shiftAlliance || 'Unknown'} · {entry.owner === 'own' ? 'Scouted alliance' : 'Opponent alliance'}
          </span>
          <span className="mt-1 block text-lg font-black text-white">{deriveActionSummaryLabel(entry)}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="admin-g2-sm border border-white/10 bg-slate-950/45 px-3 py-2 font-mono text-lg font-black text-cyan-100">
            {entry.ballsScored}
          </span>
          {entry.status === 'submitted' && (
            <span className="admin-g2-sm border border-emerald-300/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-100">
              Submitted
            </span>
          )}
        </span>
      </button>

      {isActive && (
        <div className="border-t border-white/10 px-4 pb-4 pt-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {actionOptions.map(action => (
              <button
                key={action}
                type="button"
                aria-pressed={selectedActions.includes(action)}
                onClick={() => onActionToggle(action)}
                className={`admin-g2-sm px-3 py-3 text-sm font-black ${
                  selectedActions.includes(action)
                    ? 'bg-cyan-300 text-slate-950'
                    : 'bg-slate-950/65 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {getShiftActionLabel(action)}
              </button>
            ))}
          </div>

          {canShowCounter && (
            <section className="mt-4 border border-cyan-300/20 bg-cyan-300/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/75">Offense count</div>
                  <div className="mt-1 text-3xl font-black text-white">{entry.ballsScored}</div>
                </div>
                <button
                  type="button"
                  onClick={onUndoScore}
                  disabled={(entry.scoreActions || []).length === 0}
                  className="inline-flex items-center gap-2 border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm font-black text-amber-100 hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-500"
                >
                  <RotateCcw className="h-4 w-4" />
                  Undo Last
                </button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {SCORE_ACTION_STEPS.map(delta => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => onAddScore(delta)}
                    className="admin-g2-sm border border-cyan-300/35 bg-cyan-300/15 px-3 py-4 text-xl font-black text-cyan-50 hover:bg-cyan-300/25 active:scale-95"
                  >
                    +{delta}
                  </button>
                ))}
              </div>
            </section>
          )}

          {canShowStockpile && (
            <section className="mt-4 border border-violet-300/20 bg-violet-300/10 p-4">
              <div className="text-sm font-black text-white">Stockpile</div>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-violet-50/80">
                Stockpile only means going to the Neutral Zone and shooting balls back into the Alliance Zone. Picking up your own alliance balls and taking them there does not count. Bringing balls back and spitting them out without shooting does count.
              </p>
            </section>
          )}

          {canShowDefense && (
            <section className="mt-4 border border-emerald-300/20 bg-emerald-300/10 p-4">
              <div className="text-sm font-black text-white">Defense attribution</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {opponentTeamOptions.length > 0 ? opponentTeamOptions.map(teamNumber => (
                  <button
                    key={teamNumber}
                    type="button"
                    aria-pressed={selectedDefenseTargets.has(teamNumber)}
                    onClick={() => onDefenseToggle(teamNumber)}
                    className={`admin-g2-sm px-3 py-3 font-black ${
                      selectedDefenseTargets.has(teamNumber)
                        ? 'bg-emerald-300 text-slate-950'
                        : 'bg-slate-950/65 text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    Team {teamNumber}
                  </button>
                )) : (
                  <div className="sm:col-span-3 text-xs font-semibold text-amber-100">Enter the three opposing robots above before assigning defense.</div>
                )}
              </div>
              {orderedDefenseAssignments.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {orderedDefenseAssignments.map(assignment => (
                    <label key={assignment.targetTeamNumber} className="block">
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100/75">
                        Share of denying Team {assignment.targetTeamNumber}: {Math.round(assignment.claimedSharePercent || 0)}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={assignment.claimedSharePercent || 0}
                        onChange={event => onDefenseShareChange(assignment.targetTeamNumber, Number(event.target.value))}
                        className="mt-3 w-full accent-emerald-300"
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-4 border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-50">
                  Select every opponent this robot defended. Add one slider per target.
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </article>
  );
}

export default function MatchScoutV4View() {
  const location = useLocation();
  const taskHandoff = useMemo(() => getScoutTaskHandoff('matchScout', location.search), [location.search]);
  const taskHandoffKey = taskHandoff
    ? [
        taskHandoff.teamNumber,
        taskHandoff.eventKey,
        taskHandoff.matchType,
        taskHandoff.matchNumber,
        taskHandoff.alliance,
        taskHandoff.reason
      ].join(':')
    : '';
  const [completedAdminTaskKey, setCompletedAdminTaskKey] = useState('');
  const activeTaskHandoff = taskHandoffKey && taskHandoffKey === completedAdminTaskKey ? null : taskHandoff;
  const deviceId = useMemo(() => getPersistentDeviceId(), []);
  const [archiveUsername, setArchiveUsername] = useState('');
  const [archiveScoutNumber, setArchiveScoutNumber] = useState<number | null>(null);
  const [pendingUsername, setPendingUsername] = useState('');
  const [pendingScoutNumber, setPendingScoutNumber] = useState('');
  const [renameGateOpen, setRenameGateOpen] = useState(false);
  const [identityUnlockPassphrase, setIdentityUnlockPassphrase] = useState('');
  const [identityUnlockError, setIdentityUnlockError] = useState('');
  const [isUsernameResolved, setIsUsernameResolved] = useState(false);
  const [data, setData] = useState<MatchScoutingV4>(() => getDefaultData(deviceId));
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduledTeams, setScheduledTeams] = useState<string[]>([]);
  const [scheduledMatches, setScheduledMatches] = useState<TBAMatch[]>([]);
  const [manualOpponents, setManualOpponents] = useState(['', '', '']);
  const [activeShiftIndex, setActiveShiftIndex] = useState(0);
  const [assignmentWarning, setAssignmentWarning] = useState('');
  const [teamWarning, setTeamWarning] = useState('');
  const [isEditingExistingRecord, setIsEditingExistingRecord] = useState(false);
  const [teamManuallyEdited, setTeamManuallyEdited] = useState(false);
  const [pagerMessages, setPagerMessages] = useState<ScoutPagerMessage[]>([]);

  const normalizedData = useMemo(() => normalizeMatchScoutingV4(data), [data]);
  const currentMatchKey = useMemo(
    () => buildMatchKeyV4(normalizedData.matchType, normalizedData.matchNumber),
    [normalizedData.matchNumber, normalizedData.matchType]
  );
  const canOpenForm = Boolean(normalizedData.teamNumber && archiveUsername && archiveScoutNumber && normalizedData.alliance);
  const timelineEntries = useMemo(
    () => buildMatchScoutTimelineEntries(normalizedData.shiftBreakdown || [], normalizedData.teleopFirstShiftAlliance || 'Red', normalizedData.alliance),
    [normalizedData.alliance, normalizedData.shiftBreakdown, normalizedData.teleopFirstShiftAlliance]
  );
  const currentScheduleMatch = useMemo(
    () => scheduledMatches.find(match => getShortMatchKey(match) === currentMatchKey),
    [currentMatchKey, scheduledMatches]
  );
  const fmsAutoFirstShiftAlliance = useMemo(
    () => inferFirstShiftAllianceFromFmsAuto(currentScheduleMatch),
    [currentScheduleMatch]
  );
  const opponentTeamOptions = useMemo(() => {
    const opponentAlliance = getOppositeAlliance(normalizedData.alliance);
    const scheduledOpponents = opponentAlliance && currentScheduleMatch
      ? currentScheduleMatch.alliances[opponentAlliance.toLowerCase() as 'red' | 'blue'].team_keys.map(normalizeTeamKey)
      : [];
    return (scheduledOpponents.length ? scheduledOpponents : manualOpponents)
      .map(team => team.replace(/[^\d]/g, ''))
      .filter(Boolean)
      .slice(0, 3);
  }, [currentScheduleMatch, manualOpponents, normalizedData.alliance]);
  const refreshPagerInbox = () => {
    setPagerMessages(
      readScoutPagerInbox()
        .filter(message => shouldDeliverScoutPagerMessage(message, {
          eventKey: normalizedData.eventKey,
          scoutName: archiveUsername,
          scoutNumber: archiveScoutNumber
        }))
        .slice(0, 3)
    );
  };
  useEffect(() => {
    refreshPagerInbox();
    window.addEventListener('storage', refreshPagerInbox);
    window.addEventListener('scout-pager-inbox-updated', refreshPagerInbox);
    const interval = window.setInterval(refreshPagerInbox, 5000);
    return () => {
      window.removeEventListener('storage', refreshPagerInbox);
      window.removeEventListener('scout-pager-inbox-updated', refreshPagerInbox);
      window.clearInterval(interval);
    };
  }, [archiveScoutNumber, archiveUsername, normalizedData.eventKey]);
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const identity = await getScoutArchiveIdentity();
        const draftText = localStorage.getItem(DRAFT_KEY);
        const editMode = !!draftText && localStorage.getItem(EDIT_MODE_KEY) === 'true';
        if (!draftText) {
          localStorage.removeItem(EDIT_MODE_KEY);
        }
        const draft = draftText ? JSON.parse(draftText) as Partial<MatchScoutingV4> : null;
        const scoutNumber = normalizeScoutNumberForView(draft?.scoutNumber ?? identity.scoutNumber);
        const scoutName = draft?.scoutName || identity.username || '';
        if (cancelled) return;
        setArchiveUsername(identity.username || '');
        setArchiveScoutNumber(identity.scoutNumber);
        setPendingUsername(identity.username || '');
        setPendingScoutNumber(identity.scoutNumber ? String(identity.scoutNumber) : '');
        setIsEditingExistingRecord(editMode);
        setTeamManuallyEdited(Boolean(draft?.teamNumber));
        setData(normalizeMatchScoutingV4({
          ...getDefaultData(deviceId, scoutName, scoutNumber),
          ...(draft || {}),
          scoutName,
          scoutNumber,
          assignedScoutName: scoutName,
          assignedSlot: buildScoutNumberSlot(scoutNumber),
          deviceId
        }));
      } catch (error) {
        console.error('Failed to hydrate V4 scout form', error);
      } finally {
        if (!cancelled) setIsUsernameResolved(true);
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!isUsernameResolved) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(normalizedData));
  }, [isUsernameResolved, normalizedData]);

  useEffect(() => {
    if (!isUsernameResolved || !activeTaskHandoff || isEditingExistingRecord) return;
    setTeamManuallyEdited(Boolean(activeTaskHandoff.teamNumber));
    setData(previous => normalizeMatchScoutingV4({
      ...previous,
      eventKey: activeTaskHandoff.eventKey || previous.eventKey,
      matchType: activeTaskHandoff.matchType || previous.matchType,
      matchNumber: activeTaskHandoff.matchNumber || previous.matchNumber,
      matchKey: activeTaskHandoff.matchKey || buildMatchKeyV4(activeTaskHandoff.matchType || previous.matchType, activeTaskHandoff.matchNumber || previous.matchNumber),
      teamNumber: activeTaskHandoff.teamNumber || previous.teamNumber,
      alliance: activeTaskHandoff.alliance || previous.alliance
    }));
    setStatusMessage(`Admin task loaded: ${activeTaskHandoff.reason || 'collect evidence'} for Team ${activeTaskHandoff.teamNumber}.`);
  }, [activeTaskHandoff, isEditingExistingRecord, isUsernameResolved, taskHandoffKey]);

  useEffect(() => {
    let cancelled = false;
    const fetchMatches = async () => {
      if (normalizedData.eventKey === 'TEST') {
        setScheduledTeams([]);
        setAssignmentWarning('');
        setTeamWarning('');
        return;
      }

      const cacheKey = `match_schedule_${sanitizeScheduleEventKey(normalizedData.eventKey)}`;
      const cachedMatches = localStorage.getItem(cacheKey);
      const applyMatches = (matches: TBAMatch[]) => {
        const teams = new Set<string>();
        matches.forEach(match => {
          match.alliances.red.team_keys.forEach(teamKey => teams.add(normalizeTeamKey(teamKey)));
          match.alliances.blue.team_keys.forEach(teamKey => teams.add(normalizeTeamKey(teamKey)));
        });
        setScheduledMatches(matches);
        setScheduledTeams(Array.from(teams));
      };
      const refreshFromLocalDevProxy = async () => {
        const matches = await fetchLocalTbaSchedule(normalizedData.eventKey);
        if (!matches?.length || cancelled) return false;
        localStorage.setItem(cacheKey, JSON.stringify(matches));
        applyMatches(matches);
        setAssignmentWarning('');
        return true;
      };

      if (cachedMatches) {
        try {
          const parsed = JSON.parse(cachedMatches) as TBAMatch[];
          if (!cancelled) applyMatches(parsed);
        } catch (error) {
          console.error('Failed to parse cached V4 schedule', error);
        }
      }

      const localTbaApiKey = await loadTbaApiKey().catch(() => null);
      const effectiveTbaApiKey = localTbaApiKey || TBA_API_KEY;
      if (!effectiveTbaApiKey) {
        try {
          if (await refreshFromLocalDevProxy()) return;
        } catch (error) {
          console.warn('Local dev TBA schedule proxy is unavailable.', error);
        }
        setAssignmentWarning(
          cachedMatches
            ? 'Using cached schedule validation. Live schedule refresh is unavailable on this device.'
            : 'Live schedule validation is unavailable on this device. Enter team and alliance manually.'
        );
        return;
      }

      try {
        const engine = new MathEngine(effectiveTbaApiKey);
        const matches = await engine.fetchEventMatches(normalizedData.eventKey, { includeUnplayed: true });
        if (cancelled) return;
        localStorage.setItem(cacheKey, JSON.stringify(matches));
        applyMatches(matches);
        setAssignmentWarning('');
      } catch (error) {
        console.error('Failed to fetch V4 scout schedule', error);
        try {
          if (await refreshFromLocalDevProxy()) return;
        } catch (proxyError) {
          console.warn('Local dev TBA schedule proxy fallback is unavailable.', proxyError);
        }
        if (!cancelled) {
          setAssignmentWarning(
            cachedMatches
              ? 'Using cached schedule validation. Live schedule refresh is unavailable on this device.'
              : 'Unable to load the live schedule. Team number and alliance can still be entered manually.'
          );
        }
      }
    };

    void fetchMatches();
    return () => {
      cancelled = true;
    };
  }, [normalizedData.eventKey]);

  useEffect(() => {
    const generatedMatchKey = buildMatchKeyV4(normalizedData.matchType, normalizedData.matchNumber);
    if (normalizedData.matchKey !== generatedMatchKey) {
      updateData({ matchKey: generatedMatchKey });
    }
  }, [
    normalizedData.matchKey,
    normalizedData.matchNumber,
    normalizedData.matchType
  ]);

  useEffect(() => {
    if (normalizedData.eventKey === 'TEST' || scheduledTeams.length === 0 || !normalizedData.teamNumber) {
      setTeamWarning('');
      return;
    }

    if (!scheduledTeams.includes(normalizedData.teamNumber)) {
      setTeamWarning(`Warning: Team ${normalizedData.teamNumber} is not currently listed in the ${normalizedData.eventKey} schedule.`);
      return;
    }

    setTeamWarning('');
  }, [normalizedData.eventKey, normalizedData.teamNumber, scheduledTeams]);

  const updateData = (patch: Partial<MatchScoutingV4>) => {
    setData(previous => normalizeMatchScoutingV4({ ...previous, ...patch }));
  };

  const buildPowerCoinSnapshotForCurrentMatch = (
    patch: Partial<Pick<PowerCoinMatchBetSnapshot, 'side' | 'amount' | 'secureMode' | 'lockedAt' | 'lockReason' | 'directSendStatus' | 'directSendError'>> = {}
  ) =>
    buildPowerCoinBetSnapshot({
      base: normalizedData.powerCoinBet,
      eventKey: normalizedData.eventKey,
      matchKey: currentMatchKey,
      matchNumber: normalizedData.matchNumber,
      matchType: normalizedData.matchType,
      scoutName: archiveUsername,
      scoutNumber: archiveScoutNumber,
      side: patch.side ?? normalizedData.powerCoinBet?.side ?? '',
      amount: patch.amount ?? normalizedData.powerCoinBet?.amount ?? 0,
      secureMode: patch.secureMode ?? normalizedData.powerCoinBet?.secureMode ?? false,
      lockedAt: patch.lockedAt,
      lockReason: patch.lockReason,
      directSendStatus: patch.directSendStatus,
      directSendError: patch.directSendError
    });

  const saveLocalPowerCoinBet = async (
    bet: PowerCoinMatchBetSnapshot | undefined,
    directSendStatus: PowerCoinBetSendStatus = bet?.directSendStatus || 'pending',
    directSendError = ''
  ) => {
    const storedBet = bet ? toStoredPowerCoinBet(bet, directSendStatus, directSendError) : null;
    if (!storedBet) return null;
    await upsertPowerCoinBet(storedBet);
    return storedBet;
  };

  const updatePowerCoinBetDraft = (patch: Partial<Pick<PowerCoinMatchBetSnapshot, 'side' | 'amount' | 'secureMode'>>) => {
    if (normalizedData.powerCoinBet?.lockedAt) return;
    updateData({
      powerCoinBet: buildPowerCoinSnapshotForCurrentMatch({
        ...patch,
        lockedAt: null,
        directSendStatus: 'not_attempted',
        directSendError: ''
      })
    });
  };

  const lockPowerCoinBet = (reason: PowerCoinBetLockReason) => {
    if (normalizedData.powerCoinBet?.lockedAt) return normalizedData.powerCoinBet;
    const readyBet = Boolean(
      normalizedData.powerCoinBet &&
      isPowerCoinBetSide(normalizedData.powerCoinBet.side) &&
      normalizedData.powerCoinBet.amount > 0
    );
    const lockedBet = buildPowerCoinSnapshotForCurrentMatch({
      lockedAt: Date.now(),
      lockReason: reason,
      directSendStatus: readyBet ? 'pending' : 'not_attempted',
      directSendError: ''
    });
    updateData({ powerCoinBet: lockedBet });
    if (isSubmittablePowerCoinBet(lockedBet)) {
      void saveLocalPowerCoinBet(lockedBet, 'pending').catch(error => {
        console.warn('Failed to save local PowerCoin bet', error);
      });
    }
    return lockedBet;
  };

  const getPendingIdentity = (): ScoutArchiveIdentity => ({
    username: pendingUsername.trim(),
    scoutNumber: normalizeScoutNumberForView(pendingScoutNumber)
  });

  const applyLockedIdentityToForm = (identity: ScoutArchiveIdentity) => {
    setArchiveUsername(identity.username);
    setArchiveScoutNumber(identity.scoutNumber);
    setPendingUsername(identity.username);
    setPendingScoutNumber(identity.scoutNumber ? String(identity.scoutNumber) : '');
    updateData({
      scoutName: identity.username,
      scoutNumber: identity.scoutNumber,
      assignedScoutName: identity.username,
      assignedSlot: buildScoutNumberSlot(identity.scoutNumber),
      substituteScoutName: ''
    });
  };

  const commitShiftEntries = (nextEntries: MatchScoutingV4ShiftEntry[]) => {
    const summary = deriveMatchScoutShiftSummary(nextEntries);
    updateData({
      shiftBreakdown: nextEntries,
      teleopPoints: summary.teleopPoints,
      teleopCycles: 0,
      rolePlayed: summary.rolePlayed,
      defenseAssignments: summary.defenseAssignments,
      defendedTeamNumber: summary.defendedTeamNumber,
      defenseIntensity: summary.defenseIntensity
    });
  };

  const applyFirstShiftAlliance = (alliance: MatchScoutingV3Alliance) => {
    if (!alliance) return;
    const nextEntries = buildMatchScoutTimelineEntries(timelineEntries, alliance, normalizedData.alliance);
    updateData({
      teleopFirstShiftAlliance: alliance,
      shiftBreakdown: nextEntries,
      ...deriveMatchScoutShiftSummary(nextEntries)
    });
  };

  const activateShift = (nextIndex: number) => {
    if (nextIndex === activeShiftIndex) return;
    const currentEntry = timelineEntries.find(entry => entry.index === activeShiftIndex);
    if (shouldRollSubmitShift(activeShiftIndex, nextIndex, currentEntry)) {
      const nextEntries = timelineEntries.map(entry => entry.index === activeShiftIndex
        ? { ...entry, status: 'submitted' as const, submittedAt: Date.now() }
        : entry
      );
      commitShiftEntries(nextEntries);
    }
    setActiveShiftIndex(nextIndex);
  };

  const updateShiftEntry = (shiftIndex: number, patch: Partial<MatchScoutingV4ShiftEntry>) => {
    const nextEntries = timelineEntries.map(entry => {
      if (entry.index !== shiftIndex) return entry;
      const mergedActions = normalizeMatchScoutShiftActions({ ...entry, ...patch });
      const nextActions = entry.owner === 'own'
        ? mergedActions
        : mergedActions.filter(action => action !== 'offense');
      const nextRole = deriveMatchScoutShiftRole(nextActions);
      const defaultCredits = deriveShiftActionCredits(nextActions);
      const nextEntry = {
        ...entry,
        ...patch,
        actions: nextActions,
        role: nextRole,
        ballsScored: nextActions.includes('offense') ? patch.ballsScored ?? entry.ballsScored : 0,
        scoreActions: nextActions.includes('offense') ? patch.scoreActions ?? entry.scoreActions : [],
        stockpileShiftCredit: patch.stockpileShiftCredit ?? defaultCredits.stockpileShiftCredit,
        defenseShiftCredit: patch.defenseShiftCredit ?? defaultCredits.defenseShiftCredit,
        defendedTeams: nextActions.includes('defense') ? patch.defendedTeams ?? entry.defendedTeams : [],
        status: patch.status || entry.status || 'draft'
      } satisfies MatchScoutingV4ShiftEntry;
      return nextEntry;
    });
    commitShiftEntries(nextEntries);
  };

  const toggleShiftAction = (entry: MatchScoutingV4ShiftEntry, action: MatchScoutingV4ShiftAction) => {
    lockPowerCoinBet('gameplay_action');
    const currentActions = normalizeMatchScoutShiftActions(entry);
    const nextActions = currentActions.includes(action)
      ? currentActions.filter(item => item !== action)
      : [...currentActions, action];
    const allowedActions = entry.owner === 'own'
      ? nextActions
      : nextActions.filter(item => item !== 'offense');
    const defendedTeams = allowedActions.includes('defense')
      ? entry.defendedTeams.filter(assignment => assignment.targetTeamNumber)
      : [];
    updateShiftEntry(entry.index, {
      actions: allowedActions,
      role: deriveMatchScoutShiftRole(allowedActions),
      defendedTeams,
      ballsScored: allowedActions.includes('offense') ? entry.ballsScored : 0,
      scoreActions: allowedActions.includes('offense') ? entry.scoreActions : []
    });
  };

  const addShiftScoreAction = (entry: MatchScoutingV4ShiftEntry, delta: 1 | 3 | 5 | 10) => {
    if (entry.owner !== 'own') return;
    lockPowerCoinBet('gameplay_action');
    const actions = Array.from(new Set([...normalizeMatchScoutShiftActions(entry), 'offense' as const]));
    const scoreActions = [...(entry.scoreActions || []), { delta, at: Date.now() }];
    updateShiftEntry(entry.index, {
      actions,
      role: deriveMatchScoutShiftRole(actions),
      scoreActions,
      ballsScored: scoreActions.reduce((sum, action) => sum + action.delta, 0)
    });
  };

  const undoShiftScoreAction = (entry: MatchScoutingV4ShiftEntry) => {
    lockPowerCoinBet('gameplay_action');
    const scoreActions = (entry.scoreActions || []).slice(0, -1);
    updateShiftEntry(entry.index, {
      scoreActions,
      ballsScored: scoreActions.reduce((sum, action) => sum + action.delta, 0)
    });
  };

  const toggleShiftDefenseTarget = (entry: MatchScoutingV4ShiftEntry, targetTeamNumber: string) => {
    if (!targetTeamNumber) return;
    lockPowerCoinBet('gameplay_action');
    const actions = Array.from(new Set([...normalizeMatchScoutShiftActions(entry), 'defense' as const]));
    const hasTarget = entry.defendedTeams.some(assignment => assignment.targetTeamNumber === targetTeamNumber);
    const defendedTeams = hasTarget
      ? entry.defendedTeams.filter(assignment => assignment.targetTeamNumber !== targetTeamNumber)
      : [...entry.defendedTeams, createDefenseAssignment(targetTeamNumber)];
    updateShiftEntry(entry.index, {
      actions,
      role: deriveMatchScoutShiftRole(actions),
      defendedTeams
    });
  };

  const updateShiftDefenseShare = (entry: MatchScoutingV4ShiftEntry, targetTeamNumber: string, claimedSharePercent: number) => {
    if (!targetTeamNumber) return;
    lockPowerCoinBet('gameplay_action');
    const actions = Array.from(new Set([...normalizeMatchScoutShiftActions(entry), 'defense' as const]));
    const clampedShare = Math.max(0, Math.min(100, Number.isFinite(claimedSharePercent) ? claimedSharePercent : 0));
    const hasTarget = entry.defendedTeams.some(assignment => assignment.targetTeamNumber === targetTeamNumber);
    const defendedTeams = hasTarget
      ? entry.defendedTeams.map(assignment => assignment.targetTeamNumber === targetTeamNumber
          ? { ...assignment, claimedSharePercent: clampedShare, normalizedSharePercent: clampedShare }
          : assignment
        )
      : [...entry.defendedTeams, createDefenseAssignment(targetTeamNumber)].map(assignment => assignment.targetTeamNumber === targetTeamNumber
          ? { ...assignment, claimedSharePercent: clampedShare, normalizedSharePercent: clampedShare }
          : assignment
        );
    updateShiftEntry(entry.index, {
      actions,
      role: deriveMatchScoutShiftRole(actions),
      defendedTeams
    });
  };

  const handleUsernameSave = async () => {
    const identity = getPendingIdentity();
    if (!identity.username) {
      setStatusMessage('Scout username is required on this device.');
      return;
    }
    if (!identity.scoutNumber) {
      setStatusMessage('Scout number is required on this device.');
      return;
    }

    await setScoutArchiveIdentity(identity);
    applyLockedIdentityToForm(identity);
    setStatusMessage('');
  };

  const handleIdentityRename = async () => {
    const identity = getPendingIdentity();
    if (!identity.username) {
      setIdentityUnlockError('New scout username is required.');
      return;
    }
    if (!identity.scoutNumber) {
      setIdentityUnlockError('New scout number is required.');
      return;
    }

    if (identity.username === archiveUsername.trim() && identity.scoutNumber === archiveScoutNumber) {
      setRenameGateOpen(false);
      setIdentityUnlockError('');
      setIdentityUnlockPassphrase('');
      return;
    }

    const unlocked = await verifyScoutIdentityUnlockPassphrase(identityUnlockPassphrase);
    if (!unlocked) {
      setIdentityUnlockError('Admin unlock passphrase is incorrect.');
      return;
    }

    await renameScoutArchiveIdentity(identity, 'unlock_passphrase');
    applyLockedIdentityToForm(identity);
    setRenameGateOpen(false);
    setIdentityUnlockError('');
    setIdentityUnlockPassphrase('');
    setStatusMessage('Scout identity renamed on this device.');
  };

  const validate = () => {
    if (!archiveUsername.trim()) return 'Scout username is required.';
    if (!archiveScoutNumber) return 'Scout number is required.';
    if (!normalizedData.teamNumber.trim()) return 'Team number is required.';
    if (!normalizedData.alliance) return 'Alliance is required.';
    if (!normalizedData.teleopFirstShiftAlliance) return 'Confirm which alliance started the first teleop shift.';
    return '';
  };

  const buildPowerCoinSnapshotForPayload = (
    bet: PowerCoinMatchBetSnapshot | undefined,
    directSendStatus?: PowerCoinMatchBetSnapshot['directSendStatus'],
    directSendError?: string
  ) => bet
    ? buildPowerCoinBetSnapshot({
        base: bet,
        eventKey: normalizedData.eventKey,
        matchKey: currentMatchKey,
        matchNumber: normalizedData.matchNumber,
        matchType: normalizedData.matchType,
        scoutName: archiveUsername,
        scoutNumber: archiveScoutNumber,
        side: bet.side,
        amount: bet.amount,
        secureMode: bet.secureMode,
        lockedAt: bet.lockedAt,
        lockReason: bet.lockReason,
        directSendStatus: directSendStatus ?? bet.directSendStatus,
        directSendError: directSendError ?? bet.directSendError
      })
    : undefined;

  const buildCurrentPayload = (
    scoutNameOverride = archiveUsername,
    currentVersionSubmitted = false,
    options: {
      powerCoinBet?: PowerCoinMatchBetSnapshot;
      powerCoinSendStatus?: PowerCoinMatchBetSnapshot['directSendStatus'];
      powerCoinSendError?: string;
    } = {}
  ) => {
    const previousVersion = Math.max(1, Number(normalizedData.versionMetadata?.version || 1));
    const nextVersion = isEditingExistingRecord ? previousVersion + 1 : previousVersion;
    const nextMatchKey = currentMatchKey;
    const nextShiftBreakdown = buildMatchScoutTimelineEntries(timelineEntries, normalizedData.teleopFirstShiftAlliance || '', normalizedData.alliance);
    const shiftSummary = deriveMatchScoutShiftSummary(nextShiftBreakdown);
    return normalizeMatchScoutingV4({
      ...normalizedData,
      ...shiftSummary,
      shiftBreakdown: nextShiftBreakdown,
      autoCycles: 0,
      teleopCycles: 0,
      scoutName: scoutNameOverride.trim(),
      scoutNumber: archiveScoutNumber,
      assignedScoutName: scoutNameOverride.trim(),
      assignedSlot: buildScoutNumberSlot(archiveScoutNumber),
      substituteScoutName: '',
      matchKey: nextMatchKey,
      timestamp: Date.now(),
      deviceId,
      versionMetadata: {
        logicalId: `${nextMatchKey}_${normalizedData.teamNumber || 'team'}`,
        version: nextVersion,
        parentVersion: isEditingExistingRecord ? previousVersion : null,
        currentVersionSubmitted,
        submissionNumber: currentVersionSubmitted ? 1 : 0,
        submittedAt: currentVersionSubmitted ? Date.now() : null,
        editedAt: Date.now(),
        editedByName: scoutNameOverride.trim(),
        editedByScoutNumber: archiveScoutNumber,
        editedBySurface: 'scout'
      },
      editHistory: isEditingExistingRecord
        ? [
            ...(normalizedData.editHistory || []),
            {
              timestamp: Date.now(),
              editor: scoutNameOverride.trim(),
              changes: `Scout-side edit saved as version ${nextVersion}.`
            }
          ]
        : normalizedData.editHistory || [],
      adminTask: buildScoutEvidenceAdminTask(activeTaskHandoff),
      powerCoinBet: buildPowerCoinSnapshotForPayload(
        options.powerCoinBet ?? normalizedData.powerCoinBet,
        options.powerCoinSendStatus,
        options.powerCoinSendError
      )
    });
  };

  const resetFormAfterLocalSave = (scoutName = archiveUsername, scoutNumber = archiveScoutNumber) => {
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(EDIT_MODE_KEY);
    setIsEditingExistingRecord(false);
    setData(getDefaultData(deviceId, scoutName, scoutNumber));
    setTeamManuallyEdited(false);
  };

  const withHeadScoutTimeout = async <T,>(promise: Promise<T>): Promise<T> =>
    await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        window.setTimeout(() => reject(new Error('Head scout submit timed out.')), HEAD_SCOUT_SUBMIT_TIMEOUT_MS);
      })
    ]);

  const downloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCurrentJson = () => {
    const payload = buildCurrentPayload(archiveUsername, false);
    const filename = `${payload.scoutName || 'scout'}_${payload.eventKey}_${payload.matchKey}_${payload.teamNumber || 'team'}_v${payload.versionMetadata?.version || 1}.json`;
    downloadJson(filename, {
      format: 'rebuilt-2026-match-scout-v4-single-match',
      version: 1,
      exportedAt: Date.now(),
      exportedAtIso: new Date().toISOString(),
      scoutName: archiveUsername,
      scoutNumber: archiveScoutNumber,
      currentVersionSubmitted: payload.versionMetadata?.currentVersionSubmitted || false,
      submissionNumber: payload.versionMetadata?.submissionNumber || 0,
      record: payload
    });
    setStatusMessage('Offline JSON exported for this match only.');
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setStatusMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('Submitting to Head Scout...');

    const scoutName = archiveUsername.trim();
    const powerCoinBetAtSubmit = normalizedData.powerCoinBet?.lockedAt
      ? normalizedData.powerCoinBet
      : buildPowerCoinSnapshotForCurrentMatch({
          lockedAt: Date.now(),
          lockReason: 'submit',
          directSendStatus: normalizedData.powerCoinBet && isPowerCoinBetSide(normalizedData.powerCoinBet.side) && normalizedData.powerCoinBet.amount > 0
            ? 'pending'
            : 'not_attempted',
          directSendError: ''
        });
    updateData({ powerCoinBet: powerCoinBetAtSubmit });
    if (isSubmittablePowerCoinBet(powerCoinBetAtSubmit)) {
      await saveLocalPowerCoinBet(powerCoinBetAtSubmit, 'pending').catch(error => {
        console.warn('Failed to stage PowerCoin bet before submit', error);
      });
    }

    try {
      await setScoutArchiveIdentity({ username: scoutName, scoutNumber: archiveScoutNumber });

      const submittedPayload = buildCurrentPayload(scoutName, true, {
        powerCoinBet: powerCoinBetAtSubmit,
        powerCoinSendStatus: isSubmittablePowerCoinBet(powerCoinBetAtSubmit) ? 'sent' : 'not_attempted',
        powerCoinSendError: ''
      });
      try {
        const writeResult = await withHeadScoutTimeout(
          writeMatchScoutingV4Record(submittedPayload, { mode: isEditingExistingRecord ? 'replace' : 'strict' })
        );
        if (writeResult.outcome === 'conflict') {
          const localPayload = buildCurrentPayload(scoutName, false, {
            powerCoinBet: powerCoinBetAtSubmit,
            powerCoinSendStatus: isSubmittablePowerCoinBet(powerCoinBetAtSubmit) ? 'failed' : 'not_attempted',
            powerCoinSendError: writeResult.message
          });
          const archiveRecord = await upsertMatchArchiveRecordV4(localPayload, scoutName, 'local_submit', {
            syncStatus: 'unsynced',
            syncMode: isEditingExistingRecord ? 'replace' : 'strict',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: writeResult.message
          });
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: writeResult.message
          });
          if (isSubmittablePowerCoinBet(powerCoinBetAtSubmit)) {
            await saveLocalPowerCoinBet(powerCoinBetAtSubmit, 'failed', writeResult.message).catch(error => {
              console.warn('Failed to mark local PowerCoin bet conflict', error);
            });
          }
          resetFormAfterLocalSave(scoutName, archiveScoutNumber);
          setStatusMessage(`Saved locally. Firebase conflict blocked: ${writeResult.message}${isSubmittablePowerCoinBet(powerCoinBetAtSubmit) ? ' PowerCoin bet saved locally for retry.' : ''}`);
          return;
        }

        const archiveRecord = await upsertMatchArchiveRecordV4(submittedPayload, scoutName, 'local_submit', {
          syncStatus: 'synced',
          syncMode: isEditingExistingRecord ? 'replace' : 'strict',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: ''
        });
        if (activeTaskHandoff) {
          setCompletedAdminTaskKey(taskHandoffKey);
          clearScoutTaskHandoff('matchScout');
        }
        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'synced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: ''
        });
        if (isSubmittablePowerCoinBet(powerCoinBetAtSubmit)) {
          await saveLocalPowerCoinBet(powerCoinBetAtSubmit, 'sent').catch(error => {
            console.warn('Failed to mark local PowerCoin bet sent', error);
          });
        }
        resetFormAfterLocalSave(scoutName, archiveScoutNumber);
        setStatusMessage(`Submitted to Head Scout. ${writeResult.message}`);
      } catch (remoteError) {
        const remoteErrorMessage = remoteError instanceof Error ? remoteError.message : 'Head scout submit failed.';
        const localPayload = buildCurrentPayload(scoutName, false, {
          powerCoinBet: powerCoinBetAtSubmit,
          powerCoinSendStatus: isSubmittablePowerCoinBet(powerCoinBetAtSubmit) ? 'failed' : 'not_attempted',
          powerCoinSendError: remoteErrorMessage
        });
        const archiveRecord = await upsertMatchArchiveRecordV4(localPayload, scoutName, 'local_submit', {
          syncStatus: 'unsynced',
          syncMode: isEditingExistingRecord ? 'replace' : 'strict',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: remoteErrorMessage
        });
        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'unsynced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: remoteErrorMessage
        });
        if (isSubmittablePowerCoinBet(powerCoinBetAtSubmit)) {
          await saveLocalPowerCoinBet(powerCoinBetAtSubmit, 'failed', remoteErrorMessage).catch(error => {
            console.warn('Failed to mark local PowerCoin bet failed', error);
          });
        }
        resetFormAfterLocalSave(scoutName, archiveScoutNumber);
        setStatusMessage(`Saved to Local. Try re-uploading later.${isSubmittablePowerCoinBet(powerCoinBetAtSubmit) ? ' PowerCoin bet did not reach Head Scout yet.' : ''}`);
      }
    } catch (localError) {
      console.error('Failed to save V4 record locally', localError);
      setStatusMessage('Local IndexedDB save failed. Submission stopped to prevent data loss.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showUsernameGate = isUsernameResolved && (!archiveUsername || !archiveScoutNumber || renameGateOpen);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 px-4 py-6 text-white md:px-8">
      {showUsernameGate && (
        <ScoutUsernameGate
          currentUsername={archiveUsername}
          currentScoutNumber={archiveScoutNumber}
          errorMessage={identityUnlockError}
          isUnlockMode={Boolean(archiveUsername && renameGateOpen)}
          onCancel={() => {
            setRenameGateOpen(false);
            setPendingUsername(archiveUsername);
            setPendingScoutNumber(archiveScoutNumber ? String(archiveScoutNumber) : '');
            setIdentityUnlockError('');
            setIdentityUnlockPassphrase('');
          }}
          pendingScoutNumber={pendingScoutNumber}
          pendingUsername={pendingUsername}
          setPendingScoutNumber={setPendingScoutNumber}
          setPendingUsername={setPendingUsername}
          unlockPassphrase={identityUnlockPassphrase}
          setUnlockPassphrase={setIdentityUnlockPassphrase}
          onSave={() => void (archiveUsername && renameGateOpen ? handleIdentityRename() : handleUsernameSave())}
        />
      )}

      <div
        aria-hidden={showUsernameGate}
        className={`mx-auto max-w-6xl space-y-6 pb-24 ${showUsernameGate ? 'pointer-events-none select-none blur-sm' : ''}`}
      >
        <div className="scroll-mt-4">
          <StepFrame step="setup">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className={fieldLabelClass}>Event</span>
                <input
                  value={normalizedData.eventKey}
                  readOnly
                  className="admin-g2-sm w-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 font-mono font-bold text-cyan-50 outline-none"
                />
                <span className="block text-[11px] font-semibold text-slate-500">
                  Scout event is locked locally; Admin V4 settings do not change scout submissions.
                </span>
              </label>
              <div className="space-y-2">
                <div className={fieldLabelClass}>Match Type</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['Practice', 'Qualification'] as const).map(matchType => (
                    <button
                      key={matchType}
                      type="button"
                      onClick={() => {
                        setTeamManuallyEdited(false);
                        updateData({ matchType, matchKey: buildMatchKeyV4(matchType, normalizedData.matchNumber) });
                      }}
                      className={`admin-g2-sm px-4 py-3 font-black ${normalizedData.matchType === matchType ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {matchType}
                    </button>
                  ))}
                </div>
              </div>
              <label className="space-y-2">
                <span className={fieldLabelClass}>Match Number</span>
                <input
                  type="number"
                  min={1}
                  value={normalizedData.matchNumber}
                  onChange={event => {
                    setTeamManuallyEdited(false);
                    updateData({ matchNumber: Number(event.target.value), matchKey: buildMatchKeyV4(normalizedData.matchType, Number(event.target.value)) });
                  }}
                  className={`${inputClass} font-mono font-bold`}
                />
              </label>
              <label className="space-y-2">
                <span className={fieldLabelClass}>Locked Scout Name</span>
                <input
                  value={archiveUsername}
                  readOnly
                  className={`${inputClass} border-slate-800 font-bold opacity-80`}
                />
              </label>
              <label className="space-y-2">
                <span className={fieldLabelClass}>Locked Scout Number</span>
                <input
                  value={archiveScoutNumber ?? ''}
                  readOnly
                  className={`${inputClass} border-slate-800 font-mono text-xl font-black opacity-80`}
                />
              </label>
              <label className="space-y-2">
                <span className={fieldLabelClass}>Team Number</span>
                <input
                  value={normalizedData.teamNumber}
                  onChange={event => {
                    setTeamManuallyEdited(true);
                    updateData({ teamNumber: event.target.value.replace(/[^\d]/g, '') });
                  }}
                  className={`${inputClass} font-mono text-xl font-black`}
                />
              </label>
              <div className="space-y-2">
                <div className={fieldLabelClass}>Alliance</div>
                <div className="grid grid-cols-2 gap-2">
                  {(['Red', 'Blue'] as const).map(alliance => (
                    <button
                      key={alliance}
                      type="button"
                      onClick={() => updateData({ alliance })}
                      className={`admin-g2-sm px-4 py-3 font-black ${normalizedData.alliance === alliance ? (alliance === 'Red' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white') : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {alliance}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="admin-g2-sm mt-5 border border-slate-800 bg-slate-950/45 px-4 py-3 text-sm text-slate-300">
              This device is locked to <span className="font-black text-white">{archiveUsername || 'no scout name'}</span>
              {' '}as <span className="font-black text-white">Scout #{archiveScoutNumber ?? 'not set'}</span>.
              {' '}
              <button
                type="button"
                onClick={() => {
                  setPendingUsername(archiveUsername);
                  setPendingScoutNumber(archiveScoutNumber ? String(archiveScoutNumber) : '');
                  setRenameGateOpen(true);
                }}
                className="font-black text-cyan-200 underline-offset-4 hover:text-cyan-100 hover:underline"
              >
                Change with admin passphrase
              </button>
            </div>

            {(assignmentWarning || teamWarning) && (
              <div className="mt-4 space-y-2">
                {assignmentWarning && (
                  <div className="admin-g2-sm flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {assignmentWarning}
                  </div>
                )}
                {teamWarning && (
                  <div className="admin-g2-sm flex items-start gap-2 border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {teamWarning}
                  </div>
                )}
              </div>
            )}

            {canOpenForm && (
              <div className="admin-g2-sm mt-5 border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100">
                Setup is ready. Offense, defense, risk, and notes are all unlocked below.
              </div>
            )}
            {statusMessage && (
              <div className="admin-g2-sm mt-4 border border-amber-400/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                {statusMessage}
              </div>
            )}
            {pagerMessages.length > 0 && (
              <div data-testid="scout-pager-inbox" className="mt-4 space-y-2">
                {pagerMessages.map(message => (
                  <div key={message.id} className="admin-g2-sm flex items-start gap-3 border border-yellow-300/45 bg-yellow-300/10 px-4 py-3 text-sm text-yellow-50">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-yellow-200" />
                    <div className="min-w-0 flex-1">
                      <div className="font-black">{message.title}</div>
                      <div className="mt-1 font-semibold text-yellow-100/85">{message.body}</div>
                      <div className="mt-1 text-xs font-black uppercase tracking-wider text-yellow-200/70">No reply needed here. Follow the prompt and keep scouting.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeScoutPagerInboxMessage(message.id);
                        refreshPagerInbox();
                      }}
                      className="admin-g2-sm border border-yellow-300/25 bg-yellow-300/10 p-2 text-yellow-100 hover:bg-yellow-300/20"
                      aria-label={`Dismiss ${message.title}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </StepFrame>

          {canOpenForm && (
            <section className="mt-6 space-y-5">
              <PowerCoinBetPanel
                bet={normalizedData.powerCoinBet}
                disabled={isSubmitting}
                onLock={lockPowerCoinBet}
                onUpdate={updatePowerCoinBetDraft}
              />

              <StepFrame step="score" dense>
                <section data-testid="auto-shift-panel" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <NumberCounter
                    label="Auto Points"
                    description="Autonomous contribution."
                    value={normalizedData.autoPoints}
                    onChange={value => {
                      lockPowerCoinBet('gameplay_action');
                      updateData({ autoPoints: value });
                    }}
                  />
                  <div className="admin-g2-sm border border-slate-800 bg-slate-950/40 p-3">
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Auto Shift</div>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-400">
                      Keep auto separate from the red/blue shift timeline.
                    </p>
                  </div>
                </section>
              </StepFrame>

              <div data-testid="first-shift-panel" className="admin-g2 border border-slate-800 bg-slate-900/70 p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Teleop Timeline</div>
                    <h2 className="mt-1 text-xl font-black text-white">Red/Blue First Alliance Shift</h2>
                    <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-slate-400">
                      Choose the alliance that actually started teleop. This is reversible, and the shift cards below reorder immediately so the form stays aligned with the real match.
                    </p>
                  </div>
                  <div className="grid min-w-full grid-cols-2 gap-2 xl:min-w-[18rem]">
                    {(['Red', 'Blue'] as const).map(alliance => (
                      <button
                        key={alliance}
                        type="button"
                        data-testid={`first-shift-${alliance.toLowerCase()}`}
                        onClick={() => applyFirstShiftAlliance(alliance)}
                        className={`admin-g2-sm px-4 py-3 font-black ${
                          normalizedData.teleopFirstShiftAlliance === alliance
                            ? alliance === 'Red'
                              ? 'bg-red-500 text-white'
                              : 'bg-blue-500 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {alliance} first
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <button
                    type="button"
                    data-testid="first-shift-fms-auto"
                    disabled={!fmsAutoFirstShiftAlliance}
                    onClick={() => applyFirstShiftAlliance(fmsAutoFirstShiftAlliance)}
                    className="admin-g2-sm border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-50 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-500"
                  >
                    Use FMS/Auto First Shift
                  </button>
                  <div className="text-xs font-bold text-slate-400">
                    {fmsAutoFirstShiftAlliance
                      ? `FMS/Auto suggests ${fmsAutoFirstShiftAlliance} starts first.`
                      : 'FMS/Auto first-shift data is not available yet.'}
                  </div>
                </div>
                <div data-testid="first-shift-current" className="admin-g2-sm mt-4 border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-50/85">
                  Current first shift: <span className="text-white">{normalizedData.teleopFirstShiftAlliance || 'Not confirmed'}</span>
                </div>

                {opponentTeamOptions.length < 3 && (
                  <div className="admin-g2-sm mt-4 border border-amber-400/25 bg-amber-500/10 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-100/80">Opposing Robots</div>
                    <p className="mt-1 text-xs font-semibold text-amber-50/75">
                      TBA did not provide all three opponents for this match yet. Enter them here so defense target buttons stay specific.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {manualOpponents.map((team, index) => (
                        <input
                          key={index}
                          value={team}
                          onChange={event => {
                            const next = [...manualOpponents];
                            next[index] = event.target.value.replace(/[^\d]/g, '');
                            setManualOpponents(next);
                          }}
                          className="admin-g2-sm border border-amber-400/25 bg-slate-950/70 px-3 py-2 font-mono font-black text-white outline-none focus:border-amber-200"
                          placeholder={`Opponent ${index + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <section className="space-y-3" data-testid="shift-timeline">
                {timelineEntries.map(entry => (
                  <ShiftCard
                    key={entry.id}
                    entry={entry}
                    isActive={entry.index === activeShiftIndex}
                    opponentTeamOptions={opponentTeamOptions}
                    onActivate={() => activateShift(entry.index)}
                    onActionToggle={action => toggleShiftAction(entry, action)}
                    onAddScore={delta => addShiftScoreAction(entry, delta)}
                    onUndoScore={() => undoShiftScoreAction(entry)}
                    onDefenseToggle={targetTeamNumber => toggleShiftDefenseTarget(entry, targetTeamNumber)}
                    onDefenseShareChange={(targetTeamNumber, share) => updateShiftDefenseShare(entry, targetTeamNumber, share)}
                  />
                ))}
              </section>

              <StepFrame step="score">
                <NumberCounter
                  label="Endgame Points"
                  description="Late-match contribution after teleop shifts."
                  value={normalizedData.endgamePoints}
                  onChange={value => {
                    lockPowerCoinBet('gameplay_action');
                    updateData({ endgamePoints: value });
                  }}
                  steps={[1, 5, 10, 15]}
                />
              </StepFrame>

              <StepFrame step="risk">
                <section>
                  <div className="mb-4 flex items-start gap-3">
                    <Trophy className="h-5 w-5 text-rose-300" />
                    <div>
                      <h2 className="text-xl font-black text-white">Problems During The Match</h2>
                      <p className="text-sm font-semibold text-slate-400">Only touch these if something happened. Otherwise leave them alone.</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-4">
                    <label className="space-y-2">
                      <span className={fieldLabelClass}>Fouls</span>
                      <input type="number" min={0} value={normalizedData.fouls} onChange={event => updateData({ fouls: Number(event.target.value) })} className={`${inputClass} font-mono font-bold focus:border-rose-400`} />
                    </label>
                    <label className="space-y-2">
                      <span className={fieldLabelClass}>Tech Fouls</span>
                      <input type="number" min={0} value={normalizedData.techFouls} onChange={event => updateData({ techFouls: Number(event.target.value) })} className={`${inputClass} font-mono font-bold focus:border-rose-400`} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className={fieldLabelClass}>Robot Function Confidence: {(normalizedData.reliabilityScore * 100).toFixed(0)}%</span>
                      <input type="range" min={0} max={1} step={0.0001} value={normalizedData.reliabilityScore} onChange={event => updateData({ reliabilityScore: Number(event.target.value) })} className="w-full accent-rose-400" />
                    </label>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-4">
                    {FAILURE_TOGGLES.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateData({ [key]: !normalizedData[key] })}
                        className={`admin-g2-sm px-3 py-3 font-black ${normalizedData[key] ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-4 block space-y-2">
                    <span className={fieldLabelClass}>Failure Reason</span>
                    <input value={normalizedData.failureReason} onChange={event => updateData({ failureReason: event.target.value })} className={`${inputClass} focus:border-rose-400`} />
                  </label>
                </section>
              </StepFrame>

              <StepFrame step="handoff">
                <ScoutSignalHandoff missionKey="matchScout" />
                <section className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>What changed the number?</span>
                    <textarea
                      value={normalizedData.notes}
                      onChange={event => updateData({ notes: event.target.value })}
                      rows={6}
                      className={`${inputClass} min-h-32`}
                      placeholder="Examples: scored early, switched to defense, got defended hard, intake jammed, recovered and climbed."
                    />
                  </label>
                  <label className="space-y-2">
                    <span className={fieldLabelClass}>What should strategy know?</span>
                    <textarea
                      value={normalizedData.strategyNotes}
                      onChange={event => updateData({ strategyNotes: event.target.value })}
                      rows={6}
                      className={`${inputClass} min-h-32`}
                      placeholder="Examples: good second scorer, can defend without dying, avoid traffic near source, verify before pick list."
                    />
                  </label>
                </section>

                <div className="admin-g2 mt-4 flex flex-wrap items-center justify-end gap-3 border border-slate-800 bg-slate-900/70 p-4">
                  <button
                    type="button"
                    onClick={handleDownloadCurrentJson}
                    className="admin-g2-sm inline-flex items-center gap-2 bg-slate-800 px-5 py-3 font-black text-slate-200 hover:bg-slate-700"
                  >
                    <Download className="h-5 w-5" />
                    Offline JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting}
                    className="admin-g2-sm inline-flex items-center gap-2 bg-emerald-500 px-8 py-3 text-lg font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    <Save className="h-5 w-5" />
                    Submit to Head Scout
                  </button>
                </div>
              </StepFrame>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
