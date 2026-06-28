import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteDoc, doc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../firebase';
import { MatchDefenseScoutingV1, initialMatchDefenseScoutingV1 } from '../types';
import { DEFAULT_EVENT_KEY, getPersistentDeviceId } from '../utils/sharedEventState';
import { MathEngine, TBAMatch } from '../utils/mathEngine';
import { TBA_API_KEY } from '../config';
import { loadTbaApiKey } from '../utils/adminV4LocalStore';
import {
  buildMatchKeyV3
} from '../utils/matchScoutingV3';
import {
  normalizeMatchDefenseScoutingV1
} from '../utils/matchDefenseScouting';
import { compressMatchDefenseData } from '../utils/qrCompression';
import { buildScoutDraftKey, deleteScoutDraft, getScoutDraft, setScoutDraft } from '../utils/scoutDrafts';
import {
  getScoutArchiveUsername,
  setScoutArchiveUsername,
  updateScoutArchiveRecordSyncState,
  upsertMatchDefenseArchiveRecord
} from '../utils/scoutArchive';
import { getMatchDefenseDocId, writeMatchDefenseScoutingRecord } from '../utils/scoutingWrites';
import { SCOUT_ASSIGNMENTS } from '../utils/scoutAssignments';
import ScoutUsernameGate from '../components/ScoutUsernameGate';
import ScoutWorkflowHeader, { ScoutSignalHandoff } from '../components/scouting/ScoutWorkflowHeader';
import ScoutingMissionPanel from '../components/scouting/ScoutingMissionPanel';
import { buildScoutEvidenceAdminTask, clearScoutTaskHandoff, getScoutTaskHandoff, getScoutTaskReturnPath } from '../utils/scoutTaskHandoff';

export const MATCH_DEFENSE_EDIT_STORAGE_KEY = 'edit_match_defense_data_v1';

const MATCH_DEFENSE_EVENT_KEY_STORAGE = 'match_scout_v3_event_key';
const MATCH_DEFENSE_ASSIGNED_SCOUT_STORAGE = 'match_defense_assigned_scout';
const MATCH_DEFENSE_MATCH_TYPE_STORAGE = 'match_defense_match_type';
const MATCH_DEFENSE_MATCH_NUMBER_STORAGE = 'match_defense_match_number';
const MATCH_DEFENSE_TEAM_STORAGE = 'match_defense_team';
const SUBSTITUTE_SCOUTS = ['Charlotte', 'Scarlett'] as const;
const MATCH_TYPES: MatchDefenseScoutingV1['matchType'][] = ['Practice', 'Qualification'];
type DefenseScoutStepKey = 'match' | 'target' | 'impact' | 'evidence' | 'handoff';

const DEFENSE_SCOUT_STEPS: Array<{
  key: DefenseScoutStepKey;
  label: string;
  question: string;
  output: string;
}> = [
  {
    key: 'match',
    label: 'Match',
    question: 'Which match and scout slot is this?',
    output: 'scheduled context'
  },
  {
    key: 'target',
    label: 'Target',
    question: 'Which robot produced the defense?',
    output: 'team and alliance attribution'
  },
  {
    key: 'impact',
    label: 'Impact',
    question: 'How much did the defense deny?',
    output: 'defense metric for role context'
  },
  {
    key: 'evidence',
    label: 'Evidence',
    question: 'What proof explains the number?',
    output: 'denial notes and strategy use'
  },
  {
    key: 'handoff',
    label: 'Handoff',
    question: 'How should strategy use this?',
    output: 'role recommendation, QR, submit'
  }
];

interface MatchDefenseDraftPayload {
  data: MatchDefenseScoutingV1;
}

const sanitizeEventKey = (value: string) => value.toUpperCase().replace(/\s+/g, '');
const getShortMatchKey = (match: TBAMatch) => match.key.split('_')[1]?.toLowerCase() || '';

const getStoredMatchType = (): MatchDefenseScoutingV1['matchType'] => {
  const stored = localStorage.getItem(MATCH_DEFENSE_MATCH_TYPE_STORAGE);
  return stored === 'Practice' ? 'Practice' : 'Qualification';
};

const getStoredMatchNumber = () => {
  const stored = parseInt(localStorage.getItem(MATCH_DEFENSE_MATCH_NUMBER_STORAGE) || '1', 10);
  return Number.isFinite(stored) && stored > 0 ? stored : 1;
};

const getStoredAssignedScout = () => localStorage.getItem(MATCH_DEFENSE_ASSIGNED_SCOUT_STORAGE) || '';
const getStoredTeamNumber = () => localStorage.getItem(MATCH_DEFENSE_TEAM_STORAGE) || '';
const toPositiveInt = (value: string) => {
  const parsed = parseInt(value.replace(/\D/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDefensePercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const inputClass = 'admin-g2-sm w-full border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500';
const labelClass = 'text-xs font-black uppercase tracking-wider text-slate-500';

const getDefenseRoleLabel = (value: number) => {
  if (value >= 0.75) return 'Primary defender';
  if (value >= 0.55) return 'Useful disruptor';
  if (value >= 0.35) return 'Situational pressure';
  return 'Not a defense role';
};

const getDefenseStrategyNote = (value: number) => {
  if (value >= 0.75) return 'Plan around opponent denial; verify foul risk before assigning.';
  if (value >= 0.55) return 'Useful when the match plan needs a targeted slowdown.';
  if (value >= 0.35) return 'Only assign if the offensive opportunity cost is low.';
  return 'Do not let weak scoring be excused as defense without evidence.';
};

const getDefenseModelGuardrail = (value: number) => {
  if (value >= 0.75) return 'Strong role correction';
  if (value >= 0.55) return 'Use as defense prior';
  if (value >= 0.35) return 'Flag as situational defense';
  return 'No role correction yet';
};

function ChoiceButton({
  active,
  label,
  onClick,
  disabled = false
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`admin-g2-sm px-3 py-3 text-sm font-black transition-all ${
        active
          ? 'border border-cyan-400/40 bg-cyan-500/15 text-cyan-50'
          : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
      } ${disabled ? 'cursor-not-allowed opacity-50 hover:bg-slate-950' : ''}`}
    >
      {label}
    </button>
  );
}

const getDefenseStepReadiness = (
  step: DefenseScoutStepKey,
  data: MatchDefenseScoutingV1,
  hasTouchedDefenseMetric = false
) => {
  const commentSignal = [data.defenseComments, data.generalComments].join(' ').trim();
  switch (step) {
    case 'match':
      return Boolean(data.eventKey && data.matchNumber && data.assignedScoutName);
    case 'target':
      return Boolean(data.teamNumber && data.alliance);
    case 'impact':
      return hasTouchedDefenseMetric;
    case 'evidence':
      return commentSignal.length >= 40;
    case 'handoff':
      return Boolean(data.teamNumber && data.alliance && commentSignal.length >= 40);
  }
};

function DefenseStepNav({
  activeStep,
  data,
  hasTouchedDefenseMetric,
  onChange
}: {
  activeStep: DefenseScoutStepKey;
  data: MatchDefenseScoutingV1;
  hasTouchedDefenseMetric: boolean;
  onChange: (step: DefenseScoutStepKey) => void;
}) {
  return (
    <nav className="admin-g2 border border-slate-800 bg-slate-900/70 p-3">
      <div className="grid auto-cols-[minmax(180px,1fr)] grid-flow-col gap-2 overflow-x-auto pb-1 lg:grid-flow-row lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        {DEFENSE_SCOUT_STEPS.map((step, index) => {
          const isActive = activeStep === step.key;
          const ready = getDefenseStepReadiness(step.key, data, hasTouchedDefenseMetric);
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onChange(step.key)}
              className={`admin-g2-sm border p-3 text-left transition ${
                isActive
                  ? 'border-rose-300 bg-rose-400/15 text-rose-50 ring-1 ring-rose-300/40'
                  : 'border-slate-800 bg-slate-950/65 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{index + 1}</span>
                {ready ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-rose-300' : 'bg-slate-700'}`} />}
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

function DefenseStepFrame({
  step,
  children
}: {
  step: DefenseScoutStepKey;
  children: React.ReactNode;
}) {
  const currentStep = DEFENSE_SCOUT_STEPS.find(item => item.key === step) || DEFENSE_SCOUT_STEPS[0]!;
  return (
    <section className="admin-g2 border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{currentStep.label}</div>
          <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">{currentStep.question}</h2>
        </div>
        <div className="admin-g2-sm hidden border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-50 sm:block">
          Creates: {currentStep.output}
        </div>
      </div>
      {children}
    </section>
  );
}

function DefenseStepFooter({
  activeStep,
  onChange
}: {
  activeStep: DefenseScoutStepKey;
  onChange: (step: DefenseScoutStepKey) => void;
}) {
  const activeIndex = DEFENSE_SCOUT_STEPS.findIndex(step => step.key === activeStep);
  const previousStep = DEFENSE_SCOUT_STEPS[activeIndex - 1];
  const nextStep = DEFENSE_SCOUT_STEPS[activeIndex + 1];

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
          className="admin-g2-sm inline-flex items-center gap-2 bg-rose-400 px-5 py-3 text-sm font-black text-slate-950 hover:bg-rose-300"
        >
          Next: {nextStep.label}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function DefenseMetricSlider({
  value,
  onChange
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 p-4">
      <div className="mb-2 flex items-center justify-between">
        <label className={labelClass}>Defense Metric</label>
        <span className="font-mono text-sm font-black text-emerald-300">{formatDefensePercent(value)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="0.01"
        value={(value * 100).toFixed(2)}
        onChange={event => onChange(Number((parseFloat(event.target.value) / 100).toFixed(4)))}
        className="w-full accent-emerald-500"
      />
      <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <span>0%</span>
        <span>100%</span>
      </div>
      <div className="mt-2 text-xs text-slate-500">Stored as a 0–1 float with 0.0001 precision.</div>
    </div>
  );
}

function DefenseImpactStrip({ data }: { data: MatchDefenseScoutingV1 }) {
  const roleLabel = getDefenseRoleLabel(data.defenseMetric);
  const strategyNote = getDefenseStrategyNote(data.defenseMetric);
  const commentSignal = [data.defenseComments, data.generalComments].join(' ').trim();
  const hasTargetTeam = Boolean(data.teamNumber.trim());
  const hasDeniedAction = /(deny|denied|slow|slowed|block|blocked|stop|stopped|cycle|cycles|score|scoring|reef|coral|algae|station|route)/i.test(commentSignal);
  const hasRiskNote = /(foul|fouls|penalty|pin|card|traffic|risk|contact|danger|avoid|safe)/i.test(commentSignal);
  const evidenceLabel = commentSignal.length >= 120
    ? 'Strong notes'
    : commentSignal.length >= 40
      ? 'Usable notes'
      : 'Needs evidence';
  const proofChecklist = [
    hasTargetTeam ? `Team ${data.teamNumber}` : 'team pending',
    hasDeniedAction ? 'denial named' : 'denial missing',
    hasRiskNote ? 'risk named' : 'risk missing'
  ].join(' / ');
  const cards = [
    {
      label: 'Denied Output',
      value: formatDefensePercent(data.defenseMetric),
      detail: 'Observable scoring or cycle suppression, not a vague excuse for low offense.'
    },
    {
      label: 'Role Guard',
      value: getDefenseModelGuardrail(data.defenseMetric),
      detail: 'Protects the model from punishing a robot whose job was targeted defense.'
    },
    {
      label: 'Role Read',
      value: roleLabel,
      detail: strategyNote
    },
    {
      label: 'Admin Uses',
      value: hasTargetTeam ? `${data.alliance || 'Alliance'} ${data.teamNumber}` : 'Target pending',
      detail: 'Feeds match plans, Pick List role fit, and opponent risk notes.'
    },
    {
      label: 'Proof Status',
      value: evidenceLabel,
      detail: proofChecklist
    }
  ];

  return (
    <section className="admin-g2 border border-rose-400/25 bg-rose-500/10 p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-rose-200">Defense Evidence Map</div>
          <h2 className="mt-1 text-xl font-black text-white">Separate real denial from low scoring</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold text-rose-50/75">
            This row becomes a role correction for Admin V4: it can raise trust in a defender, lower risk in future-match plans, and stop the model from treating defensive sacrifice as bad scoring.
          </p>
        </div>
        <div className="text-sm font-semibold text-rose-50/75">
          {data.matchKey.toUpperCase()} · {data.alliance || 'alliance pending'} · {roleLabel}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cards.map(card => (
          <div key={card.label} className="admin-g2-sm border border-rose-200/10 bg-slate-950/55 px-3 py-3">
            <div className="text-xs font-black uppercase tracking-wider text-rose-100">{card.label}</div>
            <div className="mt-2 text-lg font-black text-white">{card.value}</div>
            <div className="mt-2 text-xs font-semibold text-slate-300">{card.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function MatchDefenseScoutView() {
  const navigate = useNavigate();
  const location = useLocation();
  const taskHandoff = useMemo(() => getScoutTaskHandoff('defenseScout', location.search), [location.search]);
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
  const storedEventKey = sanitizeEventKey(activeTaskHandoff?.eventKey || localStorage.getItem(MATCH_DEFENSE_EVENT_KEY_STORAGE) || DEFAULT_EVENT_KEY);
  const storedAssignedScout = getStoredAssignedScout();
  const storedMatchType = activeTaskHandoff?.matchType || getStoredMatchType();
  const storedMatchNumber = activeTaskHandoff?.matchNumber || getStoredMatchNumber();
  const storedTeamNumber = activeTaskHandoff?.teamNumber || getStoredTeamNumber();
  const persistentDeviceId = useMemo(() => getPersistentDeviceId(), []);
  const storedAssignment = useMemo(
    () => SCOUT_ASSIGNMENTS.find(assignment => assignment.name === storedAssignedScout) || null,
    [storedAssignedScout]
  );

  const [data, setData] = useState<MatchDefenseScoutingV1>(() =>
    normalizeMatchDefenseScoutingV1({
      ...initialMatchDefenseScoutingV1,
      eventKey: storedEventKey,
      matchType: storedMatchType,
      matchNumber: storedMatchNumber,
      matchKey: buildMatchKeyV3(storedMatchType, storedMatchNumber),
      teamNumber: storedTeamNumber,
      scoutName: storedAssignedScout,
      assignedScoutName: storedAssignedScout,
      assignedSlot: storedAssignment?.slotLabel || '',
      alliance: activeTaskHandoff?.alliance || storedAssignment?.alliance || '',
      deviceId: persistentDeviceId
    })
  );
  const [isEditing, setIsEditing] = useState(false);
  const [originalDocId, setOriginalDocId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [bootResolved, setBootResolved] = useState(false);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [archiveUsername, setArchiveUsernameState] = useState('');
  const [pendingArchiveUsername, setPendingArchiveUsername] = useState('');
  const [isArchiveUsernameResolved, setIsArchiveUsernameResolved] = useState(false);
  const [eventMatches, setEventMatches] = useState<TBAMatch[]>([]);
  const [scheduledTeams, setScheduledTeams] = useState<string[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [assignmentWarning, setAssignmentWarning] = useState('');
  const [teamWarning, setTeamWarning] = useState('');
  const [activeStep, setActiveStep] = useState<DefenseScoutStepKey>('match');
  const [hasUsedStepNav, setHasUsedStepNav] = useState(false);
  const [hasTouchedDefenseMetric, setHasTouchedDefenseMetric] = useState(false);
  const activeStepRef = useRef<HTMLDivElement | null>(null);
  const skipNextDraftSaveRef = useRef(false);
  const shouldShowDefenseMap =
    activeStep !== 'match' ||
    Boolean(
      data.teamNumber.trim() ||
      data.defenseComments.trim() ||
      data.generalComments.trim() ||
      hasTouchedDefenseMetric
    );

  const selectedAssignment = useMemo(
    () => SCOUT_ASSIGNMENTS.find(assignment => assignment.name === data.assignedScoutName) || null,
    [data.assignedScoutName]
  );

  const activeDraftKey = useMemo(() => {
    if (!bootResolved) return '';
    if (isEditing) {
      return buildScoutDraftKey('matchDefense', 'edit', `${data.eventKey}:${originalDocId || getMatchDefenseDocId(data)}`);
    }
    return buildScoutDraftKey('matchDefense', 'new', data.eventKey);
  }, [bootResolved, data, isEditing, originalDocId]);

  const updateData = (updates: Partial<MatchDefenseScoutingV1>) => {
    setData(prev => normalizeMatchDefenseScoutingV1({ ...prev, ...updates }));
  };

  const handleStepChange = (step: DefenseScoutStepKey) => {
    setHasUsedStepNav(true);
    setActiveStep(step);
  };

  useEffect(() => {
    if (!bootResolved || !isDraftHydrated || !activeTaskHandoff || isEditing) return;
    setActiveStep('match');
    updateData({
      eventKey: activeTaskHandoff.eventKey || data.eventKey,
      matchType: activeTaskHandoff.matchType || data.matchType,
      matchNumber: activeTaskHandoff.matchNumber || data.matchNumber,
      teamNumber: activeTaskHandoff.teamNumber || data.teamNumber,
      alliance: activeTaskHandoff.alliance || data.alliance
    });
    setNotification({
      type: 'success',
      message: `Admin task loaded: ${activeTaskHandoff.reason || 'collect defense read'} for Team ${activeTaskHandoff.teamNumber}.`
    });
  }, [activeTaskHandoff, bootResolved, isDraftHydrated, isEditing, taskHandoffKey]);

  useEffect(() => {
    if (!hasUsedStepNav) return;
    window.setTimeout(() => {
      activeStepRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 0);
  }, [activeStep, hasUsedStepNav]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    window.setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateArchiveUsername = async () => {
      try {
        const storedUsername = await getScoutArchiveUsername();
        if (cancelled) return;
        setArchiveUsernameState(storedUsername || '');
        setPendingArchiveUsername(storedUsername || '');
      } catch (error) {
        console.error('Failed to hydrate scout username', error);
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
      showNotification('Please enter a scout username for this device.', 'error');
      return;
    }

    try {
      await setScoutArchiveUsername(normalized);
      setArchiveUsernameState(normalized);
      setPendingArchiveUsername(normalized);
    } catch (error) {
      console.error('Failed to save scout username', error);
      showNotification('Unable to save the scout username on this device.', 'error');
    }
  };

  useEffect(() => {
    const editPayload = localStorage.getItem(MATCH_DEFENSE_EDIT_STORAGE_KEY);
    if (!editPayload) {
      setBootResolved(true);
      return;
    }

    try {
      const parsed = JSON.parse(editPayload) as MatchDefenseScoutingV1;
      const nextData = normalizeMatchDefenseScoutingV1({ ...parsed, deviceId: parsed.deviceId || persistentDeviceId });
      setData(nextData);
      setHasTouchedDefenseMetric(true);
      setIsEditing(true);
      setOriginalDocId(getMatchDefenseDocId(nextData));
    } catch (error) {
      console.error('Failed to parse defense edit payload', error);
    } finally {
      localStorage.removeItem(MATCH_DEFENSE_EDIT_STORAGE_KEY);
      setBootResolved(true);
    }
  }, [persistentDeviceId]);

  useEffect(() => {
    if (!bootResolved || !activeDraftKey) return;

    let cancelled = false;

    const hydrateDraft = async () => {
      try {
        const draft = await getScoutDraft<MatchDefenseDraftPayload>(activeDraftKey);
        if (cancelled || !draft) return;
        const nextData = normalizeMatchDefenseScoutingV1(draft.data.data);
        setData(nextData);
        setHasTouchedDefenseMetric(
          nextData.defenseMetric !== initialMatchDefenseScoutingV1.defenseMetric ||
            Boolean(nextData.defenseComments.trim() || nextData.generalComments.trim())
        );
      } catch (error) {
        console.error('Failed to hydrate defense draft', error);
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
  }, [activeDraftKey, bootResolved]);

  useEffect(() => {
    if (!bootResolved || !isDraftHydrated || !activeDraftKey) return;
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void setScoutDraft<MatchDefenseDraftPayload>(
        activeDraftKey,
        'matchDefense',
        isEditing ? 'edit' : 'new',
        isEditing ? `${data.eventKey}:${originalDocId || getMatchDefenseDocId(data)}` : data.eventKey,
        { data }
      );
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [activeDraftKey, bootResolved, data, isDraftHydrated, isEditing, originalDocId]);

  useEffect(() => {
    if (isEditing) return;
    localStorage.setItem(MATCH_DEFENSE_EVENT_KEY_STORAGE, data.eventKey);
    localStorage.setItem(MATCH_DEFENSE_ASSIGNED_SCOUT_STORAGE, data.assignedScoutName);
    localStorage.setItem(MATCH_DEFENSE_MATCH_TYPE_STORAGE, data.matchType);
    localStorage.setItem(MATCH_DEFENSE_MATCH_NUMBER_STORAGE, String(data.matchNumber));
    localStorage.setItem(MATCH_DEFENSE_TEAM_STORAGE, data.teamNumber);
  }, [data.assignedScoutName, data.eventKey, data.matchNumber, data.matchType, data.teamNumber, isEditing]);

  useEffect(() => {
    const fetchMatches = async () => {
      if (data.eventKey === 'TEST') {
        setEventMatches([]);
        setScheduledTeams([]);
        setAssignmentWarning('');
        return;
      }

      const cacheKey = `match_schedule_${sanitizeEventKey(data.eventKey)}`;
      const cachedMatches = localStorage.getItem(cacheKey);
      if (cachedMatches) {
        try {
          const parsed = JSON.parse(cachedMatches) as TBAMatch[];
          setEventMatches(parsed);
          const teams = new Set<string>();
          parsed.forEach(match => {
            match.alliances.red.team_keys.forEach(teamKey => teams.add(teamKey.replace('frc', '')));
            match.alliances.blue.team_keys.forEach(teamKey => teams.add(teamKey.replace('frc', '')));
          });
          setScheduledTeams(Array.from(teams));
        } catch (error) {
          console.error('Failed to parse cached schedule', error);
        }
      }

      const localTbaApiKey = await loadTbaApiKey().catch(() => null);
      const effectiveTbaApiKey = localTbaApiKey || TBA_API_KEY;
      if (!effectiveTbaApiKey) {
        setAssignmentWarning(
          cachedMatches
            ? 'Using cached schedule. Upload a local TBA key in Admin V4 Settings to refresh live auto-fill.'
            : 'Schedule auto-fill needs a TBA key. Upload the local API key JSON in Admin V4 Settings, or enter team/alliance manually.'
        );
        return;
      }

      setIsLoadingSchedule(true);
      try {
        const engine = new MathEngine(effectiveTbaApiKey);
        const matches = await engine.fetchEventMatches(data.eventKey, { includeUnplayed: true });
        setEventMatches(matches);
        localStorage.setItem(cacheKey, JSON.stringify(matches));

        const teams = new Set<string>();
        matches.forEach(match => {
          match.alliances.red.team_keys.forEach(teamKey => teams.add(teamKey.replace('frc', '')));
          match.alliances.blue.team_keys.forEach(teamKey => teams.add(teamKey.replace('frc', '')));
        });
        setScheduledTeams(Array.from(teams));
      } catch (error) {
        console.error('Failed to fetch event matches for assignment', error);
        setAssignmentWarning('Unable to load the live schedule. Team number and alliance can still be entered manually.');
      } finally {
        setIsLoadingSchedule(false);
      }
    };

    void fetchMatches();
  }, [data.eventKey]);

  useEffect(() => {
    if (isEditing) return;

    const generatedMatchKey = buildMatchKeyV3(data.matchType, data.matchNumber);
    const assignment = selectedAssignment;

    setData(prev => ({
      ...prev,
      matchKey: generatedMatchKey
    }));

    if (!assignment) {
      setAssignmentWarning('');
      setData(prev =>
        normalizeMatchDefenseScoutingV1({
          ...prev,
          assignedSlot: '',
          alliance: '',
          scoutName: prev.substituteScoutName || prev.assignedScoutName
        })
      );
      return;
    }

    const scheduledMatch = eventMatches.find(match => getShortMatchKey(match) === generatedMatchKey.toLowerCase());
    const allianceTeamKeys =
      assignment.alliance === 'Red'
        ? scheduledMatch?.alliances.red.team_keys || []
        : scheduledMatch?.alliances.blue.team_keys || [];
    const assignedTeamKey = allianceTeamKeys[assignment.positionIndex] || '';
    const assignedTeamNumber = assignedTeamKey.replace('frc', '');

    setData(prev =>
      normalizeMatchDefenseScoutingV1({
        ...prev,
        matchKey: generatedMatchKey,
        assignedSlot: assignment.slotLabel,
        scoutName: prev.substituteScoutName || assignment.name,
        alliance: assignment.alliance,
        teamNumber: assignedTeamNumber || prev.teamNumber
      })
    );

    if (!scheduledMatch) {
      setAssignmentWarning(`No scheduled ${generatedMatchKey.toUpperCase()} was found for ${data.eventKey}. Team number remains editable.`);
      return;
    }

    if (!assignedTeamNumber) {
      setAssignmentWarning(`No team is published yet for ${assignment.slotLabel} in ${generatedMatchKey.toUpperCase()}. Team number remains editable.`);
      return;
    }

    setAssignmentWarning('');
  }, [data.eventKey, data.matchNumber, data.matchType, eventMatches, isEditing, selectedAssignment]);

  useEffect(() => {
    if (data.eventKey === 'TEST' || scheduledTeams.length === 0 || !data.teamNumber) {
      setTeamWarning('');
      return;
    }

    if (!scheduledTeams.includes(data.teamNumber)) {
      setTeamWarning(`Warning: Team ${data.teamNumber} is not currently listed in the ${data.eventKey} schedule.`);
      return;
    }

    setTeamWarning('');
  }, [data.eventKey, data.teamNumber, scheduledTeams]);

  const updateMatchIdentity = (
    updates: Partial<Pick<MatchDefenseScoutingV1, 'eventKey' | 'matchType' | 'matchNumber' | 'teamNumber' | 'alliance'>>
  ) => {
    const next = normalizeMatchDefenseScoutingV1({
      ...data,
      ...updates,
      matchKey: buildMatchKeyV3(updates.matchType || data.matchType, updates.matchNumber || data.matchNumber)
    });
    setData(next);
  };

  const handleAssignedScoutChange = (assignedScoutName: string) => {
    const assignment = SCOUT_ASSIGNMENTS.find(option => option.name === assignedScoutName);
    updateData({
      assignedScoutName,
      assignedSlot: assignment?.slotLabel || '',
      scoutName: data.substituteScoutName || assignedScoutName,
      substituteScoutName: data.substituteScoutName || '',
      alliance: assignment?.alliance || ''
    });
  };

  const handleSubstituteSelect = (substituteName: (typeof SUBSTITUTE_SCOUTS)[number]) => {
    if (!data.assignedScoutName) return;

    if (data.substituteScoutName === substituteName) {
      updateData({
        substituteScoutName: '',
        scoutName: data.assignedScoutName
      });
      return;
    }

    updateData({
      substituteScoutName: substituteName,
      scoutName: substituteName
    });
  };

  const handleSubmit = async () => {
    if (!archiveUsername) {
      showNotification('Please set a scout username for this device first.', 'error');
      return;
    }
    if (!data.assignedScoutName) {
      showNotification('Please select the assigned scout.', 'error');
      return;
    }
    if (!data.eventKey.trim()) {
      showNotification('Please enter an event key.', 'error');
      return;
    }
    if (!data.teamNumber.trim()) {
      showNotification('Please enter a team number.', 'error');
      return;
    }
    if (!data.alliance) {
      showNotification('Please select the alliance color.', 'error');
      return;
    }
    if (data.eventKey !== 'TEST' && scheduledTeams.length > 0 && !scheduledTeams.includes(data.teamNumber)) {
      showNotification(`Team ${data.teamNumber} is not scheduled for this event. Please verify the team number.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = normalizeMatchDefenseScoutingV1({
        ...data,
        scoutName: data.substituteScoutName || data.assignedScoutName,
        deviceId: data.deviceId || persistentDeviceId,
        timestamp: Date.now(),
        matchKey: buildMatchKeyV3(data.matchType, data.matchNumber),
        adminTask: buildScoutEvidenceAdminTask(activeTaskHandoff)
      });

      const docId = getMatchDefenseDocId(payload);
      const mode = isEditing && originalDocId === docId ? 'replace' : 'strict';
      const archiveRecord = await upsertMatchDefenseArchiveRecord(payload, archiveUsername, 'local_submit', {
        syncStatus: 'pending_sync',
        lastFirebaseAttemptAt: Date.now(),
        lastFirebaseError: ''
      });
      if (activeTaskHandoff) {
        setCompletedAdminTaskKey(taskHandoffKey);
        clearScoutTaskHandoff('defenseScout');
      }
      await deleteScoutDraft(activeDraftKey);
      skipNextDraftSaveRef.current = true;
      let syncMessage = isEditing ? 'Defense record updated successfully.' : 'Defense record submitted successfully.';
      let syncMessageType: 'success' | 'error' = 'success';
      let syncedRemotely = false;

      try {
        const writeResult = await writeMatchDefenseScoutingRecord(payload, { mode });

        if (writeResult.outcome === 'conflict') {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'unsynced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: 'Conflicting defense record already exists in Firebase.'
          });
          syncMessage = 'Saved locally. Firebase reported a conflict, so this defense record is unsynced in My History.';
          syncMessageType = 'error';
        } else {
          await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
            syncStatus: 'synced',
            lastFirebaseAttemptAt: Date.now(),
            lastFirebaseError: ''
          });
          syncedRemotely = true;
        }
      } catch (syncError) {
        console.error('Error syncing defense record to Firebase', syncError);
        await updateScoutArchiveRecordSyncState(archiveRecord.recordId, {
          syncStatus: 'unsynced',
          lastFirebaseAttemptAt: Date.now(),
          lastFirebaseError: syncError instanceof Error ? syncError.message : 'Firebase sync failed.'
        });
        syncMessage = 'Saved locally. Firebase sync failed, so this defense record is unsynced in My History.';
        syncMessageType = 'error';
      }

      if (syncedRemotely && isEditing && originalDocId && originalDocId !== docId) {
        try {
          await deleteDoc(doc(db, 'events', payload.eventKey, 'matchScoutingDefense', originalDocId));
        } catch (deleteError) {
          console.error('Failed to remove previous defense document after key change', deleteError);
        }
      }

      showNotification(syncMessage, syncMessageType);

      if (isEditing) {
        window.setTimeout(() => navigate('/history'), 900);
        return;
      }

      const nextMatchNumber = data.matchNumber + 1;
      setData(
        normalizeMatchDefenseScoutingV1({
          ...initialMatchDefenseScoutingV1,
          eventKey: payload.eventKey,
          matchType: payload.matchType,
          matchNumber: nextMatchNumber,
          matchKey: buildMatchKeyV3(payload.matchType, nextMatchNumber),
          teamNumber: '',
          scoutName: payload.assignedScoutName,
          assignedScoutName: payload.assignedScoutName,
          assignedSlot: payload.assignedSlot,
          alliance: payload.alliance,
          deviceId: payload.deviceId || persistentDeviceId
        })
      );
      setHasTouchedDefenseMetric(false);
      window.scrollTo(0, 0);
    } catch (error) {
      console.error('Error submitting defense record', error);
      showNotification('Failed to submit the defense record.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-950 p-4 pb-24 text-white md:p-6">
      {notification && (
        <div
          className={`admin-g2-sm fixed left-1/2 top-4 z-50 -translate-x-1/2 px-6 py-3 font-bold shadow-md shadow-slate-950/30 ${
            notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
          }`}
        >
          {notification.message}
        </div>
      )}

      {isArchiveUsernameResolved && !archiveUsername && (
        <div className="mb-6">
          <ScoutUsernameGate
            pendingUsername={pendingArchiveUsername}
            setPendingUsername={setPendingArchiveUsername}
            onSave={() => void handleArchiveUsernameSave()}
          />
        </div>
      )}

      <ScoutWorkflowHeader
        missionKey="defenseScout"
        title={isEditing ? 'Edit Defense Scout' : 'Defense Scout'}
        subtitle="Capture whether defense actually denied points, who it affected, and how it should influence role planning."
        handoff={activeTaskHandoff}
        onBack={() => navigate(getScoutTaskReturnPath(activeTaskHandoff ?? taskHandoff))}
        metric={(
          <div className="admin-g2-sm hidden border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-right sm:block sm:px-5 sm:py-4">
            <div className="text-xs font-black uppercase tracking-widest text-rose-200">Defense Metric</div>
            <div className="text-3xl font-black text-rose-100 sm:text-5xl">{formatDefensePercent(data.defenseMetric)}</div>
          </div>
        )}
      />

      <ScoutingMissionPanel missionKey="defenseScout" compact className="mt-6" />

      <div className="space-y-6">
        <DefenseStepNav activeStep={activeStep} data={data} hasTouchedDefenseMetric={hasTouchedDefenseMetric} onChange={handleStepChange} />
        {shouldShowDefenseMap && <DefenseImpactStrip data={data} />}

        <div ref={activeStepRef} className="scroll-mt-4">
          {activeStep === 'match' && (
            <DefenseStepFrame step="match">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2">
                  <span className={labelClass}>Archive Username</span>
                  <input value={archiveUsername} readOnly className={`${inputClass} border-slate-800 opacity-80`} />
                </label>
                <label className="space-y-2">
                  <span className={labelClass}>Event Key</span>
                  <input
                    value={data.eventKey}
                    onChange={event => {
                      const nextEventKey = sanitizeEventKey(event.target.value || DEFAULT_EVENT_KEY);
                      updateMatchIdentity({ eventKey: nextEventKey || DEFAULT_EVENT_KEY });
                    }}
                    className={inputClass}
                  />
                </label>
                <div className="space-y-2 md:col-span-2">
                  <span className={labelClass}>Assigned Scout</span>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {SCOUT_ASSIGNMENTS.map(option => (
                      <ChoiceButton
                        key={option.name}
                        active={data.assignedScoutName === option.name}
                        label={`${option.name} · ${option.slotLabel.replace('Red', 'R').replace('Blue', 'B')}`}
                        onClick={() => handleAssignedScoutChange(option.name)}
                        disabled={isEditing}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className={labelClass}>Substitute</span>
                  <div className="grid grid-cols-2 gap-2">
                    {SUBSTITUTE_SCOUTS.map(option => (
                      <ChoiceButton
                        key={option}
                        active={data.substituteScoutName === option}
                        label={option}
                        onClick={() => handleSubstituteSelect(option)}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className={labelClass}>Match Type</span>
                  <div className="grid grid-cols-2 gap-2">
                    {MATCH_TYPES.map(option => (
                      <ChoiceButton
                        key={option}
                        active={data.matchType === option}
                        label={option}
                        onClick={() => updateMatchIdentity({ matchType: option })}
                        disabled={isEditing}
                      />
                    ))}
                  </div>
                </div>
                <label className="space-y-2">
                  <span className={labelClass}>Match Number</span>
                  <input
                    value={String(data.matchNumber)}
                    onChange={event => updateMatchIdentity({ matchNumber: Math.max(1, toPositiveInt(event.target.value) || 1) })}
                    className={inputClass}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClass}>Generated Match Key</span>
                  <input value={data.matchKey.toUpperCase()} readOnly className={`${inputClass} border-slate-800 font-mono opacity-80`} />
                </label>
              </div>
              <div className="admin-g2-sm mt-4 border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-200">Schedule Status</div>
                <div className="mt-1 text-sm font-black text-white">
                  {isLoadingSchedule ? 'Loading schedule...' : assignmentWarning ? 'Manual override' : 'Auto-filled'}
                </div>
              </div>
              {assignmentWarning && (
                <div className="admin-g2-sm mt-4 flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {assignmentWarning}
                </div>
              )}
              <div className="mt-5">
                <DefenseStepFooter activeStep={activeStep} onChange={handleStepChange} />
              </div>
            </DefenseStepFrame>
          )}

          {activeStep === 'target' && (
            <DefenseStepFrame step="target">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="space-y-2">
                  <span className={labelClass}>Team Number</span>
                  <input
                    value={data.teamNumber}
                    onChange={event => updateMatchIdentity({ teamNumber: event.target.value.replace(/[^\d]/g, '') })}
                    className={inputClass}
                    inputMode="numeric"
                    pattern="[0-9]*"
                  />
                </label>
                <div className="space-y-2 md:col-span-2">
                  <span className={labelClass}>Alliance</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(['Red', 'Blue'] as const).map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateMatchIdentity({ alliance: option })}
                        className={`admin-g2-sm px-3 py-3 text-sm font-black transition-all ${
                          data.alliance === option
                            ? option === 'Red'
                              ? 'bg-red-600 text-white'
                              : 'bg-blue-600 text-white'
                            : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="admin-g2-sm mt-4 border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">
                This row describes the robot doing defense, not necessarily the team being defended.
              </div>
              {teamWarning && (
                <div className="admin-g2-sm mt-4 flex items-start gap-2 border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {teamWarning}
                </div>
              )}
              <div className="mt-5">
                <DefenseStepFooter activeStep={activeStep} onChange={handleStepChange} />
              </div>
            </DefenseStepFrame>
          )}

          {activeStep === 'impact' && (
            <DefenseStepFrame step="impact">
              <div>
                <DefenseMetricSlider
                  value={data.defenseMetric}
                  onChange={value => {
                    setHasTouchedDefenseMetric(true);
                    updateData({ defenseMetric: value });
                  }}
                />
              </div>
              <div className="mt-5">
                <DefenseStepFooter activeStep={activeStep} onChange={handleStepChange} />
              </div>
            </DefenseStepFrame>
          )}

          {activeStep === 'evidence' && (
            <DefenseStepFrame step="evidence">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className={labelClass}>Denial Evidence</span>
                  <textarea
                    value={data.defenseComments}
                    onChange={event => updateData({ defenseComments: event.target.value })}
                    className={`${inputClass} min-h-[180px]`}
                    placeholder="Name the target, where they were denied, whether cycles slowed, and whether fouls or traffic made the defense risky."
                  />
                </label>
                <label className="space-y-2">
                  <span className={labelClass}>Strategy Use</span>
                  <textarea
                    value={data.generalComments}
                    onChange={event => updateData({ generalComments: event.target.value })}
                    className={`${inputClass} min-h-[180px]`}
                    placeholder="Should we use this robot as a defender, avoid them, pair them with a scorer, or ignore the defense signal?"
                  />
                </label>
              </div>
              <div className="admin-g2-sm mt-4 border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100">
                Good evidence names the target, the denied action, the match context, and whether the defense created foul or traffic risk.
              </div>
              <div className="mt-3 grid gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-300 sm:grid-cols-3">
                <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2">1. Target defended</div>
                <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2">2. Action denied</div>
                <div className="admin-g2-sm border border-slate-800 bg-slate-950/70 px-3 py-2">3. Foul or traffic risk</div>
              </div>
              <div className="mt-5">
                <DefenseStepFooter activeStep={activeStep} onChange={handleStepChange} />
              </div>
            </DefenseStepFrame>
          )}

          {activeStep === 'handoff' && (
            <DefenseStepFrame step="handoff">
              <ScoutSignalHandoff missionKey="defenseScout" />
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
                <div className="admin-g2 border border-slate-800 bg-slate-950/55 px-5 py-4">
                  <div className={labelClass}>Current Defense Metric</div>
                  <div className="mt-1 text-4xl font-black text-white">{formatDefensePercent(data.defenseMetric)}</div>
                  <div className="mt-2 text-sm text-slate-400">{getDefenseRoleLabel(data.defenseMetric)} · stored as {data.defenseMetric.toFixed(4)}</div>
                </div>
                <div className="grid gap-3 md:min-w-72">
                  <button
                    type="button"
                    onClick={() => setShowQr(true)}
                    className="admin-g2-sm inline-flex items-center justify-center gap-2 border border-slate-700 bg-slate-950 px-5 py-4 text-sm font-black text-slate-200 hover:bg-slate-800"
                  >
                    <QrCode className="h-5 w-5" />
                    QR Export
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="admin-g2 border border-emerald-400/40 bg-emerald-500/15 px-6 py-4 text-lg font-black text-emerald-50 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    {isSubmitting ? 'SAVING...' : isEditing ? 'UPDATE DEFENSE ENTRY' : 'SUBMIT DEFENSE ENTRY'}
                  </button>
                </div>
              </div>
              <div className="mt-5">
                <DefenseStepFooter activeStep={activeStep} onChange={handleStepChange} />
              </div>
            </DefenseStepFrame>
          )}
        </div>
      </div>

      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
          <div className="admin-g2-lg relative flex w-full max-w-sm flex-col items-center bg-white p-8">
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className="admin-g2-sm absolute right-4 top-4 bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
            >
              <Download className="h-4 w-4 rotate-45" />
            </button>
            <h3 className="mb-3 text-xl font-black text-slate-900">Defense Offline QR Export</h3>
            <p className="mb-5 text-center text-sm text-slate-600">
              Scan this in Admin V4 Data when internet access is unavailable.
            </p>
            <QRCodeSVG
              value={compressMatchDefenseData(
                normalizeMatchDefenseScoutingV1({
                  ...data,
                  scoutName: archiveUsername || data.scoutName,
                  matchKey: buildMatchKeyV3(data.matchType, data.matchNumber),
                  adminTask: buildScoutEvidenceAdminTask(activeTaskHandoff)
                })
              )}
              size={280}
              includeMargin
            />
            <div className="mt-5 text-center text-xs font-mono text-slate-500">
              {data.matchKey.toUpperCase()} / Team {data.teamNumber || 'TBD'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
