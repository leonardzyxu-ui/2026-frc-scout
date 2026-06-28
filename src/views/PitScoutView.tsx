import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, QrCode, Save, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PitScoutingV2 } from '../types';
import {
  DEFAULT_EVENT_KEY,
  getPersistentDeviceId
} from '../utils/sharedEventState';
import {
  formatPitChassisSpeed,
  getClimbCapabilityLabel,
  getShooterLabel,
  getTraversalLabel,
  normalizePitChassisSpeed
} from '../utils/pitScouting';
import { compressPitData } from '../utils/qrCompression';
import { writePitScoutingRecord } from '../utils/scoutingWrites';
import { buildScoutDraftKey, deleteScoutDraft, getScoutDraft, setScoutDraft } from '../utils/scoutDrafts';
import {
  getScoutArchiveUsername,
  setScoutArchiveUsername,
  updateScoutArchiveRecordSyncState,
  upsertPitArchiveRecord
} from '../utils/scoutArchive';
import ScoutUsernameGate from '../components/ScoutUsernameGate';
import ScoutWorkflowHeader, { ScoutSignalHandoff } from '../components/scouting/ScoutWorkflowHeader';
import ScoutingMissionPanel from '../components/scouting/ScoutingMissionPanel';
import { buildScoutEvidenceAdminTask, clearScoutTaskHandoff, getScoutTaskHandoff, getScoutTaskReturnPath } from '../utils/scoutTaskHandoff';

const PIT_EDIT_STORAGE_KEY = 'edit_pit_data';
const PIT_SCOUT_NAME_STORAGE_KEY = 'pit_scout_name';

type BallField = 'match' | 'auto' | 'teleop';
type PitScoutStepKey = 'identity' | 'build' | 'scoring' | 'endgame' | 'handoff';

const PIT_SCOUT_STEPS: Array<{
  key: PitScoutStepKey;
  label: string;
  question: string;
  output: string;
}> = [
  {
    key: 'identity',
    label: 'Identity',
    question: 'Which team are we interviewing?',
    output: 'team profile anchor'
  },
  {
    key: 'build',
    label: 'Build',
    question: 'What kind of robot is this?',
    output: 'traffic and compatibility prior'
  },
  {
    key: 'scoring',
    label: 'Scoring Prior',
    question: 'What do they claim they can score?',
    output: 'early expected-range prior'
  },
  {
    key: 'endgame',
    label: 'Endgame',
    question: 'What can they finish with?',
    output: 'pick-list role fit'
  },
  {
    key: 'handoff',
    label: 'Handoff',
    question: 'What should match scouts verify?',
    output: 'verification notes and local-first save'
  }
];

interface PitScoutDraftPayload {
  form: PitScoutingV2;
  ballFieldHistory: BallField[];
}

interface PendingPitEdit {
  eventKey: string;
  data: PitScoutingV2;
}

const getStoredPitScoutName = () => localStorage.getItem(PIT_SCOUT_NAME_STORAGE_KEY) || '';

const createInitialPitForm = (scoutName = getStoredPitScoutName()): PitScoutingV2 => ({
  teamNumber: '',
  teamName: '',
  scoutName,
  robotBaseType: '',
  isWcpBot: false,
  isKitBot: false,
  turretCount: '',
  customTurretCount: '',
  canUseHopper: false,
  hopperCapacity: 0,
  canClimbL1: false,
  canClimbL2: false,
  canClimbL3: false,
  noClimbCapability: false,
  expectedHubBallsPerMatch: 0,
  expectedAutoBalls: 0,
  expectedTeleopBalls: 0,
  ballsPerSecond: 0,
  shootingStyle: '',
  canCrossTrench: false,
  isBumpOnly: false,
  chassisSpeed: 0,
  chassisSpeedDistanceUnit: '',
  chassisSpeedTimeUnit: '',
  shootingFlywheelCount: 0,
  hoodAdjustable: false,
  notes: ''
});

const sanitizeDigits = (value: string) => value.replace(/\D/g, '');
const parseNonNegativeInteger = (value: string) => {
  const digits = sanitizeDigits(value);
  return digits ? parseInt(digits, 10) : 0;
};
const inputClass = 'admin-g2-sm w-full border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-400';
const labelClass = 'block text-xs font-black uppercase tracking-widest text-slate-500';

function ChoiceButton({
  active,
  label,
  onClick,
  tone = 'emerald',
  disabled = false
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  tone?: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
  disabled?: boolean;
}) {
  const activeClasses = {
    emerald: 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-50',
    blue: 'border border-blue-400/40 bg-blue-500/15 text-blue-50',
    amber: 'border border-amber-400/40 bg-amber-500/15 text-amber-50',
    purple: 'border border-purple-400/40 bg-purple-500/15 text-purple-50',
    rose: 'border border-rose-400/40 bg-rose-500/15 text-rose-50'
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`admin-g2-sm px-3 py-3 text-sm font-bold transition-all ${
        active ? activeClasses[tone] : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-slate-800' : ''}`}
    >
      {label}
    </button>
  );
}

const getPitStepReadiness = (step: PitScoutStepKey, form: PitScoutingV2) => {
  switch (step) {
    case 'identity':
      return Boolean(form.teamNumber.trim() && form.teamName.trim() && form.scoutName.trim());
    case 'build':
      return Boolean(form.robotBaseType || form.canCrossTrench || form.isBumpOnly || form.chassisSpeed > 0);
    case 'scoring':
      return Boolean(
        form.turretCount ||
        form.expectedHubBallsPerMatch > 0 ||
        form.expectedAutoBalls > 0 ||
        form.expectedTeleopBalls > 0 ||
        form.canUseHopper ||
        form.shootingStyle
      );
    case 'endgame':
      return Boolean(form.noClimbCapability || form.canClimbL1 || form.canClimbL2 || form.canClimbL3);
    case 'handoff':
      return Boolean(form.notes.trim());
  }
};

function PitStepNav({
  activeStep,
  form,
  onChange
}: {
  activeStep: PitScoutStepKey;
  form: PitScoutingV2;
  onChange: (step: PitScoutStepKey) => void;
}) {
  return (
    <nav className="admin-g2 border border-slate-800 bg-slate-900/70 p-3">
      <div className="grid auto-cols-[minmax(180px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1 lg:grid-flow-row lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        {PIT_SCOUT_STEPS.map((step, index) => {
          const isActive = activeStep === step.key;
          const ready = getPitStepReadiness(step.key, form);
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onChange(step.key)}
              className={`admin-g2-sm border p-3 text-left transition ${
                isActive
                  ? 'border-emerald-300 bg-emerald-400/15 text-emerald-50 ring-1 ring-emerald-300/40'
                  : 'border-slate-800 bg-slate-950/65 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{index + 1}</span>
                {ready ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-300' : 'bg-slate-700'}`} />}
              </div>
              <div className="mt-2 text-sm font-black text-white">{step.label}</div>
              <div className="mt-1 text-xs font-semibold text-slate-400">{step.question}</div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function PitStepFrame({
  step,
  children
}: {
  step: PitScoutStepKey;
  children: React.ReactNode;
}) {
  const currentStep = PIT_SCOUT_STEPS.find(item => item.key === step) || PIT_SCOUT_STEPS[0]!;
  return (
    <section className="admin-g2 border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{currentStep.label}</div>
          <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{currentStep.question}</h2>
        </div>
        <div className="admin-g2-sm hidden border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-50 sm:block">
          Creates: {currentStep.output}
        </div>
      </div>
      {children}
    </section>
  );
}

function PitStepFooter({
  activeStep,
  onChange
}: {
  activeStep: PitScoutStepKey;
  onChange: (step: PitScoutStepKey) => void;
}) {
  const activeIndex = PIT_SCOUT_STEPS.findIndex(step => step.key === activeStep);
  const previousStep = PIT_SCOUT_STEPS[activeIndex - 1];
  const nextStep = PIT_SCOUT_STEPS[activeIndex + 1];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        disabled={!previousStep}
        onClick={() => previousStep && onChange(previousStep.key)}
        className="admin-g2-sm inline-flex items-center gap-2 border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-black text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
        Back Step
      </button>
      {nextStep && (
        <button
          type="button"
          onClick={() => onChange(nextStep.key)}
          className="admin-g2-sm inline-flex items-center gap-2 bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-emerald-300"
        >
          Next: {nextStep.label}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function PitPriorStrip({ form }: { form: PitScoutingV2 }) {
  const shooterLabel = getShooterLabel(form) || 'Shooter unknown';
  const traversalLabel = getTraversalLabel(form) || 'Path unknown';
  const climbLabel = getClimbCapabilityLabel(form) || 'Endgame unknown';
  const speedLabel = formatPitChassisSpeed(form);
  const claimedScoring = form.expectedHubBallsPerMatch || form.expectedAutoBalls + form.expectedTeleopBalls;
  const unknownCount = [shooterLabel === 'Shooter unknown', traversalLabel === 'Path unknown', climbLabel === 'Endgame unknown']
    .filter(Boolean)
    .length;
  const stabilityMultiplier = Math.max(0.25, 0.72 - unknownCount * 0.12 + (form.canUseHopper ? 0.08 : 0) + (form.hoodAdjustable ? 0.05 : 0));
  const floorPrior = Math.max(0, Math.round(claimedScoring * stabilityMultiplier));
  const climbUpside = form.canClimbL3 ? 15 : form.canClimbL2 ? 10 : form.canClimbL1 ? 5 : 0;
  const throughputUpside = Math.min(8, Math.max(0, form.ballsPerSecond * 2 + (form.hopperCapacity ? form.hopperCapacity / 4 : 0)));
  const ceilingPrior = Math.max(claimedScoring, Math.round(claimedScoring + climbUpside + throughputUpside));
  const rolePrior =
    form.noClimbCapability
      ? 'Scoring-only prior'
      : form.canClimbL3 || form.canClimbL2
        ? 'Endgame anchor prior'
        : form.canCrossTrench || speedLabel !== 'N/A'
          ? 'Traffic runner prior'
          : shooterLabel !== 'Shooter unknown'
            ? 'Scoring prior'
            : 'Role unknown';
  const verificationQuestions = [
    form.expectedHubBallsPerMatch ? '' : 'Ask match scouts to verify scoring volume.',
    form.expectedAutoBalls || form.expectedTeleopBalls ? '' : 'Ask for auto/teleop split.',
    form.canUseHopper && form.hopperCapacity === 0 ? 'Confirm whether the hopper capacity claim is real.' : '',
    form.ballsPerSecond > 0 ? 'Check whether claimed shot rate survives defense and traffic.' : '',
    climbLabel === 'Endgame unknown' ? 'Watch if the climb works under defense and time pressure.' : '',
    traversalLabel === 'Path unknown' ? 'Confirm field pathing before assigning traffic-heavy roles.' : ''
  ].filter(Boolean);

  const cards = [
    {
      label: 'Claimed Expected',
      value: claimedScoring > 0 ? `${claimedScoring} balls` : 'Need scoring claim',
      detail: `${form.expectedAutoBalls || 0} auto / ${form.expectedTeleopBalls || 0} teleop becomes the early expected-range prior.`
    },
    {
      label: 'Floor Watch',
      value: claimedScoring > 0 ? `${floorPrior} ball floor` : 'Untrusted floor',
      detail: unknownCount > 0 ? `${unknownCount} unknown capability area${unknownCount === 1 ? '' : 's'} lower trust.` : 'Claim has enough context for match scouts to test.'
    },
    {
      label: 'Ceiling Clue',
      value: claimedScoring > 0 || climbUpside > 0 ? `${ceilingPrior} upside` : 'Need upside clue',
      detail: `${climbLabel}; throughput and endgame are upside, not proof.`
    },
    {
      label: 'Role Prior',
      value: rolePrior,
      detail: `${shooterLabel} · ${traversalLabel} · ${speedLabel}`
    }
  ];

  return (
    <section className="admin-g2 border border-emerald-400/25 bg-emerald-500/10 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Pit Prior Map</div>
          <h2 className="mt-1 text-xl font-black text-white">Turn the interview into model context</h2>
        </div>
        <div className="text-sm font-semibold text-emerald-50/75">
          {form.teamNumber || 'Team TBD'} · {form.teamName || 'name pending'} · {climbLabel}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {cards.map(card => (
          <div key={card.label} className="admin-g2-sm border border-emerald-200/10 bg-slate-950/55 px-3 py-3">
            <div className="text-xs font-black uppercase tracking-wider text-emerald-100">{card.label}</div>
            <div className="mt-2 text-lg font-black text-white">{card.value}</div>
            <div className="mt-2 text-xs font-semibold text-slate-300">{card.detail}</div>
          </div>
        ))}
      </div>
      <div className="admin-g2-sm mt-3 border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100">
        Verify first: {verificationQuestions[0] || 'Match scouts should confirm the claimed role, scoring split, and endgame reliability under real defense.'}
      </div>
      <div className="mt-2 text-xs font-semibold leading-relaxed text-emerald-50/70">
        This is not the final expected range. It is the human prior Admin V4 uses before enough match rows exist, and it tells match scouts what to prove or disprove.
      </div>
    </section>
  );
}

export default function PitScoutView() {
  const navigate = useNavigate();
  const location = useLocation();
  const taskHandoff = useMemo(() => getScoutTaskHandoff('pitScout', location.search), [location.search]);
  const taskHandoffKey = taskHandoff
    ? [taskHandoff.teamNumber, taskHandoff.teamName, taskHandoff.eventKey, taskHandoff.reason].join(':')
    : '';
  const [completedAdminTaskKey, setCompletedAdminTaskKey] = useState('');
  const activeTaskHandoff = taskHandoffKey && taskHandoffKey === completedAdminTaskKey ? null : taskHandoff;
  const [eventKey, setEventKey] = useState(() => DEFAULT_EVENT_KEY);
  const [form, setForm] = useState<PitScoutingV2>(() => createInitialPitForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingTeamNumber, setEditingTeamNumber] = useState('');
  const [bootModeResolved, setBootModeResolved] = useState(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [ballFieldHistory, setBallFieldHistory] = useState<BallField[]>([]);
  const [showQr, setShowQr] = useState(false);
  const [archiveUsername, setArchiveUsernameState] = useState('');
  const [pendingArchiveUsername, setPendingArchiveUsername] = useState('');
  const [isArchiveUsernameResolved, setIsArchiveUsernameResolved] = useState(false);
  const [activeStep, setActiveStep] = useState<PitScoutStepKey>('identity');
  const [hasUsedStepNav, setHasUsedStepNav] = useState(false);
  const activeStepRef = useRef<HTMLDivElement | null>(null);
  const skipNextDraftSaveRef = useRef(false);

  const activeDraftKey = useMemo(() => {
    if (!bootModeResolved) return '';
    if (isEditing) {
      return buildScoutDraftKey('pit', 'edit', `${eventKey}:${editingTeamNumber || form.teamNumber || 'pending'}`);
    }
    return buildScoutDraftKey('pit', 'new', eventKey);
  }, [bootModeResolved, editingTeamNumber, eventKey, form.teamNumber, isEditing]);

  const updateForm = (updates: Partial<PitScoutingV2>) => {
    setForm(prev => ({ ...prev, ...updates }));
  };

  const handleStepChange = (step: PitScoutStepKey) => {
    setHasUsedStepNav(true);
    setActiveStep(step);
  };

  useEffect(() => {
    if (!hasUsedStepNav) return;
    window.setTimeout(() => {
      activeStepRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 0);
  }, [activeStep, hasUsedStepNav]);

  useEffect(() => {
    let cancelled = false;

    const hydrateArchiveUsername = async () => {
      try {
        const storedUsername = await getScoutArchiveUsername();
        if (cancelled) return;
        setArchiveUsernameState(storedUsername || '');
        setPendingArchiveUsername(storedUsername || '');
        if (storedUsername) {
          setForm(prev => ({
            ...prev,
            scoutName: prev.scoutName || storedUsername
          }));
        }
      } catch (error) {
        console.error('Failed to hydrate scout archive username', error);
      } finally {
        if (!cancelled) {
          setIsArchiveUsernameResolved(true);
        }
      }
    };

    void hydrateArchiveUsername();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleArchiveUsernameSave = async () => {
    const normalized = pendingArchiveUsername.trim();
    if (!normalized) {
      setError('Please enter a scout username for this device.');
      return;
    }

    try {
      await setScoutArchiveUsername(normalized);
      setArchiveUsernameState(normalized);
      setPendingArchiveUsername(normalized);
      setForm(prev => ({
        ...prev,
        scoutName: prev.scoutName || normalized
      }));
      setError('');
    } catch (error) {
      console.error('Failed to save scout archive username', error);
      setError('Unable to save the scout username on this device.');
    }
  };

  useEffect(() => {
    const editDataStr = localStorage.getItem(PIT_EDIT_STORAGE_KEY);
    if (!editDataStr) {
      setBootModeResolved(true);
      return;
    }

    try {
      const parsed = JSON.parse(editDataStr) as PendingPitEdit;
      setForm({ ...createInitialPitForm(''), ...parsed.data, scoutName: parsed.data.scoutName || '' });
      setEventKey(parsed.eventKey || DEFAULT_EVENT_KEY);
      setIsEditing(true);
      setEditingTeamNumber(parsed.data.teamNumber);
    } catch (editError) {
      console.error('Failed to parse pit edit payload', editError);
    } finally {
      localStorage.removeItem(PIT_EDIT_STORAGE_KEY);
      setBootModeResolved(true);
    }
  }, []);

  useEffect(() => {
    if (!bootModeResolved || !activeDraftKey) return;

    let cancelled = false;

    const hydrateDraft = async () => {
      try {
        const draft = await getScoutDraft<PitScoutDraftPayload>(activeDraftKey);
        if (cancelled || !draft) return;

        setForm({ ...createInitialPitForm(), ...draft.data.form });
        setBallFieldHistory(draft.data.ballFieldHistory || []);
      } catch (draftError) {
        console.error('Failed to hydrate pit scout draft', draftError);
      } finally {
        if (!cancelled) {
          setIsDraftHydrated(true);
        }
      }
    };

    setIsDraftHydrated(false);
    void hydrateDraft();

    return () => {
      cancelled = true;
    };
  }, [activeDraftKey, bootModeResolved]);

  useEffect(() => {
    if (!bootModeResolved || !isDraftHydrated || !activeDraftKey) return;

    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    void setScoutDraft(activeDraftKey, 'pit', isEditing ? 'edit' : 'new', isEditing ? editingTeamNumber || form.teamNumber : eventKey, {
      form,
      ballFieldHistory
    });
  }, [activeDraftKey, ballFieldHistory, bootModeResolved, editingTeamNumber, eventKey, form, isDraftHydrated, isEditing]);

  useEffect(() => {
    localStorage.setItem(PIT_SCOUT_NAME_STORAGE_KEY, form.scoutName || '');
  }, [form.scoutName]);

  useEffect(() => {
    if (!bootModeResolved || !isDraftHydrated || !activeTaskHandoff || isEditing) return;
    setEventKey(activeTaskHandoff.eventKey || DEFAULT_EVENT_KEY);
    setActiveStep('identity');
    setForm(prev => ({
      ...prev,
      teamNumber: activeTaskHandoff.teamNumber || prev.teamNumber,
      teamName: activeTaskHandoff.teamName || prev.teamName,
      scoutName: prev.scoutName || archiveUsername || pendingArchiveUsername
    }));
    setError('');
    setSuccessMessage(`Admin task loaded: ${activeTaskHandoff.reason || 'collect pit prior'} for Team ${activeTaskHandoff.teamNumber}.`);
  }, [activeTaskHandoff, archiveUsername, bootModeResolved, isDraftHydrated, isEditing, pendingArchiveUsername, taskHandoffKey]);

  const handleBaseTypeSelect = (robotBaseType: PitScoutingV2['robotBaseType']) => {
    updateForm({
      robotBaseType,
      isWcpBot: robotBaseType === 'WCP',
      isKitBot: robotBaseType === 'KitBot'
    });
  };

  const handleTraversalSelect = (mode: 'trench' | 'bump') => {
    updateForm({
      canCrossTrench: mode === 'trench',
      isBumpOnly: mode === 'bump'
    });
  };

  const handleNoClimbToggle = () => {
    if (form.noClimbCapability) {
      updateForm({ noClimbCapability: false });
      return;
    }

    updateForm({
      noClimbCapability: true,
      canClimbL1: false,
      canClimbL2: false,
      canClimbL3: false
    });
  };

  const handleClimbToggle = (level: 'canClimbL1' | 'canClimbL2' | 'canClimbL3') => {
    updateForm({
      noClimbCapability: false,
      [level]: !form[level]
    } as Partial<PitScoutingV2>);
  };

  const handleBallFieldChange = (field: BallField, rawValue: string) => {
    const value = parseNonNegativeInteger(rawValue);
    const fieldUpdates: Record<BallField, Partial<PitScoutingV2>> = {
      match: { expectedHubBallsPerMatch: value },
      auto: { expectedAutoBalls: value },
      teleop: { expectedTeleopBalls: value }
    };
    setForm(prev => ({
      ...prev,
      ...fieldUpdates[field]
    }));
    setBallFieldHistory(prev => [...prev.filter(entry => entry !== field), field].slice(-2));
  };

  const buildPersistedPitData = () => {
    const normalizedChassisSpeed = normalizePitChassisSpeed(
      form.chassisSpeed,
      form.chassisSpeedDistanceUnit,
      form.chassisSpeedTimeUnit
    );

    return {
      ...form,
      teamNumber: form.teamNumber.trim(),
      teamName: form.teamName.trim(),
      scoutName: archiveUsername.trim(),
      customTurretCount: form.turretCount === 'More' ? form.customTurretCount.trim() : '',
      noClimbCapability: form.noClimbCapability,
      canClimbL1: form.noClimbCapability ? false : form.canClimbL1,
      canClimbL2: form.noClimbCapability ? false : form.canClimbL2,
      canClimbL3: form.noClimbCapability ? false : form.canClimbL3,
      chassisSpeed: normalizedChassisSpeed.chassisSpeed,
      chassisSpeedDistanceUnit: normalizedChassisSpeed.chassisSpeedDistanceUnit,
      chassisSpeedTimeUnit: normalizedChassisSpeed.chassisSpeedTimeUnit,
      deviceId: getPersistentDeviceId(),
      timestamp: Date.now(),
      adminTask: buildScoutEvidenceAdminTask(activeTaskHandoff)
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!archiveUsername) {
      setError('Please set a scout username for this device first.');
      return;
    }

    const persistedData = buildPersistedPitData();
    const trimmedTeamNumber = persistedData.teamNumber;
    const trimmedTeamName = persistedData.teamName;
    const trimmedScoutName = persistedData.scoutName;
    if (!trimmedTeamNumber) {
      setError('Team number is required.');
      return;
    }
    if (!trimmedTeamName) {
      setError('Team Name is required.');
      return;
    }
    if (!trimmedScoutName) {
      setError('Scout Name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const archiveRecord = await upsertPitArchiveRecord(eventKey, persistedData, archiveUsername, 'local_submit', {
        syncStatus: 'pending_sync',
        lastFirebaseAttemptAt: Date.now(),
        lastFirebaseError: ''
      });
      if (activeTaskHandoff) {
        setCompletedAdminTaskKey(taskHandoffKey);
        clearScoutTaskHandoff('pitScout');
      }
      await deleteScoutDraft(activeDraftKey);
      skipNextDraftSaveRef.current = true;

      let syncMessage = `Successfully saved pit data for Team ${trimmedTeamNumber}`;
      let syncFailed = false;

      try {
        const writeResult = await writePitScoutingRecord(eventKey, persistedData, {
          mode: isEditing && (!!editingTeamNumber || !!trimmedTeamNumber) ? 'replace' : 'strict'
        });

        if (writeResult.outcome === 'conflict') {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: 'Conflicting pit record already exists in Firebase.'
          });
          syncMessage = `Saved locally for Team ${trimmedTeamNumber}. Firebase reported a conflict, so this pit is unsynced in My History.`;
          syncFailed = true;
        } else {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'synced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: ''
          });
        }
      } catch (syncError) {
        console.error('Error syncing pit data to Firebase:', syncError);
        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'unsynced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: syncError instanceof Error ? syncError.message : 'Firebase sync failed.'
        });
        syncMessage = `Saved locally for Team ${trimmedTeamNumber}. Firebase sync failed, so this pit is unsynced in My History.`;
        syncFailed = true;
      }

      if (syncFailed) {
        setError(syncMessage);
      } else {
        setSuccessMessage(syncMessage);
      }

      if (isEditing) {
        window.setTimeout(() => navigate('/history'), 1200);
        return;
      }

      setForm(createInitialPitForm());
      setBallFieldHistory([]);
      window.setTimeout(() => setSuccessMessage(''), 3000);
    } catch (submitError) {
      console.error('Error saving pit data:', submitError);
      setError('Failed to save pit data. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const expectedSplitTotal = form.expectedAutoBalls + form.expectedTeleopBalls;
  const hasExpectedSplit = form.expectedAutoBalls > 0 || form.expectedTeleopBalls > 0;
  const hasScoringClaimMismatch =
    form.expectedHubBallsPerMatch > 0 &&
    hasExpectedSplit &&
    form.expectedHubBallsPerMatch !== expectedSplitTotal;
  const reconcileExpectedScoringTotal = () => {
    updateForm({ expectedHubBallsPerMatch: expectedSplitTotal });
    setBallFieldHistory(prev => {
      const nextHistory: BallField[] = [...prev.filter(entry => entry !== 'match'), 'match'];
      return nextHistory.slice(-2);
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {isArchiveUsernameResolved && !archiveUsername && (
          <ScoutUsernameGate
            pendingUsername={pendingArchiveUsername}
            setPendingUsername={setPendingArchiveUsername}
            onSave={() => void handleArchiveUsernameSave()}
          />
        )}

        <ScoutWorkflowHeader
          missionKey="pitScout"
          title={isEditing ? 'Edit Pit Scout' : 'Pit Scout'}
          subtitle="Interview the team for capability priors, compatibility notes, and the questions match scouts should verify."
          handoff={activeTaskHandoff}
          onBack={() => navigate(getScoutTaskReturnPath(activeTaskHandoff ?? taskHandoff))}
          metric={(
            <div className="admin-g2-sm border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-right">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-200">{eventKey}</div>
              <div className="mt-1 text-[11px] font-black uppercase tracking-widest text-emerald-100/60">
                {isEditing ? 'History Edit' : 'Admin Controlled'}
              </div>
            </div>
          )}
        />

        <ScoutingMissionPanel missionKey="pitScout" compact />

        {error && (
          <div className="admin-g2-sm border border-red-500 bg-red-900/50 p-3 text-sm font-medium text-red-200">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="admin-g2-sm flex items-center gap-2 border border-emerald-500 bg-emerald-900/50 p-3 text-sm font-medium text-emerald-200">
            <Check className="w-4 h-4" /> {successMessage}
          </div>
        )}

        <PitStepNav activeStep={activeStep} form={form} onChange={handleStepChange} />
        {(activeStep !== 'identity' || form.teamNumber.trim() || form.teamName.trim()) && (
          <PitPriorStrip form={form} />
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div ref={activeStepRef} className="scroll-mt-4">
          {activeStep === 'identity' && (
            <PitStepFrame step="identity">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className={labelClass}>Team Number</label>
                  <input
                    type="number"
                    value={form.teamNumber}
                    onChange={(e) => updateForm({ teamNumber: e.target.value })}
                    disabled={isEditing}
                    className={`${inputClass} font-mono text-xl ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="e.g. 254"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Team Name</label>
                  <input
                    type="text"
                    value={form.teamName}
                    onChange={(e) => updateForm({ teamName: e.target.value })}
                    className={inputClass}
                    placeholder="Required"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Scout Name</label>
                  <input
                    type="text"
                    value={archiveUsername || form.scoutName}
                    readOnly
                    className={inputClass}
                    placeholder="Locked to this device identity"
                    required
                  />
                </div>
              </div>
              <div className="admin-g2-sm mt-4 border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                This anchors every pit claim to team profile, pick list, match prep, and public-only context.
              </div>
              <div className="mt-5">
                <PitStepFooter activeStep={activeStep} onChange={handleStepChange} />
              </div>
            </PitStepFrame>
          )}

          {activeStep === 'build' && (
            <PitStepFrame step="build">
              <div className="space-y-5">

            <div className="space-y-2">
              <label className={labelClass}>Robot Base Type</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['WCP', 'KitBot', 'Custom'] as const).map(option => (
                  <ChoiceButton
                    key={option}
                    active={form.robotBaseType === option}
                    label={option}
                    onClick={() => handleBaseTypeSelect(option)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-1">
                <label className={labelClass}>Chassis Speed</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.chassisSpeed || ''}
                  onChange={(e) => updateForm({ chassisSpeed: Number(e.target.value) || 0 })}
                  className={`${inputClass} font-mono`}
                  placeholder="e.g. 4.5"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className={labelClass}>Speed Units</label>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(['meters', 'feet', 'miles', 'kilometers', 'yards'] as const).map(option => (
                      <ChoiceButton
                        key={option}
                        active={form.chassisSpeedDistanceUnit === option}
                        label={option}
                        onClick={() => updateForm({ chassisSpeedDistanceUnit: option })}
                        tone="blue"
                      />
                    ))}
                  </div>
                  <div className="text-center text-slate-500 font-black uppercase tracking-widest text-sm">per</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['seconds', 'minutes', 'hours'] as const).map(option => (
                      <ChoiceButton
                        key={option}
                        active={form.chassisSpeedTimeUnit === option}
                        label={option}
                        onClick={() => updateForm({ chassisSpeedTimeUnit: option })}
                        tone="blue"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Field Traversal</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ChoiceButton
                  active={form.canCrossTrench}
                  label="Can Pass Trench"
                  onClick={() => handleTraversalSelect('trench')}
                  tone="blue"
                />
                <ChoiceButton
                  active={form.isBumpOnly}
                  label="Bump Robot Only"
                  onClick={() => handleTraversalSelect('bump')}
                  tone="blue"
                />
              </div>
            </div>
              </div>
              <div className="mt-5">
                <PitStepFooter activeStep={activeStep} onChange={handleStepChange} />
              </div>
            </PitStepFrame>
          )}

          {activeStep === 'scoring' && (
            <PitStepFrame step="scoring">
              <div className="space-y-5">

            <div className="space-y-2">
              <label className={labelClass}>Shooter Count</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['1', '2', '3', 'More'] as const).map(option => (
                  <ChoiceButton
                    key={option}
                    active={form.turretCount === option}
                    label={option}
                    onClick={() => updateForm({ turretCount: option })}
                    tone="amber"
                  />
                ))}
              </div>
              {form.turretCount === 'More' && (
                <input
                  type="text"
                  value={form.customTurretCount}
                  onChange={(e) => updateForm({ customTurretCount: e.target.value })}
                  className={`${inputClass} focus:border-amber-400`}
                  placeholder="Describe the shooter setup"
                />
              )}
            </div>

            {hasScoringClaimMismatch && (
              <div className="admin-g2-sm border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
                <div className="font-black text-amber-50">Claim mismatch: total does not equal auto plus teleop.</div>
                <div className="mt-1">
                  Keep it if the team gave an uncertain estimate, or explicitly set total to {expectedSplitTotal}.
                </div>
                <button
                  type="button"
                  onClick={reconcileExpectedScoringTotal}
                  className="admin-g2-sm mt-3 border border-amber-300/30 bg-amber-400/15 px-3 py-2 text-xs font-black text-amber-50 hover:bg-amber-400/25"
                >
                  Set total to auto + teleop
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Hopper</label>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton
                    active={form.canUseHopper}
                    label="Has Hopper"
                    onClick={() => updateForm({ canUseHopper: true })}
                    tone="amber"
                  />
                  <ChoiceButton
                    active={!form.canUseHopper}
                    label="No Hopper"
                    onClick={() => updateForm({ canUseHopper: false, hopperCapacity: 0 })}
                    tone="amber"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Hopper Capacity</label>
                <input
                  type="number"
                  min="0"
                  value={form.hopperCapacity || ''}
                  onChange={(e) => updateForm({ hopperCapacity: Number(e.target.value) || 0 })}
                  className={`${inputClass} font-mono focus:border-amber-400`}
                  placeholder="Balls in hopper"
                  disabled={!form.canUseHopper}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Expected Balls / Match</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(form.expectedHubBallsPerMatch)}
                  onChange={(e) => handleBallFieldChange('match', e.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="Total"
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Expected Auto Balls</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(form.expectedAutoBalls)}
                  onChange={(e) => handleBallFieldChange('auto', e.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="Auto"
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Expected Teleop Balls</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={String(form.expectedTeleopBalls)}
                  onChange={(e) => handleBallFieldChange('teleop', e.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="Teleop"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Balls Per Second</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.ballsPerSecond || ''}
                  onChange={(e) => updateForm({ ballsPerSecond: Number(e.target.value) || 0 })}
                  className={`${inputClass} font-mono`}
                  placeholder="e.g. 2.5"
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Number of flywheels per shooter</label>
                <input
                  type="number"
                  min="0"
                  value={form.shootingFlywheelCount || ''}
                  onChange={(e) => updateForm({ shootingFlywheelCount: Number(e.target.value) || 0 })}
                  className={`${inputClass} font-mono`}
                  placeholder="e.g. 2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={labelClass}>Shooting Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['On the Fly', 'Fixed Point'] as const).map(option => (
                    <ChoiceButton
                      key={option}
                      active={form.shootingStyle === option}
                      label={option}
                      onClick={() => updateForm({ shootingStyle: option })}
                      tone="purple"
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Adjustable Hood (firing angle)</label>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton
                    active={form.hoodAdjustable}
                    label="Yes"
                    onClick={() => updateForm({ hoodAdjustable: true })}
                    tone="purple"
                  />
                  <ChoiceButton
                    active={!form.hoodAdjustable}
                    label="No"
                    onClick={() => updateForm({ hoodAdjustable: false })}
                    tone="purple"
                  />
                </div>
              </div>
            </div>
              </div>
              <div className="mt-5">
                <PitStepFooter activeStep={activeStep} onChange={handleStepChange} />
              </div>
            </PitStepFrame>
          )}

          {activeStep === 'endgame' && (
            <PitStepFrame step="endgame">
            <div className="space-y-4">
              <div className="admin-g2-sm border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm font-semibold text-slate-300">
                This is a claimed capability prior. Match Scout confirms reliability later under time pressure, defense, and field traffic.
              </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ChoiceButton
                active={form.noClimbCapability}
                label="None"
                onClick={handleNoClimbToggle}
                tone="rose"
              />
              <ChoiceButton
                active={form.canClimbL1}
                label="L1"
                onClick={() => handleClimbToggle('canClimbL1')}
                disabled={form.noClimbCapability}
              />
              <ChoiceButton
                active={form.canClimbL2}
                label="L2"
                onClick={() => handleClimbToggle('canClimbL2')}
                disabled={form.noClimbCapability}
              />
              <ChoiceButton
                active={form.canClimbL3}
                label="L3"
                onClick={() => handleClimbToggle('canClimbL3')}
                disabled={form.noClimbCapability}
              />
            </div>
            </div>
            <div className="mt-5">
              <PitStepFooter activeStep={activeStep} onChange={handleStepChange} />
            </div>
            </PitStepFrame>
          )}

          {activeStep === 'handoff' && (
            <PitStepFrame step="handoff">
              <ScoutSignalHandoff missionKey="pitScout" />
              <div className="mt-5 space-y-3">
                <div>
                  <h3 className="text-lg font-black text-white">Verification Notes</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-400">Write what strategy should remember and what match scouts should confirm later.</p>
                </div>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm({ notes: e.target.value })}
                  className={`${inputClass} min-h-28`}
                  placeholder="Examples: needs protected path, climb only works if lined up early, shooter needs warmup, ask match scouts to watch intake jams."
                />
              </div>

              <div className="admin-g2 mt-5 grid grid-cols-4 gap-4 border border-slate-800 bg-slate-950/45 p-4">
                <button
                  type="button"
                  onClick={() => setShowQr(true)}
                  className="admin-g2-sm col-span-1 flex items-center justify-center border border-slate-700 bg-slate-950 py-4 font-black text-slate-100 transition-colors hover:bg-slate-900 active:scale-95"
                >
                  <QrCode className="w-8 h-8" />
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="admin-g2-sm col-span-3 flex items-center justify-center gap-2 border border-emerald-400/40 bg-emerald-500/15 py-4 text-lg font-black text-emerald-50 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'SAVING...' : isEditing ? 'UPDATE PIT DATA' : 'SAVE PIT DATA'}
                  {!isSubmitting && <Save className="w-5 h-5" />}
                </button>
              </div>

              <div className="mt-5">
                <PitStepFooter activeStep={activeStep} onChange={handleStepChange} />
              </div>
            </PitStepFrame>
          )}
          </div>
        </form>
      </div>

      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
          <div className="admin-g2-lg relative flex w-full max-w-sm flex-col items-center bg-white p-8">
            <button
              onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-slate-900 mb-4">Offline Pit QR Export</h3>
            <p className="text-center text-sm text-slate-600 mb-6">
              Scan this code in Admin V4 Data when internet is unavailable.
            </p>
            <div className="admin-g2-sm bg-white p-4 shadow-lg">
              <QRCodeSVG
                value={compressPitData({
                  eventKey,
                  data: buildPersistedPitData()
                })}
                size={280}
                level="L"
                includeMargin
              />
            </div>
            <div className="mt-5 text-center text-xs font-mono text-slate-500 break-all">
              Team {form.teamNumber || 'TBD'} / {form.scoutName || 'Scout name missing'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
